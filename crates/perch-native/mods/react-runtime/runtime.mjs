function xd(n, i) {
  for (var c = 0; c < i.length; c++) {
    const s = i[c];
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
//! `:first-child`, `:last-child`, `:nth-child(n)`, `:not()`, `:is()`, `:where()`, `:root`, the state pseudo-classes
//! (`:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:enabled`, `:checked`), and the
//! descendant and child combinators. Anything else (`+`, `~`, `:has()`, pseudo-elements, ...) throws a
//! `SelectorError`, so a caller can skip a rule it cannot evaluate instead of guessing.
//!
//! An element is anything with `tagName` (lower case), `getAttribute(name)`, `parentElement` and `children`
//! (elements only). State pseudo-classes ask `options.state(element, name, isSubject)`; without it they never match.
class Se extends Error {
}
const Tp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Cp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), jp = /* @__PURE__ */ new Set(["first-child", "last-child", "root", ...Tp]);
function yo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, c, s) => c ? String.fromCodePoint(parseInt(c, 16)) : s);
}
function ci(n, i) {
  let c = i;
  for (; c < n.length; ) {
    const s = n[c];
    if (s === "\\") {
      c += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(s)) {
      c++;
      continue;
    }
    break;
  }
  if (c === i) throw new Se(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [yo(n.slice(i, c)), c];
}
function Mp(n, i) {
  let c = 1;
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
    if (u === "(") c++;
    else if (u === ")" && --c === 0) return s;
  }
  throw new Se(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Ao(n) {
  const i = [];
  let c = 0, s = 0;
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
    d === "(" || d === "[" ? c++ : d === ")" || d === "]" ? c-- : d === "," && c === 0 && (i.push(n.slice(s, u).trim()), s = u + 1);
  }
  return i.push(n.slice(s).trim()), i.filter(Boolean);
}
function Ap(n, i) {
  const c = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let s = !1;
  for (; i < n.length; ) {
    const u = n[i];
    if (u === "*") {
      c.tag = "*", i++, s = !0;
      continue;
    }
    if (u === ".") {
      const [d, p] = ci(n, i + 1);
      c.classes.push(d), i = p, s = !0;
      continue;
    }
    if (u === "#") {
      const [d, p] = ci(n, i + 1);
      c.id = d, i = p, s = !0;
      continue;
    }
    if (u === "[") {
      const d = n.indexOf("]", i);
      if (d < 0) throw new Se(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(i + 1, d).trim(), m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!m) throw new Se(`cannot read the attribute selector [${p}]`);
      const w = m[3] ?? m[4] ?? m[5];
      c.attrs.push({ name: yo(m[1]).toLowerCase(), op: m[2] ?? null, value: w === void 0 ? null : yo(w) }), i = d + 1, s = !0;
      continue;
    }
    if (u === ":") {
      if (n[i + 1] === ":") throw new Se(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = ci(n, i + 1);
      i = p;
      const m = d.toLowerCase();
      if (n[i] === "(") {
        if (!Cp.has(m)) throw new Se(`:${m}() is not supported`);
        const w = Mp(n, i + 1), y = n.slice(i + 1, w).trim();
        if (i = w + 1, m === "nth-child") {
          if (!/^\d+$/.test(y)) throw new Se(`:nth-child(${y}) is not supported (only a number)`);
          c.pseudos.push({ name: m, n: Number(y) });
        } else
          c.pseudos.push({ name: m, list: Ao(y).map(Oo) });
      } else {
        if (!jp.has(m)) throw new Se(`:${m} is not supported`);
        c.pseudos.push({ name: m });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(u) && !s) {
      const [d, p] = ci(n, i);
      c.tag = d.toLowerCase(), i = p, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new Se(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [c, i];
}
function Oo(n) {
  const i = [];
  let c = 0, s = null;
  for (n = n.trim(); c < n.length; ) {
    const [u, d] = Ap(n, c);
    i.push({ compound: u, combinator: s }), c = d;
    let p = !1;
    for (; n[c] === " " || n[c] === `
` || n[c] === "	"; )
      c++, p = !0;
    if (c >= n.length) break;
    const m = n[c];
    if (m === ">")
      for (s = ">", c++; n[c] === " "; ) c++;
    else {
      if (m === "+" || m === "~") throw new Se(`the ${m} combinator is not supported`);
      if (p) s = " ";
      else throw new Se(`unexpected ${JSON.stringify(m)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new Se("empty selector");
  return i;
}
const Dc = /* @__PURE__ */ new Map();
function zi(n) {
  let i = Dc.get(n);
  return i || (i = Ao(n).map(Oo), Dc.set(n, i)), i;
}
function wd(n) {
  const i = [0, 0, 0], c = (s) => {
    i[0] += s[0], i[1] += s[1], i[2] += s[2];
  };
  for (const { compound: s } of n) {
    s.id && i[0]++, i[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && i[2]++;
    for (const u of s.pseudos)
      if (u.name !== "where")
        if (u.list) {
          const d = u.list.map(wd).sort((p, m) => m[0] - p[0] || m[1] - p[1] || m[2] - p[2])[0];
          c(d);
        } else i[1]++;
  }
  return i;
}
function Op(n, { name: i, op: c, value: s }) {
  const u = n.getAttribute(i);
  if (u == null) return !1;
  if (c === null) return !0;
  switch (c) {
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
function uo(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Rp(n, i, c, s) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const u = n.classList ?? [];
    for (const d of i.classes) if (!u.includes(d)) return !1;
  }
  for (const u of i.attrs) if (!Op(n, u)) return !1;
  for (const u of i.pseudos)
    switch (u.name) {
      case "first-child":
        if (uo(n)[0] !== n) return !1;
        break;
      case "last-child": {
        const d = uo(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (uo(n).indexOf(n) !== u.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (u.list.some((d) => Nl(n, d, c, s))) return !1;
        break;
      case "is":
      case "where":
        if (!u.list.some((d) => Nl(n, d, c, s))) return !1;
        break;
      default:
        if (!c.state || !c.state(n, u.name, s)) return !1;
    }
  return !0;
}
function Nl(n, i, c, s = !0) {
  const u = (d, p, m) => {
    const { compound: w, combinator: y } = i[p];
    if (!Rp(d, w, c, m)) return !1;
    if (p === 0) return !0;
    if (y === ">") return !!d.parentElement && u(d.parentElement, p - 1, !1);
    for (let R = d.parentElement; R; R = R.parentElement) if (u(R, p - 1, !1)) return !0;
    return !1;
  };
  return u(n, i.length - 1, s);
}
function Hp(n, i, c = {}) {
  return (typeof i == "string" ? zi(i) : i).some((u) => Nl(n, u, c));
}
function _d(n, i, c = {}) {
  return Nl(n, i, c);
}
function vi(n, i, c = {}) {
  const s = zi(i), u = [], d = (p) => {
    for (const m of p.children)
      s.some((w) => Nl(m, w, c)) && u.push(m), d(m);
  };
  return d(n), u;
}
function Sd(n, i, c = {}) {
  const s = zi(i);
  for (let u = n; u; u = u.parentElement) if (s.some((d) => Nl(u, d, c))) return u;
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
let Up = 1;
class xo {
  constructor(i = 0, c = 0, s = 0, u = 0) {
    this.x = i, this.y = c, this.width = s, this.height = u;
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
class Ro {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, c, s) {
    const u = s === !0 || !!s?.capture;
    this.listeners.some((d) => d.type === i && d.listener === c && d.capture === u) || this.listeners.push({ type: i, listener: c, capture: u });
  }
  removeEventListener(i, c, s) {
    const u = s === !0 || !!s?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === i && d.listener === c && d.capture === u));
  }
}
class Ho {
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
class ze extends Ro {
  constructor(i, c = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${Up++}`, this.tagName = i.toLowerCase(), this.props = c, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    for (const [c, s] of Object.entries(this.props))
      c.startsWith("data-") && s != null && s !== !1 && (i[c.slice(5).replace(/-([a-z])/g, (u, d) => d.toUpperCase())] = String(s));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const c = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return c.id != null ? String(c.id) : null;
    if (i === "style") return null;
    let u = c[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (u === void 0 && !i.includes("-")) {
      const d = i.replace(/-([a-z])/g, (p, m) => m.toUpperCase());
      u = c[d];
    }
    return u == null || typeof u == "function" ? null : typeof u == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(u) : u ? "" : null : String(u);
  }
  hasAttribute(i) {
    return this.getAttribute(i) !== null;
  }
  appendChild(i) {
    return i.parentNode && i.parentNode.removeChild(i), i.parentNode = this, this.childNodes.push(i), this.touch(), i;
  }
  insertBefore(i, c) {
    i.parentNode && i.parentNode.removeChild(i);
    const s = this.childNodes.indexOf(c);
    return i.parentNode = this, s < 0 ? this.childNodes.push(i) : this.childNodes.splice(s, 0, i), this.touch(), i;
  }
  removeChild(i) {
    const c = this.childNodes.indexOf(i);
    return c >= 0 && this.childNodes.splice(c, 1), i.parentNode = null, this.touch(), i;
  }
  contains(i) {
    for (let c = i; c; c = c.parentNode) if (c === this) return !0;
    return !1;
  }
  matches(i) {
    return Hp(this, i);
  }
  closest(i) {
    return Sd(this, i);
  }
  querySelectorAll(i) {
    return vi(this, i);
  }
  querySelector(i) {
    return vi(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.bounds;
    return i ? new xo(i.x, i.y, i.width, i.height) : new xo();
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
  // ponytail: the engine has no scroll offsets a script sets, so a row scrolled into view stays where the list has it.
  scrollIntoView() {
  }
  select() {
  }
}
class Dp {
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
  setItem(i, c) {
    this.map.set(i, String(c));
  }
  removeItem(i) {
    this.map.delete(i);
  }
  clear() {
    this.map.clear();
  }
}
function Bc(n) {
  for (let i = n; i instanceof ze; i = i.parentElement) i.touch();
}
class Bp extends Ro {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new ze("html", {}, this), this.body = new ze("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new ze(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Bc(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, Bc(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return vi(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
}
class qp extends Ro {
  constructor(i, c) {
    super(), this.perch = i, this.document = c, this.location = { get hostname() {
      return i.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(i, c, ...s) {
    return globalThis.setTimeout(i, c, ...s);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function zd(n) {
  return {
    setTimeout: (i, c = 0, ...s) => n.setTimeout(() => i(...s), Math.max(0, Number(c) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
function we(n, i, c) {
  Object.defineProperty(n, i, { value: c, configurable: !0, writable: !0, enumerable: !1 });
}
function Yp(n, i = globalThis) {
  const c = new Bp(n), s = new qp(n, c);
  c.defaultView = s;
  const u = n.storage ?? new Dp();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const p = zd(n);
    we(i, "setTimeout", p.setTimeout), we(i, "clearTimeout", p.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && we(i, "queueMicrotask", (p) => {
    Promise.resolve().then(p);
  }), we(i, "requestAnimationFrame", (p) => i.setTimeout(() => p(Date.now()), 0)), we(i, "cancelAnimationFrame", (p) => i.clearTimeout(p)), we(i, "document", c), we(i, "window", s), we(i, "localStorage", u), we(i, "HTMLElement", ze), we(i, "Element", ze), we(i, "DOMRect", xo);
  const d = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!d.clipboard && n.clipboard)
    try {
      we(d, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || we(i, "navigator", d), { document: c, window: s };
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
function Uo(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var co = { exports: {} }, rt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Yc;
function Gp() {
  if (Yc) return rt;
  Yc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), c = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), u = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), R = Symbol.for("react.lazy"), H = Symbol.for("react.activity"), g = Symbol.iterator;
  function C(b) {
    return b === null || typeof b != "object" ? null : (b = g && b[g] || b["@@iterator"], typeof b == "function" ? b : null);
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
  }, x = Object.assign, z = {};
  function D(b, q, tt) {
    this.props = b, this.context = q, this.refs = z, this.updater = tt || S;
  }
  D.prototype.isReactComponent = {}, D.prototype.setState = function(b, q) {
    if (typeof b != "object" && typeof b != "function" && b != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, b, q, "setState");
  }, D.prototype.forceUpdate = function(b) {
    this.updater.enqueueForceUpdate(this, b, "forceUpdate");
  };
  function v() {
  }
  v.prototype = D.prototype;
  function N(b, q, tt) {
    this.props = b, this.context = q, this.refs = z, this.updater = tt || S;
  }
  var j = N.prototype = new v();
  j.constructor = N, x(j, D.prototype), j.isPureReactComponent = !0;
  var O = Array.isArray;
  function U() {
  }
  var E = { H: null, A: null, T: null, S: null }, k = Object.prototype.hasOwnProperty;
  function Y(b, q, tt) {
    var F = tt.ref;
    return {
      $$typeof: n,
      type: b,
      key: q,
      ref: F !== void 0 ? F : null,
      props: tt
    };
  }
  function $(b, q) {
    return Y(b.type, q, b.props);
  }
  function wt(b) {
    return typeof b == "object" && b !== null && b.$$typeof === n;
  }
  function Et(b) {
    var q = { "=": "=0", ":": "=2" };
    return "$" + b.replace(/[=:]/g, function(tt) {
      return q[tt];
    });
  }
  var Ot = /\/+/g;
  function Lt(b, q) {
    return typeof b == "object" && b !== null && b.key != null ? Et("" + b.key) : q.toString(36);
  }
  function Nt(b) {
    switch (b.status) {
      case "fulfilled":
        return b.value;
      case "rejected":
        throw b.reason;
      default:
        switch (typeof b.status == "string" ? b.then(U, U) : (b.status = "pending", b.then(
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
  function G(b, q, tt, F, I) {
    var et = typeof b;
    (et === "undefined" || et === "boolean") && (b = null);
    var vt = !1;
    if (b === null) vt = !0;
    else
      switch (et) {
        case "bigint":
        case "string":
        case "number":
          vt = !0;
          break;
        case "object":
          switch (b.$$typeof) {
            case n:
            case i:
              vt = !0;
              break;
            case R:
              return vt = b._init, G(
                vt(b._payload),
                q,
                tt,
                F,
                I
              );
          }
      }
    if (vt)
      return I = I(b), vt = F === "" ? "." + Lt(b, 0) : F, O(I) ? (tt = "", vt != null && (tt = vt.replace(Ot, "$&/") + "/"), G(I, q, tt, "", function(ja) {
        return ja;
      })) : I != null && (wt(I) && (I = $(
        I,
        tt + (I.key == null || b && b.key === I.key ? "" : ("" + I.key).replace(
          Ot,
          "$&/"
        ) + "/") + vt
      )), q.push(I)), 1;
    vt = 0;
    var Kt = F === "" ? "." : F + ":";
    if (O(b))
      for (var st = 0; st < b.length; st++)
        F = b[st], et = Kt + Lt(F, st), vt += G(
          F,
          q,
          tt,
          et,
          I
        );
    else if (st = C(b), typeof st == "function")
      for (b = st.call(b), st = 0; !(F = b.next()).done; )
        F = F.value, et = Kt + Lt(F, st++), vt += G(
          F,
          q,
          tt,
          et,
          I
        );
    else if (et === "object") {
      if (typeof b.then == "function")
        return G(
          Nt(b),
          q,
          tt,
          F,
          I
        );
      throw q = String(b), Error(
        "Objects are not valid as a React child (found: " + (q === "[object Object]" ? "object with keys {" + Object.keys(b).join(", ") + "}" : q) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return vt;
  }
  function P(b, q, tt) {
    if (b == null) return b;
    var F = [], I = 0;
    return G(b, F, "", "", function(et) {
      return q.call(tt, et, I++);
    }), F;
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
  var ot = typeof reportError == "function" ? reportError : function(b) {
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
  }, K = {
    map: P,
    forEach: function(b, q, tt) {
      P(
        b,
        function() {
          q.apply(this, arguments);
        },
        tt
      );
    },
    count: function(b) {
      var q = 0;
      return P(b, function() {
        q++;
      }), q;
    },
    toArray: function(b) {
      return P(b, function(q) {
        return q;
      }) || [];
    },
    only: function(b) {
      if (!wt(b))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return b;
    }
  };
  return rt.Activity = H, rt.Children = K, rt.Component = D, rt.Fragment = c, rt.Profiler = u, rt.PureComponent = N, rt.StrictMode = s, rt.Suspense = w, rt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = E, rt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(b) {
      return E.H.useMemoCache(b);
    }
  }, rt.cache = function(b) {
    return function() {
      return b.apply(null, arguments);
    };
  }, rt.cacheSignal = function() {
    return null;
  }, rt.cloneElement = function(b, q, tt) {
    if (b == null)
      throw Error(
        "The argument must be a React element, but you passed " + b + "."
      );
    var F = x({}, b.props), I = b.key;
    if (q != null)
      for (et in q.key !== void 0 && (I = "" + q.key), q)
        !k.call(q, et) || et === "key" || et === "__self" || et === "__source" || et === "ref" && q.ref === void 0 || (F[et] = q[et]);
    var et = arguments.length - 2;
    if (et === 1) F.children = tt;
    else if (1 < et) {
      for (var vt = Array(et), Kt = 0; Kt < et; Kt++)
        vt[Kt] = arguments[Kt + 2];
      F.children = vt;
    }
    return Y(b.type, I, F);
  }, rt.createContext = function(b) {
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
  }, rt.createElement = function(b, q, tt) {
    var F, I = {}, et = null;
    if (q != null)
      for (F in q.key !== void 0 && (et = "" + q.key), q)
        k.call(q, F) && F !== "key" && F !== "__self" && F !== "__source" && (I[F] = q[F]);
    var vt = arguments.length - 2;
    if (vt === 1) I.children = tt;
    else if (1 < vt) {
      for (var Kt = Array(vt), st = 0; st < vt; st++)
        Kt[st] = arguments[st + 2];
      I.children = Kt;
    }
    if (b && b.defaultProps)
      for (F in vt = b.defaultProps, vt)
        I[F] === void 0 && (I[F] = vt[F]);
    return Y(b, et, I);
  }, rt.createRef = function() {
    return { current: null };
  }, rt.forwardRef = function(b) {
    return { $$typeof: m, render: b };
  }, rt.isValidElement = wt, rt.lazy = function(b) {
    return {
      $$typeof: R,
      _payload: { _status: -1, _result: b },
      _init: nt
    };
  }, rt.memo = function(b, q) {
    return {
      $$typeof: y,
      type: b,
      compare: q === void 0 ? null : q
    };
  }, rt.startTransition = function(b) {
    var q = E.T, tt = {};
    E.T = tt;
    try {
      var F = b(), I = E.S;
      I !== null && I(tt, F), typeof F == "object" && F !== null && typeof F.then == "function" && F.then(U, ot);
    } catch (et) {
      ot(et);
    } finally {
      q !== null && tt.types !== null && (q.types = tt.types), E.T = q;
    }
  }, rt.unstable_useCacheRefresh = function() {
    return E.H.useCacheRefresh();
  }, rt.use = function(b) {
    return E.H.use(b);
  }, rt.useActionState = function(b, q, tt) {
    return E.H.useActionState(b, q, tt);
  }, rt.useCallback = function(b, q) {
    return E.H.useCallback(b, q);
  }, rt.useContext = function(b) {
    return E.H.useContext(b);
  }, rt.useDebugValue = function() {
  }, rt.useDeferredValue = function(b, q) {
    return E.H.useDeferredValue(b, q);
  }, rt.useEffect = function(b, q) {
    return E.H.useEffect(b, q);
  }, rt.useEffectEvent = function(b) {
    return E.H.useEffectEvent(b);
  }, rt.useId = function() {
    return E.H.useId();
  }, rt.useImperativeHandle = function(b, q, tt) {
    return E.H.useImperativeHandle(b, q, tt);
  }, rt.useInsertionEffect = function(b, q) {
    return E.H.useInsertionEffect(b, q);
  }, rt.useLayoutEffect = function(b, q) {
    return E.H.useLayoutEffect(b, q);
  }, rt.useMemo = function(b, q) {
    return E.H.useMemo(b, q);
  }, rt.useOptimistic = function(b, q) {
    return E.H.useOptimistic(b, q);
  }, rt.useReducer = function(b, q, tt) {
    return E.H.useReducer(b, q, tt);
  }, rt.useRef = function(b) {
    return E.H.useRef(b);
  }, rt.useState = function(b) {
    return E.H.useState(b);
  }, rt.useSyncExternalStore = function(b, q, tt) {
    return E.H.useSyncExternalStore(
      b,
      q,
      tt
    );
  }, rt.useTransition = function() {
    return E.H.useTransition();
  }, rt.version = "19.2.8", rt;
}
var Gc;
function Ed() {
  return Gc || (Gc = 1, co.exports = Gp()), co.exports;
}
var Ut = Ed();
const Qp = /* @__PURE__ */ Uo(Ut), Ig = /* @__PURE__ */ xd({
  __proto__: null,
  default: Qp
}, [Ut]);
var fo = { exports: {} }, rn = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Qc;
function Vp() {
  if (Qc) return rn;
  Qc = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function c(s, u, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), u.key !== void 0 && (p = "" + u.key), "key" in u) {
      d = {};
      for (var m in u)
        m !== "key" && (d[m] = u[m]);
    } else d = u;
    return u = d.ref, {
      $$typeof: n,
      type: s,
      key: p,
      ref: u !== void 0 ? u : null,
      props: d
    };
  }
  return rn.Fragment = i, rn.jsx = c, rn.jsxs = c, rn;
}
var Vc;
function Kp() {
  return Vc || (Vc = 1, fo.exports = Vp()), fo.exports;
}
var te = Kp();
const Xp = /* @__PURE__ */ Uo(te), $g = /* @__PURE__ */ xd({
  __proto__: null,
  default: Xp
}, [te]);
var mo = { exports: {} }, po = { exports: {} }, ho = { exports: {} }, go = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Kc;
function Zp() {
  return Kc || (Kc = 1, (function(n) {
    function i(G, P) {
      var nt = G.length;
      G.push(P);
      t: for (; 0 < nt; ) {
        var ot = nt - 1 >>> 1, K = G[ot];
        if (0 < u(K, P))
          G[ot] = P, G[nt] = K, nt = ot;
        else break t;
      }
    }
    function c(G) {
      return G.length === 0 ? null : G[0];
    }
    function s(G) {
      if (G.length === 0) return null;
      var P = G[0], nt = G.pop();
      if (nt !== P) {
        G[0] = nt;
        t: for (var ot = 0, K = G.length, b = K >>> 1; ot < b; ) {
          var q = 2 * (ot + 1) - 1, tt = G[q], F = q + 1, I = G[F];
          if (0 > u(tt, nt))
            F < K && 0 > u(I, tt) ? (G[ot] = I, G[F] = nt, ot = F) : (G[ot] = tt, G[q] = nt, ot = q);
          else if (F < K && 0 > u(I, nt))
            G[ot] = I, G[F] = nt, ot = F;
          else break t;
        }
      }
      return P;
    }
    function u(G, P) {
      var nt = G.sortIndex - P.sortIndex;
      return nt !== 0 ? nt : G.id - P.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      n.unstable_now = function() {
        return d.now();
      };
    } else {
      var p = Date, m = p.now();
      n.unstable_now = function() {
        return p.now() - m;
      };
    }
    var w = [], y = [], R = 1, H = null, g = 3, C = !1, S = !1, x = !1, z = !1, D = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, N = typeof setImmediate < "u" ? setImmediate : null;
    function j(G) {
      for (var P = c(y); P !== null; ) {
        if (P.callback === null) s(y);
        else if (P.startTime <= G)
          s(y), P.sortIndex = P.expirationTime, i(w, P);
        else break;
        P = c(y);
      }
    }
    function O(G) {
      if (x = !1, j(G), !S)
        if (c(w) !== null)
          S = !0, U || (U = !0, Et());
        else {
          var P = c(y);
          P !== null && Nt(O, P.startTime - G);
        }
    }
    var U = !1, E = -1, k = 5, Y = -1;
    function $() {
      return z ? !0 : !(n.unstable_now() - Y < k);
    }
    function wt() {
      if (z = !1, U) {
        var G = n.unstable_now();
        Y = G;
        var P = !0;
        try {
          t: {
            S = !1, x && (x = !1, v(E), E = -1), C = !0;
            var nt = g;
            try {
              e: {
                for (j(G), H = c(w); H !== null && !(H.expirationTime > G && $()); ) {
                  var ot = H.callback;
                  if (typeof ot == "function") {
                    H.callback = null, g = H.priorityLevel;
                    var K = ot(
                      H.expirationTime <= G
                    );
                    if (G = n.unstable_now(), typeof K == "function") {
                      H.callback = K, j(G), P = !0;
                      break e;
                    }
                    H === c(w) && s(w), j(G);
                  } else s(w);
                  H = c(w);
                }
                if (H !== null) P = !0;
                else {
                  var b = c(y);
                  b !== null && Nt(
                    O,
                    b.startTime - G
                  ), P = !1;
                }
              }
              break t;
            } finally {
              H = null, g = nt, C = !1;
            }
            P = void 0;
          }
        } finally {
          P ? Et() : U = !1;
        }
      }
    }
    var Et;
    if (typeof N == "function")
      Et = function() {
        N(wt);
      };
    else if (typeof MessageChannel < "u") {
      var Ot = new MessageChannel(), Lt = Ot.port2;
      Ot.port1.onmessage = wt, Et = function() {
        Lt.postMessage(null);
      };
    } else
      Et = function() {
        D(wt, 0);
      };
    function Nt(G, P) {
      E = D(function() {
        G(n.unstable_now());
      }, P);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(G) {
      G.callback = null;
    }, n.unstable_forceFrameRate = function(G) {
      0 > G || 125 < G ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : k = 0 < G ? Math.floor(1e3 / G) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return g;
    }, n.unstable_next = function(G) {
      switch (g) {
        case 1:
        case 2:
        case 3:
          var P = 3;
          break;
        default:
          P = g;
      }
      var nt = g;
      g = P;
      try {
        return G();
      } finally {
        g = nt;
      }
    }, n.unstable_requestPaint = function() {
      z = !0;
    }, n.unstable_runWithPriority = function(G, P) {
      switch (G) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          G = 3;
      }
      var nt = g;
      g = G;
      try {
        return P();
      } finally {
        g = nt;
      }
    }, n.unstable_scheduleCallback = function(G, P, nt) {
      var ot = n.unstable_now();
      switch (typeof nt == "object" && nt !== null ? (nt = nt.delay, nt = typeof nt == "number" && 0 < nt ? ot + nt : ot) : nt = ot, G) {
        case 1:
          var K = -1;
          break;
        case 2:
          K = 250;
          break;
        case 5:
          K = 1073741823;
          break;
        case 4:
          K = 1e4;
          break;
        default:
          K = 5e3;
      }
      return K = nt + K, G = {
        id: R++,
        callback: P,
        priorityLevel: G,
        startTime: nt,
        expirationTime: K,
        sortIndex: -1
      }, nt > ot ? (G.sortIndex = nt, i(y, G), c(w) === null && G === c(y) && (x ? (v(E), E = -1) : x = !0, Nt(O, nt - ot))) : (G.sortIndex = K, i(w, G), S || C || (S = !0, U || (U = !0, Et()))), G;
    }, n.unstable_shouldYield = $, n.unstable_wrapCallback = function(G) {
      var P = g;
      return function() {
        var nt = g;
        g = P;
        try {
          return G.apply(this, arguments);
        } finally {
          g = nt;
        }
      };
    };
  })(go)), go;
}
var Xc;
function Jp() {
  return Xc || (Xc = 1, ho.exports = Zp()), ho.exports;
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
var Zc;
function Lp() {
  return Zc || (Zc = 1, (function(n) {
    n.exports = function(i) {
      function c(t, e, a, l) {
        return new Of(t, e, a, l);
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
      function m(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(u(188));
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
              if (o === a) return p(r), t;
              if (o === l) return p(r), e;
              o = o.sibling;
            }
            throw Error(u(188));
          }
          if (a.return !== l.return) a = r, l = o;
          else {
            for (var f = !1, h = r.child; h; ) {
              if (h === a) {
                f = !0, a = r, l = o;
                break;
              }
              if (h === l) {
                f = !0, l = r, a = o;
                break;
              }
              h = h.sibling;
            }
            if (!f) {
              for (h = o.child; h; ) {
                if (h === a) {
                  f = !0, a = o, l = r;
                  break;
                }
                if (h === l) {
                  f = !0, l = o, a = r;
                  break;
                }
                h = h.sibling;
              }
              if (!f) throw Error(u(189));
            }
          }
          if (a.alternate !== l) throw Error(u(190));
        }
        if (a.tag !== 3) throw Error(u(188));
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
      function R(t) {
        return t === null || typeof t != "object" ? null : (t = ac && t[ac] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function H(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Bf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case il:
            return "Fragment";
          case Cr:
            return "Profiler";
          case tc:
            return "StrictMode";
          case Mr:
            return "Suspense";
          case Ar:
            return "SuspenseList";
          case Rr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case nl:
              return "Portal";
            case va:
              return t.displayName || "Context";
            case ec:
              return (t._context.displayName || "Context") + ".Consumer";
            case jr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Or:
              return e = t.displayName || null, e !== null ? e : H(t.type) || "Memo";
            case ba:
              e = t._payload, t = t._init;
              try {
                return H(t(e));
              } catch {
              }
          }
        return null;
      }
      function g(t) {
        return { current: t };
      }
      function C(t) {
        0 > sl || (t.current = Yr[sl], Yr[sl] = null, sl--);
      }
      function S(t, e) {
        sl++, Yr[sl] = t.current, t.current = e;
      }
      function x(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (fp(t) / mp | 0) | 0;
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
      function D(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, o = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var h = l & 134217727;
        return h !== 0 ? (l = h & ~o, l !== 0 ? r = z(l) : (f &= h, f !== 0 ? r = z(f) : a || (a = h & ~t, a !== 0 && (r = z(a))))) : (h = l & ~o, h !== 0 ? r = z(h) : f !== 0 ? r = z(f) : a || (a = l & ~t, a !== 0 && (r = z(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & o) === 0 && (o = r & -r, a = e & -e, o >= a || o === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function v(t, e) {
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
        var t = Xn;
        return Xn <<= 1, (Xn & 62914560) === 0 && (Xn = 4194304), t;
      }
      function O(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function U(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function E(t, e, a, l, r, o) {
        var f = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var h = t.entanglements, A = t.expirationTimes, B = t.hiddenUpdates;
        for (a = f & ~a; 0 < a; ) {
          var X = 31 - he(a), Q = 1 << X;
          h[X] = 0, A[X] = -1;
          var Z = B[X];
          if (Z !== null)
            for (B[X] = null, X = 0; X < Z.length; X++) {
              var ut = Z[X];
              ut !== null && (ut.lane &= -536870913);
            }
          a &= ~Q;
        }
        l !== 0 && k(t, l, 0), o !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= o & ~(f & ~e));
      }
      function k(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var l = 31 - he(e);
        t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | a & 261930;
      }
      function Y(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var l = 31 - he(a), r = 1 << l;
          r & e | t[l] & e && (t[l] |= e), a &= ~r;
        }
      }
      function $(t, e) {
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
      function Et(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function Ot(t) {
        if (typeof bp == "function" && yp(t), ge && typeof ge.setStrictMode == "function")
          try {
            ge.setStrictMode(Jl, t);
          } catch {
          }
      }
      function Lt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Nt(t) {
        if (Vr === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Vr = e && e[1] || "", Tc = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Vr + t + Tc;
      }
      function G(t, e) {
        if (!t || Kr) return "";
        Kr = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var l = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var Q = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(Q.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(Q, []);
                    } catch (ut) {
                      var Z = ut;
                    }
                    Reflect.construct(t, [], Q);
                  } else {
                    try {
                      Q.call();
                    } catch (ut) {
                      Z = ut;
                    }
                    t.call(Q.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ut) {
                    Z = ut;
                  }
                  (Q = t()) && typeof Q.catch == "function" && Q.catch(function() {
                  });
                }
              } catch (ut) {
                if (ut && Z && typeof ut.stack == "string")
                  return [ut.stack, Z.stack];
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
          var o = l.DetermineComponentFrameRoot(), f = o[0], h = o[1];
          if (f && h) {
            var A = f.split(`
`), B = h.split(`
`);
            for (r = l = 0; l < A.length && !A[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < B.length && !B[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === A.length || r === B.length)
              for (l = A.length - 1, r = B.length - 1; 1 <= l && 0 <= r && A[l] !== B[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (A[l] !== B[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || A[l] !== B[r]) {
                      var X = `
` + A[l].replace(" at new ", " at ");
                      return t.displayName && X.includes("<anonymous>") && (X = X.replace("<anonymous>", t.displayName)), X;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          Kr = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? Nt(a) : "";
      }
      function P(t, e) {
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
            return G(t.type, !1);
          case 11:
            return G(t.type.render, !1);
          case 1:
            return G(t.type, !0);
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
            e += P(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (l) {
          return `
Error generating stack: ` + l.message + `
` + l.stack;
        }
      }
      function ot(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Cc.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: nt(e)
          }, Cc.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: nt(e)
        };
      }
      function K(t, e) {
        cl[dl++] = Ll, cl[dl++] = Jn, Jn = t, Ll = e;
      }
      function b(t, e, a) {
        Ee[ke++] = Ye, Ee[ke++] = Ge, Ee[ke++] = ya, ya = t;
        var l = Ye;
        t = Ge;
        var r = 32 - he(l) - 1;
        l &= ~(1 << r), a += 1;
        var o = 32 - he(e) + r;
        if (30 < o) {
          var f = r - r % 5;
          o = (l & (1 << f) - 1).toString(32), l >>= f, r -= f, Ye = 1 << 32 - he(e) + r | a << r | l, Ge = o + t;
        } else
          Ye = 1 << o | a << r | l, Ge = t;
      }
      function q(t) {
        t.return !== null && (K(t, 1), b(t, 1, 0));
      }
      function tt(t) {
        for (; t === Jn; )
          Jn = cl[--dl], cl[dl] = null, Ll = cl[--dl], cl[dl] = null;
        for (; t === ya; )
          ya = Ee[--ke], Ee[ke] = null, Ge = Ee[--ke], Ee[ke] = null, Ye = Ee[--ke], Ee[ke] = null;
      }
      function F(t, e) {
        Ee[ke++] = Ye, Ee[ke++] = Ge, Ee[ke++] = ya, Ye = e.id, Ge = e.overflow, ya = t;
      }
      function I(t, e) {
        S(xa, e), S(Wl, t), S(It, null), t = Gf(e), C(It), S(It, t);
      }
      function et() {
        C(It), C(Wl), C(xa);
      }
      function vt(t) {
        t.memoizedState !== null && S(Ln, t);
        var e = It.current, a = Qf(e, t.type);
        e !== a && (S(Wl, t), S(It, a));
      }
      function Kt(t) {
        Wl.current === t && (C(It), C(Wl)), Ln.current === t && (C(Ln), Ie ? Ya._currentValue = rl : Ya._currentValue2 = rl);
      }
      function st(t) {
        var e = Error(
          u(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Cl(ot(e, t)), Xr;
      }
      function ja(t, e) {
        if (!le) throw Error(u(175));
        Qm(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || st(t, !0);
      }
      function Ma(t) {
        for ($t = t.return; $t; )
          switch ($t.tag) {
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
              $t = $t.return;
          }
      }
      function je(t) {
        if (!le || t !== $t) return !1;
        if (!gt) return Ma(t), gt = !0, !1;
        var e = t.tag;
        if (Gt ? e !== 3 && e !== 27 && (e !== 5 || hc(t.type) && !Qn(t.type, t.memoizedProps)) && Tt && st(t) : e !== 3 && (e !== 5 || hc(t.type) && !Qn(t.type, t.memoizedProps)) && Tt && st(t), Ma(t), e === 13) {
          if (!le) throw Error(u(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(u(317));
          Tt = Jm(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(u(317));
          Tt = Zm(t);
        } else
          Tt = Gt && e === 27 ? Am(
            t.type,
            Tt
          ) : $t ? pc(t.stateNode) : null;
        return !0;
      }
      function Me() {
        le && (Tt = $t = null, gt = !1);
      }
      function ua() {
        var t = wa;
        return t !== null && (ce === null ? ce = t : ce.push.apply(
          ce,
          t
        ), wa = null), t;
      }
      function Cl(t) {
        wa === null ? wa = [t] : wa.push(t);
      }
      function ca(t, e, a) {
        Ie ? (S(Wn, e._currentValue), e._currentValue = a) : (S(Wn, e._currentValue2), e._currentValue2 = a);
      }
      function Xe(t) {
        var e = Wn.current;
        Ie ? t._currentValue = e : t._currentValue2 = e, C(Wn);
      }
      function ki(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Ni(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var o = r.dependencies;
          if (o !== null) {
            var f = r.child;
            o = o.firstContext;
            t: for (; o !== null; ) {
              var h = o;
              o = r;
              for (var A = 0; A < e.length; A++)
                if (h.context === e[A]) {
                  o.lanes |= a, h = o.alternate, h !== null && (h.lanes |= a), ki(
                    o.return,
                    a,
                    t
                  ), l || (f = null);
                  break t;
                }
              o = h.next;
            }
          } else if (r.tag === 18) {
            if (f = r.return, f === null) throw Error(u(341));
            f.lanes |= a, o = f.alternate, o !== null && (o.lanes |= a), ki(f, a, t), f = null;
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
      function $a(t, e, a, l) {
        t = null;
        for (var r = e, o = !1; r !== null; ) {
          if (!o) {
            if ((r.flags & 524288) !== 0) o = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var f = r.alternate;
            if (f === null) throw Error(u(387));
            if (f = f.memoizedProps, f !== null) {
              var h = r.type;
              ve(r.pendingProps.value, f.value) || (t !== null ? t.push(h) : t = [h]);
            }
          } else if (r === Ln.current) {
            if (f = r.alternate, f === null) throw Error(u(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ya) : t = [Ya]);
          }
          r = r.return;
        }
        t !== null && Ni(
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
      function Aa(t) {
        Ga = t, Pe = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function Wt(t) {
        return Qo(Ga, t);
      }
      function fn(t, e) {
        return Ga === null && Aa(t), Qo(t, e);
      }
      function Qo(t, e) {
        var a = Ie ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, Pe === null) {
          if (t === null) throw Error(u(308));
          Pe = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else Pe = Pe.next = e;
        return a;
      }
      function Ti() {
        return {
          controller: new wp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function jl(t) {
        t.refCount--, t.refCount === 0 && _p(Sp, function() {
          t.controller.abort();
        });
      }
      function mn() {
      }
      function De(t) {
        t !== fl && t.next === null && (fl === null ? Fn = fl = t : fl = fl.next = t), In = !0, Zr || (Zr = !0, uf());
      }
      function Pa(t, e) {
        if (!Jr && In) {
          Jr = !0;
          do
            for (var a = !1, l = Fn; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var o = 0;
                else {
                  var f = l.suspendedLanes, h = l.pingedLanes;
                  o = (1 << 31 - he(42 | t) + 1) - 1, o &= r & ~(f & ~h), o = o & 201326741 ? o & 201326741 | 1 : o ? o | 2 : 0;
                }
                o !== 0 && (a = !0, Jo(l, o));
              } else
                o = ht, o = D(
                  l,
                  l === zt ? o : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== qa
                ), (o & 3) === 0 || v(l, o) || (a = !0, Jo(l, o));
              l = l.next;
            }
          while (a);
          Jr = !1;
        }
      }
      function Vo() {
        Ko();
      }
      function Ko() {
        In = Zr = !1;
        var t = 0;
        Qa !== 0 && If() && (t = Qa);
        for (var e = se(), a = null, l = Fn; l !== null; ) {
          var r = l.next, o = Xo(l, e);
          o === 0 ? (l.next = null, a === null ? Fn = r : a.next = r, r === null && (fl = a)) : (a = l, (t !== 0 || (o & 3) !== 0) && (In = !0)), l = r;
        }
        Qt !== 0 && Qt !== 5 || Pa(t), Qa !== 0 && (Qa = 0);
      }
      function Xo(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, o = t.pendingLanes & -62914561; 0 < o; ) {
          var f = 31 - he(o), h = 1 << f, A = r[f];
          A === -1 ? ((h & a) === 0 || (h & l) !== 0) && (r[f] = N(h, e)) : A <= e && (t.expiredLanes |= h), o &= ~h;
        }
        if (e = zt, a = ht, a = D(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== qa
        ), l = t.callbackNode, a === 0 || t === e && (_t === 2 || _t === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && Gr(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || v(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && Gr(l), Et(a)) {
            case 2:
            case 8:
              a = gp;
              break;
            case 32:
              a = Qr;
              break;
            case 268435456:
              a = vp;
              break;
            default:
              a = Qr;
          }
          return l = Zo.bind(null, t), a = Zn(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && Gr(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Zo(t, e) {
        if (Qt !== 0 && Qt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Vl() && t.callbackNode !== a)
          return null;
        var l = ht;
        return l = D(
          t,
          t === zt ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== qa
        ), l === 0 ? null : (Cu(t, l, e), Xo(t, se()), t.callbackNode != null && t.callbackNode === a ? Zo.bind(null, t) : null);
      }
      function Jo(t, e) {
        if (Vl()) return null;
        Cu(t, e, !0);
      }
      function uf() {
        nm ? im(function() {
          (mt & 6) !== 0 ? Zn(
            kc,
            Vo
          ) : Ko();
        }) : Zn(
          kc,
          Vo
        );
      }
      function Ci() {
        if (Qa === 0) {
          var t = ml;
          t === 0 && (t = Vn, Vn <<= 1, (Vn & 261888) === 0 && (Vn = 256)), Qa = t;
        }
        return Qa;
      }
      function cf(t, e) {
        if (Fl === null) {
          var a = Fl = [];
          Lr = 0, ml = Ci(), pl = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return Lr++, e.then(Lo, Lo), e;
      }
      function Lo() {
        if (--Lr === 0 && Fl !== null) {
          pl !== null && (pl.status = "fulfilled");
          var t = Fl;
          Fl = null, ml = 0, pl = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function df(t, e) {
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
      function ji() {
        var t = Va.current;
        return t !== null ? t : zt.pooledCache;
      }
      function pn(t, e) {
        e === null ? S(Va, Va.current) : S(Va, e.pool);
      }
      function Wo() {
        var t = ji();
        return t === null ? null : {
          parent: Ie ? Ct._currentValue : Ct._currentValue2,
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
          if (!xp.call(e, r) || !ve(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function Fo(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Io(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(mn, mn), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Po(t), t;
          default:
            if (typeof e.status == "string") e.then(mn, mn);
            else {
              if (t = zt, t !== null && 100 < t.shellSuspendCounter)
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
                throw t = e.reason, Po(t), t;
            }
            throw Ka = e, hl;
        }
      }
      function Oa(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ka = a, hl) : a;
        }
      }
      function $o() {
        if (Ka === null) throw Error(u(459));
        var t = Ka;
        return Ka = null, t;
      }
      function Po(t) {
        if (t === hl || t === $n)
          throw Error(u(483));
      }
      function gn(t) {
        var e = Il;
        return Il += 1, gl === null && (gl = []), Io(gl, t, e);
      }
      function Ml(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function vn(t, e) {
        throw e.$$typeof === Uf ? Error(u(525)) : (t = Object.prototype.toString.call(e), Error(
          u(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function ts(t) {
        function e(T, _) {
          if (t) {
            var M = T.deletions;
            M === null ? (T.deletions = [_], T.flags |= 16) : M.push(_);
          }
        }
        function a(T, _) {
          if (!t) return null;
          for (; _ !== null; )
            e(T, _), _ = _.sibling;
          return null;
        }
        function l(T) {
          for (var _ = /* @__PURE__ */ new Map(); T !== null; )
            T.key !== null ? _.set(T.key, T) : _.set(T.index, T), T = T.sibling;
          return _;
        }
        function r(T, _) {
          return T = Fe(T, _), T.index = 0, T.sibling = null, T;
        }
        function o(T, _, M) {
          return T.index = M, t ? (M = T.alternate, M !== null ? (M = M.index, M < _ ? (T.flags |= 67108866, _) : M) : (T.flags |= 67108866, _)) : (T.flags |= 1048576, _);
        }
        function f(T) {
          return t && T.alternate === null && (T.flags |= 67108866), T;
        }
        function h(T, _, M, V) {
          return _ === null || _.tag !== 6 ? (_ = Er(M, T.mode, V), _.return = T, _) : (_ = r(_, M), _.return = T, _);
        }
        function A(T, _, M, V) {
          var lt = M.type;
          return lt === il ? X(
            T,
            _,
            M.props.children,
            V,
            M.key
          ) : _ !== null && (_.elementType === lt || typeof lt == "object" && lt !== null && lt.$$typeof === ba && Oa(lt) === _.type) ? (_ = r(_, M.props), Ml(_, M), _.return = T, _) : (_ = qn(
            M.type,
            M.key,
            M.props,
            null,
            T.mode,
            V
          ), Ml(_, M), _.return = T, _);
        }
        function B(T, _, M, V) {
          return _ === null || _.tag !== 4 || _.stateNode.containerInfo !== M.containerInfo || _.stateNode.implementation !== M.implementation ? (_ = kr(M, T.mode, V), _.return = T, _) : (_ = r(_, M.children || []), _.return = T, _);
        }
        function X(T, _, M, V, lt) {
          return _ === null || _.tag !== 7 ? (_ = Ba(
            M,
            T.mode,
            V,
            lt
          ), _.return = T, _) : (_ = r(_, M), _.return = T, _);
        }
        function Q(T, _, M) {
          if (typeof _ == "string" && _ !== "" || typeof _ == "number" || typeof _ == "bigint")
            return _ = Er(
              "" + _,
              T.mode,
              M
            ), _.return = T, _;
          if (typeof _ == "object" && _ !== null) {
            switch (_.$$typeof) {
              case Yn:
                return M = qn(
                  _.type,
                  _.key,
                  _.props,
                  null,
                  T.mode,
                  M
                ), Ml(M, _), M.return = T, M;
              case nl:
                return _ = kr(
                  _,
                  T.mode,
                  M
                ), _.return = T, _;
              case ba:
                return _ = Oa(_), Q(T, _, M);
            }
            if (Gn(_) || R(_))
              return _ = Ba(
                _,
                T.mode,
                M,
                null
              ), _.return = T, _;
            if (typeof _.then == "function")
              return Q(T, gn(_), M);
            if (_.$$typeof === va)
              return Q(
                T,
                fn(T, _),
                M
              );
            vn(T, _);
          }
          return null;
        }
        function Z(T, _, M, V) {
          var lt = _ !== null ? _.key : null;
          if (typeof M == "string" && M !== "" || typeof M == "number" || typeof M == "bigint")
            return lt !== null ? null : h(T, _, "" + M, V);
          if (typeof M == "object" && M !== null) {
            switch (M.$$typeof) {
              case Yn:
                return M.key === lt ? A(T, _, M, V) : null;
              case nl:
                return M.key === lt ? B(T, _, M, V) : null;
              case ba:
                return M = Oa(M), Z(T, _, M, V);
            }
            if (Gn(M) || R(M))
              return lt !== null ? null : X(T, _, M, V, null);
            if (typeof M.then == "function")
              return Z(
                T,
                _,
                gn(M),
                V
              );
            if (M.$$typeof === va)
              return Z(
                T,
                _,
                fn(T, M),
                V
              );
            vn(T, M);
          }
          return null;
        }
        function ut(T, _, M, V, lt) {
          if (typeof V == "string" && V !== "" || typeof V == "number" || typeof V == "bigint")
            return T = T.get(M) || null, h(_, T, "" + V, lt);
          if (typeof V == "object" && V !== null) {
            switch (V.$$typeof) {
              case Yn:
                return T = T.get(
                  V.key === null ? M : V.key
                ) || null, A(_, T, V, lt);
              case nl:
                return T = T.get(
                  V.key === null ? M : V.key
                ) || null, B(_, T, V, lt);
              case ba:
                return V = Oa(V), ut(
                  T,
                  _,
                  M,
                  V,
                  lt
                );
            }
            if (Gn(V) || R(V))
              return T = T.get(M) || null, X(_, T, V, lt, null);
            if (typeof V.then == "function")
              return ut(
                T,
                _,
                M,
                gn(V),
                lt
              );
            if (V.$$typeof === va)
              return ut(
                T,
                _,
                M,
                fn(_, V),
                lt
              );
            vn(_, V);
          }
          return null;
        }
        function Pt(T, _, M, V) {
          for (var lt = null, jt = null, it = _, yt = _ = 0, Jt = null; it !== null && yt < M.length; yt++) {
            it.index > yt ? (Jt = it, it = null) : Jt = it.sibling;
            var xt = Z(
              T,
              it,
              M[yt],
              V
            );
            if (xt === null) {
              it === null && (it = Jt);
              break;
            }
            t && it && xt.alternate === null && e(T, it), _ = o(xt, _, yt), jt === null ? lt = xt : jt.sibling = xt, jt = xt, it = Jt;
          }
          if (yt === M.length)
            return a(T, it), gt && K(T, yt), lt;
          if (it === null) {
            for (; yt < M.length; yt++)
              it = Q(T, M[yt], V), it !== null && (_ = o(
                it,
                _,
                yt
              ), jt === null ? lt = it : jt.sibling = it, jt = it);
            return gt && K(T, yt), lt;
          }
          for (it = l(it); yt < M.length; yt++)
            Jt = ut(
              it,
              T,
              yt,
              M[yt],
              V
            ), Jt !== null && (t && Jt.alternate !== null && it.delete(
              Jt.key === null ? yt : Jt.key
            ), _ = o(
              Jt,
              _,
              yt
            ), jt === null ? lt = Jt : jt.sibling = Jt, jt = Jt);
          return t && it.forEach(function(Na) {
            return e(T, Na);
          }), gt && K(T, yt), lt;
        }
        function nn(T, _, M, V) {
          if (M == null) throw Error(u(151));
          for (var lt = null, jt = null, it = _, yt = _ = 0, Jt = null, xt = M.next(); it !== null && !xt.done; yt++, xt = M.next()) {
            it.index > yt ? (Jt = it, it = null) : Jt = it.sibling;
            var Na = Z(T, it, xt.value, V);
            if (Na === null) {
              it === null && (it = Jt);
              break;
            }
            t && it && Na.alternate === null && e(T, it), _ = o(Na, _, yt), jt === null ? lt = Na : jt.sibling = Na, jt = Na, it = Jt;
          }
          if (xt.done)
            return a(T, it), gt && K(T, yt), lt;
          if (it === null) {
            for (; !xt.done; yt++, xt = M.next())
              xt = Q(T, xt.value, V), xt !== null && (_ = o(
                xt,
                _,
                yt
              ), jt === null ? lt = xt : jt.sibling = xt, jt = xt);
            return gt && K(T, yt), lt;
          }
          for (it = l(it); !xt.done; yt++, xt = M.next())
            xt = ut(
              it,
              T,
              yt,
              xt.value,
              V
            ), xt !== null && (t && xt.alternate !== null && it.delete(xt.key === null ? yt : xt.key), _ = o(xt, _, yt), jt === null ? lt = xt : jt.sibling = xt, jt = xt);
          return t && it.forEach(function(Np) {
            return e(T, Np);
          }), gt && K(T, yt), lt;
        }
        function La(T, _, M, V) {
          if (typeof M == "object" && M !== null && M.type === il && M.key === null && (M = M.props.children), typeof M == "object" && M !== null) {
            switch (M.$$typeof) {
              case Yn:
                t: {
                  for (var lt = M.key; _ !== null; ) {
                    if (_.key === lt) {
                      if (lt = M.type, lt === il) {
                        if (_.tag === 7) {
                          a(
                            T,
                            _.sibling
                          ), V = r(
                            _,
                            M.props.children
                          ), V.return = T, T = V;
                          break t;
                        }
                      } else if (_.elementType === lt || typeof lt == "object" && lt !== null && lt.$$typeof === ba && Oa(lt) === _.type) {
                        a(
                          T,
                          _.sibling
                        ), V = r(_, M.props), Ml(V, M), V.return = T, T = V;
                        break t;
                      }
                      a(T, _);
                      break;
                    } else e(T, _);
                    _ = _.sibling;
                  }
                  M.type === il ? (V = Ba(
                    M.props.children,
                    T.mode,
                    V,
                    M.key
                  ), V.return = T, T = V) : (V = qn(
                    M.type,
                    M.key,
                    M.props,
                    null,
                    T.mode,
                    V
                  ), Ml(V, M), V.return = T, T = V);
                }
                return f(T);
              case nl:
                t: {
                  for (lt = M.key; _ !== null; ) {
                    if (_.key === lt)
                      if (_.tag === 4 && _.stateNode.containerInfo === M.containerInfo && _.stateNode.implementation === M.implementation) {
                        a(
                          T,
                          _.sibling
                        ), V = r(
                          _,
                          M.children || []
                        ), V.return = T, T = V;
                        break t;
                      } else {
                        a(T, _);
                        break;
                      }
                    else e(T, _);
                    _ = _.sibling;
                  }
                  V = kr(M, T.mode, V), V.return = T, T = V;
                }
                return f(T);
              case ba:
                return M = Oa(M), La(
                  T,
                  _,
                  M,
                  V
                );
            }
            if (Gn(M))
              return Pt(
                T,
                _,
                M,
                V
              );
            if (R(M)) {
              if (lt = R(M), typeof lt != "function")
                throw Error(u(150));
              return M = lt.call(M), nn(
                T,
                _,
                M,
                V
              );
            }
            if (typeof M.then == "function")
              return La(
                T,
                _,
                gn(M),
                V
              );
            if (M.$$typeof === va)
              return La(
                T,
                _,
                fn(T, M),
                V
              );
            vn(T, M);
          }
          return typeof M == "string" && M !== "" || typeof M == "number" || typeof M == "bigint" ? (M = "" + M, _ !== null && _.tag === 6 ? (a(T, _.sibling), V = r(_, M), V.return = T, T = V) : (a(T, _), V = Er(M, T.mode, V), V.return = T, T = V), f(T)) : a(T, _);
        }
        return function(T, _, M, V) {
          try {
            Il = 0;
            var lt = La(
              T,
              _,
              M,
              V
            );
            return gl = null, lt;
          } catch (it) {
            if (it === hl || it === $n) throw it;
            var jt = c(29, it, null, T.mode);
            return jt.lanes = V, jt.return = T, jt;
          } finally {
          }
        };
      }
      function bn() {
        for (var t = vl, e = Fr = vl = 0; e < t; ) {
          var a = Te[e];
          Te[e++] = null;
          var l = Te[e];
          Te[e++] = null;
          var r = Te[e];
          Te[e++] = null;
          var o = Te[e];
          if (Te[e++] = null, l !== null && r !== null) {
            var f = l.pending;
            f === null ? r.next = r : (r.next = f.next, f.next = r), l.pending = r;
          }
          o !== 0 && es(a, r, o);
        }
      }
      function yn(t, e, a, l) {
        Te[vl++] = t, Te[vl++] = e, Te[vl++] = a, Te[vl++] = l, Fr |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Mi(t, e, a, l) {
        return yn(t, e, a, l), xn(t);
      }
      function Ra(t, e) {
        return yn(t, null, null, e), xn(t);
      }
      function es(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, o = t.return; o !== null; )
          o.childLanes |= a, l = o.alternate, l !== null && (l.childLanes |= a), o.tag === 22 && (t = o.stateNode, t === null || t._visibility & 1 || (r = !0)), t = o, o = o.return;
        return t.tag === 3 ? (o = t.stateNode, r && e !== null && (r = 31 - he(a), t = o.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), o) : null;
      }
      function xn(t) {
        if (50 < ln)
          throw ln = 0, so = null, Error(u(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Ai(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Oi(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function da(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function fa(t, e, a) {
        var l = t.updateQueue;
        if (l === null) return null;
        if (l = l.shared, (mt & 2) !== 0) {
          var r = l.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = xn(t), es(t, null, a), e;
        }
        return yn(t, l, e, a), xn(t);
      }
      function Al(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, Y(t, a);
        }
      }
      function Ri(t, e) {
        var a = t.updateQueue, l = t.alternate;
        if (l !== null && (l = l.updateQueue, a === l)) {
          var r = null, o = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var f = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              o === null ? r = o = f : o = o.next = f, a = a.next;
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
      function Ol() {
        if (Ir) {
          var t = pl;
          if (t !== null) throw t;
        }
      }
      function Rl(t, e, a, l) {
        Ir = !1;
        var r = t.updateQueue;
        _a = !1;
        var o = r.firstBaseUpdate, f = r.lastBaseUpdate, h = r.shared.pending;
        if (h !== null) {
          r.shared.pending = null;
          var A = h, B = A.next;
          A.next = null, f === null ? o = B : f.next = B, f = A;
          var X = t.alternate;
          X !== null && (X = X.updateQueue, h = X.lastBaseUpdate, h !== f && (h === null ? X.firstBaseUpdate = B : h.next = B, X.lastBaseUpdate = A));
        }
        if (o !== null) {
          var Q = r.baseState;
          f = 0, X = B = A = null, h = o;
          do {
            var Z = h.lane & -536870913, ut = Z !== h.lane;
            if (ut ? (ht & Z) === Z : (l & Z) === Z) {
              Z !== 0 && Z === ml && (Ir = !0), X !== null && (X = X.next = {
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: null,
                next: null
              });
              t: {
                var Pt = t, nn = h;
                Z = e;
                var La = a;
                switch (nn.tag) {
                  case 1:
                    if (Pt = nn.payload, typeof Pt == "function") {
                      Q = Pt.call(
                        La,
                        Q,
                        Z
                      );
                      break t;
                    }
                    Q = Pt;
                    break t;
                  case 3:
                    Pt.flags = Pt.flags & -65537 | 128;
                  case 0:
                    if (Pt = nn.payload, Z = typeof Pt == "function" ? Pt.call(La, Q, Z) : Pt, Z == null) break t;
                    Q = Tr({}, Q, Z);
                    break t;
                  case 2:
                    _a = !0;
                }
              }
              Z = h.callback, Z !== null && (t.flags |= 64, ut && (t.flags |= 8192), ut = r.callbacks, ut === null ? r.callbacks = [Z] : ut.push(Z));
            } else
              ut = {
                lane: Z,
                tag: h.tag,
                payload: h.payload,
                callback: h.callback,
                next: null
              }, X === null ? (B = X = ut, A = Q) : X = X.next = ut, f |= Z;
            if (h = h.next, h === null) {
              if (h = r.shared.pending, h === null)
                break;
              ut = h, h = ut.next, ut.next = null, r.lastBaseUpdate = ut, r.shared.pending = null;
            }
          } while (!0);
          X === null && (A = Q), r.baseState = A, r.firstBaseUpdate = B, r.lastBaseUpdate = X, o === null && (r.shared.lanes = 0), za |= f, t.lanes = f, t.memoizedState = Q;
        }
      }
      function as(t, e) {
        if (typeof t != "function")
          throw Error(u(191, t));
        t.call(e);
      }
      function ls(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            as(a[t], e);
      }
      function ns(t, e) {
        t = aa, S(ti, t), S(bl, e), aa = t | e.baseLanes;
      }
      function Hi() {
        S(ti, aa), S(bl, bl.current);
      }
      function Ui() {
        aa = ti.current, C(bl), C(ti);
      }
      function ma(t) {
        var e = t.alternate;
        S(Ht, Ht.current & 1), S(be, t), Ce === null && (e === null || bl.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Di(t) {
        S(Ht, Ht.current), S(be, t), Ce === null && (Ce = t);
      }
      function is(t) {
        t.tag === 22 ? (S(Ht, Ht.current), S(be, t), Ce === null && (Ce = t)) : pa();
      }
      function pa() {
        S(Ht, Ht.current), S(be, be.current);
      }
      function fe(t) {
        C(be), Ce === t && (Ce = null), C(Ht);
      }
      function wn(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Dr(a) || Br(a)))
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
        throw Error(u(321));
      }
      function Bi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ve(t[a], e[a])) return !1;
        return !0;
      }
      function qi(t, e, a, l, r, o) {
        return ta = o, ct = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, at.H = t === null || t.memoizedState === null ? Ac : $r, Za = !1, o = a(l, r), Za = !1, yl && (o = os(
          e,
          a,
          l,
          r
        )), rs(t), o;
      }
      function rs(t) {
        at.H = Pl;
        var e = St !== null && St.next !== null;
        if (ta = 0, Dt = St = ct = null, ei = !1, $l = 0, xl = null, e) throw Error(u(300));
        t === null || Bt || (t = t.dependencies, t !== null && dn(t) && (Bt = !0));
      }
      function os(t, e, a, l) {
        ct = t;
        var r = 0;
        do {
          if (yl && (xl = null), $l = 0, yl = !1, 25 <= r) throw Error(u(301));
          if (r += 1, Dt = St = null, t.updateQueue != null) {
            var o = t.updateQueue;
            o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
          }
          at.H = Oc, o = e(a, l);
        } while (yl);
        return o;
      }
      function ff() {
        var t = at.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Hl(e) : e, t = t.useState()[0], (St !== null ? St.memoizedState : null) !== t && (ct.flags |= 1024), e;
      }
      function Yi() {
        var t = ai !== 0;
        return ai = 0, t;
      }
      function Gi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Qi(t) {
        if (ei) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ei = !1;
        }
        ta = 0, Dt = St = ct = null, yl = !1, $l = ai = 0, xl = null;
      }
      function ne() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Dt === null ? ct.memoizedState = Dt = t : Dt = Dt.next = t, Dt;
      }
      function Rt() {
        if (St === null) {
          var t = ct.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = St.next;
        var e = Dt === null ? ct.memoizedState : Dt.next;
        if (e !== null)
          Dt = e, St = t;
        else {
          if (t === null)
            throw ct.alternate === null ? Error(u(467)) : Error(u(310));
          St = t, t = {
            memoizedState: St.memoizedState,
            baseState: St.baseState,
            baseQueue: St.baseQueue,
            queue: St.queue,
            next: null
          }, Dt === null ? ct.memoizedState = Dt = t : Dt = Dt.next = t;
        }
        return Dt;
      }
      function _n() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Hl(t) {
        var e = $l;
        return $l += 1, xl === null && (xl = []), t = Io(xl, t, e), e = ct, (Dt === null ? e.memoizedState : Dt.next) === null && (e = e.alternate, at.H = e === null || e.memoizedState === null ? Ac : $r), t;
      }
      function Sn(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Hl(t);
          if (t.$$typeof === va) return Wt(t);
        }
        throw Error(u(438, String(t)));
      }
      function Vi(t) {
        var e = null, a = ct.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var l = ct.alternate;
          l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (e = {
            data: l.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = _n(), ct.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = Df;
        return e.index++, a;
      }
      function Ze(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function zn(t) {
        var e = Rt();
        return Ki(e, St, t);
      }
      function Ki(t, e, a) {
        var l = t.queue;
        if (l === null) throw Error(u(311));
        l.lastRenderedReducer = a;
        var r = t.baseQueue, o = l.pending;
        if (o !== null) {
          if (r !== null) {
            var f = r.next;
            r.next = o.next, o.next = f;
          }
          e.baseQueue = r = o, l.pending = null;
        }
        if (o = t.baseState, r === null) t.memoizedState = o;
        else {
          e = r.next;
          var h = f = null, A = null, B = e, X = !1;
          do {
            var Q = B.lane & -536870913;
            if (Q !== B.lane ? (ht & Q) === Q : (ta & Q) === Q) {
              var Z = B.revertLane;
              if (Z === 0)
                A !== null && (A = A.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: B.action,
                  hasEagerState: B.hasEagerState,
                  eagerState: B.eagerState,
                  next: null
                }), Q === ml && (X = !0);
              else if ((ta & Z) === Z) {
                B = B.next, Z === ml && (X = !0);
                continue;
              } else
                Q = {
                  lane: 0,
                  revertLane: B.revertLane,
                  gesture: null,
                  action: B.action,
                  hasEagerState: B.hasEagerState,
                  eagerState: B.eagerState,
                  next: null
                }, A === null ? (h = A = Q, f = o) : A = A.next = Q, ct.lanes |= Z, za |= Z;
              Q = B.action, Za && a(o, Q), o = B.hasEagerState ? B.eagerState : a(o, Q);
            } else
              Z = {
                lane: Q,
                revertLane: B.revertLane,
                gesture: B.gesture,
                action: B.action,
                hasEagerState: B.hasEagerState,
                eagerState: B.eagerState,
                next: null
              }, A === null ? (h = A = Z, f = o) : A = A.next = Z, ct.lanes |= Q, za |= Q;
            B = B.next;
          } while (B !== null && B !== e);
          if (A === null ? f = o : A.next = h, !ve(o, t.memoizedState) && (Bt = !0, X && (a = pl, a !== null)))
            throw a;
          t.memoizedState = o, t.baseState = f, t.baseQueue = A, l.lastRenderedState = o;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function Xi(t) {
        var e = Rt(), a = e.queue;
        if (a === null) throw Error(u(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, o = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var f = r = r.next;
          do
            o = t(o, f.action), f = f.next;
          while (f !== r);
          ve(o, e.memoizedState) || (Bt = !0), e.memoizedState = o, e.baseQueue === null && (e.baseState = o), a.lastRenderedState = o;
        }
        return [o, l];
      }
      function ss(t, e, a) {
        var l = ct, r = Rt(), o = gt;
        if (o) {
          if (a === void 0)
            throw Error(u(407));
          a = a();
        } else a = e();
        var f = !ve(
          (St || r).memoizedState,
          a
        );
        if (f && (r.memoizedState = a, Bt = !0), r = r.queue, Li(ds.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || f || Dt !== null && Dt.memoizedState.tag & 1) {
          if (l.flags |= 2048, tl(
            9,
            { destroy: void 0 },
            cs.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), zt === null) throw Error(u(349));
          o || (ta & 127) !== 0 || us(l, e, a);
        }
        return a;
      }
      function us(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = ct.updateQueue, e === null ? (e = _n(), ct.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function cs(t, e, a, l) {
        e.value = a, e.getSnapshot = l, fs(e) && ms(t);
      }
      function ds(t, e, a) {
        return a(function() {
          fs(e) && ms(t);
        });
      }
      function fs(t) {
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
        var e = Ra(t, 2);
        e !== null && oe(e, t, 2);
      }
      function Zi(t) {
        var e = ne();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Za) {
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
          lastRenderedReducer: Ze,
          lastRenderedState: t
        }, e;
      }
      function ps(t, e, a, l) {
        return t.baseState = a, Ki(
          t,
          St,
          typeof l == "function" ? l : Ze
        );
      }
      function mf(t, e, a, l, r) {
        if (Nn(t)) throw Error(u(485));
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
          at.T !== null ? a(!0) : o.isTransition = !1, l(o), a = e.pending, a === null ? (o.next = e.pending = o, hs(e, o)) : (o.next = a.next, e.pending = a.next = o);
        }
      }
      function hs(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var o = at.T, f = {};
          at.T = f;
          try {
            var h = a(r, l), A = at.S;
            A !== null && A(f, h), gs(t, e, h);
          } catch (B) {
            Ji(t, e, B);
          } finally {
            o !== null && f.types !== null && (o.types = f.types), at.T = o;
          }
        } else
          try {
            o = a(r, l), gs(t, e, o);
          } catch (B) {
            Ji(t, e, B);
          }
      }
      function gs(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            vs(t, e, l);
          },
          function(l) {
            return Ji(t, e, l);
          }
        ) : vs(t, e, a);
      }
      function vs(t, e, a) {
        e.status = "fulfilled", e.value = a, bs(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, hs(t, a)));
      }
      function Ji(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, bs(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function bs(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function ys(t, e) {
        return e;
      }
      function xs(t, e) {
        if (gt) {
          var a = zt.formState;
          if (a !== null) {
            t: {
              var l = ct;
              if (gt) {
                if (Tt) {
                  var r = jm(
                    Tt,
                    Ne
                  );
                  if (r) {
                    Tt = pc(r), l = Mm(r);
                    break t;
                  }
                }
                st(l);
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
          lastRenderedReducer: ys,
          lastRenderedState: e
        }, a.queue = l, a = Bs.bind(
          null,
          ct,
          l
        ), l.dispatch = a, l = Zi(!1);
        var o = $i.bind(
          null,
          ct,
          !1,
          l.queue
        );
        return l = ne(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = mf.bind(
          null,
          ct,
          r,
          o,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function ws(t) {
        var e = Rt();
        return _s(e, St, t);
      }
      function _s(t, e, a) {
        if (e = Ki(
          t,
          e,
          ys
        )[0], t = zn(Ze)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Hl(e);
          } catch (f) {
            throw f === hl ? $n : f;
          }
        else l = e;
        e = Rt();
        var r = e.queue, o = r.dispatch;
        return a !== e.memoizedState && (ct.flags |= 2048, tl(
          9,
          { destroy: void 0 },
          pf.bind(null, r, a),
          null
        )), [l, o, t];
      }
      function pf(t, e) {
        t.action = e;
      }
      function Ss(t) {
        var e = Rt(), a = St;
        if (a !== null)
          return _s(e, a, t);
        Rt(), e = e.memoizedState, a = Rt();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function tl(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = ct.updateQueue, e === null && (e = _n(), ct.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function zs() {
        return Rt().memoizedState;
      }
      function En(t, e, a, l) {
        var r = ne();
        ct.flags |= t, r.memoizedState = tl(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function kn(t, e, a, l) {
        var r = Rt();
        l = l === void 0 ? null : l;
        var o = r.memoizedState.inst;
        St !== null && l !== null && Bi(l, St.memoizedState.deps) ? r.memoizedState = tl(e, o, a, l) : (ct.flags |= t, r.memoizedState = tl(
          1 | e,
          o,
          a,
          l
        ));
      }
      function Es(t, e) {
        En(8390656, 8, t, e);
      }
      function Li(t, e) {
        kn(2048, 8, t, e);
      }
      function hf(t) {
        ct.flags |= 4;
        var e = ct.updateQueue;
        if (e === null)
          e = _n(), ct.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function ks(t) {
        var e = Rt().memoizedState;
        return hf({ ref: e, nextImpl: t }), function() {
          if ((mt & 2) !== 0)
            throw Error(u(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Ns(t, e) {
        return kn(4, 2, t, e);
      }
      function Ts(t, e) {
        return kn(4, 4, t, e);
      }
      function Cs(t, e) {
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
      function js(t, e, a) {
        a = a != null ? a.concat([t]) : null, kn(
          4,
          4,
          Cs.bind(null, e, t),
          a
        );
      }
      function Wi() {
      }
      function Ms(t, e) {
        var a = Rt();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Bi(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function As(t, e) {
        var a = Rt();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Bi(e, l[1]))
          return l[0];
        if (l = t(), Za) {
          Ot(!0);
          try {
            t();
          } finally {
            Ot(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function Fi(t, e, a) {
        return a === void 0 || (ta & 1073741824) !== 0 && (ht & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Tu(), ct.lanes |= t, za |= t, a);
      }
      function Os(t, e, a, l) {
        return ve(a, e) ? a : bl.current !== null ? (t = Fi(t, a, l), ve(t, e) || (Bt = !0), t) : (ta & 42) === 0 || (ta & 1073741824) !== 0 && (ht & 261930) === 0 ? (Bt = !0, t.memoizedState = a) : (t = Tu(), ct.lanes |= t, za |= t, e);
      }
      function Rs(t, e, a, l, r) {
        var o = $e();
        Xt(
          o !== 0 && 8 > o ? o : 8
        );
        var f = at.T, h = {};
        at.T = h, $i(t, !1, e, a);
        try {
          var A = r(), B = at.S;
          if (B !== null && B(h, A), A !== null && typeof A == "object" && typeof A.then == "function") {
            var X = df(
              A,
              l
            );
            Ul(
              t,
              e,
              X,
              me(t)
            );
          } else
            Ul(
              t,
              e,
              l,
              me(t)
            );
        } catch (Q) {
          Ul(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: Q },
            me()
          );
        } finally {
          Xt(o), f !== null && h.types !== null && (f.types = h.types), at.T = f;
        }
      }
      function Hs(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: rl,
          baseState: rl,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ze,
            lastRenderedState: rl
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
      function Ii() {
        return Wt(Ya);
      }
      function Us() {
        return Rt().memoizedState;
      }
      function Ds() {
        return Rt().memoizedState;
      }
      function gf(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = me();
              t = da(a);
              var l = fa(e, t, a);
              l !== null && (oe(l, e, a), Al(l, e, a)), e = { cache: Ti() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function vf(t, e, a) {
        var l = me();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Nn(t) ? qs(e, a) : (a = Mi(t, e, a, l), a !== null && (oe(a, t, l), Ys(a, e, l)));
      }
      function Bs(t, e, a) {
        var l = me();
        Ul(t, e, a, l);
      }
      function Ul(t, e, a, l) {
        var r = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Nn(t)) qs(e, r);
        else {
          var o = t.alternate;
          if (t.lanes === 0 && (o === null || o.lanes === 0) && (o = e.lastRenderedReducer, o !== null))
            try {
              var f = e.lastRenderedState, h = o(f, a);
              if (r.hasEagerState = !0, r.eagerState = h, ve(h, f))
                return yn(t, e, r, 0), zt === null && bn(), !1;
            } catch {
            } finally {
            }
          if (a = Mi(t, e, r, l), a !== null)
            return oe(a, t, l), Ys(a, e, l), !0;
        }
        return !1;
      }
      function $i(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: Ci(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Nn(t)) {
          if (e) throw Error(u(479));
        } else
          e = Mi(
            t,
            a,
            l,
            2
          ), e !== null && oe(e, t, 2);
      }
      function Nn(t) {
        var e = t.alternate;
        return t === ct || e !== null && e === ct;
      }
      function qs(t, e) {
        yl = ei = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Ys(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, Y(t, a);
        }
      }
      function Pi(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : Tr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Gs(t, e, a, l, r, o, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, o, f) : e.prototype && e.prototype.isPureReactComponent ? !hn(a, l) || !hn(r, o) : !0;
      }
      function Qs(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && Pr.enqueueReplaceState(e, e.state, null);
      }
      function Ha(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Tr({}, a));
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
      function Vs(t, e, a) {
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
      function tr(t, e, a) {
        return a = da(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Tn(t, e);
        }, a;
      }
      function Ks(t) {
        return t = da(t), t.tag = 3, t;
      }
      function Xs(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var o = l.value;
          t.payload = function() {
            return r(o);
          }, t.callback = function() {
            Vs(e, a, l);
          };
        }
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          Vs(e, a, l), typeof r != "function" && (Ea === null ? Ea = /* @__PURE__ */ new Set([this]) : Ea.add(this));
          var h = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: h !== null ? h : ""
          });
        });
      }
      function bf(t, e, a, l, r) {
        if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          if (e = a.alternate, e !== null && $a(
            e,
            a,
            r,
            !0
          ), a = be.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Ce === null ? Dn() : a.alternate === null && At === 0 && (At = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === Pn ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Sr(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === Pn ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Sr(t, l, r)), !1;
            }
            throw Error(u(435, a.tag));
          }
          return Sr(t, l, r), Dn(), !1;
        }
        if (gt)
          return e = be.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== Xr && (t = Error(u(422), { cause: l }), Cl(
            ot(t, a)
          ))) : (l !== Xr && (e = Error(u(423), {
            cause: l
          }), Cl(
            ot(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = ot(l, a), r = tr(
            t.stateNode,
            l,
            r
          ), Ri(t, r), At !== 4 && (At = 2)), !1;
        var o = Error(u(520), { cause: l });
        if (o = ot(o, a), en === null ? en = [o] : en.push(o), At !== 4 && (At = 2), e === null) return !0;
        l = ot(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = tr(a.stateNode, l, t), Ri(a, t), !1;
            case 1:
              if (e = a.type, o = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (Ea === null || !Ea.has(
                o
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = Ks(r), Xs(
                  r,
                  t,
                  a,
                  l
                ), Ri(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function Ft(t, e, a, l) {
        e.child = t === null ? Mc(e, null, a, l) : Xa(
          e,
          t.child,
          a,
          l
        );
      }
      function Zs(t, e, a, l, r) {
        a = a.render;
        var o = e.ref;
        if ("ref" in l) {
          var f = {};
          for (var h in l)
            h !== "ref" && (f[h] = l[h]);
        } else f = l;
        return Aa(e), l = qi(
          t,
          e,
          a,
          f,
          o,
          r
        ), h = Yi(), t !== null && !Bt ? (Gi(t, e, r), Je(t, e, r)) : (gt && h && q(e), e.flags |= 1, Ft(t, e, l, r), e.child);
      }
      function Js(t, e, a, l, r) {
        if (t === null) {
          var o = a.type;
          return typeof o == "function" && !zr(o) && o.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = o, Ls(
            t,
            e,
            o,
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
        if (o = t.child, !or(t, r)) {
          var f = o.memoizedProps;
          if (a = a.compare, a = a !== null ? a : hn, a(f, l) && t.ref === e.ref)
            return Je(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Fe(o, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Ls(t, e, a, l, r) {
        if (t !== null) {
          var o = t.memoizedProps;
          if (hn(o, l) && t.ref === e.ref)
            if (Bt = !1, e.pendingProps = l = o, or(t, r))
              (t.flags & 131072) !== 0 && (Bt = !0);
            else
              return e.lanes = t.lanes, Je(t, e, r);
        }
        return er(
          t,
          e,
          a,
          l,
          r
        );
      }
      function Ws(t, e, a, l) {
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
            return Fs(
              t,
              e,
              o,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && pn(
              e,
              o !== null ? o.cachePool : null
            ), o !== null ? ns(e, o) : Hi(), is(e);
          else
            return l = e.lanes = 536870912, Fs(
              t,
              e,
              o !== null ? o.baseLanes | a : a,
              a,
              l
            );
        } else
          o !== null ? (pn(e, o.cachePool), ns(e, o), pa(), e.memoizedState = null) : (t !== null && pn(e, null), Hi(), pa());
        return Ft(t, e, r, a), e.child;
      }
      function Dl(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Fs(t, e, a, l, r) {
        var o = ji();
        return o = o === null ? null : {
          parent: Ie ? Ct._currentValue : Ct._currentValue2,
          pool: o
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: o
        }, t !== null && pn(e, null), Hi(), is(e), t !== null && $a(t, e, l, !0), e.childLanes = r, null;
      }
      function Cn(t, e) {
        return e = Mn(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Is(t, e, a) {
        return Xa(e, t.child, null, a), t = Cn(
          e,
          e.pendingProps
        ), t.flags |= 2, fe(e), e.memoizedState = null, t;
      }
      function yf(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (gt) {
            if (l.mode === "hidden")
              return t = Cn(e, l), e.lanes = 536870912, Dl(null, t);
            if (Di(e), (t = Tt) ? (t = Ym(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: ya !== null ? { id: Ye, overflow: Ge } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Lu(t), a.return = e, e.child = a, $t = e, Tt = null)) : t = null, t === null) throw st(e);
            return e.lanes = 536870912, null;
          }
          return Cn(e, l);
        }
        var o = t.memoizedState;
        if (o !== null) {
          var f = o.dehydrated;
          if (Di(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = Is(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(u(558));
          else if (Bt || $a(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Bt || r) {
            if (l = zt, l !== null && (f = $(l, a), f !== 0 && f !== o.retryLane))
              throw o.retryLane = f, Ra(t, f), oe(l, t, f), to;
            Dn(), e = Is(
              t,
              e,
              a
            );
          } else
            t = o.treeContext, le && (Tt = Hm(f), $t = e, gt = !0, wa = null, Ne = !1, t !== null && F(e, t)), e = Cn(e, l), e.flags |= 4096;
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
            throw Error(u(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function er(t, e, a, l, r) {
        return Aa(e), a = qi(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = Yi(), t !== null && !Bt ? (Gi(t, e, r), Je(t, e, r)) : (gt && l && q(e), e.flags |= 1, Ft(t, e, a, r), e.child);
      }
      function $s(t, e, a, l, r, o) {
        return Aa(e), e.updateQueue = null, a = os(
          e,
          l,
          a,
          r
        ), rs(t), l = Yi(), t !== null && !Bt ? (Gi(t, e, o), Je(t, e, o)) : (gt && l && q(e), e.flags |= 1, Ft(t, e, a, o), e.child);
      }
      function Ps(t, e, a, l, r) {
        if (Aa(e), e.stateNode === null) {
          var o = ul, f = a.contextType;
          typeof f == "object" && f !== null && (o = Wt(f)), o = new a(l, o), e.memoizedState = o.state !== null && o.state !== void 0 ? o.state : null, o.updater = Pr, e.stateNode = o, o._reactInternals = e, o = e.stateNode, o.props = l, o.state = e.memoizedState, o.refs = {}, Ai(e), f = a.contextType, o.context = typeof f == "object" && f !== null ? Wt(f) : ul, o.state = e.memoizedState, f = a.getDerivedStateFromProps, typeof f == "function" && (Pi(
            e,
            a,
            f,
            l
          ), o.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof o.getSnapshotBeforeUpdate == "function" || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (f = o.state, typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount(), f !== o.state && Pr.enqueueReplaceState(
            o,
            o.state,
            null
          ), Rl(e, l, o, r), Ol(), o.state = e.memoizedState), typeof o.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          o = e.stateNode;
          var h = e.memoizedProps, A = Ha(a, h);
          o.props = A;
          var B = o.context, X = a.contextType;
          f = ul, typeof X == "object" && X !== null && (f = Wt(X));
          var Q = a.getDerivedStateFromProps;
          X = typeof Q == "function" || typeof o.getSnapshotBeforeUpdate == "function", h = e.pendingProps !== h, X || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (h || B !== f) && Qs(
            e,
            o,
            l,
            f
          ), _a = !1;
          var Z = e.memoizedState;
          o.state = Z, Rl(e, l, o, r), Ol(), B = e.memoizedState, h || Z !== B || _a ? (typeof Q == "function" && (Pi(
            e,
            a,
            Q,
            l
          ), B = e.memoizedState), (A = _a || Gs(
            e,
            a,
            A,
            l,
            Z,
            B,
            f
          )) ? (X || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = B), o.props = l, o.state = B, o.context = f, l = A) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          o = e.stateNode, Oi(t, e), f = e.memoizedProps, X = Ha(a, f), o.props = X, Q = e.pendingProps, Z = o.context, B = a.contextType, A = ul, typeof B == "object" && B !== null && (A = Wt(B)), h = a.getDerivedStateFromProps, (B = typeof h == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (f !== Q || Z !== A) && Qs(
            e,
            o,
            l,
            A
          ), _a = !1, Z = e.memoizedState, o.state = Z, Rl(e, l, o, r), Ol();
          var ut = e.memoizedState;
          f !== Q || Z !== ut || _a || t !== null && t.dependencies !== null && dn(t.dependencies) ? (typeof h == "function" && (Pi(
            e,
            a,
            h,
            l
          ), ut = e.memoizedState), (X = _a || Gs(
            e,
            a,
            X,
            l,
            Z,
            ut,
            A
          ) || t !== null && t.dependencies !== null && dn(t.dependencies)) ? (B || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(l, ut, A), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(
            l,
            ut,
            A
          )), typeof o.componentDidUpdate == "function" && (e.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = ut), o.props = l, o.state = ut, o.context = A, l = X) : (typeof o.componentDidUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return o = l, jn(t, e), l = (e.flags & 128) !== 0, o || l ? (o = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : o.render(), e.flags |= 1, t !== null && l ? (e.child = Xa(
          e,
          t.child,
          null,
          r
        ), e.child = Xa(
          e,
          null,
          a,
          r
        )) : Ft(t, e, a, r), e.memoizedState = o.state, t = e.child) : t = Je(
          t,
          e,
          r
        ), t;
      }
      function tu(t, e, a, l) {
        return Me(), e.flags |= 256, Ft(t, e, a, l), e.child;
      }
      function ar(t) {
        return { baseLanes: t, cachePool: Wo() };
      }
      function lr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= xe), t;
      }
      function eu(t, e, a) {
        var l = e.pendingProps, r = !1, o = (e.flags & 128) !== 0, f;
        if ((f = o) || (f = t !== null && t.memoizedState === null ? !1 : (Ht.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (gt) {
            if (r ? ma(e) : pa(), (t = Tt) ? (t = Gm(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: ya !== null ? { id: Ye, overflow: Ge } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Lu(t), a.return = e, e.child = a, $t = e, Tt = null)) : t = null, t === null) throw st(e);
            return Br(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var h = l.children;
          return l = l.fallback, r ? (pa(), r = e.mode, h = Mn(
            { mode: "hidden", children: h },
            r
          ), l = Ba(
            l,
            r,
            a,
            null
          ), h.return = e, l.return = e, h.sibling = l, e.child = h, l = e.child, l.memoizedState = ar(a), l.childLanes = lr(
            t,
            f,
            a
          ), e.memoizedState = eo, Dl(null, l)) : (ma(e), nr(e, h));
        }
        var A = t.memoizedState;
        if (A !== null && (h = A.dehydrated, h !== null)) {
          if (o)
            e.flags & 256 ? (ma(e), e.flags &= -257, e = ir(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (pa(), e.child = t.child, e.flags |= 128, e = null) : (pa(), h = l.fallback, r = e.mode, l = Mn(
              { mode: "visible", children: l.children },
              r
            ), h = Ba(
              h,
              r,
              a,
              null
            ), h.flags |= 2, l.return = e, h.return = e, l.sibling = h, e.child = l, Xa(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = ar(a), l.childLanes = lr(
              t,
              f,
              a
            ), e.memoizedState = eo, e = Dl(null, l));
          else if (ma(e), Br(h))
            f = Tm(h).digest, l = Error(u(419)), l.stack = "", l.digest = f, Cl({ value: l, source: null, stack: null }), e = ir(
              t,
              e,
              a
            );
          else if (Bt || $a(
            t,
            e,
            a,
            !1
          ), f = (a & t.childLanes) !== 0, Bt || f) {
            if (f = zt, f !== null && (l = $(
              f,
              a
            ), l !== 0 && l !== A.retryLane))
              throw A.retryLane = l, Ra(t, l), oe(f, t, l), to;
            Dr(h) || Dn(), e = ir(
              t,
              e,
              a
            );
          } else
            Dr(h) ? (e.flags |= 192, e.child = t.child, e = null) : (t = A.treeContext, le && (Tt = Um(
              h
            ), $t = e, gt = !0, wa = null, Ne = !1, t !== null && F(e, t)), e = nr(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (pa(), h = l.fallback, r = e.mode, A = t.child, o = A.sibling, l = Fe(A, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = A.subtreeFlags & 65011712, o !== null ? h = Fe(
          o,
          h
        ) : (h = Ba(
          h,
          r,
          a,
          null
        ), h.flags |= 2), h.return = e, l.return = e, l.sibling = h, e.child = l, Dl(null, l), l = e.child, h = t.child.memoizedState, h === null ? h = ar(a) : (r = h.cachePool, r !== null ? (A = Ie ? Ct._currentValue : Ct._currentValue2, r = r.parent !== A ? { parent: A, pool: A } : r) : r = Wo(), h = {
          baseLanes: h.baseLanes | a,
          cachePool: r
        }), l.memoizedState = h, l.childLanes = lr(
          t,
          f,
          a
        ), e.memoizedState = eo, Dl(t.child, l)) : (ma(e), a = t.child, t = a.sibling, a = Fe(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function nr(t, e) {
        return e = Mn(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Mn(t, e) {
        return t = c(22, t, null, e), t.lanes = 0, t;
      }
      function ir(t, e, a) {
        return Xa(e, t.child, null, a), t = nr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function au(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), ki(t.return, e, a);
      }
      function rr(t, e, a, l, r, o) {
        var f = t.memoizedState;
        f === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: r,
          treeForkCount: o
        } : (f.isBackwards = e, f.rendering = null, f.renderingStartTime = 0, f.last = l, f.tail = a, f.tailMode = r, f.treeForkCount = o);
      }
      function lu(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, o = l.tail;
        l = l.children;
        var f = Ht.current, h = (f & 2) !== 0;
        if (h ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, S(Ht, f), Ft(t, e, l, a), l = gt ? Ll : 0, !h && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && au(t, a, e);
            else if (t.tag === 19)
              au(t, a, e);
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
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), rr(
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
              if (t = r.alternate, t !== null && wn(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            rr(
              e,
              !0,
              a,
              null,
              o,
              l
            );
            break;
          case "together":
            rr(
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
        if (t !== null && (e.dependencies = t.dependencies), za |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if ($a(
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
          for (t = e.child, a = Fe(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Fe(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function or(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && dn(t)));
      }
      function xf(t, e, a) {
        switch (e.tag) {
          case 3:
            I(
              e,
              e.stateNode.containerInfo
            ), ca(e, Ct, t.memoizedState.cache), Me();
            break;
          case 27:
          case 5:
            vt(e);
            break;
          case 4:
            I(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            ca(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, Di(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (ma(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? eu(
                t,
                e,
                a
              ) : (ma(e), t = Je(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            ma(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (l = (a & e.childLanes) !== 0, l || ($a(
              t,
              e,
              a,
              !1
            ), l = (a & e.childLanes) !== 0), r) {
              if (l)
                return lu(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), S(Ht, Ht.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, Ws(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            ca(e, Ct, t.memoizedState.cache);
        }
        return Je(t, e, a);
      }
      function nu(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Bt = !0;
          else {
            if (!or(t, a) && (e.flags & 128) === 0)
              return Bt = !1, xf(
                t,
                e,
                a
              );
            Bt = (t.flags & 131072) !== 0;
          }
        else
          Bt = !1, gt && (e.flags & 1048576) !== 0 && b(e, Ll, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = Oa(e.elementType), e.type = t, typeof t == "function")
                zr(t) ? (l = Ha(t, l), e.tag = 1, e = Ps(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = er(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === jr) {
                    e.tag = 11, e = Zs(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Or) {
                    e.tag = 14, e = Js(
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
            return er(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return l = e.type, r = Ha(
              l,
              e.pendingProps
            ), Ps(
              t,
              e,
              l,
              r,
              a
            );
          case 3:
            t: {
              if (I(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(u(387));
              var o = e.pendingProps;
              r = e.memoizedState, l = r.element, Oi(t, e), Rl(e, o, null, a);
              var f = e.memoizedState;
              if (o = f.cache, ca(e, Ct, o), o !== r.cache && Ni(
                e,
                [Ct],
                a,
                !0
              ), Ol(), o = f.element, le && r.isDehydrated)
                if (r = {
                  element: o,
                  isDehydrated: !1,
                  cache: f.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = tu(
                    t,
                    e,
                    o,
                    a
                  );
                  break t;
                } else if (o !== l) {
                  l = ot(
                    Error(u(424)),
                    e
                  ), Cl(l), e = tu(
                    t,
                    e,
                    o,
                    a
                  );
                  break t;
                } else
                  for (le && (Tt = Rm(
                    e.stateNode.containerInfo
                  ), $t = e, gt = !0, wa = null, Ne = !0), a = Mc(
                    e,
                    null,
                    o,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Me(), o === l) {
                  e = Je(
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
            if (He)
              return jn(t, e), t === null ? (a = vc(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : gt || (e.stateNode = op(
                e.type,
                e.pendingProps,
                xa.current,
                e
              )) : e.memoizedState = vc(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Gt)
              return vt(e), t === null && Gt && gt && (l = e.stateNode = Sc(
                e.type,
                e.pendingProps,
                xa.current,
                It.current,
                !1
              ), $t = e, Ne = !0, Tt = Dm(
                e.type,
                l,
                Tt
              )), Ft(
                t,
                e,
                e.pendingProps.children,
                a
              ), jn(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && gt && (np(
              e.type,
              e.pendingProps,
              It.current
            ), (r = l = Tt) && (l = Bm(
              l,
              e.type,
              e.pendingProps,
              Ne
            ), l !== null ? (e.stateNode = l, $t = e, Tt = Om(l), Ne = !1, r = !0) : r = !1), r || st(e)), vt(e), r = e.type, o = e.pendingProps, f = t !== null ? t.memoizedProps : null, l = o.children, Qn(r, o) ? l = null : f !== null && Qn(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = qi(
              t,
              e,
              ff,
              null,
              null,
              a
            ), Ie ? Ya._currentValue = r : Ya._currentValue2 = r), jn(t, e), Ft(t, e, l, a), e.child;
          case 6:
            return t === null && gt && (ip(
              e.pendingProps,
              It.current
            ), (t = a = Tt) && (a = qm(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, $t = e, Tt = null, t = !0) : t = !1), t || st(e)), null;
          case 13:
            return eu(t, e, a);
          case 4:
            return I(
              e,
              e.stateNode.containerInfo
            ), l = e.pendingProps, t === null ? e.child = Xa(
              e,
              null,
              l,
              a
            ) : Ft(t, e, l, a), e.child;
          case 11:
            return Zs(
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
            return l = e.pendingProps, ca(e, e.type, l.value), Ft(
              t,
              e,
              l.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, l = e.pendingProps.children, Aa(e), r = Wt(r), l = l(r), e.flags |= 1, Ft(t, e, l, a), e.child;
          case 14:
            return Js(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Ls(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return lu(
              t,
              e,
              a
            );
          case 31:
            return yf(t, e, a);
          case 22:
            return Ws(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Aa(e), l = Wt(Ct), t === null ? (r = ji(), r === null && (r = zt, o = Ti(), r.pooledCache = o, o.refCount++, o !== null && (r.pooledCacheLanes |= a), r = o), e.memoizedState = {
              parent: l,
              cache: r
            }, Ai(e), ca(e, Ct, r)) : ((t.lanes & a) !== 0 && (Oi(t, e), Rl(e, null, null, a), Ol()), r = t.memoizedState, o = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), ca(e, Ct, l)) : (l = o.cache, ca(e, Ct, l), l !== r.cache && Ni(
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
        throw Error(u(156, e.tag));
      }
      function Ae(t) {
        t.flags |= 4;
      }
      function An(t) {
        qe && (t.flags |= 8);
      }
      function iu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function sr(t, e, a, l) {
        if (ae)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Hr(t, a.stateNode);
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
        else if (qe)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var o = r.stateNode;
              a && l && (o = fc(
                o,
                r.type,
                r.memoizedProps
              )), Hr(t, o);
            } else if (r.tag === 6)
              o = r.stateNode, a && l && (o = mc(
                o,
                r.memoizedProps
              )), Hr(t, o);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                o = r.child, o !== null && (o.return = r), sr(t, r, !0, !0);
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
      function ru(t, e, a, l) {
        var r = !1;
        if (qe)
          for (var o = e.child; o !== null; ) {
            if (o.tag === 5) {
              var f = o.stateNode;
              a && l && (f = fc(
                f,
                o.type,
                o.memoizedProps
              )), cc(t, f);
            } else if (o.tag === 6)
              f = o.stateNode, a && l && (f = mc(
                f,
                o.memoizedProps
              )), cc(t, f);
            else if (o.tag !== 4) {
              if (o.tag === 22 && o.memoizedState !== null)
                r = o.child, r !== null && (r.return = o), ru(t, o, !0, !0), r = !0;
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
      function ou(t, e) {
        if (qe && iu(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = uc();
          ru(l, e, !1, !1), t.pendingChildren = l, Ae(e), Nm(a, l);
        }
      }
      function ur(t, e, a, l) {
        if (ae)
          t.memoizedProps !== l && Ae(e);
        else if (qe) {
          var r = t.stateNode, o = t.memoizedProps;
          if ((t = iu(t, e)) || o !== l) {
            var f = It.current;
            o = km(
              r,
              a,
              o,
              l,
              !t,
              null
            ), o === r ? e.stateNode = r : (An(e), nc(
              o,
              a,
              l,
              f
            ) && Ae(e), e.stateNode = o, t && sr(o, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function cr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Pf(e, l) : tm(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Ur(e, l))
            if (rc(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Ou()) t.flags |= 8192;
            else
              throw Ka = Pn, Wr;
        } else t.flags &= -16777217;
      }
      function su(t, e) {
        if (up(e)) {
          if (t.flags |= 16777216, !_c(e))
            if (Ou()) t.flags |= 8192;
            else
              throw Ka = Pn, Wr;
        } else t.flags &= -16777217;
      }
      function On(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? j() : 536870912, t.lanes |= e, Sl |= e);
      }
      function Bl(t, e) {
        if (!gt)
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
      function wf(t, e, a) {
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
            return kt(e), null;
          case 1:
            return kt(e), null;
          case 3:
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Xe(Ct), et(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (je(e) ? Ae(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ua())), ou(t, e), kt(e), null;
          case 26:
            if (He) {
              var r = e.type, o = e.memoizedState;
              return t === null ? (Ae(e), o !== null ? (kt(e), su(
                e,
                o
              )) : (kt(e), cr(
                e,
                r,
                null,
                l,
                a
              ))) : o ? o !== t.memoizedState ? (Ae(e), kt(e), su(
                e,
                o
              )) : (kt(e), e.flags &= -16777217) : (o = t.memoizedProps, ae ? o !== l && Ae(e) : ur(
                t,
                e,
                r,
                l
              ), kt(e), cr(
                e,
                r,
                o,
                l,
                a
              )), null;
            }
          case 27:
            if (Gt) {
              if (Kt(e), a = xa.current, r = e.type, t !== null && e.stateNode != null)
                ae ? t.memoizedProps !== l && Ae(e) : ur(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(u(166));
                  return kt(e), null;
                }
                t = It.current, je(e) ? ja(e, t) : (t = Sc(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Ae(e));
              }
              return kt(e), null;
            }
          case 5:
            if (Kt(e), r = e.type, t !== null && e.stateNode != null)
              ur(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(u(166));
                return kt(e), null;
              }
              if (o = It.current, je(e))
                ja(e, o), $m(
                  e.stateNode,
                  r,
                  l,
                  o
                ) && (e.flags |= 64);
              else {
                var f = Xf(
                  r,
                  l,
                  xa.current,
                  o,
                  e
                );
                An(e), sr(f, e, !1, !1), e.stateNode = f, nc(
                  f,
                  r,
                  l,
                  o
                ) && Ae(e);
              }
            }
            return kt(e), cr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ae ? a !== l && Ae(e) : qe && (a !== l ? (t = xa.current, a = It.current, An(e), e.stateNode = ic(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(u(166));
              if (t = xa.current, a = It.current, je(e)) {
                if (!le) throw Error(u(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = $t, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                Vm(
                  t,
                  a,
                  e,
                  l
                ) || st(e, !0);
              } else
                An(e), e.stateNode = ic(
                  l,
                  t,
                  a,
                  e
                );
            }
            return kt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = je(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(u(318));
                  if (!le) throw Error(u(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(u(557));
                  Km(t, e);
                } else
                  Me(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                kt(e), t = !1;
              } else
                a = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(u(558));
            }
            return kt(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = je(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(u(318));
                  if (!le) throw Error(u(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(u(317));
                  Xm(r, e);
                } else
                  Me(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                kt(e), r = !1;
              } else
                r = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (fe(e), e) : (fe(e), null);
            }
            return fe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), o = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (o = l.memoizedState.cachePool.pool), o !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), On(e, e.updateQueue), kt(e), null);
          case 4:
            return et(), ou(t, e), t === null && Wf(e.stateNode.containerInfo), kt(e), null;
          case 10:
            return Xe(e.type), kt(e), null;
          case 19:
            if (C(Ht), l = e.memoizedState, l === null) return kt(e), null;
            if (r = (e.flags & 128) !== 0, o = l.rendering, o === null)
              if (r) Bl(l, !1);
              else {
                if (At !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (o = wn(t), o !== null) {
                      for (e.flags |= 128, Bl(l, !1), t = o.updateQueue, e.updateQueue = t, On(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Ju(a, t), a = a.sibling;
                      return S(
                        Ht,
                        Ht.current & 1 | 2
                      ), gt && K(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && se() > an && (e.flags |= 128, r = !0, Bl(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = wn(o), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, On(e, t), Bl(l, !0), l.tail === null && l.tailMode === "hidden" && !o.alternate && !gt)
                    return kt(e), null;
                } else
                  2 * se() - l.renderingStartTime > an && a !== 536870912 && (e.flags |= 128, r = !0, Bl(l, !1), e.lanes = 4194304);
              l.isBackwards ? (o.sibling = e.child, e.child = o) : (t = l.last, t !== null ? t.sibling = o : e.child = o, l.last = o);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = se(), t.sibling = null, a = Ht.current, S(
              Ht,
              r ? a & 1 | 2 : a & 1
            ), gt && K(e, l.treeForkCount), t) : (kt(e), null);
          case 22:
          case 23:
            return fe(e), Ui(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (kt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : kt(e), a = e.updateQueue, a !== null && On(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && C(Va), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Xe(Ct), kt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(u(156, e.tag));
      }
      function _f(t, e) {
        switch (tt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Xe(Ct), et(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Kt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (fe(e), e.alternate === null)
                throw Error(u(340));
              Me();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (fe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(u(340));
              Me();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return C(Ht), null;
          case 4:
            return et(), null;
          case 10:
            return Xe(e.type), null;
          case 22:
          case 23:
            return fe(e), Ui(), t !== null && C(Va), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Xe(Ct), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function uu(t, e) {
        switch (tt(e), e.tag) {
          case 3:
            Xe(Ct), et();
            break;
          case 26:
          case 27:
          case 5:
            Kt(e);
            break;
          case 4:
            et();
            break;
          case 31:
            e.memoizedState !== null && fe(e);
            break;
          case 13:
            fe(e);
            break;
          case 19:
            C(Ht);
            break;
          case 10:
            Xe(e.type);
            break;
          case 22:
          case 23:
            fe(e), Ui(), t !== null && C(Va);
            break;
          case 24:
            Xe(Ct);
        }
      }
      function ql(t, e) {
        try {
          var a = e.updateQueue, l = a !== null ? a.lastEffect : null;
          if (l !== null) {
            var r = l.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                l = void 0;
                var o = a.create, f = a.inst;
                l = o(), f.destroy = l;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (h) {
          bt(e, e.return, h);
        }
      }
      function ha(t, e, a) {
        try {
          var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
          if (r !== null) {
            var o = r.next;
            l = o;
            do {
              if ((l.tag & t) === t) {
                var f = l.inst, h = f.destroy;
                if (h !== void 0) {
                  f.destroy = void 0, r = e;
                  var A = a, B = h;
                  try {
                    B();
                  } catch (X) {
                    bt(
                      r,
                      A,
                      X
                    );
                  }
                }
              }
              l = l.next;
            } while (l !== o);
          }
        } catch (X) {
          bt(e, e.return, X);
        }
      }
      function cu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            ls(e, a);
          } catch (l) {
            bt(t, t.return, l);
          }
        }
      }
      function du(t, e, a) {
        a.props = Ha(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (l) {
          bt(t, e, l);
        }
      }
      function Yl(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var l = Kl(t.stateNode);
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
          bt(t, e, r);
        }
      }
      function Be(t, e) {
        var a = t.ref, l = t.refCleanup;
        if (a !== null)
          if (typeof l == "function")
            try {
              l();
            } catch (r) {
              bt(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (r) {
              bt(t, e, r);
            }
          else a.current = null;
      }
      function fu(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          hm(l, e, a, t);
        } catch (r) {
          bt(t, t.return, r);
        }
      }
      function dr(t, e, a) {
        try {
          gm(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          bt(t, t.return, l);
        }
      }
      function mu(t) {
        return t.tag === 5 || t.tag === 3 || (He ? t.tag === 26 : !1) || (Gt ? t.tag === 27 && ol(t.type) : !1) || t.tag === 4;
      }
      function fr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || mu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Gt && t.tag === 27 && ol(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function mr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? bm(a, t, e) : mm(a, t);
        else if (l !== 4 && (Gt && l === 27 && ol(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (mr(t, e, a), t = t.sibling; t !== null; )
            mr(t, e, a), t = t.sibling;
      }
      function Rn(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? vm(a, t, e) : fm(a, t);
        else if (l !== 4 && (Gt && l === 27 && ol(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Rn(t, e, a), t = t.sibling; t !== null; )
            Rn(t, e, a), t = t.sibling;
      }
      function pu(t, e, a) {
        t = t.containerInfo;
        try {
          dc(t, a);
        } catch (l) {
          bt(e, e.return, l);
        }
      }
      function hu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          dp(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          bt(t, t.return, l);
        }
      }
      function Sf(t, e) {
        for (Vf(t.containerInfo), Zt = e; Zt !== null; )
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
                      var f = Ha(
                        l.type,
                        r
                      );
                      e = o.getSnapshotBeforeUpdate(
                        f,
                        a
                      ), o.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (h) {
                      bt(l, l.return, h);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ae && Em(t.stateNode.containerInfo);
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
                e.return = t.return, Zt = e;
                break;
              }
              Zt = t.return;
            }
      }
      function gu(t, e, a) {
        var l = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Le(t, a), l & 4 && ql(5, a);
            break;
          case 1:
            if (Le(t, a), l & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (f) {
                  bt(a, a.return, f);
                }
              else {
                var r = Ha(
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
                  bt(
                    a,
                    a.return,
                    f
                  );
                }
              }
            l & 64 && cu(a), l & 512 && Yl(a, a.return);
            break;
          case 3:
            if (Le(t, a), l & 64 && (l = a.updateQueue, l !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Kl(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                ls(l, t);
              } catch (f) {
                bt(a, a.return, f);
              }
            }
            break;
          case 27:
            Gt && e === null && l & 4 && hu(a);
          case 26:
          case 5:
            if (Le(t, a), e === null) {
              if (l & 4) fu(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  Lm(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (f) {
                  bt(a, a.return, f);
                }
              }
            }
            l & 512 && Yl(a, a.return);
            break;
          case 12:
            Le(t, a);
            break;
          case 31:
            Le(t, a), l & 4 && bu(t, a);
            break;
          case 13:
            Le(t, a), l & 4 && yu(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = jf.bind(
              null,
              a
            ), Cm(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || ea, !l) {
              e = e !== null && e.memoizedState !== null || qt, r = ea;
              var o = qt;
              ea = l, (qt = e) && !o ? We(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Le(t, a), ea = r, qt = o;
            }
            break;
          case 30:
            break;
          default:
            Le(t, a);
        }
      }
      function vu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, vu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && $f(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Oe(t, e, a) {
        for (a = a.child; a !== null; )
          pr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function pr(t, e, a) {
        if (ge && typeof ge.onCommitFiberUnmount == "function")
          try {
            ge.onCommitFiberUnmount(Jl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (He) {
              qt || Be(a, e), Oe(
                t,
                e,
                a
              ), a.memoizedState ? yc(a.memoizedState) : a.stateNode && wc(a.stateNode);
              break;
            }
          case 27:
            if (Gt) {
              qt || Be(a, e);
              var l = Yt, r = ue;
              ol(a.type) && (Yt = a.stateNode, ue = !1), Oe(
                t,
                e,
                a
              ), zc(a.stateNode), Yt = l, ue = r;
              break;
            }
          case 5:
            qt || Be(a, e);
          case 6:
            if (ae) {
              if (l = Yt, r = ue, Yt = null, Oe(
                t,
                e,
                a
              ), Yt = l, ue = r, Yt !== null)
                if (ue)
                  try {
                    xm(Yt, a.stateNode);
                  } catch (o) {
                    bt(
                      a,
                      e,
                      o
                    );
                  }
                else
                  try {
                    ym(Yt, a.stateNode);
                  } catch (o) {
                    bt(
                      a,
                      e,
                      o
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
            ae && Yt !== null && (ue ? ep(
              Yt,
              a.stateNode
            ) : tp(Yt, a.stateNode));
            break;
          case 4:
            ae ? (l = Yt, r = ue, Yt = a.stateNode.containerInfo, ue = !0, Oe(
              t,
              e,
              a
            ), Yt = l, ue = r) : (qe && pu(
              a.stateNode,
              a,
              uc()
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
            ha(2, a, e), qt || ha(4, a, e), Oe(
              t,
              e,
              a
            );
            break;
          case 1:
            qt || (Be(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && du(
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
      function bu(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Fm(t);
          } catch (a) {
            bt(e, e.return, a);
          }
        }
      }
      function yu(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Im(t);
          } catch (a) {
            bt(e, e.return, a);
          }
      }
      function zf(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Rc()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Rc()), e;
          default:
            throw Error(u(435, t.tag));
        }
      }
      function Hn(t, e) {
        var a = zf(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = Mf.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ee(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], o = t, f = e;
            if (ae) {
              var h = f;
              t: for (; h !== null; ) {
                switch (h.tag) {
                  case 27:
                    if (Gt) {
                      if (ol(h.type)) {
                        Yt = h.stateNode, ue = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Yt = h.stateNode, ue = !1;
                    break t;
                  case 3:
                  case 4:
                    Yt = h.stateNode.containerInfo, ue = !0;
                    break t;
                }
                h = h.return;
              }
              if (Yt === null) throw Error(u(160));
              pr(o, f, r), Yt = null, ue = !1;
            } else pr(o, f, r);
            o = r.alternate, o !== null && (o.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            xu(e, t), e = e.sibling;
      }
      function xu(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ee(e, t), ie(t), l & 4 && (ha(3, t, t.return), ql(3, t), ha(5, t, t.return));
            break;
          case 1:
            ee(e, t), ie(t), l & 512 && (qt || a === null || Be(a, a.return)), l & 64 && ea && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (He) {
              var r = Ue;
              if (ee(e, t), ie(t), l & 512 && (qt || a === null || Be(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var o = t.memoizedState;
                a === null ? o === null ? t.stateNode === null ? t.stateNode = rp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : xc(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = bc(
                  r,
                  o,
                  t.memoizedProps
                ) : l !== o ? (l === null ? a.stateNode !== null && wc(a.stateNode) : yc(l), o === null ? xc(
                  r,
                  t.type,
                  t.stateNode
                ) : bc(
                  r,
                  o,
                  t.memoizedProps
                )) : o === null && t.stateNode !== null && dr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Gt) {
              ee(e, t), ie(t), l & 512 && (qt || a === null || Be(a, a.return)), a !== null && l & 4 && dr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ee(e, t), ie(t), l & 512 && (qt || a === null || Be(a, a.return)), ae) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  sc(r);
                } catch (Q) {
                  bt(t, t.return, Q);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, dr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (ao = !0);
            } else
              qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ee(e, t), ie(t), l & 4 && ae) {
              if (t.stateNode === null)
                throw Error(u(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                pm(r, a, l);
              } catch (Q) {
                bt(t, t.return, Q);
              }
            }
            break;
          case 3:
            if (He ? (sp(), r = Ue, Ue = qr(e.containerInfo), ee(e, t), Ue = r) : ee(e, t), ie(t), l & 4) {
              if (ae && le && a !== null && a.memoizedState.isDehydrated)
                try {
                  Wm(e.containerInfo);
                } catch (Q) {
                  bt(t, t.return, Q);
                }
              if (qe) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  dc(l, a);
                } catch (Q) {
                  bt(t, t.return, Q);
                }
              }
            }
            ao && (ao = !1, wu(t));
            break;
          case 4:
            He ? (a = Ue, Ue = qr(
              t.stateNode.containerInfo
            ), ee(e, t), ie(t), Ue = a) : (ee(e, t), ie(t)), l & 4 && qe && pu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ee(e, t), ie(t);
            break;
          case 31:
            ee(e, t), ie(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Hn(t, l)));
            break;
          case 13:
            ee(e, t), ie(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (si = se()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Hn(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = a !== null && a.memoizedState !== null, h = ea, A = qt;
            if (ea = h || r, qt = A || f, ee(e, t), qt = A, ea = h, ie(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || f || ea || qt || Ua(t)), ae)) {
              t: if (a = null, ae)
                for (e = t; ; ) {
                  if (e.tag === 5 || He && e.tag === 26) {
                    if (a === null) {
                      f = a = e;
                      try {
                        o = f.stateNode, r ? wm(o) : Sm(
                          f.stateNode,
                          f.memoizedProps
                        );
                      } catch (Q) {
                        bt(f, f.return, Q);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      f = e;
                      try {
                        var B = f.stateNode;
                        r ? _m(B) : zm(B, f.memoizedProps);
                      } catch (Q) {
                        bt(f, f.return, Q);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      f = e;
                      try {
                        var X = f.stateNode;
                        r ? ap(X) : lp(f.stateNode);
                      } catch (Q) {
                        bt(f, f.return, Q);
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
            ee(e, t), ie(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Hn(t, l)));
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
              if (a == null) throw Error(u(160));
              switch (a.tag) {
                case 27:
                  if (Gt) {
                    var r = a.stateNode, o = fr(t);
                    Rn(t, o, r);
                    break;
                  }
                case 5:
                  var f = a.stateNode;
                  a.flags & 32 && (sc(f), a.flags &= -33);
                  var h = fr(t);
                  Rn(t, h, f);
                  break;
                case 3:
                case 4:
                  var A = a.stateNode.containerInfo, B = fr(t);
                  mr(
                    t,
                    B,
                    A
                  );
                  break;
                default:
                  throw Error(u(161));
              }
            }
          } catch (X) {
            bt(t, t.return, X);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function wu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            wu(e), e.tag === 5 && e.flags & 1024 && lm(e.stateNode), t = t.sibling;
          }
      }
      function Le(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            gu(t, e.alternate, e), e = e.sibling;
      }
      function Ua(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ha(4, e, e.return), Ua(e);
              break;
            case 1:
              Be(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && du(
                e,
                e.return,
                a
              ), Ua(e);
              break;
            case 27:
              Gt && zc(e.stateNode);
            case 26:
            case 5:
              Be(e, e.return), Ua(e);
              break;
            case 22:
              e.memoizedState === null && Ua(e);
              break;
            case 30:
              Ua(e);
              break;
            default:
              Ua(e);
          }
          t = t.sibling;
        }
      }
      function We(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var l = e.alternate, r = t, o = e, f = o.flags;
          switch (o.tag) {
            case 0:
            case 11:
            case 15:
              We(
                r,
                o,
                a
              ), ql(4, o);
              break;
            case 1:
              if (We(
                r,
                o,
                a
              ), l = o, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (B) {
                  bt(l, l.return, B);
                }
              if (l = o, r = l.updateQueue, r !== null) {
                var h = l.stateNode;
                try {
                  var A = r.shared.hiddenCallbacks;
                  if (A !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < A.length; r++)
                      as(A[r], h);
                } catch (B) {
                  bt(l, l.return, B);
                }
              }
              a && f & 64 && cu(o), Yl(o, o.return);
              break;
            case 27:
              Gt && hu(o);
            case 26:
            case 5:
              We(
                r,
                o,
                a
              ), a && l === null && f & 4 && fu(o), Yl(o, o.return);
              break;
            case 12:
              We(
                r,
                o,
                a
              );
              break;
            case 31:
              We(
                r,
                o,
                a
              ), a && f & 4 && bu(r, o);
              break;
            case 13:
              We(
                r,
                o,
                a
              ), a && f & 4 && yu(r, o);
              break;
            case 22:
              o.memoizedState === null && We(
                r,
                o,
                a
              ), Yl(o, o.return);
              break;
            case 30:
              break;
            default:
              We(
                r,
                o,
                a
              );
          }
          e = e.sibling;
        }
      }
      function hr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && jl(a));
      }
      function gr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && jl(t));
      }
      function Re(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            _u(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function _u(t, e, a, l) {
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
            ), r & 2048 && ql(9, e);
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
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && jl(t)));
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
                var o = e.memoizedProps, f = o.id, h = o.onPostCommit;
                typeof h == "function" && h(
                  f,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (A) {
                bt(e, e.return, A);
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
            o = e.stateNode, f = e.alternate, e.memoizedState !== null ? o._visibility & 2 ? Re(
              t,
              e,
              a,
              l
            ) : Gl(
              t,
              e
            ) : o._visibility & 2 ? Re(
              t,
              e,
              a,
              l
            ) : (o._visibility |= 2, el(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && hr(f, e);
            break;
          case 24:
            Re(
              t,
              e,
              a,
              l
            ), r & 2048 && gr(e.alternate, e);
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
      function el(t, e, a, l, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var o = t, f = e, h = a, A = l, B = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              el(
                o,
                f,
                h,
                A,
                r
              ), ql(8, f);
              break;
            case 23:
              break;
            case 22:
              var X = f.stateNode;
              f.memoizedState !== null ? X._visibility & 2 ? el(
                o,
                f,
                h,
                A,
                r
              ) : Gl(
                o,
                f
              ) : (X._visibility |= 2, el(
                o,
                f,
                h,
                A,
                r
              )), r && B & 2048 && hr(
                f.alternate,
                f
              );
              break;
            case 24:
              el(
                o,
                f,
                h,
                A,
                r
              ), r && B & 2048 && gr(f.alternate, f);
              break;
            default:
              el(
                o,
                f,
                h,
                A,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Gl(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, l = e, r = l.flags;
            switch (l.tag) {
              case 22:
                Gl(a, l), r & 2048 && hr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Gl(a, l), r & 2048 && gr(
                  l.alternate,
                  l
                );
                break;
              default:
                Gl(a, l);
            }
            e = e.sibling;
          }
      }
      function Da(t, e, a) {
        if (t.subtreeFlags & wl)
          for (t = t.child; t !== null; )
            Su(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Su(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Da(
              t,
              e,
              a
            ), t.flags & wl)
              if (t.memoizedState !== null)
                cp(
                  a,
                  Ue,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Ur(r, t)) && oc(a, l, r, t);
              }
            break;
          case 5:
            Da(
              t,
              e,
              a
            ), t.flags & wl && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Ur(r, t)) && oc(a, l, r, t));
            break;
          case 3:
          case 4:
            He ? (l = Ue, Ue = qr(
              t.stateNode.containerInfo
            ), Da(
              t,
              e,
              a
            ), Ue = l) : Da(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = wl, wl = 16777216, Da(
              t,
              e,
              a
            ), wl = l) : Da(
              t,
              e,
              a
            ));
            break;
          default:
            Da(
              t,
              e,
              a
            );
        }
      }
      function zu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Ql(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Zt = l, ku(
                l,
                t
              );
            }
          zu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Eu(t), t = t.sibling;
      }
      function Eu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Ql(t), t.flags & 2048 && ha(9, t, t.return);
            break;
          case 3:
            Ql(t);
            break;
          case 12:
            Ql(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Un(t)) : Ql(t);
            break;
          default:
            Ql(t);
        }
      }
      function Un(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Zt = l, ku(
                l,
                t
              );
            }
          zu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ha(8, e, e.return), Un(e);
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
      function ku(t, e) {
        for (; Zt !== null; ) {
          var a = Zt;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              ha(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var l = a.memoizedState.cachePool.pool;
                l != null && l.refCount++;
              }
              break;
            case 24:
              jl(a.memoizedState.cache);
          }
          if (l = a.child, l !== null) l.return = a, Zt = l;
          else
            t: for (a = t; Zt !== null; ) {
              l = Zt;
              var r = l.sibling, o = l.return;
              if (vu(l), l === a) {
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
      function vr(t) {
        var e = Lf(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(u(364));
          return e;
        }
        if (t = rm(t), t === null) throw Error(u(362));
        return t.stateNode.current;
      }
      function br(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case li:
            if (t.type === e.value) return !0;
            break;
          case ni:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, o = t[a++], f = e[o];
                if (r !== 5 && r !== 26 && r !== 27 || !Zl(l)) {
                  for (; f != null && br(l, f); )
                    o++, f = e[o];
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
          case ii:
            if ((a === 5 || a === 26 || a === 27) && um(t.stateNode, e.value))
              return !0;
            break;
          case oi:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = sm(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ri:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(u(365));
        }
        return !1;
      }
      function yr(t) {
        switch (t.$$typeof) {
          case li:
            return "<" + (H(t.value) || "Unknown") + ">";
          case ni:
            return ":has(" + (yr(t) || "") + ")";
          case ii:
            return '[role="' + t.value + '"]';
          case oi:
            return '"' + t.value + '"';
          case ri:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(u(365));
        }
      }
      function Nu(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], o = r.tag, f = t[l++], h = e[f];
          if (o !== 5 && o !== 26 && o !== 27 || !Zl(r)) {
            for (; h != null && br(r, h); )
              f++, h = e[f];
            if (f === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return a;
      }
      function xr(t, e) {
        if (!Xl) throw Error(u(363));
        t = vr(t), t = Nu(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var l = t[a++], r = l.tag;
          if (r === 5 || r === 26 || r === 27)
            Zl(l) || e.push(l.stateNode);
          else
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
        }
        return e;
      }
      function me() {
        return (mt & 2) !== 0 && ht !== 0 ? ht & -ht : at.T !== null ? Ci() : Ff();
      }
      function Tu() {
        if (xe === 0)
          if ((ht & 536870912) === 0 || gt) {
            var t = Kn;
            Kn <<= 1, (Kn & 3932160) === 0 && (Kn = 262144), xe = t;
          } else xe = 536870912;
        return t = be.current, t !== null && (t.flags |= 32), xe;
      }
      function oe(t, e, a) {
        (t === zt && (_t === 2 || _t === 9) || t.cancelPendingCommit !== null) && (al(t, 0), ga(
          t,
          ht,
          xe,
          !1
        )), U(t, a), ((mt & 2) === 0 || t !== zt) && (t === zt && ((mt & 2) === 0 && (Ja |= a), At === 4 && ga(
          t,
          ht,
          xe,
          !1
        )), De(t));
      }
      function Cu(t, e, a) {
        if ((mt & 6) !== 0) throw Error(u(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || v(t, e), r = l ? Nf(t, e) : _r(t, e, !0), o = l;
        do {
          if (r === 0) {
            _l && !l && ga(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, o && !Ef(a)) {
              r = _r(t, e, !1), o = !1;
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
                  var h = t;
                  r = en;
                  var A = le && h.current.memoizedState.isDehydrated;
                  if (A && (al(h, f).flags |= 256), f = _r(
                    h,
                    f,
                    !1
                  ), f !== 2) {
                    if (lo && !A) {
                      h.errorRecoveryDisabledLanes |= o, Ja |= o, r = 4;
                      break t;
                    }
                    o = ce, ce = r, o !== null && (ce === null ? ce = o : ce.push.apply(
                      ce,
                      o
                    ));
                  }
                  r = f;
                }
                if (o = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              al(t, 0), ga(t, e, 0, !0);
              break;
            }
            t: {
              switch (l = t, o = r, o) {
                case 0:
                case 1:
                  throw Error(u(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  ga(
                    l,
                    e,
                    xe,
                    !Sa
                  );
                  break t;
                case 2:
                  ce = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(u(329));
              }
              if ((e & 62914560) === e && (r = si + 300 - se(), 10 < r)) {
                if (ga(
                  l,
                  e,
                  xe,
                  !Sa
                ), D(l, 0, !0) !== 0) break t;
                la = e, l.timeoutHandle = Zf(
                  ju.bind(
                    null,
                    l,
                    a,
                    ce,
                    ui,
                    io,
                    e,
                    xe,
                    Ja,
                    Sl,
                    Sa,
                    o,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              ju(
                l,
                a,
                ce,
                ui,
                io,
                e,
                xe,
                Ja,
                Sl,
                Sa,
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
      function ju(t, e, a, l, r, o, f, h, A, B, X, Q, Z, ut) {
        if (t.timeoutHandle = qa, Q = e.subtreeFlags, Q & 8192 || (Q & 16785408) === 16785408) {
          Q = em(), Su(
            e,
            o,
            Q
          );
          var Pt = (o & 62914560) === o ? si - se() : (o & 4194048) === o ? Hc - se() : 0;
          if (Pt = am(
            Q,
            Pt
          ), Pt !== null) {
            la = o, t.cancelPendingCommit = Pt(
              qu.bind(
                null,
                t,
                e,
                o,
                a,
                l,
                r,
                f,
                h,
                A,
                X,
                Q,
                null,
                Z,
                ut
              )
            ), ga(t, o, f, !B);
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
          f,
          h,
          A
        );
      }
      function Ef(t) {
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
      function ga(t, e, a, l) {
        e &= ~no, e &= ~Ja, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var o = 31 - he(r), f = 1 << o;
          l[o] = -1, r &= ~f;
        }
        a !== 0 && k(t, a, e);
      }
      function Mu() {
        return (mt & 6) === 0 ? (Pa(0), !1) : !0;
      }
      function wr() {
        if (pt !== null) {
          if (_t === 0)
            var t = pt.return;
          else
            t = pt, Pe = Ga = null, Qi(t), gl = null, Il = 0, t = pt;
          for (; t !== null; )
            uu(t.alternate, t), t = t.return;
          pt = null;
        }
      }
      function al(t, e) {
        var a = t.timeoutHandle;
        a !== qa && (t.timeoutHandle = qa, Jf(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), la = 0, wr(), zt = t, pt = a = Fe(t.current, null), ht = e, _t = 0, ye = null, Sa = !1, _l = v(t, e), lo = !1, Sl = xe = no = Ja = za = At = 0, ce = en = null, io = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - he(l), o = 1 << r;
            e |= t[r], l &= ~o;
          }
        return aa = e, bn(), a;
      }
      function Au(t, e) {
        ct = null, at.H = Pl, e === hl || e === $n ? (e = $o(), _t = 3) : e === Wr ? (e = $o(), _t = 4) : _t = e === to ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ye = e, pt === null && (At = 1, Tn(
          t,
          ot(e, t.current)
        ));
      }
      function Ou() {
        var t = be.current;
        return t === null ? !0 : (ht & 4194048) === ht ? Ce === null : (ht & 62914560) === ht || (ht & 536870912) !== 0 ? t === Ce : !1;
      }
      function Ru() {
        var t = at.H;
        return at.H = Pl, t === null ? Pl : t;
      }
      function Hu() {
        var t = at.A;
        return at.A = Ep, t;
      }
      function Dn() {
        At = 4, Sa || (ht & 4194048) !== ht && be.current !== null || (_l = !0), (za & 134217727) === 0 && (Ja & 134217727) === 0 || zt === null || ga(
          zt,
          ht,
          xe,
          !1
        );
      }
      function _r(t, e, a) {
        var l = mt;
        mt |= 2;
        var r = Ru(), o = Hu();
        (zt !== t || ht !== e) && (ui = null, al(t, e)), e = !1;
        var f = At;
        t: do
          try {
            if (_t !== 0 && pt !== null) {
              var h = pt, A = ye;
              switch (_t) {
                case 8:
                  wr(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  be.current === null && (e = !0);
                  var B = _t;
                  if (_t = 0, ye = null, ll(t, h, A, B), a && _l) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  B = _t, _t = 0, ye = null, ll(t, h, A, B);
              }
            }
            kf(), f = At;
            break;
          } catch (X) {
            Au(t, X);
          }
        while (!0);
        return e && t.shellSuspendCounter++, Pe = Ga = null, mt = l, at.H = r, at.A = o, pt === null && (zt = null, ht = 0, bn()), f;
      }
      function kf() {
        for (; pt !== null; ) Uu(pt);
      }
      function Nf(t, e) {
        var a = mt;
        mt |= 2;
        var l = Ru(), r = Hu();
        zt !== t || ht !== e ? (ui = null, an = se() + 500, al(t, e)) : _l = v(
          t,
          e
        );
        t: do
          try {
            if (_t !== 0 && pt !== null) {
              e = pt;
              var o = ye;
              e: switch (_t) {
                case 1:
                  _t = 0, ye = null, ll(t, e, o, 1);
                  break;
                case 2:
                case 9:
                  if (Fo(o)) {
                    _t = 0, ye = null, Du(e);
                    break;
                  }
                  e = function() {
                    _t !== 2 && _t !== 9 || zt !== t || (_t = 7), De(t);
                  }, o.then(e, e);
                  break t;
                case 3:
                  _t = 7;
                  break t;
                case 4:
                  _t = 5;
                  break t;
                case 7:
                  Fo(o) ? (_t = 0, ye = null, Du(e)) : (_t = 0, ye = null, ll(t, e, o, 7));
                  break;
                case 5:
                  var f = null;
                  switch (pt.tag) {
                    case 26:
                      f = pt.memoizedState;
                    case 5:
                    case 27:
                      var h = pt, A = h.type, B = h.pendingProps;
                      if (f ? _c(f) : rc(h.stateNode, A, B)) {
                        _t = 0, ye = null;
                        var X = h.sibling;
                        if (X !== null) pt = X;
                        else {
                          var Q = h.return;
                          Q !== null ? (pt = Q, Bn(Q)) : pt = null;
                        }
                        break e;
                      }
                  }
                  _t = 0, ye = null, ll(t, e, o, 5);
                  break;
                case 6:
                  _t = 0, ye = null, ll(t, e, o, 6);
                  break;
                case 8:
                  wr(), At = 6;
                  break t;
                default:
                  throw Error(u(462));
              }
            }
            Tf();
            break;
          } catch (Z) {
            Au(t, Z);
          }
        while (!0);
        return Pe = Ga = null, at.H = l, at.A = r, mt = a, pt !== null ? 0 : (zt = null, ht = 0, bn(), At);
      }
      function Tf() {
        for (; pt !== null && !pp(); )
          Uu(pt);
      }
      function Uu(t) {
        var e = nu(
          t.alternate,
          t,
          aa
        );
        t.memoizedProps = t.pendingProps, e === null ? Bn(t) : pt = e;
      }
      function Du(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = $s(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              ht
            );
            break;
          case 11:
            e = $s(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              ht
            );
            break;
          case 5:
            Qi(e);
          default:
            uu(a, e), e = pt = Ju(e, aa), e = nu(a, e, aa);
        }
        t.memoizedProps = t.pendingProps, e === null ? Bn(t) : pt = e;
      }
      function ll(t, e, a, l) {
        Pe = Ga = null, Qi(e), gl = null, Il = 0;
        var r = e.return;
        try {
          if (bf(
            t,
            r,
            e,
            a,
            ht
          )) {
            At = 1, Tn(
              t,
              ot(a, t.current)
            ), pt = null;
            return;
          }
        } catch (o) {
          if (r !== null) throw pt = r, o;
          At = 1, Tn(
            t,
            ot(a, t.current)
          ), pt = null;
          return;
        }
        e.flags & 32768 ? (gt || l === 1 ? t = !0 : _l || (ht & 536870912) !== 0 ? t = !1 : (Sa = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = be.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Bu(e, t)) : Bn(e);
      }
      function Bn(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Bu(
              e,
              Sa
            );
            return;
          }
          t = e.return;
          var a = wf(
            e.alternate,
            e,
            aa
          );
          if (a !== null) {
            pt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            pt = e;
            return;
          }
          pt = e = t;
        } while (e !== null);
        At === 0 && (At = 5);
      }
      function Bu(t, e) {
        do {
          var a = _f(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, pt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            pt = t;
            return;
          }
          pt = t = a;
        } while (t !== null);
        At = 6, pt = null;
      }
      function qu(t, e, a, l, r, o, f, h, A) {
        t.cancelPendingCommit = null;
        do
          Vl();
        while (Qt !== 0);
        if ((mt & 6) !== 0) throw Error(u(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(u(177));
          if (o = e.lanes | e.childLanes, o |= Fr, E(
            t,
            a,
            o,
            f,
            h,
            A
          ), t === zt && (pt = zt = null, ht = 0), zl = e, ka = t, la = a, ro = o, oo = r, Uc = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Af(Qr, function() {
            return Ku(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = at.T, at.T = null, r = $e(), Xt(2), f = mt, mt |= 4;
            try {
              Sf(t, e, a);
            } finally {
              mt = f, Xt(r), at.T = l;
            }
          }
          Qt = 1, Yu(), Gu(), Qu();
        }
      }
      function Yu() {
        if (Qt === 1) {
          Qt = 0;
          var t = ka, e = zl, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = at.T, at.T = null;
            var l = $e();
            Xt(2);
            var r = mt;
            mt |= 4;
            try {
              xu(e, t), Kf(t.containerInfo);
            } finally {
              mt = r, Xt(l), at.T = a;
            }
          }
          t.current = e, Qt = 2;
        }
      }
      function Gu() {
        if (Qt === 2) {
          Qt = 0;
          var t = ka, e = zl, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = at.T, at.T = null;
            var l = $e();
            Xt(2);
            var r = mt;
            mt |= 4;
            try {
              gu(t, e.alternate, e);
            } finally {
              mt = r, Xt(l), at.T = a;
            }
          }
          Qt = 3;
        }
      }
      function Qu() {
        if (Qt === 4 || Qt === 3) {
          Qt = 0, hp();
          var t = ka, e = zl, a = la, l = Uc;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Qt = 5 : (Qt = 0, zl = ka = null, Vu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Ea = null), Et(a), e = e.stateNode, ge && typeof ge.onCommitFiberRoot == "function")
            try {
              ge.onCommitFiberRoot(
                Jl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (l !== null) {
            e = at.T, r = $e(), Xt(2), at.T = null;
            try {
              for (var o = t.onRecoverableError, f = 0; f < l.length; f++) {
                var h = l[f];
                o(h.value, {
                  componentStack: h.stack
                });
              }
            } finally {
              at.T = e, Xt(r);
            }
          }
          (la & 3) !== 0 && Vl(), De(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === so ? ln++ : (ln = 0, so = t) : ln = 0, le && Pm(), Pa(0);
        }
      }
      function Vu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, jl(e)));
      }
      function Vl() {
        return Yu(), Gu(), Qu(), Ku();
      }
      function Ku() {
        if (Qt !== 5) return !1;
        var t = ka, e = ro;
        ro = 0;
        var a = Et(la), l = 32 > a ? 32 : a;
        a = at.T;
        var r = $e();
        try {
          Xt(l), at.T = null, l = oo, oo = null;
          var o = ka, f = la;
          if (Qt = 0, zl = ka = null, la = 0, (mt & 6) !== 0)
            throw Error(u(331));
          var h = mt;
          if (mt |= 4, Eu(o.current), _u(
            o,
            o.current,
            f,
            l
          ), mt = h, Pa(0, !1), ge && typeof ge.onPostCommitFiberRoot == "function")
            try {
              ge.onPostCommitFiberRoot(Jl, o);
            } catch {
            }
          return !0;
        } finally {
          Xt(r), at.T = a, Vu(t, e);
        }
      }
      function Xu(t, e, a) {
        e = ot(a, e), e = tr(t.stateNode, e, 2), t = fa(t, e, 2), t !== null && (U(t, 2), De(t));
      }
      function bt(t, e, a) {
        if (t.tag === 3)
          Xu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Xu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Ea === null || !Ea.has(l))) {
                t = ot(a, t), a = Ks(2), l = fa(e, a, 2), l !== null && (Xs(
                  a,
                  l,
                  e,
                  t
                ), U(l, 2), De(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function Sr(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new kp();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (lo = !0, r.add(a), t = Cf.bind(null, t, e, a), e.then(t, t));
      }
      function Cf(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, zt === t && (ht & a) === a && (At === 4 || At === 3 && (ht & 62914560) === ht && 300 > se() - si ? (mt & 2) === 0 && al(t, 0) : no |= a, Sl === ht && (Sl = 0)), De(t);
      }
      function Zu(t, e) {
        e === 0 && (e = j()), t = Ra(t, e), t !== null && (U(t, e), De(t));
      }
      function jf(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Zu(t, a);
      }
      function Mf(t, e) {
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
        l !== null && l.delete(e), Zu(t, a);
      }
      function Af(t, e) {
        return Zn(t, e);
      }
      function Of(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function zr(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function Fe(t, e) {
        var a = t.alternate;
        return a === null ? (a = c(
          t.tag,
          e,
          t.key,
          t.mode
        ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
      }
      function Ju(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function qn(t, e, a, l, r, o) {
        var f = 0;
        if (l = t, typeof t == "function") zr(t) && (f = 1);
        else if (typeof t == "string")
          f = He && Gt ? gc(t, a, It.current) ? 26 : Ec(t) ? 27 : 5 : He ? gc(
            t,
            a,
            It.current
          ) ? 26 : 5 : Gt && Ec(t) ? 27 : 5;
        else
          t: switch (t) {
            case Rr:
              return t = c(31, a, e, r), t.elementType = Rr, t.lanes = o, t;
            case il:
              return Ba(
                a.children,
                r,
                o,
                e
              );
            case tc:
              f = 8, r |= 24;
              break;
            case Cr:
              return t = c(12, a, e, r | 2), t.elementType = Cr, t.lanes = o, t;
            case Mr:
              return t = c(13, a, e, r), t.elementType = Mr, t.lanes = o, t;
            case Ar:
              return t = c(19, a, e, r), t.elementType = Ar, t.lanes = o, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case va:
                    f = 10;
                    break t;
                  case ec:
                    f = 9;
                    break t;
                  case jr:
                    f = 11;
                    break t;
                  case Or:
                    f = 14;
                    break t;
                  case ba:
                    f = 16, l = null;
                    break t;
                }
              f = 29, a = Error(
                u(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), l = null;
          }
        return e = c(f, a, e, r), e.elementType = t, e.type = l, e.lanes = o, e;
      }
      function Ba(t, e, a, l) {
        return t = c(7, t, l, e), t.lanes = a, t;
      }
      function Er(t, e, a) {
        return t = c(6, t, null, e), t.lanes = a, t;
      }
      function Lu(t) {
        var e = c(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function kr(t, e, a) {
        return e = c(
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
      function Rf(t, e, a, l, r, o, f, h, A) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = O(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = O(0), this.hiddenUpdates = O(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = o, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = A, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Wu(t, e, a, l, r, o, f, h, A, B, X, Q) {
        return t = new Rf(
          t,
          e,
          a,
          f,
          A,
          B,
          X,
          Q,
          h
        ), e = 1, o === !0 && (e |= 24), o = c(3, null, null, e), t.current = o, o.stateNode = t, e = Ti(), e.refCount++, t.pooledCache = e, e.refCount++, o.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Ai(o), t;
      }
      function Fu(t) {
        return t ? (t = ul, t) : ul;
      }
      function Iu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(u(188)) : (t = Object.keys(t).join(","), Error(u(268, t)));
        return t = m(e), t = t !== null ? w(t) : null, t === null ? null : Kl(t.stateNode);
      }
      function $u(t, e, a, l, r, o) {
        r = Fu(r), l.context === null ? l.context = r : l.pendingContext = r, l = da(e), l.payload = { element: a }, o = o === void 0 ? null : o, o !== null && (l.callback = o), a = fa(t, l, e), a !== null && (oe(a, t, e), Al(a, t, e));
      }
      function Pu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Nr(t, e) {
        Pu(t, e), (t = t.alternate) && Pu(t, e);
      }
      var ft = {}, Hf = Ed(), pe = Jp(), Tr = Object.assign, Uf = Symbol.for("react.element"), Yn = Symbol.for("react.transitional.element"), nl = Symbol.for("react.portal"), il = Symbol.for("react.fragment"), tc = Symbol.for("react.strict_mode"), Cr = Symbol.for("react.profiler"), ec = Symbol.for("react.consumer"), va = Symbol.for("react.context"), jr = Symbol.for("react.forward_ref"), Mr = Symbol.for("react.suspense"), Ar = Symbol.for("react.suspense_list"), Or = Symbol.for("react.memo"), ba = Symbol.for("react.lazy"), Rr = Symbol.for("react.activity"), Df = Symbol.for("react.memo_cache_sentinel"), ac = Symbol.iterator, Bf = Symbol.for("react.client.reference"), Gn = Array.isArray, at = Hf.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, qf = i.rendererVersion, Yf = i.rendererPackageName, lc = i.extraDevToolsConfig, Kl = i.getPublicInstance, Gf = i.getRootHostContext, Qf = i.getChildHostContext, Vf = i.prepareForCommit, Kf = i.resetAfterCommit, Xf = i.createInstance;
      i.cloneMutableInstance;
      var Hr = i.appendInitialChild, nc = i.finalizeInitialChildren, Qn = i.shouldSetTextContent, ic = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Zf = i.scheduleTimeout, Jf = i.cancelTimeout, qa = i.noTimeout, Ie = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ae = i.supportsMutation, qe = i.supportsPersistence, le = i.supportsHydration, Lf = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var Wf = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Xt = i.setCurrentUpdatePriority, $e = i.getCurrentUpdatePriority, Ff = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var If = i.shouldAttemptEagerTransition, $f = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var Pf = i.maySuspendCommit, tm = i.maySuspendCommitOnUpdate, Ur = i.maySuspendCommitInSyncRender, rc = i.preloadInstance, em = i.startSuspendingCommit, oc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var am = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var rl = i.NotPendingTransition, Ya = i.HostTransitionContext, lm = i.resetFormInstance;
      i.bindToConsole;
      var nm = i.supportsMicrotasks, im = i.scheduleMicrotask, Xl = i.supportsTestSelectors, rm = i.findFiberRoot, om = i.getBoundingRect, sm = i.getTextContent, Zl = i.isHiddenSubtree, um = i.matchAccessibilityRole, cm = i.setFocusIfFocusable, dm = i.setupIntersectionObserver, fm = i.appendChild, mm = i.appendChildToContainer, pm = i.commitTextUpdate, hm = i.commitMount, gm = i.commitUpdate, vm = i.insertBefore, bm = i.insertInContainerBefore, ym = i.removeChild, xm = i.removeChildFromContainer, sc = i.resetTextContent, wm = i.hideInstance, _m = i.hideTextInstance, Sm = i.unhideInstance, zm = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var Em = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var km = i.cloneInstance, uc = i.createContainerChildSet, cc = i.appendChildToContainerChildSet, Nm = i.finalizeContainerChildren, dc = i.replaceContainerChildren, fc = i.cloneHiddenInstance, mc = i.cloneHiddenTextInstance, Dr = i.isSuspenseInstancePending, Br = i.isSuspenseInstanceFallback, Tm = i.getSuspenseInstanceFallbackErrorDetails, Cm = i.registerSuspenseInstanceRetry, jm = i.canHydrateFormStateMarker, Mm = i.isFormStateMarkerMatching, pc = i.getNextHydratableSibling, Am = i.getNextHydratableSiblingAfterSingleton, Om = i.getFirstHydratableChild, Rm = i.getFirstHydratableChildWithinContainer, Hm = i.getFirstHydratableChildWithinActivityInstance, Um = i.getFirstHydratableChildWithinSuspenseInstance, Dm = i.getFirstHydratableChildWithinSingleton, Bm = i.canHydrateInstance, qm = i.canHydrateTextInstance, Ym = i.canHydrateActivityInstance, Gm = i.canHydrateSuspenseInstance, Qm = i.hydrateInstance, Vm = i.hydrateTextInstance, Km = i.hydrateActivityInstance, Xm = i.hydrateSuspenseInstance, Zm = i.getNextHydratableInstanceAfterActivityInstance, Jm = i.getNextHydratableInstanceAfterSuspenseInstance, Lm = i.commitHydratedInstance, Wm = i.commitHydratedContainer, Fm = i.commitHydratedActivityInstance, Im = i.commitHydratedSuspenseInstance, $m = i.finalizeHydratedChildren, Pm = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var tp = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var ep = i.clearSuspenseBoundaryFromContainer, ap = i.hideDehydratedBoundary, lp = i.unhideDehydratedBoundary, hc = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var np = i.validateHydratableInstance, ip = i.validateHydratableTextInstance, He = i.supportsResources, gc = i.isHostHoistableType, qr = i.getHoistableRoot, vc = i.getResource, bc = i.acquireResource, yc = i.releaseResource, rp = i.hydrateHoistable, xc = i.mountHoistable, wc = i.unmountHoistable, op = i.createHoistableInstance, sp = i.prepareToCommitHoistables, up = i.mayResourceSuspendCommit, _c = i.preloadResource, cp = i.suspendResource, Gt = i.supportsSingletons, Sc = i.resolveSingletonInstance, dp = i.acquireSingletonInstance, zc = i.releaseSingletonInstance, Ec = i.isHostSingletonType, ol = i.isSingletonScope, Yr = [], sl = -1, ul = {}, he = Math.clz32 ? Math.clz32 : x, fp = Math.log, mp = Math.LN2, Vn = 256, Kn = 262144, Xn = 4194304, Zn = pe.unstable_scheduleCallback, Gr = pe.unstable_cancelCallback, pp = pe.unstable_shouldYield, hp = pe.unstable_requestPaint, se = pe.unstable_now, kc = pe.unstable_ImmediatePriority, gp = pe.unstable_UserBlockingPriority, Qr = pe.unstable_NormalPriority, vp = pe.unstable_IdlePriority, bp = pe.log, yp = pe.unstable_setDisableYieldValue, Jl = null, ge = null, ve = typeof Object.is == "function" ? Object.is : Lt, Nc = typeof reportError == "function" ? reportError : function(t) {
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
      }, xp = Object.prototype.hasOwnProperty, Vr, Tc, Kr = !1, Cc = /* @__PURE__ */ new WeakMap(), cl = [], dl = 0, Jn = null, Ll = 0, Ee = [], ke = 0, ya = null, Ye = 1, Ge = "", It = g(null), Wl = g(null), xa = g(null), Ln = g(null), $t = null, Tt = null, gt = !1, wa = null, Ne = !1, Xr = Error(u(519)), Wn = g(null), Ga = null, Pe = null, wp = typeof AbortController < "u" ? AbortController : function() {
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
      }, _p = pe.unstable_scheduleCallback, Sp = pe.unstable_NormalPriority, Ct = {
        $$typeof: va,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Fn = null, fl = null, Zr = !1, In = !1, Jr = !1, Qa = 0, Fl = null, Lr = 0, ml = 0, pl = null, jc = at.S;
      at.S = function(t, e) {
        Hc = se(), typeof e == "object" && e !== null && typeof e.then == "function" && cf(t, e), jc !== null && jc(t, e);
      };
      var Va = g(null), hl = Error(u(460)), Wr = Error(u(474)), $n = Error(u(542)), Pn = { then: function() {
      } }, Ka = null, gl = null, Il = 0, Xa = ts(!0), Mc = ts(!1), Te = [], vl = 0, Fr = 0, _a = !1, Ir = !1, bl = g(null), ti = g(0), be = g(null), Ce = null, Ht = g(0), ta = 0, ct = null, St = null, Dt = null, ei = !1, yl = !1, Za = !1, ai = 0, $l = 0, xl = null, zp = 0, Pl = {
        readContext: Wt,
        use: Sn,
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
      Pl.useEffectEvent = Mt;
      var Ac = {
        readContext: Wt,
        use: Sn,
        useCallback: function(t, e) {
          return ne().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: Wt,
        useEffect: Es,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, En(
            4194308,
            4,
            Cs.bind(null, e, t),
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
          var a = ne();
          e = e === void 0 ? null : e;
          var l = t();
          if (Za) {
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
            if (Za) {
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
          }, l.queue = t, t = t.dispatch = vf.bind(
            null,
            ct,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = ne();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Zi(t);
          var e = t.queue, a = Bs.bind(
            null,
            ct,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Wi,
        useDeferredValue: function(t, e) {
          var a = ne();
          return Fi(a, t, e);
        },
        useTransition: function() {
          var t = Zi(!1);
          return t = Rs.bind(
            null,
            ct,
            t.queue,
            !0,
            !1
          ), ne().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = ct, r = ne();
          if (gt) {
            if (a === void 0)
              throw Error(u(407));
            a = a();
          } else {
            if (a = e(), zt === null)
              throw Error(u(349));
            (ht & 127) !== 0 || us(l, e, a);
          }
          r.memoizedState = a;
          var o = { value: a, getSnapshot: e };
          return r.queue = o, Es(ds.bind(null, l, o, t), [
            t
          ]), l.flags |= 2048, tl(
            9,
            { destroy: void 0 },
            cs.bind(
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
          if (gt) {
            var a = Ge, l = Ye;
            a = (l & ~(1 << 32 - he(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ai++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = zp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ii,
        useFormState: xs,
        useActionState: xs,
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
          return e.queue = a, e = $i.bind(
            null,
            ct,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Vi,
        useCacheRefresh: function() {
          return ne().memoizedState = gf.bind(
            null,
            ct
          );
        },
        useEffectEvent: function(t) {
          var e = ne(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((mt & 2) !== 0)
              throw Error(u(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, $r = {
        readContext: Wt,
        use: Sn,
        useCallback: Ms,
        useContext: Wt,
        useEffect: Li,
        useImperativeHandle: js,
        useInsertionEffect: Ns,
        useLayoutEffect: Ts,
        useMemo: As,
        useReducer: zn,
        useRef: zs,
        useState: function() {
          return zn(Ze);
        },
        useDebugValue: Wi,
        useDeferredValue: function(t, e) {
          var a = Rt();
          return Os(
            a,
            St.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = zn(Ze)[0], e = Rt().memoizedState;
          return [
            typeof t == "boolean" ? t : Hl(t),
            e
          ];
        },
        useSyncExternalStore: ss,
        useId: Us,
        useHostTransitionStatus: Ii,
        useFormState: ws,
        useActionState: ws,
        useOptimistic: function(t, e) {
          var a = Rt();
          return ps(a, St, t, e);
        },
        useMemoCache: Vi,
        useCacheRefresh: Ds
      };
      $r.useEffectEvent = ks;
      var Oc = {
        readContext: Wt,
        use: Sn,
        useCallback: Ms,
        useContext: Wt,
        useEffect: Li,
        useImperativeHandle: js,
        useInsertionEffect: Ns,
        useLayoutEffect: Ts,
        useMemo: As,
        useReducer: Xi,
        useRef: zs,
        useState: function() {
          return Xi(Ze);
        },
        useDebugValue: Wi,
        useDeferredValue: function(t, e) {
          var a = Rt();
          return St === null ? Fi(a, t, e) : Os(
            a,
            St.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Xi(Ze)[0], e = Rt().memoizedState;
          return [
            typeof t == "boolean" ? t : Hl(t),
            e
          ];
        },
        useSyncExternalStore: ss,
        useId: Us,
        useHostTransitionStatus: Ii,
        useFormState: Ss,
        useActionState: Ss,
        useOptimistic: function(t, e) {
          var a = Rt();
          return St !== null ? ps(a, St, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Vi,
        useCacheRefresh: Ds
      };
      Oc.useEffectEvent = ks;
      var Pr = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = me(), r = da(l);
          r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (oe(e, t, l), Al(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = me(), r = da(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (oe(e, t, l), Al(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = me(), l = da(a);
          l.tag = 2, e != null && (l.callback = e), e = fa(t, l, a), e !== null && (oe(e, t, a), Al(e, t, a));
        }
      }, to = Error(u(461)), Bt = !1, eo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, ea = !1, qt = !1, ao = !1, Rc = typeof WeakSet == "function" ? WeakSet : Set, Zt = null, Yt = null, ue = !1, Ue = null, wl = 8192, Ep = {
        getCacheForType: function(t) {
          var e = Wt(Ct), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return Wt(Ct).controller.signal;
        }
      }, li = 0, ni = 1, ii = 2, ri = 3, oi = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var tn = Symbol.for;
        li = tn("selector.component"), ni = tn("selector.has_pseudo_class"), ii = tn("selector.role"), ri = tn("selector.test_id"), oi = tn("selector.text");
      }
      var kp = typeof WeakMap == "function" ? WeakMap : Map, mt = 0, zt = null, pt = null, ht = 0, _t = 0, ye = null, Sa = !1, _l = !1, lo = !1, aa = 0, At = 0, za = 0, Ja = 0, no = 0, xe = 0, Sl = 0, en = null, ce = null, io = !1, si = 0, Hc = 0, an = 1 / 0, ui = null, Ea = null, Qt = 0, ka = null, zl = null, la = 0, ro = 0, oo = null, Uc = null, ln = 0, so = null;
      return ft.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ra(t, 67108864);
          e !== null && oe(e, t, 67108864), Nr(t, 67108864);
        }
      }, ft.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = me();
          e = wt(e);
          var a = Ra(t, e);
          a !== null && oe(a, t, e), Nr(t, e);
        }
      }, ft.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = z(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - he(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                De(t), (mt & 6) === 0 && (an = se() + 500, Pa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ra(t, 2), e !== null && oe(e, t, 2), Mu(), Nr(t, 2);
        }
      }, ft.batchedUpdates = function(t, e) {
        return t(e);
      }, ft.createComponentSelector = function(t) {
        return { $$typeof: li, value: t };
      }, ft.createContainer = function(t, e, a, l, r, o, f, h, A, B) {
        return Wu(
          t,
          e,
          !1,
          null,
          a,
          l,
          o,
          null,
          f,
          h,
          A,
          B
        );
      }, ft.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ni, value: t };
      }, ft.createHydrationContainer = function(t, e, a, l, r, o, f, h, A, B, X, Q, Z, ut) {
        return t = Wu(
          a,
          l,
          !0,
          t,
          r,
          o,
          h,
          ut,
          A,
          B,
          X,
          Q
        ), t.context = Fu(null), a = t.current, l = me(), l = wt(l), r = da(l), r.callback = e ?? null, fa(a, r, l), e = l, t.current.lanes = e, U(t, e), De(t), t;
      }, ft.createPortal = function(t, e, a) {
        var l = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: nl,
          key: l == null ? null : "" + l,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, ft.createRoleSelector = function(t) {
        return { $$typeof: ii, value: t };
      }, ft.createTestNameSelector = function(t) {
        return { $$typeof: ri, value: t };
      }, ft.createTextSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, ft.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ft.defaultOnRecoverableError = function(t) {
        Nc(t);
      }, ft.defaultOnUncaughtError = function(t) {
        Nc(t);
      }, ft.deferredUpdates = function(t) {
        var e = at.T, a = $e();
        try {
          return Xt(32), at.T = null, t();
        } finally {
          Xt(a), at.T = e;
        }
      }, ft.discreteUpdates = function(t, e, a, l, r) {
        var o = at.T, f = $e();
        try {
          return Xt(2), at.T = null, t(e, a, l, r);
        } finally {
          Xt(f), at.T = o, mt === 0 && (an = se() + 500);
        }
      }, ft.findAllNodes = xr, ft.findBoundingRects = function(t, e) {
        if (!Xl) throw Error(u(363));
        e = xr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(om(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, o = a.y, f = o + a.height, h = e - 1; 0 <= h; h--)
            if (e !== h) {
              var A = t[h], B = A.x, X = B + A.width, Q = A.y, Z = Q + A.height;
              if (l >= B && o >= Q && r <= X && f <= Z) {
                t.splice(e, 1);
                break;
              } else if (l !== B || a.width !== A.width || Z < o || Q > f) {
                if (!(o !== Q || a.height !== A.height || X < l || B > r)) {
                  B > l && (A.width += B - l, A.x = l), X < r && (A.width = r - B), t.splice(e, 1);
                  break;
                }
              } else {
                Q > o && (A.height += Q - o, A.y = o), Z < f && (A.height = f - Q), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ft.findHostInstance = Iu, ft.findHostInstanceWithNoPortals = function(t) {
        return t = m(t), t = t !== null ? y(t) : null, t === null ? null : Kl(t.stateNode);
      }, ft.findHostInstanceWithWarning = function(t) {
        return Iu(t);
      }, ft.flushPassiveEffects = Vl, ft.flushSyncFromReconciler = function(t) {
        var e = mt;
        mt |= 1;
        var a = at.T, l = $e();
        try {
          if (Xt(2), at.T = null, t)
            return t();
        } finally {
          Xt(l), at.T = a, mt = e, (mt & 6) === 0 && Pa(0);
        }
      }, ft.flushSyncWork = Mu, ft.focusWithin = function(t, e) {
        if (!Xl) throw Error(u(363));
        for (t = vr(t), e = Nu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!Zl(a)) {
            if ((l === 5 || l === 26 || l === 27) && cm(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ft.getFindAllNodesFailureDescription = function(t, e) {
        if (!Xl) throw Error(u(363));
        var a = 0, l = [];
        t = [vr(t), 0];
        for (var r = 0; r < t.length; ) {
          var o = t[r++], f = o.tag, h = t[r++], A = e[h];
          if ((f !== 5 && f !== 26 && f !== 27 || !Zl(o)) && (br(o, A) && (l.push(yr(A)), h++, h > a && (a = h)), h < e.length))
            for (o = o.child; o !== null; )
              t.push(o, h), o = o.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(yr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (l.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, ft.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Kl(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, ft.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: qf,
          rendererPackageName: Yf,
          currentDispatcherRef: at,
          reconcilerVersion: "19.2.0"
        };
        if (lc !== null && (t.rendererConfig = lc), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Jl = e.inject(t), ge = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ft.isAlreadyRendering = function() {
        return (mt & 6) !== 0;
      }, ft.observeVisibleRects = function(t, e, a, l) {
        if (!Xl) throw Error(u(363));
        t = xr(t, e);
        var r = dm(
          t,
          a,
          l
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, ft.shouldError = function() {
        return null;
      }, ft.shouldSuspend = function() {
        return !1;
      }, ft.startHostTransition = function(t, e, a, l) {
        if (t.tag !== 5) throw Error(u(476));
        var r = Hs(t).queue;
        Rs(
          t,
          r,
          e,
          rl,
          a === null ? s : function() {
            var o = Hs(t);
            return o.next === null && (o = t.alternate.memoizedState), Ul(
              t,
              o.next.queue,
              {},
              me()
            ), a(l);
          }
        );
      }, ft.updateContainer = function(t, e, a, l) {
        var r = e.current, o = me();
        return $u(
          r,
          o,
          t,
          e,
          a,
          l
        ), o;
      }, ft.updateContainerSync = function(t, e, a, l) {
        return $u(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, ft;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(po)), po.exports;
}
var Jc;
function Wp() {
  return Jc || (Jc = 1, mo.exports = Lp()), mo.exports;
}
var Fp = Wp();
const Ip = /* @__PURE__ */ Uo(Fp);
var vo = { exports: {} }, na = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Lc;
function $p() {
  return Lc || (Lc = 1, na.ConcurrentRoot = 1, na.ContinuousEventPriority = 8, na.DefaultEventPriority = 32, na.DiscreteEventPriority = 2, na.IdleEventPriority = 268435456, na.LegacyRoot = 0, na.NoEventPriority = 0), na;
}
var Wc;
function Pp() {
  return Wc || (Wc = 1, vo.exports = $p()), vo.exports;
}
var un = Pp();
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
const kd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], wo = 16, Nd = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), th = [
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
], Fc = {
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
}, eh = /* @__PURE__ */ new Set([
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
}, _o = ["font-size", "color", ...new Set([...Object.keys(Td), ...Object.keys(Cd)].filter((n) => n !== "font-size" && n !== "color"))], ah = new Set(_o);
function de(n, i = " ") {
  const c = [];
  let s = 0, u = "";
  for (let d = 0; d < n.length; d++) {
    const p = n[d];
    if (p === "(" ? s++ : p === ")" && s--, s === 0 && (i === " " ? /\s/.test(p) : p === i)) {
      (u.trim() || i !== " ") && c.push(u.trim()), u = "";
      continue;
    }
    u += p;
  }
  return (u.trim() || i !== " " && c.length) && c.push(u.trim()), c;
}
function So(n, i, c = 0) {
  if (c > 32) return null;
  let s = "", u = 0;
  for (; ; ) {
    const d = n.indexOf("var(", u);
    if (d < 0)
      return s += n.slice(u), s;
    s += n.slice(u, d);
    let p = 1, m = d + 4;
    for (; m < n.length && p; m++)
      n[m] === "(" ? p++ : n[m] === ")" && p--;
    const w = n.slice(d + 4, m - 1), y = de(w, ","), R = y[0].trim(), H = y.length > 1 ? w.slice(w.indexOf(",") + 1).trim() : null;
    let g = i(R);
    if ((g == null || g === "initial") && (g = H), g == null) return null;
    const C = So(g, i, c + 1);
    if (C === null) return null;
    s += C, u = m;
  }
}
function lh(n) {
  const i = [], c = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, u = 0;
  for (; u < n.length; ) {
    if (c.lastIndex = u, s = c.exec(n), !s || s.index !== u) {
      if (/^\s+$/.test(n.slice(u))) break;
      return null;
    }
    u = c.lastIndex, s[1] !== void 0 ? i.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? i.push({ fn: s[3].toLowerCase() }) : s[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: s[5] ?? s[6] });
  }
  return i;
}
function zo(n, i) {
  const c = lh(n.trim());
  if (!c) return null;
  let s = 0;
  const u = ({ num: g, unit: C }) => {
    switch (C) {
      case "":
        return { px: 0, pct: 0, num: g, unitless: !0 };
      case "px":
        return { px: g, pct: 0, num: 0 };
      case "rem":
        return { px: g * wo, pct: 0, num: 0 };
      case "em":
        return { px: g * (i.fontSize ?? wo), pct: 0, num: 0 };
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
  }, d = (g, C, S) => g && C ? { px: g.px + S * C.px, pct: g.pct + S * C.pct, num: g.num + S * C.num, unitless: g.unitless && C.unitless } : null, p = (g, C) => g ? { px: g.px * C, pct: g.pct * C, num: g.num * C, unitless: g.unitless } : null, m = (g) => g && g.unitless;
  function w() {
    const g = c[s++];
    if (!g) return null;
    if (g.num !== void 0) return u(g);
    if (g.op === "(") {
      const C = R();
      return c[s]?.op !== ")" ? null : (s++, C);
    }
    if (g.op === "-" || g.op === "+") {
      const C = w();
      return g.op === "-" ? p(C, -1) : C;
    }
    if (g.fn) {
      const C = [];
      for (; ; ) {
        C.push(R());
        const z = c[s++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (C.some((z) => !z)) return null;
      if (g.fn === "calc") return C[0];
      if (!(C.every((z) => !z.pct) || C.every((z) => !z.px && !z.num))) return null;
      const x = (z) => z.px + z.pct + z.num;
      return g.fn === "min" ? C.reduce((z, D) => x(D) < x(z) ? D : z) : g.fn === "max" ? C.reduce((z, D) => x(D) > x(z) ? D : z) : g.fn === "clamp" && C.length === 3 ? x(C[1]) < x(C[0]) ? C[0] : x(C[1]) > x(C[2]) ? C[2] : C[1] : null;
    }
    return null;
  }
  function y() {
    let g = w();
    for (; c[s] && (c[s].op === "*" || c[s].op === "/"); ) {
      const C = c[s++].op, S = w();
      if (!g || !S) return null;
      C === "*" ? g = m(S) ? p(g, S.num) : m(g) ? p(S, g.num) : null : g = m(S) && S.num !== 0 ? p(g, 1 / S.num) : null;
    }
    return g;
  }
  function R() {
    let g = y();
    for (; c[s] && (c[s].op === "+" || c[s].op === "-"); ) {
      const C = c[s++].op;
      g = d(g, y(), C === "-" ? -1 : 1);
    }
    return g;
  }
  const H = R();
  return s !== c.length || !H ? null : H;
}
function Eo(n, i) {
  const c = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(c))
    return c === "thin" ? { px: 1 } : c === "medium" ? { px: 3 } : c === "thick" ? { px: 5 } : c;
  const s = zo(c, i);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: n.trim() } : s.pct && (s.px || s.num) ? { expr: n.trim() } : s.pct ? { pct: s.pct } : { px: nh(s.px) } : { expr: n.trim() };
}
const nh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, di = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), ih = ([n, i, c, s]) => `#${di(n)}${di(i)}${di(c)}${di(s * 255)}`;
function Ic(n) {
  const i = n.slice(1), c = i.length <= 4 ? i.split("").map((u) => u + u).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c)) return null;
  const s = (u) => parseInt(c.slice(u, u + 2), 16);
  return [s(0), s(2), s(4), c.length === 8 ? s(6) / 255 : 1];
}
function bi(n, i) {
  const c = n.trim().toLowerCase();
  if (c === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(c);
  if (s) {
    const y = i(s[1]), R = y && Ic(y);
    return R ? { rgba: R, token: s[1] } : null;
  }
  if (c.startsWith("#")) {
    const y = Ic(c);
    return y ? { rgba: y, token: null } : null;
  }
  if (Fc[c]) return { rgba: [...Fc[c]], token: null };
  const u = /^(rgba?|color-mix)\((.*)\)$/s.exec(c);
  if (!u) return null;
  if (u[1] === "color-mix") {
    const y = de(u[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const R = (Ot) => {
      const Lt = de(Ot), Nt = Lt.findIndex((nt) => /%$/.test(nt)), G = Nt >= 0 ? parseFloat(Lt[Nt]) / 100 : null;
      return { color: bi(Lt.filter((nt, ot) => ot !== Nt).join(" "), i), pct: G };
    }, H = R(y[1]), g = R(y[2]);
    if (!H.color || !g.color || H.color === "currentcolor" || g.color === "currentcolor") return null;
    let C = H.pct, S = g.pct;
    C === null && S === null ? (C = 0.5, S = 0.5) : C === null ? C = 1 - S : S === null && (S = 1 - C);
    const x = C + S, z = x < 1 ? x : 1;
    C /= x, S /= x;
    const [D, v, N, j] = H.color.rgba, [O, U, E, k] = g.color.rgba, Y = j * C + k * S, $ = (Ot, Lt) => Y === 0 ? 0 : (Ot * j * C + Lt * k * S) / Y, wt = [$(D, O), $(v, U), $(N, E), Y * z], Et = k === 0 ? H.color.token : j === 0 ? g.color.token : null;
    return { rgba: wt, token: Et };
  }
  const d = u[2].includes(",") ? de(u[2], ",") : de(u[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const p = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), m = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), w = [p(d[0]), p(d[1]), p(d[2]), m];
  return w.some((y) => Number.isNaN(y)) ? null : { rgba: w, token: null };
}
const sn = ["top", "right", "bottom", "left"], rh = ["top-left", "top-right", "bottom-right", "bottom-left"], fi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], $c = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function ko(n, i) {
  const c = i.trim(), s = () => de(c);
  switch (n) {
    case "padding":
    case "margin": {
      const u = fi(s());
      return sn.map((d, p) => [`${n}-${d}`, u[p]]);
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
      return [[`${n.split("-")[0]}-left`, c]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, c]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, c]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, c]];
    case "inset": {
      const u = fi(s());
      return sn.map((d, p) => [d, u[p]]);
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
      return [["left", c]];
    case "inset-inline-end":
      return [["right", c]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const u = n.split("-")[1], d = fi(s());
      return sn.map((p, m) => [`border-${p}-${u}`, d[m]]);
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
      const u = n === "border" ? sn : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", p = "none", m = "currentcolor";
      if (c !== "none" && c !== "0")
        for (const w of s())
          $c.has(w) ? p = w : /^(thin|medium|thick|-?[\d.]|calc\()/.test(w) ? d = w : m = w;
      else c === "0" && (d = "0");
      return u.flatMap((w) => [[`border-${w}-width`, d], [`border-${w}-style`, p], [`border-${w}-color`, m]]);
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
      const u = fi(de(c.split("/")[0]));
      return rh.map((d, p) => [`border-${d}-radius`, u[p]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", c]];
    case "border-start-end-radius":
      return [["border-top-right-radius", c]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", c]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", c]];
    case "background":
      return c === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : bi(c, () => "#000000") ? [["background-color", c], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", c]];
    case "overflow": {
      const u = s();
      return [["overflow-x", u[0]], ["overflow-y", u[1] ?? u[0]]];
    }
    case "gap": {
      const u = s();
      return [["row-gap", u[0]], ["column-gap", u[1] ?? u[0]]];
    }
    case "grid-gap":
      return ko("gap", c);
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
      if (c === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (c === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (c === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const u = s(), d = u.filter((m) => /^[\d.]+$/.test(m)), p = u.find((m) => !/^[\d.]+$/.test(m));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", p ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const u = [];
      for (const d of s()) u.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return u;
    }
    case "outline": {
      if (c === "none" || c === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let u = "medium", d = "none", p = "currentcolor";
      for (const m of s())
        $c.has(m) || m === "auto" ? d = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? u = m : p = m;
      return [["outline-width", u], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (c === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const u = de(c, ","), d = u.map((m) => de(m).find((w) => !/^[\d.]+m?s$/.test(w) && !/^(ease|linear|step|cubic)/.test(w)) ?? "all"), p = u.map((m) => de(m).find((w) => /^[\d.]+m?s$/.test(w)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", p.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", s()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", c]];
    case "word-wrap":
      return [["overflow-wrap", c]];
    default:
      return [[n, c]];
  }
}
function oh(n, i) {
  return n ? de(n, ",").some((c) => {
    let s = c.trim().toLowerCase(), u = !1;
    s.startsWith("not ") && (u = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const d = s.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const m = /^\((.+)\)$/.exec(p);
      if (!m) return !1;
      const w = m[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(w);
      if (y) {
        const [, H, g] = y, C = (S) => {
          const x = Eo(S, { viewport: i });
          return typeof x == "object" && "px" in x ? x.px : NaN;
        };
        switch (H) {
          case "min-width":
            return i.width >= C(g);
          case "max-width":
            return i.width <= C(g);
          case "min-height":
            return i.height >= C(g);
          case "max-height":
            return i.height <= C(g);
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
      const R = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(w);
      if (R) {
        const H = R[1] === "width" ? i.width : i.height, g = Eo(R[3], { viewport: i }), C = typeof g == "object" && "px" in g ? g.px : NaN;
        switch (R[2]) {
          case ">=":
            return H >= C;
          case "<=":
            return H <= C;
          case ">":
            return H > C;
          case "<":
            return H < C;
          default:
            return H === C;
        }
      }
      return !1;
    });
    return u ? !d : d;
  }) : !0;
}
function sh(n, i) {
  const c = i[i.length - 1].compound;
  return Do(c)[0] ?? n;
}
function uh(n) {
  const i = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set(), s = (u, d) => {
    u.forEach(({ compound: p }, m) => {
      const w = d && m === u.length - 1;
      for (const y of p.pseudos)
        if (Nd.has(y.name) && (w ? i : c).add(y.name), y.list && y.name !== "not") for (const R of y.list) s(R, w);
    });
  };
  return s(n, !0), { subject: i, ancestor: c };
}
function Do(n) {
  const i = [...n.classes];
  for (const c of n.pseudos)
    if (!(c.name !== "is" && c.name !== "where"))
      for (const s of c.list) s.length === 1 && i.push(...Do(s[0].compound));
  return i;
}
function ch(n, i) {
  const c = (s, u) => {
    s.forEach(({ compound: d }, p) => {
      const m = u && p === s.length - 1, w = d.pseudos.filter((y) => Nd.has(y.name)).map((y) => y.name);
      if (!m) for (const y of w) for (const R of Do(d)) i.add(`${y}:${R}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const R of y.list) c(R, m);
    });
  };
  c(n, !0);
}
class dh {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const c = (d, p) => {
      const m = p[p.length - 1].compound, w = m.classes.length ? `.${m.classes[0]}` : m.tag && m.tag !== "*" ? m.tag : "*";
      this.index.has(w) || this.index.set(w, []), this.index.get(w).push(d);
    };
    let s = 0;
    const u = (d, p) => {
      for (const [m, w, y, R] of d)
        for (const H of Ao(m)) {
          let g;
          try {
            g = Oo(H);
          } catch (x) {
            if (x instanceof Se) {
              this.skipped++;
              continue;
            }
            throw x;
          }
          const C = uh(g);
          ch(g, this.trackedStates);
          const S = { steps: g, media: w, layer: y, origin: p, order: s++, specificity: wd(g), decls: R, states: C, source: p === 0 ? `ua:${g[g.length - 1].compound.tag ?? "*"}` : sh(H, g) };
          this.rules.push(S), c(S, g);
        }
    };
    u(th.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), u(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const c = [], s = /* @__PURE__ */ new Set(), u = (d) => {
      if (d) for (const p of d) s.has(p) || (s.add(p), c.push(p));
    };
    for (const d of i.classList) u(this.index.get(`.${d}`));
    return u(this.index.get(i.tagName)), u(this.index.get("*")), c;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, c) {
    for (const s of i.classList) if (this.trackedStates.has(`${c}:${s}`)) return !0;
    return !1;
  }
}
const fh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function mh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [c, s] of Object.entries(n)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const u = c.startsWith("--") ? c : c.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof s == "number" && s !== 0 && !fh.has(u) && !u.startsWith("--") ? `${s}px` : String(s);
    i.push([u, d]);
  }
  return i;
}
function ph(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const c of ["width", "height"]) {
    const s = n.getAttribute(c);
    s !== null && i.push([c, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return i;
}
const hh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class gh {
  constructor(i, { theme: c, viewport: s }) {
    this.sheet = i, this.theme = c, this.viewport = s, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, c) {
    const s = (u, d, p) => {
      if (d === "disabled") return !!u.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(u.tagName);
      if (d === "enabled") return !u.props?.disabled && ["button", "input", "select", "textarea"].includes(u.tagName);
      if (d === "checked") return !!u.props?.checked;
      if (c === "*") return !0;
      if (d === "focus-within") {
        const m = u.ownerDocument?.activeElement;
        return !!m && m !== u.ownerDocument.body && typeof u.contains == "function" && u.contains(m);
      }
      return p ? c.has(d) : d === "focus-visible" ? !!u.state?.focus : !!u.state?.[d];
    };
    return this.sheet.candidates(i).filter((u) => (!u.media || u.media.every((d) => oh(d, this.viewport))) && _d(i, u.steps, { state: s }));
  }
  compute(i, c, s = /* @__PURE__ */ new Set()) {
    const u = this.matching(i, s), d = [];
    for (const E of u)
      for (const [k, Y, $] of E.decls) d.push({ prop: k, value: Y, important: $ ? 1 : 0, origin: E.origin === 0 ? 0 : 2, layer: E.layer, specificity: E.specificity, order: E.order, source: E.source });
    for (const [E, k] of ph(i)) d.push({ prop: E, value: k, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${E}` });
    for (const [E, k] of mh(i.props?.style)) d.push({ prop: E, value: k, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(hh);
    const p = this.sheet.properties, m = Object.create(c?.customs ?? null), w = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const E of d) E.prop.startsWith("--") && y.set(E.prop, E.value);
    if (!c && this.theme) for (const E of kd) this.theme[E] && y.set(`--${E}`, `perchtoken(${E})`);
    const R = (E) => {
      if (w.has(E)) return w.get(E);
      const k = p[E];
      return k && !k.inherits ? k.initial ?? null : E in m ? m[E] : k?.initial ?? null;
    }, H = /* @__PURE__ */ new Set(), g = (E) => {
      if (!y.has(E)) return R(E);
      if (H.has(E)) return null;
      H.add(E);
      const k = So(y.get(E), g);
      return H.delete(E), y.delete(E), w.set(E, k), (!p[E] || p[E].inherits) && (m[E] = k), k;
    };
    for (const E of [...y.keys()]) g(E);
    const C = /* @__PURE__ */ new Map();
    for (const E of d) {
      if (E.prop.startsWith("--")) continue;
      const k = So(E.value, R);
      if (k === null) {
        for (const [Y] of ko(E.prop, "unset")) C.set(Y, { value: "unset", source: E.source, origin: E.origin });
        continue;
      }
      for (const [Y, $] of ko(E.prop, k)) C.set(Y, { value: $, source: E.source, origin: E.origin });
    }
    const S = {}, x = {}, z = /* @__PURE__ */ new Set(), D = /* @__PURE__ */ new Set(), v = c?.values, N = { fontSize: v?.["font-size"] ?? wo, viewport: this.viewport }, j = (E, k) => {
      if (/currentcolor/i.test(k)) return this.parseValue(E, k, N, S, v);
      const Y = `${E}\0${k}\0${N.fontSize}`;
      let $ = this.parsed.get(Y);
      return $ === void 0 && this.parsed.set(Y, $ = this.parseValue(E, k, N, S, v)), $;
    }, O = C.size ? [..._o, ...[...C.keys()].filter((E) => !ah.has(E))] : _o;
    for (const E of O) {
      const k = C.get(E);
      let Y = k?.value;
      const $ = eh.has(E);
      if ((Y === void 0 || Y === "unset" || Y === "revert" || Y === "revert-layer") && (Y = $ ? "inherit" : "initial"), k && (x[E] = k.source, k.origin !== 0 && z.add(E)), Y === "inherit" && v && E in v) {
        S[E] = v[E], D.add(E);
        continue;
      }
      (Y === "inherit" || Y === "initial") && (Y = $ ? Cd[E] : Td[E]), S[E] = j(E, Y), E === "font-size" && (N.fontSize = S["font-size"]);
    }
    for (const E of sn) {
      const k = S[`border-${E}-style`];
      (k === "none" || k === "hidden") && (S[`border-${E}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const U = v?.display;
    return (U === "flex" || U === "inline-flex" || U === "grid" || U === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = Pc(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = Pc(S.display)), { values: S, sources: x, own: z, inherited: D, customs: m, rules: u, element: i };
  }
  parseValue(i, c, s, u, d) {
    const p = String(c).trim();
    switch (i) {
      case "font-size": {
        const m = p.toLowerCase(), w = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (w[m]) return w[m];
        if (m === "smaller") return s.fontSize / 1.2;
        if (m === "larger") return s.fontSize * 1.2;
        const y = zo(m, { fontSize: s.fontSize, viewport: s.viewport });
        return !y || y.num ? s.fontSize : y.px + y.pct / 100 * s.fontSize;
      }
      case "font-weight": {
        const m = p.toLowerCase();
        if (m === "normal") return 400;
        if (m === "bold") return 700;
        if (m === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (m === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const w = parseFloat(m);
        return Number.isFinite(w) ? w : 400;
      }
      case "line-height": {
        const m = p.toLowerCase();
        if (m === "normal") return { normal: !0 };
        const w = zo(m, { fontSize: s.fontSize, viewport: s.viewport });
        return w ? w.unitless ? { factor: w.num } : { px: w.px + w.pct / 100 * s.fontSize } : { normal: !0 };
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
        const m = bi(p, (w) => this.themeHex(w));
        return m === "currentcolor" || !m ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : m;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const m = bi(p, (w) => this.themeHex(w));
        return m === "currentcolor" ? u.color : m ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
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
        return Eo(p, s);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function Pc(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const yi = (n) => n && n.rgba ? { value: ih(n.rgba), token: n.token ?? null } : null, vh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function bh(n, i) {
  const c = i?.(n);
  if (Number.isFinite(c)) return c;
  const s = Math.round(n * 100) / 100;
  return vh[s] ?? Math.round(n * 1.2);
}
function jd(n, i) {
  const c = n["line-height"], s = n["font-size"];
  return c.normal ? bh(s, i) : c.factor !== void 0 ? c.factor * s : c.px;
}
const yh = (n) => de(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
//! - `blocks_pointer` on a node that takes pointer events under an ancestor that lets them through; `tabular` on one
//!   whose digits are tabular; `scrollbar` (its width) on a vertical scroller
//! - a node `mount` was given a parity table for (`options.names`) carries `name` (`name` or `name:key`, the engine
//!   id tests find it by) and, for a name that is the element's own text, `range_name`.
//! - letter-spaced text is a `div` (no `id`) around the run with the spacing as room after it.
//!
//! Text styles follow GPUI's inheritance: a node carries a text style when it sets one itself (so an ancestor's
//! hover colour does not reach it, as in CSS) or when the inherited value would differ (`line-height: normal`, a
//! multiplier under a new size). `tokens` names the theme token each colour came from.
const xh = "perch-native-description/1", mi = Symbol("display"), xi = {
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
}, wh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of wh) xi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
xi.rounded = 0;
const _h = /* @__PURE__ */ new Set([
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
]), Sh = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, zh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Eh = (n) => zh.test(n) ? "Menlo" : Sh.test(n) ? ".SystemUIFont" : yh(n).split(",")[0].trim(), kh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, td = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Md = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const c = n.classList.find((u) => !u.includes(":") && !u.includes("[")) ?? n.classList[0];
  if (c) return `${n.tagName}.${c}`;
  const s = n.parentElement;
  return s && s.tagName !== "body" ? `${Md(s)} > ${n.tagName}` : n.tagName;
};
class Nh {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, c, s, u, d, p = "") {
    const m = `${i}|${c}|${s}|${u}`, w = this.map.get(m);
    if (w) {
      !w.elements.includes(d) && w.elements.length < 4 && w.elements.push(d), w.count++;
      return;
    }
    this.map.set(m, { kind: i, property: c, value: String(s), class: u ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, c) => i.kind < c.kind ? -1 : i.kind > c.kind ? 1 : i.property < c.property ? -1 : i.property > c.property ? 1 : 0);
  }
}
const ra = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, Th = /^(text|search|url|email|tel|password|number)$/, Ch = 162.13 / 12.8;
function ed(n, i, c = null) {
  const s = n.values, u = {}, d = (v) => n.sources[v], p = (v) => n.sources[v] !== void 0, m = s.display;
  m === "none" ? u.display = "hidden" : m === "flex" || m === "inline-flex" ? u.display = "flex" : (m === "grid" || m === "inline-grid") && (u.display = "flex", u.flex_direction = "col", i("approximated", "display", m, d("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", s["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (u.display = "hidden");
  const w = u.display === "flex";
  if (w && u.flex_direction !== "col") {
    const v = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    u.flex_direction = v;
  }
  if (w) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (u.flex_wrap = "wrap");
    const v = m === "grid" || m === "inline-grid", N = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    N && (u.items = N);
    let j = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (v) {
      const E = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      E && (u.items = E), s["align-items"] === "center" && (j = "center");
    }
    j && (u.justify = j);
    const O = ra(s["row-gap"]), U = ra(s["column-gap"]);
    typeof O == "number" && O && (u.gap_y = O), typeof U == "number" && U && !v && (u.gap_x = U);
  }
  s["flex-grow"] && (u.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (u.flex_shrink = s["flex-shrink"]);
  const y = ra(s["flex-basis"]);
  y !== void 0 && y !== "auto" && (u.flex_basis = y);
  const R = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  R && (u.self = R);
  for (const [v, N] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const j = s[N], O = ra(j);
    if (O === void 0) {
      typeof j == "object" && j.expr ? i("unsupported", N, j.expr, d(N), "no calc() in the engine") : typeof j == "string" && !["auto", "none"].includes(j) && i("unsupported", N, j, d(N));
      continue;
    }
    O !== "auto" && (u[v] = O);
  }
  const H = ["top", "right", "bottom", "left"];
  for (const v of H) {
    const N = v[0];
    for (const [j, O] of [["p", "padding"], ["m", "margin"]]) {
      const U = s[`${O}-${v}`], E = ra(U);
      if (E === void 0) {
        U?.expr && i("unsupported", `${O}-${v}`, U.expr, d(`${O}-${v}`), "no calc() in the engine");
        continue;
      }
      E !== 0 && (u[`${j}${N}`] = E);
    }
  }
  const g = s.position;
  if (g === "absolute" || g === "fixed") {
    u.position = "absolute", g === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const v of H) {
      const N = ra(s[v]);
      N !== void 0 && N !== "auto" && (u[v] = N);
    }
    if (g === "fixed" && c && u.w === void 0 && u.right === void 0 && typeof u.left == "number") {
      const v = c.width - u.left - (typeof u.ml == "number" ? u.ml : 0) - (typeof u.mr == "number" ? u.mr : 0);
      u.max_w = typeof u.max_w == "number" ? Math.min(u.max_w, v) : v;
    }
  } else g === "sticky" && i("unsupported", "position", "sticky", d("position"));
  s["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", s["z-index"], d("z-index"), "paint order is tree order");
  for (const [v, N] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const j = s[N];
    j === "hidden" || j === "clip" ? u[v] = "hidden" : (j === "auto" || j === "scroll") && (u[v] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (u.visibility = "invisible");
  const C = s["background-color"];
  C?.unreadable ? i("unsupported", "background-color", C.unreadable, d("background-color")) : C?.rgba && C.rgba[3] > 0 && (u.bg = yi(C)), s["background-image"] && s["background-image"] !== "none" && i("unsupported", "background-image", s["background-image"], d("background-image"));
  const S = H.map((v) => ra(s[`border-${v}-width`]) || 0), x = [];
  H.forEach((v, N) => {
    if (!S[N]) return;
    u[`border_${v[0]}`] = S[N];
    const j = s[`border-${v}-style`];
    j !== "solid" && i("approximated", `border-${v}-style`, j, d(`border-${v}-style`), "drawn solid");
    const O = yi(s[`border-${v}-color`]);
    O && x.push(O);
  }), x.length && (u.border_color = x[0], x.some((v) => v.value !== x[0].value) && i("approximated", "border-color", x.map((v) => v.value).join(" "), d("border-top-color"), "one border colour"));
  const z = ["top-left", "top-right", "bottom-right", "bottom-left"].map((v) => ra(s[`border-${v}-radius`]) || 0);
  z.every((v) => v === z[0]) ? z[0] && (u.rounded = z[0]) : ["tl", "tr", "br", "bl"].forEach((v, N) => {
    z[N] && (u[`rounded_${v}`] = z[N]);
  }), s.opacity !== 1 && (u.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const D = s["box-shadow"];
  if (D && D !== "none" && de(D, ",").some((v) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(v.trim())) && (u.shadow = "lg", i("approximated", "box-shadow", D, d("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !n.inherited.has("cursor")) {
    const v = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    v ? u.cursor = v : i("unsupported", "cursor", s.cursor, d("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (u.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? u.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", s["text-decoration-line"], d("text-decoration-line")), u;
}
function ad(n, i) {
  const c = n.values, s = c["line-height"];
  return {
    text_color: yi(c.color),
    text_size: Math.round(c["font-size"] * 1e3) / 1e3,
    font_weight: c["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(jd(c, i) * 1e3) / 1e3 },
    font_family: Eh(c["font-family"]),
    italic: c["font-style"] === "italic" || c["font-style"] === "oblique",
    whitespace: c["white-space"] === "nowrap" || c["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[c["text-align"]] ?? "left"
  };
}
const ld = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, Ad = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function nd(n, i, c) {
  const s = {}, u = (m, w) => w.some((y) => !n.inherited.has(y));
  for (const [m, w] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]]])
    (u(m, w) || !Ad(i[m], c[m])) && (s[m] = i[m]);
  const d = ld(i.line_height, i.text_size), p = c.line_height ? ld(c.line_height, i.text_size) : NaN;
  return (u("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (s.line_height = i.line_height), s;
}
const jh = (n, i) => ({ ...n, ...i });
function id(n, i) {
  const c = {};
  for (const [s, u] of Object.entries(n))
    u && typeof u == "object" && "value" in u ? (c[s] = u.value, u.token && (i[s] = u.token)) : s === "line_height" ? c[s] = u.factor !== void 0 ? Math.round(u.factor * 1e3) / 1e3 : `${u.px}px` : s === "italic" ? u && (c.italic = !0) : c[s] = u;
  return c.italic === !1 && delete c.italic, c;
}
function Mh(n, i) {
  const c = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const u = n[s], d = i[s];
    Ad(u, d) || (c[s] = d === void 0 ? s in xi ? xi[s] : null : d);
  }
  return c;
}
function rd(n, i) {
  const c = n.values;
  for (const [s, u] of Object.entries(n.sources)) {
    if (s.startsWith("--") || _h.has(s) || u.startsWith("ua:")) continue;
    const d = c[s];
    switch (s) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", s, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, u, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && i("unsupported", s, d, u, "no font features in the engine");
        break;
      case "text-transform":
        d !== "none" && i("approximated", s, d, u, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = c["transition-duration"];
        s === "transition-property" && p && de(p, ",").some((m) => parseFloat(m) > 0) && c["transition-property"] !== "none" && i("unsupported", "transition", `${c["transition-property"]} ${p}`, u, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && i("unsupported", s, d, u, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        s === "overflow-wrap" && d !== "normal" && i("unsupported", s, d, u);
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        c["outline-style"] !== "none" && s === "outline-style" && i("unsupported", "outline", `${ra(c["outline-width"])}px ${c["outline-style"]} ${yi(c["outline-color"])?.value ?? ""}`.trim(), u, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && i("unsupported", s, d, u);
        break;
    }
  }
}
function Ah(n, i, c, s) {
  const u = Md(n), d = [], p = (z, D, v, N, j) => d.push([z, D, v, N ?? "(user agent)", u, j]), m = s.cascade.compute(n, i), w = {}, y = ed(m, p, s.viewport);
  rd(m, p);
  const R = ad(m, s.measure), H = nd(m, R, c), g = id({ ...y, ...H }, w), C = {}, S = s.cascade.matching(n, "*").filter((z) => z.states.subject.size);
  for (const [z, D] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!S.some((U) => D.some((E) => U.states.subject.has(E)))) continue;
    const v = s.cascade.compute(n, i, new Set(D)), N = {}, j = id({ ...ed(v, () => {
    }), ...nd(v, ad(v, s.measure), c) }, N);
    z === "focus" && rd(v, p);
    const O = Mh(g, j);
    if (Object.keys(O).length) {
      C[z] = O;
      const U = Object.fromEntries(Object.entries(N).filter(([E]) => E in O));
      Object.keys(U).length && (C[`${z}_tokens`] = U);
    }
  }
  if (s.cascade.sheet.tracks(n, "hover") && (C.track_hover = !0), /tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (C.tabular = !0), y.overflow_y === "scroll") {
    const z = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    z > 0 && (C.scrollbar = z);
  }
  m.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (C.blocks_pointer = !0);
  const x = Object.entries(kh).filter(([, z]) => z.some((D) => typeof n.props[D] == "function")).map(([z]) => z);
  return x.length && (C.events = x), { computed: m, style: g, tokens: w, extra: C, meta: Uh(n), reports: d, childText: jh(c, H), where: u };
}
function Od(n, i, c, s, u = "") {
  const d = `${u}/${n.id}.${n.version}`;
  let p = s.cache.get(n);
  (!p || p.key !== d) && s.cache.set(n, p = { key: d, part: Ah(n, i, c, s) });
  const { computed: m, tokens: w, extra: y, reports: R, childText: H, where: g } = p.part;
  for (const k of R) s.findings.add(...k);
  const C = (k, Y, $, wt, Et) => s.findings.add(k, Y, $, wt, g, Et), S = { ...p.part.style }, x = { kind: "div", id: n.id, style: S, tokens: w, meta: p.part.meta, ...y };
  Object.defineProperty(x, mi, { value: m.values.display });
  const z = n.tagName;
  if (z === "svg")
    return x.kind = n.props["data-perch-image"] ? "image" : "svg", x.markup = Bh(n), x;
  if (z === "input" || z === "textarea" || z === "select") {
    x.kind = "input", x.input_type = z === "input" ? String(n.props.type ?? "text") : z;
    for (const k of ["placeholder", "checked", "disabled"]) n.props[k] !== void 0 && (x[k] = n.props[k]);
    return z !== "select" && (x.value = n.value), z === "input" && Th.test(x.input_type) && (x.field_w = Ch * m.values["font-size"]), x;
  }
  if (z === "img")
    return x.kind = "image", x.src = n.props.src ?? null, x;
  const D = m.values["text-transform"], v = [];
  let N = !1, j = !1;
  for (const k of n.childNodes) {
    if (k instanceof Ho) {
      if (k.hidden || k.data === "") continue;
      N = !0;
      const wt = v[v.length - 1];
      if (wt?.kind === "text")
        wt.source = (wt.source ?? wt.text) + k.data, wt.text = od(wt.source, D), wt.text === wt.source && delete wt.source;
      else {
        const Et = od(k.data, D);
        v.push(Et === k.data ? { kind: "text", text: Et } : { kind: "text", text: Et, source: k.data });
      }
      continue;
    }
    if (!(k instanceof ze)) continue;
    const Y = Od(k, m, H, s, d), $ = Y[mi];
    $ === "inline" || $ === "inline-block" || $ === "inline-flex" ? N = !0 : $ !== "none" && (j = !0), v.push(Y);
  }
  const O = v.some((k) => k.kind !== "text"), U = v.length === 1 && v[0].kind !== "text" && /^inline-(block|flex)$/.test(v[0][mi]) ? v[0] : null;
  if (!S.display && U) {
    const k = s.cache.get(n.childNodes.find(($) => $.id === U.id))?.part.computed, Y = k ? Hd(m.values, s.measure) - Hh(k.values, s.measure) : 0;
    S.display = "flex", S.flex_direction = "col", S.items = "start", Y > 0 && (U.style.mt = Math.round(((U.style.mt ?? 0) + Y) * 100) / 100), C("approximated", "display", `${m.values.display} holding one ${U[mi]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else !S.display && N && O && (S.display = "flex", S.flex_direction = j ? "col" : "row", j || (S.items = "baseline"), C("approximated", "display", `${m.values.display} with inline content`, "(inline formatting)", j ? "a column of its children" : "a row on the text baseline"));
  const E = m.values["letter-spacing"]?.px;
  if (E)
    for (let k = 0; k < v.length; k++) {
      const Y = v[k];
      if (Y.kind !== "text") continue;
      const $ = Math.round(E * [...Y.text].length * 1e3) / 1e3;
      v[k] = { kind: "div", style: { pr: $ }, tokens: {}, children: [Y] };
    }
  return x.children = v, x;
}
function Oh(n, i) {
  if (!i) return null;
  let s = (i.self ? n : i.closest ? Sd(n, i.closest) : i.find ? vi(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return s && i.strip && s.startsWith(i.strip) && (s = s.slice(i.strip.length)), s;
}
function Rh(n, i, c) {
  const s = i.map((d) => [d, zi(d.selector)]), u = (d) => {
    for (const p of d.children) {
      const m = c.get(p.id);
      if (m)
        for (const [w, y] of s) {
          const R = w.textRange ? "range_name" : "name";
          if (m[R] != null || !y.some((g) => _d(p, g))) continue;
          const H = Oh(p, w.key);
          m[R] = H == null ? w.name : `${w.name}:${H}`;
        }
      u(p);
    }
  };
  u(n.documentElement);
}
const wi = 0.9521, Rd = 0.2256, Hd = (n, i) => (jd(n, i) - (wi + Rd) * n["font-size"]) / 2 + wi * n["font-size"];
function Hh(n, i) {
  const c = (u) => u && typeof u == "object" && "px" in u ? u.px : 0, s = n["border-top-style"] === "none" ? 0 : c(n["border-top-width"]);
  return c(n["padding-top"]) + s + Hd(n, i);
}
const od = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : n, Ud = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Uh(n) {
  const i = {};
  for (const [c, s] of Object.entries(n.props)) {
    if (Ud.has(c) || typeof s == "function" || s === void 0 || s === null || typeof s == "object") continue;
    const u = c.startsWith("aria-") || c.startsWith("data-");
    if (s === !1 && !u) continue;
    const d = c === "htmlFor" ? "for" : c === "tabIndex" ? "tabindex" : c;
    i[d] = typeof s == "boolean" ? u ? String(s) : "" : String(s);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const Dh = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), sd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Bh(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (c) => {
    const s = [];
    for (const [d, p] of Object.entries(c.props))
      Ud.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || s.push(`${Dh(d)}="${sd(p === !0 ? "" : p)}"`);
    c.tagName === "svg" && !c.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const u = c.childNodes.map((d) => d instanceof Ho ? sd(d.data) : i(d)).join("");
    return `<${c.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${u}</${c.tagName}>`;
  };
  return i(n);
}
function qh(n) {
  const i = n.theme?.() ?? {}, c = {};
  for (const s of kd) i[s] && (c[s] = i[s]);
  return c;
}
const Yh = {};
function Gh(n, i, c, s = {}, u = null) {
  const d = qh(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([d, p]);
  (s.look !== m || s.sheet !== c) && Object.assign(s, { look: m, sheet: c, cache: /* @__PURE__ */ new WeakMap(), cascade: new gh(c, { theme: d, viewport: p }), top: null });
  const { cascade: w, cache: y } = s, R = { cascade: w, cache: y, viewport: p, findings: new Nh(), measure: i.lineHeight ? (C) => i.lineHeight(C) : null };
  s.top ??= w.compute(n.body, w.compute(n.documentElement, null));
  const H = n.body.children.map((C) => Od(C, s.top, Yh, R));
  if (u?.length) {
    const C = /* @__PURE__ */ new Map(), S = (x) => {
      x.id && C.set(x.id, x);
      for (const z of x.children ?? []) S(z);
    };
    H.forEach(S), Rh(n, u, C);
  }
  const g = /* @__PURE__ */ new Set();
  for (const C of [n, n.defaultView])
    for (const { type: S } of C?.listeners ?? []) td[S] && g.add(td[S]);
  return { schema: xh, root: H[0] ?? null, overlays: H.slice(1), document_events: [...g].sort(), unsupported: R.findings.list() };
}
const Qh = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Vh = null;
const Kh = () => Vh ??= new dh(Qh);
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
let Fa = un.NoEventPriority;
function Xh(n, i) {
  const c = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const s of c) {
    if (s === "children") continue;
    const u = n[s], d = i[s];
    if (!(u === d || typeof u == "function" && typeof d == "function") && !(s === "style" && u && d && typeof u == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(u), ...Object.keys(d)])].every((m) => u[m] === d[m])))
      return !0;
  }
  return !1;
}
const Zh = {
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
  createInstance: (n, i, c) => new ze(n, i, c.ownerDocument),
  createTextInstance: (n, i) => new Ho(n),
  appendInitialChild: (n, i) => {
    n.appendChild(i);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, i, c) => !!c.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, i) => {
    n.appendChild(i);
  },
  appendChildToContainer: (n, i) => {
    n.appendChild(i);
  },
  insertBefore: (n, i, c) => {
    n.insertBefore(i, c);
  },
  insertInContainerBefore: (n, i, c) => {
    n.insertBefore(i, c);
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
  commitUpdate: (n, i, c, s) => {
    n.props = s, Xh(c, s) && n.touch();
  },
  commitTextUpdate: (n, i, c) => {
    n.data = String(c);
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
    Fa = n;
  },
  getCurrentUpdatePriority: () => Fa,
  resolveUpdatePriority: () => Fa !== un.NoEventPriority ? Fa : un.DefaultEventPriority,
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
}, _e = Ip(Zh), Bo = (n, i, c = null) => _e.createPortal(n, i, null, c), Jh = {
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
class Lh {
  constructor(i, c, s) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, c), this.type = i, this.target = s, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function pi(n, i, c) {
  i.currentTarget = n;
  for (const { type: s, listener: u, capture: d } of [...n.listeners ?? []])
    s === i.type && d === c && u.call(n, i);
  if (n instanceof ze) {
    const s = Jh[i.type], u = s && n.props[c ? `${s}Capture` : s];
    typeof u == "function" && u(i);
  }
}
const Wh = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
function Pg(n, i, c = {}) {
  const { document: s, window: u } = Yp(n), d = new ze("div", { id: "root", style: c.container ?? {} }, s);
  s.body.appendChild(d);
  const p = [];
  let m = null;
  const w = () => [s, u].map((v) => v.listeners.map((N) => `${N.type}:${N.capture}`).sort().join(",")).join("|");
  let y = "";
  const R = {}, H = () => (m = Gh(s, n, Kh(), R, c.names), y = w(), n.render?.(m), m), g = () => {
    _e.flushPassiveEffects(), _e.flushSyncWork(), w() !== y && H();
  };
  s.afterCommit = H;
  const C = (v) => {
    p.push(v), n.error?.(v);
  }, S = _e.createContainer(d, un.ConcurrentRoot, null, !1, null, "", C, C, C, null);
  _e.updateContainerSync(Ut.createElement(i, c.props ?? {}), S, null, null), _e.flushSyncWork(), g();
  const x = (v) => {
    const N = (j) => {
      if (j.id === v) return j;
      for (const O of j.children) {
        const U = N(O);
        if (U) return U;
      }
      return null;
    };
    return N(s.documentElement);
  }, z = (v) => {
    const N = Fa;
    Fa = un.DiscreteEventPriority;
    try {
      return v();
    } finally {
      Fa = N, _e.flushSyncWork(), g();
    }
  }, D = {
    document: s,
    window: u,
    container: d,
    errors: p,
    /** The latest description (after the last commit or state change). */
    get description() {
      return m;
    },
    describe: H,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(v, N, j = {}) {
      const O = typeof v == "string" ? x(v) : v;
      if (!O) return !1;
      const U = new Lh(N, j, O), E = [];
      for (let Y = O; Y; Y = Y.parentNode) E.push(Y);
      const k = [...E, s, u];
      return z(() => {
        for (let Y = k.length - 1; Y > 0 && !U.propagationStopped; Y--) pi(k[Y], U, !0);
        U.propagationStopped || (pi(O, U, !0), U.propagationStopped || pi(O, U, !1));
        for (let Y = 1; Y < k.length && !U.propagationStopped; Y++) pi(k[Y], U, !1);
      }), !U.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end, Backspace deletes the last one, and the field gets `input` and
     * `change` events with its new `value`. Returns whether the source took the key (prevented it, or a field
     * changed). */
    key(v) {
      const N = s.activeElement && s.activeElement !== s.body ? s.activeElement : s.body;
      if (!D.dispatch(N, "keydown", v)) return !0;
      if (!Wh(N) || N.props.disabled || N.props.readOnly || v.ctrlKey || v.metaKey) return !1;
      const O = N.value, U = v.key === "Backspace" ? O.slice(0, -1) : [...v.key].length === 1 ? O + v.key : O;
      return U === O ? !1 : (N.value = U, D.dispatch(N, "input", { data: v.key }), D.dispatch(N, "change", {}), N.props.value !== void 0 && delete N.edit, N.touch(), H(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(v, N) {
      const j = x(v);
      j && (j.bounds = { x: N.x, y: N.y, width: N.width, height: N.height });
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(v, N = {}) {
      const j = { button: 0, buttons: 1, pointerType: "mouse", ...N };
      for (const O of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) D.dispatch(v, O, j);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (v) => !!x(v)?.state.hover,
    hover(v, N) {
      const j = x(v);
      !j || j.state.hover === N || (j.state.hover = N, j.touch(), H());
    },
    focus(v) {
      const N = x(v);
      N && (z(() => {
        const j = s.activeElement;
        j && j !== N && j !== s.body && D.dispatch(j, "blur"), s.focus(N), D.dispatch(N, "focus");
      }), H());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: g,
    update(v) {
      _e.updateContainerSync(Ut.createElement(i, v ?? {}), S, null, null), _e.flushSyncWork(), g();
    },
    unmount() {
      _e.updateContainerSync(null, S, null, null), _e.flushSyncWork(), _e.flushPassiveEffects(), s.afterCommit = null;
    }
  };
  return D;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Dd = (n) => _e.flushSyncFromReconciler(n), Fh = { createPortal: Bo, flushSync: Dd }, tv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Bo,
  default: Fh,
  flushSync: Dd
}, Symbol.toStringTag, { value: "Module" }));
function Bd(n) {
  var i, c, s = "";
  if (typeof n == "string" || typeof n == "number") s += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var u = n.length;
    for (i = 0; i < u; i++) n[i] && (c = Bd(n[i])) && (s && (s += " "), s += c);
  } else for (c in n) n[c] && (s && (s += " "), s += c);
  return s;
}
function qd() {
  for (var n, i, c = 0, s = "", u = arguments.length; c < u; c++) (n = arguments[c]) && (i = Bd(n)) && (s && (s += " "), s += i);
  return s;
}
const Ih = (n, i) => {
  const c = new Array(n.length + i.length);
  for (let s = 0; s < n.length; s++)
    c[s] = n[s];
  for (let s = 0; s < i.length; s++)
    c[n.length + s] = i[s];
  return c;
}, $h = (n, i) => ({
  classGroupId: n,
  validator: i
}), Yd = (n = /* @__PURE__ */ new Map(), i = null, c) => ({
  nextPart: n,
  validators: i,
  classGroupId: c
}), _i = "-", ud = [], Ph = "arbitrary..", t0 = (n) => {
  const i = a0(n), {
    conflictingClassGroups: c,
    conflictingClassGroupModifiers: s
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return e0(p);
      const m = p.split(_i), w = m[0] === "" && m.length > 1 ? 1 : 0;
      return Gd(m, w, i);
    },
    getConflictingClassGroupIds: (p, m) => {
      if (m) {
        const w = s[p], y = c[p];
        return w ? y ? Ih(y, w) : w : y || ud;
      }
      return c[p] || ud;
    }
  };
}, Gd = (n, i, c) => {
  if (n.length - i === 0)
    return c.classGroupId;
  const u = n[i], d = c.nextPart.get(u);
  if (d) {
    const y = Gd(n, i + 1, d);
    if (y) return y;
  }
  const p = c.validators;
  if (p === null)
    return;
  const m = i === 0 ? n.join(_i) : n.slice(i).join(_i), w = p.length;
  for (let y = 0; y < w; y++) {
    const R = p[y];
    if (R.validator(m))
      return R.classGroupId;
  }
}, e0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), c = i.indexOf(":"), s = i.slice(0, c);
  return s ? Ph + s : void 0;
})(), a0 = (n) => {
  const {
    theme: i,
    classGroups: c
  } = n;
  return l0(c, i);
}, l0 = (n, i) => {
  const c = Yd();
  for (const s in n) {
    const u = n[s];
    qo(u, c, s, i);
  }
  return c;
}, qo = (n, i, c, s) => {
  const u = n.length;
  for (let d = 0; d < u; d++) {
    const p = n[d];
    n0(p, i, c, s);
  }
}, n0 = (n, i, c, s) => {
  if (typeof n == "string") {
    i0(n, i, c);
    return;
  }
  if (typeof n == "function") {
    r0(n, i, c, s);
    return;
  }
  o0(n, i, c, s);
}, i0 = (n, i, c) => {
  const s = n === "" ? i : Qd(i, n);
  s.classGroupId = c;
}, r0 = (n, i, c, s) => {
  if (s0(n)) {
    qo(n(s), i, c, s);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push($h(c, n));
}, o0 = (n, i, c, s) => {
  const u = Object.entries(n), d = u.length;
  for (let p = 0; p < d; p++) {
    const [m, w] = u[p];
    qo(w, Qd(i, m), c, s);
  }
}, Qd = (n, i) => {
  let c = n;
  const s = i.split(_i), u = s.length;
  for (let d = 0; d < u; d++) {
    const p = s[d];
    let m = c.nextPart.get(p);
    m || (m = Yd(), c.nextPart.set(p, m)), c = m;
  }
  return c;
}, s0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, u0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, c = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const u = (d, p) => {
    c[d] = p, i++, i > n && (i = 0, s = c, c = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let p = c[d];
      if (p !== void 0)
        return p;
      if ((p = s[d]) !== void 0)
        return u(d, p), p;
    },
    set(d, p) {
      d in c ? c[d] = p : u(d, p);
    }
  };
}, No = "!", cd = ":", c0 = [], dd = (n, i, c, s, u) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: c,
  maybePostfixModifierPosition: s,
  isExternal: u
}), d0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: c
  } = n;
  let s = (u) => {
    const d = [];
    let p = 0, m = 0, w = 0, y;
    const R = u.length;
    for (let x = 0; x < R; x++) {
      const z = u[x];
      if (p === 0 && m === 0) {
        if (z === cd) {
          d.push(u.slice(w, x)), w = x + 1;
          continue;
        }
        if (z === "/") {
          y = x;
          continue;
        }
      }
      z === "[" ? p++ : z === "]" ? p-- : z === "(" ? m++ : z === ")" && m--;
    }
    const H = d.length === 0 ? u : u.slice(w);
    let g = H, C = !1;
    H.endsWith(No) ? (g = H.slice(0, -1), C = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      H.startsWith(No) && (g = H.slice(1), C = !0)
    );
    const S = y && y > w ? y - w : void 0;
    return dd(d, C, g, S);
  };
  if (i) {
    const u = i + cd, d = s;
    s = (p) => p.startsWith(u) ? d(p.slice(u.length)) : dd(c0, !1, p, void 0, !0);
  }
  if (c) {
    const u = s;
    s = (d) => c({
      className: d,
      parseClassName: u
    });
  }
  return s;
}, f0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((c, s) => {
    i.set(c, 1e6 + s);
  }), (c) => {
    const s = [];
    let u = [];
    for (let d = 0; d < c.length; d++) {
      const p = c[d], m = p[0] === "[", w = i.has(p);
      m || w ? (u.length > 0 && (u.sort(), s.push(...u), u = []), s.push(p)) : u.push(p);
    }
    return u.length > 0 && (u.sort(), s.push(...u)), s;
  };
}, m0 = (n) => ({
  cache: u0(n.cacheSize),
  parseClassName: d0(n),
  sortModifiers: f0(n),
  postfixLookupClassGroupIds: p0(n),
  ...t0(n)
}), p0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), c = n.postfixLookupClassGroups;
  if (c)
    for (let s = 0; s < c.length; s++)
      i[c[s]] = !0;
  return i;
}, h0 = /\s+/, g0 = (n, i) => {
  const {
    parseClassName: c,
    getClassGroupId: s,
    getConflictingClassGroupIds: u,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, m = [], w = n.trim().split(h0);
  let y = "";
  for (let R = w.length - 1; R >= 0; R -= 1) {
    const H = w[R], {
      isExternal: g,
      modifiers: C,
      hasImportantModifier: S,
      baseClassName: x,
      maybePostfixModifierPosition: z
    } = c(H);
    if (g) {
      y = H + (y.length > 0 ? " " + y : y);
      continue;
    }
    let D = !!z, v;
    if (D) {
      const E = x.substring(0, z);
      v = s(E);
      const k = v && p[v] ? s(x) : void 0;
      k && k !== v && (v = k, D = !1);
    } else
      v = s(x);
    if (!v) {
      if (!D) {
        y = H + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (v = s(x), !v) {
        y = H + (y.length > 0 ? " " + y : y);
        continue;
      }
      D = !1;
    }
    const N = C.length === 0 ? "" : C.length === 1 ? C[0] : d(C).join(":"), j = S ? N + No : N, O = j + v;
    if (m.indexOf(O) > -1)
      continue;
    m.push(O);
    const U = u(v, D);
    for (let E = 0; E < U.length; ++E) {
      const k = U[E];
      m.push(j + k);
    }
    y = H + (y.length > 0 ? " " + y : y);
  }
  return y;
}, v0 = (...n) => {
  let i = 0, c, s, u = "";
  for (; i < n.length; )
    (c = n[i++]) && (s = Vd(c)) && (u && (u += " "), u += s);
  return u;
}, Vd = (n) => {
  if (typeof n == "string")
    return n;
  let i, c = "";
  for (let s = 0; s < n.length; s++)
    n[s] && (i = Vd(n[s])) && (c && (c += " "), c += i);
  return c;
}, b0 = (n, ...i) => {
  let c, s, u, d;
  const p = (w) => {
    const y = i.reduce((R, H) => H(R), n());
    return c = m0(y), s = c.cache.get, u = c.cache.set, d = m, m(w);
  }, m = (w) => {
    const y = s(w);
    if (y)
      return y;
    const R = g0(w, c);
    return u(w, R), R;
  };
  return d = p, (...w) => d(v0(...w));
}, y0 = [], Vt = (n) => {
  const i = (c) => c[n] || y0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, Kd = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Xd = /^\((?:(\w[\w-]*):)?(.+)\)$/i, x0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, w0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, _0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, S0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, z0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, E0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ta = (n) => x0.test(n), dt = (n) => !!n && !Number.isNaN(Number(n)), Qe = (n) => !!n && Number.isInteger(Number(n)), bo = (n) => n.endsWith("%") && dt(n.slice(0, -1)), ia = (n) => w0.test(n), Zd = () => !0, k0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  _0.test(n) && !S0.test(n)
), Yo = () => !1, N0 = (n) => z0.test(n), T0 = (n) => E0.test(n), C0 = (n) => !J(n) && !L(n), j0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), M0 = (n) => Ca(n, Wd, Yo), J = (n) => Kd.test(n), Wa = (n) => Ca(n, Fd, k0), fd = (n) => Ca(n, q0, dt), A0 = (n) => Ca(n, $d, Zd), O0 = (n) => Ca(n, Id, Yo), md = (n) => Ca(n, Jd, Yo), R0 = (n) => Ca(n, Ld, T0), hi = (n) => Ca(n, Pd, N0), L = (n) => Xd.test(n), on = (n) => Ia(n, Fd), H0 = (n) => Ia(n, Id), pd = (n) => Ia(n, Jd), U0 = (n) => Ia(n, Wd), D0 = (n) => Ia(n, Ld), gi = (n) => Ia(n, Pd, !0), B0 = (n) => Ia(n, $d, !0), Ca = (n, i, c) => {
  const s = Kd.exec(n);
  return s ? s[1] ? i(s[1]) : c(s[2]) : !1;
}, Ia = (n, i, c = !1) => {
  const s = Xd.exec(n);
  return s ? s[1] ? i(s[1]) : c : !1;
}, Jd = (n) => n === "position" || n === "percentage", Ld = (n) => n === "image" || n === "url", Wd = (n) => n === "length" || n === "size" || n === "bg-size", Fd = (n) => n === "length", q0 = (n) => n === "number", Id = (n) => n === "family-name", $d = (n) => n === "number" || n === "weight", Pd = (n) => n === "shadow", Y0 = () => {
  const n = Vt("color"), i = Vt("font"), c = Vt("text"), s = Vt("font-weight"), u = Vt("tracking"), d = Vt("leading"), p = Vt("breakpoint"), m = Vt("container"), w = Vt("spacing"), y = Vt("radius"), R = Vt("shadow"), H = Vt("inset-shadow"), g = Vt("text-shadow"), C = Vt("drop-shadow"), S = Vt("blur"), x = Vt("perspective"), z = Vt("aspect"), D = Vt("ease"), v = Vt("animate"), N = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], j = () => [
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
  ], O = () => [...j(), L, J], U = () => ["auto", "hidden", "clip", "visible", "scroll"], E = () => ["auto", "contain", "none"], k = () => [L, J, w], Y = () => [Ta, "full", "auto", ...k()], $ = () => [Qe, "none", "subgrid", L, J], wt = () => ["auto", {
    span: ["full", Qe, L, J]
  }, Qe, L, J], Et = () => [Qe, "auto", L, J], Ot = () => ["auto", "min", "max", "fr", L, J], Lt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Nt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], G = () => ["auto", ...k()], P = () => [Ta, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...k()], nt = () => [m, Ta, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...k()], ot = () => [Ta, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...k()], K = () => [n, L, J], b = () => [...j(), pd, md, {
    position: [L, J]
  }], q = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", U0, M0, {
    size: [L, J]
  }], F = () => [bo, on, Wa], I = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    L,
    J
  ], et = () => ["", dt, on, Wa], vt = () => ["solid", "dashed", "dotted", "double"], Kt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], st = () => [dt, bo, pd, md], ja = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    S,
    L,
    J
  ], Ma = () => ["none", dt, L, J], je = () => ["none", dt, L, J], Me = () => [dt, L, J], ua = () => [Ta, "full", ...k()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [ia],
      breakpoint: [ia],
      color: [Zd],
      container: [ia],
      "drop-shadow": [ia],
      ease: ["in", "out", "in-out"],
      font: [C0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [ia],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [ia],
      shadow: [ia],
      spacing: ["px", dt],
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
        aspect: ["auto", "square", Ta, J, L, z]
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
      "container-named": [j0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [dt, "auto", J, L, m]
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
        object: O()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: U()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": U()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": U()
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
        basis: [Ta, "full", "auto", m, ...k()]
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
        flex: [dt, Ta, "auto", "initial", "none", J]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", dt, L, J]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", dt, L, J]
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
        "grid-cols": $()
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
        "grid-rows": $()
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
        m: G()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: G()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: G()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: G()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: G()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: G()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: G()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: G()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: G()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: G()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: G()
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
        size: P()
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
        block: ["auto", ...ot()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...ot()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...ot()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [m, "screen", ...P()]
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
          ...P()
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
          ...P()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...P()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...P()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...P()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", c, on, Wa]
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
        font: [s, B0, A0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", bo, J]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [H0, O0, i]
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
        tracking: [u, L, J]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [dt, "none", L, fd]
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
          ...k()
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
        placeholder: K()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: K()
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
        decoration: [...vt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [dt, "from-font", "auto", L, Wa]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: K()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [dt, "auto", L, J]
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
          }, Qe, L, J],
          radial: ["", L, J],
          conic: ["", Qe, L, J]
        }, D0, R0]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: K()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: F()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: F()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: F()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: K()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: K()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: K()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: I()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": I()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": I()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": I()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": I()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": I()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": I()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": I()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": I()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": I()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": I()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": I()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": I()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": I()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": I()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: et()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": et()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": et()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": et()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": et()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": et()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": et()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": et()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": et()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": et()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": et()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": et()
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
        "divide-y": et()
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
        border: [...vt(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...vt(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: K()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": K()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": K()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": K()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": K()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": K()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": K()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": K()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": K()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": K()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": K()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: K()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...vt(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [dt, L, J]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", dt, on, Wa]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: K()
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
          gi,
          hi
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: K()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", H, gi, hi]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": K()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: et()
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
        ring: K()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [dt, Wa]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": K()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": et()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": K()
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
        "text-shadow": K()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [dt, L, J]
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
        "mask-linear": [dt]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": st()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": st()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": K()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": K()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": st()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": st()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": K()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": K()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": st()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": st()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": K()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": K()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": st()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": st()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": K()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": K()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": st()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": st()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": K()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": K()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": st()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": st()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": K()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": K()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": st()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": st()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": K()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": K()
      }],
      "mask-image-radial": [{
        "mask-radial": [L, J]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": st()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": st()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": K()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": K()
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
        "mask-conic": [dt]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": st()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": st()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": K()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": K()
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
        blur: ja()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [dt, L, J]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [dt, L, J]
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
          C,
          gi,
          hi
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": K()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", dt, L, J]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [dt, L, J]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", dt, L, J]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [dt, L, J]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", dt, L, J]
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
        "backdrop-blur": ja()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [dt, L, J]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [dt, L, J]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", dt, L, J]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [dt, L, J]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", dt, L, J]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [dt, L, J]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [dt, L, J]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", dt, L, J]
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
        duration: [dt, "initial", L, J]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", D, L, J]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [dt, L, J]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", v, L, J]
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
        perspective: [x, L, J]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": O()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Ma()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Ma()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Ma()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Ma()
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
        origin: O()
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
        accent: K()
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
        caret: K()
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
        "scrollbar-thumb": K()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": K()
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
        fill: ["none", ...K()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [dt, on, Wa, fd]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...K()]
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
}, G0 = /* @__PURE__ */ b0(Y0);
function Ke(...n) {
  return G0(qd(n));
}
const tf = typeof navigator < "u" && /Mac/i.test(navigator.platform), Si = {
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
for (let n = 1; n <= 12; n++) Si[`f${n}`] = `F${n}`;
const Q0 = Object.fromEntries(Object.entries(Si).map(([n, i]) => [i, n])), V0 = {
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
function K0(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : Q0[n];
}
const hd = /* @__PURE__ */ new Map();
function ef(n, i = tf) {
  const c = `${i}|${n}`, s = hd.get(c);
  if (s) return s;
  const u = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      i ? u.cmd = !0 : (u.ctrl = !0, u.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") u[d] = !0;
    else if (/^[a-z]$/.test(d))
      u.code = `Key${d.toUpperCase()}`, u.letter = d;
    else if (/^[0-9]$/.test(d)) u.code = `Digit${d}`;
    else if (Si[d]) u.code = Si[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!u.code) throw new Error(`no key in "${n}"`);
  return hd.set(c, u), u;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = ef(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function X0(n, i = tf) {
  const c = ef(n, i), s = Z0(K0(c.code) ?? "");
  return i ? `${c.ctrl ? "⌃" : ""}${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${c.cmd ? "⌘" : ""}${s}` : [c.ctrl && "Ctrl", c.alt && "Alt", c.shift && "Shift", s].filter(Boolean).join("+");
}
const Z0 = (n) => V0[n] ?? n.toUpperCase(), gd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, vd = qd, Ei = (n, i) => (c) => {
  var s;
  if (i?.variants == null) return vd(n, c?.class, c?.className);
  const { variants: u, defaultVariants: d } = i, p = Object.keys(u).map((y) => {
    const R = c?.[y], H = d?.[y];
    if (R === null) return null;
    const g = gd(R) || gd(H);
    return u[y][g];
  }), m = c && Object.entries(c).reduce((y, R) => {
    let [H, g] = R;
    return g === void 0 || (y[H] = g), y;
  }, {}), w = i == null || (s = i.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((y, R) => {
    let { class: H, className: g, ...C } = R;
    return Object.entries(C).every((S) => {
      let [x, z] = S;
      return Array.isArray(z) ? z.includes({
        ...d,
        ...m
      }[x]) : {
        ...d,
        ...m
      }[x] === z;
    }) ? [
      ...y,
      H,
      g
    ] : y;
  }, []);
  return vd(n, p, w, c?.class, c?.className);
}, J0 = Ei(
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
), L0 = Ei(
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
function W0({ className: n, ...i } = {}) {
  return Ke(L0(i), n);
}
const af = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", lf = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", F0 = Ei(`${lf} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function I0({ className: n, ...i } = {}) {
  return Ke(F0(i), n);
}
const $0 = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", P0 = Ei(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), tg = "my-1 h-px bg-overlay-0";
function eg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function ag({ size: n = 16, className: i }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function lg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ te.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function nf({ size: n = 14, className: i }) {
  return /* @__PURE__ */ te.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const bd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function ng({ state: n, error: i }) {
  return /* @__PURE__ */ te.jsx(
    "span",
    {
      className: Ke("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", bd[n] ?? bd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function ig({ title: n, onClose: i, children: c, testId: s }) {
  return Bo(
    /* @__PURE__ */ te.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (u) => {
          u.target === u.currentTarget && i();
        },
        onKeyDown: (u) => {
          u.key === "Escape" && i();
        },
        children: /* @__PURE__ */ te.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": s,
            children: [
              /* @__PURE__ */ te.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              c
            ]
          }
        )
      }
    ),
    document.body
  );
}
function rg(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const To = {
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
function Co(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((c) => c.id === n.parentSessionId);
}
function og(n) {
  const i = /* @__PURE__ */ new Map();
  for (const c of n)
    Co(c, n) && i.set(c.parentSessionId, [...i.get(c.parentSessionId) ?? [], c]);
  return i.size ? n.filter((c) => !Co(c, n)).flatMap((c) => [c, ...i.get(c.id) ?? []]) : n;
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const sg = "1.3.0";
function re() {
  const n = globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const ug = (n) => re().subscribe?.(n) ?? (() => {
}), cg = globalThis.perch?.isMac !== !1, dg = (n) => X0(n, re().isMac !== !1), fg = (n) => J0(n), mg = ({ className: n, ...i } = {}) => Ke(W0(i), n), pg = I0, hg = (n) => P0(n), gg = tg, vg = lf, bg = af, yg = (n) => To[n].color, xg = (n, i) => re().shortcutFor?.(n, i) ?? null, wg = (n, i) => re().command(n, i ?? {}) !== !1, _g = (n, i, c) => re().startSession?.(n, i, c), Sg = globalThis.perch?.pickFolder ? (n) => re().pickFolder(n) : null;
function cn(n) {
  const i = Ut.useRef(n);
  return i.current = n, Ut.useSyncExternalStore(ug, () => i.current(re()));
}
const zg = (n = {}) => cn((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Eg = () => cn((n) => n.hosts()), kg = () => cn((n) => n.sessionFolders());
function Ng() {
  const n = cn((i) => i.addProject?.() ?? Tg);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, c, s) => {
      i.trim() && n.status !== "pending" && re().addProjectFolder?.(i, c, s);
    },
    clear: () => re().clearAddProject?.()
  };
}
const Tg = Object.freeze({ status: "idle" });
function Cg(n) {
  Ut.useEffect(() => re().onRequest?.("add-project", n) ?? void 0, [n]);
}
function jg(n) {
  const i = n.map((c) => ({ id: c.id, parentSessionId: c.parentId, session: c }));
  return og(i).map((c) => ({ session: c.session, nested: Co(c, i) }));
}
function Mg({ id: n, plain: i, className: c }) {
  const s = cn((y) => y.session(n));
  if (!s) return null;
  const u = s.state ?? rg(s), d = To[u]?.color ?? To.unknown.color, p = s.provider, m = p === "claude" || p === "claude-agent-teams" || p === "omp", w = i ? Ke("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", c) : Ke("agent-status-dot", `agent-status-dot--${u}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", c);
  return Ut.createElement(
    "span",
    { className: w, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${u}`, "aria-hidden": "true" },
    Ut.createElement("span", { className: Ke("inline-flex text-fg", m && "rounded-full bg-[#161616]") }, Ut.createElement(rf, { provider: p, size: 14 }))
  );
}
function rf({ provider: n, size: i = 14 }) {
  const c = re().agentIcon?.(n, i) ?? null, s = c?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return Ut.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": s, ...c && c.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Ag = ({ children: n }) => Ut.createElement(Ut.Fragment, null, n);
function Og(n, i) {
  const c = Ut.useRef(i);
  return c.current = i, Ut.useEffect(() => {
    const s = re();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const u = {};
    for (const [p, m] of Object.entries(c.current))
      u[p] = typeof m == "function" ? (...w) => c.current[p]?.(...w) : m;
    const d = s.openOverlay(n, u);
    return () => s.closeOverlay?.(d);
  }, [n]), null;
}
const Tl = (n) => function(c) {
  return Og(n, c);
}, Rg = Tl("session-menu"), Hg = Tl("new-session-menu"), Ug = Tl("confirm");
function Dg({ value: n, onChange: i, options: c = [], className: s, ariaLabel: u, testId: d, title: p, disabled: m, placeholder: w }) {
  const y = Ut.useRef(null), R = c.find((H) => H.value === n);
  return Ut.createElement(
    "button",
    {
      type: "button",
      ref: y,
      title: p,
      disabled: m,
      "aria-label": u,
      "data-testid": d,
      "aria-haspopup": "listbox",
      className: Ke("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
      onClick: () => re().openOverlay?.("select", { value: n, options: c, onChange: (H) => i?.(H), anchor: y.current?.getBoundingClientRect() })
    },
    Ut.createElement("span", { className: "min-w-0 flex-1 truncate" }, R ? R.label : w ?? "")
  );
}
const Bg = Tl("folder-browser"), qg = Tl("instructions"), Yg = Tl("memory"), Gg = ig;
function Qg({ hostId: n, path: i, className: c }) {
  const s = Ut.useRef(null);
  return Ut.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Ke("worktree-menu__btn", af, c),
      "data-testid": `worktree-menu-${n}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => re().openOverlay?.("worktree", { hostId: n, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    Ut.createElement(nf, null)
  );
}
const Vg = (n, i) => re().beginReorderDrag?.(n, i), ev = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: rf,
  CloseIcon: lg,
  ConfirmDialog: Ug,
  Dialog: Gg,
  EllipsisIcon: eg,
  FolderBrowser: Bg,
  GearIcon: ag,
  HostStateDot: ng,
  InstructionsDialog: qg,
  MemoryDialog: Yg,
  NewSessionMenu: Hg,
  PlusIcon: nf,
  Select: Dg,
  SessionDot: Mg,
  SessionMenu: Rg,
  Slot: Ag,
  WorktreeMenu: Qg,
  agentStateColor: yg,
  beginReorderDrag: Vg,
  buttonClass: pg,
  cn: Ke,
  ghostButton: vg,
  iconButton: bg,
  isMac: cg,
  keyLabel: dg,
  menuDividerClass: gg,
  menuItemClass: hg,
  menuPanel: $0,
  nestSessions: jg,
  pickFolder: Sg,
  rowActionClass: mg,
  runCommand: wg,
  segmentClass: fg,
  shortcutFor: xg,
  startSession: _g,
  useAddProject: Ng,
  useAddProjectRequest: Cg,
  useHosts: Eg,
  useNavigation: zg,
  useSessionFolders: kg,
  version: sg
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
const Go = {
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
  Go[n] = (i, c) => i[n](c);
const av = Object.keys(Go);
function yd(n, i) {
  for (const [c, s] of Object.entries(i)) {
    const u = Go[c];
    if (!u) throw new Error(`the description key ${c} has no GPUI builder`);
    s != null && (n = u(n, s));
  }
  return n;
}
const El = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 });
function Kg(n, i, c) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || c)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const sa = (n) => n.style?.display !== "hidden";
function jo(n, i, c, s, u = !1, d = !1, p = null, m = {}, w = !1, y = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return n.text;
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0 }), p = n.style.text_color ?? p;
  const R = !!n.hover?.text_color && sf(n);
  R && c.hovered?.(n.id) && (p = n.hover.text_color), m = { ...m };
  for (const j of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[j] !== void 0 && (m[j] = n.style[j]);
  const H = new Set(n.events ?? []);
  let g;
  n.kind === "image" && !n.markup ? g = i.image(n.src) : g = i.div(), n.markup && (g = g.child(s.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const C = Kg(n, H, u);
  C && (g = g.id(C)), g = yd(g, { ...n.style, ...y.get(n) });
  const S = m.whitespace !== "nowrap" && !m.text_ellipsis;
  w && S && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && (n.children ?? []).some((j) => j.kind === "text") && (g = g.min_w(0));
  for (const j of ["hover", "focus", "active"]) n[j] && (g = g[j]((O) => yd(O, n[j])));
  n.kind === "input" && !n.disabled && (g = g.on_mouse_down("left", (j, O) => {
    c.focus(n.id), O.notify();
  }));
  const x = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((j) => H.has(j));
  if (x && (g = g.on_mouse_down("left", (j, O) => {
    O.stop_propagation?.(), j.bounds && c.setBounds(n.id, j.bounds);
    const U = { ...El(j), button: 0, buttons: 1, detail: j.click_count };
    c.dispatch(n.id, "pointerdown", { ...U, pointerType: "mouse" }), c.dispatch(n.id, "mousedown", U), O.notify();
  }), g = g.on_mouse_down("right", (j, O) => {
    O.stop_propagation?.(), j.bounds && c.setBounds(n.id, j.bounds), c.dispatch(n.id, "contextmenu", { ...El(j), button: 2 }), O.notify();
  }), g = g.on_mouse_up("left", (j, O) => {
    O.stop_propagation?.();
    const U = { ...El(j), button: 0 };
    c.dispatch(n.id, "pointerup", { ...U, pointerType: "mouse" }), c.dispatch(n.id, "mouseup", U), O.notify();
  }), g = g.on_click((j, O) => {
    c.dispatch(n.id, j.click_count === 2 && H.has("double_click") ? "dblclick" : "click", { detail: j.click_count, button: 0 }), O.notify();
  })), n.blocks_pointer && !x)
    for (const j of ["left", "right"]) g = g.on_mouse_down(j, (O, U) => U.stop_propagation?.());
  if (H.has("mouse_move") && (g = g.on_mouse_move((j, O) => {
    c.dispatch(n.id, "pointermove", { ...El(j), pointerType: "mouse" }), O.notify();
  })), (n.track_hover || R) && (g = g.on_hover((j, O) => {
    c.hover(n.id, j), O.notify();
  })), u && (g = g.on_mouse_down_out((j, O) => {
    c.dispatch(c.document.body.id, "pointerdown", { ...El(j), pointerType: "mouse" }), c.dispatch(c.document.body.id, "mousedown", El(j)), O.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const j = n.value ? String(n.value) : String(n.placeholder ?? "");
    let O = i.div().whitespace_nowrap().overflow_x_hidden();
    const U = kl(m);
    U && (O = O.h(U)), !n.value && p && (O = O.text_color(Xg(p))), j && (g = g.child(O.child(n.input_type === "password" && n.value ? "•".repeat([...j].length) : j))), n.field_w && (g = g.child(i.div().w(n.field_w).h(0)));
  }
  const z = m.whitespace === "nowrap" ? kl(m) : null, D = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let v = !n.range_name;
  const N = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const j of (n.children ?? []).filter(sa)) {
    const O = j.style?.flex_basis;
    N && j.style.flex_grow > 0 && (O === 0 || typeof O == "string" && O.endsWith("%")) && y.set(j, { ...y.get(j), flex_basis: "auto" });
    let U = jo(j, i, c, s, !1, d, p, m, D && j.style?.position !== "absolute", y);
    const E = !v && (j.kind === "text" || !j.meta), k = j.kind === "text" ? y.get(j)?.h ?? z : null, Y = j.kind === "text" ? y.get(j)?.w : void 0;
    if (E || k || Y !== void 0) {
      let $ = i.div();
      E && ($ = $.id(n.range_name)), k && ($ = $.h(k)), Y !== void 0 && ($ = $.w(Y).flex_none().whitespace_nowrap()), U = $.child(U), v ||= E;
    }
    g = g.child(U);
  }
  return g;
}
function Xg(n) {
  const i = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return n;
  const c = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(c / 2).toString(16).padStart(2, "0")}`;
}
const of = /^[!-,.-~]+$/, sf = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && sf(i));
function kl(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function lv(n, i, c, s, u = 0) {
  const d = [n.root, ...n.overlays], p = u > 0 ? Fg(d, u) : /* @__PURE__ */ new Map();
  u > 0 && s.measure && Zg(d, u, s.measure, p), Lg(d, p), Jg(d, p);
  let m = i.div().relative().size_full().child(jo(n.root, i, c, s, !1, !1, null, {}, !1, p));
  for (const w of n.overlays) m = m.child(jo(w, i, c, s, !0, !1, null, {}, !1, p));
  return m;
}
function Zg(n, i, c, s) {
  const u = (S, x) => s.set(S, { ...s.get(S), ...x }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function w(S, x, z) {
    if (S.kind === "text") {
      if (!(x.whitespace === "nowrap" || of.test(S.text)) || x.text_ellipsis || z || typeof x.text_size != "number") return NaN;
      const E = c(S.text, { size: x.text_size, weight: x.font_weight ?? 400, family: x.font_family ?? ".SystemUIFont", italic: !!x.italic });
      return Number.isFinite(E) ? E : NaN;
    }
    if (!sa(S) || S.kind === "input" || S.markup) return y(S);
    const D = { ...x };
    for (const U of m) S.style[U] !== void 0 && (D[U] = S.style[U]);
    p.set(S, D);
    const v = S.style, N = (S.children ?? []).filter(Ve), j = N.map((U) => w(U, D, z || !!S.tabular));
    let O = y(S);
    if (!Number.isFinite(O) && v.w === void 0) {
      const U = N.map((k, Y) => j[Y] + (k.kind === "text" ? 0 : W(k.style.ml) + W(k.style.mr)));
      let E;
      N.length ? oa(S) ? E = N.some((k) => k.kind !== "text" && k.style.flex_grow > 0) || v.flex_wrap === "wrap" ? NaN : U.reduce((k, Y) => k + Y, 0) + W(v.gap_x) * (N.length - 1) : E = Math.max(...U) : E = 0, O = E + W(v.pl) + W(v.pr) + W(v.border_l) + W(v.border_r), typeof v.min_w == "number" && (O = Math.max(O, v.min_w)), typeof v.max_w == "number" && (O = Math.min(O, v.max_w));
    }
    return d.set(S, O), O;
  }
  const y = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, R = () => ({ exact: 0, laid: 0 }), H = (S, x) => {
    if (!Number.isFinite(x))
      return Object.assign(S, R()), NaN;
    S.exact += x;
    const z = Math.round(S.exact * i + 1e-9) / i, D = z - S.laid;
    return S.laid = z, D;
  }, g = (S) => oa(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function C(S) {
    if (!S || S.kind === "text" || !sa(S)) return;
    const x = (S.children ?? []).filter(Ve);
    if (g(S) && x.length > 1) {
      const z = W(S.style.gap_x), D = R(), v = !(z && x.some((N) => N.kind === "text"));
      u(S, { border_l: H(D, W(S.style.border_l)), pl: H(D, W(S.style.pl)) }), v && z && u(S, { gap_x: 0 }), x.forEach((N, j) => {
        const O = (j && v ? z : 0) + (N.kind === "text" ? 0 : W(N.style.ml));
        if (N.kind === "text")
          O && Object.assign(D, R());
        else {
          const Y = H(D, O);
          Number.isFinite(Y) && u(N, { ml: Y });
        }
        const U = N.kind === "text" ? p.get(S) ?? {} : null, E = N.kind === "text" ? w(N, U, !!S.tabular) : d.get(N);
        if ((N.kind === "text" || !(N.style.flex_grow > 0)) && Number.isFinite(E) ? u(N, { w: H(D, E) }) : Object.assign(D, R()), N.kind !== "text") {
          const Y = H(D, W(N.style.mr));
          Number.isFinite(Y) && u(N, { mr: Y });
        }
      });
    }
    for (const z of S.children ?? []) z.kind !== "text" && C(z);
  }
  for (const S of n)
    S && (w(S, {}, !1), C(S));
}
function Jg(n, i) {
  const c = (s, u) => {
    if (!s || s.kind === "text" || !sa(s)) return;
    const d = s.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : u && typeof d.w != "number";
    if (p && oa(s))
      for (const m of s.children ?? []) {
        const w = m.kind === "text" ? void 0 : m.style.flex_basis;
        m.kind !== "text" && m.style.flex_grow > 0 && (w === 0 || typeof w == "string" && w.endsWith("%")) && i.set(m, { ...i.get(m), flex_basis: "auto" });
      }
    for (const m of s.children ?? []) c(m, p);
  };
  for (const s of n) c(s, !1);
}
function Lg(n, i) {
  const c = i.heights ?? /* @__PURE__ */ new Map(), s = (m) => c.get(m), u = (m) => {
    const w = m.style, y = (m.children ?? []).filter(Ve);
    if (!y.length || oa(m)) return NaN;
    let R = 0;
    for (const H of y) {
      const g = s(H);
      if (!Number.isFinite(g)) return NaN;
      R += g + (H.kind === "text" ? 0 : W(H.style.mt) + W(H.style.mb));
    }
    return R + (w.display === "flex" ? W(w.gap_y) * (y.length - 1) : 0) + W(w.pt) + W(w.pb);
  }, d = (m, w) => {
    const y = m.style;
    if (typeof y.h == "number") return y.h;
    if (typeof y.max_h == "number") return y.max_h;
    if (!w || !Mo(w) || oa(w)) return NaN;
    const R = w.style, H = typeof R.h == "number" ? R.h : typeof R.max_h == "number" ? R.max_h : NaN, g = (w.children ?? []).filter(Ve);
    let C = 0;
    for (const x of g) {
      if (x === m) continue;
      const z = s(x);
      if (!Number.isFinite(z)) return NaN;
      C += z + (x.kind === "text" ? 0 : W(x.style.mt) + W(x.style.mb));
    }
    const S = R.display === "flex" ? W(R.gap_y) * Math.max(0, g.length - 1) : 0;
    return H - W(R.pt) - W(R.pb) - W(R.border_t) - W(R.border_b) - C - S - W(y.mt) - W(y.mb);
  }, p = (m, w) => {
    if (!(!m || m.kind === "text" || !sa(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const y = u(m), R = d(m, w);
        Number.isFinite(y) && Number.isFinite(R) && y > R + 0.01 && i.set(m, { ...i.get(m), pr: W(m.style.pr) + m.scrollbar });
      }
      for (const y of m.children ?? []) p(y, m);
    }
  };
  for (const m of n) p(m, null);
}
const Wg = ["text_size", "line_height", "whitespace", "text_ellipsis"], W = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Mo = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, oa = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ve = (n) => n.kind === "text" || sa(n) && n.style.position !== "absolute";
function Fg(n, i) {
  const c = /* @__PURE__ */ new Map(), s = (x, z) => c.set(x, { ...c.get(x), ...Object.fromEntries(Object.entries(z).filter(([, D]) => Number.isFinite(D))) }), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(x, z) {
    if (x.kind === "text") return z.whitespace === "nowrap" || of.test(x.text) ? kl(z) ?? NaN : NaN;
    const D = { ...z };
    for (const U of Wg) x.style[U] !== void 0 && (D[U] = x.style[U]);
    d.set(x, D);
    const v = x.style, N = (x.children ?? []).filter(Ve), j = N.map((U) => p(U, D));
    let O;
    if (v.h !== void 0 && v.h !== "auto") O = W(v.h);
    else if (x.kind === "input")
      O = (x.input_type === "textarea" || x.input_type === "select" ? NaN : kl(D) ?? NaN) + W(v.pt) + W(v.pb) + W(v.border_t) + W(v.border_b), v.min_h !== void 0 && (O = Math.max(O, W(v.min_h)));
    else {
      const U = N.map((k, Y) => (k.kind === "text" ? 0 : W(k.style.mt) + W(k.style.mb)) + j[Y]);
      let E;
      if (oa(x)) E = v.flex_wrap === "wrap" ? NaN : v.items === "baseline" ? w(N, j, D) : Math.max(0, ...U);
      else if (Mo(x)) {
        const k = N.some(($) => $.kind !== "text" && ($.style.flex_grow > 0 || $.style.flex_basis !== void 0)), Y = v.display !== "flex" && N.some(($) => $.kind !== "text" && (W($.style.mt) || W($.style.mb)));
        E = k || Y ? NaN : U.reduce(($, wt) => $ + wt, 0) + (v.display === "flex" ? W(v.gap_y) * Math.max(0, N.length - 1) : 0);
      } else E = NaN;
      O = E + W(v.pt) + W(v.pb) + W(v.border_t) + W(v.border_b), v.min_h !== void 0 && (O = Math.max(O, W(v.min_h))), v.max_h !== void 0 && (O = Math.min(O, W(v.max_h)));
    }
    return u.set(x, O), O;
  }
  const m = (x) => (kl(x) - (wi + Rd) * x.text_size) / 2 + wi * x.text_size;
  function w(x, z, D) {
    let v = 0, N = 0;
    for (const [j, O] of x.entries()) {
      const U = O.kind === "text" ? D : d.get(O);
      if (!(O.kind === "text" || (O.children ?? []).filter(Ve).every(($) => $.kind === "text")) || !Number.isFinite(z[j]) || typeof U.text_size != "number") return NaN;
      const k = O.kind === "text" ? {} : O.style, Y = W(k.mt) + W(k.border_t) + W(k.pt) + m(U);
      v = Math.max(v, Y), N = Math.max(N, W(k.mt) + z[j] + W(k.mb) - Y);
    }
    return v + N;
  }
  const y = () => ({ exact: 0, laid: 0 }), R = (x, z) => {
    if (!Number.isFinite(z))
      return Object.assign(x, y()), NaN;
    x.exact += z;
    const D = Math.round(x.exact * i + 1e-9) / i, v = D - x.laid;
    return x.laid = D, v;
  };
  function H(x) {
    if (!(x.kind === "text" || !sa(x))) {
      for (const z of (x.children ?? []).filter((D) => D.kind !== "text" && sa(D) && D.style.position === "absolute")) H(z);
      if (Mo(x) && !oa(x)) {
        const z = y();
        s(x, { border_t: R(z, W(x.style.border_t)), pt: R(z, W(x.style.pt)) }), g(x, z);
      } else for (const z of (x.children ?? []).filter(Ve)) z.kind !== "text" && H(z);
    }
  }
  function g(x, z) {
    const D = (x.children ?? []).filter(Ve), v = x.style.display === "flex" ? W(x.style.gap_y) : 0;
    if (v && D.some((N) => N.kind === "text")) {
      for (const N of D) N.kind !== "text" && H(N);
      return !1;
    }
    return v && s(x, { gap_y: 0 }), D.forEach((N, j) => {
      if (N.kind === "text") {
        const O = u.get(N) ?? p(N, d.get(x) ?? {});
        Number.isFinite(O) ? s(N, { h: R(z, O) }) : Object.assign(z, y());
        return;
      }
      if (s(N, { mt: R(z, (j ? v : 0) + W(N.style.mt)) }), Number.isFinite(u.get(N))) S(N, z);
      else if (C(N)) {
        const O = N.style;
        s(N, { border_t: R(z, W(O.border_t)), pt: R(z, W(O.pt)) }), s(N, { pb: R(z, W(O.pb)), border_b: R(z, W(O.border_b)) });
      } else
        H(N), Object.assign(z, y());
      s(N, { mb: R(z, W(N.style.mb)) });
    }), !0;
  }
  function C(x) {
    const z = x.style, D = (x.children ?? []).filter(Ve), v = kl(d.get(x) ?? {});
    return x.kind === "div" && !oa(x) && D.length > 0 && D.every((N) => N.kind === "text") && Number.isInteger(v) && [z.h, z.min_h, z.max_h].every((N) => N === void 0 || N === "auto");
  }
  function S(x, z) {
    const D = x.style;
    for (const U of (x.children ?? []).filter((E) => E.kind !== "text" && sa(E) && E.style.position === "absolute")) H(U);
    const v = z.laid, N = z.exact;
    s(x, { border_t: R(z, W(D.border_t)), pt: R(z, W(D.pt)) });
    const j = D.h !== void 0 && D.h !== "auto", O = u.get(x) - W(D.pt) - W(D.pb) - W(D.border_t) - W(D.border_b);
    if (x.kind === "input")
      j || R(z, O);
    else if (oa(x) || j && (D.justify ?? "start") !== "start") {
      for (const U of (x.children ?? []).filter(Ve)) U.kind !== "text" && H(U);
      j || R(z, O);
    } else !g(x, z) && !j && R(z, O);
    if (j) {
      z.exact = N + u.get(x), z.laid = Math.round(z.exact * i + 1e-9) / i, s(x, { h: z.laid - v });
      return;
    }
    s(x, { pb: R(z, W(D.pb)), border_b: R(z, W(D.border_b)) }), s(x, { h: z.laid - v });
  }
  for (const x of n)
    p(x, {}), H(x);
  return Object.defineProperty(c, "heights", { value: u }), c;
}
const nv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }] };
export {
  nv as NAMED_ELEMENTS,
  Ig as React,
  xh as SCHEMA,
  av as STYLE_KEYS,
  lv as describeToGpui,
  $g as jsxRuntime,
  Pg as mount,
  tv as reactDom,
  ev as sdk
};
