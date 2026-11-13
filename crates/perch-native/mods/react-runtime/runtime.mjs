function Lo(n, i) {
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
const ch = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), uh = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), dh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...ch]);
function Ao(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, o, c) => o ? String.fromCodePoint(parseInt(o, 16)) : c);
}
function hi(n, i) {
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
  return [Ao(n.slice(i, o)), o];
}
function mh(n, i) {
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
function Wo(n) {
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
function fh(n, i) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let c = !1;
  for (; i < n.length; ) {
    const s = n[i];
    if (s === "*") {
      o.tag = "*", i++, c = !0;
      continue;
    }
    if (s === ".") {
      const [d, p] = hi(n, i + 1);
      o.classes.push(d), i = p, c = !0;
      continue;
    }
    if (s === "#") {
      const [d, p] = hi(n, i + 1);
      o.id = d, i = p, c = !0;
      continue;
    }
    if (s === "[") {
      const d = n.indexOf("]", i);
      if (d < 0) throw new ke(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(i + 1, d).trim(), m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!m) throw new ke(`cannot read the attribute selector [${p}]`);
      const y = m[3] ?? m[4] ?? m[5];
      o.attrs.push({ name: Ao(m[1]).toLowerCase(), op: m[2] ?? null, value: y === void 0 ? null : Ao(y) }), i = d + 1, c = !0;
      continue;
    }
    if (s === ":") {
      if (n[i + 1] === ":") throw new ke(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = hi(n, i + 1);
      i = p;
      const m = d.toLowerCase();
      if (n[i] === "(") {
        if (!uh.has(m)) throw new ke(`:${m}() is not supported`);
        const y = mh(n, i + 1), _ = n.slice(i + 1, y).trim();
        if (i = y + 1, m === "nth-child") {
          if (!/^\d+$/.test(_)) throw new ke(`:nth-child(${_}) is not supported (only a number)`);
          o.pseudos.push({ name: m, n: Number(_) });
        } else
          o.pseudos.push({ name: m, list: Wo(_).map(Fo) });
      } else {
        if (!dh.has(m)) throw new ke(`:${m} is not supported`);
        o.pseudos.push({ name: m });
      }
      c = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !c) {
      const [d, p] = hi(n, i);
      o.tag = d.toLowerCase(), i = p, c = !0;
      continue;
    }
    break;
  }
  if (!c) throw new ke(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [o, i];
}
function Fo(n) {
  const i = [];
  let o = 0, c = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, d] = fh(n, o);
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
const Pu = /* @__PURE__ */ new Map();
function Hi(n) {
  let i = Pu.get(n);
  return i || (i = Wo(n).map(Fo), Pu.set(n, i)), i;
}
function Vd(n) {
  const i = [0, 0, 0], o = (c) => {
    i[0] += c[0], i[1] += c[1], i[2] += c[2];
  };
  for (const { compound: c } of n) {
    c.id && i[0]++, i[1] += c.classes.length + c.attrs.length, c.tag && c.tag !== "*" && i[2]++;
    for (const s of c.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(Vd).sort((p, m) => m[0] - p[0] || m[1] - p[1] || m[2] - p[2])[0];
          o(d);
        } else i[1]++;
  }
  return i;
}
function ph(n, { name: i, op: o, value: c }) {
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
function gi(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function hh(n, i, o, c) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const s = n.classList ?? [];
    for (const d of i.classes) if (!s.includes(d)) return !1;
  }
  for (const s of i.attrs) if (!ph(n, s)) return !1;
  for (const s of i.pseudos)
    switch (s.name) {
      case "first-child":
        if (gi(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (gi(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = gi(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (gi(n).indexOf(n) !== s.n - 1) return !1;
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
    const { compound: y, combinator: _ } = i[p];
    if (!hh(d, y, o, m)) return !1;
    if (p === 0) return !0;
    if (_ === ">") return !!d.parentElement && s(d.parentElement, p - 1, !1);
    for (let j = d.parentElement; j; j = j.parentElement) if (s(j, p - 1, !1)) return !0;
    return !1;
  };
  return s(n, i.length - 1, c);
}
function gh(n, i, o = {}) {
  return (typeof i == "string" ? Hi(i) : i).some((s) => On(n, s, o));
}
function Xd(n, i, o = {}) {
  return On(n, i, o);
}
function pl(n, i, o = {}) {
  const c = Hi(i), s = [], d = (p) => {
    for (const m of p.children)
      c.some((y) => On(m, y, o)) && s.push(m), d(m);
  };
  return d(n), s;
}
function Zd(n, i, o = {}) {
  const c = Hi(i);
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
let bh = 1;
class Oo {
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
class Io {
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
class Di {
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
class re extends Io {
  constructor(i, o = {}, c = null) {
    super(), this.nodeType = 1, this.id = `n${bh++}`, this.tagName = i.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = c, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return gh(this, i);
  }
  closest(i) {
    return Zd(this, i);
  }
  querySelectorAll(i) {
    return pl(this, i);
  }
  querySelector(i) {
    return pl(this, i)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return i ? new Oo(i.x, i.y, i.width, i.height) : new Oo();
  }
  // The DOM's measurement properties, from the same boxes. An offset is from the parent's box (the nearest box the
  // engine lays this one out in); a scroll size is the box's own, as nothing is measured inside a scroller.
  get offsetWidth() {
    return this.getBoundingClientRect().width;
  }
  get offsetHeight() {
    return this.getBoundingClientRect().height;
  }
  get offsetLeft() {
    return this.getBoundingClientRect().x - (this.parentElement?.getBoundingClientRect().x ?? 0);
  }
  get offsetTop() {
    return this.getBoundingClientRect().y - (this.parentElement?.getBoundingClientRect().y ?? 0);
  }
  get offsetParent() {
    return this.parentElement;
  }
  get clientWidth() {
    return this.getBoundingClientRect().width;
  }
  get clientHeight() {
    return this.getBoundingClientRect().height;
  }
  get scrollWidth() {
    return this.getBoundingClientRect().width;
  }
  get scrollHeight() {
    return this.getBoundingClientRect().height;
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
          return m === "setProperty" ? (y, _) => d(o(y), _) : m === "removeProperty" ? (y) => {
            const _ = s(o(y));
            return d(o(y), ""), _;
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
    return td(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(i = []) {
    return td(this, i);
  }
}
const Jd = Symbol("perch.stale-layout"), vh = 3;
let zi = !1;
function Ld(n) {
  return () => {
    let i, o = !1;
    const c = (s) => {
      const d = zi;
      zi = s < vh;
      try {
        i = n();
      } catch (p) {
        const m = p?.[Jd];
        if (!m) throw p;
        m.retries.push(() => {
          o || c(s + 1);
        });
      } finally {
        zi = d;
      }
    };
    return c(0), () => {
      o = !0, typeof i == "function" && i();
    };
  };
}
const Ro = "perch-dom:", yh = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), xh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function td(n, i = []) {
  const o = new Set(i.map((s) => xh[s] ?? s)), c = (s) => {
    if (!(s instanceof re)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [p, m] of Object.entries(s.props))
      yh.has(p) || o.has(p) || m == null || typeof m == "function" || typeof m == "symbol" || (d[p] = m);
    return { t: s.tagName, p: d, c: s.childNodes.map(c), ...s.hidden ? { h: 1 } : {} };
  };
  return Ro + JSON.stringify(c(n));
}
function wh(n, i) {
  if (typeof n != "string" || !n.startsWith(Ro)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(Ro.length));
  } catch {
    return null;
  }
  const c = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!c(d)) throw new Error("not a node");
    let p;
    if (typeof d.x == "string") p = new Di(d.x);
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
class _h {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Sh {
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
function ed(n) {
  for (let i = n; i instanceof re; i = i.parentElement) i.touch();
}
class kh extends Io {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new re("html", {}, this), this.body = new re("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(i) {
    return new re(i, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(i) {
    const o = this.perch?.bounds;
    if (typeof o != "function" || !this.measureKey) return null;
    i.measured || (i.measured = !0, i.touch(), this.restyled());
    const c = o(this.measureKey(i));
    if (zi && (!c || this.stale?.())) throw { [Jd]: this };
    return c ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, i.state.pointerFocus = !1, ed(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, ed(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return pl(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(i) {
    return pl(this.documentElement, "*").find((o) => o.props?.id === i) ?? null;
  }
}
class zh extends Io {
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
function Wd(n) {
  return {
    setTimeout: (i, o = 0, ...c) => n.setTimeout(() => i(...c), Math.max(0, Number(o) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
const ad = Symbol.for("perch.react.globals");
function qe(n, i, o) {
  Object.defineProperty(n, i, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function Eh(n, i = globalThis) {
  const o = new kh(n), c = new zh(n, o);
  o.defaultView = c;
  const s = n.storage ?? new Sh();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const m = Wd(n);
    qe(i, "setTimeout", m.setTimeout), qe(i, "clearTimeout", m.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && qe(i, "queueMicrotask", (m) => {
    Promise.resolve().then(m);
  }), qe(i, "requestAnimationFrame", (m) => i.setTimeout(() => m(Date.now()), 0)), qe(i, "cancelAnimationFrame", (m) => i.clearTimeout(m));
  const d = { document: o, window: c, localStorage: s };
  for (const m of Object.keys(d))
    Object.defineProperty(i, m, { get: () => i[ad]?.[m], configurable: !0, enumerable: !1 });
  i[ad] = d, qe(i, "HTMLElement", re), qe(i, "Element", re), qe(i, "DOMRect", Oo), typeof i.ResizeObserver != "function" && qe(i, "ResizeObserver", _h);
  const p = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      qe(p, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || qe(i, "navigator", p), { document: o, window: c, globals: d };
}
function Ho(n, i = !1) {
  if (!(i ? n?.tagName === "input" && Fd(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let c = n.parentElement; c; c = c.parentElement) if (c.tagName === "form") return c;
  return null;
}
const Fd = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const nd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof nd?.setTimeout == "function") {
  const n = Wd(nd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function $o(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function Nh(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var i = n.default;
  if (typeof i == "function") {
    var o = function c() {
      return this instanceof c ? Reflect.construct(i, arguments, this.constructor) : i.apply(this, arguments);
    };
    o.prototype = i.prototype;
  } else o = {};
  return Object.defineProperty(o, "__esModule", { value: !0 }), Object.keys(n).forEach(function(c) {
    var s = Object.getOwnPropertyDescriptor(n, c);
    Object.defineProperty(o, c, s.get ? s : {
      enumerable: !0,
      get: function() {
        return n[c];
      }
    });
  }), o;
}
var ko = { exports: {} }, ct = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ld;
function Th() {
  if (ld) return ct;
  ld = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), c = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), y = Symbol.for("react.suspense"), _ = Symbol.for("react.memo"), j = Symbol.for("react.lazy"), R = Symbol.for("react.activity"), E = Symbol.iterator;
  function b(v) {
    return v === null || typeof v != "object" ? null : (v = E && v[E] || v["@@iterator"], typeof v == "function" ? v : null);
  }
  var k = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, S = Object.assign, z = {};
  function B(v, G, et) {
    this.props = v, this.context = G, this.refs = z, this.updater = et || k;
  }
  B.prototype.isReactComponent = {}, B.prototype.setState = function(v, G) {
    if (typeof v != "object" && typeof v != "function" && v != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, v, G, "setState");
  }, B.prototype.forceUpdate = function(v) {
    this.updater.enqueueForceUpdate(this, v, "forceUpdate");
  };
  function N() {
  }
  N.prototype = B.prototype;
  function M(v, G, et) {
    this.props = v, this.context = G, this.refs = z, this.updater = et || k;
  }
  var Y = M.prototype = new N();
  Y.constructor = M, S(Y, B.prototype), Y.isPureReactComponent = !0;
  var D = Array.isArray;
  function w() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function H(v, G, et) {
    var P = et.ref;
    return {
      $$typeof: n,
      type: v,
      key: G,
      ref: P !== void 0 ? P : null,
      props: et
    };
  }
  function Z(v, G) {
    return H(v.type, G, v.props);
  }
  function ot(v) {
    return typeof v == "object" && v !== null && v.$$typeof === n;
  }
  function $(v) {
    var G = { "=": "=0", ":": "=2" };
    return "$" + v.replace(/[=:]/g, function(et) {
      return G[et];
    });
  }
  var Et = /\/+/g;
  function wt(v, G) {
    return typeof v == "object" && v !== null && v.key != null ? $("" + v.key) : G.toString(36);
  }
  function jt(v) {
    switch (v.status) {
      case "fulfilled":
        return v.value;
      case "rejected":
        throw v.reason;
      default:
        switch (typeof v.status == "string" ? v.then(w, w) : (v.status = "pending", v.then(
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
  function Q(v, G, et, P, tt) {
    var lt = typeof v;
    (lt === "undefined" || lt === "boolean") && (v = null);
    var xt = !1;
    if (v === null) xt = !0;
    else
      switch (lt) {
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
            case j:
              return xt = v._init, Q(
                xt(v._payload),
                G,
                et,
                P,
                tt
              );
          }
      }
    if (xt)
      return tt = tt(v), xt = P === "" ? "." + wt(v, 0) : P, D(tt) ? (et = "", xt != null && (et = xt.replace(Et, "$&/") + "/"), Q(tt, G, et, "", function(Ra) {
        return Ra;
      })) : tt != null && (ot(tt) && (tt = Z(
        tt,
        et + (tt.key == null || v && v.key === tt.key ? "" : ("" + tt.key).replace(
          Et,
          "$&/"
        ) + "/") + xt
      )), G.push(tt)), 1;
    xt = 0;
    var Jt = P === "" ? "." : P + ":";
    if (D(v))
      for (var ut = 0; ut < v.length; ut++)
        P = v[ut], lt = Jt + wt(P, ut), xt += Q(
          P,
          G,
          et,
          lt,
          tt
        );
    else if (ut = b(v), typeof ut == "function")
      for (v = ut.call(v), ut = 0; !(P = v.next()).done; )
        P = P.value, lt = Jt + wt(P, ut++), xt += Q(
          P,
          G,
          et,
          lt,
          tt
        );
    else if (lt === "object") {
      if (typeof v.then == "function")
        return Q(
          jt(v),
          G,
          et,
          P,
          tt
        );
      throw G = String(v), Error(
        "Objects are not valid as a React child (found: " + (G === "[object Object]" ? "object with keys {" + Object.keys(v).join(", ") + "}" : G) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return xt;
  }
  function at(v, G, et) {
    if (v == null) return v;
    var P = [], tt = 0;
    return Q(v, P, "", "", function(lt) {
      return G.call(et, lt, tt++);
    }), P;
  }
  function nt(v) {
    if (v._status === -1) {
      var G = v._result;
      G = G(), G.then(
        function(et) {
          (v._status === 0 || v._status === -1) && (v._status = 1, v._result = et);
        },
        function(et) {
          (v._status === 0 || v._status === -1) && (v._status = 2, v._result = et);
        }
      ), v._status === -1 && (v._status = 0, v._result = G);
    }
    if (v._status === 1) return v._result.default;
    throw v._result;
  }
  var U = typeof reportError == "function" ? reportError : function(v) {
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
  }, q = {
    map: at,
    forEach: function(v, G, et) {
      at(
        v,
        function() {
          G.apply(this, arguments);
        },
        et
      );
    },
    count: function(v) {
      var G = 0;
      return at(v, function() {
        G++;
      }), G;
    },
    toArray: function(v) {
      return at(v, function(G) {
        return G;
      }) || [];
    },
    only: function(v) {
      if (!ot(v))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return v;
    }
  };
  return ct.Activity = R, ct.Children = q, ct.Component = B, ct.Fragment = o, ct.Profiler = s, ct.PureComponent = M, ct.StrictMode = c, ct.Suspense = y, ct.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, ct.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(v) {
      return g.H.useMemoCache(v);
    }
  }, ct.cache = function(v) {
    return function() {
      return v.apply(null, arguments);
    };
  }, ct.cacheSignal = function() {
    return null;
  }, ct.cloneElement = function(v, G, et) {
    if (v == null)
      throw Error(
        "The argument must be a React element, but you passed " + v + "."
      );
    var P = S({}, v.props), tt = v.key;
    if (G != null)
      for (lt in G.key !== void 0 && (tt = "" + G.key), G)
        !h.call(G, lt) || lt === "key" || lt === "__self" || lt === "__source" || lt === "ref" && G.ref === void 0 || (P[lt] = G[lt]);
    var lt = arguments.length - 2;
    if (lt === 1) P.children = et;
    else if (1 < lt) {
      for (var xt = Array(lt), Jt = 0; Jt < lt; Jt++)
        xt[Jt] = arguments[Jt + 2];
      P.children = xt;
    }
    return H(v.type, tt, P);
  }, ct.createContext = function(v) {
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
  }, ct.createElement = function(v, G, et) {
    var P, tt = {}, lt = null;
    if (G != null)
      for (P in G.key !== void 0 && (lt = "" + G.key), G)
        h.call(G, P) && P !== "key" && P !== "__self" && P !== "__source" && (tt[P] = G[P]);
    var xt = arguments.length - 2;
    if (xt === 1) tt.children = et;
    else if (1 < xt) {
      for (var Jt = Array(xt), ut = 0; ut < xt; ut++)
        Jt[ut] = arguments[ut + 2];
      tt.children = Jt;
    }
    if (v && v.defaultProps)
      for (P in xt = v.defaultProps, xt)
        tt[P] === void 0 && (tt[P] = xt[P]);
    return H(v, lt, tt);
  }, ct.createRef = function() {
    return { current: null };
  }, ct.forwardRef = function(v) {
    return { $$typeof: m, render: v };
  }, ct.isValidElement = ot, ct.lazy = function(v) {
    return {
      $$typeof: j,
      _payload: { _status: -1, _result: v },
      _init: nt
    };
  }, ct.memo = function(v, G) {
    return {
      $$typeof: _,
      type: v,
      compare: G === void 0 ? null : G
    };
  }, ct.startTransition = function(v) {
    var G = g.T, et = {};
    g.T = et;
    try {
      var P = v(), tt = g.S;
      tt !== null && tt(et, P), typeof P == "object" && P !== null && typeof P.then == "function" && P.then(w, U);
    } catch (lt) {
      U(lt);
    } finally {
      G !== null && et.types !== null && (G.types = et.types), g.T = G;
    }
  }, ct.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, ct.use = function(v) {
    return g.H.use(v);
  }, ct.useActionState = function(v, G, et) {
    return g.H.useActionState(v, G, et);
  }, ct.useCallback = function(v, G) {
    return g.H.useCallback(v, G);
  }, ct.useContext = function(v) {
    return g.H.useContext(v);
  }, ct.useDebugValue = function() {
  }, ct.useDeferredValue = function(v, G) {
    return g.H.useDeferredValue(v, G);
  }, ct.useEffect = function(v, G) {
    return g.H.useEffect(v, G);
  }, ct.useEffectEvent = function(v) {
    return g.H.useEffectEvent(v);
  }, ct.useId = function() {
    return g.H.useId();
  }, ct.useImperativeHandle = function(v, G, et) {
    return g.H.useImperativeHandle(v, G, et);
  }, ct.useInsertionEffect = function(v, G) {
    return g.H.useInsertionEffect(v, G);
  }, ct.useLayoutEffect = function(v, G) {
    return g.H.useLayoutEffect(v, G);
  }, ct.useMemo = function(v, G) {
    return g.H.useMemo(v, G);
  }, ct.useOptimistic = function(v, G) {
    return g.H.useOptimistic(v, G);
  }, ct.useReducer = function(v, G, et) {
    return g.H.useReducer(v, G, et);
  }, ct.useRef = function(v) {
    return g.H.useRef(v);
  }, ct.useState = function(v) {
    return g.H.useState(v);
  }, ct.useSyncExternalStore = function(v, G, et) {
    return g.H.useSyncExternalStore(
      v,
      G,
      et
    );
  }, ct.useTransition = function() {
    return g.H.useTransition();
  }, ct.version = "19.2.8", ct;
}
var id;
function Ch() {
  return id || (id = 1, ko.exports = Th()), ko.exports;
}
var ft = Ch();
const Id = /* @__PURE__ */ $o(ft), jh = /* @__PURE__ */ Lo({
  __proto__: null,
  default: Id
}, [ft]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const Mh = Id ?? jh;
function ua(n, i) {
  return ft.useEffect(Ld(n), i);
}
function Do(n, i) {
  return ft.useLayoutEffect(Ld(n), i);
}
const Ah = /* @__PURE__ */ Lo({
  __proto__: null,
  default: Mh,
  useEffect: ua,
  useLayoutEffect: Do
}, [ft]);
var zo = { exports: {} }, dl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var rd;
function Oh() {
  if (rd) return dl;
  rd = 1;
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
  return dl.Fragment = i, dl.jsx = o, dl.jsxs = o, dl;
}
var od;
function Rh() {
  return od || (od = 1, zo.exports = Oh()), zo.exports;
}
var zt = Rh();
const Hh = /* @__PURE__ */ $o(zt), Tv = /* @__PURE__ */ Lo({
  __proto__: null,
  default: Hh
}, [zt]);
var Eo = { exports: {} }, No = { exports: {} };
const Dh = /* @__PURE__ */ Nh(Ah);
var To = { exports: {} }, Co = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var sd;
function Uh() {
  return sd || (sd = 1, (function(n) {
    function i(Q, at) {
      var nt = Q.length;
      Q.push(at);
      t: for (; 0 < nt; ) {
        var U = nt - 1 >>> 1, q = Q[U];
        if (0 < s(q, at))
          Q[U] = at, Q[nt] = q, nt = U;
        else break t;
      }
    }
    function o(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function c(Q) {
      if (Q.length === 0) return null;
      var at = Q[0], nt = Q.pop();
      if (nt !== at) {
        Q[0] = nt;
        t: for (var U = 0, q = Q.length, v = q >>> 1; U < v; ) {
          var G = 2 * (U + 1) - 1, et = Q[G], P = G + 1, tt = Q[P];
          if (0 > s(et, nt))
            P < q && 0 > s(tt, et) ? (Q[U] = tt, Q[P] = nt, U = P) : (Q[U] = et, Q[G] = nt, U = G);
          else if (P < q && 0 > s(tt, nt))
            Q[U] = tt, Q[P] = nt, U = P;
          else break t;
        }
      }
      return at;
    }
    function s(Q, at) {
      var nt = Q.sortIndex - at.sortIndex;
      return nt !== 0 ? nt : Q.id - at.id;
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
    var y = [], _ = [], j = 1, R = null, E = 3, b = !1, k = !1, S = !1, z = !1, B = typeof setTimeout == "function" ? setTimeout : null, N = typeof clearTimeout == "function" ? clearTimeout : null, M = typeof setImmediate < "u" ? setImmediate : null;
    function Y(Q) {
      for (var at = o(_); at !== null; ) {
        if (at.callback === null) c(_);
        else if (at.startTime <= Q)
          c(_), at.sortIndex = at.expirationTime, i(y, at);
        else break;
        at = o(_);
      }
    }
    function D(Q) {
      if (S = !1, Y(Q), !k)
        if (o(y) !== null)
          k = !0, w || (w = !0, $());
        else {
          var at = o(_);
          at !== null && jt(D, at.startTime - Q);
        }
    }
    var w = !1, g = -1, h = 5, H = -1;
    function Z() {
      return z ? !0 : !(n.unstable_now() - H < h);
    }
    function ot() {
      if (z = !1, w) {
        var Q = n.unstable_now();
        H = Q;
        var at = !0;
        try {
          t: {
            k = !1, S && (S = !1, N(g), g = -1), b = !0;
            var nt = E;
            try {
              e: {
                for (Y(Q), R = o(y); R !== null && !(R.expirationTime > Q && Z()); ) {
                  var U = R.callback;
                  if (typeof U == "function") {
                    R.callback = null, E = R.priorityLevel;
                    var q = U(
                      R.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof q == "function") {
                      R.callback = q, Y(Q), at = !0;
                      break e;
                    }
                    R === o(y) && c(y), Y(Q);
                  } else c(y);
                  R = o(y);
                }
                if (R !== null) at = !0;
                else {
                  var v = o(_);
                  v !== null && jt(
                    D,
                    v.startTime - Q
                  ), at = !1;
                }
              }
              break t;
            } finally {
              R = null, E = nt, b = !1;
            }
            at = void 0;
          }
        } finally {
          at ? $() : w = !1;
        }
      }
    }
    var $;
    if (typeof M == "function")
      $ = function() {
        M(ot);
      };
    else if (typeof MessageChannel < "u") {
      var Et = new MessageChannel(), wt = Et.port2;
      Et.port1.onmessage = ot, $ = function() {
        wt.postMessage(null);
      };
    } else
      $ = function() {
        B(ot, 0);
      };
    function jt(Q, at) {
      g = B(function() {
        Q(n.unstable_now());
      }, at);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, n.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return E;
    }, n.unstable_next = function(Q) {
      switch (E) {
        case 1:
        case 2:
        case 3:
          var at = 3;
          break;
        default:
          at = E;
      }
      var nt = E;
      E = at;
      try {
        return Q();
      } finally {
        E = nt;
      }
    }, n.unstable_requestPaint = function() {
      z = !0;
    }, n.unstable_runWithPriority = function(Q, at) {
      switch (Q) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          Q = 3;
      }
      var nt = E;
      E = Q;
      try {
        return at();
      } finally {
        E = nt;
      }
    }, n.unstable_scheduleCallback = function(Q, at, nt) {
      var U = n.unstable_now();
      switch (typeof nt == "object" && nt !== null ? (nt = nt.delay, nt = typeof nt == "number" && 0 < nt ? U + nt : U) : nt = U, Q) {
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
      return q = nt + q, Q = {
        id: j++,
        callback: at,
        priorityLevel: Q,
        startTime: nt,
        expirationTime: q,
        sortIndex: -1
      }, nt > U ? (Q.sortIndex = nt, i(_, Q), o(y) === null && Q === o(_) && (S ? (N(g), g = -1) : S = !0, jt(D, nt - U))) : (Q.sortIndex = q, i(y, Q), k || b || (k = !0, w || (w = !0, $()))), Q;
    }, n.unstable_shouldYield = Z, n.unstable_wrapCallback = function(Q) {
      var at = E;
      return function() {
        var nt = E;
        E = at;
        try {
          return Q.apply(this, arguments);
        } finally {
          E = nt;
        }
      };
    };
  })(Co)), Co;
}
var cd;
function Bh() {
  return cd || (cd = 1, To.exports = Uh()), To.exports;
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
var ud;
function qh() {
  return ud || (ud = 1, (function(n) {
    n.exports = function(i) {
      function o(t, e, a, l) {
        return new pf(t, e, a, l);
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
      function j(t) {
        return t === null || typeof t != "object" ? null : (t = vu && t[vu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function R(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === yf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case mn:
            return "Fragment";
          case Qr:
            return "Profiler";
          case gu:
            return "StrictMode";
          case Xr:
            return "Suspense";
          case Zr:
            return "SuspenseList";
          case Lr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case dn:
              return "Portal";
            case ya:
              return t.displayName || "Context";
            case bu:
              return (t._context.displayName || "Context") + ".Consumer";
            case Vr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Jr:
              return e = t.displayName || null, e !== null ? e : R(t.type) || "Memo";
            case xa:
              e = t._payload, t = t._init;
              try {
                return R(t(e));
              } catch {
              }
          }
        return null;
      }
      function E(t) {
        return { current: t };
      }
      function b(t) {
        0 > hn || (t.current = to[hn], to[hn] = null, hn--);
      }
      function k(t, e) {
        hn++, to[hn] = t.current, t.current = e;
      }
      function S(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Jp(t) / Lp | 0) | 0;
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
      function B(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, u = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var x = l & 134217727;
        return x !== 0 ? (l = x & ~u, l !== 0 ? r = z(l) : (f &= x, f !== 0 ? r = z(f) : a || (a = x & ~t, a !== 0 && (r = z(a))))) : (x = l & ~u, x !== 0 ? r = z(x) : f !== 0 ? r = z(f) : a || (a = l & ~t, a !== 0 && (r = z(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function N(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function M(t, e) {
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
      function Y() {
        var t = Fl;
        return Fl <<= 1, (Fl & 62914560) === 0 && (Fl = 4194304), t;
      }
      function D(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function w(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, a, l, r, u) {
        var f = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var x = t.entanglements, O = t.expirationTimes, K = t.hiddenUpdates;
        for (a = f & ~a; 0 < a; ) {
          var J = 31 - be(a), V = 1 << J;
          x[J] = 0, O[J] = -1;
          var L = K[J];
          if (L !== null)
            for (K[J] = null, J = 0; J < L.length; J++) {
              var dt = L[J];
              dt !== null && (dt.lane &= -536870913);
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
      function H(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var l = 31 - be(a), r = 1 << l;
          r & e | t[l] & e && (t[l] |= e), a &= ~r;
        }
      }
      function Z(t, e) {
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
      function $(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function Et(t) {
        if (typeof Pp == "function" && th(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode(Pn, t);
          } catch {
          }
      }
      function wt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function jt(t) {
        if (no === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            no = e && e[1] || "", Vu = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + no + t + Vu;
      }
      function Q(t, e) {
        if (!t || lo) return "";
        lo = !0;
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
          var u = l.DetermineComponentFrameRoot(), f = u[0], x = u[1];
          if (f && x) {
            var O = f.split(`
`), K = x.split(`
`);
            for (r = l = 0; l < O.length && !O[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < K.length && !K[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === O.length || r === K.length)
              for (l = O.length - 1, r = K.length - 1; 1 <= l && 0 <= r && O[l] !== K[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (O[l] !== K[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || O[l] !== K[r]) {
                      var J = `
` + O[l].replace(" at new ", " at ");
                      return t.displayName && J.includes("<anonymous>") && (J = J.replace("<anonymous>", t.displayName)), J;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          lo = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? jt(a) : "";
      }
      function at(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return jt(t.type);
          case 16:
            return jt("Lazy");
          case 13:
            return t.child !== e && e !== null ? jt("Suspense Fallback") : jt("Suspense");
          case 19:
            return jt("SuspenseList");
          case 0:
          case 15:
            return Q(t.type, !1);
          case 11:
            return Q(t.type.render, !1);
          case 1:
            return Q(t.type, !0);
          case 31:
            return jt("Activity");
          default:
            return "";
        }
      }
      function nt(t) {
        try {
          var e = "", a = null;
          do
            e += at(t, a), a = t, t = t.return;
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
          var a = Xu.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: nt(e)
          }, Xu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: nt(e)
        };
      }
      function q(t, e) {
        bn[vn++] = tl, bn[vn++] = $l, $l = t, tl = e;
      }
      function v(t, e, a) {
        ze[Ee++] = Ve, ze[Ee++] = Xe, ze[Ee++] = wa, wa = t;
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
        t.return !== null && (q(t, 1), v(t, 1, 0));
      }
      function et(t) {
        for (; t === $l; )
          $l = bn[--vn], bn[vn] = null, tl = bn[--vn], bn[vn] = null;
        for (; t === wa; )
          wa = ze[--Ee], ze[Ee] = null, Xe = ze[--Ee], ze[Ee] = null, Ve = ze[--Ee], ze[Ee] = null;
      }
      function P(t, e) {
        ze[Ee++] = Ve, ze[Ee++] = Xe, ze[Ee++] = wa, Ve = e.id, Xe = e.overflow, wa = t;
      }
      function tt(t, e) {
        k(_a, e), k(el, t), k(Pt, null), t = _f(e), b(Pt), k(Pt, t);
      }
      function lt() {
        b(Pt), b(el), b(_a);
      }
      function xt(t) {
        t.memoizedState !== null && k(Pl, t);
        var e = Pt.current, a = Sf(e, t.type);
        e !== a && (k(el, t), k(Pt, a));
      }
      function Jt(t) {
        el.current === t && (b(Pt), b(el)), Pl.current === t && (b(Pl), ta ? Va._currentValue = fn : Va._currentValue2 = fn);
      }
      function ut(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Hn(U(e, t)), io;
      }
      function Ra(t, e) {
        if (!le) throw Error(s(175));
        Sp(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ut(t, !0);
      }
      function Ha(t) {
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
        if (!yt) return Ha(t), yt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Mu(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ut(t) : e !== 3 && (e !== 5 || Mu(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ut(t), Ha(t), e === 13) {
          if (!le) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Tp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Np(t);
        } else
          Ot = Vt && e === 27 ? fp(
            t.type,
            Ot
          ) : te ? ju(t.stateNode) : null;
        return !0;
      }
      function Oe() {
        le && (Ot = te = null, yt = !1);
      }
      function da() {
        var t = Sa;
        return t !== null && (me === null ? me = t : me.push.apply(
          me,
          t
        ), Sa = null), t;
      }
      function Hn(t) {
        Sa === null ? Sa = [t] : Sa.push(t);
      }
      function ma(t, e, a) {
        ta ? (k(ti, e._currentValue), e._currentValue = a) : (k(ti, e._currentValue2), e._currentValue2 = a);
      }
      function Le(t) {
        var e = ti.current;
        ta ? t._currentValue = e : t._currentValue2 = e, b(ti);
      }
      function Yi(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Gi(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var f = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var x = u;
              u = r;
              for (var O = 0; O < e.length; O++)
                if (x.context === e[O]) {
                  u.lanes |= a, x = u.alternate, x !== null && (x.lanes |= a), Yi(
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
            f.lanes |= a, u = f.alternate, u !== null && (u.lanes |= a), Yi(f, a, t), f = null;
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
          } else if (r === Pl.current) {
            if (f = r.alternate, f === null) throw Error(s(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Va) : t = [Va]);
          }
          r = r.return;
        }
        t !== null && Gi(
          e,
          t,
          a,
          l
        ), e.flags |= 262144;
      }
      function gl(t) {
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
      function Da(t) {
        Xa = t, aa = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function It(t) {
        return ls(Xa, t);
      }
      function bl(t, e) {
        return Xa === null && Da(t), ls(t, e);
      }
      function ls(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(s(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function Ki() {
        return {
          controller: new ah(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Dn(t) {
        t.refCount--, t.refCount === 0 && nh(lh, function() {
          t.controller.abort();
        });
      }
      function vl() {
      }
      function Ge(t) {
        t !== yn && t.next === null && (yn === null ? ei = yn = t : yn = yn.next = t), ai = !0, ro || (ro = !0, Qm());
      }
      function rn(t, e) {
        if (!oo && ai) {
          oo = !0;
          do
            for (var a = !1, l = ei; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var f = l.suspendedLanes, x = l.pingedLanes;
                  u = (1 << 31 - be(42 | t) + 1) - 1, u &= r & ~(f & ~x), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, cs(l, u));
              } else
                u = vt, u = B(
                  l,
                  l === Mt ? u : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Qa
                ), (u & 3) === 0 || N(l, u) || (a = !0, cs(l, u));
              l = l.next;
            }
          while (a);
          oo = !1;
        }
      }
      function is() {
        rs();
      }
      function rs() {
        ai = ro = !1;
        var t = 0;
        Za !== 0 && Af() && (t = Za);
        for (var e = ue(), a = null, l = ei; l !== null; ) {
          var r = l.next, u = os(l, e);
          u === 0 ? (l.next = null, a === null ? ei = r : a.next = r, r === null && (yn = a)) : (a = l, (t !== 0 || (u & 3) !== 0) && (ai = !0)), l = r;
        }
        Xt !== 0 && Xt !== 5 || rn(t), Za !== 0 && (Za = 0);
      }
      function os(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var f = 31 - be(u), x = 1 << f, O = r[f];
          O === -1 ? ((x & a) === 0 || (x & l) !== 0) && (r[f] = M(x, e)) : O <= e && (t.expiredLanes |= x), u &= ~x;
        }
        if (e = Mt, a = vt, a = B(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l = t.callbackNode, a === 0 || t === e && (Tt === 2 || Tt === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && eo(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || N(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && eo(l), $(a)) {
            case 2:
            case 8:
              a = Ip;
              break;
            case 32:
              a = ao;
              break;
            case 268435456:
              a = $p;
              break;
            default:
              a = ao;
          }
          return l = ss.bind(null, t), a = Il(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && eo(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function ss(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Wn() && t.callbackNode !== a)
          return null;
        var l = vt;
        return l = B(
          t,
          t === Mt ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l === 0 ? null : (Xc(t, l, e), os(t, ue()), t.callbackNode != null && t.callbackNode === a ? ss.bind(null, t) : null);
      }
      function cs(t, e) {
        if (Wn()) return null;
        Xc(t, e, !0);
      }
      function Qm() {
        qf ? Yf(function() {
          (gt & 6) !== 0 ? Il(
            Ku,
            is
          ) : rs();
        }) : Il(
          Ku,
          is
        );
      }
      function Qi() {
        if (Za === 0) {
          var t = xn;
          t === 0 && (t = Ll, Ll <<= 1, (Ll & 261888) === 0 && (Ll = 256)), Za = t;
        }
        return Za;
      }
      function Vm(t, e) {
        if (al === null) {
          var a = al = [];
          so = 0, xn = Qi(), wn = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return so++, e.then(us, us), e;
      }
      function us() {
        if (--so === 0 && al !== null) {
          wn !== null && (wn.status = "fulfilled");
          var t = al;
          al = null, xn = 0, wn = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Xm(t, e) {
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
      function Vi() {
        var t = Ja.current;
        return t !== null ? t : Mt.pooledCache;
      }
      function yl(t, e) {
        e === null ? k(Ja, Ja.current) : k(Ja, e.pool);
      }
      function ds() {
        var t = Vi();
        return t === null ? null : {
          parent: ta ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function xl(t, e) {
        if (ye(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), l = Object.keys(e);
        if (a.length !== l.length) return !1;
        for (l = 0; l < a.length; l++) {
          var r = a[l];
          if (!eh.call(e, r) || !ye(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function ms(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function fs(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(vl, vl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, hs(t), t;
          default:
            if (typeof e.status == "string") e.then(vl, vl);
            else {
              if (t = Mt, t !== null && 100 < t.shellSuspendCounter)
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
                throw t = e.reason, hs(t), t;
            }
            throw La = e, _n;
        }
      }
      function Ua(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (La = a, _n) : a;
        }
      }
      function ps() {
        if (La === null) throw Error(s(459));
        var t = La;
        return La = null, t;
      }
      function hs(t) {
        if (t === _n || t === ni)
          throw Error(s(483));
      }
      function wl(t) {
        var e = nl;
        return nl += 1, Sn === null && (Sn = []), fs(Sn, t, e);
      }
      function Un(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function _l(t, e) {
        throw e.$$typeof === bf ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function gs(t) {
        function e(C, T) {
          if (t) {
            var A = C.deletions;
            A === null ? (C.deletions = [T], C.flags |= 16) : A.push(T);
          }
        }
        function a(C, T) {
          if (!t) return null;
          for (; T !== null; )
            e(C, T), T = T.sibling;
          return null;
        }
        function l(C) {
          for (var T = /* @__PURE__ */ new Map(); C !== null; )
            C.key !== null ? T.set(C.key, C) : T.set(C.index, C), C = C.sibling;
          return T;
        }
        function r(C, T) {
          return C = Pe(C, T), C.index = 0, C.sibling = null, C;
        }
        function u(C, T, A) {
          return C.index = A, t ? (A = C.alternate, A !== null ? (A = A.index, A < T ? (C.flags |= 67108866, T) : A) : (C.flags |= 67108866, T)) : (C.flags |= 1048576, T);
        }
        function f(C) {
          return t && C.alternate === null && (C.flags |= 67108866), C;
        }
        function x(C, T, A, X) {
          return T === null || T.tag !== 6 ? (T = qr(A, C.mode, X), T.return = C, T) : (T = r(T, A), T.return = C, T);
        }
        function O(C, T, A, X) {
          var rt = A.type;
          return rt === mn ? J(
            C,
            T,
            A.props.children,
            X,
            A.key
          ) : T !== null && (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === xa && Ua(rt) === T.type) ? (T = r(T, A.props), Un(T, A), T.return = C, T) : (T = Vl(
            A.type,
            A.key,
            A.props,
            null,
            C.mode,
            X
          ), Un(T, A), T.return = C, T);
        }
        function K(C, T, A, X) {
          return T === null || T.tag !== 4 || T.stateNode.containerInfo !== A.containerInfo || T.stateNode.implementation !== A.implementation ? (T = Yr(A, C.mode, X), T.return = C, T) : (T = r(T, A.children || []), T.return = C, T);
        }
        function J(C, T, A, X, rt) {
          return T === null || T.tag !== 7 ? (T = Ka(
            A,
            C.mode,
            X,
            rt
          ), T.return = C, T) : (T = r(T, A), T.return = C, T);
        }
        function V(C, T, A) {
          if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
            return T = qr(
              "" + T,
              C.mode,
              A
            ), T.return = C, T;
          if (typeof T == "object" && T !== null) {
            switch (T.$$typeof) {
              case Xl:
                return A = Vl(
                  T.type,
                  T.key,
                  T.props,
                  null,
                  C.mode,
                  A
                ), Un(A, T), A.return = C, A;
              case dn:
                return T = Yr(
                  T,
                  C.mode,
                  A
                ), T.return = C, T;
              case xa:
                return T = Ua(T), V(C, T, A);
            }
            if (Zl(T) || j(T))
              return T = Ka(
                T,
                C.mode,
                A,
                null
              ), T.return = C, T;
            if (typeof T.then == "function")
              return V(C, wl(T), A);
            if (T.$$typeof === ya)
              return V(
                C,
                bl(C, T),
                A
              );
            _l(C, T);
          }
          return null;
        }
        function L(C, T, A, X) {
          var rt = T !== null ? T.key : null;
          if (typeof A == "string" && A !== "" || typeof A == "number" || typeof A == "bigint")
            return rt !== null ? null : x(C, T, "" + A, X);
          if (typeof A == "object" && A !== null) {
            switch (A.$$typeof) {
              case Xl:
                return A.key === rt ? O(C, T, A, X) : null;
              case dn:
                return A.key === rt ? K(C, T, A, X) : null;
              case xa:
                return A = Ua(A), L(C, T, A, X);
            }
            if (Zl(A) || j(A))
              return rt !== null ? null : J(C, T, A, X, null);
            if (typeof A.then == "function")
              return L(
                C,
                T,
                wl(A),
                X
              );
            if (A.$$typeof === ya)
              return L(
                C,
                T,
                bl(C, A),
                X
              );
            _l(C, A);
          }
          return null;
        }
        function dt(C, T, A, X, rt) {
          if (typeof X == "string" && X !== "" || typeof X == "number" || typeof X == "bigint")
            return C = C.get(A) || null, x(T, C, "" + X, rt);
          if (typeof X == "object" && X !== null) {
            switch (X.$$typeof) {
              case Xl:
                return C = C.get(
                  X.key === null ? A : X.key
                ) || null, O(T, C, X, rt);
              case dn:
                return C = C.get(
                  X.key === null ? A : X.key
                ) || null, K(T, C, X, rt);
              case xa:
                return X = Ua(X), dt(
                  C,
                  T,
                  A,
                  X,
                  rt
                );
            }
            if (Zl(X) || j(X))
              return C = C.get(A) || null, J(T, C, X, rt, null);
            if (typeof X.then == "function")
              return dt(
                C,
                T,
                A,
                wl(X),
                rt
              );
            if (X.$$typeof === ya)
              return dt(
                C,
                T,
                A,
                bl(T, X),
                rt
              );
            _l(T, X);
          }
          return null;
        }
        function ee(C, T, A, X) {
          for (var rt = null, Ht = null, st = T, St = T = 0, Ft = null; st !== null && St < A.length; St++) {
            st.index > St ? (Ft = st, st = null) : Ft = st.sibling;
            var kt = L(
              C,
              st,
              A[St],
              X
            );
            if (kt === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && kt.alternate === null && e(C, st), T = u(kt, T, St), Ht === null ? rt = kt : Ht.sibling = kt, Ht = kt, st = Ft;
          }
          if (St === A.length)
            return a(C, st), yt && q(C, St), rt;
          if (st === null) {
            for (; St < A.length; St++)
              st = V(C, A[St], X), st !== null && (T = u(
                st,
                T,
                St
              ), Ht === null ? rt = st : Ht.sibling = st, Ht = st);
            return yt && q(C, St), rt;
          }
          for (st = l(st); St < A.length; St++)
            Ft = dt(
              st,
              C,
              St,
              A[St],
              X
            ), Ft !== null && (t && Ft.alternate !== null && st.delete(
              Ft.key === null ? St : Ft.key
            ), T = u(
              Ft,
              T,
              St
            ), Ht === null ? rt = Ft : Ht.sibling = Ft, Ht = Ft);
          return t && st.forEach(function(Ca) {
            return e(C, Ca);
          }), yt && q(C, St), rt;
        }
        function ul(C, T, A, X) {
          if (A == null) throw Error(s(151));
          for (var rt = null, Ht = null, st = T, St = T = 0, Ft = null, kt = A.next(); st !== null && !kt.done; St++, kt = A.next()) {
            st.index > St ? (Ft = st, st = null) : Ft = st.sibling;
            var Ca = L(C, st, kt.value, X);
            if (Ca === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Ca.alternate === null && e(C, st), T = u(Ca, T, St), Ht === null ? rt = Ca : Ht.sibling = Ca, Ht = Ca, st = Ft;
          }
          if (kt.done)
            return a(C, st), yt && q(C, St), rt;
          if (st === null) {
            for (; !kt.done; St++, kt = A.next())
              kt = V(C, kt.value, X), kt !== null && (T = u(
                kt,
                T,
                St
              ), Ht === null ? rt = kt : Ht.sibling = kt, Ht = kt);
            return yt && q(C, St), rt;
          }
          for (st = l(st); !kt.done; St++, kt = A.next())
            kt = dt(
              st,
              C,
              St,
              kt.value,
              X
            ), kt !== null && (t && kt.alternate !== null && st.delete(kt.key === null ? St : kt.key), T = u(kt, T, St), Ht === null ? rt = kt : Ht.sibling = kt, Ht = kt);
          return t && st.forEach(function(sh) {
            return e(C, sh);
          }), yt && q(C, St), rt;
        }
        function $a(C, T, A, X) {
          if (typeof A == "object" && A !== null && A.type === mn && A.key === null && (A = A.props.children), typeof A == "object" && A !== null) {
            switch (A.$$typeof) {
              case Xl:
                t: {
                  for (var rt = A.key; T !== null; ) {
                    if (T.key === rt) {
                      if (rt = A.type, rt === mn) {
                        if (T.tag === 7) {
                          a(
                            C,
                            T.sibling
                          ), X = r(
                            T,
                            A.props.children
                          ), X.return = C, C = X;
                          break t;
                        }
                      } else if (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === xa && Ua(rt) === T.type) {
                        a(
                          C,
                          T.sibling
                        ), X = r(T, A.props), Un(X, A), X.return = C, C = X;
                        break t;
                      }
                      a(C, T);
                      break;
                    } else e(C, T);
                    T = T.sibling;
                  }
                  A.type === mn ? (X = Ka(
                    A.props.children,
                    C.mode,
                    X,
                    A.key
                  ), X.return = C, C = X) : (X = Vl(
                    A.type,
                    A.key,
                    A.props,
                    null,
                    C.mode,
                    X
                  ), Un(X, A), X.return = C, C = X);
                }
                return f(C);
              case dn:
                t: {
                  for (rt = A.key; T !== null; ) {
                    if (T.key === rt)
                      if (T.tag === 4 && T.stateNode.containerInfo === A.containerInfo && T.stateNode.implementation === A.implementation) {
                        a(
                          C,
                          T.sibling
                        ), X = r(
                          T,
                          A.children || []
                        ), X.return = C, C = X;
                        break t;
                      } else {
                        a(C, T);
                        break;
                      }
                    else e(C, T);
                    T = T.sibling;
                  }
                  X = Yr(A, C.mode, X), X.return = C, C = X;
                }
                return f(C);
              case xa:
                return A = Ua(A), $a(
                  C,
                  T,
                  A,
                  X
                );
            }
            if (Zl(A))
              return ee(
                C,
                T,
                A,
                X
              );
            if (j(A)) {
              if (rt = j(A), typeof rt != "function")
                throw Error(s(150));
              return A = rt.call(A), ul(
                C,
                T,
                A,
                X
              );
            }
            if (typeof A.then == "function")
              return $a(
                C,
                T,
                wl(A),
                X
              );
            if (A.$$typeof === ya)
              return $a(
                C,
                T,
                bl(C, A),
                X
              );
            _l(C, A);
          }
          return typeof A == "string" && A !== "" || typeof A == "number" || typeof A == "bigint" ? (A = "" + A, T !== null && T.tag === 6 ? (a(C, T.sibling), X = r(T, A), X.return = C, C = X) : (a(C, T), X = qr(A, C.mode, X), X.return = C, C = X), f(C)) : a(C, T);
        }
        return function(C, T, A, X) {
          try {
            nl = 0;
            var rt = $a(
              C,
              T,
              A,
              X
            );
            return Sn = null, rt;
          } catch (st) {
            if (st === _n || st === ni) throw st;
            var Ht = o(29, st, null, C.mode);
            return Ht.lanes = X, Ht.return = C, Ht;
          } finally {
          }
        };
      }
      function Sl() {
        for (var t = kn, e = uo = kn = 0; e < t; ) {
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
          u !== 0 && bs(a, r, u);
        }
      }
      function kl(t, e, a, l) {
        Te[kn++] = t, Te[kn++] = e, Te[kn++] = a, Te[kn++] = l, uo |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Xi(t, e, a, l) {
        return kl(t, e, a, l), zl(t);
      }
      function Ba(t, e) {
        return kl(t, null, null, e), zl(t);
      }
      function bs(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, u = t.return; u !== null; )
          u.childLanes |= a, l = u.alternate, l !== null && (l.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - be(a), t = u.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), u) : null;
      }
      function zl(t) {
        if (50 < cl)
          throw cl = 0, So = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Zi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Ji(t, e) {
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
      function pa(t, e, a) {
        var l = t.updateQueue;
        if (l === null) return null;
        if (l = l.shared, (gt & 2) !== 0) {
          var r = l.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = zl(t), bs(t, null, a), e;
        }
        return kl(t, l, e, a), zl(t);
      }
      function Bn(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, H(t, a);
        }
      }
      function Li(t, e) {
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
      function qn() {
        if (mo) {
          var t = wn;
          if (t !== null) throw t;
        }
      }
      function Yn(t, e, a, l) {
        mo = !1;
        var r = t.updateQueue;
        ka = !1;
        var u = r.firstBaseUpdate, f = r.lastBaseUpdate, x = r.shared.pending;
        if (x !== null) {
          r.shared.pending = null;
          var O = x, K = O.next;
          O.next = null, f === null ? u = K : f.next = K, f = O;
          var J = t.alternate;
          J !== null && (J = J.updateQueue, x = J.lastBaseUpdate, x !== f && (x === null ? J.firstBaseUpdate = K : x.next = K, J.lastBaseUpdate = O));
        }
        if (u !== null) {
          var V = r.baseState;
          f = 0, J = K = O = null, x = u;
          do {
            var L = x.lane & -536870913, dt = L !== x.lane;
            if (dt ? (vt & L) === L : (l & L) === L) {
              L !== 0 && L === xn && (mo = !0), J !== null && (J = J.next = {
                lane: 0,
                tag: x.tag,
                payload: x.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, ul = x;
                L = e;
                var $a = a;
                switch (ul.tag) {
                  case 1:
                    if (ee = ul.payload, typeof ee == "function") {
                      V = ee.call(
                        $a,
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
                    if (ee = ul.payload, L = typeof ee == "function" ? ee.call($a, V, L) : ee, L == null) break t;
                    V = Kr({}, V, L);
                    break t;
                  case 2:
                    ka = !0;
                }
              }
              L = x.callback, L !== null && (t.flags |= 64, dt && (t.flags |= 8192), dt = r.callbacks, dt === null ? r.callbacks = [L] : dt.push(L));
            } else
              dt = {
                lane: L,
                tag: x.tag,
                payload: x.payload,
                callback: x.callback,
                next: null
              }, J === null ? (K = J = dt, O = V) : J = J.next = dt, f |= L;
            if (x = x.next, x === null) {
              if (x = r.shared.pending, x === null)
                break;
              dt = x, x = dt.next, dt.next = null, r.lastBaseUpdate = dt, r.shared.pending = null;
            }
          } while (!0);
          J === null && (O = V), r.baseState = O, r.firstBaseUpdate = K, r.lastBaseUpdate = J, u === null && (r.shared.lanes = 0), Ea |= f, t.lanes = f, t.memoizedState = V;
        }
      }
      function vs(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function ys(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            vs(a[t], e);
      }
      function xs(t, e) {
        t = ia, k(ii, t), k(zn, e), ia = t | e.baseLanes;
      }
      function Wi() {
        k(ii, ia), k(zn, zn.current);
      }
      function Fi() {
        ia = ii.current, b(zn), b(ii);
      }
      function ha(t) {
        var e = t.alternate;
        k(qt, qt.current & 1), k(xe, t), Ce === null && (e === null || zn.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Ii(t) {
        k(qt, qt.current), k(xe, t), Ce === null && (Ce = t);
      }
      function ws(t) {
        t.tag === 22 ? (k(qt, qt.current), k(xe, t), Ce === null && (Ce = t)) : ga();
      }
      function ga() {
        k(qt, qt.current), k(xe, xe.current);
      }
      function pe(t) {
        b(xe), Ce === t && (Ce = null), b(qt);
      }
      function El(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Ir(a) || $r(a)))
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
      function Dt() {
        throw Error(s(321));
      }
      function $i(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ye(t[a], e[a])) return !1;
        return !0;
      }
      function Pi(t, e, a, l, r, u) {
        return na = u, mt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, it.H = t === null || t.memoizedState === null ? Lu : fo, Fa = !1, u = a(l, r), Fa = !1, En && (u = Ss(
          e,
          a,
          l,
          r
        )), _s(t), u;
      }
      function _s(t) {
        it.H = il;
        var e = Ct !== null && Ct.next !== null;
        if (na = 0, Yt = Ct = mt = null, ri = !1, ll = 0, Nn = null, e) throw Error(s(300));
        t === null || Gt || (t = t.dependencies, t !== null && gl(t) && (Gt = !0));
      }
      function Ss(t, e, a, l) {
        mt = t;
        var r = 0;
        do {
          if (En && (Nn = null), ll = 0, En = !1, 25 <= r) throw Error(s(301));
          if (r += 1, Yt = Ct = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          it.H = Wu, u = e(a, l);
        } while (En);
        return u;
      }
      function Zm() {
        var t = it.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Gn(e) : e, t = t.useState()[0], (Ct !== null ? Ct.memoizedState : null) !== t && (mt.flags |= 1024), e;
      }
      function tr() {
        var t = oi !== 0;
        return oi = 0, t;
      }
      function er(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function ar(t) {
        if (ri) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ri = !1;
        }
        na = 0, Yt = Ct = mt = null, En = !1, ll = oi = 0, Nn = null;
      }
      function oe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Yt === null ? mt.memoizedState = Yt = t : Yt = Yt.next = t, Yt;
      }
      function Bt() {
        if (Ct === null) {
          var t = mt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Ct.next;
        var e = Yt === null ? mt.memoizedState : Yt.next;
        if (e !== null)
          Yt = e, Ct = t;
        else {
          if (t === null)
            throw mt.alternate === null ? Error(s(467)) : Error(s(310));
          Ct = t, t = {
            memoizedState: Ct.memoizedState,
            baseState: Ct.baseState,
            baseQueue: Ct.baseQueue,
            queue: Ct.queue,
            next: null
          }, Yt === null ? mt.memoizedState = Yt = t : Yt = Yt.next = t;
        }
        return Yt;
      }
      function Nl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Gn(t) {
        var e = ll;
        return ll += 1, Nn === null && (Nn = []), t = fs(Nn, t, e), e = mt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, it.H = e === null || e.memoizedState === null ? Lu : fo), t;
      }
      function Tl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Gn(t);
          if (t.$$typeof === ya) return It(t);
        }
        throw Error(s(438, String(t)));
      }
      function nr(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Nl(), mt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = vf;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Cl(t) {
        var e = Bt();
        return lr(e, Ct, t);
      }
      function lr(t, e, a) {
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
          var x = f = null, O = null, K = e, J = !1;
          do {
            var V = K.lane & -536870913;
            if (V !== K.lane ? (vt & V) === V : (na & V) === V) {
              var L = K.revertLane;
              if (L === 0)
                O !== null && (O = O.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: K.action,
                  hasEagerState: K.hasEagerState,
                  eagerState: K.eagerState,
                  next: null
                }), V === xn && (J = !0);
              else if ((na & L) === L) {
                K = K.next, L === xn && (J = !0);
                continue;
              } else
                V = {
                  lane: 0,
                  revertLane: K.revertLane,
                  gesture: null,
                  action: K.action,
                  hasEagerState: K.hasEagerState,
                  eagerState: K.eagerState,
                  next: null
                }, O === null ? (x = O = V, f = u) : O = O.next = V, mt.lanes |= L, Ea |= L;
              V = K.action, Fa && a(u, V), u = K.hasEagerState ? K.eagerState : a(u, V);
            } else
              L = {
                lane: V,
                revertLane: K.revertLane,
                gesture: K.gesture,
                action: K.action,
                hasEagerState: K.hasEagerState,
                eagerState: K.eagerState,
                next: null
              }, O === null ? (x = O = L, f = u) : O = O.next = L, mt.lanes |= V, Ea |= V;
            K = K.next;
          } while (K !== null && K !== e);
          if (O === null ? f = u : O.next = x, !ye(u, t.memoizedState) && (Gt = !0, J && (a = wn, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = f, t.baseQueue = O, l.lastRenderedState = u;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function ir(t) {
        var e = Bt(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, u = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var f = r = r.next;
          do
            u = t(u, f.action), f = f.next;
          while (f !== r);
          ye(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, l];
      }
      function ks(t, e, a) {
        var l = mt, r = Bt(), u = yt;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var f = !ye(
          (Ct || r).memoizedState,
          a
        );
        if (f && (r.memoizedState = a, Gt = !0), r = r.queue, sr(Ns.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || f || Yt !== null && Yt.memoizedState.tag & 1) {
          if (l.flags |= 2048, on(
            9,
            { destroy: void 0 },
            Es.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), Mt === null) throw Error(s(349));
          u || (na & 127) !== 0 || zs(l, e, a);
        }
        return a;
      }
      function zs(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = mt.updateQueue, e === null ? (e = Nl(), mt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function Es(t, e, a, l) {
        e.value = a, e.getSnapshot = l, Ts(e) && Cs(t);
      }
      function Ns(t, e, a) {
        return a(function() {
          Ts(e) && Cs(t);
        });
      }
      function Ts(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ye(t, a);
        } catch {
          return !0;
        }
      }
      function Cs(t) {
        var e = Ba(t, 2);
        e !== null && ce(e, t, 2);
      }
      function rr(t) {
        var e = oe();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Fa) {
            Et(!0);
            try {
              a();
            } finally {
              Et(!1);
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
      function js(t, e, a, l) {
        return t.baseState = a, lr(
          t,
          Ct,
          typeof l == "function" ? l : We
        );
      }
      function Jm(t, e, a, l, r) {
        if (Al(t)) throw Error(s(485));
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
          it.T !== null ? a(!0) : u.isTransition = !1, l(u), a = e.pending, a === null ? (u.next = e.pending = u, Ms(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function Ms(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var u = it.T, f = {};
          it.T = f;
          try {
            var x = a(r, l), O = it.S;
            O !== null && O(f, x), As(t, e, x);
          } catch (K) {
            or(t, e, K);
          } finally {
            u !== null && f.types !== null && (u.types = f.types), it.T = u;
          }
        } else
          try {
            u = a(r, l), As(t, e, u);
          } catch (K) {
            or(t, e, K);
          }
      }
      function As(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            Os(t, e, l);
          },
          function(l) {
            return or(t, e, l);
          }
        ) : Os(t, e, a);
      }
      function Os(t, e, a) {
        e.status = "fulfilled", e.value = a, Rs(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Ms(t, a)));
      }
      function or(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, Rs(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function Rs(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Hs(t, e) {
        return e;
      }
      function Ds(t, e) {
        if (yt) {
          var a = Mt.formState;
          if (a !== null) {
            t: {
              var l = mt;
              if (yt) {
                if (Ot) {
                  var r = dp(
                    Ot,
                    Ne
                  );
                  if (r) {
                    Ot = ju(r), l = mp(r);
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
        a = oe(), a.memoizedState = a.baseState = e, l = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Hs,
          lastRenderedState: e
        }, a.queue = l, a = tc.bind(
          null,
          mt,
          l
        ), l.dispatch = a, l = rr(!1);
        var u = mr.bind(
          null,
          mt,
          !1,
          l.queue
        );
        return l = oe(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = Jm.bind(
          null,
          mt,
          r,
          u,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function Us(t) {
        var e = Bt();
        return Bs(e, Ct, t);
      }
      function Bs(t, e, a) {
        if (e = lr(
          t,
          e,
          Hs
        )[0], t = Cl(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Gn(e);
          } catch (f) {
            throw f === _n ? ni : f;
          }
        else l = e;
        e = Bt();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (mt.flags |= 2048, on(
          9,
          { destroy: void 0 },
          Lm.bind(null, r, a),
          null
        )), [l, u, t];
      }
      function Lm(t, e) {
        t.action = e;
      }
      function qs(t) {
        var e = Bt(), a = Ct;
        if (a !== null)
          return Bs(e, a, t);
        Bt(), e = e.memoizedState, a = Bt();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function on(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = mt.updateQueue, e === null && (e = Nl(), mt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function Ys() {
        return Bt().memoizedState;
      }
      function jl(t, e, a, l) {
        var r = oe();
        mt.flags |= t, r.memoizedState = on(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function Ml(t, e, a, l) {
        var r = Bt();
        l = l === void 0 ? null : l;
        var u = r.memoizedState.inst;
        Ct !== null && l !== null && $i(l, Ct.memoizedState.deps) ? r.memoizedState = on(e, u, a, l) : (mt.flags |= t, r.memoizedState = on(
          1 | e,
          u,
          a,
          l
        ));
      }
      function Gs(t, e) {
        jl(8390656, 8, t, e);
      }
      function sr(t, e) {
        Ml(2048, 8, t, e);
      }
      function Wm(t) {
        mt.flags |= 4;
        var e = mt.updateQueue;
        if (e === null)
          e = Nl(), mt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Ks(t) {
        var e = Bt().memoizedState;
        return Wm({ ref: e, nextImpl: t }), function() {
          if ((gt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Qs(t, e) {
        return Ml(4, 2, t, e);
      }
      function Vs(t, e) {
        return Ml(4, 4, t, e);
      }
      function Xs(t, e) {
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
      function Zs(t, e, a) {
        a = a != null ? a.concat([t]) : null, Ml(
          4,
          4,
          Xs.bind(null, e, t),
          a
        );
      }
      function cr() {
      }
      function Js(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && $i(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Ls(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && $i(e, l[1]))
          return l[0];
        if (l = t(), Fa) {
          Et(!0);
          try {
            t();
          } finally {
            Et(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function ur(t, e, a) {
        return a === void 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Vc(), mt.lanes |= t, Ea |= t, a);
      }
      function Ws(t, e, a, l) {
        return ye(a, e) ? a : zn.current !== null ? (t = ur(t, a, l), ye(t, e) || (Gt = !0), t) : (na & 42) === 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = Vc(), mt.lanes |= t, Ea |= t, e);
      }
      function Fs(t, e, a, l, r) {
        var u = ea();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var f = it.T, x = {};
        it.T = x, mr(t, !1, e, a);
        try {
          var O = r(), K = it.S;
          if (K !== null && K(x, O), O !== null && typeof O == "object" && typeof O.then == "function") {
            var J = Xm(
              O,
              l
            );
            Kn(
              t,
              e,
              J,
              he(t)
            );
          } else
            Kn(
              t,
              e,
              l,
              he(t)
            );
        } catch (V) {
          Kn(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: V },
            he()
          );
        } finally {
          Lt(u), f !== null && x.types !== null && (f.types = x.types), it.T = f;
        }
      }
      function Is(t) {
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
      function dr() {
        return It(Va);
      }
      function $s() {
        return Bt().memoizedState;
      }
      function Ps() {
        return Bt().memoizedState;
      }
      function Fm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = he();
              t = fa(a);
              var l = pa(e, t, a);
              l !== null && (ce(l, e, a), Bn(l, e, a)), e = { cache: Ki() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Im(t, e, a) {
        var l = he();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t) ? ec(e, a) : (a = Xi(t, e, a, l), a !== null && (ce(a, t, l), ac(a, e, l)));
      }
      function tc(t, e, a) {
        var l = he();
        Kn(t, e, a, l);
      }
      function Kn(t, e, a, l) {
        var r = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Al(t)) ec(e, r);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var f = e.lastRenderedState, x = u(f, a);
              if (r.hasEagerState = !0, r.eagerState = x, ye(x, f))
                return kl(t, e, r, 0), Mt === null && Sl(), !1;
            } catch {
            } finally {
            }
          if (a = Xi(t, e, r, l), a !== null)
            return ce(a, t, l), ac(a, e, l), !0;
        }
        return !1;
      }
      function mr(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: Qi(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t)) {
          if (e) throw Error(s(479));
        } else
          e = Xi(
            t,
            a,
            l,
            2
          ), e !== null && ce(e, t, 2);
      }
      function Al(t) {
        var e = t.alternate;
        return t === mt || e !== null && e === mt;
      }
      function ec(t, e) {
        En = ri = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function ac(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, H(t, a);
        }
      }
      function fr(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : Kr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function nc(t, e, a, l, r, u, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, u, f) : e.prototype && e.prototype.isPureReactComponent ? !xl(a, l) || !xl(r, u) : !0;
      }
      function lc(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && po.enqueueReplaceState(e, e.state, null);
      }
      function qa(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Kr({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function Ol(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (l) {
          setTimeout(function() {
            throw l;
          });
        }
      }
      function ic(t, e, a) {
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
      function pr(t, e, a) {
        return a = fa(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Ol(t, e);
        }, a;
      }
      function rc(t) {
        return t = fa(t), t.tag = 3, t;
      }
      function oc(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = l.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            ic(e, a, l);
          };
        }
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          ic(e, a, l), typeof r != "function" && (Na === null ? Na = /* @__PURE__ */ new Set([this]) : Na.add(this));
          var x = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: x !== null ? x : ""
          });
        });
      }
      function $m(t, e, a, l, r) {
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
                return Ce === null ? Kl() : a.alternate === null && Ut === 0 && (Ut = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Ur(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Ur(t, l, r)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return Ur(t, l, r), Kl(), !1;
        }
        if (yt)
          return e = xe.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== io && (t = Error(s(422), { cause: l }), Hn(
            U(t, a)
          ))) : (l !== io && (e = Error(s(423), {
            cause: l
          }), Hn(
            U(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = U(l, a), r = pr(
            t.stateNode,
            l,
            r
          ), Li(t, r), Ut !== 4 && (Ut = 2)), !1;
        var u = Error(s(520), { cause: l });
        if (u = U(u, a), ol === null ? ol = [u] : ol.push(u), Ut !== 4 && (Ut = 2), e === null) return !0;
        l = U(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = pr(a.stateNode, l, t), Li(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Na === null || !Na.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = rc(r), oc(
                  r,
                  t,
                  a,
                  l
                ), Li(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, l) {
        e.child = t === null ? Ju(e, null, a, l) : Wa(
          e,
          t.child,
          a,
          l
        );
      }
      function sc(t, e, a, l, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in l) {
          var f = {};
          for (var x in l)
            x !== "ref" && (f[x] = l[x]);
        } else f = l;
        return Da(e), l = Pi(
          t,
          e,
          a,
          f,
          u,
          r
        ), x = tr(), t !== null && !Gt ? (er(t, e, r), Fe(t, e, r)) : (yt && x && G(e), e.flags |= 1, $t(t, e, l, r), e.child);
      }
      function cc(t, e, a, l, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !Br(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, uc(
            t,
            e,
            u,
            l,
            r
          )) : (t = Vl(
            a.type,
            null,
            l,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !wr(t, r)) {
          var f = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : xl, a(f, l) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(u, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function uc(t, e, a, l, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (xl(u, l) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = l = u, wr(t, r))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return hr(
          t,
          e,
          a,
          l,
          r
        );
      }
      function dc(t, e, a, l) {
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
            return mc(
              t,
              e,
              u,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && yl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? xs(e, u) : Wi(), ws(e);
          else
            return l = e.lanes = 536870912, mc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              l
            );
        } else
          u !== null ? (yl(e, u.cachePool), xs(e, u), ga(), e.memoizedState = null) : (t !== null && yl(e, null), Wi(), ga());
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
      function mc(t, e, a, l, r) {
        var u = Vi();
        return u = u === null ? null : {
          parent: ta ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && yl(e, null), Wi(), ws(e), t !== null && ln(t, e, l, !0), e.childLanes = r, null;
      }
      function Rl(t, e) {
        return e = Dl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function fc(t, e, a) {
        return Wa(e, t.child, null, a), t = Rl(
          e,
          e.pendingProps
        ), t.flags |= 2, pe(e), e.memoizedState = null, t;
      }
      function Pm(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (yt) {
            if (l.mode === "hidden")
              return t = Rl(e, l), e.lanes = 536870912, Qn(null, t);
            if (Ii(e), (t = Ot) ? (t = wp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = uu(t), a.return = e, e.child = a, te = e, Ot = null)) : t = null, t === null) throw ut(e);
            return e.lanes = 536870912, null;
          }
          return Rl(e, l);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var f = u.dehydrated;
          if (Ii(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = fc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Gt || ln(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Gt || r) {
            if (l = Mt, l !== null && (f = Z(l, a), f !== 0 && f !== u.retryLane))
              throw u.retryLane = f, Ba(t, f), ce(l, t, f), ho;
            Kl(), e = fc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, le && (Ot = gp(f), te = e, yt = !0, Sa = null, Ne = !1, t !== null && P(e, t)), e = Rl(e, l), e.flags |= 4096;
          return e;
        }
        return t = Pe(t.child, {
          mode: l.mode,
          children: l.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Hl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function hr(t, e, a, l, r) {
        return Da(e), a = Pi(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = tr(), t !== null && !Gt ? (er(t, e, r), Fe(t, e, r)) : (yt && l && G(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function pc(t, e, a, l, r, u) {
        return Da(e), e.updateQueue = null, a = Ss(
          e,
          l,
          a,
          r
        ), _s(t), l = tr(), t !== null && !Gt ? (er(t, e, u), Fe(t, e, u)) : (yt && l && G(e), e.flags |= 1, $t(t, e, a, u), e.child);
      }
      function hc(t, e, a, l, r) {
        if (Da(e), e.stateNode === null) {
          var u = gn, f = a.contextType;
          typeof f == "object" && f !== null && (u = It(f)), u = new a(l, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = po, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = l, u.state = e.memoizedState, u.refs = {}, Zi(e), f = a.contextType, u.context = typeof f == "object" && f !== null ? It(f) : gn, u.state = e.memoizedState, f = a.getDerivedStateFromProps, typeof f == "function" && (fr(
            e,
            a,
            f,
            l
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (f = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), f !== u.state && po.enqueueReplaceState(
            u,
            u.state,
            null
          ), Yn(e, l, u, r), qn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          u = e.stateNode;
          var x = e.memoizedProps, O = qa(a, x);
          u.props = O;
          var K = u.context, J = a.contextType;
          f = gn, typeof J == "object" && J !== null && (f = It(J));
          var V = a.getDerivedStateFromProps;
          J = typeof V == "function" || typeof u.getSnapshotBeforeUpdate == "function", x = e.pendingProps !== x, J || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (x || K !== f) && lc(
            e,
            u,
            l,
            f
          ), ka = !1;
          var L = e.memoizedState;
          u.state = L, Yn(e, l, u, r), qn(), K = e.memoizedState, x || L !== K || ka ? (typeof V == "function" && (fr(
            e,
            a,
            V,
            l
          ), K = e.memoizedState), (O = ka || nc(
            e,
            a,
            O,
            l,
            L,
            K,
            f
          )) ? (J || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = K), u.props = l, u.state = K, u.context = f, l = O) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          u = e.stateNode, Ji(t, e), f = e.memoizedProps, J = qa(a, f), u.props = J, V = e.pendingProps, L = u.context, K = a.contextType, O = gn, typeof K == "object" && K !== null && (O = It(K)), x = a.getDerivedStateFromProps, (K = typeof x == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (f !== V || L !== O) && lc(
            e,
            u,
            l,
            O
          ), ka = !1, L = e.memoizedState, u.state = L, Yn(e, l, u, r), qn();
          var dt = e.memoizedState;
          f !== V || L !== dt || ka || t !== null && t.dependencies !== null && gl(t.dependencies) ? (typeof x == "function" && (fr(
            e,
            a,
            x,
            l
          ), dt = e.memoizedState), (J = ka || nc(
            e,
            a,
            J,
            l,
            L,
            dt,
            O
          ) || t !== null && t.dependencies !== null && gl(t.dependencies)) ? (K || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(l, dt, O), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            l,
            dt,
            O
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = dt), u.props = l, u.state = dt, u.context = O, l = J) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return u = l, Hl(t, e), l = (e.flags & 128) !== 0, u || l ? (u = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && l ? (e.child = Wa(
          e,
          t.child,
          null,
          r
        ), e.child = Wa(
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
      function gc(t, e, a, l) {
        return Oe(), e.flags |= 256, $t(t, e, a, l), e.child;
      }
      function gr(t) {
        return { baseLanes: t, cachePool: ds() };
      }
      function br(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= _e), t;
      }
      function bc(t, e, a) {
        var l = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, f;
        if ((f = u) || (f = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (yt) {
            if (r ? ha(e) : ga(), (t = Ot) ? (t = _p(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = uu(t), a.return = e, e.child = a, te = e, Ot = null)) : t = null, t === null) throw ut(e);
            return $r(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var x = l.children;
          return l = l.fallback, r ? (ga(), r = e.mode, x = Dl(
            { mode: "hidden", children: x },
            r
          ), l = Ka(
            l,
            r,
            a,
            null
          ), x.return = e, l.return = e, x.sibling = l, e.child = x, l = e.child, l.memoizedState = gr(a), l.childLanes = br(
            t,
            f,
            a
          ), e.memoizedState = go, Qn(null, l)) : (ha(e), vr(e, x));
        }
        var O = t.memoizedState;
        if (O !== null && (x = O.dehydrated, x !== null)) {
          if (u)
            e.flags & 256 ? (ha(e), e.flags &= -257, e = yr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ga(), e.child = t.child, e.flags |= 128, e = null) : (ga(), x = l.fallback, r = e.mode, l = Dl(
              { mode: "visible", children: l.children },
              r
            ), x = Ka(
              x,
              r,
              a,
              null
            ), x.flags |= 2, l.return = e, x.return = e, l.sibling = x, e.child = l, Wa(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = gr(a), l.childLanes = br(
              t,
              f,
              a
            ), e.memoizedState = go, e = Qn(null, l));
          else if (ha(e), $r(x))
            f = cp(x).digest, l = Error(s(419)), l.stack = "", l.digest = f, Hn({ value: l, source: null, stack: null }), e = yr(
              t,
              e,
              a
            );
          else if (Gt || ln(
            t,
            e,
            a,
            !1
          ), f = (a & t.childLanes) !== 0, Gt || f) {
            if (f = Mt, f !== null && (l = Z(
              f,
              a
            ), l !== 0 && l !== O.retryLane))
              throw O.retryLane = l, Ba(t, l), ce(f, t, l), ho;
            Ir(x) || Kl(), e = yr(
              t,
              e,
              a
            );
          } else
            Ir(x) ? (e.flags |= 192, e.child = t.child, e = null) : (t = O.treeContext, le && (Ot = bp(
              x
            ), te = e, yt = !0, Sa = null, Ne = !1, t !== null && P(e, t)), e = vr(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ga(), x = l.fallback, r = e.mode, O = t.child, u = O.sibling, l = Pe(O, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = O.subtreeFlags & 65011712, u !== null ? x = Pe(
          u,
          x
        ) : (x = Ka(
          x,
          r,
          a,
          null
        ), x.flags |= 2), x.return = e, l.return = e, l.sibling = x, e.child = l, Qn(null, l), l = e.child, x = t.child.memoizedState, x === null ? x = gr(a) : (r = x.cachePool, r !== null ? (O = ta ? Rt._currentValue : Rt._currentValue2, r = r.parent !== O ? { parent: O, pool: O } : r) : r = ds(), x = {
          baseLanes: x.baseLanes | a,
          cachePool: r
        }), l.memoizedState = x, l.childLanes = br(
          t,
          f,
          a
        ), e.memoizedState = go, Qn(t.child, l)) : (ha(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function vr(t, e) {
        return e = Dl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Dl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function yr(t, e, a) {
        return Wa(e, t.child, null, a), t = vr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function vc(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), Yi(t.return, e, a);
      }
      function xr(t, e, a, l, r, u) {
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
      function yc(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, u = l.tail;
        l = l.children;
        var f = qt.current, x = (f & 2) !== 0;
        if (x ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, k(qt, f), $t(t, e, l, a), l = yt ? tl : 0, !x && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && vc(t, a, e);
            else if (t.tag === 19)
              vc(t, a, e);
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
              t = a.alternate, t !== null && El(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), xr(
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
              if (t = r.alternate, t !== null && El(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            xr(
              e,
              !0,
              a,
              null,
              u,
              l
            );
            break;
          case "together":
            xr(
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
        if (t !== null && (e.dependencies = t.dependencies), Ea |= e.lanes, (a & e.childLanes) === 0)
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
      function wr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && gl(t)));
      }
      function tf(t, e, a) {
        switch (e.tag) {
          case 3:
            tt(
              e,
              e.stateNode.containerInfo
            ), ma(e, Rt, t.memoizedState.cache), Oe();
            break;
          case 27:
          case 5:
            xt(e);
            break;
          case 4:
            tt(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            ma(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, Ii(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (ha(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? bc(
                t,
                e,
                a
              ) : (ha(e), t = Fe(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            ha(e);
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
                return yc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), k(qt, qt.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, dc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            ma(e, Rt, t.memoizedState.cache);
        }
        return Fe(t, e, a);
      }
      function xc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!wr(t, a) && (e.flags & 128) === 0)
              return Gt = !1, tf(
                t,
                e,
                a
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, yt && (e.flags & 1048576) !== 0 && v(e, tl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = Ua(e.elementType), e.type = t, typeof t == "function")
                Br(t) ? (l = qa(t, l), e.tag = 1, e = hc(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = hr(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Vr) {
                    e.tag = 11, e = sc(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Jr) {
                    e.tag = 14, e = cc(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  }
                }
                throw e = R(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return hr(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return l = e.type, r = qa(
              l,
              e.pendingProps
            ), hc(
              t,
              e,
              l,
              r,
              a
            );
          case 3:
            t: {
              if (tt(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              r = e.memoizedState, l = r.element, Ji(t, e), Yn(e, u, null, a);
              var f = e.memoizedState;
              if (u = f.cache, ma(e, Rt, u), u !== r.cache && Gi(
                e,
                [Rt],
                a,
                !0
              ), qn(), u = f.element, le && r.isDehydrated)
                if (r = {
                  element: u,
                  isDehydrated: !1,
                  cache: f.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = gc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== l) {
                  l = U(
                    Error(s(424)),
                    e
                  ), Hn(l), e = gc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (le && (Ot = hp(
                    e.stateNode.containerInfo
                  ), te = e, yt = !0, Sa = null, Ne = !0), a = Ju(
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
              return Hl(t, e), t === null ? (a = Ou(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : yt || (e.stateNode = Kp(
                e.type,
                e.pendingProps,
                _a.current,
                e
              )) : e.memoizedState = Ou(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return xt(e), t === null && Vt && yt && (l = e.stateNode = qu(
                e.type,
                e.pendingProps,
                _a.current,
                Pt.current,
                !1
              ), te = e, Ne = !0, Ot = vp(
                e.type,
                l,
                Ot
              )), $t(
                t,
                e,
                e.pendingProps.children,
                a
              ), Hl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && yt && (qp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = l = Ot) && (l = yp(
              l,
              e.type,
              e.pendingProps,
              Ne
            ), l !== null ? (e.stateNode = l, te = e, Ot = pp(l), Ne = !1, r = !0) : r = !1), r || ut(e)), xt(e), r = e.type, u = e.pendingProps, f = t !== null ? t.memoizedProps : null, l = u.children, Jl(r, u) ? l = null : f !== null && Jl(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = Pi(
              t,
              e,
              Zm,
              null,
              null,
              a
            ), ta ? Va._currentValue = r : Va._currentValue2 = r), Hl(t, e), $t(t, e, l, a), e.child;
          case 6:
            return t === null && yt && (Yp(
              e.pendingProps,
              Pt.current
            ), (t = a = Ot) && (a = xp(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, te = e, Ot = null, t = !0) : t = !1), t || ut(e)), null;
          case 13:
            return bc(t, e, a);
          case 4:
            return tt(
              e,
              e.stateNode.containerInfo
            ), l = e.pendingProps, t === null ? e.child = Wa(
              e,
              null,
              l,
              a
            ) : $t(t, e, l, a), e.child;
          case 11:
            return sc(
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
            return l = e.pendingProps, ma(e, e.type, l.value), $t(
              t,
              e,
              l.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, l = e.pendingProps.children, Da(e), r = It(r), l = l(r), e.flags |= 1, $t(t, e, l, a), e.child;
          case 14:
            return cc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return uc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return yc(
              t,
              e,
              a
            );
          case 31:
            return Pm(t, e, a);
          case 22:
            return dc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Da(e), l = It(Rt), t === null ? (r = Vi(), r === null && (r = Mt, u = Ki(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: l,
              cache: r
            }, Zi(e), ma(e, Rt, r)) : ((t.lanes & a) !== 0 && (Ji(t, e), Yn(e, null, null, a), qn()), r = t.memoizedState, u = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), ma(e, Rt, l)) : (l = u.cache, ma(e, Rt, l), l !== r.cache && Gi(
              e,
              [Rt],
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
      function Ul(t) {
        Qe && (t.flags |= 8);
      }
      function wc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function _r(t, e, a, l) {
        if (ne)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Wr(t, a.stateNode);
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
              var u = r.stateNode;
              a && l && (u = Tu(
                u,
                r.type,
                r.memoizedProps
              )), Wr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && l && (u = Cu(
                u,
                r.memoizedProps
              )), Wr(t, u);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                u = r.child, u !== null && (u.return = r), _r(t, r, !0, !0);
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
      function _c(t, e, a, l) {
        var r = !1;
        if (Qe)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var f = u.stateNode;
              a && l && (f = Tu(
                f,
                u.type,
                u.memoizedProps
              )), Eu(t, f);
            } else if (u.tag === 6)
              f = u.stateNode, a && l && (f = Cu(
                f,
                u.memoizedProps
              )), Eu(t, f);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), _c(t, u, !0, !0), r = !0;
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
      function Sc(t, e) {
        if (Qe && wc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = zu();
          _c(l, e, !1, !1), t.pendingChildren = l, Re(e), sp(a, l);
        }
      }
      function Sr(t, e, a, l) {
        if (ne)
          t.memoizedProps !== l && Re(e);
        else if (Qe) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = wc(t, e)) || u !== l) {
            var f = Pt.current;
            u = op(
              r,
              a,
              u,
              l,
              !t,
              null
            ), u === r ? e.stateNode = r : (Ul(e), xu(
              u,
              a,
              l,
              f
            ) && Re(e), e.stateNode = u, t && _r(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function kr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Rf(e, l) : Hf(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Fr(e, l))
            if (_u(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Wc()) t.flags |= 8192;
            else
              throw La = li, co;
        } else t.flags &= -16777217;
      }
      function kc(t, e) {
        if (Vp(e)) {
          if (t.flags |= 16777216, !Bu(e))
            if (Wc()) t.flags |= 8192;
            else
              throw La = li, co;
        } else t.flags &= -16777217;
      }
      function Bl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? Y() : 536870912, t.lanes |= e, jn |= e);
      }
      function Vn(t, e) {
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
      function At(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, l = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= l, t.childLanes = a, e;
      }
      function ef(t, e, a) {
        var l = e.pendingProps;
        switch (et(e), e.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return At(e), null;
          case 1:
            return At(e), null;
          case 3:
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Le(Rt), lt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ae(e) ? Re(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, da())), Sc(t, e), At(e), null;
          case 26:
            if (Ue) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (Re(e), u !== null ? (At(e), kc(
                e,
                u
              )) : (At(e), kr(
                e,
                r,
                null,
                l,
                a
              ))) : u ? u !== t.memoizedState ? (Re(e), At(e), kc(
                e,
                u
              )) : (At(e), e.flags &= -16777217) : (u = t.memoizedProps, ne ? u !== l && Re(e) : Sr(
                t,
                e,
                r,
                l
              ), At(e), kr(
                e,
                r,
                u,
                l,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Jt(e), a = _a.current, r = e.type, t !== null && e.stateNode != null)
                ne ? t.memoizedProps !== l && Re(e) : Sr(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return At(e), null;
                }
                t = Pt.current, Ae(e) ? Ra(e, t) : (t = qu(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Re(e));
              }
              return At(e), null;
            }
          case 5:
            if (Jt(e), r = e.type, t !== null && e.stateNode != null)
              Sr(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return At(e), null;
              }
              if (u = Pt.current, Ae(e))
                Ra(e, u), Op(
                  e.stateNode,
                  r,
                  l,
                  u
                ) && (e.flags |= 64);
              else {
                var f = Ef(
                  r,
                  l,
                  _a.current,
                  u,
                  e
                );
                Ul(e), _r(f, e, !1, !1), e.stateNode = f, xu(
                  f,
                  r,
                  l,
                  u
                ) && Re(e);
              }
            }
            return At(e), kr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ne ? a !== l && Re(e) : Qe && (a !== l ? (t = _a.current, a = Pt.current, Ul(e), e.stateNode = wu(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = _a.current, a = Pt.current, Ae(e)) {
                if (!le) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                kp(
                  t,
                  a,
                  e,
                  l
                ) || ut(e, !0);
              } else
                Ul(e), e.stateNode = wu(
                  l,
                  t,
                  a,
                  e
                );
            }
            return At(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = Ae(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(s(318));
                  if (!le) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  zp(t, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                At(e), t = !1;
              } else
                a = da(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return At(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ae(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!le) throw Error(s(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(s(317));
                  Ep(r, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                At(e), r = !1;
              } else
                r = da(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
            }
            return pe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), u = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), u !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Bl(e, e.updateQueue), At(e), null);
          case 4:
            return lt(), Sc(t, e), t === null && jf(e.stateNode.containerInfo), At(e), null;
          case 10:
            return Le(e.type), At(e), null;
          case 19:
            if (b(qt), l = e.memoizedState, l === null) return At(e), null;
            if (r = (e.flags & 128) !== 0, u = l.rendering, u === null)
              if (r) Vn(l, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = El(t), u !== null) {
                      for (e.flags |= 128, Vn(l, !1), t = u.updateQueue, e.updateQueue = t, Bl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        cu(a, t), a = a.sibling;
                      return k(
                        qt,
                        qt.current & 1 | 2
                      ), yt && q(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && ue() > sl && (e.flags |= 128, r = !0, Vn(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = El(u), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Bl(e, t), Vn(l, !0), l.tail === null && l.tailMode === "hidden" && !u.alternate && !yt)
                    return At(e), null;
                } else
                  2 * ue() - l.renderingStartTime > sl && a !== 536870912 && (e.flags |= 128, r = !0, Vn(l, !1), e.lanes = 4194304);
              l.isBackwards ? (u.sibling = e.child, e.child = u) : (t = l.last, t !== null ? t.sibling = u : e.child = u, l.last = u);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = ue(), t.sibling = null, a = qt.current, k(
              qt,
              r ? a & 1 | 2 : a & 1
            ), yt && q(e, l.treeForkCount), t) : (At(e), null);
          case 22:
          case 23:
            return pe(e), Fi(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (At(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : At(e), a = e.updateQueue, a !== null && Bl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && b(Ja), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(Rt), At(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function af(t, e) {
        switch (et(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Le(Rt), lt(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
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
            return b(qt), null;
          case 4:
            return lt(), null;
          case 10:
            return Le(e.type), null;
          case 22:
          case 23:
            return pe(e), Fi(), t !== null && b(Ja), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function zc(t, e) {
        switch (et(e), e.tag) {
          case 3:
            Le(Rt), lt();
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
            e.memoizedState !== null && pe(e);
            break;
          case 13:
            pe(e);
            break;
          case 19:
            b(qt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            pe(e), Fi(), t !== null && b(Ja);
            break;
          case 24:
            Le(Rt);
        }
      }
      function Xn(t, e) {
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
          _t(e, e.return, x);
        }
      }
      function ba(t, e, a) {
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
                  var O = a, K = x;
                  try {
                    K();
                  } catch (J) {
                    _t(
                      r,
                      O,
                      J
                    );
                  }
                }
              }
              l = l.next;
            } while (l !== u);
          }
        } catch (J) {
          _t(e, e.return, J);
        }
      }
      function Ec(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            ys(e, a);
          } catch (l) {
            _t(t, t.return, l);
          }
        }
      }
      function Nc(t, e, a) {
        a.props = qa(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (l) {
          _t(t, e, l);
        }
      }
      function Zn(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var l = Fn(t.stateNode);
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
          _t(t, e, r);
        }
      }
      function Ke(t, e) {
        var a = t.ref, l = t.refCleanup;
        if (a !== null)
          if (typeof l == "function")
            try {
              l();
            } catch (r) {
              _t(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (r) {
              _t(t, e, r);
            }
          else a.current = null;
      }
      function Tc(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          Ff(l, e, a, t);
        } catch (r) {
          _t(t, t.return, r);
        }
      }
      function zr(t, e, a) {
        try {
          If(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          _t(t, t.return, l);
        }
      }
      function Cc(t) {
        return t.tag === 5 || t.tag === 3 || (Ue ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && pn(t.type) : !1) || t.tag === 4;
      }
      function Er(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Cc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && pn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Nr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Pf(a, t, e) : Lf(a, t);
        else if (l !== 4 && (Vt && l === 27 && pn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Nr(t, e, a), t = t.sibling; t !== null; )
            Nr(t, e, a), t = t.sibling;
      }
      function ql(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? $f(a, t, e) : Jf(a, t);
        else if (l !== 4 && (Vt && l === 27 && pn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (ql(t, e, a), t = t.sibling; t !== null; )
            ql(t, e, a), t = t.sibling;
      }
      function jc(t, e, a) {
        t = t.containerInfo;
        try {
          Nu(t, a);
        } catch (l) {
          _t(e, e.return, l);
        }
      }
      function Mc(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Zp(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          _t(t, t.return, l);
        }
      }
      function nf(t, e) {
        for (kf(t.containerInfo), Wt = e; Wt !== null; )
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
                      var f = qa(
                        l.type,
                        r
                      );
                      e = u.getSnapshotBeforeUpdate(
                        f,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (x) {
                      _t(l, l.return, x);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ne && rp(t.stateNode.containerInfo);
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
      function Ac(t, e, a) {
        var l = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Ie(t, a), l & 4 && Xn(5, a);
            break;
          case 1:
            if (Ie(t, a), l & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (f) {
                  _t(a, a.return, f);
                }
              else {
                var r = qa(
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
                  _t(
                    a,
                    a.return,
                    f
                  );
                }
              }
            l & 64 && Ec(a), l & 512 && Zn(a, a.return);
            break;
          case 3:
            if (Ie(t, a), l & 64 && (l = a.updateQueue, l !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Fn(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                ys(l, t);
              } catch (f) {
                _t(a, a.return, f);
              }
            }
            break;
          case 27:
            Vt && e === null && l & 4 && Mc(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (l & 4) Tc(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  Cp(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (f) {
                  _t(a, a.return, f);
                }
              }
            }
            l & 512 && Zn(a, a.return);
            break;
          case 12:
            Ie(t, a);
            break;
          case 31:
            Ie(t, a), l & 4 && Rc(t, a);
            break;
          case 13:
            Ie(t, a), l & 4 && Hc(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = df.bind(
              null,
              a
            ), up(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || la, !l) {
              e = e !== null && e.memoizedState !== null || Kt, r = la;
              var u = Kt;
              la = l, (Kt = e) && !u ? $e(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Ie(t, a), la = r, Kt = u;
            }
            break;
          case 30:
            break;
          default:
            Ie(t, a);
        }
      }
      function Oc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Oc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Of(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, a) {
        for (a = a.child; a !== null; )
          Tr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Tr(t, e, a) {
        if (ve && typeof ve.onCommitFiberUnmount == "function")
          try {
            ve.onCommitFiberUnmount(Pn, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ue) {
              Kt || Ke(a, e), He(
                t,
                e,
                a
              ), a.memoizedState ? Hu(a.memoizedState) : a.stateNode && Uu(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Ke(a, e);
              var l = Qt, r = de;
              pn(a.type) && (Qt = a.stateNode, de = !1), He(
                t,
                e,
                a
              ), Yu(a.stateNode), Qt = l, de = r;
              break;
            }
          case 5:
            Kt || Ke(a, e);
          case 6:
            if (ne) {
              if (l = Qt, r = de, Qt = null, He(
                t,
                e,
                a
              ), Qt = l, de = r, Qt !== null)
                if (de)
                  try {
                    ep(Qt, a.stateNode);
                  } catch (u) {
                    _t(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    tp(Qt, a.stateNode);
                  } catch (u) {
                    _t(
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
            ne && Qt !== null && (de ? Dp(
              Qt,
              a.stateNode
            ) : Hp(Qt, a.stateNode));
            break;
          case 4:
            ne ? (l = Qt, r = de, Qt = a.stateNode.containerInfo, de = !0, He(
              t,
              e,
              a
            ), Qt = l, de = r) : (Qe && jc(
              a.stateNode,
              a,
              zu()
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
            ba(2, a, e), Kt || ba(4, a, e), He(
              t,
              e,
              a
            );
            break;
          case 1:
            Kt || (Ke(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && Nc(
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
            Kt = (l = Kt) || a.memoizedState !== null, He(
              t,
              e,
              a
            ), Kt = l;
            break;
          default:
            He(
              t,
              e,
              a
            );
        }
      }
      function Rc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Mp(t);
          } catch (a) {
            _t(e, e.return, a);
          }
        }
      }
      function Hc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Ap(t);
          } catch (a) {
            _t(e, e.return, a);
          }
      }
      function lf(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Fu()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Fu()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function Yl(t, e) {
        var a = lf(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = mf.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ae(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], u = t, f = e;
            if (ne) {
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
              Tr(u, f, r), Qt = null, de = !1;
            } else Tr(u, f, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Dc(e, t), e = e.sibling;
      }
      function Dc(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ae(e, t), se(t), l & 4 && (ba(3, t, t.return), Xn(3, t), ba(5, t, t.return));
            break;
          case 1:
            ae(e, t), se(t), l & 512 && (Kt || a === null || Ke(a, a.return)), l & 64 && la && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (Ue) {
              var r = Be;
              if (ae(e, t), se(t), l & 512 && (Kt || a === null || Ke(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Gp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Du(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Ru(
                  r,
                  u,
                  t.memoizedProps
                ) : l !== u ? (l === null ? a.stateNode !== null && Uu(a.stateNode) : Hu(l), u === null ? Du(
                  r,
                  t.type,
                  t.stateNode
                ) : Ru(
                  r,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && zr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ae(e, t), se(t), l & 512 && (Kt || a === null || Ke(a, a.return)), a !== null && l & 4 && zr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ae(e, t), se(t), l & 512 && (Kt || a === null || Ke(a, a.return)), ne) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  ku(r);
                } catch (V) {
                  _t(t, t.return, V);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, zr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (bo = !0);
            } else
              Qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ae(e, t), se(t), l & 4 && ne) {
              if (t.stateNode === null)
                throw Error(s(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                Wf(r, a, l);
              } catch (V) {
                _t(t, t.return, V);
              }
            }
            break;
          case 3:
            if (Ue ? (Qp(), r = Be, Be = Pr(e.containerInfo), ae(e, t), Be = r) : ae(e, t), se(t), l & 4) {
              if (ne && le && a !== null && a.memoizedState.isDehydrated)
                try {
                  jp(e.containerInfo);
                } catch (V) {
                  _t(t, t.return, V);
                }
              if (Qe) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  Nu(l, a);
                } catch (V) {
                  _t(t, t.return, V);
                }
              }
            }
            bo && (bo = !1, Uc(t));
            break;
          case 4:
            Ue ? (a = Be, Be = Pr(
              t.stateNode.containerInfo
            ), ae(e, t), se(t), Be = a) : (ae(e, t), se(t)), l & 4 && Qe && jc(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ae(e, t), se(t);
            break;
          case 31:
            ae(e, t), se(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Yl(t, l)));
            break;
          case 13:
            ae(e, t), se(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (fi = ue()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Yl(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = a !== null && a.memoizedState !== null, x = la, O = Kt;
            if (la = x || r, Kt = O || f, ae(e, t), Kt = O, la = x, se(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || f || la || Kt || Ya(t)), ne)) {
              t: if (a = null, ne)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ue && e.tag === 26) {
                    if (a === null) {
                      f = a = e;
                      try {
                        u = f.stateNode, r ? ap(u) : lp(
                          f.stateNode,
                          f.memoizedProps
                        );
                      } catch (V) {
                        _t(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      f = e;
                      try {
                        var K = f.stateNode;
                        r ? np(K) : ip(K, f.memoizedProps);
                      } catch (V) {
                        _t(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      f = e;
                      try {
                        var J = f.stateNode;
                        r ? Up(J) : Bp(f.stateNode);
                      } catch (V) {
                        _t(f, f.return, V);
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
            l & 4 && (l = t.updateQueue, l !== null && (a = l.retryQueue, a !== null && (l.retryQueue = null, Yl(t, a))));
            break;
          case 19:
            ae(e, t), se(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Yl(t, l)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            ae(e, t), se(t);
        }
      }
      function se(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, l = t.return; l !== null; ) {
              if (Cc(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (ne) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, u = Er(t);
                    ql(t, u, r);
                    break;
                  }
                case 5:
                  var f = a.stateNode;
                  a.flags & 32 && (ku(f), a.flags &= -33);
                  var x = Er(t);
                  ql(t, x, f);
                  break;
                case 3:
                case 4:
                  var O = a.stateNode.containerInfo, K = Er(t);
                  Nr(
                    t,
                    K,
                    O
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (J) {
            _t(t, t.return, J);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Uc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Uc(e), e.tag === 5 && e.flags & 1024 && Bf(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Ac(t, e.alternate, e), e = e.sibling;
      }
      function Ya(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ba(4, e, e.return), Ya(e);
              break;
            case 1:
              Ke(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && Nc(
                e,
                e.return,
                a
              ), Ya(e);
              break;
            case 27:
              Vt && Yu(e.stateNode);
            case 26:
            case 5:
              Ke(e, e.return), Ya(e);
              break;
            case 22:
              e.memoizedState === null && Ya(e);
              break;
            case 30:
              Ya(e);
              break;
            default:
              Ya(e);
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
              ), Xn(4, u);
              break;
            case 1:
              if ($e(
                r,
                u,
                a
              ), l = u, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (K) {
                  _t(l, l.return, K);
                }
              if (l = u, r = l.updateQueue, r !== null) {
                var x = l.stateNode;
                try {
                  var O = r.shared.hiddenCallbacks;
                  if (O !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < O.length; r++)
                      vs(O[r], x);
                } catch (K) {
                  _t(l, l.return, K);
                }
              }
              a && f & 64 && Ec(u), Zn(u, u.return);
              break;
            case 27:
              Vt && Mc(u);
            case 26:
            case 5:
              $e(
                r,
                u,
                a
              ), a && l === null && f & 4 && Tc(u), Zn(u, u.return);
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
              ), a && f & 4 && Rc(r, u);
              break;
            case 13:
              $e(
                r,
                u,
                a
              ), a && f & 4 && Hc(r, u);
              break;
            case 22:
              u.memoizedState === null && $e(
                r,
                u,
                a
              ), Zn(u, u.return);
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
      function Cr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Dn(a));
      }
      function jr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Dn(t));
      }
      function De(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Bc(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function Bc(t, e, a, l) {
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
            ), r & 2048 && Xn(9, e);
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
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Dn(t)));
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
              } catch (O) {
                _t(e, e.return, O);
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
            ) : Jn(
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
            )), r & 2048 && Cr(f, e);
            break;
          case 24:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && jr(e.alternate, e);
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
          var u = t, f = e, x = a, O = l, K = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              sn(
                u,
                f,
                x,
                O,
                r
              ), Xn(8, f);
              break;
            case 23:
              break;
            case 22:
              var J = f.stateNode;
              f.memoizedState !== null ? J._visibility & 2 ? sn(
                u,
                f,
                x,
                O,
                r
              ) : Jn(
                u,
                f
              ) : (J._visibility |= 2, sn(
                u,
                f,
                x,
                O,
                r
              )), r && K & 2048 && Cr(
                f.alternate,
                f
              );
              break;
            case 24:
              sn(
                u,
                f,
                x,
                O,
                r
              ), r && K & 2048 && jr(f.alternate, f);
              break;
            default:
              sn(
                u,
                f,
                x,
                O,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Jn(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, l = e, r = l.flags;
            switch (l.tag) {
              case 22:
                Jn(a, l), r & 2048 && Cr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Jn(a, l), r & 2048 && jr(
                  l.alternate,
                  l
                );
                break;
              default:
                Jn(a, l);
            }
            e = e.sibling;
          }
      }
      function Ga(t, e, a) {
        if (t.subtreeFlags & Tn)
          for (t = t.child; t !== null; )
            qc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function qc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ga(
              t,
              e,
              a
            ), t.flags & Tn)
              if (t.memoizedState !== null)
                Xp(
                  a,
                  Be,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Fr(r, t)) && Su(a, l, r, t);
              }
            break;
          case 5:
            Ga(
              t,
              e,
              a
            ), t.flags & Tn && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Fr(r, t)) && Su(a, l, r, t));
            break;
          case 3:
          case 4:
            Ue ? (l = Be, Be = Pr(
              t.stateNode.containerInfo
            ), Ga(
              t,
              e,
              a
            ), Be = l) : Ga(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = Tn, Tn = 16777216, Ga(
              t,
              e,
              a
            ), Tn = l) : Ga(
              t,
              e,
              a
            ));
            break;
          default:
            Ga(
              t,
              e,
              a
            );
        }
      }
      function Yc(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Ln(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Wt = l, Kc(
                l,
                t
              );
            }
          Yc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Gc(t), t = t.sibling;
      }
      function Gc(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Ln(t), t.flags & 2048 && ba(9, t, t.return);
            break;
          case 3:
            Ln(t);
            break;
          case 12:
            Ln(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Gl(t)) : Ln(t);
            break;
          default:
            Ln(t);
        }
      }
      function Gl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Wt = l, Kc(
                l,
                t
              );
            }
          Yc(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ba(8, e, e.return), Gl(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Gl(e));
              break;
            default:
              Gl(e);
          }
          t = t.sibling;
        }
      }
      function Kc(t, e) {
        for (; Wt !== null; ) {
          var a = Wt;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              ba(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var l = a.memoizedState.cachePool.pool;
                l != null && l.refCount++;
              }
              break;
            case 24:
              Dn(a.memoizedState.cache);
          }
          if (l = a.child, l !== null) l.return = a, Wt = l;
          else
            t: for (a = t; Wt !== null; ) {
              l = Wt;
              var r = l.sibling, u = l.return;
              if (Oc(l), l === a) {
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
      function Mr(t) {
        var e = Cf(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Gf(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function Ar(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case si:
            if (t.type === e.value) return !0;
            break;
          case ci:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, u = t[a++], f = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !$n(l)) {
                  for (; f != null && Ar(l, f); )
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
          case ui:
            if ((a === 5 || a === 26 || a === 27) && Vf(t.stateNode, e.value))
              return !0;
            break;
          case mi:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Qf(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case di:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function Or(t) {
        switch (t.$$typeof) {
          case si:
            return "<" + (R(t.value) || "Unknown") + ">";
          case ci:
            return ":has(" + (Or(t) || "") + ")";
          case ui:
            return '[role="' + t.value + '"]';
          case mi:
            return '"' + t.value + '"';
          case di:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function Qc(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], u = r.tag, f = t[l++], x = e[f];
          if (u !== 5 && u !== 26 && u !== 27 || !$n(r)) {
            for (; x != null && Ar(r, x); )
              f++, x = e[f];
            if (f === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return a;
      }
      function Rr(t, e) {
        if (!In) throw Error(s(363));
        t = Mr(t), t = Qc(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var l = t[a++], r = l.tag;
          if (r === 5 || r === 26 || r === 27)
            $n(l) || e.push(l.stateNode);
          else
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
        }
        return e;
      }
      function he() {
        return (gt & 2) !== 0 && vt !== 0 ? vt & -vt : it.T !== null ? Qi() : Mf();
      }
      function Vc() {
        if (_e === 0)
          if ((vt & 536870912) === 0 || yt) {
            var t = Wl;
            Wl <<= 1, (Wl & 3932160) === 0 && (Wl = 262144), _e = t;
          } else _e = 536870912;
        return t = xe.current, t !== null && (t.flags |= 32), _e;
      }
      function ce(t, e, a) {
        (t === Mt && (Tt === 2 || Tt === 9) || t.cancelPendingCommit !== null) && (cn(t, 0), va(
          t,
          vt,
          _e,
          !1
        )), w(t, a), ((gt & 2) === 0 || t !== Mt) && (t === Mt && ((gt & 2) === 0 && (Ia |= a), Ut === 4 && va(
          t,
          vt,
          _e,
          !1
        )), Ge(t));
      }
      function Xc(t, e, a) {
        if ((gt & 6) !== 0) throw Error(s(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || N(t, e), r = l ? sf(t, e) : Dr(t, e, !0), u = l;
        do {
          if (r === 0) {
            Cn && !l && va(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !rf(a)) {
              r = Dr(t, e, !1), u = !1;
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
                  r = ol;
                  var O = le && x.current.memoizedState.isDehydrated;
                  if (O && (cn(x, f).flags |= 256), f = Dr(
                    x,
                    f,
                    !1
                  ), f !== 2) {
                    if (vo && !O) {
                      x.errorRecoveryDisabledLanes |= u, Ia |= u, r = 4;
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
              cn(t, 0), va(t, e, 0, !0);
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
                  va(
                    l,
                    e,
                    _e,
                    !za
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
              if ((e & 62914560) === e && (r = fi + 300 - ue(), 10 < r)) {
                if (va(
                  l,
                  e,
                  _e,
                  !za
                ), B(l, 0, !0) !== 0) break t;
                ra = e, l.timeoutHandle = Nf(
                  Zc.bind(
                    null,
                    l,
                    a,
                    me,
                    pi,
                    xo,
                    e,
                    _e,
                    Ia,
                    jn,
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
              Zc(
                l,
                a,
                me,
                pi,
                xo,
                e,
                _e,
                Ia,
                jn,
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
      function Zc(t, e, a, l, r, u, f, x, O, K, J, V, L, dt) {
        if (t.timeoutHandle = Qa, V = e.subtreeFlags, V & 8192 || (V & 16785408) === 16785408) {
          V = Df(), qc(
            e,
            u,
            V
          );
          var ee = (u & 62914560) === u ? fi - ue() : (u & 4194048) === u ? Iu - ue() : 0;
          if (ee = Uf(
            V,
            ee
          ), ee !== null) {
            ra = u, t.cancelPendingCommit = ee(
              eu.bind(
                null,
                t,
                e,
                u,
                a,
                l,
                r,
                f,
                x,
                O,
                J,
                V,
                null,
                L,
                dt
              )
            ), va(t, u, f, !K);
            return;
          }
        }
        eu(
          t,
          e,
          u,
          a,
          l,
          r,
          f,
          x,
          O
        );
      }
      function rf(t) {
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
      function va(t, e, a, l) {
        e &= ~yo, e &= ~Ia, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - be(r), f = 1 << u;
          l[u] = -1, r &= ~f;
        }
        a !== 0 && h(t, a, e);
      }
      function Jc() {
        return (gt & 6) === 0 ? (rn(0), !1) : !0;
      }
      function Hr() {
        if (bt !== null) {
          if (Tt === 0)
            var t = bt.return;
          else
            t = bt, aa = Xa = null, ar(t), Sn = null, nl = 0, t = bt;
          for (; t !== null; )
            zc(t.alternate, t), t = t.return;
          bt = null;
        }
      }
      function cn(t, e) {
        var a = t.timeoutHandle;
        a !== Qa && (t.timeoutHandle = Qa, Tf(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, Hr(), Mt = t, bt = a = Pe(t.current, null), vt = e, Tt = 0, we = null, za = !1, Cn = N(t, e), vo = !1, jn = _e = yo = Ia = Ea = Ut = 0, me = ol = null, xo = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - be(l), u = 1 << r;
            e |= t[r], l &= ~u;
          }
        return ia = e, Sl(), a;
      }
      function Lc(t, e) {
        mt = null, it.H = il, e === _n || e === ni ? (e = ps(), Tt = 3) : e === co ? (e = ps(), Tt = 4) : Tt = e === ho ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, we = e, bt === null && (Ut = 1, Ol(
          t,
          U(e, t.current)
        ));
      }
      function Wc() {
        var t = xe.current;
        return t === null ? !0 : (vt & 4194048) === vt ? Ce === null : (vt & 62914560) === vt || (vt & 536870912) !== 0 ? t === Ce : !1;
      }
      function Fc() {
        var t = it.H;
        return it.H = il, t === null ? il : t;
      }
      function Ic() {
        var t = it.A;
        return it.A = rh, t;
      }
      function Kl() {
        Ut = 4, za || (vt & 4194048) !== vt && xe.current !== null || (Cn = !0), (Ea & 134217727) === 0 && (Ia & 134217727) === 0 || Mt === null || va(
          Mt,
          vt,
          _e,
          !1
        );
      }
      function Dr(t, e, a) {
        var l = gt;
        gt |= 2;
        var r = Fc(), u = Ic();
        (Mt !== t || vt !== e) && (pi = null, cn(t, e)), e = !1;
        var f = Ut;
        t: do
          try {
            if (Tt !== 0 && bt !== null) {
              var x = bt, O = we;
              switch (Tt) {
                case 8:
                  Hr(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  xe.current === null && (e = !0);
                  var K = Tt;
                  if (Tt = 0, we = null, un(t, x, O, K), a && Cn) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  K = Tt, Tt = 0, we = null, un(t, x, O, K);
              }
            }
            of(), f = Ut;
            break;
          } catch (J) {
            Lc(t, J);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Xa = null, gt = l, it.H = r, it.A = u, bt === null && (Mt = null, vt = 0, Sl()), f;
      }
      function of() {
        for (; bt !== null; ) $c(bt);
      }
      function sf(t, e) {
        var a = gt;
        gt |= 2;
        var l = Fc(), r = Ic();
        Mt !== t || vt !== e ? (pi = null, sl = ue() + 500, cn(t, e)) : Cn = N(
          t,
          e
        );
        t: do
          try {
            if (Tt !== 0 && bt !== null) {
              e = bt;
              var u = we;
              e: switch (Tt) {
                case 1:
                  Tt = 0, we = null, un(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (ms(u)) {
                    Tt = 0, we = null, Pc(e);
                    break;
                  }
                  e = function() {
                    Tt !== 2 && Tt !== 9 || Mt !== t || (Tt = 7), Ge(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Tt = 7;
                  break t;
                case 4:
                  Tt = 5;
                  break t;
                case 7:
                  ms(u) ? (Tt = 0, we = null, Pc(e)) : (Tt = 0, we = null, un(t, e, u, 7));
                  break;
                case 5:
                  var f = null;
                  switch (bt.tag) {
                    case 26:
                      f = bt.memoizedState;
                    case 5:
                    case 27:
                      var x = bt, O = x.type, K = x.pendingProps;
                      if (f ? Bu(f) : _u(x.stateNode, O, K)) {
                        Tt = 0, we = null;
                        var J = x.sibling;
                        if (J !== null) bt = J;
                        else {
                          var V = x.return;
                          V !== null ? (bt = V, Ql(V)) : bt = null;
                        }
                        break e;
                      }
                  }
                  Tt = 0, we = null, un(t, e, u, 5);
                  break;
                case 6:
                  Tt = 0, we = null, un(t, e, u, 6);
                  break;
                case 8:
                  Hr(), Ut = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            cf();
            break;
          } catch (L) {
            Lc(t, L);
          }
        while (!0);
        return aa = Xa = null, it.H = l, it.A = r, gt = a, bt !== null ? 0 : (Mt = null, vt = 0, Sl(), Ut);
      }
      function cf() {
        for (; bt !== null && !Wp(); )
          $c(bt);
      }
      function $c(t) {
        var e = xc(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function Pc(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = pc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              vt
            );
            break;
          case 11:
            e = pc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              vt
            );
            break;
          case 5:
            ar(e);
          default:
            zc(a, e), e = bt = cu(e, ia), e = xc(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function un(t, e, a, l) {
        aa = Xa = null, ar(e), Sn = null, nl = 0;
        var r = e.return;
        try {
          if ($m(
            t,
            r,
            e,
            a,
            vt
          )) {
            Ut = 1, Ol(
              t,
              U(a, t.current)
            ), bt = null;
            return;
          }
        } catch (u) {
          if (r !== null) throw bt = r, u;
          Ut = 1, Ol(
            t,
            U(a, t.current)
          ), bt = null;
          return;
        }
        e.flags & 32768 ? (yt || l === 1 ? t = !0 : Cn || (vt & 536870912) !== 0 ? t = !1 : (za = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = xe.current, l !== null && l.tag === 13 && (l.flags |= 16384))), tu(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            tu(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = ef(
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
        Ut === 0 && (Ut = 5);
      }
      function tu(t, e) {
        do {
          var a = af(t.alternate, t);
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
        Ut = 6, bt = null;
      }
      function eu(t, e, a, l, r, u, f, x, O) {
        t.cancelPendingCommit = null;
        do
          Wn();
        while (Xt !== 0);
        if ((gt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= uo, g(
            t,
            a,
            u,
            f,
            x,
            O
          ), t === Mt && (bt = Mt = null, vt = 0), Mn = e, Ta = t, ra = a, wo = u, _o = r, $u = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, ff(ao, function() {
            return ru(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = it.T, it.T = null, r = ea(), Lt(2), f = gt, gt |= 4;
            try {
              nf(t, e, a);
            } finally {
              gt = f, Lt(r), it.T = l;
            }
          }
          Xt = 1, au(), nu(), lu();
        }
      }
      function au() {
        if (Xt === 1) {
          Xt = 0;
          var t = Ta, e = Mn, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = it.T, it.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Dc(e, t), zf(t.containerInfo);
            } finally {
              gt = r, Lt(l), it.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function nu() {
        if (Xt === 2) {
          Xt = 0;
          var t = Ta, e = Mn, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = it.T, it.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Ac(t, e.alternate, e);
            } finally {
              gt = r, Lt(l), it.T = a;
            }
          }
          Xt = 3;
        }
      }
      function lu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Fp();
          var t = Ta, e = Mn, a = ra, l = $u;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, Mn = Ta = null, iu(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Na = null), $(a), e = e.stateNode, ve && typeof ve.onCommitFiberRoot == "function")
            try {
              ve.onCommitFiberRoot(
                Pn,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (l !== null) {
            e = it.T, r = ea(), Lt(2), it.T = null;
            try {
              for (var u = t.onRecoverableError, f = 0; f < l.length; f++) {
                var x = l[f];
                u(x.value, {
                  componentStack: x.stack
                });
              }
            } finally {
              it.T = e, Lt(r);
            }
          }
          (ra & 3) !== 0 && Wn(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === So ? cl++ : (cl = 0, So = t) : cl = 0, le && Rp(), rn(0);
        }
      }
      function iu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Dn(e)));
      }
      function Wn() {
        return au(), nu(), lu(), ru();
      }
      function ru() {
        if (Xt !== 5) return !1;
        var t = Ta, e = wo;
        wo = 0;
        var a = $(ra), l = 32 > a ? 32 : a;
        a = it.T;
        var r = ea();
        try {
          Lt(l), it.T = null, l = _o, _o = null;
          var u = Ta, f = ra;
          if (Xt = 0, Mn = Ta = null, ra = 0, (gt & 6) !== 0)
            throw Error(s(331));
          var x = gt;
          if (gt |= 4, Gc(u.current), Bc(
            u,
            u.current,
            f,
            l
          ), gt = x, rn(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot(Pn, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), it.T = a, iu(t, e);
        }
      }
      function ou(t, e, a) {
        e = U(a, e), e = pr(t.stateNode, e, 2), t = pa(t, e, 2), t !== null && (w(t, 2), Ge(t));
      }
      function _t(t, e, a) {
        if (t.tag === 3)
          ou(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              ou(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Na === null || !Na.has(l))) {
                t = U(a, t), a = rc(2), l = pa(e, a, 2), l !== null && (oc(
                  a,
                  l,
                  e,
                  t
                ), w(l, 2), Ge(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function Ur(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new oh();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (vo = !0, r.add(a), t = uf.bind(null, t, e, a), e.then(t, t));
      }
      function uf(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Mt === t && (vt & a) === a && (Ut === 4 || Ut === 3 && (vt & 62914560) === vt && 300 > ue() - fi ? (gt & 2) === 0 && cn(t, 0) : yo |= a, jn === vt && (jn = 0)), Ge(t);
      }
      function su(t, e) {
        e === 0 && (e = Y()), t = Ba(t, e), t !== null && (w(t, e), Ge(t));
      }
      function df(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), su(t, a);
      }
      function mf(t, e) {
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
        l !== null && l.delete(e), su(t, a);
      }
      function ff(t, e) {
        return Il(t, e);
      }
      function pf(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Br(t) {
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
      function cu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Vl(t, e, a, l, r, u) {
        var f = 0;
        if (l = t, typeof t == "function") Br(t) && (f = 1);
        else if (typeof t == "string")
          f = Ue && Vt ? Au(t, a, Pt.current) ? 26 : Gu(t) ? 27 : 5 : Ue ? Au(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Gu(t) ? 27 : 5;
        else
          t: switch (t) {
            case Lr:
              return t = o(31, a, e, r), t.elementType = Lr, t.lanes = u, t;
            case mn:
              return Ka(
                a.children,
                r,
                u,
                e
              );
            case gu:
              f = 8, r |= 24;
              break;
            case Qr:
              return t = o(12, a, e, r | 2), t.elementType = Qr, t.lanes = u, t;
            case Xr:
              return t = o(13, a, e, r), t.elementType = Xr, t.lanes = u, t;
            case Zr:
              return t = o(19, a, e, r), t.elementType = Zr, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ya:
                    f = 10;
                    break t;
                  case bu:
                    f = 9;
                    break t;
                  case Vr:
                    f = 11;
                    break t;
                  case Jr:
                    f = 14;
                    break t;
                  case xa:
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
      function Ka(t, e, a, l) {
        return t = o(7, t, l, e), t.lanes = a, t;
      }
      function qr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function uu(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Yr(t, e, a) {
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
      function hf(t, e, a, l, r, u, f, x, O) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = D(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = D(0), this.hiddenUpdates = D(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = O, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function du(t, e, a, l, r, u, f, x, O, K, J, V) {
        return t = new hf(
          t,
          e,
          a,
          f,
          O,
          K,
          J,
          V,
          x
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Ki(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Zi(u), t;
      }
      function mu(t) {
        return t ? (t = gn, t) : gn;
      }
      function fu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = m(e), t = t !== null ? y(t) : null, t === null ? null : Fn(t.stateNode);
      }
      function pu(t, e, a, l, r, u) {
        r = mu(r), l.context === null ? l.context = r : l.pendingContext = r, l = fa(e), l.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (l.callback = u), a = pa(t, l, e), a !== null && (ce(a, t, e), Bn(a, t, e));
      }
      function hu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Gr(t, e) {
        hu(t, e), (t = t.alternate) && hu(t, e);
      }
      var ht = {}, gf = Dh, ge = Bh(), Kr = Object.assign, bf = Symbol.for("react.element"), Xl = Symbol.for("react.transitional.element"), dn = Symbol.for("react.portal"), mn = Symbol.for("react.fragment"), gu = Symbol.for("react.strict_mode"), Qr = Symbol.for("react.profiler"), bu = Symbol.for("react.consumer"), ya = Symbol.for("react.context"), Vr = Symbol.for("react.forward_ref"), Xr = Symbol.for("react.suspense"), Zr = Symbol.for("react.suspense_list"), Jr = Symbol.for("react.memo"), xa = Symbol.for("react.lazy"), Lr = Symbol.for("react.activity"), vf = Symbol.for("react.memo_cache_sentinel"), vu = Symbol.iterator, yf = Symbol.for("react.client.reference"), Zl = Array.isArray, it = gf.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, xf = i.rendererVersion, wf = i.rendererPackageName, yu = i.extraDevToolsConfig, Fn = i.getPublicInstance, _f = i.getRootHostContext, Sf = i.getChildHostContext, kf = i.prepareForCommit, zf = i.resetAfterCommit, Ef = i.createInstance;
      i.cloneMutableInstance;
      var Wr = i.appendInitialChild, xu = i.finalizeInitialChildren, Jl = i.shouldSetTextContent, wu = i.createTextInstance;
      i.cloneMutableTextInstance;
      var Nf = i.scheduleTimeout, Tf = i.cancelTimeout, Qa = i.noTimeout, ta = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ne = i.supportsMutation, Qe = i.supportsPersistence, le = i.supportsHydration, Cf = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var jf = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Lt = i.setCurrentUpdatePriority, ea = i.getCurrentUpdatePriority, Mf = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var Af = i.shouldAttemptEagerTransition, Of = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var Rf = i.maySuspendCommit, Hf = i.maySuspendCommitOnUpdate, Fr = i.maySuspendCommitInSyncRender, _u = i.preloadInstance, Df = i.startSuspendingCommit, Su = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var Uf = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var fn = i.NotPendingTransition, Va = i.HostTransitionContext, Bf = i.resetFormInstance;
      i.bindToConsole;
      var qf = i.supportsMicrotasks, Yf = i.scheduleMicrotask, In = i.supportsTestSelectors, Gf = i.findFiberRoot, Kf = i.getBoundingRect, Qf = i.getTextContent, $n = i.isHiddenSubtree, Vf = i.matchAccessibilityRole, Xf = i.setFocusIfFocusable, Zf = i.setupIntersectionObserver, Jf = i.appendChild, Lf = i.appendChildToContainer, Wf = i.commitTextUpdate, Ff = i.commitMount, If = i.commitUpdate, $f = i.insertBefore, Pf = i.insertInContainerBefore, tp = i.removeChild, ep = i.removeChildFromContainer, ku = i.resetTextContent, ap = i.hideInstance, np = i.hideTextInstance, lp = i.unhideInstance, ip = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var rp = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var op = i.cloneInstance, zu = i.createContainerChildSet, Eu = i.appendChildToContainerChildSet, sp = i.finalizeContainerChildren, Nu = i.replaceContainerChildren, Tu = i.cloneHiddenInstance, Cu = i.cloneHiddenTextInstance, Ir = i.isSuspenseInstancePending, $r = i.isSuspenseInstanceFallback, cp = i.getSuspenseInstanceFallbackErrorDetails, up = i.registerSuspenseInstanceRetry, dp = i.canHydrateFormStateMarker, mp = i.isFormStateMarkerMatching, ju = i.getNextHydratableSibling, fp = i.getNextHydratableSiblingAfterSingleton, pp = i.getFirstHydratableChild, hp = i.getFirstHydratableChildWithinContainer, gp = i.getFirstHydratableChildWithinActivityInstance, bp = i.getFirstHydratableChildWithinSuspenseInstance, vp = i.getFirstHydratableChildWithinSingleton, yp = i.canHydrateInstance, xp = i.canHydrateTextInstance, wp = i.canHydrateActivityInstance, _p = i.canHydrateSuspenseInstance, Sp = i.hydrateInstance, kp = i.hydrateTextInstance, zp = i.hydrateActivityInstance, Ep = i.hydrateSuspenseInstance, Np = i.getNextHydratableInstanceAfterActivityInstance, Tp = i.getNextHydratableInstanceAfterSuspenseInstance, Cp = i.commitHydratedInstance, jp = i.commitHydratedContainer, Mp = i.commitHydratedActivityInstance, Ap = i.commitHydratedSuspenseInstance, Op = i.finalizeHydratedChildren, Rp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var Hp = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var Dp = i.clearSuspenseBoundaryFromContainer, Up = i.hideDehydratedBoundary, Bp = i.unhideDehydratedBoundary, Mu = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var qp = i.validateHydratableInstance, Yp = i.validateHydratableTextInstance, Ue = i.supportsResources, Au = i.isHostHoistableType, Pr = i.getHoistableRoot, Ou = i.getResource, Ru = i.acquireResource, Hu = i.releaseResource, Gp = i.hydrateHoistable, Du = i.mountHoistable, Uu = i.unmountHoistable, Kp = i.createHoistableInstance, Qp = i.prepareToCommitHoistables, Vp = i.mayResourceSuspendCommit, Bu = i.preloadResource, Xp = i.suspendResource, Vt = i.supportsSingletons, qu = i.resolveSingletonInstance, Zp = i.acquireSingletonInstance, Yu = i.releaseSingletonInstance, Gu = i.isHostSingletonType, pn = i.isSingletonScope, to = [], hn = -1, gn = {}, be = Math.clz32 ? Math.clz32 : S, Jp = Math.log, Lp = Math.LN2, Ll = 256, Wl = 262144, Fl = 4194304, Il = ge.unstable_scheduleCallback, eo = ge.unstable_cancelCallback, Wp = ge.unstable_shouldYield, Fp = ge.unstable_requestPaint, ue = ge.unstable_now, Ku = ge.unstable_ImmediatePriority, Ip = ge.unstable_UserBlockingPriority, ao = ge.unstable_NormalPriority, $p = ge.unstable_IdlePriority, Pp = ge.log, th = ge.unstable_setDisableYieldValue, Pn = null, ve = null, ye = typeof Object.is == "function" ? Object.is : wt, Qu = typeof reportError == "function" ? reportError : function(t) {
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
      }, eh = Object.prototype.hasOwnProperty, no, Vu, lo = !1, Xu = /* @__PURE__ */ new WeakMap(), bn = [], vn = 0, $l = null, tl = 0, ze = [], Ee = 0, wa = null, Ve = 1, Xe = "", Pt = E(null), el = E(null), _a = E(null), Pl = E(null), te = null, Ot = null, yt = !1, Sa = null, Ne = !1, io = Error(s(519)), ti = E(null), Xa = null, aa = null, ah = typeof AbortController < "u" ? AbortController : function() {
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
      }, nh = ge.unstable_scheduleCallback, lh = ge.unstable_NormalPriority, Rt = {
        $$typeof: ya,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ei = null, yn = null, ro = !1, ai = !1, oo = !1, Za = 0, al = null, so = 0, xn = 0, wn = null, Zu = it.S;
      it.S = function(t, e) {
        Iu = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && Vm(t, e), Zu !== null && Zu(t, e);
      };
      var Ja = E(null), _n = Error(s(460)), co = Error(s(474)), ni = Error(s(542)), li = { then: function() {
      } }, La = null, Sn = null, nl = 0, Wa = gs(!0), Ju = gs(!1), Te = [], kn = 0, uo = 0, ka = !1, mo = !1, zn = E(null), ii = E(0), xe = E(null), Ce = null, qt = E(0), na = 0, mt = null, Ct = null, Yt = null, ri = !1, En = !1, Fa = !1, oi = 0, ll = 0, Nn = null, ih = 0, il = {
        readContext: It,
        use: Tl,
        useCallback: Dt,
        useContext: Dt,
        useEffect: Dt,
        useImperativeHandle: Dt,
        useLayoutEffect: Dt,
        useInsertionEffect: Dt,
        useMemo: Dt,
        useReducer: Dt,
        useRef: Dt,
        useState: Dt,
        useDebugValue: Dt,
        useDeferredValue: Dt,
        useTransition: Dt,
        useSyncExternalStore: Dt,
        useId: Dt,
        useHostTransitionStatus: Dt,
        useFormState: Dt,
        useActionState: Dt,
        useOptimistic: Dt,
        useMemoCache: Dt,
        useCacheRefresh: Dt
      };
      il.useEffectEvent = Dt;
      var Lu = {
        readContext: It,
        use: Tl,
        useCallback: function(t, e) {
          return oe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Gs,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, jl(
            4194308,
            4,
            Xs.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return jl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          jl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = oe();
          e = e === void 0 ? null : e;
          var l = t();
          if (Fa) {
            Et(!0);
            try {
              t();
            } finally {
              Et(!1);
            }
          }
          return a.memoizedState = [l, e], l;
        },
        useReducer: function(t, e, a) {
          var l = oe();
          if (a !== void 0) {
            var r = a(e);
            if (Fa) {
              Et(!0);
              try {
                a(e);
              } finally {
                Et(!1);
              }
            }
          } else r = e;
          return l.memoizedState = l.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, l.queue = t, t = t.dispatch = Im.bind(
            null,
            mt,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = oe();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = rr(t);
          var e = t.queue, a = tc.bind(
            null,
            mt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: cr,
        useDeferredValue: function(t, e) {
          var a = oe();
          return ur(a, t, e);
        },
        useTransition: function() {
          var t = rr(!1);
          return t = Fs.bind(
            null,
            mt,
            t.queue,
            !0,
            !1
          ), oe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = mt, r = oe();
          if (yt) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), Mt === null)
              throw Error(s(349));
            (vt & 127) !== 0 || zs(l, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Gs(Ns.bind(null, l, u, t), [
            t
          ]), l.flags |= 2048, on(
            9,
            { destroy: void 0 },
            Es.bind(
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
          var t = oe(), e = Mt.identifierPrefix;
          if (yt) {
            var a = Xe, l = Ve;
            a = (l & ~(1 << 32 - be(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = oi++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = ih++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: dr,
        useFormState: Ds,
        useActionState: Ds,
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
          return e.queue = a, e = mr.bind(
            null,
            mt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: nr,
        useCacheRefresh: function() {
          return oe().memoizedState = Fm.bind(
            null,
            mt
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
      }, fo = {
        readContext: It,
        use: Tl,
        useCallback: Js,
        useContext: It,
        useEffect: sr,
        useImperativeHandle: Zs,
        useInsertionEffect: Qs,
        useLayoutEffect: Vs,
        useMemo: Ls,
        useReducer: Cl,
        useRef: Ys,
        useState: function() {
          return Cl(We);
        },
        useDebugValue: cr,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return Ws(
            a,
            Ct.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Cl(We)[0], e = Bt().memoizedState;
          return [
            typeof t == "boolean" ? t : Gn(t),
            e
          ];
        },
        useSyncExternalStore: ks,
        useId: $s,
        useHostTransitionStatus: dr,
        useFormState: Us,
        useActionState: Us,
        useOptimistic: function(t, e) {
          var a = Bt();
          return js(a, Ct, t, e);
        },
        useMemoCache: nr,
        useCacheRefresh: Ps
      };
      fo.useEffectEvent = Ks;
      var Wu = {
        readContext: It,
        use: Tl,
        useCallback: Js,
        useContext: It,
        useEffect: sr,
        useImperativeHandle: Zs,
        useInsertionEffect: Qs,
        useLayoutEffect: Vs,
        useMemo: Ls,
        useReducer: ir,
        useRef: Ys,
        useState: function() {
          return ir(We);
        },
        useDebugValue: cr,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return Ct === null ? ur(a, t, e) : Ws(
            a,
            Ct.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = ir(We)[0], e = Bt().memoizedState;
          return [
            typeof t == "boolean" ? t : Gn(t),
            e
          ];
        },
        useSyncExternalStore: ks,
        useId: $s,
        useHostTransitionStatus: dr,
        useFormState: qs,
        useActionState: qs,
        useOptimistic: function(t, e) {
          var a = Bt();
          return Ct !== null ? js(a, Ct, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: nr,
        useCacheRefresh: Ps
      };
      Wu.useEffectEvent = Ks;
      var po = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = he(), r = fa(l);
          r.payload = e, a != null && (r.callback = a), e = pa(t, r, l), e !== null && (ce(e, t, l), Bn(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = he(), r = fa(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = pa(t, r, l), e !== null && (ce(e, t, l), Bn(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = he(), l = fa(a);
          l.tag = 2, e != null && (l.callback = e), e = pa(t, l, a), e !== null && (ce(e, t, a), Bn(e, t, a));
        }
      }, ho = Error(s(461)), Gt = !1, go = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, la = !1, Kt = !1, bo = !1, Fu = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, de = !1, Be = null, Tn = 8192, rh = {
        getCacheForType: function(t) {
          var e = It(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return It(Rt).controller.signal;
        }
      }, si = 0, ci = 1, ui = 2, di = 3, mi = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var rl = Symbol.for;
        si = rl("selector.component"), ci = rl("selector.has_pseudo_class"), ui = rl("selector.role"), di = rl("selector.test_id"), mi = rl("selector.text");
      }
      var oh = typeof WeakMap == "function" ? WeakMap : Map, gt = 0, Mt = null, bt = null, vt = 0, Tt = 0, we = null, za = !1, Cn = !1, vo = !1, ia = 0, Ut = 0, Ea = 0, Ia = 0, yo = 0, _e = 0, jn = 0, ol = null, me = null, xo = !1, fi = 0, Iu = 0, sl = 1 / 0, pi = null, Na = null, Xt = 0, Ta = null, Mn = null, ra = 0, wo = 0, _o = null, $u = null, cl = 0, So = null;
      return ht.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ba(t, 67108864);
          e !== null && ce(e, t, 67108864), Gr(t, 67108864);
        }
      }, ht.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = he();
          e = ot(e);
          var a = Ba(t, e);
          a !== null && ce(a, t, e), Gr(t, e);
        }
      }, ht.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = z(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - be(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ge(t), (gt & 6) === 0 && (sl = ue() + 500, rn(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ba(t, 2), e !== null && ce(e, t, 2), Jc(), Gr(t, 2);
        }
      }, ht.batchedUpdates = function(t, e) {
        return t(e);
      }, ht.createComponentSelector = function(t) {
        return { $$typeof: si, value: t };
      }, ht.createContainer = function(t, e, a, l, r, u, f, x, O, K) {
        return du(
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
          O,
          K
        );
      }, ht.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, ht.createHydrationContainer = function(t, e, a, l, r, u, f, x, O, K, J, V, L, dt) {
        return t = du(
          a,
          l,
          !0,
          t,
          r,
          u,
          x,
          dt,
          O,
          K,
          J,
          V
        ), t.context = mu(null), a = t.current, l = he(), l = ot(l), r = fa(l), r.callback = e ?? null, pa(a, r, l), e = l, t.current.lanes = e, w(t, e), Ge(t), t;
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
        return { $$typeof: ui, value: t };
      }, ht.createTestNameSelector = function(t) {
        return { $$typeof: di, value: t };
      }, ht.createTextSelector = function(t) {
        return { $$typeof: mi, value: t };
      }, ht.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ht.defaultOnRecoverableError = function(t) {
        Qu(t);
      }, ht.defaultOnUncaughtError = function(t) {
        Qu(t);
      }, ht.deferredUpdates = function(t) {
        var e = it.T, a = ea();
        try {
          return Lt(32), it.T = null, t();
        } finally {
          Lt(a), it.T = e;
        }
      }, ht.discreteUpdates = function(t, e, a, l, r) {
        var u = it.T, f = ea();
        try {
          return Lt(2), it.T = null, t(e, a, l, r);
        } finally {
          Lt(f), it.T = u, gt === 0 && (sl = ue() + 500);
        }
      }, ht.findAllNodes = Rr, ht.findBoundingRects = function(t, e) {
        if (!In) throw Error(s(363));
        e = Rr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Kf(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, u = a.y, f = u + a.height, x = e - 1; 0 <= x; x--)
            if (e !== x) {
              var O = t[x], K = O.x, J = K + O.width, V = O.y, L = V + O.height;
              if (l >= K && u >= V && r <= J && f <= L) {
                t.splice(e, 1);
                break;
              } else if (l !== K || a.width !== O.width || L < u || V > f) {
                if (!(u !== V || a.height !== O.height || J < l || K > r)) {
                  K > l && (O.width += K - l, O.x = l), J < r && (O.width = r - K), t.splice(e, 1);
                  break;
                }
              } else {
                V > u && (O.height += V - u, O.y = u), L < f && (O.height = f - V), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ht.findHostInstance = fu, ht.findHostInstanceWithNoPortals = function(t) {
        return t = m(t), t = t !== null ? _(t) : null, t === null ? null : Fn(t.stateNode);
      }, ht.findHostInstanceWithWarning = function(t) {
        return fu(t);
      }, ht.flushPassiveEffects = Wn, ht.flushSyncFromReconciler = function(t) {
        var e = gt;
        gt |= 1;
        var a = it.T, l = ea();
        try {
          if (Lt(2), it.T = null, t)
            return t();
        } finally {
          Lt(l), it.T = a, gt = e, (gt & 6) === 0 && rn(0);
        }
      }, ht.flushSyncWork = Jc, ht.focusWithin = function(t, e) {
        if (!In) throw Error(s(363));
        for (t = Mr(t), e = Qc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!$n(a)) {
            if ((l === 5 || l === 26 || l === 27) && Xf(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ht.getFindAllNodesFailureDescription = function(t, e) {
        if (!In) throw Error(s(363));
        var a = 0, l = [];
        t = [Mr(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], f = u.tag, x = t[r++], O = e[x];
          if ((f !== 5 && f !== 26 && f !== 27 || !$n(u)) && (Ar(u, O) && (l.push(Or(O)), x++, x > a && (a = x)), x < e.length))
            for (u = u.child; u !== null; )
              t.push(u, x), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Or(e[a]));
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
            return Fn(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, ht.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: xf,
          rendererPackageName: wf,
          currentDispatcherRef: it,
          reconcilerVersion: "19.2.0"
        };
        if (yu !== null && (t.rendererConfig = yu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              Pn = e.inject(t), ve = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ht.isAlreadyRendering = function() {
        return (gt & 6) !== 0;
      }, ht.observeVisibleRects = function(t, e, a, l) {
        if (!In) throw Error(s(363));
        t = Rr(t, e);
        var r = Zf(
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
        var r = Is(t).queue;
        Fs(
          t,
          r,
          e,
          fn,
          a === null ? c : function() {
            var u = Is(t);
            return u.next === null && (u = t.alternate.memoizedState), Kn(
              t,
              u.next.queue,
              {},
              he()
            ), a(l);
          }
        );
      }, ht.updateContainer = function(t, e, a, l) {
        var r = e.current, u = he();
        return pu(
          r,
          u,
          t,
          e,
          a,
          l
        ), u;
      }, ht.updateContainerSync = function(t, e, a, l) {
        return pu(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, ht;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(No)), No.exports;
}
var dd;
function Yh() {
  return dd || (dd = 1, Eo.exports = qh()), Eo.exports;
}
var Gh = Yh();
const Kh = /* @__PURE__ */ $o(Gh);
var jo = { exports: {} }, oa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var md;
function Qh() {
  return md || (md = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var fd;
function Vh() {
  return fd || (fd = 1, jo.exports = Qh()), jo.exports;
}
var hl = Vh();
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
const $d = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Uo = 16, Pd = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Xh = [
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
], pd = {
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
}, Zh = /* @__PURE__ */ new Set([
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
]), tm = {
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
}, em = {
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
}, Bo = ["font-size", "color", ...new Set([...Object.keys(tm), ...Object.keys(em)].filter((n) => n !== "font-size" && n !== "color"))], Jh = new Set(Bo);
function ie(n, i = " ") {
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
function qo(n, i, o = 0) {
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
    const y = n.slice(d + 4, m - 1), _ = ie(y, ","), j = _[0].trim(), R = _.length > 1 ? y.slice(y.indexOf(",") + 1).trim() : null;
    let E = i(j);
    if ((E == null || E === "initial") && (E = R), E == null) return null;
    const b = qo(E, i, o + 1);
    if (b === null) return null;
    c += b, s = m;
  }
}
function Lh(n) {
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
function Rn(n, i) {
  const o = Lh(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let c = 0;
  const s = ({ num: E, unit: b }) => {
    switch (b) {
      case "":
        return { px: 0, pct: 0, num: E, unitless: !0 };
      case "px":
        return { px: E, pct: 0, num: 0 };
      case "rem":
        return { px: E * Uo, pct: 0, num: 0 };
      case "em":
        return { px: E * (i.fontSize ?? Uo), pct: 0, num: 0 };
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
  }, d = (E, b, k) => E && b ? { px: E.px + k * b.px, pct: E.pct + k * b.pct, num: E.num + k * b.num, unitless: E.unitless && b.unitless } : null, p = (E, b) => E ? { px: E.px * b, pct: E.pct * b, num: E.num * b, unitless: E.unitless } : null, m = (E) => E && E.unitless;
  function y() {
    const E = o[c++];
    if (!E) return null;
    if (E.num !== void 0) return s(E);
    if (E.op === "(") {
      const b = j();
      return o[c]?.op !== ")" ? null : (c++, b);
    }
    if (E.op === "-" || E.op === "+") {
      const b = y();
      return E.op === "-" ? p(b, -1) : b;
    }
    if (E.fn) {
      const b = [];
      for (; ; ) {
        b.push(j());
        const z = o[c++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (b.some((z) => !z)) return null;
      if (E.fn === "calc") return b[0];
      if (!(b.every((z) => !z.pct) || b.every((z) => !z.px && !z.num))) return null;
      const S = (z) => z.px + z.pct + z.num;
      return E.fn === "min" ? b.reduce((z, B) => S(B) < S(z) ? B : z) : E.fn === "max" ? b.reduce((z, B) => S(B) > S(z) ? B : z) : E.fn === "clamp" && b.length === 3 ? S(b[1]) < S(b[0]) ? b[0] : S(b[1]) > S(b[2]) ? b[2] : b[1] : null;
    }
    return null;
  }
  function _() {
    let E = y();
    for (; o[c] && (o[c].op === "*" || o[c].op === "/"); ) {
      const b = o[c++].op, k = y();
      if (!E || !k) return null;
      b === "*" ? E = m(k) ? p(E, k.num) : m(E) ? p(k, E.num) : null : E = m(k) && k.num !== 0 ? p(E, 1 / k.num) : null;
    }
    return E;
  }
  function j() {
    let E = _();
    for (; o[c] && (o[c].op === "+" || o[c].op === "-"); ) {
      const b = o[c++].op;
      E = d(E, _(), b === "-" ? -1 : 1);
    }
    return E;
  }
  const R = j();
  return c !== o.length || !R ? null : R;
}
function Yo(n, i) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const c = Rn(o, i);
  return c ? c.unitless ? c.num === 0 ? { px: 0 } : { expr: n.trim() } : c.pct && (c.px || c.num) ? { expr: n.trim() } : c.pct ? { pct: c.pct } : { px: Wh(c.px) } : { expr: n.trim() };
}
const Wh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, bi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Fh = ([n, i, o, c]) => `#${bi(n)}${bi(i)}${bi(o)}${bi(c * 255)}`;
function hd(n) {
  const i = n.slice(1), o = i.length <= 4 ? i.split("").map((s) => s + s).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const c = (s) => parseInt(o.slice(s, s + 2), 16);
  return [c(0), c(2), c(4), o.length === 8 ? c(6) / 255 : 1];
}
function Ni(n, i) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const c = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (c) {
    const _ = i(c[1]), j = _ && hd(_);
    return j ? { rgba: j, token: c[1] } : null;
  }
  if (o.startsWith("#")) {
    const _ = hd(o);
    return _ ? { rgba: _, token: null } : null;
  }
  if (pd[o]) return { rgba: [...pd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const _ = ie(s[2], ",");
    if (_.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(_[0])) return null;
    const j = (Et) => {
      const wt = ie(Et), jt = wt.findIndex((nt) => /%$/.test(nt)), Q = jt >= 0 ? parseFloat(wt[jt]) / 100 : null;
      return { color: Ni(wt.filter((nt, U) => U !== jt).join(" "), i), pct: Q };
    }, R = j(_[1]), E = j(_[2]);
    if (!R.color || !E.color || R.color === "currentcolor" || E.color === "currentcolor") return null;
    let b = R.pct, k = E.pct;
    b === null && k === null ? (b = 0.5, k = 0.5) : b === null ? b = 1 - k : k === null && (k = 1 - b);
    const S = b + k, z = S < 1 ? S : 1;
    b /= S, k /= S;
    const [B, N, M, Y] = R.color.rgba, [D, w, g, h] = E.color.rgba, H = Y * b + h * k, Z = (Et, wt) => H === 0 ? 0 : (Et * Y * b + wt * h * k) / H, ot = [Z(B, D), Z(N, w), Z(M, g), H * z], $ = h === 0 ? R.color.token : Y === 0 ? E.color.token : null;
    return { rgba: ot, token: $ };
  }
  const d = s[2].includes(",") ? ie(s[2], ",") : ie(s[2].replace("/", " / ")).filter((_) => _ !== "/");
  if (d.length < 3) return null;
  const p = (_) => _.endsWith("%") ? parseFloat(_) / 100 * 255 : parseFloat(_), m = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), y = [p(d[0]), p(d[1]), p(d[2]), m];
  return y.some((_) => Number.isNaN(_)) ? null : { rgba: y, token: null };
}
const fl = ["top", "right", "bottom", "left"], Ih = ["top-left", "top-right", "bottom-right", "bottom-left"], vi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], gd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Go(n, i) {
  const o = i.trim(), c = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const s = vi(c());
      return fl.map((d, p) => [`${n}-${d}`, s[p]]);
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
      const s = vi(c());
      return fl.map((d, p) => [d, s[p]]);
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
      const s = n.split("-")[1], d = vi(c());
      return fl.map((p, m) => [`border-${p}-${s}`, d[m]]);
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
      const s = n === "border" ? fl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", p = "none", m = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const y of c())
          gd.has(y) ? p = y : /^(thin|medium|thick|-?[\d.]|calc\()/.test(y) ? d = y : m = y;
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
      const s = vi(ie(o.split("/")[0]));
      return Ih.map((d, p) => [`border-${d}-radius`, s[p]]);
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
      return o === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Ni(o, () => "#000000") ? [["background-color", o], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", o]];
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
      return Go("gap", o);
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
        gd.has(m) || m === "auto" ? d = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? s = m : p = m;
      return [["outline-width", s], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ie(o, ","), d = s.map((m) => ie(m).find((y) => !/^[\d.]+m?s$/.test(y) && !/^(ease|linear|step|cubic)/.test(y)) ?? "all"), p = s.map((m) => ie(m).find((y) => /^[\d.]+m?s$/.test(y)) ?? "0s");
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
function $h(n, i) {
  return n ? ie(n, ",").some((o) => {
    let c = o.trim().toLowerCase(), s = !1;
    c.startsWith("not ") && (s = !0, c = c.slice(4)), c.startsWith("only ") && (c = c.slice(5));
    const d = c.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const m = /^\((.+)\)$/.exec(p);
      if (!m) return !1;
      const y = m[1].trim(), _ = /^([a-z-]+)\s*:\s*(.+)$/.exec(y);
      if (_) {
        const [, R, E] = _, b = (k) => {
          const S = Yo(k, { viewport: i });
          return typeof S == "object" && "px" in S ? S.px : NaN;
        };
        switch (R) {
          case "min-width":
            return i.width >= b(E);
          case "max-width":
            return i.width <= b(E);
          case "min-height":
            return i.height >= b(E);
          case "max-height":
            return i.height <= b(E);
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
      const j = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(y);
      if (j) {
        const R = j[1] === "width" ? i.width : i.height, E = Yo(j[3], { viewport: i }), b = typeof E == "object" && "px" in E ? E.px : NaN;
        switch (j[2]) {
          case ">=":
            return R >= b;
          case "<=":
            return R <= b;
          case ">":
            return R > b;
          case "<":
            return R < b;
          default:
            return R === b;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function Ph(n, i) {
  const o = i[i.length - 1].compound;
  return Po(o)[0] ?? n;
}
function tg(n) {
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = (s, d) => {
    s.forEach(({ compound: p }, m) => {
      const y = d && m === s.length - 1;
      for (const _ of p.pseudos)
        if (Pd.has(_.name) && (y ? i : o).add(_.name), _.list && _.name !== "not") for (const j of _.list) c(j, y);
    });
  };
  return c(n, !0), { subject: i, ancestor: o };
}
function Po(n) {
  const i = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const c of o.list) c.length === 1 && i.push(...Po(c[0].compound));
  return i;
}
function eg(n, i) {
  const o = (c, s) => {
    c.forEach(({ compound: d }, p) => {
      const m = s && p === c.length - 1, y = d.pseudos.filter((_) => Pd.has(_.name)).map((_) => _.name);
      if (!m) for (const _ of y) for (const j of Po(d)) i.add(`${_}:${j}`);
      for (const _ of d.pseudos) if (_.list && _.name !== "not") for (const j of _.list) o(j, m);
    });
  };
  o(n, !0);
}
class ag {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const m = p[p.length - 1].compound, y = m.classes.length ? `.${m.classes[0]}` : m.tag && m.tag !== "*" ? m.tag : "*";
      this.index.has(y) || this.index.set(y, []), this.index.get(y).push(d);
    };
    let c = 0;
    const s = (d, p) => {
      for (const [m, y, _, j] of d)
        for (const R of Wo(m)) {
          let E;
          try {
            E = Fo(R);
          } catch (S) {
            if (S instanceof ke) {
              this.skipped++;
              continue;
            }
            throw S;
          }
          const b = tg(E);
          eg(E, this.trackedStates);
          const k = { steps: E, media: y, layer: _, origin: p, order: c++, specificity: Vd(E), decls: j, states: b, source: p === 0 ? `ua:${E[E.length - 1].compound.tag ?? "*"}` : Ph(R, E) };
          this.rules.push(k), o(k, E);
        }
    };
    s(Xh.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), s(i.rules, 1);
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
const ng = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function lg(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [o, c] of Object.entries(n)) {
    if (c == null || c === "" || typeof c == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof c == "number" && c !== 0 && !ng.has(s) && !s.startsWith("--") ? `${c}px` : String(c);
    i.push([s, d]);
  }
  return i;
}
function ig(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const o of ["width", "height"]) {
    const c = n.getAttribute(o);
    c !== null && i.push([o, /^[\d.]+$/.test(c) ? `${c}px` : c]);
  }
  return i;
}
const rg = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class og {
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
    return this.sheet.candidates(i).filter((s) => (!s.media || s.media.every((d) => $h(d, this.viewport))) && Xd(i, s.steps, { state: c }));
  }
  compute(i, o, c = /* @__PURE__ */ new Set()) {
    const s = this.matching(i, c), d = [];
    for (const g of s)
      for (const [h, H, Z] of g.decls) d.push({ prop: h, value: H, important: Z ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of ig(i)) d.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of lg(i.inlineStyle ?? i.props?.style)) d.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(rg);
    const p = this.sheet.properties, m = Object.create(o?.customs ?? null), y = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map();
    for (const g of d) g.prop.startsWith("--") && _.set(g.prop, g.value);
    if (!o && this.theme) for (const g of $d) this.theme[g] && _.set(`--${g}`, `perchtoken(${g})`);
    const j = (g) => {
      if (y.has(g)) return y.get(g);
      const h = p[g];
      return h && !h.inherits ? h.initial ?? null : g in m ? m[g] : h?.initial ?? null;
    }, R = /* @__PURE__ */ new Set(), E = (g) => {
      if (!_.has(g)) return j(g);
      if (R.has(g)) return null;
      R.add(g);
      const h = qo(_.get(g), E);
      return R.delete(g), _.delete(g), y.set(g, h), (!p[g] || p[g].inherits) && (m[g] = h), h;
    };
    for (const g of [..._.keys()]) E(g);
    const b = /* @__PURE__ */ new Map();
    for (const g of d) {
      if (g.prop.startsWith("--")) continue;
      const h = qo(g.value, j);
      if (h === null) {
        for (const [H] of Go(g.prop, "unset")) b.set(H, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [H, Z] of Go(g.prop, h)) b.set(H, { value: Z, source: g.source, origin: g.origin });
    }
    const k = {}, S = {}, z = /* @__PURE__ */ new Set(), B = /* @__PURE__ */ new Set(), N = o?.values, M = { fontSize: N?.["font-size"] ?? Uo, viewport: this.viewport }, Y = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, M, k, N);
      const H = `${g}\0${h}\0${M.fontSize}`;
      let Z = this.parsed.get(H);
      return Z === void 0 && this.parsed.set(H, Z = this.parseValue(g, h, M, k, N)), Z;
    }, D = b.size ? [...Bo, ...[...b.keys()].filter((g) => !Jh.has(g))] : Bo;
    for (const g of D) {
      const h = b.get(g);
      let H = h?.value;
      const Z = Zh.has(g);
      if ((H === void 0 || H === "unset" || H === "revert" || H === "revert-layer") && (H = Z ? "inherit" : "initial"), h && (S[g] = h.source, h.origin !== 0 && z.add(g)), H === "inherit" && N && g in N) {
        k[g] = N[g], B.add(g);
        continue;
      }
      (H === "inherit" || H === "initial") && (H = Z ? em[g] : tm[g]), k[g] = Y(g, H), g === "font-size" && (M.fontSize = k["font-size"]);
    }
    for (const g of fl) {
      const h = k[`border-${g}-style`];
      (h === "none" || h === "hidden") && (k[`border-${g}-width`] = { px: 0 });
    }
    k["outline-style"] === "none" && (k["outline-width"] = { px: 0 });
    const w = N?.display;
    return (w === "flex" || w === "inline-flex" || w === "grid" || w === "inline-grid") && k.position !== "absolute" && k.position !== "fixed" && (k.display = bd(k.display)), (k.position === "absolute" || k.position === "fixed") && (k.display = bd(k.display)), { values: k, sources: S, own: z, inherited: B, customs: m, rules: s, element: i };
  }
  parseValue(i, o, c, s, d) {
    const p = String(o).trim();
    switch (i) {
      case "font-size": {
        const m = p.toLowerCase(), y = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (y[m]) return y[m];
        if (m === "smaller") return c.fontSize / 1.2;
        if (m === "larger") return c.fontSize * 1.2;
        const _ = Rn(m, { fontSize: c.fontSize, viewport: c.viewport });
        return !_ || _.num ? c.fontSize : _.px + _.pct / 100 * c.fontSize;
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
        const y = Rn(m, { fontSize: c.fontSize, viewport: c.viewport });
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
        const m = Ni(p, (y) => this.themeHex(y));
        return m === "currentcolor" || !m ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : m;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const m = Ni(p, (y) => this.themeHex(y));
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
        return Yo(p, c);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function bd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Ti = (n) => n && n.rgba ? { value: Fh(n.rgba), token: n.token ?? null } : null, sg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function cg(n, i) {
  const o = i?.(n);
  if (Number.isFinite(o)) return o;
  const c = Math.round(n * 100) / 100;
  return sg[c] ?? Math.round(n * 1.2);
}
function Ci(n, i) {
  const o = n["line-height"], c = n["font-size"];
  return o.normal ? cg(c, i) : o.factor !== void 0 ? o.factor * c : o.px;
}
const ug = (n) => ie(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const dg = "perch-native-description/1", An = Symbol("display"), ji = {
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
}, mg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of mg) ji[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ji.rounded = 0;
const fg = /* @__PURE__ */ new Set([
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
]), pg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, hg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, gg = (n) => hg.test(n) ? "Menlo" : pg.test(n) ? ".SystemUIFont" : ug(n).split(",")[0].trim(), bg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, vd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, am = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const c = n.parentElement;
  return c && c.tagName !== "body" ? `${am(c)} > ${n.tagName}` : n.tagName;
};
class vg {
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
}, yg = /^(text|search|url|email|tel|password|number)$/, xg = 162.13 / 12.8;
function wg(n, i) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = Rn(n.expr, { fontSize: i["font-size"] }), c = (i["margin-left"]?.px ?? NaN) + (i["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + c) < 0.01;
}
function nm(n) {
  const i = n.transform;
  if (i && i !== "none") {
    const c = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), s = c && ie(c[2], ",").map((d) => d.trim());
    return !s || s.length > (c[1] ? 1 : 2) ? null : c[1] === "X" ? [s[0], "0"] : c[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const c = ie(String(o).trim(), " ").filter(Boolean);
    return c.length > 3 || c[2] !== void 0 && Rn(c[2], {})?.px ? null : [c[0], c[1] ?? "0"];
  }
  return [];
}
function yd(n, i, o, c = !1) {
  const s = n.values, d = nm(s);
  if (d?.length === 0) return;
  const p = s.transform && s.transform !== "none" ? "transform" : "translate", m = { fontSize: s["font-size"] }, y = (R, E) => {
    const b = Rn(R, m);
    if (!(!b || b.unitless && b.num))
      return b.pct ? typeof E == "number" ? b.px + b.pct / 100 * E : void 0 : b.px;
  }, _ = d ? y(d[0], i.w) : void 0, j = d ? y(d[1], i.h) : void 0;
  if (_ === void 0 || j === void 0) {
    o("unsupported", p, s[p], n.sources[p]);
    return;
  }
  if (c) {
    _ && (i.left = _), j && (i.top = j);
    return;
  }
  _ && (i.ml = (i.ml ?? 0) + _), j && (i.mt = (i.mt ?? 0) + j);
}
function xd(n, i, o = null) {
  const c = n.values, s = {}, d = (N) => n.sources[N], p = (N) => n.sources[N] !== void 0, m = c.display;
  m === "none" ? s.display = "hidden" : m === "flex" || m === "inline-flex" ? s.display = "flex" : (m === "grid" || m === "inline-grid") && (s.display = "flex", s.flex_direction = "col", i("approximated", "display", m, d("display"), "one-column flex column"), c["grid-template-columns"] && c["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", c["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const y = s.display === "flex";
  if (y && s.flex_direction !== "col") {
    const N = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[c["flex-direction"]] ?? "row";
    s.flex_direction = N;
  }
  if (y) {
    (c["flex-wrap"] === "wrap" || c["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const N = m === "grid" || m === "inline-grid", M = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[c["align-items"]];
    M && (s.items = M);
    let Y = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[c["justify-content"]];
    if (N) {
      const g = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[c["justify-items"]];
      g && (s.items = g), c["align-items"] === "center" && (Y = "center");
    }
    Y && (s.justify = Y);
    const D = ca(c["row-gap"]), w = ca(c["column-gap"]);
    typeof D == "number" && D && (s.gap_y = D), typeof w == "number" && w && !N && (s.gap_x = w);
  }
  c["flex-grow"] && (s.flex_grow = c["flex-grow"]), c["flex-shrink"] !== 1 && (s.flex_shrink = c["flex-shrink"]);
  const _ = ca(c["flex-basis"]);
  _ !== void 0 && _ !== "auto" && (s.flex_basis = _);
  const j = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[c["align-self"]];
  j && (s.self = j);
  for (const [N, M] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const Y = c[M], D = ca(Y);
    if (D === void 0 && M === "width" && wg(Y, c)) {
      s.self = "stretch", i("approximated", M, Y.expr, d(M), "stretched across its parent, inside its margins");
      continue;
    }
    if (D === void 0) {
      typeof Y == "object" && Y.expr ? i("unsupported", M, Y.expr, d(M), "no calc() in the engine") : typeof Y == "string" && !["auto", "none"].includes(Y) && i("unsupported", M, Y, d(M));
      continue;
    }
    D !== "auto" && (s[N] = D);
  }
  const R = ["top", "right", "bottom", "left"];
  for (const N of R) {
    const M = N[0];
    for (const [Y, D] of [["p", "padding"], ["m", "margin"]]) {
      const w = c[`${D}-${N}`], g = ca(w);
      if (g === void 0) {
        w?.expr && i("unsupported", `${D}-${N}`, w.expr, d(`${D}-${N}`), "no calc() in the engine");
        continue;
      }
      g !== 0 && (s[`${Y}${M}`] = g);
    }
  }
  const E = c.position;
  if (E === "absolute" || E === "fixed") {
    s.position = "absolute", E === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const N of R) {
      const M = ca(c[N]);
      M !== void 0 && M !== "auto" && (s[N] = M);
    }
    if (E === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const N = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, N) : N;
    }
    yd(n, s, i);
  } else E === "sticky" ? i("unsupported", "position", "sticky", d("position")) : nm(c)?.length !== 0 && (s.position = "relative", yd(n, s, i, !0));
  c["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", c["z-index"], d("z-index"), "paint order is tree order");
  for (const [N, M] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const Y = c[M];
    Y === "hidden" || Y === "clip" ? s[N] = "hidden" : (Y === "auto" || Y === "scroll") && (s[N] = "scroll");
  }
  (c.visibility === "hidden" || c.visibility === "collapse") && (s.visibility = "invisible");
  const b = c["background-color"];
  b?.unreadable ? i("unsupported", "background-color", b.unreadable, d("background-color")) : b?.rgba && b.rgba[3] > 0 && (s.bg = Ti(b)), c["background-image"] && c["background-image"] !== "none" && i("unsupported", "background-image", c["background-image"], d("background-image"));
  const k = R.map((N) => ca(c[`border-${N}-width`]) || 0), S = [];
  R.forEach((N, M) => {
    if (!k[M]) return;
    s[`border_${N[0]}`] = k[M];
    const Y = c[`border-${N}-style`];
    Y !== "solid" && i("approximated", `border-${N}-style`, Y, d(`border-${N}-style`), "drawn solid");
    const D = Ti(c[`border-${N}-color`]);
    D && S.push(D);
  }), S.length && (s.border_color = S[0], S.some((N) => N.value !== S[0].value) && i("approximated", "border-color", S.map((N) => N.value).join(" "), d("border-top-color"), "one border colour"));
  const z = ["top-left", "top-right", "bottom-right", "bottom-left"].map((N) => ca(c[`border-${N}-radius`]) || 0);
  z.every((N) => N === z[0]) ? z[0] && (s.rounded = z[0]) : ["tl", "tr", "br", "bl"].forEach((N, M) => {
    z[M] && (s[`rounded_${N}`] = z[M]);
  }), c.opacity !== 1 && (s.opacity = Math.round(c.opacity * 1e3) / 1e3);
  const B = c["box-shadow"];
  if (B && B !== "none" && ie(B, ",").some((N) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(N.trim())) && (s.shadow = "lg", i("approximated", "box-shadow", B, d("box-shadow"), "the engine's large shadow preset")), c.cursor && c.cursor !== "auto" && !n.inherited.has("cursor")) {
    const N = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[c.cursor];
    N ? s.cursor = N : i("unsupported", "cursor", c.cursor, d("cursor"));
  }
  return c["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), c["text-decoration-line"] === "underline" ? s.underline = !0 : c["text-decoration-line"] && c["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", c["text-decoration-line"], d("text-decoration-line")), s;
}
const _g = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function lm(n) {
  if (!n || n === "normal") return "";
  const i = String(n).trim().split(/\s+/).map((o) => _g[o]);
  return i.every(Boolean) ? i.join(",") : null;
}
function wd(n, i) {
  const o = n.values, c = o["line-height"];
  return {
    text_color: Ti(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: lm(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: c.factor !== void 0 ? { factor: c.factor } : { px: Math.round(Ci(o, i) * 1e3) / 1e3 },
    font_family: gg(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const _d = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, im = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function Sd(n, i, o) {
  const c = {}, s = (m, y) => y.some((_) => !n.inherited.has(_));
  for (const [m, y] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(m, y) || !im(i[m], o[m])) && (c[m] = i[m]);
  const d = _d(i.line_height, i.text_size), p = o.line_height ? _d(o.line_height, i.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (c.line_height = i.line_height), c;
}
const Sg = (n, i) => ({ ...n, ...i });
function kd(n, i) {
  const o = {};
  for (const [c, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[c] = s.value, s.token && (i[c] = s.token)) : c === "line_height" ? o[c] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : c === "italic" ? s && (o.italic = !0) : o[c] = s;
  return o.italic === !1 && delete o.italic, o;
}
function kg(n, i) {
  const o = {};
  for (const c of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const s = n[c], d = i[c];
    im(s, d) || (o[c] = d === void 0 ? c in ji ? ji[c] : null : d);
  }
  return o;
}
function zd(n, i) {
  const o = n.values;
  for (const [c, s] of Object.entries(n.sources)) {
    if (c.startsWith("--") || fg.has(c) || s.startsWith("ua:")) continue;
    const d = o[c];
    switch (c) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", c, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && lm(d) === null && i("unsupported", c, d, s);
        break;
      case "text-transform":
        d !== "none" && i("approximated", c, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        c === "transition-property" && p && ie(p, ",").some((m) => parseFloat(m) > 0) && o["transition-property"] !== "none" && i("unsupported", "transition", `${o["transition-property"]} ${p}`, s, "changes are instant (the engine animates only opacity and size)");
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
        o["outline-style"] !== "none" && c === "outline-style" && i("unsupported", "outline", `${ca(o["outline-width"])}px ${o["outline-style"]} ${Ti(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function zg(n, i, o, c) {
  const s = am(n), d = [], p = (z, B, N, M, Y) => d.push([z, B, N, M ?? "(user agent)", s, Y]), m = c.cascade.compute(n, i), y = {}, _ = xd(m, p, c.viewport);
  zd(m, p);
  const j = wd(m, c.measure), R = Sd(m, j, o), E = kd({ ..._, ...R }, y), b = {}, k = c.cascade.matching(n, "*").filter((z) => z.states.subject.size);
  for (const [z, B] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!k.some((w) => B.some((g) => w.states.subject.has(g)))) continue;
    const N = c.cascade.compute(n, i, new Set(B)), M = {}, Y = kd({ ...xd(N, () => {
    }), ...Sd(N, wd(N, c.measure), o) }, M);
    z === "focus" && zd(N, p);
    const D = kg(E, Y);
    if (Object.keys(D).length) {
      b[z] = D;
      const w = Object.fromEntries(Object.entries(M).filter(([g]) => g in D));
      Object.keys(w).length && (b[`${z}_tokens`] = w);
    }
  }
  if (c.cascade.sheet.tracks(n, "hover") && (b.track_hover = !0), /tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (b.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (b.break_anywhere = !0), _.overflow_y === "scroll") {
    const z = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    z > 0 && (b.scrollbar = z);
  }
  m.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (b.blocks_pointer = !0);
  const S = Object.entries(bg).filter(([, z]) => z.some((B) => typeof n.props[B] == "function")).map(([z]) => z);
  return !S.includes("click") && Ho(n) && S.push("click"), S.length && (b.events = S), { computed: m, style: E, tokens: y, extra: b, meta: Cg(n), reports: d, childText: Sg(o, R), where: s };
}
function rm(n, i, o, c, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let p = c.cache.get(n);
  (!p || p.key !== d) && c.cache.set(n, p = { key: d, part: zg(n, i, o, c) });
  const { computed: m, tokens: y, extra: _, reports: j, childText: R, where: E } = p.part;
  for (const h of j) c.findings.add(...h);
  const b = (h, H, Z, ot, $) => c.findings.add(h, H, Z, ot, E, $), k = { ...p.part.style }, S = { kind: "div", id: n.id, style: k, tokens: y, meta: p.part.meta, ..._ };
  Object.defineProperty(S, An, { value: m.values.display }), n.measured && n.ownerDocument?.measureKey && (S.measure = n.ownerDocument.measureKey(n));
  const z = n.tagName;
  if (z === "svg")
    return S.kind = n.props["data-perch-image"] ? "image" : "svg", S.markup = Mg(n), S;
  if (z === "input" || z === "textarea" || z === "select") {
    S.kind = "input", S.input_type = z === "input" ? String(n.props.type ?? "text") : z;
    for (const h of ["placeholder", "checked", "disabled"]) n.props[h] !== void 0 && (S[h] = n.props[h]);
    if (/^(checkbox|radio)$/.test(S.input_type) && (S.checked = n.checked), z !== "select" && (S.value = n.value), z === "input" && yg.test(S.input_type) && (S.field_w = xg * m.values["font-size"]), z === "textarea" && k.h === void 0) {
      const h = m.values, H = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, Z = ($) => h[`border-${$}-style`] === "none" ? 0 : H(h[`border-${$}-width`]), ot = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      k.h = ot * Ci(h, c.measure) + H(h["padding-top"]) + H(h["padding-bottom"]) + Z("top") + Z("bottom");
    }
    return S;
  }
  if (z === "img") {
    S.kind = "image", S.src = n.props.src ?? null;
    for (const [h, H] of [["width", "w"], ["height", "h"]]) {
      const Z = Number(n.props[h]);
      k[H] === void 0 && n.props[h] != null && Number.isFinite(Z) && (k[H] = Z);
    }
    return S;
  }
  const B = m.values["text-transform"], N = [];
  let M = !1, Y = !1;
  for (const h of n.childNodes) {
    if (h instanceof Di) {
      if (h.hidden || h.data === "") continue;
      M = !0;
      const ot = N[N.length - 1];
      if (ot?.kind === "text")
        ot.source = (ot.source ?? ot.text) + h.data, ot.text = Ed(ot.source, B), ot.text === ot.source && delete ot.source;
      else {
        const $ = Ed(h.data, B);
        N.push($ === h.data ? { kind: "text", text: $ } : { kind: "text", text: $, source: h.data });
      }
      continue;
    }
    if (!(h instanceof re)) continue;
    const H = rm(h, m, R, c, d), Z = H[An];
    Z === "inline" || Z === "inline-block" || Z === "inline-flex" ? M = !0 : Z !== "none" && (Y = !0), N.push(H);
  }
  const D = N.some((h) => h.kind !== "text"), w = N.length === 1 && N[0].kind !== "text" && /^inline-(block|flex)$/.test(N[0][An]) ? N[0] : null;
  if (!k.display && w) {
    const h = c.cache.get(n.childNodes.find((Z) => Z.id === w.id))?.part.computed, H = h ? Ko(m.values, c.measure) - Tg(h.values, c.measure) : 0;
    k.display = "flex", k.flex_direction = "col", k.items = "start", H > 0 && (w.style.mt = Math.round(((w.style.mt ?? 0) + H) * 100) / 100), b("approximated", "display", `${m.values.display} holding one ${w[An]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!k.display && N.length === 1 && (N[0].kind === "svg" || N[0].kind === "image") && N[0][An] === "inline" && typeof N[0].style.h == "number") {
    const h = N[0], H = Ko(m.values, c.measure), Z = Ci(m.values, c.measure) - H, ot = ($) => Math.round($ * 100) / 100;
    k.display = "flex", k.flex_direction = "col", k.items = "start", H > h.style.h && (h.style.mt = ot((h.style.mt ?? 0) + H - h.style.h)), Z > 0 && (h.style.mb = ot((h.style.mb ?? 0) + Z)), b("approximated", "display", `${m.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!k.display && M && D) {
    if (k.display = "flex", k.flex_direction = Y ? "col" : "row", !Y) k.items = "baseline";
    else for (const h of N) h.kind !== "text" && /^inline-(block|flex)$/.test(h[An]) && !h.style.self && (h.style.self = "start");
    b("approximated", "display", `${m.values.display} with inline content`, "(inline formatting)", Y ? "a column of its children" : "a row on the text baseline");
  }
  const g = m.values["letter-spacing"]?.px;
  if (g)
    for (let h = 0; h < N.length; h++) {
      const H = N[h];
      if (H.kind !== "text") continue;
      const Z = Math.round(g * [...H.text].length * 1e3) / 1e3;
      N[h] = { kind: "div", style: { pr: Z }, tokens: {}, children: [H] };
    }
  return S.children = N, S;
}
function Eg(n, i) {
  if (!i) return null;
  let c = (i.self ? n : i.closest ? Zd(n, i.closest) : i.find ? pl(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return c && i.strip && c.startsWith(i.strip) && (c = c.slice(i.strip.length)), c;
}
function Ng(n, i, o) {
  const c = i.map((p) => [p, Hi(p.selector)]), s = /* @__PURE__ */ new Map(), d = (p) => {
    for (const m of p.children) {
      const y = o.get(m.id);
      if (y)
        for (const [_, j] of c) {
          const R = _.textRange ? "range_name" : "name";
          if (_.textRange && y[R] != null || !j.some((S) => Xd(m, S))) continue;
          const E = Eg(m, _.key), b = E == null ? s.get(_.name) ?? 0 : 0;
          E == null && s.set(_.name, b + 1);
          const k = E != null ? `${_.name}:${E}` : b ? `${_.name}@${b}` : _.name;
          y[R] == null ? y[R] = k : (y.also ??= []).push(k);
        }
      d(m);
    }
  };
  d(n.documentElement);
}
const Mi = 0.9521, om = 0.2256, Ko = (n, i) => (Ci(n, i) - (Mi + om) * n["font-size"]) / 2 + Mi * n["font-size"];
function Tg(n, i) {
  const o = (s) => s && typeof s == "object" && "px" in s ? s.px : 0, c = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]);
  return o(n["padding-top"]) + c + Ko(n, i);
}
const Ed = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, sm = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Cg(n) {
  const i = {};
  for (const [o, c] of Object.entries(n.props)) {
    if (sm.has(o) || typeof c == "function" || c === void 0 || c === null || typeof c == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (c === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    i[d] = typeof c == "boolean" ? s ? String(c) : "" : String(c);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const jg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), Nd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Mg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (o) => {
    const c = [];
    for (const [d, p] of Object.entries(o.props))
      sm.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || c.push(`${jg(d)}="${Nd(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && c.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof Di ? Nd(d.data) : i(d)).join("");
    return `<${o.tagName}${c.length ? ` ${c.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return i(n);
}
function Ag(n) {
  const i = n.theme?.() ?? {}, o = {};
  for (const c of $d) i[c] && (o[c] = i[c]);
  return o;
}
const Og = { font_features: "" };
function Rg(n, i, o, c = {}, s = null) {
  const d = Ag(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([d, p]);
  (c.look !== m || c.sheet !== o) && Object.assign(c, { look: m, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new og(o, { theme: d, viewport: p }), top: null });
  const { cascade: y, cache: _ } = c, j = { cascade: y, cache: _, viewport: p, findings: new vg(), measure: i.lineHeight ? (b) => i.lineHeight(b) : null };
  c.top ??= y.compute(n.body, y.compute(n.documentElement, null));
  const R = n.body.children.map((b) => rm(b, c.top, Og, j));
  if (s?.length) {
    const b = /* @__PURE__ */ new Map(), k = (S) => {
      S.id && b.set(S.id, S);
      for (const z of S.children ?? []) k(z);
    };
    R.forEach(k), Ng(n, s, b);
  }
  const E = /* @__PURE__ */ new Set();
  for (const b of [n, n.defaultView])
    for (const { type: k } of b?.listeners ?? []) vd[k] && E.add(vd[k]);
  return { schema: dg, root: R[0] ?? null, overlays: R.slice(1), document_events: [...E].sort(), unsupported: j.findings.list() };
}
const Hg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Dg = null;
const Ug = () => Dg ??= new ag(Hg);
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
let tn = hl.NoEventPriority;
function Bg(n, i) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const c of o) {
    if (c === "children") continue;
    const s = n[c], d = i[c];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(c === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((m) => s[m] === d[m])))
      return !0;
  }
  return !1;
}
const qg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Td(n, i) {
  for (const o of wh(i.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const Yg = {
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
  createInstance: (n, i, o) => Td(new re(n, i, o.ownerDocument), i),
  createTextInstance: (n, i) => new Di(n),
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
      Td(n, c);
    }
    Bg(o, c) && n.touch();
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
    tn = n;
  },
  getCurrentUpdatePriority: () => tn,
  resolveUpdatePriority: () => tn !== hl.NoEventPriority ? tn : hl.DefaultEventPriority,
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
}, Se = Kh(Yg), Ui = (n, i, o = null) => Se.createPortal(n, i, null, o), Gg = {
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
class Kg {
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
function yi(n, i, o) {
  i.currentTarget = n;
  for (const { type: c, listener: s, capture: d } of [...n.listeners ?? []])
    c === i.type && d === o && s.call(n, i);
  if (n instanceof re) {
    const c = Gg[i.type], s = c && n.props[o ? `${c}Capture` : c];
    typeof s == "function" && s(i);
  }
}
function Cv(n, i, o = {}) {
  const { document: c, window: s, globals: d } = Eh(n), p = new re("div", { id: "root", style: o.container ?? {} }, c);
  c.body.appendChild(p);
  const m = [];
  let y = null;
  const _ = () => [c, s].map((w) => w.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let j = "";
  const R = {}, E = `m${Math.random().toString(36).slice(2, 10)}:`;
  let b = 0, k = -1;
  c.measureKey = (w) => E + w.id, c.stale = () => k !== b;
  const S = () => (b += 1, y = Rg(c, n, Ug(), R, o.names), j = _(), n.render?.(y), y), z = () => {
    Se.flushPassiveEffects(), Se.flushSyncWork(), _() !== j && S();
  };
  c.afterCommit = S;
  const B = (w) => {
    m.push(w), n.error?.(w);
  }, N = Se.createContainer(p, hl.ConcurrentRoot, null, !1, null, "", B, B, B, null);
  Se.updateContainerSync(ft.createElement(i, o.props ?? {}), N, null, null), Se.flushSyncWork(), z();
  const M = (w) => {
    const g = (h) => {
      if (h.id === w) return h;
      for (const H of h.children) {
        const Z = g(H);
        if (Z) return Z;
      }
      return null;
    };
    return g(c.documentElement);
  }, Y = (w) => {
    const g = tn;
    tn = hl.DiscreteEventPriority;
    try {
      return w();
    } finally {
      tn = g, Se.flushSyncWork(), z();
    }
  }, D = {
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
    describe: S,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(w, g, h = {}) {
      const H = typeof w == "string" ? M(w) : w;
      if (!H) return !1;
      const Z = new Kg(g, h, H), ot = [];
      for (let wt = H; wt; wt = wt.parentNode) ot.push(wt);
      const $ = [...ot, c, s];
      Y(() => {
        for (let wt = $.length - 1; wt > 0 && !Z.propagationStopped; wt--) yi($[wt], Z, !0);
        Z.propagationStopped || (yi(H, Z, !0), Z.propagationStopped || yi(H, Z, !1));
        for (let wt = 1; wt < $.length && !Z.propagationStopped; wt++) yi($[wt], Z, !1);
      });
      const Et = g === "click" && !Z.defaultPrevented ? Ho(H) : null;
      return Et && D.dispatch(Et, "submit", {}), !Z.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(w) {
      const g = c.activeElement && c.activeElement !== c.body ? c.activeElement : c.body;
      if (!D.dispatch(g, "keydown", w)) return !0;
      const H = w.key === "Enter" && !w.isComposing ? Ho(g, !0) : null;
      if (H)
        return D.dispatch(H, "submit", {}), !0;
      if (!Fd(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((w.ctrlKey || w.metaKey) && !w.altKey && !w.shiftKey && w.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (w.ctrlKey || w.metaKey) return !1;
      const Z = g.selectedAll;
      g.selectedAll = !1;
      const ot = g.value, Et = w.key === "Backspace" || Z && w.key === "Delete" ? Z ? "" : ot.slice(0, -1) : [...w.key].length === 1 ? (Z ? "" : ot) + w.key : ot;
      return Et === ot ? !1 : (g.value = Et, D.dispatch(g, "input", { data: w.key }), D.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), S(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(w, g) {
      const h = M(w);
      h && (h.bounds = { x: g.x, y: g.y, width: g.width, height: g.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(w) {
      const g = M(w);
      if (!g || g.props.disabled || !D.dispatch(w, "click", { button: 0, detail: 1 })) return;
      const h = g.props.type === "radio";
      h && g.checked || (g.checked = h ? !0 : !g.checked, D.dispatch(w, "input", {}), D.dispatch(w, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), S());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(w, g = {}) {
      const h = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const H of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) D.dispatch(w, H, h);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (w) => !!M(w)?.state.hover,
    hover(w, g) {
      const h = M(w);
      !h || h.state.hover === g || (h.state.hover = g, h.touch(), S());
    },
    focus(w) {
      const g = M(w);
      g && (Y(() => {
        const h = c.activeElement;
        h && h !== g && h !== c.body && D.dispatch(h, "blur"), c.focus(g), D.dispatch(g, "focus");
      }), S());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(w) {
      let h = typeof w == "string" ? M(w) : w;
      for (; h && !(h instanceof re && typeof h.props.onKeyDown == "function" && qg(h)); ) h = h.parentNode;
      !h || h === c.activeElement || (D.focus(h.id), h.state.pointerFocus = !0, h.touch(), S());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return k = b, c.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const w = c.retries.splice(0);
      for (const g of w) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: z,
    update(w) {
      Se.updateContainerSync(ft.createElement(i, w ?? {}), N, null, null), Se.flushSyncWork(), z();
    },
    unmount() {
      Se.updateContainerSync(null, N, null, null), Se.flushSyncWork(), Se.flushPassiveEffects(), c.afterCommit = null, c.retries.length = 0, n.forgetBounds?.(E);
    }
  };
  return D;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const cm = (n) => Se.flushSyncFromReconciler(n), Qg = { createPortal: Ui, flushSync: cm }, jv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Ui,
  default: Qg,
  flushSync: cm
}, Symbol.toStringTag, { value: "Module" }));
function um(n) {
  var i, o, c = "";
  if (typeof n == "string" || typeof n == "number") c += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (i = 0; i < s; i++) n[i] && (o = um(n[i])) && (c && (c += " "), c += o);
  } else for (o in n) n[o] && (c && (c += " "), c += o);
  return c;
}
function dm() {
  for (var n, i, o = 0, c = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (i = um(n)) && (c && (c += " "), c += i);
  return c;
}
const Vg = (n, i) => {
  const o = new Array(n.length + i.length);
  for (let c = 0; c < n.length; c++)
    o[c] = n[c];
  for (let c = 0; c < i.length; c++)
    o[n.length + c] = i[c];
  return o;
}, Xg = (n, i) => ({
  classGroupId: n,
  validator: i
}), mm = (n = /* @__PURE__ */ new Map(), i = null, o) => ({
  nextPart: n,
  validators: i,
  classGroupId: o
}), Ai = "-", Cd = [], Zg = "arbitrary..", Jg = (n) => {
  const i = Wg(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: c
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return Lg(p);
      const m = p.split(Ai), y = m[0] === "" && m.length > 1 ? 1 : 0;
      return fm(m, y, i);
    },
    getConflictingClassGroupIds: (p, m) => {
      if (m) {
        const y = c[p], _ = o[p];
        return y ? _ ? Vg(_, y) : y : _ || Cd;
      }
      return o[p] || Cd;
    }
  };
}, fm = (n, i, o) => {
  if (n.length - i === 0)
    return o.classGroupId;
  const s = n[i], d = o.nextPart.get(s);
  if (d) {
    const _ = fm(n, i + 1, d);
    if (_) return _;
  }
  const p = o.validators;
  if (p === null)
    return;
  const m = i === 0 ? n.join(Ai) : n.slice(i).join(Ai), y = p.length;
  for (let _ = 0; _ < y; _++) {
    const j = p[_];
    if (j.validator(m))
      return j.classGroupId;
  }
}, Lg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), o = i.indexOf(":"), c = i.slice(0, o);
  return c ? Zg + c : void 0;
})(), Wg = (n) => {
  const {
    theme: i,
    classGroups: o
  } = n;
  return Fg(o, i);
}, Fg = (n, i) => {
  const o = mm();
  for (const c in n) {
    const s = n[c];
    ts(s, o, c, i);
  }
  return o;
}, ts = (n, i, o, c) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const p = n[d];
    Ig(p, i, o, c);
  }
}, Ig = (n, i, o, c) => {
  if (typeof n == "string") {
    $g(n, i, o);
    return;
  }
  if (typeof n == "function") {
    Pg(n, i, o, c);
    return;
  }
  t0(n, i, o, c);
}, $g = (n, i, o) => {
  const c = n === "" ? i : pm(i, n);
  c.classGroupId = o;
}, Pg = (n, i, o, c) => {
  if (e0(n)) {
    ts(n(c), i, o, c);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(Xg(o, n));
}, t0 = (n, i, o, c) => {
  const s = Object.entries(n), d = s.length;
  for (let p = 0; p < d; p++) {
    const [m, y] = s[p];
    ts(y, pm(i, m), o, c);
  }
}, pm = (n, i) => {
  let o = n;
  const c = i.split(Ai), s = c.length;
  for (let d = 0; d < s; d++) {
    const p = c[d];
    let m = o.nextPart.get(p);
    m || (m = mm(), o.nextPart.set(p, m)), o = m;
  }
  return o;
}, e0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, a0 = (n) => {
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
}, Qo = "!", jd = ":", n0 = [], Md = (n, i, o, c, s) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: o,
  maybePostfixModifierPosition: c,
  isExternal: s
}), l0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: o
  } = n;
  let c = (s) => {
    const d = [];
    let p = 0, m = 0, y = 0, _;
    const j = s.length;
    for (let S = 0; S < j; S++) {
      const z = s[S];
      if (p === 0 && m === 0) {
        if (z === jd) {
          d.push(s.slice(y, S)), y = S + 1;
          continue;
        }
        if (z === "/") {
          _ = S;
          continue;
        }
      }
      z === "[" ? p++ : z === "]" ? p-- : z === "(" ? m++ : z === ")" && m--;
    }
    const R = d.length === 0 ? s : s.slice(y);
    let E = R, b = !1;
    R.endsWith(Qo) ? (E = R.slice(0, -1), b = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      R.startsWith(Qo) && (E = R.slice(1), b = !0)
    );
    const k = _ && _ > y ? _ - y : void 0;
    return Md(d, b, E, k);
  };
  if (i) {
    const s = i + jd, d = c;
    c = (p) => p.startsWith(s) ? d(p.slice(s.length)) : Md(n0, !1, p, void 0, !0);
  }
  if (o) {
    const s = c;
    c = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return c;
}, i0 = (n) => {
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
}, r0 = (n) => ({
  cache: a0(n.cacheSize),
  parseClassName: l0(n),
  sortModifiers: i0(n),
  postfixLookupClassGroupIds: o0(n),
  ...Jg(n)
}), o0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let c = 0; c < o.length; c++)
      i[o[c]] = !0;
  return i;
}, s0 = /\s+/, c0 = (n, i) => {
  const {
    parseClassName: o,
    getClassGroupId: c,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, m = [], y = n.trim().split(s0);
  let _ = "";
  for (let j = y.length - 1; j >= 0; j -= 1) {
    const R = y[j], {
      isExternal: E,
      modifiers: b,
      hasImportantModifier: k,
      baseClassName: S,
      maybePostfixModifierPosition: z
    } = o(R);
    if (E) {
      _ = R + (_.length > 0 ? " " + _ : _);
      continue;
    }
    let B = !!z, N;
    if (B) {
      const g = S.substring(0, z);
      N = c(g);
      const h = N && p[N] ? c(S) : void 0;
      h && h !== N && (N = h, B = !1);
    } else
      N = c(S);
    if (!N) {
      if (!B) {
        _ = R + (_.length > 0 ? " " + _ : _);
        continue;
      }
      if (N = c(S), !N) {
        _ = R + (_.length > 0 ? " " + _ : _);
        continue;
      }
      B = !1;
    }
    const M = b.length === 0 ? "" : b.length === 1 ? b[0] : d(b).join(":"), Y = k ? M + Qo : M, D = Y + N;
    if (m.indexOf(D) > -1)
      continue;
    m.push(D);
    const w = s(N, B);
    for (let g = 0; g < w.length; ++g) {
      const h = w[g];
      m.push(Y + h);
    }
    _ = R + (_.length > 0 ? " " + _ : _);
  }
  return _;
}, u0 = (...n) => {
  let i = 0, o, c, s = "";
  for (; i < n.length; )
    (o = n[i++]) && (c = hm(o)) && (s && (s += " "), s += c);
  return s;
}, hm = (n) => {
  if (typeof n == "string")
    return n;
  let i, o = "";
  for (let c = 0; c < n.length; c++)
    n[c] && (i = hm(n[c])) && (o && (o += " "), o += i);
  return o;
}, d0 = (n, ...i) => {
  let o, c, s, d;
  const p = (y) => {
    const _ = i.reduce((j, R) => R(j), n());
    return o = r0(_), c = o.cache.get, s = o.cache.set, d = m, m(y);
  }, m = (y) => {
    const _ = c(y);
    if (_)
      return _;
    const j = c0(y, o);
    return s(y, j), j;
  };
  return d = p, (...y) => d(u0(...y));
}, m0 = [], Zt = (n) => {
  const i = (o) => o[n] || m0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, gm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, bm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, f0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, p0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, h0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, g0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, b0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, v0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, ja = (n) => f0.test(n), pt = (n) => !!n && !Number.isNaN(Number(n)), Ze = (n) => !!n && Number.isInteger(Number(n)), Mo = (n) => n.endsWith("%") && pt(n.slice(0, -1)), sa = (n) => p0.test(n), vm = () => !0, y0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  h0.test(n) && !g0.test(n)
), es = () => !1, x0 = (n) => b0.test(n), w0 = (n) => v0.test(n), _0 = (n) => !W(n) && !F(n), S0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), k0 = (n) => Oa(n, wm, es), W = (n) => gm.test(n), Pa = (n) => Oa(n, _m, y0), Ad = (n) => Oa(n, A0, pt), z0 = (n) => Oa(n, km, vm), E0 = (n) => Oa(n, Sm, es), Od = (n) => Oa(n, ym, es), N0 = (n) => Oa(n, xm, w0), xi = (n) => Oa(n, zm, x0), F = (n) => bm.test(n), ml = (n) => an(n, _m), T0 = (n) => an(n, Sm), Rd = (n) => an(n, ym), C0 = (n) => an(n, wm), j0 = (n) => an(n, xm), wi = (n) => an(n, zm, !0), M0 = (n) => an(n, km, !0), Oa = (n, i, o) => {
  const c = gm.exec(n);
  return c ? c[1] ? i(c[1]) : o(c[2]) : !1;
}, an = (n, i, o = !1) => {
  const c = bm.exec(n);
  return c ? c[1] ? i(c[1]) : o : !1;
}, ym = (n) => n === "position" || n === "percentage", xm = (n) => n === "image" || n === "url", wm = (n) => n === "length" || n === "size" || n === "bg-size", _m = (n) => n === "length", A0 = (n) => n === "number", Sm = (n) => n === "family-name", km = (n) => n === "number" || n === "weight", zm = (n) => n === "shadow", O0 = () => {
  const n = Zt("color"), i = Zt("font"), o = Zt("text"), c = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), m = Zt("container"), y = Zt("spacing"), _ = Zt("radius"), j = Zt("shadow"), R = Zt("inset-shadow"), E = Zt("text-shadow"), b = Zt("drop-shadow"), k = Zt("blur"), S = Zt("perspective"), z = Zt("aspect"), B = Zt("ease"), N = Zt("animate"), M = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], Y = () => [
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
  ], D = () => [...Y(), F, W], w = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [F, W, y], H = () => [ja, "full", "auto", ...h()], Z = () => [Ze, "none", "subgrid", F, W], ot = () => ["auto", {
    span: ["full", Ze, F, W]
  }, Ze, F, W], $ = () => [Ze, "auto", F, W], Et = () => ["auto", "min", "max", "fr", F, W], wt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], jt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...h()], at = () => [ja, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], nt = () => [m, ja, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], U = () => [ja, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], q = () => [n, F, W], v = () => [...Y(), Rd, Od, {
    position: [F, W]
  }], G = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", C0, k0, {
    size: [F, W]
  }], P = () => [Mo, ml, Pa], tt = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    _,
    F,
    W
  ], lt = () => ["", pt, ml, Pa], xt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ut = () => [pt, Mo, Rd, Od], Ra = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    k,
    F,
    W
  ], Ha = () => ["none", pt, F, W], Ae = () => ["none", pt, F, W], Oe = () => [pt, F, W], da = () => [ja, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [sa],
      breakpoint: [sa],
      color: [vm],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [_0],
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
        aspect: ["auto", "square", ja, W, F, z]
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
      "container-named": [S0],
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
        "break-after": M()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": M()
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
        overflow: w()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": w()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": w()
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
        inset: H()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": H()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": H()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": H(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: H()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": H(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: H()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": H()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": H()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: H()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: H()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: H()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: H()
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
        basis: [ja, "full", "auto", m, ...h()]
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
        flex: [pt, ja, "auto", "initial", "none", W]
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
        "grid-cols": Z()
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
        "col-start": $()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": $()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": Z()
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
        "row-start": $()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": $()
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
        "auto-cols": Et()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": Et()
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
        justify: [...wt(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...jt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...jt()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...wt()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...jt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...jt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": wt()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...jt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...jt()]
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
        m: Q()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: Q()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: Q()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: Q()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: Q()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: Q()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: Q()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: Q()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: Q()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: Q()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: Q()
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
        size: at()
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
        w: [m, "screen", ...at()]
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
          ...at()
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
          ...at()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...at()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...at()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...at()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", o, ml, Pa]
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
        font: [c, M0, z0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Mo, W]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [T0, E0, i]
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
        "line-clamp": [pt, "none", F, Ad]
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
        decoration: [...xt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [pt, "from-font", "auto", F, Pa]
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
        bg: et()
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
        }, j0, N0]
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
        from: P()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: P()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: P()
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
        rounded: tt()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": tt()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": tt()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": tt()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": tt()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": tt()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": tt()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": tt()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": tt()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": tt()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": tt()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": tt()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": tt()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": tt()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": tt()
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
        outline: ["", pt, ml, Pa]
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
          j,
          wi,
          xi
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
        "inset-shadow": ["none", R, wi, xi]
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
        ring: q()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [pt, Pa]
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
        "inset-ring": lt()
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
        "text-shadow": ["none", E, wi, xi]
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
        "mask-linear-from": q()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": q()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": ut()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": ut()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": q()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": q()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": ut()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": ut()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": q()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": q()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": ut()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": ut()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": q()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": q()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": ut()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": ut()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": q()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": q()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": ut()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": ut()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": q()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": q()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": ut()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": ut()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": q()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": q()
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
        "mask-radial-at": Y()
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
        mask: G()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: et()
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
        blur: Ra()
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
          b,
          wi,
          xi
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
        "backdrop-blur": Ra()
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
        ease: ["linear", "initial", B, F, W]
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
        perspective: [S, F, W]
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
        rotate: Ha()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Ha()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Ha()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Ha()
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
        translate: da()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": da()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": da()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": da()
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
        fill: ["none", ...q()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [pt, ml, Pa, Ad]
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
}, R0 = /* @__PURE__ */ d0(O0);
function je(...n) {
  return R0(dm(n));
}
const Em = typeof navigator < "u" && /Mac/i.test(navigator.platform), Oi = {
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
for (let n = 1; n <= 12; n++) Oi[`f${n}`] = `F${n}`;
const H0 = Object.fromEntries(Object.entries(Oi).map(([n, i]) => [i, n])), D0 = {
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
function U0(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : H0[n];
}
const Hd = /* @__PURE__ */ new Map();
function Nm(n, i = Em) {
  const o = `${i}|${n}`, c = Hd.get(o);
  if (c) return c;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      i ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (Oi[d]) s.code = Oi[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Hd.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = Nm(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function B0(n, i = Em) {
  const o = Nm(n, i), c = q0(U0(o.code) ?? "");
  return i ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${c}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", c].filter(Boolean).join("+");
}
const q0 = (n) => D0[n] ?? n.toUpperCase(), Dd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Ud = dm, Bi = (n, i) => (o) => {
  var c;
  if (i?.variants == null) return Ud(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = i, p = Object.keys(s).map((_) => {
    const j = o?.[_], R = d?.[_];
    if (j === null) return null;
    const E = Dd(j) || Dd(R);
    return s[_][E];
  }), m = o && Object.entries(o).reduce((_, j) => {
    let [R, E] = j;
    return E === void 0 || (_[R] = E), _;
  }, {}), y = i == null || (c = i.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((_, j) => {
    let { class: R, className: E, ...b } = j;
    return Object.entries(b).every((k) => {
      let [S, z] = k;
      return Array.isArray(z) ? z.includes({
        ...d,
        ...m
      }[S]) : {
        ...d,
        ...m
      }[S] === z;
    }) ? [
      ..._,
      R,
      E
    ] : _;
  }, []);
  return Ud(n, p, y, o?.class, o?.className);
}, Y0 = Bi(
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
), G0 = Bi(
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
function K0({ className: n, ...i } = {}) {
  return je(G0(i), n);
}
const Tm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Cm = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Q0 = Bi(`${Cm} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function V0({ className: n, ...i } = {}) {
  return je(Q0(i), n);
}
const jm = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", X0 = Bi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Z0 = "my-1 h-px bg-overlay-0";
function J0({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function L0({ size: n = 16, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function W0({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Mm({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Bd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function F0({ state: n, error: i }) {
  return /* @__PURE__ */ zt.jsx(
    "span",
    {
      className: je("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Bd[n] ?? Bd.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function I0({ title: n, onClose: i, children: o, testId: c }) {
  return Ui(
    /* @__PURE__ */ zt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && i();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && i();
        },
        children: /* @__PURE__ */ zt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": c,
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
const _i = 4, Ma = 8, $0 = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", qd = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function P0({ value: n, onChange: i, options: o, className: c, ariaLabel: s, testId: d, id: p, title: m, disabled: y, placeholder: _, freeText: j, onKeyDown: R }) {
  const E = ft.useId(), [b, k] = ft.useState(!1), [S, z] = ft.useState(-1), [B, N] = ft.useState(!1), M = ft.useRef(null), Y = ft.useRef(null), [D, w] = ft.useState({}), g = ft.useRef({ text: "", at: 0 }), h = j && B && n ? o.filter((U) => qd(U).toLowerCase().includes(n.toLowerCase()) || U.value.toLowerCase().includes(n.toLowerCase())) : o, H = o.find((U) => U.value === n), Z = (U) => `${E}-${U}`;
  function ot(U) {
    y || (z(U), k(!0));
  }
  function $() {
    k(!1), N(!1), z(-1);
  }
  function Et(U) {
    !U || U.disabled || (i(U.value), $());
  }
  function wt(U, q) {
    for (let v = 1; v <= h.length; v++) {
      const G = (U + q * v + h.length * v) % h.length;
      if (!h[G].disabled) return G;
    }
    return U;
  }
  const jt = () => h.findIndex((U) => !U.disabled), Q = () => h.length - 1 - [...h].reverse().findIndex((U) => !U.disabled);
  Do(() => {
    if (!b || !M.current) {
      w((et) => et.left === void 0 ? et : {});
      return;
    }
    const U = M.current.getBoundingClientRect(), q = window.innerHeight - U.bottom - _i - Ma, v = U.top - _i - Ma, G = q < 160 && v > q;
    w({
      position: "fixed",
      left: Math.min(Math.max(Ma, U.left), Math.max(Ma, window.innerWidth - U.width - Ma)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: U.width,
      maxWidth: window.innerWidth - 2 * Ma,
      maxHeight: Math.min(G ? v : q, 320),
      ...G ? { bottom: window.innerHeight - U.top + _i } : { top: U.bottom + _i },
      overflowY: "auto"
    });
  }, [b, h.length]), Do(() => {
    const U = Y.current;
    if (!b || !U || D.left === void 0) return;
    const q = U.getBoundingClientRect().right, v = window.innerWidth - Ma;
    q > v && w((G) => ({ ...G, left: Math.max(Ma, Number(G.left) - (q - v)) }));
  }, [b, D]), ua(() => {
    if (!b) return;
    const U = (q) => {
      const v = q.target;
      (v === document || v instanceof Node && M.current && v.contains(M.current)) && $();
    };
    return window.addEventListener("resize", $), window.addEventListener("scroll", U, !0), () => {
      window.removeEventListener("resize", $), window.removeEventListener("scroll", U, !0);
    };
  }, [b]), ua(() => {
    const U = b && S >= 0 ? document.getElementById(Z(S)) : null, q = Y.current;
    !U || !q || (U.offsetTop < q.scrollTop ? q.scrollTop = U.offsetTop : U.offsetTop + U.offsetHeight > q.scrollTop + q.clientHeight && (q.scrollTop = U.offsetTop + U.offsetHeight - q.clientHeight));
  }, [b, S]), Om(b, (U) => {
    U || $();
  }, M, Y);
  function at(U) {
    if (U.nativeEvent.isComposing) return;
    const q = () => {
      U.preventDefault(), U.stopPropagation();
    }, { key: v } = U;
    if (b) {
      if (v === "Escape") {
        q(), $();
        return;
      } else if (v === "Tab")
        $();
      else if (v === "ArrowDown" || v === "ArrowUp") {
        q(), h.length && z(S < 0 ? v === "ArrowDown" ? jt() : Q() : wt(S, v === "ArrowDown" ? 1 : -1));
        return;
      } else if (v === "Home" && !j) {
        q(), z(jt());
        return;
      } else if (v === "End" && !j) {
        q(), z(Q());
        return;
      } else if (v === "Enter" || v === " " && !j) {
        if (S >= 0 && h[S]) {
          q(), Et(h[S]);
          return;
        }
        if (!j) {
          q(), $();
          return;
        }
      } else if (!j && v.length === 1 && !U.metaKey && !U.ctrlKey && !U.altKey) {
        const G = Date.now();
        g.current = { text: (G - g.current.at > 600 ? "" : g.current.text) + v.toLowerCase(), at: G };
        const et = Math.max(S, 0), P = [...h.slice(et + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, et + 1)].find((tt) => !tt.disabled && qd(tt).toLowerCase().startsWith(g.current.text));
        P && (q(), z(h.indexOf(P)));
        return;
      }
    } else if (v === "ArrowDown" || v === "ArrowUp" || !j && (v === "Enter" || v === " ")) {
      q(), ot(Math.max(0, h.findIndex((G) => G.value === n)));
      return;
    }
    R?.(U);
  }
  const nt = {
    ref: (U) => {
      M.current = U;
    },
    id: p,
    title: m,
    disabled: y,
    "aria-label": s,
    "aria-expanded": b,
    "aria-controls": b ? E : void 0,
    "aria-activedescendant": b && S >= 0 ? Z(S) : void 0,
    "data-testid": d,
    onKeyDown: at
  };
  return /* @__PURE__ */ zt.jsxs(zt.Fragment, { children: [
    j ? /* @__PURE__ */ zt.jsx(
      "input",
      {
        ...nt,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: _,
        className: c,
        value: n,
        onChange: (U) => {
          i(U.target.value), N(!0), b ? z(-1) : (z(-1), k(!0));
        },
        onBlur: () => $()
      }
    ) : /* @__PURE__ */ zt.jsxs(
      "button",
      {
        ...nt,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: je("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", c),
        onClick: () => b ? $() : ot(Math.max(0, h.findIndex((U) => U.value === n))),
        children: [
          /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 flex-1 truncate", children: H ? H.label : _ ?? "" }),
          /* @__PURE__ */ zt.jsx(Am, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    b && h.length > 0 && Ui(
      /* @__PURE__ */ zt.jsx(
        "div",
        {
          ref: Y,
          id: E,
          role: "listbox",
          "aria-label": s,
          className: je("z-[9999]", jm),
          style: D,
          onMouseDown: (U) => {
            U.preventDefault(), U.stopPropagation();
          },
          onClick: (U) => U.stopPropagation(),
          children: h.map((U, q) => /* @__PURE__ */ zt.jsxs(
            "div",
            {
              id: Z(q),
              role: "option",
              "aria-selected": U.value === n,
              "aria-disabled": U.disabled || void 0,
              "data-value": U.value,
              className: je($0, q === S && !U.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                U.disabled || z(q);
              },
              onClick: () => Et(U),
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
const tb = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", eb = `${tb} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function Am({ open: n, size: i = 12, className: o }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: o, width: i, height: i, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function ab(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Vo = {
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
function Xo(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((o) => o.id === n.parentSessionId);
}
function nb(n) {
  const i = /* @__PURE__ */ new Map();
  for (const o of n)
    Xo(o, n) && i.set(o.parentSessionId, [...i.get(o.parentSessionId) ?? [], o]);
  return i.size ? n.filter((o) => !Xo(o, n)).flatMap((o) => [o, ...i.get(o.id) ?? []]) : n;
}
const Si = 6, Yd = 8;
function lb(n, i = {}) {
  const { minWidth: o = 220, align: c = "right", minSpaceAbove: s = 100 } = i, d = n.getBoundingClientRect(), p = window.innerWidth, m = window.innerHeight, y = c === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, _ = d.top - Si - Yd, j = m - d.bottom - Si - Yd;
  return _ >= s ? {
    position: "fixed",
    bottom: m - d.top + Si,
    ...y,
    minWidth: o,
    maxHeight: Math.min(_, m * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Si,
    ...y,
    minWidth: o,
    maxHeight: Math.min(j, m * 0.75),
    overflowY: "auto"
  };
}
function Om(n, i, o, c) {
  ua(() => {
    if (!n) return;
    function s(p) {
      const m = p.target, y = o.current?.contains(m) ?? !1, _ = c.current?.contains(m) ?? !1;
      !y && !_ && i(!1);
    }
    function d(p) {
      p.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function ib({ icon: n, fallback: i }) {
  const [o, c] = ft.useState(!1);
  return ua(() => c(!1), [n]), !n || o ? /* @__PURE__ */ zt.jsx(zt.Fragment, { children: i }) : /* @__PURE__ */ zt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => c(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const rb = "1.3.0";
let Ei = null;
const ob = (n) => {
  Ei = n;
};
function Nt() {
  const n = (typeof Ei == "function" ? Ei() : Ei) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const sb = (n) => Nt().subscribe?.(n) ?? (() => {
}), cb = lb, ub = globalThis.perch?.isMac !== !1, db = (n) => B0(n, Nt().isMac !== !1), mb = (n) => Y0(n), fb = ({ className: n, ...i } = {}) => je(K0(i), n), pb = V0, hb = (n) => X0(n), gb = Z0, bb = Cm, vb = Tm, yb = (n) => Vo[n].color, xb = (n, i) => Nt().shortcutFor?.(n, i) ?? null, wb = (n) => Nt().shortcutLabel?.(n) ?? null, qi = (n, i) => Nt().command(n, i ?? {}) !== !1, _b = (n, i, o) => Nt().startSession?.(n, i, o), Sb = globalThis.perch?.pickFolder ? (n) => Nt().pickFolder(n) : null;
function fe(n) {
  const i = ft.useRef(n);
  return i.current = n, ft.useSyncExternalStore(sb, () => i.current(Nt()));
}
const Rm = (n = {}) => fe((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), kb = () => fe((n) => n.hosts()), zb = () => fe((n) => n.sessionFolders());
function Eb() {
  const n = fe((i) => i.addProject?.() ?? Nb);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, o, c) => {
      i.trim() && n.status !== "pending" && Nt().addProjectFolder?.(i, o, c);
    },
    clear: () => Nt().clearAddProject?.()
  };
}
const Nb = Object.freeze({ status: "idle" }), Hm = "perch.lastAgentChoice", Tb = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Cb = () => {
  const n = Nt().storage?.getItem(Hm);
  return n === "claude" || n === "codex" ? n : "claude";
}, jb = Object.freeze({ items: [] });
function Mb() {
  const n = fe((i) => i.notifications?.() ?? jb);
  return ft.useMemo(() => ({
    items: n.items ?? [],
    open: (i) => Nt().command("notification.open", { id: i }),
    dismiss: (i) => Nt().command("notification.dismiss", { id: i })
  }), [n]);
}
function Ab(n) {
  const i = fe((s) => s.agentChoices?.(n) ?? Tb), [o, c] = ft.useState(Cb);
  return ft.useMemo(() => ({
    connected: !!i.connected,
    discovery: !!i.discovery,
    choices: i.choices ?? [],
    lastChoice: o,
    state: i.state ?? "ready",
    error: i.state === "error" ? i.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (Nt().storage?.setItem(Hm, s), c(s));
    },
    manage: () => Nt().command("agents.manage", {})
  }), [i, o]);
}
function Ob(n) {
  ua(() => Nt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Rb(n) {
  const i = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return nb(i).map((o) => ({ session: o.session, nested: Xo(o, i) }));
}
function Hb({ id: n, plain: i, className: o }) {
  const c = fe((_) => _.session(n));
  if (!c) return null;
  const s = c.state ?? ab(c), d = Vo[s]?.color ?? Vo.unknown.color, p = c.provider, m = p === "claude" || p === "claude-agent-teams" || p === "omp", y = i ? je("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : je("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return ft.createElement(
    "span",
    { className: y, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    ft.createElement("span", { className: je("inline-flex text-fg", m && "rounded-full bg-[#161616]") }, ft.createElement(Dm, { provider: p, size: 14 }))
  );
}
function Dm({ provider: n, size: i = 14 }) {
  const o = Nt().agentIcon?.(n, i) ?? null, c = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ft.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": c, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Db = ({ children: n }) => ft.createElement(ft.Fragment, null, n);
function Ub(n, i) {
  const o = ft.useRef(i);
  return o.current = i, ua(() => {
    const c = Nt();
    if (!c.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [p, m] of Object.entries(o.current))
      s[p] = typeof m == "function" ? (...y) => o.current[p]?.(...y) : m;
    const d = c.openOverlay(n, s);
    return () => c.closeOverlay?.(d);
  }, [n]), null;
}
const nn = (n) => function(o) {
  return Ub(n, o);
}, Bb = nn("session-menu"), qb = nn("new-session-menu"), Yb = nn("confirm");
let Um = null;
const Gb = (n) => {
  Um = n;
};
function Kb(n) {
  return ft.createElement(Um ?? Yb, n);
}
function Qb({ className: n = eb, ...i }) {
  return ft.createElement(P0, { ...i, className: n });
}
let Zo = null;
const Vb = (n) => {
  Zo = n;
}, Xb = nn("folder-browser");
function Zb(n) {
  return Zo ? ft.createElement(Zo, { ...n, browse: (i) => Nt().browse(n.hostId, i) }) : ft.createElement(Xb, n);
}
const Jb = nn("instructions"), Lb = nn("memory"), Wb = I0;
let as = null;
const Fb = (n) => {
  as = n;
};
function Ib(n) {
  if (as) return ft.createElement($b, n);
  const { hostId: i, path: o, className: c } = n, s = ft.useRef(null);
  return ft.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: je("worktree-menu__btn", Tm, c),
      "data-testid": `worktree-menu-${i}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Nt().openOverlay?.("worktree", { hostId: i, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    ft.createElement(Mm, null)
  );
}
const Bm = "Perch did not answer.";
function ki(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Bm };
}
function $b({ hostId: n, path: i, className: o, worktrees: c, request: s = null, parentChoices: d, emptyAgent: p, ...m }) {
  const [y, _] = ft.useState(c), j = (M) => !!Nt().coreCan?.(M, n), R = Rm(), E = ft.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!j("workspace.nest")) return [];
    const M = R?.projects?.find((w) => w.hostId === n && w.repoPath === i), Y = [], D = (w, g) => {
      for (const h of w ?? [])
        g && Y.push({ id: h.id, name: h.name, path: h.path }), D(h.children, !0);
    };
    return D(M?.workspaces, !1), Y;
  }, [d, R, n, i]), b = !1, k = m.deleteSupported ?? j("worktree.delete"), S = m.startFromSupported ?? j("worktree.startFrom"), [z, B] = ft.useState(s), N = ft.useMemo(() => {
    const M = (Y, D) => Nt().ask(Y, { hostId: n, repoPath: i, ...D });
    return {
      list: async () => {
        const Y = await M("worktree.list", {});
        return Y?.type === "worktree.list.result" && _({ worktrees: Y.worktrees ?? [], defaultRoot: Y.defaultRoot ?? "", baseRef: Y.baseRef, refs: Y.refs ?? [] }), ki(Y);
      },
      create: async ({ branch: Y, newBranch: D, path: w, extra: g, agent: h }) => {
        const H = await M("worktree.create", { branch: Y, newBranch: !!D, path: w ?? null, name: g?.name ?? null, startFrom: g?.startFrom ?? null, parentWorkspaceId: g?.parentWorkspaceId ?? null });
        return H?.type !== "worktree.done" ? { error: ki(H).error ?? Bm } : (h && H.path && Nt().startSession?.(n, H.path, h), {});
      },
      remove: async (Y, D) => {
        const w = await M("worktree.remove", { path: Y, force: !!D, deleteBranch: k });
        return { ...ki(w), preservedBranch: w?.type === "worktree.done" ? w.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (Y, D) => ki(await M("worktree.branch.delete", { branch: Y, expectedHead: D })),
      open: (Y) => Nt().startSession?.(n, Y, "terminal"),
      takeRequest: () => B(null)
    };
  }, [n, i, k]);
  return ft.createElement(as, {
    hostId: n,
    cwd: i,
    projectKey: `${n}:${i}`,
    className: o,
    worktrees: y,
    background: b,
    startFromSupported: S,
    deleteSupported: k,
    parentChoices: E,
    emptyAgent: p,
    request: z,
    actions: N
  });
}
const Pb = (n, i) => Nt().beginReorderDrag?.(n, i), tv = () => fe((n) => n.workspaceTabs()), ev = () => fe((n) => n.statusLine()), av = () => fe((n) => n.zoom()), nv = () => fe((n) => n.paneLook()), lv = () => fe((n) => n.keybindings?.() ?? []), iv = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function rv(n) {
  const i = !!n?.keepFresh, o = fe((s) => s.statusLine?.().connected ?? !1), c = fe((s) => s.planUsage?.() ?? iv);
  return ua(() => {
    if (!i || !o) return;
    let s;
    const d = () => {
      Nt().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [i, o]), c;
}
const ov = () => Nt().command("usage.get", { force: !0 }), sv = (n) => Nt().command("usage.redeemReset", { accountId: n }), cv = () => qi("app.zoom_reset"), uv = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, dv = (n, i, o) => Nt().beginTabDrag?.(n, i, o);
function mv(n) {
  ua(() => Nt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const fv = (n) => qi("browser.open", { workspaceId: n }), pv = (n, i) => qi("file.open", { workspaceId: n, path: i }), hv = () => null, gv = () => null, bv = nn("new-file"), Mv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Dm,
  Chevron: Am,
  CloseIcon: W0,
  ConfirmDialog: Kb,
  Dialog: Wb,
  EllipsisIcon: J0,
  FolderBrowser: Zb,
  GearIcon: L0,
  HostStateDot: F0,
  InstructionsDialog: Jb,
  MemoryDialog: Lb,
  NewFilePrompt: bv,
  NewSessionMenu: qb,
  PageIcon: ib,
  PlusIcon: Mm,
  Select: Qb,
  SessionDot: Hb,
  SessionMenu: Bb,
  Slot: Db,
  TabDragLayer: gv,
  TabMenu: hv,
  WorktreeMenu: Ib,
  agentStateColor: yb,
  anchoredPopoverStyle: cb,
  beginReorderDrag: Pb,
  beginTabDrag: dv,
  bindHost: ob,
  buttonClass: pb,
  cn: je,
  drawConfirmationsInPlace: Gb,
  drawFolderBrowserInPlace: Vb,
  drawWorktreeInPlace: Fb,
  ghostButton: bb,
  iconButton: vb,
  isMac: ub,
  keyLabel: db,
  menuDividerClass: gb,
  menuItemClass: hb,
  menuPanel: jm,
  nestSessions: Rb,
  openBrowserTab: fv,
  openFileTab: pv,
  pickFolder: Sb,
  redeemUsageReset: sv,
  refreshUsage: ov,
  resetZoom: cv,
  rowActionClass: fb,
  runCommand: qi,
  segmentClass: mb,
  shortcutFor: xb,
  shortcutLabel: wb,
  startSession: _b,
  tabStateClass: uv,
  useAddProject: Eb,
  useAddProjectRequest: Ob,
  useAgentChoices: Ab,
  useDismissOnOutsideClick: Om,
  useHosts: kb,
  useKeybindings: lv,
  useNavigation: Rm,
  useNewTabRequest: mv,
  useNotifications: Mb,
  usePaneLook: nv,
  usePlanUsage: rv,
  useSessionFolders: zb,
  useStatusLine: ev,
  useWorkspaceTabs: tv,
  useZoom: av,
  version: rb
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
const ns = {
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
  ns[n] = (i, o) => i[n](o);
const Av = Object.keys(ns);
function Gd(n, i) {
  for (const [o, c] of Object.entries(i)) {
    const s = ns[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    c != null && (n = s(n, c));
  }
  return n;
}
const Aa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Kd = /* @__PURE__ */ new WeakSet();
function Qd(n, i, o) {
  const c = n.pressed, s = Aa(o);
  return c && c.x === s.clientX && c.y === s.clientY ? c.id : i;
}
function vv(n, i, o) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const c = n.meta?.attrs["data-testid"];
  return c ? `~${n.id}:${c}` : `~${n.id}`;
}
const Me = (n) => n.style?.display !== "hidden";
function Jo(n, i, o, c, s = !1, d = !1, p = null, m = {}, y = !1, _ = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return _.get(n)?.text ?? n.text;
  const j = Kd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), p = n.style.text_color ?? p;
  const R = !!n.hover?.text_color && Km(n);
  R && o.hovered?.(n.id) && (p = n.hover.text_color), m = { ...m };
  for (const w of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[w] !== void 0 && (m[w] = n.style[w]);
  const E = new Set(n.events ?? []);
  let b;
  n.kind === "image" && !n.markup ? b = i.image(n.src) : b = i.div(), n.markup && (b = b.child(c.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const k = vv(n, E, s);
  if (k && (b = b.id(k)), n.measure && (b = b.measure(n.measure)), n.name && b.also_named) for (const w of n.also ?? []) b = b.also_named(w);
  b = Gd(b, { ...n.style, ..._.get(n) });
  const S = m.whitespace !== "nowrap" && !m.text_ellipsis;
  y && S && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && (n.children ?? []).some((w) => w.kind === "text") && (b = b.min_w(0));
  for (const w of ["hover", "focus", "active"]) n[w] && (b = b[w]((g) => Gd(g, n[w])));
  if (i.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const w = o.document?.scrollTarget, g = w ? (n.children ?? []).filter(Me).findIndex((h) => Gm(h, w.id)) : -1;
    if (g >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, i.scroll.scroll_to_item(g)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      b = b.track_scroll(i.scroll);
      const h = (n.children ?? []).filter(Me).map((H) => H.id);
      o.document.itemBounds = (H) => h.includes(H) ? i.scroll.item_bounds?.(h.indexOf(H)) ?? null : null;
    }
  }
  n.kind === "input" && !n.disabled && (b = b.on_mouse_down("left", (w, g) => {
    w.bounds && o.setBounds(n.id, w.bounds), o.focus(n.id), g.notify();
  }));
  const z = n.kind === "input" ? n : n.meta?.tag === "label" ? Ym(n) : null;
  z && !z.disabled && /^(checkbox|radio)$/.test(z.input_type) && (b = b.on_click((w, g) => {
    g.stop_propagation?.(), o.toggle(z.id), g.notify();
  }));
  const B = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((w) => E.has(w));
  if (B || j) for (const w of n.children ?? []) w.kind !== "text" && Kd.add(w);
  if (B && (b = b.on_mouse_down("left", (w, g) => {
    g.stop_propagation?.(), w.bounds && o.setBounds(n.id, w.bounds);
    const h = { ...Aa(w), button: 0, buttons: 1, detail: w.click_count }, H = Qd(o, n.id, w);
    o.pressed = null, o.dispatch(H, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(H, "mousedown", h) && o.pressFocus?.(H), g.notify();
  }), b = b.on_mouse_down("right", (w, g) => {
    g.stop_propagation?.(), w.bounds && o.setBounds(n.id, w.bounds);
    const h = Qd(o, n.id, w);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Aa(w), button: 2 }), g.notify();
  }), b = b.on_mouse_up("left", (w, g) => {
    g.stop_propagation?.();
    const h = { ...Aa(w), button: 0 };
    o.dispatch(n.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", h), g.notify();
  }), b = b.on_click((w, g) => {
    o.dispatch(n.id, w.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: w.click_count, button: 0 }), g.notify();
  })), n.blocks_pointer && !B)
    for (const w of ["left", "right"]) b = b.on_mouse_down(w, (g, h) => h.stop_propagation?.());
  else if (j && !B)
    for (const w of ["left", "right"])
      b = b.on_mouse_down(w, (g) => {
        const h = Aa(g);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: n.id, x: h.clientX, y: h.clientY });
      });
  if (E.has("mouse_move") && (b = b.on_mouse_move((w, g) => {
    o.dispatch(n.id, "pointermove", { ...Aa(w), pointerType: "mouse" }), g.notify();
  })), (n.track_hover || R) && (b = b.on_hover((w, g) => {
    o.hover(n.id, w), g.notify();
  })), s && (b = b.on_mouse_down_out((w, g) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Aa(w), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Aa(w)), g.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const w = n.value ? String(n.value) : String(n.placeholder ?? "");
    let g = i.div().whitespace_nowrap().overflow_x_hidden();
    const h = en(m);
    h && (g = g.h(h)), !n.value && p && (g = g.text_color(xv(p))), w && (b = b.child(g.child(n.input_type === "password" && n.value ? "•".repeat([...w].length) : w))), n.field_w && (b = b.child(i.div().w(n.field_w).h(0)));
  }
  const N = m.whitespace === "nowrap" ? en(m) : null, M = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let Y = !n.range_name;
  const D = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const w of (n.children ?? []).filter(Me)) {
    const g = w.style?.flex_basis;
    D && w.style.flex_grow > 0 && (g === 0 || typeof g == "string" && g.endsWith("%")) && _.set(w, { ..._.get(w), flex_basis: "auto" });
    let h = Jo(w, i, o, c, !1, d, p, m, M && w.style?.position !== "absolute", _);
    const H = !Y && (w.kind === "text" || !w.meta), Z = w.kind === "text" ? _.get(w)?.h ?? N : null, ot = w.kind === "text" ? _.get(w)?.w : void 0;
    if (H || Z || ot !== void 0) {
      let $ = i.div();
      H && ($ = $.id(n.range_name)), H && !M && n.style.display === "flex" && ($ = $[`self_${yv[m.text_align] ?? "start"}`]().max_w("100%")), Z && ($ = $.h(Z)), ot !== void 0 && ($ = $.w(ot).flex_none().whitespace_nowrap()), h = $.child(h), Y ||= H;
    }
    b = b.child(h);
  }
  return b;
}
const yv = { center: "center", right: "end", end: "end" };
function xv(n) {
  const i = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return n;
  const o = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const qm = /^(?:[!-,.-~]+|\S)$/u, Ym = (n) => {
  for (const i of n.children ?? []) {
    if (i.kind === "input" && /^(checkbox|radio)$/.test(i.input_type)) return i;
    const o = i.kind === "text" ? null : Ym(i);
    if (o) return o;
  }
  return null;
}, Gm = (n, i) => n.id === i || (n.children ?? []).some((o) => o.kind !== "text" && Gm(o, i)), Km = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && Km(i));
function en(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function Ov(n, i, o, c, s = 0, d = !1) {
  const p = [n.root, ...n.overlays], m = s > 0 ? Nv(p, s) : /* @__PURE__ */ new Map();
  s > 0 && c.measure && wv(p, s, c.measure, m), zv(p, m), kv(p, m), c.measure && Sv(p, c.measure, m);
  let y = i.div().relative().size_full().child(Jo(n.root, i, o, c, !1, !1, null, {}, !1, m)), _ = d && n.overlays.length ? i.div().relative().size_full().window_layer() : y;
  for (const j of n.overlays) _ = _.child(Jo(j, i, o, c, !0, !1, null, {}, !1, m));
  return _ === y ? y : y.child(_);
}
function wv(n, i, o, c) {
  const s = (k, S) => c.set(k, { ...c.get(k), ...S }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function y(k, S, z) {
    if (k.kind === "text") {
      if (!(S.whitespace === "nowrap" || qm.test(k.text)) || S.text_ellipsis || z || typeof S.text_size != "number") return NaN;
      const g = o(k.text, { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Me(k) || k.kind === "input" || k.markup) return _(k);
    const B = { ...S };
    for (const w of m) k.style[w] !== void 0 && (B[w] = k.style[w]);
    p.set(k, B);
    const N = k.style, M = (k.children ?? []).filter(Je), Y = M.map((w) => y(w, B, z || !!k.tabular));
    let D = _(k);
    if (!Number.isFinite(D) && N.w === void 0) {
      const w = M.map((h, H) => Y[H] + (h.kind === "text" ? 0 : I(h.style.ml) + I(h.style.mr)));
      let g;
      M.length ? Ye(k) ? g = M.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || N.flex_wrap === "wrap" ? NaN : w.reduce((h, H) => h + H, 0) + I(N.gap_x) * (M.length - 1) : g = Math.max(...w) : g = 0, D = g + I(N.pl) + I(N.pr) + I(N.border_l) + I(N.border_r), typeof N.min_w == "number" && (D = Math.max(D, N.min_w)), typeof N.max_w == "number" && (D = Math.min(D, N.max_w));
    }
    return d.set(k, D), D;
  }
  const _ = (k) => typeof k.style?.w == "number" ? k.style.w : NaN, j = () => ({ exact: 0, laid: 0 }), R = (k, S) => {
    if (!Number.isFinite(S))
      return Object.assign(k, j()), NaN;
    k.exact += S;
    const z = Math.round(k.exact * i + 1e-9) / i, B = z - k.laid;
    return k.laid = z, B;
  }, E = (k) => Ye(k) && k.style.flex_wrap !== "wrap" && (k.style.justify ?? "start") === "start";
  function b(k) {
    if (!k || k.kind === "text" || !Me(k)) return;
    const S = (k.children ?? []).filter(Je);
    if (E(k) && S.length > 1) {
      const z = I(k.style.gap_x), B = j(), N = !(z && S.some((M) => M.kind === "text"));
      s(k, { border_l: R(B, I(k.style.border_l)), pl: R(B, I(k.style.pl)) }), N && z && s(k, { gap_x: 0 }), S.forEach((M, Y) => {
        const D = (Y && N ? z : 0) + (M.kind === "text" ? 0 : I(M.style.ml));
        if (M.kind === "text")
          D && Object.assign(B, j());
        else {
          const H = R(B, D);
          Number.isFinite(H) && s(M, { ml: H });
        }
        const w = M.kind === "text" ? p.get(k) ?? {} : null, g = M.kind === "text" ? y(M, w, !!k.tabular) : d.get(M);
        if ((M.kind === "text" || !(M.style.flex_grow > 0)) && Number.isFinite(g) ? s(M, { w: R(B, g) }) : Object.assign(B, j()), M.kind !== "text") {
          const H = R(B, I(M.style.mr));
          Number.isFinite(H) && s(M, { mr: H });
        }
      });
    }
    for (const z of k.children ?? []) z.kind !== "text" && b(z);
  }
  for (const k of n)
    k && (y(k, {}, !1), b(k));
}
const _v = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Sv(n, i, o) {
  const c = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (m) => typeof m == "number" ? m : 0, d = (m, y) => y && Ri(y) && !Ye(y) && m.style.position !== "absolute" && !["start", "center", "end"].includes(m.style.self) && !["start", "center", "end"].includes(y.style.items), p = (m, y, _, j) => {
    if (!m || m.kind === "text" || !Me(m)) return;
    const R = m.style;
    let E = typeof R.w == "number" ? R.w : R.w === "100%" ? _ : d(m, y) ? _ - s(R.ml) - s(R.mr) : NaN;
    typeof R.max_w == "number" && (E = Math.min(E, R.max_w));
    const b = E - s(R.pl) - s(R.pr) - s(R.border_l) - s(R.border_r), k = { ...j };
    for (const z of c) R[z] !== void 0 && (k[z] = R[z]);
    const S = m.children ?? [];
    if (m.break_anywhere && Number.isFinite(b) && b > 0 && typeof k.text_size == "number" && S.length && S.every((z) => z.kind === "text")) {
      const z = { size: k.text_size, weight: k.font_weight ?? 400, family: k.font_family ?? ".SystemUIFont", italic: !!k.italic }, B = (Y) => i(Y.trimEnd(), z) <= b + 0.01;
      let N = 0;
      for (const Y of S) {
        const D = [];
        for (const g of Y.text.split(`
`)) {
          let h = "";
          for (const H of g.split(_v)) {
            if (B(h + H)) {
              h += H;
              continue;
            }
            h && D.push(h.trimEnd()), h = "";
            for (const Z of H)
              h && !B(h + Z) && (D.push(h), h = ""), h += Z;
          }
          D.push(h.trimEnd());
        }
        const w = D.join(`
`);
        D.every((g) => !g || B(g)) ? w !== Y.text && o.set(Y, { ...o.get(Y), text: w }) : N = NaN, N += D.length;
      }
      const M = en(k);
      Number.isFinite(N) && M && R.h === void 0 && S.length === 1 && o.set(m, { ...o.get(m), h: N * M + s(R.pt) + s(R.pb) + s(R.border_t) + s(R.border_b) });
    }
    for (const z of S) p(z, m, Ye(m) ? NaN : b, k);
  };
  for (const m of n) p(m, null, NaN, {});
}
function kv(n, i) {
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
function zv(n, i) {
  const o = i.heights ?? /* @__PURE__ */ new Map(), c = (m) => o.get(m), s = (m) => {
    const y = m.style, _ = (m.children ?? []).filter(Je);
    if (!_.length || Ye(m)) return NaN;
    let j = 0;
    for (const R of _) {
      const E = c(R);
      if (!Number.isFinite(E)) return NaN;
      j += E + (R.kind === "text" ? 0 : I(R.style.mt) + I(R.style.mb));
    }
    return j + (y.display === "flex" ? I(y.gap_y) * (_.length - 1) : 0) + I(y.pt) + I(y.pb);
  }, d = (m, y) => {
    const _ = m.style;
    if (typeof _.h == "number") return _.h;
    if (typeof _.max_h == "number") return _.max_h;
    if (!y || !Ri(y) || Ye(y)) return NaN;
    const j = y.style, R = typeof j.h == "number" ? j.h : typeof j.max_h == "number" ? j.max_h : NaN, E = (y.children ?? []).filter(Je);
    let b = 0;
    for (const S of E) {
      if (S === m) continue;
      const z = c(S);
      if (!Number.isFinite(z)) return NaN;
      b += z + (S.kind === "text" ? 0 : I(S.style.mt) + I(S.style.mb));
    }
    const k = j.display === "flex" ? I(j.gap_y) * Math.max(0, E.length - 1) : 0;
    return R - I(j.pt) - I(j.pb) - I(j.border_t) - I(j.border_b) - b - k - I(_.mt) - I(_.mb);
  }, p = (m, y) => {
    if (!(!m || m.kind === "text" || !Me(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const _ = s(m), j = d(m, y);
        Number.isFinite(_) && Number.isFinite(j) && _ > j + 0.01 && i.set(m, { ...i.get(m), pr: I(m.style.pr) + m.scrollbar });
      }
      for (const _ of m.children ?? []) p(_, m);
    }
  };
  for (const m of n) p(m, null);
}
const Ev = ["text_size", "line_height", "whitespace", "text_ellipsis"], I = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ri = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ye = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Je = (n) => n.kind === "text" || Me(n) && n.style.position !== "absolute";
function Nv(n, i) {
  const o = /* @__PURE__ */ new Map(), c = (S, z) => o.set(S, { ...o.get(S), ...Object.fromEntries(Object.entries(z).filter(([, B]) => Number.isFinite(B))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(S, z) {
    if (S.kind === "text") return z.whitespace === "nowrap" || qm.test(S.text) ? en(z) ?? NaN : NaN;
    const B = { ...z };
    for (const w of Ev) S.style[w] !== void 0 && (B[w] = S.style[w]);
    d.set(S, B);
    const N = S.style, M = (S.children ?? []).filter(Je), Y = M.map((w) => p(w, B));
    let D;
    if (N.h !== void 0 && N.h !== "auto") D = I(N.h);
    else if (S.kind === "input")
      D = (S.input_type === "textarea" || S.input_type === "select" ? NaN : en(B) ?? NaN) + I(N.pt) + I(N.pb) + I(N.border_t) + I(N.border_b), N.min_h !== void 0 && (D = Math.max(D, I(N.min_h)));
    else {
      const w = M.map((h, H) => (h.kind === "text" ? 0 : I(h.style.mt) + I(h.style.mb)) + Y[H]);
      let g;
      if (Ye(S)) g = N.flex_wrap === "wrap" ? NaN : N.items === "baseline" ? y(M, Y, B) : Math.max(0, ...w);
      else if (Ri(S)) {
        const h = M.some((Z) => Z.kind !== "text" && (Z.style.flex_grow > 0 || Z.style.flex_basis !== void 0)), H = N.display !== "flex" && M.some((Z) => Z.kind !== "text" && (I(Z.style.mt) || I(Z.style.mb)));
        g = h || H ? NaN : w.reduce((Z, ot) => Z + ot, 0) + (N.display === "flex" ? I(N.gap_y) * Math.max(0, M.length - 1) : 0);
      } else g = NaN;
      D = g + I(N.pt) + I(N.pb) + I(N.border_t) + I(N.border_b), N.min_h !== void 0 && (D = Math.max(D, I(N.min_h))), N.max_h !== void 0 && (D = Math.min(D, I(N.max_h)));
    }
    return s.set(S, D), D;
  }
  const m = (S) => (en(S) - (Mi + om) * S.text_size) / 2 + Mi * S.text_size;
  function y(S, z, B) {
    let N = 0, M = 0;
    for (const [Y, D] of S.entries()) {
      const w = D.kind === "text" ? B : d.get(D);
      if (!(D.kind === "text" || (D.children ?? []).filter(Je).every((Z) => Z.kind === "text")) || !Number.isFinite(z[Y]) || typeof w.text_size != "number") return NaN;
      const h = D.kind === "text" ? {} : D.style, H = I(h.mt) + I(h.border_t) + I(h.pt) + m(w);
      N = Math.max(N, H), M = Math.max(M, I(h.mt) + z[Y] + I(h.mb) - H);
    }
    return N + M;
  }
  const _ = () => ({ exact: 0, laid: 0 }), j = (S, z) => {
    if (!Number.isFinite(z))
      return Object.assign(S, _()), NaN;
    S.exact += z;
    const B = Math.round(S.exact * i + 1e-9) / i, N = B - S.laid;
    return S.laid = B, N;
  };
  function R(S) {
    if (!(S.kind === "text" || !Me(S))) {
      for (const z of (S.children ?? []).filter((B) => B.kind !== "text" && Me(B) && B.style.position === "absolute")) R(z);
      if (Ri(S) && !Ye(S)) {
        const z = _();
        c(S, { border_t: j(z, I(S.style.border_t)), pt: j(z, I(S.style.pt)) }), E(S, z);
      } else for (const z of (S.children ?? []).filter(Je)) z.kind !== "text" && R(z);
    }
  }
  function E(S, z) {
    const B = (S.children ?? []).filter(Je), N = S.style.display === "flex" ? I(S.style.gap_y) : 0;
    if (N && B.some((M) => M.kind === "text")) {
      for (const M of B) M.kind !== "text" && R(M);
      return !1;
    }
    return N && c(S, { gap_y: 0 }), B.forEach((M, Y) => {
      if (M.kind === "text") {
        const D = s.get(M) ?? p(M, d.get(S) ?? {});
        Number.isFinite(D) ? c(M, { h: j(z, D) }) : Object.assign(z, _());
        return;
      }
      if (c(M, { mt: j(z, (Y ? N : 0) + I(M.style.mt)) }), Number.isFinite(s.get(M))) k(M, z);
      else if (b(M)) {
        const D = M.style;
        c(M, { border_t: j(z, I(D.border_t)), pt: j(z, I(D.pt)) }), c(M, { pb: j(z, I(D.pb)), border_b: j(z, I(D.border_b)) });
      } else
        R(M), Object.assign(z, _());
      c(M, { mb: j(z, I(M.style.mb)) });
    }), !0;
  }
  function b(S) {
    const z = S.style, B = (S.children ?? []).filter(Je), N = en(d.get(S) ?? {});
    return S.kind === "div" && !Ye(S) && B.length > 0 && B.every((M) => M.kind === "text") && Number.isInteger(N) && [z.h, z.min_h, z.max_h].every((M) => M === void 0 || M === "auto");
  }
  function k(S, z) {
    const B = S.style;
    for (const w of (S.children ?? []).filter((g) => g.kind !== "text" && Me(g) && g.style.position === "absolute")) R(w);
    const N = z.laid, M = z.exact;
    c(S, { border_t: j(z, I(B.border_t)), pt: j(z, I(B.pt)) });
    const Y = B.h !== void 0 && B.h !== "auto", D = s.get(S) - I(B.pt) - I(B.pb) - I(B.border_t) - I(B.border_b);
    if (S.kind === "input")
      Y || j(z, D);
    else if (Ye(S) || Y && (B.justify ?? "start") !== "start") {
      for (const w of (S.children ?? []).filter(Je)) w.kind !== "text" && R(w);
      Y || j(z, D);
    } else !E(S, z) && !Y && j(z, D);
    if (Y) {
      z.exact = M + s.get(S), z.laid = Math.round(z.exact * i + 1e-9) / i, c(S, { h: z.laid - N });
      return;
    }
    c(S, { pb: j(z, I(B.pb)), border_b: j(z, I(B.border_b)) }), c(S, { h: z.laid - N });
  }
  for (const S of n)
    p(S, {}), R(S);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const Rv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }] };
export {
  Rv as NAMED_ELEMENTS,
  Ah as React,
  dg as SCHEMA,
  Av as STYLE_KEYS,
  Ov as describeToGpui,
  Tv as jsxRuntime,
  Cv as mount,
  jv as reactDom,
  Mv as sdk
};
