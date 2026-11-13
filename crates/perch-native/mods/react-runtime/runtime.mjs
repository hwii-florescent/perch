function Ed(l, i) {
  for (var u = 0; u < i.length; u++) {
    const s = i[u];
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
const Dp = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Bp = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), qp = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Dp]);
function So(l) {
  return l.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, u, s) => u ? String.fromCodePoint(parseInt(u, 16)) : s);
}
function fi(l, i) {
  let u = i;
  for (; u < l.length; ) {
    const s = l[u];
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
  if (u === i) throw new Se(`expected a name at ${i} in ${JSON.stringify(l)}`);
  return [So(l.slice(i, u)), u];
}
function Yp(l, i) {
  let u = 1;
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
    if (c === "(") u++;
    else if (c === ")" && --u === 0) return s;
  }
  throw new Se(`unbalanced parenthesis in ${JSON.stringify(l)}`);
}
function Ho(l) {
  const i = [];
  let u = 0, s = 0;
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
    d === "(" || d === "[" ? u++ : d === ")" || d === "]" ? u-- : d === "," && u === 0 && (i.push(l.slice(s, c).trim()), s = c + 1);
  }
  return i.push(l.slice(s).trim()), i.filter(Boolean);
}
function Gp(l, i) {
  const u = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let s = !1;
  for (; i < l.length; ) {
    const c = l[i];
    if (c === "*") {
      u.tag = "*", i++, s = !0;
      continue;
    }
    if (c === ".") {
      const [d, p] = fi(l, i + 1);
      u.classes.push(d), i = p, s = !0;
      continue;
    }
    if (c === "#") {
      const [d, p] = fi(l, i + 1);
      u.id = d, i = p, s = !0;
      continue;
    }
    if (c === "[") {
      const d = l.indexOf("]", i);
      if (d < 0) throw new Se(`unclosed [ in ${JSON.stringify(l)}`);
      const p = l.slice(i + 1, d).trim(), m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!m) throw new Se(`cannot read the attribute selector [${p}]`);
      const y = m[3] ?? m[4] ?? m[5];
      u.attrs.push({ name: So(m[1]).toLowerCase(), op: m[2] ?? null, value: y === void 0 ? null : So(y) }), i = d + 1, s = !0;
      continue;
    }
    if (c === ":") {
      if (l[i + 1] === ":") throw new Se(`pseudo-elements are not supported (${JSON.stringify(l)})`);
      const [d, p] = fi(l, i + 1);
      i = p;
      const m = d.toLowerCase();
      if (l[i] === "(") {
        if (!Bp.has(m)) throw new Se(`:${m}() is not supported`);
        const y = Yp(l, i + 1), b = l.slice(i + 1, y).trim();
        if (i = y + 1, m === "nth-child") {
          if (!/^\d+$/.test(b)) throw new Se(`:nth-child(${b}) is not supported (only a number)`);
          u.pseudos.push({ name: m, n: Number(b) });
        } else
          u.pseudos.push({ name: m, list: Ho(b).map(Uo) });
      } else {
        if (!qp.has(m)) throw new Se(`:${m} is not supported`);
        u.pseudos.push({ name: m });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !s) {
      const [d, p] = fi(l, i);
      u.tag = d.toLowerCase(), i = p, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new Se(`empty compound selector at ${i} in ${JSON.stringify(l)}`);
  return [u, i];
}
function Uo(l) {
  const i = [];
  let u = 0, s = null;
  for (l = l.trim(); u < l.length; ) {
    const [c, d] = Gp(l, u);
    i.push({ compound: c, combinator: s }), u = d;
    let p = !1;
    for (; l[u] === " " || l[u] === `
` || l[u] === "	"; )
      u++, p = !0;
    if (u >= l.length) break;
    const m = l[u];
    if (m === ">")
      for (s = ">", u++; l[u] === " "; ) u++;
    else {
      if (m === "+" || m === "~") throw new Se(`the ${m} combinator is not supported`);
      if (p) s = " ";
      else throw new Se(`unexpected ${JSON.stringify(m)} in ${JSON.stringify(l)}`);
    }
  }
  if (!i.length) throw new Se("empty selector");
  return i;
}
const Gc = /* @__PURE__ */ new Map();
function Ti(l) {
  let i = Gc.get(l);
  return i || (i = Ho(l).map(Uo), Gc.set(l, i)), i;
}
function kd(l) {
  const i = [0, 0, 0], u = (s) => {
    i[0] += s[0], i[1] += s[1], i[2] += s[2];
  };
  for (const { compound: s } of l) {
    s.id && i[0]++, i[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && i[2]++;
    for (const c of s.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const d = c.list.map(kd).sort((p, m) => m[0] - p[0] || m[1] - p[1] || m[2] - p[2])[0];
          u(d);
        } else i[1]++;
  }
  return i;
}
function Qp(l, { name: i, op: u, value: s }) {
  const c = l.getAttribute(i);
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
function mi(l) {
  return l.parentElement ? l.parentElement.children : [l];
}
function Vp(l, i, u, s) {
  if (i.tag && i.tag !== "*" && l.tagName !== i.tag || i.id && l.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const c = l.classList ?? [];
    for (const d of i.classes) if (!c.includes(d)) return !1;
  }
  for (const c of i.attrs) if (!Qp(l, c)) return !1;
  for (const c of i.pseudos)
    switch (c.name) {
      case "first-child":
        if (mi(l)[0] !== l) return !1;
        break;
      case "only-child":
        if (mi(l).length !== 1) return !1;
        break;
      case "last-child": {
        const d = mi(l);
        if (d[d.length - 1] !== l) return !1;
        break;
      }
      case "nth-child":
        if (mi(l).indexOf(l) !== c.n - 1) return !1;
        break;
      case "root":
        if (!l.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((d) => jl(l, d, u, s))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((d) => jl(l, d, u, s))) return !1;
        break;
      default:
        if (!u.state || !u.state(l, c.name, s)) return !1;
    }
  return !0;
}
function jl(l, i, u, s = !0) {
  const c = (d, p, m) => {
    const { compound: y, combinator: b } = i[p];
    if (!Vp(d, y, u, m)) return !1;
    if (p === 0) return !0;
    if (b === ">") return !!d.parentElement && c(d.parentElement, p - 1, !1);
    for (let H = d.parentElement; H; H = H.parentElement) if (c(H, p - 1, !1)) return !0;
    return !1;
  };
  return c(l, i.length - 1, s);
}
function Kp(l, i, u = {}) {
  return (typeof i == "string" ? Ti(i) : i).some((c) => jl(l, c, u));
}
function Nd(l, i, u = {}) {
  return jl(l, i, u);
}
function xi(l, i, u = {}) {
  const s = Ti(i), c = [], d = (p) => {
    for (const m of p.children)
      s.some((y) => jl(m, y, u)) && c.push(m), d(m);
  };
  return d(l), c;
}
function Td(l, i, u = {}) {
  const s = Ti(i);
  for (let c = l; c; c = c.parentElement) if (s.some((d) => jl(c, d, u))) return c;
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
let Xp = 1;
class zo {
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
class Do {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, u, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners.some((d) => d.type === i && d.listener === u && d.capture === c) || this.listeners.push({ type: i, listener: u, capture: c });
  }
  removeEventListener(i, u, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === i && d.listener === u && d.capture === c));
  }
}
class Bo {
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
class ze extends Do {
  constructor(i, u = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${Xp++}`, this.tagName = i.toLowerCase(), this.props = u, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    for (const [u, s] of Object.entries(this.props))
      u.startsWith("data-") && s != null && s !== !1 && (i[u.slice(5).replace(/-([a-z])/g, (c, d) => d.toUpperCase())] = String(s));
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
      const d = i.replace(/-([a-z])/g, (p, m) => m.toUpperCase());
      c = u[d];
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
    return Kp(this, i);
  }
  closest(i) {
    return Td(this, i);
  }
  querySelectorAll(i) {
    return xi(this, i);
  }
  querySelector(i) {
    return xi(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return i ? new zo(i.x, i.y, i.width, i.height) : new zo();
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
  select() {
  }
  /** Asks the scroll area around this element to show it (`toGpui`, on the next frame: the engine scrolls by the
   * fewest pixels, as `{ inline: "nearest", block: "nearest" }`, whatever the options). */
  scrollIntoView() {
    this.ownerDocument && (this.ownerDocument.scrollTarget = this);
  }
}
class Zp {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Jp {
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
function Qc(l) {
  for (let i = l; i instanceof ze; i = i.parentElement) i.touch();
}
class Lp extends Do {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new ze("html", {}, this), this.body = new ze("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new ze(i, {}, this);
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, Qc(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, Qc(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return xi(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
}
class Wp extends Do {
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
function Cd(l) {
  return {
    setTimeout: (i, u = 0, ...s) => l.setTimeout(() => i(...s), Math.max(0, Number(u) || 0)),
    clearTimeout: (i) => {
      i != null && l.clearTimeout(i);
    }
  };
}
function fe(l, i, u) {
  Object.defineProperty(l, i, { value: u, configurable: !0, writable: !0, enumerable: !1 });
}
function Fp(l, i = globalThis) {
  const u = new Lp(l), s = new Wp(l, u);
  u.defaultView = s;
  const c = l.storage ?? new Jp();
  if (typeof i.setTimeout != "function") {
    if (typeof l.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const p = Cd(l);
    fe(i, "setTimeout", p.setTimeout), fe(i, "clearTimeout", p.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && fe(i, "queueMicrotask", (p) => {
    Promise.resolve().then(p);
  }), fe(i, "requestAnimationFrame", (p) => i.setTimeout(() => p(Date.now()), 0)), fe(i, "cancelAnimationFrame", (p) => i.clearTimeout(p)), fe(i, "document", u), fe(i, "window", s), fe(i, "localStorage", c), fe(i, "HTMLElement", ze), fe(i, "Element", ze), fe(i, "DOMRect", zo), typeof i.ResizeObserver != "function" && fe(i, "ResizeObserver", Zp);
  const d = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!d.clipboard && l.clipboard)
    try {
      fe(d, "clipboard", l.clipboard);
    } catch {
    }
  return i.navigator || fe(i, "navigator", d), { document: u, window: s };
}
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Vc = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Vc?.setTimeout == "function") {
  const l = Cd(Vc);
  globalThis.setTimeout = l.setTimeout, globalThis.clearTimeout = l.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (l) => {
  Promise.resolve().then(l);
});
function qo(l) {
  return l && l.__esModule && Object.prototype.hasOwnProperty.call(l, "default") ? l.default : l;
}
var ho = { exports: {} }, rt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Kc;
function Ip() {
  if (Kc) return rt;
  Kc = 1;
  var l = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), u = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), y = Symbol.for("react.suspense"), b = Symbol.for("react.memo"), H = Symbol.for("react.lazy"), M = Symbol.for("react.activity"), h = Symbol.iterator;
  function C(_) {
    return _ === null || typeof _ != "object" ? null : (_ = h && _[h] || _["@@iterator"], typeof _ == "function" ? _ : null);
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
  }, x = Object.assign, E = {};
  function U(_, Y, tt) {
    this.props = _, this.context = Y, this.refs = E, this.updater = tt || S;
  }
  U.prototype.isReactComponent = {}, U.prototype.setState = function(_, Y) {
    if (typeof _ != "object" && typeof _ != "function" && _ != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, _, Y, "setState");
  }, U.prototype.forceUpdate = function(_) {
    this.updater.enqueueForceUpdate(this, _, "forceUpdate");
  };
  function v() {
  }
  v.prototype = U.prototype;
  function N(_, Y, tt) {
    this.props = _, this.context = Y, this.refs = E, this.updater = tt || S;
  }
  var D = N.prototype = new v();
  D.constructor = N, x(D, U.prototype), D.isPureReactComponent = !0;
  var T = Array.isArray;
  function R() {
  }
  var z = { H: null, A: null, T: null, S: null }, w = Object.prototype.hasOwnProperty;
  function q(_, Y, tt) {
    var I = tt.ref;
    return {
      $$typeof: l,
      type: _,
      key: Y,
      ref: I !== void 0 ? I : null,
      props: tt
    };
  }
  function F(_, Y) {
    return q(_.type, Y, _.props);
  }
  function ot(_) {
    return typeof _ == "object" && _ !== null && _.$$typeof === l;
  }
  function Et(_) {
    var Y = { "=": "=0", ":": "=2" };
    return "$" + _.replace(/[=:]/g, function(tt) {
      return Y[tt];
    });
  }
  var Ht = /\/+/g;
  function Ft(_, Y) {
    return typeof _ == "object" && _ !== null && _.key != null ? Et("" + _.key) : Y.toString(36);
  }
  function Tt(_) {
    switch (_.status) {
      case "fulfilled":
        return _.value;
      case "rejected":
        throw _.reason;
      default:
        switch (typeof _.status == "string" ? _.then(R, R) : (_.status = "pending", _.then(
          function(Y) {
            _.status === "pending" && (_.status = "fulfilled", _.value = Y);
          },
          function(Y) {
            _.status === "pending" && (_.status = "rejected", _.reason = Y);
          }
        )), _.status) {
          case "fulfilled":
            return _.value;
          case "rejected":
            throw _.reason;
        }
    }
    throw _;
  }
  function G(_, Y, tt, I, $) {
    var et = typeof _;
    (et === "undefined" || et === "boolean") && (_ = null);
    var bt = !1;
    if (_ === null) bt = !0;
    else
      switch (et) {
        case "bigint":
        case "string":
        case "number":
          bt = !0;
          break;
        case "object":
          switch (_.$$typeof) {
            case l:
            case i:
              bt = !0;
              break;
            case H:
              return bt = _._init, G(
                bt(_._payload),
                Y,
                tt,
                I,
                $
              );
          }
      }
    if (bt)
      return $ = $(_), bt = I === "" ? "." + Ft(_, 0) : I, T($) ? (tt = "", bt != null && (tt = bt.replace(Ht, "$&/") + "/"), G($, Y, tt, "", function(Ma) {
        return Ma;
      })) : $ != null && (ot($) && ($ = F(
        $,
        tt + ($.key == null || _ && _.key === $.key ? "" : ("" + $.key).replace(
          Ht,
          "$&/"
        ) + "/") + bt
      )), Y.push($)), 1;
    bt = 0;
    var Zt = I === "" ? "." : I + ":";
    if (T(_))
      for (var ut = 0; ut < _.length; ut++)
        I = _[ut], et = Zt + Ft(I, ut), bt += G(
          I,
          Y,
          tt,
          et,
          $
        );
    else if (ut = C(_), typeof ut == "function")
      for (_ = ut.call(_), ut = 0; !(I = _.next()).done; )
        I = I.value, et = Zt + Ft(I, ut++), bt += G(
          I,
          Y,
          tt,
          et,
          $
        );
    else if (et === "object") {
      if (typeof _.then == "function")
        return G(
          Tt(_),
          Y,
          tt,
          I,
          $
        );
      throw Y = String(_), Error(
        "Objects are not valid as a React child (found: " + (Y === "[object Object]" ? "object with keys {" + Object.keys(_).join(", ") + "}" : Y) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return bt;
  }
  function P(_, Y, tt) {
    if (_ == null) return _;
    var I = [], $ = 0;
    return G(_, I, "", "", function(et) {
      return Y.call(tt, et, $++);
    }), I;
  }
  function nt(_) {
    if (_._status === -1) {
      var Y = _._result;
      Y = Y(), Y.then(
        function(tt) {
          (_._status === 0 || _._status === -1) && (_._status = 1, _._result = tt);
        },
        function(tt) {
          (_._status === 0 || _._status === -1) && (_._status = 2, _._result = tt);
        }
      ), _._status === -1 && (_._status = 0, _._result = Y);
    }
    if (_._status === 1) return _._result.default;
    throw _._result;
  }
  var st = typeof reportError == "function" ? reportError : function(_) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var Y = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof _ == "object" && _ !== null && typeof _.message == "string" ? String(_.message) : String(_),
        error: _
      });
      if (!window.dispatchEvent(Y)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", _);
      return;
    }
    console.error(_);
  }, K = {
    map: P,
    forEach: function(_, Y, tt) {
      P(
        _,
        function() {
          Y.apply(this, arguments);
        },
        tt
      );
    },
    count: function(_) {
      var Y = 0;
      return P(_, function() {
        Y++;
      }), Y;
    },
    toArray: function(_) {
      return P(_, function(Y) {
        return Y;
      }) || [];
    },
    only: function(_) {
      if (!ot(_))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return _;
    }
  };
  return rt.Activity = M, rt.Children = K, rt.Component = U, rt.Fragment = u, rt.Profiler = c, rt.PureComponent = N, rt.StrictMode = s, rt.Suspense = y, rt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = z, rt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(_) {
      return z.H.useMemoCache(_);
    }
  }, rt.cache = function(_) {
    return function() {
      return _.apply(null, arguments);
    };
  }, rt.cacheSignal = function() {
    return null;
  }, rt.cloneElement = function(_, Y, tt) {
    if (_ == null)
      throw Error(
        "The argument must be a React element, but you passed " + _ + "."
      );
    var I = x({}, _.props), $ = _.key;
    if (Y != null)
      for (et in Y.key !== void 0 && ($ = "" + Y.key), Y)
        !w.call(Y, et) || et === "key" || et === "__self" || et === "__source" || et === "ref" && Y.ref === void 0 || (I[et] = Y[et]);
    var et = arguments.length - 2;
    if (et === 1) I.children = tt;
    else if (1 < et) {
      for (var bt = Array(et), Zt = 0; Zt < et; Zt++)
        bt[Zt] = arguments[Zt + 2];
      I.children = bt;
    }
    return q(_.type, $, I);
  }, rt.createContext = function(_) {
    return _ = {
      $$typeof: p,
      _currentValue: _,
      _currentValue2: _,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, _.Provider = _, _.Consumer = {
      $$typeof: d,
      _context: _
    }, _;
  }, rt.createElement = function(_, Y, tt) {
    var I, $ = {}, et = null;
    if (Y != null)
      for (I in Y.key !== void 0 && (et = "" + Y.key), Y)
        w.call(Y, I) && I !== "key" && I !== "__self" && I !== "__source" && ($[I] = Y[I]);
    var bt = arguments.length - 2;
    if (bt === 1) $.children = tt;
    else if (1 < bt) {
      for (var Zt = Array(bt), ut = 0; ut < bt; ut++)
        Zt[ut] = arguments[ut + 2];
      $.children = Zt;
    }
    if (_ && _.defaultProps)
      for (I in bt = _.defaultProps, bt)
        $[I] === void 0 && ($[I] = bt[I]);
    return q(_, et, $);
  }, rt.createRef = function() {
    return { current: null };
  }, rt.forwardRef = function(_) {
    return { $$typeof: m, render: _ };
  }, rt.isValidElement = ot, rt.lazy = function(_) {
    return {
      $$typeof: H,
      _payload: { _status: -1, _result: _ },
      _init: nt
    };
  }, rt.memo = function(_, Y) {
    return {
      $$typeof: b,
      type: _,
      compare: Y === void 0 ? null : Y
    };
  }, rt.startTransition = function(_) {
    var Y = z.T, tt = {};
    z.T = tt;
    try {
      var I = _(), $ = z.S;
      $ !== null && $(tt, I), typeof I == "object" && I !== null && typeof I.then == "function" && I.then(R, st);
    } catch (et) {
      st(et);
    } finally {
      Y !== null && tt.types !== null && (Y.types = tt.types), z.T = Y;
    }
  }, rt.unstable_useCacheRefresh = function() {
    return z.H.useCacheRefresh();
  }, rt.use = function(_) {
    return z.H.use(_);
  }, rt.useActionState = function(_, Y, tt) {
    return z.H.useActionState(_, Y, tt);
  }, rt.useCallback = function(_, Y) {
    return z.H.useCallback(_, Y);
  }, rt.useContext = function(_) {
    return z.H.useContext(_);
  }, rt.useDebugValue = function() {
  }, rt.useDeferredValue = function(_, Y) {
    return z.H.useDeferredValue(_, Y);
  }, rt.useEffect = function(_, Y) {
    return z.H.useEffect(_, Y);
  }, rt.useEffectEvent = function(_) {
    return z.H.useEffectEvent(_);
  }, rt.useId = function() {
    return z.H.useId();
  }, rt.useImperativeHandle = function(_, Y, tt) {
    return z.H.useImperativeHandle(_, Y, tt);
  }, rt.useInsertionEffect = function(_, Y) {
    return z.H.useInsertionEffect(_, Y);
  }, rt.useLayoutEffect = function(_, Y) {
    return z.H.useLayoutEffect(_, Y);
  }, rt.useMemo = function(_, Y) {
    return z.H.useMemo(_, Y);
  }, rt.useOptimistic = function(_, Y) {
    return z.H.useOptimistic(_, Y);
  }, rt.useReducer = function(_, Y, tt) {
    return z.H.useReducer(_, Y, tt);
  }, rt.useRef = function(_) {
    return z.H.useRef(_);
  }, rt.useState = function(_) {
    return z.H.useState(_);
  }, rt.useSyncExternalStore = function(_, Y, tt) {
    return z.H.useSyncExternalStore(
      _,
      Y,
      tt
    );
  }, rt.useTransition = function() {
    return z.H.useTransition();
  }, rt.version = "19.2.8", rt;
}
var Xc;
function jd() {
  return Xc || (Xc = 1, ho.exports = Ip()), ho.exports;
}
var St = jd();
const $p = /* @__PURE__ */ qo(St), Yv = /* @__PURE__ */ Ed({
  __proto__: null,
  default: $p
}, [St]);
var go = { exports: {} }, un = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Zc;
function Pp() {
  if (Zc) return un;
  Zc = 1;
  var l = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function u(s, c, d) {
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
  return un.Fragment = i, un.jsx = u, un.jsxs = u, un;
}
var Jc;
function th() {
  return Jc || (Jc = 1, go.exports = Pp()), go.exports;
}
var Qt = th();
const eh = /* @__PURE__ */ qo(Qt), Gv = /* @__PURE__ */ Ed({
  __proto__: null,
  default: eh
}, [Qt]);
var vo = { exports: {} }, bo = { exports: {} }, yo = { exports: {} }, xo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Lc;
function ah() {
  return Lc || (Lc = 1, (function(l) {
    function i(G, P) {
      var nt = G.length;
      G.push(P);
      t: for (; 0 < nt; ) {
        var st = nt - 1 >>> 1, K = G[st];
        if (0 < c(K, P))
          G[st] = P, G[nt] = K, nt = st;
        else break t;
      }
    }
    function u(G) {
      return G.length === 0 ? null : G[0];
    }
    function s(G) {
      if (G.length === 0) return null;
      var P = G[0], nt = G.pop();
      if (nt !== P) {
        G[0] = nt;
        t: for (var st = 0, K = G.length, _ = K >>> 1; st < _; ) {
          var Y = 2 * (st + 1) - 1, tt = G[Y], I = Y + 1, $ = G[I];
          if (0 > c(tt, nt))
            I < K && 0 > c($, tt) ? (G[st] = $, G[I] = nt, st = I) : (G[st] = tt, G[Y] = nt, st = Y);
          else if (I < K && 0 > c($, nt))
            G[st] = $, G[I] = nt, st = I;
          else break t;
        }
      }
      return P;
    }
    function c(G, P) {
      var nt = G.sortIndex - P.sortIndex;
      return nt !== 0 ? nt : G.id - P.id;
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
    var y = [], b = [], H = 1, M = null, h = 3, C = !1, S = !1, x = !1, E = !1, U = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, N = typeof setImmediate < "u" ? setImmediate : null;
    function D(G) {
      for (var P = u(b); P !== null; ) {
        if (P.callback === null) s(b);
        else if (P.startTime <= G)
          s(b), P.sortIndex = P.expirationTime, i(y, P);
        else break;
        P = u(b);
      }
    }
    function T(G) {
      if (x = !1, D(G), !S)
        if (u(y) !== null)
          S = !0, R || (R = !0, Et());
        else {
          var P = u(b);
          P !== null && Tt(T, P.startTime - G);
        }
    }
    var R = !1, z = -1, w = 5, q = -1;
    function F() {
      return E ? !0 : !(l.unstable_now() - q < w);
    }
    function ot() {
      if (E = !1, R) {
        var G = l.unstable_now();
        q = G;
        var P = !0;
        try {
          t: {
            S = !1, x && (x = !1, v(z), z = -1), C = !0;
            var nt = h;
            try {
              e: {
                for (D(G), M = u(y); M !== null && !(M.expirationTime > G && F()); ) {
                  var st = M.callback;
                  if (typeof st == "function") {
                    M.callback = null, h = M.priorityLevel;
                    var K = st(
                      M.expirationTime <= G
                    );
                    if (G = l.unstable_now(), typeof K == "function") {
                      M.callback = K, D(G), P = !0;
                      break e;
                    }
                    M === u(y) && s(y), D(G);
                  } else s(y);
                  M = u(y);
                }
                if (M !== null) P = !0;
                else {
                  var _ = u(b);
                  _ !== null && Tt(
                    T,
                    _.startTime - G
                  ), P = !1;
                }
              }
              break t;
            } finally {
              M = null, h = nt, C = !1;
            }
            P = void 0;
          }
        } finally {
          P ? Et() : R = !1;
        }
      }
    }
    var Et;
    if (typeof N == "function")
      Et = function() {
        N(ot);
      };
    else if (typeof MessageChannel < "u") {
      var Ht = new MessageChannel(), Ft = Ht.port2;
      Ht.port1.onmessage = ot, Et = function() {
        Ft.postMessage(null);
      };
    } else
      Et = function() {
        U(ot, 0);
      };
    function Tt(G, P) {
      z = U(function() {
        G(l.unstable_now());
      }, P);
    }
    l.unstable_IdlePriority = 5, l.unstable_ImmediatePriority = 1, l.unstable_LowPriority = 4, l.unstable_NormalPriority = 3, l.unstable_Profiling = null, l.unstable_UserBlockingPriority = 2, l.unstable_cancelCallback = function(G) {
      G.callback = null;
    }, l.unstable_forceFrameRate = function(G) {
      0 > G || 125 < G ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : w = 0 < G ? Math.floor(1e3 / G) : 5;
    }, l.unstable_getCurrentPriorityLevel = function() {
      return h;
    }, l.unstable_next = function(G) {
      switch (h) {
        case 1:
        case 2:
        case 3:
          var P = 3;
          break;
        default:
          P = h;
      }
      var nt = h;
      h = P;
      try {
        return G();
      } finally {
        h = nt;
      }
    }, l.unstable_requestPaint = function() {
      E = !0;
    }, l.unstable_runWithPriority = function(G, P) {
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
      var nt = h;
      h = G;
      try {
        return P();
      } finally {
        h = nt;
      }
    }, l.unstable_scheduleCallback = function(G, P, nt) {
      var st = l.unstable_now();
      switch (typeof nt == "object" && nt !== null ? (nt = nt.delay, nt = typeof nt == "number" && 0 < nt ? st + nt : st) : nt = st, G) {
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
        id: H++,
        callback: P,
        priorityLevel: G,
        startTime: nt,
        expirationTime: K,
        sortIndex: -1
      }, nt > st ? (G.sortIndex = nt, i(b, G), u(y) === null && G === u(b) && (x ? (v(z), z = -1) : x = !0, Tt(T, nt - st))) : (G.sortIndex = K, i(y, G), S || C || (S = !0, R || (R = !0, Et()))), G;
    }, l.unstable_shouldYield = F, l.unstable_wrapCallback = function(G) {
      var P = h;
      return function() {
        var nt = h;
        h = P;
        try {
          return G.apply(this, arguments);
        } finally {
          h = nt;
        }
      };
    };
  })(xo)), xo;
}
var Wc;
function lh() {
  return Wc || (Wc = 1, yo.exports = ah()), yo.exports;
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
var Fc;
function nh() {
  return Fc || (Fc = 1, (function(l) {
    l.exports = function(i) {
      function u(t, e, a, n) {
        return new Qf(t, e, a, n);
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
          var o = r.alternate;
          if (o === null) {
            if (n = r.return, n !== null) {
              a = n;
              continue;
            }
            break;
          }
          if (r.child === o.child) {
            for (o = r.child; o; ) {
              if (o === a) return p(r), t;
              if (o === n) return p(r), e;
              o = o.sibling;
            }
            throw Error(c(188));
          }
          if (a.return !== n.return) a = r, n = o;
          else {
            for (var f = !1, g = r.child; g; ) {
              if (g === a) {
                f = !0, a = r, n = o;
                break;
              }
              if (g === n) {
                f = !0, n = r, a = o;
                break;
              }
              g = g.sibling;
            }
            if (!f) {
              for (g = o.child; g; ) {
                if (g === a) {
                  f = !0, a = o, n = r;
                  break;
                }
                if (g === n) {
                  f = !0, n = o, a = r;
                  break;
                }
                g = g.sibling;
              }
              if (!f) throw Error(c(189));
            }
          }
          if (a.alternate !== n) throw Error(c(190));
        }
        if (a.tag !== 3) throw Error(c(188));
        return a.stateNode.current === a ? t : e;
      }
      function y(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = y(t), e !== null) return e;
          t = t.sibling;
        }
        return null;
      }
      function b(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = b(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function H(t) {
        return t === null || typeof t != "object" ? null : (t = rc && t[rc] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function M(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Jf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case sl:
            return "Fragment";
          case Rr:
            return "Profiler";
          case nc:
            return "StrictMode";
          case Ur:
            return "Suspense";
          case Dr:
            return "SuspenseList";
          case qr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ol:
              return "Portal";
            case ba:
              return t.displayName || "Context";
            case ic:
              return (t._context.displayName || "Context") + ".Consumer";
            case Hr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Br:
              return e = t.displayName || null, e !== null ? e : M(t.type) || "Memo";
            case ya:
              e = t._payload, t = t._init;
              try {
                return M(t(e));
              } catch {
              }
          }
        return null;
      }
      function h(t) {
        return { current: t };
      }
      function C(t) {
        0 > dl || (t.current = Xr[dl], Xr[dl] = null, dl--);
      }
      function S(t, e) {
        dl++, Xr[dl] = t.current, t.current = e;
      }
      function x(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (wp(t) / _p | 0) | 0;
      }
      function E(t) {
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
      function U(t, e, a) {
        var n = t.pendingLanes;
        if (n === 0) return 0;
        var r = 0, o = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var g = n & 134217727;
        return g !== 0 ? (n = g & ~o, n !== 0 ? r = E(n) : (f &= g, f !== 0 ? r = E(f) : a || (a = g & ~t, a !== 0 && (r = E(a))))) : (g = n & ~o, g !== 0 ? r = E(g) : f !== 0 ? r = E(f) : a || (a = n & ~t, a !== 0 && (r = E(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & o) === 0 && (o = r & -r, a = e & -e, o >= a || o === 32 && (a & 4194048) !== 0) ? e : r;
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
      function D() {
        var t = Jn;
        return Jn <<= 1, (Jn & 62914560) === 0 && (Jn = 4194304), t;
      }
      function T(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function R(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function z(t, e, a, n, r, o) {
        var f = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var g = t.entanglements, O = t.expirationTimes, B = t.hiddenUpdates;
        for (a = f & ~a; 0 < a; ) {
          var X = 31 - ge(a), Q = 1 << X;
          g[X] = 0, O[X] = -1;
          var Z = B[X];
          if (Z !== null)
            for (B[X] = null, X = 0; X < Z.length; X++) {
              var ct = Z[X];
              ct !== null && (ct.lane &= -536870913);
            }
          a &= ~Q;
        }
        n !== 0 && w(t, n, 0), o !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= o & ~(f & ~e));
      }
      function w(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var n = 31 - ge(e);
        t.entangledLanes |= e, t.entanglements[n] = t.entanglements[n] | 1073741824 | a & 261930;
      }
      function q(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var n = 31 - ge(a), r = 1 << n;
          r & e | t[n] & e && (t[n] |= e), a &= ~r;
        }
      }
      function F(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : ot(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function ot(t) {
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
      function Ht(t) {
        if (typeof Np == "function" && Tp(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode(Fl, t);
          } catch {
          }
      }
      function Ft(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Tt(t) {
        if (Lr === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Lr = e && e[1] || "", Ac = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Lr + t + Ac;
      }
      function G(t, e) {
        if (!t || Wr) return "";
        Wr = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var n = {
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
                    } catch (ct) {
                      var Z = ct;
                    }
                    Reflect.construct(t, [], Q);
                  } else {
                    try {
                      Q.call();
                    } catch (ct) {
                      Z = ct;
                    }
                    t.call(Q.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ct) {
                    Z = ct;
                  }
                  (Q = t()) && typeof Q.catch == "function" && Q.catch(function() {
                  });
                }
              } catch (ct) {
                if (ct && Z && typeof ct.stack == "string")
                  return [ct.stack, Z.stack];
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
          var o = n.DetermineComponentFrameRoot(), f = o[0], g = o[1];
          if (f && g) {
            var O = f.split(`
`), B = g.split(`
`);
            for (r = n = 0; n < O.length && !O[n].includes("DetermineComponentFrameRoot"); )
              n++;
            for (; r < B.length && !B[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (n === O.length || r === B.length)
              for (n = O.length - 1, r = B.length - 1; 1 <= n && 0 <= r && O[n] !== B[r]; )
                r--;
            for (; 1 <= n && 0 <= r; n--, r--)
              if (O[n] !== B[r]) {
                if (n !== 1 || r !== 1)
                  do
                    if (n--, r--, 0 > r || O[n] !== B[r]) {
                      var X = `
` + O[n].replace(" at new ", " at ");
                      return t.displayName && X.includes("<anonymous>") && (X = X.replace("<anonymous>", t.displayName)), X;
                    }
                  while (1 <= n && 0 <= r);
                break;
              }
          }
        } finally {
          Wr = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? Tt(a) : "";
      }
      function P(t, e) {
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
            return G(t.type, !1);
          case 11:
            return G(t.type.render, !1);
          case 1:
            return G(t.type, !0);
          case 31:
            return Tt("Activity");
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
        } catch (n) {
          return `
Error generating stack: ` + n.message + `
` + n.stack;
        }
      }
      function st(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Oc.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: nt(e)
          }, Oc.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: nt(e)
        };
      }
      function K(t, e) {
        ml[pl++] = Il, ml[pl++] = Wn, Wn = t, Il = e;
      }
      function _(t, e, a) {
        Ee[ke++] = Ve, Ee[ke++] = Ke, Ee[ke++] = xa, xa = t;
        var n = Ve;
        t = Ke;
        var r = 32 - ge(n) - 1;
        n &= ~(1 << r), a += 1;
        var o = 32 - ge(e) + r;
        if (30 < o) {
          var f = r - r % 5;
          o = (n & (1 << f) - 1).toString(32), n >>= f, r -= f, Ve = 1 << 32 - ge(e) + r | a << r | n, Ke = o + t;
        } else
          Ve = 1 << o | a << r | n, Ke = t;
      }
      function Y(t) {
        t.return !== null && (K(t, 1), _(t, 1, 0));
      }
      function tt(t) {
        for (; t === Wn; )
          Wn = ml[--pl], ml[pl] = null, Il = ml[--pl], ml[pl] = null;
        for (; t === xa; )
          xa = Ee[--ke], Ee[ke] = null, Ke = Ee[--ke], Ee[ke] = null, Ve = Ee[--ke], Ee[ke] = null;
      }
      function I(t, e) {
        Ee[ke++] = Ve, Ee[ke++] = Ke, Ee[ke++] = xa, Ve = e.id, Ke = e.overflow, xa = t;
      }
      function $(t, e) {
        S(wa, e), S($l, t), S(Pt, null), t = Ff(e), C(Pt), S(Pt, t);
      }
      function et() {
        C(Pt), C($l), C(wa);
      }
      function bt(t) {
        t.memoizedState !== null && S(Fn, t);
        var e = Pt.current, a = If(e, t.type);
        e !== a && (S($l, t), S(Pt, a));
      }
      function Zt(t) {
        $l.current === t && (C(Pt), C($l)), Fn.current === t && (C(Fn), ta ? Ga._currentValue = ul : Ga._currentValue2 = ul);
      }
      function ut(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Al(st(e, t)), Fr;
      }
      function Ma(t, e) {
        if (!ne) throw Error(c(175));
        Im(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ut(t, !0);
      }
      function Aa(t) {
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
        if (!ne || t !== te) return !1;
        if (!vt) return Aa(t), vt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || yc(t.type) && !Kn(t.type, t.memoizedProps)) && Ct && ut(t) : e !== 3 && (e !== 5 || yc(t.type) && !Kn(t.type, t.memoizedProps)) && Ct && ut(t), Aa(t), e === 13) {
          if (!ne) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Ct = ap(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Ct = ep(t);
        } else
          Ct = Vt && e === 27 ? Gm(
            t.type,
            Ct
          ) : te ? bc(t.stateNode) : null;
        return !0;
      }
      function Oe() {
        ne && (Ct = te = null, vt = !1);
      }
      function ca() {
        var t = _a;
        return t !== null && (de === null ? de = t : de.push.apply(
          de,
          t
        ), _a = null), t;
      }
      function Al(t) {
        _a === null ? _a = [t] : _a.push(t);
      }
      function da(t, e, a) {
        ta ? (S(In, e._currentValue), e._currentValue = a) : (S(In, e._currentValue2), e._currentValue2 = a);
      }
      function Le(t) {
        var e = In.current;
        ta ? t._currentValue = e : t._currentValue2 = e, C(In);
      }
      function Mi(t, e, a) {
        for (; t !== null; ) {
          var n = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, n !== null && (n.childLanes |= e)) : n !== null && (n.childLanes & e) !== e && (n.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Ai(t, e, a, n) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var o = r.dependencies;
          if (o !== null) {
            var f = r.child;
            o = o.firstContext;
            t: for (; o !== null; ) {
              var g = o;
              o = r;
              for (var O = 0; O < e.length; O++)
                if (g.context === e[O]) {
                  o.lanes |= a, g = o.alternate, g !== null && (g.lanes |= a), Mi(
                    o.return,
                    a,
                    t
                  ), n || (f = null);
                  break t;
                }
              o = g.next;
            }
          } else if (r.tag === 18) {
            if (f = r.return, f === null) throw Error(c(341));
            f.lanes |= a, o = f.alternate, o !== null && (o.lanes |= a), Mi(f, a, t), f = null;
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
      function el(t, e, a, n) {
        t = null;
        for (var r = e, o = !1; r !== null; ) {
          if (!o) {
            if ((r.flags & 524288) !== 0) o = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var f = r.alternate;
            if (f === null) throw Error(c(387));
            if (f = f.memoizedProps, f !== null) {
              var g = r.type;
              be(r.pendingProps.value, f.value) || (t !== null ? t.push(g) : t = [g]);
            }
          } else if (r === Fn.current) {
            if (f = r.alternate, f === null) throw Error(c(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ga) : t = [Ga]);
          }
          r = r.return;
        }
        t !== null && Ai(
          e,
          t,
          a,
          n
        ), e.flags |= 262144;
      }
      function mn(t) {
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
      function Oa(t) {
        Qa = t, aa = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function It(t) {
        return Zo(Qa, t);
      }
      function pn(t, e) {
        return Qa === null && Oa(t), Zo(t, e);
      }
      function Zo(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(c(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function Oi() {
        return {
          controller: new jp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ol(t) {
        t.refCount--, t.refCount === 0 && Mp(Ap, function() {
          t.controller.abort();
        });
      }
      function hn() {
      }
      function Ye(t) {
        t !== hl && t.next === null && (hl === null ? $n = hl = t : hl = hl.next = t), Pn = !0, Ir || (Ir = !0, bf());
      }
      function al(t, e) {
        if (!$r && Pn) {
          $r = !0;
          do
            for (var a = !1, n = $n; n !== null; ) {
              if (t !== 0) {
                var r = n.pendingLanes;
                if (r === 0) var o = 0;
                else {
                  var f = n.suspendedLanes, g = n.pingedLanes;
                  o = (1 << 31 - ge(42 | t) + 1) - 1, o &= r & ~(f & ~g), o = o & 201326741 ? o & 201326741 | 1 : o ? o | 2 : 0;
                }
                o !== 0 && (a = !0, Io(n, o));
              } else
                o = gt, o = U(
                  n,
                  n === kt ? o : 0,
                  n.cancelPendingCommit !== null || n.timeoutHandle !== Ya
                ), (o & 3) === 0 || v(n, o) || (a = !0, Io(n, o));
              n = n.next;
            }
          while (a);
          $r = !1;
        }
      }
      function Jo() {
        Lo();
      }
      function Lo() {
        Pn = Ir = !1;
        var t = 0;
        Va !== 0 && rm() && (t = Va);
        for (var e = ue(), a = null, n = $n; n !== null; ) {
          var r = n.next, o = Wo(n, e);
          o === 0 ? (n.next = null, a === null ? $n = r : a.next = r, r === null && (hl = a)) : (a = n, (t !== 0 || (o & 3) !== 0) && (Pn = !0)), n = r;
        }
        Kt !== 0 && Kt !== 5 || al(t), Va !== 0 && (Va = 0);
      }
      function Wo(t, e) {
        for (var a = t.suspendedLanes, n = t.pingedLanes, r = t.expirationTimes, o = t.pendingLanes & -62914561; 0 < o; ) {
          var f = 31 - ge(o), g = 1 << f, O = r[f];
          O === -1 ? ((g & a) === 0 || (g & n) !== 0) && (r[f] = N(g, e)) : O <= e && (t.expiredLanes |= g), o &= ~g;
        }
        if (e = kt, a = gt, a = U(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Ya
        ), n = t.callbackNode, a === 0 || t === e && (_t === 2 || _t === 9) || t.cancelPendingCommit !== null)
          return n !== null && n !== null && Zr(n), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || v(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (n !== null && Zr(n), Et(a)) {
            case 2:
            case 8:
              a = Ep;
              break;
            case 32:
              a = Jr;
              break;
            case 268435456:
              a = kp;
              break;
            default:
              a = Jr;
          }
          return n = Fo.bind(null, t), a = Ln(a, n), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return n !== null && n !== null && Zr(n), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Fo(t, e) {
        if (Kt !== 0 && Kt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Zl() && t.callbackNode !== a)
          return null;
        var n = gt;
        return n = U(
          t,
          t === kt ? n : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Ya
        ), n === 0 ? null : (Ou(t, n, e), Wo(t, ue()), t.callbackNode != null && t.callbackNode === a ? Fo.bind(null, t) : null);
      }
      function Io(t, e) {
        if (Zl()) return null;
        Ou(t, e, !0);
      }
      function bf() {
        mm ? pm(function() {
          (pt & 6) !== 0 ? Ln(
            jc,
            Jo
          ) : Lo();
        }) : Ln(
          jc,
          Jo
        );
      }
      function Ri() {
        if (Va === 0) {
          var t = gl;
          t === 0 && (t = Xn, Xn <<= 1, (Xn & 261888) === 0 && (Xn = 256)), Va = t;
        }
        return Va;
      }
      function yf(t, e) {
        if (Pl === null) {
          var a = Pl = [];
          Pr = 0, gl = Ri(), vl = {
            status: "pending",
            value: void 0,
            then: function(n) {
              a.push(n);
            }
          };
        }
        return Pr++, e.then($o, $o), e;
      }
      function $o() {
        if (--Pr === 0 && Pl !== null) {
          vl !== null && (vl.status = "fulfilled");
          var t = Pl;
          Pl = null, gl = 0, vl = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function xf(t, e) {
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
      function Hi() {
        var t = Ka.current;
        return t !== null ? t : kt.pooledCache;
      }
      function gn(t, e) {
        e === null ? S(Ka, Ka.current) : S(Ka, e.pool);
      }
      function Po() {
        var t = Hi();
        return t === null ? null : {
          parent: ta ? jt._currentValue : jt._currentValue2,
          pool: t
        };
      }
      function vn(t, e) {
        if (be(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), n = Object.keys(e);
        if (a.length !== n.length) return !1;
        for (n = 0; n < a.length; n++) {
          var r = a[n];
          if (!Cp.call(e, r) || !be(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function ts(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function es(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(hn, hn), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, ls(t), t;
          default:
            if (typeof e.status == "string") e.then(hn, hn);
            else {
              if (t = kt, t !== null && 100 < t.shellSuspendCounter)
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
                throw t = e.reason, ls(t), t;
            }
            throw Xa = e, bl;
        }
      }
      function Ra(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Xa = a, bl) : a;
        }
      }
      function as() {
        if (Xa === null) throw Error(c(459));
        var t = Xa;
        return Xa = null, t;
      }
      function ls(t) {
        if (t === bl || t === ti)
          throw Error(c(483));
      }
      function bn(t) {
        var e = tn;
        return tn += 1, yl === null && (yl = []), es(yl, t, e);
      }
      function Rl(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function yn(t, e) {
        throw e.$$typeof === Xf ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
          c(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function ns(t) {
        function e(j, k) {
          if (t) {
            var A = j.deletions;
            A === null ? (j.deletions = [k], j.flags |= 16) : A.push(k);
          }
        }
        function a(j, k) {
          if (!t) return null;
          for (; k !== null; )
            e(j, k), k = k.sibling;
          return null;
        }
        function n(j) {
          for (var k = /* @__PURE__ */ new Map(); j !== null; )
            j.key !== null ? k.set(j.key, j) : k.set(j.index, j), j = j.sibling;
          return k;
        }
        function r(j, k) {
          return j = Pe(j, k), j.index = 0, j.sibling = null, j;
        }
        function o(j, k, A) {
          return j.index = A, t ? (A = j.alternate, A !== null ? (A = A.index, A < k ? (j.flags |= 67108866, k) : A) : (j.flags |= 67108866, k)) : (j.flags |= 1048576, k);
        }
        function f(j) {
          return t && j.alternate === null && (j.flags |= 67108866), j;
        }
        function g(j, k, A, V) {
          return k === null || k.tag !== 6 ? (k = jr(A, j.mode, V), k.return = j, k) : (k = r(k, A), k.return = j, k);
        }
        function O(j, k, A, V) {
          var lt = A.type;
          return lt === sl ? X(
            j,
            k,
            A.props.children,
            V,
            A.key
          ) : k !== null && (k.elementType === lt || typeof lt == "object" && lt !== null && lt.$$typeof === ya && Ra(lt) === k.type) ? (k = r(k, A.props), Rl(k, A), k.return = j, k) : (k = Gn(
            A.type,
            A.key,
            A.props,
            null,
            j.mode,
            V
          ), Rl(k, A), k.return = j, k);
        }
        function B(j, k, A, V) {
          return k === null || k.tag !== 4 || k.stateNode.containerInfo !== A.containerInfo || k.stateNode.implementation !== A.implementation ? (k = Mr(A, j.mode, V), k.return = j, k) : (k = r(k, A.children || []), k.return = j, k);
        }
        function X(j, k, A, V, lt) {
          return k === null || k.tag !== 7 ? (k = qa(
            A,
            j.mode,
            V,
            lt
          ), k.return = j, k) : (k = r(k, A), k.return = j, k);
        }
        function Q(j, k, A) {
          if (typeof k == "string" && k !== "" || typeof k == "number" || typeof k == "bigint")
            return k = jr(
              "" + k,
              j.mode,
              A
            ), k.return = j, k;
          if (typeof k == "object" && k !== null) {
            switch (k.$$typeof) {
              case Qn:
                return A = Gn(
                  k.type,
                  k.key,
                  k.props,
                  null,
                  j.mode,
                  A
                ), Rl(A, k), A.return = j, A;
              case ol:
                return k = Mr(
                  k,
                  j.mode,
                  A
                ), k.return = j, k;
              case ya:
                return k = Ra(k), Q(j, k, A);
            }
            if (Vn(k) || H(k))
              return k = qa(
                k,
                j.mode,
                A,
                null
              ), k.return = j, k;
            if (typeof k.then == "function")
              return Q(j, bn(k), A);
            if (k.$$typeof === ba)
              return Q(
                j,
                pn(j, k),
                A
              );
            yn(j, k);
          }
          return null;
        }
        function Z(j, k, A, V) {
          var lt = k !== null ? k.key : null;
          if (typeof A == "string" && A !== "" || typeof A == "number" || typeof A == "bigint")
            return lt !== null ? null : g(j, k, "" + A, V);
          if (typeof A == "object" && A !== null) {
            switch (A.$$typeof) {
              case Qn:
                return A.key === lt ? O(j, k, A, V) : null;
              case ol:
                return A.key === lt ? B(j, k, A, V) : null;
              case ya:
                return A = Ra(A), Z(j, k, A, V);
            }
            if (Vn(A) || H(A))
              return lt !== null ? null : X(j, k, A, V, null);
            if (typeof A.then == "function")
              return Z(
                j,
                k,
                bn(A),
                V
              );
            if (A.$$typeof === ba)
              return Z(
                j,
                k,
                pn(j, A),
                V
              );
            yn(j, A);
          }
          return null;
        }
        function ct(j, k, A, V, lt) {
          if (typeof V == "string" && V !== "" || typeof V == "number" || typeof V == "bigint")
            return j = j.get(A) || null, g(k, j, "" + V, lt);
          if (typeof V == "object" && V !== null) {
            switch (V.$$typeof) {
              case Qn:
                return j = j.get(
                  V.key === null ? A : V.key
                ) || null, O(k, j, V, lt);
              case ol:
                return j = j.get(
                  V.key === null ? A : V.key
                ) || null, B(k, j, V, lt);
              case ya:
                return V = Ra(V), ct(
                  j,
                  k,
                  A,
                  V,
                  lt
                );
            }
            if (Vn(V) || H(V))
              return j = j.get(A) || null, X(k, j, V, lt, null);
            if (typeof V.then == "function")
              return ct(
                j,
                k,
                A,
                bn(V),
                lt
              );
            if (V.$$typeof === ba)
              return ct(
                j,
                k,
                A,
                pn(k, V),
                lt
              );
            yn(k, V);
          }
          return null;
        }
        function ee(j, k, A, V) {
          for (var lt = null, Mt = null, it = k, xt = k = 0, Wt = null; it !== null && xt < A.length; xt++) {
            it.index > xt ? (Wt = it, it = null) : Wt = it.sibling;
            var wt = Z(
              j,
              it,
              A[xt],
              V
            );
            if (wt === null) {
              it === null && (it = Wt);
              break;
            }
            t && it && wt.alternate === null && e(j, it), k = o(wt, k, xt), Mt === null ? lt = wt : Mt.sibling = wt, Mt = wt, it = Wt;
          }
          if (xt === A.length)
            return a(j, it), vt && K(j, xt), lt;
          if (it === null) {
            for (; xt < A.length; xt++)
              it = Q(j, A[xt], V), it !== null && (k = o(
                it,
                k,
                xt
              ), Mt === null ? lt = it : Mt.sibling = it, Mt = it);
            return vt && K(j, xt), lt;
          }
          for (it = n(it); xt < A.length; xt++)
            Wt = ct(
              it,
              j,
              xt,
              A[xt],
              V
            ), Wt !== null && (t && Wt.alternate !== null && it.delete(
              Wt.key === null ? xt : Wt.key
            ), k = o(
              Wt,
              k,
              xt
            ), Mt === null ? lt = Wt : Mt.sibling = Wt, Mt = Wt);
          return t && it.forEach(function(Ta) {
            return e(j, Ta);
          }), vt && K(j, xt), lt;
        }
        function sn(j, k, A, V) {
          if (A == null) throw Error(c(151));
          for (var lt = null, Mt = null, it = k, xt = k = 0, Wt = null, wt = A.next(); it !== null && !wt.done; xt++, wt = A.next()) {
            it.index > xt ? (Wt = it, it = null) : Wt = it.sibling;
            var Ta = Z(j, it, wt.value, V);
            if (Ta === null) {
              it === null && (it = Wt);
              break;
            }
            t && it && Ta.alternate === null && e(j, it), k = o(Ta, k, xt), Mt === null ? lt = Ta : Mt.sibling = Ta, Mt = Ta, it = Wt;
          }
          if (wt.done)
            return a(j, it), vt && K(j, xt), lt;
          if (it === null) {
            for (; !wt.done; xt++, wt = A.next())
              wt = Q(j, wt.value, V), wt !== null && (k = o(
                wt,
                k,
                xt
              ), Mt === null ? lt = wt : Mt.sibling = wt, Mt = wt);
            return vt && K(j, xt), lt;
          }
          for (it = n(it); !wt.done; xt++, wt = A.next())
            wt = ct(
              it,
              j,
              xt,
              wt.value,
              V
            ), wt !== null && (t && wt.alternate !== null && it.delete(wt.key === null ? xt : wt.key), k = o(wt, k, xt), Mt === null ? lt = wt : Mt.sibling = wt, Mt = wt);
          return t && it.forEach(function(Up) {
            return e(j, Up);
          }), vt && K(j, xt), lt;
        }
        function Wa(j, k, A, V) {
          if (typeof A == "object" && A !== null && A.type === sl && A.key === null && (A = A.props.children), typeof A == "object" && A !== null) {
            switch (A.$$typeof) {
              case Qn:
                t: {
                  for (var lt = A.key; k !== null; ) {
                    if (k.key === lt) {
                      if (lt = A.type, lt === sl) {
                        if (k.tag === 7) {
                          a(
                            j,
                            k.sibling
                          ), V = r(
                            k,
                            A.props.children
                          ), V.return = j, j = V;
                          break t;
                        }
                      } else if (k.elementType === lt || typeof lt == "object" && lt !== null && lt.$$typeof === ya && Ra(lt) === k.type) {
                        a(
                          j,
                          k.sibling
                        ), V = r(k, A.props), Rl(V, A), V.return = j, j = V;
                        break t;
                      }
                      a(j, k);
                      break;
                    } else e(j, k);
                    k = k.sibling;
                  }
                  A.type === sl ? (V = qa(
                    A.props.children,
                    j.mode,
                    V,
                    A.key
                  ), V.return = j, j = V) : (V = Gn(
                    A.type,
                    A.key,
                    A.props,
                    null,
                    j.mode,
                    V
                  ), Rl(V, A), V.return = j, j = V);
                }
                return f(j);
              case ol:
                t: {
                  for (lt = A.key; k !== null; ) {
                    if (k.key === lt)
                      if (k.tag === 4 && k.stateNode.containerInfo === A.containerInfo && k.stateNode.implementation === A.implementation) {
                        a(
                          j,
                          k.sibling
                        ), V = r(
                          k,
                          A.children || []
                        ), V.return = j, j = V;
                        break t;
                      } else {
                        a(j, k);
                        break;
                      }
                    else e(j, k);
                    k = k.sibling;
                  }
                  V = Mr(A, j.mode, V), V.return = j, j = V;
                }
                return f(j);
              case ya:
                return A = Ra(A), Wa(
                  j,
                  k,
                  A,
                  V
                );
            }
            if (Vn(A))
              return ee(
                j,
                k,
                A,
                V
              );
            if (H(A)) {
              if (lt = H(A), typeof lt != "function")
                throw Error(c(150));
              return A = lt.call(A), sn(
                j,
                k,
                A,
                V
              );
            }
            if (typeof A.then == "function")
              return Wa(
                j,
                k,
                bn(A),
                V
              );
            if (A.$$typeof === ba)
              return Wa(
                j,
                k,
                pn(j, A),
                V
              );
            yn(j, A);
          }
          return typeof A == "string" && A !== "" || typeof A == "number" || typeof A == "bigint" ? (A = "" + A, k !== null && k.tag === 6 ? (a(j, k.sibling), V = r(k, A), V.return = j, j = V) : (a(j, k), V = jr(A, j.mode, V), V.return = j, j = V), f(j)) : a(j, k);
        }
        return function(j, k, A, V) {
          try {
            tn = 0;
            var lt = Wa(
              j,
              k,
              A,
              V
            );
            return yl = null, lt;
          } catch (it) {
            if (it === bl || it === ti) throw it;
            var Mt = u(29, it, null, j.mode);
            return Mt.lanes = V, Mt.return = j, Mt;
          } finally {
          }
        };
      }
      function xn() {
        for (var t = xl, e = eo = xl = 0; e < t; ) {
          var a = Te[e];
          Te[e++] = null;
          var n = Te[e];
          Te[e++] = null;
          var r = Te[e];
          Te[e++] = null;
          var o = Te[e];
          if (Te[e++] = null, n !== null && r !== null) {
            var f = n.pending;
            f === null ? r.next = r : (r.next = f.next, f.next = r), n.pending = r;
          }
          o !== 0 && is(a, r, o);
        }
      }
      function wn(t, e, a, n) {
        Te[xl++] = t, Te[xl++] = e, Te[xl++] = a, Te[xl++] = n, eo |= n, t.lanes |= n, t = t.alternate, t !== null && (t.lanes |= n);
      }
      function Ui(t, e, a, n) {
        return wn(t, e, a, n), _n(t);
      }
      function Ha(t, e) {
        return wn(t, null, null, e), _n(t);
      }
      function is(t, e, a) {
        t.lanes |= a;
        var n = t.alternate;
        n !== null && (n.lanes |= a);
        for (var r = !1, o = t.return; o !== null; )
          o.childLanes |= a, n = o.alternate, n !== null && (n.childLanes |= a), o.tag === 22 && (t = o.stateNode, t === null || t._visibility & 1 || (r = !0)), t = o, o = o.return;
        return t.tag === 3 ? (o = t.stateNode, r && e !== null && (r = 31 - ge(a), t = o.hiddenUpdates, n = t[r], n === null ? t[r] = [e] : n.push(e), e.lane = a | 536870912), o) : null;
      }
      function _n(t) {
        if (50 < on)
          throw on = 0, po = null, Error(c(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Di(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Bi(t, e) {
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
        if (n = n.shared, (pt & 2) !== 0) {
          var r = n.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), n.pending = e, e = _n(t), is(t, null, a), e;
        }
        return wn(t, n, e, a), _n(t);
      }
      function Hl(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var n = e.lanes;
          n &= t.pendingLanes, a |= n, e.lanes = a, q(t, a);
        }
      }
      function qi(t, e) {
        var a = t.updateQueue, n = t.alternate;
        if (n !== null && (n = n.updateQueue, a === n)) {
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
            baseState: n.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: o,
            shared: n.shared,
            callbacks: n.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Ul() {
        if (ao) {
          var t = vl;
          if (t !== null) throw t;
        }
      }
      function Dl(t, e, a, n) {
        ao = !1;
        var r = t.updateQueue;
        Sa = !1;
        var o = r.firstBaseUpdate, f = r.lastBaseUpdate, g = r.shared.pending;
        if (g !== null) {
          r.shared.pending = null;
          var O = g, B = O.next;
          O.next = null, f === null ? o = B : f.next = B, f = O;
          var X = t.alternate;
          X !== null && (X = X.updateQueue, g = X.lastBaseUpdate, g !== f && (g === null ? X.firstBaseUpdate = B : g.next = B, X.lastBaseUpdate = O));
        }
        if (o !== null) {
          var Q = r.baseState;
          f = 0, X = B = O = null, g = o;
          do {
            var Z = g.lane & -536870913, ct = Z !== g.lane;
            if (ct ? (gt & Z) === Z : (n & Z) === Z) {
              Z !== 0 && Z === gl && (ao = !0), X !== null && (X = X.next = {
                lane: 0,
                tag: g.tag,
                payload: g.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, sn = g;
                Z = e;
                var Wa = a;
                switch (sn.tag) {
                  case 1:
                    if (ee = sn.payload, typeof ee == "function") {
                      Q = ee.call(
                        Wa,
                        Q,
                        Z
                      );
                      break t;
                    }
                    Q = ee;
                    break t;
                  case 3:
                    ee.flags = ee.flags & -65537 | 128;
                  case 0:
                    if (ee = sn.payload, Z = typeof ee == "function" ? ee.call(Wa, Q, Z) : ee, Z == null) break t;
                    Q = Or({}, Q, Z);
                    break t;
                  case 2:
                    Sa = !0;
                }
              }
              Z = g.callback, Z !== null && (t.flags |= 64, ct && (t.flags |= 8192), ct = r.callbacks, ct === null ? r.callbacks = [Z] : ct.push(Z));
            } else
              ct = {
                lane: Z,
                tag: g.tag,
                payload: g.payload,
                callback: g.callback,
                next: null
              }, X === null ? (B = X = ct, O = Q) : X = X.next = ct, f |= Z;
            if (g = g.next, g === null) {
              if (g = r.shared.pending, g === null)
                break;
              ct = g, g = ct.next, ct.next = null, r.lastBaseUpdate = ct, r.shared.pending = null;
            }
          } while (!0);
          X === null && (O = Q), r.baseState = O, r.firstBaseUpdate = B, r.lastBaseUpdate = X, o === null && (r.shared.lanes = 0), Ea |= f, t.lanes = f, t.memoizedState = Q;
        }
      }
      function rs(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function os(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            rs(a[t], e);
      }
      function ss(t, e) {
        t = ia, S(ai, t), S(wl, e), ia = t | e.baseLanes;
      }
      function Yi() {
        S(ai, ia), S(wl, wl.current);
      }
      function Gi() {
        ia = ai.current, C(wl), C(ai);
      }
      function pa(t) {
        var e = t.alternate;
        S(Dt, Dt.current & 1), S(ye, t), Ce === null && (e === null || wl.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Qi(t) {
        S(Dt, Dt.current), S(ye, t), Ce === null && (Ce = t);
      }
      function us(t) {
        t.tag === 22 ? (S(Dt, Dt.current), S(ye, t), Ce === null && (Ce = t)) : ha();
      }
      function ha() {
        S(Dt, Dt.current), S(ye, ye.current);
      }
      function me(t) {
        C(ye), Ce === t && (Ce = null), C(Dt);
      }
      function Sn(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Qr(a) || Vr(a)))
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
      function Ot() {
        throw Error(c(321));
      }
      function Vi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!be(t[a], e[a])) return !1;
        return !0;
      }
      function Ki(t, e, a, n, r, o) {
        return la = o, dt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, at.H = t === null || t.memoizedState === null ? Uc : lo, Ja = !1, o = a(n, r), Ja = !1, _l && (o = ds(
          e,
          a,
          n,
          r
        )), cs(t), o;
      }
      function cs(t) {
        at.H = an;
        var e = zt !== null && zt.next !== null;
        if (la = 0, Bt = zt = dt = null, li = !1, en = 0, Sl = null, e) throw Error(c(300));
        t === null || qt || (t = t.dependencies, t !== null && mn(t) && (qt = !0));
      }
      function ds(t, e, a, n) {
        dt = t;
        var r = 0;
        do {
          if (_l && (Sl = null), en = 0, _l = !1, 25 <= r) throw Error(c(301));
          if (r += 1, Bt = zt = null, t.updateQueue != null) {
            var o = t.updateQueue;
            o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
          }
          at.H = Dc, o = e(a, n);
        } while (_l);
        return o;
      }
      function wf() {
        var t = at.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Bl(e) : e, t = t.useState()[0], (zt !== null ? zt.memoizedState : null) !== t && (dt.flags |= 1024), e;
      }
      function Xi() {
        var t = ni !== 0;
        return ni = 0, t;
      }
      function Zi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Ji(t) {
        if (li) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          li = !1;
        }
        la = 0, Bt = zt = dt = null, _l = !1, en = ni = 0, Sl = null;
      }
      function re() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Bt === null ? dt.memoizedState = Bt = t : Bt = Bt.next = t, Bt;
      }
      function Ut() {
        if (zt === null) {
          var t = dt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = zt.next;
        var e = Bt === null ? dt.memoizedState : Bt.next;
        if (e !== null)
          Bt = e, zt = t;
        else {
          if (t === null)
            throw dt.alternate === null ? Error(c(467)) : Error(c(310));
          zt = t, t = {
            memoizedState: zt.memoizedState,
            baseState: zt.baseState,
            baseQueue: zt.baseQueue,
            queue: zt.queue,
            next: null
          }, Bt === null ? dt.memoizedState = Bt = t : Bt = Bt.next = t;
        }
        return Bt;
      }
      function zn() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Bl(t) {
        var e = en;
        return en += 1, Sl === null && (Sl = []), t = es(Sl, t, e), e = dt, (Bt === null ? e.memoizedState : Bt.next) === null && (e = e.alternate, at.H = e === null || e.memoizedState === null ? Uc : lo), t;
      }
      function En(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Bl(t);
          if (t.$$typeof === ba) return It(t);
        }
        throw Error(c(438, String(t)));
      }
      function Li(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = zn(), dt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), n = 0; n < t; n++)
            a[n] = Zf;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function kn(t) {
        var e = Ut();
        return Wi(e, zt, t);
      }
      function Wi(t, e, a) {
        var n = t.queue;
        if (n === null) throw Error(c(311));
        n.lastRenderedReducer = a;
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
          var g = f = null, O = null, B = e, X = !1;
          do {
            var Q = B.lane & -536870913;
            if (Q !== B.lane ? (gt & Q) === Q : (la & Q) === Q) {
              var Z = B.revertLane;
              if (Z === 0)
                O !== null && (O = O.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: B.action,
                  hasEagerState: B.hasEagerState,
                  eagerState: B.eagerState,
                  next: null
                }), Q === gl && (X = !0);
              else if ((la & Z) === Z) {
                B = B.next, Z === gl && (X = !0);
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
                }, O === null ? (g = O = Q, f = o) : O = O.next = Q, dt.lanes |= Z, Ea |= Z;
              Q = B.action, Ja && a(o, Q), o = B.hasEagerState ? B.eagerState : a(o, Q);
            } else
              Z = {
                lane: Q,
                revertLane: B.revertLane,
                gesture: B.gesture,
                action: B.action,
                hasEagerState: B.hasEagerState,
                eagerState: B.eagerState,
                next: null
              }, O === null ? (g = O = Z, f = o) : O = O.next = Z, dt.lanes |= Q, Ea |= Q;
            B = B.next;
          } while (B !== null && B !== e);
          if (O === null ? f = o : O.next = g, !be(o, t.memoizedState) && (qt = !0, X && (a = vl, a !== null)))
            throw a;
          t.memoizedState = o, t.baseState = f, t.baseQueue = O, n.lastRenderedState = o;
        }
        return r === null && (n.lanes = 0), [t.memoizedState, n.dispatch];
      }
      function Fi(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(c(311));
        a.lastRenderedReducer = t;
        var n = a.dispatch, r = a.pending, o = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var f = r = r.next;
          do
            o = t(o, f.action), f = f.next;
          while (f !== r);
          be(o, e.memoizedState) || (qt = !0), e.memoizedState = o, e.baseQueue === null && (e.baseState = o), a.lastRenderedState = o;
        }
        return [o, n];
      }
      function fs(t, e, a) {
        var n = dt, r = Ut(), o = vt;
        if (o) {
          if (a === void 0)
            throw Error(c(407));
          a = a();
        } else a = e();
        var f = !be(
          (zt || r).memoizedState,
          a
        );
        if (f && (r.memoizedState = a, qt = !0), r = r.queue, Pi(hs.bind(null, n, r, t), [
          t
        ]), r.getSnapshot !== e || f || Bt !== null && Bt.memoizedState.tag & 1) {
          if (n.flags |= 2048, ll(
            9,
            { destroy: void 0 },
            ps.bind(
              null,
              n,
              r,
              a,
              e
            ),
            null
          ), kt === null) throw Error(c(349));
          o || (la & 127) !== 0 || ms(n, e, a);
        }
        return a;
      }
      function ms(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = dt.updateQueue, e === null ? (e = zn(), dt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function ps(t, e, a, n) {
        e.value = a, e.getSnapshot = n, gs(e) && vs(t);
      }
      function hs(t, e, a) {
        return a(function() {
          gs(e) && vs(t);
        });
      }
      function gs(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !be(t, a);
        } catch {
          return !0;
        }
      }
      function vs(t) {
        var e = Ha(t, 2);
        e !== null && se(e, t, 2);
      }
      function Ii(t) {
        var e = re();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Ja) {
            Ht(!0);
            try {
              a();
            } finally {
              Ht(!1);
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
      function bs(t, e, a, n) {
        return t.baseState = a, Wi(
          t,
          zt,
          typeof n == "function" ? n : We
        );
      }
      function _f(t, e, a, n, r) {
        if (Cn(t)) throw Error(c(485));
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
          at.T !== null ? a(!0) : o.isTransition = !1, n(o), a = e.pending, a === null ? (o.next = e.pending = o, ys(e, o)) : (o.next = a.next, e.pending = a.next = o);
        }
      }
      function ys(t, e) {
        var a = e.action, n = e.payload, r = t.state;
        if (e.isTransition) {
          var o = at.T, f = {};
          at.T = f;
          try {
            var g = a(r, n), O = at.S;
            O !== null && O(f, g), xs(t, e, g);
          } catch (B) {
            $i(t, e, B);
          } finally {
            o !== null && f.types !== null && (o.types = f.types), at.T = o;
          }
        } else
          try {
            o = a(r, n), xs(t, e, o);
          } catch (B) {
            $i(t, e, B);
          }
      }
      function xs(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(n) {
            ws(t, e, n);
          },
          function(n) {
            return $i(t, e, n);
          }
        ) : ws(t, e, a);
      }
      function ws(t, e, a) {
        e.status = "fulfilled", e.value = a, _s(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ys(t, a)));
      }
      function $i(t, e, a) {
        var n = t.pending;
        if (t.pending = null, n !== null) {
          n = n.next;
          do
            e.status = "rejected", e.reason = a, _s(e), e = e.next;
          while (e !== n);
        }
        t.action = null;
      }
      function _s(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Ss(t, e) {
        return e;
      }
      function zs(t, e) {
        if (vt) {
          var a = kt.formState;
          if (a !== null) {
            t: {
              var n = dt;
              if (vt) {
                if (Ct) {
                  var r = qm(
                    Ct,
                    Ne
                  );
                  if (r) {
                    Ct = bc(r), n = Ym(r);
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
          lastRenderedReducer: Ss,
          lastRenderedState: e
        }, a.queue = n, a = Qs.bind(
          null,
          dt,
          n
        ), n.dispatch = a, n = Ii(!1);
        var o = lr.bind(
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
        }, n.queue = r, a = _f.bind(
          null,
          dt,
          r,
          o,
          a
        ), r.dispatch = a, n.memoizedState = t, [e, a, !1];
      }
      function Es(t) {
        var e = Ut();
        return ks(e, zt, t);
      }
      function ks(t, e, a) {
        if (e = Wi(
          t,
          e,
          Ss
        )[0], t = kn(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var n = Bl(e);
          } catch (f) {
            throw f === bl ? ti : f;
          }
        else n = e;
        e = Ut();
        var r = e.queue, o = r.dispatch;
        return a !== e.memoizedState && (dt.flags |= 2048, ll(
          9,
          { destroy: void 0 },
          Sf.bind(null, r, a),
          null
        )), [n, o, t];
      }
      function Sf(t, e) {
        t.action = e;
      }
      function Ns(t) {
        var e = Ut(), a = zt;
        if (a !== null)
          return ks(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var n = a.queue.dispatch;
        return a.memoizedState = t, [e, n, !1];
      }
      function ll(t, e, a, n) {
        return t = { tag: t, create: a, deps: n, inst: e, next: null }, e = dt.updateQueue, e === null && (e = zn(), dt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (n = a.next, a.next = t, t.next = n, e.lastEffect = t), t;
      }
      function Ts() {
        return Ut().memoizedState;
      }
      function Nn(t, e, a, n) {
        var r = re();
        dt.flags |= t, r.memoizedState = ll(
          1 | e,
          { destroy: void 0 },
          a,
          n === void 0 ? null : n
        );
      }
      function Tn(t, e, a, n) {
        var r = Ut();
        n = n === void 0 ? null : n;
        var o = r.memoizedState.inst;
        zt !== null && n !== null && Vi(n, zt.memoizedState.deps) ? r.memoizedState = ll(e, o, a, n) : (dt.flags |= t, r.memoizedState = ll(
          1 | e,
          o,
          a,
          n
        ));
      }
      function Cs(t, e) {
        Nn(8390656, 8, t, e);
      }
      function Pi(t, e) {
        Tn(2048, 8, t, e);
      }
      function zf(t) {
        dt.flags |= 4;
        var e = dt.updateQueue;
        if (e === null)
          e = zn(), dt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function js(t) {
        var e = Ut().memoizedState;
        return zf({ ref: e, nextImpl: t }), function() {
          if ((pt & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Ms(t, e) {
        return Tn(4, 2, t, e);
      }
      function As(t, e) {
        return Tn(4, 4, t, e);
      }
      function Os(t, e) {
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
      function Rs(t, e, a) {
        a = a != null ? a.concat([t]) : null, Tn(
          4,
          4,
          Os.bind(null, e, t),
          a
        );
      }
      function tr() {
      }
      function Hs(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var n = a.memoizedState;
        return e !== null && Vi(e, n[1]) ? n[0] : (a.memoizedState = [t, e], t);
      }
      function Us(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var n = a.memoizedState;
        if (e !== null && Vi(e, n[1]))
          return n[0];
        if (n = t(), Ja) {
          Ht(!0);
          try {
            t();
          } finally {
            Ht(!1);
          }
        }
        return a.memoizedState = [n, e], n;
      }
      function er(t, e, a) {
        return a === void 0 || (la & 1073741824) !== 0 && (gt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Au(), dt.lanes |= t, Ea |= t, a);
      }
      function Ds(t, e, a, n) {
        return be(a, e) ? a : wl.current !== null ? (t = er(t, a, n), be(t, e) || (qt = !0), t) : (la & 42) === 0 || (la & 1073741824) !== 0 && (gt & 261930) === 0 ? (qt = !0, t.memoizedState = a) : (t = Au(), dt.lanes |= t, Ea |= t, e);
      }
      function Bs(t, e, a, n, r) {
        var o = ea();
        Jt(
          o !== 0 && 8 > o ? o : 8
        );
        var f = at.T, g = {};
        at.T = g, lr(t, !1, e, a);
        try {
          var O = r(), B = at.S;
          if (B !== null && B(g, O), O !== null && typeof O == "object" && typeof O.then == "function") {
            var X = xf(
              O,
              n
            );
            ql(
              t,
              e,
              X,
              pe(t)
            );
          } else
            ql(
              t,
              e,
              n,
              pe(t)
            );
        } catch (Q) {
          ql(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: Q },
            pe()
          );
        } finally {
          Jt(o), f !== null && g.types !== null && (f.types = g.types), at.T = f;
        }
      }
      function qs(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: ul,
          baseState: ul,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: We,
            lastRenderedState: ul
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
      function ar() {
        return It(Ga);
      }
      function Ys() {
        return Ut().memoizedState;
      }
      function Gs() {
        return Ut().memoizedState;
      }
      function Ef(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = pe();
              t = fa(a);
              var n = ma(e, t, a);
              n !== null && (se(n, e, a), Hl(n, e, a)), e = { cache: Oi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function kf(t, e, a) {
        var n = pe();
        a = {
          lane: n,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Cn(t) ? Vs(e, a) : (a = Ui(t, e, a, n), a !== null && (se(a, t, n), Ks(a, e, n)));
      }
      function Qs(t, e, a) {
        var n = pe();
        ql(t, e, a, n);
      }
      function ql(t, e, a, n) {
        var r = {
          lane: n,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Cn(t)) Vs(e, r);
        else {
          var o = t.alternate;
          if (t.lanes === 0 && (o === null || o.lanes === 0) && (o = e.lastRenderedReducer, o !== null))
            try {
              var f = e.lastRenderedState, g = o(f, a);
              if (r.hasEagerState = !0, r.eagerState = g, be(g, f))
                return wn(t, e, r, 0), kt === null && xn(), !1;
            } catch {
            } finally {
            }
          if (a = Ui(t, e, r, n), a !== null)
            return se(a, t, n), Ks(a, e, n), !0;
        }
        return !1;
      }
      function lr(t, e, a, n) {
        if (n = {
          lane: 2,
          revertLane: Ri(),
          gesture: null,
          action: n,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Cn(t)) {
          if (e) throw Error(c(479));
        } else
          e = Ui(
            t,
            a,
            n,
            2
          ), e !== null && se(e, t, 2);
      }
      function Cn(t) {
        var e = t.alternate;
        return t === dt || e !== null && e === dt;
      }
      function Vs(t, e) {
        _l = li = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Ks(t, e, a) {
        if ((a & 4194048) !== 0) {
          var n = e.lanes;
          n &= t.pendingLanes, a |= n, e.lanes = a, q(t, a);
        }
      }
      function nr(t, e, a, n) {
        e = t.memoizedState, a = a(n, e), a = a == null ? e : Or({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Xs(t, e, a, n, r, o, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(n, o, f) : e.prototype && e.prototype.isPureReactComponent ? !vn(a, n) || !vn(r, o) : !0;
      }
      function Zs(t, e, a, n) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, n), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, n), e.state !== t && no.enqueueReplaceState(e, e.state, null);
      }
      function Ua(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var n in e)
            n !== "ref" && (a[n] = e[n]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Or({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function jn(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (n) {
          setTimeout(function() {
            throw n;
          });
        }
      }
      function Js(t, e, a) {
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
      function ir(t, e, a) {
        return a = fa(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          jn(t, e);
        }, a;
      }
      function Ls(t) {
        return t = fa(t), t.tag = 3, t;
      }
      function Ws(t, e, a, n) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var o = n.value;
          t.payload = function() {
            return r(o);
          }, t.callback = function() {
            Js(e, a, n);
          };
        }
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          Js(e, a, n), typeof r != "function" && (ka === null ? ka = /* @__PURE__ */ new Set([this]) : ka.add(this));
          var g = n.stack;
          this.componentDidCatch(n.value, {
            componentStack: g !== null ? g : ""
          });
        });
      }
      function Nf(t, e, a, n, r) {
        if (a.flags |= 32768, n !== null && typeof n == "object" && typeof n.then == "function") {
          if (e = a.alternate, e !== null && el(
            e,
            a,
            r,
            !0
          ), a = ye.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Ce === null ? qn() : a.alternate === null && Rt === 0 && (Rt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, n === ei ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([n]) : e.add(n), Tr(t, n, r)), !1;
              case 22:
                return a.flags |= 65536, n === ei ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([n])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([n]) : a.add(n)), Tr(t, n, r)), !1;
            }
            throw Error(c(435, a.tag));
          }
          return Tr(t, n, r), qn(), !1;
        }
        if (vt)
          return e = ye.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, n !== Fr && (t = Error(c(422), { cause: n }), Al(
            st(t, a)
          ))) : (n !== Fr && (e = Error(c(423), {
            cause: n
          }), Al(
            st(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, n = st(n, a), r = ir(
            t.stateNode,
            n,
            r
          ), qi(t, r), Rt !== 4 && (Rt = 2)), !1;
        var o = Error(c(520), { cause: n });
        if (o = st(o, a), nn === null ? nn = [o] : nn.push(o), Rt !== 4 && (Rt = 2), e === null) return !0;
        n = st(n, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = ir(a.stateNode, n, t), qi(a, t), !1;
            case 1:
              if (e = a.type, o = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (ka === null || !ka.has(
                o
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = Ls(r), Ws(
                  r,
                  t,
                  a,
                  n
                ), qi(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, n) {
        e.child = t === null ? Hc(e, null, a, n) : Za(
          e,
          t.child,
          a,
          n
        );
      }
      function Fs(t, e, a, n, r) {
        a = a.render;
        var o = e.ref;
        if ("ref" in n) {
          var f = {};
          for (var g in n)
            g !== "ref" && (f[g] = n[g]);
        } else f = n;
        return Oa(e), n = Ki(
          t,
          e,
          a,
          f,
          o,
          r
        ), g = Xi(), t !== null && !qt ? (Zi(t, e, r), Fe(t, e, r)) : (vt && g && Y(e), e.flags |= 1, $t(t, e, n, r), e.child);
      }
      function Is(t, e, a, n, r) {
        if (t === null) {
          var o = a.type;
          return typeof o == "function" && !Cr(o) && o.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = o, $s(
            t,
            e,
            o,
            n,
            r
          )) : (t = Gn(
            a.type,
            null,
            n,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (o = t.child, !fr(t, r)) {
          var f = o.memoizedProps;
          if (a = a.compare, a = a !== null ? a : vn, a(f, n) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(o, n), t.ref = e.ref, t.return = e, e.child = t;
      }
      function $s(t, e, a, n, r) {
        if (t !== null) {
          var o = t.memoizedProps;
          if (vn(o, n) && t.ref === e.ref)
            if (qt = !1, e.pendingProps = n = o, fr(t, r))
              (t.flags & 131072) !== 0 && (qt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return rr(
          t,
          e,
          a,
          n,
          r
        );
      }
      function Ps(t, e, a, n) {
        var r = n.children, o = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), n.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (o = o !== null ? o.baseLanes | a : a, t !== null) {
              for (n = e.child = t.child, r = 0; n !== null; )
                r = r | n.lanes | n.childLanes, n = n.sibling;
              n = r & ~o;
            } else n = 0, e.child = null;
            return tu(
              t,
              e,
              o,
              a,
              n
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && gn(
              e,
              o !== null ? o.cachePool : null
            ), o !== null ? ss(e, o) : Yi(), us(e);
          else
            return n = e.lanes = 536870912, tu(
              t,
              e,
              o !== null ? o.baseLanes | a : a,
              a,
              n
            );
        } else
          o !== null ? (gn(e, o.cachePool), ss(e, o), ha(), e.memoizedState = null) : (t !== null && gn(e, null), Yi(), ha());
        return $t(t, e, r, a), e.child;
      }
      function Yl(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function tu(t, e, a, n, r) {
        var o = Hi();
        return o = o === null ? null : {
          parent: ta ? jt._currentValue : jt._currentValue2,
          pool: o
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: o
        }, t !== null && gn(e, null), Yi(), us(e), t !== null && el(t, e, n, !0), e.childLanes = r, null;
      }
      function Mn(t, e) {
        return e = On(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function eu(t, e, a) {
        return Za(e, t.child, null, a), t = Mn(
          e,
          e.pendingProps
        ), t.flags |= 2, me(e), e.memoizedState = null, t;
      }
      function Tf(t, e, a) {
        var n = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (vt) {
            if (n.mode === "hidden")
              return t = Mn(e, n), e.lanes = 536870912, Yl(null, t);
            if (Qi(e), (t = Ct) ? (t = Wm(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Ke } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = $u(t), a.return = e, e.child = a, te = e, Ct = null)) : t = null, t === null) throw ut(e);
            return e.lanes = 536870912, null;
          }
          return Mn(e, n);
        }
        var o = t.memoizedState;
        if (o !== null) {
          var f = o.dehydrated;
          if (Qi(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = eu(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (qt || el(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, qt || r) {
            if (n = kt, n !== null && (f = F(n, a), f !== 0 && f !== o.retryLane))
              throw o.retryLane = f, Ha(t, f), se(n, t, f), io;
            qn(), e = eu(
              t,
              e,
              a
            );
          } else
            t = o.treeContext, ne && (Ct = Km(f), te = e, vt = !0, _a = null, Ne = !1, t !== null && I(e, t)), e = Mn(e, n), e.flags |= 4096;
          return e;
        }
        return t = Pe(t.child, {
          mode: n.mode,
          children: n.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function An(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(c(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function rr(t, e, a, n, r) {
        return Oa(e), a = Ki(
          t,
          e,
          a,
          n,
          void 0,
          r
        ), n = Xi(), t !== null && !qt ? (Zi(t, e, r), Fe(t, e, r)) : (vt && n && Y(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function au(t, e, a, n, r, o) {
        return Oa(e), e.updateQueue = null, a = ds(
          e,
          n,
          a,
          r
        ), cs(t), n = Xi(), t !== null && !qt ? (Zi(t, e, o), Fe(t, e, o)) : (vt && n && Y(e), e.flags |= 1, $t(t, e, a, o), e.child);
      }
      function lu(t, e, a, n, r) {
        if (Oa(e), e.stateNode === null) {
          var o = fl, f = a.contextType;
          typeof f == "object" && f !== null && (o = It(f)), o = new a(n, o), e.memoizedState = o.state !== null && o.state !== void 0 ? o.state : null, o.updater = no, e.stateNode = o, o._reactInternals = e, o = e.stateNode, o.props = n, o.state = e.memoizedState, o.refs = {}, Di(e), f = a.contextType, o.context = typeof f == "object" && f !== null ? It(f) : fl, o.state = e.memoizedState, f = a.getDerivedStateFromProps, typeof f == "function" && (nr(
            e,
            a,
            f,
            n
          ), o.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof o.getSnapshotBeforeUpdate == "function" || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (f = o.state, typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount(), f !== o.state && no.enqueueReplaceState(
            o,
            o.state,
            null
          ), Dl(e, n, o, r), Ul(), o.state = e.memoizedState), typeof o.componentDidMount == "function" && (e.flags |= 4194308), n = !0;
        } else if (t === null) {
          o = e.stateNode;
          var g = e.memoizedProps, O = Ua(a, g);
          o.props = O;
          var B = o.context, X = a.contextType;
          f = fl, typeof X == "object" && X !== null && (f = It(X));
          var Q = a.getDerivedStateFromProps;
          X = typeof Q == "function" || typeof o.getSnapshotBeforeUpdate == "function", g = e.pendingProps !== g, X || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (g || B !== f) && Zs(
            e,
            o,
            n,
            f
          ), Sa = !1;
          var Z = e.memoizedState;
          o.state = Z, Dl(e, n, o, r), Ul(), B = e.memoizedState, g || Z !== B || Sa ? (typeof Q == "function" && (nr(
            e,
            a,
            Q,
            n
          ), B = e.memoizedState), (O = Sa || Xs(
            e,
            a,
            O,
            n,
            Z,
            B,
            f
          )) ? (X || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = n, e.memoizedState = B), o.props = n, o.state = B, o.context = f, n = O) : (typeof o.componentDidMount == "function" && (e.flags |= 4194308), n = !1);
        } else {
          o = e.stateNode, Bi(t, e), f = e.memoizedProps, X = Ua(a, f), o.props = X, Q = e.pendingProps, Z = o.context, B = a.contextType, O = fl, typeof B == "object" && B !== null && (O = It(B)), g = a.getDerivedStateFromProps, (B = typeof g == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (f !== Q || Z !== O) && Zs(
            e,
            o,
            n,
            O
          ), Sa = !1, Z = e.memoizedState, o.state = Z, Dl(e, n, o, r), Ul();
          var ct = e.memoizedState;
          f !== Q || Z !== ct || Sa || t !== null && t.dependencies !== null && mn(t.dependencies) ? (typeof g == "function" && (nr(
            e,
            a,
            g,
            n
          ), ct = e.memoizedState), (X = Sa || Xs(
            e,
            a,
            X,
            n,
            Z,
            ct,
            O
          ) || t !== null && t.dependencies !== null && mn(t.dependencies)) ? (B || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(n, ct, O), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(
            n,
            ct,
            O
          )), typeof o.componentDidUpdate == "function" && (e.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), e.memoizedProps = n, e.memoizedState = ct), o.props = n, o.state = ct, o.context = O, n = X) : (typeof o.componentDidUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && Z === t.memoizedState || (e.flags |= 1024), n = !1);
        }
        return o = n, An(t, e), n = (e.flags & 128) !== 0, o || n ? (o = e.stateNode, a = n && typeof a.getDerivedStateFromError != "function" ? null : o.render(), e.flags |= 1, t !== null && n ? (e.child = Za(
          e,
          t.child,
          null,
          r
        ), e.child = Za(
          e,
          null,
          a,
          r
        )) : $t(t, e, a, r), e.memoizedState = o.state, t = e.child) : t = Fe(
          t,
          e,
          r
        ), t;
      }
      function nu(t, e, a, n) {
        return Oe(), e.flags |= 256, $t(t, e, a, n), e.child;
      }
      function or(t) {
        return { baseLanes: t, cachePool: Po() };
      }
      function sr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= we), t;
      }
      function iu(t, e, a) {
        var n = e.pendingProps, r = !1, o = (e.flags & 128) !== 0, f;
        if ((f = o) || (f = t !== null && t.memoizedState === null ? !1 : (Dt.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (vt) {
            if (r ? pa(e) : ha(), (t = Ct) ? (t = Fm(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Ke } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = $u(t), a.return = e, e.child = a, te = e, Ct = null)) : t = null, t === null) throw ut(e);
            return Vr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var g = n.children;
          return n = n.fallback, r ? (ha(), r = e.mode, g = On(
            { mode: "hidden", children: g },
            r
          ), n = qa(
            n,
            r,
            a,
            null
          ), g.return = e, n.return = e, g.sibling = n, e.child = g, n = e.child, n.memoizedState = or(a), n.childLanes = sr(
            t,
            f,
            a
          ), e.memoizedState = ro, Yl(null, n)) : (pa(e), ur(e, g));
        }
        var O = t.memoizedState;
        if (O !== null && (g = O.dehydrated, g !== null)) {
          if (o)
            e.flags & 256 ? (pa(e), e.flags &= -257, e = cr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ha(), e.child = t.child, e.flags |= 128, e = null) : (ha(), g = n.fallback, r = e.mode, n = On(
              { mode: "visible", children: n.children },
              r
            ), g = qa(
              g,
              r,
              a,
              null
            ), g.flags |= 2, n.return = e, g.return = e, n.sibling = g, e.child = n, Za(
              e,
              t.child,
              null,
              a
            ), n = e.child, n.memoizedState = or(a), n.childLanes = sr(
              t,
              f,
              a
            ), e.memoizedState = ro, e = Yl(null, n));
          else if (pa(e), Vr(g))
            f = Dm(g).digest, n = Error(c(419)), n.stack = "", n.digest = f, Al({ value: n, source: null, stack: null }), e = cr(
              t,
              e,
              a
            );
          else if (qt || el(
            t,
            e,
            a,
            !1
          ), f = (a & t.childLanes) !== 0, qt || f) {
            if (f = kt, f !== null && (n = F(
              f,
              a
            ), n !== 0 && n !== O.retryLane))
              throw O.retryLane = n, Ha(t, n), se(f, t, n), io;
            Qr(g) || qn(), e = cr(
              t,
              e,
              a
            );
          } else
            Qr(g) ? (e.flags |= 192, e.child = t.child, e = null) : (t = O.treeContext, ne && (Ct = Xm(
              g
            ), te = e, vt = !0, _a = null, Ne = !1, t !== null && I(e, t)), e = ur(
              e,
              n.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ha(), g = n.fallback, r = e.mode, O = t.child, o = O.sibling, n = Pe(O, {
          mode: "hidden",
          children: n.children
        }), n.subtreeFlags = O.subtreeFlags & 65011712, o !== null ? g = Pe(
          o,
          g
        ) : (g = qa(
          g,
          r,
          a,
          null
        ), g.flags |= 2), g.return = e, n.return = e, n.sibling = g, e.child = n, Yl(null, n), n = e.child, g = t.child.memoizedState, g === null ? g = or(a) : (r = g.cachePool, r !== null ? (O = ta ? jt._currentValue : jt._currentValue2, r = r.parent !== O ? { parent: O, pool: O } : r) : r = Po(), g = {
          baseLanes: g.baseLanes | a,
          cachePool: r
        }), n.memoizedState = g, n.childLanes = sr(
          t,
          f,
          a
        ), e.memoizedState = ro, Yl(t.child, n)) : (pa(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: n.children
        }), a.return = e, a.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function ur(t, e) {
        return e = On(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function On(t, e) {
        return t = u(22, t, null, e), t.lanes = 0, t;
      }
      function cr(t, e, a) {
        return Za(e, t.child, null, a), t = ur(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function ru(t, e, a) {
        t.lanes |= e;
        var n = t.alternate;
        n !== null && (n.lanes |= e), Mi(t.return, e, a);
      }
      function dr(t, e, a, n, r, o) {
        var f = t.memoizedState;
        f === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: n,
          tail: a,
          tailMode: r,
          treeForkCount: o
        } : (f.isBackwards = e, f.rendering = null, f.renderingStartTime = 0, f.last = n, f.tail = a, f.tailMode = r, f.treeForkCount = o);
      }
      function ou(t, e, a) {
        var n = e.pendingProps, r = n.revealOrder, o = n.tail;
        n = n.children;
        var f = Dt.current, g = (f & 2) !== 0;
        if (g ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, S(Dt, f), $t(t, e, n, a), n = vt ? Il : 0, !g && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && ru(t, a, e);
            else if (t.tag === 19)
              ru(t, a, e);
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
              t = a.alternate, t !== null && Sn(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), dr(
              e,
              !1,
              r,
              a,
              o,
              n
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && Sn(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            dr(
              e,
              !0,
              a,
              null,
              o,
              n
            );
            break;
          case "together":
            dr(
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
            if (el(
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
      function fr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && mn(t)));
      }
      function Cf(t, e, a) {
        switch (e.tag) {
          case 3:
            $(
              e,
              e.stateNode.containerInfo
            ), da(e, jt, t.memoizedState.cache), Oe();
            break;
          case 27:
          case 5:
            bt(e);
            break;
          case 4:
            $(
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
              return e.flags |= 128, Qi(e), null;
            break;
          case 13:
            var n = e.memoizedState;
            if (n !== null)
              return n.dehydrated !== null ? (pa(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? iu(
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
            if (n = (a & e.childLanes) !== 0, n || (el(
              t,
              e,
              a,
              !1
            ), n = (a & e.childLanes) !== 0), r) {
              if (n)
                return ou(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), S(Dt, Dt.current), n) break;
            return null;
          case 22:
            return e.lanes = 0, Ps(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            da(e, jt, t.memoizedState.cache);
        }
        return Fe(t, e, a);
      }
      function su(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            qt = !0;
          else {
            if (!fr(t, a) && (e.flags & 128) === 0)
              return qt = !1, Cf(
                t,
                e,
                a
              );
            qt = (t.flags & 131072) !== 0;
          }
        else
          qt = !1, vt && (e.flags & 1048576) !== 0 && _(e, Il, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var n = e.pendingProps;
              if (t = Ra(e.elementType), e.type = t, typeof t == "function")
                Cr(t) ? (n = Ua(t, n), e.tag = 1, e = lu(
                  null,
                  e,
                  t,
                  n,
                  a
                )) : (e.tag = 0, e = rr(
                  null,
                  e,
                  t,
                  n,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Hr) {
                    e.tag = 11, e = Fs(
                      null,
                      e,
                      t,
                      n,
                      a
                    );
                    break t;
                  } else if (r === Br) {
                    e.tag = 14, e = Is(
                      null,
                      e,
                      t,
                      n,
                      a
                    );
                    break t;
                  }
                }
                throw e = M(t) || t, Error(c(306, e, ""));
              }
            }
            return e;
          case 0:
            return rr(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return n = e.type, r = Ua(
              n,
              e.pendingProps
            ), lu(
              t,
              e,
              n,
              r,
              a
            );
          case 3:
            t: {
              if ($(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(c(387));
              var o = e.pendingProps;
              r = e.memoizedState, n = r.element, Bi(t, e), Dl(e, o, null, a);
              var f = e.memoizedState;
              if (o = f.cache, da(e, jt, o), o !== r.cache && Ai(
                e,
                [jt],
                a,
                !0
              ), Ul(), o = f.element, ne && r.isDehydrated)
                if (r = {
                  element: o,
                  isDehydrated: !1,
                  cache: f.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = nu(
                    t,
                    e,
                    o,
                    a
                  );
                  break t;
                } else if (o !== n) {
                  n = st(
                    Error(c(424)),
                    e
                  ), Al(n), e = nu(
                    t,
                    e,
                    o,
                    a
                  );
                  break t;
                } else
                  for (ne && (Ct = Vm(
                    e.stateNode.containerInfo
                  ), te = e, vt = !0, _a = null, Ne = !0), a = Hc(
                    e,
                    null,
                    o,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Oe(), o === n) {
                  e = Fe(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                $t(t, e, o, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (De)
              return An(t, e), t === null ? (a = wc(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : vt || (e.stateNode = gp(
                e.type,
                e.pendingProps,
                wa.current,
                e
              )) : e.memoizedState = wc(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return bt(e), t === null && Vt && vt && (n = e.stateNode = Nc(
                e.type,
                e.pendingProps,
                wa.current,
                Pt.current,
                !1
              ), te = e, Ne = !0, Ct = Zm(
                e.type,
                n,
                Ct
              )), $t(
                t,
                e,
                e.pendingProps.children,
                a
              ), An(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && vt && (mp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = n = Ct) && (n = Jm(
              n,
              e.type,
              e.pendingProps,
              Ne
            ), n !== null ? (e.stateNode = n, te = e, Ct = Qm(n), Ne = !1, r = !0) : r = !1), r || ut(e)), bt(e), r = e.type, o = e.pendingProps, f = t !== null ? t.memoizedProps : null, n = o.children, Kn(r, o) ? n = null : f !== null && Kn(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = Ki(
              t,
              e,
              wf,
              null,
              null,
              a
            ), ta ? Ga._currentValue = r : Ga._currentValue2 = r), An(t, e), $t(t, e, n, a), e.child;
          case 6:
            return t === null && vt && (pp(
              e.pendingProps,
              Pt.current
            ), (t = a = Ct) && (a = Lm(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, te = e, Ct = null, t = !0) : t = !1), t || ut(e)), null;
          case 13:
            return iu(t, e, a);
          case 4:
            return $(
              e,
              e.stateNode.containerInfo
            ), n = e.pendingProps, t === null ? e.child = Za(
              e,
              null,
              n,
              a
            ) : $t(t, e, n, a), e.child;
          case 11:
            return Fs(
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
            return r = e.type._context, n = e.pendingProps.children, Oa(e), r = It(r), n = n(r), e.flags |= 1, $t(t, e, n, a), e.child;
          case 14:
            return Is(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return $s(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return ou(
              t,
              e,
              a
            );
          case 31:
            return Tf(t, e, a);
          case 22:
            return Ps(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Oa(e), n = It(jt), t === null ? (r = Hi(), r === null && (r = kt, o = Oi(), r.pooledCache = o, o.refCount++, o !== null && (r.pooledCacheLanes |= a), r = o), e.memoizedState = {
              parent: n,
              cache: r
            }, Di(e), da(e, jt, r)) : ((t.lanes & a) !== 0 && (Bi(t, e), Dl(e, null, null, a), Ul()), r = t.memoizedState, o = e.memoizedState, r.parent !== n ? (r = { parent: n, cache: n }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), da(e, jt, n)) : (n = o.cache, da(e, jt, n), n !== r.cache && Ai(
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
      function Re(t) {
        t.flags |= 4;
      }
      function Rn(t) {
        Qe && (t.flags |= 8);
      }
      function uu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function mr(t, e, a, n) {
        if (le)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Yr(t, a.stateNode);
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
        else if (Qe)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var o = r.stateNode;
              a && n && (o = gc(
                o,
                r.type,
                r.memoizedProps
              )), Yr(t, o);
            } else if (r.tag === 6)
              o = r.stateNode, a && n && (o = vc(
                o,
                r.memoizedProps
              )), Yr(t, o);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                o = r.child, o !== null && (o.return = r), mr(t, r, !0, !0);
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
      function cu(t, e, a, n) {
        var r = !1;
        if (Qe)
          for (var o = e.child; o !== null; ) {
            if (o.tag === 5) {
              var f = o.stateNode;
              a && n && (f = gc(
                f,
                o.type,
                o.memoizedProps
              )), pc(t, f);
            } else if (o.tag === 6)
              f = o.stateNode, a && n && (f = vc(
                f,
                o.memoizedProps
              )), pc(t, f);
            else if (o.tag !== 4) {
              if (o.tag === 22 && o.memoizedState !== null)
                r = o.child, r !== null && (r.return = o), cu(t, o, !0, !0), r = !0;
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
      function du(t, e) {
        if (Qe && uu(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, n = mc();
          cu(n, e, !1, !1), t.pendingChildren = n, Re(e), Um(a, n);
        }
      }
      function pr(t, e, a, n) {
        if (le)
          t.memoizedProps !== n && Re(e);
        else if (Qe) {
          var r = t.stateNode, o = t.memoizedProps;
          if ((t = uu(t, e)) || o !== n) {
            var f = Pt.current;
            o = Hm(
              r,
              a,
              o,
              n,
              !t,
              null
            ), o === r ? e.stateNode = r : (Rn(e), sc(
              o,
              a,
              n,
              f
            ) && Re(e), e.stateNode = o, t && mr(o, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function hr(t, e, a, n, r) {
        if ((t.mode & 32) !== 0 && (a === null ? sm(e, n) : um(e, a, n))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Gr(e, n))
            if (cc(t.stateNode, e, n))
              t.flags |= 8192;
            else if (Du()) t.flags |= 8192;
            else
              throw Xa = ei, to;
        } else t.flags &= -16777217;
      }
      function fu(t, e) {
        if (bp(e)) {
          if (t.flags |= 16777216, !kc(e))
            if (Du()) t.flags |= 8192;
            else
              throw Xa = ei, to;
        } else t.flags &= -16777217;
      }
      function Hn(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? D() : 536870912, t.lanes |= e, kl |= e);
      }
      function Gl(t, e) {
        if (!vt)
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
      function Nt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, n = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, n |= r.subtreeFlags & 65011712, n |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, n |= r.subtreeFlags, n |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= n, t.childLanes = a, e;
      }
      function jf(t, e, a) {
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
            return Nt(e), null;
          case 1:
            return Nt(e), null;
          case 3:
            return a = e.stateNode, n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), Le(jt), et(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ae(e) ? Re(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ca())), du(t, e), Nt(e), null;
          case 26:
            if (De) {
              var r = e.type, o = e.memoizedState;
              return t === null ? (Re(e), o !== null ? (Nt(e), fu(
                e,
                o
              )) : (Nt(e), hr(
                e,
                r,
                null,
                n,
                a
              ))) : o ? o !== t.memoizedState ? (Re(e), Nt(e), fu(
                e,
                o
              )) : (Nt(e), e.flags &= -16777217) : (o = t.memoizedProps, le ? o !== n && Re(e) : pr(
                t,
                e,
                r,
                n
              ), Nt(e), hr(
                e,
                r,
                o,
                n,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Zt(e), a = wa.current, r = e.type, t !== null && e.stateNode != null)
                le ? t.memoizedProps !== n && Re(e) : pr(t, e, r, n);
              else {
                if (!n) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return Nt(e), null;
                }
                t = Pt.current, Ae(e) ? Ma(e, t) : (t = Nc(
                  r,
                  n,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Re(e));
              }
              return Nt(e), null;
            }
          case 5:
            if (Zt(e), r = e.type, t !== null && e.stateNode != null)
              pr(t, e, r, n);
            else {
              if (!n) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return Nt(e), null;
              }
              if (o = Pt.current, Ae(e))
                Ma(e, o), op(
                  e.stateNode,
                  r,
                  n,
                  o
                ) && (e.flags |= 64);
              else {
                var f = tm(
                  r,
                  n,
                  wa.current,
                  o,
                  e
                );
                Rn(e), mr(f, e, !1, !1), e.stateNode = f, sc(
                  f,
                  r,
                  n,
                  o
                ) && Re(e);
              }
            }
            return Nt(e), hr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, le ? a !== n && Re(e) : Qe && (a !== n ? (t = wa.current, a = Pt.current, Rn(e), e.stateNode = uc(
                n,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof n != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = wa.current, a = Pt.current, Ae(e)) {
                if (!ne) throw Error(c(176));
                if (t = e.stateNode, a = e.memoizedProps, n = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      n = r.memoizedProps;
                  }
                $m(
                  t,
                  a,
                  e,
                  n
                ) || ut(e, !0);
              } else
                Rn(e), e.stateNode = uc(
                  n,
                  t,
                  a,
                  e
                );
            }
            return Nt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (n = Ae(e), a !== null) {
                if (t === null) {
                  if (!n) throw Error(c(318));
                  if (!ne) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  Pm(t, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Nt(e), t = !1;
              } else
                a = ca(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (me(e), e) : (me(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return Nt(e), null;
          case 13:
            if (n = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ae(e), n !== null && n.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!ne) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  tp(r, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Nt(e), r = !1;
              } else
                r = ca(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (me(e), e) : (me(e), null);
            }
            return me(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = n !== null, t = t !== null && t.memoizedState !== null, a && (n = e.child, r = null, n.alternate !== null && n.alternate.memoizedState !== null && n.alternate.memoizedState.cachePool !== null && (r = n.alternate.memoizedState.cachePool.pool), o = null, n.memoizedState !== null && n.memoizedState.cachePool !== null && (o = n.memoizedState.cachePool.pool), o !== r && (n.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Hn(e, e.updateQueue), Nt(e), null);
          case 4:
            return et(), du(t, e), t === null && nm(e.stateNode.containerInfo), Nt(e), null;
          case 10:
            return Le(e.type), Nt(e), null;
          case 19:
            if (C(Dt), n = e.memoizedState, n === null) return Nt(e), null;
            if (r = (e.flags & 128) !== 0, o = n.rendering, o === null)
              if (r) Gl(n, !1);
              else {
                if (Rt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (o = Sn(t), o !== null) {
                      for (e.flags |= 128, Gl(n, !1), t = o.updateQueue, e.updateQueue = t, Hn(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Iu(a, t), a = a.sibling;
                      return S(
                        Dt,
                        Dt.current & 1 | 2
                      ), vt && K(e, n.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                n.tail !== null && ue() > rn && (e.flags |= 128, r = !0, Gl(n, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = Sn(o), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Hn(e, t), Gl(n, !0), n.tail === null && n.tailMode === "hidden" && !o.alternate && !vt)
                    return Nt(e), null;
                } else
                  2 * ue() - n.renderingStartTime > rn && a !== 536870912 && (e.flags |= 128, r = !0, Gl(n, !1), e.lanes = 4194304);
              n.isBackwards ? (o.sibling = e.child, e.child = o) : (t = n.last, t !== null ? t.sibling = o : e.child = o, n.last = o);
            }
            return n.tail !== null ? (t = n.tail, n.rendering = t, n.tail = t.sibling, n.renderingStartTime = ue(), t.sibling = null, a = Dt.current, S(
              Dt,
              r ? a & 1 | 2 : a & 1
            ), vt && K(e, n.treeForkCount), t) : (Nt(e), null);
          case 22:
          case 23:
            return me(e), Gi(), n = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== n && (e.flags |= 8192) : n && (e.flags |= 8192), n ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Nt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Nt(e), a = e.updateQueue, a !== null && Hn(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), n = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), n !== a && (e.flags |= 2048), t !== null && C(Ka), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(jt), Nt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function Mf(t, e) {
        switch (tt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Le(jt), et(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Zt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (me(e), e.alternate === null)
                throw Error(c(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (me(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(c(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return C(Dt), null;
          case 4:
            return et(), null;
          case 10:
            return Le(e.type), null;
          case 22:
          case 23:
            return me(e), Gi(), t !== null && C(Ka), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(jt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function mu(t, e) {
        switch (tt(e), e.tag) {
          case 3:
            Le(jt), et();
            break;
          case 26:
          case 27:
          case 5:
            Zt(e);
            break;
          case 4:
            et();
            break;
          case 31:
            e.memoizedState !== null && me(e);
            break;
          case 13:
            me(e);
            break;
          case 19:
            C(Dt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            me(e), Gi(), t !== null && C(Ka);
            break;
          case 24:
            Le(jt);
        }
      }
      function Ql(t, e) {
        try {
          var a = e.updateQueue, n = a !== null ? a.lastEffect : null;
          if (n !== null) {
            var r = n.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                n = void 0;
                var o = a.create, f = a.inst;
                n = o(), f.destroy = n;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (g) {
          yt(e, e.return, g);
        }
      }
      function ga(t, e, a) {
        try {
          var n = e.updateQueue, r = n !== null ? n.lastEffect : null;
          if (r !== null) {
            var o = r.next;
            n = o;
            do {
              if ((n.tag & t) === t) {
                var f = n.inst, g = f.destroy;
                if (g !== void 0) {
                  f.destroy = void 0, r = e;
                  var O = a, B = g;
                  try {
                    B();
                  } catch (X) {
                    yt(
                      r,
                      O,
                      X
                    );
                  }
                }
              }
              n = n.next;
            } while (n !== o);
          }
        } catch (X) {
          yt(e, e.return, X);
        }
      }
      function pu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            os(e, a);
          } catch (n) {
            yt(t, t.return, n);
          }
        }
      }
      function hu(t, e, a) {
        a.props = Ua(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (n) {
          yt(t, e, n);
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
                var n = Jl(t.stateNode);
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
          yt(t, e, r);
        }
      }
      function Ge(t, e) {
        var a = t.ref, n = t.refCleanup;
        if (a !== null)
          if (typeof n == "function")
            try {
              n();
            } catch (r) {
              yt(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (r) {
              yt(t, e, r);
            }
          else a.current = null;
      }
      function gu(t) {
        var e = t.type, a = t.memoizedProps, n = t.stateNode;
        try {
          zm(n, e, a, t);
        } catch (r) {
          yt(t, t.return, r);
        }
      }
      function gr(t, e, a) {
        try {
          Em(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (n) {
          yt(t, t.return, n);
        }
      }
      function vu(t) {
        return t.tag === 5 || t.tag === 3 || (De ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && cl(t.type) : !1) || t.tag === 4;
      }
      function vr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || vu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && cl(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function br(t, e, a) {
        var n = t.tag;
        if (n === 5 || n === 6)
          t = t.stateNode, e ? Nm(a, t, e) : _m(a, t);
        else if (n !== 4 && (Vt && n === 27 && cl(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (br(t, e, a), t = t.sibling; t !== null; )
            br(t, e, a), t = t.sibling;
      }
      function Un(t, e, a) {
        var n = t.tag;
        if (n === 5 || n === 6)
          t = t.stateNode, e ? km(a, t, e) : wm(a, t);
        else if (n !== 4 && (Vt && n === 27 && cl(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Un(t, e, a), t = t.sibling; t !== null; )
            Un(t, e, a), t = t.sibling;
      }
      function bu(t, e, a) {
        t = t.containerInfo;
        try {
          hc(t, a);
        } catch (n) {
          yt(e, e.return, n);
        }
      }
      function yu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          xp(
            t.type,
            a,
            e,
            t
          );
        } catch (n) {
          yt(t, t.return, n);
        }
      }
      function Af(t, e) {
        for ($f(t.containerInfo), Lt = e; Lt !== null; )
          if (t = Lt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Lt = e;
          else
            for (; Lt !== null; ) {
              t = Lt;
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
                    var o = n.stateNode;
                    try {
                      var f = Ua(
                        n.type,
                        r
                      );
                      e = o.getSnapshotBeforeUpdate(
                        f,
                        a
                      ), o.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (g) {
                      yt(n, n.return, g);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && le && Rm(t.stateNode.containerInfo);
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
      function xu(t, e, a) {
        var n = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Ie(t, a), n & 4 && Ql(5, a);
            break;
          case 1:
            if (Ie(t, a), n & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (f) {
                  yt(a, a.return, f);
                }
              else {
                var r = Ua(
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
                  yt(
                    a,
                    a.return,
                    f
                  );
                }
              }
            n & 64 && pu(a), n & 512 && Vl(a, a.return);
            break;
          case 3:
            if (Ie(t, a), n & 64 && (n = a.updateQueue, n !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Jl(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                os(n, t);
              } catch (f) {
                yt(a, a.return, f);
              }
            }
            break;
          case 27:
            Vt && e === null && n & 4 && yu(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (n & 4) gu(a);
              else if (n & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  lp(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (f) {
                  yt(a, a.return, f);
                }
              }
            }
            n & 512 && Vl(a, a.return);
            break;
          case 12:
            Ie(t, a);
            break;
          case 31:
            Ie(t, a), n & 4 && _u(t, a);
            break;
          case 13:
            Ie(t, a), n & 4 && Su(t, a), n & 64 && (n = a.memoizedState, n !== null && (n = n.dehydrated, n !== null && (a = qf.bind(
              null,
              a
            ), Bm(n, a))));
            break;
          case 22:
            if (n = a.memoizedState !== null || na, !n) {
              e = e !== null && e.memoizedState !== null || Yt, r = na;
              var o = Yt;
              na = n, (Yt = e) && !o ? $e(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Ie(t, a), na = r, Yt = o;
            }
            break;
          case 30:
            break;
          default:
            Ie(t, a);
        }
      }
      function wu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, wu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && om(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, a) {
        for (a = a.child; a !== null; )
          yr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function yr(t, e, a) {
        if (ve && typeof ve.onCommitFiberUnmount == "function")
          try {
            ve.onCommitFiberUnmount(Fl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (De) {
              Yt || Ge(a, e), He(
                t,
                e,
                a
              ), a.memoizedState ? Sc(a.memoizedState) : a.stateNode && Ec(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Yt || Ge(a, e);
              var n = Gt, r = ce;
              cl(a.type) && (Gt = a.stateNode, ce = !1), He(
                t,
                e,
                a
              ), Tc(a.stateNode), Gt = n, ce = r;
              break;
            }
          case 5:
            Yt || Ge(a, e);
          case 6:
            if (le) {
              if (n = Gt, r = ce, Gt = null, He(
                t,
                e,
                a
              ), Gt = n, ce = r, Gt !== null)
                if (ce)
                  try {
                    Cm(Gt, a.stateNode);
                  } catch (o) {
                    yt(
                      a,
                      e,
                      o
                    );
                  }
                else
                  try {
                    Tm(Gt, a.stateNode);
                  } catch (o) {
                    yt(
                      a,
                      e,
                      o
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
            le && Gt !== null && (ce ? cp(
              Gt,
              a.stateNode
            ) : up(Gt, a.stateNode));
            break;
          case 4:
            le ? (n = Gt, r = ce, Gt = a.stateNode.containerInfo, ce = !0, He(
              t,
              e,
              a
            ), Gt = n, ce = r) : (Qe && bu(
              a.stateNode,
              a,
              mc()
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
            ga(2, a, e), Yt || ga(4, a, e), He(
              t,
              e,
              a
            );
            break;
          case 1:
            Yt || (Ge(a, e), n = a.stateNode, typeof n.componentWillUnmount == "function" && hu(
              a,
              e,
              n
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
            Yt = (n = Yt) || a.memoizedState !== null, He(
              t,
              e,
              a
            ), Yt = n;
            break;
          default:
            He(
              t,
              e,
              a
            );
        }
      }
      function _u(t, e) {
        if (ne && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            ip(t);
          } catch (a) {
            yt(e, e.return, a);
          }
        }
      }
      function Su(t, e) {
        if (ne && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            rp(t);
          } catch (a) {
            yt(e, e.return, a);
          }
      }
      function Of(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Bc()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Bc()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function Dn(t, e) {
        var a = Of(t);
        e.forEach(function(n) {
          if (!a.has(n)) {
            a.add(n);
            var r = Yf.bind(null, t, n);
            n.then(r, r);
          }
        });
      }
      function ae(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var n = 0; n < a.length; n++) {
            var r = a[n], o = t, f = e;
            if (le) {
              var g = f;
              t: for (; g !== null; ) {
                switch (g.tag) {
                  case 27:
                    if (Vt) {
                      if (cl(g.type)) {
                        Gt = g.stateNode, ce = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Gt = g.stateNode, ce = !1;
                    break t;
                  case 3:
                  case 4:
                    Gt = g.stateNode.containerInfo, ce = !0;
                    break t;
                }
                g = g.return;
              }
              if (Gt === null) throw Error(c(160));
              yr(o, f, r), Gt = null, ce = !1;
            } else yr(o, f, r);
            o = r.alternate, o !== null && (o.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            zu(e, t), e = e.sibling;
      }
      function zu(t, e) {
        var a = t.alternate, n = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ae(e, t), oe(t), n & 4 && (ga(3, t, t.return), Ql(3, t), ga(5, t, t.return));
            break;
          case 1:
            ae(e, t), oe(t), n & 512 && (Yt || a === null || Ge(a, a.return)), n & 64 && na && (t = t.updateQueue, t !== null && (n = t.callbacks, n !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? n : a.concat(n))));
            break;
          case 26:
            if (De) {
              var r = Be;
              if (ae(e, t), oe(t), n & 512 && (Yt || a === null || Ge(a, a.return)), n & 4) {
                n = a !== null ? a.memoizedState : null;
                var o = t.memoizedState;
                a === null ? o === null ? t.stateNode === null ? t.stateNode = hp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : zc(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = _c(
                  r,
                  o,
                  t.memoizedProps
                ) : n !== o ? (n === null ? a.stateNode !== null && Ec(a.stateNode) : Sc(n), o === null ? zc(
                  r,
                  t.type,
                  t.stateNode
                ) : _c(
                  r,
                  o,
                  t.memoizedProps
                )) : o === null && t.stateNode !== null && gr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ae(e, t), oe(t), n & 512 && (Yt || a === null || Ge(a, a.return)), a !== null && n & 4 && gr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ae(e, t), oe(t), n & 512 && (Yt || a === null || Ge(a, a.return)), le) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  fc(r);
                } catch (Q) {
                  yt(t, t.return, Q);
                }
              }
              n & 4 && t.stateNode != null && (r = t.memoizedProps, gr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), n & 1024 && (oo = !0);
            } else
              Qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ae(e, t), oe(t), n & 4 && le) {
              if (t.stateNode === null)
                throw Error(c(162));
              n = t.memoizedProps, a = a !== null ? a.memoizedProps : n, r = t.stateNode;
              try {
                Sm(r, a, n);
              } catch (Q) {
                yt(t, t.return, Q);
              }
            }
            break;
          case 3:
            if (De ? (vp(), r = Be, Be = Kr(e.containerInfo), ae(e, t), Be = r) : ae(e, t), oe(t), n & 4) {
              if (le && ne && a !== null && a.memoizedState.isDehydrated)
                try {
                  np(e.containerInfo);
                } catch (Q) {
                  yt(t, t.return, Q);
                }
              if (Qe) {
                n = e.containerInfo, a = e.pendingChildren;
                try {
                  hc(n, a);
                } catch (Q) {
                  yt(t, t.return, Q);
                }
              }
            }
            oo && (oo = !1, Eu(t));
            break;
          case 4:
            De ? (a = Be, Be = Kr(
              t.stateNode.containerInfo
            ), ae(e, t), oe(t), Be = a) : (ae(e, t), oe(t)), n & 4 && Qe && bu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ae(e, t), oe(t);
            break;
          case 31:
            ae(e, t), oe(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, Dn(t, n)));
            break;
          case 13:
            ae(e, t), oe(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (ci = ue()), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, Dn(t, n)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = a !== null && a.memoizedState !== null, g = na, O = Yt;
            if (na = g || r, Yt = O || f, ae(e, t), Yt = O, na = g, oe(t), n & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || f || na || Yt || Da(t)), le)) {
              t: if (a = null, le)
                for (e = t; ; ) {
                  if (e.tag === 5 || De && e.tag === 26) {
                    if (a === null) {
                      f = a = e;
                      try {
                        o = f.stateNode, r ? jm(o) : Am(
                          f.stateNode,
                          f.memoizedProps
                        );
                      } catch (Q) {
                        yt(f, f.return, Q);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      f = e;
                      try {
                        var B = f.stateNode;
                        r ? Mm(B) : Om(B, f.memoizedProps);
                      } catch (Q) {
                        yt(f, f.return, Q);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      f = e;
                      try {
                        var X = f.stateNode;
                        r ? dp(X) : fp(f.stateNode);
                      } catch (Q) {
                        yt(f, f.return, Q);
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
            n & 4 && (n = t.updateQueue, n !== null && (a = n.retryQueue, a !== null && (n.retryQueue = null, Dn(t, a))));
            break;
          case 19:
            ae(e, t), oe(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, Dn(t, n)));
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
              if (vu(n)) {
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
                    var r = a.stateNode, o = vr(t);
                    Un(t, o, r);
                    break;
                  }
                case 5:
                  var f = a.stateNode;
                  a.flags & 32 && (fc(f), a.flags &= -33);
                  var g = vr(t);
                  Un(t, g, f);
                  break;
                case 3:
                case 4:
                  var O = a.stateNode.containerInfo, B = vr(t);
                  br(
                    t,
                    B,
                    O
                  );
                  break;
                default:
                  throw Error(c(161));
              }
            }
          } catch (X) {
            yt(t, t.return, X);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Eu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Eu(e), e.tag === 5 && e.flags & 1024 && fm(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            xu(t, e.alternate, e), e = e.sibling;
      }
      function Da(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ga(4, e, e.return), Da(e);
              break;
            case 1:
              Ge(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && hu(
                e,
                e.return,
                a
              ), Da(e);
              break;
            case 27:
              Vt && Tc(e.stateNode);
            case 26:
            case 5:
              Ge(e, e.return), Da(e);
              break;
            case 22:
              e.memoizedState === null && Da(e);
              break;
            case 30:
              Da(e);
              break;
            default:
              Da(e);
          }
          t = t.sibling;
        }
      }
      function $e(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var n = e.alternate, r = t, o = e, f = o.flags;
          switch (o.tag) {
            case 0:
            case 11:
            case 15:
              $e(
                r,
                o,
                a
              ), Ql(4, o);
              break;
            case 1:
              if ($e(
                r,
                o,
                a
              ), n = o, r = n.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (B) {
                  yt(n, n.return, B);
                }
              if (n = o, r = n.updateQueue, r !== null) {
                var g = n.stateNode;
                try {
                  var O = r.shared.hiddenCallbacks;
                  if (O !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < O.length; r++)
                      rs(O[r], g);
                } catch (B) {
                  yt(n, n.return, B);
                }
              }
              a && f & 64 && pu(o), Vl(o, o.return);
              break;
            case 27:
              Vt && yu(o);
            case 26:
            case 5:
              $e(
                r,
                o,
                a
              ), a && n === null && f & 4 && gu(o), Vl(o, o.return);
              break;
            case 12:
              $e(
                r,
                o,
                a
              );
              break;
            case 31:
              $e(
                r,
                o,
                a
              ), a && f & 4 && _u(r, o);
              break;
            case 13:
              $e(
                r,
                o,
                a
              ), a && f & 4 && Su(r, o);
              break;
            case 22:
              o.memoizedState === null && $e(
                r,
                o,
                a
              ), Vl(o, o.return);
              break;
            case 30:
              break;
            default:
              $e(
                r,
                o,
                a
              );
          }
          e = e.sibling;
        }
      }
      function xr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Ol(a));
      }
      function wr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ol(t));
      }
      function Ue(t, e, a, n) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            ku(
              t,
              e,
              a,
              n
            ), e = e.sibling;
      }
      function ku(t, e, a, n) {
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
            ), r & 2048 && Ql(9, e);
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
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ol(t)));
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
                var o = e.memoizedProps, f = o.id, g = o.onPostCommit;
                typeof g == "function" && g(
                  f,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (O) {
                yt(e, e.return, O);
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
            o = e.stateNode, f = e.alternate, e.memoizedState !== null ? o._visibility & 2 ? Ue(
              t,
              e,
              a,
              n
            ) : Kl(
              t,
              e
            ) : o._visibility & 2 ? Ue(
              t,
              e,
              a,
              n
            ) : (o._visibility |= 2, nl(
              t,
              e,
              a,
              n,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && xr(f, e);
            break;
          case 24:
            Ue(
              t,
              e,
              a,
              n
            ), r & 2048 && wr(e.alternate, e);
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
      function nl(t, e, a, n, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var o = t, f = e, g = a, O = n, B = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              nl(
                o,
                f,
                g,
                O,
                r
              ), Ql(8, f);
              break;
            case 23:
              break;
            case 22:
              var X = f.stateNode;
              f.memoizedState !== null ? X._visibility & 2 ? nl(
                o,
                f,
                g,
                O,
                r
              ) : Kl(
                o,
                f
              ) : (X._visibility |= 2, nl(
                o,
                f,
                g,
                O,
                r
              )), r && B & 2048 && xr(
                f.alternate,
                f
              );
              break;
            case 24:
              nl(
                o,
                f,
                g,
                O,
                r
              ), r && B & 2048 && wr(f.alternate, f);
              break;
            default:
              nl(
                o,
                f,
                g,
                O,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Kl(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, n = e, r = n.flags;
            switch (n.tag) {
              case 22:
                Kl(a, n), r & 2048 && xr(
                  n.alternate,
                  n
                );
                break;
              case 24:
                Kl(a, n), r & 2048 && wr(
                  n.alternate,
                  n
                );
                break;
              default:
                Kl(a, n);
            }
            e = e.sibling;
          }
      }
      function Ba(t, e, a) {
        if (t.subtreeFlags & zl)
          for (t = t.child; t !== null; )
            Nu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Nu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ba(
              t,
              e,
              a
            ), t.flags & zl)
              if (t.memoizedState !== null)
                yp(
                  a,
                  Be,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var n = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Gr(r, t)) && dc(a, n, r, t);
              }
            break;
          case 5:
            Ba(
              t,
              e,
              a
            ), t.flags & zl && (n = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Gr(r, t)) && dc(a, n, r, t));
            break;
          case 3:
          case 4:
            De ? (n = Be, Be = Kr(
              t.stateNode.containerInfo
            ), Ba(
              t,
              e,
              a
            ), Be = n) : Ba(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (n = t.alternate, n !== null && n.memoizedState !== null ? (n = zl, zl = 16777216, Ba(
              t,
              e,
              a
            ), zl = n) : Ba(
              t,
              e,
              a
            ));
            break;
          default:
            Ba(
              t,
              e,
              a
            );
        }
      }
      function Tu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Xl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var n = e[a];
              Lt = n, ju(
                n,
                t
              );
            }
          Tu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Cu(t), t = t.sibling;
      }
      function Cu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Xl(t), t.flags & 2048 && ga(9, t, t.return);
            break;
          case 3:
            Xl(t);
            break;
          case 12:
            Xl(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Bn(t)) : Xl(t);
            break;
          default:
            Xl(t);
        }
      }
      function Bn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var n = e[a];
              Lt = n, ju(
                n,
                t
              );
            }
          Tu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ga(8, e, e.return), Bn(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Bn(e));
              break;
            default:
              Bn(e);
          }
          t = t.sibling;
        }
      }
      function ju(t, e) {
        for (; Lt !== null; ) {
          var a = Lt;
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
              Ol(a.memoizedState.cache);
          }
          if (n = a.child, n !== null) n.return = a, Lt = n;
          else
            t: for (a = t; Lt !== null; ) {
              n = Lt;
              var r = n.sibling, o = n.return;
              if (wu(n), n === a) {
                Lt = null;
                break t;
              }
              if (r !== null) {
                r.return = o, Lt = r;
                break t;
              }
              Lt = o;
            }
        }
      }
      function _r(t) {
        var e = lm(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = hm(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function Sr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case ii:
            if (t.type === e.value) return !0;
            break;
          case ri:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var n = t[a++], r = n.tag, o = t[a++], f = e[o];
                if (r !== 5 && r !== 26 && r !== 27 || !Wl(n)) {
                  for (; f != null && Sr(n, f); )
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
          case oi:
            if ((a === 5 || a === 26 || a === 27) && bm(t.stateNode, e.value))
              return !0;
            break;
          case ui:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = vm(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case si:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function zr(t) {
        switch (t.$$typeof) {
          case ii:
            return "<" + (M(t.value) || "Unknown") + ">";
          case ri:
            return ":has(" + (zr(t) || "") + ")";
          case oi:
            return '[role="' + t.value + '"]';
          case ui:
            return '"' + t.value + '"';
          case si:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function Mu(t, e) {
        var a = [];
        t = [t, 0];
        for (var n = 0; n < t.length; ) {
          var r = t[n++], o = r.tag, f = t[n++], g = e[f];
          if (o !== 5 && o !== 26 && o !== 27 || !Wl(r)) {
            for (; g != null && Sr(r, g); )
              f++, g = e[f];
            if (f === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return a;
      }
      function Er(t, e) {
        if (!Ll) throw Error(c(363));
        t = _r(t), t = Mu(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var n = t[a++], r = n.tag;
          if (r === 5 || r === 26 || r === 27)
            Wl(n) || e.push(n.stateNode);
          else
            for (n = n.child; n !== null; )
              t.push(n), n = n.sibling;
        }
        return e;
      }
      function pe() {
        return (pt & 2) !== 0 && gt !== 0 ? gt & -gt : at.T !== null ? Ri() : im();
      }
      function Au() {
        if (we === 0)
          if ((gt & 536870912) === 0 || vt) {
            var t = Zn;
            Zn <<= 1, (Zn & 3932160) === 0 && (Zn = 262144), we = t;
          } else we = 536870912;
        return t = ye.current, t !== null && (t.flags |= 32), we;
      }
      function se(t, e, a) {
        (t === kt && (_t === 2 || _t === 9) || t.cancelPendingCommit !== null) && (il(t, 0), va(
          t,
          gt,
          we,
          !1
        )), R(t, a), ((pt & 2) === 0 || t !== kt) && (t === kt && ((pt & 2) === 0 && (La |= a), Rt === 4 && va(
          t,
          gt,
          we,
          !1
        )), Ye(t));
      }
      function Ou(t, e, a) {
        if ((pt & 6) !== 0) throw Error(c(327));
        var n = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || v(t, e), r = n ? Uf(t, e) : Nr(t, e, !0), o = n;
        do {
          if (r === 0) {
            El && !n && va(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, o && !Rf(a)) {
              r = Nr(t, e, !1), o = !1;
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
                  var g = t;
                  r = nn;
                  var O = ne && g.current.memoizedState.isDehydrated;
                  if (O && (il(g, f).flags |= 256), f = Nr(
                    g,
                    f,
                    !1
                  ), f !== 2) {
                    if (so && !O) {
                      g.errorRecoveryDisabledLanes |= o, La |= o, r = 4;
                      break t;
                    }
                    o = de, de = r, o !== null && (de === null ? de = o : de.push.apply(
                      de,
                      o
                    ));
                  }
                  r = f;
                }
                if (o = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              il(t, 0), va(t, e, 0, !0);
              break;
            }
            t: {
              switch (n = t, o = r, o) {
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
              if ((e & 62914560) === e && (r = ci + 300 - ue(), 10 < r)) {
                if (va(
                  n,
                  e,
                  we,
                  !za
                ), U(n, 0, !0) !== 0) break t;
                ra = e, n.timeoutHandle = em(
                  Ru.bind(
                    null,
                    n,
                    a,
                    de,
                    di,
                    co,
                    e,
                    we,
                    La,
                    kl,
                    za,
                    o,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Ru(
                n,
                a,
                de,
                di,
                co,
                e,
                we,
                La,
                kl,
                za,
                o,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Ye(t);
      }
      function Ru(t, e, a, n, r, o, f, g, O, B, X, Q, Z, ct) {
        if (t.timeoutHandle = Ya, Q = e.subtreeFlags, Q & 8192 || (Q & 16785408) === 16785408) {
          Q = cm(), Nu(
            e,
            o,
            Q
          );
          var ee = (o & 62914560) === o ? ci - ue() : (o & 4194048) === o ? qc - ue() : 0;
          if (ee = dm(
            Q,
            ee
          ), ee !== null) {
            ra = o, t.cancelPendingCommit = ee(
              Vu.bind(
                null,
                t,
                e,
                o,
                a,
                n,
                r,
                f,
                g,
                O,
                X,
                Q,
                null,
                Z,
                ct
              )
            ), va(t, o, f, !B);
            return;
          }
        }
        Vu(
          t,
          e,
          o,
          a,
          n,
          r,
          f,
          g,
          O
        );
      }
      function Rf(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var n = 0; n < a.length; n++) {
              var r = a[n], o = r.getSnapshot;
              r = r.value;
              try {
                if (!be(o(), r)) return !1;
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
        e &= ~uo, e &= ~La, t.suspendedLanes |= e, t.pingedLanes &= ~e, n && (t.warmLanes |= e), n = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var o = 31 - ge(r), f = 1 << o;
          n[o] = -1, r &= ~f;
        }
        a !== 0 && w(t, a, e);
      }
      function Hu() {
        return (pt & 6) === 0 ? (al(0), !1) : !0;
      }
      function kr() {
        if (ht !== null) {
          if (_t === 0)
            var t = ht.return;
          else
            t = ht, aa = Qa = null, Ji(t), yl = null, tn = 0, t = ht;
          for (; t !== null; )
            mu(t.alternate, t), t = t.return;
          ht = null;
        }
      }
      function il(t, e) {
        var a = t.timeoutHandle;
        a !== Ya && (t.timeoutHandle = Ya, am(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, kr(), kt = t, ht = a = Pe(t.current, null), gt = e, _t = 0, xe = null, za = !1, El = v(t, e), so = !1, kl = we = uo = La = Ea = Rt = 0, de = nn = null, co = !1, (e & 8) !== 0 && (e |= e & 32);
        var n = t.entangledLanes;
        if (n !== 0)
          for (t = t.entanglements, n &= e; 0 < n; ) {
            var r = 31 - ge(n), o = 1 << r;
            e |= t[r], n &= ~o;
          }
        return ia = e, xn(), a;
      }
      function Uu(t, e) {
        dt = null, at.H = an, e === bl || e === ti ? (e = as(), _t = 3) : e === to ? (e = as(), _t = 4) : _t = e === io ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, xe = e, ht === null && (Rt = 1, jn(
          t,
          st(e, t.current)
        ));
      }
      function Du() {
        var t = ye.current;
        return t === null ? !0 : (gt & 4194048) === gt ? Ce === null : (gt & 62914560) === gt || (gt & 536870912) !== 0 ? t === Ce : !1;
      }
      function Bu() {
        var t = at.H;
        return at.H = an, t === null ? an : t;
      }
      function qu() {
        var t = at.A;
        return at.A = Rp, t;
      }
      function qn() {
        Rt = 4, za || (gt & 4194048) !== gt && ye.current !== null || (El = !0), (Ea & 134217727) === 0 && (La & 134217727) === 0 || kt === null || va(
          kt,
          gt,
          we,
          !1
        );
      }
      function Nr(t, e, a) {
        var n = pt;
        pt |= 2;
        var r = Bu(), o = qu();
        (kt !== t || gt !== e) && (di = null, il(t, e)), e = !1;
        var f = Rt;
        t: do
          try {
            if (_t !== 0 && ht !== null) {
              var g = ht, O = xe;
              switch (_t) {
                case 8:
                  kr(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ye.current === null && (e = !0);
                  var B = _t;
                  if (_t = 0, xe = null, rl(t, g, O, B), a && El) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  B = _t, _t = 0, xe = null, rl(t, g, O, B);
              }
            }
            Hf(), f = Rt;
            break;
          } catch (X) {
            Uu(t, X);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Qa = null, pt = n, at.H = r, at.A = o, ht === null && (kt = null, gt = 0, xn()), f;
      }
      function Hf() {
        for (; ht !== null; ) Yu(ht);
      }
      function Uf(t, e) {
        var a = pt;
        pt |= 2;
        var n = Bu(), r = qu();
        kt !== t || gt !== e ? (di = null, rn = ue() + 500, il(t, e)) : El = v(
          t,
          e
        );
        t: do
          try {
            if (_t !== 0 && ht !== null) {
              e = ht;
              var o = xe;
              e: switch (_t) {
                case 1:
                  _t = 0, xe = null, rl(t, e, o, 1);
                  break;
                case 2:
                case 9:
                  if (ts(o)) {
                    _t = 0, xe = null, Gu(e);
                    break;
                  }
                  e = function() {
                    _t !== 2 && _t !== 9 || kt !== t || (_t = 7), Ye(t);
                  }, o.then(e, e);
                  break t;
                case 3:
                  _t = 7;
                  break t;
                case 4:
                  _t = 5;
                  break t;
                case 7:
                  ts(o) ? (_t = 0, xe = null, Gu(e)) : (_t = 0, xe = null, rl(t, e, o, 7));
                  break;
                case 5:
                  var f = null;
                  switch (ht.tag) {
                    case 26:
                      f = ht.memoizedState;
                    case 5:
                    case 27:
                      var g = ht, O = g.type, B = g.pendingProps;
                      if (f ? kc(f) : cc(g.stateNode, O, B)) {
                        _t = 0, xe = null;
                        var X = g.sibling;
                        if (X !== null) ht = X;
                        else {
                          var Q = g.return;
                          Q !== null ? (ht = Q, Yn(Q)) : ht = null;
                        }
                        break e;
                      }
                  }
                  _t = 0, xe = null, rl(t, e, o, 5);
                  break;
                case 6:
                  _t = 0, xe = null, rl(t, e, o, 6);
                  break;
                case 8:
                  kr(), Rt = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            Df();
            break;
          } catch (Z) {
            Uu(t, Z);
          }
        while (!0);
        return aa = Qa = null, at.H = n, at.A = r, pt = a, ht !== null ? 0 : (kt = null, gt = 0, xn(), Rt);
      }
      function Df() {
        for (; ht !== null && !Sp(); )
          Yu(ht);
      }
      function Yu(t) {
        var e = su(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Yn(t) : ht = e;
      }
      function Gu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = au(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              gt
            );
            break;
          case 11:
            e = au(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              gt
            );
            break;
          case 5:
            Ji(e);
          default:
            mu(a, e), e = ht = Iu(e, ia), e = su(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Yn(t) : ht = e;
      }
      function rl(t, e, a, n) {
        aa = Qa = null, Ji(e), yl = null, tn = 0;
        var r = e.return;
        try {
          if (Nf(
            t,
            r,
            e,
            a,
            gt
          )) {
            Rt = 1, jn(
              t,
              st(a, t.current)
            ), ht = null;
            return;
          }
        } catch (o) {
          if (r !== null) throw ht = r, o;
          Rt = 1, jn(
            t,
            st(a, t.current)
          ), ht = null;
          return;
        }
        e.flags & 32768 ? (vt || n === 1 ? t = !0 : El || (gt & 536870912) !== 0 ? t = !1 : (za = t = !0, (n === 2 || n === 9 || n === 3 || n === 6) && (n = ye.current, n !== null && n.tag === 13 && (n.flags |= 16384))), Qu(e, t)) : Yn(e);
      }
      function Yn(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Qu(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = jf(
            e.alternate,
            e,
            ia
          );
          if (a !== null) {
            ht = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            ht = e;
            return;
          }
          ht = e = t;
        } while (e !== null);
        Rt === 0 && (Rt = 5);
      }
      function Qu(t, e) {
        do {
          var a = Mf(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, ht = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            ht = t;
            return;
          }
          ht = t = a;
        } while (t !== null);
        Rt = 6, ht = null;
      }
      function Vu(t, e, a, n, r, o, f, g, O) {
        t.cancelPendingCommit = null;
        do
          Zl();
        while (Kt !== 0);
        if ((pt & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (o = e.lanes | e.childLanes, o |= eo, z(
            t,
            a,
            o,
            f,
            g,
            O
          ), t === kt && (ht = kt = null, gt = 0), Nl = e, Na = t, ra = a, fo = o, mo = r, Yc = n, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Gf(Jr, function() {
            return Lu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), n = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || n) {
            n = at.T, at.T = null, r = ea(), Jt(2), f = pt, pt |= 4;
            try {
              Af(t, e, a);
            } finally {
              pt = f, Jt(r), at.T = n;
            }
          }
          Kt = 1, Ku(), Xu(), Zu();
        }
      }
      function Ku() {
        if (Kt === 1) {
          Kt = 0;
          var t = Na, e = Nl, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = at.T, at.T = null;
            var n = ea();
            Jt(2);
            var r = pt;
            pt |= 4;
            try {
              zu(e, t), Pf(t.containerInfo);
            } finally {
              pt = r, Jt(n), at.T = a;
            }
          }
          t.current = e, Kt = 2;
        }
      }
      function Xu() {
        if (Kt === 2) {
          Kt = 0;
          var t = Na, e = Nl, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = at.T, at.T = null;
            var n = ea();
            Jt(2);
            var r = pt;
            pt |= 4;
            try {
              xu(t, e.alternate, e);
            } finally {
              pt = r, Jt(n), at.T = a;
            }
          }
          Kt = 3;
        }
      }
      function Zu() {
        if (Kt === 4 || Kt === 3) {
          Kt = 0, zp();
          var t = Na, e = Nl, a = ra, n = Yc;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Kt = 5 : (Kt = 0, Nl = Na = null, Ju(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (ka = null), Et(a), e = e.stateNode, ve && typeof ve.onCommitFiberRoot == "function")
            try {
              ve.onCommitFiberRoot(
                Fl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (n !== null) {
            e = at.T, r = ea(), Jt(2), at.T = null;
            try {
              for (var o = t.onRecoverableError, f = 0; f < n.length; f++) {
                var g = n[f];
                o(g.value, {
                  componentStack: g.stack
                });
              }
            } finally {
              at.T = e, Jt(r);
            }
          }
          (ra & 3) !== 0 && Zl(), Ye(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === po ? on++ : (on = 0, po = t) : on = 0, ne && sp(), al(0);
        }
      }
      function Ju(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ol(e)));
      }
      function Zl() {
        return Ku(), Xu(), Zu(), Lu();
      }
      function Lu() {
        if (Kt !== 5) return !1;
        var t = Na, e = fo;
        fo = 0;
        var a = Et(ra), n = 32 > a ? 32 : a;
        a = at.T;
        var r = ea();
        try {
          Jt(n), at.T = null, n = mo, mo = null;
          var o = Na, f = ra;
          if (Kt = 0, Nl = Na = null, ra = 0, (pt & 6) !== 0)
            throw Error(c(331));
          var g = pt;
          if (pt |= 4, Cu(o.current), ku(
            o,
            o.current,
            f,
            n
          ), pt = g, al(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot(Fl, o);
            } catch {
            }
          return !0;
        } finally {
          Jt(r), at.T = a, Ju(t, e);
        }
      }
      function Wu(t, e, a) {
        e = st(a, e), e = ir(t.stateNode, e, 2), t = ma(t, e, 2), t !== null && (R(t, 2), Ye(t));
      }
      function yt(t, e, a) {
        if (t.tag === 3)
          Wu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Wu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var n = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof n.componentDidCatch == "function" && (ka === null || !ka.has(n))) {
                t = st(a, t), a = Ls(2), n = ma(e, a, 2), n !== null && (Ws(
                  a,
                  n,
                  e,
                  t
                ), R(n, 2), Ye(n));
                break;
              }
            }
            e = e.return;
          }
      }
      function Tr(t, e, a) {
        var n = t.pingCache;
        if (n === null) {
          n = t.pingCache = new Hp();
          var r = /* @__PURE__ */ new Set();
          n.set(e, r);
        } else
          r = n.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), n.set(e, r));
        r.has(a) || (so = !0, r.add(a), t = Bf.bind(null, t, e, a), e.then(t, t));
      }
      function Bf(t, e, a) {
        var n = t.pingCache;
        n !== null && n.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, kt === t && (gt & a) === a && (Rt === 4 || Rt === 3 && (gt & 62914560) === gt && 300 > ue() - ci ? (pt & 2) === 0 && il(t, 0) : uo |= a, kl === gt && (kl = 0)), Ye(t);
      }
      function Fu(t, e) {
        e === 0 && (e = D()), t = Ha(t, e), t !== null && (R(t, e), Ye(t));
      }
      function qf(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Fu(t, a);
      }
      function Yf(t, e) {
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
        n !== null && n.delete(e), Fu(t, a);
      }
      function Gf(t, e) {
        return Ln(t, e);
      }
      function Qf(t, e, a, n) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = n, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Cr(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function Pe(t, e) {
        var a = t.alternate;
        return a === null ? (a = u(
          t.tag,
          e,
          t.key,
          t.mode
        ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
      }
      function Iu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Gn(t, e, a, n, r, o) {
        var f = 0;
        if (n = t, typeof t == "function") Cr(t) && (f = 1);
        else if (typeof t == "string")
          f = De && Vt ? xc(t, a, Pt.current) ? 26 : Cc(t) ? 27 : 5 : De ? xc(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Cc(t) ? 27 : 5;
        else
          t: switch (t) {
            case qr:
              return t = u(31, a, e, r), t.elementType = qr, t.lanes = o, t;
            case sl:
              return qa(
                a.children,
                r,
                o,
                e
              );
            case nc:
              f = 8, r |= 24;
              break;
            case Rr:
              return t = u(12, a, e, r | 2), t.elementType = Rr, t.lanes = o, t;
            case Ur:
              return t = u(13, a, e, r), t.elementType = Ur, t.lanes = o, t;
            case Dr:
              return t = u(19, a, e, r), t.elementType = Dr, t.lanes = o, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ba:
                    f = 10;
                    break t;
                  case ic:
                    f = 9;
                    break t;
                  case Hr:
                    f = 11;
                    break t;
                  case Br:
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
        return e = u(f, a, e, r), e.elementType = t, e.type = n, e.lanes = o, e;
      }
      function qa(t, e, a, n) {
        return t = u(7, t, n, e), t.lanes = a, t;
      }
      function jr(t, e, a) {
        return t = u(6, t, null, e), t.lanes = a, t;
      }
      function $u(t) {
        var e = u(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Mr(t, e, a) {
        return e = u(
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
      function Vf(t, e, a, n, r, o, f, g, O) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Ya, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = T(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = T(0), this.hiddenUpdates = T(null), this.identifierPrefix = n, this.onUncaughtError = r, this.onCaughtError = o, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = O, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Pu(t, e, a, n, r, o, f, g, O, B, X, Q) {
        return t = new Vf(
          t,
          e,
          a,
          f,
          O,
          B,
          X,
          Q,
          g
        ), e = 1, o === !0 && (e |= 24), o = u(3, null, null, e), t.current = o, o.stateNode = t, e = Oi(), e.refCount++, t.pooledCache = e, e.refCount++, o.memoizedState = {
          element: n,
          isDehydrated: a,
          cache: e
        }, Di(o), t;
      }
      function tc(t) {
        return t ? (t = fl, t) : fl;
      }
      function ec(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = m(e), t = t !== null ? y(t) : null, t === null ? null : Jl(t.stateNode);
      }
      function ac(t, e, a, n, r, o) {
        r = tc(r), n.context === null ? n.context = r : n.pendingContext = r, n = fa(e), n.payload = { element: a }, o = o === void 0 ? null : o, o !== null && (n.callback = o), a = ma(t, n, e), a !== null && (se(a, t, e), Hl(a, t, e));
      }
      function lc(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Ar(t, e) {
        lc(t, e), (t = t.alternate) && lc(t, e);
      }
      var mt = {}, Kf = jd(), he = lh(), Or = Object.assign, Xf = Symbol.for("react.element"), Qn = Symbol.for("react.transitional.element"), ol = Symbol.for("react.portal"), sl = Symbol.for("react.fragment"), nc = Symbol.for("react.strict_mode"), Rr = Symbol.for("react.profiler"), ic = Symbol.for("react.consumer"), ba = Symbol.for("react.context"), Hr = Symbol.for("react.forward_ref"), Ur = Symbol.for("react.suspense"), Dr = Symbol.for("react.suspense_list"), Br = Symbol.for("react.memo"), ya = Symbol.for("react.lazy"), qr = Symbol.for("react.activity"), Zf = Symbol.for("react.memo_cache_sentinel"), rc = Symbol.iterator, Jf = Symbol.for("react.client.reference"), Vn = Array.isArray, at = Kf.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Lf = i.rendererVersion, Wf = i.rendererPackageName, oc = i.extraDevToolsConfig, Jl = i.getPublicInstance, Ff = i.getRootHostContext, If = i.getChildHostContext, $f = i.prepareForCommit, Pf = i.resetAfterCommit, tm = i.createInstance;
      i.cloneMutableInstance;
      var Yr = i.appendInitialChild, sc = i.finalizeInitialChildren, Kn = i.shouldSetTextContent, uc = i.createTextInstance;
      i.cloneMutableTextInstance;
      var em = i.scheduleTimeout, am = i.cancelTimeout, Ya = i.noTimeout, ta = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var le = i.supportsMutation, Qe = i.supportsPersistence, ne = i.supportsHydration, lm = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var nm = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Jt = i.setCurrentUpdatePriority, ea = i.getCurrentUpdatePriority, im = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var rm = i.shouldAttemptEagerTransition, om = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var sm = i.maySuspendCommit, um = i.maySuspendCommitOnUpdate, Gr = i.maySuspendCommitInSyncRender, cc = i.preloadInstance, cm = i.startSuspendingCommit, dc = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var dm = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var ul = i.NotPendingTransition, Ga = i.HostTransitionContext, fm = i.resetFormInstance;
      i.bindToConsole;
      var mm = i.supportsMicrotasks, pm = i.scheduleMicrotask, Ll = i.supportsTestSelectors, hm = i.findFiberRoot, gm = i.getBoundingRect, vm = i.getTextContent, Wl = i.isHiddenSubtree, bm = i.matchAccessibilityRole, ym = i.setFocusIfFocusable, xm = i.setupIntersectionObserver, wm = i.appendChild, _m = i.appendChildToContainer, Sm = i.commitTextUpdate, zm = i.commitMount, Em = i.commitUpdate, km = i.insertBefore, Nm = i.insertInContainerBefore, Tm = i.removeChild, Cm = i.removeChildFromContainer, fc = i.resetTextContent, jm = i.hideInstance, Mm = i.hideTextInstance, Am = i.unhideInstance, Om = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var Rm = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var Hm = i.cloneInstance, mc = i.createContainerChildSet, pc = i.appendChildToContainerChildSet, Um = i.finalizeContainerChildren, hc = i.replaceContainerChildren, gc = i.cloneHiddenInstance, vc = i.cloneHiddenTextInstance, Qr = i.isSuspenseInstancePending, Vr = i.isSuspenseInstanceFallback, Dm = i.getSuspenseInstanceFallbackErrorDetails, Bm = i.registerSuspenseInstanceRetry, qm = i.canHydrateFormStateMarker, Ym = i.isFormStateMarkerMatching, bc = i.getNextHydratableSibling, Gm = i.getNextHydratableSiblingAfterSingleton, Qm = i.getFirstHydratableChild, Vm = i.getFirstHydratableChildWithinContainer, Km = i.getFirstHydratableChildWithinActivityInstance, Xm = i.getFirstHydratableChildWithinSuspenseInstance, Zm = i.getFirstHydratableChildWithinSingleton, Jm = i.canHydrateInstance, Lm = i.canHydrateTextInstance, Wm = i.canHydrateActivityInstance, Fm = i.canHydrateSuspenseInstance, Im = i.hydrateInstance, $m = i.hydrateTextInstance, Pm = i.hydrateActivityInstance, tp = i.hydrateSuspenseInstance, ep = i.getNextHydratableInstanceAfterActivityInstance, ap = i.getNextHydratableInstanceAfterSuspenseInstance, lp = i.commitHydratedInstance, np = i.commitHydratedContainer, ip = i.commitHydratedActivityInstance, rp = i.commitHydratedSuspenseInstance, op = i.finalizeHydratedChildren, sp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var up = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var cp = i.clearSuspenseBoundaryFromContainer, dp = i.hideDehydratedBoundary, fp = i.unhideDehydratedBoundary, yc = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var mp = i.validateHydratableInstance, pp = i.validateHydratableTextInstance, De = i.supportsResources, xc = i.isHostHoistableType, Kr = i.getHoistableRoot, wc = i.getResource, _c = i.acquireResource, Sc = i.releaseResource, hp = i.hydrateHoistable, zc = i.mountHoistable, Ec = i.unmountHoistable, gp = i.createHoistableInstance, vp = i.prepareToCommitHoistables, bp = i.mayResourceSuspendCommit, kc = i.preloadResource, yp = i.suspendResource, Vt = i.supportsSingletons, Nc = i.resolveSingletonInstance, xp = i.acquireSingletonInstance, Tc = i.releaseSingletonInstance, Cc = i.isHostSingletonType, cl = i.isSingletonScope, Xr = [], dl = -1, fl = {}, ge = Math.clz32 ? Math.clz32 : x, wp = Math.log, _p = Math.LN2, Xn = 256, Zn = 262144, Jn = 4194304, Ln = he.unstable_scheduleCallback, Zr = he.unstable_cancelCallback, Sp = he.unstable_shouldYield, zp = he.unstable_requestPaint, ue = he.unstable_now, jc = he.unstable_ImmediatePriority, Ep = he.unstable_UserBlockingPriority, Jr = he.unstable_NormalPriority, kp = he.unstable_IdlePriority, Np = he.log, Tp = he.unstable_setDisableYieldValue, Fl = null, ve = null, be = typeof Object.is == "function" ? Object.is : Ft, Mc = typeof reportError == "function" ? reportError : function(t) {
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
      }, Cp = Object.prototype.hasOwnProperty, Lr, Ac, Wr = !1, Oc = /* @__PURE__ */ new WeakMap(), ml = [], pl = 0, Wn = null, Il = 0, Ee = [], ke = 0, xa = null, Ve = 1, Ke = "", Pt = h(null), $l = h(null), wa = h(null), Fn = h(null), te = null, Ct = null, vt = !1, _a = null, Ne = !1, Fr = Error(c(519)), In = h(null), Qa = null, aa = null, jp = typeof AbortController < "u" ? AbortController : function() {
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
      }, Mp = he.unstable_scheduleCallback, Ap = he.unstable_NormalPriority, jt = {
        $$typeof: ba,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, $n = null, hl = null, Ir = !1, Pn = !1, $r = !1, Va = 0, Pl = null, Pr = 0, gl = 0, vl = null, Rc = at.S;
      at.S = function(t, e) {
        qc = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && yf(t, e), Rc !== null && Rc(t, e);
      };
      var Ka = h(null), bl = Error(c(460)), to = Error(c(474)), ti = Error(c(542)), ei = { then: function() {
      } }, Xa = null, yl = null, tn = 0, Za = ns(!0), Hc = ns(!1), Te = [], xl = 0, eo = 0, Sa = !1, ao = !1, wl = h(null), ai = h(0), ye = h(null), Ce = null, Dt = h(0), la = 0, dt = null, zt = null, Bt = null, li = !1, _l = !1, Ja = !1, ni = 0, en = 0, Sl = null, Op = 0, an = {
        readContext: It,
        use: En,
        useCallback: Ot,
        useContext: Ot,
        useEffect: Ot,
        useImperativeHandle: Ot,
        useLayoutEffect: Ot,
        useInsertionEffect: Ot,
        useMemo: Ot,
        useReducer: Ot,
        useRef: Ot,
        useState: Ot,
        useDebugValue: Ot,
        useDeferredValue: Ot,
        useTransition: Ot,
        useSyncExternalStore: Ot,
        useId: Ot,
        useHostTransitionStatus: Ot,
        useFormState: Ot,
        useActionState: Ot,
        useOptimistic: Ot,
        useMemoCache: Ot,
        useCacheRefresh: Ot
      };
      an.useEffectEvent = Ot;
      var Uc = {
        readContext: It,
        use: En,
        useCallback: function(t, e) {
          return re().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Cs,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Nn(
            4194308,
            4,
            Os.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Nn(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Nn(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = re();
          e = e === void 0 ? null : e;
          var n = t();
          if (Ja) {
            Ht(!0);
            try {
              t();
            } finally {
              Ht(!1);
            }
          }
          return a.memoizedState = [n, e], n;
        },
        useReducer: function(t, e, a) {
          var n = re();
          if (a !== void 0) {
            var r = a(e);
            if (Ja) {
              Ht(!0);
              try {
                a(e);
              } finally {
                Ht(!1);
              }
            }
          } else r = e;
          return n.memoizedState = n.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, n.queue = t, t = t.dispatch = kf.bind(
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
          t = Ii(t);
          var e = t.queue, a = Qs.bind(
            null,
            dt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: tr,
        useDeferredValue: function(t, e) {
          var a = re();
          return er(a, t, e);
        },
        useTransition: function() {
          var t = Ii(!1);
          return t = Bs.bind(
            null,
            dt,
            t.queue,
            !0,
            !1
          ), re().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var n = dt, r = re();
          if (vt) {
            if (a === void 0)
              throw Error(c(407));
            a = a();
          } else {
            if (a = e(), kt === null)
              throw Error(c(349));
            (gt & 127) !== 0 || ms(n, e, a);
          }
          r.memoizedState = a;
          var o = { value: a, getSnapshot: e };
          return r.queue = o, Cs(hs.bind(null, n, o, t), [
            t
          ]), n.flags |= 2048, ll(
            9,
            { destroy: void 0 },
            ps.bind(
              null,
              n,
              o,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = re(), e = kt.identifierPrefix;
          if (vt) {
            var a = Ke, n = Ve;
            a = (n & ~(1 << 32 - ge(n) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ni++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Op++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: ar,
        useFormState: zs,
        useActionState: zs,
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
          return e.queue = a, e = lr.bind(
            null,
            dt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Li,
        useCacheRefresh: function() {
          return re().memoizedState = Ef.bind(
            null,
            dt
          );
        },
        useEffectEvent: function(t) {
          var e = re(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((pt & 2) !== 0)
              throw Error(c(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, lo = {
        readContext: It,
        use: En,
        useCallback: Hs,
        useContext: It,
        useEffect: Pi,
        useImperativeHandle: Rs,
        useInsertionEffect: Ms,
        useLayoutEffect: As,
        useMemo: Us,
        useReducer: kn,
        useRef: Ts,
        useState: function() {
          return kn(We);
        },
        useDebugValue: tr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Ds(
            a,
            zt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = kn(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Bl(t),
            e
          ];
        },
        useSyncExternalStore: fs,
        useId: Ys,
        useHostTransitionStatus: ar,
        useFormState: Es,
        useActionState: Es,
        useOptimistic: function(t, e) {
          var a = Ut();
          return bs(a, zt, t, e);
        },
        useMemoCache: Li,
        useCacheRefresh: Gs
      };
      lo.useEffectEvent = js;
      var Dc = {
        readContext: It,
        use: En,
        useCallback: Hs,
        useContext: It,
        useEffect: Pi,
        useImperativeHandle: Rs,
        useInsertionEffect: Ms,
        useLayoutEffect: As,
        useMemo: Us,
        useReducer: Fi,
        useRef: Ts,
        useState: function() {
          return Fi(We);
        },
        useDebugValue: tr,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return zt === null ? er(a, t, e) : Ds(
            a,
            zt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Fi(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Bl(t),
            e
          ];
        },
        useSyncExternalStore: fs,
        useId: Ys,
        useHostTransitionStatus: ar,
        useFormState: Ns,
        useActionState: Ns,
        useOptimistic: function(t, e) {
          var a = Ut();
          return zt !== null ? bs(a, zt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Li,
        useCacheRefresh: Gs
      };
      Dc.useEffectEvent = js;
      var no = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var n = pe(), r = fa(n);
          r.payload = e, a != null && (r.callback = a), e = ma(t, r, n), e !== null && (se(e, t, n), Hl(e, t, n));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var n = pe(), r = fa(n);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = ma(t, r, n), e !== null && (se(e, t, n), Hl(e, t, n));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = pe(), n = fa(a);
          n.tag = 2, e != null && (n.callback = e), e = ma(t, n, a), e !== null && (se(e, t, a), Hl(e, t, a));
        }
      }, io = Error(c(461)), qt = !1, ro = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, na = !1, Yt = !1, oo = !1, Bc = typeof WeakSet == "function" ? WeakSet : Set, Lt = null, Gt = null, ce = !1, Be = null, zl = 8192, Rp = {
        getCacheForType: function(t) {
          var e = It(jt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return It(jt).controller.signal;
        }
      }, ii = 0, ri = 1, oi = 2, si = 3, ui = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var ln = Symbol.for;
        ii = ln("selector.component"), ri = ln("selector.has_pseudo_class"), oi = ln("selector.role"), si = ln("selector.test_id"), ui = ln("selector.text");
      }
      var Hp = typeof WeakMap == "function" ? WeakMap : Map, pt = 0, kt = null, ht = null, gt = 0, _t = 0, xe = null, za = !1, El = !1, so = !1, ia = 0, Rt = 0, Ea = 0, La = 0, uo = 0, we = 0, kl = 0, nn = null, de = null, co = !1, ci = 0, qc = 0, rn = 1 / 0, di = null, ka = null, Kt = 0, Na = null, Nl = null, ra = 0, fo = 0, mo = null, Yc = null, on = 0, po = null;
      return mt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ha(t, 67108864);
          e !== null && se(e, t, 67108864), Ar(t, 67108864);
        }
      }, mt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = pe();
          e = ot(e);
          var a = Ha(t, e);
          a !== null && se(a, t, e), Ar(t, e);
        }
      }, mt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = E(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - ge(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ye(t), (pt & 6) === 0 && (rn = ue() + 500, al(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ha(t, 2), e !== null && se(e, t, 2), Hu(), Ar(t, 2);
        }
      }, mt.batchedUpdates = function(t, e) {
        return t(e);
      }, mt.createComponentSelector = function(t) {
        return { $$typeof: ii, value: t };
      }, mt.createContainer = function(t, e, a, n, r, o, f, g, O, B) {
        return Pu(
          t,
          e,
          !1,
          null,
          a,
          n,
          o,
          null,
          f,
          g,
          O,
          B
        );
      }, mt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ri, value: t };
      }, mt.createHydrationContainer = function(t, e, a, n, r, o, f, g, O, B, X, Q, Z, ct) {
        return t = Pu(
          a,
          n,
          !0,
          t,
          r,
          o,
          g,
          ct,
          O,
          B,
          X,
          Q
        ), t.context = tc(null), a = t.current, n = pe(), n = ot(n), r = fa(n), r.callback = e ?? null, ma(a, r, n), e = n, t.current.lanes = e, R(t, e), Ye(t), t;
      }, mt.createPortal = function(t, e, a) {
        var n = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ol,
          key: n == null ? null : "" + n,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, mt.createRoleSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, mt.createTestNameSelector = function(t) {
        return { $$typeof: si, value: t };
      }, mt.createTextSelector = function(t) {
        return { $$typeof: ui, value: t };
      }, mt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, mt.defaultOnRecoverableError = function(t) {
        Mc(t);
      }, mt.defaultOnUncaughtError = function(t) {
        Mc(t);
      }, mt.deferredUpdates = function(t) {
        var e = at.T, a = ea();
        try {
          return Jt(32), at.T = null, t();
        } finally {
          Jt(a), at.T = e;
        }
      }, mt.discreteUpdates = function(t, e, a, n, r) {
        var o = at.T, f = ea();
        try {
          return Jt(2), at.T = null, t(e, a, n, r);
        } finally {
          Jt(f), at.T = o, pt === 0 && (rn = ue() + 500);
        }
      }, mt.findAllNodes = Er, mt.findBoundingRects = function(t, e) {
        if (!Ll) throw Error(c(363));
        e = Er(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(gm(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var n = a.x, r = n + a.width, o = a.y, f = o + a.height, g = e - 1; 0 <= g; g--)
            if (e !== g) {
              var O = t[g], B = O.x, X = B + O.width, Q = O.y, Z = Q + O.height;
              if (n >= B && o >= Q && r <= X && f <= Z) {
                t.splice(e, 1);
                break;
              } else if (n !== B || a.width !== O.width || Z < o || Q > f) {
                if (!(o !== Q || a.height !== O.height || X < n || B > r)) {
                  B > n && (O.width += B - n, O.x = n), X < r && (O.width = r - B), t.splice(e, 1);
                  break;
                }
              } else {
                Q > o && (O.height += Q - o, O.y = o), Z < f && (O.height = f - Q), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, mt.findHostInstance = ec, mt.findHostInstanceWithNoPortals = function(t) {
        return t = m(t), t = t !== null ? b(t) : null, t === null ? null : Jl(t.stateNode);
      }, mt.findHostInstanceWithWarning = function(t) {
        return ec(t);
      }, mt.flushPassiveEffects = Zl, mt.flushSyncFromReconciler = function(t) {
        var e = pt;
        pt |= 1;
        var a = at.T, n = ea();
        try {
          if (Jt(2), at.T = null, t)
            return t();
        } finally {
          Jt(n), at.T = a, pt = e, (pt & 6) === 0 && al(0);
        }
      }, mt.flushSyncWork = Hu, mt.focusWithin = function(t, e) {
        if (!Ll) throw Error(c(363));
        for (t = _r(t), e = Mu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], n = a.tag;
          if (!Wl(a)) {
            if ((n === 5 || n === 26 || n === 27) && ym(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, mt.getFindAllNodesFailureDescription = function(t, e) {
        if (!Ll) throw Error(c(363));
        var a = 0, n = [];
        t = [_r(t), 0];
        for (var r = 0; r < t.length; ) {
          var o = t[r++], f = o.tag, g = t[r++], O = e[g];
          if ((f !== 5 && f !== 26 && f !== 27 || !Wl(o)) && (Sr(o, O) && (n.push(zr(O)), g++, g > a && (a = g)), g < e.length))
            for (o = o.child; o !== null; )
              t.push(o, g), o = o.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(zr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (n.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, mt.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Jl(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, mt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Lf,
          rendererPackageName: Wf,
          currentDispatcherRef: at,
          reconcilerVersion: "19.2.0"
        };
        if (oc !== null && (t.rendererConfig = oc), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Fl = e.inject(t), ve = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, mt.isAlreadyRendering = function() {
        return (pt & 6) !== 0;
      }, mt.observeVisibleRects = function(t, e, a, n) {
        if (!Ll) throw Error(c(363));
        t = Er(t, e);
        var r = xm(
          t,
          a,
          n
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, mt.shouldError = function() {
        return null;
      }, mt.shouldSuspend = function() {
        return !1;
      }, mt.startHostTransition = function(t, e, a, n) {
        if (t.tag !== 5) throw Error(c(476));
        var r = qs(t).queue;
        Bs(
          t,
          r,
          e,
          ul,
          a === null ? s : function() {
            var o = qs(t);
            return o.next === null && (o = t.alternate.memoizedState), ql(
              t,
              o.next.queue,
              {},
              pe()
            ), a(n);
          }
        );
      }, mt.updateContainer = function(t, e, a, n) {
        var r = e.current, o = pe();
        return ac(
          r,
          o,
          t,
          e,
          a,
          n
        ), o;
      }, mt.updateContainerSync = function(t, e, a, n) {
        return ac(
          e.current,
          2,
          t,
          e,
          a,
          n
        ), 2;
      }, mt;
    }, l.exports.default = l.exports, Object.defineProperty(l.exports, "__esModule", { value: !0 });
  })(bo)), bo.exports;
}
var Ic;
function ih() {
  return Ic || (Ic = 1, vo.exports = nh()), vo.exports;
}
var rh = ih();
const oh = /* @__PURE__ */ qo(rh);
var wo = { exports: {} }, oa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var $c;
function sh() {
  return $c || ($c = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var Pc;
function uh() {
  return Pc || (Pc = 1, wo.exports = sh()), wo.exports;
}
var fn = uh();
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
const Md = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Eo = 16, Ad = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), ch = [
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
], td = {
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
}, dh = /* @__PURE__ */ new Set([
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
}, ko = ["font-size", "color", ...new Set([...Object.keys(Od), ...Object.keys(Rd)].filter((l) => l !== "font-size" && l !== "color"))], fh = new Set(ko);
function ie(l, i = " ") {
  const u = [];
  let s = 0, c = "";
  for (let d = 0; d < l.length; d++) {
    const p = l[d];
    if (p === "(" ? s++ : p === ")" && s--, s === 0 && (i === " " ? /\s/.test(p) : p === i)) {
      (c.trim() || i !== " ") && u.push(c.trim()), c = "";
      continue;
    }
    c += p;
  }
  return (c.trim() || i !== " " && u.length) && u.push(c.trim()), u;
}
function No(l, i, u = 0) {
  if (u > 32) return null;
  let s = "", c = 0;
  for (; ; ) {
    const d = l.indexOf("var(", c);
    if (d < 0)
      return s += l.slice(c), s;
    s += l.slice(c, d);
    let p = 1, m = d + 4;
    for (; m < l.length && p; m++)
      l[m] === "(" ? p++ : l[m] === ")" && p--;
    const y = l.slice(d + 4, m - 1), b = ie(y, ","), H = b[0].trim(), M = b.length > 1 ? y.slice(y.indexOf(",") + 1).trim() : null;
    let h = i(H);
    if ((h == null || h === "initial") && (h = M), h == null) return null;
    const C = No(h, i, u + 1);
    if (C === null) return null;
    s += C, c = m;
  }
}
function mh(l) {
  const i = [], u = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, c = 0;
  for (; c < l.length; ) {
    if (u.lastIndex = c, s = u.exec(l), !s || s.index !== c) {
      if (/^\s+$/.test(l.slice(c))) break;
      return null;
    }
    c = u.lastIndex, s[1] !== void 0 ? i.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? i.push({ fn: s[3].toLowerCase() }) : s[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: s[5] ?? s[6] });
  }
  return i;
}
function Ml(l, i) {
  const u = mh(l.trim());
  if (!u) return null;
  let s = 0;
  const c = ({ num: h, unit: C }) => {
    switch (C) {
      case "":
        return { px: 0, pct: 0, num: h, unitless: !0 };
      case "px":
        return { px: h, pct: 0, num: 0 };
      case "rem":
        return { px: h * Eo, pct: 0, num: 0 };
      case "em":
        return { px: h * (i.fontSize ?? Eo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: h, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: h / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: h / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: h * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (h, C, S) => h && C ? { px: h.px + S * C.px, pct: h.pct + S * C.pct, num: h.num + S * C.num, unitless: h.unitless && C.unitless } : null, p = (h, C) => h ? { px: h.px * C, pct: h.pct * C, num: h.num * C, unitless: h.unitless } : null, m = (h) => h && h.unitless;
  function y() {
    const h = u[s++];
    if (!h) return null;
    if (h.num !== void 0) return c(h);
    if (h.op === "(") {
      const C = H();
      return u[s]?.op !== ")" ? null : (s++, C);
    }
    if (h.op === "-" || h.op === "+") {
      const C = y();
      return h.op === "-" ? p(C, -1) : C;
    }
    if (h.fn) {
      const C = [];
      for (; ; ) {
        C.push(H());
        const E = u[s++];
        if (!E) return null;
        if (E.op === ")") break;
        if (E.op !== ",") return null;
      }
      if (C.some((E) => !E)) return null;
      if (h.fn === "calc") return C[0];
      if (!(C.every((E) => !E.pct) || C.every((E) => !E.px && !E.num))) return null;
      const x = (E) => E.px + E.pct + E.num;
      return h.fn === "min" ? C.reduce((E, U) => x(U) < x(E) ? U : E) : h.fn === "max" ? C.reduce((E, U) => x(U) > x(E) ? U : E) : h.fn === "clamp" && C.length === 3 ? x(C[1]) < x(C[0]) ? C[0] : x(C[1]) > x(C[2]) ? C[2] : C[1] : null;
    }
    return null;
  }
  function b() {
    let h = y();
    for (; u[s] && (u[s].op === "*" || u[s].op === "/"); ) {
      const C = u[s++].op, S = y();
      if (!h || !S) return null;
      C === "*" ? h = m(S) ? p(h, S.num) : m(h) ? p(S, h.num) : null : h = m(S) && S.num !== 0 ? p(h, 1 / S.num) : null;
    }
    return h;
  }
  function H() {
    let h = b();
    for (; u[s] && (u[s].op === "+" || u[s].op === "-"); ) {
      const C = u[s++].op;
      h = d(h, b(), C === "-" ? -1 : 1);
    }
    return h;
  }
  const M = H();
  return s !== u.length || !M ? null : M;
}
function To(l, i) {
  const u = l.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(u))
    return u === "thin" ? { px: 1 } : u === "medium" ? { px: 3 } : u === "thick" ? { px: 5 } : u;
  const s = Ml(u, i);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: l.trim() } : s.pct && (s.px || s.num) ? { expr: l.trim() } : s.pct ? { pct: s.pct } : { px: ph(s.px) } : { expr: l.trim() };
}
const ph = (l) => Number.isFinite(l) ? l : l > 0 ? 34e37 : -34e37, pi = (l) => Math.max(0, Math.min(255, Math.round(l))).toString(16).padStart(2, "0"), hh = ([l, i, u, s]) => `#${pi(l)}${pi(i)}${pi(u)}${pi(s * 255)}`;
function ed(l) {
  const i = l.slice(1), u = i.length <= 4 ? i.split("").map((c) => c + c).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(u)) return null;
  const s = (c) => parseInt(u.slice(c, c + 2), 16);
  return [s(0), s(2), s(4), u.length === 8 ? s(6) / 255 : 1];
}
function wi(l, i) {
  const u = l.trim().toLowerCase();
  if (u === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(u);
  if (s) {
    const b = i(s[1]), H = b && ed(b);
    return H ? { rgba: H, token: s[1] } : null;
  }
  if (u.startsWith("#")) {
    const b = ed(u);
    return b ? { rgba: b, token: null } : null;
  }
  if (td[u]) return { rgba: [...td[u]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(u);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const b = ie(c[2], ",");
    if (b.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(b[0])) return null;
    const H = (Ht) => {
      const Ft = ie(Ht), Tt = Ft.findIndex((nt) => /%$/.test(nt)), G = Tt >= 0 ? parseFloat(Ft[Tt]) / 100 : null;
      return { color: wi(Ft.filter((nt, st) => st !== Tt).join(" "), i), pct: G };
    }, M = H(b[1]), h = H(b[2]);
    if (!M.color || !h.color || M.color === "currentcolor" || h.color === "currentcolor") return null;
    let C = M.pct, S = h.pct;
    C === null && S === null ? (C = 0.5, S = 0.5) : C === null ? C = 1 - S : S === null && (S = 1 - C);
    const x = C + S, E = x < 1 ? x : 1;
    C /= x, S /= x;
    const [U, v, N, D] = M.color.rgba, [T, R, z, w] = h.color.rgba, q = D * C + w * S, F = (Ht, Ft) => q === 0 ? 0 : (Ht * D * C + Ft * w * S) / q, ot = [F(U, T), F(v, R), F(N, z), q * E], Et = w === 0 ? M.color.token : D === 0 ? h.color.token : null;
    return { rgba: ot, token: Et };
  }
  const d = c[2].includes(",") ? ie(c[2], ",") : ie(c[2].replace("/", " / ")).filter((b) => b !== "/");
  if (d.length < 3) return null;
  const p = (b) => b.endsWith("%") ? parseFloat(b) / 100 * 255 : parseFloat(b), m = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), y = [p(d[0]), p(d[1]), p(d[2]), m];
  return y.some((b) => Number.isNaN(b)) ? null : { rgba: y, token: null };
}
const dn = ["top", "right", "bottom", "left"], gh = ["top-left", "top-right", "bottom-right", "bottom-left"], hi = (l) => [l[0], l[1] ?? l[0], l[2] ?? l[0], l[3] ?? l[1] ?? l[0]], ad = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Co(l, i) {
  const u = i.trim(), s = () => ie(u);
  switch (l) {
    case "padding":
    case "margin": {
      const c = hi(s());
      return dn.map((d, p) => [`${l}-${d}`, c[p]]);
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
      return [[`${l.split("-")[0]}-left`, u]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${l.split("-")[0]}-right`, u]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${l.split("-")[0]}-top`, u]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${l.split("-")[0]}-bottom`, u]];
    case "inset": {
      const c = hi(s());
      return dn.map((d, p) => [d, c[p]]);
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
      const c = l.split("-")[1], d = hi(s());
      return dn.map((p, m) => [`border-${p}-${c}`, d[m]]);
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
      const c = l === "border" ? dn : l === "border-inline" ? ["left", "right"] : l === "border-block" ? ["top", "bottom"] : l === "border-inline-start" ? ["left"] : l === "border-inline-end" ? ["right"] : [l.slice(7)];
      let d = "medium", p = "none", m = "currentcolor";
      if (u !== "none" && u !== "0")
        for (const y of s())
          ad.has(y) ? p = y : /^(thin|medium|thick|-?[\d.]|calc\()/.test(y) ? d = y : m = y;
      else u === "0" && (d = "0");
      return c.flatMap((y) => [[`border-${y}-width`, d], [`border-${y}-style`, p], [`border-${y}-color`, m]]);
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
      const c = hi(ie(u.split("/")[0]));
      return gh.map((d, p) => [`border-${d}-radius`, c[p]]);
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
      return u === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : wi(u, () => "#000000") ? [["background-color", u], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", u]];
    case "overflow": {
      const c = s();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = s();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return Co("gap", u);
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
      const c = s(), d = c.filter((m) => /^[\d.]+$/.test(m)), p = c.find((m) => !/^[\d.]+$/.test(m));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", p ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const c = [];
      for (const d of s()) c.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return c;
    }
    case "outline": {
      if (u === "none" || u === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let c = "medium", d = "none", p = "currentcolor";
      for (const m of s())
        ad.has(m) || m === "auto" ? d = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? c = m : p = m;
      return [["outline-width", c], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (u === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = ie(u, ","), d = c.map((m) => ie(m).find((y) => !/^[\d.]+m?s$/.test(y) && !/^(ease|linear|step|cubic)/.test(y)) ?? "all"), p = c.map((m) => ie(m).find((y) => /^[\d.]+m?s$/.test(y)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", p.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", s()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", u]];
    case "word-wrap":
      return [["overflow-wrap", u]];
    default:
      return [[l, u]];
  }
}
function vh(l, i) {
  return l ? ie(l, ",").some((u) => {
    let s = u.trim().toLowerCase(), c = !1;
    s.startsWith("not ") && (c = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const d = s.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const m = /^\((.+)\)$/.exec(p);
      if (!m) return !1;
      const y = m[1].trim(), b = /^([a-z-]+)\s*:\s*(.+)$/.exec(y);
      if (b) {
        const [, M, h] = b, C = (S) => {
          const x = To(S, { viewport: i });
          return typeof x == "object" && "px" in x ? x.px : NaN;
        };
        switch (M) {
          case "min-width":
            return i.width >= C(h);
          case "max-width":
            return i.width <= C(h);
          case "min-height":
            return i.height >= C(h);
          case "max-height":
            return i.height <= C(h);
          case "hover":
          case "any-hover":
            return h.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return h.trim() === "fine";
          case "prefers-reduced-motion":
            return h.trim() === "no-preference";
          case "prefers-color-scheme":
            return h.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const H = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(y);
      if (H) {
        const M = H[1] === "width" ? i.width : i.height, h = To(H[3], { viewport: i }), C = typeof h == "object" && "px" in h ? h.px : NaN;
        switch (H[2]) {
          case ">=":
            return M >= C;
          case "<=":
            return M <= C;
          case ">":
            return M > C;
          case "<":
            return M < C;
          default:
            return M === C;
        }
      }
      return !1;
    });
    return c ? !d : d;
  }) : !0;
}
function bh(l, i) {
  const u = i[i.length - 1].compound;
  return Yo(u)[0] ?? l;
}
function yh(l) {
  const i = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Set(), s = (c, d) => {
    c.forEach(({ compound: p }, m) => {
      const y = d && m === c.length - 1;
      for (const b of p.pseudos)
        if (Ad.has(b.name) && (y ? i : u).add(b.name), b.list && b.name !== "not") for (const H of b.list) s(H, y);
    });
  };
  return s(l, !0), { subject: i, ancestor: u };
}
function Yo(l) {
  const i = [...l.classes];
  for (const u of l.pseudos)
    if (!(u.name !== "is" && u.name !== "where"))
      for (const s of u.list) s.length === 1 && i.push(...Yo(s[0].compound));
  return i;
}
function xh(l, i) {
  const u = (s, c) => {
    s.forEach(({ compound: d }, p) => {
      const m = c && p === s.length - 1, y = d.pseudos.filter((b) => Ad.has(b.name)).map((b) => b.name);
      if (!m) for (const b of y) for (const H of Yo(d)) i.add(`${b}:${H}`);
      for (const b of d.pseudos) if (b.list && b.name !== "not") for (const H of b.list) u(H, m);
    });
  };
  u(l, !0);
}
class wh {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const u = (d, p) => {
      const m = p[p.length - 1].compound, y = m.classes.length ? `.${m.classes[0]}` : m.tag && m.tag !== "*" ? m.tag : "*";
      this.index.has(y) || this.index.set(y, []), this.index.get(y).push(d);
    };
    let s = 0;
    const c = (d, p) => {
      for (const [m, y, b, H] of d)
        for (const M of Ho(m)) {
          let h;
          try {
            h = Uo(M);
          } catch (x) {
            if (x instanceof Se) {
              this.skipped++;
              continue;
            }
            throw x;
          }
          const C = yh(h);
          xh(h, this.trackedStates);
          const S = { steps: h, media: y, layer: b, origin: p, order: s++, specificity: kd(h), decls: H, states: C, source: p === 0 ? `ua:${h[h.length - 1].compound.tag ?? "*"}` : bh(M, h) };
          this.rules.push(S), u(S, h);
        }
    };
    c(ch.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), c(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const u = [], s = /* @__PURE__ */ new Set(), c = (d) => {
      if (d) for (const p of d) s.has(p) || (s.add(p), u.push(p));
    };
    for (const d of i.classList) c(this.index.get(`.${d}`));
    return c(this.index.get(i.tagName)), c(this.index.get("*")), u;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, u) {
    for (const s of i.classList) if (this.trackedStates.has(`${u}:${s}`)) return !0;
    return !1;
  }
}
const _h = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function Sh(l) {
  if (!l || typeof l != "object") return [];
  const i = [];
  for (const [u, s] of Object.entries(l)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const c = u.startsWith("--") ? u : u.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof s == "number" && s !== 0 && !_h.has(c) && !c.startsWith("--") ? `${s}px` : String(s);
    i.push([c, d]);
  }
  return i;
}
function zh(l) {
  if (l.tagName !== "svg") return [];
  const i = [];
  for (const u of ["width", "height"]) {
    const s = l.getAttribute(u);
    s !== null && i.push([u, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return i;
}
const Eh = (l, i) => l.important - i.important || l.origin - i.origin || l.layer - i.layer || l.specificity[0] - i.specificity[0] || l.specificity[1] - i.specificity[1] || l.specificity[2] - i.specificity[2] || l.order - i.order;
class kh {
  constructor(i, { theme: u, viewport: s }) {
    this.sheet = i, this.theme = u, this.viewport = s, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, u) {
    const s = (c, d, p) => {
      if (d === "disabled") return !!c.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(c.tagName);
      if (d === "enabled") return !c.props?.disabled && ["button", "input", "select", "textarea"].includes(c.tagName);
      if (d === "checked") return !!c.props?.checked;
      if (u === "*") return !0;
      if (d === "focus-within") {
        const m = c.ownerDocument?.activeElement;
        return !!m && m !== c.ownerDocument.body && typeof c.contains == "function" && c.contains(m);
      }
      return p ? u.has(d) : d === "focus-visible" ? !!c.state?.focus : !!c.state?.[d];
    };
    return this.sheet.candidates(i).filter((c) => (!c.media || c.media.every((d) => vh(d, this.viewport))) && Nd(i, c.steps, { state: s }));
  }
  compute(i, u, s = /* @__PURE__ */ new Set()) {
    const c = this.matching(i, s), d = [];
    for (const z of c)
      for (const [w, q, F] of z.decls) d.push({ prop: w, value: q, important: F ? 1 : 0, origin: z.origin === 0 ? 0 : 2, layer: z.layer, specificity: z.specificity, order: z.order, source: z.source });
    for (const [z, w] of zh(i)) d.push({ prop: z, value: w, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${z}` });
    for (const [z, w] of Sh(i.props?.style)) d.push({ prop: z, value: w, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(Eh);
    const p = this.sheet.properties, m = Object.create(u?.customs ?? null), y = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new Map();
    for (const z of d) z.prop.startsWith("--") && b.set(z.prop, z.value);
    if (!u && this.theme) for (const z of Md) this.theme[z] && b.set(`--${z}`, `perchtoken(${z})`);
    const H = (z) => {
      if (y.has(z)) return y.get(z);
      const w = p[z];
      return w && !w.inherits ? w.initial ?? null : z in m ? m[z] : w?.initial ?? null;
    }, M = /* @__PURE__ */ new Set(), h = (z) => {
      if (!b.has(z)) return H(z);
      if (M.has(z)) return null;
      M.add(z);
      const w = No(b.get(z), h);
      return M.delete(z), b.delete(z), y.set(z, w), (!p[z] || p[z].inherits) && (m[z] = w), w;
    };
    for (const z of [...b.keys()]) h(z);
    const C = /* @__PURE__ */ new Map();
    for (const z of d) {
      if (z.prop.startsWith("--")) continue;
      const w = No(z.value, H);
      if (w === null) {
        for (const [q] of Co(z.prop, "unset")) C.set(q, { value: "unset", source: z.source, origin: z.origin });
        continue;
      }
      for (const [q, F] of Co(z.prop, w)) C.set(q, { value: F, source: z.source, origin: z.origin });
    }
    const S = {}, x = {}, E = /* @__PURE__ */ new Set(), U = /* @__PURE__ */ new Set(), v = u?.values, N = { fontSize: v?.["font-size"] ?? Eo, viewport: this.viewport }, D = (z, w) => {
      if (/currentcolor/i.test(w)) return this.parseValue(z, w, N, S, v);
      const q = `${z}\0${w}\0${N.fontSize}`;
      let F = this.parsed.get(q);
      return F === void 0 && this.parsed.set(q, F = this.parseValue(z, w, N, S, v)), F;
    }, T = C.size ? [...ko, ...[...C.keys()].filter((z) => !fh.has(z))] : ko;
    for (const z of T) {
      const w = C.get(z);
      let q = w?.value;
      const F = dh.has(z);
      if ((q === void 0 || q === "unset" || q === "revert" || q === "revert-layer") && (q = F ? "inherit" : "initial"), w && (x[z] = w.source, w.origin !== 0 && E.add(z)), q === "inherit" && v && z in v) {
        S[z] = v[z], U.add(z);
        continue;
      }
      (q === "inherit" || q === "initial") && (q = F ? Rd[z] : Od[z]), S[z] = D(z, q), z === "font-size" && (N.fontSize = S["font-size"]);
    }
    for (const z of dn) {
      const w = S[`border-${z}-style`];
      (w === "none" || w === "hidden") && (S[`border-${z}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const R = v?.display;
    return (R === "flex" || R === "inline-flex" || R === "grid" || R === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = ld(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = ld(S.display)), { values: S, sources: x, own: E, inherited: U, customs: m, rules: c, element: i };
  }
  parseValue(i, u, s, c, d) {
    const p = String(u).trim();
    switch (i) {
      case "font-size": {
        const m = p.toLowerCase(), y = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (y[m]) return y[m];
        if (m === "smaller") return s.fontSize / 1.2;
        if (m === "larger") return s.fontSize * 1.2;
        const b = Ml(m, { fontSize: s.fontSize, viewport: s.viewport });
        return !b || b.num ? s.fontSize : b.px + b.pct / 100 * s.fontSize;
      }
      case "font-weight": {
        const m = p.toLowerCase();
        if (m === "normal") return 400;
        if (m === "bold") return 700;
        if (m === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (m === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const y = parseFloat(m);
        return Number.isFinite(y) ? y : 400;
      }
      case "line-height": {
        const m = p.toLowerCase();
        if (m === "normal") return { normal: !0 };
        const y = Ml(m, { fontSize: s.fontSize, viewport: s.viewport });
        return y ? y.unitless ? { factor: y.num } : { px: y.px + y.pct / 100 * s.fontSize } : { normal: !0 };
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
        const m = wi(p, (y) => this.themeHex(y));
        return m === "currentcolor" || !m ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : m;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const m = wi(p, (y) => this.themeHex(y));
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
        return To(p, s);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function ld(l) {
  return l === "inline" || l === "inline-block" || l === "contents" ? "block" : l === "inline-flex" ? "flex" : l === "inline-grid" ? "grid" : l;
}
const _i = (l) => l && l.rgba ? { value: hh(l.rgba), token: l.token ?? null } : null, Nh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Th(l, i) {
  const u = i?.(l);
  if (Number.isFinite(u)) return u;
  const s = Math.round(l * 100) / 100;
  return Nh[s] ?? Math.round(l * 1.2);
}
function Go(l, i) {
  const u = l["line-height"], s = l["font-size"];
  return u.normal ? Th(s, i) : u.factor !== void 0 ? u.factor * s : u.px;
}
const Ch = (l) => ie(l, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const jh = "perch-native-description/1", Tl = Symbol("display"), Si = {
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
}, Mh = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const l of Mh) Si[l] = /^(w|h|min_|max_|top|right|bottom|left)/.test(l) ? "auto" : 0;
Si.rounded = 0;
const Ah = /* @__PURE__ */ new Set([
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
]), Oh = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Rh = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Hh = (l) => Rh.test(l) ? "Menlo" : Oh.test(l) ? ".SystemUIFont" : Ch(l).split(",")[0].trim(), Uh = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, nd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Hd = (l) => {
  const i = l.props["data-testid"];
  if (i) return `${l.tagName}[data-testid="${i}"]`;
  if (l.props.id) return `${l.tagName}#${l.props.id}`;
  const u = l.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? l.classList[0];
  if (u) return `${l.tagName}.${u}`;
  const s = l.parentElement;
  return s && s.tagName !== "body" ? `${Hd(s)} > ${l.tagName}` : l.tagName;
};
class Dh {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, u, s, c, d, p = "") {
    const m = `${i}|${u}|${s}|${c}`, y = this.map.get(m);
    if (y) {
      !y.elements.includes(d) && y.elements.length < 4 && y.elements.push(d), y.count++;
      return;
    }
    this.map.set(m, { kind: i, property: u, value: String(s), class: c ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, u) => i.kind < u.kind ? -1 : i.kind > u.kind ? 1 : i.property < u.property ? -1 : i.property > u.property ? 1 : 0);
  }
}
const ua = (l) => {
  if (l != null) {
    if (typeof l == "string") return l === "auto" || l === "none" || l === "normal" ? "auto" : void 0;
    if ("px" in l) return Math.round(Math.min(Math.max(l.px, -9999), 9999) * 100) / 100;
    if ("pct" in l) return `${Math.round(l.pct * 1e3) / 1e3}%`;
  }
}, Bh = /^(text|search|url|email|tel|password|number)$/, qh = 162.13 / 12.8;
function Yh(l, i) {
  if (typeof l != "object" || !l?.expr) return !1;
  const u = Ml(l.expr, { fontSize: i["font-size"] }), s = (i["margin-left"]?.px ?? NaN) + (i["margin-right"]?.px ?? NaN);
  return !!u && !u.num && u.pct === 100 && Math.abs(u.px + s) < 0.01;
}
function Gh(l) {
  const i = l.transform;
  if (i && i !== "none") {
    const s = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), c = s && ie(s[2], ",").map((d) => d.trim());
    return !c || c.length > (s[1] ? 1 : 2) ? null : s[1] === "X" ? [c[0], "0"] : s[1] === "Y" ? ["0", c[0]] : [c[0], c[1] ?? "0"];
  }
  const u = l.translate;
  if (u && u !== "none") {
    const s = ie(String(u).trim(), " ").filter(Boolean);
    return s.length > 3 || s[2] !== void 0 && Ml(s[2], {})?.px ? null : [s[0], s[1] ?? "0"];
  }
  return [];
}
function Qh(l, i, u) {
  const s = l.values, c = Gh(s);
  if (c?.length === 0) return;
  const d = s.transform && s.transform !== "none" ? "transform" : "translate", p = { fontSize: s["font-size"] }, m = (H, M) => {
    const h = Ml(H, p);
    if (!(!h || h.unitless && h.num))
      return h.pct ? typeof M == "number" ? h.px + h.pct / 100 * M : void 0 : h.px;
  }, y = c ? m(c[0], i.w) : void 0, b = c ? m(c[1], i.h) : void 0;
  if (y === void 0 || b === void 0) {
    u("unsupported", d, s[d], l.sources[d]);
    return;
  }
  y && (i.ml = (i.ml ?? 0) + y), b && (i.mt = (i.mt ?? 0) + b);
}
function id(l, i, u = null) {
  const s = l.values, c = {}, d = (v) => l.sources[v], p = (v) => l.sources[v] !== void 0, m = s.display;
  m === "none" ? c.display = "hidden" : m === "flex" || m === "inline-flex" ? c.display = "flex" : (m === "grid" || m === "inline-grid") && (c.display = "flex", c.flex_direction = "col", i("approximated", "display", m, d("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", s["grid-template-columns"], d("grid-template-columns"))), l.element.hidden && (c.display = "hidden");
  const y = c.display === "flex";
  if (y && c.flex_direction !== "col") {
    const v = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    c.flex_direction = v;
  }
  if (y) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (c.flex_wrap = "wrap");
    const v = m === "grid" || m === "inline-grid", N = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    N && (c.items = N);
    let D = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (v) {
      const z = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      z && (c.items = z), s["align-items"] === "center" && (D = "center");
    }
    D && (c.justify = D);
    const T = ua(s["row-gap"]), R = ua(s["column-gap"]);
    typeof T == "number" && T && (c.gap_y = T), typeof R == "number" && R && !v && (c.gap_x = R);
  }
  s["flex-grow"] && (c.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (c.flex_shrink = s["flex-shrink"]);
  const b = ua(s["flex-basis"]);
  b !== void 0 && b !== "auto" && (c.flex_basis = b);
  const H = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  H && (c.self = H);
  for (const [v, N] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const D = s[N], T = ua(D);
    if (T === void 0 && N === "width" && Yh(D, s)) {
      c.self = "stretch", i("approximated", N, D.expr, d(N), "stretched across its parent, inside its margins");
      continue;
    }
    if (T === void 0) {
      typeof D == "object" && D.expr ? i("unsupported", N, D.expr, d(N), "no calc() in the engine") : typeof D == "string" && !["auto", "none"].includes(D) && i("unsupported", N, D, d(N));
      continue;
    }
    T !== "auto" && (c[v] = T);
  }
  const M = ["top", "right", "bottom", "left"];
  for (const v of M) {
    const N = v[0];
    for (const [D, T] of [["p", "padding"], ["m", "margin"]]) {
      const R = s[`${T}-${v}`], z = ua(R);
      if (z === void 0) {
        R?.expr && i("unsupported", `${T}-${v}`, R.expr, d(`${T}-${v}`), "no calc() in the engine");
        continue;
      }
      z !== 0 && (c[`${D}${N}`] = z);
    }
  }
  const h = s.position;
  if (h === "absolute" || h === "fixed") {
    c.position = "absolute", h === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const v of M) {
      const N = ua(s[v]);
      N !== void 0 && N !== "auto" && (c[v] = N);
    }
    if (h === "fixed" && u && c.w === void 0 && c.right === void 0 && typeof c.left == "number") {
      const v = u.width - c.left - (typeof c.ml == "number" ? c.ml : 0) - (typeof c.mr == "number" ? c.mr : 0);
      c.max_w = typeof c.max_w == "number" ? Math.min(c.max_w, v) : v;
    }
    Qh(l, c, i);
  } else h === "sticky" && i("unsupported", "position", "sticky", d("position"));
  s["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", s["z-index"], d("z-index"), "paint order is tree order");
  for (const [v, N] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const D = s[N];
    D === "hidden" || D === "clip" ? c[v] = "hidden" : (D === "auto" || D === "scroll") && (c[v] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (c.visibility = "invisible");
  const C = s["background-color"];
  C?.unreadable ? i("unsupported", "background-color", C.unreadable, d("background-color")) : C?.rgba && C.rgba[3] > 0 && (c.bg = _i(C)), s["background-image"] && s["background-image"] !== "none" && i("unsupported", "background-image", s["background-image"], d("background-image"));
  const S = M.map((v) => ua(s[`border-${v}-width`]) || 0), x = [];
  M.forEach((v, N) => {
    if (!S[N]) return;
    c[`border_${v[0]}`] = S[N];
    const D = s[`border-${v}-style`];
    D !== "solid" && i("approximated", `border-${v}-style`, D, d(`border-${v}-style`), "drawn solid");
    const T = _i(s[`border-${v}-color`]);
    T && x.push(T);
  }), x.length && (c.border_color = x[0], x.some((v) => v.value !== x[0].value) && i("approximated", "border-color", x.map((v) => v.value).join(" "), d("border-top-color"), "one border colour"));
  const E = ["top-left", "top-right", "bottom-right", "bottom-left"].map((v) => ua(s[`border-${v}-radius`]) || 0);
  E.every((v) => v === E[0]) ? E[0] && (c.rounded = E[0]) : ["tl", "tr", "br", "bl"].forEach((v, N) => {
    E[N] && (c[`rounded_${v}`] = E[N]);
  }), s.opacity !== 1 && (c.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const U = s["box-shadow"];
  if (U && U !== "none" && ie(U, ",").some((v) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(v.trim())) && (c.shadow = "lg", i("approximated", "box-shadow", U, d("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !l.inherited.has("cursor")) {
    const v = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    v ? c.cursor = v : i("unsupported", "cursor", s.cursor, d("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (c.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? c.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", s["text-decoration-line"], d("text-decoration-line")), c;
}
const Vh = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Ud(l) {
  if (!l || l === "normal") return "";
  const i = String(l).trim().split(/\s+/).map((u) => Vh[u]);
  return i.every(Boolean) ? i.join(",") : null;
}
function rd(l, i) {
  const u = l.values, s = u["line-height"];
  return {
    text_color: _i(u.color),
    text_size: Math.round(u["font-size"] * 1e3) / 1e3,
    font_features: Ud(u["font-variant-numeric"]) ?? "",
    font_weight: u["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(Go(u, i) * 1e3) / 1e3 },
    font_family: Hh(u["font-family"]),
    italic: u["font-style"] === "italic" || u["font-style"] === "oblique",
    whitespace: u["white-space"] === "nowrap" || u["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[u["text-align"]] ?? "left"
  };
}
const od = (l, i) => l.factor !== void 0 ? l.factor * i : l.px, Dd = (l, i) => JSON.stringify(l) === JSON.stringify(i);
function sd(l, i, u) {
  const s = {}, c = (m, y) => y.some((b) => !l.inherited.has(b));
  for (const [m, y] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (c(m, y) || !Dd(i[m], u[m])) && (s[m] = i[m]);
  const d = od(i.line_height, i.text_size), p = u.line_height ? od(u.line_height, i.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (s.line_height = i.line_height), s;
}
const Kh = (l, i) => ({ ...l, ...i });
function ud(l, i) {
  const u = {};
  for (const [s, c] of Object.entries(l))
    c && typeof c == "object" && "value" in c ? (u[s] = c.value, c.token && (i[s] = c.token)) : s === "line_height" ? u[s] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : s === "italic" ? c && (u.italic = !0) : u[s] = c;
  return u.italic === !1 && delete u.italic, u;
}
function Xh(l, i) {
  const u = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(l), ...Object.keys(i)])) {
    const c = l[s], d = i[s];
    Dd(c, d) || (u[s] = d === void 0 ? s in Si ? Si[s] : null : d);
  }
  return u;
}
function cd(l, i) {
  const u = l.values;
  for (const [s, c] of Object.entries(l.sources)) {
    if (s.startsWith("--") || Ah.has(s) || c.startsWith("ua:")) continue;
    const d = u[s];
    switch (s) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", s, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, c, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Ud(d) === null && i("unsupported", s, d, c);
        break;
      case "text-transform":
        d !== "none" && i("approximated", s, d, c, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = u["transition-duration"];
        s === "transition-property" && p && ie(p, ",").some((m) => parseFloat(m) > 0) && u["transition-property"] !== "none" && i("unsupported", "transition", `${u["transition-property"]} ${p}`, c, "changes are instant (the engine animates only opacity and size)");
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
        u["outline-style"] !== "none" && s === "outline-style" && i("unsupported", "outline", `${ua(u["outline-width"])}px ${u["outline-style"]} ${_i(u["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
        break;
      case "transform":
      case "translate":
        u.position !== "absolute" && u.position !== "fixed" && d && d !== "none" && i("unsupported", s, d, c);
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
function Zh(l, i, u, s) {
  const c = Hd(l), d = [], p = (E, U, v, N, D) => d.push([E, U, v, N ?? "(user agent)", c, D]), m = s.cascade.compute(l, i), y = {}, b = id(m, p, s.viewport);
  cd(m, p);
  const H = rd(m, s.measure), M = sd(m, H, u), h = ud({ ...b, ...M }, y), C = {}, S = s.cascade.matching(l, "*").filter((E) => E.states.subject.size);
  for (const [E, U] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!S.some((R) => U.some((z) => R.states.subject.has(z)))) continue;
    const v = s.cascade.compute(l, i, new Set(U)), N = {}, D = ud({ ...id(v, () => {
    }), ...sd(v, rd(v, s.measure), u) }, N);
    E === "focus" && cd(v, p);
    const T = Xh(h, D);
    if (Object.keys(T).length) {
      C[E] = T;
      const R = Object.fromEntries(Object.entries(N).filter(([z]) => z in T));
      Object.keys(R).length && (C[`${E}_tokens`] = R);
    }
  }
  if (s.cascade.sheet.tracks(l, "hover") && (C.track_hover = !0), /tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (C.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (C.break_anywhere = !0), b.overflow_y === "scroll") {
    const E = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    E > 0 && (C.scrollbar = E);
  }
  m.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (C.blocks_pointer = !0);
  const x = Object.entries(Uh).filter(([, E]) => E.some((U) => typeof l.props[U] == "function")).map(([E]) => E);
  return x.length && (C.events = x), { computed: m, style: h, tokens: y, extra: C, meta: Fh(l), reports: d, childText: Kh(u, M), where: c };
}
function Bd(l, i, u, s, c = "") {
  const d = `${c}/${l.id}.${l.version}`;
  let p = s.cache.get(l);
  (!p || p.key !== d) && s.cache.set(l, p = { key: d, part: Zh(l, i, u, s) });
  const { computed: m, tokens: y, extra: b, reports: H, childText: M, where: h } = p.part;
  for (const w of H) s.findings.add(...w);
  const C = (w, q, F, ot, Et) => s.findings.add(w, q, F, ot, h, Et), S = { ...p.part.style }, x = { kind: "div", id: l.id, style: S, tokens: y, meta: p.part.meta, ...b };
  Object.defineProperty(x, Tl, { value: m.values.display });
  const E = l.tagName;
  if (E === "svg")
    return x.kind = l.props["data-perch-image"] ? "image" : "svg", x.markup = $h(l), x;
  if (E === "input" || E === "textarea" || E === "select") {
    x.kind = "input", x.input_type = E === "input" ? String(l.props.type ?? "text") : E;
    for (const w of ["placeholder", "checked", "disabled"]) l.props[w] !== void 0 && (x[w] = l.props[w]);
    return /^(checkbox|radio)$/.test(x.input_type) && (x.checked = l.checked), E !== "select" && (x.value = l.value), E === "input" && Bh.test(x.input_type) && (x.field_w = qh * m.values["font-size"]), x;
  }
  if (E === "img")
    return x.kind = "image", x.src = l.props.src ?? null, x;
  const U = m.values["text-transform"], v = [];
  let N = !1, D = !1;
  for (const w of l.childNodes) {
    if (w instanceof Bo) {
      if (w.hidden || w.data === "") continue;
      N = !0;
      const ot = v[v.length - 1];
      if (ot?.kind === "text")
        ot.source = (ot.source ?? ot.text) + w.data, ot.text = dd(ot.source, U), ot.text === ot.source && delete ot.source;
      else {
        const Et = dd(w.data, U);
        v.push(Et === w.data ? { kind: "text", text: Et } : { kind: "text", text: Et, source: w.data });
      }
      continue;
    }
    if (!(w instanceof ze)) continue;
    const q = Bd(w, m, M, s, d), F = q[Tl];
    F === "inline" || F === "inline-block" || F === "inline-flex" ? N = !0 : F !== "none" && (D = !0), v.push(q);
  }
  const T = v.some((w) => w.kind !== "text"), R = v.length === 1 && v[0].kind !== "text" && /^inline-(block|flex)$/.test(v[0][Tl]) ? v[0] : null;
  if (!S.display && R) {
    const w = s.cache.get(l.childNodes.find((F) => F.id === R.id))?.part.computed, q = w ? jo(m.values, s.measure) - Wh(w.values, s.measure) : 0;
    S.display = "flex", S.flex_direction = "col", S.items = "start", q > 0 && (R.style.mt = Math.round(((R.style.mt ?? 0) + q) * 100) / 100), C("approximated", "display", `${m.values.display} holding one ${R[Tl]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!S.display && v.length === 1 && (v[0].kind === "svg" || v[0].kind === "image") && v[0][Tl] === "inline" && typeof v[0].style.h == "number") {
    const w = v[0], q = jo(m.values, s.measure), F = Go(m.values, s.measure) - q, ot = (Et) => Math.round(Et * 100) / 100;
    S.display = "flex", S.flex_direction = "col", S.items = "start", q > w.style.h && (w.style.mt = ot((w.style.mt ?? 0) + q - w.style.h)), F > 0 && (w.style.mb = ot((w.style.mb ?? 0) + F)), C("approximated", "display", `${m.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!S.display && N && T) {
    if (S.display = "flex", S.flex_direction = D ? "col" : "row", !D) S.items = "baseline";
    else for (const w of v) w.kind !== "text" && /^inline-(block|flex)$/.test(w[Tl]) && !w.style.self && (w.style.self = "start");
    C("approximated", "display", `${m.values.display} with inline content`, "(inline formatting)", D ? "a column of its children" : "a row on the text baseline");
  }
  const z = m.values["letter-spacing"]?.px;
  if (z)
    for (let w = 0; w < v.length; w++) {
      const q = v[w];
      if (q.kind !== "text") continue;
      const F = Math.round(z * [...q.text].length * 1e3) / 1e3;
      v[w] = { kind: "div", style: { pr: F }, tokens: {}, children: [q] };
    }
  return x.children = v, x;
}
function Jh(l, i) {
  if (!i) return null;
  let s = (i.self ? l : i.closest ? Td(l, i.closest) : i.find ? xi(l, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return s && i.strip && s.startsWith(i.strip) && (s = s.slice(i.strip.length)), s;
}
function Lh(l, i, u) {
  const s = i.map((p) => [p, Ti(p.selector)]), c = /* @__PURE__ */ new Map(), d = (p) => {
    for (const m of p.children) {
      const y = u.get(m.id);
      if (y)
        for (const [b, H] of s) {
          const M = b.textRange ? "range_name" : "name";
          if (y[M] != null || !H.some((S) => Nd(m, S))) continue;
          const h = Jh(m, b.key), C = h == null ? c.get(b.name) ?? 0 : 0;
          h == null && c.set(b.name, C + 1), y[M] = h != null ? `${b.name}:${h}` : C ? `${b.name}@${C}` : b.name;
        }
      d(m);
    }
  };
  d(l.documentElement);
}
const zi = 0.9521, qd = 0.2256, jo = (l, i) => (Go(l, i) - (zi + qd) * l["font-size"]) / 2 + zi * l["font-size"];
function Wh(l, i) {
  const u = (c) => c && typeof c == "object" && "px" in c ? c.px : 0, s = l["border-top-style"] === "none" ? 0 : u(l["border-top-width"]);
  return u(l["padding-top"]) + s + jo(l, i);
}
const dd = (l, i) => i === "uppercase" ? l.toUpperCase() : i === "lowercase" ? l.toLowerCase() : i === "capitalize" ? l.replace(/\b\p{L}/gu, (u) => u.toUpperCase()) : l, Yd = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Fh(l) {
  const i = {};
  for (const [u, s] of Object.entries(l.props)) {
    if (Yd.has(u) || typeof s == "function" || s === void 0 || s === null || typeof s == "object") continue;
    const c = u.startsWith("aria-") || u.startsWith("data-");
    if (s === !1 && !c) continue;
    const d = u === "htmlFor" ? "for" : u === "tabIndex" ? "tabindex" : u;
    i[d] = typeof s == "boolean" ? c ? String(s) : "" : String(s);
  }
  return { tag: l.tagName, classes: l.classList, attrs: i };
}
const Ih = (l) => l === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(l) ? l : l.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), fd = (l) => String(l).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function $h(l) {
  if (l.props["data-perch-markup"]) return String(l.props["data-perch-markup"]);
  const i = (u) => {
    const s = [];
    for (const [d, p] of Object.entries(u.props))
      Yd.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || s.push(`${Ih(d)}="${fd(p === !0 ? "" : p)}"`);
    u.tagName === "svg" && !u.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = u.childNodes.map((d) => d instanceof Bo ? fd(d.data) : i(d)).join("");
    return `<${u.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${c}</${u.tagName}>`;
  };
  return i(l);
}
function Ph(l) {
  const i = l.theme?.() ?? {}, u = {};
  for (const s of Md) i[s] && (u[s] = i[s]);
  return u;
}
const t0 = { font_features: "" };
function e0(l, i, u, s = {}, c = null) {
  const d = Ph(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([d, p]);
  (s.look !== m || s.sheet !== u) && Object.assign(s, { look: m, sheet: u, cache: /* @__PURE__ */ new WeakMap(), cascade: new kh(u, { theme: d, viewport: p }), top: null });
  const { cascade: y, cache: b } = s, H = { cascade: y, cache: b, viewport: p, findings: new Dh(), measure: i.lineHeight ? (C) => i.lineHeight(C) : null };
  s.top ??= y.compute(l.body, y.compute(l.documentElement, null));
  const M = l.body.children.map((C) => Bd(C, s.top, t0, H));
  if (c?.length) {
    const C = /* @__PURE__ */ new Map(), S = (x) => {
      x.id && C.set(x.id, x);
      for (const E of x.children ?? []) S(E);
    };
    M.forEach(S), Lh(l, c, C);
  }
  const h = /* @__PURE__ */ new Set();
  for (const C of [l, l.defaultView])
    for (const { type: S } of C?.listeners ?? []) nd[S] && h.add(nd[S]);
  return { schema: jh, root: M[0] ?? null, overlays: M.slice(1), document_events: [...h].sort(), unsupported: H.findings.list() };
}
const a0 = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let l0 = null;
const n0 = () => l0 ??= new wh(a0);
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
let Ia = fn.NoEventPriority;
function i0(l, i) {
  const u = /* @__PURE__ */ new Set([...Object.keys(l), ...Object.keys(i)]);
  for (const s of u) {
    if (s === "children") continue;
    const c = l[s], d = i[s];
    if (!(c === d || typeof c == "function" && typeof d == "function") && !(s === "style" && c && d && typeof c == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(d)])].every((m) => c[m] === d[m])))
      return !0;
  }
  return !1;
}
const r0 = {
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
  createInstance: (l, i, u) => new ze(l, i, u.ownerDocument),
  createTextInstance: (l, i) => new Bo(l),
  appendInitialChild: (l, i) => {
    l.appendChild(i);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (l, i, u) => !!u.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (l, i) => {
    l.appendChild(i);
  },
  appendChildToContainer: (l, i) => {
    l.appendChild(i);
  },
  insertBefore: (l, i, u) => {
    l.insertBefore(i, u);
  },
  insertInContainerBefore: (l, i, u) => {
    l.insertBefore(i, u);
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
  commitUpdate: (l, i, u, s) => {
    l.props = s, i0(u, s) && l.touch();
  },
  commitTextUpdate: (l, i, u) => {
    l.data = String(u);
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
    Ia = l;
  },
  getCurrentUpdatePriority: () => Ia,
  resolveUpdatePriority: () => Ia !== fn.NoEventPriority ? Ia : fn.DefaultEventPriority,
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
}, _e = oh(r0), Qo = (l, i, u = null) => _e.createPortal(l, i, null, u), o0 = {
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
class s0 {
  constructor(i, u, s) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, u), this.type = i, this.target = s, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function gi(l, i, u) {
  i.currentTarget = l;
  for (const { type: s, listener: c, capture: d } of [...l.listeners ?? []])
    s === i.type && d === u && c.call(l, i);
  if (l instanceof ze) {
    const s = o0[i.type], c = s && l.props[u ? `${s}Capture` : s];
    typeof c == "function" && c(i);
  }
}
const u0 = (l) => l?.tagName === "textarea" || l?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(l.props.type ?? ""));
function Qv(l, i, u = {}) {
  const { document: s, window: c } = Fp(l), d = new ze("div", { id: "root", style: u.container ?? {} }, s);
  s.body.appendChild(d);
  const p = [];
  let m = null;
  const y = () => [s, c].map((v) => v.listeners.map((N) => `${N.type}:${N.capture}`).sort().join(",")).join("|");
  let b = "";
  const H = {}, M = () => (m = e0(s, l, n0(), H, u.names), b = y(), l.render?.(m), m), h = () => {
    _e.flushPassiveEffects(), _e.flushSyncWork(), y() !== b && M();
  };
  s.afterCommit = M;
  const C = (v) => {
    p.push(v), l.error?.(v);
  }, S = _e.createContainer(d, fn.ConcurrentRoot, null, !1, null, "", C, C, C, null);
  _e.updateContainerSync(St.createElement(i, u.props ?? {}), S, null, null), _e.flushSyncWork(), h();
  const x = (v) => {
    const N = (D) => {
      if (D.id === v) return D;
      for (const T of D.children) {
        const R = N(T);
        if (R) return R;
      }
      return null;
    };
    return N(s.documentElement);
  }, E = (v) => {
    const N = Ia;
    Ia = fn.DiscreteEventPriority;
    try {
      return v();
    } finally {
      Ia = N, _e.flushSyncWork(), h();
    }
  }, U = {
    document: s,
    window: c,
    container: d,
    errors: p,
    /** The latest description (after the last commit or state change). */
    get description() {
      return m;
    },
    describe: M,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(v, N, D = {}) {
      const T = typeof v == "string" ? x(v) : v;
      if (!T) return !1;
      const R = new s0(N, D, T), z = [];
      for (let q = T; q; q = q.parentNode) z.push(q);
      const w = [...z, s, c];
      return E(() => {
        for (let q = w.length - 1; q > 0 && !R.propagationStopped; q--) gi(w[q], R, !0);
        R.propagationStopped || (gi(T, R, !0), R.propagationStopped || gi(T, R, !1));
        for (let q = 1; q < w.length && !R.propagationStopped; q++) gi(w[q], R, !1);
      }), !R.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end, Backspace deletes the last one, and the field gets `input` and
     * `change` events with its new `value`. Returns whether the source took the key (prevented it, or a field
     * changed). */
    key(v) {
      const N = s.activeElement && s.activeElement !== s.body ? s.activeElement : s.body;
      if (!U.dispatch(N, "keydown", v)) return !0;
      if (!u0(N) || N.props.disabled || N.props.readOnly || v.ctrlKey || v.metaKey) return !1;
      const T = N.value, R = v.key === "Backspace" ? T.slice(0, -1) : [...v.key].length === 1 ? T + v.key : T;
      return R === T ? !1 : (N.value = R, U.dispatch(N, "input", { data: v.key }), U.dispatch(N, "change", {}), N.props.value !== void 0 && delete N.edit, N.touch(), M(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(v, N) {
      const D = x(v);
      D && (D.bounds = { x: N.x, y: N.y, width: N.width, height: N.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(v) {
      const N = x(v);
      if (!N || N.props.disabled || !U.dispatch(v, "click", { button: 0, detail: 1 })) return;
      const D = N.props.type === "radio";
      D && N.checked || (N.checked = D ? !0 : !N.checked, U.dispatch(v, "input", {}), U.dispatch(v, "change", {}), N.props.checked !== void 0 && delete N.ticked, N.touch(), M());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(v, N = {}) {
      const D = { button: 0, buttons: 1, pointerType: "mouse", ...N };
      for (const T of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) U.dispatch(v, T, D);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (v) => !!x(v)?.state.hover,
    hover(v, N) {
      const D = x(v);
      !D || D.state.hover === N || (D.state.hover = N, D.touch(), M());
    },
    focus(v) {
      const N = x(v);
      N && (E(() => {
        const D = s.activeElement;
        D && D !== N && D !== s.body && U.dispatch(D, "blur"), s.focus(N), U.dispatch(N, "focus");
      }), M());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: h,
    update(v) {
      _e.updateContainerSync(St.createElement(i, v ?? {}), S, null, null), _e.flushSyncWork(), h();
    },
    unmount() {
      _e.updateContainerSync(null, S, null, null), _e.flushSyncWork(), _e.flushPassiveEffects(), s.afterCommit = null;
    }
  };
  return U;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Gd = (l) => _e.flushSyncFromReconciler(l), c0 = { createPortal: Qo, flushSync: Gd }, Vv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Qo,
  default: c0,
  flushSync: Gd
}, Symbol.toStringTag, { value: "Module" }));
function Qd(l) {
  var i, u, s = "";
  if (typeof l == "string" || typeof l == "number") s += l;
  else if (typeof l == "object") if (Array.isArray(l)) {
    var c = l.length;
    for (i = 0; i < c; i++) l[i] && (u = Qd(l[i])) && (s && (s += " "), s += u);
  } else for (u in l) l[u] && (s && (s += " "), s += u);
  return s;
}
function Vd() {
  for (var l, i, u = 0, s = "", c = arguments.length; u < c; u++) (l = arguments[u]) && (i = Qd(l)) && (s && (s += " "), s += i);
  return s;
}
const d0 = (l, i) => {
  const u = new Array(l.length + i.length);
  for (let s = 0; s < l.length; s++)
    u[s] = l[s];
  for (let s = 0; s < i.length; s++)
    u[l.length + s] = i[s];
  return u;
}, f0 = (l, i) => ({
  classGroupId: l,
  validator: i
}), Kd = (l = /* @__PURE__ */ new Map(), i = null, u) => ({
  nextPart: l,
  validators: i,
  classGroupId: u
}), Ei = "-", md = [], m0 = "arbitrary..", p0 = (l) => {
  const i = g0(l), {
    conflictingClassGroups: u,
    conflictingClassGroupModifiers: s
  } = l;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return h0(p);
      const m = p.split(Ei), y = m[0] === "" && m.length > 1 ? 1 : 0;
      return Xd(m, y, i);
    },
    getConflictingClassGroupIds: (p, m) => {
      if (m) {
        const y = s[p], b = u[p];
        return y ? b ? d0(b, y) : y : b || md;
      }
      return u[p] || md;
    }
  };
}, Xd = (l, i, u) => {
  if (l.length - i === 0)
    return u.classGroupId;
  const c = l[i], d = u.nextPart.get(c);
  if (d) {
    const b = Xd(l, i + 1, d);
    if (b) return b;
  }
  const p = u.validators;
  if (p === null)
    return;
  const m = i === 0 ? l.join(Ei) : l.slice(i).join(Ei), y = p.length;
  for (let b = 0; b < y; b++) {
    const H = p[b];
    if (H.validator(m))
      return H.classGroupId;
  }
}, h0 = (l) => l.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = l.slice(1, -1), u = i.indexOf(":"), s = i.slice(0, u);
  return s ? m0 + s : void 0;
})(), g0 = (l) => {
  const {
    theme: i,
    classGroups: u
  } = l;
  return v0(u, i);
}, v0 = (l, i) => {
  const u = Kd();
  for (const s in l) {
    const c = l[s];
    Vo(c, u, s, i);
  }
  return u;
}, Vo = (l, i, u, s) => {
  const c = l.length;
  for (let d = 0; d < c; d++) {
    const p = l[d];
    b0(p, i, u, s);
  }
}, b0 = (l, i, u, s) => {
  if (typeof l == "string") {
    y0(l, i, u);
    return;
  }
  if (typeof l == "function") {
    x0(l, i, u, s);
    return;
  }
  w0(l, i, u, s);
}, y0 = (l, i, u) => {
  const s = l === "" ? i : Zd(i, l);
  s.classGroupId = u;
}, x0 = (l, i, u, s) => {
  if (_0(l)) {
    Vo(l(s), i, u, s);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(f0(u, l));
}, w0 = (l, i, u, s) => {
  const c = Object.entries(l), d = c.length;
  for (let p = 0; p < d; p++) {
    const [m, y] = c[p];
    Vo(y, Zd(i, m), u, s);
  }
}, Zd = (l, i) => {
  let u = l;
  const s = i.split(Ei), c = s.length;
  for (let d = 0; d < c; d++) {
    const p = s[d];
    let m = u.nextPart.get(p);
    m || (m = Kd(), u.nextPart.set(p, m)), u = m;
  }
  return u;
}, _0 = (l) => "isThemeGetter" in l && l.isThemeGetter === !0, S0 = (l) => {
  if (l < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, u = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const c = (d, p) => {
    u[d] = p, i++, i > l && (i = 0, s = u, u = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let p = u[d];
      if (p !== void 0)
        return p;
      if ((p = s[d]) !== void 0)
        return c(d, p), p;
    },
    set(d, p) {
      d in u ? u[d] = p : c(d, p);
    }
  };
}, Mo = "!", pd = ":", z0 = [], hd = (l, i, u, s, c) => ({
  modifiers: l,
  hasImportantModifier: i,
  baseClassName: u,
  maybePostfixModifierPosition: s,
  isExternal: c
}), E0 = (l) => {
  const {
    prefix: i,
    experimentalParseClassName: u
  } = l;
  let s = (c) => {
    const d = [];
    let p = 0, m = 0, y = 0, b;
    const H = c.length;
    for (let x = 0; x < H; x++) {
      const E = c[x];
      if (p === 0 && m === 0) {
        if (E === pd) {
          d.push(c.slice(y, x)), y = x + 1;
          continue;
        }
        if (E === "/") {
          b = x;
          continue;
        }
      }
      E === "[" ? p++ : E === "]" ? p-- : E === "(" ? m++ : E === ")" && m--;
    }
    const M = d.length === 0 ? c : c.slice(y);
    let h = M, C = !1;
    M.endsWith(Mo) ? (h = M.slice(0, -1), C = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      M.startsWith(Mo) && (h = M.slice(1), C = !0)
    );
    const S = b && b > y ? b - y : void 0;
    return hd(d, C, h, S);
  };
  if (i) {
    const c = i + pd, d = s;
    s = (p) => p.startsWith(c) ? d(p.slice(c.length)) : hd(z0, !1, p, void 0, !0);
  }
  if (u) {
    const c = s;
    s = (d) => u({
      className: d,
      parseClassName: c
    });
  }
  return s;
}, k0 = (l) => {
  const i = /* @__PURE__ */ new Map();
  return l.orderSensitiveModifiers.forEach((u, s) => {
    i.set(u, 1e6 + s);
  }), (u) => {
    const s = [];
    let c = [];
    for (let d = 0; d < u.length; d++) {
      const p = u[d], m = p[0] === "[", y = i.has(p);
      m || y ? (c.length > 0 && (c.sort(), s.push(...c), c = []), s.push(p)) : c.push(p);
    }
    return c.length > 0 && (c.sort(), s.push(...c)), s;
  };
}, N0 = (l) => ({
  cache: S0(l.cacheSize),
  parseClassName: E0(l),
  sortModifiers: k0(l),
  postfixLookupClassGroupIds: T0(l),
  ...p0(l)
}), T0 = (l) => {
  const i = /* @__PURE__ */ Object.create(null), u = l.postfixLookupClassGroups;
  if (u)
    for (let s = 0; s < u.length; s++)
      i[u[s]] = !0;
  return i;
}, C0 = /\s+/, j0 = (l, i) => {
  const {
    parseClassName: u,
    getClassGroupId: s,
    getConflictingClassGroupIds: c,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, m = [], y = l.trim().split(C0);
  let b = "";
  for (let H = y.length - 1; H >= 0; H -= 1) {
    const M = y[H], {
      isExternal: h,
      modifiers: C,
      hasImportantModifier: S,
      baseClassName: x,
      maybePostfixModifierPosition: E
    } = u(M);
    if (h) {
      b = M + (b.length > 0 ? " " + b : b);
      continue;
    }
    let U = !!E, v;
    if (U) {
      const z = x.substring(0, E);
      v = s(z);
      const w = v && p[v] ? s(x) : void 0;
      w && w !== v && (v = w, U = !1);
    } else
      v = s(x);
    if (!v) {
      if (!U) {
        b = M + (b.length > 0 ? " " + b : b);
        continue;
      }
      if (v = s(x), !v) {
        b = M + (b.length > 0 ? " " + b : b);
        continue;
      }
      U = !1;
    }
    const N = C.length === 0 ? "" : C.length === 1 ? C[0] : d(C).join(":"), D = S ? N + Mo : N, T = D + v;
    if (m.indexOf(T) > -1)
      continue;
    m.push(T);
    const R = c(v, U);
    for (let z = 0; z < R.length; ++z) {
      const w = R[z];
      m.push(D + w);
    }
    b = M + (b.length > 0 ? " " + b : b);
  }
  return b;
}, M0 = (...l) => {
  let i = 0, u, s, c = "";
  for (; i < l.length; )
    (u = l[i++]) && (s = Jd(u)) && (c && (c += " "), c += s);
  return c;
}, Jd = (l) => {
  if (typeof l == "string")
    return l;
  let i, u = "";
  for (let s = 0; s < l.length; s++)
    l[s] && (i = Jd(l[s])) && (u && (u += " "), u += i);
  return u;
}, A0 = (l, ...i) => {
  let u, s, c, d;
  const p = (y) => {
    const b = i.reduce((H, M) => M(H), l());
    return u = N0(b), s = u.cache.get, c = u.cache.set, d = m, m(y);
  }, m = (y) => {
    const b = s(y);
    if (b)
      return b;
    const H = j0(y, u);
    return c(y, H), H;
  };
  return d = p, (...y) => d(M0(...y));
}, O0 = [], Xt = (l) => {
  const i = (u) => u[l] || O0;
  return i.isThemeGetter = !0, i.themeKey = l, i;
}, Ld = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Wd = /^\((?:(\w[\w-]*):)?(.+)\)$/i, R0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, H0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, U0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, D0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, B0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, q0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ca = (l) => R0.test(l), ft = (l) => !!l && !Number.isNaN(Number(l)), Xe = (l) => !!l && Number.isInteger(Number(l)), _o = (l) => l.endsWith("%") && ft(l.slice(0, -1)), sa = (l) => H0.test(l), Fd = () => !0, Y0 = (l) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  U0.test(l) && !D0.test(l)
), Ko = () => !1, G0 = (l) => B0.test(l), Q0 = (l) => q0.test(l), V0 = (l) => !J(l) && !L(l), K0 = (l) => l.startsWith("@container") && (l[10] === "/" && l[11] !== void 0 || l[11] === "s" && l[16] !== void 0 && l.startsWith("-size/", 10) || l[11] === "n" && l[18] !== void 0 && l.startsWith("-normal/", 10)), X0 = (l) => ja(l, Pd, Ko), J = (l) => Ld.test(l), Fa = (l) => ja(l, tf, Y0), gd = (l) => ja(l, P0, ft), Z0 = (l) => ja(l, af, Fd), J0 = (l) => ja(l, ef, Ko), vd = (l) => ja(l, Id, Ko), L0 = (l) => ja(l, $d, Q0), vi = (l) => ja(l, lf, G0), L = (l) => Wd.test(l), cn = (l) => Pa(l, tf), W0 = (l) => Pa(l, ef), bd = (l) => Pa(l, Id), F0 = (l) => Pa(l, Pd), I0 = (l) => Pa(l, $d), bi = (l) => Pa(l, lf, !0), $0 = (l) => Pa(l, af, !0), ja = (l, i, u) => {
  const s = Ld.exec(l);
  return s ? s[1] ? i(s[1]) : u(s[2]) : !1;
}, Pa = (l, i, u = !1) => {
  const s = Wd.exec(l);
  return s ? s[1] ? i(s[1]) : u : !1;
}, Id = (l) => l === "position" || l === "percentage", $d = (l) => l === "image" || l === "url", Pd = (l) => l === "length" || l === "size" || l === "bg-size", tf = (l) => l === "length", P0 = (l) => l === "number", ef = (l) => l === "family-name", af = (l) => l === "number" || l === "weight", lf = (l) => l === "shadow", tg = () => {
  const l = Xt("color"), i = Xt("font"), u = Xt("text"), s = Xt("font-weight"), c = Xt("tracking"), d = Xt("leading"), p = Xt("breakpoint"), m = Xt("container"), y = Xt("spacing"), b = Xt("radius"), H = Xt("shadow"), M = Xt("inset-shadow"), h = Xt("text-shadow"), C = Xt("drop-shadow"), S = Xt("blur"), x = Xt("perspective"), E = Xt("aspect"), U = Xt("ease"), v = Xt("animate"), N = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], D = () => [
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
  ], T = () => [...D(), L, J], R = () => ["auto", "hidden", "clip", "visible", "scroll"], z = () => ["auto", "contain", "none"], w = () => [L, J, y], q = () => [Ca, "full", "auto", ...w()], F = () => [Xe, "none", "subgrid", L, J], ot = () => ["auto", {
    span: ["full", Xe, L, J]
  }, Xe, L, J], Et = () => [Xe, "auto", L, J], Ht = () => ["auto", "min", "max", "fr", L, J], Ft = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Tt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], G = () => ["auto", ...w()], P = () => [Ca, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...w()], nt = () => [m, Ca, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...w()], st = () => [Ca, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...w()], K = () => [l, L, J], _ = () => [...D(), bd, vd, {
    position: [L, J]
  }], Y = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", F0, X0, {
    size: [L, J]
  }], I = () => [_o, cn, Fa], $ = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    b,
    L,
    J
  ], et = () => ["", ft, cn, Fa], bt = () => ["solid", "dashed", "dotted", "double"], Zt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ut = () => [ft, _o, bd, vd], Ma = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    S,
    L,
    J
  ], Aa = () => ["none", ft, L, J], Ae = () => ["none", ft, L, J], Oe = () => [ft, L, J], ca = () => [Ca, "full", ...w()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [sa],
      breakpoint: [sa],
      color: [Fd],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [V0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [sa],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [sa],
      shadow: [sa],
      spacing: ["px", ft],
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
        aspect: ["auto", "square", Ca, J, L, E]
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
      "container-named": [K0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [ft, "auto", J, L, m]
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
        object: T()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: R()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": R()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": R()
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
        inset: q()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": q()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": q()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": q(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: q()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": q(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: q()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": q()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": q()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: q()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: q()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: q()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: q()
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
        z: [Xe, "auto", L, J]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Ca, "full", "auto", m, ...w()]
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
        flex: [ft, Ca, "auto", "initial", "none", J]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ft, L, J]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ft, L, J]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Xe, "first", "last", "none", L, J]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": F()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: ot()
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
        "grid-rows": F()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: ot()
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
        "auto-cols": Ht()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": Ht()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: w()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": w()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": w()
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
        p: w()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: w()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: w()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: w()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: w()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: w()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: w()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: w()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: w()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: w()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: w()
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
        "space-x": w()
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
        "space-y": w()
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
        block: ["auto", ...st()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...st()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...st()]
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
        text: ["base", u, cn, Fa]
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
        font: [s, $0, Z0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", _o, J]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [W0, J0, i]
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
        "line-clamp": [ft, "none", L, gd]
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
          ...w()
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
        decoration: [...bt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [ft, "from-font", "auto", L, Fa]
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
        "underline-offset": [ft, "auto", L, J]
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
        indent: w()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [Xe, L, J]
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
        bg: _()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: Y()
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
          }, Xe, L, J],
          radial: ["", L, J],
          conic: ["", Xe, L, J]
        }, I0, L0]
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
        from: I()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: I()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: I()
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
        rounded: $()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": $()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": $()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": $()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": $()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": $()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": $()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": $()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": $()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": $()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": $()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": $()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": $()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": $()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": $()
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
        border: [...bt(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...bt(), "hidden", "none"]
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
        outline: [...bt(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [ft, L, J]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ft, cn, Fa]
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
          H,
          bi,
          vi
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
        "inset-shadow": ["none", M, bi, vi]
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
        "ring-offset": [ft, Fa]
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
        "text-shadow": ["none", h, bi, vi]
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
        opacity: [ft, L, J]
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
        "mask-linear": [ft]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": ut()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": ut()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": K()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": K()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": ut()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": ut()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": K()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": K()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": ut()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": ut()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": K()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": K()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": ut()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": ut()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": K()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": K()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": ut()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": ut()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": K()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": K()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": ut()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": ut()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": K()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": K()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": ut()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": ut()
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
        "mask-radial-from": ut()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": ut()
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
        "mask-radial-at": D()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [ft]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": ut()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": ut()
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
        mask: _()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: Y()
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
        blur: Ma()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [ft, L, J]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ft, L, J]
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
          bi,
          vi
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
        grayscale: ["", ft, L, J]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ft, L, J]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ft, L, J]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ft, L, J]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ft, L, J]
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
        "backdrop-blur": Ma()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [ft, L, J]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ft, L, J]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ft, L, J]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ft, L, J]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ft, L, J]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ft, L, J]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ft, L, J]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ft, L, J]
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
        "border-spacing": w()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": w()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": w()
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
        duration: [ft, "initial", L, J]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", U, L, J]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [ft, L, J]
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
        "perspective-origin": T()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Aa()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Aa()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Aa()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Aa()
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
        transform: [L, J, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: T()
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
        zoom: [Xe, L, J]
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
        "scroll-m": w()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": w()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": w()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": w()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": w()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": w()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": w()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": w()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": w()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": w()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": w()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": w()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": w()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": w()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": w()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": w()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": w()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": w()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": w()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": w()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": w()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": w()
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
        stroke: [ft, cn, Fa, gd]
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
}, eg = /* @__PURE__ */ A0(tg);
function Je(...l) {
  return eg(Vd(l));
}
const nf = typeof navigator < "u" && /Mac/i.test(navigator.platform), ki = {
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
for (let l = 1; l <= 12; l++) ki[`f${l}`] = `F${l}`;
const ag = Object.fromEntries(Object.entries(ki).map(([l, i]) => [i, l])), lg = {
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
function ng(l) {
  const i = /^Key([A-Z])$/.exec(l) ?? /^Digit(\d)$/.exec(l);
  return i ? i[1].toLowerCase() : ag[l];
}
const yd = /* @__PURE__ */ new Map();
function rf(l, i = nf) {
  const u = `${i}|${l}`, s = yd.get(u);
  if (s) return s;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of l.split("+"))
    if (d === "mod")
      i ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") c[d] = !0;
    else if (/^[a-z]$/.test(d))
      c.code = `Key${d.toUpperCase()}`, c.letter = d;
    else if (/^[0-9]$/.test(d)) c.code = `Digit${d}`;
    else if (ki[d]) c.code = ki[d];
    else throw new Error(`unknown key "${d}" in "${l}"`);
  if (!c.code) throw new Error(`no key in "${l}"`);
  return yd.set(u, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((l) => {
  const i = rf(l, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function ig(l, i = nf) {
  const u = rf(l, i), s = rg(ng(u.code) ?? "");
  return i ? `${u.ctrl ? "⌃" : ""}${u.alt ? "⌥" : ""}${u.shift ? "⇧" : ""}${u.cmd ? "⌘" : ""}${s}` : [u.ctrl && "Ctrl", u.alt && "Alt", u.shift && "Shift", s].filter(Boolean).join("+");
}
const rg = (l) => lg[l] ?? l.toUpperCase(), xd = (l) => typeof l == "boolean" ? `${l}` : l === 0 ? "0" : l, wd = Vd, Ci = (l, i) => (u) => {
  var s;
  if (i?.variants == null) return wd(l, u?.class, u?.className);
  const { variants: c, defaultVariants: d } = i, p = Object.keys(c).map((b) => {
    const H = u?.[b], M = d?.[b];
    if (H === null) return null;
    const h = xd(H) || xd(M);
    return c[b][h];
  }), m = u && Object.entries(u).reduce((b, H) => {
    let [M, h] = H;
    return h === void 0 || (b[M] = h), b;
  }, {}), y = i == null || (s = i.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((b, H) => {
    let { class: M, className: h, ...C } = H;
    return Object.entries(C).every((S) => {
      let [x, E] = S;
      return Array.isArray(E) ? E.includes({
        ...d,
        ...m
      }[x]) : {
        ...d,
        ...m
      }[x] === E;
    }) ? [
      ...b,
      M,
      h
    ] : b;
  }, []);
  return wd(l, p, y, u?.class, u?.className);
}, og = Ci(
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
), sg = Ci(
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
function ug({ className: l, ...i } = {}) {
  return Je(sg(i), l);
}
const of = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", sf = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", cg = Ci(`${sf} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function dg({ className: l, ...i } = {}) {
  return Je(cg(i), l);
}
const fg = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", mg = Ci(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), pg = "my-1 h-px bg-overlay-0";
function hg({ size: l = 14, className: i }) {
  return /* @__PURE__ */ Qt.jsxs("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ Qt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Qt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Qt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function gg({ size: l = 16, className: i }) {
  return /* @__PURE__ */ Qt.jsxs("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ Qt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ Qt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function vg({ size: l = 14, className: i }) {
  return /* @__PURE__ */ Qt.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Qt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function uf({ size: l = 14, className: i }) {
  return /* @__PURE__ */ Qt.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Qt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const _d = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function bg({ state: l, error: i }) {
  return /* @__PURE__ */ Qt.jsx(
    "span",
    {
      className: Je("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", _d[l] ?? _d.disabled),
      title: l === "error" && i ? i : l
    }
  );
}
function yg({ title: l, onClose: i, children: u, testId: s }) {
  return Qo(
    /* @__PURE__ */ Qt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (c) => {
          c.target === c.currentTarget && i();
        },
        onKeyDown: (c) => {
          c.key === "Escape" && i();
        },
        children: /* @__PURE__ */ Qt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": l,
            "data-testid": s,
            children: [
              /* @__PURE__ */ Qt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: l }),
              u
            ]
          }
        )
      }
    ),
    document.body
  );
}
function xg(l) {
  return l.blocked && !l.stale ? "blocked" : l.status === "running" && !l.stale ? "working" : l.unseen ? "done" : "idle";
}
const Ao = {
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
function Oo(l, i) {
  return !!l.parentSessionId && l.parentSessionId !== l.id && i.some((u) => u.id === l.parentSessionId);
}
function wg(l) {
  const i = /* @__PURE__ */ new Map();
  for (const u of l)
    Oo(u, l) && i.set(u.parentSessionId, [...i.get(u.parentSessionId) ?? [], u]);
  return i.size ? l.filter((u) => !Oo(u, l)).flatMap((u) => [u, ...i.get(u.id) ?? []]) : l;
}
const yi = 6, Sd = 8;
function _g(l, i = {}) {
  const { minWidth: u = 220, align: s = "right", minSpaceAbove: c = 100 } = i, d = l.getBoundingClientRect(), p = window.innerWidth, m = window.innerHeight, y = s === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, b = d.top - yi - Sd, H = m - d.bottom - yi - Sd;
  return b >= c ? {
    position: "fixed",
    bottom: m - d.top + yi,
    ...y,
    minWidth: u,
    maxHeight: Math.min(b, m * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + yi,
    ...y,
    minWidth: u,
    maxHeight: Math.min(H, m * 0.75),
    overflowY: "auto"
  };
}
function Sg(l, i, u, s) {
  St.useEffect(() => {
    if (!l) return;
    function c(p) {
      const m = p.target, y = u.current?.contains(m) ?? !1, b = s.current?.contains(m) ?? !1;
      !y && !b && i(!1);
    }
    function d(p) {
      p.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", d);
    };
  }, [l]);
}
function zg({ icon: l, fallback: i }) {
  const [u, s] = St.useState(!1);
  return St.useEffect(() => s(!1), [l]), !l || u ? /* @__PURE__ */ Qt.jsx(Qt.Fragment, { children: i }) : /* @__PURE__ */ Qt.jsx("img", { src: l, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => s(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Eg = "1.3.0";
let cf = null;
const kg = (l) => {
  cf = l;
};
function At() {
  const l = cf ?? globalThis.perch;
  if (!l) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return l;
}
const Ng = (l) => At().subscribe?.(l) ?? (() => {
}), Tg = _g, Cg = globalThis.perch?.isMac !== !1, jg = (l) => ig(l, At().isMac !== !1), Mg = (l) => og(l), Ag = ({ className: l, ...i } = {}) => Je(ug(i), l), Og = dg, Rg = (l) => mg(l), Hg = pg, Ug = sf, Dg = of, Bg = (l) => Ao[l].color, qg = (l, i) => At().shortcutFor?.(l, i) ?? null, ji = (l, i) => At().command(l, i ?? {}) !== !1, Yg = (l, i, u) => At().startSession?.(l, i, u), Gg = globalThis.perch?.pickFolder ? (l) => At().pickFolder(l) : null;
function Me(l) {
  const i = St.useRef(l);
  return i.current = l, St.useSyncExternalStore(Ng, () => i.current(At()));
}
const Qg = (l = {}) => Me((i) => i.navigation({ showTerminals: !!l.showTerminals, sortByAttention: !!l.sortByAttention })), Vg = () => Me((l) => l.hosts()), Kg = () => Me((l) => l.sessionFolders());
function Xg() {
  const l = Me((i) => i.addProject?.() ?? Zg);
  return {
    status: l.status ?? "idle",
    error: l.error,
    hostId: l.hostId,
    add: (i, u, s) => {
      i.trim() && l.status !== "pending" && At().addProjectFolder?.(i, u, s);
    },
    clear: () => At().clearAddProject?.()
  };
}
const Zg = Object.freeze({ status: "idle" }), df = "perch.lastAgentChoice", Jg = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Lg = () => {
  const l = At().storage?.getItem(df);
  return l === "claude" || l === "codex" ? l : "claude";
};
function Wg(l) {
  const i = Me((c) => c.agentChoices?.(l) ?? Jg), [u, s] = St.useState(Lg);
  return St.useMemo(() => ({
    connected: !!i.connected,
    discovery: !!i.discovery,
    choices: i.choices ?? [],
    lastChoice: u,
    state: i.state ?? "ready",
    error: i.state === "error" ? i.error : void 0,
    rememberChoice: (c) => {
      c !== "claude" && c !== "codex" || (At().storage?.setItem(df, c), s(c));
    },
    manage: () => At().command("agents.manage", {})
  }), [i, u]);
}
function Fg(l) {
  St.useEffect(() => At().onRequest?.("add-project", l) ?? void 0, [l]);
}
function Ig(l) {
  const i = l.map((u) => ({ id: u.id, parentSessionId: u.parentId, session: u }));
  return wg(i).map((u) => ({ session: u.session, nested: Oo(u, i) }));
}
function $g({ id: l, plain: i, className: u }) {
  const s = Me((b) => b.session(l));
  if (!s) return null;
  const c = s.state ?? xg(s), d = Ao[c]?.color ?? Ao.unknown.color, p = s.provider, m = p === "claude" || p === "claude-agent-teams" || p === "omp", y = i ? Je("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", u) : Je("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", u);
  return St.createElement(
    "span",
    { className: y, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    St.createElement("span", { className: Je("inline-flex text-fg", m && "rounded-full bg-[#161616]") }, St.createElement(ff, { provider: p, size: 14 }))
  );
}
function ff({ provider: l, size: i = 14 }) {
  const u = At().agentIcon?.(l, i) ?? null, s = u?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return St.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": l ?? "unknown", "data-perch-markup": s, ...u && u.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Pg = ({ children: l }) => St.createElement(St.Fragment, null, l);
function tv(l, i) {
  const u = St.useRef(i);
  return u.current = i, St.useEffect(() => {
    const s = At();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${l} cannot open`);
    const c = {};
    for (const [p, m] of Object.entries(u.current))
      c[p] = typeof m == "function" ? (...y) => u.current[p]?.(...y) : m;
    const d = s.openOverlay(l, c);
    return () => s.closeOverlay?.(d);
  }, [l]), null;
}
const tl = (l) => function(u) {
  return tv(l, u);
}, ev = tl("session-menu"), av = tl("new-session-menu"), lv = tl("confirm");
let mf = null;
const nv = (l) => {
  mf = l;
};
function iv(l) {
  return St.createElement(mf ?? lv, l);
}
function rv({ value: l, onChange: i, options: u = [], className: s, ariaLabel: c, testId: d, title: p, disabled: m, placeholder: y }) {
  const b = St.useRef(null), H = u.find((M) => M.value === l);
  return St.createElement(
    "button",
    {
      type: "button",
      ref: b,
      title: p,
      disabled: m,
      "aria-label": c,
      "data-testid": d,
      "aria-haspopup": "listbox",
      className: Je("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
      onClick: () => At().openOverlay?.("select", { value: l, options: u, onChange: (M) => i?.(M), anchor: b.current?.getBoundingClientRect() })
    },
    St.createElement("span", { className: "min-w-0 flex-1 truncate" }, H ? H.label : y ?? "")
  );
}
const ov = tl("folder-browser"), sv = tl("instructions"), uv = tl("memory"), cv = yg;
function dv({ hostId: l, path: i, className: u }) {
  const s = St.useRef(null);
  return St.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Je("worktree-menu__btn", of, u),
      "data-testid": `worktree-menu-${l}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => At().openOverlay?.("worktree", { hostId: l, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    St.createElement(uf, null)
  );
}
const fv = (l, i) => At().beginReorderDrag?.(l, i), mv = () => Me((l) => l.workspaceTabs()), pv = () => Me((l) => l.statusLine()), hv = () => Me((l) => l.zoom()), gv = () => Me((l) => l.paneLook()), vv = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function bv(l) {
  const i = !!l?.keepFresh, u = Me((c) => c.statusLine?.().connected ?? !1), s = Me((c) => c.planUsage?.() ?? vv);
  return St.useEffect(() => {
    if (!i || !u) return;
    let c;
    const d = () => {
      At().command("usage.get"), c = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(c);
  }, [i, u]), s;
}
const yv = () => At().command("usage.get", { force: !0 }), xv = (l) => At().command("usage.redeemReset", { accountId: l }), wv = () => ji("app.zoom_reset"), _v = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Sv = (l, i, u) => At().beginTabDrag?.(l, i, u);
function zv(l) {
  St.useEffect(() => At().onRequest?.("new-tab", l) ?? void 0, [l]);
}
const Ev = (l) => ji("browser.open", { workspaceId: l }), kv = (l, i) => ji("file.open", { workspaceId: l, path: i }), Nv = () => null, Tv = () => null, Cv = tl("new-file"), Kv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: ff,
  CloseIcon: vg,
  ConfirmDialog: iv,
  Dialog: cv,
  EllipsisIcon: hg,
  FolderBrowser: ov,
  GearIcon: gg,
  HostStateDot: bg,
  InstructionsDialog: sv,
  MemoryDialog: uv,
  NewFilePrompt: Cv,
  NewSessionMenu: av,
  PageIcon: zg,
  PlusIcon: uf,
  Select: rv,
  SessionDot: $g,
  SessionMenu: ev,
  Slot: Pg,
  TabDragLayer: Tv,
  TabMenu: Nv,
  WorktreeMenu: dv,
  agentStateColor: Bg,
  anchoredPopoverStyle: Tg,
  beginReorderDrag: fv,
  beginTabDrag: Sv,
  bindHost: kg,
  buttonClass: Og,
  cn: Je,
  drawConfirmationsInPlace: nv,
  ghostButton: Ug,
  iconButton: Dg,
  isMac: Cg,
  keyLabel: jg,
  menuDividerClass: Hg,
  menuItemClass: Rg,
  menuPanel: fg,
  nestSessions: Ig,
  openBrowserTab: Ev,
  openFileTab: kv,
  pickFolder: Gg,
  redeemUsageReset: xv,
  refreshUsage: yv,
  resetZoom: wv,
  rowActionClass: Ag,
  runCommand: ji,
  segmentClass: Mg,
  shortcutFor: qg,
  startSession: Yg,
  tabStateClass: _v,
  useAddProject: Xg,
  useAddProjectRequest: Fg,
  useAgentChoices: Wg,
  useDismissOnOutsideClick: Sg,
  useHosts: Vg,
  useNavigation: Qg,
  useNewTabRequest: zv,
  usePaneLook: gv,
  usePlanUsage: bv,
  useSessionFolders: Kg,
  useStatusLine: pv,
  useWorkspaceTabs: mv,
  useZoom: hv,
  version: Eg
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
const Xo = {
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
  Xo[l] = (i, u) => i[l](u);
const Xv = Object.keys(Xo);
function zd(l, i) {
  for (const [u, s] of Object.entries(i)) {
    const c = Xo[u];
    if (!c) throw new Error(`the description key ${u} has no GPUI builder`);
    s != null && (l = c(l, s));
  }
  return l;
}
const Cl = (l) => ({ clientX: l?.position?.x ?? 0, clientY: l?.position?.y ?? 0 });
function jv(l, i, u) {
  if (l.name) return l.name;
  if (!(i.size || l.hover || l.focus || l.active || l.track_hover || u)) return null;
  const s = l.meta?.attrs["data-testid"];
  return s ? `~${l.id}:${s}` : `~${l.id}`;
}
const je = (l) => l.style?.display !== "hidden";
function Ro(l, i, u, s, c = !1, d = !1, p = null, m = {}, y = !1, b = /* @__PURE__ */ new Map()) {
  if (l.kind === "text") return b.get(l)?.text ?? l.text;
  d ||= l.style.opacity === 0 || l.style.visibility === "invisible", d && (l.name || l.range_name) && (l = { ...l, name: void 0, range_name: void 0 }), p = l.style.text_color ?? p;
  const H = !!l.hover?.text_color && vf(l);
  H && u.hovered?.(l.id) && (p = l.hover.text_color), m = { ...m };
  for (const T of ["text_size", "line_height", "whitespace", "text_ellipsis"]) l.style[T] !== void 0 && (m[T] = l.style[T]);
  const M = new Set(l.events ?? []);
  let h;
  l.kind === "image" && !l.markup ? h = i.image(l.src) : h = i.div(), l.markup && (h = h.child(s.icon(`~icon-${l.id}`, l.markup, l.kind === "svg" ? p : "")));
  const C = jv(l, M, c);
  C && (h = h.id(C)), h = zd(h, { ...l.style, ...b.get(l) });
  const S = m.whitespace !== "nowrap" && !m.text_ellipsis;
  y && S && l.style.flex_shrink !== 0 && l.style.min_w === void 0 && (l.children ?? []).some((T) => T.kind === "text") && (h = h.min_w(0));
  for (const T of ["hover", "focus", "active"]) l[T] && (h = h[T]((R) => zd(R, l[T])));
  if (i.scroll && (l.style.overflow_x === "scroll" || l.style.overflow_y === "scroll")) {
    const T = u.document?.scrollTarget, R = T ? (l.children ?? []).filter(je).findIndex((z) => gf(z, T.id)) : -1;
    if (R >= 0 && (u.scroller ?? l.id) === l.id && (u.document.scrollTarget = null, u.scroller = l.id, i.scroll.scroll_to_item(R)), u.scroller ??= l.id, u.scroller === l.id && u.document) {
      h = h.track_scroll(i.scroll);
      const z = (l.children ?? []).filter(je).map((w) => w.id);
      u.document.itemBounds = (w) => z.includes(w) ? i.scroll.item_bounds?.(z.indexOf(w)) ?? null : null;
    }
  }
  l.kind === "input" && !l.disabled && (h = h.on_mouse_down("left", (T, R) => {
    u.focus(l.id), R.notify();
  }));
  const x = l.kind === "input" ? l : l.meta?.tag === "label" ? hf(l) : null;
  x && !x.disabled && /^(checkbox|radio)$/.test(x.input_type) && (h = h.on_click((T, R) => {
    R.stop_propagation?.(), u.toggle(x.id), R.notify();
  }));
  const E = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((T) => M.has(T));
  if (E && (h = h.on_mouse_down("left", (T, R) => {
    R.stop_propagation?.(), T.bounds && u.setBounds(l.id, T.bounds);
    const z = { ...Cl(T), button: 0, buttons: 1, detail: T.click_count };
    u.dispatch(l.id, "pointerdown", { ...z, pointerType: "mouse" }), u.dispatch(l.id, "mousedown", z), R.notify();
  }), h = h.on_mouse_down("right", (T, R) => {
    R.stop_propagation?.(), T.bounds && u.setBounds(l.id, T.bounds), u.dispatch(l.id, "contextmenu", { ...Cl(T), button: 2 }), R.notify();
  }), h = h.on_mouse_up("left", (T, R) => {
    R.stop_propagation?.();
    const z = { ...Cl(T), button: 0 };
    u.dispatch(l.id, "pointerup", { ...z, pointerType: "mouse" }), u.dispatch(l.id, "mouseup", z), R.notify();
  }), h = h.on_click((T, R) => {
    u.dispatch(l.id, T.click_count === 2 && M.has("double_click") ? "dblclick" : "click", { detail: T.click_count, button: 0 }), R.notify();
  })), l.blocks_pointer && !E)
    for (const T of ["left", "right"]) h = h.on_mouse_down(T, (R, z) => z.stop_propagation?.());
  if (M.has("mouse_move") && (h = h.on_mouse_move((T, R) => {
    u.dispatch(l.id, "pointermove", { ...Cl(T), pointerType: "mouse" }), R.notify();
  })), (l.track_hover || H) && (h = h.on_hover((T, R) => {
    u.hover(l.id, T), R.notify();
  })), c && (h = h.on_mouse_down_out((T, R) => {
    u.dispatch(u.document.body.id, "pointerdown", { ...Cl(T), pointerType: "mouse" }), u.dispatch(u.document.body.id, "mousedown", Cl(T)), R.notify();
  })), l.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(l.input_type)) {
    const T = l.value ? String(l.value) : String(l.placeholder ?? "");
    let R = i.div().whitespace_nowrap().overflow_x_hidden();
    const z = $a(m);
    z && (R = R.h(z)), !l.value && p && (R = R.text_color(Av(p))), T && (h = h.child(R.child(l.input_type === "password" && l.value ? "•".repeat([...T].length) : T))), l.field_w && (h = h.child(i.div().w(l.field_w).h(0)));
  }
  const U = m.whitespace === "nowrap" ? $a(m) : null, v = l.style.display === "flex" && !String(l.style.flex_direction ?? "row").startsWith("col");
  let N = !l.range_name;
  const D = l.style.display === "flex" && String(l.style.flex_direction ?? "row").startsWith("col") && (l.style.h === void 0 || l.style.h === "auto") && typeof l.style.max_h == "number";
  for (const T of (l.children ?? []).filter(je)) {
    const R = T.style?.flex_basis;
    D && T.style.flex_grow > 0 && (R === 0 || typeof R == "string" && R.endsWith("%")) && b.set(T, { ...b.get(T), flex_basis: "auto" });
    let z = Ro(T, i, u, s, !1, d, p, m, v && T.style?.position !== "absolute", b);
    const w = !N && (T.kind === "text" || !T.meta), q = T.kind === "text" ? b.get(T)?.h ?? U : null, F = T.kind === "text" ? b.get(T)?.w : void 0;
    if (w || q || F !== void 0) {
      let ot = i.div();
      w && (ot = ot.id(l.range_name)), w && !v && l.style.display === "flex" && (ot = ot[`self_${Mv[m.text_align] ?? "start"}`]().max_w("100%")), q && (ot = ot.h(q)), F !== void 0 && (ot = ot.w(F).flex_none().whitespace_nowrap()), z = ot.child(z), N ||= w;
    }
    h = h.child(z);
  }
  return h;
}
const Mv = { center: "center", right: "end", end: "end" };
function Av(l) {
  const i = String(l);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return l;
  const u = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(u / 2).toString(16).padStart(2, "0")}`;
}
const pf = /^[!-,.-~]+$/, hf = (l) => {
  for (const i of l.children ?? []) {
    if (i.kind === "input" && /^(checkbox|radio)$/.test(i.input_type)) return i;
    const u = i.kind === "text" ? null : hf(i);
    if (u) return u;
  }
  return null;
}, gf = (l, i) => l.id === i || (l.children ?? []).some((u) => u.kind !== "text" && gf(u, i)), vf = (l) => !!l.markup || (l.children ?? []).some((i) => i.kind !== "text" && vf(i));
function $a(l) {
  const i = l.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof l.text_size == "number" ? i * l.text_size : null;
}
function Zv(l, i, u, s, c = 0) {
  const d = [l.root, ...l.overlays], p = c > 0 ? qv(d, c) : /* @__PURE__ */ new Map();
  c > 0 && s.measure && Ov(d, c, s.measure, p), Dv(d, p), Uv(d, p), s.measure && Hv(d, s.measure, p);
  let m = i.div().relative().size_full().child(Ro(l.root, i, u, s, !1, !1, null, {}, !1, p));
  for (const y of l.overlays) m = m.child(Ro(y, i, u, s, !0, !1, null, {}, !1, p));
  return m;
}
function Ov(l, i, u, s) {
  const c = (S, x) => s.set(S, { ...s.get(S), ...x }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function y(S, x, E) {
    if (S.kind === "text") {
      if (!(x.whitespace === "nowrap" || pf.test(S.text)) || x.text_ellipsis || E || typeof x.text_size != "number") return NaN;
      const z = u(S.text, { size: x.text_size, weight: x.font_weight ?? 400, family: x.font_family ?? ".SystemUIFont", italic: !!x.italic });
      return Number.isFinite(z) ? z : NaN;
    }
    if (!je(S) || S.kind === "input" || S.markup) return b(S);
    const U = { ...x };
    for (const R of m) S.style[R] !== void 0 && (U[R] = S.style[R]);
    p.set(S, U);
    const v = S.style, N = (S.children ?? []).filter(Ze), D = N.map((R) => y(R, U, E || !!S.tabular));
    let T = b(S);
    if (!Number.isFinite(T) && v.w === void 0) {
      const R = N.map((w, q) => D[q] + (w.kind === "text" ? 0 : W(w.style.ml) + W(w.style.mr)));
      let z;
      N.length ? qe(S) ? z = N.some((w) => w.kind !== "text" && w.style.flex_grow > 0) || v.flex_wrap === "wrap" ? NaN : R.reduce((w, q) => w + q, 0) + W(v.gap_x) * (N.length - 1) : z = Math.max(...R) : z = 0, T = z + W(v.pl) + W(v.pr) + W(v.border_l) + W(v.border_r), typeof v.min_w == "number" && (T = Math.max(T, v.min_w)), typeof v.max_w == "number" && (T = Math.min(T, v.max_w));
    }
    return d.set(S, T), T;
  }
  const b = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, H = () => ({ exact: 0, laid: 0 }), M = (S, x) => {
    if (!Number.isFinite(x))
      return Object.assign(S, H()), NaN;
    S.exact += x;
    const E = Math.round(S.exact * i + 1e-9) / i, U = E - S.laid;
    return S.laid = E, U;
  }, h = (S) => qe(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function C(S) {
    if (!S || S.kind === "text" || !je(S)) return;
    const x = (S.children ?? []).filter(Ze);
    if (h(S) && x.length > 1) {
      const E = W(S.style.gap_x), U = H(), v = !(E && x.some((N) => N.kind === "text"));
      c(S, { border_l: M(U, W(S.style.border_l)), pl: M(U, W(S.style.pl)) }), v && E && c(S, { gap_x: 0 }), x.forEach((N, D) => {
        const T = (D && v ? E : 0) + (N.kind === "text" ? 0 : W(N.style.ml));
        if (N.kind === "text")
          T && Object.assign(U, H());
        else {
          const q = M(U, T);
          Number.isFinite(q) && c(N, { ml: q });
        }
        const R = N.kind === "text" ? p.get(S) ?? {} : null, z = N.kind === "text" ? y(N, R, !!S.tabular) : d.get(N);
        if ((N.kind === "text" || !(N.style.flex_grow > 0)) && Number.isFinite(z) ? c(N, { w: M(U, z) }) : Object.assign(U, H()), N.kind !== "text") {
          const q = M(U, W(N.style.mr));
          Number.isFinite(q) && c(N, { mr: q });
        }
      });
    }
    for (const E of S.children ?? []) E.kind !== "text" && C(E);
  }
  for (const S of l)
    S && (y(S, {}, !1), C(S));
}
const Rv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Hv(l, i, u) {
  const s = ["text_size", "font_weight", "font_family", "italic", "line_height"], c = (m) => typeof m == "number" ? m : 0, d = (m, y) => y && Ni(y) && !qe(y) && m.style.position !== "absolute" && !["start", "center", "end"].includes(m.style.self) && !["start", "center", "end"].includes(y.style.items), p = (m, y, b, H) => {
    if (!m || m.kind === "text" || !je(m)) return;
    const M = m.style;
    let h = typeof M.w == "number" ? M.w : M.w === "100%" ? b : d(m, y) ? b - c(M.ml) - c(M.mr) : NaN;
    typeof M.max_w == "number" && (h = Math.min(h, M.max_w));
    const C = h - c(M.pl) - c(M.pr) - c(M.border_l) - c(M.border_r), S = { ...H };
    for (const E of s) M[E] !== void 0 && (S[E] = M[E]);
    const x = m.children ?? [];
    if (m.break_anywhere && Number.isFinite(C) && C > 0 && typeof S.text_size == "number" && x.length && x.every((E) => E.kind === "text")) {
      const E = { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic }, U = (D) => i(D.trimEnd(), E) <= C + 0.01;
      let v = 0;
      for (const D of x) {
        const T = [];
        for (const z of D.text.split(`
`)) {
          let w = "";
          for (const q of z.split(Rv)) {
            if (U(w + q)) {
              w += q;
              continue;
            }
            w && T.push(w.trimEnd()), w = "";
            for (const F of q)
              w && !U(w + F) && (T.push(w), w = ""), w += F;
          }
          T.push(w.trimEnd());
        }
        const R = T.join(`
`);
        T.every((z) => !z || U(z)) ? R !== D.text && u.set(D, { ...u.get(D), text: R }) : v = NaN, v += T.length;
      }
      const N = $a(S);
      Number.isFinite(v) && N && M.h === void 0 && x.length === 1 && u.set(m, { ...u.get(m), h: v * N + c(M.pt) + c(M.pb) + c(M.border_t) + c(M.border_b) });
    }
    for (const E of x) p(E, m, qe(m) ? NaN : C, S);
  };
  for (const m of l) p(m, null, NaN, {});
}
function Uv(l, i) {
  const u = (s, c) => {
    if (!s || s.kind === "text" || !je(s)) return;
    const d = s.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : c && typeof d.w != "number";
    if (p && qe(s))
      for (const m of s.children ?? []) {
        const y = m.kind === "text" ? void 0 : m.style.flex_basis;
        m.kind !== "text" && m.style.flex_grow > 0 && (y === 0 || typeof y == "string" && y.endsWith("%")) && i.set(m, { ...i.get(m), flex_basis: "auto" });
      }
    for (const m of s.children ?? []) u(m, p);
  };
  for (const s of l) u(s, !1);
}
function Dv(l, i) {
  const u = i.heights ?? /* @__PURE__ */ new Map(), s = (m) => u.get(m), c = (m) => {
    const y = m.style, b = (m.children ?? []).filter(Ze);
    if (!b.length || qe(m)) return NaN;
    let H = 0;
    for (const M of b) {
      const h = s(M);
      if (!Number.isFinite(h)) return NaN;
      H += h + (M.kind === "text" ? 0 : W(M.style.mt) + W(M.style.mb));
    }
    return H + (y.display === "flex" ? W(y.gap_y) * (b.length - 1) : 0) + W(y.pt) + W(y.pb);
  }, d = (m, y) => {
    const b = m.style;
    if (typeof b.h == "number") return b.h;
    if (typeof b.max_h == "number") return b.max_h;
    if (!y || !Ni(y) || qe(y)) return NaN;
    const H = y.style, M = typeof H.h == "number" ? H.h : typeof H.max_h == "number" ? H.max_h : NaN, h = (y.children ?? []).filter(Ze);
    let C = 0;
    for (const x of h) {
      if (x === m) continue;
      const E = s(x);
      if (!Number.isFinite(E)) return NaN;
      C += E + (x.kind === "text" ? 0 : W(x.style.mt) + W(x.style.mb));
    }
    const S = H.display === "flex" ? W(H.gap_y) * Math.max(0, h.length - 1) : 0;
    return M - W(H.pt) - W(H.pb) - W(H.border_t) - W(H.border_b) - C - S - W(b.mt) - W(b.mb);
  }, p = (m, y) => {
    if (!(!m || m.kind === "text" || !je(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const b = c(m), H = d(m, y);
        Number.isFinite(b) && Number.isFinite(H) && b > H + 0.01 && i.set(m, { ...i.get(m), pr: W(m.style.pr) + m.scrollbar });
      }
      for (const b of m.children ?? []) p(b, m);
    }
  };
  for (const m of l) p(m, null);
}
const Bv = ["text_size", "line_height", "whitespace", "text_ellipsis"], W = (l) => l == null ? 0 : typeof l == "number" ? l : NaN, Ni = (l) => l.style.display === "flex" ? l.style.flex_direction === "col" : !0, qe = (l) => l.style.display === "flex" && (l.style.flex_direction ?? "row") === "row", Ze = (l) => l.kind === "text" || je(l) && l.style.position !== "absolute";
function qv(l, i) {
  const u = /* @__PURE__ */ new Map(), s = (x, E) => u.set(x, { ...u.get(x), ...Object.fromEntries(Object.entries(E).filter(([, U]) => Number.isFinite(U))) }), c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(x, E) {
    if (x.kind === "text") return E.whitespace === "nowrap" || pf.test(x.text) ? $a(E) ?? NaN : NaN;
    const U = { ...E };
    for (const R of Bv) x.style[R] !== void 0 && (U[R] = x.style[R]);
    d.set(x, U);
    const v = x.style, N = (x.children ?? []).filter(Ze), D = N.map((R) => p(R, U));
    let T;
    if (v.h !== void 0 && v.h !== "auto") T = W(v.h);
    else if (x.kind === "input")
      T = (x.input_type === "textarea" || x.input_type === "select" ? NaN : $a(U) ?? NaN) + W(v.pt) + W(v.pb) + W(v.border_t) + W(v.border_b), v.min_h !== void 0 && (T = Math.max(T, W(v.min_h)));
    else {
      const R = N.map((w, q) => (w.kind === "text" ? 0 : W(w.style.mt) + W(w.style.mb)) + D[q]);
      let z;
      if (qe(x)) z = v.flex_wrap === "wrap" ? NaN : v.items === "baseline" ? y(N, D, U) : Math.max(0, ...R);
      else if (Ni(x)) {
        const w = N.some((F) => F.kind !== "text" && (F.style.flex_grow > 0 || F.style.flex_basis !== void 0)), q = v.display !== "flex" && N.some((F) => F.kind !== "text" && (W(F.style.mt) || W(F.style.mb)));
        z = w || q ? NaN : R.reduce((F, ot) => F + ot, 0) + (v.display === "flex" ? W(v.gap_y) * Math.max(0, N.length - 1) : 0);
      } else z = NaN;
      T = z + W(v.pt) + W(v.pb) + W(v.border_t) + W(v.border_b), v.min_h !== void 0 && (T = Math.max(T, W(v.min_h))), v.max_h !== void 0 && (T = Math.min(T, W(v.max_h)));
    }
    return c.set(x, T), T;
  }
  const m = (x) => ($a(x) - (zi + qd) * x.text_size) / 2 + zi * x.text_size;
  function y(x, E, U) {
    let v = 0, N = 0;
    for (const [D, T] of x.entries()) {
      const R = T.kind === "text" ? U : d.get(T);
      if (!(T.kind === "text" || (T.children ?? []).filter(Ze).every((F) => F.kind === "text")) || !Number.isFinite(E[D]) || typeof R.text_size != "number") return NaN;
      const w = T.kind === "text" ? {} : T.style, q = W(w.mt) + W(w.border_t) + W(w.pt) + m(R);
      v = Math.max(v, q), N = Math.max(N, W(w.mt) + E[D] + W(w.mb) - q);
    }
    return v + N;
  }
  const b = () => ({ exact: 0, laid: 0 }), H = (x, E) => {
    if (!Number.isFinite(E))
      return Object.assign(x, b()), NaN;
    x.exact += E;
    const U = Math.round(x.exact * i + 1e-9) / i, v = U - x.laid;
    return x.laid = U, v;
  };
  function M(x) {
    if (!(x.kind === "text" || !je(x))) {
      for (const E of (x.children ?? []).filter((U) => U.kind !== "text" && je(U) && U.style.position === "absolute")) M(E);
      if (Ni(x) && !qe(x)) {
        const E = b();
        s(x, { border_t: H(E, W(x.style.border_t)), pt: H(E, W(x.style.pt)) }), h(x, E);
      } else for (const E of (x.children ?? []).filter(Ze)) E.kind !== "text" && M(E);
    }
  }
  function h(x, E) {
    const U = (x.children ?? []).filter(Ze), v = x.style.display === "flex" ? W(x.style.gap_y) : 0;
    if (v && U.some((N) => N.kind === "text")) {
      for (const N of U) N.kind !== "text" && M(N);
      return !1;
    }
    return v && s(x, { gap_y: 0 }), U.forEach((N, D) => {
      if (N.kind === "text") {
        const T = c.get(N) ?? p(N, d.get(x) ?? {});
        Number.isFinite(T) ? s(N, { h: H(E, T) }) : Object.assign(E, b());
        return;
      }
      if (s(N, { mt: H(E, (D ? v : 0) + W(N.style.mt)) }), Number.isFinite(c.get(N))) S(N, E);
      else if (C(N)) {
        const T = N.style;
        s(N, { border_t: H(E, W(T.border_t)), pt: H(E, W(T.pt)) }), s(N, { pb: H(E, W(T.pb)), border_b: H(E, W(T.border_b)) });
      } else
        M(N), Object.assign(E, b());
      s(N, { mb: H(E, W(N.style.mb)) });
    }), !0;
  }
  function C(x) {
    const E = x.style, U = (x.children ?? []).filter(Ze), v = $a(d.get(x) ?? {});
    return x.kind === "div" && !qe(x) && U.length > 0 && U.every((N) => N.kind === "text") && Number.isInteger(v) && [E.h, E.min_h, E.max_h].every((N) => N === void 0 || N === "auto");
  }
  function S(x, E) {
    const U = x.style;
    for (const R of (x.children ?? []).filter((z) => z.kind !== "text" && je(z) && z.style.position === "absolute")) M(R);
    const v = E.laid, N = E.exact;
    s(x, { border_t: H(E, W(U.border_t)), pt: H(E, W(U.pt)) });
    const D = U.h !== void 0 && U.h !== "auto", T = c.get(x) - W(U.pt) - W(U.pb) - W(U.border_t) - W(U.border_b);
    if (x.kind === "input")
      D || H(E, T);
    else if (qe(x) || D && (U.justify ?? "start") !== "start") {
      for (const R of (x.children ?? []).filter(Ze)) R.kind !== "text" && M(R);
      D || H(E, T);
    } else !h(x, E) && !D && H(E, T);
    if (D) {
      E.exact = N + c.get(x), E.laid = Math.round(E.exact * i + 1e-9) / i, s(x, { h: E.laid - v });
      return;
    }
    s(x, { pb: H(E, W(U.pb)), border_b: H(E, W(U.border_b)) }), s(x, { h: E.laid - v });
  }
  for (const x of l)
    p(x, {}), M(x);
  return Object.defineProperty(u, "heights", { value: c }), u;
}
const Jv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }] };
export {
  Jv as NAMED_ELEMENTS,
  Yv as React,
  jh as SCHEMA,
  Xv as STYLE_KEYS,
  Zv as describeToGpui,
  Gv as jsxRuntime,
  Qv as mount,
  Vv as reactDom,
  Kv as sdk
};
