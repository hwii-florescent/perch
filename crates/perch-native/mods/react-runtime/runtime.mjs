function Wo(n, l) {
  for (var o = 0; o < l.length; o++) {
    const c = l[o];
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
const hh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), gh = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), bh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...hh]);
function Oo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, o, c) => o ? String.fromCodePoint(parseInt(o, 16)) : c);
}
function hi(n, l) {
  let o = l;
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
  if (o === l) throw new ke(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [Oo(n.slice(l, o)), o];
}
function vh(n, l) {
  let o = 1;
  for (let c = l; c < n.length; c++) {
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
function Fo(n) {
  const l = [];
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
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (l.push(n.slice(c, s).trim()), c = s + 1);
  }
  return l.push(n.slice(c).trim()), l.filter(Boolean);
}
function yh(n, l) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let c = !1;
  for (; l < n.length; ) {
    const s = n[l];
    if (s === "*") {
      o.tag = "*", l++, c = !0;
      continue;
    }
    if (s === ".") {
      const [d, p] = hi(n, l + 1);
      o.classes.push(d), l = p, c = !0;
      continue;
    }
    if (s === "#") {
      const [d, p] = hi(n, l + 1);
      o.id = d, l = p, c = !0;
      continue;
    }
    if (s === "[") {
      const d = n.indexOf("]", l);
      if (d < 0) throw new ke(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!f) throw new ke(`cannot read the attribute selector [${p}]`);
      const v = f[3] ?? f[4] ?? f[5];
      o.attrs.push({ name: Oo(f[1]).toLowerCase(), op: f[2] ?? null, value: v === void 0 ? null : Oo(v) }), l = d + 1, c = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") throw new ke(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = hi(n, l + 1);
      l = p;
      const f = d.toLowerCase();
      if (n[l] === "(") {
        if (!gh.has(f)) throw new ke(`:${f}() is not supported`);
        const v = vh(n, l + 1), y = n.slice(l + 1, v).trim();
        if (l = v + 1, f === "nth-child") {
          if (!/^\d+$/.test(y)) throw new ke(`:nth-child(${y}) is not supported (only a number)`);
          o.pseudos.push({ name: f, n: Number(y) });
        } else
          o.pseudos.push({ name: f, list: Fo(y).map(Io) });
      } else {
        if (!bh.has(f)) throw new ke(`:${f} is not supported`);
        o.pseudos.push({ name: f });
      }
      c = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !c) {
      const [d, p] = hi(n, l);
      o.tag = d.toLowerCase(), l = p, c = !0;
      continue;
    }
    break;
  }
  if (!c) throw new ke(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [o, l];
}
function Io(n) {
  const l = [];
  let o = 0, c = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, d] = yh(n, o);
    l.push({ compound: s, combinator: c }), o = d;
    let p = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, p = !0;
    if (o >= n.length) break;
    const f = n[o];
    if (f === ">")
      for (c = ">", o++; n[o] === " "; ) o++;
    else {
      if (f === "+" || f === "~") throw new ke(`the ${f} combinator is not supported`);
      if (p) c = " ";
      else throw new ke(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new ke("empty selector");
  return l;
}
const td = /* @__PURE__ */ new Map();
function Hi(n) {
  let l = td.get(n);
  return l || (l = Fo(n).map(Io), td.set(n, l)), l;
}
function Zd(n) {
  const l = [0, 0, 0], o = (c) => {
    l[0] += c[0], l[1] += c[1], l[2] += c[2];
  };
  for (const { compound: c } of n) {
    c.id && l[0]++, l[1] += c.classes.length + c.attrs.length, c.tag && c.tag !== "*" && l[2]++;
    for (const s of c.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(Zd).sort((p, f) => f[0] - p[0] || f[1] - p[1] || f[2] - p[2])[0];
          o(d);
        } else l[1]++;
  }
  return l;
}
function xh(n, { name: l, op: o, value: c }) {
  const s = n.getAttribute(l);
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
function wh(n, l, o, c) {
  if (l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classList ?? [];
    for (const d of l.classes) if (!s.includes(d)) return !1;
  }
  for (const s of l.attrs) if (!xh(n, s)) return !1;
  for (const s of l.pseudos)
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
        if (s.list.some((d) => Rn(n, d, o, c))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((d) => Rn(n, d, o, c))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, s.name, c)) return !1;
    }
  return !0;
}
function Rn(n, l, o, c = !0) {
  const s = (d, p, f) => {
    const { compound: v, combinator: y } = l[p];
    if (!wh(d, v, o, f)) return !1;
    if (p === 0) return !0;
    if (y === ">") return !!d.parentElement && s(d.parentElement, p - 1, !1);
    for (let C = d.parentElement; C; C = C.parentElement) if (s(C, p - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, c);
}
function _h(n, l, o = {}) {
  return (typeof l == "string" ? Hi(l) : l).some((s) => Rn(n, s, o));
}
function Jd(n, l, o = {}) {
  return Rn(n, l, o);
}
function pl(n, l, o = {}) {
  const c = Hi(l), s = [], d = (p) => {
    for (const f of p.children)
      c.some((v) => Rn(f, v, o)) && s.push(f), d(f);
  };
  return d(n), s;
}
function Ld(n, l, o = {}) {
  const c = Hi(l);
  for (let s = n; s; s = s.parentElement) if (c.some((d) => Rn(s, d, o))) return s;
  return null;
}
//! The DOM, as much of it as a stock screen's source touches (the web reference's findings, section 9) and no more.
//! The renderer's host instances are `HostElement`s, so a `ref`, `event.currentTarget` and `event.target` are these
//! objects: `closest`, `contains`, `parentElement`, `children`, `dataset`, `getAttribute`, `getBoundingClientRect`.
//! `document` (with `body`, the portal target) and `window` keep listeners for the capture and bubble phases the
//! source registers; `localStorage`, timers, `window.location` and `navigator.clipboard` go to the `perch` host.
//!
//! `installGlobals(perch)` puts `window`, `document`, `localStorage`, `HTMLElement`, `DOMRect`, `getComputedStyle`
//! and (where the engine has none) `setTimeout`/`clearTimeout`/`queueMicrotask` on `globalThis`, so a module that
//! names them as globals runs unchanged. `window`, `document`, `localStorage` and `HTMLElement` read the record at
//! `globalThis[GLOBALS]`, which each mount sets to its own and a host running several screens in one script context
//! sets to the running screen's.
let Sh = 1;
class Ro {
  constructor(l = 0, o = 0, c = 0, s = 0) {
    this.x = l, this.y = o, this.width = c, this.height = s;
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
class $o {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, o, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners.some((d) => d.type === l && d.listener === o && d.capture === s) || this.listeners.push({ type: l, listener: o, capture: s });
  }
  removeEventListener(l, o, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === l && d.listener === o && d.capture === s));
  }
}
class Di {
  constructor(l) {
    this.nodeType = 3, this.data = String(l), this.parentNode = null, this.hidden = !1;
  }
  get parentElement() {
    return this.parentNode;
  }
  get textContent() {
    return this.data;
  }
}
class It extends $o {
  constructor(l, o = {}, c = null) {
    super(), this.nodeType = 1, this.id = `n${Sh++}`, this.tagName = l.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = c, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof It ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof It);
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
    const l = this.className;
    return this.classCache?.name !== l && (this.classCache = { name: l, list: l.split(/\s+/).filter(Boolean) }), this.classCache.list;
  }
  get textContent() {
    return this.childNodes.map((l) => l.textContent).join("");
  }
  get dataset() {
    const l = {};
    for (const [o, c] of Object.entries(this.props))
      o.startsWith("data-") && c != null && c !== !1 && (l[o.slice(5).replace(/-([a-z])/g, (s, d) => d.toUpperCase())] = String(c));
    return l;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(l) {
    const o = this.props;
    if (l === "class") return this.className || null;
    if (l === "id") return o.id != null ? String(o.id) : null;
    if (l === "style") return null;
    let s = o[l === "for" ? "htmlFor" : l === "tabindex" ? "tabIndex" : l];
    if (s === void 0 && !l.includes("-")) {
      const d = l.replace(/-([a-z])/g, (p, f) => f.toUpperCase());
      s = o[d];
    }
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? l.startsWith("aria-") || l.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(l) {
    return this.getAttribute(l) !== null;
  }
  appendChild(l) {
    return l.parentNode && l.parentNode.removeChild(l), l.parentNode = this, this.childNodes.push(l), this.touch(), l;
  }
  insertBefore(l, o) {
    l.parentNode && l.parentNode.removeChild(l);
    const c = this.childNodes.indexOf(o);
    return l.parentNode = this, c < 0 ? this.childNodes.push(l) : this.childNodes.splice(c, 0, l), this.touch(), l;
  }
  removeChild(l) {
    const o = this.childNodes.indexOf(l);
    return o >= 0 && this.childNodes.splice(o, 1), l.parentNode = null, this.touch(), l;
  }
  contains(l) {
    for (let o = l; o; o = o.parentNode) if (o === this) return !0;
    return !1;
  }
  matches(l) {
    return _h(this, l);
  }
  closest(l) {
    return Ld(this, l);
  }
  querySelectorAll(l) {
    return pl(this, l);
  }
  querySelector(l) {
    return pl(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new Ro(l.x, l.y, l.width, l.height) : new Ro();
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
  set value(l) {
    this.edit = String(l);
  }
  /** A box's tick: what a click just made it (`ticked`, during the change event it causes), else its props'. */
  get checked() {
    return this.ticked ?? !!(this.props.checked ?? this.props.defaultChecked);
  }
  set checked(l) {
    this.ticked = !!l;
  }
  /** Selection in a field: the caret stays at the end of its text, and the one selection kept is all of it
   * (`selectedAll`: the next character typed replaces the text). */
  select() {
    this.selectedAll = !0;
  }
  setSelectionRange(l, o) {
    this.selectedAll = l === 0 && o >= this.value.length && o > 0;
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
    const l = this, o = (p) => String(p).startsWith("--") ? String(p) : String(p).replace(/-([a-z])/g, (f, v) => v.toUpperCase()), c = (p) => {
      const f = l.props.style?.[p];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, s = (p) => l.inline && p in l.inline ? l.inline[p] : c(p), d = (p, f) => {
      const v = f == null ? "" : String(f);
      s(p) !== v && (l.inline ??= {}, v === c(p) ? delete l.inline[p] : l.inline[p] = v, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (p, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (v, y) => d(o(v), y) : f === "removeProperty" ? (v) => {
            const y = s(o(v));
            return d(o(v), ""), y;
          } : f === "getPropertyValue" ? (v) => s(o(v)) : s(f);
      },
      set: (p, f, v) => (typeof f == "string" && d(f, v), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return ed(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return ed(this, l);
  }
}
const Wd = Symbol("perch.stale-layout"), Fd = 3;
let zi = !1;
function Id(n) {
  return () => {
    let l, o = !1;
    const c = (s) => {
      const d = zi;
      zi = s < Fd;
      try {
        l = n();
      } catch (p) {
        const f = p?.[Wd];
        if (!f) throw p;
        f.retries.push(() => {
          o || c(s + 1);
        });
      } finally {
        zi = d;
      }
    };
    return c(0), () => {
      o = !0, typeof l == "function" && l();
    };
  };
}
const Ho = "perch-dom:", kh = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), zh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function ed(n, l = []) {
  const o = new Set(l.map((s) => zh[s] ?? s)), c = (s) => {
    if (!(s instanceof It)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [p, f] of Object.entries(s.props))
      kh.has(p) || o.has(p) || f == null || typeof f == "function" || typeof f == "symbol" || (d[p] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(c), ...s.hidden ? { h: 1 } : {} };
  };
  return Ho + JSON.stringify(c(n));
}
function Eh(n, l) {
  if (typeof n != "string" || !n.startsWith(Ho)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(Ho.length));
  } catch {
    return null;
  }
  const c = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!c(d)) throw new Error("not a node");
    let p;
    if (typeof d.x == "string") p = new Di(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !c(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      p = new It(d.t, d.p, l);
      for (const f of d.c) p.appendChild(s(f));
    }
    return p.hidden = d.h === 1, p;
  };
  try {
    return [s(o)];
  } catch {
    return null;
  }
}
class Nh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Th {
  constructor(l = {}) {
    this.map = new Map(Object.entries(l));
  }
  get length() {
    return this.map.size;
  }
  key(l) {
    return [...this.map.keys()][l] ?? null;
  }
  getItem(l) {
    return this.map.has(l) ? this.map.get(l) : null;
  }
  setItem(l, o) {
    this.map.set(l, String(o));
  }
  removeItem(l) {
    this.map.delete(l);
  }
  clear() {
    this.map.clear();
  }
}
function ad(n) {
  for (let l = n; l instanceof It; l = l.parentElement) l.touch();
}
class Ch extends $o {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new It("html", {}, this), this.body = new It("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new It(l, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(l) {
    const o = this.perch?.bounds;
    if (typeof o != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const c = o(this.measureKey(l));
    if (zi && (!c || this.stale?.())) throw { [Wd]: this };
    return c ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, ad(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, ad(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return pl(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return pl(this.documentElement, "*").find((o) => o.props?.id === l) ?? null;
  }
}
class jh extends $o {
  constructor(l, o) {
    super(), this.perch = l, this.document = o, this.location = { get hostname() {
      return l.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(l, o, ...c) {
    return globalThis.setTimeout(l, o, ...c);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function $d(n) {
  return {
    setTimeout: (l, o = 0, ...c) => n.setTimeout(() => l(...c), Math.max(0, Number(o) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const nd = Symbol.for("perch.react.globals");
function Xe(n, l, o) {
  Object.defineProperty(n, l, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function Mh(n, l = globalThis) {
  const o = new Ch(n), c = new jh(n, o);
  o.defaultView = c;
  const s = n.storage ?? new Th();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = $d(n);
    Xe(l, "setTimeout", f.setTimeout), Xe(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Xe(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Xe(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Xe(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: o, window: c, localStorage: s, HTMLElement: It, Element: It };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[nd]?.[f], configurable: !0, enumerable: !1 });
  l[nd] = d, Xe(l, "DOMRect", Ro), Xe(l, "getComputedStyle", Ah), typeof l.ResizeObserver != "function" && Xe(l, "ResizeObserver", Nh);
  const p = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      Xe(p, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Xe(l, "navigator", p), { document: o, window: c, globals: d };
}
function Ah(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, o = (c) => {
    const s = l[c];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (c, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (d) => o(String(d)) : o(s.replace(/[A-Z]/g, (d) => `-${d.toLowerCase()}`));
    }
  });
}
function Do(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Pd(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let c = n.parentElement; c; c = c.parentElement) if (c.tagName === "form") return c;
  return null;
}
const Pd = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const ld = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof ld?.setTimeout == "function") {
  const n = $d(ld);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Po(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function Oh(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var l = n.default;
  if (typeof l == "function") {
    var o = function c() {
      return this instanceof c ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    o.prototype = l.prototype;
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
var id;
function Rh() {
  if (id) return ct;
  id = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), c = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), v = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), C = Symbol.for("react.lazy"), A = Symbol.for("react.activity"), E = Symbol.iterator;
  function b(_) {
    return _ === null || typeof _ != "object" ? null : (_ = E && _[E] || _["@@iterator"], typeof _ == "function" ? _ : null);
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
  }, w = Object.assign, z = {};
  function H(_, Y, nt) {
    this.props = _, this.context = Y, this.refs = z, this.updater = nt || x;
  }
  H.prototype.isReactComponent = {}, H.prototype.setState = function(_, Y) {
    if (typeof _ != "object" && typeof _ != "function" && _ != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, _, Y, "setState");
  }, H.prototype.forceUpdate = function(_) {
    this.updater.enqueueForceUpdate(this, _, "forceUpdate");
  };
  function N() {
  }
  N.prototype = H.prototype;
  function j(_, Y, nt) {
    this.props = _, this.context = Y, this.refs = z, this.updater = nt || x;
  }
  var K = j.prototype = new N();
  K.constructor = j, w(K, H.prototype), K.isPureReactComponent = !0;
  var U = Array.isArray;
  function k() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function D(_, Y, nt) {
    var tt = nt.ref;
    return {
      $$typeof: n,
      type: _,
      key: Y,
      ref: tt !== void 0 ? tt : null,
      props: nt
    };
  }
  function Q(_, Y) {
    return D(_.type, Y, _.props);
  }
  function W(_) {
    return typeof _ == "object" && _ !== null && _.$$typeof === n;
  }
  function L(_) {
    var Y = { "=": "=0", ":": "=2" };
    return "$" + _.replace(/[=:]/g, function(nt) {
      return Y[nt];
    });
  }
  var pt = /\/+/g;
  function gt(_, Y) {
    return typeof _ == "object" && _ !== null && _.key != null ? L("" + _.key) : Y.toString(36);
  }
  function wt(_) {
    switch (_.status) {
      case "fulfilled":
        return _.value;
      case "rejected":
        throw _.reason;
      default:
        switch (typeof _.status == "string" ? _.then(k, k) : (_.status = "pending", _.then(
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
  function V(_, Y, nt, tt, at) {
    var it = typeof _;
    (it === "undefined" || it === "boolean") && (_ = null);
    var St = !1;
    if (_ === null) St = !0;
    else
      switch (it) {
        case "bigint":
        case "string":
        case "number":
          St = !0;
          break;
        case "object":
          switch (_.$$typeof) {
            case n:
            case l:
              St = !0;
              break;
            case C:
              return St = _._init, V(
                St(_._payload),
                Y,
                nt,
                tt,
                at
              );
          }
      }
    if (St)
      return at = at(_), St = tt === "" ? "." + gt(_, 0) : tt, U(at) ? (nt = "", St != null && (nt = St.replace(pt, "$&/") + "/"), V(at, Y, nt, "", function(Ha) {
        return Ha;
      })) : at != null && (W(at) && (at = Q(
        at,
        nt + (at.key == null || _ && _.key === at.key ? "" : ("" + at.key).replace(
          pt,
          "$&/"
        ) + "/") + St
      )), Y.push(at)), 1;
    St = 0;
    var Jt = tt === "" ? "." : tt + ":";
    if (U(_))
      for (var ut = 0; ut < _.length; ut++)
        tt = _[ut], it = Jt + gt(tt, ut), St += V(
          tt,
          Y,
          nt,
          it,
          at
        );
    else if (ut = b(_), typeof ut == "function")
      for (_ = ut.call(_), ut = 0; !(tt = _.next()).done; )
        tt = tt.value, it = Jt + gt(tt, ut++), St += V(
          tt,
          Y,
          nt,
          it,
          at
        );
    else if (it === "object") {
      if (typeof _.then == "function")
        return V(
          wt(_),
          Y,
          nt,
          tt,
          at
        );
      throw Y = String(_), Error(
        "Objects are not valid as a React child (found: " + (Y === "[object Object]" ? "object with keys {" + Object.keys(_).join(", ") + "}" : Y) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return St;
  }
  function et(_, Y, nt) {
    if (_ == null) return _;
    var tt = [], at = 0;
    return V(_, tt, "", "", function(it) {
      return Y.call(nt, it, at++);
    }), tt;
  }
  function lt(_) {
    if (_._status === -1) {
      var Y = _._result;
      Y = Y(), Y.then(
        function(nt) {
          (_._status === 0 || _._status === -1) && (_._status = 1, _._result = nt);
        },
        function(nt) {
          (_._status === 0 || _._status === -1) && (_._status = 2, _._result = nt);
        }
      ), _._status === -1 && (_._status = 0, _._result = Y);
    }
    if (_._status === 1) return _._result.default;
    throw _._result;
  }
  var B = typeof reportError == "function" ? reportError : function(_) {
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
  }, q = {
    map: et,
    forEach: function(_, Y, nt) {
      et(
        _,
        function() {
          Y.apply(this, arguments);
        },
        nt
      );
    },
    count: function(_) {
      var Y = 0;
      return et(_, function() {
        Y++;
      }), Y;
    },
    toArray: function(_) {
      return et(_, function(Y) {
        return Y;
      }) || [];
    },
    only: function(_) {
      if (!W(_))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return _;
    }
  };
  return ct.Activity = A, ct.Children = q, ct.Component = H, ct.Fragment = o, ct.Profiler = s, ct.PureComponent = j, ct.StrictMode = c, ct.Suspense = v, ct.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, ct.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(_) {
      return g.H.useMemoCache(_);
    }
  }, ct.cache = function(_) {
    return function() {
      return _.apply(null, arguments);
    };
  }, ct.cacheSignal = function() {
    return null;
  }, ct.cloneElement = function(_, Y, nt) {
    if (_ == null)
      throw Error(
        "The argument must be a React element, but you passed " + _ + "."
      );
    var tt = w({}, _.props), at = _.key;
    if (Y != null)
      for (it in Y.key !== void 0 && (at = "" + Y.key), Y)
        !h.call(Y, it) || it === "key" || it === "__self" || it === "__source" || it === "ref" && Y.ref === void 0 || (tt[it] = Y[it]);
    var it = arguments.length - 2;
    if (it === 1) tt.children = nt;
    else if (1 < it) {
      for (var St = Array(it), Jt = 0; Jt < it; Jt++)
        St[Jt] = arguments[Jt + 2];
      tt.children = St;
    }
    return D(_.type, at, tt);
  }, ct.createContext = function(_) {
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
  }, ct.createElement = function(_, Y, nt) {
    var tt, at = {}, it = null;
    if (Y != null)
      for (tt in Y.key !== void 0 && (it = "" + Y.key), Y)
        h.call(Y, tt) && tt !== "key" && tt !== "__self" && tt !== "__source" && (at[tt] = Y[tt]);
    var St = arguments.length - 2;
    if (St === 1) at.children = nt;
    else if (1 < St) {
      for (var Jt = Array(St), ut = 0; ut < St; ut++)
        Jt[ut] = arguments[ut + 2];
      at.children = Jt;
    }
    if (_ && _.defaultProps)
      for (tt in St = _.defaultProps, St)
        at[tt] === void 0 && (at[tt] = St[tt]);
    return D(_, it, at);
  }, ct.createRef = function() {
    return { current: null };
  }, ct.forwardRef = function(_) {
    return { $$typeof: f, render: _ };
  }, ct.isValidElement = W, ct.lazy = function(_) {
    return {
      $$typeof: C,
      _payload: { _status: -1, _result: _ },
      _init: lt
    };
  }, ct.memo = function(_, Y) {
    return {
      $$typeof: y,
      type: _,
      compare: Y === void 0 ? null : Y
    };
  }, ct.startTransition = function(_) {
    var Y = g.T, nt = {};
    g.T = nt;
    try {
      var tt = _(), at = g.S;
      at !== null && at(nt, tt), typeof tt == "object" && tt !== null && typeof tt.then == "function" && tt.then(k, B);
    } catch (it) {
      B(it);
    } finally {
      Y !== null && nt.types !== null && (Y.types = nt.types), g.T = Y;
    }
  }, ct.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, ct.use = function(_) {
    return g.H.use(_);
  }, ct.useActionState = function(_, Y, nt) {
    return g.H.useActionState(_, Y, nt);
  }, ct.useCallback = function(_, Y) {
    return g.H.useCallback(_, Y);
  }, ct.useContext = function(_) {
    return g.H.useContext(_);
  }, ct.useDebugValue = function() {
  }, ct.useDeferredValue = function(_, Y) {
    return g.H.useDeferredValue(_, Y);
  }, ct.useEffect = function(_, Y) {
    return g.H.useEffect(_, Y);
  }, ct.useEffectEvent = function(_) {
    return g.H.useEffectEvent(_);
  }, ct.useId = function() {
    return g.H.useId();
  }, ct.useImperativeHandle = function(_, Y, nt) {
    return g.H.useImperativeHandle(_, Y, nt);
  }, ct.useInsertionEffect = function(_, Y) {
    return g.H.useInsertionEffect(_, Y);
  }, ct.useLayoutEffect = function(_, Y) {
    return g.H.useLayoutEffect(_, Y);
  }, ct.useMemo = function(_, Y) {
    return g.H.useMemo(_, Y);
  }, ct.useOptimistic = function(_, Y) {
    return g.H.useOptimistic(_, Y);
  }, ct.useReducer = function(_, Y, nt) {
    return g.H.useReducer(_, Y, nt);
  }, ct.useRef = function(_) {
    return g.H.useRef(_);
  }, ct.useState = function(_) {
    return g.H.useState(_);
  }, ct.useSyncExternalStore = function(_, Y, nt) {
    return g.H.useSyncExternalStore(
      _,
      Y,
      nt
    );
  }, ct.useTransition = function() {
    return g.H.useTransition();
  }, ct.version = "19.2.8", ct;
}
var rd;
function Hh() {
  return rd || (rd = 1, ko.exports = Rh()), ko.exports;
}
var ft = Hh();
const tf = /* @__PURE__ */ Po(ft), Dh = /* @__PURE__ */ Wo({
  __proto__: null,
  default: tf
}, [ft]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const Uh = tf ?? Dh;
function Le(n, l) {
  return ft.useEffect(Id(n), l);
}
function Uo(n, l) {
  return ft.useLayoutEffect(Id(n), l);
}
const Bh = /* @__PURE__ */ Wo({
  __proto__: null,
  default: Uh,
  useEffect: Le,
  useLayoutEffect: Uo
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
var od;
function qh() {
  if (od) return dl;
  od = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function o(c, s, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), s.key !== void 0 && (p = "" + s.key), "key" in s) {
      d = {};
      for (var f in s)
        f !== "key" && (d[f] = s[f]);
    } else d = s;
    return s = d.ref, {
      $$typeof: n,
      type: c,
      key: p,
      ref: s !== void 0 ? s : null,
      props: d
    };
  }
  return dl.Fragment = l, dl.jsx = o, dl.jsxs = o, dl;
}
var sd;
function Yh() {
  return sd || (sd = 1, zo.exports = qh()), zo.exports;
}
var Nt = Yh();
const Gh = /* @__PURE__ */ Po(Nt), Lv = /* @__PURE__ */ Wo({
  __proto__: null,
  default: Gh
}, [Nt]);
var Eo = { exports: {} }, No = { exports: {} };
const Kh = /* @__PURE__ */ Oh(Bh);
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
var cd;
function Qh() {
  return cd || (cd = 1, (function(n) {
    function l(V, et) {
      var lt = V.length;
      V.push(et);
      t: for (; 0 < lt; ) {
        var B = lt - 1 >>> 1, q = V[B];
        if (0 < s(q, et))
          V[B] = et, V[lt] = q, lt = B;
        else break t;
      }
    }
    function o(V) {
      return V.length === 0 ? null : V[0];
    }
    function c(V) {
      if (V.length === 0) return null;
      var et = V[0], lt = V.pop();
      if (lt !== et) {
        V[0] = lt;
        t: for (var B = 0, q = V.length, _ = q >>> 1; B < _; ) {
          var Y = 2 * (B + 1) - 1, nt = V[Y], tt = Y + 1, at = V[tt];
          if (0 > s(nt, lt))
            tt < q && 0 > s(at, nt) ? (V[B] = at, V[tt] = lt, B = tt) : (V[B] = nt, V[Y] = lt, B = Y);
          else if (tt < q && 0 > s(at, lt))
            V[B] = at, V[tt] = lt, B = tt;
          else break t;
        }
      }
      return et;
    }
    function s(V, et) {
      var lt = V.sortIndex - et.sortIndex;
      return lt !== 0 ? lt : V.id - et.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      n.unstable_now = function() {
        return d.now();
      };
    } else {
      var p = Date, f = p.now();
      n.unstable_now = function() {
        return p.now() - f;
      };
    }
    var v = [], y = [], C = 1, A = null, E = 3, b = !1, x = !1, w = !1, z = !1, H = typeof setTimeout == "function" ? setTimeout : null, N = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
    function K(V) {
      for (var et = o(y); et !== null; ) {
        if (et.callback === null) c(y);
        else if (et.startTime <= V)
          c(y), et.sortIndex = et.expirationTime, l(v, et);
        else break;
        et = o(y);
      }
    }
    function U(V) {
      if (w = !1, K(V), !x)
        if (o(v) !== null)
          x = !0, k || (k = !0, L());
        else {
          var et = o(y);
          et !== null && wt(U, et.startTime - V);
        }
    }
    var k = !1, g = -1, h = 5, D = -1;
    function Q() {
      return z ? !0 : !(n.unstable_now() - D < h);
    }
    function W() {
      if (z = !1, k) {
        var V = n.unstable_now();
        D = V;
        var et = !0;
        try {
          t: {
            x = !1, w && (w = !1, N(g), g = -1), b = !0;
            var lt = E;
            try {
              e: {
                for (K(V), A = o(v); A !== null && !(A.expirationTime > V && Q()); ) {
                  var B = A.callback;
                  if (typeof B == "function") {
                    A.callback = null, E = A.priorityLevel;
                    var q = B(
                      A.expirationTime <= V
                    );
                    if (V = n.unstable_now(), typeof q == "function") {
                      A.callback = q, K(V), et = !0;
                      break e;
                    }
                    A === o(v) && c(v), K(V);
                  } else c(v);
                  A = o(v);
                }
                if (A !== null) et = !0;
                else {
                  var _ = o(y);
                  _ !== null && wt(
                    U,
                    _.startTime - V
                  ), et = !1;
                }
              }
              break t;
            } finally {
              A = null, E = lt, b = !1;
            }
            et = void 0;
          }
        } finally {
          et ? L() : k = !1;
        }
      }
    }
    var L;
    if (typeof j == "function")
      L = function() {
        j(W);
      };
    else if (typeof MessageChannel < "u") {
      var pt = new MessageChannel(), gt = pt.port2;
      pt.port1.onmessage = W, L = function() {
        gt.postMessage(null);
      };
    } else
      L = function() {
        H(W, 0);
      };
    function wt(V, et) {
      g = H(function() {
        V(n.unstable_now());
      }, et);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(V) {
      V.callback = null;
    }, n.unstable_forceFrameRate = function(V) {
      0 > V || 125 < V ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < V ? Math.floor(1e3 / V) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return E;
    }, n.unstable_next = function(V) {
      switch (E) {
        case 1:
        case 2:
        case 3:
          var et = 3;
          break;
        default:
          et = E;
      }
      var lt = E;
      E = et;
      try {
        return V();
      } finally {
        E = lt;
      }
    }, n.unstable_requestPaint = function() {
      z = !0;
    }, n.unstable_runWithPriority = function(V, et) {
      switch (V) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          V = 3;
      }
      var lt = E;
      E = V;
      try {
        return et();
      } finally {
        E = lt;
      }
    }, n.unstable_scheduleCallback = function(V, et, lt) {
      var B = n.unstable_now();
      switch (typeof lt == "object" && lt !== null ? (lt = lt.delay, lt = typeof lt == "number" && 0 < lt ? B + lt : B) : lt = B, V) {
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
      return q = lt + q, V = {
        id: C++,
        callback: et,
        priorityLevel: V,
        startTime: lt,
        expirationTime: q,
        sortIndex: -1
      }, lt > B ? (V.sortIndex = lt, l(y, V), o(v) === null && V === o(y) && (w ? (N(g), g = -1) : w = !0, wt(U, lt - B))) : (V.sortIndex = q, l(v, V), x || b || (x = !0, k || (k = !0, L()))), V;
    }, n.unstable_shouldYield = Q, n.unstable_wrapCallback = function(V) {
      var et = E;
      return function() {
        var lt = E;
        E = et;
        try {
          return V.apply(this, arguments);
        } finally {
          E = lt;
        }
      };
    };
  })(Co)), Co;
}
var ud;
function Vh() {
  return ud || (ud = 1, To.exports = Qh()), To.exports;
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
var dd;
function Xh() {
  return dd || (dd = 1, (function(n) {
    n.exports = function(l) {
      function o(t, e, a, i) {
        return new xm(t, e, a, i);
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
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(s(188));
          return e !== t ? null : t;
        }
        for (var a = t, i = e; ; ) {
          var r = a.return;
          if (r === null) break;
          var u = r.alternate;
          if (u === null) {
            if (i = r.return, i !== null) {
              a = i;
              continue;
            }
            break;
          }
          if (r.child === u.child) {
            for (u = r.child; u; ) {
              if (u === a) return p(r), t;
              if (u === i) return p(r), e;
              u = u.sibling;
            }
            throw Error(s(188));
          }
          if (a.return !== i.return) a = r, i = u;
          else {
            for (var m = !1, S = r.child; S; ) {
              if (S === a) {
                m = !0, a = r, i = u;
                break;
              }
              if (S === i) {
                m = !0, i = r, a = u;
                break;
              }
              S = S.sibling;
            }
            if (!m) {
              for (S = u.child; S; ) {
                if (S === a) {
                  m = !0, a = u, i = r;
                  break;
                }
                if (S === i) {
                  m = !0, i = u, a = r;
                  break;
                }
                S = S.sibling;
              }
              if (!m) throw Error(s(189));
            }
          }
          if (a.alternate !== i) throw Error(s(190));
        }
        if (a.tag !== 3) throw Error(s(188));
        return a.stateNode.current === a ? t : e;
      }
      function v(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = v(t), e !== null) return e;
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
      function C(t) {
        return t === null || typeof t != "object" ? null : (t = yu && t[yu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function A(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === zm ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case mn:
            return "Fragment";
          case Qr:
            return "Profiler";
          case bu:
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
            case fn:
              return "Portal";
            case ya:
              return t.displayName || "Context";
            case vu:
              return (t._context.displayName || "Context") + ".Consumer";
            case Vr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Jr:
              return e = t.displayName || null, e !== null ? e : A(t.type) || "Memo";
            case xa:
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
      function b(t) {
        0 > gn || (t.current = to[gn], to[gn] = null, gn--);
      }
      function x(t, e) {
        gn++, to[gn] = t.current, t.current = e;
      }
      function w(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Pp(t) / th | 0) | 0;
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
      function H(t, e, a) {
        var i = t.pendingLanes;
        if (i === 0) return 0;
        var r = 0, u = t.suspendedLanes, m = t.pingedLanes;
        t = t.warmLanes;
        var S = i & 134217727;
        return S !== 0 ? (i = S & ~u, i !== 0 ? r = z(i) : (m &= S, m !== 0 ? r = z(m) : a || (a = S & ~t, a !== 0 && (r = z(a))))) : (S = i & ~u, S !== 0 ? r = z(S) : m !== 0 ? r = z(m) : a || (a = i & ~t, a !== 0 && (r = z(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function N(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function j(t, e) {
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
        var t = Fl;
        return Fl <<= 1, (Fl & 62914560) === 0 && (Fl = 4194304), t;
      }
      function U(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function k(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, a, i, r, u) {
        var m = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var S = t.entanglements, R = t.expirationTimes, G = t.hiddenUpdates;
        for (a = m & ~a; 0 < a; ) {
          var J = 31 - be(a), X = 1 << J;
          S[J] = 0, R[J] = -1;
          var F = G[J];
          if (F !== null)
            for (G[J] = null, J = 0; J < F.length; J++) {
              var dt = F[J];
              dt !== null && (dt.lane &= -536870913);
            }
          a &= ~X;
        }
        i !== 0 && h(t, i, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(m & ~e));
      }
      function h(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var i = 31 - be(e);
        t.entangledLanes |= e, t.entanglements[i] = t.entanglements[i] | 1073741824 | a & 261930;
      }
      function D(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var i = 31 - be(a), r = 1 << i;
          r & e | t[i] & e && (t[i] |= e), a &= ~r;
        }
      }
      function Q(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : W(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function W(t) {
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
      function L(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function pt(t) {
        if (typeof ih == "function" && rh(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode(Pn, t);
          } catch {
          }
      }
      function gt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function wt(t) {
        if (no === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            no = e && e[1] || "", Xu = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + no + t + Xu;
      }
      function V(t, e) {
        if (!t || lo) return "";
        lo = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var i = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var X = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(X.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(X, []);
                    } catch (dt) {
                      var F = dt;
                    }
                    Reflect.construct(t, [], X);
                  } else {
                    try {
                      X.call();
                    } catch (dt) {
                      F = dt;
                    }
                    t.call(X.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (dt) {
                    F = dt;
                  }
                  (X = t()) && typeof X.catch == "function" && X.catch(function() {
                  });
                }
              } catch (dt) {
                if (dt && F && typeof dt.stack == "string")
                  return [dt.stack, F.stack];
              }
              return [null, null];
            }
          };
          i.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var r = Object.getOwnPropertyDescriptor(
            i.DetermineComponentFrameRoot,
            "name"
          );
          r && r.configurable && Object.defineProperty(
            i.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var u = i.DetermineComponentFrameRoot(), m = u[0], S = u[1];
          if (m && S) {
            var R = m.split(`
`), G = S.split(`
`);
            for (r = i = 0; i < R.length && !R[i].includes("DetermineComponentFrameRoot"); )
              i++;
            for (; r < G.length && !G[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (i === R.length || r === G.length)
              for (i = R.length - 1, r = G.length - 1; 1 <= i && 0 <= r && R[i] !== G[r]; )
                r--;
            for (; 1 <= i && 0 <= r; i--, r--)
              if (R[i] !== G[r]) {
                if (i !== 1 || r !== 1)
                  do
                    if (i--, r--, 0 > r || R[i] !== G[r]) {
                      var J = `
` + R[i].replace(" at new ", " at ");
                      return t.displayName && J.includes("<anonymous>") && (J = J.replace("<anonymous>", t.displayName)), J;
                    }
                  while (1 <= i && 0 <= r);
                break;
              }
          }
        } finally {
          lo = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? wt(a) : "";
      }
      function et(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return wt(t.type);
          case 16:
            return wt("Lazy");
          case 13:
            return t.child !== e && e !== null ? wt("Suspense Fallback") : wt("Suspense");
          case 19:
            return wt("SuspenseList");
          case 0:
          case 15:
            return V(t.type, !1);
          case 11:
            return V(t.type.render, !1);
          case 1:
            return V(t.type, !0);
          case 31:
            return wt("Activity");
          default:
            return "";
        }
      }
      function lt(t) {
        try {
          var e = "", a = null;
          do
            e += et(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (i) {
          return `
Error generating stack: ` + i.message + `
` + i.stack;
        }
      }
      function B(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Zu.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: lt(e)
          }, Zu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: lt(e)
        };
      }
      function q(t, e) {
        vn[yn++] = tl, vn[yn++] = $l, $l = t, tl = e;
      }
      function _(t, e, a) {
        ze[Ee++] = Qe, ze[Ee++] = Ve, ze[Ee++] = wa, wa = t;
        var i = Qe;
        t = Ve;
        var r = 32 - be(i) - 1;
        i &= ~(1 << r), a += 1;
        var u = 32 - be(e) + r;
        if (30 < u) {
          var m = r - r % 5;
          u = (i & (1 << m) - 1).toString(32), i >>= m, r -= m, Qe = 1 << 32 - be(e) + r | a << r | i, Ve = u + t;
        } else
          Qe = 1 << u | a << r | i, Ve = t;
      }
      function Y(t) {
        t.return !== null && (q(t, 1), _(t, 1, 0));
      }
      function nt(t) {
        for (; t === $l; )
          $l = vn[--yn], vn[yn] = null, tl = vn[--yn], vn[yn] = null;
        for (; t === wa; )
          wa = ze[--Ee], ze[Ee] = null, Ve = ze[--Ee], ze[Ee] = null, Qe = ze[--Ee], ze[Ee] = null;
      }
      function tt(t, e) {
        ze[Ee++] = Qe, ze[Ee++] = Ve, ze[Ee++] = wa, Qe = e.id, Ve = e.overflow, wa = t;
      }
      function at(t, e) {
        x(_a, e), x(el, t), x(te, null), t = Tm(e), b(te), x(te, t);
      }
      function it() {
        b(te), b(el), b(_a);
      }
      function St(t) {
        t.memoizedState !== null && x(Pl, t);
        var e = te.current, a = Cm(e, t.type);
        e !== a && (x(el, t), x(te, a));
      }
      function Jt(t) {
        el.current === t && (b(te), b(el)), Pl.current === t && (b(Pl), ea ? Xa._currentValue = pn : Xa._currentValue2 = pn);
      }
      function ut(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Hn(B(e, t)), io;
      }
      function Ha(t, e) {
        if (!re) throw Error(s(175));
        Cp(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ut(t, !0);
      }
      function Da(t) {
        for (ee = t.return; ee; )
          switch (ee.tag) {
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
              ee = ee.return;
          }
      }
      function Ae(t) {
        if (!re || t !== ee) return !1;
        if (!_t) return Da(t), _t = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Au(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ut(t) : e !== 3 && (e !== 5 || Au(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ut(t), Da(t), e === 13) {
          if (!re) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Rp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Op(t);
        } else
          Ot = Vt && e === 27 ? yp(
            t.type,
            Ot
          ) : ee ? Mu(t.stateNode) : null;
        return !0;
      }
      function Oe() {
        re && (Ot = ee = null, _t = !1);
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
      function fa(t, e, a) {
        ea ? (x(ti, e._currentValue), e._currentValue = a) : (x(ti, e._currentValue2), e._currentValue2 = a);
      }
      function We(t) {
        var e = ti.current;
        ea ? t._currentValue = e : t._currentValue2 = e, b(ti);
      }
      function Yi(t, e, a) {
        for (; t !== null; ) {
          var i = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, i !== null && (i.childLanes |= e)) : i !== null && (i.childLanes & e) !== e && (i.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Gi(t, e, a, i) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var m = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var S = u;
              u = r;
              for (var R = 0; R < e.length; R++)
                if (S.context === e[R]) {
                  u.lanes |= a, S = u.alternate, S !== null && (S.lanes |= a), Yi(
                    u.return,
                    a,
                    t
                  ), i || (m = null);
                  break t;
                }
              u = S.next;
            }
          } else if (r.tag === 18) {
            if (m = r.return, m === null) throw Error(s(341));
            m.lanes |= a, u = m.alternate, u !== null && (u.lanes |= a), Yi(m, a, t), m = null;
          } else m = r.child;
          if (m !== null) m.return = r;
          else
            for (m = r; m !== null; ) {
              if (m === t) {
                m = null;
                break;
              }
              if (r = m.sibling, r !== null) {
                r.return = m.return, m = r;
                break;
              }
              m = m.return;
            }
          r = m;
        }
      }
      function rn(t, e, a, i) {
        t = null;
        for (var r = e, u = !1; r !== null; ) {
          if (!u) {
            if ((r.flags & 524288) !== 0) u = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var m = r.alternate;
            if (m === null) throw Error(s(387));
            if (m = m.memoizedProps, m !== null) {
              var S = r.type;
              ye(r.pendingProps.value, m.value) || (t !== null ? t.push(S) : t = [S]);
            }
          } else if (r === Pl.current) {
            if (m = r.alternate, m === null) throw Error(s(387));
            m.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Xa) : t = [Xa]);
          }
          r = r.return;
        }
        t !== null && Gi(
          e,
          t,
          a,
          i
        ), e.flags |= 262144;
      }
      function gl(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ye(
            ea ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Ua(t) {
        Za = t, na = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function $t(t) {
        return is(Za, t);
      }
      function bl(t, e) {
        return Za === null && Ua(t), is(t, e);
      }
      function is(t, e) {
        var a = ea ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, na === null) {
          if (t === null) throw Error(s(308));
          na = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else na = na.next = e;
        return a;
      }
      function Ki() {
        return {
          controller: new sh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Dn(t) {
        t.refCount--, t.refCount === 0 && ch(uh, function() {
          t.controller.abort();
        });
      }
      function vl() {
      }
      function Ye(t) {
        t !== xn && t.next === null && (xn === null ? ei = xn = t : xn = xn.next = t), ai = !0, ro || (ro = !0, Ff());
      }
      function on(t, e) {
        if (!oo && ai) {
          oo = !0;
          do
            for (var a = !1, i = ei; i !== null; ) {
              if (t !== 0) {
                var r = i.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var m = i.suspendedLanes, S = i.pingedLanes;
                  u = (1 << 31 - be(42 | t) + 1) - 1, u &= r & ~(m & ~S), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, us(i, u));
              } else
                u = xt, u = H(
                  i,
                  i === Mt ? u : 0,
                  i.cancelPendingCommit !== null || i.timeoutHandle !== Va
                ), (u & 3) === 0 || N(i, u) || (a = !0, us(i, u));
              i = i.next;
            }
          while (a);
          oo = !1;
        }
      }
      function rs() {
        os();
      }
      function os() {
        ai = ro = !1;
        var t = 0;
        Ja !== 0 && Bm() && (t = Ja);
        for (var e = de(), a = null, i = ei; i !== null; ) {
          var r = i.next, u = ss(i, e);
          u === 0 ? (i.next = null, a === null ? ei = r : a.next = r, r === null && (xn = a)) : (a = i, (t !== 0 || (u & 3) !== 0) && (ai = !0)), i = r;
        }
        Xt !== 0 && Xt !== 5 || on(t), Ja !== 0 && (Ja = 0);
      }
      function ss(t, e) {
        for (var a = t.suspendedLanes, i = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var m = 31 - be(u), S = 1 << m, R = r[m];
          R === -1 ? ((S & a) === 0 || (S & i) !== 0) && (r[m] = j(S, e)) : R <= e && (t.expiredLanes |= S), u &= ~S;
        }
        if (e = Mt, a = xt, a = H(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Va
        ), i = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return i !== null && i !== null && eo(i), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || N(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (i !== null && eo(i), L(a)) {
            case 2:
            case 8:
              a = nh;
              break;
            case 32:
              a = ao;
              break;
            case 268435456:
              a = lh;
              break;
            default:
              a = ao;
          }
          return i = cs.bind(null, t), a = Il(a, i), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return i !== null && i !== null && eo(i), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function cs(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Wn() && t.callbackNode !== a)
          return null;
        var i = xt;
        return i = H(
          t,
          t === Mt ? i : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Va
        ), i === 0 ? null : (Zc(t, i, e), ss(t, de()), t.callbackNode != null && t.callbackNode === a ? cs.bind(null, t) : null);
      }
      function us(t, e) {
        if (Wn()) return null;
        Zc(t, e, !0);
      }
      function Ff() {
        Xm ? Zm(function() {
          (vt & 6) !== 0 ? Il(
            Qu,
            rs
          ) : os();
        }) : Il(
          Qu,
          rs
        );
      }
      function Qi() {
        if (Ja === 0) {
          var t = wn;
          t === 0 && (t = Ll, Ll <<= 1, (Ll & 261888) === 0 && (Ll = 256)), Ja = t;
        }
        return Ja;
      }
      function If(t, e) {
        if (al === null) {
          var a = al = [];
          so = 0, wn = Qi(), _n = {
            status: "pending",
            value: void 0,
            then: function(i) {
              a.push(i);
            }
          };
        }
        return so++, e.then(ds, ds), e;
      }
      function ds() {
        if (--so === 0 && al !== null) {
          _n !== null && (_n.status = "fulfilled");
          var t = al;
          al = null, wn = 0, _n = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function $f(t, e) {
        var a = [], i = {
          status: "pending",
          value: null,
          reason: null,
          then: function(r) {
            a.push(r);
          }
        };
        return t.then(
          function() {
            i.status = "fulfilled", i.value = e;
            for (var r = 0; r < a.length; r++) (0, a[r])(e);
          },
          function(r) {
            for (i.status = "rejected", i.reason = r, r = 0; r < a.length; r++)
              (0, a[r])(void 0);
          }
        ), i;
      }
      function Vi() {
        var t = La.current;
        return t !== null ? t : Mt.pooledCache;
      }
      function yl(t, e) {
        e === null ? x(La, La.current) : x(La, e.pool);
      }
      function fs() {
        var t = Vi();
        return t === null ? null : {
          parent: ea ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function xl(t, e) {
        if (ye(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), i = Object.keys(e);
        if (a.length !== i.length) return !1;
        for (i = 0; i < a.length; i++) {
          var r = a[i];
          if (!oh.call(e, r) || !ye(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function ms(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function ps(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(vl, vl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, gs(t), t;
          default:
            if (typeof e.status == "string") e.then(vl, vl);
            else {
              if (t = Mt, t !== null && 100 < t.shellSuspendCounter)
                throw Error(s(482));
              t = e, t.status = "pending", t.then(
                function(i) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "fulfilled", r.value = i;
                  }
                },
                function(i) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "rejected", r.reason = i;
                  }
                }
              );
            }
            switch (e.status) {
              case "fulfilled":
                return e.value;
              case "rejected":
                throw t = e.reason, gs(t), t;
            }
            throw Wa = e, Sn;
        }
      }
      function Ba(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Wa = a, Sn) : a;
        }
      }
      function hs() {
        if (Wa === null) throw Error(s(459));
        var t = Wa;
        return Wa = null, t;
      }
      function gs(t) {
        if (t === Sn || t === ni)
          throw Error(s(483));
      }
      function wl(t) {
        var e = nl;
        return nl += 1, kn === null && (kn = []), ps(kn, t, e);
      }
      function Un(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function _l(t, e) {
        throw e.$$typeof === Sm ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function bs(t) {
        function e(M, T) {
          if (t) {
            var O = M.deletions;
            O === null ? (M.deletions = [T], M.flags |= 16) : O.push(T);
          }
        }
        function a(M, T) {
          if (!t) return null;
          for (; T !== null; )
            e(M, T), T = T.sibling;
          return null;
        }
        function i(M) {
          for (var T = /* @__PURE__ */ new Map(); M !== null; )
            M.key !== null ? T.set(M.key, M) : T.set(M.index, M), M = M.sibling;
          return T;
        }
        function r(M, T) {
          return M = ta(M, T), M.index = 0, M.sibling = null, M;
        }
        function u(M, T, O) {
          return M.index = O, t ? (O = M.alternate, O !== null ? (O = O.index, O < T ? (M.flags |= 67108866, T) : O) : (M.flags |= 67108866, T)) : (M.flags |= 1048576, T);
        }
        function m(M) {
          return t && M.alternate === null && (M.flags |= 67108866), M;
        }
        function S(M, T, O, Z) {
          return T === null || T.tag !== 6 ? (T = qr(O, M.mode, Z), T.return = M, T) : (T = r(T, O), T.return = M, T);
        }
        function R(M, T, O, Z) {
          var ot = O.type;
          return ot === mn ? J(
            M,
            T,
            O.props.children,
            Z,
            O.key
          ) : T !== null && (T.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === xa && Ba(ot) === T.type) ? (T = r(T, O.props), Un(T, O), T.return = M, T) : (T = Vl(
            O.type,
            O.key,
            O.props,
            null,
            M.mode,
            Z
          ), Un(T, O), T.return = M, T);
        }
        function G(M, T, O, Z) {
          return T === null || T.tag !== 4 || T.stateNode.containerInfo !== O.containerInfo || T.stateNode.implementation !== O.implementation ? (T = Yr(O, M.mode, Z), T.return = M, T) : (T = r(T, O.children || []), T.return = M, T);
        }
        function J(M, T, O, Z, ot) {
          return T === null || T.tag !== 7 ? (T = Qa(
            O,
            M.mode,
            Z,
            ot
          ), T.return = M, T) : (T = r(T, O), T.return = M, T);
        }
        function X(M, T, O) {
          if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
            return T = qr(
              "" + T,
              M.mode,
              O
            ), T.return = M, T;
          if (typeof T == "object" && T !== null) {
            switch (T.$$typeof) {
              case Xl:
                return O = Vl(
                  T.type,
                  T.key,
                  T.props,
                  null,
                  M.mode,
                  O
                ), Un(O, T), O.return = M, O;
              case fn:
                return T = Yr(
                  T,
                  M.mode,
                  O
                ), T.return = M, T;
              case xa:
                return T = Ba(T), X(M, T, O);
            }
            if (Zl(T) || C(T))
              return T = Qa(
                T,
                M.mode,
                O,
                null
              ), T.return = M, T;
            if (typeof T.then == "function")
              return X(M, wl(T), O);
            if (T.$$typeof === ya)
              return X(
                M,
                bl(M, T),
                O
              );
            _l(M, T);
          }
          return null;
        }
        function F(M, T, O, Z) {
          var ot = T !== null ? T.key : null;
          if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
            return ot !== null ? null : S(M, T, "" + O, Z);
          if (typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case Xl:
                return O.key === ot ? R(M, T, O, Z) : null;
              case fn:
                return O.key === ot ? G(M, T, O, Z) : null;
              case xa:
                return O = Ba(O), F(M, T, O, Z);
            }
            if (Zl(O) || C(O))
              return ot !== null ? null : J(M, T, O, Z, null);
            if (typeof O.then == "function")
              return F(
                M,
                T,
                wl(O),
                Z
              );
            if (O.$$typeof === ya)
              return F(
                M,
                T,
                bl(M, O),
                Z
              );
            _l(M, O);
          }
          return null;
        }
        function dt(M, T, O, Z, ot) {
          if (typeof Z == "string" && Z !== "" || typeof Z == "number" || typeof Z == "bigint")
            return M = M.get(O) || null, S(T, M, "" + Z, ot);
          if (typeof Z == "object" && Z !== null) {
            switch (Z.$$typeof) {
              case Xl:
                return M = M.get(
                  Z.key === null ? O : Z.key
                ) || null, R(T, M, Z, ot);
              case fn:
                return M = M.get(
                  Z.key === null ? O : Z.key
                ) || null, G(T, M, Z, ot);
              case xa:
                return Z = Ba(Z), dt(
                  M,
                  T,
                  O,
                  Z,
                  ot
                );
            }
            if (Zl(Z) || C(Z))
              return M = M.get(O) || null, J(T, M, Z, ot, null);
            if (typeof Z.then == "function")
              return dt(
                M,
                T,
                O,
                wl(Z),
                ot
              );
            if (Z.$$typeof === ya)
              return dt(
                M,
                T,
                O,
                bl(T, Z),
                ot
              );
            _l(T, Z);
          }
          return null;
        }
        function ae(M, T, O, Z) {
          for (var ot = null, Ht = null, st = T, zt = T = 0, Ft = null; st !== null && zt < O.length; zt++) {
            st.index > zt ? (Ft = st, st = null) : Ft = st.sibling;
            var Et = F(
              M,
              st,
              O[zt],
              Z
            );
            if (Et === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Et.alternate === null && e(M, st), T = u(Et, T, zt), Ht === null ? ot = Et : Ht.sibling = Et, Ht = Et, st = Ft;
          }
          if (zt === O.length)
            return a(M, st), _t && q(M, zt), ot;
          if (st === null) {
            for (; zt < O.length; zt++)
              st = X(M, O[zt], Z), st !== null && (T = u(
                st,
                T,
                zt
              ), Ht === null ? ot = st : Ht.sibling = st, Ht = st);
            return _t && q(M, zt), ot;
          }
          for (st = i(st); zt < O.length; zt++)
            Ft = dt(
              st,
              M,
              zt,
              O[zt],
              Z
            ), Ft !== null && (t && Ft.alternate !== null && st.delete(
              Ft.key === null ? zt : Ft.key
            ), T = u(
              Ft,
              T,
              zt
            ), Ht === null ? ot = Ft : Ht.sibling = Ft, Ht = Ft);
          return t && st.forEach(function(Ca) {
            return e(M, Ca);
          }), _t && q(M, zt), ot;
        }
        function ul(M, T, O, Z) {
          if (O == null) throw Error(s(151));
          for (var ot = null, Ht = null, st = T, zt = T = 0, Ft = null, Et = O.next(); st !== null && !Et.done; zt++, Et = O.next()) {
            st.index > zt ? (Ft = st, st = null) : Ft = st.sibling;
            var Ca = F(M, st, Et.value, Z);
            if (Ca === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Ca.alternate === null && e(M, st), T = u(Ca, T, zt), Ht === null ? ot = Ca : Ht.sibling = Ca, Ht = Ca, st = Ft;
          }
          if (Et.done)
            return a(M, st), _t && q(M, zt), ot;
          if (st === null) {
            for (; !Et.done; zt++, Et = O.next())
              Et = X(M, Et.value, Z), Et !== null && (T = u(
                Et,
                T,
                zt
              ), Ht === null ? ot = Et : Ht.sibling = Et, Ht = Et);
            return _t && q(M, zt), ot;
          }
          for (st = i(st); !Et.done; zt++, Et = O.next())
            Et = dt(
              st,
              M,
              zt,
              Et.value,
              Z
            ), Et !== null && (t && Et.alternate !== null && st.delete(Et.key === null ? zt : Et.key), T = u(Et, T, zt), Ht === null ? ot = Et : Ht.sibling = Et, Ht = Et);
          return t && st.forEach(function(ph) {
            return e(M, ph);
          }), _t && q(M, zt), ot;
        }
        function Pa(M, T, O, Z) {
          if (typeof O == "object" && O !== null && O.type === mn && O.key === null && (O = O.props.children), typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case Xl:
                t: {
                  for (var ot = O.key; T !== null; ) {
                    if (T.key === ot) {
                      if (ot = O.type, ot === mn) {
                        if (T.tag === 7) {
                          a(
                            M,
                            T.sibling
                          ), Z = r(
                            T,
                            O.props.children
                          ), Z.return = M, M = Z;
                          break t;
                        }
                      } else if (T.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === xa && Ba(ot) === T.type) {
                        a(
                          M,
                          T.sibling
                        ), Z = r(T, O.props), Un(Z, O), Z.return = M, M = Z;
                        break t;
                      }
                      a(M, T);
                      break;
                    } else e(M, T);
                    T = T.sibling;
                  }
                  O.type === mn ? (Z = Qa(
                    O.props.children,
                    M.mode,
                    Z,
                    O.key
                  ), Z.return = M, M = Z) : (Z = Vl(
                    O.type,
                    O.key,
                    O.props,
                    null,
                    M.mode,
                    Z
                  ), Un(Z, O), Z.return = M, M = Z);
                }
                return m(M);
              case fn:
                t: {
                  for (ot = O.key; T !== null; ) {
                    if (T.key === ot)
                      if (T.tag === 4 && T.stateNode.containerInfo === O.containerInfo && T.stateNode.implementation === O.implementation) {
                        a(
                          M,
                          T.sibling
                        ), Z = r(
                          T,
                          O.children || []
                        ), Z.return = M, M = Z;
                        break t;
                      } else {
                        a(M, T);
                        break;
                      }
                    else e(M, T);
                    T = T.sibling;
                  }
                  Z = Yr(O, M.mode, Z), Z.return = M, M = Z;
                }
                return m(M);
              case xa:
                return O = Ba(O), Pa(
                  M,
                  T,
                  O,
                  Z
                );
            }
            if (Zl(O))
              return ae(
                M,
                T,
                O,
                Z
              );
            if (C(O)) {
              if (ot = C(O), typeof ot != "function")
                throw Error(s(150));
              return O = ot.call(O), ul(
                M,
                T,
                O,
                Z
              );
            }
            if (typeof O.then == "function")
              return Pa(
                M,
                T,
                wl(O),
                Z
              );
            if (O.$$typeof === ya)
              return Pa(
                M,
                T,
                bl(M, O),
                Z
              );
            _l(M, O);
          }
          return typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint" ? (O = "" + O, T !== null && T.tag === 6 ? (a(M, T.sibling), Z = r(T, O), Z.return = M, M = Z) : (a(M, T), Z = qr(O, M.mode, Z), Z.return = M, M = Z), m(M)) : a(M, T);
        }
        return function(M, T, O, Z) {
          try {
            nl = 0;
            var ot = Pa(
              M,
              T,
              O,
              Z
            );
            return kn = null, ot;
          } catch (st) {
            if (st === Sn || st === ni) throw st;
            var Ht = o(29, st, null, M.mode);
            return Ht.lanes = Z, Ht.return = M, Ht;
          } finally {
          }
        };
      }
      function Sl() {
        for (var t = zn, e = uo = zn = 0; e < t; ) {
          var a = Te[e];
          Te[e++] = null;
          var i = Te[e];
          Te[e++] = null;
          var r = Te[e];
          Te[e++] = null;
          var u = Te[e];
          if (Te[e++] = null, i !== null && r !== null) {
            var m = i.pending;
            m === null ? r.next = r : (r.next = m.next, m.next = r), i.pending = r;
          }
          u !== 0 && vs(a, r, u);
        }
      }
      function kl(t, e, a, i) {
        Te[zn++] = t, Te[zn++] = e, Te[zn++] = a, Te[zn++] = i, uo |= i, t.lanes |= i, t = t.alternate, t !== null && (t.lanes |= i);
      }
      function Xi(t, e, a, i) {
        return kl(t, e, a, i), zl(t);
      }
      function qa(t, e) {
        return kl(t, null, null, e), zl(t);
      }
      function vs(t, e, a) {
        t.lanes |= a;
        var i = t.alternate;
        i !== null && (i.lanes |= a);
        for (var r = !1, u = t.return; u !== null; )
          u.childLanes |= a, i = u.alternate, i !== null && (i.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - be(a), t = u.hiddenUpdates, i = t[r], i === null ? t[r] = [e] : i.push(e), e.lane = a | 536870912), u) : null;
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
      function ma(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function pa(t, e, a) {
        var i = t.updateQueue;
        if (i === null) return null;
        if (i = i.shared, (vt & 2) !== 0) {
          var r = i.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), i.pending = e, e = zl(t), vs(t, null, a), e;
        }
        return kl(t, i, e, a), zl(t);
      }
      function Bn(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, D(t, a);
        }
      }
      function Li(t, e) {
        var a = t.updateQueue, i = t.alternate;
        if (i !== null && (i = i.updateQueue, a === i)) {
          var r = null, u = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var m = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              u === null ? r = u = m : u = u.next = m, a = a.next;
            } while (a !== null);
            u === null ? r = u = e : u = u.next = e;
          } else r = u = e;
          a = {
            baseState: i.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: u,
            shared: i.shared,
            callbacks: i.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function qn() {
        if (fo) {
          var t = _n;
          if (t !== null) throw t;
        }
      }
      function Yn(t, e, a, i) {
        fo = !1;
        var r = t.updateQueue;
        ka = !1;
        var u = r.firstBaseUpdate, m = r.lastBaseUpdate, S = r.shared.pending;
        if (S !== null) {
          r.shared.pending = null;
          var R = S, G = R.next;
          R.next = null, m === null ? u = G : m.next = G, m = R;
          var J = t.alternate;
          J !== null && (J = J.updateQueue, S = J.lastBaseUpdate, S !== m && (S === null ? J.firstBaseUpdate = G : S.next = G, J.lastBaseUpdate = R));
        }
        if (u !== null) {
          var X = r.baseState;
          m = 0, J = G = R = null, S = u;
          do {
            var F = S.lane & -536870913, dt = F !== S.lane;
            if (dt ? (xt & F) === F : (i & F) === F) {
              F !== 0 && F === wn && (fo = !0), J !== null && (J = J.next = {
                lane: 0,
                tag: S.tag,
                payload: S.payload,
                callback: null,
                next: null
              });
              t: {
                var ae = t, ul = S;
                F = e;
                var Pa = a;
                switch (ul.tag) {
                  case 1:
                    if (ae = ul.payload, typeof ae == "function") {
                      X = ae.call(
                        Pa,
                        X,
                        F
                      );
                      break t;
                    }
                    X = ae;
                    break t;
                  case 3:
                    ae.flags = ae.flags & -65537 | 128;
                  case 0:
                    if (ae = ul.payload, F = typeof ae == "function" ? ae.call(Pa, X, F) : ae, F == null) break t;
                    X = Kr({}, X, F);
                    break t;
                  case 2:
                    ka = !0;
                }
              }
              F = S.callback, F !== null && (t.flags |= 64, dt && (t.flags |= 8192), dt = r.callbacks, dt === null ? r.callbacks = [F] : dt.push(F));
            } else
              dt = {
                lane: F,
                tag: S.tag,
                payload: S.payload,
                callback: S.callback,
                next: null
              }, J === null ? (G = J = dt, R = X) : J = J.next = dt, m |= F;
            if (S = S.next, S === null) {
              if (S = r.shared.pending, S === null)
                break;
              dt = S, S = dt.next, dt.next = null, r.lastBaseUpdate = dt, r.shared.pending = null;
            }
          } while (!0);
          J === null && (R = X), r.baseState = R, r.firstBaseUpdate = G, r.lastBaseUpdate = J, u === null && (r.shared.lanes = 0), Ea |= m, t.lanes = m, t.memoizedState = X;
        }
      }
      function ys(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function xs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            ys(a[t], e);
      }
      function ws(t, e) {
        t = ra, x(ii, t), x(En, e), ra = t | e.baseLanes;
      }
      function Wi() {
        x(ii, ra), x(En, En.current);
      }
      function Fi() {
        ra = ii.current, b(En), b(ii);
      }
      function ha(t) {
        var e = t.alternate;
        x(qt, qt.current & 1), x(xe, t), Ce === null && (e === null || En.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Ii(t) {
        x(qt, qt.current), x(xe, t), Ce === null && (Ce = t);
      }
      function _s(t) {
        t.tag === 22 ? (x(qt, qt.current), x(xe, t), Ce === null && (Ce = t)) : ga();
      }
      function ga() {
        x(qt, qt.current), x(xe, xe.current);
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
      function Pi(t, e, a, i, r, u) {
        return la = u, mt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, rt.H = t === null || t.memoizedState === null ? Wu : mo, Ia = !1, u = a(i, r), Ia = !1, Nn && (u = ks(
          e,
          a,
          i,
          r
        )), Ss(t), u;
      }
      function Ss(t) {
        rt.H = il;
        var e = jt !== null && jt.next !== null;
        if (la = 0, Yt = jt = mt = null, ri = !1, ll = 0, Tn = null, e) throw Error(s(300));
        t === null || Gt || (t = t.dependencies, t !== null && gl(t) && (Gt = !0));
      }
      function ks(t, e, a, i) {
        mt = t;
        var r = 0;
        do {
          if (Nn && (Tn = null), ll = 0, Nn = !1, 25 <= r) throw Error(s(301));
          if (r += 1, Yt = jt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          rt.H = Fu, u = e(a, i);
        } while (Nn);
        return u;
      }
      function Pf() {
        var t = rt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Gn(e) : e, t = t.useState()[0], (jt !== null ? jt.memoizedState : null) !== t && (mt.flags |= 1024), e;
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
        la = 0, Yt = jt = mt = null, Nn = !1, ll = oi = 0, Tn = null;
      }
      function se() {
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
        if (jt === null) {
          var t = mt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = jt.next;
        var e = Yt === null ? mt.memoizedState : Yt.next;
        if (e !== null)
          Yt = e, jt = t;
        else {
          if (t === null)
            throw mt.alternate === null ? Error(s(467)) : Error(s(310));
          jt = t, t = {
            memoizedState: jt.memoizedState,
            baseState: jt.baseState,
            baseQueue: jt.baseQueue,
            queue: jt.queue,
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
        return ll += 1, Tn === null && (Tn = []), t = ps(Tn, t, e), e = mt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, rt.H = e === null || e.memoizedState === null ? Wu : mo), t;
      }
      function Tl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Gn(t);
          if (t.$$typeof === ya) return $t(t);
        }
        throw Error(s(438, String(t)));
      }
      function nr(t) {
        var e = null, a = mt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var i = mt.alternate;
          i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (e = {
            data: i.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Nl(), mt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), i = 0; i < t; i++)
            a[i] = km;
        return e.index++, a;
      }
      function Fe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Cl(t) {
        var e = Bt();
        return lr(e, jt, t);
      }
      function lr(t, e, a) {
        var i = t.queue;
        if (i === null) throw Error(s(311));
        i.lastRenderedReducer = a;
        var r = t.baseQueue, u = i.pending;
        if (u !== null) {
          if (r !== null) {
            var m = r.next;
            r.next = u.next, u.next = m;
          }
          e.baseQueue = r = u, i.pending = null;
        }
        if (u = t.baseState, r === null) t.memoizedState = u;
        else {
          e = r.next;
          var S = m = null, R = null, G = e, J = !1;
          do {
            var X = G.lane & -536870913;
            if (X !== G.lane ? (xt & X) === X : (la & X) === X) {
              var F = G.revertLane;
              if (F === 0)
                R !== null && (R = R.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: G.action,
                  hasEagerState: G.hasEagerState,
                  eagerState: G.eagerState,
                  next: null
                }), X === wn && (J = !0);
              else if ((la & F) === F) {
                G = G.next, F === wn && (J = !0);
                continue;
              } else
                X = {
                  lane: 0,
                  revertLane: G.revertLane,
                  gesture: null,
                  action: G.action,
                  hasEagerState: G.hasEagerState,
                  eagerState: G.eagerState,
                  next: null
                }, R === null ? (S = R = X, m = u) : R = R.next = X, mt.lanes |= F, Ea |= F;
              X = G.action, Ia && a(u, X), u = G.hasEagerState ? G.eagerState : a(u, X);
            } else
              F = {
                lane: X,
                revertLane: G.revertLane,
                gesture: G.gesture,
                action: G.action,
                hasEagerState: G.hasEagerState,
                eagerState: G.eagerState,
                next: null
              }, R === null ? (S = R = F, m = u) : R = R.next = F, mt.lanes |= X, Ea |= X;
            G = G.next;
          } while (G !== null && G !== e);
          if (R === null ? m = u : R.next = S, !ye(u, t.memoizedState) && (Gt = !0, J && (a = _n, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = m, t.baseQueue = R, i.lastRenderedState = u;
        }
        return r === null && (i.lanes = 0), [t.memoizedState, i.dispatch];
      }
      function ir(t) {
        var e = Bt(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var i = a.dispatch, r = a.pending, u = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var m = r = r.next;
          do
            u = t(u, m.action), m = m.next;
          while (m !== r);
          ye(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, i];
      }
      function zs(t, e, a) {
        var i = mt, r = Bt(), u = _t;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var m = !ye(
          (jt || r).memoizedState,
          a
        );
        if (m && (r.memoizedState = a, Gt = !0), r = r.queue, sr(Ts.bind(null, i, r, t), [
          t
        ]), r.getSnapshot !== e || m || Yt !== null && Yt.memoizedState.tag & 1) {
          if (i.flags |= 2048, sn(
            9,
            { destroy: void 0 },
            Ns.bind(
              null,
              i,
              r,
              a,
              e
            ),
            null
          ), Mt === null) throw Error(s(349));
          u || (la & 127) !== 0 || Es(i, e, a);
        }
        return a;
      }
      function Es(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = mt.updateQueue, e === null ? (e = Nl(), mt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function Ns(t, e, a, i) {
        e.value = a, e.getSnapshot = i, Cs(e) && js(t);
      }
      function Ts(t, e, a) {
        return a(function() {
          Cs(e) && js(t);
        });
      }
      function Cs(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ye(t, a);
        } catch {
          return !0;
        }
      }
      function js(t) {
        var e = qa(t, 2);
        e !== null && ue(e, t, 2);
      }
      function rr(t) {
        var e = se();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Ia) {
            pt(!0);
            try {
              a();
            } finally {
              pt(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Fe,
          lastRenderedState: t
        }, e;
      }
      function Ms(t, e, a, i) {
        return t.baseState = a, lr(
          t,
          jt,
          typeof i == "function" ? i : Fe
        );
      }
      function tm(t, e, a, i, r) {
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
            then: function(m) {
              u.listeners.push(m);
            }
          };
          rt.T !== null ? a(!0) : u.isTransition = !1, i(u), a = e.pending, a === null ? (u.next = e.pending = u, As(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function As(t, e) {
        var a = e.action, i = e.payload, r = t.state;
        if (e.isTransition) {
          var u = rt.T, m = {};
          rt.T = m;
          try {
            var S = a(r, i), R = rt.S;
            R !== null && R(m, S), Os(t, e, S);
          } catch (G) {
            or(t, e, G);
          } finally {
            u !== null && m.types !== null && (u.types = m.types), rt.T = u;
          }
        } else
          try {
            u = a(r, i), Os(t, e, u);
          } catch (G) {
            or(t, e, G);
          }
      }
      function Os(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(i) {
            Rs(t, e, i);
          },
          function(i) {
            return or(t, e, i);
          }
        ) : Rs(t, e, a);
      }
      function Rs(t, e, a) {
        e.status = "fulfilled", e.value = a, Hs(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, As(t, a)));
      }
      function or(t, e, a) {
        var i = t.pending;
        if (t.pending = null, i !== null) {
          i = i.next;
          do
            e.status = "rejected", e.reason = a, Hs(e), e = e.next;
          while (e !== i);
        }
        t.action = null;
      }
      function Hs(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Ds(t, e) {
        return e;
      }
      function Us(t, e) {
        if (_t) {
          var a = Mt.formState;
          if (a !== null) {
            t: {
              var i = mt;
              if (_t) {
                if (Ot) {
                  var r = bp(
                    Ot,
                    Ne
                  );
                  if (r) {
                    Ot = Mu(r), i = vp(r);
                    break t;
                  }
                }
                ut(i);
              }
              i = !1;
            }
            i && (e = a[0]);
          }
        }
        a = se(), a.memoizedState = a.baseState = e, i = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ds,
          lastRenderedState: e
        }, a.queue = i, a = ec.bind(
          null,
          mt,
          i
        ), i.dispatch = a, i = rr(!1);
        var u = fr.bind(
          null,
          mt,
          !1,
          i.queue
        );
        return i = se(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, i.queue = r, a = tm.bind(
          null,
          mt,
          r,
          u,
          a
        ), r.dispatch = a, i.memoizedState = t, [e, a, !1];
      }
      function Bs(t) {
        var e = Bt();
        return qs(e, jt, t);
      }
      function qs(t, e, a) {
        if (e = lr(
          t,
          e,
          Ds
        )[0], t = Cl(Fe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var i = Gn(e);
          } catch (m) {
            throw m === Sn ? ni : m;
          }
        else i = e;
        e = Bt();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (mt.flags |= 2048, sn(
          9,
          { destroy: void 0 },
          em.bind(null, r, a),
          null
        )), [i, u, t];
      }
      function em(t, e) {
        t.action = e;
      }
      function Ys(t) {
        var e = Bt(), a = jt;
        if (a !== null)
          return qs(e, a, t);
        Bt(), e = e.memoizedState, a = Bt();
        var i = a.queue.dispatch;
        return a.memoizedState = t, [e, i, !1];
      }
      function sn(t, e, a, i) {
        return t = { tag: t, create: a, deps: i, inst: e, next: null }, e = mt.updateQueue, e === null && (e = Nl(), mt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (i = a.next, a.next = t, t.next = i, e.lastEffect = t), t;
      }
      function Gs() {
        return Bt().memoizedState;
      }
      function jl(t, e, a, i) {
        var r = se();
        mt.flags |= t, r.memoizedState = sn(
          1 | e,
          { destroy: void 0 },
          a,
          i === void 0 ? null : i
        );
      }
      function Ml(t, e, a, i) {
        var r = Bt();
        i = i === void 0 ? null : i;
        var u = r.memoizedState.inst;
        jt !== null && i !== null && $i(i, jt.memoizedState.deps) ? r.memoizedState = sn(e, u, a, i) : (mt.flags |= t, r.memoizedState = sn(
          1 | e,
          u,
          a,
          i
        ));
      }
      function Ks(t, e) {
        jl(8390656, 8, t, e);
      }
      function sr(t, e) {
        Ml(2048, 8, t, e);
      }
      function am(t) {
        mt.flags |= 4;
        var e = mt.updateQueue;
        if (e === null)
          e = Nl(), mt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Qs(t) {
        var e = Bt().memoizedState;
        return am({ ref: e, nextImpl: t }), function() {
          if ((vt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Vs(t, e) {
        return Ml(4, 2, t, e);
      }
      function Xs(t, e) {
        return Ml(4, 4, t, e);
      }
      function Zs(t, e) {
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
      function Js(t, e, a) {
        a = a != null ? a.concat([t]) : null, Ml(
          4,
          4,
          Zs.bind(null, e, t),
          a
        );
      }
      function cr() {
      }
      function Ls(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        return e !== null && $i(e, i[1]) ? i[0] : (a.memoizedState = [t, e], t);
      }
      function Ws(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        if (e !== null && $i(e, i[1]))
          return i[0];
        if (i = t(), Ia) {
          pt(!0);
          try {
            t();
          } finally {
            pt(!1);
          }
        }
        return a.memoizedState = [i, e], i;
      }
      function ur(t, e, a) {
        return a === void 0 || (la & 1073741824) !== 0 && (xt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Xc(), mt.lanes |= t, Ea |= t, a);
      }
      function Fs(t, e, a, i) {
        return ye(a, e) ? a : En.current !== null ? (t = ur(t, a, i), ye(t, e) || (Gt = !0), t) : (la & 42) === 0 || (la & 1073741824) !== 0 && (xt & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = Xc(), mt.lanes |= t, Ea |= t, e);
      }
      function Is(t, e, a, i, r) {
        var u = aa();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var m = rt.T, S = {};
        rt.T = S, fr(t, !1, e, a);
        try {
          var R = r(), G = rt.S;
          if (G !== null && G(S, R), R !== null && typeof R == "object" && typeof R.then == "function") {
            var J = $f(
              R,
              i
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
              i,
              he(t)
            );
        } catch (X) {
          Kn(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: X },
            he()
          );
        } finally {
          Lt(u), m !== null && S.types !== null && (m.types = S.types), rt.T = m;
        }
      }
      function $s(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: pn,
          baseState: pn,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Fe,
            lastRenderedState: pn
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
            lastRenderedReducer: Fe,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function dr() {
        return $t(Xa);
      }
      function Ps() {
        return Bt().memoizedState;
      }
      function tc() {
        return Bt().memoizedState;
      }
      function nm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = he();
              t = ma(a);
              var i = pa(e, t, a);
              i !== null && (ue(i, e, a), Bn(i, e, a)), e = { cache: Ki() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function lm(t, e, a) {
        var i = he();
        a = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t) ? ac(e, a) : (a = Xi(t, e, a, i), a !== null && (ue(a, t, i), nc(a, e, i)));
      }
      function ec(t, e, a) {
        var i = he();
        Kn(t, e, a, i);
      }
      function Kn(t, e, a, i) {
        var r = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Al(t)) ac(e, r);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var m = e.lastRenderedState, S = u(m, a);
              if (r.hasEagerState = !0, r.eagerState = S, ye(S, m))
                return kl(t, e, r, 0), Mt === null && Sl(), !1;
            } catch {
            } finally {
            }
          if (a = Xi(t, e, r, i), a !== null)
            return ue(a, t, i), nc(a, e, i), !0;
        }
        return !1;
      }
      function fr(t, e, a, i) {
        if (i = {
          lane: 2,
          revertLane: Qi(),
          gesture: null,
          action: i,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t)) {
          if (e) throw Error(s(479));
        } else
          e = Xi(
            t,
            a,
            i,
            2
          ), e !== null && ue(e, t, 2);
      }
      function Al(t) {
        var e = t.alternate;
        return t === mt || e !== null && e === mt;
      }
      function ac(t, e) {
        Nn = ri = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function nc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, D(t, a);
        }
      }
      function mr(t, e, a, i) {
        e = t.memoizedState, a = a(i, e), a = a == null ? e : Kr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function lc(t, e, a, i, r, u, m) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(i, u, m) : e.prototype && e.prototype.isPureReactComponent ? !xl(a, i) || !xl(r, u) : !0;
      }
      function ic(t, e, a, i) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, i), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, i), e.state !== t && po.enqueueReplaceState(e, e.state, null);
      }
      function Ya(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var i in e)
            i !== "ref" && (a[i] = e[i]);
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
        } catch (i) {
          setTimeout(function() {
            throw i;
          });
        }
      }
      function rc(t, e, a) {
        try {
          var i = t.onCaughtError;
          i(a.value, {
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
        return a = ma(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Ol(t, e);
        }, a;
      }
      function oc(t) {
        return t = ma(t), t.tag = 3, t;
      }
      function sc(t, e, a, i) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = i.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            rc(e, a, i);
          };
        }
        var m = a.stateNode;
        m !== null && typeof m.componentDidCatch == "function" && (t.callback = function() {
          rc(e, a, i), typeof r != "function" && (Na === null ? Na = /* @__PURE__ */ new Set([this]) : Na.add(this));
          var S = i.stack;
          this.componentDidCatch(i.value, {
            componentStack: S !== null ? S : ""
          });
        });
      }
      function im(t, e, a, i, r) {
        if (a.flags |= 32768, i !== null && typeof i == "object" && typeof i.then == "function") {
          if (e = a.alternate, e !== null && rn(
            e,
            a,
            r,
            !0
          ), a = xe.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Ce === null ? Kl() : a.alternate === null && Ut === 0 && (Ut = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, i === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([i]) : e.add(i), Ur(t, i, r)), !1;
              case 22:
                return a.flags |= 65536, i === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([i])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([i]) : a.add(i)), Ur(t, i, r)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return Ur(t, i, r), Kl(), !1;
        }
        if (_t)
          return e = xe.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, i !== io && (t = Error(s(422), { cause: i }), Hn(
            B(t, a)
          ))) : (i !== io && (e = Error(s(423), {
            cause: i
          }), Hn(
            B(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, i = B(i, a), r = pr(
            t.stateNode,
            i,
            r
          ), Li(t, r), Ut !== 4 && (Ut = 2)), !1;
        var u = Error(s(520), { cause: i });
        if (u = B(u, a), ol === null ? ol = [u] : ol.push(u), Ut !== 4 && (Ut = 2), e === null) return !0;
        i = B(i, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = pr(a.stateNode, i, t), Li(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Na === null || !Na.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = oc(r), sc(
                  r,
                  t,
                  a,
                  i
                ), Li(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function Pt(t, e, a, i) {
        e.child = t === null ? Lu(e, null, a, i) : Fa(
          e,
          t.child,
          a,
          i
        );
      }
      function cc(t, e, a, i, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in i) {
          var m = {};
          for (var S in i)
            S !== "ref" && (m[S] = i[S]);
        } else m = i;
        return Ua(e), i = Pi(
          t,
          e,
          a,
          m,
          u,
          r
        ), S = tr(), t !== null && !Gt ? (er(t, e, r), Ie(t, e, r)) : (_t && S && Y(e), e.flags |= 1, Pt(t, e, i, r), e.child);
      }
      function uc(t, e, a, i, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !Br(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, dc(
            t,
            e,
            u,
            i,
            r
          )) : (t = Vl(
            a.type,
            null,
            i,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !wr(t, r)) {
          var m = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : xl, a(m, i) && t.ref === e.ref)
            return Ie(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = ta(u, i), t.ref = e.ref, t.return = e, e.child = t;
      }
      function dc(t, e, a, i, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (xl(u, i) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = i = u, wr(t, r))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, Ie(t, e, r);
        }
        return hr(
          t,
          e,
          a,
          i,
          r
        );
      }
      function fc(t, e, a, i) {
        var r = i.children, u = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), i.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (u = u !== null ? u.baseLanes | a : a, t !== null) {
              for (i = e.child = t.child, r = 0; i !== null; )
                r = r | i.lanes | i.childLanes, i = i.sibling;
              i = r & ~u;
            } else i = 0, e.child = null;
            return mc(
              t,
              e,
              u,
              a,
              i
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && yl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? ws(e, u) : Wi(), _s(e);
          else
            return i = e.lanes = 536870912, mc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              i
            );
        } else
          u !== null ? (yl(e, u.cachePool), ws(e, u), ga(), e.memoizedState = null) : (t !== null && yl(e, null), Wi(), ga());
        return Pt(t, e, r, a), e.child;
      }
      function Qn(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function mc(t, e, a, i, r) {
        var u = Vi();
        return u = u === null ? null : {
          parent: ea ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && yl(e, null), Wi(), _s(e), t !== null && rn(t, e, i, !0), e.childLanes = r, null;
      }
      function Rl(t, e) {
        return e = Dl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function pc(t, e, a) {
        return Fa(e, t.child, null, a), t = Rl(
          e,
          e.pendingProps
        ), t.flags |= 2, pe(e), e.memoizedState = null, t;
      }
      function rm(t, e, a) {
        var i = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (_t) {
            if (i.mode === "hidden")
              return t = Rl(e, i), e.lanes = 536870912, Qn(null, t);
            if (Ii(e), (t = Ot) ? (t = Np(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Qe, overflow: Ve } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = du(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw ut(e);
            return e.lanes = 536870912, null;
          }
          return Rl(e, i);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var m = u.dehydrated;
          if (Ii(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = pc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Gt || rn(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Gt || r) {
            if (i = Mt, i !== null && (m = Q(i, a), m !== 0 && m !== u.retryLane))
              throw u.retryLane = m, qa(t, m), ue(i, t, m), ho;
            Kl(), e = pc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, re && (Ot = _p(m), ee = e, _t = !0, Sa = null, Ne = !1, t !== null && tt(e, t)), e = Rl(e, i), e.flags |= 4096;
          return e;
        }
        return t = ta(t.child, {
          mode: i.mode,
          children: i.children
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
      function hr(t, e, a, i, r) {
        return Ua(e), a = Pi(
          t,
          e,
          a,
          i,
          void 0,
          r
        ), i = tr(), t !== null && !Gt ? (er(t, e, r), Ie(t, e, r)) : (_t && i && Y(e), e.flags |= 1, Pt(t, e, a, r), e.child);
      }
      function hc(t, e, a, i, r, u) {
        return Ua(e), e.updateQueue = null, a = ks(
          e,
          i,
          a,
          r
        ), Ss(t), i = tr(), t !== null && !Gt ? (er(t, e, u), Ie(t, e, u)) : (_t && i && Y(e), e.flags |= 1, Pt(t, e, a, u), e.child);
      }
      function gc(t, e, a, i, r) {
        if (Ua(e), e.stateNode === null) {
          var u = bn, m = a.contextType;
          typeof m == "object" && m !== null && (u = $t(m)), u = new a(i, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = po, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = i, u.state = e.memoizedState, u.refs = {}, Zi(e), m = a.contextType, u.context = typeof m == "object" && m !== null ? $t(m) : bn, u.state = e.memoizedState, m = a.getDerivedStateFromProps, typeof m == "function" && (mr(
            e,
            a,
            m,
            i
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (m = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), m !== u.state && po.enqueueReplaceState(
            u,
            u.state,
            null
          ), Yn(e, i, u, r), qn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !0;
        } else if (t === null) {
          u = e.stateNode;
          var S = e.memoizedProps, R = Ya(a, S);
          u.props = R;
          var G = u.context, J = a.contextType;
          m = bn, typeof J == "object" && J !== null && (m = $t(J));
          var X = a.getDerivedStateFromProps;
          J = typeof X == "function" || typeof u.getSnapshotBeforeUpdate == "function", S = e.pendingProps !== S, J || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (S || G !== m) && ic(
            e,
            u,
            i,
            m
          ), ka = !1;
          var F = e.memoizedState;
          u.state = F, Yn(e, i, u, r), qn(), G = e.memoizedState, S || F !== G || ka ? (typeof X == "function" && (mr(
            e,
            a,
            X,
            i
          ), G = e.memoizedState), (R = ka || lc(
            e,
            a,
            R,
            i,
            F,
            G,
            m
          )) ? (J || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = i, e.memoizedState = G), u.props = i, u.state = G, u.context = m, i = R) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !1);
        } else {
          u = e.stateNode, Ji(t, e), m = e.memoizedProps, J = Ya(a, m), u.props = J, X = e.pendingProps, F = u.context, G = a.contextType, R = bn, typeof G == "object" && G !== null && (R = $t(G)), S = a.getDerivedStateFromProps, (G = typeof S == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (m !== X || F !== R) && ic(
            e,
            u,
            i,
            R
          ), ka = !1, F = e.memoizedState, u.state = F, Yn(e, i, u, r), qn();
          var dt = e.memoizedState;
          m !== X || F !== dt || ka || t !== null && t.dependencies !== null && gl(t.dependencies) ? (typeof S == "function" && (mr(
            e,
            a,
            S,
            i
          ), dt = e.memoizedState), (J = ka || lc(
            e,
            a,
            J,
            i,
            F,
            dt,
            R
          ) || t !== null && t.dependencies !== null && gl(t.dependencies)) ? (G || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(i, dt, R), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            i,
            dt,
            R
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 1024), e.memoizedProps = i, e.memoizedState = dt), u.props = i, u.state = dt, u.context = R, i = J) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 1024), i = !1);
        }
        return u = i, Hl(t, e), i = (e.flags & 128) !== 0, u || i ? (u = e.stateNode, a = i && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && i ? (e.child = Fa(
          e,
          t.child,
          null,
          r
        ), e.child = Fa(
          e,
          null,
          a,
          r
        )) : Pt(t, e, a, r), e.memoizedState = u.state, t = e.child) : t = Ie(
          t,
          e,
          r
        ), t;
      }
      function bc(t, e, a, i) {
        return Oe(), e.flags |= 256, Pt(t, e, a, i), e.child;
      }
      function gr(t) {
        return { baseLanes: t, cachePool: fs() };
      }
      function br(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= _e), t;
      }
      function vc(t, e, a) {
        var i = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, m;
        if ((m = u) || (m = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), m && (r = !0, e.flags &= -129), m = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (_t) {
            if (r ? ha(e) : ga(), (t = Ot) ? (t = Tp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Qe, overflow: Ve } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = du(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw ut(e);
            return $r(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var S = i.children;
          return i = i.fallback, r ? (ga(), r = e.mode, S = Dl(
            { mode: "hidden", children: S },
            r
          ), i = Qa(
            i,
            r,
            a,
            null
          ), S.return = e, i.return = e, S.sibling = i, e.child = S, i = e.child, i.memoizedState = gr(a), i.childLanes = br(
            t,
            m,
            a
          ), e.memoizedState = go, Qn(null, i)) : (ha(e), vr(e, S));
        }
        var R = t.memoizedState;
        if (R !== null && (S = R.dehydrated, S !== null)) {
          if (u)
            e.flags & 256 ? (ha(e), e.flags &= -257, e = yr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ga(), e.child = t.child, e.flags |= 128, e = null) : (ga(), S = i.fallback, r = e.mode, i = Dl(
              { mode: "visible", children: i.children },
              r
            ), S = Qa(
              S,
              r,
              a,
              null
            ), S.flags |= 2, i.return = e, S.return = e, i.sibling = S, e.child = i, Fa(
              e,
              t.child,
              null,
              a
            ), i = e.child, i.memoizedState = gr(a), i.childLanes = br(
              t,
              m,
              a
            ), e.memoizedState = go, e = Qn(null, i));
          else if (ha(e), $r(S))
            m = hp(S).digest, i = Error(s(419)), i.stack = "", i.digest = m, Hn({ value: i, source: null, stack: null }), e = yr(
              t,
              e,
              a
            );
          else if (Gt || rn(
            t,
            e,
            a,
            !1
          ), m = (a & t.childLanes) !== 0, Gt || m) {
            if (m = Mt, m !== null && (i = Q(
              m,
              a
            ), i !== 0 && i !== R.retryLane))
              throw R.retryLane = i, qa(t, i), ue(m, t, i), ho;
            Ir(S) || Kl(), e = yr(
              t,
              e,
              a
            );
          } else
            Ir(S) ? (e.flags |= 192, e.child = t.child, e = null) : (t = R.treeContext, re && (Ot = Sp(
              S
            ), ee = e, _t = !0, Sa = null, Ne = !1, t !== null && tt(e, t)), e = vr(
              e,
              i.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ga(), S = i.fallback, r = e.mode, R = t.child, u = R.sibling, i = ta(R, {
          mode: "hidden",
          children: i.children
        }), i.subtreeFlags = R.subtreeFlags & 65011712, u !== null ? S = ta(
          u,
          S
        ) : (S = Qa(
          S,
          r,
          a,
          null
        ), S.flags |= 2), S.return = e, i.return = e, i.sibling = S, e.child = i, Qn(null, i), i = e.child, S = t.child.memoizedState, S === null ? S = gr(a) : (r = S.cachePool, r !== null ? (R = ea ? Rt._currentValue : Rt._currentValue2, r = r.parent !== R ? { parent: R, pool: R } : r) : r = fs(), S = {
          baseLanes: S.baseLanes | a,
          cachePool: r
        }), i.memoizedState = S, i.childLanes = br(
          t,
          m,
          a
        ), e.memoizedState = go, Qn(t.child, i)) : (ha(e), a = t.child, t = a.sibling, a = ta(a, {
          mode: "visible",
          children: i.children
        }), a.return = e, a.sibling = null, t !== null && (m = e.deletions, m === null ? (e.deletions = [t], e.flags |= 16) : m.push(t)), e.child = a, e.memoizedState = null, a);
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
        return Fa(e, t.child, null, a), t = vr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function yc(t, e, a) {
        t.lanes |= e;
        var i = t.alternate;
        i !== null && (i.lanes |= e), Yi(t.return, e, a);
      }
      function xr(t, e, a, i, r, u) {
        var m = t.memoizedState;
        m === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: i,
          tail: a,
          tailMode: r,
          treeForkCount: u
        } : (m.isBackwards = e, m.rendering = null, m.renderingStartTime = 0, m.last = i, m.tail = a, m.tailMode = r, m.treeForkCount = u);
      }
      function xc(t, e, a) {
        var i = e.pendingProps, r = i.revealOrder, u = i.tail;
        i = i.children;
        var m = qt.current, S = (m & 2) !== 0;
        if (S ? (m = m & 1 | 2, e.flags |= 128) : m &= 1, x(qt, m), Pt(t, e, i, a), i = _t ? tl : 0, !S && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && yc(t, a, e);
            else if (t.tag === 19)
              yc(t, a, e);
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
              i
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
              i
            );
            break;
          case "together":
            xr(
              e,
              !1,
              null,
              null,
              void 0,
              i
            );
            break;
          default:
            e.memoizedState = null;
        }
        return e.child;
      }
      function Ie(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), Ea |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (rn(
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
          for (t = e.child, a = ta(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = ta(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function wr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && gl(t)));
      }
      function om(t, e, a) {
        switch (e.tag) {
          case 3:
            at(
              e,
              e.stateNode.containerInfo
            ), fa(e, Rt, t.memoizedState.cache), Oe();
            break;
          case 27:
          case 5:
            St(e);
            break;
          case 4:
            at(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            fa(
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
            var i = e.memoizedState;
            if (i !== null)
              return i.dehydrated !== null ? (ha(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? vc(
                t,
                e,
                a
              ) : (ha(e), t = Ie(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            ha(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (i = (a & e.childLanes) !== 0, i || (rn(
              t,
              e,
              a,
              !1
            ), i = (a & e.childLanes) !== 0), r) {
              if (i)
                return xc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), x(qt, qt.current), i) break;
            return null;
          case 22:
            return e.lanes = 0, fc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            fa(e, Rt, t.memoizedState.cache);
        }
        return Ie(t, e, a);
      }
      function wc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!wr(t, a) && (e.flags & 128) === 0)
              return Gt = !1, om(
                t,
                e,
                a
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, _t && (e.flags & 1048576) !== 0 && _(e, tl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var i = e.pendingProps;
              if (t = Ba(e.elementType), e.type = t, typeof t == "function")
                Br(t) ? (i = Ya(t, i), e.tag = 1, e = gc(
                  null,
                  e,
                  t,
                  i,
                  a
                )) : (e.tag = 0, e = hr(
                  null,
                  e,
                  t,
                  i,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Vr) {
                    e.tag = 11, e = cc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  } else if (r === Jr) {
                    e.tag = 14, e = uc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  }
                }
                throw e = A(t) || t, Error(s(306, e, ""));
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
            return i = e.type, r = Ya(
              i,
              e.pendingProps
            ), gc(
              t,
              e,
              i,
              r,
              a
            );
          case 3:
            t: {
              if (at(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              r = e.memoizedState, i = r.element, Ji(t, e), Yn(e, u, null, a);
              var m = e.memoizedState;
              if (u = m.cache, fa(e, Rt, u), u !== r.cache && Gi(
                e,
                [Rt],
                a,
                !0
              ), qn(), u = m.element, re && r.isDehydrated)
                if (r = {
                  element: u,
                  isDehydrated: !1,
                  cache: m.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = bc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== i) {
                  i = B(
                    Error(s(424)),
                    e
                  ), Hn(i), e = bc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (re && (Ot = wp(
                    e.stateNode.containerInfo
                  ), ee = e, _t = !0, Sa = null, Ne = !0), a = Lu(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Oe(), u === i) {
                  e = Ie(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                Pt(t, e, u, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Ue)
              return Hl(t, e), t === null ? (a = Ru(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : _t || (e.stateNode = Lp(
                e.type,
                e.pendingProps,
                _a.current,
                e
              )) : e.memoizedState = Ru(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return St(e), t === null && Vt && _t && (i = e.stateNode = Yu(
                e.type,
                e.pendingProps,
                _a.current,
                te.current,
                !1
              ), ee = e, Ne = !0, Ot = kp(
                e.type,
                i,
                Ot
              )), Pt(
                t,
                e,
                e.pendingProps.children,
                a
              ), Hl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && _t && (Xp(
              e.type,
              e.pendingProps,
              te.current
            ), (r = i = Ot) && (i = zp(
              i,
              e.type,
              e.pendingProps,
              Ne
            ), i !== null ? (e.stateNode = i, ee = e, Ot = xp(i), Ne = !1, r = !0) : r = !1), r || ut(e)), St(e), r = e.type, u = e.pendingProps, m = t !== null ? t.memoizedProps : null, i = u.children, Jl(r, u) ? i = null : m !== null && Jl(r, m) && (e.flags |= 32), e.memoizedState !== null && (r = Pi(
              t,
              e,
              Pf,
              null,
              null,
              a
            ), ea ? Xa._currentValue = r : Xa._currentValue2 = r), Hl(t, e), Pt(t, e, i, a), e.child;
          case 6:
            return t === null && _t && (Zp(
              e.pendingProps,
              te.current
            ), (t = a = Ot) && (a = Ep(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, ee = e, Ot = null, t = !0) : t = !1), t || ut(e)), null;
          case 13:
            return vc(t, e, a);
          case 4:
            return at(
              e,
              e.stateNode.containerInfo
            ), i = e.pendingProps, t === null ? e.child = Fa(
              e,
              null,
              i,
              a
            ) : Pt(t, e, i, a), e.child;
          case 11:
            return cc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return Pt(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return Pt(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return Pt(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return i = e.pendingProps, fa(e, e.type, i.value), Pt(
              t,
              e,
              i.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, i = e.pendingProps.children, Ua(e), r = $t(r), i = i(r), e.flags |= 1, Pt(t, e, i, a), e.child;
          case 14:
            return uc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return dc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return xc(
              t,
              e,
              a
            );
          case 31:
            return rm(t, e, a);
          case 22:
            return fc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ua(e), i = $t(Rt), t === null ? (r = Vi(), r === null && (r = Mt, u = Ki(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: i,
              cache: r
            }, Zi(e), fa(e, Rt, r)) : ((t.lanes & a) !== 0 && (Ji(t, e), Yn(e, null, null, a), qn()), r = t.memoizedState, u = e.memoizedState, r.parent !== i ? (r = { parent: i, cache: i }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), fa(e, Rt, i)) : (i = u.cache, fa(e, Rt, i), i !== r.cache && Gi(
              e,
              [Rt],
              a,
              !0
            ))), Pt(
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
        Ke && (t.flags |= 8);
      }
      function _c(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function _r(t, e, a, i) {
        if (ie)
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
        else if (Ke)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var u = r.stateNode;
              a && i && (u = Cu(
                u,
                r.type,
                r.memoizedProps
              )), Wr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && i && (u = ju(
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
      function Sc(t, e, a, i) {
        var r = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var m = u.stateNode;
              a && i && (m = Cu(
                m,
                u.type,
                u.memoizedProps
              )), Nu(t, m);
            } else if (u.tag === 6)
              m = u.stateNode, a && i && (m = ju(
                m,
                u.memoizedProps
              )), Nu(t, m);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), Sc(t, u, !0, !0), r = !0;
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
      function kc(t, e) {
        if (Ke && _c(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, i = Eu();
          Sc(i, e, !1, !1), t.pendingChildren = i, Re(e), pp(a, i);
        }
      }
      function Sr(t, e, a, i) {
        if (ie)
          t.memoizedProps !== i && Re(e);
        else if (Ke) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = _c(t, e)) || u !== i) {
            var m = te.current;
            u = mp(
              r,
              a,
              u,
              i,
              !t,
              null
            ), u === r ? e.stateNode = r : (Ul(e), wu(
              u,
              a,
              i,
              m
            ) && Re(e), e.stateNode = u, t && _r(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function kr(t, e, a, i, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Ym(e, i) : Gm(e, a, i))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Fr(e, i))
            if (Su(t.stateNode, e, i))
              t.flags |= 8192;
            else if (Fc()) t.flags |= 8192;
            else
              throw Wa = li, co;
        } else t.flags &= -16777217;
      }
      function zc(t, e) {
        if (Fp(e)) {
          if (t.flags |= 16777216, !qu(e))
            if (Fc()) t.flags |= 8192;
            else
              throw Wa = li, co;
        } else t.flags &= -16777217;
      }
      function Bl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? K() : 536870912, t.lanes |= e, Mn |= e);
      }
      function Vn(t, e) {
        if (!_t)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var a = null; e !== null; )
                e.alternate !== null && (a = e), e = e.sibling;
              a === null ? t.tail = null : a.sibling = null;
              break;
            case "collapsed":
              a = t.tail;
              for (var i = null; a !== null; )
                a.alternate !== null && (i = a), a = a.sibling;
              i === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : i.sibling = null;
          }
      }
      function At(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, i = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, i |= r.subtreeFlags & 65011712, i |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, i |= r.subtreeFlags, i |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= i, t.childLanes = a, e;
      }
      function sm(t, e, a) {
        var i = e.pendingProps;
        switch (nt(e), e.tag) {
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
            return a = e.stateNode, i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), We(Rt), it(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ae(e) ? Re(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, da())), kc(t, e), At(e), null;
          case 26:
            if (Ue) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (Re(e), u !== null ? (At(e), zc(
                e,
                u
              )) : (At(e), kr(
                e,
                r,
                null,
                i,
                a
              ))) : u ? u !== t.memoizedState ? (Re(e), At(e), zc(
                e,
                u
              )) : (At(e), e.flags &= -16777217) : (u = t.memoizedProps, ie ? u !== i && Re(e) : Sr(
                t,
                e,
                r,
                i
              ), At(e), kr(
                e,
                r,
                u,
                i,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Jt(e), a = _a.current, r = e.type, t !== null && e.stateNode != null)
                ie ? t.memoizedProps !== i && Re(e) : Sr(t, e, r, i);
              else {
                if (!i) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return At(e), null;
                }
                t = te.current, Ae(e) ? Ha(e, t) : (t = Yu(
                  r,
                  i,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Re(e));
              }
              return At(e), null;
            }
          case 5:
            if (Jt(e), r = e.type, t !== null && e.stateNode != null)
              Sr(t, e, r, i);
            else {
              if (!i) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return At(e), null;
              }
              if (u = te.current, Ae(e))
                Ha(e, u), qp(
                  e.stateNode,
                  r,
                  i,
                  u
                ) && (e.flags |= 64);
              else {
                var m = Am(
                  r,
                  i,
                  _a.current,
                  u,
                  e
                );
                Ul(e), _r(m, e, !1, !1), e.stateNode = m, wu(
                  m,
                  r,
                  i,
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
              a = t.memoizedProps, ie ? a !== i && Re(e) : Ke && (a !== i ? (t = _a.current, a = te.current, Ul(e), e.stateNode = _u(
                i,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof i != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = _a.current, a = te.current, Ae(e)) {
                if (!re) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, i = null, r = ee, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      i = r.memoizedProps;
                  }
                jp(
                  t,
                  a,
                  e,
                  i
                ) || ut(e, !0);
              } else
                Ul(e), e.stateNode = _u(
                  i,
                  t,
                  a,
                  e
                );
            }
            return At(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (i = Ae(e), a !== null) {
                if (t === null) {
                  if (!i) throw Error(s(318));
                  if (!re) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  Mp(t, e);
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
            if (i = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ae(e), i !== null && i.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!re) throw Error(s(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(s(317));
                  Ap(r, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                At(e), r = !1;
              } else
                r = da(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
            }
            return pe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = i !== null, t = t !== null && t.memoizedState !== null, a && (i = e.child, r = null, i.alternate !== null && i.alternate.memoizedState !== null && i.alternate.memoizedState.cachePool !== null && (r = i.alternate.memoizedState.cachePool.pool), u = null, i.memoizedState !== null && i.memoizedState.cachePool !== null && (u = i.memoizedState.cachePool.pool), u !== r && (i.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Bl(e, e.updateQueue), At(e), null);
          case 4:
            return it(), kc(t, e), t === null && Dm(e.stateNode.containerInfo), At(e), null;
          case 10:
            return We(e.type), At(e), null;
          case 19:
            if (b(qt), i = e.memoizedState, i === null) return At(e), null;
            if (r = (e.flags & 128) !== 0, u = i.rendering, u === null)
              if (r) Vn(i, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = El(t), u !== null) {
                      for (e.flags |= 128, Vn(i, !1), t = u.updateQueue, e.updateQueue = t, Bl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        uu(a, t), a = a.sibling;
                      return x(
                        qt,
                        qt.current & 1 | 2
                      ), _t && q(e, i.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                i.tail !== null && de() > sl && (e.flags |= 128, r = !0, Vn(i, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = El(u), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Bl(e, t), Vn(i, !0), i.tail === null && i.tailMode === "hidden" && !u.alternate && !_t)
                    return At(e), null;
                } else
                  2 * de() - i.renderingStartTime > sl && a !== 536870912 && (e.flags |= 128, r = !0, Vn(i, !1), e.lanes = 4194304);
              i.isBackwards ? (u.sibling = e.child, e.child = u) : (t = i.last, t !== null ? t.sibling = u : e.child = u, i.last = u);
            }
            return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = de(), t.sibling = null, a = qt.current, x(
              qt,
              r ? a & 1 | 2 : a & 1
            ), _t && q(e, i.treeForkCount), t) : (At(e), null);
          case 22:
          case 23:
            return pe(e), Fi(), i = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== i && (e.flags |= 8192) : i && (e.flags |= 8192), i ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (At(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : At(e), a = e.updateQueue, a !== null && Bl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), i = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (i = e.memoizedState.cachePool.pool), i !== a && (e.flags |= 2048), t !== null && b(La), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), We(Rt), At(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function cm(t, e) {
        switch (nt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return We(Rt), it(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
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
            return it(), null;
          case 10:
            return We(e.type), null;
          case 22:
          case 23:
            return pe(e), Fi(), t !== null && b(La), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return We(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Ec(t, e) {
        switch (nt(e), e.tag) {
          case 3:
            We(Rt), it();
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
            b(qt);
            break;
          case 10:
            We(e.type);
            break;
          case 22:
          case 23:
            pe(e), Fi(), t !== null && b(La);
            break;
          case 24:
            We(Rt);
        }
      }
      function Xn(t, e) {
        try {
          var a = e.updateQueue, i = a !== null ? a.lastEffect : null;
          if (i !== null) {
            var r = i.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                i = void 0;
                var u = a.create, m = a.inst;
                i = u(), m.destroy = i;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (S) {
          kt(e, e.return, S);
        }
      }
      function ba(t, e, a) {
        try {
          var i = e.updateQueue, r = i !== null ? i.lastEffect : null;
          if (r !== null) {
            var u = r.next;
            i = u;
            do {
              if ((i.tag & t) === t) {
                var m = i.inst, S = m.destroy;
                if (S !== void 0) {
                  m.destroy = void 0, r = e;
                  var R = a, G = S;
                  try {
                    G();
                  } catch (J) {
                    kt(
                      r,
                      R,
                      J
                    );
                  }
                }
              }
              i = i.next;
            } while (i !== u);
          }
        } catch (J) {
          kt(e, e.return, J);
        }
      }
      function Nc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            xs(e, a);
          } catch (i) {
            kt(t, t.return, i);
          }
        }
      }
      function Tc(t, e, a) {
        a.props = Ya(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (i) {
          kt(t, e, i);
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
                var i = Fn(t.stateNode);
                break;
              case 30:
                i = t.stateNode;
                break;
              default:
                i = t.stateNode;
            }
            typeof a == "function" ? t.refCleanup = a(i) : a.current = i;
          }
        } catch (r) {
          kt(t, e, r);
        }
      }
      function Ge(t, e) {
        var a = t.ref, i = t.refCleanup;
        if (a !== null)
          if (typeof i == "function")
            try {
              i();
            } catch (r) {
              kt(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (r) {
              kt(t, e, r);
            }
          else a.current = null;
      }
      function Cc(t) {
        var e = t.type, a = t.memoizedProps, i = t.stateNode;
        try {
          ap(i, e, a, t);
        } catch (r) {
          kt(t, t.return, r);
        }
      }
      function zr(t, e, a) {
        try {
          np(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          kt(t, t.return, i);
        }
      }
      function jc(t) {
        return t.tag === 5 || t.tag === 3 || (Ue ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && hn(t.type) : !1) || t.tag === 4;
      }
      function Er(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || jc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && hn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Nr(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? ip(a, t, e) : tp(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Nr(t, e, a), t = t.sibling; t !== null; )
            Nr(t, e, a), t = t.sibling;
      }
      function ql(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? lp(a, t, e) : Pm(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (ql(t, e, a), t = t.sibling; t !== null; )
            ql(t, e, a), t = t.sibling;
      }
      function Mc(t, e, a) {
        t = t.containerInfo;
        try {
          Tu(t, a);
        } catch (i) {
          kt(e, e.return, i);
        }
      }
      function Ac(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          $p(
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          kt(t, t.return, i);
        }
      }
      function um(t, e) {
        for (jm(t.containerInfo), Wt = e; Wt !== null; )
          if (t = Wt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Wt = e;
          else
            for (; Wt !== null; ) {
              t = Wt;
              var a = t.alternate;
              switch (e = t.flags, t.tag) {
                case 0:
                  if ((e & 4) !== 0 && (e = t.updateQueue, e = e !== null ? e.events : null, e !== null))
                    for (var i = 0; i < e.length; i++) {
                      var r = e[i];
                      r.ref.impl = r.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((e & 1024) !== 0 && a !== null) {
                    e = void 0, i = t, r = a.memoizedProps, a = a.memoizedState;
                    var u = i.stateNode;
                    try {
                      var m = Ya(
                        i.type,
                        r
                      );
                      e = u.getSnapshotBeforeUpdate(
                        m,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (S) {
                      kt(i, i.return, S);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ie && fp(t.stateNode.containerInfo);
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
      function Oc(t, e, a) {
        var i = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            $e(t, a), i & 4 && Xn(5, a);
            break;
          case 1:
            if ($e(t, a), i & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (m) {
                  kt(a, a.return, m);
                }
              else {
                var r = Ya(
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
                } catch (m) {
                  kt(
                    a,
                    a.return,
                    m
                  );
                }
              }
            i & 64 && Nc(a), i & 512 && Zn(a, a.return);
            break;
          case 3:
            if ($e(t, a), i & 64 && (i = a.updateQueue, i !== null)) {
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
                xs(i, t);
              } catch (m) {
                kt(a, a.return, m);
              }
            }
            break;
          case 27:
            Vt && e === null && i & 4 && Ac(a);
          case 26:
          case 5:
            if ($e(t, a), e === null) {
              if (i & 4) Cc(a);
              else if (i & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  Hp(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (m) {
                  kt(a, a.return, m);
                }
              }
            }
            i & 512 && Zn(a, a.return);
            break;
          case 12:
            $e(t, a);
            break;
          case 31:
            $e(t, a), i & 4 && Hc(t, a);
            break;
          case 13:
            $e(t, a), i & 4 && Dc(t, a), i & 64 && (i = a.memoizedState, i !== null && (i = i.dehydrated, i !== null && (a = bm.bind(
              null,
              a
            ), gp(i, a))));
            break;
          case 22:
            if (i = a.memoizedState !== null || ia, !i) {
              e = e !== null && e.memoizedState !== null || Kt, r = ia;
              var u = Kt;
              ia = i, (Kt = e) && !u ? Pe(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : $e(t, a), ia = r, Kt = u;
            }
            break;
          case 30:
            break;
          default:
            $e(t, a);
        }
      }
      function Rc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Rc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && qm(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
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
              Kt || Ge(a, e), He(
                t,
                e,
                a
              ), a.memoizedState ? Du(a.memoizedState) : a.stateNode && Bu(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Ge(a, e);
              var i = Qt, r = fe;
              hn(a.type) && (Qt = a.stateNode, fe = !1), He(
                t,
                e,
                a
              ), Gu(a.stateNode), Qt = i, fe = r;
              break;
            }
          case 5:
            Kt || Ge(a, e);
          case 6:
            if (ie) {
              if (i = Qt, r = fe, Qt = null, He(
                t,
                e,
                a
              ), Qt = i, fe = r, Qt !== null)
                if (fe)
                  try {
                    op(Qt, a.stateNode);
                  } catch (u) {
                    kt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    rp(Qt, a.stateNode);
                  } catch (u) {
                    kt(
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
            ie && Qt !== null && (fe ? Kp(
              Qt,
              a.stateNode
            ) : Gp(Qt, a.stateNode));
            break;
          case 4:
            ie ? (i = Qt, r = fe, Qt = a.stateNode.containerInfo, fe = !0, He(
              t,
              e,
              a
            ), Qt = i, fe = r) : (Ke && Mc(
              a.stateNode,
              a,
              Eu()
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
            Kt || (Ge(a, e), i = a.stateNode, typeof i.componentWillUnmount == "function" && Tc(
              a,
              e,
              i
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
            Kt = (i = Kt) || a.memoizedState !== null, He(
              t,
              e,
              a
            ), Kt = i;
            break;
          default:
            He(
              t,
              e,
              a
            );
        }
      }
      function Hc(t, e) {
        if (re && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Up(t);
          } catch (a) {
            kt(e, e.return, a);
          }
        }
      }
      function Dc(t, e) {
        if (re && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Bp(t);
          } catch (a) {
            kt(e, e.return, a);
          }
      }
      function dm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Iu()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Iu()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function Yl(t, e) {
        var a = dm(t);
        e.forEach(function(i) {
          if (!a.has(i)) {
            a.add(i);
            var r = vm.bind(null, t, i);
            i.then(r, r);
          }
        });
      }
      function le(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var i = 0; i < a.length; i++) {
            var r = a[i], u = t, m = e;
            if (ie) {
              var S = m;
              t: for (; S !== null; ) {
                switch (S.tag) {
                  case 27:
                    if (Vt) {
                      if (hn(S.type)) {
                        Qt = S.stateNode, fe = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = S.stateNode, fe = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = S.stateNode.containerInfo, fe = !0;
                    break t;
                }
                S = S.return;
              }
              if (Qt === null) throw Error(s(160));
              Tr(u, m, r), Qt = null, fe = !1;
            } else Tr(u, m, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Uc(e, t), e = e.sibling;
      }
      function Uc(t, e) {
        var a = t.alternate, i = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            le(e, t), ce(t), i & 4 && (ba(3, t, t.return), Xn(3, t), ba(5, t, t.return));
            break;
          case 1:
            le(e, t), ce(t), i & 512 && (Kt || a === null || Ge(a, a.return)), i & 64 && ia && (t = t.updateQueue, t !== null && (i = t.callbacks, i !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? i : a.concat(i))));
            break;
          case 26:
            if (Ue) {
              var r = Be;
              if (le(e, t), ce(t), i & 512 && (Kt || a === null || Ge(a, a.return)), i & 4) {
                i = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Jp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Uu(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Hu(
                  r,
                  u,
                  t.memoizedProps
                ) : i !== u ? (i === null ? a.stateNode !== null && Bu(a.stateNode) : Du(i), u === null ? Uu(
                  r,
                  t.type,
                  t.stateNode
                ) : Hu(
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
              le(e, t), ce(t), i & 512 && (Kt || a === null || Ge(a, a.return)), a !== null && i & 4 && zr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (le(e, t), ce(t), i & 512 && (Kt || a === null || Ge(a, a.return)), ie) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  zu(r);
                } catch (X) {
                  kt(t, t.return, X);
                }
              }
              i & 4 && t.stateNode != null && (r = t.memoizedProps, zr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), i & 1024 && (bo = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (le(e, t), ce(t), i & 4 && ie) {
              if (t.stateNode === null)
                throw Error(s(162));
              i = t.memoizedProps, a = a !== null ? a.memoizedProps : i, r = t.stateNode;
              try {
                ep(r, a, i);
              } catch (X) {
                kt(t, t.return, X);
              }
            }
            break;
          case 3:
            if (Ue ? (Wp(), r = Be, Be = Pr(e.containerInfo), le(e, t), Be = r) : le(e, t), ce(t), i & 4) {
              if (ie && re && a !== null && a.memoizedState.isDehydrated)
                try {
                  Dp(e.containerInfo);
                } catch (X) {
                  kt(t, t.return, X);
                }
              if (Ke) {
                i = e.containerInfo, a = e.pendingChildren;
                try {
                  Tu(i, a);
                } catch (X) {
                  kt(t, t.return, X);
                }
              }
            }
            bo && (bo = !1, Bc(t));
            break;
          case 4:
            Ue ? (a = Be, Be = Pr(
              t.stateNode.containerInfo
            ), le(e, t), ce(t), Be = a) : (le(e, t), ce(t)), i & 4 && Ke && Mc(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            le(e, t), ce(t);
            break;
          case 31:
            le(e, t), ce(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Yl(t, i)));
            break;
          case 13:
            le(e, t), ce(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (mi = de()), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Yl(t, i)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var m = a !== null && a.memoizedState !== null, S = ia, R = Kt;
            if (ia = S || r, Kt = R || m, le(e, t), Kt = R, ia = S, ce(t), i & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || m || ia || Kt || Ga(t)), ie)) {
              t: if (a = null, ie)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ue && e.tag === 26) {
                    if (a === null) {
                      m = a = e;
                      try {
                        u = m.stateNode, r ? sp(u) : up(
                          m.stateNode,
                          m.memoizedProps
                        );
                      } catch (X) {
                        kt(m, m.return, X);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      m = e;
                      try {
                        var G = m.stateNode;
                        r ? cp(G) : dp(G, m.memoizedProps);
                      } catch (X) {
                        kt(m, m.return, X);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      m = e;
                      try {
                        var J = m.stateNode;
                        r ? Qp(J) : Vp(m.stateNode);
                      } catch (X) {
                        kt(m, m.return, X);
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
            i & 4 && (i = t.updateQueue, i !== null && (a = i.retryQueue, a !== null && (i.retryQueue = null, Yl(t, a))));
            break;
          case 19:
            le(e, t), ce(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Yl(t, i)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            le(e, t), ce(t);
        }
      }
      function ce(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, i = t.return; i !== null; ) {
              if (jc(i)) {
                a = i;
                break;
              }
              i = i.return;
            }
            if (ie) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, u = Er(t);
                    ql(t, u, r);
                    break;
                  }
                case 5:
                  var m = a.stateNode;
                  a.flags & 32 && (zu(m), a.flags &= -33);
                  var S = Er(t);
                  ql(t, S, m);
                  break;
                case 3:
                case 4:
                  var R = a.stateNode.containerInfo, G = Er(t);
                  Nr(
                    t,
                    G,
                    R
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (J) {
            kt(t, t.return, J);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Bc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Bc(e), e.tag === 5 && e.flags & 1024 && Vm(e.stateNode), t = t.sibling;
          }
      }
      function $e(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Oc(t, e.alternate, e), e = e.sibling;
      }
      function Ga(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ba(4, e, e.return), Ga(e);
              break;
            case 1:
              Ge(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && Tc(
                e,
                e.return,
                a
              ), Ga(e);
              break;
            case 27:
              Vt && Gu(e.stateNode);
            case 26:
            case 5:
              Ge(e, e.return), Ga(e);
              break;
            case 22:
              e.memoizedState === null && Ga(e);
              break;
            case 30:
              Ga(e);
              break;
            default:
              Ga(e);
          }
          t = t.sibling;
        }
      }
      function Pe(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var i = e.alternate, r = t, u = e, m = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              Pe(
                r,
                u,
                a
              ), Xn(4, u);
              break;
            case 1:
              if (Pe(
                r,
                u,
                a
              ), i = u, r = i.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (G) {
                  kt(i, i.return, G);
                }
              if (i = u, r = i.updateQueue, r !== null) {
                var S = i.stateNode;
                try {
                  var R = r.shared.hiddenCallbacks;
                  if (R !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < R.length; r++)
                      ys(R[r], S);
                } catch (G) {
                  kt(i, i.return, G);
                }
              }
              a && m & 64 && Nc(u), Zn(u, u.return);
              break;
            case 27:
              Vt && Ac(u);
            case 26:
            case 5:
              Pe(
                r,
                u,
                a
              ), a && i === null && m & 4 && Cc(u), Zn(u, u.return);
              break;
            case 12:
              Pe(
                r,
                u,
                a
              );
              break;
            case 31:
              Pe(
                r,
                u,
                a
              ), a && m & 4 && Hc(r, u);
              break;
            case 13:
              Pe(
                r,
                u,
                a
              ), a && m & 4 && Dc(r, u);
              break;
            case 22:
              u.memoizedState === null && Pe(
                r,
                u,
                a
              ), Zn(u, u.return);
              break;
            case 30:
              break;
            default:
              Pe(
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
      function De(t, e, a, i) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            qc(
              t,
              e,
              a,
              i
            ), e = e.sibling;
      }
      function qc(t, e, a, i) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            De(
              t,
              e,
              a,
              i
            ), r & 2048 && Xn(9, e);
            break;
          case 1:
            De(
              t,
              e,
              a,
              i
            );
            break;
          case 3:
            De(
              t,
              e,
              a,
              i
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Dn(t)));
            break;
          case 12:
            if (r & 2048) {
              De(
                t,
                e,
                a,
                i
              ), t = e.stateNode;
              try {
                var u = e.memoizedProps, m = u.id, S = u.onPostCommit;
                typeof S == "function" && S(
                  m,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (R) {
                kt(e, e.return, R);
              }
            } else
              De(
                t,
                e,
                a,
                i
              );
            break;
          case 31:
            De(
              t,
              e,
              a,
              i
            );
            break;
          case 13:
            De(
              t,
              e,
              a,
              i
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, m = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? De(
              t,
              e,
              a,
              i
            ) : Jn(
              t,
              e
            ) : u._visibility & 2 ? De(
              t,
              e,
              a,
              i
            ) : (u._visibility |= 2, cn(
              t,
              e,
              a,
              i,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && Cr(m, e);
            break;
          case 24:
            De(
              t,
              e,
              a,
              i
            ), r & 2048 && jr(e.alternate, e);
            break;
          default:
            De(
              t,
              e,
              a,
              i
            );
        }
      }
      function cn(t, e, a, i, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, m = e, S = a, R = i, G = m.flags;
          switch (m.tag) {
            case 0:
            case 11:
            case 15:
              cn(
                u,
                m,
                S,
                R,
                r
              ), Xn(8, m);
              break;
            case 23:
              break;
            case 22:
              var J = m.stateNode;
              m.memoizedState !== null ? J._visibility & 2 ? cn(
                u,
                m,
                S,
                R,
                r
              ) : Jn(
                u,
                m
              ) : (J._visibility |= 2, cn(
                u,
                m,
                S,
                R,
                r
              )), r && G & 2048 && Cr(
                m.alternate,
                m
              );
              break;
            case 24:
              cn(
                u,
                m,
                S,
                R,
                r
              ), r && G & 2048 && jr(m.alternate, m);
              break;
            default:
              cn(
                u,
                m,
                S,
                R,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Jn(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, i = e, r = i.flags;
            switch (i.tag) {
              case 22:
                Jn(a, i), r & 2048 && Cr(
                  i.alternate,
                  i
                );
                break;
              case 24:
                Jn(a, i), r & 2048 && jr(
                  i.alternate,
                  i
                );
                break;
              default:
                Jn(a, i);
            }
            e = e.sibling;
          }
      }
      function Ka(t, e, a) {
        if (t.subtreeFlags & Cn)
          for (t = t.child; t !== null; )
            Yc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Yc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ka(
              t,
              e,
              a
            ), t.flags & Cn)
              if (t.memoizedState !== null)
                Ip(
                  a,
                  Be,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var i = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Fr(r, t)) && ku(a, i, r, t);
              }
            break;
          case 5:
            Ka(
              t,
              e,
              a
            ), t.flags & Cn && (i = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Fr(r, t)) && ku(a, i, r, t));
            break;
          case 3:
          case 4:
            Ue ? (i = Be, Be = Pr(
              t.stateNode.containerInfo
            ), Ka(
              t,
              e,
              a
            ), Be = i) : Ka(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (i = t.alternate, i !== null && i.memoizedState !== null ? (i = Cn, Cn = 16777216, Ka(
              t,
              e,
              a
            ), Cn = i) : Ka(
              t,
              e,
              a
            ));
            break;
          default:
            Ka(
              t,
              e,
              a
            );
        }
      }
      function Gc(t) {
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
              var i = e[a];
              Wt = i, Qc(
                i,
                t
              );
            }
          Gc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Kc(t), t = t.sibling;
      }
      function Kc(t) {
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
              var i = e[a];
              Wt = i, Qc(
                i,
                t
              );
            }
          Gc(t);
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
      function Qc(t, e) {
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
                var i = a.memoizedState.cachePool.pool;
                i != null && i.refCount++;
              }
              break;
            case 24:
              Dn(a.memoizedState.cache);
          }
          if (i = a.child, i !== null) i.return = a, Wt = i;
          else
            t: for (a = t; Wt !== null; ) {
              i = Wt;
              var r = i.sibling, u = i.return;
              if (Rc(i), i === a) {
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
        var e = Hm(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Jm(t), t === null) throw Error(s(362));
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
                var i = t[a++], r = i.tag, u = t[a++], m = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !$n(i)) {
                  for (; m != null && Ar(i, m); )
                    u++, m = e[u];
                  if (u === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (i = i.child; i !== null; )
                      t.push(i, u), i = i.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ui:
            if ((a === 5 || a === 26 || a === 27) && Fm(t.stateNode, e.value))
              return !0;
            break;
          case fi:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Wm(t), t !== null && 0 <= t.indexOf(e.value)))
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
            return "<" + (A(t.value) || "Unknown") + ">";
          case ci:
            return ":has(" + (Or(t) || "") + ")";
          case ui:
            return '[role="' + t.value + '"]';
          case fi:
            return '"' + t.value + '"';
          case di:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function Vc(t, e) {
        var a = [];
        t = [t, 0];
        for (var i = 0; i < t.length; ) {
          var r = t[i++], u = r.tag, m = t[i++], S = e[m];
          if (u !== 5 && u !== 26 && u !== 27 || !$n(r)) {
            for (; S != null && Ar(r, S); )
              m++, S = e[m];
            if (m === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, m), r = r.sibling;
          }
        }
        return a;
      }
      function Rr(t, e) {
        if (!In) throw Error(s(363));
        t = Mr(t), t = Vc(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var i = t[a++], r = i.tag;
          if (r === 5 || r === 26 || r === 27)
            $n(i) || e.push(i.stateNode);
          else
            for (i = i.child; i !== null; )
              t.push(i), i = i.sibling;
        }
        return e;
      }
      function he() {
        return (vt & 2) !== 0 && xt !== 0 ? xt & -xt : rt.T !== null ? Qi() : Um();
      }
      function Xc() {
        if (_e === 0)
          if ((xt & 536870912) === 0 || _t) {
            var t = Wl;
            Wl <<= 1, (Wl & 3932160) === 0 && (Wl = 262144), _e = t;
          } else _e = 536870912;
        return t = xe.current, t !== null && (t.flags |= 32), _e;
      }
      function ue(t, e, a) {
        (t === Mt && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (un(t, 0), va(
          t,
          xt,
          _e,
          !1
        )), k(t, a), ((vt & 2) === 0 || t !== Mt) && (t === Mt && ((vt & 2) === 0 && ($a |= a), Ut === 4 && va(
          t,
          xt,
          _e,
          !1
        )), Ye(t));
      }
      function Zc(t, e, a) {
        if ((vt & 6) !== 0) throw Error(s(327));
        var i = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || N(t, e), r = i ? pm(t, e) : Dr(t, e, !0), u = i;
        do {
          if (r === 0) {
            jn && !i && va(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !fm(a)) {
              r = Dr(t, e, !1), u = !1;
              continue;
            }
            if (r === 2) {
              if (u = e, t.errorRecoveryDisabledLanes & u)
                var m = 0;
              else
                m = t.pendingLanes & -536870913, m = m !== 0 ? m : m & 536870912 ? 536870912 : 0;
              if (m !== 0) {
                e = m;
                t: {
                  var S = t;
                  r = ol;
                  var R = re && S.current.memoizedState.isDehydrated;
                  if (R && (un(S, m).flags |= 256), m = Dr(
                    S,
                    m,
                    !1
                  ), m !== 2) {
                    if (vo && !R) {
                      S.errorRecoveryDisabledLanes |= u, $a |= u, r = 4;
                      break t;
                    }
                    u = me, me = r, u !== null && (me === null ? me = u : me.push.apply(
                      me,
                      u
                    ));
                  }
                  r = m;
                }
                if (u = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              un(t, 0), va(t, e, 0, !0);
              break;
            }
            t: {
              switch (i = t, u = r, u) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  va(
                    i,
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
              if ((e & 62914560) === e && (r = mi + 300 - de(), 10 < r)) {
                if (va(
                  i,
                  e,
                  _e,
                  !za
                ), H(i, 0, !0) !== 0) break t;
                oa = e, i.timeoutHandle = Om(
                  Jc.bind(
                    null,
                    i,
                    a,
                    me,
                    pi,
                    xo,
                    e,
                    _e,
                    $a,
                    Mn,
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
              Jc(
                i,
                a,
                me,
                pi,
                xo,
                e,
                _e,
                $a,
                Mn,
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
        Ye(t);
      }
      function Jc(t, e, a, i, r, u, m, S, R, G, J, X, F, dt) {
        if (t.timeoutHandle = Va, X = e.subtreeFlags, X & 8192 || (X & 16785408) === 16785408) {
          X = Km(), Yc(
            e,
            u,
            X
          );
          var ae = (u & 62914560) === u ? mi - de() : (u & 4194048) === u ? $u - de() : 0;
          if (ae = Qm(
            X,
            ae
          ), ae !== null) {
            oa = u, t.cancelPendingCommit = ae(
              au.bind(
                null,
                t,
                e,
                u,
                a,
                i,
                r,
                m,
                S,
                R,
                J,
                X,
                null,
                F,
                dt
              )
            ), va(t, u, m, !G);
            return;
          }
        }
        au(
          t,
          e,
          u,
          a,
          i,
          r,
          m,
          S,
          R
        );
      }
      function fm(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var i = 0; i < a.length; i++) {
              var r = a[i], u = r.getSnapshot;
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
      function va(t, e, a, i) {
        e &= ~yo, e &= ~$a, t.suspendedLanes |= e, t.pingedLanes &= ~e, i && (t.warmLanes |= e), i = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - be(r), m = 1 << u;
          i[u] = -1, r &= ~m;
        }
        a !== 0 && h(t, a, e);
      }
      function Lc() {
        return (vt & 6) === 0 ? (on(0), !1) : !0;
      }
      function Hr() {
        if (yt !== null) {
          if (Ct === 0)
            var t = yt.return;
          else
            t = yt, na = Za = null, ar(t), kn = null, nl = 0, t = yt;
          for (; t !== null; )
            Ec(t.alternate, t), t = t.return;
          yt = null;
        }
      }
      function un(t, e) {
        var a = t.timeoutHandle;
        a !== Va && (t.timeoutHandle = Va, Rm(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), oa = 0, Hr(), Mt = t, yt = a = ta(t.current, null), xt = e, Ct = 0, we = null, za = !1, jn = N(t, e), vo = !1, Mn = _e = yo = $a = Ea = Ut = 0, me = ol = null, xo = !1, (e & 8) !== 0 && (e |= e & 32);
        var i = t.entangledLanes;
        if (i !== 0)
          for (t = t.entanglements, i &= e; 0 < i; ) {
            var r = 31 - be(i), u = 1 << r;
            e |= t[r], i &= ~u;
          }
        return ra = e, Sl(), a;
      }
      function Wc(t, e) {
        mt = null, rt.H = il, e === Sn || e === ni ? (e = hs(), Ct = 3) : e === co ? (e = hs(), Ct = 4) : Ct = e === ho ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, we = e, yt === null && (Ut = 1, Ol(
          t,
          B(e, t.current)
        ));
      }
      function Fc() {
        var t = xe.current;
        return t === null ? !0 : (xt & 4194048) === xt ? Ce === null : (xt & 62914560) === xt || (xt & 536870912) !== 0 ? t === Ce : !1;
      }
      function Ic() {
        var t = rt.H;
        return rt.H = il, t === null ? il : t;
      }
      function $c() {
        var t = rt.A;
        return rt.A = fh, t;
      }
      function Kl() {
        Ut = 4, za || (xt & 4194048) !== xt && xe.current !== null || (jn = !0), (Ea & 134217727) === 0 && ($a & 134217727) === 0 || Mt === null || va(
          Mt,
          xt,
          _e,
          !1
        );
      }
      function Dr(t, e, a) {
        var i = vt;
        vt |= 2;
        var r = Ic(), u = $c();
        (Mt !== t || xt !== e) && (pi = null, un(t, e)), e = !1;
        var m = Ut;
        t: do
          try {
            if (Ct !== 0 && yt !== null) {
              var S = yt, R = we;
              switch (Ct) {
                case 8:
                  Hr(), m = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  xe.current === null && (e = !0);
                  var G = Ct;
                  if (Ct = 0, we = null, dn(t, S, R, G), a && jn) {
                    m = 0;
                    break t;
                  }
                  break;
                default:
                  G = Ct, Ct = 0, we = null, dn(t, S, R, G);
              }
            }
            mm(), m = Ut;
            break;
          } catch (J) {
            Wc(t, J);
          }
        while (!0);
        return e && t.shellSuspendCounter++, na = Za = null, vt = i, rt.H = r, rt.A = u, yt === null && (Mt = null, xt = 0, Sl()), m;
      }
      function mm() {
        for (; yt !== null; ) Pc(yt);
      }
      function pm(t, e) {
        var a = vt;
        vt |= 2;
        var i = Ic(), r = $c();
        Mt !== t || xt !== e ? (pi = null, sl = de() + 500, un(t, e)) : jn = N(
          t,
          e
        );
        t: do
          try {
            if (Ct !== 0 && yt !== null) {
              e = yt;
              var u = we;
              e: switch (Ct) {
                case 1:
                  Ct = 0, we = null, dn(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (ms(u)) {
                    Ct = 0, we = null, tu(e);
                    break;
                  }
                  e = function() {
                    Ct !== 2 && Ct !== 9 || Mt !== t || (Ct = 7), Ye(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Ct = 7;
                  break t;
                case 4:
                  Ct = 5;
                  break t;
                case 7:
                  ms(u) ? (Ct = 0, we = null, tu(e)) : (Ct = 0, we = null, dn(t, e, u, 7));
                  break;
                case 5:
                  var m = null;
                  switch (yt.tag) {
                    case 26:
                      m = yt.memoizedState;
                    case 5:
                    case 27:
                      var S = yt, R = S.type, G = S.pendingProps;
                      if (m ? qu(m) : Su(S.stateNode, R, G)) {
                        Ct = 0, we = null;
                        var J = S.sibling;
                        if (J !== null) yt = J;
                        else {
                          var X = S.return;
                          X !== null ? (yt = X, Ql(X)) : yt = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, we = null, dn(t, e, u, 5);
                  break;
                case 6:
                  Ct = 0, we = null, dn(t, e, u, 6);
                  break;
                case 8:
                  Hr(), Ut = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            hm();
            break;
          } catch (F) {
            Wc(t, F);
          }
        while (!0);
        return na = Za = null, rt.H = i, rt.A = r, vt = a, yt !== null ? 0 : (Mt = null, xt = 0, Sl(), Ut);
      }
      function hm() {
        for (; yt !== null && !eh(); )
          Pc(yt);
      }
      function Pc(t) {
        var e = wc(
          t.alternate,
          t,
          ra
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : yt = e;
      }
      function tu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = hc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              xt
            );
            break;
          case 11:
            e = hc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              xt
            );
            break;
          case 5:
            ar(e);
          default:
            Ec(a, e), e = yt = uu(e, ra), e = wc(a, e, ra);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : yt = e;
      }
      function dn(t, e, a, i) {
        na = Za = null, ar(e), kn = null, nl = 0;
        var r = e.return;
        try {
          if (im(
            t,
            r,
            e,
            a,
            xt
          )) {
            Ut = 1, Ol(
              t,
              B(a, t.current)
            ), yt = null;
            return;
          }
        } catch (u) {
          if (r !== null) throw yt = r, u;
          Ut = 1, Ol(
            t,
            B(a, t.current)
          ), yt = null;
          return;
        }
        e.flags & 32768 ? (_t || i === 1 ? t = !0 : jn || (xt & 536870912) !== 0 ? t = !1 : (za = t = !0, (i === 2 || i === 9 || i === 3 || i === 6) && (i = xe.current, i !== null && i.tag === 13 && (i.flags |= 16384))), eu(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            eu(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = sm(
            e.alternate,
            e,
            ra
          );
          if (a !== null) {
            yt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            yt = e;
            return;
          }
          yt = e = t;
        } while (e !== null);
        Ut === 0 && (Ut = 5);
      }
      function eu(t, e) {
        do {
          var a = cm(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, yt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            yt = t;
            return;
          }
          yt = t = a;
        } while (t !== null);
        Ut = 6, yt = null;
      }
      function au(t, e, a, i, r, u, m, S, R) {
        t.cancelPendingCommit = null;
        do
          Wn();
        while (Xt !== 0);
        if ((vt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= uo, g(
            t,
            a,
            u,
            m,
            S,
            R
          ), t === Mt && (yt = Mt = null, xt = 0), An = e, Ta = t, oa = a, wo = u, _o = r, Pu = i, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, ym(ao, function() {
            return ou(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), i = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || i) {
            i = rt.T, rt.T = null, r = aa(), Lt(2), m = vt, vt |= 4;
            try {
              um(t, e, a);
            } finally {
              vt = m, Lt(r), rt.T = i;
            }
          }
          Xt = 1, nu(), lu(), iu();
        }
      }
      function nu() {
        if (Xt === 1) {
          Xt = 0;
          var t = Ta, e = An, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = rt.T, rt.T = null;
            var i = aa();
            Lt(2);
            var r = vt;
            vt |= 4;
            try {
              Uc(e, t), Mm(t.containerInfo);
            } finally {
              vt = r, Lt(i), rt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function lu() {
        if (Xt === 2) {
          Xt = 0;
          var t = Ta, e = An, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = rt.T, rt.T = null;
            var i = aa();
            Lt(2);
            var r = vt;
            vt |= 4;
            try {
              Oc(t, e.alternate, e);
            } finally {
              vt = r, Lt(i), rt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function iu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, ah();
          var t = Ta, e = An, a = oa, i = Pu;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, An = Ta = null, ru(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Na = null), L(a), e = e.stateNode, ve && typeof ve.onCommitFiberRoot == "function")
            try {
              ve.onCommitFiberRoot(
                Pn,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (i !== null) {
            e = rt.T, r = aa(), Lt(2), rt.T = null;
            try {
              for (var u = t.onRecoverableError, m = 0; m < i.length; m++) {
                var S = i[m];
                u(S.value, {
                  componentStack: S.stack
                });
              }
            } finally {
              rt.T = e, Lt(r);
            }
          }
          (oa & 3) !== 0 && Wn(), Ye(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === So ? cl++ : (cl = 0, So = t) : cl = 0, re && Yp(), on(0);
        }
      }
      function ru(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Dn(e)));
      }
      function Wn() {
        return nu(), lu(), iu(), ou();
      }
      function ou() {
        if (Xt !== 5) return !1;
        var t = Ta, e = wo;
        wo = 0;
        var a = L(oa), i = 32 > a ? 32 : a;
        a = rt.T;
        var r = aa();
        try {
          Lt(i), rt.T = null, i = _o, _o = null;
          var u = Ta, m = oa;
          if (Xt = 0, An = Ta = null, oa = 0, (vt & 6) !== 0)
            throw Error(s(331));
          var S = vt;
          if (vt |= 4, Kc(u.current), qc(
            u,
            u.current,
            m,
            i
          ), vt = S, on(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot(Pn, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), rt.T = a, ru(t, e);
        }
      }
      function su(t, e, a) {
        e = B(a, e), e = pr(t.stateNode, e, 2), t = pa(t, e, 2), t !== null && (k(t, 2), Ye(t));
      }
      function kt(t, e, a) {
        if (t.tag === 3)
          su(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              su(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var i = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof i.componentDidCatch == "function" && (Na === null || !Na.has(i))) {
                t = B(a, t), a = oc(2), i = pa(e, a, 2), i !== null && (sc(
                  a,
                  i,
                  e,
                  t
                ), k(i, 2), Ye(i));
                break;
              }
            }
            e = e.return;
          }
      }
      function Ur(t, e, a) {
        var i = t.pingCache;
        if (i === null) {
          i = t.pingCache = new mh();
          var r = /* @__PURE__ */ new Set();
          i.set(e, r);
        } else
          r = i.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), i.set(e, r));
        r.has(a) || (vo = !0, r.add(a), t = gm.bind(null, t, e, a), e.then(t, t));
      }
      function gm(t, e, a) {
        var i = t.pingCache;
        i !== null && i.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Mt === t && (xt & a) === a && (Ut === 4 || Ut === 3 && (xt & 62914560) === xt && 300 > de() - mi ? (vt & 2) === 0 && un(t, 0) : yo |= a, Mn === xt && (Mn = 0)), Ye(t);
      }
      function cu(t, e) {
        e === 0 && (e = K()), t = qa(t, e), t !== null && (k(t, e), Ye(t));
      }
      function bm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), cu(t, a);
      }
      function vm(t, e) {
        var a = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var i = t.stateNode, r = t.memoizedState;
            r !== null && (a = r.retryLane);
            break;
          case 19:
            i = t.stateNode;
            break;
          case 22:
            i = t.stateNode._retryCache;
            break;
          default:
            throw Error(s(314));
        }
        i !== null && i.delete(e), cu(t, a);
      }
      function ym(t, e) {
        return Il(t, e);
      }
      function xm(t, e, a, i) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Br(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function ta(t, e) {
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
      function uu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Vl(t, e, a, i, r, u) {
        var m = 0;
        if (i = t, typeof t == "function") Br(t) && (m = 1);
        else if (typeof t == "string")
          m = Ue && Vt ? Ou(t, a, te.current) ? 26 : Ku(t) ? 27 : 5 : Ue ? Ou(
            t,
            a,
            te.current
          ) ? 26 : 5 : Vt && Ku(t) ? 27 : 5;
        else
          t: switch (t) {
            case Lr:
              return t = o(31, a, e, r), t.elementType = Lr, t.lanes = u, t;
            case mn:
              return Qa(
                a.children,
                r,
                u,
                e
              );
            case bu:
              m = 8, r |= 24;
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
                    m = 10;
                    break t;
                  case vu:
                    m = 9;
                    break t;
                  case Vr:
                    m = 11;
                    break t;
                  case Jr:
                    m = 14;
                    break t;
                  case xa:
                    m = 16, i = null;
                    break t;
                }
              m = 29, a = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), i = null;
          }
        return e = o(m, a, e, r), e.elementType = t, e.type = i, e.lanes = u, e;
      }
      function Qa(t, e, a, i) {
        return t = o(7, t, i, e), t.lanes = a, t;
      }
      function qr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function du(t) {
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
      function wm(t, e, a, i, r, u, m, S, R) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Va, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = U(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = U(0), this.hiddenUpdates = U(null), this.identifierPrefix = i, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = m, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = R, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function fu(t, e, a, i, r, u, m, S, R, G, J, X) {
        return t = new wm(
          t,
          e,
          a,
          m,
          R,
          G,
          J,
          X,
          S
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Ki(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: i,
          isDehydrated: a,
          cache: e
        }, Zi(u), t;
      }
      function mu(t) {
        return t ? (t = bn, t) : bn;
      }
      function pu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? v(t) : null, t === null ? null : Fn(t.stateNode);
      }
      function hu(t, e, a, i, r, u) {
        r = mu(r), i.context === null ? i.context = r : i.pendingContext = r, i = ma(e), i.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (i.callback = u), a = pa(t, i, e), a !== null && (ue(a, t, e), Bn(a, t, e));
      }
      function gu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Gr(t, e) {
        gu(t, e), (t = t.alternate) && gu(t, e);
      }
      var bt = {}, _m = Kh, ge = Vh(), Kr = Object.assign, Sm = Symbol.for("react.element"), Xl = Symbol.for("react.transitional.element"), fn = Symbol.for("react.portal"), mn = Symbol.for("react.fragment"), bu = Symbol.for("react.strict_mode"), Qr = Symbol.for("react.profiler"), vu = Symbol.for("react.consumer"), ya = Symbol.for("react.context"), Vr = Symbol.for("react.forward_ref"), Xr = Symbol.for("react.suspense"), Zr = Symbol.for("react.suspense_list"), Jr = Symbol.for("react.memo"), xa = Symbol.for("react.lazy"), Lr = Symbol.for("react.activity"), km = Symbol.for("react.memo_cache_sentinel"), yu = Symbol.iterator, zm = Symbol.for("react.client.reference"), Zl = Array.isArray, rt = _m.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Em = l.rendererVersion, Nm = l.rendererPackageName, xu = l.extraDevToolsConfig, Fn = l.getPublicInstance, Tm = l.getRootHostContext, Cm = l.getChildHostContext, jm = l.prepareForCommit, Mm = l.resetAfterCommit, Am = l.createInstance;
      l.cloneMutableInstance;
      var Wr = l.appendInitialChild, wu = l.finalizeInitialChildren, Jl = l.shouldSetTextContent, _u = l.createTextInstance;
      l.cloneMutableTextInstance;
      var Om = l.scheduleTimeout, Rm = l.cancelTimeout, Va = l.noTimeout, ea = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ie = l.supportsMutation, Ke = l.supportsPersistence, re = l.supportsHydration, Hm = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Dm = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Lt = l.setCurrentUpdatePriority, aa = l.getCurrentUpdatePriority, Um = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var Bm = l.shouldAttemptEagerTransition, qm = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Ym = l.maySuspendCommit, Gm = l.maySuspendCommitOnUpdate, Fr = l.maySuspendCommitInSyncRender, Su = l.preloadInstance, Km = l.startSuspendingCommit, ku = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Qm = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var pn = l.NotPendingTransition, Xa = l.HostTransitionContext, Vm = l.resetFormInstance;
      l.bindToConsole;
      var Xm = l.supportsMicrotasks, Zm = l.scheduleMicrotask, In = l.supportsTestSelectors, Jm = l.findFiberRoot, Lm = l.getBoundingRect, Wm = l.getTextContent, $n = l.isHiddenSubtree, Fm = l.matchAccessibilityRole, Im = l.setFocusIfFocusable, $m = l.setupIntersectionObserver, Pm = l.appendChild, tp = l.appendChildToContainer, ep = l.commitTextUpdate, ap = l.commitMount, np = l.commitUpdate, lp = l.insertBefore, ip = l.insertInContainerBefore, rp = l.removeChild, op = l.removeChildFromContainer, zu = l.resetTextContent, sp = l.hideInstance, cp = l.hideTextInstance, up = l.unhideInstance, dp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var fp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var mp = l.cloneInstance, Eu = l.createContainerChildSet, Nu = l.appendChildToContainerChildSet, pp = l.finalizeContainerChildren, Tu = l.replaceContainerChildren, Cu = l.cloneHiddenInstance, ju = l.cloneHiddenTextInstance, Ir = l.isSuspenseInstancePending, $r = l.isSuspenseInstanceFallback, hp = l.getSuspenseInstanceFallbackErrorDetails, gp = l.registerSuspenseInstanceRetry, bp = l.canHydrateFormStateMarker, vp = l.isFormStateMarkerMatching, Mu = l.getNextHydratableSibling, yp = l.getNextHydratableSiblingAfterSingleton, xp = l.getFirstHydratableChild, wp = l.getFirstHydratableChildWithinContainer, _p = l.getFirstHydratableChildWithinActivityInstance, Sp = l.getFirstHydratableChildWithinSuspenseInstance, kp = l.getFirstHydratableChildWithinSingleton, zp = l.canHydrateInstance, Ep = l.canHydrateTextInstance, Np = l.canHydrateActivityInstance, Tp = l.canHydrateSuspenseInstance, Cp = l.hydrateInstance, jp = l.hydrateTextInstance, Mp = l.hydrateActivityInstance, Ap = l.hydrateSuspenseInstance, Op = l.getNextHydratableInstanceAfterActivityInstance, Rp = l.getNextHydratableInstanceAfterSuspenseInstance, Hp = l.commitHydratedInstance, Dp = l.commitHydratedContainer, Up = l.commitHydratedActivityInstance, Bp = l.commitHydratedSuspenseInstance, qp = l.finalizeHydratedChildren, Yp = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Gp = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var Kp = l.clearSuspenseBoundaryFromContainer, Qp = l.hideDehydratedBoundary, Vp = l.unhideDehydratedBoundary, Au = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Xp = l.validateHydratableInstance, Zp = l.validateHydratableTextInstance, Ue = l.supportsResources, Ou = l.isHostHoistableType, Pr = l.getHoistableRoot, Ru = l.getResource, Hu = l.acquireResource, Du = l.releaseResource, Jp = l.hydrateHoistable, Uu = l.mountHoistable, Bu = l.unmountHoistable, Lp = l.createHoistableInstance, Wp = l.prepareToCommitHoistables, Fp = l.mayResourceSuspendCommit, qu = l.preloadResource, Ip = l.suspendResource, Vt = l.supportsSingletons, Yu = l.resolveSingletonInstance, $p = l.acquireSingletonInstance, Gu = l.releaseSingletonInstance, Ku = l.isHostSingletonType, hn = l.isSingletonScope, to = [], gn = -1, bn = {}, be = Math.clz32 ? Math.clz32 : w, Pp = Math.log, th = Math.LN2, Ll = 256, Wl = 262144, Fl = 4194304, Il = ge.unstable_scheduleCallback, eo = ge.unstable_cancelCallback, eh = ge.unstable_shouldYield, ah = ge.unstable_requestPaint, de = ge.unstable_now, Qu = ge.unstable_ImmediatePriority, nh = ge.unstable_UserBlockingPriority, ao = ge.unstable_NormalPriority, lh = ge.unstable_IdlePriority, ih = ge.log, rh = ge.unstable_setDisableYieldValue, Pn = null, ve = null, ye = typeof Object.is == "function" ? Object.is : gt, Vu = typeof reportError == "function" ? reportError : function(t) {
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
      }, oh = Object.prototype.hasOwnProperty, no, Xu, lo = !1, Zu = /* @__PURE__ */ new WeakMap(), vn = [], yn = 0, $l = null, tl = 0, ze = [], Ee = 0, wa = null, Qe = 1, Ve = "", te = E(null), el = E(null), _a = E(null), Pl = E(null), ee = null, Ot = null, _t = !1, Sa = null, Ne = !1, io = Error(s(519)), ti = E(null), Za = null, na = null, sh = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(a, i) {
            t.push(i);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(a) {
            return a();
          });
        };
      }, ch = ge.unstable_scheduleCallback, uh = ge.unstable_NormalPriority, Rt = {
        $$typeof: ya,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ei = null, xn = null, ro = !1, ai = !1, oo = !1, Ja = 0, al = null, so = 0, wn = 0, _n = null, Ju = rt.S;
      rt.S = function(t, e) {
        $u = de(), typeof e == "object" && e !== null && typeof e.then == "function" && If(t, e), Ju !== null && Ju(t, e);
      };
      var La = E(null), Sn = Error(s(460)), co = Error(s(474)), ni = Error(s(542)), li = { then: function() {
      } }, Wa = null, kn = null, nl = 0, Fa = bs(!0), Lu = bs(!1), Te = [], zn = 0, uo = 0, ka = !1, fo = !1, En = E(null), ii = E(0), xe = E(null), Ce = null, qt = E(0), la = 0, mt = null, jt = null, Yt = null, ri = !1, Nn = !1, Ia = !1, oi = 0, ll = 0, Tn = null, dh = 0, il = {
        readContext: $t,
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
      var Wu = {
        readContext: $t,
        use: Tl,
        useCallback: function(t, e) {
          return se().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: $t,
        useEffect: Ks,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, jl(
            4194308,
            4,
            Zs.bind(null, e, t),
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
          var a = se();
          e = e === void 0 ? null : e;
          var i = t();
          if (Ia) {
            pt(!0);
            try {
              t();
            } finally {
              pt(!1);
            }
          }
          return a.memoizedState = [i, e], i;
        },
        useReducer: function(t, e, a) {
          var i = se();
          if (a !== void 0) {
            var r = a(e);
            if (Ia) {
              pt(!0);
              try {
                a(e);
              } finally {
                pt(!1);
              }
            }
          } else r = e;
          return i.memoizedState = i.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, i.queue = t, t = t.dispatch = lm.bind(
            null,
            mt,
            t
          ), [i.memoizedState, t];
        },
        useRef: function(t) {
          var e = se();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = rr(t);
          var e = t.queue, a = ec.bind(
            null,
            mt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: cr,
        useDeferredValue: function(t, e) {
          var a = se();
          return ur(a, t, e);
        },
        useTransition: function() {
          var t = rr(!1);
          return t = Is.bind(
            null,
            mt,
            t.queue,
            !0,
            !1
          ), se().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var i = mt, r = se();
          if (_t) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), Mt === null)
              throw Error(s(349));
            (xt & 127) !== 0 || Es(i, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Ks(Ts.bind(null, i, u, t), [
            t
          ]), i.flags |= 2048, sn(
            9,
            { destroy: void 0 },
            Ns.bind(
              null,
              i,
              u,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = se(), e = Mt.identifierPrefix;
          if (_t) {
            var a = Ve, i = Qe;
            a = (i & ~(1 << 32 - be(i) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = oi++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = dh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: dr,
        useFormState: Us,
        useActionState: Us,
        useOptimistic: function(t) {
          var e = se();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = fr.bind(
            null,
            mt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: nr,
        useCacheRefresh: function() {
          return se().memoizedState = nm.bind(
            null,
            mt
          );
        },
        useEffectEvent: function(t) {
          var e = se(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((vt & 2) !== 0)
              throw Error(s(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, mo = {
        readContext: $t,
        use: Tl,
        useCallback: Ls,
        useContext: $t,
        useEffect: sr,
        useImperativeHandle: Js,
        useInsertionEffect: Vs,
        useLayoutEffect: Xs,
        useMemo: Ws,
        useReducer: Cl,
        useRef: Gs,
        useState: function() {
          return Cl(Fe);
        },
        useDebugValue: cr,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return Fs(
            a,
            jt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Cl(Fe)[0], e = Bt().memoizedState;
          return [
            typeof t == "boolean" ? t : Gn(t),
            e
          ];
        },
        useSyncExternalStore: zs,
        useId: Ps,
        useHostTransitionStatus: dr,
        useFormState: Bs,
        useActionState: Bs,
        useOptimistic: function(t, e) {
          var a = Bt();
          return Ms(a, jt, t, e);
        },
        useMemoCache: nr,
        useCacheRefresh: tc
      };
      mo.useEffectEvent = Qs;
      var Fu = {
        readContext: $t,
        use: Tl,
        useCallback: Ls,
        useContext: $t,
        useEffect: sr,
        useImperativeHandle: Js,
        useInsertionEffect: Vs,
        useLayoutEffect: Xs,
        useMemo: Ws,
        useReducer: ir,
        useRef: Gs,
        useState: function() {
          return ir(Fe);
        },
        useDebugValue: cr,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return jt === null ? ur(a, t, e) : Fs(
            a,
            jt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = ir(Fe)[0], e = Bt().memoizedState;
          return [
            typeof t == "boolean" ? t : Gn(t),
            e
          ];
        },
        useSyncExternalStore: zs,
        useId: Ps,
        useHostTransitionStatus: dr,
        useFormState: Ys,
        useActionState: Ys,
        useOptimistic: function(t, e) {
          var a = Bt();
          return jt !== null ? Ms(a, jt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: nr,
        useCacheRefresh: tc
      };
      Fu.useEffectEvent = Qs;
      var po = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var i = he(), r = ma(i);
          r.payload = e, a != null && (r.callback = a), e = pa(t, r, i), e !== null && (ue(e, t, i), Bn(e, t, i));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var i = he(), r = ma(i);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = pa(t, r, i), e !== null && (ue(e, t, i), Bn(e, t, i));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = he(), i = ma(a);
          i.tag = 2, e != null && (i.callback = e), e = pa(t, i, a), e !== null && (ue(e, t, a), Bn(e, t, a));
        }
      }, ho = Error(s(461)), Gt = !1, go = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, ia = !1, Kt = !1, bo = !1, Iu = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, fe = !1, Be = null, Cn = 8192, fh = {
        getCacheForType: function(t) {
          var e = $t(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return $t(Rt).controller.signal;
        }
      }, si = 0, ci = 1, ui = 2, di = 3, fi = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var rl = Symbol.for;
        si = rl("selector.component"), ci = rl("selector.has_pseudo_class"), ui = rl("selector.role"), di = rl("selector.test_id"), fi = rl("selector.text");
      }
      var mh = typeof WeakMap == "function" ? WeakMap : Map, vt = 0, Mt = null, yt = null, xt = 0, Ct = 0, we = null, za = !1, jn = !1, vo = !1, ra = 0, Ut = 0, Ea = 0, $a = 0, yo = 0, _e = 0, Mn = 0, ol = null, me = null, xo = !1, mi = 0, $u = 0, sl = 1 / 0, pi = null, Na = null, Xt = 0, Ta = null, An = null, oa = 0, wo = 0, _o = null, Pu = null, cl = 0, So = null;
      return bt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = qa(t, 67108864);
          e !== null && ue(e, t, 67108864), Gr(t, 67108864);
        }
      }, bt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = he();
          e = W(e);
          var a = qa(t, e);
          a !== null && ue(a, t, e), Gr(t, e);
        }
      }, bt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = z(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - be(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ye(t), (vt & 6) === 0 && (sl = de() + 500, on(0));
              }
            }
            break;
          case 31:
          case 13:
            e = qa(t, 2), e !== null && ue(e, t, 2), Lc(), Gr(t, 2);
        }
      }, bt.batchedUpdates = function(t, e) {
        return t(e);
      }, bt.createComponentSelector = function(t) {
        return { $$typeof: si, value: t };
      }, bt.createContainer = function(t, e, a, i, r, u, m, S, R, G) {
        return fu(
          t,
          e,
          !1,
          null,
          a,
          i,
          u,
          null,
          m,
          S,
          R,
          G
        );
      }, bt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, bt.createHydrationContainer = function(t, e, a, i, r, u, m, S, R, G, J, X, F, dt) {
        return t = fu(
          a,
          i,
          !0,
          t,
          r,
          u,
          S,
          dt,
          R,
          G,
          J,
          X
        ), t.context = mu(null), a = t.current, i = he(), i = W(i), r = ma(i), r.callback = e ?? null, pa(a, r, i), e = i, t.current.lanes = e, k(t, e), Ye(t), t;
      }, bt.createPortal = function(t, e, a) {
        var i = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: fn,
          key: i == null ? null : "" + i,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, bt.createRoleSelector = function(t) {
        return { $$typeof: ui, value: t };
      }, bt.createTestNameSelector = function(t) {
        return { $$typeof: di, value: t };
      }, bt.createTextSelector = function(t) {
        return { $$typeof: fi, value: t };
      }, bt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, bt.defaultOnRecoverableError = function(t) {
        Vu(t);
      }, bt.defaultOnUncaughtError = function(t) {
        Vu(t);
      }, bt.deferredUpdates = function(t) {
        var e = rt.T, a = aa();
        try {
          return Lt(32), rt.T = null, t();
        } finally {
          Lt(a), rt.T = e;
        }
      }, bt.discreteUpdates = function(t, e, a, i, r) {
        var u = rt.T, m = aa();
        try {
          return Lt(2), rt.T = null, t(e, a, i, r);
        } finally {
          Lt(m), rt.T = u, vt === 0 && (sl = de() + 500);
        }
      }, bt.findAllNodes = Rr, bt.findBoundingRects = function(t, e) {
        if (!In) throw Error(s(363));
        e = Rr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Lm(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var i = a.x, r = i + a.width, u = a.y, m = u + a.height, S = e - 1; 0 <= S; S--)
            if (e !== S) {
              var R = t[S], G = R.x, J = G + R.width, X = R.y, F = X + R.height;
              if (i >= G && u >= X && r <= J && m <= F) {
                t.splice(e, 1);
                break;
              } else if (i !== G || a.width !== R.width || F < u || X > m) {
                if (!(u !== X || a.height !== R.height || J < i || G > r)) {
                  G > i && (R.width += G - i, R.x = i), J < r && (R.width = r - G), t.splice(e, 1);
                  break;
                }
              } else {
                X > u && (R.height += X - u, R.y = u), F < m && (R.height = m - X), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, bt.findHostInstance = pu, bt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? y(t) : null, t === null ? null : Fn(t.stateNode);
      }, bt.findHostInstanceWithWarning = function(t) {
        return pu(t);
      }, bt.flushPassiveEffects = Wn, bt.flushSyncFromReconciler = function(t) {
        var e = vt;
        vt |= 1;
        var a = rt.T, i = aa();
        try {
          if (Lt(2), rt.T = null, t)
            return t();
        } finally {
          Lt(i), rt.T = a, vt = e, (vt & 6) === 0 && on(0);
        }
      }, bt.flushSyncWork = Lc, bt.focusWithin = function(t, e) {
        if (!In) throw Error(s(363));
        for (t = Mr(t), e = Vc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], i = a.tag;
          if (!$n(a)) {
            if ((i === 5 || i === 26 || i === 27) && Im(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, bt.getFindAllNodesFailureDescription = function(t, e) {
        if (!In) throw Error(s(363));
        var a = 0, i = [];
        t = [Mr(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], m = u.tag, S = t[r++], R = e[S];
          if ((m !== 5 && m !== 26 && m !== 27 || !$n(u)) && (Ar(u, R) && (i.push(Or(R)), S++, S > a && (a = S)), S < e.length))
            for (u = u.child; u !== null; )
              t.push(u, S), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Or(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (i.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, bt.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Fn(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, bt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Em,
          rendererPackageName: Nm,
          currentDispatcherRef: rt,
          reconcilerVersion: "19.2.0"
        };
        if (xu !== null && (t.rendererConfig = xu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
      }, bt.isAlreadyRendering = function() {
        return (vt & 6) !== 0;
      }, bt.observeVisibleRects = function(t, e, a, i) {
        if (!In) throw Error(s(363));
        t = Rr(t, e);
        var r = $m(
          t,
          a,
          i
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, bt.shouldError = function() {
        return null;
      }, bt.shouldSuspend = function() {
        return !1;
      }, bt.startHostTransition = function(t, e, a, i) {
        if (t.tag !== 5) throw Error(s(476));
        var r = $s(t).queue;
        Is(
          t,
          r,
          e,
          pn,
          a === null ? c : function() {
            var u = $s(t);
            return u.next === null && (u = t.alternate.memoizedState), Kn(
              t,
              u.next.queue,
              {},
              he()
            ), a(i);
          }
        );
      }, bt.updateContainer = function(t, e, a, i) {
        var r = e.current, u = he();
        return hu(
          r,
          u,
          t,
          e,
          a,
          i
        ), u;
      }, bt.updateContainerSync = function(t, e, a, i) {
        return hu(
          e.current,
          2,
          t,
          e,
          a,
          i
        ), 2;
      }, bt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(No)), No.exports;
}
var fd;
function Zh() {
  return fd || (fd = 1, Eo.exports = Xh()), Eo.exports;
}
var Jh = Zh();
const Lh = /* @__PURE__ */ Po(Jh);
var jo = { exports: {} }, sa = {};
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
function Wh() {
  return md || (md = 1, sa.ConcurrentRoot = 1, sa.ContinuousEventPriority = 8, sa.DefaultEventPriority = 32, sa.DiscreteEventPriority = 2, sa.IdleEventPriority = 268435456, sa.LegacyRoot = 0, sa.NoEventPriority = 0), sa;
}
var pd;
function Fh() {
  return pd || (pd = 1, jo.exports = Wh()), jo.exports;
}
var hl = Fh();
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
const ef = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Bo = 16, af = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Ih = [
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
], hd = {
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
}, $h = /* @__PURE__ */ new Set([
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
]), nf = {
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
}, lf = {
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
}, qo = ["font-size", "color", ...new Set([...Object.keys(nf), ...Object.keys(lf)].filter((n) => n !== "font-size" && n !== "color"))], Ph = new Set(qo);
function ne(n, l = " ") {
  const o = [];
  let c = 0, s = "";
  for (let d = 0; d < n.length; d++) {
    const p = n[d];
    if (p === "(" ? c++ : p === ")" && c--, c === 0 && (l === " " ? /\s/.test(p) : p === l)) {
      (s.trim() || l !== " ") && o.push(s.trim()), s = "";
      continue;
    }
    s += p;
  }
  return (s.trim() || l !== " " && o.length) && o.push(s.trim()), o;
}
function Yo(n, l, o = 0) {
  if (o > 32) return null;
  let c = "", s = 0;
  for (; ; ) {
    const d = n.indexOf("var(", s);
    if (d < 0)
      return c += n.slice(s), c;
    c += n.slice(s, d);
    let p = 1, f = d + 4;
    for (; f < n.length && p; f++)
      n[f] === "(" ? p++ : n[f] === ")" && p--;
    const v = n.slice(d + 4, f - 1), y = ne(v, ","), C = y[0].trim(), A = y.length > 1 ? v.slice(v.indexOf(",") + 1).trim() : null;
    let E = l(C);
    if ((E == null || E === "initial") && (E = A), E == null) return null;
    const b = Yo(E, l, o + 1);
    if (b === null) return null;
    c += b, s = f;
  }
}
function tg(n) {
  const l = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let c, s = 0;
  for (; s < n.length; ) {
    if (o.lastIndex = s, c = o.exec(n), !c || c.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = o.lastIndex, c[1] !== void 0 ? l.push({ num: parseFloat(c[1]), unit: (c[2] ?? "").toLowerCase() }) : c[3] ? l.push({ fn: c[3].toLowerCase() }) : c[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: c[5] ?? c[6] });
  }
  return l;
}
function Oa(n, l) {
  const o = tg(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let c = 0;
  const s = ({ num: E, unit: b }) => {
    switch (b) {
      case "":
        return { px: 0, pct: 0, num: E, unitless: !0 };
      case "px":
        return { px: E, pct: 0, num: 0 };
      case "rem":
        return { px: E * Bo, pct: 0, num: 0 };
      case "em":
        return { px: E * (l.fontSize ?? Bo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: E, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: E / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: E / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: E * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (E, b, x) => E && b ? { px: E.px + x * b.px, pct: E.pct + x * b.pct, num: E.num + x * b.num, unitless: E.unitless && b.unitless } : null, p = (E, b) => E ? { px: E.px * b, pct: E.pct * b, num: E.num * b, unitless: E.unitless } : null, f = (E) => E && E.unitless;
  function v() {
    const E = o[c++];
    if (!E) return null;
    if (E.num !== void 0) return s(E);
    if (E.op === "(") {
      const b = C();
      return o[c]?.op !== ")" ? null : (c++, b);
    }
    if (E.op === "-" || E.op === "+") {
      const b = v();
      return E.op === "-" ? p(b, -1) : b;
    }
    if (E.fn) {
      const b = [];
      for (; ; ) {
        b.push(C());
        const z = o[c++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (b.some((z) => !z)) return null;
      if (E.fn === "calc") return b[0];
      if (!(b.every((z) => !z.pct) || b.every((z) => !z.px && !z.num))) return null;
      const w = (z) => z.px + z.pct + z.num;
      return E.fn === "min" ? b.reduce((z, H) => w(H) < w(z) ? H : z) : E.fn === "max" ? b.reduce((z, H) => w(H) > w(z) ? H : z) : E.fn === "clamp" && b.length === 3 ? w(b[1]) < w(b[0]) ? b[0] : w(b[1]) > w(b[2]) ? b[2] : b[1] : null;
    }
    return null;
  }
  function y() {
    let E = v();
    for (; o[c] && (o[c].op === "*" || o[c].op === "/"); ) {
      const b = o[c++].op, x = v();
      if (!E || !x) return null;
      b === "*" ? E = f(x) ? p(E, x.num) : f(E) ? p(x, E.num) : null : E = f(x) && x.num !== 0 ? p(E, 1 / x.num) : null;
    }
    return E;
  }
  function C() {
    let E = y();
    for (; o[c] && (o[c].op === "+" || o[c].op === "-"); ) {
      const b = o[c++].op;
      E = d(E, y(), b === "-" ? -1 : 1);
    }
    return E;
  }
  const A = C();
  return c !== o.length || !A ? null : A;
}
function Go(n, l) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const c = Oa(o, l);
  return c ? c.unitless ? c.num === 0 ? { px: 0 } : { expr: n.trim() } : c.pct && (c.px || c.num) ? { expr: n.trim() } : c.pct ? { pct: c.pct } : { px: eg(c.px) } : { expr: n.trim() };
}
const eg = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, bi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), ag = ([n, l, o, c]) => `#${bi(n)}${bi(l)}${bi(o)}${bi(c * 255)}`;
function gd(n) {
  const l = n.slice(1), o = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const c = (s) => parseInt(o.slice(s, s + 2), 16);
  return [c(0), c(2), c(4), o.length === 8 ? c(6) / 255 : 1];
}
function Ni(n, l) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const c = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (c) {
    const y = l(c[1]), C = y && gd(y);
    return C ? { rgba: C, token: c[1] } : null;
  }
  if (o.startsWith("#")) {
    const y = gd(o);
    return y ? { rgba: y, token: null } : null;
  }
  if (hd[o]) return { rgba: [...hd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = ne(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const C = (pt) => {
      const gt = ne(pt), wt = gt.findIndex((lt) => /%$/.test(lt)), V = wt >= 0 ? parseFloat(gt[wt]) / 100 : null;
      return { color: Ni(gt.filter((lt, B) => B !== wt).join(" "), l), pct: V };
    }, A = C(y[1]), E = C(y[2]);
    if (!A.color || !E.color || A.color === "currentcolor" || E.color === "currentcolor") return null;
    let b = A.pct, x = E.pct;
    b === null && x === null ? (b = 0.5, x = 0.5) : b === null ? b = 1 - x : x === null && (x = 1 - b);
    const w = b + x, z = w < 1 ? w : 1;
    b /= w, x /= w;
    const [H, N, j, K] = A.color.rgba, [U, k, g, h] = E.color.rgba, D = K * b + h * x, Q = (pt, gt) => D === 0 ? 0 : (pt * K * b + gt * h * x) / D, W = [Q(H, U), Q(N, k), Q(j, g), D * z], L = h === 0 ? A.color.token : K === 0 ? E.color.token : null;
    return { rgba: W, token: L };
  }
  const d = s[2].includes(",") ? ne(s[2], ",") : ne(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const p = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), v = [p(d[0]), p(d[1]), p(d[2]), f];
  return v.some((y) => Number.isNaN(y)) ? null : { rgba: v, token: null };
}
const ml = ["top", "right", "bottom", "left"], ng = ["top-left", "top-right", "bottom-right", "bottom-left"], vi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], bd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Ko(n, l) {
  const o = l.trim(), c = () => ne(o);
  switch (n) {
    case "padding":
    case "margin": {
      const s = vi(c());
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
      const s = vi(c());
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
      const s = n.split("-")[1], d = vi(c());
      return ml.map((p, f) => [`border-${p}-${s}`, d[f]]);
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
      let d = "medium", p = "none", f = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const v of c())
          bd.has(v) ? p = v : /^(thin|medium|thick|-?[\d.]|calc\()/.test(v) ? d = v : f = v;
      else o === "0" && (d = "0");
      return s.flatMap((v) => [[`border-${v}-width`, d], [`border-${v}-style`, p], [`border-${v}-color`, f]]);
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
      const s = vi(ne(o.split("/")[0]));
      return ng.map((d, p) => [`border-${d}-radius`, s[p]]);
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
      return Ko("gap", o);
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
      const s = c(), d = s.filter((f) => /^[\d.]+$/.test(f)), p = s.find((f) => !/^[\d.]+$/.test(f));
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
      for (const f of c())
        bd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : p = f;
      return [["outline-width", s], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ne(o, ","), d = s.map((f) => ne(f).find((v) => !/^[\d.]+m?s$/.test(v) && !/^(ease|linear|step|cubic)/.test(v)) ?? "all"), p = s.map((f) => ne(f).find((v) => /^[\d.]+m?s$/.test(v)) ?? "0s");
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
function lg(n, l) {
  return n ? ne(n, ",").some((o) => {
    let c = o.trim().toLowerCase(), s = !1;
    c.startsWith("not ") && (s = !0, c = c.slice(4)), c.startsWith("only ") && (c = c.slice(5));
    const d = c.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const f = /^\((.+)\)$/.exec(p);
      if (!f) return !1;
      const v = f[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(v);
      if (y) {
        const [, A, E] = y, b = (x) => {
          const w = Go(x, { viewport: l });
          return typeof w == "object" && "px" in w ? w.px : NaN;
        };
        switch (A) {
          case "min-width":
            return l.width >= b(E);
          case "max-width":
            return l.width <= b(E);
          case "min-height":
            return l.height >= b(E);
          case "max-height":
            return l.height <= b(E);
          case "hover":
          case "any-hover":
            return E.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return E.trim() === "fine";
          case "prefers-reduced-motion":
            return E.trim() === "no-preference";
          case "prefers-color-scheme":
            return E.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const C = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(v);
      if (C) {
        const A = C[1] === "width" ? l.width : l.height, E = Go(C[3], { viewport: l }), b = typeof E == "object" && "px" in E ? E.px : NaN;
        switch (C[2]) {
          case ">=":
            return A >= b;
          case "<=":
            return A <= b;
          case ">":
            return A > b;
          case "<":
            return A < b;
          default:
            return A === b;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function ig(n, l) {
  const o = l[l.length - 1].compound;
  return ts(o)[0] ?? n;
}
function rg(n) {
  const l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = (s, d) => {
    s.forEach(({ compound: p }, f) => {
      const v = d && f === s.length - 1;
      for (const y of p.pseudos)
        if (af.has(y.name) && (v ? l : o).add(y.name), y.list && y.name !== "not") for (const C of y.list) c(C, v);
    });
  };
  return c(n, !0), { subject: l, ancestor: o };
}
function ts(n) {
  const l = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const c of o.list) c.length === 1 && l.push(...ts(c[0].compound));
  return l;
}
function og(n, l) {
  const o = (c, s) => {
    c.forEach(({ compound: d }, p) => {
      const f = s && p === c.length - 1, v = d.pseudos.filter((y) => af.has(y.name)).map((y) => y.name);
      if (!f) for (const y of v) for (const C of ts(d)) l.add(`${y}:${C}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const C of y.list) o(C, f);
    });
  };
  o(n, !0);
}
class sg {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const f = p[p.length - 1].compound, v = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(v) || this.index.set(v, []), this.index.get(v).push(d);
    };
    let c = 0;
    const s = (d, p) => {
      for (const [f, v, y, C] of d)
        for (const A of Fo(f)) {
          let E;
          try {
            E = Io(A);
          } catch (w) {
            if (w instanceof ke) {
              this.skipped++;
              continue;
            }
            throw w;
          }
          const b = rg(E);
          og(E, this.trackedStates);
          const x = { steps: E, media: v, layer: y, origin: p, order: c++, specificity: Zd(E), decls: C, states: b, source: p === 0 ? `ua:${E[E.length - 1].compound.tag ?? "*"}` : ig(A, E) };
          this.rules.push(x), o(x, E);
        }
    };
    s(Ih.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), s(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(l) {
    const o = [], c = /* @__PURE__ */ new Set(), s = (d) => {
      if (d) for (const p of d) c.has(p) || (c.add(p), o.push(p));
    };
    for (const d of l.classList) s(this.index.get(`.${d}`));
    return s(this.index.get(l.tagName)), s(this.index.get("*")), o;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, o) {
    for (const c of l.classList) if (this.trackedStates.has(`${o}:${c}`)) return !0;
    return !1;
  }
}
const cg = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function ug(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [o, c] of Object.entries(n)) {
    if (c == null || c === "" || typeof c == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof c == "number" && c !== 0 && !cg.has(s) && !s.startsWith("--") ? `${c}px` : String(c);
    l.push([s, d]);
  }
  return l;
}
function dg(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const o of ["width", "height"]) {
    const c = n.getAttribute(o);
    c !== null && l.push([o, /^[\d.]+$/.test(c) ? `${c}px` : c]);
  }
  return l;
}
const fg = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class mg {
  constructor(l, { theme: o, viewport: c }) {
    this.sheet = l, this.theme = o, this.viewport = c, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, o) {
    const c = (s, d, p) => {
      if (d === "disabled") return !!s.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(s.tagName);
      if (d === "enabled") return !s.props?.disabled && ["button", "input", "select", "textarea"].includes(s.tagName);
      if (d === "checked") return !!s.props?.checked;
      if (o === "*") return !0;
      if (d === "focus-within") {
        const f = s.ownerDocument?.activeElement;
        return !!f && f !== s.ownerDocument.body && typeof s.contains == "function" && s.contains(f);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!s.state?.focus && !s.state?.pointerFocus : !!s.state?.[d];
    };
    return this.sheet.candidates(l).filter((s) => (!s.media || s.media.every((d) => lg(d, this.viewport))) && Jd(l, s.steps, { state: c }));
  }
  compute(l, o, c = /* @__PURE__ */ new Set()) {
    const s = this.matching(l, c), d = [];
    for (const g of s)
      for (const [h, D, Q] of g.decls) d.push({ prop: h, value: D, important: Q ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of dg(l)) d.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of ug(l.inlineStyle ?? l.props?.style)) d.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(fg);
    const p = this.sheet.properties, f = Object.create(o?.customs ?? null), v = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const g of d) g.prop.startsWith("--") && y.set(g.prop, g.value);
    if (!o && this.theme) for (const g of ef) this.theme[g] && y.set(`--${g}`, `perchtoken(${g})`);
    const C = (g) => {
      if (v.has(g)) return v.get(g);
      const h = p[g];
      return h && !h.inherits ? h.initial ?? null : g in f ? f[g] : h?.initial ?? null;
    }, A = /* @__PURE__ */ new Set(), E = (g) => {
      if (!y.has(g)) return C(g);
      if (A.has(g)) return null;
      A.add(g);
      const h = Yo(y.get(g), E);
      return A.delete(g), y.delete(g), v.set(g, h), (!p[g] || p[g].inherits) && (f[g] = h), h;
    };
    for (const g of [...y.keys()]) E(g);
    const b = /* @__PURE__ */ new Map();
    for (const g of d) {
      if (g.prop.startsWith("--")) continue;
      const h = Yo(g.value, C);
      if (h === null) {
        for (const [D] of Ko(g.prop, "unset")) b.set(D, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [D, Q] of Ko(g.prop, h)) b.set(D, { value: Q, source: g.source, origin: g.origin });
    }
    const x = {}, w = {}, z = /* @__PURE__ */ new Set(), H = /* @__PURE__ */ new Set(), N = o?.values, j = { fontSize: N?.["font-size"] ?? Bo, viewport: this.viewport }, K = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, j, x, N);
      const D = `${g}\0${h}\0${j.fontSize}`;
      let Q = this.parsed.get(D);
      return Q === void 0 && this.parsed.set(D, Q = this.parseValue(g, h, j, x, N)), Q;
    }, U = b.size ? [...qo, ...[...b.keys()].filter((g) => !Ph.has(g))] : qo;
    for (const g of U) {
      const h = b.get(g);
      let D = h?.value;
      const Q = $h.has(g);
      if ((D === void 0 || D === "unset" || D === "revert" || D === "revert-layer") && (D = Q ? "inherit" : "initial"), h && (w[g] = h.source, h.origin !== 0 && z.add(g)), D === "inherit" && N && g in N) {
        x[g] = N[g], H.add(g);
        continue;
      }
      (D === "inherit" || D === "initial") && (D = Q ? lf[g] : nf[g]), x[g] = K(g, D), g === "font-size" && (j.fontSize = x["font-size"]);
    }
    for (const g of ml) {
      const h = x[`border-${g}-style`];
      (h === "none" || h === "hidden") && (x[`border-${g}-width`] = { px: 0 });
    }
    x["outline-style"] === "none" && (x["outline-width"] = { px: 0 });
    const k = N?.display;
    return (k === "flex" || k === "inline-flex" || k === "grid" || k === "inline-grid") && x.position !== "absolute" && x.position !== "fixed" && (x.display = vd(x.display)), (x.position === "absolute" || x.position === "fixed") && (x.display = vd(x.display)), { values: x, sources: w, own: z, inherited: H, customs: f, rules: s, element: l };
  }
  parseValue(l, o, c, s, d) {
    const p = String(o).trim();
    switch (l) {
      case "font-size": {
        const f = p.toLowerCase(), v = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (v[f]) return v[f];
        if (f === "smaller") return c.fontSize / 1.2;
        if (f === "larger") return c.fontSize * 1.2;
        const y = Oa(f, { fontSize: c.fontSize, viewport: c.viewport });
        return !y || y.num ? c.fontSize : y.px + y.pct / 100 * c.fontSize;
      }
      case "font-weight": {
        const f = p.toLowerCase();
        if (f === "normal") return 400;
        if (f === "bold") return 700;
        if (f === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (f === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const v = parseFloat(f);
        return Number.isFinite(v) ? v : 400;
      }
      case "line-height": {
        const f = p.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const v = Oa(f, { fontSize: c.fontSize, viewport: c.viewport });
        return v ? v.unitless ? { factor: v.num } : { px: v.px + v.pct / 100 * c.fontSize } : { normal: !0 };
      }
      case "font-family":
        return p;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const f = p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p);
        return Number.isFinite(f) ? f : parseFloat(l === "flex-shrink" || l === "opacity" ? 1 : 0);
      }
      case "color": {
        const f = Ni(p, (v) => this.themeHex(v));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Ni(p, (v) => this.themeHex(v));
        return f === "currentcolor" ? s.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
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
        return Go(p, c);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function vd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Ti = (n) => n && n.rgba ? { value: ag(n.rgba), token: n.token ?? null } : null, pg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function hg(n, l) {
  const o = l?.(n);
  if (Number.isFinite(o)) return o;
  const c = Math.round(n * 100) / 100;
  return pg[c] ?? Math.round(n * 1.2);
}
function Ci(n, l) {
  const o = n["line-height"], c = n["font-size"];
  return o.normal ? hg(c, l) : o.factor !== void 0 ? o.factor * c : o.px;
}
const gg = (n) => ne(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const bg = "perch-native-description/1", On = Symbol("display"), ji = {
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
}, vg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of vg) ji[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ji.rounded = 0;
const yg = /* @__PURE__ */ new Set([
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
]), xg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, wg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, _g = (n) => wg.test(n) ? "Menlo" : xg.test(n) ? ".SystemUIFont" : gg(n).split(",")[0].trim(), Sg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, yd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, rf = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const c = n.parentElement;
  return c && c.tagName !== "body" ? `${rf(c)} > ${n.tagName}` : n.tagName;
};
class kg {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, o, c, s, d, p = "") {
    const f = `${l}|${o}|${c}|${s}`, v = this.map.get(f);
    if (v) {
      !v.elements.includes(d) && v.elements.length < 4 && v.elements.push(d), v.count++;
      return;
    }
    this.map.set(f, { kind: l, property: o, value: String(c), class: s ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
  }
  list() {
    return [...this.map.values()].sort((l, o) => l.kind < o.kind ? -1 : l.kind > o.kind ? 1 : l.property < o.property ? -1 : l.property > o.property ? 1 : 0);
  }
}
const ua = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, zg = /^(text|search|url|email|tel|password|number)$/, Eg = 162.13 / 12.8;
function Ng(n, l) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const c = ne(o[1], ",").map((s) => Oa(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return c.length ? Math.min(...c) : void 0;
}
function Tg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = Oa(n.expr, { fontSize: l["font-size"] }), c = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + c) < 0.01;
}
function of(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const c = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = c && ne(c[2], ",").map((d) => d.trim());
    return !s || s.length > (c[1] ? 1 : 2) ? null : c[1] === "X" ? [s[0], "0"] : c[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const c = ne(String(o).trim(), " ").filter(Boolean);
    return c.length > 3 || c[2] !== void 0 && Oa(c[2], {})?.px ? null : [c[0], c[1] ?? "0"];
  }
  return [];
}
function xd(n, l, o, c = !1) {
  const s = n.values, d = of(s);
  if (d?.length === 0) return;
  const p = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, v = (A, E) => {
    const b = Oa(A, f);
    if (!(!b || b.unitless && b.num))
      return b.pct ? typeof E == "number" ? b.px + b.pct / 100 * E : void 0 : b.px;
  }, y = d ? v(d[0], l.w) : void 0, C = d ? v(d[1], l.h) : void 0;
  if (y === void 0 || C === void 0) {
    const A = !c && d ? d.map((E) => Oa(E, f)) : null;
    if (A?.every((E) => E && !(E.unitless && E.num))) {
      l[sf] = A.map((E) => [E.px, E.pct ?? 0]);
      return;
    }
    o("unsupported", p, s[p], n.sources[p]);
    return;
  }
  if (c) {
    y && (l.left = y), C && (l.top = C);
    return;
  }
  y && (l.ml = (l.ml ?? 0) + y), C && (l.mt = (l.mt ?? 0) + C);
}
const sf = Symbol("perch.shift");
function Cg(n, l, o) {
  const c = n.ownerDocument, s = c?.measure?.(n) ?? null;
  if (s) {
    const [[p, f], [v, y]] = o, C = p + f / 100 * s.width, A = v + y / 100 * s.height;
    C && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + C), A && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + A);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Fd && c?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, c.retries.push(() => c.afterCommit?.()));
}
function wd(n, l, o = null) {
  const c = n.values, s = {}, d = (N) => n.sources[N], p = (N) => n.sources[N] !== void 0, f = c.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), c["grid-template-columns"] && c["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", c["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const v = s.display === "flex";
  if (v && s.flex_direction !== "col") {
    const N = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[c["flex-direction"]] ?? "row";
    s.flex_direction = N;
  }
  if (v) {
    (c["flex-wrap"] === "wrap" || c["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const N = f === "grid" || f === "inline-grid", j = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[c["align-items"]];
    j && (s.items = j);
    let K = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[c["justify-content"]];
    if (N) {
      const g = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[c["justify-items"]];
      g && (s.items = g), c["align-items"] === "center" && (K = "center");
    }
    K && (s.justify = K);
    const U = ua(c["row-gap"]), k = ua(c["column-gap"]);
    typeof U == "number" && U && (s.gap_y = U), typeof k == "number" && k && !N && (s.gap_x = k);
  }
  c["flex-grow"] && (s.flex_grow = c["flex-grow"]), c["flex-shrink"] !== 1 && (s.flex_shrink = c["flex-shrink"]);
  const y = ua(c["flex-basis"]);
  y !== void 0 && y !== "auto" && (s.flex_basis = y);
  const C = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[c["align-self"]];
  C && (s.self = C);
  for (const [N, j] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const K = c[j], U = ua(K);
    if (U === void 0 && j === "width" && Tg(K, c)) {
      s.self = "stretch", l("approximated", j, K.expr, d(j), "stretched across its parent, inside its margins");
      continue;
    }
    const k = U === void 0 && /^max-/.test(j) ? Ng(K, c["font-size"]) : void 0;
    if (k !== void 0) {
      s[N] = k, l("approximated", j, K.expr, d(j), "the fixed bound of min()");
      continue;
    }
    if (U === void 0) {
      typeof K == "object" && K.expr ? l("unsupported", j, K.expr, d(j), "no calc() in the engine") : typeof K == "string" && !["auto", "none"].includes(K) && l("unsupported", j, K, d(j));
      continue;
    }
    U !== "auto" && (s[N] = U);
  }
  const A = ["top", "right", "bottom", "left"];
  for (const N of A) {
    const j = N[0];
    for (const [K, U] of [["p", "padding"], ["m", "margin"]]) {
      const k = c[`${U}-${N}`], g = ua(k);
      if (g === void 0) {
        k?.expr && l("unsupported", `${U}-${N}`, k.expr, d(`${U}-${N}`), "no calc() in the engine");
        continue;
      }
      g !== 0 && (s[`${K}${j}`] = g);
    }
  }
  const E = c.position;
  if (E === "absolute" || E === "fixed") {
    s.position = "absolute", E === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const N of A) {
      const j = ua(c[N]);
      j !== void 0 && j !== "auto" && (s[N] = j);
    }
    if (E === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const N = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, N) : N;
    }
    xd(n, s, l);
  } else E === "sticky" ? l("unsupported", "position", "sticky", d("position")) : of(c)?.length !== 0 && (s.position = "relative", xd(n, s, l, !0));
  c["z-index"] !== "auto" && p("z-index") && l("unsupported", "z-index", c["z-index"], d("z-index"), "paint order is tree order");
  for (const [N, j] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const K = c[j];
    K === "hidden" || K === "clip" ? s[N] = "hidden" : (K === "auto" || K === "scroll") && (s[N] = "scroll");
  }
  (c.visibility === "hidden" || c.visibility === "collapse") && (s.visibility = "invisible");
  const b = c["background-color"];
  b?.unreadable ? l("unsupported", "background-color", b.unreadable, d("background-color")) : b?.rgba && b.rgba[3] > 0 && (s.bg = Ti(b)), c["background-image"] && c["background-image"] !== "none" && l("unsupported", "background-image", c["background-image"], d("background-image"));
  const x = A.map((N) => ua(c[`border-${N}-width`]) || 0), w = [];
  A.forEach((N, j) => {
    if (!x[j]) return;
    s[`border_${N[0]}`] = x[j];
    const K = c[`border-${N}-style`];
    K !== "solid" && l("approximated", `border-${N}-style`, K, d(`border-${N}-style`), "drawn solid");
    const U = Ti(c[`border-${N}-color`]);
    U && w.push(U);
  }), w.length && (s.border_color = w[0], w.some((N) => N.value !== w[0].value) && l("approximated", "border-color", w.map((N) => N.value).join(" "), d("border-top-color"), "one border colour"));
  const z = ["top-left", "top-right", "bottom-right", "bottom-left"].map((N) => ua(c[`border-${N}-radius`]) || 0);
  z.every((N) => N === z[0]) ? z[0] && (s.rounded = z[0]) : ["tl", "tr", "br", "bl"].forEach((N, j) => {
    z[j] && (s[`rounded_${N}`] = z[j]);
  }), c.opacity !== 1 && (s.opacity = Math.round(c.opacity * 1e3) / 1e3);
  const H = c["box-shadow"];
  if (H && H !== "none" && ne(H, ",").some((N) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(N.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", H, d("box-shadow"), "the engine's large shadow preset")), c.cursor && c.cursor !== "auto" && !n.inherited.has("cursor")) {
    const N = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[c.cursor];
    N ? s.cursor = N : l("unsupported", "cursor", c.cursor, d("cursor"));
  }
  return c["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), c["text-decoration-line"] === "underline" ? s.underline = !0 : c["text-decoration-line"] && c["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", c["text-decoration-line"], d("text-decoration-line")), s;
}
const jg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function cf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((o) => jg[o]);
  return l.every(Boolean) ? l.join(",") : null;
}
function _d(n, l) {
  const o = n.values, c = o["line-height"];
  return {
    text_color: Ti(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: cf(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: c.factor !== void 0 ? { factor: c.factor } : { px: Math.round(Ci(o, l) * 1e3) / 1e3 },
    font_family: _g(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const Sd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, uf = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function kd(n, l, o) {
  const c = {}, s = (f, v) => v.some((y) => !n.inherited.has(y));
  for (const [f, v] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, v) || !uf(l[f], o[f])) && (c[f] = l[f]);
  const d = Sd(l.line_height, l.text_size), p = o.line_height ? Sd(o.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (c.line_height = l.line_height), c;
}
const Mg = (n, l) => ({ ...n, ...l });
function zd(n, l) {
  const o = {};
  for (const [c, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[c] = s.value, s.token && (l[c] = s.token)) : c === "line_height" ? o[c] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : c === "italic" ? s && (o.italic = !0) : o[c] = s;
  return o.italic === !1 && delete o.italic, o;
}
function Ag(n, l) {
  const o = {};
  for (const c of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[c], d = l[c];
    uf(s, d) || (o[c] = d === void 0 ? c in ji ? ji[c] : null : d);
  }
  return o;
}
function Ed(n, l) {
  const o = n.values;
  for (const [c, s] of Object.entries(n.sources)) {
    if (c.startsWith("--") || yg.has(c) || s.startsWith("ua:")) continue;
    const d = o[c];
    switch (c) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", c, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && cf(d) === null && l("unsupported", c, d, s);
        break;
      case "text-transform":
        d !== "none" && l("approximated", c, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        c === "transition-property" && p && ne(p, ",").some((f) => parseFloat(f) > 0) && o["transition-property"] !== "none" && l("unsupported", "transition", `${o["transition-property"]} ${p}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && l("unsupported", c, d, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        c === "overflow-wrap" && d !== "normal" && l("approximated", c, d, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && c === "outline-style" && l("unsupported", "outline", `${ua(o["outline-width"])}px ${o["outline-style"]} ${Ti(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && l("unsupported", c, d, s);
        break;
    }
  }
}
function Og(n, l, o, c) {
  const s = rf(n), d = [], p = (H, N, j, K, U) => d.push([H, N, j, K ?? "(user agent)", s, U]), f = c.cascade.compute(n, l), v = {}, y = wd(f, p, c.viewport), C = y[sf];
  Ed(f, p);
  const A = _d(f, c.measure), E = kd(f, A, o), b = zd({ ...y, ...E }, v), x = {}, w = c.cascade.matching(n, "*").filter((H) => H.states.subject.size);
  for (const [H, N] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!w.some((g) => N.some((h) => g.states.subject.has(h)))) continue;
    const j = c.cascade.compute(n, l, new Set(N)), K = {}, U = zd({ ...wd(j, () => {
    }), ...kd(j, _d(j, c.measure), o) }, K);
    H === "focus" && Ed(j, p);
    const k = Ag(b, U);
    if (Object.keys(k).length) {
      x[H] = k;
      const g = Object.fromEntries(Object.entries(K).filter(([h]) => h in k));
      Object.keys(g).length && (x[`${H}_tokens`] = g);
    }
  }
  if (c.cascade.sheet.tracks(n, "hover") && (x.track_hover = !0), /tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (x.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (x.break_anywhere = !0), y.overflow_y === "scroll") {
    const H = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    H > 0 && (x.scrollbar = H);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (x.blocks_pointer = !0);
  const z = Object.entries(Sg).filter(([, H]) => H.some((N) => typeof n.props[N] == "function")).map(([H]) => H);
  return !z.includes("click") && Do(n) && z.push("click"), z.length && (x.events = z), { computed: f, style: b, tokens: v, extra: x, meta: Ug(n), reports: d, childText: Mg(o, E), where: s, shift: C };
}
function df(n, l, o, c, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let p = c.cache.get(n);
  (!p || p.key !== d) && c.cache.set(n, p = { key: d, part: Og(n, l, o, c) });
  const { computed: f, tokens: v, extra: y, reports: C, childText: A, where: E } = p.part;
  for (const h of C) c.findings.add(...h);
  const b = (h, D, Q, W, L) => c.findings.add(h, D, Q, W, E, L), x = { ...p.part.style };
  p.part.shift && Cg(n, x, p.part.shift);
  const w = { kind: "div", id: n.id, style: x, tokens: v, meta: p.part.meta, ...y };
  Object.defineProperty(w, On, { value: f.values.display }), n.measured && n.ownerDocument?.measureKey && (w.measure = n.ownerDocument.measureKey(n));
  const z = n.tagName;
  if (z === "svg")
    return w.kind = n.props["data-perch-image"] ? "image" : "svg", w.markup = qg(n), w;
  if (z === "input" || z === "textarea" || z === "select") {
    w.kind = "input", w.input_type = z === "input" ? String(n.props.type ?? "text") : z;
    for (const h of ["placeholder", "checked", "disabled"]) n.props[h] !== void 0 && (w[h] = n.props[h]);
    if (/^(checkbox|radio)$/.test(w.input_type) && (w.checked = n.checked), z !== "select" && (w.value = n.value), z === "input" && zg.test(w.input_type) && (w.field_w = Eg * f.values["font-size"]), z === "textarea" && x.h === void 0) {
      const h = f.values, D = (L) => L && typeof L == "object" && "px" in L ? L.px : 0, Q = (L) => h[`border-${L}-style`] === "none" ? 0 : D(h[`border-${L}-width`]), W = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      x.h = W * Ci(h, c.measure) + D(h["padding-top"]) + D(h["padding-bottom"]) + Q("top") + Q("bottom");
    }
    return w;
  }
  if (z === "img") {
    w.kind = "image", w.src = n.props.src ?? null;
    for (const [h, D] of [["width", "w"], ["height", "h"]]) {
      const Q = Number(n.props[h]);
      x[D] === void 0 && n.props[h] != null && Number.isFinite(Q) && (x[D] = Q);
    }
    return w;
  }
  const H = f.values["text-transform"], N = [];
  let j = !1, K = !1;
  for (const h of n.childNodes) {
    if (h instanceof Di) {
      if (h.hidden || h.data === "") continue;
      j = !0;
      const W = N[N.length - 1];
      if (W?.kind === "text")
        W.source = (W.source ?? W.text) + h.data, W.text = Nd(W.source, H), W.text === W.source && delete W.source;
      else {
        const L = Nd(h.data, H);
        N.push(L === h.data ? { kind: "text", text: L } : { kind: "text", text: L, source: h.data });
      }
      continue;
    }
    if (!(h instanceof It)) continue;
    const D = df(h, f, A, c, d), Q = D[On];
    Q === "inline" || Q === "inline-block" || Q === "inline-flex" ? j = !0 : Q !== "none" && (K = !0), N.push(D);
  }
  const U = N.some((h) => h.kind !== "text"), k = N.length === 1 && N[0].kind !== "text" && /^inline-(block|flex)$/.test(N[0][On]) ? N[0] : null;
  if (!x.display && k) {
    const h = c.cache.get(n.childNodes.find((Q) => Q.id === k.id))?.part.computed, D = h ? Qo(f.values, c.measure) - Dg(h.values, c.measure) : 0;
    x.display = "flex", x.flex_direction = "col", x.items = "start", D > 0 && (k.style.mt = Math.round(((k.style.mt ?? 0) + D) * 100) / 100), b("approximated", "display", `${f.values.display} holding one ${k[On]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!x.display && N.length === 1 && (N[0].kind === "svg" || N[0].kind === "image") && N[0][On] === "inline" && typeof N[0].style.h == "number") {
    const h = N[0], D = Qo(f.values, c.measure), Q = Ci(f.values, c.measure) - D, W = (L) => Math.round(L * 100) / 100;
    x.display = "flex", x.flex_direction = "col", x.items = "start", D > h.style.h && (h.style.mt = W((h.style.mt ?? 0) + D - h.style.h)), Q > 0 && (h.style.mb = W((h.style.mb ?? 0) + Q)), b("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!x.display && j && U) {
    if (x.display = "flex", x.flex_direction = K ? "col" : "row", !K) x.items = "baseline";
    else for (const h of N) h.kind !== "text" && /^inline-(block|flex)$/.test(h[On]) && !h.style.self && (h.style.self = "start");
    b("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", K ? "a column of its children" : "a row on the text baseline");
  }
  const g = f.values["letter-spacing"]?.px;
  if (g)
    for (let h = 0; h < N.length; h++) {
      const D = N[h];
      if (D.kind !== "text") continue;
      const Q = Math.round(g * [...D.text].length * 1e3) / 1e3;
      N[h] = { kind: "div", style: { pr: Q }, tokens: {}, children: [D] };
    }
  return w.children = N, w;
}
function Rg(n, l) {
  if (!l) return null;
  let c = (l.self ? n : l.closest ? Ld(n, l.closest) : l.find ? pl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return c && l.strip && c.startsWith(l.strip) && (c = c.slice(l.strip.length)), c;
}
function Hg(n, l, o) {
  const c = l.map((p) => [p, Hi(p.selector)]), s = /* @__PURE__ */ new Map(), d = (p) => {
    for (const f of p.children) {
      const v = o.get(f.id);
      if (v)
        for (const [y, C] of c) {
          const A = y.textRange ? "range_name" : "name";
          if (y.textRange && v[A] != null || !C.some((w) => Jd(f, w))) continue;
          const E = Rg(f, y.key), b = E == null ? s.get(y.name) ?? 0 : 0;
          E == null && s.set(y.name, b + 1);
          const x = E != null ? `${y.name}:${E}` : b ? `${y.name}@${b}` : y.name;
          v[A] == null ? v[A] = x : (v.also ??= []).push(x);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Mi = 0.9521, ff = 0.2256, Qo = (n, l) => (Ci(n, l) - (Mi + ff) * n["font-size"]) / 2 + Mi * n["font-size"];
function Dg(n, l) {
  const o = (s) => s && typeof s == "object" && "px" in s ? s.px : 0, c = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]);
  return o(n["padding-top"]) + c + Qo(n, l);
}
const Nd = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, mf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Ug(n) {
  const l = {};
  for (const [o, c] of Object.entries(n.props)) {
    if (mf.has(o) || typeof c == "function" || c === void 0 || c === null || typeof c == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (c === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    l[d] = typeof c == "boolean" ? s ? String(c) : "" : String(c);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const Bg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Td = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function qg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (o) => {
    const c = [];
    for (const [d, p] of Object.entries(o.props))
      mf.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || c.push(`${Bg(d)}="${Td(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && c.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof Di ? Td(d.data) : l(d)).join("");
    return `<${o.tagName}${c.length ? ` ${c.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return l(n);
}
function Yg(n) {
  const l = n.theme?.() ?? {}, o = {};
  for (const c of ef) l[c] && (o[c] = l[c]);
  return o;
}
const Gg = { font_features: "" };
function Kg(n, l, o, c = {}, s = null) {
  const d = Yg(l), p = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, p]);
  (c.look !== f || c.sheet !== o) && Object.assign(c, { look: f, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new mg(o, { theme: d, viewport: p }), top: null });
  const { cascade: v, cache: y } = c, C = { cascade: v, cache: y, viewport: p, findings: new kg(), measure: l.lineHeight ? (b) => l.lineHeight(b) : null };
  c.top ??= v.compute(n.body, v.compute(n.documentElement, null));
  const A = n.body.children.map((b) => df(b, c.top, Gg, C));
  if (s?.length) {
    const b = /* @__PURE__ */ new Map(), x = (w) => {
      w.id && b.set(w.id, w);
      for (const z of w.children ?? []) x(z);
    };
    A.forEach(x), Hg(n, s, b);
  }
  const E = /* @__PURE__ */ new Set();
  for (const b of [n, n.defaultView])
    for (const { type: x } of b?.listeners ?? []) yd[x] && E.add(yd[x]);
  return { schema: bg, root: A[0] ?? null, overlays: A.slice(1), document_events: [...E].sort(), unsupported: C.findings.list() };
}
const Qg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Vg = null;
const Xg = () => Vg ??= new sg(Qg);
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
let en = hl.NoEventPriority;
function Zg(n, l) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const c of o) {
    if (c === "children") continue;
    const s = n[c], d = l[c];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(c === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const Jg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Cd(n, l) {
  for (const o of Eh(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const Lg = {
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
  scheduleTimeout: (n, l) => setTimeout(n, l),
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
  createInstance: (n, l, o) => Cd(new It(n, l, o.ownerDocument), l),
  createTextInstance: (n, l) => new Di(n),
  appendInitialChild: (n, l) => {
    n.appendChild(l);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, l, o) => !!o.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, l) => {
    n.appendChild(l);
  },
  appendChildToContainer: (n, l) => {
    n.appendChild(l);
  },
  insertBefore: (n, l, o) => {
    n.insertBefore(l, o);
  },
  insertInContainerBefore: (n, l, o) => {
    n.insertBefore(l, o);
  },
  removeChild: (n, l) => {
    n.removeChild(l);
  },
  removeChildFromContainer: (n, l) => {
    n.removeChild(l);
  },
  clearContainer: (n) => {
    for (const l of [...n.childNodes]) n.removeChild(l);
  },
  commitUpdate: (n, l, o, c) => {
    if (n.props = c, n.inline) for (const s of Object.keys(n.inline)) o.style?.[s] !== c.style?.[s] && delete n.inline[s];
    if (o.dangerouslySetInnerHTML?.__html !== c.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      Cd(n, c);
    }
    Zg(o, c) && n.touch();
  },
  commitTextUpdate: (n, l, o) => {
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
    en = n;
  },
  getCurrentUpdatePriority: () => en,
  resolveUpdatePriority: () => en !== hl.NoEventPriority ? en : hl.DefaultEventPriority,
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
  bindToConsole: (n, l) => Function.prototype.bind.call(console[n], console, ...l)
}, Se = Lh(Lg), Ui = (n, l, o = null) => Se.createPortal(n, l, null, o), Wg = {
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
}, Fg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Ig = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), $g = (n) => {
  for (let l = n; l instanceof It; l = l.parentNode) if (l.props.disabled && Ig.has(l.tagName)) return !0;
  return !1;
};
class Pg {
  constructor(l, o, c) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, o), this.type = l, this.target = c, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function yi(n, l, o) {
  l.currentTarget = n;
  for (const { type: c, listener: s, capture: d } of [...n.listeners ?? []])
    c === l.type && d === o && s.call(n, l);
  if (n instanceof It) {
    const c = Wg[l.type], s = c && n.props[o ? `${c}Capture` : c];
    typeof s == "function" && s(l);
  }
}
function Wv(n, l, o = {}) {
  const { document: c, window: s, globals: d } = Mh(n), p = new It("div", { id: "root", style: o.container ?? {} }, c);
  c.body.appendChild(p);
  const f = [];
  let v = null;
  const y = () => [c, s].map((k) => k.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let C = "";
  const A = {}, E = `m${Math.random().toString(36).slice(2, 10)}:`;
  let b = 0, x = -1;
  c.measureKey = (k) => E + k.id, c.stale = () => x !== b, c.computed = (k) => {
    if (!A.cascade || !A.top) return null;
    const g = [];
    for (let D = k; D instanceof It && D !== c.body; D = D.parentNode) g.unshift(D);
    let h = A.top;
    for (const D of g) h = A.cascade.compute(D, h);
    return h.values;
  };
  const w = () => (b += 1, v = Kg(c, n, Xg(), A, o.names), C = y(), n.render?.(v), v), z = () => {
    Se.flushPassiveEffects(), Se.flushSyncWork(), y() !== C && w();
  };
  c.afterCommit = w;
  const H = (k) => {
    f.push(k), n.error?.(k);
  }, N = Se.createContainer(p, hl.ConcurrentRoot, null, !1, null, "", H, H, H, null);
  Se.updateContainerSync(ft.createElement(l, o.props ?? {}), N, null, null), Se.flushSyncWork(), z();
  const j = (k) => {
    const g = (h) => {
      if (h.id === k) return h;
      for (const D of h.children) {
        const Q = g(D);
        if (Q) return Q;
      }
      return null;
    };
    return g(c.documentElement);
  }, K = (k) => {
    const g = en;
    en = hl.DiscreteEventPriority;
    try {
      return k();
    } finally {
      en = g, Se.flushSyncWork(), z();
    }
  }, U = {
    document: c,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: p,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return v;
    },
    describe: w,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(k, g, h = {}) {
      const D = typeof k == "string" ? j(k) : k;
      if (!D || Fg.has(g) && $g(D)) return !1;
      const Q = new Pg(g, h, D), W = [];
      for (let gt = D; gt; gt = gt.parentNode) W.push(gt);
      const L = [...W, c, s];
      K(() => {
        for (let gt = L.length - 1; gt > 0 && !Q.propagationStopped; gt--) yi(L[gt], Q, !0);
        Q.propagationStopped || (yi(D, Q, !0), Q.propagationStopped || yi(D, Q, !1));
        for (let gt = 1; gt < L.length && !Q.propagationStopped; gt++) yi(L[gt], Q, !1);
      });
      const pt = g === "click" && !Q.defaultPrevented ? Do(D) : null;
      return pt && U.dispatch(pt, "submit", {}), !Q.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(k) {
      const g = c.activeElement && c.activeElement !== c.body ? c.activeElement : c.body;
      if (!U.dispatch(g, "keydown", k)) return !0;
      const D = k.key === "Enter" && !k.isComposing ? Do(g, !0) : null;
      if (D)
        return U.dispatch(D, "submit", {}), !0;
      if (!Pd(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((k.ctrlKey || k.metaKey) && !k.altKey && !k.shiftKey && k.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (k.ctrlKey || k.metaKey) return !1;
      const Q = g.selectedAll;
      g.selectedAll = !1;
      const W = g.value, pt = k.key === "Backspace" || Q && k.key === "Delete" ? Q ? "" : W.slice(0, -1) : [...k.key].length === 1 ? (Q ? "" : W) + k.key : W;
      return pt === W ? !1 : (g.value = pt, U.dispatch(g, "input", { data: k.key }), U.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), w(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(k, g) {
      const h = j(k);
      h && (h.bounds = { x: g.x, y: g.y, width: g.width, height: g.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(k) {
      const g = j(k);
      if (!g || g.props.disabled || !U.dispatch(k, "click", { button: 0, detail: 1 })) return;
      const h = g.props.type === "radio";
      h && g.checked || (g.checked = h ? !0 : !g.checked, U.dispatch(k, "input", {}), U.dispatch(k, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), w());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(k, g = {}) {
      const h = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const D of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) U.dispatch(k, D, h);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (k) => !!j(k)?.state.hover,
    hover(k, g) {
      const h = j(k);
      !h || h.state.hover === g || (h.state.hover = g, h.touch(), w());
    },
    focus(k) {
      const g = j(k);
      g && (K(() => {
        const h = c.activeElement;
        h && h !== g && h !== c.body && U.dispatch(h, "blur"), c.focus(g), U.dispatch(g, "focus");
      }), w());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(k) {
      let h = typeof k == "string" ? j(k) : k;
      for (; h && !(h instanceof It && typeof h.props.onKeyDown == "function" && Jg(h)); ) h = h.parentNode;
      !h || h === c.activeElement || (U.focus(h.id), h.state.pointerFocus = !0, h.touch(), w());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return x = b, c.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const k = c.retries.splice(0);
      for (const g of k) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: z,
    update(k) {
      Se.updateContainerSync(ft.createElement(l, k ?? {}), N, null, null), Se.flushSyncWork(), z();
    },
    unmount() {
      Se.updateContainerSync(null, N, null, null), Se.flushSyncWork(), Se.flushPassiveEffects(), c.afterCommit = null, c.retries.length = 0, n.forgetBounds?.(E);
    }
  };
  return U;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const pf = (n) => Se.flushSyncFromReconciler(n), t0 = { createPortal: Ui, flushSync: pf }, Fv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Ui,
  default: t0,
  flushSync: pf
}, Symbol.toStringTag, { value: "Module" }));
function hf(n) {
  var l, o, c = "";
  if (typeof n == "string" || typeof n == "number") c += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (o = hf(n[l])) && (c && (c += " "), c += o);
  } else for (o in n) n[o] && (c && (c += " "), c += o);
  return c;
}
function gf() {
  for (var n, l, o = 0, c = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (l = hf(n)) && (c && (c += " "), c += l);
  return c;
}
const e0 = (n, l) => {
  const o = new Array(n.length + l.length);
  for (let c = 0; c < n.length; c++)
    o[c] = n[c];
  for (let c = 0; c < l.length; c++)
    o[n.length + c] = l[c];
  return o;
}, a0 = (n, l) => ({
  classGroupId: n,
  validator: l
}), bf = (n = /* @__PURE__ */ new Map(), l = null, o) => ({
  nextPart: n,
  validators: l,
  classGroupId: o
}), Ai = "-", jd = [], n0 = "arbitrary..", l0 = (n) => {
  const l = r0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: c
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return i0(p);
      const f = p.split(Ai), v = f[0] === "" && f.length > 1 ? 1 : 0;
      return vf(f, v, l);
    },
    getConflictingClassGroupIds: (p, f) => {
      if (f) {
        const v = c[p], y = o[p];
        return v ? y ? e0(y, v) : v : y || jd;
      }
      return o[p] || jd;
    }
  };
}, vf = (n, l, o) => {
  if (n.length - l === 0)
    return o.classGroupId;
  const s = n[l], d = o.nextPart.get(s);
  if (d) {
    const y = vf(n, l + 1, d);
    if (y) return y;
  }
  const p = o.validators;
  if (p === null)
    return;
  const f = l === 0 ? n.join(Ai) : n.slice(l).join(Ai), v = p.length;
  for (let y = 0; y < v; y++) {
    const C = p[y];
    if (C.validator(f))
      return C.classGroupId;
  }
}, i0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), o = l.indexOf(":"), c = l.slice(0, o);
  return c ? n0 + c : void 0;
})(), r0 = (n) => {
  const {
    theme: l,
    classGroups: o
  } = n;
  return o0(o, l);
}, o0 = (n, l) => {
  const o = bf();
  for (const c in n) {
    const s = n[c];
    es(s, o, c, l);
  }
  return o;
}, es = (n, l, o, c) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const p = n[d];
    s0(p, l, o, c);
  }
}, s0 = (n, l, o, c) => {
  if (typeof n == "string") {
    c0(n, l, o);
    return;
  }
  if (typeof n == "function") {
    u0(n, l, o, c);
    return;
  }
  d0(n, l, o, c);
}, c0 = (n, l, o) => {
  const c = n === "" ? l : yf(l, n);
  c.classGroupId = o;
}, u0 = (n, l, o, c) => {
  if (f0(n)) {
    es(n(c), l, o, c);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(a0(o, n));
}, d0 = (n, l, o, c) => {
  const s = Object.entries(n), d = s.length;
  for (let p = 0; p < d; p++) {
    const [f, v] = s[p];
    es(v, yf(l, f), o, c);
  }
}, yf = (n, l) => {
  let o = n;
  const c = l.split(Ai), s = c.length;
  for (let d = 0; d < s; d++) {
    const p = c[d];
    let f = o.nextPart.get(p);
    f || (f = bf(), o.nextPart.set(p, f)), o = f;
  }
  return o;
}, f0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, m0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, o = /* @__PURE__ */ Object.create(null), c = /* @__PURE__ */ Object.create(null);
  const s = (d, p) => {
    o[d] = p, l++, l > n && (l = 0, c = o, o = /* @__PURE__ */ Object.create(null));
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
}, Vo = "!", Md = ":", p0 = [], Ad = (n, l, o, c, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: o,
  maybePostfixModifierPosition: c,
  isExternal: s
}), h0 = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: o
  } = n;
  let c = (s) => {
    const d = [];
    let p = 0, f = 0, v = 0, y;
    const C = s.length;
    for (let w = 0; w < C; w++) {
      const z = s[w];
      if (p === 0 && f === 0) {
        if (z === Md) {
          d.push(s.slice(v, w)), v = w + 1;
          continue;
        }
        if (z === "/") {
          y = w;
          continue;
        }
      }
      z === "[" ? p++ : z === "]" ? p-- : z === "(" ? f++ : z === ")" && f--;
    }
    const A = d.length === 0 ? s : s.slice(v);
    let E = A, b = !1;
    A.endsWith(Vo) ? (E = A.slice(0, -1), b = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      A.startsWith(Vo) && (E = A.slice(1), b = !0)
    );
    const x = y && y > v ? y - v : void 0;
    return Ad(d, b, E, x);
  };
  if (l) {
    const s = l + Md, d = c;
    c = (p) => p.startsWith(s) ? d(p.slice(s.length)) : Ad(p0, !1, p, void 0, !0);
  }
  if (o) {
    const s = c;
    c = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return c;
}, g0 = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, c) => {
    l.set(o, 1e6 + c);
  }), (o) => {
    const c = [];
    let s = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], f = p[0] === "[", v = l.has(p);
      f || v ? (s.length > 0 && (s.sort(), c.push(...s), s = []), c.push(p)) : s.push(p);
    }
    return s.length > 0 && (s.sort(), c.push(...s)), c;
  };
}, b0 = (n) => ({
  cache: m0(n.cacheSize),
  parseClassName: h0(n),
  sortModifiers: g0(n),
  postfixLookupClassGroupIds: v0(n),
  ...l0(n)
}), v0 = (n) => {
  const l = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let c = 0; c < o.length; c++)
      l[o[c]] = !0;
  return l;
}, y0 = /\s+/, x0 = (n, l) => {
  const {
    parseClassName: o,
    getClassGroupId: c,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = l, f = [], v = n.trim().split(y0);
  let y = "";
  for (let C = v.length - 1; C >= 0; C -= 1) {
    const A = v[C], {
      isExternal: E,
      modifiers: b,
      hasImportantModifier: x,
      baseClassName: w,
      maybePostfixModifierPosition: z
    } = o(A);
    if (E) {
      y = A + (y.length > 0 ? " " + y : y);
      continue;
    }
    let H = !!z, N;
    if (H) {
      const g = w.substring(0, z);
      N = c(g);
      const h = N && p[N] ? c(w) : void 0;
      h && h !== N && (N = h, H = !1);
    } else
      N = c(w);
    if (!N) {
      if (!H) {
        y = A + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (N = c(w), !N) {
        y = A + (y.length > 0 ? " " + y : y);
        continue;
      }
      H = !1;
    }
    const j = b.length === 0 ? "" : b.length === 1 ? b[0] : d(b).join(":"), K = x ? j + Vo : j, U = K + N;
    if (f.indexOf(U) > -1)
      continue;
    f.push(U);
    const k = s(N, H);
    for (let g = 0; g < k.length; ++g) {
      const h = k[g];
      f.push(K + h);
    }
    y = A + (y.length > 0 ? " " + y : y);
  }
  return y;
}, w0 = (...n) => {
  let l = 0, o, c, s = "";
  for (; l < n.length; )
    (o = n[l++]) && (c = xf(o)) && (s && (s += " "), s += c);
  return s;
}, xf = (n) => {
  if (typeof n == "string")
    return n;
  let l, o = "";
  for (let c = 0; c < n.length; c++)
    n[c] && (l = xf(n[c])) && (o && (o += " "), o += l);
  return o;
}, _0 = (n, ...l) => {
  let o, c, s, d;
  const p = (v) => {
    const y = l.reduce((C, A) => A(C), n());
    return o = b0(y), c = o.cache.get, s = o.cache.set, d = f, f(v);
  }, f = (v) => {
    const y = c(v);
    if (y)
      return y;
    const C = x0(v, o);
    return s(v, C), C;
  };
  return d = p, (...v) => d(w0(...v));
}, S0 = [], Zt = (n) => {
  const l = (o) => o[n] || S0;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, wf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, _f = /^\((?:(\w[\w-]*):)?(.+)\)$/i, k0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, z0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, E0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, N0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, T0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, C0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, ja = (n) => k0.test(n), ht = (n) => !!n && !Number.isNaN(Number(n)), Ze = (n) => !!n && Number.isInteger(Number(n)), Mo = (n) => n.endsWith("%") && ht(n.slice(0, -1)), ca = (n) => z0.test(n), Sf = () => !0, j0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  E0.test(n) && !N0.test(n)
), as = () => !1, M0 = (n) => T0.test(n), A0 = (n) => C0.test(n), O0 = (n) => !I(n) && !$(n), R0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), H0 = (n) => Ra(n, Ef, as), I = (n) => wf.test(n), tn = (n) => Ra(n, Nf, j0), Od = (n) => Ra(n, Q0, ht), D0 = (n) => Ra(n, Cf, Sf), U0 = (n) => Ra(n, Tf, as), Rd = (n) => Ra(n, kf, as), B0 = (n) => Ra(n, zf, A0), xi = (n) => Ra(n, jf, M0), $ = (n) => _f.test(n), fl = (n) => nn(n, Nf), q0 = (n) => nn(n, Tf), Hd = (n) => nn(n, kf), Y0 = (n) => nn(n, Ef), G0 = (n) => nn(n, zf), wi = (n) => nn(n, jf, !0), K0 = (n) => nn(n, Cf, !0), Ra = (n, l, o) => {
  const c = wf.exec(n);
  return c ? c[1] ? l(c[1]) : o(c[2]) : !1;
}, nn = (n, l, o = !1) => {
  const c = _f.exec(n);
  return c ? c[1] ? l(c[1]) : o : !1;
}, kf = (n) => n === "position" || n === "percentage", zf = (n) => n === "image" || n === "url", Ef = (n) => n === "length" || n === "size" || n === "bg-size", Nf = (n) => n === "length", Q0 = (n) => n === "number", Tf = (n) => n === "family-name", Cf = (n) => n === "number" || n === "weight", jf = (n) => n === "shadow", V0 = () => {
  const n = Zt("color"), l = Zt("font"), o = Zt("text"), c = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), f = Zt("container"), v = Zt("spacing"), y = Zt("radius"), C = Zt("shadow"), A = Zt("inset-shadow"), E = Zt("text-shadow"), b = Zt("drop-shadow"), x = Zt("blur"), w = Zt("perspective"), z = Zt("aspect"), H = Zt("ease"), N = Zt("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], K = () => [
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
  ], U = () => [...K(), $, I], k = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [$, I, v], D = () => [ja, "full", "auto", ...h()], Q = () => [Ze, "none", "subgrid", $, I], W = () => ["auto", {
    span: ["full", Ze, $, I]
  }, Ze, $, I], L = () => [Ze, "auto", $, I], pt = () => ["auto", "min", "max", "fr", $, I], gt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], wt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], V = () => ["auto", ...h()], et = () => [ja, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], lt = () => [f, ja, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], B = () => [ja, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], q = () => [n, $, I], _ = () => [...K(), Hd, Rd, {
    position: [$, I]
  }], Y = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], nt = () => ["auto", "cover", "contain", Y0, H0, {
    size: [$, I]
  }], tt = () => [Mo, fl, tn], at = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    $,
    I
  ], it = () => ["", ht, fl, tn], St = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ut = () => [ht, Mo, Hd, Rd], Ha = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    x,
    $,
    I
  ], Da = () => ["none", ht, $, I], Ae = () => ["none", ht, $, I], Oe = () => [ht, $, I], da = () => [ja, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [ca],
      breakpoint: [ca],
      color: [Sf],
      container: [ca],
      "drop-shadow": [ca],
      ease: ["in", "out", "in-out"],
      font: [O0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [ca],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [ca],
      shadow: [ca],
      spacing: ["px", ht],
      text: [ca],
      "text-shadow": [ca],
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
        aspect: ["auto", "square", ja, I, $, z]
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
        "@container": ["", "normal", "size", $, I]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [R0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [ht, "auto", I, $, f]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": j()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": j()
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
        object: U()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: k()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": k()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": k()
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
        inset: D()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": D()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": D()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": D(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: D()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": D(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: D()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": D()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": D()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: D()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: D()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: D()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: D()
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
        z: [Ze, "auto", $, I]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [ja, "full", "auto", f, ...h()]
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
        flex: [ht, ja, "auto", "initial", "none", I]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ht, $, I]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ht, $, I]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Ze, "first", "last", "none", $, I]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": Q()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: W()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": L()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": L()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": Q()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: W()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": L()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": L()
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
        "auto-cols": pt()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": pt()
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
        justify: [...gt(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...wt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...wt()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...gt()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...wt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...wt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": gt()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...wt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...wt()]
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
        m: V()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: V()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: V()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: V()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: V()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: V()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: V()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: V()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: V()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: V()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: V()
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
        w: [f, "screen", ...et()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          f,
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
          f,
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
        text: ["base", o, fl, tn]
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
        font: [c, K0, D0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Mo, I]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [q0, U0, l]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [I]
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
        tracking: [s, $, I]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [ht, "none", $, Od]
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
        "list-image": ["none", $, I]
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
        list: ["disc", "decimal", "none", $, I]
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
        decoration: [...St(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [ht, "from-font", "auto", $, tn]
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
        "underline-offset": [ht, "auto", $, I]
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
        tab: [Ze, $, I]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", $, I]
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
        content: ["none", $, I]
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
        bg: nt()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Ze, $, I],
          radial: ["", $, I],
          conic: ["", Ze, $, I]
        }, G0, B0]
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
        from: tt()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: tt()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: tt()
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
        rounded: at()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": at()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": at()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": at()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": at()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": at()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": at()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": at()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": at()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": at()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": at()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": at()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": at()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": at()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": at()
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
        border: [...St(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...St(), "hidden", "none"]
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
        outline: [...St(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [ht, $, I]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ht, fl, tn]
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
          C,
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
        "inset-shadow": ["none", A, wi, xi]
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
        ring: q()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [ht, tn]
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
        "inset-ring": it()
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
        opacity: [ht, $, I]
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
        "mask-linear": [ht]
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
        "mask-radial": [$, I]
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
        "mask-radial-at": K()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [ht]
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
        mask: nt()
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
        mask: ["none", $, I]
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
          $,
          I
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Ha()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [ht, $, I]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ht, $, I]
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
        grayscale: ["", ht, $, I]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ht, $, I]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ht, $, I]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ht, $, I]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ht, $, I]
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
          $,
          I
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Ha()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [ht, $, I]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ht, $, I]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ht, $, I]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ht, $, I]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ht, $, I]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ht, $, I]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ht, $, I]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ht, $, I]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", $, I]
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
        duration: [ht, "initial", $, I]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", H, $, I]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [ht, $, I]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", N, $, I]
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
        perspective: [w, $, I]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": U()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Da()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Da()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Da()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Da()
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
        transform: [$, I, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: U()
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
        zoom: [Ze, $, I]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", $, I]
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
        "will-change": ["auto", "scroll", "contents", "transform", $, I]
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
        stroke: [ht, fl, tn, Od]
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
}, X0 = /* @__PURE__ */ _0(V0);
function je(...n) {
  return X0(gf(n));
}
function Z0(n, l, o) {
  return n.filter((c, s) => s !== l && (c.start + c.end) / 2 < o).length;
}
function J0(n, l, o, c) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const p = n[l + 1], f = n[l - 1], v = d.end - d.start + (p ? p.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((y, C) => {
    l < o && C > l && C <= o ? s[C] = -v : o < l && C >= o && C < l && (s[C] = v);
  }), s[l] = Math.min(Math.max(c, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const Dd = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function L0(n, l) {
  for (let o = n.parentElement; o; o = o.parentElement) {
    const c = getComputedStyle(o)[l === "x" ? "overflowX" : "overflowY"];
    if ((c === "auto" || c === "scroll") && (l === "x" ? o.scrollWidth > o.clientWidth : o.scrollHeight > o.clientHeight)) return o;
  }
  return null;
}
function W0(n, l, o, c) {
  const s = n[l] ? L0(n[l], o) : null, d = () => s ? o === "x" ? s.scrollLeft : s.scrollTop : 0, p = (z) => (o === "x" ? z.clientX : z.clientY) + d(), f = p(c), v = d(), y = n.map((z) => {
    const H = z.getBoundingClientRect();
    return o === "x" ? { start: H.left + v, end: H.right + v } : { start: H.top + v, end: H.bottom + v };
  }), C = n.map((z) => Dd.map((H) => z.style[H])), A = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, E = o === "x" ? "translateX" : "translateY";
  let b = !1;
  const x = { to: l };
  n.forEach((z, H) => {
    if (z.style.pointerEvents = "none", H !== l) {
      A || (z.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(z).position === "static" && (z.style.position = "relative"), z.style.zIndex = "30", z.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const w = (z, H) => {
    x.to = z, J0(y, l, z, H).forEach((N, j) => {
      n[j].style.transform = N ? `${E}(${N}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return x.to;
    },
    slot: (z) => Z0(y, l, p(z)),
    apply: (z, H) => {
      b || w(z, p(H) - f);
    },
    rest: () => {
      b || w(l, 0);
    },
    end: () => {
      b || (b = !0, n.forEach((z, H) => Dd.forEach((N, j) => {
        z.style[N] = C[H][j];
      })));
    }
  };
}
const F0 = 5;
let Ao = !1;
function I0(n, l) {
  if (n.button !== 0 || Ao) return;
  const o = { clientX: n.clientX, clientY: n.clientY }, c = n.currentTarget, s = n.pointerId;
  let d = null, p, f = !1;
  const v = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, y = (x) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", C), window.removeEventListener("pointerup", A), window.removeEventListener("pointercancel", E), window.removeEventListener("keydown", b, !0), window.removeEventListener("blur", E), c.removeEventListener("lostpointercapture", E);
    try {
      c.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    Ao = !1, document.body.style.cursor = v.cursor, document.body.style.userSelect = v.userSelect, d.end();
    const w = (z) => z.stopPropagation();
    window.addEventListener("click", w, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", w, !0), 0), p?.(), l.onEnd(x, d);
  }, C = (x) => {
    if (!d) {
      if (Math.hypot(x.clientX - o.clientX, x.clientY - o.clientY) < F0) return;
      const w = l.items();
      d = W0(w, l.from(w), l.axis, o), Ao = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        c.setPointerCapture(s);
      } catch {
      }
      c.addEventListener("lostpointercapture", E);
      const z = l.onStart?.();
      p = typeof z == "function" ? z : void 0;
    }
    l.onMove(x, d);
  }, A = () => y(!0), E = () => y(!1), b = (x) => {
    x.key === "Escape" && (x.stopPropagation(), y(!1));
  };
  window.addEventListener("pointermove", C), window.addEventListener("pointerup", A), window.addEventListener("pointercancel", E), window.addEventListener("keydown", b, !0), window.addEventListener("blur", E);
}
const Mf = typeof navigator < "u" && /Mac/i.test(navigator.platform), Oi = {
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
const $0 = Object.fromEntries(Object.entries(Oi).map(([n, l]) => [l, n])), P0 = {
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
function tb(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : $0[n];
}
const Ud = /* @__PURE__ */ new Map();
function Af(n, l = Mf) {
  const o = `${l}|${n}`, c = Ud.get(o);
  if (c) return c;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (Oi[d]) s.code = Oi[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Ud.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = Af(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function eb(n, l = Mf) {
  const o = Af(n, l), c = ab(tb(o.code) ?? "");
  return l ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${c}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", c].filter(Boolean).join("+");
}
const ab = (n) => P0[n] ?? n.toUpperCase(), Bd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, qd = gf, Bi = (n, l) => (o) => {
  var c;
  if (l?.variants == null) return qd(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = l, p = Object.keys(s).map((y) => {
    const C = o?.[y], A = d?.[y];
    if (C === null) return null;
    const E = Bd(C) || Bd(A);
    return s[y][E];
  }), f = o && Object.entries(o).reduce((y, C) => {
    let [A, E] = C;
    return E === void 0 || (y[A] = E), y;
  }, {}), v = l == null || (c = l.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((y, C) => {
    let { class: A, className: E, ...b } = C;
    return Object.entries(b).every((x) => {
      let [w, z] = x;
      return Array.isArray(z) ? z.includes({
        ...d,
        ...f
      }[w]) : {
        ...d,
        ...f
      }[w] === z;
    }) ? [
      ...y,
      A,
      E
    ] : y;
  }, []);
  return qd(n, p, v, o?.class, o?.className);
}, nb = Bi(
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
), lb = Bi(
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
function ib({ className: n, ...l } = {}) {
  return je(lb(l), n);
}
const Of = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Rf = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", rb = Bi(`${Rf} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function ob({ className: n, ...l } = {}) {
  return je(rb(l), n);
}
const Hf = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", sb = Bi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), cb = "my-1 h-px bg-overlay-0";
function ub({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ Nt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function db({ size: n = 16, className: l }) {
  return /* @__PURE__ */ Nt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ Nt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function fb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Df({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Yd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function mb({ state: n, error: l }) {
  return /* @__PURE__ */ Nt.jsx(
    "span",
    {
      className: je("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Yd[n] ?? Yd.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function pb({ title: n, onClose: l, children: o, testId: c }) {
  return Ui(
    /* @__PURE__ */ Nt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ Nt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": c,
            children: [
              /* @__PURE__ */ Nt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const _i = 4, Ma = 8, hb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Gd = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function gb({ value: n, onChange: l, options: o, className: c, ariaLabel: s, testId: d, id: p, title: f, disabled: v, placeholder: y, freeText: C, onKeyDown: A }) {
  const E = ft.useId(), [b, x] = ft.useState(!1), [w, z] = ft.useState(-1), [H, N] = ft.useState(!1), j = ft.useRef(null), K = ft.useRef(null), [U, k] = ft.useState({}), g = ft.useRef({ text: "", at: 0 }), h = C && H && n ? o.filter((B) => Gd(B).toLowerCase().includes(n.toLowerCase()) || B.value.toLowerCase().includes(n.toLowerCase())) : o, D = o.find((B) => B.value === n), Q = (B) => `${E}-${B}`;
  function W(B) {
    v || (z(B), x(!0));
  }
  function L() {
    x(!1), N(!1), z(-1);
  }
  function pt(B) {
    !B || B.disabled || (l(B.value), L());
  }
  function gt(B, q) {
    for (let _ = 1; _ <= h.length; _++) {
      const Y = (B + q * _ + h.length * _) % h.length;
      if (!h[Y].disabled) return Y;
    }
    return B;
  }
  const wt = () => h.findIndex((B) => !B.disabled), V = () => h.length - 1 - [...h].reverse().findIndex((B) => !B.disabled);
  Uo(() => {
    if (!b || !j.current) {
      k((nt) => nt.left === void 0 ? nt : {});
      return;
    }
    const B = j.current.getBoundingClientRect(), q = window.innerHeight - B.bottom - _i - Ma, _ = B.top - _i - Ma, Y = q < 160 && _ > q;
    k({
      position: "fixed",
      left: Math.min(Math.max(Ma, B.left), Math.max(Ma, window.innerWidth - B.width - Ma)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: B.width,
      maxWidth: window.innerWidth - 2 * Ma,
      maxHeight: Math.min(Y ? _ : q, 320),
      ...Y ? { bottom: window.innerHeight - B.top + _i } : { top: B.bottom + _i },
      overflowY: "auto"
    });
  }, [b, h.length]), Uo(() => {
    const B = K.current;
    if (!b || !B || U.left === void 0) return;
    const q = B.getBoundingClientRect().right, _ = window.innerWidth - Ma;
    q > _ && k((Y) => ({ ...Y, left: Math.max(Ma, Number(Y.left) - (q - _)) }));
  }, [b, U]), Le(() => {
    if (!b) return;
    const B = (q) => {
      const _ = q.target;
      (_ === document || _ instanceof Node && j.current && _.contains(j.current)) && L();
    };
    return window.addEventListener("resize", L), window.addEventListener("scroll", B, !0), () => {
      window.removeEventListener("resize", L), window.removeEventListener("scroll", B, !0);
    };
  }, [b]), Le(() => {
    const B = b && w >= 0 ? document.getElementById(Q(w)) : null, q = K.current;
    !B || !q || (B.offsetTop < q.scrollTop ? q.scrollTop = B.offsetTop : B.offsetTop + B.offsetHeight > q.scrollTop + q.clientHeight && (q.scrollTop = B.offsetTop + B.offsetHeight - q.clientHeight));
  }, [b, w]), Bf(b, (B) => {
    B || L();
  }, j, K);
  function et(B) {
    if (B.nativeEvent.isComposing) return;
    const q = () => {
      B.preventDefault(), B.stopPropagation();
    }, { key: _ } = B;
    if (b) {
      if (_ === "Escape") {
        q(), L();
        return;
      } else if (_ === "Tab")
        L();
      else if (_ === "ArrowDown" || _ === "ArrowUp") {
        q(), h.length && z(w < 0 ? _ === "ArrowDown" ? wt() : V() : gt(w, _ === "ArrowDown" ? 1 : -1));
        return;
      } else if (_ === "Home" && !C) {
        q(), z(wt());
        return;
      } else if (_ === "End" && !C) {
        q(), z(V());
        return;
      } else if (_ === "Enter" || _ === " " && !C) {
        if (w >= 0 && h[w]) {
          q(), pt(h[w]);
          return;
        }
        if (!C) {
          q(), L();
          return;
        }
      } else if (!C && _.length === 1 && !B.metaKey && !B.ctrlKey && !B.altKey) {
        const Y = Date.now();
        g.current = { text: (Y - g.current.at > 600 ? "" : g.current.text) + _.toLowerCase(), at: Y };
        const nt = Math.max(w, 0), tt = [...h.slice(nt + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, nt + 1)].find((at) => !at.disabled && Gd(at).toLowerCase().startsWith(g.current.text));
        tt && (q(), z(h.indexOf(tt)));
        return;
      }
    } else if (_ === "ArrowDown" || _ === "ArrowUp" || !C && (_ === "Enter" || _ === " ")) {
      q(), W(Math.max(0, h.findIndex((Y) => Y.value === n)));
      return;
    }
    A?.(B);
  }
  const lt = {
    ref: (B) => {
      j.current = B;
    },
    id: p,
    title: f,
    disabled: v,
    "aria-label": s,
    "aria-expanded": b,
    "aria-controls": b ? E : void 0,
    "aria-activedescendant": b && w >= 0 ? Q(w) : void 0,
    "data-testid": d,
    onKeyDown: et
  };
  return /* @__PURE__ */ Nt.jsxs(Nt.Fragment, { children: [
    C ? /* @__PURE__ */ Nt.jsx(
      "input",
      {
        ...lt,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: y,
        className: c,
        value: n,
        onChange: (B) => {
          l(B.target.value), N(!0), b ? z(-1) : (z(-1), x(!0));
        },
        onBlur: () => L()
      }
    ) : /* @__PURE__ */ Nt.jsxs(
      "button",
      {
        ...lt,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: je("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", c),
        onClick: () => b ? L() : W(Math.max(0, h.findIndex((B) => B.value === n))),
        children: [
          /* @__PURE__ */ Nt.jsx("span", { className: "min-w-0 flex-1 truncate", children: D ? D.label : y ?? "" }),
          /* @__PURE__ */ Nt.jsx(Uf, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    b && h.length > 0 && Ui(
      /* @__PURE__ */ Nt.jsx(
        "div",
        {
          ref: K,
          id: E,
          role: "listbox",
          "aria-label": s,
          className: je("z-[9999]", Hf),
          style: U,
          onMouseDown: (B) => {
            B.preventDefault(), B.stopPropagation();
          },
          onClick: (B) => B.stopPropagation(),
          children: h.map((B, q) => /* @__PURE__ */ Nt.jsxs(
            "div",
            {
              id: Q(q),
              role: "option",
              "aria-selected": B.value === n,
              "aria-disabled": B.disabled || void 0,
              "data-value": B.value,
              className: je(hb, q === w && !B.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                B.disabled || z(q);
              },
              onClick: () => pt(B),
              children: [
                /* @__PURE__ */ Nt.jsx("span", { className: "min-w-0 truncate", children: B.label }),
                B.value === n && /* @__PURE__ */ Nt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const bb = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", vb = `${bb} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function Uf({ open: n, size: l = 12, className: o }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: o, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function yb(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Xo = {
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
function Zo(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((o) => o.id === n.parentSessionId);
}
function xb(n) {
  const l = /* @__PURE__ */ new Map();
  for (const o of n)
    Zo(o, n) && l.set(o.parentSessionId, [...l.get(o.parentSessionId) ?? [], o]);
  return l.size ? n.filter((o) => !Zo(o, n)).flatMap((o) => [o, ...l.get(o.id) ?? []]) : n;
}
const Si = 6, Kd = 8;
function wb(n, l = {}) {
  const { minWidth: o = 220, align: c = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), p = window.innerWidth, f = window.innerHeight, v = c === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, y = d.top - Si - Kd, C = f - d.bottom - Si - Kd;
  return y >= s ? {
    position: "fixed",
    bottom: f - d.top + Si,
    ...v,
    minWidth: o,
    maxHeight: Math.min(y, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Si,
    ...v,
    minWidth: o,
    maxHeight: Math.min(C, f * 0.75),
    overflowY: "auto"
  };
}
function Bf(n, l, o, c) {
  Le(() => {
    if (!n) return;
    function s(p) {
      const f = p.target, v = o.current?.contains(f) ?? !1, y = c.current?.contains(f) ?? !1;
      !v && !y && l(!1);
    }
    function d(p) {
      p.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function _b({ icon: n, fallback: l }) {
  const [o, c] = ft.useState(!1);
  return Le(() => c(!1), [n]), !n || o ? /* @__PURE__ */ Nt.jsx(Nt.Fragment, { children: l }) : /* @__PURE__ */ Nt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => c(!0) });
}
const Sb = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", kb = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const zb = "1.3.0";
let Ei = null;
const Eb = (n) => {
  Ei = n;
};
function Tt() {
  const n = (typeof Ei == "function" ? Ei() : Ei) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const qf = (n) => Tt().subscribe?.(n) ?? (() => {
}), Nb = wb, Tb = globalThis.perch?.isMac !== !1, Cb = (n) => eb(n, Tt().isMac !== !1), jb = (n) => nb(n), Mb = ({ className: n, ...l } = {}) => je(ib(l), n), Ab = ob, Ob = (n) => sb(n), Rb = cb, Hb = Rf, Db = Of, Ub = (n) => Xo[n].color, Bb = (n, l) => Tt().shortcutFor?.(n, l) ?? null, qb = (n) => Tt().shortcutLabel?.(n) ?? null, qi = (n, l) => Tt().command(n, l ?? {}) !== !1, Yb = (n, l, o) => Tt().startSession?.(n, l, o), Gb = globalThis.perch?.pickFolder ? (n) => Tt().pickFolder(n) : null;
function oe(n) {
  const l = ft.useRef(n);
  return l.current = n, ft.useSyncExternalStore(qf, () => l.current(Tt()));
}
const Yf = (n = {}) => oe((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Kb = () => oe((n) => n.hosts()), Qb = () => oe((n) => n.sessionFolders());
function Vb() {
  const n = oe((l) => l.addProject?.() ?? Xb);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, o, c) => {
      l.trim() && n.status !== "pending" && Tt().addProjectFolder?.(l, o, c);
    },
    clear: () => Tt().clearAddProject?.()
  };
}
const Xb = Object.freeze({ status: "idle" }), Gf = "perch.lastAgentChoice", Zb = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Jb = () => {
  const n = Tt().storage?.getItem(Gf);
  return n === "claude" || n === "codex" ? n : "claude";
}, Lb = Object.freeze({ items: [] });
function Wb() {
  const n = oe((l) => l.notifications?.() ?? Lb);
  return ft.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [n]);
}
function Fb(n) {
  const l = oe((s) => s.agentChoices?.(n) ?? Zb), [o, c] = ft.useState(Jb);
  return ft.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: o,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (Tt().storage?.setItem(Gf, s), c(s));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, o]);
}
function Ib(n) {
  Le(() => Tt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function $b(n) {
  const l = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return xb(l).map((o) => ({ session: o.session, nested: Zo(o, l) }));
}
function Pb({ id: n, plain: l, className: o }) {
  const c = oe((y) => y.session(n));
  if (!c) return null;
  const s = c.state ?? yb(c), d = Xo[s]?.color ?? Xo.unknown.color, p = c.provider, f = p === "claude" || p === "claude-agent-teams" || p === "omp", v = l ? je("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : je("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return ft.createElement(
    "span",
    { className: v, style: l ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: l ? p ?? "Agent" : `${p ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    ft.createElement("span", { className: je("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, ft.createElement(Kf, { provider: p, size: 14 }))
  );
}
function Kf({ provider: n, size: l = 14 }) {
  const o = Tt().agentIcon?.(n, l) ?? null, c = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ft.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": c, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const tv = ({ children: n }) => ft.createElement(ft.Fragment, null, n);
function ev(n, l) {
  const o = ft.useRef(l);
  return o.current = l, Le(() => {
    const c = Tt();
    if (!c.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [p, f] of Object.entries(o.current))
      s[p] = typeof f == "function" ? (...v) => o.current[p]?.(...v) : f;
    const d = c.openOverlay(n, s);
    return () => c.closeOverlay?.(d);
  }, [n]), null;
}
const ln = (n) => function(o) {
  return ev(n, o);
}, av = ln("session-menu"), nv = ln("new-session-menu"), lv = ln("confirm");
let Qf = null;
const iv = (n) => {
  Qf = n;
};
function rv(n) {
  return ft.createElement(Qf ?? lv, n);
}
function ov({ className: n = vb, ...l }) {
  return ft.createElement(gb, { ...l, className: n });
}
let Jo = null;
const sv = (n) => {
  Jo = n;
}, cv = ln("folder-browser");
function uv(n) {
  return Jo ? ft.createElement(Jo, { ...n, browse: (l) => Tt().browse(n.hostId, l) }) : ft.createElement(cv, n);
}
const dv = ln("instructions"), fv = ln("memory"), mv = pb;
let ns = null;
const pv = (n) => {
  ns = n;
};
function hv(n) {
  if (ns) return ft.createElement(vv, n);
  const { hostId: l, path: o, className: c } = n, s = ft.useRef(null);
  return ft.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: je("worktree-menu__btn", Of, c),
      "data-testid": `worktree-menu-${l}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    ft.createElement(Df, null)
  );
}
const Vf = "Perch did not answer.";
function ki(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Vf };
}
function gv(n, l) {
  const o = (c) => {
    for (const s of c ?? []) {
      if (s.path === l) return s;
      const d = o(s.children);
      if (d) return d;
    }
    return null;
  };
  for (const c of Tt().navigation({})?.projects ?? []) {
    if (c.hostId !== n) continue;
    const s = o(c.workspaces) ?? o(c.hidden);
    if (s) return s;
  }
  return null;
}
function bv(n, l, o) {
  let c = !1, s = () => {
  };
  const d = () => {
    c || !gv(n, l) || (c = !0, s(), clearTimeout(p), Tt().startSession?.(n, l, o));
  }, p = setTimeout(() => {
    c = !0, s();
  }, 5 * 6e4);
  s = qf(d), d();
}
function vv({ hostId: n, path: l, className: o, worktrees: c, request: s, parentChoices: d, emptyAgent: p, ...f }) {
  const [v, y] = ft.useState(c), C = (Q) => !!Tt().coreCan?.(Q, n), A = Yf(), E = `${n}:${l}`, b = ft.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!C("workspace.nest")) return [];
    const Q = A?.projects?.find((pt) => pt.hostId === n && pt.repoPath === l), W = [], L = (pt, gt) => {
      for (const wt of pt ?? [])
        gt && W.push({ id: wt.id, name: wt.name, path: wt.path }), L(wt.children, !0);
    };
    return L(Q?.workspaces, !1), W;
  }, [d, A, n, l]), x = n === "local" && C("worktree.job"), w = f.deleteSupported ?? C("worktree.delete"), z = f.startFromSupported ?? C("worktree.startFrom"), H = oe((Q) => Q.emptyWorkspaceAgent?.() ?? void 0), N = p ?? H ?? void 0, j = oe((Q) => Q.worktreeMenuRequest?.() ?? null), K = j?.projectKey === E ? j.nonce : null, U = ft.useMemo(() => s ?? (K == null ? null : j), [s, K]), [k, g] = ft.useState(U);
  Le(() => {
    U && g(U);
  }, [U]);
  const h = ft.useRef({});
  h.current = { background: x, deleteSupported: w };
  const D = ft.useMemo(() => {
    const Q = (W, L) => Tt().ask(W, { hostId: n, repoPath: l, ...L });
    return {
      list: async () => {
        const W = await Q("worktree.list", {});
        return W?.type === "worktree.list.result" && y({ worktrees: W.worktrees ?? [], defaultRoot: W.defaultRoot ?? "", baseRef: W.baseRef, refs: W.refs ?? [] }), ki(W);
      },
      create: async ({ branch: W, newBranch: L, path: pt, extra: gt, agent: wt }) => {
        const V = { branch: W, newBranch: !!L, path: pt ?? null, name: gt?.name ?? null, startFrom: gt?.startFrom ?? null, parentWorkspaceId: gt?.parentWorkspaceId ?? null }, { background: et } = h.current, lt = await Q(et ? "worktree.job.start" : "worktree.create", V), B = et ? "worktree.job.started" : "worktree.done";
        if (lt?.type !== B) return { error: ki(lt).error ?? Vf };
        const q = et ? lt.job?.path : lt.path;
        return wt && q && bv(n, q, wt), { background: et };
      },
      remove: async (W, L) => {
        const pt = await Q("worktree.remove", { path: W, force: !!L, deleteBranch: h.current.deleteSupported });
        return { ...ki(pt), preservedBranch: pt?.type === "worktree.done" ? pt.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (W, L) => ki(await Q("worktree.branch.delete", { branch: W, expectedHead: L })),
      open: (W) => Tt().startSession?.(n, W, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return ft.createElement(ns, {
    hostId: n,
    cwd: l,
    projectKey: E,
    className: o,
    worktrees: v,
    background: x,
    startFromSupported: z,
    deleteSupported: w,
    parentChoices: b,
    emptyAgent: N,
    request: k,
    actions: D
  });
}
const yv = (n, l) => {
  if (!Tt().followPointer?.(n)) return;
  const o = l.items();
  for (const c of o) c.getBoundingClientRect();
  o[0]?.parentElement?.getBoundingClientRect(), I0(n, l);
}, xv = () => oe((n) => n.workspaceTabs()), wv = () => oe((n) => n.statusLine()), _v = () => oe((n) => n.zoom()), Sv = () => oe((n) => n.paneLook()), kv = () => oe((n) => n.keybindings?.() ?? []), zv = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Ev(n) {
  const l = !!n?.keepFresh, o = oe((s) => s.statusLine?.().connected ?? !1), c = oe((s) => s.planUsage?.() ?? zv);
  return Le(() => {
    if (!l || !o) return;
    let s;
    const d = () => {
      Tt().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, o]), c;
}
const Nv = () => Tt().command("usage.get", { force: !0 }), Tv = (n) => Tt().command("usage.redeemReset", { accountId: n }), Cv = () => qi("app.zoom_reset"), jv = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Mv = (n, l, o) => Tt().beginTabDrag?.(n, l, o);
function Av(n) {
  Le(() => Tt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Ov = (n) => qi("browser.open", { workspaceId: n }), Rv = (n, l) => qi("file.open", { workspaceId: n, path: l }), Hv = () => null, Dv = () => null, Uv = ln("new-file"), Iv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Kf,
  Chevron: Uf,
  CloseIcon: fb,
  ConfirmDialog: rv,
  Dialog: mv,
  EllipsisIcon: ub,
  FolderBrowser: uv,
  GearIcon: db,
  HostStateDot: mb,
  InstructionsDialog: dv,
  MemoryDialog: fv,
  NewFilePrompt: Uv,
  NewSessionMenu: nv,
  PageIcon: _b,
  PlusIcon: Df,
  Select: ov,
  SessionDot: Pb,
  SessionMenu: av,
  Slot: tv,
  TabDragLayer: Dv,
  TabMenu: Hv,
  WorktreeMenu: hv,
  agentStateColor: Ub,
  anchoredPopoverStyle: Nb,
  beginReorderDrag: yv,
  beginTabDrag: Mv,
  bindHost: Eb,
  buttonClass: Ab,
  cn: je,
  drawConfirmationsInPlace: iv,
  drawFolderBrowserInPlace: sv,
  drawWorktreeInPlace: pv,
  ghostButton: Hb,
  glassClass: Sb,
  iconButton: Db,
  isMac: Tb,
  keyLabel: Cb,
  menuDividerClass: Rb,
  menuItemClass: Ob,
  menuPanel: Hf,
  nestSessions: $b,
  openBrowserTab: Ov,
  openFileTab: Rv,
  pickFolder: Gb,
  redeemUsageReset: Tv,
  refreshUsage: Nv,
  resetZoom: Cv,
  rowActionClass: Mb,
  runCommand: qi,
  segmentClass: jb,
  shortcutFor: Bb,
  shortcutLabel: qb,
  startSession: Yb,
  tabStateClass: jv,
  tapButtonClass: kb,
  useAddProject: Vb,
  useAddProjectRequest: Ib,
  useAgentChoices: Fb,
  useDismissOnOutsideClick: Bf,
  useHosts: Kb,
  useKeybindings: kv,
  useNavigation: Yf,
  useNewTabRequest: Av,
  useNotifications: Wb,
  usePaneLook: Sv,
  usePlanUsage: Ev,
  useSessionFolders: Qb,
  useStatusLine: wv,
  useWorkspaceTabs: xv,
  useZoom: _v,
  version: zb
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
const ls = {
  display: (n, l) => l === "hidden" ? n.hidden() : l === "flex" ? n.flex() : n.block(),
  flex_direction: (n, l) => n[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[l]](),
  flex_wrap: (n, l) => l === "wrap" ? n.flex_wrap() : n.flex_nowrap(),
  items: (n, l) => n[`items_${l}`](),
  justify: (n, l) => n[`justify_${l}`](),
  self: (n, l) => l === "auto" ? n : n[`self_${l}`](),
  flex_grow: (n, l) => n.flex_grow(l),
  flex_shrink: (n, l) => n.flex_shrink(l),
  flex_basis: (n, l) => n.flex_basis(l),
  position: (n, l) => l === "absolute" ? n.absolute() : n.relative(),
  overflow_x: (n, l) => l === "hidden" ? n.overflow_x_hidden() : l === "scroll" ? n.overflow_x_scroll() : n,
  overflow_y: (n, l) => l === "hidden" ? n.overflow_y_hidden() : l === "scroll" ? n.overflow_y_scroll() : n,
  visibility: (n, l) => l === "invisible" ? n.invisible() : n.visible(),
  bg: (n, l) => n.bg(l),
  opacity: (n, l) => n.opacity(l),
  shadow: (n, l) => l === "none" ? n.shadow_none() : n[`shadow_${l}`](),
  cursor: (n, l) => n[`cursor_${l}`](),
  border_color: (n, l) => n.border_color(l),
  text_ellipsis: (n, l) => l ? n.text_ellipsis() : n,
  underline: (n, l) => l ? n.underline() : n,
  text_color: (n, l) => n.text_color(l),
  text_size: (n, l) => n.text_size(l),
  font_weight: (n, l) => n.font_weight(l),
  font_family: (n, l) => n.font_family(l),
  font_features: (n, l) => n.font_features(l),
  line_height: (n, l) => n.line_height(l),
  italic: (n, l) => l ? n.italic() : n.not_italic(),
  whitespace: (n, l) => l === "nowrap" ? n.whitespace_nowrap() : n.whitespace_normal(),
  text_align: (n, l) => n[`text_${l}`](),
  rounded: (n, l) => n.rounded(l)
};
for (const n of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  ls[n] = (l, o) => l[n](o);
const $v = Object.keys(ls);
function Qd(n, l) {
  for (const [o, c] of Object.entries(l)) {
    const s = ls[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    c != null && (n = s(n, c));
  }
  return n;
}
const Aa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Vd = /* @__PURE__ */ new WeakSet();
function Xd(n, l, o) {
  const c = n.pressed, s = Aa(o);
  return c && c.x === s.clientX && c.y === s.clientY ? c.id : l;
}
function Bv(n, l, o) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const c = n.meta?.attrs["data-testid"];
  return c ? `~${n.id}:${c}` : `~${n.id}`;
}
const Xf = (n, l = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !l || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && Xf(o, !0)), Me = (n) => n.style?.display !== "hidden";
function Lo(n, l, o, c, s = !1, d = !1, p = null, f = {}, v = !1, y = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return y.get(n)?.text ?? n.text;
  const C = Vd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), p = n.style.text_color ?? p;
  const A = !!n.hover?.text_color && Wf(n);
  A && o.hovered?.(n.id) && (p = n.hover.text_color), f = { ...f };
  for (const k of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[k] !== void 0 && (f[k] = n.style[k]);
  const E = new Set(n.events ?? []);
  let b;
  n.kind === "image" && !n.markup ? b = l.image(n.src) : b = l.div(), n.markup && (b = b.child(c.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const x = Bv(n, E, s);
  if (x && (b = b.id(x)), n.measure && (b = b.measure(n.measure)), n.name && b.also_named) for (const k of n.also ?? []) b = b.also_named(k);
  b = Qd(b, { ...n.style, ...y.get(n) });
  const w = f.whitespace !== "nowrap" && !f.text_ellipsis;
  v && w && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Xf(n) && (b = b.min_w(0));
  for (const k of ["hover", "focus", "active"]) n[k] && (b = b[k]((g) => Qd(g, n[k])));
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const k = o.document?.scrollTarget, g = k ? (n.children ?? []).filter(Me).findIndex((h) => Lf(h, k.id)) : -1;
    if (g >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, l.scroll.scroll_to_item(g)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      b = b.track_scroll(l.scroll);
      const h = (n.children ?? []).filter(Me).map((D) => D.id);
      o.document.itemBounds = (D) => h.includes(D) ? l.scroll.item_bounds?.(h.indexOf(D)) ?? null : null;
    }
  }
  n.kind === "input" && !n.disabled && (b = b.on_mouse_down("left", (k, g) => {
    k.bounds && o.setBounds(n.id, k.bounds), o.focus(n.id), g.notify();
  }));
  const z = n.kind === "input" ? n : n.meta?.tag === "label" ? Jf(n) : null;
  z && !z.disabled && /^(checkbox|radio)$/.test(z.input_type) && (b = b.on_click((k, g) => {
    g.stop_propagation?.(), o.toggle(z.id), g.notify();
  }));
  const H = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((k) => E.has(k));
  if (H || C) for (const k of n.children ?? []) k.kind !== "text" && Vd.add(k);
  if (H && (b = b.on_mouse_down("left", (k, g) => {
    g.stop_propagation?.(), k.bounds && o.setBounds(n.id, k.bounds);
    const h = { ...Aa(k), button: 0, buttons: 1, detail: k.click_count }, D = Xd(o, n.id, k);
    o.pressed = null, o.dispatch(D, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(D, "mousedown", h) && o.pressFocus?.(D), g.notify();
  }), b = b.on_mouse_down("right", (k, g) => {
    g.stop_propagation?.(), k.bounds && o.setBounds(n.id, k.bounds);
    const h = Xd(o, n.id, k);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Aa(k), button: 2 }), g.notify();
  }), b = b.on_mouse_up("left", (k, g) => {
    g.stop_propagation?.();
    const h = { ...Aa(k), button: 0 };
    o.dispatch(n.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", h), g.notify();
  }), b = b.on_click((k, g) => {
    o.dispatch(n.id, k.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: k.click_count, button: 0 }), g.notify();
  })), n.blocks_pointer && !H)
    for (const k of ["left", "right"]) b = b.on_mouse_down(k, (g, h) => h.stop_propagation?.());
  else if (C && !H)
    for (const k of ["left", "right"])
      b = b.on_mouse_down(k, (g) => {
        const h = Aa(g);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: n.id, x: h.clientX, y: h.clientY });
      });
  if (E.has("mouse_move") && (b = b.on_mouse_move((k, g) => {
    o.dispatch(n.id, "pointermove", { ...Aa(k), pointerType: "mouse" }), g.notify();
  })), (n.track_hover || A) && (b = b.on_hover((k, g) => {
    o.hover(n.id, k), g.notify();
  })), s && (b = b.on_mouse_down_out((k, g) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Aa(k), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Aa(k)), g.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const k = n.value ? String(n.value) : String(n.placeholder ?? "");
    let g = l.div().whitespace_nowrap().overflow_x_hidden();
    const h = an(f);
    h && (g = g.h(h)), !n.value && p && (g = g.text_color(Yv(p))), k && (b = b.child(g.child(n.input_type === "password" && n.value ? "•".repeat([...k].length) : k))), n.field_w && (b = b.child(l.div().w(n.field_w).h(0)));
  }
  const N = f.whitespace === "nowrap" ? an(f) : null, j = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let K = !n.range_name;
  const U = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const k of (n.children ?? []).filter(Me)) {
    const g = k.style?.flex_basis;
    U && k.style.flex_grow > 0 && (g === 0 || typeof g == "string" && g.endsWith("%")) && y.set(k, { ...y.get(k), flex_basis: "auto" });
    let h = Lo(k, l, o, c, !1, d, p, f, j && k.style?.position !== "absolute", y);
    const D = !K && (k.kind === "text" || !k.meta), Q = k.kind === "text" ? y.get(k)?.h ?? N : null, W = k.kind === "text" ? y.get(k)?.w : void 0;
    if (D || Q || W !== void 0) {
      let L = l.div();
      D && (L = L.id(n.range_name)), D && !j && n.style.display === "flex" && (L = L[`self_${qv[f.text_align] ?? "start"}`]().max_w("100%")), Q && (L = L.h(Q)), W !== void 0 && (L = L.w(W).flex_none().whitespace_nowrap()), h = L.child(h), K ||= D;
    }
    b = b.child(h);
  }
  return b;
}
const qv = { center: "center", right: "end", end: "end" };
function Yv(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const o = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const Zf = /^(?:[!-,.-~]+|\S)$/u, Jf = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const o = l.kind === "text" ? null : Jf(l);
    if (o) return o;
  }
  return null;
}, Lf = (n, l) => n.id === l || (n.children ?? []).some((o) => o.kind !== "text" && Lf(o, l)), Wf = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Wf(l));
function an(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function Pv(n, l, o, c, s = 0, d = !1) {
  const p = [n.root, ...n.overlays], f = s > 0 ? Jv(p, s) : /* @__PURE__ */ new Map();
  s > 0 && c.measure && Gv(p, s, c.measure, f), Xv(p, f), Vv(p, f), c.measure && Qv(p, c.measure, f);
  let v = l.div().relative().size_full().child(Lo(n.root, l, o, c, !1, !1, null, {}, !1, f)), y = d && n.overlays.length ? l.div().relative().size_full().window_layer() : v;
  for (const C of n.overlays) y = y.child(Lo(C, l, o, c, !0, !1, null, {}, !1, f));
  return y === v ? v : v.child(y);
}
function Gv(n, l, o, c) {
  const s = (x, w) => c.set(x, { ...c.get(x), ...w }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function v(x, w, z) {
    if (x.kind === "text") {
      if (!(w.whitespace === "nowrap" || Zf.test(x.text)) || w.text_ellipsis || z || typeof w.text_size != "number") return NaN;
      const g = o(x.text, { size: w.text_size, weight: w.font_weight ?? 400, family: w.font_family ?? ".SystemUIFont", italic: !!w.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Me(x) || x.kind === "input" || x.markup) return y(x);
    const H = { ...w };
    for (const k of f) x.style[k] !== void 0 && (H[k] = x.style[k]);
    p.set(x, H);
    const N = x.style, j = (x.children ?? []).filter(Je), K = j.map((k) => v(k, H, z || !!x.tabular));
    let U = y(x);
    if (!Number.isFinite(U) && N.w === void 0) {
      const k = j.map((h, D) => K[D] + (h.kind === "text" ? 0 : P(h.style.ml) + P(h.style.mr)));
      let g;
      j.length ? qe(x) ? g = j.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || N.flex_wrap === "wrap" ? NaN : k.reduce((h, D) => h + D, 0) + P(N.gap_x) * (j.length - 1) : g = Math.max(...k) : g = 0, U = g + P(N.pl) + P(N.pr) + P(N.border_l) + P(N.border_r), typeof N.min_w == "number" && (U = Math.max(U, N.min_w)), typeof N.max_w == "number" && (U = Math.min(U, N.max_w));
    }
    return d.set(x, U), U;
  }
  const y = (x) => typeof x.style?.w == "number" ? x.style.w : NaN, C = () => ({ exact: 0, laid: 0 }), A = (x, w) => {
    if (!Number.isFinite(w))
      return Object.assign(x, C()), NaN;
    x.exact += w;
    const z = Math.round(x.exact * l + 1e-9) / l, H = z - x.laid;
    return x.laid = z, H;
  }, E = (x) => qe(x) && x.style.flex_wrap !== "wrap" && (x.style.justify ?? "start") === "start";
  function b(x) {
    if (!x || x.kind === "text" || !Me(x)) return;
    const w = (x.children ?? []).filter(Je);
    if (E(x) && w.length > 1) {
      const z = P(x.style.gap_x), H = C(), N = !(z && w.some((j) => j.kind === "text"));
      s(x, { border_l: A(H, P(x.style.border_l)), pl: A(H, P(x.style.pl)) }), N && z && s(x, { gap_x: 0 }), w.forEach((j, K) => {
        const U = (K && N ? z : 0) + (j.kind === "text" ? 0 : P(j.style.ml));
        if (j.kind === "text")
          U && Object.assign(H, C());
        else {
          const D = A(H, U);
          Number.isFinite(D) && s(j, { ml: D });
        }
        const k = j.kind === "text" ? p.get(x) ?? {} : null, g = j.kind === "text" ? v(j, k, !!x.tabular) : d.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(g) ? s(j, { w: A(H, g) }) : Object.assign(H, C()), j.kind !== "text") {
          const D = A(H, P(j.style.mr));
          Number.isFinite(D) && s(j, { mr: D });
        }
      });
    }
    for (const z of x.children ?? []) z.kind !== "text" && b(z);
  }
  for (const x of n)
    x && (v(x, {}, !1), b(x));
}
const Kv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Qv(n, l, o) {
  const c = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (f) => typeof f == "number" ? f : 0, d = (f, v) => v && Ri(v) && !qe(v) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(v.style.items), p = (f, v, y, C) => {
    if (!f || f.kind === "text" || !Me(f)) return;
    const A = f.style;
    let E = typeof A.w == "number" ? A.w : A.w === "100%" ? y : d(f, v) ? y - s(A.ml) - s(A.mr) : NaN;
    typeof A.max_w == "number" && (E = Math.min(E, A.max_w));
    const b = E - s(A.pl) - s(A.pr) - s(A.border_l) - s(A.border_r), x = { ...C };
    for (const z of c) A[z] !== void 0 && (x[z] = A[z]);
    const w = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(b) && b > 0 && typeof x.text_size == "number" && w.length && w.every((z) => z.kind === "text")) {
      const z = { size: x.text_size, weight: x.font_weight ?? 400, family: x.font_family ?? ".SystemUIFont", italic: !!x.italic }, H = (K) => l(K.trimEnd(), z) <= b + 0.01;
      let N = 0;
      for (const K of w) {
        const U = [];
        for (const g of K.text.split(`
`)) {
          let h = "";
          for (const D of g.split(Kv)) {
            if (H(h + D)) {
              h += D;
              continue;
            }
            h && U.push(h.trimEnd()), h = "";
            for (const Q of D)
              h && !H(h + Q) && (U.push(h), h = ""), h += Q;
          }
          U.push(h.trimEnd());
        }
        const k = U.join(`
`);
        U.every((g) => !g || H(g)) ? k !== K.text && o.set(K, { ...o.get(K), text: k }) : N = NaN, N += U.length;
      }
      const j = an(x);
      Number.isFinite(N) && j && A.h === void 0 && w.length === 1 && o.set(f, { ...o.get(f), h: N * j + s(A.pt) + s(A.pb) + s(A.border_t) + s(A.border_b) });
    }
    for (const z of w) p(z, f, qe(f) ? NaN : b, x);
  };
  for (const f of n) p(f, null, NaN, {});
}
function Vv(n, l) {
  const o = (c, s) => {
    if (!c || c.kind === "text" || !Me(c)) return;
    const d = c.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (p && qe(c))
      for (const f of c.children ?? []) {
        const v = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (v === 0 || typeof v == "string" && v.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of c.children ?? []) o(f, p);
  };
  for (const c of n) o(c, !1);
}
function Xv(n, l) {
  const o = l.heights ?? /* @__PURE__ */ new Map(), c = (f) => o.get(f), s = (f) => {
    const v = f.style, y = (f.children ?? []).filter(Je);
    if (!y.length || qe(f)) return NaN;
    let C = 0;
    for (const A of y) {
      const E = c(A);
      if (!Number.isFinite(E)) return NaN;
      C += E + (A.kind === "text" ? 0 : P(A.style.mt) + P(A.style.mb));
    }
    return C + (v.display === "flex" ? P(v.gap_y) * (y.length - 1) : 0) + P(v.pt) + P(v.pb);
  }, d = (f, v) => {
    const y = f.style;
    if (typeof y.h == "number") return y.h;
    if (typeof y.max_h == "number") return y.max_h;
    if (!v || !Ri(v) || qe(v)) return NaN;
    const C = v.style, A = typeof C.h == "number" ? C.h : typeof C.max_h == "number" ? C.max_h : NaN, E = (v.children ?? []).filter(Je);
    let b = 0;
    for (const w of E) {
      if (w === f) continue;
      const z = c(w);
      if (!Number.isFinite(z)) return NaN;
      b += z + (w.kind === "text" ? 0 : P(w.style.mt) + P(w.style.mb));
    }
    const x = C.display === "flex" ? P(C.gap_y) * Math.max(0, E.length - 1) : 0;
    return A - P(C.pt) - P(C.pb) - P(C.border_t) - P(C.border_b) - b - x - P(y.mt) - P(y.mb);
  }, p = (f, v) => {
    if (!(!f || f.kind === "text" || !Me(f))) {
      if (f.scrollbar > 0 && f.style.overflow_y === "scroll") {
        const y = s(f), C = d(f, v);
        Number.isFinite(y) && Number.isFinite(C) && y > C + 0.01 && l.set(f, { ...l.get(f), pr: P(f.style.pr) + f.scrollbar });
      }
      for (const y of f.children ?? []) p(y, f);
    }
  };
  for (const f of n) p(f, null);
}
const Zv = ["text_size", "line_height", "whitespace", "text_ellipsis"], P = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ri = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, qe = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Je = (n) => n.kind === "text" || Me(n) && n.style.position !== "absolute";
function Jv(n, l) {
  const o = /* @__PURE__ */ new Map(), c = (w, z) => o.set(w, { ...o.get(w), ...Object.fromEntries(Object.entries(z).filter(([, H]) => Number.isFinite(H))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(w, z) {
    if (w.kind === "text") return z.whitespace === "nowrap" || Zf.test(w.text) ? an(z) ?? NaN : NaN;
    const H = { ...z };
    for (const k of Zv) w.style[k] !== void 0 && (H[k] = w.style[k]);
    d.set(w, H);
    const N = w.style, j = (w.children ?? []).filter(Je), K = j.map((k) => p(k, H));
    let U;
    if (N.h !== void 0 && N.h !== "auto") U = P(N.h);
    else if (w.kind === "input")
      U = (w.input_type === "textarea" || w.input_type === "select" ? NaN : an(H) ?? NaN) + P(N.pt) + P(N.pb) + P(N.border_t) + P(N.border_b), N.min_h !== void 0 && (U = Math.max(U, P(N.min_h)));
    else {
      const k = j.map((h, D) => (h.kind === "text" ? 0 : P(h.style.mt) + P(h.style.mb)) + K[D]);
      let g;
      if (qe(w)) g = N.flex_wrap === "wrap" ? NaN : N.items === "baseline" ? v(j, K, H) : Math.max(0, ...k);
      else if (Ri(w)) {
        const h = j.some((Q) => Q.kind !== "text" && (Q.style.flex_grow > 0 || Q.style.flex_basis !== void 0)), D = N.display !== "flex" && j.some((Q) => Q.kind !== "text" && (P(Q.style.mt) || P(Q.style.mb)));
        g = h || D ? NaN : k.reduce((Q, W) => Q + W, 0) + (N.display === "flex" ? P(N.gap_y) * Math.max(0, j.length - 1) : 0);
      } else g = NaN;
      U = g + P(N.pt) + P(N.pb) + P(N.border_t) + P(N.border_b), N.min_h !== void 0 && (U = Math.max(U, P(N.min_h))), N.max_h !== void 0 && (U = Math.min(U, P(N.max_h)));
    }
    return s.set(w, U), U;
  }
  const f = (w) => (an(w) - (Mi + ff) * w.text_size) / 2 + Mi * w.text_size;
  function v(w, z, H) {
    let N = 0, j = 0;
    for (const [K, U] of w.entries()) {
      const k = U.kind === "text" ? H : d.get(U);
      if (!(U.kind === "text" || (U.children ?? []).filter(Je).every((Q) => Q.kind === "text")) || !Number.isFinite(z[K]) || typeof k.text_size != "number") return NaN;
      const h = U.kind === "text" ? {} : U.style, D = P(h.mt) + P(h.border_t) + P(h.pt) + f(k);
      N = Math.max(N, D), j = Math.max(j, P(h.mt) + z[K] + P(h.mb) - D);
    }
    return N + j;
  }
  const y = () => ({ exact: 0, laid: 0 }), C = (w, z) => {
    if (!Number.isFinite(z))
      return Object.assign(w, y()), NaN;
    w.exact += z;
    const H = Math.round(w.exact * l + 1e-9) / l, N = H - w.laid;
    return w.laid = H, N;
  };
  function A(w) {
    if (!(w.kind === "text" || !Me(w))) {
      for (const z of (w.children ?? []).filter((H) => H.kind !== "text" && Me(H) && H.style.position === "absolute")) A(z);
      if (Ri(w) && !qe(w)) {
        const z = y();
        c(w, { border_t: C(z, P(w.style.border_t)), pt: C(z, P(w.style.pt)) }), E(w, z);
      } else for (const z of (w.children ?? []).filter(Je)) z.kind !== "text" && A(z);
    }
  }
  function E(w, z) {
    const H = (w.children ?? []).filter(Je), N = w.style.display === "flex" ? P(w.style.gap_y) : 0;
    if (N && H.some((j) => j.kind === "text")) {
      for (const j of H) j.kind !== "text" && A(j);
      return !1;
    }
    return N && c(w, { gap_y: 0 }), H.forEach((j, K) => {
      if (j.kind === "text") {
        const U = s.get(j) ?? p(j, d.get(w) ?? {});
        Number.isFinite(U) ? c(j, { h: C(z, U) }) : Object.assign(z, y());
        return;
      }
      if (c(j, { mt: C(z, (K ? N : 0) + P(j.style.mt)) }), Number.isFinite(s.get(j))) x(j, z);
      else if (b(j)) {
        const U = j.style;
        c(j, { border_t: C(z, P(U.border_t)), pt: C(z, P(U.pt)) }), c(j, { pb: C(z, P(U.pb)), border_b: C(z, P(U.border_b)) });
      } else
        A(j), Object.assign(z, y());
      c(j, { mb: C(z, P(j.style.mb)) });
    }), !0;
  }
  function b(w) {
    const z = w.style, H = (w.children ?? []).filter(Je), N = an(d.get(w) ?? {});
    return w.kind === "div" && !qe(w) && H.length > 0 && H.every((j) => j.kind === "text") && Number.isInteger(N) && [z.h, z.min_h, z.max_h].every((j) => j === void 0 || j === "auto");
  }
  function x(w, z) {
    const H = w.style;
    for (const k of (w.children ?? []).filter((g) => g.kind !== "text" && Me(g) && g.style.position === "absolute")) A(k);
    const N = z.laid, j = z.exact;
    c(w, { border_t: C(z, P(H.border_t)), pt: C(z, P(H.pt)) });
    const K = H.h !== void 0 && H.h !== "auto", U = s.get(w) - P(H.pt) - P(H.pb) - P(H.border_t) - P(H.border_b);
    if (w.kind === "input")
      K || C(z, U);
    else if (qe(w) || K && (H.justify ?? "start") !== "start") {
      for (const k of (w.children ?? []).filter(Je)) k.kind !== "text" && A(k);
      K || C(z, U);
    } else !E(w, z) && !K && C(z, U);
    if (K) {
      z.exact = j + s.get(w), z.laid = Math.round(z.exact * l + 1e-9) / l, c(w, { h: z.laid - N });
      return;
    }
    c(w, { pb: C(z, P(H.pb)), border_b: C(z, P(H.border_b)) }), c(w, { h: z.laid - N });
  }
  for (const w of n)
    p(w, {}), A(w);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const ty = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }] };
export {
  ty as NAMED_ELEMENTS,
  Bh as React,
  bg as SCHEMA,
  $v as STYLE_KEYS,
  Pv as describeToGpui,
  Lv as jsxRuntime,
  Wv as mount,
  Fv as reactDom,
  Iv as sdk
};
