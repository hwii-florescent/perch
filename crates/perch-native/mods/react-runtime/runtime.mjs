function Yd(n, i) {
  for (var o = 0; o < i.length; o++) {
    const c = i[o];
    if (typeof c != "string" && !Array.isArray(c)) {
      for (const s in c)
        if (s !== "default" && !(s in n)) {
          const d = Object.getOwnPropertyDescriptor(c, s);
          d && Object.defineProperty(n, s, d.get ? d : {
            enumerable: !0,
            get: () => c[s]
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
class ke extends Error {
}
const ih = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), rh = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), oh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...ih]);
function jo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, o, c) => o ? String.fromCodePoint(parseInt(o, 16)) : c);
}
function pi(n, i) {
  let o = i;
  for (; o < n.length; ) {
    const c = n[o];
    if (c === "\\") {
      o += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(c)) {
      o++;
      continue;
    }
    break;
  }
  if (o === i) throw new ke(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [jo(n.slice(i, o)), o];
}
function sh(n, i) {
  let o = 1;
  for (let c = i; c < n.length; c++) {
    const s = n[c];
    if (s === "\\") {
      c++;
      continue;
    }
    if (s === '"' || s === "'") {
      if (c = n.indexOf(s, c + 1), c < 0) break;
      continue;
    }
    if (s === "(") o++;
    else if (s === ")" && --o === 0) return c;
  }
  throw new ke(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Xo(n) {
  const i = [];
  let o = 0, c = 0;
  for (let s = 0; s < n.length; s++) {
    const d = n[s];
    if (d === "\\") {
      s++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (s = n.indexOf(d, s + 1), s < 0) break;
      continue;
    }
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (i.push(n.slice(c, s).trim()), c = s + 1);
  }
  return i.push(n.slice(c).trim()), i.filter(Boolean);
}
function ch(n, i) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let c = !1;
  for (; i < n.length; ) {
    const s = n[i];
    if (s === "*") {
      o.tag = "*", i++, c = !0;
      continue;
    }
    if (s === ".") {
      const [d, p] = pi(n, i + 1);
      o.classes.push(d), i = p, c = !0;
      continue;
    }
    if (s === "#") {
      const [d, p] = pi(n, i + 1);
      o.id = d, i = p, c = !0;
      continue;
    }
    if (s === "[") {
      const d = n.indexOf("]", i);
      if (d < 0) throw new ke(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(i + 1, d).trim(), m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!m) throw new ke(`cannot read the attribute selector [${p}]`);
      const y = m[3] ?? m[4] ?? m[5];
      o.attrs.push({ name: jo(m[1]).toLowerCase(), op: m[2] ?? null, value: y === void 0 ? null : jo(y) }), i = d + 1, c = !0;
      continue;
    }
    if (s === ":") {
      if (n[i + 1] === ":") throw new ke(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = pi(n, i + 1);
      i = p;
      const m = d.toLowerCase();
      if (n[i] === "(") {
        if (!rh.has(m)) throw new ke(`:${m}() is not supported`);
        const y = sh(n, i + 1), w = n.slice(i + 1, y).trim();
        if (i = y + 1, m === "nth-child") {
          if (!/^\d+$/.test(w)) throw new ke(`:nth-child(${w}) is not supported (only a number)`);
          o.pseudos.push({ name: m, n: Number(w) });
        } else
          o.pseudos.push({ name: m, list: Xo(w).map(Zo) });
      } else {
        if (!oh.has(m)) throw new ke(`:${m} is not supported`);
        o.pseudos.push({ name: m });
      }
      c = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !c) {
      const [d, p] = pi(n, i);
      o.tag = d.toLowerCase(), i = p, c = !0;
      continue;
    }
    break;
  }
  if (!c) throw new ke(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [o, i];
}
function Zo(n) {
  const i = [];
  let o = 0, c = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, d] = ch(n, o);
    i.push({ compound: s, combinator: c }), o = d;
    let p = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, p = !0;
    if (o >= n.length) break;
    const m = n[o];
    if (m === ">")
      for (c = ">", o++; n[o] === " "; ) o++;
    else {
      if (m === "+" || m === "~") throw new ke(`the ${m} combinator is not supported`);
      if (p) c = " ";
      else throw new ke(`unexpected ${JSON.stringify(m)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new ke("empty selector");
  return i;
}
const Wu = /* @__PURE__ */ new Map();
function Oi(n) {
  let i = Wu.get(n);
  return i || (i = Xo(n).map(Zo), Wu.set(n, i)), i;
}
function Gd(n) {
  const i = [0, 0, 0], o = (c) => {
    i[0] += c[0], i[1] += c[1], i[2] += c[2];
  };
  for (const { compound: c } of n) {
    c.id && i[0]++, i[1] += c.classes.length + c.attrs.length, c.tag && c.tag !== "*" && i[2]++;
    for (const s of c.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(Gd).sort((p, m) => m[0] - p[0] || m[1] - p[1] || m[2] - p[2])[0];
          o(d);
        } else i[1]++;
  }
  return i;
}
function uh(n, { name: i, op: o, value: c }) {
  const s = n.getAttribute(i);
  if (s == null) return !1;
  if (o === null) return !0;
  switch (o) {
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
function hi(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function dh(n, i, o, c) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const s = n.classList ?? [];
    for (const d of i.classes) if (!s.includes(d)) return !1;
  }
  for (const s of i.attrs) if (!uh(n, s)) return !1;
  for (const s of i.pseudos)
    switch (s.name) {
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
        if (hi(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => On(n, d, o, c))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((d) => On(n, d, o, c))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, s.name, c)) return !1;
    }
  return !0;
}
function On(n, i, o, c = !0) {
  const s = (d, p, m) => {
    const { compound: y, combinator: w } = i[p];
    if (!dh(d, y, o, m)) return !1;
    if (p === 0) return !0;
    if (w === ">") return !!d.parentElement && s(d.parentElement, p - 1, !1);
    for (let A = d.parentElement; A; A = A.parentElement) if (s(A, p - 1, !1)) return !0;
    return !1;
  };
  return s(n, i.length - 1, c);
}
function mh(n, i, o = {}) {
  return (typeof i == "string" ? Oi(i) : i).some((s) => On(n, s, o));
}
function Qd(n, i, o = {}) {
  return On(n, i, o);
}
function fl(n, i, o = {}) {
  const c = Oi(i), s = [], d = (p) => {
    for (const m of p.children)
      c.some((y) => On(m, y, o)) && s.push(m), d(m);
  };
  return d(n), s;
}
function Kd(n, i, o = {}) {
  const c = Oi(i);
  for (let s = n; s; s = s.parentElement) if (c.some((d) => On(s, d, o))) return s;
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
let fh = 1;
class Mo {
  constructor(i = 0, o = 0, c = 0, s = 0) {
    this.x = i, this.y = o, this.width = c, this.height = s;
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
class Jo {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, o, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners.some((d) => d.type === i && d.listener === o && d.capture === s) || this.listeners.push({ type: i, listener: o, capture: s });
  }
  removeEventListener(i, o, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === i && d.listener === o && d.capture === s));
  }
}
class Ri {
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
class re extends Jo {
  constructor(i, o = {}, c = null) {
    super(), this.nodeType = 1, this.id = `n${fh++}`, this.tagName = i.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = c, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof re ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((i) => i instanceof re);
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
    for (const [o, c] of Object.entries(this.props))
      o.startsWith("data-") && c != null && c !== !1 && (i[o.slice(5).replace(/-([a-z])/g, (s, d) => d.toUpperCase())] = String(c));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const o = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return o.id != null ? String(o.id) : null;
    if (i === "style") return null;
    let s = o[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (s === void 0 && !i.includes("-")) {
      const d = i.replace(/-([a-z])/g, (p, m) => m.toUpperCase());
      s = o[d];
    }
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(i) {
    return this.getAttribute(i) !== null;
  }
  appendChild(i) {
    return i.parentNode && i.parentNode.removeChild(i), i.parentNode = this, this.childNodes.push(i), this.touch(), i;
  }
  insertBefore(i, o) {
    i.parentNode && i.parentNode.removeChild(i);
    const c = this.childNodes.indexOf(o);
    return i.parentNode = this, c < 0 ? this.childNodes.push(i) : this.childNodes.splice(c, 0, i), this.touch(), i;
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
    return mh(this, i);
  }
  closest(i) {
    return Kd(this, i);
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
    return i ? new Mo(i.x, i.y, i.width, i.height) : new Mo();
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
  /** `element.style`: a write (`el.style.transform = ...`, `setProperty`) is kept on the element over its props'
   * `style` until the source writes that property again, and the next frame draws it, as in a page; a read is the
   * written value, else the props'. */
  get style() {
    if (this.styleView) return this.styleView;
    const i = this, o = (p) => String(p).startsWith("--") ? String(p) : String(p).replace(/-([a-z])/g, (m, y) => y.toUpperCase()), c = (p) => {
      const m = i.props.style?.[p];
      return m == null || typeof m == "boolean" ? "" : typeof m == "number" && m !== 0 ? `${m}px` : String(m);
    }, s = (p) => i.inline && p in i.inline ? i.inline[p] : c(p), d = (p, m) => {
      const y = m == null ? "" : String(m);
      s(p) !== y && (i.inline ??= {}, y === c(p) ? delete i.inline[p] : i.inline[p] = y, i.touch(), i.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (p, m) => {
        if (typeof m == "string")
          return m === "setProperty" ? (y, w) => d(o(y), w) : m === "removeProperty" ? (y) => {
            const w = s(o(y));
            return d(o(y), ""), w;
          } : m === "getPropertyValue" ? (y) => s(o(y)) : s(m);
      },
      set: (p, m, y) => (typeof m == "string" && d(m, y), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return Fu(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(i = []) {
    return Fu(this, i);
  }
}
const Ao = "perch-dom:", ph = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), hh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Fu(n, i = []) {
  const o = new Set(i.map((s) => hh[s] ?? s)), c = (s) => {
    if (!(s instanceof re)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [p, m] of Object.entries(s.props))
      ph.has(p) || o.has(p) || m == null || typeof m == "function" || typeof m == "symbol" || (d[p] = m);
    return { t: s.tagName, p: d, c: s.childNodes.map(c), ...s.hidden ? { h: 1 } : {} };
  };
  return Ao + JSON.stringify(c(n));
}
function gh(n, i) {
  if (typeof n != "string" || !n.startsWith(Ao)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(Ao.length));
  } catch {
    return null;
  }
  const c = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!c(d)) throw new Error("not a node");
    let p;
    if (typeof d.x == "string") p = new Ri(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !c(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      p = new re(d.t, d.p, i);
      for (const m of d.c) p.appendChild(s(m));
    }
    return p.hidden = d.h === 1, p;
  };
  try {
    return [s(o)];
  } catch {
    return null;
  }
}
class bh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class vh {
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
function Iu(n) {
  for (let i = n; i instanceof re; i = i.parentElement) i.touch();
}
class yh extends Jo {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new re("html", {}, this), this.body = new re("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new re(i, {}, this);
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, i.state.pointerFocus = !1, Iu(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, Iu(i), this.activeElement === i && (this.activeElement = this.body);
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
class xh extends Jo {
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
  setTimeout(i, o, ...c) {
    return globalThis.setTimeout(i, o, ...c);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function Vd(n) {
  return {
    setTimeout: (i, o = 0, ...c) => n.setTimeout(() => i(...c), Math.max(0, Number(o) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
const $u = Symbol.for("perch.react.globals");
function qe(n, i, o) {
  Object.defineProperty(n, i, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function wh(n, i = globalThis) {
  const o = new yh(n), c = new xh(n, o);
  o.defaultView = c;
  const s = n.storage ?? new vh();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const m = Vd(n);
    qe(i, "setTimeout", m.setTimeout), qe(i, "clearTimeout", m.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && qe(i, "queueMicrotask", (m) => {
    Promise.resolve().then(m);
  }), qe(i, "requestAnimationFrame", (m) => i.setTimeout(() => m(Date.now()), 0)), qe(i, "cancelAnimationFrame", (m) => i.clearTimeout(m));
  const d = { document: o, window: c, localStorage: s };
  for (const m of Object.keys(d))
    Object.defineProperty(i, m, { get: () => i[$u]?.[m], configurable: !0, enumerable: !1 });
  i[$u] = d, qe(i, "HTMLElement", re), qe(i, "Element", re), qe(i, "DOMRect", Mo), typeof i.ResizeObserver != "function" && qe(i, "ResizeObserver", bh);
  const p = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      qe(p, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || qe(i, "navigator", p), { document: o, window: c, globals: d };
}
function Oo(n, i = !1) {
  if (!(i ? n?.tagName === "input" && Xd(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let c = n.parentElement; c; c = c.parentElement) if (c.tagName === "form") return c;
  return null;
}
const Xd = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Pu = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Pu?.setTimeout == "function") {
  const n = Vd(Pu);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Lo(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var _o = { exports: {} }, ut = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var td;
function _h() {
  if (td) return ut;
  td = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), c = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), y = Symbol.for("react.suspense"), w = Symbol.for("react.memo"), A = Symbol.for("react.lazy"), D = Symbol.for("react.activity"), E = Symbol.iterator;
  function g(v) {
    return v === null || typeof v != "object" ? null : (v = E && v[E] || v["@@iterator"], typeof v == "function" ? v : null);
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
  }, _ = Object.assign, k = {};
  function q(v, G, tt) {
    this.props = v, this.context = G, this.refs = k, this.updater = tt || S;
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
  function N() {
  }
  N.prototype = q.prototype;
  function z(v, G, tt) {
    this.props = v, this.context = G, this.refs = k, this.updater = tt || S;
  }
  var j = z.prototype = new N();
  j.constructor = z, _(j, q.prototype), j.isPureReactComponent = !0;
  var O = Array.isArray;
  function T() {
  }
  var b = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
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
      return P = P(v), xt = $ === "" ? "." + Kt(v, 0) : $, O(P) ? (tt = "", xt != null && (tt = xt.replace(Mt, "$&/") + "/"), K(P, G, tt, "", function(Oa) {
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
    if (O(v))
      for (var dt = 0; dt < v.length; dt++)
        $ = v[dt], it = Jt + Kt($, dt), xt += K(
          $,
          G,
          tt,
          it,
          P
        );
    else if (dt = g(v), typeof dt == "function")
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
  return ut.Activity = D, ut.Children = Y, ut.Component = q, ut.Fragment = o, ut.Profiler = s, ut.PureComponent = z, ut.StrictMode = c, ut.Suspense = y, ut.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = b, ut.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(v) {
      return b.H.useMemoCache(v);
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
    var $ = _({}, v.props), P = v.key;
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
    return { $$typeof: m, render: v };
  }, ut.isValidElement = at, ut.lazy = function(v) {
    return {
      $$typeof: A,
      _payload: { _status: -1, _result: v },
      _init: lt
    };
  }, ut.memo = function(v, G) {
    return {
      $$typeof: w,
      type: v,
      compare: G === void 0 ? null : G
    };
  }, ut.startTransition = function(v) {
    var G = b.T, tt = {};
    b.T = tt;
    try {
      var $ = v(), P = b.S;
      P !== null && P(tt, $), typeof $ == "object" && $ !== null && typeof $.then == "function" && $.then(T, B);
    } catch (it) {
      B(it);
    } finally {
      G !== null && tt.types !== null && (G.types = tt.types), b.T = G;
    }
  }, ut.unstable_useCacheRefresh = function() {
    return b.H.useCacheRefresh();
  }, ut.use = function(v) {
    return b.H.use(v);
  }, ut.useActionState = function(v, G, tt) {
    return b.H.useActionState(v, G, tt);
  }, ut.useCallback = function(v, G) {
    return b.H.useCallback(v, G);
  }, ut.useContext = function(v) {
    return b.H.useContext(v);
  }, ut.useDebugValue = function() {
  }, ut.useDeferredValue = function(v, G) {
    return b.H.useDeferredValue(v, G);
  }, ut.useEffect = function(v, G) {
    return b.H.useEffect(v, G);
  }, ut.useEffectEvent = function(v) {
    return b.H.useEffectEvent(v);
  }, ut.useId = function() {
    return b.H.useId();
  }, ut.useImperativeHandle = function(v, G, tt) {
    return b.H.useImperativeHandle(v, G, tt);
  }, ut.useInsertionEffect = function(v, G) {
    return b.H.useInsertionEffect(v, G);
  }, ut.useLayoutEffect = function(v, G) {
    return b.H.useLayoutEffect(v, G);
  }, ut.useMemo = function(v, G) {
    return b.H.useMemo(v, G);
  }, ut.useOptimistic = function(v, G) {
    return b.H.useOptimistic(v, G);
  }, ut.useReducer = function(v, G, tt) {
    return b.H.useReducer(v, G, tt);
  }, ut.useRef = function(v) {
    return b.H.useRef(v);
  }, ut.useState = function(v) {
    return b.H.useState(v);
  }, ut.useSyncExternalStore = function(v, G, tt) {
    return b.H.useSyncExternalStore(
      v,
      G,
      tt
    );
  }, ut.useTransition = function() {
    return b.H.useTransition();
  }, ut.version = "19.2.8", ut;
}
var ed;
function Zd() {
  return ed || (ed = 1, _o.exports = _h()), _o.exports;
}
var ct = Zd();
const Sh = /* @__PURE__ */ Lo(ct), yv = /* @__PURE__ */ Yd({
  __proto__: null,
  default: Sh
}, [ct]);
var So = { exports: {} }, ul = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ad;
function kh() {
  if (ad) return ul;
  ad = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function o(c, s, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), s.key !== void 0 && (p = "" + s.key), "key" in s) {
      d = {};
      for (var m in s)
        m !== "key" && (d[m] = s[m]);
    } else d = s;
    return s = d.ref, {
      $$typeof: n,
      type: c,
      key: p,
      ref: s !== void 0 ? s : null,
      props: d
    };
  }
  return ul.Fragment = i, ul.jsx = o, ul.jsxs = o, ul;
}
var nd;
function zh() {
  return nd || (nd = 1, So.exports = kh()), So.exports;
}
var kt = zh();
const Eh = /* @__PURE__ */ Lo(kt), xv = /* @__PURE__ */ Yd({
  __proto__: null,
  default: Eh
}, [kt]);
var ko = { exports: {} }, zo = { exports: {} }, Eo = { exports: {} }, No = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ld;
function Nh() {
  return ld || (ld = 1, (function(n) {
    function i(K, nt) {
      var lt = K.length;
      K.push(nt);
      t: for (; 0 < lt; ) {
        var B = lt - 1 >>> 1, Y = K[B];
        if (0 < s(Y, nt))
          K[B] = nt, K[lt] = Y, lt = B;
        else break t;
      }
    }
    function o(K) {
      return K.length === 0 ? null : K[0];
    }
    function c(K) {
      if (K.length === 0) return null;
      var nt = K[0], lt = K.pop();
      if (lt !== nt) {
        K[0] = lt;
        t: for (var B = 0, Y = K.length, v = Y >>> 1; B < v; ) {
          var G = 2 * (B + 1) - 1, tt = K[G], $ = G + 1, P = K[$];
          if (0 > s(tt, lt))
            $ < Y && 0 > s(P, tt) ? (K[B] = P, K[$] = lt, B = $) : (K[B] = tt, K[G] = lt, B = G);
          else if ($ < Y && 0 > s(P, lt))
            K[B] = P, K[$] = lt, B = $;
          else break t;
        }
      }
      return nt;
    }
    function s(K, nt) {
      var lt = K.sortIndex - nt.sortIndex;
      return lt !== 0 ? lt : K.id - nt.id;
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
    var y = [], w = [], A = 1, D = null, E = 3, g = !1, S = !1, _ = !1, k = !1, q = typeof setTimeout == "function" ? setTimeout : null, N = typeof clearTimeout == "function" ? clearTimeout : null, z = typeof setImmediate < "u" ? setImmediate : null;
    function j(K) {
      for (var nt = o(w); nt !== null; ) {
        if (nt.callback === null) c(w);
        else if (nt.startTime <= K)
          c(w), nt.sortIndex = nt.expirationTime, i(y, nt);
        else break;
        nt = o(w);
      }
    }
    function O(K) {
      if (_ = !1, j(K), !S)
        if (o(y) !== null)
          S = !0, T || (T = !0, et());
        else {
          var nt = o(w);
          nt !== null && Tt(O, nt.startTime - K);
        }
    }
    var T = !1, b = -1, h = 5, U = -1;
    function J() {
      return k ? !0 : !(n.unstable_now() - U < h);
    }
    function at() {
      if (k = !1, T) {
        var K = n.unstable_now();
        U = K;
        var nt = !0;
        try {
          t: {
            S = !1, _ && (_ = !1, N(b), b = -1), g = !0;
            var lt = E;
            try {
              e: {
                for (j(K), D = o(y); D !== null && !(D.expirationTime > K && J()); ) {
                  var B = D.callback;
                  if (typeof B == "function") {
                    D.callback = null, E = D.priorityLevel;
                    var Y = B(
                      D.expirationTime <= K
                    );
                    if (K = n.unstable_now(), typeof Y == "function") {
                      D.callback = Y, j(K), nt = !0;
                      break e;
                    }
                    D === o(y) && c(y), j(K);
                  } else c(y);
                  D = o(y);
                }
                if (D !== null) nt = !0;
                else {
                  var v = o(w);
                  v !== null && Tt(
                    O,
                    v.startTime - K
                  ), nt = !1;
                }
              }
              break t;
            } finally {
              D = null, E = lt, g = !1;
            }
            nt = void 0;
          }
        } finally {
          nt ? et() : T = !1;
        }
      }
    }
    var et;
    if (typeof z == "function")
      et = function() {
        z(at);
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
      b = q(function() {
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
      return E;
    }, n.unstable_next = function(K) {
      switch (E) {
        case 1:
        case 2:
        case 3:
          var nt = 3;
          break;
        default:
          nt = E;
      }
      var lt = E;
      E = nt;
      try {
        return K();
      } finally {
        E = lt;
      }
    }, n.unstable_requestPaint = function() {
      k = !0;
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
      var lt = E;
      E = K;
      try {
        return nt();
      } finally {
        E = lt;
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
      }, lt > B ? (K.sortIndex = lt, i(w, K), o(y) === null && K === o(w) && (_ ? (N(b), b = -1) : _ = !0, Tt(O, lt - B))) : (K.sortIndex = Y, i(y, K), S || g || (S = !0, T || (T = !0, et()))), K;
    }, n.unstable_shouldYield = J, n.unstable_wrapCallback = function(K) {
      var nt = E;
      return function() {
        var lt = E;
        E = nt;
        try {
          return K.apply(this, arguments);
        } finally {
          E = lt;
        }
      };
    };
  })(No)), No;
}
var id;
function Th() {
  return id || (id = 1, Eo.exports = Nh()), Eo.exports;
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
var rd;
function Ch() {
  return rd || (rd = 1, (function(n) {
    n.exports = function(i) {
      function o(t, e, a, l) {
        return new uf(t, e, a, l);
      }
      function c() {
      }
      function s(t) {
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
          throw Error(s(188));
      }
      function m(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(s(188));
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
            throw Error(s(188));
          }
          if (a.return !== l.return) a = r, l = u;
          else {
            for (var f = !1, x = r.child; x; ) {
              if (x === a) {
                f = !0, a = r, l = u;
                break;
              }
              if (x === l) {
                f = !0, l = r, a = u;
                break;
              }
              x = x.sibling;
            }
            if (!f) {
              for (x = u.child; x; ) {
                if (x === a) {
                  f = !0, a = u, l = r;
                  break;
                }
                if (x === l) {
                  f = !0, l = u, a = r;
                  break;
                }
                x = x.sibling;
              }
              if (!f) throw Error(s(189));
            }
          }
          if (a.alternate !== l) throw Error(s(190));
        }
        if (a.tag !== 3) throw Error(s(188));
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
      function A(t) {
        return t === null || typeof t != "object" ? null : (t = pu && t[pu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function D(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === hf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case mn:
            return "Fragment";
          case Gr:
            return "Profiler";
          case mu:
            return "StrictMode";
          case Kr:
            return "Suspense";
          case Vr:
            return "SuspenseList";
          case Zr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case dn:
              return "Portal";
            case va:
              return t.displayName || "Context";
            case fu:
              return (t._context.displayName || "Context") + ".Consumer";
            case Qr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Xr:
              return e = t.displayName || null, e !== null ? e : D(t.type) || "Memo";
            case ya:
              e = t._payload, t = t._init;
              try {
                return D(t(e));
              } catch {
              }
          }
        return null;
      }
      function E(t) {
        return { current: t };
      }
      function g(t) {
        0 > hn || (t.current = $r[hn], $r[hn] = null, hn--);
      }
      function S(t, e) {
        hn++, $r[hn] = t.current, t.current = e;
      }
      function _(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Kp(t) / Vp | 0) | 0;
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
      function q(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, u = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var x = l & 134217727;
        return x !== 0 ? (l = x & ~u, l !== 0 ? r = k(l) : (f &= x, f !== 0 ? r = k(f) : a || (a = x & ~t, a !== 0 && (r = k(a))))) : (x = l & ~u, x !== 0 ? r = k(x) : f !== 0 ? r = k(f) : a || (a = l & ~t, a !== 0 && (r = k(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function N(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function z(t, e) {
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
      function O(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function T(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function b(t, e, a, l, r, u) {
        var f = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var x = t.entanglements, H = t.expirationTimes, Q = t.hiddenUpdates;
        for (a = f & ~a; 0 < a; ) {
          var Z = 31 - be(a), V = 1 << Z;
          x[Z] = 0, H[Z] = -1;
          var L = Q[Z];
          if (L !== null)
            for (Q[Z] = null, Z = 0; Z < L.length; Z++) {
              var mt = L[Z];
              mt !== null && (mt.lane &= -536870913);
            }
          a &= ~V;
        }
        l !== 0 && h(t, l, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(f & ~e));
      }
      function h(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var l = 31 - be(e);
        t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | a & 261930;
      }
      function U(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var l = 31 - be(a), r = 1 << l;
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
        if (typeof Wp == "function" && Fp(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode($n, t);
          } catch {
          }
      }
      function Kt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Tt(t) {
        if (eo === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            eo = e && e[1] || "", Yu = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + eo + t + Yu;
      }
      function K(t, e) {
        if (!t || ao) return "";
        ao = !0;
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
          var u = l.DetermineComponentFrameRoot(), f = u[0], x = u[1];
          if (f && x) {
            var H = f.split(`
`), Q = x.split(`
`);
            for (r = l = 0; l < H.length && !H[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < Q.length && !Q[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === H.length || r === Q.length)
              for (l = H.length - 1, r = Q.length - 1; 1 <= l && 0 <= r && H[l] !== Q[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (H[l] !== Q[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || H[l] !== Q[r]) {
                      var Z = `
` + H[l].replace(" at new ", " at ");
                      return t.displayName && Z.includes("<anonymous>") && (Z = Z.replace("<anonymous>", t.displayName)), Z;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          ao = !1, Error.prepareStackTrace = a;
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
          var a = Gu.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: lt(e)
          }, Gu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: lt(e)
        };
      }
      function Y(t, e) {
        bn[vn++] = Pn, bn[vn++] = Il, Il = t, Pn = e;
      }
      function v(t, e, a) {
        ze[Ee++] = Ve, ze[Ee++] = Xe, ze[Ee++] = xa, xa = t;
        var l = Ve;
        t = Xe;
        var r = 32 - be(l) - 1;
        l &= ~(1 << r), a += 1;
        var u = 32 - be(e) + r;
        if (30 < u) {
          var f = r - r % 5;
          u = (l & (1 << f) - 1).toString(32), l >>= f, r -= f, Ve = 1 << 32 - be(e) + r | a << r | l, Xe = u + t;
        } else
          Ve = 1 << u | a << r | l, Xe = t;
      }
      function G(t) {
        t.return !== null && (Y(t, 1), v(t, 1, 0));
      }
      function tt(t) {
        for (; t === Il; )
          Il = bn[--vn], bn[vn] = null, Pn = bn[--vn], bn[vn] = null;
        for (; t === xa; )
          xa = ze[--Ee], ze[Ee] = null, Xe = ze[--Ee], ze[Ee] = null, Ve = ze[--Ee], ze[Ee] = null;
      }
      function $(t, e) {
        ze[Ee++] = Ve, ze[Ee++] = Xe, ze[Ee++] = xa, Ve = e.id, Xe = e.overflow, xa = t;
      }
      function P(t, e) {
        S(wa, e), S(tl, t), S(Pt, null), t = vf(e), g(Pt), S(Pt, t);
      }
      function it() {
        g(Pt), g(tl), g(wa);
      }
      function xt(t) {
        t.memoizedState !== null && S($l, t);
        var e = Pt.current, a = yf(e, t.type);
        e !== a && (S(tl, t), S(Pt, a));
      }
      function Jt(t) {
        tl.current === t && (g(Pt), g(tl)), $l.current === t && (g($l), ta ? Ka._currentValue = fn : Ka._currentValue2 = fn);
      }
      function dt(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Rn(B(e, t)), no;
      }
      function Oa(t, e) {
        if (!ie) throw Error(s(175));
        yp(
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
        if (!ie || t !== te) return !1;
        if (!yt) return Ra(t), yt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Nu(t.type) && !Zl(t.type, t.memoizedProps)) && At && dt(t) : e !== 3 && (e !== 5 || Nu(t.type) && !Zl(t.type, t.memoizedProps)) && At && dt(t), Ra(t), e === 13) {
          if (!ie) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          At = kp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          At = Sp(t);
        } else
          At = Vt && e === 27 ? cp(
            t.type,
            At
          ) : te ? Eu(t.stateNode) : null;
        return !0;
      }
      function Oe() {
        ie && (At = te = null, yt = !1);
      }
      function ua() {
        var t = _a;
        return t !== null && (me === null ? me = t : me.push.apply(
          me,
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
        ta ? t._currentValue = e : t._currentValue2 = e, g(Pl);
      }
      function Bi(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function qi(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var f = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var x = u;
              u = r;
              for (var H = 0; H < e.length; H++)
                if (x.context === e[H]) {
                  u.lanes |= a, x = u.alternate, x !== null && (x.lanes |= a), Bi(
                    u.return,
                    a,
                    t
                  ), l || (f = null);
                  break t;
                }
              u = x.next;
            }
          } else if (r.tag === 18) {
            if (f = r.return, f === null) throw Error(s(341));
            f.lanes |= a, u = f.alternate, u !== null && (u.lanes |= a), Bi(f, a, t), f = null;
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
      function ln(t, e, a, l) {
        t = null;
        for (var r = e, u = !1; r !== null; ) {
          if (!u) {
            if ((r.flags & 524288) !== 0) u = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var f = r.alternate;
            if (f === null) throw Error(s(387));
            if (f = f.memoizedProps, f !== null) {
              var x = r.type;
              ye(r.pendingProps.value, f.value) || (t !== null ? t.push(x) : t = [x]);
            }
          } else if (r === $l.current) {
            if (f = r.alternate, f === null) throw Error(s(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ka) : t = [Ka]);
          }
          r = r.return;
        }
        t !== null && qi(
          e,
          t,
          a,
          l
        ), e.flags |= 262144;
      }
      function hl(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ye(
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
        return ts(Va, t);
      }
      function gl(t, e) {
        return Va === null && Ha(t), ts(t, e);
      }
      function ts(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(s(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function Yi() {
        return {
          controller: new $p(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Hn(t) {
        t.refCount--, t.refCount === 0 && Pp(th, function() {
          t.controller.abort();
        });
      }
      function bl() {
      }
      function Ge(t) {
        t !== yn && t.next === null && (yn === null ? ti = yn = t : yn = yn.next = t), ei = !0, lo || (lo = !0, qm());
      }
      function rn(t, e) {
        if (!io && ei) {
          io = !0;
          do
            for (var a = !1, l = ti; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var f = l.suspendedLanes, x = l.pingedLanes;
                  u = (1 << 31 - be(42 | t) + 1) - 1, u &= r & ~(f & ~x), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, is(l, u));
              } else
                u = vt, u = q(
                  l,
                  l === Ct ? u : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Qa
                ), (u & 3) === 0 || N(l, u) || (a = !0, is(l, u));
              l = l.next;
            }
          while (a);
          io = !1;
        }
      }
      function es() {
        as();
      }
      function as() {
        ei = lo = !1;
        var t = 0;
        Xa !== 0 && Tf() && (t = Xa);
        for (var e = ue(), a = null, l = ti; l !== null; ) {
          var r = l.next, u = ns(l, e);
          u === 0 ? (l.next = null, a === null ? ti = r : a.next = r, r === null && (yn = a)) : (a = l, (t !== 0 || (u & 3) !== 0) && (ei = !0)), l = r;
        }
        Xt !== 0 && Xt !== 5 || rn(t), Xa !== 0 && (Xa = 0);
      }
      function ns(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var f = 31 - be(u), x = 1 << f, H = r[f];
          H === -1 ? ((x & a) === 0 || (x & l) !== 0) && (r[f] = z(x, e)) : H <= e && (t.expiredLanes |= x), u &= ~x;
        }
        if (e = Ct, a = vt, a = q(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l = t.callbackNode, a === 0 || t === e && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && Pr(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || N(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && Pr(l), et(a)) {
            case 2:
            case 8:
              a = Jp;
              break;
            case 32:
              a = to;
              break;
            case 268435456:
              a = Lp;
              break;
            default:
              a = to;
          }
          return l = ls.bind(null, t), a = Fl(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && Pr(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function ls(t, e) {
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
        ), l === 0 ? null : (Gc(t, l, e), ns(t, ue()), t.callbackNode != null && t.callbackNode === a ? ls.bind(null, t) : null);
      }
      function is(t, e) {
        if (Ln()) return null;
        Gc(t, e, !0);
      }
      function qm() {
        Hf ? Df(function() {
          (gt & 6) !== 0 ? Fl(
            Bu,
            es
          ) : as();
        }) : Fl(
          Bu,
          es
        );
      }
      function Gi() {
        if (Xa === 0) {
          var t = xn;
          t === 0 && (t = Jl, Jl <<= 1, (Jl & 261888) === 0 && (Jl = 256)), Xa = t;
        }
        return Xa;
      }
      function Ym(t, e) {
        if (el === null) {
          var a = el = [];
          ro = 0, xn = Gi(), wn = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return ro++, e.then(rs, rs), e;
      }
      function rs() {
        if (--ro === 0 && el !== null) {
          wn !== null && (wn.status = "fulfilled");
          var t = el;
          el = null, xn = 0, wn = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Gm(t, e) {
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
      function Qi() {
        var t = Za.current;
        return t !== null ? t : Ct.pooledCache;
      }
      function vl(t, e) {
        e === null ? S(Za, Za.current) : S(Za, e.pool);
      }
      function os() {
        var t = Qi();
        return t === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: t
        };
      }
      function yl(t, e) {
        if (ye(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), l = Object.keys(e);
        if (a.length !== l.length) return !1;
        for (l = 0; l < a.length; l++) {
          var r = a[l];
          if (!Ip.call(e, r) || !ye(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function ss(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function cs(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(bl, bl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, ds(t), t;
          default:
            if (typeof e.status == "string") e.then(bl, bl);
            else {
              if (t = Ct, t !== null && 100 < t.shellSuspendCounter)
                throw Error(s(482));
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
                throw t = e.reason, ds(t), t;
            }
            throw Ja = e, _n;
        }
      }
      function Da(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ja = a, _n) : a;
        }
      }
      function us() {
        if (Ja === null) throw Error(s(459));
        var t = Ja;
        return Ja = null, t;
      }
      function ds(t) {
        if (t === _n || t === ai)
          throw Error(s(483));
      }
      function xl(t) {
        var e = al;
        return al += 1, Sn === null && (Sn = []), cs(Sn, t, e);
      }
      function Dn(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function wl(t, e) {
        throw e.$$typeof === ff ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function ms(t) {
        function e(M, C) {
          if (t) {
            var R = M.deletions;
            R === null ? (M.deletions = [C], M.flags |= 16) : R.push(C);
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
        function u(M, C, R) {
          return M.index = R, t ? (R = M.alternate, R !== null ? (R = R.index, R < C ? (M.flags |= 67108866, C) : R) : (M.flags |= 67108866, C)) : (M.flags |= 1048576, C);
        }
        function f(M) {
          return t && M.alternate === null && (M.flags |= 67108866), M;
        }
        function x(M, C, R, X) {
          return C === null || C.tag !== 6 ? (C = Ur(R, M.mode, X), C.return = M, C) : (C = r(C, R), C.return = M, C);
        }
        function H(M, C, R, X) {
          var ot = R.type;
          return ot === mn ? Z(
            M,
            C,
            R.props.children,
            X,
            R.key
          ) : C !== null && (C.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === ya && Da(ot) === C.type) ? (C = r(C, R.props), Dn(C, R), C.return = M, C) : (C = Kl(
            R.type,
            R.key,
            R.props,
            null,
            M.mode,
            X
          ), Dn(C, R), C.return = M, C);
        }
        function Q(M, C, R, X) {
          return C === null || C.tag !== 4 || C.stateNode.containerInfo !== R.containerInfo || C.stateNode.implementation !== R.implementation ? (C = Br(R, M.mode, X), C.return = M, C) : (C = r(C, R.children || []), C.return = M, C);
        }
        function Z(M, C, R, X, ot) {
          return C === null || C.tag !== 7 ? (C = Ga(
            R,
            M.mode,
            X,
            ot
          ), C.return = M, C) : (C = r(C, R), C.return = M, C);
        }
        function V(M, C, R) {
          if (typeof C == "string" && C !== "" || typeof C == "number" || typeof C == "bigint")
            return C = Ur(
              "" + C,
              M.mode,
              R
            ), C.return = M, C;
          if (typeof C == "object" && C !== null) {
            switch (C.$$typeof) {
              case Vl:
                return R = Kl(
                  C.type,
                  C.key,
                  C.props,
                  null,
                  M.mode,
                  R
                ), Dn(R, C), R.return = M, R;
              case dn:
                return C = Br(
                  C,
                  M.mode,
                  R
                ), C.return = M, C;
              case ya:
                return C = Da(C), V(M, C, R);
            }
            if (Xl(C) || A(C))
              return C = Ga(
                C,
                M.mode,
                R,
                null
              ), C.return = M, C;
            if (typeof C.then == "function")
              return V(M, xl(C), R);
            if (C.$$typeof === va)
              return V(
                M,
                gl(M, C),
                R
              );
            wl(M, C);
          }
          return null;
        }
        function L(M, C, R, X) {
          var ot = C !== null ? C.key : null;
          if (typeof R == "string" && R !== "" || typeof R == "number" || typeof R == "bigint")
            return ot !== null ? null : x(M, C, "" + R, X);
          if (typeof R == "object" && R !== null) {
            switch (R.$$typeof) {
              case Vl:
                return R.key === ot ? H(M, C, R, X) : null;
              case dn:
                return R.key === ot ? Q(M, C, R, X) : null;
              case ya:
                return R = Da(R), L(M, C, R, X);
            }
            if (Xl(R) || A(R))
              return ot !== null ? null : Z(M, C, R, X, null);
            if (typeof R.then == "function")
              return L(
                M,
                C,
                xl(R),
                X
              );
            if (R.$$typeof === va)
              return L(
                M,
                C,
                gl(M, R),
                X
              );
            wl(M, R);
          }
          return null;
        }
        function mt(M, C, R, X, ot) {
          if (typeof X == "string" && X !== "" || typeof X == "number" || typeof X == "bigint")
            return M = M.get(R) || null, x(C, M, "" + X, ot);
          if (typeof X == "object" && X !== null) {
            switch (X.$$typeof) {
              case Vl:
                return M = M.get(
                  X.key === null ? R : X.key
                ) || null, H(C, M, X, ot);
              case dn:
                return M = M.get(
                  X.key === null ? R : X.key
                ) || null, Q(C, M, X, ot);
              case ya:
                return X = Da(X), mt(
                  M,
                  C,
                  R,
                  X,
                  ot
                );
            }
            if (Xl(X) || A(X))
              return M = M.get(R) || null, Z(C, M, X, ot, null);
            if (typeof X.then == "function")
              return mt(
                M,
                C,
                R,
                xl(X),
                ot
              );
            if (X.$$typeof === va)
              return mt(
                M,
                C,
                R,
                gl(C, X),
                ot
              );
            wl(C, X);
          }
          return null;
        }
        function ee(M, C, R, X) {
          for (var ot = null, Rt = null, st = C, _t = C = 0, Ft = null; st !== null && _t < R.length; _t++) {
            st.index > _t ? (Ft = st, st = null) : Ft = st.sibling;
            var St = L(
              M,
              st,
              R[_t],
              X
            );
            if (St === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && St.alternate === null && e(M, st), C = u(St, C, _t), Rt === null ? ot = St : Rt.sibling = St, Rt = St, st = Ft;
          }
          if (_t === R.length)
            return a(M, st), yt && Y(M, _t), ot;
          if (st === null) {
            for (; _t < R.length; _t++)
              st = V(M, R[_t], X), st !== null && (C = u(
                st,
                C,
                _t
              ), Rt === null ? ot = st : Rt.sibling = st, Rt = st);
            return yt && Y(M, _t), ot;
          }
          for (st = l(st); _t < R.length; _t++)
            Ft = mt(
              st,
              M,
              _t,
              R[_t],
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
        function cl(M, C, R, X) {
          if (R == null) throw Error(s(151));
          for (var ot = null, Rt = null, st = C, _t = C = 0, Ft = null, St = R.next(); st !== null && !St.done; _t++, St = R.next()) {
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
            for (; !St.done; _t++, St = R.next())
              St = V(M, St.value, X), St !== null && (C = u(
                St,
                C,
                _t
              ), Rt === null ? ot = St : Rt.sibling = St, Rt = St);
            return yt && Y(M, _t), ot;
          }
          for (st = l(st); !St.done; _t++, St = R.next())
            St = mt(
              st,
              M,
              _t,
              St.value,
              X
            ), St !== null && (t && St.alternate !== null && st.delete(St.key === null ? _t : St.key), C = u(St, C, _t), Rt === null ? ot = St : Rt.sibling = St, Rt = St);
          return t && st.forEach(function(lh) {
            return e(M, lh);
          }), yt && Y(M, _t), ot;
        }
        function Ia(M, C, R, X) {
          if (typeof R == "object" && R !== null && R.type === mn && R.key === null && (R = R.props.children), typeof R == "object" && R !== null) {
            switch (R.$$typeof) {
              case Vl:
                t: {
                  for (var ot = R.key; C !== null; ) {
                    if (C.key === ot) {
                      if (ot = R.type, ot === mn) {
                        if (C.tag === 7) {
                          a(
                            M,
                            C.sibling
                          ), X = r(
                            C,
                            R.props.children
                          ), X.return = M, M = X;
                          break t;
                        }
                      } else if (C.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === ya && Da(ot) === C.type) {
                        a(
                          M,
                          C.sibling
                        ), X = r(C, R.props), Dn(X, R), X.return = M, M = X;
                        break t;
                      }
                      a(M, C);
                      break;
                    } else e(M, C);
                    C = C.sibling;
                  }
                  R.type === mn ? (X = Ga(
                    R.props.children,
                    M.mode,
                    X,
                    R.key
                  ), X.return = M, M = X) : (X = Kl(
                    R.type,
                    R.key,
                    R.props,
                    null,
                    M.mode,
                    X
                  ), Dn(X, R), X.return = M, M = X);
                }
                return f(M);
              case dn:
                t: {
                  for (ot = R.key; C !== null; ) {
                    if (C.key === ot)
                      if (C.tag === 4 && C.stateNode.containerInfo === R.containerInfo && C.stateNode.implementation === R.implementation) {
                        a(
                          M,
                          C.sibling
                        ), X = r(
                          C,
                          R.children || []
                        ), X.return = M, M = X;
                        break t;
                      } else {
                        a(M, C);
                        break;
                      }
                    else e(M, C);
                    C = C.sibling;
                  }
                  X = Br(R, M.mode, X), X.return = M, M = X;
                }
                return f(M);
              case ya:
                return R = Da(R), Ia(
                  M,
                  C,
                  R,
                  X
                );
            }
            if (Xl(R))
              return ee(
                M,
                C,
                R,
                X
              );
            if (A(R)) {
              if (ot = A(R), typeof ot != "function")
                throw Error(s(150));
              return R = ot.call(R), cl(
                M,
                C,
                R,
                X
              );
            }
            if (typeof R.then == "function")
              return Ia(
                M,
                C,
                xl(R),
                X
              );
            if (R.$$typeof === va)
              return Ia(
                M,
                C,
                gl(M, R),
                X
              );
            wl(M, R);
          }
          return typeof R == "string" && R !== "" || typeof R == "number" || typeof R == "bigint" ? (R = "" + R, C !== null && C.tag === 6 ? (a(M, C.sibling), X = r(C, R), X.return = M, M = X) : (a(M, C), X = Ur(R, M.mode, X), X.return = M, M = X), f(M)) : a(M, C);
        }
        return function(M, C, R, X) {
          try {
            al = 0;
            var ot = Ia(
              M,
              C,
              R,
              X
            );
            return Sn = null, ot;
          } catch (st) {
            if (st === _n || st === ai) throw st;
            var Rt = o(29, st, null, M.mode);
            return Rt.lanes = X, Rt.return = M, Rt;
          } finally {
          }
        };
      }
      function _l() {
        for (var t = kn, e = so = kn = 0; e < t; ) {
          var a = Te[e];
          Te[e++] = null;
          var l = Te[e];
          Te[e++] = null;
          var r = Te[e];
          Te[e++] = null;
          var u = Te[e];
          if (Te[e++] = null, l !== null && r !== null) {
            var f = l.pending;
            f === null ? r.next = r : (r.next = f.next, f.next = r), l.pending = r;
          }
          u !== 0 && fs(a, r, u);
        }
      }
      function Sl(t, e, a, l) {
        Te[kn++] = t, Te[kn++] = e, Te[kn++] = a, Te[kn++] = l, so |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Ki(t, e, a, l) {
        return Sl(t, e, a, l), kl(t);
      }
      function Ua(t, e) {
        return Sl(t, null, null, e), kl(t);
      }
      function fs(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, u = t.return; u !== null; )
          u.childLanes |= a, l = u.alternate, l !== null && (l.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - be(a), t = u.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), u) : null;
      }
      function kl(t) {
        if (50 < sl)
          throw sl = 0, wo = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Vi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Xi(t, e) {
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
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = kl(t), fs(t, null, a), e;
        }
        return Sl(t, l, e, a), kl(t);
      }
      function Un(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, U(t, a);
        }
      }
      function Zi(t, e) {
        var a = t.updateQueue, l = t.alternate;
        if (l !== null && (l = l.updateQueue, a === l)) {
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
        if (co) {
          var t = wn;
          if (t !== null) throw t;
        }
      }
      function qn(t, e, a, l) {
        co = !1;
        var r = t.updateQueue;
        Sa = !1;
        var u = r.firstBaseUpdate, f = r.lastBaseUpdate, x = r.shared.pending;
        if (x !== null) {
          r.shared.pending = null;
          var H = x, Q = H.next;
          H.next = null, f === null ? u = Q : f.next = Q, f = H;
          var Z = t.alternate;
          Z !== null && (Z = Z.updateQueue, x = Z.lastBaseUpdate, x !== f && (x === null ? Z.firstBaseUpdate = Q : x.next = Q, Z.lastBaseUpdate = H));
        }
        if (u !== null) {
          var V = r.baseState;
          f = 0, Z = Q = H = null, x = u;
          do {
            var L = x.lane & -536870913, mt = L !== x.lane;
            if (mt ? (vt & L) === L : (l & L) === L) {
              L !== 0 && L === xn && (co = !0), Z !== null && (Z = Z.next = {
                lane: 0,
                tag: x.tag,
                payload: x.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, cl = x;
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
                    V = Yr({}, V, L);
                    break t;
                  case 2:
                    Sa = !0;
                }
              }
              L = x.callback, L !== null && (t.flags |= 64, mt && (t.flags |= 8192), mt = r.callbacks, mt === null ? r.callbacks = [L] : mt.push(L));
            } else
              mt = {
                lane: L,
                tag: x.tag,
                payload: x.payload,
                callback: x.callback,
                next: null
              }, Z === null ? (Q = Z = mt, H = V) : Z = Z.next = mt, f |= L;
            if (x = x.next, x === null) {
              if (x = r.shared.pending, x === null)
                break;
              mt = x, x = mt.next, mt.next = null, r.lastBaseUpdate = mt, r.shared.pending = null;
            }
          } while (!0);
          Z === null && (H = V), r.baseState = H, r.firstBaseUpdate = Q, r.lastBaseUpdate = Z, u === null && (r.shared.lanes = 0), za |= f, t.lanes = f, t.memoizedState = V;
        }
      }
      function ps(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function hs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            ps(a[t], e);
      }
      function gs(t, e) {
        t = ia, S(li, t), S(zn, e), ia = t | e.baseLanes;
      }
      function Ji() {
        S(li, ia), S(zn, zn.current);
      }
      function Li() {
        ia = li.current, g(zn), g(li);
      }
      function pa(t) {
        var e = t.alternate;
        S(Bt, Bt.current & 1), S(xe, t), Ce === null && (e === null || zn.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Wi(t) {
        S(Bt, Bt.current), S(xe, t), Ce === null && (Ce = t);
      }
      function bs(t) {
        t.tag === 22 ? (S(Bt, Bt.current), S(xe, t), Ce === null && (Ce = t)) : ha();
      }
      function ha() {
        S(Bt, Bt.current), S(xe, xe.current);
      }
      function pe(t) {
        g(xe), Ce === t && (Ce = null), g(Bt);
      }
      function zl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Wr(a) || Fr(a)))
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
        throw Error(s(321));
      }
      function Fi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ye(t[a], e[a])) return !1;
        return !0;
      }
      function Ii(t, e, a, l, r, u) {
        return na = u, ft = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, rt.H = t === null || t.memoizedState === null ? Vu : uo, Wa = !1, u = a(l, r), Wa = !1, En && (u = ys(
          e,
          a,
          l,
          r
        )), vs(t), u;
      }
      function vs(t) {
        rt.H = ll;
        var e = Nt !== null && Nt.next !== null;
        if (na = 0, qt = Nt = ft = null, ii = !1, nl = 0, Nn = null, e) throw Error(s(300));
        t === null || Yt || (t = t.dependencies, t !== null && hl(t) && (Yt = !0));
      }
      function ys(t, e, a, l) {
        ft = t;
        var r = 0;
        do {
          if (En && (Nn = null), nl = 0, En = !1, 25 <= r) throw Error(s(301));
          if (r += 1, qt = Nt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          rt.H = Xu, u = e(a, l);
        } while (En);
        return u;
      }
      function Qm() {
        var t = rt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Yn(e) : e, t = t.useState()[0], (Nt !== null ? Nt.memoizedState : null) !== t && (ft.flags |= 1024), e;
      }
      function $i() {
        var t = ri !== 0;
        return ri = 0, t;
      }
      function Pi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function tr(t) {
        if (ii) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ii = !1;
        }
        na = 0, qt = Nt = ft = null, En = !1, nl = ri = 0, Nn = null;
      }
      function oe() {
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
            throw ft.alternate === null ? Error(s(467)) : Error(s(310));
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
        return nl += 1, Nn === null && (Nn = []), t = cs(Nn, t, e), e = ft, (qt === null ? e.memoizedState : qt.next) === null && (e = e.alternate, rt.H = e === null || e.memoizedState === null ? Vu : uo), t;
      }
      function Nl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Yn(t);
          if (t.$$typeof === va) return It(t);
        }
        throw Error(s(438, String(t)));
      }
      function er(t) {
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
            a[l] = pf;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Tl(t) {
        var e = Ut();
        return ar(e, Nt, t);
      }
      function ar(t, e, a) {
        var l = t.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = a;
        var r = t.baseQueue, u = l.pending;
        if (u !== null) {
          if (r !== null) {
            var f = r.next;
            r.next = u.next, u.next = f;
          }
          e.baseQueue = r = u, l.pending = null;
        }
        if (u = t.baseState, r === null) t.memoizedState = u;
        else {
          e = r.next;
          var x = f = null, H = null, Q = e, Z = !1;
          do {
            var V = Q.lane & -536870913;
            if (V !== Q.lane ? (vt & V) === V : (na & V) === V) {
              var L = Q.revertLane;
              if (L === 0)
                H !== null && (H = H.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }), V === xn && (Z = !0);
              else if ((na & L) === L) {
                Q = Q.next, L === xn && (Z = !0);
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
                }, H === null ? (x = H = V, f = u) : H = H.next = V, ft.lanes |= L, za |= L;
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
              }, H === null ? (x = H = L, f = u) : H = H.next = L, ft.lanes |= V, za |= V;
            Q = Q.next;
          } while (Q !== null && Q !== e);
          if (H === null ? f = u : H.next = x, !ye(u, t.memoizedState) && (Yt = !0, Z && (a = wn, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = f, t.baseQueue = H, l.lastRenderedState = u;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function nr(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, u = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var f = r = r.next;
          do
            u = t(u, f.action), f = f.next;
          while (f !== r);
          ye(u, e.memoizedState) || (Yt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, l];
      }
      function xs(t, e, a) {
        var l = ft, r = Ut(), u = yt;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var f = !ye(
          (Nt || r).memoizedState,
          a
        );
        if (f && (r.memoizedState = a, Yt = !0), r = r.queue, rr(Ss.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || f || qt !== null && qt.memoizedState.tag & 1) {
          if (l.flags |= 2048, on(
            9,
            { destroy: void 0 },
            _s.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), Ct === null) throw Error(s(349));
          u || (na & 127) !== 0 || ws(l, e, a);
        }
        return a;
      }
      function ws(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = ft.updateQueue, e === null ? (e = El(), ft.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function _s(t, e, a, l) {
        e.value = a, e.getSnapshot = l, ks(e) && zs(t);
      }
      function Ss(t, e, a) {
        return a(function() {
          ks(e) && zs(t);
        });
      }
      function ks(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ye(t, a);
        } catch {
          return !0;
        }
      }
      function zs(t) {
        var e = Ua(t, 2);
        e !== null && ce(e, t, 2);
      }
      function lr(t) {
        var e = oe();
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
      function Es(t, e, a, l) {
        return t.baseState = a, ar(
          t,
          Nt,
          typeof l == "function" ? l : We
        );
      }
      function Km(t, e, a, l, r) {
        if (Ml(t)) throw Error(s(485));
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
          rt.T !== null ? a(!0) : u.isTransition = !1, l(u), a = e.pending, a === null ? (u.next = e.pending = u, Ns(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function Ns(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var u = rt.T, f = {};
          rt.T = f;
          try {
            var x = a(r, l), H = rt.S;
            H !== null && H(f, x), Ts(t, e, x);
          } catch (Q) {
            ir(t, e, Q);
          } finally {
            u !== null && f.types !== null && (u.types = f.types), rt.T = u;
          }
        } else
          try {
            u = a(r, l), Ts(t, e, u);
          } catch (Q) {
            ir(t, e, Q);
          }
      }
      function Ts(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            Cs(t, e, l);
          },
          function(l) {
            return ir(t, e, l);
          }
        ) : Cs(t, e, a);
      }
      function Cs(t, e, a) {
        e.status = "fulfilled", e.value = a, js(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Ns(t, a)));
      }
      function ir(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, js(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function js(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Ms(t, e) {
        return e;
      }
      function As(t, e) {
        if (yt) {
          var a = Ct.formState;
          if (a !== null) {
            t: {
              var l = ft;
              if (yt) {
                if (At) {
                  var r = op(
                    At,
                    Ne
                  );
                  if (r) {
                    At = Eu(r), l = sp(r);
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
        a = oe(), a.memoizedState = a.baseState = e, l = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ms,
          lastRenderedState: e
        }, a.queue = l, a = Fs.bind(
          null,
          ft,
          l
        ), l.dispatch = a, l = lr(!1);
        var u = ur.bind(
          null,
          ft,
          !1,
          l.queue
        );
        return l = oe(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = Km.bind(
          null,
          ft,
          r,
          u,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function Os(t) {
        var e = Ut();
        return Rs(e, Nt, t);
      }
      function Rs(t, e, a) {
        if (e = ar(
          t,
          e,
          Ms
        )[0], t = Tl(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Yn(e);
          } catch (f) {
            throw f === _n ? ai : f;
          }
        else l = e;
        e = Ut();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (ft.flags |= 2048, on(
          9,
          { destroy: void 0 },
          Vm.bind(null, r, a),
          null
        )), [l, u, t];
      }
      function Vm(t, e) {
        t.action = e;
      }
      function Hs(t) {
        var e = Ut(), a = Nt;
        if (a !== null)
          return Rs(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function on(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = ft.updateQueue, e === null && (e = El(), ft.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function Ds() {
        return Ut().memoizedState;
      }
      function Cl(t, e, a, l) {
        var r = oe();
        ft.flags |= t, r.memoizedState = on(
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
        Nt !== null && l !== null && Fi(l, Nt.memoizedState.deps) ? r.memoizedState = on(e, u, a, l) : (ft.flags |= t, r.memoizedState = on(
          1 | e,
          u,
          a,
          l
        ));
      }
      function Us(t, e) {
        Cl(8390656, 8, t, e);
      }
      function rr(t, e) {
        jl(2048, 8, t, e);
      }
      function Xm(t) {
        ft.flags |= 4;
        var e = ft.updateQueue;
        if (e === null)
          e = El(), ft.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Bs(t) {
        var e = Ut().memoizedState;
        return Xm({ ref: e, nextImpl: t }), function() {
          if ((gt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function qs(t, e) {
        return jl(4, 2, t, e);
      }
      function Ys(t, e) {
        return jl(4, 4, t, e);
      }
      function Gs(t, e) {
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
      function Qs(t, e, a) {
        a = a != null ? a.concat([t]) : null, jl(
          4,
          4,
          Gs.bind(null, e, t),
          a
        );
      }
      function or() {
      }
      function Ks(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Fi(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Vs(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Fi(e, l[1]))
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
      function sr(t, e, a) {
        return a === void 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Yc(), ft.lanes |= t, za |= t, a);
      }
      function Xs(t, e, a, l) {
        return ye(a, e) ? a : zn.current !== null ? (t = sr(t, a, l), ye(t, e) || (Yt = !0), t) : (na & 42) === 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? (Yt = !0, t.memoizedState = a) : (t = Yc(), ft.lanes |= t, za |= t, e);
      }
      function Zs(t, e, a, l, r) {
        var u = ea();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var f = rt.T, x = {};
        rt.T = x, ur(t, !1, e, a);
        try {
          var H = r(), Q = rt.S;
          if (Q !== null && Q(x, H), H !== null && typeof H == "object" && typeof H.then == "function") {
            var Z = Gm(
              H,
              l
            );
            Gn(
              t,
              e,
              Z,
              he(t)
            );
          } else
            Gn(
              t,
              e,
              l,
              he(t)
            );
        } catch (V) {
          Gn(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: V },
            he()
          );
        } finally {
          Lt(u), f !== null && x.types !== null && (f.types = x.types), rt.T = f;
        }
      }
      function Js(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: fn,
          baseState: fn,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: We,
            lastRenderedState: fn
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
      function cr() {
        return It(Ka);
      }
      function Ls() {
        return Ut().memoizedState;
      }
      function Ws() {
        return Ut().memoizedState;
      }
      function Zm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = he();
              t = ma(a);
              var l = fa(e, t, a);
              l !== null && (ce(l, e, a), Un(l, e, a)), e = { cache: Yi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Jm(t, e, a) {
        var l = he();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t) ? Is(e, a) : (a = Ki(t, e, a, l), a !== null && (ce(a, t, l), $s(a, e, l)));
      }
      function Fs(t, e, a) {
        var l = he();
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
        if (Ml(t)) Is(e, r);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var f = e.lastRenderedState, x = u(f, a);
              if (r.hasEagerState = !0, r.eagerState = x, ye(x, f))
                return Sl(t, e, r, 0), Ct === null && _l(), !1;
            } catch {
            } finally {
            }
          if (a = Ki(t, e, r, l), a !== null)
            return ce(a, t, l), $s(a, e, l), !0;
        }
        return !1;
      }
      function ur(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: Gi(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t)) {
          if (e) throw Error(s(479));
        } else
          e = Ki(
            t,
            a,
            l,
            2
          ), e !== null && ce(e, t, 2);
      }
      function Ml(t) {
        var e = t.alternate;
        return t === ft || e !== null && e === ft;
      }
      function Is(t, e) {
        En = ii = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function $s(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, U(t, a);
        }
      }
      function dr(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : Yr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Ps(t, e, a, l, r, u, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, u, f) : e.prototype && e.prototype.isPureReactComponent ? !yl(a, l) || !yl(r, u) : !0;
      }
      function tc(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && mo.enqueueReplaceState(e, e.state, null);
      }
      function Ba(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Yr({}, a));
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
      function ec(t, e, a) {
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
      function mr(t, e, a) {
        return a = ma(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Al(t, e);
        }, a;
      }
      function ac(t) {
        return t = ma(t), t.tag = 3, t;
      }
      function nc(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = l.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            ec(e, a, l);
          };
        }
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          ec(e, a, l), typeof r != "function" && (Ea === null ? Ea = /* @__PURE__ */ new Set([this]) : Ea.add(this));
          var x = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: x !== null ? x : ""
          });
        });
      }
      function Lm(t, e, a, l, r) {
        if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          if (e = a.alternate, e !== null && ln(
            e,
            a,
            r,
            !0
          ), a = xe.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Ce === null ? Gl() : a.alternate === null && Dt === 0 && (Dt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Hr(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Hr(t, l, r)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return Hr(t, l, r), Gl(), !1;
        }
        if (yt)
          return e = xe.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== no && (t = Error(s(422), { cause: l }), Rn(
            B(t, a)
          ))) : (l !== no && (e = Error(s(423), {
            cause: l
          }), Rn(
            B(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = B(l, a), r = mr(
            t.stateNode,
            l,
            r
          ), Zi(t, r), Dt !== 4 && (Dt = 2)), !1;
        var u = Error(s(520), { cause: l });
        if (u = B(u, a), rl === null ? rl = [u] : rl.push(u), Dt !== 4 && (Dt = 2), e === null) return !0;
        l = B(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = mr(a.stateNode, l, t), Zi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Ea === null || !Ea.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = ac(r), nc(
                  r,
                  t,
                  a,
                  l
                ), Zi(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, l) {
        e.child = t === null ? Ku(e, null, a, l) : La(
          e,
          t.child,
          a,
          l
        );
      }
      function lc(t, e, a, l, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in l) {
          var f = {};
          for (var x in l)
            x !== "ref" && (f[x] = l[x]);
        } else f = l;
        return Ha(e), l = Ii(
          t,
          e,
          a,
          f,
          u,
          r
        ), x = $i(), t !== null && !Yt ? (Pi(t, e, r), Fe(t, e, r)) : (yt && x && G(e), e.flags |= 1, $t(t, e, l, r), e.child);
      }
      function ic(t, e, a, l, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !Dr(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, rc(
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
        if (u = t.child, !yr(t, r)) {
          var f = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : yl, a(f, l) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(u, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function rc(t, e, a, l, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (yl(u, l) && t.ref === e.ref)
            if (Yt = !1, e.pendingProps = l = u, yr(t, r))
              (t.flags & 131072) !== 0 && (Yt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return fr(
          t,
          e,
          a,
          l,
          r
        );
      }
      function oc(t, e, a, l) {
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
            return sc(
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
            ), u !== null ? gs(e, u) : Ji(), bs(e);
          else
            return l = e.lanes = 536870912, sc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              l
            );
        } else
          u !== null ? (vl(e, u.cachePool), gs(e, u), ha(), e.memoizedState = null) : (t !== null && vl(e, null), Ji(), ha());
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
      function sc(t, e, a, l, r) {
        var u = Qi();
        return u = u === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && vl(e, null), Ji(), bs(e), t !== null && ln(t, e, l, !0), e.childLanes = r, null;
      }
      function Ol(t, e) {
        return e = Hl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function cc(t, e, a) {
        return La(e, t.child, null, a), t = Ol(
          e,
          e.pendingProps
        ), t.flags |= 2, pe(e), e.memoizedState = null, t;
      }
      function Wm(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (yt) {
            if (l.mode === "hidden")
              return t = Ol(e, l), e.lanes = 536870912, Qn(null, t);
            if (Wi(e), (t = At) ? (t = bp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = ru(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw dt(e);
            return e.lanes = 536870912, null;
          }
          return Ol(e, l);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var f = u.dehydrated;
          if (Wi(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = cc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Yt || ln(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Yt || r) {
            if (l = Ct, l !== null && (f = J(l, a), f !== 0 && f !== u.retryLane))
              throw u.retryLane = f, Ua(t, f), ce(l, t, f), fo;
            Gl(), e = cc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ie && (At = mp(f), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = Ol(e, l), e.flags |= 4096;
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
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function fr(t, e, a, l, r) {
        return Ha(e), a = Ii(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = $i(), t !== null && !Yt ? (Pi(t, e, r), Fe(t, e, r)) : (yt && l && G(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function uc(t, e, a, l, r, u) {
        return Ha(e), e.updateQueue = null, a = ys(
          e,
          l,
          a,
          r
        ), vs(t), l = $i(), t !== null && !Yt ? (Pi(t, e, u), Fe(t, e, u)) : (yt && l && G(e), e.flags |= 1, $t(t, e, a, u), e.child);
      }
      function dc(t, e, a, l, r) {
        if (Ha(e), e.stateNode === null) {
          var u = gn, f = a.contextType;
          typeof f == "object" && f !== null && (u = It(f)), u = new a(l, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = mo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = l, u.state = e.memoizedState, u.refs = {}, Vi(e), f = a.contextType, u.context = typeof f == "object" && f !== null ? It(f) : gn, u.state = e.memoizedState, f = a.getDerivedStateFromProps, typeof f == "function" && (dr(
            e,
            a,
            f,
            l
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (f = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), f !== u.state && mo.enqueueReplaceState(
            u,
            u.state,
            null
          ), qn(e, l, u, r), Bn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          u = e.stateNode;
          var x = e.memoizedProps, H = Ba(a, x);
          u.props = H;
          var Q = u.context, Z = a.contextType;
          f = gn, typeof Z == "object" && Z !== null && (f = It(Z));
          var V = a.getDerivedStateFromProps;
          Z = typeof V == "function" || typeof u.getSnapshotBeforeUpdate == "function", x = e.pendingProps !== x, Z || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (x || Q !== f) && tc(
            e,
            u,
            l,
            f
          ), Sa = !1;
          var L = e.memoizedState;
          u.state = L, qn(e, l, u, r), Bn(), Q = e.memoizedState, x || L !== Q || Sa ? (typeof V == "function" && (dr(
            e,
            a,
            V,
            l
          ), Q = e.memoizedState), (H = Sa || Ps(
            e,
            a,
            H,
            l,
            L,
            Q,
            f
          )) ? (Z || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = Q), u.props = l, u.state = Q, u.context = f, l = H) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          u = e.stateNode, Xi(t, e), f = e.memoizedProps, Z = Ba(a, f), u.props = Z, V = e.pendingProps, L = u.context, Q = a.contextType, H = gn, typeof Q == "object" && Q !== null && (H = It(Q)), x = a.getDerivedStateFromProps, (Q = typeof x == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (f !== V || L !== H) && tc(
            e,
            u,
            l,
            H
          ), Sa = !1, L = e.memoizedState, u.state = L, qn(e, l, u, r), Bn();
          var mt = e.memoizedState;
          f !== V || L !== mt || Sa || t !== null && t.dependencies !== null && hl(t.dependencies) ? (typeof x == "function" && (dr(
            e,
            a,
            x,
            l
          ), mt = e.memoizedState), (Z = Sa || Ps(
            e,
            a,
            Z,
            l,
            L,
            mt,
            H
          ) || t !== null && t.dependencies !== null && hl(t.dependencies)) ? (Q || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(l, mt, H), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            l,
            mt,
            H
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = mt), u.props = l, u.state = mt, u.context = H, l = Z) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), l = !1);
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
      function mc(t, e, a, l) {
        return Oe(), e.flags |= 256, $t(t, e, a, l), e.child;
      }
      function pr(t) {
        return { baseLanes: t, cachePool: os() };
      }
      function hr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= _e), t;
      }
      function fc(t, e, a) {
        var l = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, f;
        if ((f = u) || (f = t !== null && t.memoizedState === null ? !1 : (Bt.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (yt) {
            if (r ? pa(e) : ha(), (t = At) ? (t = vp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = ru(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw dt(e);
            return Fr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var x = l.children;
          return l = l.fallback, r ? (ha(), r = e.mode, x = Hl(
            { mode: "hidden", children: x },
            r
          ), l = Ga(
            l,
            r,
            a,
            null
          ), x.return = e, l.return = e, x.sibling = l, e.child = x, l = e.child, l.memoizedState = pr(a), l.childLanes = hr(
            t,
            f,
            a
          ), e.memoizedState = po, Qn(null, l)) : (pa(e), gr(e, x));
        }
        var H = t.memoizedState;
        if (H !== null && (x = H.dehydrated, x !== null)) {
          if (u)
            e.flags & 256 ? (pa(e), e.flags &= -257, e = br(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ha(), e.child = t.child, e.flags |= 128, e = null) : (ha(), x = l.fallback, r = e.mode, l = Hl(
              { mode: "visible", children: l.children },
              r
            ), x = Ga(
              x,
              r,
              a,
              null
            ), x.flags |= 2, l.return = e, x.return = e, l.sibling = x, e.child = l, La(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = pr(a), l.childLanes = hr(
              t,
              f,
              a
            ), e.memoizedState = po, e = Qn(null, l));
          else if (pa(e), Fr(x))
            f = ip(x).digest, l = Error(s(419)), l.stack = "", l.digest = f, Rn({ value: l, source: null, stack: null }), e = br(
              t,
              e,
              a
            );
          else if (Yt || ln(
            t,
            e,
            a,
            !1
          ), f = (a & t.childLanes) !== 0, Yt || f) {
            if (f = Ct, f !== null && (l = J(
              f,
              a
            ), l !== 0 && l !== H.retryLane))
              throw H.retryLane = l, Ua(t, l), ce(f, t, l), fo;
            Wr(x) || Gl(), e = br(
              t,
              e,
              a
            );
          } else
            Wr(x) ? (e.flags |= 192, e.child = t.child, e = null) : (t = H.treeContext, ie && (At = fp(
              x
            ), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = gr(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ha(), x = l.fallback, r = e.mode, H = t.child, u = H.sibling, l = Pe(H, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = H.subtreeFlags & 65011712, u !== null ? x = Pe(
          u,
          x
        ) : (x = Ga(
          x,
          r,
          a,
          null
        ), x.flags |= 2), x.return = e, l.return = e, l.sibling = x, e.child = l, Qn(null, l), l = e.child, x = t.child.memoizedState, x === null ? x = pr(a) : (r = x.cachePool, r !== null ? (H = ta ? Ot._currentValue : Ot._currentValue2, r = r.parent !== H ? { parent: H, pool: H } : r) : r = os(), x = {
          baseLanes: x.baseLanes | a,
          cachePool: r
        }), l.memoizedState = x, l.childLanes = hr(
          t,
          f,
          a
        ), e.memoizedState = po, Qn(t.child, l)) : (pa(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function gr(t, e) {
        return e = Hl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Hl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function br(t, e, a) {
        return La(e, t.child, null, a), t = gr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function pc(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), Bi(t.return, e, a);
      }
      function vr(t, e, a, l, r, u) {
        var f = t.memoizedState;
        f === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: r,
          treeForkCount: u
        } : (f.isBackwards = e, f.rendering = null, f.renderingStartTime = 0, f.last = l, f.tail = a, f.tailMode = r, f.treeForkCount = u);
      }
      function hc(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, u = l.tail;
        l = l.children;
        var f = Bt.current, x = (f & 2) !== 0;
        if (x ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, S(Bt, f), $t(t, e, l, a), l = yt ? Pn : 0, !x && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && pc(t, a, e);
            else if (t.tag === 19)
              pc(t, a, e);
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
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), vr(
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
            vr(
              e,
              !0,
              a,
              null,
              u,
              l
            );
            break;
          case "together":
            vr(
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
            if (ln(
              t,
              e,
              a,
              !1
            ), (a & e.childLanes) === 0)
              return null;
          } else return null;
        if (t !== null && e.child !== t.child)
          throw Error(s(153));
        if (e.child !== null) {
          for (t = e.child, a = Pe(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Pe(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function yr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && hl(t)));
      }
      function Fm(t, e, a) {
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
              return e.flags |= 128, Wi(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (pa(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? fc(
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
            if (l = (a & e.childLanes) !== 0, l || (ln(
              t,
              e,
              a,
              !1
            ), l = (a & e.childLanes) !== 0), r) {
              if (l)
                return hc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), S(Bt, Bt.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, oc(
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
      function gc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Yt = !0;
          else {
            if (!yr(t, a) && (e.flags & 128) === 0)
              return Yt = !1, Fm(
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
                Dr(t) ? (l = Ba(t, l), e.tag = 1, e = dc(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = fr(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Qr) {
                    e.tag = 11, e = lc(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Xr) {
                    e.tag = 14, e = ic(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  }
                }
                throw e = D(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return fr(
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
            ), dc(
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
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              r = e.memoizedState, l = r.element, Xi(t, e), qn(e, u, null, a);
              var f = e.memoizedState;
              if (u = f.cache, da(e, Ot, u), u !== r.cache && qi(
                e,
                [Ot],
                a,
                !0
              ), Bn(), u = f.element, ie && r.isDehydrated)
                if (r = {
                  element: u,
                  isDehydrated: !1,
                  cache: f.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = mc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== l) {
                  l = B(
                    Error(s(424)),
                    e
                  ), Rn(l), e = mc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ie && (At = dp(
                    e.stateNode.containerInfo
                  ), te = e, yt = !0, _a = null, Ne = !0), a = Ku(
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
              return Rl(t, e), t === null ? (a = Cu(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : yt || (e.stateNode = Bp(
                e.type,
                e.pendingProps,
                wa.current,
                e
              )) : e.memoizedState = Cu(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return xt(e), t === null && Vt && yt && (l = e.stateNode = Hu(
                e.type,
                e.pendingProps,
                wa.current,
                Pt.current,
                !1
              ), te = e, Ne = !0, At = pp(
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
            return t === null && yt && (Hp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = l = At) && (l = hp(
              l,
              e.type,
              e.pendingProps,
              Ne
            ), l !== null ? (e.stateNode = l, te = e, At = up(l), Ne = !1, r = !0) : r = !1), r || dt(e)), xt(e), r = e.type, u = e.pendingProps, f = t !== null ? t.memoizedProps : null, l = u.children, Zl(r, u) ? l = null : f !== null && Zl(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = Ii(
              t,
              e,
              Qm,
              null,
              null,
              a
            ), ta ? Ka._currentValue = r : Ka._currentValue2 = r), Rl(t, e), $t(t, e, l, a), e.child;
          case 6:
            return t === null && yt && (Dp(
              e.pendingProps,
              Pt.current
            ), (t = a = At) && (a = gp(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, te = e, At = null, t = !0) : t = !1), t || dt(e)), null;
          case 13:
            return fc(t, e, a);
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
            return lc(
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
            return ic(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return rc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return hc(
              t,
              e,
              a
            );
          case 31:
            return Wm(t, e, a);
          case 22:
            return oc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ha(e), l = It(Ot), t === null ? (r = Qi(), r === null && (r = Ct, u = Yi(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: l,
              cache: r
            }, Vi(e), da(e, Ot, r)) : ((t.lanes & a) !== 0 && (Xi(t, e), qn(e, null, null, a), Bn()), r = t.memoizedState, u = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), da(e, Ot, l)) : (l = u.cache, da(e, Ot, l), l !== r.cache && qi(
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
        throw Error(s(156, e.tag));
      }
      function Re(t) {
        t.flags |= 4;
      }
      function Dl(t) {
        Ke && (t.flags |= 8);
      }
      function bc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function xr(t, e, a, l) {
        if (le)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Jr(t, a.stateNode);
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
              a && l && (u = ku(
                u,
                r.type,
                r.memoizedProps
              )), Jr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && l && (u = zu(
                u,
                r.memoizedProps
              )), Jr(t, u);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                u = r.child, u !== null && (u.return = r), xr(t, r, !0, !0);
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
      function vc(t, e, a, l) {
        var r = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var f = u.stateNode;
              a && l && (f = ku(
                f,
                u.type,
                u.memoizedProps
              )), _u(t, f);
            } else if (u.tag === 6)
              f = u.stateNode, a && l && (f = zu(
                f,
                u.memoizedProps
              )), _u(t, f);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), vc(t, u, !0, !0), r = !0;
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
      function yc(t, e) {
        if (Ke && bc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = wu();
          vc(l, e, !1, !1), t.pendingChildren = l, Re(e), lp(a, l);
        }
      }
      function wr(t, e, a, l) {
        if (le)
          t.memoizedProps !== l && Re(e);
        else if (Ke) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = bc(t, e)) || u !== l) {
            var f = Pt.current;
            u = np(
              r,
              a,
              u,
              l,
              !t,
              null
            ), u === r ? e.stateNode = r : (Dl(e), gu(
              u,
              a,
              l,
              f
            ) && Re(e), e.stateNode = u, t && xr(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function _r(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? jf(e, l) : Mf(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Lr(e, l))
            if (vu(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Xc()) t.flags |= 8192;
            else
              throw Ja = ni, oo;
        } else t.flags &= -16777217;
      }
      function xc(t, e) {
        if (Yp(e)) {
          if (t.flags |= 16777216, !Ru(e))
            if (Xc()) t.flags |= 8192;
            else
              throw Ja = ni, oo;
        } else t.flags &= -16777217;
      }
      function Ul(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? j() : 536870912, t.lanes |= e, jn |= e);
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
      function Im(t, e, a) {
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
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Le(Ot), it(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ae(e) ? Re(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ua())), yc(t, e), jt(e), null;
          case 26:
            if (Ue) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (Re(e), u !== null ? (jt(e), xc(
                e,
                u
              )) : (jt(e), _r(
                e,
                r,
                null,
                l,
                a
              ))) : u ? u !== t.memoizedState ? (Re(e), jt(e), xc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, le ? u !== l && Re(e) : wr(
                t,
                e,
                r,
                l
              ), jt(e), _r(
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
                le ? t.memoizedProps !== l && Re(e) : wr(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = Pt.current, Ae(e) ? Oa(e, t) : (t = Hu(
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
              wr(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = Pt.current, Ae(e))
                Oa(e, u), Cp(
                  e.stateNode,
                  r,
                  l,
                  u
                ) && (e.flags |= 64);
              else {
                var f = _f(
                  r,
                  l,
                  wa.current,
                  u,
                  e
                );
                Dl(e), xr(f, e, !1, !1), e.stateNode = f, gu(
                  f,
                  r,
                  l,
                  u
                ) && Re(e);
              }
            }
            return jt(e), _r(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, le ? a !== l && Re(e) : Ke && (a !== l ? (t = wa.current, a = Pt.current, Dl(e), e.stateNode = bu(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = wa.current, a = Pt.current, Ae(e)) {
                if (!ie) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                xp(
                  t,
                  a,
                  e,
                  l
                ) || dt(e, !0);
              } else
                Dl(e), e.stateNode = bu(
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
                  if (!l) throw Error(s(318));
                  if (!ie) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  wp(t, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return jt(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ae(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!ie) throw Error(s(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(s(317));
                  _p(r, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), r = !1;
              } else
                r = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
            }
            return pe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), u = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), u !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Ul(e, e.updateQueue), jt(e), null);
          case 4:
            return it(), yc(t, e), t === null && Ef(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Le(e.type), jt(e), null;
          case 19:
            if (g(Bt), l = e.memoizedState, l === null) return jt(e), null;
            if (r = (e.flags & 128) !== 0, u = l.rendering, u === null)
              if (r) Kn(l, !1);
              else {
                if (Dt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = zl(t), u !== null) {
                      for (e.flags |= 128, Kn(l, !1), t = u.updateQueue, e.updateQueue = t, Ul(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        iu(a, t), a = a.sibling;
                      return S(
                        Bt,
                        Bt.current & 1 | 2
                      ), yt && Y(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && ue() > ol && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = zl(u), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Ul(e, t), Kn(l, !0), l.tail === null && l.tailMode === "hidden" && !u.alternate && !yt)
                    return jt(e), null;
                } else
                  2 * ue() - l.renderingStartTime > ol && a !== 536870912 && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              l.isBackwards ? (u.sibling = e.child, e.child = u) : (t = l.last, t !== null ? t.sibling = u : e.child = u, l.last = u);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = ue(), t.sibling = null, a = Bt.current, S(
              Bt,
              r ? a & 1 | 2 : a & 1
            ), yt && Y(e, l.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return pe(e), Li(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Ul(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && g(Za), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(Ot), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function $m(t, e) {
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
              if (pe(e), e.alternate === null)
                throw Error(s(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (pe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return g(Bt), null;
          case 4:
            return it(), null;
          case 10:
            return Le(e.type), null;
          case 22:
          case 23:
            return pe(e), Li(), t !== null && g(Za), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(Ot), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function wc(t, e) {
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
            e.memoizedState !== null && pe(e);
            break;
          case 13:
            pe(e);
            break;
          case 19:
            g(Bt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            pe(e), Li(), t !== null && g(Za);
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
                var u = a.create, f = a.inst;
                l = u(), f.destroy = l;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (x) {
          wt(e, e.return, x);
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
                var f = l.inst, x = f.destroy;
                if (x !== void 0) {
                  f.destroy = void 0, r = e;
                  var H = a, Q = x;
                  try {
                    Q();
                  } catch (Z) {
                    wt(
                      r,
                      H,
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
      function _c(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            hs(e, a);
          } catch (l) {
            wt(t, t.return, l);
          }
        }
      }
      function Sc(t, e, a) {
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
      function kc(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          Zf(l, e, a, t);
        } catch (r) {
          wt(t, t.return, r);
        }
      }
      function Sr(t, e, a) {
        try {
          Jf(
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
      function zc(t) {
        return t.tag === 5 || t.tag === 3 || (Ue ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && pn(t.type) : !1) || t.tag === 4;
      }
      function kr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || zc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && pn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function zr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Wf(a, t, e) : Vf(a, t);
        else if (l !== 4 && (Vt && l === 27 && pn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (zr(t, e, a), t = t.sibling; t !== null; )
            zr(t, e, a), t = t.sibling;
      }
      function Bl(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Lf(a, t, e) : Kf(a, t);
        else if (l !== 4 && (Vt && l === 27 && pn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Bl(t, e, a), t = t.sibling; t !== null; )
            Bl(t, e, a), t = t.sibling;
      }
      function Ec(t, e, a) {
        t = t.containerInfo;
        try {
          Su(t, a);
        } catch (l) {
          wt(e, e.return, l);
        }
      }
      function Nc(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Qp(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          wt(t, t.return, l);
        }
      }
      function Pm(t, e) {
        for (xf(t.containerInfo), Wt = e; Wt !== null; )
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
                      var f = Ba(
                        l.type,
                        r
                      );
                      e = u.getSnapshotBeforeUpdate(
                        f,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (x) {
                      wt(l, l.return, x);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && le && ap(t.stateNode.containerInfo);
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
                e.return = t.return, Wt = e;
                break;
              }
              Wt = t.return;
            }
      }
      function Tc(t, e, a) {
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
            l & 64 && _c(a), l & 512 && Xn(a, a.return);
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
                hs(l, t);
              } catch (f) {
                wt(a, a.return, f);
              }
            }
            break;
          case 27:
            Vt && e === null && l & 4 && Nc(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (l & 4) kc(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  zp(
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
            l & 512 && Xn(a, a.return);
            break;
          case 12:
            Ie(t, a);
            break;
          case 31:
            Ie(t, a), l & 4 && jc(t, a);
            break;
          case 13:
            Ie(t, a), l & 4 && Mc(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = of.bind(
              null,
              a
            ), rp(l, a))));
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
      function Cc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Cc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Cf(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, a) {
        for (a = a.child; a !== null; )
          Er(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Er(t, e, a) {
        if (ve && typeof ve.onCommitFiberUnmount == "function")
          try {
            ve.onCommitFiberUnmount($n, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ue) {
              Gt || Qe(a, e), He(
                t,
                e,
                a
              ), a.memoizedState ? Mu(a.memoizedState) : a.stateNode && Ou(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Gt || Qe(a, e);
              var l = Qt, r = de;
              pn(a.type) && (Qt = a.stateNode, de = !1), He(
                t,
                e,
                a
              ), Du(a.stateNode), Qt = l, de = r;
              break;
            }
          case 5:
            Gt || Qe(a, e);
          case 6:
            if (le) {
              if (l = Qt, r = de, Qt = null, He(
                t,
                e,
                a
              ), Qt = l, de = r, Qt !== null)
                if (de)
                  try {
                    If(Qt, a.stateNode);
                  } catch (u) {
                    wt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Ff(Qt, a.stateNode);
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
            le && Qt !== null && (de ? Ap(
              Qt,
              a.stateNode
            ) : Mp(Qt, a.stateNode));
            break;
          case 4:
            le ? (l = Qt, r = de, Qt = a.stateNode.containerInfo, de = !0, He(
              t,
              e,
              a
            ), Qt = l, de = r) : (Ke && Ec(
              a.stateNode,
              a,
              wu()
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
            Gt || (Qe(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && Sc(
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
      function jc(t, e) {
        if (ie && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Np(t);
          } catch (a) {
            wt(e, e.return, a);
          }
        }
      }
      function Mc(t, e) {
        if (ie && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Tp(t);
          } catch (a) {
            wt(e, e.return, a);
          }
      }
      function tf(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Zu()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Zu()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function ql(t, e) {
        var a = tf(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = sf.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ne(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], u = t, f = e;
            if (le) {
              var x = f;
              t: for (; x !== null; ) {
                switch (x.tag) {
                  case 27:
                    if (Vt) {
                      if (pn(x.type)) {
                        Qt = x.stateNode, de = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = x.stateNode, de = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = x.stateNode.containerInfo, de = !0;
                    break t;
                }
                x = x.return;
              }
              if (Qt === null) throw Error(s(160));
              Er(u, f, r), Qt = null, de = !1;
            } else Er(u, f, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Ac(e, t), e = e.sibling;
      }
      function Ac(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ne(e, t), se(t), l & 4 && (ga(3, t, t.return), Vn(3, t), ga(5, t, t.return));
            break;
          case 1:
            ne(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), l & 64 && la && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (Ue) {
              var r = Be;
              if (ne(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Up(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Au(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = ju(
                  r,
                  u,
                  t.memoizedProps
                ) : l !== u ? (l === null ? a.stateNode !== null && Ou(a.stateNode) : Mu(l), u === null ? Au(
                  r,
                  t.type,
                  t.stateNode
                ) : ju(
                  r,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Sr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ne(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), a !== null && l & 4 && Sr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ne(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), le) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  xu(r);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, Sr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (ho = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ne(e, t), se(t), l & 4 && le) {
              if (t.stateNode === null)
                throw Error(s(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                Xf(r, a, l);
              } catch (V) {
                wt(t, t.return, V);
              }
            }
            break;
          case 3:
            if (Ue ? (qp(), r = Be, Be = Ir(e.containerInfo), ne(e, t), Be = r) : ne(e, t), se(t), l & 4) {
              if (le && ie && a !== null && a.memoizedState.isDehydrated)
                try {
                  Ep(e.containerInfo);
                } catch (V) {
                  wt(t, t.return, V);
                }
              if (Ke) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  Su(l, a);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
            }
            ho && (ho = !1, Oc(t));
            break;
          case 4:
            Ue ? (a = Be, Be = Ir(
              t.stateNode.containerInfo
            ), ne(e, t), se(t), Be = a) : (ne(e, t), se(t)), l & 4 && Ke && Ec(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ne(e, t), se(t);
            break;
          case 31:
            ne(e, t), se(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 13:
            ne(e, t), se(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (mi = ue()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = a !== null && a.memoizedState !== null, x = la, H = Gt;
            if (la = x || r, Gt = H || f, ne(e, t), Gt = H, la = x, se(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || f || la || Gt || qa(t)), le)) {
              t: if (a = null, le)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ue && e.tag === 26) {
                    if (a === null) {
                      f = a = e;
                      try {
                        u = f.stateNode, r ? $f(u) : tp(
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
                        r ? Pf(Q) : ep(Q, f.memoizedProps);
                      } catch (V) {
                        wt(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      f = e;
                      try {
                        var Z = f.stateNode;
                        r ? Op(Z) : Rp(f.stateNode);
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
            l & 4 && (l = t.updateQueue, l !== null && (a = l.retryQueue, a !== null && (l.retryQueue = null, ql(t, a))));
            break;
          case 19:
            ne(e, t), se(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            ne(e, t), se(t);
        }
      }
      function se(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, l = t.return; l !== null; ) {
              if (zc(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (le) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, u = kr(t);
                    Bl(t, u, r);
                    break;
                  }
                case 5:
                  var f = a.stateNode;
                  a.flags & 32 && (xu(f), a.flags &= -33);
                  var x = kr(t);
                  Bl(t, x, f);
                  break;
                case 3:
                case 4:
                  var H = a.stateNode.containerInfo, Q = kr(t);
                  zr(
                    t,
                    Q,
                    H
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (Z) {
            wt(t, t.return, Z);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Oc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Oc(e), e.tag === 5 && e.flags & 1024 && Rf(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Tc(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && Sc(
                e,
                e.return,
                a
              ), qa(e);
              break;
            case 27:
              Vt && Du(e.stateNode);
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
          var l = e.alternate, r = t, u = e, f = u.flags;
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
                var x = l.stateNode;
                try {
                  var H = r.shared.hiddenCallbacks;
                  if (H !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < H.length; r++)
                      ps(H[r], x);
                } catch (Q) {
                  wt(l, l.return, Q);
                }
              }
              a && f & 64 && _c(u), Xn(u, u.return);
              break;
            case 27:
              Vt && Nc(u);
            case 26:
            case 5:
              $e(
                r,
                u,
                a
              ), a && l === null && f & 4 && kc(u), Xn(u, u.return);
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
              ), a && f & 4 && jc(r, u);
              break;
            case 13:
              $e(
                r,
                u,
                a
              ), a && f & 4 && Mc(r, u);
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
      function Nr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Hn(a));
      }
      function Tr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Hn(t));
      }
      function De(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Rc(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function Rc(t, e, a, l) {
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
                var u = e.memoizedProps, f = u.id, x = u.onPostCommit;
                typeof x == "function" && x(
                  f,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (H) {
                wt(e, e.return, H);
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
            u = e.stateNode, f = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? De(
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
            ) : (u._visibility |= 2, sn(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && Nr(f, e);
            break;
          case 24:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && Tr(e.alternate, e);
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
      function sn(t, e, a, l, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, f = e, x = a, H = l, Q = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              sn(
                u,
                f,
                x,
                H,
                r
              ), Vn(8, f);
              break;
            case 23:
              break;
            case 22:
              var Z = f.stateNode;
              f.memoizedState !== null ? Z._visibility & 2 ? sn(
                u,
                f,
                x,
                H,
                r
              ) : Zn(
                u,
                f
              ) : (Z._visibility |= 2, sn(
                u,
                f,
                x,
                H,
                r
              )), r && Q & 2048 && Nr(
                f.alternate,
                f
              );
              break;
            case 24:
              sn(
                u,
                f,
                x,
                H,
                r
              ), r && Q & 2048 && Tr(f.alternate, f);
              break;
            default:
              sn(
                u,
                f,
                x,
                H,
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
                Zn(a, l), r & 2048 && Nr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Zn(a, l), r & 2048 && Tr(
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
        if (t.subtreeFlags & Tn)
          for (t = t.child; t !== null; )
            Hc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Hc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ya(
              t,
              e,
              a
            ), t.flags & Tn)
              if (t.memoizedState !== null)
                Gp(
                  a,
                  Be,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Lr(r, t)) && yu(a, l, r, t);
              }
            break;
          case 5:
            Ya(
              t,
              e,
              a
            ), t.flags & Tn && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Lr(r, t)) && yu(a, l, r, t));
            break;
          case 3:
          case 4:
            Ue ? (l = Be, Be = Ir(
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
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = Tn, Tn = 16777216, Ya(
              t,
              e,
              a
            ), Tn = l) : Ya(
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
      function Dc(t) {
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
              Wt = l, Bc(
                l,
                t
              );
            }
          Dc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Uc(t), t = t.sibling;
      }
      function Uc(t) {
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
              Wt = l, Bc(
                l,
                t
              );
            }
          Dc(t);
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
      function Bc(t, e) {
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
              if (Cc(l), l === a) {
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
      function Cr(t) {
        var e = zf(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Uf(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function jr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case oi:
            if (t.type === e.value) return !0;
            break;
          case si:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, u = t[a++], f = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !In(l)) {
                  for (; f != null && jr(l, f); )
                    u++, f = e[u];
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
            if ((a === 5 || a === 26 || a === 27) && Yf(t.stateNode, e.value))
              return !0;
            break;
          case di:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = qf(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ui:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function Mr(t) {
        switch (t.$$typeof) {
          case oi:
            return "<" + (D(t.value) || "Unknown") + ">";
          case si:
            return ":has(" + (Mr(t) || "") + ")";
          case ci:
            return '[role="' + t.value + '"]';
          case di:
            return '"' + t.value + '"';
          case ui:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function qc(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], u = r.tag, f = t[l++], x = e[f];
          if (u !== 5 && u !== 26 && u !== 27 || !In(r)) {
            for (; x != null && jr(r, x); )
              f++, x = e[f];
            if (f === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return a;
      }
      function Ar(t, e) {
        if (!Fn) throw Error(s(363));
        t = Cr(t), t = qc(t, e), e = [], t = Array.from(t);
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
      function he() {
        return (gt & 2) !== 0 && vt !== 0 ? vt & -vt : rt.T !== null ? Gi() : Nf();
      }
      function Yc() {
        if (_e === 0)
          if ((vt & 536870912) === 0 || yt) {
            var t = Ll;
            Ll <<= 1, (Ll & 3932160) === 0 && (Ll = 262144), _e = t;
          } else _e = 536870912;
        return t = xe.current, t !== null && (t.flags |= 32), _e;
      }
      function ce(t, e, a) {
        (t === Ct && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null) && (cn(t, 0), ba(
          t,
          vt,
          _e,
          !1
        )), T(t, a), ((gt & 2) === 0 || t !== Ct) && (t === Ct && ((gt & 2) === 0 && (Fa |= a), Dt === 4 && ba(
          t,
          vt,
          _e,
          !1
        )), Ge(t));
      }
      function Gc(t, e, a) {
        if ((gt & 6) !== 0) throw Error(s(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || N(t, e), r = l ? nf(t, e) : Rr(t, e, !0), u = l;
        do {
          if (r === 0) {
            Cn && !l && ba(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !ef(a)) {
              r = Rr(t, e, !1), u = !1;
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
                  var x = t;
                  r = rl;
                  var H = ie && x.current.memoizedState.isDehydrated;
                  if (H && (cn(x, f).flags |= 256), f = Rr(
                    x,
                    f,
                    !1
                  ), f !== 2) {
                    if (go && !H) {
                      x.errorRecoveryDisabledLanes |= u, Fa |= u, r = 4;
                      break t;
                    }
                    u = me, me = r, u !== null && (me === null ? me = u : me.push.apply(
                      me,
                      u
                    ));
                  }
                  r = f;
                }
                if (u = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              cn(t, 0), ba(t, e, 0, !0);
              break;
            }
            t: {
              switch (l = t, u = r, u) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  ba(
                    l,
                    e,
                    _e,
                    !ka
                  );
                  break t;
                case 2:
                  me = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (r = mi + 300 - ue(), 10 < r)) {
                if (ba(
                  l,
                  e,
                  _e,
                  !ka
                ), q(l, 0, !0) !== 0) break t;
                ra = e, l.timeoutHandle = Sf(
                  Qc.bind(
                    null,
                    l,
                    a,
                    me,
                    fi,
                    vo,
                    e,
                    _e,
                    Fa,
                    jn,
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
              Qc(
                l,
                a,
                me,
                fi,
                vo,
                e,
                _e,
                Fa,
                jn,
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
      function Qc(t, e, a, l, r, u, f, x, H, Q, Z, V, L, mt) {
        if (t.timeoutHandle = Qa, V = e.subtreeFlags, V & 8192 || (V & 16785408) === 16785408) {
          V = Af(), Hc(
            e,
            u,
            V
          );
          var ee = (u & 62914560) === u ? mi - ue() : (u & 4194048) === u ? Ju - ue() : 0;
          if (ee = Of(
            V,
            ee
          ), ee !== null) {
            ra = u, t.cancelPendingCommit = ee(
              Ic.bind(
                null,
                t,
                e,
                u,
                a,
                l,
                r,
                f,
                x,
                H,
                Z,
                V,
                null,
                L,
                mt
              )
            ), ba(t, u, f, !Q);
            return;
          }
        }
        Ic(
          t,
          e,
          u,
          a,
          l,
          r,
          f,
          x,
          H
        );
      }
      function ef(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var l = 0; l < a.length; l++) {
              var r = a[l], u = r.getSnapshot;
              r = r.value;
              try {
                if (!ye(u(), r)) return !1;
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
        e &= ~bo, e &= ~Fa, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - be(r), f = 1 << u;
          l[u] = -1, r &= ~f;
        }
        a !== 0 && h(t, a, e);
      }
      function Kc() {
        return (gt & 6) === 0 ? (rn(0), !1) : !0;
      }
      function Or() {
        if (bt !== null) {
          if (Et === 0)
            var t = bt.return;
          else
            t = bt, aa = Va = null, tr(t), Sn = null, al = 0, t = bt;
          for (; t !== null; )
            wc(t.alternate, t), t = t.return;
          bt = null;
        }
      }
      function cn(t, e) {
        var a = t.timeoutHandle;
        a !== Qa && (t.timeoutHandle = Qa, kf(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, Or(), Ct = t, bt = a = Pe(t.current, null), vt = e, Et = 0, we = null, ka = !1, Cn = N(t, e), go = !1, jn = _e = bo = Fa = za = Dt = 0, me = rl = null, vo = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - be(l), u = 1 << r;
            e |= t[r], l &= ~u;
          }
        return ia = e, _l(), a;
      }
      function Vc(t, e) {
        ft = null, rt.H = ll, e === _n || e === ai ? (e = us(), Et = 3) : e === oo ? (e = us(), Et = 4) : Et = e === fo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, we = e, bt === null && (Dt = 1, Al(
          t,
          B(e, t.current)
        ));
      }
      function Xc() {
        var t = xe.current;
        return t === null ? !0 : (vt & 4194048) === vt ? Ce === null : (vt & 62914560) === vt || (vt & 536870912) !== 0 ? t === Ce : !1;
      }
      function Zc() {
        var t = rt.H;
        return rt.H = ll, t === null ? ll : t;
      }
      function Jc() {
        var t = rt.A;
        return rt.A = ah, t;
      }
      function Gl() {
        Dt = 4, ka || (vt & 4194048) !== vt && xe.current !== null || (Cn = !0), (za & 134217727) === 0 && (Fa & 134217727) === 0 || Ct === null || ba(
          Ct,
          vt,
          _e,
          !1
        );
      }
      function Rr(t, e, a) {
        var l = gt;
        gt |= 2;
        var r = Zc(), u = Jc();
        (Ct !== t || vt !== e) && (fi = null, cn(t, e)), e = !1;
        var f = Dt;
        t: do
          try {
            if (Et !== 0 && bt !== null) {
              var x = bt, H = we;
              switch (Et) {
                case 8:
                  Or(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  xe.current === null && (e = !0);
                  var Q = Et;
                  if (Et = 0, we = null, un(t, x, H, Q), a && Cn) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  Q = Et, Et = 0, we = null, un(t, x, H, Q);
              }
            }
            af(), f = Dt;
            break;
          } catch (Z) {
            Vc(t, Z);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Va = null, gt = l, rt.H = r, rt.A = u, bt === null && (Ct = null, vt = 0, _l()), f;
      }
      function af() {
        for (; bt !== null; ) Lc(bt);
      }
      function nf(t, e) {
        var a = gt;
        gt |= 2;
        var l = Zc(), r = Jc();
        Ct !== t || vt !== e ? (fi = null, ol = ue() + 500, cn(t, e)) : Cn = N(
          t,
          e
        );
        t: do
          try {
            if (Et !== 0 && bt !== null) {
              e = bt;
              var u = we;
              e: switch (Et) {
                case 1:
                  Et = 0, we = null, un(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (ss(u)) {
                    Et = 0, we = null, Wc(e);
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
                  ss(u) ? (Et = 0, we = null, Wc(e)) : (Et = 0, we = null, un(t, e, u, 7));
                  break;
                case 5:
                  var f = null;
                  switch (bt.tag) {
                    case 26:
                      f = bt.memoizedState;
                    case 5:
                    case 27:
                      var x = bt, H = x.type, Q = x.pendingProps;
                      if (f ? Ru(f) : vu(x.stateNode, H, Q)) {
                        Et = 0, we = null;
                        var Z = x.sibling;
                        if (Z !== null) bt = Z;
                        else {
                          var V = x.return;
                          V !== null ? (bt = V, Ql(V)) : bt = null;
                        }
                        break e;
                      }
                  }
                  Et = 0, we = null, un(t, e, u, 5);
                  break;
                case 6:
                  Et = 0, we = null, un(t, e, u, 6);
                  break;
                case 8:
                  Or(), Dt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            lf();
            break;
          } catch (L) {
            Vc(t, L);
          }
        while (!0);
        return aa = Va = null, rt.H = l, rt.A = r, gt = a, bt !== null ? 0 : (Ct = null, vt = 0, _l(), Dt);
      }
      function lf() {
        for (; bt !== null && !Xp(); )
          Lc(bt);
      }
      function Lc(t) {
        var e = gc(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function Wc(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = uc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              vt
            );
            break;
          case 11:
            e = uc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              vt
            );
            break;
          case 5:
            tr(e);
          default:
            wc(a, e), e = bt = iu(e, ia), e = gc(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function un(t, e, a, l) {
        aa = Va = null, tr(e), Sn = null, al = 0;
        var r = e.return;
        try {
          if (Lm(
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
        e.flags & 32768 ? (yt || l === 1 ? t = !0 : Cn || (vt & 536870912) !== 0 ? t = !1 : (ka = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = xe.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Fc(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Fc(
              e,
              ka
            );
            return;
          }
          t = e.return;
          var a = Im(
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
      function Fc(t, e) {
        do {
          var a = $m(t.alternate, t);
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
      function Ic(t, e, a, l, r, u, f, x, H) {
        t.cancelPendingCommit = null;
        do
          Ln();
        while (Xt !== 0);
        if ((gt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= so, b(
            t,
            a,
            u,
            f,
            x,
            H
          ), t === Ct && (bt = Ct = null, vt = 0), Mn = e, Na = t, ra = a, yo = u, xo = r, Lu = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, cf(to, function() {
            return au(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = rt.T, rt.T = null, r = ea(), Lt(2), f = gt, gt |= 4;
            try {
              Pm(t, e, a);
            } finally {
              gt = f, Lt(r), rt.T = l;
            }
          }
          Xt = 1, $c(), Pc(), tu();
        }
      }
      function $c() {
        if (Xt === 1) {
          Xt = 0;
          var t = Na, e = Mn, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = rt.T, rt.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Ac(e, t), wf(t.containerInfo);
            } finally {
              gt = r, Lt(l), rt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Pc() {
        if (Xt === 2) {
          Xt = 0;
          var t = Na, e = Mn, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = rt.T, rt.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Tc(t, e.alternate, e);
            } finally {
              gt = r, Lt(l), rt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function tu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Zp();
          var t = Na, e = Mn, a = ra, l = Lu;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Mn = Na = null, eu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Ea = null), et(a), e = e.stateNode, ve && typeof ve.onCommitFiberRoot == "function")
            try {
              ve.onCommitFiberRoot(
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
              for (var u = t.onRecoverableError, f = 0; f < l.length; f++) {
                var x = l[f];
                u(x.value, {
                  componentStack: x.stack
                });
              }
            } finally {
              rt.T = e, Lt(r);
            }
          }
          (ra & 3) !== 0 && Ln(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === wo ? sl++ : (sl = 0, wo = t) : sl = 0, ie && jp(), rn(0);
        }
      }
      function eu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Hn(e)));
      }
      function Ln() {
        return $c(), Pc(), tu(), au();
      }
      function au() {
        if (Xt !== 5) return !1;
        var t = Na, e = yo;
        yo = 0;
        var a = et(ra), l = 32 > a ? 32 : a;
        a = rt.T;
        var r = ea();
        try {
          Lt(l), rt.T = null, l = xo, xo = null;
          var u = Na, f = ra;
          if (Xt = 0, Mn = Na = null, ra = 0, (gt & 6) !== 0)
            throw Error(s(331));
          var x = gt;
          if (gt |= 4, Uc(u.current), Rc(
            u,
            u.current,
            f,
            l
          ), gt = x, rn(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot($n, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), rt.T = a, eu(t, e);
        }
      }
      function nu(t, e, a) {
        e = B(a, e), e = mr(t.stateNode, e, 2), t = fa(t, e, 2), t !== null && (T(t, 2), Ge(t));
      }
      function wt(t, e, a) {
        if (t.tag === 3)
          nu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              nu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Ea === null || !Ea.has(l))) {
                t = B(a, t), a = ac(2), l = fa(e, a, 2), l !== null && (nc(
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
      function Hr(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new nh();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (go = !0, r.add(a), t = rf.bind(null, t, e, a), e.then(t, t));
      }
      function rf(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Ct === t && (vt & a) === a && (Dt === 4 || Dt === 3 && (vt & 62914560) === vt && 300 > ue() - mi ? (gt & 2) === 0 && cn(t, 0) : bo |= a, jn === vt && (jn = 0)), Ge(t);
      }
      function lu(t, e) {
        e === 0 && (e = j()), t = Ua(t, e), t !== null && (T(t, e), Ge(t));
      }
      function of(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), lu(t, a);
      }
      function sf(t, e) {
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
            throw Error(s(314));
        }
        l !== null && l.delete(e), lu(t, a);
      }
      function cf(t, e) {
        return Fl(t, e);
      }
      function uf(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Dr(t) {
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
      function iu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Kl(t, e, a, l, r, u) {
        var f = 0;
        if (l = t, typeof t == "function") Dr(t) && (f = 1);
        else if (typeof t == "string")
          f = Ue && Vt ? Tu(t, a, Pt.current) ? 26 : Uu(t) ? 27 : 5 : Ue ? Tu(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Uu(t) ? 27 : 5;
        else
          t: switch (t) {
            case Zr:
              return t = o(31, a, e, r), t.elementType = Zr, t.lanes = u, t;
            case mn:
              return Ga(
                a.children,
                r,
                u,
                e
              );
            case mu:
              f = 8, r |= 24;
              break;
            case Gr:
              return t = o(12, a, e, r | 2), t.elementType = Gr, t.lanes = u, t;
            case Kr:
              return t = o(13, a, e, r), t.elementType = Kr, t.lanes = u, t;
            case Vr:
              return t = o(19, a, e, r), t.elementType = Vr, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case va:
                    f = 10;
                    break t;
                  case fu:
                    f = 9;
                    break t;
                  case Qr:
                    f = 11;
                    break t;
                  case Xr:
                    f = 14;
                    break t;
                  case ya:
                    f = 16, l = null;
                    break t;
                }
              f = 29, a = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), l = null;
          }
        return e = o(f, a, e, r), e.elementType = t, e.type = l, e.lanes = u, e;
      }
      function Ga(t, e, a, l) {
        return t = o(7, t, l, e), t.lanes = a, t;
      }
      function Ur(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function ru(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Br(t, e, a) {
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
      function df(t, e, a, l, r, u, f, x, H) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = O(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = O(0), this.hiddenUpdates = O(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = H, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function ou(t, e, a, l, r, u, f, x, H, Q, Z, V) {
        return t = new df(
          t,
          e,
          a,
          f,
          H,
          Q,
          Z,
          V,
          x
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Yi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Vi(u), t;
      }
      function su(t) {
        return t ? (t = gn, t) : gn;
      }
      function cu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = m(e), t = t !== null ? y(t) : null, t === null ? null : Wn(t.stateNode);
      }
      function uu(t, e, a, l, r, u) {
        r = su(r), l.context === null ? l.context = r : l.pendingContext = r, l = ma(e), l.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (l.callback = u), a = fa(t, l, e), a !== null && (ce(a, t, e), Un(a, t, e));
      }
      function du(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function qr(t, e) {
        du(t, e), (t = t.alternate) && du(t, e);
      }
      var ht = {}, mf = Zd(), ge = Th(), Yr = Object.assign, ff = Symbol.for("react.element"), Vl = Symbol.for("react.transitional.element"), dn = Symbol.for("react.portal"), mn = Symbol.for("react.fragment"), mu = Symbol.for("react.strict_mode"), Gr = Symbol.for("react.profiler"), fu = Symbol.for("react.consumer"), va = Symbol.for("react.context"), Qr = Symbol.for("react.forward_ref"), Kr = Symbol.for("react.suspense"), Vr = Symbol.for("react.suspense_list"), Xr = Symbol.for("react.memo"), ya = Symbol.for("react.lazy"), Zr = Symbol.for("react.activity"), pf = Symbol.for("react.memo_cache_sentinel"), pu = Symbol.iterator, hf = Symbol.for("react.client.reference"), Xl = Array.isArray, rt = mf.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, gf = i.rendererVersion, bf = i.rendererPackageName, hu = i.extraDevToolsConfig, Wn = i.getPublicInstance, vf = i.getRootHostContext, yf = i.getChildHostContext, xf = i.prepareForCommit, wf = i.resetAfterCommit, _f = i.createInstance;
      i.cloneMutableInstance;
      var Jr = i.appendInitialChild, gu = i.finalizeInitialChildren, Zl = i.shouldSetTextContent, bu = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Sf = i.scheduleTimeout, kf = i.cancelTimeout, Qa = i.noTimeout, ta = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var le = i.supportsMutation, Ke = i.supportsPersistence, ie = i.supportsHydration, zf = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var Ef = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Lt = i.setCurrentUpdatePriority, ea = i.getCurrentUpdatePriority, Nf = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var Tf = i.shouldAttemptEagerTransition, Cf = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var jf = i.maySuspendCommit, Mf = i.maySuspendCommitOnUpdate, Lr = i.maySuspendCommitInSyncRender, vu = i.preloadInstance, Af = i.startSuspendingCommit, yu = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var Of = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var fn = i.NotPendingTransition, Ka = i.HostTransitionContext, Rf = i.resetFormInstance;
      i.bindToConsole;
      var Hf = i.supportsMicrotasks, Df = i.scheduleMicrotask, Fn = i.supportsTestSelectors, Uf = i.findFiberRoot, Bf = i.getBoundingRect, qf = i.getTextContent, In = i.isHiddenSubtree, Yf = i.matchAccessibilityRole, Gf = i.setFocusIfFocusable, Qf = i.setupIntersectionObserver, Kf = i.appendChild, Vf = i.appendChildToContainer, Xf = i.commitTextUpdate, Zf = i.commitMount, Jf = i.commitUpdate, Lf = i.insertBefore, Wf = i.insertInContainerBefore, Ff = i.removeChild, If = i.removeChildFromContainer, xu = i.resetTextContent, $f = i.hideInstance, Pf = i.hideTextInstance, tp = i.unhideInstance, ep = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var ap = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var np = i.cloneInstance, wu = i.createContainerChildSet, _u = i.appendChildToContainerChildSet, lp = i.finalizeContainerChildren, Su = i.replaceContainerChildren, ku = i.cloneHiddenInstance, zu = i.cloneHiddenTextInstance, Wr = i.isSuspenseInstancePending, Fr = i.isSuspenseInstanceFallback, ip = i.getSuspenseInstanceFallbackErrorDetails, rp = i.registerSuspenseInstanceRetry, op = i.canHydrateFormStateMarker, sp = i.isFormStateMarkerMatching, Eu = i.getNextHydratableSibling, cp = i.getNextHydratableSiblingAfterSingleton, up = i.getFirstHydratableChild, dp = i.getFirstHydratableChildWithinContainer, mp = i.getFirstHydratableChildWithinActivityInstance, fp = i.getFirstHydratableChildWithinSuspenseInstance, pp = i.getFirstHydratableChildWithinSingleton, hp = i.canHydrateInstance, gp = i.canHydrateTextInstance, bp = i.canHydrateActivityInstance, vp = i.canHydrateSuspenseInstance, yp = i.hydrateInstance, xp = i.hydrateTextInstance, wp = i.hydrateActivityInstance, _p = i.hydrateSuspenseInstance, Sp = i.getNextHydratableInstanceAfterActivityInstance, kp = i.getNextHydratableInstanceAfterSuspenseInstance, zp = i.commitHydratedInstance, Ep = i.commitHydratedContainer, Np = i.commitHydratedActivityInstance, Tp = i.commitHydratedSuspenseInstance, Cp = i.finalizeHydratedChildren, jp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var Mp = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var Ap = i.clearSuspenseBoundaryFromContainer, Op = i.hideDehydratedBoundary, Rp = i.unhideDehydratedBoundary, Nu = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var Hp = i.validateHydratableInstance, Dp = i.validateHydratableTextInstance, Ue = i.supportsResources, Tu = i.isHostHoistableType, Ir = i.getHoistableRoot, Cu = i.getResource, ju = i.acquireResource, Mu = i.releaseResource, Up = i.hydrateHoistable, Au = i.mountHoistable, Ou = i.unmountHoistable, Bp = i.createHoistableInstance, qp = i.prepareToCommitHoistables, Yp = i.mayResourceSuspendCommit, Ru = i.preloadResource, Gp = i.suspendResource, Vt = i.supportsSingletons, Hu = i.resolveSingletonInstance, Qp = i.acquireSingletonInstance, Du = i.releaseSingletonInstance, Uu = i.isHostSingletonType, pn = i.isSingletonScope, $r = [], hn = -1, gn = {}, be = Math.clz32 ? Math.clz32 : _, Kp = Math.log, Vp = Math.LN2, Jl = 256, Ll = 262144, Wl = 4194304, Fl = ge.unstable_scheduleCallback, Pr = ge.unstable_cancelCallback, Xp = ge.unstable_shouldYield, Zp = ge.unstable_requestPaint, ue = ge.unstable_now, Bu = ge.unstable_ImmediatePriority, Jp = ge.unstable_UserBlockingPriority, to = ge.unstable_NormalPriority, Lp = ge.unstable_IdlePriority, Wp = ge.log, Fp = ge.unstable_setDisableYieldValue, $n = null, ve = null, ye = typeof Object.is == "function" ? Object.is : Kt, qu = typeof reportError == "function" ? reportError : function(t) {
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
      }, Ip = Object.prototype.hasOwnProperty, eo, Yu, ao = !1, Gu = /* @__PURE__ */ new WeakMap(), bn = [], vn = 0, Il = null, Pn = 0, ze = [], Ee = 0, xa = null, Ve = 1, Xe = "", Pt = E(null), tl = E(null), wa = E(null), $l = E(null), te = null, At = null, yt = !1, _a = null, Ne = !1, no = Error(s(519)), Pl = E(null), Va = null, aa = null, $p = typeof AbortController < "u" ? AbortController : function() {
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
      }, Pp = ge.unstable_scheduleCallback, th = ge.unstable_NormalPriority, Ot = {
        $$typeof: va,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ti = null, yn = null, lo = !1, ei = !1, io = !1, Xa = 0, el = null, ro = 0, xn = 0, wn = null, Qu = rt.S;
      rt.S = function(t, e) {
        Ju = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && Ym(t, e), Qu !== null && Qu(t, e);
      };
      var Za = E(null), _n = Error(s(460)), oo = Error(s(474)), ai = Error(s(542)), ni = { then: function() {
      } }, Ja = null, Sn = null, al = 0, La = ms(!0), Ku = ms(!1), Te = [], kn = 0, so = 0, Sa = !1, co = !1, zn = E(null), li = E(0), xe = E(null), Ce = null, Bt = E(0), na = 0, ft = null, Nt = null, qt = null, ii = !1, En = !1, Wa = !1, ri = 0, nl = 0, Nn = null, eh = 0, ll = {
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
      var Vu = {
        readContext: It,
        use: Nl,
        useCallback: function(t, e) {
          return oe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Us,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Cl(
            4194308,
            4,
            Gs.bind(null, e, t),
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
          var a = oe();
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
          var l = oe();
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
          }, l.queue = t, t = t.dispatch = Jm.bind(
            null,
            ft,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = oe();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = lr(t);
          var e = t.queue, a = Fs.bind(
            null,
            ft,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: or,
        useDeferredValue: function(t, e) {
          var a = oe();
          return sr(a, t, e);
        },
        useTransition: function() {
          var t = lr(!1);
          return t = Zs.bind(
            null,
            ft,
            t.queue,
            !0,
            !1
          ), oe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = ft, r = oe();
          if (yt) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), Ct === null)
              throw Error(s(349));
            (vt & 127) !== 0 || ws(l, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Us(Ss.bind(null, l, u, t), [
            t
          ]), l.flags |= 2048, on(
            9,
            { destroy: void 0 },
            _s.bind(
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
          var t = oe(), e = Ct.identifierPrefix;
          if (yt) {
            var a = Xe, l = Ve;
            a = (l & ~(1 << 32 - be(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ri++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = eh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: cr,
        useFormState: As,
        useActionState: As,
        useOptimistic: function(t) {
          var e = oe();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = ur.bind(
            null,
            ft,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: er,
        useCacheRefresh: function() {
          return oe().memoizedState = Zm.bind(
            null,
            ft
          );
        },
        useEffectEvent: function(t) {
          var e = oe(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((gt & 2) !== 0)
              throw Error(s(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, uo = {
        readContext: It,
        use: Nl,
        useCallback: Ks,
        useContext: It,
        useEffect: rr,
        useImperativeHandle: Qs,
        useInsertionEffect: qs,
        useLayoutEffect: Ys,
        useMemo: Vs,
        useReducer: Tl,
        useRef: Ds,
        useState: function() {
          return Tl(We);
        },
        useDebugValue: or,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Xs(
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
        useSyncExternalStore: xs,
        useId: Ls,
        useHostTransitionStatus: cr,
        useFormState: Os,
        useActionState: Os,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Es(a, Nt, t, e);
        },
        useMemoCache: er,
        useCacheRefresh: Ws
      };
      uo.useEffectEvent = Bs;
      var Xu = {
        readContext: It,
        use: Nl,
        useCallback: Ks,
        useContext: It,
        useEffect: rr,
        useImperativeHandle: Qs,
        useInsertionEffect: qs,
        useLayoutEffect: Ys,
        useMemo: Vs,
        useReducer: nr,
        useRef: Ds,
        useState: function() {
          return nr(We);
        },
        useDebugValue: or,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Nt === null ? sr(a, t, e) : Xs(
            a,
            Nt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = nr(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Yn(t),
            e
          ];
        },
        useSyncExternalStore: xs,
        useId: Ls,
        useHostTransitionStatus: cr,
        useFormState: Hs,
        useActionState: Hs,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Nt !== null ? Es(a, Nt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: er,
        useCacheRefresh: Ws
      };
      Xu.useEffectEvent = Bs;
      var mo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = he(), r = ma(l);
          r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (ce(e, t, l), Un(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = he(), r = ma(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (ce(e, t, l), Un(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = he(), l = ma(a);
          l.tag = 2, e != null && (l.callback = e), e = fa(t, l, a), e !== null && (ce(e, t, a), Un(e, t, a));
        }
      }, fo = Error(s(461)), Yt = !1, po = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, la = !1, Gt = !1, ho = !1, Zu = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, de = !1, Be = null, Tn = 8192, ah = {
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
      var nh = typeof WeakMap == "function" ? WeakMap : Map, gt = 0, Ct = null, bt = null, vt = 0, Et = 0, we = null, ka = !1, Cn = !1, go = !1, ia = 0, Dt = 0, za = 0, Fa = 0, bo = 0, _e = 0, jn = 0, rl = null, me = null, vo = !1, mi = 0, Ju = 0, ol = 1 / 0, fi = null, Ea = null, Xt = 0, Na = null, Mn = null, ra = 0, yo = 0, xo = null, Lu = null, sl = 0, wo = null;
      return ht.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ua(t, 67108864);
          e !== null && ce(e, t, 67108864), qr(t, 67108864);
        }
      }, ht.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = he();
          e = at(e);
          var a = Ua(t, e);
          a !== null && ce(a, t, e), qr(t, e);
        }
      }, ht.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = k(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - be(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ge(t), (gt & 6) === 0 && (ol = ue() + 500, rn(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ua(t, 2), e !== null && ce(e, t, 2), Kc(), qr(t, 2);
        }
      }, ht.batchedUpdates = function(t, e) {
        return t(e);
      }, ht.createComponentSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, ht.createContainer = function(t, e, a, l, r, u, f, x, H, Q) {
        return ou(
          t,
          e,
          !1,
          null,
          a,
          l,
          u,
          null,
          f,
          x,
          H,
          Q
        );
      }, ht.createHasPseudoClassSelector = function(t) {
        return { $$typeof: si, value: t };
      }, ht.createHydrationContainer = function(t, e, a, l, r, u, f, x, H, Q, Z, V, L, mt) {
        return t = ou(
          a,
          l,
          !0,
          t,
          r,
          u,
          x,
          mt,
          H,
          Q,
          Z,
          V
        ), t.context = su(null), a = t.current, l = he(), l = at(l), r = ma(l), r.callback = e ?? null, fa(a, r, l), e = l, t.current.lanes = e, T(t, e), Ge(t), t;
      }, ht.createPortal = function(t, e, a) {
        var l = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: dn,
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
        qu(t);
      }, ht.defaultOnUncaughtError = function(t) {
        qu(t);
      }, ht.deferredUpdates = function(t) {
        var e = rt.T, a = ea();
        try {
          return Lt(32), rt.T = null, t();
        } finally {
          Lt(a), rt.T = e;
        }
      }, ht.discreteUpdates = function(t, e, a, l, r) {
        var u = rt.T, f = ea();
        try {
          return Lt(2), rt.T = null, t(e, a, l, r);
        } finally {
          Lt(f), rt.T = u, gt === 0 && (ol = ue() + 500);
        }
      }, ht.findAllNodes = Ar, ht.findBoundingRects = function(t, e) {
        if (!Fn) throw Error(s(363));
        e = Ar(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Bf(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, u = a.y, f = u + a.height, x = e - 1; 0 <= x; x--)
            if (e !== x) {
              var H = t[x], Q = H.x, Z = Q + H.width, V = H.y, L = V + H.height;
              if (l >= Q && u >= V && r <= Z && f <= L) {
                t.splice(e, 1);
                break;
              } else if (l !== Q || a.width !== H.width || L < u || V > f) {
                if (!(u !== V || a.height !== H.height || Z < l || Q > r)) {
                  Q > l && (H.width += Q - l, H.x = l), Z < r && (H.width = r - Q), t.splice(e, 1);
                  break;
                }
              } else {
                V > u && (H.height += V - u, H.y = u), L < f && (H.height = f - V), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ht.findHostInstance = cu, ht.findHostInstanceWithNoPortals = function(t) {
        return t = m(t), t = t !== null ? w(t) : null, t === null ? null : Wn(t.stateNode);
      }, ht.findHostInstanceWithWarning = function(t) {
        return cu(t);
      }, ht.flushPassiveEffects = Ln, ht.flushSyncFromReconciler = function(t) {
        var e = gt;
        gt |= 1;
        var a = rt.T, l = ea();
        try {
          if (Lt(2), rt.T = null, t)
            return t();
        } finally {
          Lt(l), rt.T = a, gt = e, (gt & 6) === 0 && rn(0);
        }
      }, ht.flushSyncWork = Kc, ht.focusWithin = function(t, e) {
        if (!Fn) throw Error(s(363));
        for (t = Cr(t), e = qc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!In(a)) {
            if ((l === 5 || l === 26 || l === 27) && Gf(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ht.getFindAllNodesFailureDescription = function(t, e) {
        if (!Fn) throw Error(s(363));
        var a = 0, l = [];
        t = [Cr(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], f = u.tag, x = t[r++], H = e[x];
          if ((f !== 5 && f !== 26 && f !== 27 || !In(u)) && (jr(u, H) && (l.push(Mr(H)), x++, x > a && (a = x)), x < e.length))
            for (u = u.child; u !== null; )
              t.push(u, x), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Mr(e[a]));
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
          version: gf,
          rendererPackageName: bf,
          currentDispatcherRef: rt,
          reconcilerVersion: "19.2.0"
        };
        if (hu !== null && (t.rendererConfig = hu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              $n = e.inject(t), ve = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ht.isAlreadyRendering = function() {
        return (gt & 6) !== 0;
      }, ht.observeVisibleRects = function(t, e, a, l) {
        if (!Fn) throw Error(s(363));
        t = Ar(t, e);
        var r = Qf(
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
        if (t.tag !== 5) throw Error(s(476));
        var r = Js(t).queue;
        Zs(
          t,
          r,
          e,
          fn,
          a === null ? c : function() {
            var u = Js(t);
            return u.next === null && (u = t.alternate.memoizedState), Gn(
              t,
              u.next.queue,
              {},
              he()
            ), a(l);
          }
        );
      }, ht.updateContainer = function(t, e, a, l) {
        var r = e.current, u = he();
        return uu(
          r,
          u,
          t,
          e,
          a,
          l
        ), u;
      }, ht.updateContainerSync = function(t, e, a, l) {
        return uu(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, ht;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(zo)), zo.exports;
}
var od;
function jh() {
  return od || (od = 1, ko.exports = Ch()), ko.exports;
}
var Mh = jh();
const Ah = /* @__PURE__ */ Lo(Mh);
var To = { exports: {} }, oa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var sd;
function Oh() {
  return sd || (sd = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var cd;
function Rh() {
  return cd || (cd = 1, To.exports = Oh()), To.exports;
}
var pl = Rh();
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
const Jd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Ro = 16, Ld = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Hh = [
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
], ud = {
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
}, Dh = /* @__PURE__ */ new Set([
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
]), Wd = {
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
}, Fd = {
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
}, Ho = ["font-size", "color", ...new Set([...Object.keys(Wd), ...Object.keys(Fd)].filter((n) => n !== "font-size" && n !== "color"))], Uh = new Set(Ho);
function ae(n, i = " ") {
  const o = [];
  let c = 0, s = "";
  for (let d = 0; d < n.length; d++) {
    const p = n[d];
    if (p === "(" ? c++ : p === ")" && c--, c === 0 && (i === " " ? /\s/.test(p) : p === i)) {
      (s.trim() || i !== " ") && o.push(s.trim()), s = "";
      continue;
    }
    s += p;
  }
  return (s.trim() || i !== " " && o.length) && o.push(s.trim()), o;
}
function Do(n, i, o = 0) {
  if (o > 32) return null;
  let c = "", s = 0;
  for (; ; ) {
    const d = n.indexOf("var(", s);
    if (d < 0)
      return c += n.slice(s), c;
    c += n.slice(s, d);
    let p = 1, m = d + 4;
    for (; m < n.length && p; m++)
      n[m] === "(" ? p++ : n[m] === ")" && p--;
    const y = n.slice(d + 4, m - 1), w = ae(y, ","), A = w[0].trim(), D = w.length > 1 ? y.slice(y.indexOf(",") + 1).trim() : null;
    let E = i(A);
    if ((E == null || E === "initial") && (E = D), E == null) return null;
    const g = Do(E, i, o + 1);
    if (g === null) return null;
    c += g, s = m;
  }
}
function Bh(n) {
  const i = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let c, s = 0;
  for (; s < n.length; ) {
    if (o.lastIndex = s, c = o.exec(n), !c || c.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = o.lastIndex, c[1] !== void 0 ? i.push({ num: parseFloat(c[1]), unit: (c[2] ?? "").toLowerCase() }) : c[3] ? i.push({ fn: c[3].toLowerCase() }) : c[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: c[5] ?? c[6] });
  }
  return i;
}
function en(n, i) {
  const o = Bh(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let c = 0;
  const s = ({ num: E, unit: g }) => {
    switch (g) {
      case "":
        return { px: 0, pct: 0, num: E, unitless: !0 };
      case "px":
        return { px: E, pct: 0, num: 0 };
      case "rem":
        return { px: E * Ro, pct: 0, num: 0 };
      case "em":
        return { px: E * (i.fontSize ?? Ro), pct: 0, num: 0 };
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
  }, d = (E, g, S) => E && g ? { px: E.px + S * g.px, pct: E.pct + S * g.pct, num: E.num + S * g.num, unitless: E.unitless && g.unitless } : null, p = (E, g) => E ? { px: E.px * g, pct: E.pct * g, num: E.num * g, unitless: E.unitless } : null, m = (E) => E && E.unitless;
  function y() {
    const E = o[c++];
    if (!E) return null;
    if (E.num !== void 0) return s(E);
    if (E.op === "(") {
      const g = A();
      return o[c]?.op !== ")" ? null : (c++, g);
    }
    if (E.op === "-" || E.op === "+") {
      const g = y();
      return E.op === "-" ? p(g, -1) : g;
    }
    if (E.fn) {
      const g = [];
      for (; ; ) {
        g.push(A());
        const k = o[c++];
        if (!k) return null;
        if (k.op === ")") break;
        if (k.op !== ",") return null;
      }
      if (g.some((k) => !k)) return null;
      if (E.fn === "calc") return g[0];
      if (!(g.every((k) => !k.pct) || g.every((k) => !k.px && !k.num))) return null;
      const _ = (k) => k.px + k.pct + k.num;
      return E.fn === "min" ? g.reduce((k, q) => _(q) < _(k) ? q : k) : E.fn === "max" ? g.reduce((k, q) => _(q) > _(k) ? q : k) : E.fn === "clamp" && g.length === 3 ? _(g[1]) < _(g[0]) ? g[0] : _(g[1]) > _(g[2]) ? g[2] : g[1] : null;
    }
    return null;
  }
  function w() {
    let E = y();
    for (; o[c] && (o[c].op === "*" || o[c].op === "/"); ) {
      const g = o[c++].op, S = y();
      if (!E || !S) return null;
      g === "*" ? E = m(S) ? p(E, S.num) : m(E) ? p(S, E.num) : null : E = m(S) && S.num !== 0 ? p(E, 1 / S.num) : null;
    }
    return E;
  }
  function A() {
    let E = w();
    for (; o[c] && (o[c].op === "+" || o[c].op === "-"); ) {
      const g = o[c++].op;
      E = d(E, w(), g === "-" ? -1 : 1);
    }
    return E;
  }
  const D = A();
  return c !== o.length || !D ? null : D;
}
function Uo(n, i) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const c = en(o, i);
  return c ? c.unitless ? c.num === 0 ? { px: 0 } : { expr: n.trim() } : c.pct && (c.px || c.num) ? { expr: n.trim() } : c.pct ? { pct: c.pct } : { px: qh(c.px) } : { expr: n.trim() };
}
const qh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, gi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Yh = ([n, i, o, c]) => `#${gi(n)}${gi(i)}${gi(o)}${gi(c * 255)}`;
function dd(n) {
  const i = n.slice(1), o = i.length <= 4 ? i.split("").map((s) => s + s).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const c = (s) => parseInt(o.slice(s, s + 2), 16);
  return [c(0), c(2), c(4), o.length === 8 ? c(6) / 255 : 1];
}
function zi(n, i) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const c = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (c) {
    const w = i(c[1]), A = w && dd(w);
    return A ? { rgba: A, token: c[1] } : null;
  }
  if (o.startsWith("#")) {
    const w = dd(o);
    return w ? { rgba: w, token: null } : null;
  }
  if (ud[o]) return { rgba: [...ud[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const w = ae(s[2], ",");
    if (w.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(w[0])) return null;
    const A = (Mt) => {
      const Kt = ae(Mt), Tt = Kt.findIndex((lt) => /%$/.test(lt)), K = Tt >= 0 ? parseFloat(Kt[Tt]) / 100 : null;
      return { color: zi(Kt.filter((lt, B) => B !== Tt).join(" "), i), pct: K };
    }, D = A(w[1]), E = A(w[2]);
    if (!D.color || !E.color || D.color === "currentcolor" || E.color === "currentcolor") return null;
    let g = D.pct, S = E.pct;
    g === null && S === null ? (g = 0.5, S = 0.5) : g === null ? g = 1 - S : S === null && (S = 1 - g);
    const _ = g + S, k = _ < 1 ? _ : 1;
    g /= _, S /= _;
    const [q, N, z, j] = D.color.rgba, [O, T, b, h] = E.color.rgba, U = j * g + h * S, J = (Mt, Kt) => U === 0 ? 0 : (Mt * j * g + Kt * h * S) / U, at = [J(q, O), J(N, T), J(z, b), U * k], et = h === 0 ? D.color.token : j === 0 ? E.color.token : null;
    return { rgba: at, token: et };
  }
  const d = s[2].includes(",") ? ae(s[2], ",") : ae(s[2].replace("/", " / ")).filter((w) => w !== "/");
  if (d.length < 3) return null;
  const p = (w) => w.endsWith("%") ? parseFloat(w) / 100 * 255 : parseFloat(w), m = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), y = [p(d[0]), p(d[1]), p(d[2]), m];
  return y.some((w) => Number.isNaN(w)) ? null : { rgba: y, token: null };
}
const ml = ["top", "right", "bottom", "left"], Gh = ["top-left", "top-right", "bottom-right", "bottom-left"], bi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], md = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Bo(n, i) {
  const o = i.trim(), c = () => ae(o);
  switch (n) {
    case "padding":
    case "margin": {
      const s = bi(c());
      return ml.map((d, p) => [`${n}-${d}`, s[p]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = c(), d = n.split("-")[0];
      return [[`${d}-left`, s[0]], [`${d}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = c(), d = n.split("-")[0];
      return [[`${d}-top`, s[0]], [`${d}-bottom`, s[1] ?? s[0]]];
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
      const s = bi(c());
      return ml.map((d, p) => [d, s[p]]);
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
      return [["left", o]];
    case "inset-inline-end":
      return [["right", o]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const s = n.split("-")[1], d = bi(c());
      return ml.map((p, m) => [`border-${p}-${s}`, d[m]]);
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
      const s = n === "border" ? ml : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", p = "none", m = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const y of c())
          md.has(y) ? p = y : /^(thin|medium|thick|-?[\d.]|calc\()/.test(y) ? d = y : m = y;
      else o === "0" && (d = "0");
      return s.flatMap((y) => [[`border-${y}-width`, d], [`border-${y}-style`, p], [`border-${y}-color`, m]]);
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
      const s = bi(ae(o.split("/")[0]));
      return Gh.map((d, p) => [`border-${d}-radius`, s[p]]);
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
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(o) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((s) => [s, o]) : [[n, o]];
    case "overflow": {
      const s = c();
      return [["overflow-x", s[0]], ["overflow-y", s[1] ?? s[0]]];
    }
    case "gap": {
      const s = c();
      return [["row-gap", s[0]], ["column-gap", s[1] ?? s[0]]];
    }
    case "grid-gap":
      return Bo("gap", o);
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
      if (o === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (o === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (o === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const s = c(), d = s.filter((m) => /^[\d.]+$/.test(m)), p = s.find((m) => !/^[\d.]+$/.test(m));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", p ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const d of c()) s.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return s;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", d = "none", p = "currentcolor";
      for (const m of c())
        md.has(m) || m === "auto" ? d = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? s = m : p = m;
      return [["outline-width", s], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ae(o, ","), d = s.map((m) => ae(m).find((y) => !/^[\d.]+m?s$/.test(y) && !/^(ease|linear|step|cubic)/.test(y)) ?? "all"), p = s.map((m) => ae(m).find((y) => /^[\d.]+m?s$/.test(y)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", p.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", c()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", o]];
    case "word-wrap":
      return [["overflow-wrap", o]];
    default:
      return [[n, o]];
  }
}
function Qh(n, i) {
  return n ? ae(n, ",").some((o) => {
    let c = o.trim().toLowerCase(), s = !1;
    c.startsWith("not ") && (s = !0, c = c.slice(4)), c.startsWith("only ") && (c = c.slice(5));
    const d = c.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const m = /^\((.+)\)$/.exec(p);
      if (!m) return !1;
      const y = m[1].trim(), w = /^([a-z-]+)\s*:\s*(.+)$/.exec(y);
      if (w) {
        const [, D, E] = w, g = (S) => {
          const _ = Uo(S, { viewport: i });
          return typeof _ == "object" && "px" in _ ? _.px : NaN;
        };
        switch (D) {
          case "min-width":
            return i.width >= g(E);
          case "max-width":
            return i.width <= g(E);
          case "min-height":
            return i.height >= g(E);
          case "max-height":
            return i.height <= g(E);
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
      const A = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(y);
      if (A) {
        const D = A[1] === "width" ? i.width : i.height, E = Uo(A[3], { viewport: i }), g = typeof E == "object" && "px" in E ? E.px : NaN;
        switch (A[2]) {
          case ">=":
            return D >= g;
          case "<=":
            return D <= g;
          case ">":
            return D > g;
          case "<":
            return D < g;
          default:
            return D === g;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function Kh(n, i) {
  const o = i[i.length - 1].compound;
  return Wo(o)[0] ?? n;
}
function Vh(n) {
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = (s, d) => {
    s.forEach(({ compound: p }, m) => {
      const y = d && m === s.length - 1;
      for (const w of p.pseudos)
        if (Ld.has(w.name) && (y ? i : o).add(w.name), w.list && w.name !== "not") for (const A of w.list) c(A, y);
    });
  };
  return c(n, !0), { subject: i, ancestor: o };
}
function Wo(n) {
  const i = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const c of o.list) c.length === 1 && i.push(...Wo(c[0].compound));
  return i;
}
function Xh(n, i) {
  const o = (c, s) => {
    c.forEach(({ compound: d }, p) => {
      const m = s && p === c.length - 1, y = d.pseudos.filter((w) => Ld.has(w.name)).map((w) => w.name);
      if (!m) for (const w of y) for (const A of Wo(d)) i.add(`${w}:${A}`);
      for (const w of d.pseudos) if (w.list && w.name !== "not") for (const A of w.list) o(A, m);
    });
  };
  o(n, !0);
}
class Zh {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const m = p[p.length - 1].compound, y = m.classes.length ? `.${m.classes[0]}` : m.tag && m.tag !== "*" ? m.tag : "*";
      this.index.has(y) || this.index.set(y, []), this.index.get(y).push(d);
    };
    let c = 0;
    const s = (d, p) => {
      for (const [m, y, w, A] of d)
        for (const D of Xo(m)) {
          let E;
          try {
            E = Zo(D);
          } catch (_) {
            if (_ instanceof ke) {
              this.skipped++;
              continue;
            }
            throw _;
          }
          const g = Vh(E);
          Xh(E, this.trackedStates);
          const S = { steps: E, media: y, layer: w, origin: p, order: c++, specificity: Gd(E), decls: A, states: g, source: p === 0 ? `ua:${E[E.length - 1].compound.tag ?? "*"}` : Kh(D, E) };
          this.rules.push(S), o(S, E);
        }
    };
    s(Hh.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), s(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const o = [], c = /* @__PURE__ */ new Set(), s = (d) => {
      if (d) for (const p of d) c.has(p) || (c.add(p), o.push(p));
    };
    for (const d of i.classList) s(this.index.get(`.${d}`));
    return s(this.index.get(i.tagName)), s(this.index.get("*")), o;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, o) {
    for (const c of i.classList) if (this.trackedStates.has(`${o}:${c}`)) return !0;
    return !1;
  }
}
const Jh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function Lh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [o, c] of Object.entries(n)) {
    if (c == null || c === "" || typeof c == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof c == "number" && c !== 0 && !Jh.has(s) && !s.startsWith("--") ? `${c}px` : String(c);
    i.push([s, d]);
  }
  return i;
}
function Wh(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const o of ["width", "height"]) {
    const c = n.getAttribute(o);
    c !== null && i.push([o, /^[\d.]+$/.test(c) ? `${c}px` : c]);
  }
  return i;
}
const Fh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class Ih {
  constructor(i, { theme: o, viewport: c }) {
    this.sheet = i, this.theme = o, this.viewport = c, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, o) {
    const c = (s, d, p) => {
      if (d === "disabled") return !!s.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(s.tagName);
      if (d === "enabled") return !s.props?.disabled && ["button", "input", "select", "textarea"].includes(s.tagName);
      if (d === "checked") return !!s.props?.checked;
      if (o === "*") return !0;
      if (d === "focus-within") {
        const m = s.ownerDocument?.activeElement;
        return !!m && m !== s.ownerDocument.body && typeof s.contains == "function" && s.contains(m);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!s.state?.focus && !s.state?.pointerFocus : !!s.state?.[d];
    };
    return this.sheet.candidates(i).filter((s) => (!s.media || s.media.every((d) => Qh(d, this.viewport))) && Qd(i, s.steps, { state: c }));
  }
  compute(i, o, c = /* @__PURE__ */ new Set()) {
    const s = this.matching(i, c), d = [];
    for (const b of s)
      for (const [h, U, J] of b.decls) d.push({ prop: h, value: U, important: J ? 1 : 0, origin: b.origin === 0 ? 0 : 2, layer: b.layer, specificity: b.specificity, order: b.order, source: b.source });
    for (const [b, h] of Wh(i)) d.push({ prop: b, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${b}` });
    for (const [b, h] of Lh(i.inlineStyle ?? i.props?.style)) d.push({ prop: b, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(Fh);
    const p = this.sheet.properties, m = Object.create(o?.customs ?? null), y = /* @__PURE__ */ new Map(), w = /* @__PURE__ */ new Map();
    for (const b of d) b.prop.startsWith("--") && w.set(b.prop, b.value);
    if (!o && this.theme) for (const b of Jd) this.theme[b] && w.set(`--${b}`, `perchtoken(${b})`);
    const A = (b) => {
      if (y.has(b)) return y.get(b);
      const h = p[b];
      return h && !h.inherits ? h.initial ?? null : b in m ? m[b] : h?.initial ?? null;
    }, D = /* @__PURE__ */ new Set(), E = (b) => {
      if (!w.has(b)) return A(b);
      if (D.has(b)) return null;
      D.add(b);
      const h = Do(w.get(b), E);
      return D.delete(b), w.delete(b), y.set(b, h), (!p[b] || p[b].inherits) && (m[b] = h), h;
    };
    for (const b of [...w.keys()]) E(b);
    const g = /* @__PURE__ */ new Map();
    for (const b of d) {
      if (b.prop.startsWith("--")) continue;
      const h = Do(b.value, A);
      if (h === null) {
        for (const [U] of Bo(b.prop, "unset")) g.set(U, { value: "unset", source: b.source, origin: b.origin });
        continue;
      }
      for (const [U, J] of Bo(b.prop, h)) g.set(U, { value: J, source: b.source, origin: b.origin });
    }
    const S = {}, _ = {}, k = /* @__PURE__ */ new Set(), q = /* @__PURE__ */ new Set(), N = o?.values, z = { fontSize: N?.["font-size"] ?? Ro, viewport: this.viewport }, j = (b, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(b, h, z, S, N);
      const U = `${b}\0${h}\0${z.fontSize}`;
      let J = this.parsed.get(U);
      return J === void 0 && this.parsed.set(U, J = this.parseValue(b, h, z, S, N)), J;
    }, O = g.size ? [...Ho, ...[...g.keys()].filter((b) => !Uh.has(b))] : Ho;
    for (const b of O) {
      const h = g.get(b);
      let U = h?.value;
      const J = Dh.has(b);
      if ((U === void 0 || U === "unset" || U === "revert" || U === "revert-layer") && (U = J ? "inherit" : "initial"), h && (_[b] = h.source, h.origin !== 0 && k.add(b)), U === "inherit" && N && b in N) {
        S[b] = N[b], q.add(b);
        continue;
      }
      (U === "inherit" || U === "initial") && (U = J ? Fd[b] : Wd[b]), S[b] = j(b, U), b === "font-size" && (z.fontSize = S["font-size"]);
    }
    for (const b of ml) {
      const h = S[`border-${b}-style`];
      (h === "none" || h === "hidden") && (S[`border-${b}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const T = N?.display;
    return (T === "flex" || T === "inline-flex" || T === "grid" || T === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = fd(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = fd(S.display)), { values: S, sources: _, own: k, inherited: q, customs: m, rules: s, element: i };
  }
  parseValue(i, o, c, s, d) {
    const p = String(o).trim();
    switch (i) {
      case "font-size": {
        const m = p.toLowerCase(), y = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (y[m]) return y[m];
        if (m === "smaller") return c.fontSize / 1.2;
        if (m === "larger") return c.fontSize * 1.2;
        const w = en(m, { fontSize: c.fontSize, viewport: c.viewport });
        return !w || w.num ? c.fontSize : w.px + w.pct / 100 * c.fontSize;
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
        const y = en(m, { fontSize: c.fontSize, viewport: c.viewport });
        return y ? y.unitless ? { factor: y.num } : { px: y.px + y.pct / 100 * c.fontSize } : { normal: !0 };
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
        const m = zi(p, (y) => this.themeHex(y));
        return m === "currentcolor" || !m ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : m;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const m = zi(p, (y) => this.themeHex(y));
        return m === "currentcolor" ? s.color : m ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
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
        return Uo(p, c);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function fd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Ei = (n) => n && n.rgba ? { value: Yh(n.rgba), token: n.token ?? null } : null, $h = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Ph(n, i) {
  const o = i?.(n);
  if (Number.isFinite(o)) return o;
  const c = Math.round(n * 100) / 100;
  return $h[c] ?? Math.round(n * 1.2);
}
function Ni(n, i) {
  const o = n["line-height"], c = n["font-size"];
  return o.normal ? Ph(c, i) : o.factor !== void 0 ? o.factor * c : o.px;
}
const t0 = (n) => ae(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const e0 = "perch-native-description/1", An = Symbol("display"), Ti = {
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
}, a0 = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of a0) Ti[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Ti.rounded = 0;
const n0 = /* @__PURE__ */ new Set([
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
]), l0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, i0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, r0 = (n) => i0.test(n) ? "Menlo" : l0.test(n) ? ".SystemUIFont" : t0(n).split(",")[0].trim(), o0 = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, pd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Id = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const c = n.parentElement;
  return c && c.tagName !== "body" ? `${Id(c)} > ${n.tagName}` : n.tagName;
};
class s0 {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, o, c, s, d, p = "") {
    const m = `${i}|${o}|${c}|${s}`, y = this.map.get(m);
    if (y) {
      !y.elements.includes(d) && y.elements.length < 4 && y.elements.push(d), y.count++;
      return;
    }
    this.map.set(m, { kind: i, property: o, value: String(c), class: s ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
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
}, c0 = /^(text|search|url|email|tel|password|number)$/, u0 = 162.13 / 12.8;
function d0(n, i) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const c = ae(o[1], ",").map((s) => en(s.trim(), { fontSize: i })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return c.length ? Math.min(...c) : void 0;
}
function m0(n, i) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = en(n.expr, { fontSize: i["font-size"] }), c = (i["margin-left"]?.px ?? NaN) + (i["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + c) < 0.01;
}
function $d(n) {
  const i = n.transform;
  if (i && i !== "none") {
    const c = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), s = c && ae(c[2], ",").map((d) => d.trim());
    return !s || s.length > (c[1] ? 1 : 2) ? null : c[1] === "X" ? [s[0], "0"] : c[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const c = ae(String(o).trim(), " ").filter(Boolean);
    return c.length > 3 || c[2] !== void 0 && en(c[2], {})?.px ? null : [c[0], c[1] ?? "0"];
  }
  return [];
}
function hd(n, i, o, c = !1) {
  const s = n.values, d = $d(s);
  if (d?.length === 0) return;
  const p = s.transform && s.transform !== "none" ? "transform" : "translate", m = { fontSize: s["font-size"] }, y = (D, E) => {
    const g = en(D, m);
    if (!(!g || g.unitless && g.num))
      return g.pct ? typeof E == "number" ? g.px + g.pct / 100 * E : void 0 : g.px;
  }, w = d ? y(d[0], i.w) : void 0, A = d ? y(d[1], i.h) : void 0;
  if (w === void 0 || A === void 0) {
    o("unsupported", p, s[p], n.sources[p]);
    return;
  }
  if (c) {
    w && (i.left = w), A && (i.top = A);
    return;
  }
  w && (i.ml = (i.ml ?? 0) + w), A && (i.mt = (i.mt ?? 0) + A);
}
function gd(n, i, o = null) {
  const c = n.values, s = {}, d = (N) => n.sources[N], p = (N) => n.sources[N] !== void 0, m = c.display;
  m === "none" ? s.display = "hidden" : m === "flex" || m === "inline-flex" ? s.display = "flex" : (m === "grid" || m === "inline-grid") && (s.display = "flex", s.flex_direction = "col", i("approximated", "display", m, d("display"), "one-column flex column"), c["grid-template-columns"] && c["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", c["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const y = s.display === "flex";
  if (y && s.flex_direction !== "col") {
    const N = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[c["flex-direction"]] ?? "row";
    s.flex_direction = N;
  }
  if (y) {
    (c["flex-wrap"] === "wrap" || c["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const N = m === "grid" || m === "inline-grid", z = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[c["align-items"]];
    z && (s.items = z);
    let j = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[c["justify-content"]];
    if (N) {
      const b = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[c["justify-items"]];
      b && (s.items = b), c["align-items"] === "center" && (j = "center");
    }
    j && (s.justify = j);
    const O = ca(c["row-gap"]), T = ca(c["column-gap"]);
    typeof O == "number" && O && (s.gap_y = O), typeof T == "number" && T && !N && (s.gap_x = T);
  }
  c["flex-grow"] && (s.flex_grow = c["flex-grow"]), c["flex-shrink"] !== 1 && (s.flex_shrink = c["flex-shrink"]);
  const w = ca(c["flex-basis"]);
  w !== void 0 && w !== "auto" && (s.flex_basis = w);
  const A = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[c["align-self"]];
  A && (s.self = A);
  for (const [N, z] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const j = c[z], O = ca(j);
    if (O === void 0 && z === "width" && m0(j, c)) {
      s.self = "stretch", i("approximated", z, j.expr, d(z), "stretched across its parent, inside its margins");
      continue;
    }
    const T = O === void 0 && /^max-/.test(z) ? d0(j, c["font-size"]) : void 0;
    if (T !== void 0) {
      s[N] = T, i("approximated", z, j.expr, d(z), "the fixed bound of min()");
      continue;
    }
    if (O === void 0) {
      typeof j == "object" && j.expr ? i("unsupported", z, j.expr, d(z), "no calc() in the engine") : typeof j == "string" && !["auto", "none"].includes(j) && i("unsupported", z, j, d(z));
      continue;
    }
    O !== "auto" && (s[N] = O);
  }
  const D = ["top", "right", "bottom", "left"];
  for (const N of D) {
    const z = N[0];
    for (const [j, O] of [["p", "padding"], ["m", "margin"]]) {
      const T = c[`${O}-${N}`], b = ca(T);
      if (b === void 0) {
        T?.expr && i("unsupported", `${O}-${N}`, T.expr, d(`${O}-${N}`), "no calc() in the engine");
        continue;
      }
      b !== 0 && (s[`${j}${z}`] = b);
    }
  }
  const E = c.position;
  if (E === "absolute" || E === "fixed") {
    s.position = "absolute", E === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const N of D) {
      const z = ca(c[N]);
      z !== void 0 && z !== "auto" && (s[N] = z);
    }
    if (E === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const N = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, N) : N;
    }
    hd(n, s, i);
  } else E === "sticky" ? i("unsupported", "position", "sticky", d("position")) : $d(c)?.length !== 0 && (s.position = "relative", hd(n, s, i, !0));
  c["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", c["z-index"], d("z-index"), "paint order is tree order");
  for (const [N, z] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const j = c[z];
    j === "hidden" || j === "clip" ? s[N] = "hidden" : (j === "auto" || j === "scroll") && (s[N] = "scroll");
  }
  (c.visibility === "hidden" || c.visibility === "collapse") && (s.visibility = "invisible");
  const g = c["background-color"];
  g?.unreadable ? i("unsupported", "background-color", g.unreadable, d("background-color")) : g?.rgba && g.rgba[3] > 0 && (s.bg = Ei(g)), c["background-image"] && c["background-image"] !== "none" && i("unsupported", "background-image", c["background-image"], d("background-image"));
  const S = D.map((N) => ca(c[`border-${N}-width`]) || 0), _ = [];
  D.forEach((N, z) => {
    if (!S[z]) return;
    s[`border_${N[0]}`] = S[z];
    const j = c[`border-${N}-style`];
    j !== "solid" && i("approximated", `border-${N}-style`, j, d(`border-${N}-style`), "drawn solid");
    const O = Ei(c[`border-${N}-color`]);
    O && _.push(O);
  }), _.length && (s.border_color = _[0], _.some((N) => N.value !== _[0].value) && i("approximated", "border-color", _.map((N) => N.value).join(" "), d("border-top-color"), "one border colour"));
  const k = ["top-left", "top-right", "bottom-right", "bottom-left"].map((N) => ca(c[`border-${N}-radius`]) || 0);
  k.every((N) => N === k[0]) ? k[0] && (s.rounded = k[0]) : ["tl", "tr", "br", "bl"].forEach((N, z) => {
    k[z] && (s[`rounded_${N}`] = k[z]);
  }), c.opacity !== 1 && (s.opacity = Math.round(c.opacity * 1e3) / 1e3);
  const q = c["box-shadow"];
  if (q && q !== "none" && ae(q, ",").some((N) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(N.trim())) && (s.shadow = "lg", i("approximated", "box-shadow", q, d("box-shadow"), "the engine's large shadow preset")), c.cursor && c.cursor !== "auto" && !n.inherited.has("cursor")) {
    const N = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[c.cursor];
    N ? s.cursor = N : i("unsupported", "cursor", c.cursor, d("cursor"));
  }
  return c["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), c["text-decoration-line"] === "underline" ? s.underline = !0 : c["text-decoration-line"] && c["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", c["text-decoration-line"], d("text-decoration-line")), s;
}
const f0 = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Pd(n) {
  if (!n || n === "normal") return "";
  const i = String(n).trim().split(/\s+/).map((o) => f0[o]);
  return i.every(Boolean) ? i.join(",") : null;
}
function bd(n, i) {
  const o = n.values, c = o["line-height"];
  return {
    text_color: Ei(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Pd(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: c.factor !== void 0 ? { factor: c.factor } : { px: Math.round(Ni(o, i) * 1e3) / 1e3 },
    font_family: r0(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const vd = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, tm = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function yd(n, i, o) {
  const c = {}, s = (m, y) => y.some((w) => !n.inherited.has(w));
  for (const [m, y] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(m, y) || !tm(i[m], o[m])) && (c[m] = i[m]);
  const d = vd(i.line_height, i.text_size), p = o.line_height ? vd(o.line_height, i.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (c.line_height = i.line_height), c;
}
const p0 = (n, i) => ({ ...n, ...i });
function xd(n, i) {
  const o = {};
  for (const [c, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[c] = s.value, s.token && (i[c] = s.token)) : c === "line_height" ? o[c] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : c === "italic" ? s && (o.italic = !0) : o[c] = s;
  return o.italic === !1 && delete o.italic, o;
}
function h0(n, i) {
  const o = {};
  for (const c of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const s = n[c], d = i[c];
    tm(s, d) || (o[c] = d === void 0 ? c in Ti ? Ti[c] : null : d);
  }
  return o;
}
function wd(n, i) {
  const o = n.values;
  for (const [c, s] of Object.entries(n.sources)) {
    if (c.startsWith("--") || n0.has(c) || s.startsWith("ua:")) continue;
    const d = o[c];
    switch (c) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", c, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Pd(d) === null && i("unsupported", c, d, s);
        break;
      case "text-transform":
        d !== "none" && i("approximated", c, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        c === "transition-property" && p && ae(p, ",").some((m) => parseFloat(m) > 0) && o["transition-property"] !== "none" && i("unsupported", "transition", `${o["transition-property"]} ${p}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && i("unsupported", c, d, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        c === "overflow-wrap" && d !== "normal" && i("approximated", c, d, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && c === "outline-style" && i("unsupported", "outline", `${ca(o["outline-width"])}px ${o["outline-style"]} ${Ei(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
        break;
      case "transform":
      case "translate":
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && i("unsupported", c, d, s);
        break;
    }
  }
}
function g0(n, i, o, c) {
  const s = Id(n), d = [], p = (k, q, N, z, j) => d.push([k, q, N, z ?? "(user agent)", s, j]), m = c.cascade.compute(n, i), y = {}, w = gd(m, p, c.viewport);
  wd(m, p);
  const A = bd(m, c.measure), D = yd(m, A, o), E = xd({ ...w, ...D }, y), g = {}, S = c.cascade.matching(n, "*").filter((k) => k.states.subject.size);
  for (const [k, q] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!S.some((T) => q.some((b) => T.states.subject.has(b)))) continue;
    const N = c.cascade.compute(n, i, new Set(q)), z = {}, j = xd({ ...gd(N, () => {
    }), ...yd(N, bd(N, c.measure), o) }, z);
    k === "focus" && wd(N, p);
    const O = h0(E, j);
    if (Object.keys(O).length) {
      g[k] = O;
      const T = Object.fromEntries(Object.entries(z).filter(([b]) => b in O));
      Object.keys(T).length && (g[`${k}_tokens`] = T);
    }
  }
  if (c.cascade.sheet.tracks(n, "hover") && (g.track_hover = !0), /tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (g.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (g.break_anywhere = !0), w.overflow_y === "scroll") {
    const k = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    k > 0 && (g.scrollbar = k);
  }
  m.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (g.blocks_pointer = !0);
  const _ = Object.entries(o0).filter(([, k]) => k.some((q) => typeof n.props[q] == "function")).map(([k]) => k);
  return !_.includes("click") && Oo(n) && _.push("click"), _.length && (g.events = _), { computed: m, style: E, tokens: y, extra: g, meta: x0(n), reports: d, childText: p0(o, D), where: s };
}
function em(n, i, o, c, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let p = c.cache.get(n);
  (!p || p.key !== d) && c.cache.set(n, p = { key: d, part: g0(n, i, o, c) });
  const { computed: m, tokens: y, extra: w, reports: A, childText: D, where: E } = p.part;
  for (const h of A) c.findings.add(...h);
  const g = (h, U, J, at, et) => c.findings.add(h, U, J, at, E, et), S = { ...p.part.style }, _ = { kind: "div", id: n.id, style: S, tokens: y, meta: p.part.meta, ...w };
  Object.defineProperty(_, An, { value: m.values.display });
  const k = n.tagName;
  if (k === "svg")
    return _.kind = n.props["data-perch-image"] ? "image" : "svg", _.markup = _0(n), _;
  if (k === "input" || k === "textarea" || k === "select") {
    _.kind = "input", _.input_type = k === "input" ? String(n.props.type ?? "text") : k;
    for (const h of ["placeholder", "checked", "disabled"]) n.props[h] !== void 0 && (_[h] = n.props[h]);
    if (/^(checkbox|radio)$/.test(_.input_type) && (_.checked = n.checked), k !== "select" && (_.value = n.value), k === "input" && c0.test(_.input_type) && (_.field_w = u0 * m.values["font-size"]), k === "textarea" && S.h === void 0) {
      const h = m.values, U = (et) => et && typeof et == "object" && "px" in et ? et.px : 0, J = (et) => h[`border-${et}-style`] === "none" ? 0 : U(h[`border-${et}-width`]), at = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      S.h = at * Ni(h, c.measure) + U(h["padding-top"]) + U(h["padding-bottom"]) + J("top") + J("bottom");
    }
    return _;
  }
  if (k === "img") {
    _.kind = "image", _.src = n.props.src ?? null;
    for (const [h, U] of [["width", "w"], ["height", "h"]]) {
      const J = Number(n.props[h]);
      S[U] === void 0 && n.props[h] != null && Number.isFinite(J) && (S[U] = J);
    }
    return _;
  }
  const q = m.values["text-transform"], N = [];
  let z = !1, j = !1;
  for (const h of n.childNodes) {
    if (h instanceof Ri) {
      if (h.hidden || h.data === "") continue;
      z = !0;
      const at = N[N.length - 1];
      if (at?.kind === "text")
        at.source = (at.source ?? at.text) + h.data, at.text = _d(at.source, q), at.text === at.source && delete at.source;
      else {
        const et = _d(h.data, q);
        N.push(et === h.data ? { kind: "text", text: et } : { kind: "text", text: et, source: h.data });
      }
      continue;
    }
    if (!(h instanceof re)) continue;
    const U = em(h, m, D, c, d), J = U[An];
    J === "inline" || J === "inline-block" || J === "inline-flex" ? z = !0 : J !== "none" && (j = !0), N.push(U);
  }
  const O = N.some((h) => h.kind !== "text"), T = N.length === 1 && N[0].kind !== "text" && /^inline-(block|flex)$/.test(N[0][An]) ? N[0] : null;
  if (!S.display && T) {
    const h = c.cache.get(n.childNodes.find((J) => J.id === T.id))?.part.computed, U = h ? qo(m.values, c.measure) - y0(h.values, c.measure) : 0;
    S.display = "flex", S.flex_direction = "col", S.items = "start", U > 0 && (T.style.mt = Math.round(((T.style.mt ?? 0) + U) * 100) / 100), g("approximated", "display", `${m.values.display} holding one ${T[An]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!S.display && N.length === 1 && (N[0].kind === "svg" || N[0].kind === "image") && N[0][An] === "inline" && typeof N[0].style.h == "number") {
    const h = N[0], U = qo(m.values, c.measure), J = Ni(m.values, c.measure) - U, at = (et) => Math.round(et * 100) / 100;
    S.display = "flex", S.flex_direction = "col", S.items = "start", U > h.style.h && (h.style.mt = at((h.style.mt ?? 0) + U - h.style.h)), J > 0 && (h.style.mb = at((h.style.mb ?? 0) + J)), g("approximated", "display", `${m.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!S.display && z && O) {
    if (S.display = "flex", S.flex_direction = j ? "col" : "row", !j) S.items = "baseline";
    else for (const h of N) h.kind !== "text" && /^inline-(block|flex)$/.test(h[An]) && !h.style.self && (h.style.self = "start");
    g("approximated", "display", `${m.values.display} with inline content`, "(inline formatting)", j ? "a column of its children" : "a row on the text baseline");
  }
  const b = m.values["letter-spacing"]?.px;
  if (b)
    for (let h = 0; h < N.length; h++) {
      const U = N[h];
      if (U.kind !== "text") continue;
      const J = Math.round(b * [...U.text].length * 1e3) / 1e3;
      N[h] = { kind: "div", style: { pr: J }, tokens: {}, children: [U] };
    }
  return _.children = N, _;
}
function b0(n, i) {
  if (!i) return null;
  let c = (i.self ? n : i.closest ? Kd(n, i.closest) : i.find ? fl(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return c && i.strip && c.startsWith(i.strip) && (c = c.slice(i.strip.length)), c;
}
function v0(n, i, o) {
  const c = i.map((p) => [p, Oi(p.selector)]), s = /* @__PURE__ */ new Map(), d = (p) => {
    for (const m of p.children) {
      const y = o.get(m.id);
      if (y)
        for (const [w, A] of c) {
          const D = w.textRange ? "range_name" : "name";
          if (w.textRange && y[D] != null || !A.some((_) => Qd(m, _))) continue;
          const E = b0(m, w.key), g = E == null ? s.get(w.name) ?? 0 : 0;
          E == null && s.set(w.name, g + 1);
          const S = E != null ? `${w.name}:${E}` : g ? `${w.name}@${g}` : w.name;
          y[D] == null ? y[D] = S : (y.also ??= []).push(S);
        }
      d(m);
    }
  };
  d(n.documentElement);
}
const Ci = 0.9521, am = 0.2256, qo = (n, i) => (Ni(n, i) - (Ci + am) * n["font-size"]) / 2 + Ci * n["font-size"];
function y0(n, i) {
  const o = (s) => s && typeof s == "object" && "px" in s ? s.px : 0, c = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]);
  return o(n["padding-top"]) + c + qo(n, i);
}
const _d = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, nm = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function x0(n) {
  const i = {};
  for (const [o, c] of Object.entries(n.props)) {
    if (nm.has(o) || typeof c == "function" || c === void 0 || c === null || typeof c == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (c === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    i[d] = typeof c == "boolean" ? s ? String(c) : "" : String(c);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const w0 = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), Sd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function _0(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (o) => {
    const c = [];
    for (const [d, p] of Object.entries(o.props))
      nm.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || c.push(`${w0(d)}="${Sd(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && c.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof Ri ? Sd(d.data) : i(d)).join("");
    return `<${o.tagName}${c.length ? ` ${c.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return i(n);
}
function S0(n) {
  const i = n.theme?.() ?? {}, o = {};
  for (const c of Jd) i[c] && (o[c] = i[c]);
  return o;
}
const k0 = { font_features: "" };
function z0(n, i, o, c = {}, s = null) {
  const d = S0(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([d, p]);
  (c.look !== m || c.sheet !== o) && Object.assign(c, { look: m, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new Ih(o, { theme: d, viewport: p }), top: null });
  const { cascade: y, cache: w } = c, A = { cascade: y, cache: w, viewport: p, findings: new s0(), measure: i.lineHeight ? (g) => i.lineHeight(g) : null };
  c.top ??= y.compute(n.body, y.compute(n.documentElement, null));
  const D = n.body.children.map((g) => em(g, c.top, k0, A));
  if (s?.length) {
    const g = /* @__PURE__ */ new Map(), S = (_) => {
      _.id && g.set(_.id, _);
      for (const k of _.children ?? []) S(k);
    };
    D.forEach(S), v0(n, s, g);
  }
  const E = /* @__PURE__ */ new Set();
  for (const g of [n, n.defaultView])
    for (const { type: S } of g?.listeners ?? []) pd[S] && E.add(pd[S]);
  return { schema: e0, root: D[0] ?? null, overlays: D.slice(1), document_events: [...E].sort(), unsupported: A.findings.list() };
}
const E0 = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let N0 = null;
const T0 = () => N0 ??= new Zh(E0);
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
function C0(n, i) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const c of o) {
    if (c === "children") continue;
    const s = n[c], d = i[c];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(c === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((m) => s[m] === d[m])))
      return !0;
  }
  return !1;
}
const j0 = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function kd(n, i) {
  for (const o of gh(i.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const M0 = {
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
  createInstance: (n, i, o) => kd(new re(n, i, o.ownerDocument), i),
  createTextInstance: (n, i) => new Ri(n),
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
  commitUpdate: (n, i, o, c) => {
    if (n.props = c, n.inline) for (const s of Object.keys(n.inline)) o.style?.[s] !== c.style?.[s] && delete n.inline[s];
    if (o.dangerouslySetInnerHTML?.__html !== c.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      kd(n, c);
    }
    C0(o, c) && n.touch();
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
}, Se = Ah(M0), Hi = (n, i, o = null) => Se.createPortal(n, i, null, o), A0 = {
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
class O0 {
  constructor(i, o, c) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, o), this.type = i, this.target = c, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
  for (const { type: c, listener: s, capture: d } of [...n.listeners ?? []])
    c === i.type && d === o && s.call(n, i);
  if (n instanceof re) {
    const c = A0[i.type], s = c && n.props[o ? `${c}Capture` : c];
    typeof s == "function" && s(i);
  }
}
function wv(n, i, o = {}) {
  const { document: c, window: s, globals: d } = wh(n), p = new re("div", { id: "root", style: o.container ?? {} }, c);
  c.body.appendChild(p);
  const m = [];
  let y = null;
  const w = () => [c, s].map((z) => z.listeners.map((j) => `${j.type}:${j.capture}`).sort().join(",")).join("|");
  let A = "";
  const D = {}, E = () => (y = z0(c, n, T0(), D, o.names), A = w(), n.render?.(y), y), g = () => {
    Se.flushPassiveEffects(), Se.flushSyncWork(), w() !== A && E();
  };
  c.afterCommit = E;
  const S = (z) => {
    m.push(z), n.error?.(z);
  }, _ = Se.createContainer(p, pl.ConcurrentRoot, null, !1, null, "", S, S, S, null);
  Se.updateContainerSync(ct.createElement(i, o.props ?? {}), _, null, null), Se.flushSyncWork(), g();
  const k = (z) => {
    const j = (O) => {
      if (O.id === z) return O;
      for (const T of O.children) {
        const b = j(T);
        if (b) return b;
      }
      return null;
    };
    return j(c.documentElement);
  }, q = (z) => {
    const j = Pa;
    Pa = pl.DiscreteEventPriority;
    try {
      return z();
    } finally {
      Pa = j, Se.flushSyncWork(), g();
    }
  }, N = {
    document: c,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: p,
    errors: m,
    /** The latest description (after the last commit or state change). */
    get description() {
      return y;
    },
    describe: E,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(z, j, O = {}) {
      const T = typeof z == "string" ? k(z) : z;
      if (!T) return !1;
      const b = new O0(j, O, T), h = [];
      for (let at = T; at; at = at.parentNode) h.push(at);
      const U = [...h, c, s];
      q(() => {
        for (let at = U.length - 1; at > 0 && !b.propagationStopped; at--) vi(U[at], b, !0);
        b.propagationStopped || (vi(T, b, !0), b.propagationStopped || vi(T, b, !1));
        for (let at = 1; at < U.length && !b.propagationStopped; at++) vi(U[at], b, !1);
      });
      const J = j === "click" && !b.defaultPrevented ? Oo(T) : null;
      return J && N.dispatch(J, "submit", {}), !b.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(z) {
      const j = c.activeElement && c.activeElement !== c.body ? c.activeElement : c.body;
      if (!N.dispatch(j, "keydown", z)) return !0;
      const T = z.key === "Enter" && !z.isComposing ? Oo(j, !0) : null;
      if (T)
        return N.dispatch(T, "submit", {}), !0;
      if (!Xd(j) || j.props.disabled || j.props.readOnly) return !1;
      if ((z.ctrlKey || z.metaKey) && !z.altKey && !z.shiftKey && z.key.toLowerCase() === "a")
        return j.selectedAll = !0, !0;
      if (z.ctrlKey || z.metaKey) return !1;
      const b = j.selectedAll;
      j.selectedAll = !1;
      const h = j.value, J = z.key === "Backspace" || b && z.key === "Delete" ? b ? "" : h.slice(0, -1) : [...z.key].length === 1 ? (b ? "" : h) + z.key : h;
      return J === h ? !1 : (j.value = J, N.dispatch(j, "input", { data: z.key }), N.dispatch(j, "change", {}), j.props.value !== void 0 && delete j.edit, j.touch(), E(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(z, j) {
      const O = k(z);
      O && (O.bounds = { x: j.x, y: j.y, width: j.width, height: j.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(z) {
      const j = k(z);
      if (!j || j.props.disabled || !N.dispatch(z, "click", { button: 0, detail: 1 })) return;
      const O = j.props.type === "radio";
      O && j.checked || (j.checked = O ? !0 : !j.checked, N.dispatch(z, "input", {}), N.dispatch(z, "change", {}), j.props.checked !== void 0 && delete j.ticked, j.touch(), E());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(z, j = {}) {
      const O = { button: 0, buttons: 1, pointerType: "mouse", ...j };
      for (const T of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) N.dispatch(z, T, O);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (z) => !!k(z)?.state.hover,
    hover(z, j) {
      const O = k(z);
      !O || O.state.hover === j || (O.state.hover = j, O.touch(), E());
    },
    focus(z) {
      const j = k(z);
      j && (q(() => {
        const O = c.activeElement;
        O && O !== j && O !== c.body && N.dispatch(O, "blur"), c.focus(j), N.dispatch(j, "focus");
      }), E());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(z) {
      let O = typeof z == "string" ? k(z) : z;
      for (; O && !(O instanceof re && typeof O.props.onKeyDown == "function" && j0(O)); ) O = O.parentNode;
      !O || O === c.activeElement || (N.focus(O.id), O.state.pointerFocus = !0, O.touch(), E());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: g,
    update(z) {
      Se.updateContainerSync(ct.createElement(i, z ?? {}), _, null, null), Se.flushSyncWork(), g();
    },
    unmount() {
      Se.updateContainerSync(null, _, null, null), Se.flushSyncWork(), Se.flushPassiveEffects(), c.afterCommit = null;
    }
  };
  return N;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const lm = (n) => Se.flushSyncFromReconciler(n), R0 = { createPortal: Hi, flushSync: lm }, _v = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Hi,
  default: R0,
  flushSync: lm
}, Symbol.toStringTag, { value: "Module" }));
function im(n) {
  var i, o, c = "";
  if (typeof n == "string" || typeof n == "number") c += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (i = 0; i < s; i++) n[i] && (o = im(n[i])) && (c && (c += " "), c += o);
  } else for (o in n) n[o] && (c && (c += " "), c += o);
  return c;
}
function rm() {
  for (var n, i, o = 0, c = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (i = im(n)) && (c && (c += " "), c += i);
  return c;
}
const H0 = (n, i) => {
  const o = new Array(n.length + i.length);
  for (let c = 0; c < n.length; c++)
    o[c] = n[c];
  for (let c = 0; c < i.length; c++)
    o[n.length + c] = i[c];
  return o;
}, D0 = (n, i) => ({
  classGroupId: n,
  validator: i
}), om = (n = /* @__PURE__ */ new Map(), i = null, o) => ({
  nextPart: n,
  validators: i,
  classGroupId: o
}), ji = "-", zd = [], U0 = "arbitrary..", B0 = (n) => {
  const i = Y0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: c
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return q0(p);
      const m = p.split(ji), y = m[0] === "" && m.length > 1 ? 1 : 0;
      return sm(m, y, i);
    },
    getConflictingClassGroupIds: (p, m) => {
      if (m) {
        const y = c[p], w = o[p];
        return y ? w ? H0(w, y) : y : w || zd;
      }
      return o[p] || zd;
    }
  };
}, sm = (n, i, o) => {
  if (n.length - i === 0)
    return o.classGroupId;
  const s = n[i], d = o.nextPart.get(s);
  if (d) {
    const w = sm(n, i + 1, d);
    if (w) return w;
  }
  const p = o.validators;
  if (p === null)
    return;
  const m = i === 0 ? n.join(ji) : n.slice(i).join(ji), y = p.length;
  for (let w = 0; w < y; w++) {
    const A = p[w];
    if (A.validator(m))
      return A.classGroupId;
  }
}, q0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), o = i.indexOf(":"), c = i.slice(0, o);
  return c ? U0 + c : void 0;
})(), Y0 = (n) => {
  const {
    theme: i,
    classGroups: o
  } = n;
  return G0(o, i);
}, G0 = (n, i) => {
  const o = om();
  for (const c in n) {
    const s = n[c];
    Fo(s, o, c, i);
  }
  return o;
}, Fo = (n, i, o, c) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const p = n[d];
    Q0(p, i, o, c);
  }
}, Q0 = (n, i, o, c) => {
  if (typeof n == "string") {
    K0(n, i, o);
    return;
  }
  if (typeof n == "function") {
    V0(n, i, o, c);
    return;
  }
  X0(n, i, o, c);
}, K0 = (n, i, o) => {
  const c = n === "" ? i : cm(i, n);
  c.classGroupId = o;
}, V0 = (n, i, o, c) => {
  if (Z0(n)) {
    Fo(n(c), i, o, c);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(D0(o, n));
}, X0 = (n, i, o, c) => {
  const s = Object.entries(n), d = s.length;
  for (let p = 0; p < d; p++) {
    const [m, y] = s[p];
    Fo(y, cm(i, m), o, c);
  }
}, cm = (n, i) => {
  let o = n;
  const c = i.split(ji), s = c.length;
  for (let d = 0; d < s; d++) {
    const p = c[d];
    let m = o.nextPart.get(p);
    m || (m = om(), o.nextPart.set(p, m)), o = m;
  }
  return o;
}, Z0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, J0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, o = /* @__PURE__ */ Object.create(null), c = /* @__PURE__ */ Object.create(null);
  const s = (d, p) => {
    o[d] = p, i++, i > n && (i = 0, c = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let p = o[d];
      if (p !== void 0)
        return p;
      if ((p = c[d]) !== void 0)
        return s(d, p), p;
    },
    set(d, p) {
      d in o ? o[d] = p : s(d, p);
    }
  };
}, Yo = "!", Ed = ":", L0 = [], Nd = (n, i, o, c, s) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: o,
  maybePostfixModifierPosition: c,
  isExternal: s
}), W0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: o
  } = n;
  let c = (s) => {
    const d = [];
    let p = 0, m = 0, y = 0, w;
    const A = s.length;
    for (let _ = 0; _ < A; _++) {
      const k = s[_];
      if (p === 0 && m === 0) {
        if (k === Ed) {
          d.push(s.slice(y, _)), y = _ + 1;
          continue;
        }
        if (k === "/") {
          w = _;
          continue;
        }
      }
      k === "[" ? p++ : k === "]" ? p-- : k === "(" ? m++ : k === ")" && m--;
    }
    const D = d.length === 0 ? s : s.slice(y);
    let E = D, g = !1;
    D.endsWith(Yo) ? (E = D.slice(0, -1), g = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      D.startsWith(Yo) && (E = D.slice(1), g = !0)
    );
    const S = w && w > y ? w - y : void 0;
    return Nd(d, g, E, S);
  };
  if (i) {
    const s = i + Ed, d = c;
    c = (p) => p.startsWith(s) ? d(p.slice(s.length)) : Nd(L0, !1, p, void 0, !0);
  }
  if (o) {
    const s = c;
    c = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return c;
}, F0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, c) => {
    i.set(o, 1e6 + c);
  }), (o) => {
    const c = [];
    let s = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], m = p[0] === "[", y = i.has(p);
      m || y ? (s.length > 0 && (s.sort(), c.push(...s), s = []), c.push(p)) : s.push(p);
    }
    return s.length > 0 && (s.sort(), c.push(...s)), c;
  };
}, I0 = (n) => ({
  cache: J0(n.cacheSize),
  parseClassName: W0(n),
  sortModifiers: F0(n),
  postfixLookupClassGroupIds: $0(n),
  ...B0(n)
}), $0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let c = 0; c < o.length; c++)
      i[o[c]] = !0;
  return i;
}, P0 = /\s+/, tg = (n, i) => {
  const {
    parseClassName: o,
    getClassGroupId: c,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, m = [], y = n.trim().split(P0);
  let w = "";
  for (let A = y.length - 1; A >= 0; A -= 1) {
    const D = y[A], {
      isExternal: E,
      modifiers: g,
      hasImportantModifier: S,
      baseClassName: _,
      maybePostfixModifierPosition: k
    } = o(D);
    if (E) {
      w = D + (w.length > 0 ? " " + w : w);
      continue;
    }
    let q = !!k, N;
    if (q) {
      const b = _.substring(0, k);
      N = c(b);
      const h = N && p[N] ? c(_) : void 0;
      h && h !== N && (N = h, q = !1);
    } else
      N = c(_);
    if (!N) {
      if (!q) {
        w = D + (w.length > 0 ? " " + w : w);
        continue;
      }
      if (N = c(_), !N) {
        w = D + (w.length > 0 ? " " + w : w);
        continue;
      }
      q = !1;
    }
    const z = g.length === 0 ? "" : g.length === 1 ? g[0] : d(g).join(":"), j = S ? z + Yo : z, O = j + N;
    if (m.indexOf(O) > -1)
      continue;
    m.push(O);
    const T = s(N, q);
    for (let b = 0; b < T.length; ++b) {
      const h = T[b];
      m.push(j + h);
    }
    w = D + (w.length > 0 ? " " + w : w);
  }
  return w;
}, eg = (...n) => {
  let i = 0, o, c, s = "";
  for (; i < n.length; )
    (o = n[i++]) && (c = um(o)) && (s && (s += " "), s += c);
  return s;
}, um = (n) => {
  if (typeof n == "string")
    return n;
  let i, o = "";
  for (let c = 0; c < n.length; c++)
    n[c] && (i = um(n[c])) && (o && (o += " "), o += i);
  return o;
}, ag = (n, ...i) => {
  let o, c, s, d;
  const p = (y) => {
    const w = i.reduce((A, D) => D(A), n());
    return o = I0(w), c = o.cache.get, s = o.cache.set, d = m, m(y);
  }, m = (y) => {
    const w = c(y);
    if (w)
      return w;
    const A = tg(y, o);
    return s(y, A), A;
  };
  return d = p, (...y) => d(eg(...y));
}, ng = [], Zt = (n) => {
  const i = (o) => o[n] || ng;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, dm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, mm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, lg = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, ig = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, rg = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, og = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, sg = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, cg = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ca = (n) => lg.test(n), pt = (n) => !!n && !Number.isNaN(Number(n)), Ze = (n) => !!n && Number.isInteger(Number(n)), Co = (n) => n.endsWith("%") && pt(n.slice(0, -1)), sa = (n) => ig.test(n), fm = () => !0, ug = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  rg.test(n) && !og.test(n)
), Io = () => !1, dg = (n) => sg.test(n), mg = (n) => cg.test(n), fg = (n) => !W(n) && !F(n), pg = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), hg = (n) => Aa(n, gm, Io), W = (n) => dm.test(n), $a = (n) => Aa(n, bm, ug), Td = (n) => Aa(n, Sg, pt), gg = (n) => Aa(n, ym, fm), bg = (n) => Aa(n, vm, Io), Cd = (n) => Aa(n, pm, Io), vg = (n) => Aa(n, hm, mg), yi = (n) => Aa(n, xm, dg), F = (n) => mm.test(n), dl = (n) => an(n, bm), yg = (n) => an(n, vm), jd = (n) => an(n, pm), xg = (n) => an(n, gm), wg = (n) => an(n, hm), xi = (n) => an(n, xm, !0), _g = (n) => an(n, ym, !0), Aa = (n, i, o) => {
  const c = dm.exec(n);
  return c ? c[1] ? i(c[1]) : o(c[2]) : !1;
}, an = (n, i, o = !1) => {
  const c = mm.exec(n);
  return c ? c[1] ? i(c[1]) : o : !1;
}, pm = (n) => n === "position" || n === "percentage", hm = (n) => n === "image" || n === "url", gm = (n) => n === "length" || n === "size" || n === "bg-size", bm = (n) => n === "length", Sg = (n) => n === "number", vm = (n) => n === "family-name", ym = (n) => n === "number" || n === "weight", xm = (n) => n === "shadow", kg = () => {
  const n = Zt("color"), i = Zt("font"), o = Zt("text"), c = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), m = Zt("container"), y = Zt("spacing"), w = Zt("radius"), A = Zt("shadow"), D = Zt("inset-shadow"), E = Zt("text-shadow"), g = Zt("drop-shadow"), S = Zt("blur"), _ = Zt("perspective"), k = Zt("aspect"), q = Zt("ease"), N = Zt("animate"), z = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], j = () => [
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
  ], O = () => [...j(), F, W], T = () => ["auto", "hidden", "clip", "visible", "scroll"], b = () => ["auto", "contain", "none"], h = () => [F, W, y], U = () => [Ca, "full", "auto", ...h()], J = () => [Ze, "none", "subgrid", F, W], at = () => ["auto", {
    span: ["full", Ze, F, W]
  }, Ze, F, W], et = () => [Ze, "auto", F, W], Mt = () => ["auto", "min", "max", "fr", F, W], Kt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Tt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], K = () => ["auto", ...h()], nt = () => [Ca, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], lt = () => [m, Ca, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], B = () => [Ca, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], Y = () => [n, F, W], v = () => [...j(), jd, Cd, {
    position: [F, W]
  }], G = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", xg, hg, {
    size: [F, W]
  }], $ = () => [Co, dl, $a], P = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    w,
    F,
    W
  ], it = () => ["", pt, dl, $a], xt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], dt = () => [pt, Co, jd, Cd], Oa = () => [
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
      color: [fm],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [fg],
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
      "container-named": [pg],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [pt, "auto", W, F, m]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": z()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": z()
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
        overscroll: b()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": b()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": b()
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
        w: [m, "screen", ...nt()]
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
          ...nt()
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
        font: [c, _g, gg]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Co, W]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [yg, bg, i]
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
        tracking: [s, F, W]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [pt, "none", F, Td]
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
        }, wg, vg]
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
        "inset-shadow": ["none", D, xi, yi]
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
        "text-shadow": ["none", E, xi, yi]
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
          g,
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
        animate: ["none", N, F, W]
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
        perspective: [_, F, W]
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
        stroke: [pt, dl, $a, Td]
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
}, zg = /* @__PURE__ */ ag(kg);
function je(...n) {
  return zg(rm(n));
}
const wm = typeof navigator < "u" && /Mac/i.test(navigator.platform), Mi = {
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
const Eg = Object.fromEntries(Object.entries(Mi).map(([n, i]) => [i, n])), Ng = {
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
function Tg(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : Eg[n];
}
const Md = /* @__PURE__ */ new Map();
function _m(n, i = wm) {
  const o = `${i}|${n}`, c = Md.get(o);
  if (c) return c;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      i ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (Mi[d]) s.code = Mi[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Md.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = _m(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function Cg(n, i = wm) {
  const o = _m(n, i), c = jg(Tg(o.code) ?? "");
  return i ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${c}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", c].filter(Boolean).join("+");
}
const jg = (n) => Ng[n] ?? n.toUpperCase(), Ad = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Od = rm, Di = (n, i) => (o) => {
  var c;
  if (i?.variants == null) return Od(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = i, p = Object.keys(s).map((w) => {
    const A = o?.[w], D = d?.[w];
    if (A === null) return null;
    const E = Ad(A) || Ad(D);
    return s[w][E];
  }), m = o && Object.entries(o).reduce((w, A) => {
    let [D, E] = A;
    return E === void 0 || (w[D] = E), w;
  }, {}), y = i == null || (c = i.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((w, A) => {
    let { class: D, className: E, ...g } = A;
    return Object.entries(g).every((S) => {
      let [_, k] = S;
      return Array.isArray(k) ? k.includes({
        ...d,
        ...m
      }[_]) : {
        ...d,
        ...m
      }[_] === k;
    }) ? [
      ...w,
      D,
      E
    ] : w;
  }, []);
  return Od(n, p, y, o?.class, o?.className);
}, Mg = Di(
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
), Ag = Di(
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
function Og({ className: n, ...i } = {}) {
  return je(Ag(i), n);
}
const Sm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", km = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Rg = Di(`${km} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Hg({ className: n, ...i } = {}) {
  return je(Rg(i), n);
}
const zm = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Dg = Di(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Ug = "my-1 h-px bg-overlay-0";
function Bg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ kt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ kt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ kt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ kt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function qg({ size: n = 16, className: i }) {
  return /* @__PURE__ */ kt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ kt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ kt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Yg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ kt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ kt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Em({ size: n = 14, className: i }) {
  return /* @__PURE__ */ kt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ kt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Rd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Gg({ state: n, error: i }) {
  return /* @__PURE__ */ kt.jsx(
    "span",
    {
      className: je("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Rd[n] ?? Rd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function Qg({ title: n, onClose: i, children: o, testId: c }) {
  return Hi(
    /* @__PURE__ */ kt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && i();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && i();
        },
        children: /* @__PURE__ */ kt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": c,
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
const wi = 4, ja = 8, Kg = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Hd = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Vg({ value: n, onChange: i, options: o, className: c, ariaLabel: s, testId: d, id: p, title: m, disabled: y, placeholder: w, freeText: A, onKeyDown: D }) {
  const E = ct.useId(), [g, S] = ct.useState(!1), [_, k] = ct.useState(-1), [q, N] = ct.useState(!1), z = ct.useRef(null), j = ct.useRef(null), [O, T] = ct.useState({}), b = ct.useRef({ text: "", at: 0 }), h = A && q && n ? o.filter((B) => Hd(B).toLowerCase().includes(n.toLowerCase()) || B.value.toLowerCase().includes(n.toLowerCase())) : o, U = o.find((B) => B.value === n), J = (B) => `${E}-${B}`;
  function at(B) {
    y || (k(B), S(!0));
  }
  function et() {
    S(!1), N(!1), k(-1);
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
    if (!g || !z.current) {
      T((tt) => tt.left === void 0 ? tt : {});
      return;
    }
    const B = z.current.getBoundingClientRect(), Y = window.innerHeight - B.bottom - wi - ja, v = B.top - wi - ja, G = Y < 160 && v > Y;
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
  }, [g, h.length]), ct.useLayoutEffect(() => {
    const B = j.current;
    if (!g || !B || O.left === void 0) return;
    const Y = B.getBoundingClientRect().right, v = window.innerWidth - ja;
    Y > v && T((G) => ({ ...G, left: Math.max(ja, Number(G.left) - (Y - v)) }));
  }, [g, O]), ct.useEffect(() => {
    if (!g) return;
    const B = (Y) => {
      const v = Y.target;
      (v === document || v instanceof Node && z.current && v.contains(z.current)) && et();
    };
    return window.addEventListener("resize", et), window.addEventListener("scroll", B, !0), () => {
      window.removeEventListener("resize", et), window.removeEventListener("scroll", B, !0);
    };
  }, [g]), ct.useEffect(() => {
    const B = g && _ >= 0 ? document.getElementById(J(_)) : null, Y = j.current;
    !B || !Y || (B.offsetTop < Y.scrollTop ? Y.scrollTop = B.offsetTop : B.offsetTop + B.offsetHeight > Y.scrollTop + Y.clientHeight && (Y.scrollTop = B.offsetTop + B.offsetHeight - Y.clientHeight));
  }, [g, _]), Tm(g, (B) => {
    B || et();
  }, z, j);
  function nt(B) {
    if (B.nativeEvent.isComposing) return;
    const Y = () => {
      B.preventDefault(), B.stopPropagation();
    }, { key: v } = B;
    if (g) {
      if (v === "Escape") {
        Y(), et();
        return;
      } else if (v === "Tab")
        et();
      else if (v === "ArrowDown" || v === "ArrowUp") {
        Y(), h.length && k(_ < 0 ? v === "ArrowDown" ? Tt() : K() : Kt(_, v === "ArrowDown" ? 1 : -1));
        return;
      } else if (v === "Home" && !A) {
        Y(), k(Tt());
        return;
      } else if (v === "End" && !A) {
        Y(), k(K());
        return;
      } else if (v === "Enter" || v === " " && !A) {
        if (_ >= 0 && h[_]) {
          Y(), Mt(h[_]);
          return;
        }
        if (!A) {
          Y(), et();
          return;
        }
      } else if (!A && v.length === 1 && !B.metaKey && !B.ctrlKey && !B.altKey) {
        const G = Date.now();
        b.current = { text: (G - b.current.at > 600 ? "" : b.current.text) + v.toLowerCase(), at: G };
        const tt = Math.max(_, 0), $ = [...h.slice(tt + (b.current.text.length === 1 ? 1 : 0)), ...h.slice(0, tt + 1)].find((P) => !P.disabled && Hd(P).toLowerCase().startsWith(b.current.text));
        $ && (Y(), k(h.indexOf($)));
        return;
      }
    } else if (v === "ArrowDown" || v === "ArrowUp" || !A && (v === "Enter" || v === " ")) {
      Y(), at(Math.max(0, h.findIndex((G) => G.value === n)));
      return;
    }
    D?.(B);
  }
  const lt = {
    ref: (B) => {
      z.current = B;
    },
    id: p,
    title: m,
    disabled: y,
    "aria-label": s,
    "aria-expanded": g,
    "aria-controls": g ? E : void 0,
    "aria-activedescendant": g && _ >= 0 ? J(_) : void 0,
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
        placeholder: w,
        className: c,
        value: n,
        onChange: (B) => {
          i(B.target.value), N(!0), g ? k(-1) : (k(-1), S(!0));
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
        className: je("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", c),
        onClick: () => g ? et() : at(Math.max(0, h.findIndex((B) => B.value === n))),
        children: [
          /* @__PURE__ */ kt.jsx("span", { className: "min-w-0 flex-1 truncate", children: U ? U.label : w ?? "" }),
          /* @__PURE__ */ kt.jsx(Nm, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    g && h.length > 0 && Hi(
      /* @__PURE__ */ kt.jsx(
        "div",
        {
          ref: j,
          id: E,
          role: "listbox",
          "aria-label": s,
          className: je("z-[9999]", zm),
          style: O,
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
              className: je(Kg, Y === _ && !B.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                B.disabled || k(Y);
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
const Xg = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Zg = `${Xg} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function Nm({ open: n, size: i = 12, className: o }) {
  return /* @__PURE__ */ kt.jsx("svg", { className: o, width: i, height: i, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ kt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Jg(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Go = {
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
function Qo(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((o) => o.id === n.parentSessionId);
}
function Lg(n) {
  const i = /* @__PURE__ */ new Map();
  for (const o of n)
    Qo(o, n) && i.set(o.parentSessionId, [...i.get(o.parentSessionId) ?? [], o]);
  return i.size ? n.filter((o) => !Qo(o, n)).flatMap((o) => [o, ...i.get(o.id) ?? []]) : n;
}
const _i = 6, Dd = 8;
function Wg(n, i = {}) {
  const { minWidth: o = 220, align: c = "right", minSpaceAbove: s = 100 } = i, d = n.getBoundingClientRect(), p = window.innerWidth, m = window.innerHeight, y = c === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, w = d.top - _i - Dd, A = m - d.bottom - _i - Dd;
  return w >= s ? {
    position: "fixed",
    bottom: m - d.top + _i,
    ...y,
    minWidth: o,
    maxHeight: Math.min(w, m * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + _i,
    ...y,
    minWidth: o,
    maxHeight: Math.min(A, m * 0.75),
    overflowY: "auto"
  };
}
function Tm(n, i, o, c) {
  ct.useEffect(() => {
    if (!n) return;
    function s(p) {
      const m = p.target, y = o.current?.contains(m) ?? !1, w = c.current?.contains(m) ?? !1;
      !y && !w && i(!1);
    }
    function d(p) {
      p.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function Fg({ icon: n, fallback: i }) {
  const [o, c] = ct.useState(!1);
  return ct.useEffect(() => c(!1), [n]), !n || o ? /* @__PURE__ */ kt.jsx(kt.Fragment, { children: i }) : /* @__PURE__ */ kt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => c(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Ig = "1.3.0";
let ki = null;
const $g = (n) => {
  ki = n;
};
function zt() {
  const n = (typeof ki == "function" ? ki() : ki) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Pg = (n) => zt().subscribe?.(n) ?? (() => {
}), tb = Wg, eb = globalThis.perch?.isMac !== !1, ab = (n) => Cg(n, zt().isMac !== !1), nb = (n) => Mg(n), lb = ({ className: n, ...i } = {}) => je(Og(i), n), ib = Hg, rb = (n) => Dg(n), ob = Ug, sb = km, cb = Sm, ub = (n) => Go[n].color, db = (n, i) => zt().shortcutFor?.(n, i) ?? null, mb = (n) => zt().shortcutLabel?.(n) ?? null, Ui = (n, i) => zt().command(n, i ?? {}) !== !1, fb = (n, i, o) => zt().startSession?.(n, i, o), pb = globalThis.perch?.pickFolder ? (n) => zt().pickFolder(n) : null;
function fe(n) {
  const i = ct.useRef(n);
  return i.current = n, ct.useSyncExternalStore(Pg, () => i.current(zt()));
}
const Cm = (n = {}) => fe((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), hb = () => fe((n) => n.hosts()), gb = () => fe((n) => n.sessionFolders());
function bb() {
  const n = fe((i) => i.addProject?.() ?? vb);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, o, c) => {
      i.trim() && n.status !== "pending" && zt().addProjectFolder?.(i, o, c);
    },
    clear: () => zt().clearAddProject?.()
  };
}
const vb = Object.freeze({ status: "idle" }), jm = "perch.lastAgentChoice", yb = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), xb = () => {
  const n = zt().storage?.getItem(jm);
  return n === "claude" || n === "codex" ? n : "claude";
}, wb = Object.freeze({ items: [] });
function _b() {
  const n = fe((i) => i.notifications?.() ?? wb);
  return ct.useMemo(() => ({
    items: n.items ?? [],
    open: (i) => zt().command("notification.open", { id: i }),
    dismiss: (i) => zt().command("notification.dismiss", { id: i })
  }), [n]);
}
function Sb(n) {
  const i = fe((s) => s.agentChoices?.(n) ?? yb), [o, c] = ct.useState(xb);
  return ct.useMemo(() => ({
    connected: !!i.connected,
    discovery: !!i.discovery,
    choices: i.choices ?? [],
    lastChoice: o,
    state: i.state ?? "ready",
    error: i.state === "error" ? i.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (zt().storage?.setItem(jm, s), c(s));
    },
    manage: () => zt().command("agents.manage", {})
  }), [i, o]);
}
function kb(n) {
  ct.useEffect(() => zt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function zb(n) {
  const i = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return Lg(i).map((o) => ({ session: o.session, nested: Qo(o, i) }));
}
function Eb({ id: n, plain: i, className: o }) {
  const c = fe((w) => w.session(n));
  if (!c) return null;
  const s = c.state ?? Jg(c), d = Go[s]?.color ?? Go.unknown.color, p = c.provider, m = p === "claude" || p === "claude-agent-teams" || p === "omp", y = i ? je("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : je("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return ct.createElement(
    "span",
    { className: y, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    ct.createElement("span", { className: je("inline-flex text-fg", m && "rounded-full bg-[#161616]") }, ct.createElement(Mm, { provider: p, size: 14 }))
  );
}
function Mm({ provider: n, size: i = 14 }) {
  const o = zt().agentIcon?.(n, i) ?? null, c = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ct.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": c, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Nb = ({ children: n }) => ct.createElement(ct.Fragment, null, n);
function Tb(n, i) {
  const o = ct.useRef(i);
  return o.current = i, ct.useEffect(() => {
    const c = zt();
    if (!c.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [p, m] of Object.entries(o.current))
      s[p] = typeof m == "function" ? (...y) => o.current[p]?.(...y) : m;
    const d = c.openOverlay(n, s);
    return () => c.closeOverlay?.(d);
  }, [n]), null;
}
const nn = (n) => function(o) {
  return Tb(n, o);
}, Cb = nn("session-menu"), jb = nn("new-session-menu"), Mb = nn("confirm");
let Am = null;
const Ab = (n) => {
  Am = n;
};
function Ob(n) {
  return ct.createElement(Am ?? Mb, n);
}
function Rb({ className: n = Zg, ...i }) {
  return ct.createElement(Vg, { ...i, className: n });
}
let Ko = null;
const Hb = (n) => {
  Ko = n;
}, Db = nn("folder-browser");
function Ub(n) {
  return Ko ? ct.createElement(Ko, { ...n, browse: (i) => zt().browse(n.hostId, i) }) : ct.createElement(Db, n);
}
const Bb = nn("instructions"), qb = nn("memory"), Yb = Qg;
let $o = null;
const Gb = (n) => {
  $o = n;
};
function Qb(n) {
  if ($o) return ct.createElement(Kb, n);
  const { hostId: i, path: o, className: c } = n, s = ct.useRef(null);
  return ct.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: je("worktree-menu__btn", Sm, c),
      "data-testid": `worktree-menu-${i}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => zt().openOverlay?.("worktree", { hostId: i, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    ct.createElement(Em, null)
  );
}
const Om = "Perch did not answer.";
function Si(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Om };
}
function Kb({ hostId: n, path: i, className: o, worktrees: c, request: s = null, parentChoices: d, emptyAgent: p, ...m }) {
  const [y, w] = ct.useState(c), A = (z) => !!zt().coreCan?.(z, n), D = Cm(), E = ct.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!A("workspace.nest")) return [];
    const z = D?.projects?.find((T) => T.hostId === n && T.repoPath === i), j = [], O = (T, b) => {
      for (const h of T ?? [])
        b && j.push({ id: h.id, name: h.name, path: h.path }), O(h.children, !0);
    };
    return O(z?.workspaces, !1), j;
  }, [d, D, n, i]), g = !1, S = m.deleteSupported ?? A("worktree.delete"), _ = m.startFromSupported ?? A("worktree.startFrom"), [k, q] = ct.useState(s), N = ct.useMemo(() => {
    const z = (j, O) => zt().ask(j, { hostId: n, repoPath: i, ...O });
    return {
      list: async () => {
        const j = await z("worktree.list", {});
        return j?.type === "worktree.list.result" && w({ worktrees: j.worktrees ?? [], defaultRoot: j.defaultRoot ?? "", baseRef: j.baseRef, refs: j.refs ?? [] }), Si(j);
      },
      create: async ({ branch: j, newBranch: O, path: T, extra: b, agent: h }) => {
        const U = await z("worktree.create", { branch: j, newBranch: !!O, path: T ?? null, name: b?.name ?? null, startFrom: b?.startFrom ?? null, parentWorkspaceId: b?.parentWorkspaceId ?? null });
        return U?.type !== "worktree.done" ? { error: Si(U).error ?? Om } : (h && U.path && zt().startSession?.(n, U.path, h), {});
      },
      remove: async (j, O) => {
        const T = await z("worktree.remove", { path: j, force: !!O, deleteBranch: S });
        return { ...Si(T), preservedBranch: T?.type === "worktree.done" ? T.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (j, O) => Si(await z("worktree.branch.delete", { branch: j, expectedHead: O })),
      open: (j) => zt().startSession?.(n, j, "terminal"),
      takeRequest: () => q(null)
    };
  }, [n, i, S]);
  return ct.createElement($o, {
    hostId: n,
    cwd: i,
    projectKey: `${n}:${i}`,
    className: o,
    worktrees: y,
    background: g,
    startFromSupported: _,
    deleteSupported: S,
    parentChoices: E,
    emptyAgent: p,
    request: k,
    actions: N
  });
}
const Vb = (n, i) => zt().beginReorderDrag?.(n, i), Xb = () => fe((n) => n.workspaceTabs()), Zb = () => fe((n) => n.statusLine()), Jb = () => fe((n) => n.zoom()), Lb = () => fe((n) => n.paneLook()), Wb = () => fe((n) => n.keybindings?.() ?? []), Fb = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Ib(n) {
  const i = !!n?.keepFresh, o = fe((s) => s.statusLine?.().connected ?? !1), c = fe((s) => s.planUsage?.() ?? Fb);
  return ct.useEffect(() => {
    if (!i || !o) return;
    let s;
    const d = () => {
      zt().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [i, o]), c;
}
const $b = () => zt().command("usage.get", { force: !0 }), Pb = (n) => zt().command("usage.redeemReset", { accountId: n }), tv = () => Ui("app.zoom_reset"), ev = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, av = (n, i, o) => zt().beginTabDrag?.(n, i, o);
function nv(n) {
  ct.useEffect(() => zt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const lv = (n) => Ui("browser.open", { workspaceId: n }), iv = (n, i) => Ui("file.open", { workspaceId: n, path: i }), rv = () => null, ov = () => null, sv = nn("new-file"), Sv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Mm,
  Chevron: Nm,
  CloseIcon: Yg,
  ConfirmDialog: Ob,
  Dialog: Yb,
  EllipsisIcon: Bg,
  FolderBrowser: Ub,
  GearIcon: qg,
  HostStateDot: Gg,
  InstructionsDialog: Bb,
  MemoryDialog: qb,
  NewFilePrompt: sv,
  NewSessionMenu: jb,
  PageIcon: Fg,
  PlusIcon: Em,
  Select: Rb,
  SessionDot: Eb,
  SessionMenu: Cb,
  Slot: Nb,
  TabDragLayer: ov,
  TabMenu: rv,
  WorktreeMenu: Qb,
  agentStateColor: ub,
  anchoredPopoverStyle: tb,
  beginReorderDrag: Vb,
  beginTabDrag: av,
  bindHost: $g,
  buttonClass: ib,
  cn: je,
  drawConfirmationsInPlace: Ab,
  drawFolderBrowserInPlace: Hb,
  drawWorktreeInPlace: Gb,
  ghostButton: sb,
  iconButton: cb,
  isMac: eb,
  keyLabel: ab,
  menuDividerClass: ob,
  menuItemClass: rb,
  menuPanel: zm,
  nestSessions: zb,
  openBrowserTab: lv,
  openFileTab: iv,
  pickFolder: pb,
  redeemUsageReset: Pb,
  refreshUsage: $b,
  resetZoom: tv,
  rowActionClass: lb,
  runCommand: Ui,
  segmentClass: nb,
  shortcutFor: db,
  shortcutLabel: mb,
  startSession: fb,
  tabStateClass: ev,
  useAddProject: bb,
  useAddProjectRequest: kb,
  useAgentChoices: Sb,
  useDismissOnOutsideClick: Tm,
  useHosts: hb,
  useKeybindings: Wb,
  useNavigation: Cm,
  useNewTabRequest: nv,
  useNotifications: _b,
  usePaneLook: Lb,
  usePlanUsage: Ib,
  useSessionFolders: gb,
  useStatusLine: Zb,
  useWorkspaceTabs: Xb,
  useZoom: Jb,
  version: Ig
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
const Po = {
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
  Po[n] = (i, o) => i[n](o);
const kv = Object.keys(Po);
function Ud(n, i) {
  for (const [o, c] of Object.entries(i)) {
    const s = Po[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    c != null && (n = s(n, c));
  }
  return n;
}
const Ma = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Bd = /* @__PURE__ */ new WeakSet();
function qd(n, i, o) {
  const c = n.pressed, s = Ma(o);
  return c && c.x === s.clientX && c.y === s.clientY ? c.id : i;
}
function cv(n, i, o) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const c = n.meta?.attrs["data-testid"];
  return c ? `~${n.id}:${c}` : `~${n.id}`;
}
const Rm = (n, i = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !i || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && Rm(o, !0)), Me = (n) => n.style?.display !== "hidden";
function Vo(n, i, o, c, s = !1, d = !1, p = null, m = {}, y = !1, w = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return w.get(n)?.text ?? n.text;
  const A = Bd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), p = n.style.text_color ?? p;
  const D = !!n.hover?.text_color && Bm(n);
  D && o.hovered?.(n.id) && (p = n.hover.text_color), m = { ...m };
  for (const T of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[T] !== void 0 && (m[T] = n.style[T]);
  const E = new Set(n.events ?? []);
  let g;
  n.kind === "image" && !n.markup ? g = i.image(n.src) : g = i.div(), n.markup && (g = g.child(c.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const S = cv(n, E, s);
  if (S && (g = g.id(S)), n.name && g.also_named) for (const T of n.also ?? []) g = g.also_named(T);
  g = Ud(g, { ...n.style, ...w.get(n) });
  const _ = m.whitespace !== "nowrap" && !m.text_ellipsis;
  y && _ && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Rm(n) && (g = g.min_w(0));
  for (const T of ["hover", "focus", "active"]) n[T] && (g = g[T]((b) => Ud(b, n[T])));
  if (i.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const T = o.document?.scrollTarget, b = T ? (n.children ?? []).filter(Me).findIndex((h) => Um(h, T.id)) : -1;
    if (b >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, i.scroll.scroll_to_item(b)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      g = g.track_scroll(i.scroll);
      const h = (n.children ?? []).filter(Me).map((U) => U.id);
      o.document.itemBounds = (U) => h.includes(U) ? i.scroll.item_bounds?.(h.indexOf(U)) ?? null : null;
    }
  }
  n.kind === "input" && !n.disabled && (g = g.on_mouse_down("left", (T, b) => {
    T.bounds && o.setBounds(n.id, T.bounds), o.focus(n.id), b.notify();
  }));
  const k = n.kind === "input" ? n : n.meta?.tag === "label" ? Dm(n) : null;
  k && !k.disabled && /^(checkbox|radio)$/.test(k.input_type) && (g = g.on_click((T, b) => {
    b.stop_propagation?.(), o.toggle(k.id), b.notify();
  }));
  const q = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((T) => E.has(T));
  if (q || A) for (const T of n.children ?? []) T.kind !== "text" && Bd.add(T);
  if (q && (g = g.on_mouse_down("left", (T, b) => {
    b.stop_propagation?.(), T.bounds && o.setBounds(n.id, T.bounds);
    const h = { ...Ma(T), button: 0, buttons: 1, detail: T.click_count }, U = qd(o, n.id, T);
    o.pressed = null, o.dispatch(U, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(U, "mousedown", h) && o.pressFocus?.(U), b.notify();
  }), g = g.on_mouse_down("right", (T, b) => {
    b.stop_propagation?.(), T.bounds && o.setBounds(n.id, T.bounds);
    const h = qd(o, n.id, T);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Ma(T), button: 2 }), b.notify();
  }), g = g.on_mouse_up("left", (T, b) => {
    b.stop_propagation?.();
    const h = { ...Ma(T), button: 0 };
    o.dispatch(n.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", h), b.notify();
  }), g = g.on_click((T, b) => {
    o.dispatch(n.id, T.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: T.click_count, button: 0 }), b.notify();
  })), n.blocks_pointer && !q)
    for (const T of ["left", "right"]) g = g.on_mouse_down(T, (b, h) => h.stop_propagation?.());
  else if (A && !q)
    for (const T of ["left", "right"])
      g = g.on_mouse_down(T, (b) => {
        const h = Ma(b);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: n.id, x: h.clientX, y: h.clientY });
      });
  if (E.has("mouse_move") && (g = g.on_mouse_move((T, b) => {
    o.dispatch(n.id, "pointermove", { ...Ma(T), pointerType: "mouse" }), b.notify();
  })), (n.track_hover || D) && (g = g.on_hover((T, b) => {
    o.hover(n.id, T), b.notify();
  })), s && (g = g.on_mouse_down_out((T, b) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Ma(T), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Ma(T)), b.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const T = n.value ? String(n.value) : String(n.placeholder ?? "");
    let b = i.div().whitespace_nowrap().overflow_x_hidden();
    const h = tn(m);
    h && (b = b.h(h)), !n.value && p && (b = b.text_color(dv(p))), T && (g = g.child(b.child(n.input_type === "password" && n.value ? "•".repeat([...T].length) : T))), n.field_w && (g = g.child(i.div().w(n.field_w).h(0)));
  }
  const N = m.whitespace === "nowrap" ? tn(m) : null, z = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let j = !n.range_name;
  const O = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const T of (n.children ?? []).filter(Me)) {
    const b = T.style?.flex_basis;
    O && T.style.flex_grow > 0 && (b === 0 || typeof b == "string" && b.endsWith("%")) && w.set(T, { ...w.get(T), flex_basis: "auto" });
    let h = Vo(T, i, o, c, !1, d, p, m, z && T.style?.position !== "absolute", w);
    const U = !j && (T.kind === "text" || !T.meta), J = T.kind === "text" ? w.get(T)?.h ?? N : null, at = T.kind === "text" ? w.get(T)?.w : void 0;
    if (U || J || at !== void 0) {
      let et = i.div();
      U && (et = et.id(n.range_name)), U && !z && n.style.display === "flex" && (et = et[`self_${uv[m.text_align] ?? "start"}`]().max_w("100%")), J && (et = et.h(J)), at !== void 0 && (et = et.w(at).flex_none().whitespace_nowrap()), h = et.child(h), j ||= U;
    }
    g = g.child(h);
  }
  return g;
}
const uv = { center: "center", right: "end", end: "end" };
function dv(n) {
  const i = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return n;
  const o = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const Hm = /^(?:[!-,.-~]+|\S)$/u, Dm = (n) => {
  for (const i of n.children ?? []) {
    if (i.kind === "input" && /^(checkbox|radio)$/.test(i.input_type)) return i;
    const o = i.kind === "text" ? null : Dm(i);
    if (o) return o;
  }
  return null;
}, Um = (n, i) => n.id === i || (n.children ?? []).some((o) => o.kind !== "text" && Um(o, i)), Bm = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && Bm(i));
function tn(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function zv(n, i, o, c, s = 0, d = !1) {
  const p = [n.root, ...n.overlays], m = s > 0 ? vv(p, s) : /* @__PURE__ */ new Map();
  s > 0 && c.measure && mv(p, s, c.measure, m), gv(p, m), hv(p, m), c.measure && pv(p, c.measure, m);
  let y = i.div().relative().size_full().child(Vo(n.root, i, o, c, !1, !1, null, {}, !1, m)), w = d && n.overlays.length ? i.div().relative().size_full().window_layer() : y;
  for (const A of n.overlays) w = w.child(Vo(A, i, o, c, !0, !1, null, {}, !1, m));
  return w === y ? y : y.child(w);
}
function mv(n, i, o, c) {
  const s = (S, _) => c.set(S, { ...c.get(S), ..._ }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function y(S, _, k) {
    if (S.kind === "text") {
      if (!(_.whitespace === "nowrap" || Hm.test(S.text)) || _.text_ellipsis || k || typeof _.text_size != "number") return NaN;
      const b = o(S.text, { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic });
      return Number.isFinite(b) ? b : NaN;
    }
    if (!Me(S) || S.kind === "input" || S.markup) return w(S);
    const q = { ..._ };
    for (const T of m) S.style[T] !== void 0 && (q[T] = S.style[T]);
    p.set(S, q);
    const N = S.style, z = (S.children ?? []).filter(Je), j = z.map((T) => y(T, q, k || !!S.tabular));
    let O = w(S);
    if (!Number.isFinite(O) && N.w === void 0) {
      const T = z.map((h, U) => j[U] + (h.kind === "text" ? 0 : I(h.style.ml) + I(h.style.mr)));
      let b;
      z.length ? Ye(S) ? b = z.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || N.flex_wrap === "wrap" ? NaN : T.reduce((h, U) => h + U, 0) + I(N.gap_x) * (z.length - 1) : b = Math.max(...T) : b = 0, O = b + I(N.pl) + I(N.pr) + I(N.border_l) + I(N.border_r), typeof N.min_w == "number" && (O = Math.max(O, N.min_w)), typeof N.max_w == "number" && (O = Math.min(O, N.max_w));
    }
    return d.set(S, O), O;
  }
  const w = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, A = () => ({ exact: 0, laid: 0 }), D = (S, _) => {
    if (!Number.isFinite(_))
      return Object.assign(S, A()), NaN;
    S.exact += _;
    const k = Math.round(S.exact * i + 1e-9) / i, q = k - S.laid;
    return S.laid = k, q;
  }, E = (S) => Ye(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function g(S) {
    if (!S || S.kind === "text" || !Me(S)) return;
    const _ = (S.children ?? []).filter(Je);
    if (E(S) && _.length > 1) {
      const k = I(S.style.gap_x), q = A(), N = !(k && _.some((z) => z.kind === "text"));
      s(S, { border_l: D(q, I(S.style.border_l)), pl: D(q, I(S.style.pl)) }), N && k && s(S, { gap_x: 0 }), _.forEach((z, j) => {
        const O = (j && N ? k : 0) + (z.kind === "text" ? 0 : I(z.style.ml));
        if (z.kind === "text")
          O && Object.assign(q, A());
        else {
          const U = D(q, O);
          Number.isFinite(U) && s(z, { ml: U });
        }
        const T = z.kind === "text" ? p.get(S) ?? {} : null, b = z.kind === "text" ? y(z, T, !!S.tabular) : d.get(z);
        if ((z.kind === "text" || !(z.style.flex_grow > 0)) && Number.isFinite(b) ? s(z, { w: D(q, b) }) : Object.assign(q, A()), z.kind !== "text") {
          const U = D(q, I(z.style.mr));
          Number.isFinite(U) && s(z, { mr: U });
        }
      });
    }
    for (const k of S.children ?? []) k.kind !== "text" && g(k);
  }
  for (const S of n)
    S && (y(S, {}, !1), g(S));
}
const fv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function pv(n, i, o) {
  const c = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (m) => typeof m == "number" ? m : 0, d = (m, y) => y && Ai(y) && !Ye(y) && m.style.position !== "absolute" && !["start", "center", "end"].includes(m.style.self) && !["start", "center", "end"].includes(y.style.items), p = (m, y, w, A) => {
    if (!m || m.kind === "text" || !Me(m)) return;
    const D = m.style;
    let E = typeof D.w == "number" ? D.w : D.w === "100%" ? w : d(m, y) ? w - s(D.ml) - s(D.mr) : NaN;
    typeof D.max_w == "number" && (E = Math.min(E, D.max_w));
    const g = E - s(D.pl) - s(D.pr) - s(D.border_l) - s(D.border_r), S = { ...A };
    for (const k of c) D[k] !== void 0 && (S[k] = D[k]);
    const _ = m.children ?? [];
    if (m.break_anywhere && Number.isFinite(g) && g > 0 && typeof S.text_size == "number" && _.length && _.every((k) => k.kind === "text")) {
      const k = { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic }, q = (j) => i(j.trimEnd(), k) <= g + 0.01;
      let N = 0;
      for (const j of _) {
        const O = [];
        for (const b of j.text.split(`
`)) {
          let h = "";
          for (const U of b.split(fv)) {
            if (q(h + U)) {
              h += U;
              continue;
            }
            h && O.push(h.trimEnd()), h = "";
            for (const J of U)
              h && !q(h + J) && (O.push(h), h = ""), h += J;
          }
          O.push(h.trimEnd());
        }
        const T = O.join(`
`);
        O.every((b) => !b || q(b)) ? T !== j.text && o.set(j, { ...o.get(j), text: T }) : N = NaN, N += O.length;
      }
      const z = tn(S);
      Number.isFinite(N) && z && D.h === void 0 && _.length === 1 && o.set(m, { ...o.get(m), h: N * z + s(D.pt) + s(D.pb) + s(D.border_t) + s(D.border_b) });
    }
    for (const k of _) p(k, m, Ye(m) ? NaN : g, S);
  };
  for (const m of n) p(m, null, NaN, {});
}
function hv(n, i) {
  const o = (c, s) => {
    if (!c || c.kind === "text" || !Me(c)) return;
    const d = c.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (p && Ye(c))
      for (const m of c.children ?? []) {
        const y = m.kind === "text" ? void 0 : m.style.flex_basis;
        m.kind !== "text" && m.style.flex_grow > 0 && (y === 0 || typeof y == "string" && y.endsWith("%")) && i.set(m, { ...i.get(m), flex_basis: "auto" });
      }
    for (const m of c.children ?? []) o(m, p);
  };
  for (const c of n) o(c, !1);
}
function gv(n, i) {
  const o = i.heights ?? /* @__PURE__ */ new Map(), c = (m) => o.get(m), s = (m) => {
    const y = m.style, w = (m.children ?? []).filter(Je);
    if (!w.length || Ye(m)) return NaN;
    let A = 0;
    for (const D of w) {
      const E = c(D);
      if (!Number.isFinite(E)) return NaN;
      A += E + (D.kind === "text" ? 0 : I(D.style.mt) + I(D.style.mb));
    }
    return A + (y.display === "flex" ? I(y.gap_y) * (w.length - 1) : 0) + I(y.pt) + I(y.pb);
  }, d = (m, y) => {
    const w = m.style;
    if (typeof w.h == "number") return w.h;
    if (typeof w.max_h == "number") return w.max_h;
    if (!y || !Ai(y) || Ye(y)) return NaN;
    const A = y.style, D = typeof A.h == "number" ? A.h : typeof A.max_h == "number" ? A.max_h : NaN, E = (y.children ?? []).filter(Je);
    let g = 0;
    for (const _ of E) {
      if (_ === m) continue;
      const k = c(_);
      if (!Number.isFinite(k)) return NaN;
      g += k + (_.kind === "text" ? 0 : I(_.style.mt) + I(_.style.mb));
    }
    const S = A.display === "flex" ? I(A.gap_y) * Math.max(0, E.length - 1) : 0;
    return D - I(A.pt) - I(A.pb) - I(A.border_t) - I(A.border_b) - g - S - I(w.mt) - I(w.mb);
  }, p = (m, y) => {
    if (!(!m || m.kind === "text" || !Me(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const w = s(m), A = d(m, y);
        Number.isFinite(w) && Number.isFinite(A) && w > A + 0.01 && i.set(m, { ...i.get(m), pr: I(m.style.pr) + m.scrollbar });
      }
      for (const w of m.children ?? []) p(w, m);
    }
  };
  for (const m of n) p(m, null);
}
const bv = ["text_size", "line_height", "whitespace", "text_ellipsis"], I = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ai = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ye = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Je = (n) => n.kind === "text" || Me(n) && n.style.position !== "absolute";
function vv(n, i) {
  const o = /* @__PURE__ */ new Map(), c = (_, k) => o.set(_, { ...o.get(_), ...Object.fromEntries(Object.entries(k).filter(([, q]) => Number.isFinite(q))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(_, k) {
    if (_.kind === "text") return k.whitespace === "nowrap" || Hm.test(_.text) ? tn(k) ?? NaN : NaN;
    const q = { ...k };
    for (const T of bv) _.style[T] !== void 0 && (q[T] = _.style[T]);
    d.set(_, q);
    const N = _.style, z = (_.children ?? []).filter(Je), j = z.map((T) => p(T, q));
    let O;
    if (N.h !== void 0 && N.h !== "auto") O = I(N.h);
    else if (_.kind === "input")
      O = (_.input_type === "textarea" || _.input_type === "select" ? NaN : tn(q) ?? NaN) + I(N.pt) + I(N.pb) + I(N.border_t) + I(N.border_b), N.min_h !== void 0 && (O = Math.max(O, I(N.min_h)));
    else {
      const T = z.map((h, U) => (h.kind === "text" ? 0 : I(h.style.mt) + I(h.style.mb)) + j[U]);
      let b;
      if (Ye(_)) b = N.flex_wrap === "wrap" ? NaN : N.items === "baseline" ? y(z, j, q) : Math.max(0, ...T);
      else if (Ai(_)) {
        const h = z.some((J) => J.kind !== "text" && (J.style.flex_grow > 0 || J.style.flex_basis !== void 0)), U = N.display !== "flex" && z.some((J) => J.kind !== "text" && (I(J.style.mt) || I(J.style.mb)));
        b = h || U ? NaN : T.reduce((J, at) => J + at, 0) + (N.display === "flex" ? I(N.gap_y) * Math.max(0, z.length - 1) : 0);
      } else b = NaN;
      O = b + I(N.pt) + I(N.pb) + I(N.border_t) + I(N.border_b), N.min_h !== void 0 && (O = Math.max(O, I(N.min_h))), N.max_h !== void 0 && (O = Math.min(O, I(N.max_h)));
    }
    return s.set(_, O), O;
  }
  const m = (_) => (tn(_) - (Ci + am) * _.text_size) / 2 + Ci * _.text_size;
  function y(_, k, q) {
    let N = 0, z = 0;
    for (const [j, O] of _.entries()) {
      const T = O.kind === "text" ? q : d.get(O);
      if (!(O.kind === "text" || (O.children ?? []).filter(Je).every((J) => J.kind === "text")) || !Number.isFinite(k[j]) || typeof T.text_size != "number") return NaN;
      const h = O.kind === "text" ? {} : O.style, U = I(h.mt) + I(h.border_t) + I(h.pt) + m(T);
      N = Math.max(N, U), z = Math.max(z, I(h.mt) + k[j] + I(h.mb) - U);
    }
    return N + z;
  }
  const w = () => ({ exact: 0, laid: 0 }), A = (_, k) => {
    if (!Number.isFinite(k))
      return Object.assign(_, w()), NaN;
    _.exact += k;
    const q = Math.round(_.exact * i + 1e-9) / i, N = q - _.laid;
    return _.laid = q, N;
  };
  function D(_) {
    if (!(_.kind === "text" || !Me(_))) {
      for (const k of (_.children ?? []).filter((q) => q.kind !== "text" && Me(q) && q.style.position === "absolute")) D(k);
      if (Ai(_) && !Ye(_)) {
        const k = w();
        c(_, { border_t: A(k, I(_.style.border_t)), pt: A(k, I(_.style.pt)) }), E(_, k);
      } else for (const k of (_.children ?? []).filter(Je)) k.kind !== "text" && D(k);
    }
  }
  function E(_, k) {
    const q = (_.children ?? []).filter(Je), N = _.style.display === "flex" ? I(_.style.gap_y) : 0;
    if (N && q.some((z) => z.kind === "text")) {
      for (const z of q) z.kind !== "text" && D(z);
      return !1;
    }
    return N && c(_, { gap_y: 0 }), q.forEach((z, j) => {
      if (z.kind === "text") {
        const O = s.get(z) ?? p(z, d.get(_) ?? {});
        Number.isFinite(O) ? c(z, { h: A(k, O) }) : Object.assign(k, w());
        return;
      }
      if (c(z, { mt: A(k, (j ? N : 0) + I(z.style.mt)) }), Number.isFinite(s.get(z))) S(z, k);
      else if (g(z)) {
        const O = z.style;
        c(z, { border_t: A(k, I(O.border_t)), pt: A(k, I(O.pt)) }), c(z, { pb: A(k, I(O.pb)), border_b: A(k, I(O.border_b)) });
      } else
        D(z), Object.assign(k, w());
      c(z, { mb: A(k, I(z.style.mb)) });
    }), !0;
  }
  function g(_) {
    const k = _.style, q = (_.children ?? []).filter(Je), N = tn(d.get(_) ?? {});
    return _.kind === "div" && !Ye(_) && q.length > 0 && q.every((z) => z.kind === "text") && Number.isInteger(N) && [k.h, k.min_h, k.max_h].every((z) => z === void 0 || z === "auto");
  }
  function S(_, k) {
    const q = _.style;
    for (const T of (_.children ?? []).filter((b) => b.kind !== "text" && Me(b) && b.style.position === "absolute")) D(T);
    const N = k.laid, z = k.exact;
    c(_, { border_t: A(k, I(q.border_t)), pt: A(k, I(q.pt)) });
    const j = q.h !== void 0 && q.h !== "auto", O = s.get(_) - I(q.pt) - I(q.pb) - I(q.border_t) - I(q.border_b);
    if (_.kind === "input")
      j || A(k, O);
    else if (Ye(_) || j && (q.justify ?? "start") !== "start") {
      for (const T of (_.children ?? []).filter(Je)) T.kind !== "text" && D(T);
      j || A(k, O);
    } else !E(_, k) && !j && A(k, O);
    if (j) {
      k.exact = z + s.get(_), k.laid = Math.round(k.exact * i + 1e-9) / i, c(_, { h: k.laid - N });
      return;
    }
    c(_, { pb: A(k, I(q.pb)), border_b: A(k, I(q.border_b)) }), c(_, { h: k.laid - N });
  }
  for (const _ of n)
    p(_, {}), D(_);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const Ev = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }] };
export {
  Ev as NAMED_ELEMENTS,
  yv as React,
  e0 as SCHEMA,
  kv as STYLE_KEYS,
  zv as describeToGpui,
  xv as jsxRuntime,
  wv as mount,
  _v as reactDom,
  Sv as sdk
};
