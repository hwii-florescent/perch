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
const fh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), mh = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), ph = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...fh]);
function Ro(n) {
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
  return [Ro(n.slice(l, o)), o];
}
function hh(n, l) {
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
function gh(n, l) {
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
      const p = n.slice(l + 1, d).trim(), m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!m) throw new ke(`cannot read the attribute selector [${p}]`);
      const b = m[3] ?? m[4] ?? m[5];
      o.attrs.push({ name: Ro(m[1]).toLowerCase(), op: m[2] ?? null, value: b === void 0 ? null : Ro(b) }), l = d + 1, c = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") throw new ke(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = hi(n, l + 1);
      l = p;
      const m = d.toLowerCase();
      if (n[l] === "(") {
        if (!mh.has(m)) throw new ke(`:${m}() is not supported`);
        const b = hh(n, l + 1), x = n.slice(l + 1, b).trim();
        if (l = b + 1, m === "nth-child") {
          if (!/^\d+$/.test(x)) throw new ke(`:nth-child(${x}) is not supported (only a number)`);
          o.pseudos.push({ name: m, n: Number(x) });
        } else
          o.pseudos.push({ name: m, list: Fo(x).map(Io) });
      } else {
        if (!ph.has(m)) throw new ke(`:${m} is not supported`);
        o.pseudos.push({ name: m });
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
    const [s, d] = gh(n, o);
    l.push({ compound: s, combinator: c }), o = d;
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
  if (!l.length) throw new ke("empty selector");
  return l;
}
const td = /* @__PURE__ */ new Map();
function Di(n) {
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
          const d = s.list.map(Zd).sort((p, m) => m[0] - p[0] || m[1] - p[1] || m[2] - p[2])[0];
          o(d);
        } else l[1]++;
  }
  return l;
}
function bh(n, { name: l, op: o, value: c }) {
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
function vh(n, l, o, c) {
  if (l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classList ?? [];
    for (const d of l.classes) if (!s.includes(d)) return !1;
  }
  for (const s of l.attrs) if (!bh(n, s)) return !1;
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
  const s = (d, p, m) => {
    const { compound: b, combinator: x } = l[p];
    if (!vh(d, b, o, m)) return !1;
    if (p === 0) return !0;
    if (x === ">") return !!d.parentElement && s(d.parentElement, p - 1, !1);
    for (let C = d.parentElement; C; C = C.parentElement) if (s(C, p - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, c);
}
function yh(n, l, o = {}) {
  return (typeof l == "string" ? Di(l) : l).some((s) => Rn(n, s, o));
}
function Jd(n, l, o = {}) {
  return Rn(n, l, o);
}
function pl(n, l, o = {}) {
  const c = Di(l), s = [], d = (p) => {
    for (const m of p.children)
      c.some((b) => Rn(m, b, o)) && s.push(m), d(m);
  };
  return d(n), s;
}
function Ld(n, l, o = {}) {
  const c = Di(l);
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
let xh = 1;
class Ho {
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
class Ui {
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
class ne extends $o {
  constructor(l, o = {}, c = null) {
    super(), this.nodeType = 1, this.id = `n${xh++}`, this.tagName = l.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = c, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof ne ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof ne);
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
      const d = l.replace(/-([a-z])/g, (p, m) => m.toUpperCase());
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
    return yh(this, l);
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
    return l ? new Ho(l.x, l.y, l.width, l.height) : new Ho();
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
    const l = this, o = (p) => String(p).startsWith("--") ? String(p) : String(p).replace(/-([a-z])/g, (m, b) => b.toUpperCase()), c = (p) => {
      const m = l.props.style?.[p];
      return m == null || typeof m == "boolean" ? "" : typeof m == "number" && m !== 0 ? `${m}px` : String(m);
    }, s = (p) => l.inline && p in l.inline ? l.inline[p] : c(p), d = (p, m) => {
      const b = m == null ? "" : String(m);
      s(p) !== b && (l.inline ??= {}, b === c(p) ? delete l.inline[p] : l.inline[p] = b, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (p, m) => {
        if (typeof m == "string")
          return m === "setProperty" ? (b, x) => d(o(b), x) : m === "removeProperty" ? (b) => {
            const x = s(o(b));
            return d(o(b), ""), x;
          } : m === "getPropertyValue" ? (b) => s(o(b)) : s(m);
      },
      set: (p, m, b) => (typeof m == "string" && d(m, b), !0)
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
const Wd = Symbol("perch.stale-layout"), wh = 3;
let zi = !1;
function Fd(n) {
  return () => {
    let l, o = !1;
    const c = (s) => {
      const d = zi;
      zi = s < wh;
      try {
        l = n();
      } catch (p) {
        const m = p?.[Wd];
        if (!m) throw p;
        m.retries.push(() => {
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
const Do = "perch-dom:", _h = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), Sh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function ed(n, l = []) {
  const o = new Set(l.map((s) => Sh[s] ?? s)), c = (s) => {
    if (!(s instanceof ne)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [p, m] of Object.entries(s.props))
      _h.has(p) || o.has(p) || m == null || typeof m == "function" || typeof m == "symbol" || (d[p] = m);
    return { t: s.tagName, p: d, c: s.childNodes.map(c), ...s.hidden ? { h: 1 } : {} };
  };
  return Do + JSON.stringify(c(n));
}
function kh(n, l) {
  if (typeof n != "string" || !n.startsWith(Do)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(Do.length));
  } catch {
    return null;
  }
  const c = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!c(d)) throw new Error("not a node");
    let p;
    if (typeof d.x == "string") p = new Ui(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !c(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      p = new ne(d.t, d.p, l);
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
class zh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Eh {
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
  for (let l = n; l instanceof ne; l = l.parentElement) l.touch();
}
class Nh extends $o {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new ne("html", {}, this), this.body = new ne("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new ne(l, {}, this);
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
class Th extends $o {
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
function Id(n) {
  return {
    setTimeout: (l, o = 0, ...c) => n.setTimeout(() => l(...c), Math.max(0, Number(o) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const nd = Symbol.for("perch.react.globals");
function Ze(n, l, o) {
  Object.defineProperty(n, l, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function Ch(n, l = globalThis) {
  const o = new Nh(n), c = new Th(n, o);
  o.defaultView = c;
  const s = n.storage ?? new Eh();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const m = Id(n);
    Ze(l, "setTimeout", m.setTimeout), Ze(l, "clearTimeout", m.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (m) => {
    Promise.resolve().then(m);
  }), Ze(l, "requestAnimationFrame", (m) => l.setTimeout(() => m(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (m) => l.clearTimeout(m));
  const d = { document: o, window: c, localStorage: s, HTMLElement: ne, Element: ne };
  for (const m of Object.keys(d))
    Object.defineProperty(l, m, { get: () => l[nd]?.[m], configurable: !0, enumerable: !1 });
  l[nd] = d, Ze(l, "DOMRect", Ho), Ze(l, "getComputedStyle", jh), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", zh);
  const p = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      Ze(p, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", p), { document: o, window: c, globals: d };
}
function jh(n) {
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
function Uo(n, l = !1) {
  if (!(l ? n?.tagName === "input" && $d(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let c = n.parentElement; c; c = c.parentElement) if (c.tagName === "form") return c;
  return null;
}
const $d = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const ld = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof ld?.setTimeout == "function") {
  const n = Id(ld);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Po(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function Mh(n) {
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
var zo = { exports: {} }, ct = {};
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
function Ah() {
  if (id) return ct;
  id = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), c = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), b = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), C = Symbol.for("react.lazy"), M = Symbol.for("react.activity"), N = Symbol.iterator;
  function v(_) {
    return _ === null || typeof _ != "object" ? null : (_ = N && _[N] || _["@@iterator"], typeof _ == "function" ? _ : null);
  }
  var z = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, w = Object.assign, y = {};
  function O(_, Y, et) {
    this.props = _, this.context = Y, this.refs = y, this.updater = et || z;
  }
  O.prototype.isReactComponent = {}, O.prototype.setState = function(_, Y) {
    if (typeof _ != "object" && typeof _ != "function" && _ != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, _, Y, "setState");
  }, O.prototype.forceUpdate = function(_) {
    this.updater.enqueueForceUpdate(this, _, "forceUpdate");
  };
  function E() {
  }
  E.prototype = O.prototype;
  function j(_, Y, et) {
    this.props = _, this.context = Y, this.refs = y, this.updater = et || z;
  }
  var G = j.prototype = new E();
  G.constructor = j, w(G, O.prototype), G.isPureReactComponent = !0;
  var U = Array.isArray;
  function S() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function D(_, Y, et) {
    var P = et.ref;
    return {
      $$typeof: n,
      type: _,
      key: Y,
      ref: P !== void 0 ? P : null,
      props: et
    };
  }
  function Z(_, Y) {
    return D(_.type, Y, _.props);
  }
  function ot(_) {
    return typeof _ == "object" && _ !== null && _.$$typeof === n;
  }
  function $(_) {
    var Y = { "=": "=0", ":": "=2" };
    return "$" + _.replace(/[=:]/g, function(et) {
      return Y[et];
    });
  }
  var Et = /\/+/g;
  function wt(_, Y) {
    return typeof _ == "object" && _ !== null && _.key != null ? $("" + _.key) : Y.toString(36);
  }
  function jt(_) {
    switch (_.status) {
      case "fulfilled":
        return _.value;
      case "rejected":
        throw _.reason;
      default:
        switch (typeof _.status == "string" ? _.then(S, S) : (_.status = "pending", _.then(
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
  function Q(_, Y, et, P, tt) {
    var lt = typeof _;
    (lt === "undefined" || lt === "boolean") && (_ = null);
    var xt = !1;
    if (_ === null) xt = !0;
    else
      switch (lt) {
        case "bigint":
        case "string":
        case "number":
          xt = !0;
          break;
        case "object":
          switch (_.$$typeof) {
            case n:
            case l:
              xt = !0;
              break;
            case C:
              return xt = _._init, Q(
                xt(_._payload),
                Y,
                et,
                P,
                tt
              );
          }
      }
    if (xt)
      return tt = tt(_), xt = P === "" ? "." + wt(_, 0) : P, U(tt) ? (et = "", xt != null && (et = xt.replace(Et, "$&/") + "/"), Q(tt, Y, et, "", function(Ra) {
        return Ra;
      })) : tt != null && (ot(tt) && (tt = Z(
        tt,
        et + (tt.key == null || _ && _.key === tt.key ? "" : ("" + tt.key).replace(
          Et,
          "$&/"
        ) + "/") + xt
      )), Y.push(tt)), 1;
    xt = 0;
    var Jt = P === "" ? "." : P + ":";
    if (U(_))
      for (var ut = 0; ut < _.length; ut++)
        P = _[ut], lt = Jt + wt(P, ut), xt += Q(
          P,
          Y,
          et,
          lt,
          tt
        );
    else if (ut = v(_), typeof ut == "function")
      for (_ = ut.call(_), ut = 0; !(P = _.next()).done; )
        P = P.value, lt = Jt + wt(P, ut++), xt += Q(
          P,
          Y,
          et,
          lt,
          tt
        );
    else if (lt === "object") {
      if (typeof _.then == "function")
        return Q(
          jt(_),
          Y,
          et,
          P,
          tt
        );
      throw Y = String(_), Error(
        "Objects are not valid as a React child (found: " + (Y === "[object Object]" ? "object with keys {" + Object.keys(_).join(", ") + "}" : Y) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return xt;
  }
  function at(_, Y, et) {
    if (_ == null) return _;
    var P = [], tt = 0;
    return Q(_, P, "", "", function(lt) {
      return Y.call(et, lt, tt++);
    }), P;
  }
  function nt(_) {
    if (_._status === -1) {
      var Y = _._result;
      Y = Y(), Y.then(
        function(et) {
          (_._status === 0 || _._status === -1) && (_._status = 1, _._result = et);
        },
        function(et) {
          (_._status === 0 || _._status === -1) && (_._status = 2, _._result = et);
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
    map: at,
    forEach: function(_, Y, et) {
      at(
        _,
        function() {
          Y.apply(this, arguments);
        },
        et
      );
    },
    count: function(_) {
      var Y = 0;
      return at(_, function() {
        Y++;
      }), Y;
    },
    toArray: function(_) {
      return at(_, function(Y) {
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
  return ct.Activity = M, ct.Children = q, ct.Component = O, ct.Fragment = o, ct.Profiler = s, ct.PureComponent = j, ct.StrictMode = c, ct.Suspense = b, ct.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, ct.__COMPILER_RUNTIME = {
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
  }, ct.cloneElement = function(_, Y, et) {
    if (_ == null)
      throw Error(
        "The argument must be a React element, but you passed " + _ + "."
      );
    var P = w({}, _.props), tt = _.key;
    if (Y != null)
      for (lt in Y.key !== void 0 && (tt = "" + Y.key), Y)
        !h.call(Y, lt) || lt === "key" || lt === "__self" || lt === "__source" || lt === "ref" && Y.ref === void 0 || (P[lt] = Y[lt]);
    var lt = arguments.length - 2;
    if (lt === 1) P.children = et;
    else if (1 < lt) {
      for (var xt = Array(lt), Jt = 0; Jt < lt; Jt++)
        xt[Jt] = arguments[Jt + 2];
      P.children = xt;
    }
    return D(_.type, tt, P);
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
  }, ct.createElement = function(_, Y, et) {
    var P, tt = {}, lt = null;
    if (Y != null)
      for (P in Y.key !== void 0 && (lt = "" + Y.key), Y)
        h.call(Y, P) && P !== "key" && P !== "__self" && P !== "__source" && (tt[P] = Y[P]);
    var xt = arguments.length - 2;
    if (xt === 1) tt.children = et;
    else if (1 < xt) {
      for (var Jt = Array(xt), ut = 0; ut < xt; ut++)
        Jt[ut] = arguments[ut + 2];
      tt.children = Jt;
    }
    if (_ && _.defaultProps)
      for (P in xt = _.defaultProps, xt)
        tt[P] === void 0 && (tt[P] = xt[P]);
    return D(_, lt, tt);
  }, ct.createRef = function() {
    return { current: null };
  }, ct.forwardRef = function(_) {
    return { $$typeof: m, render: _ };
  }, ct.isValidElement = ot, ct.lazy = function(_) {
    return {
      $$typeof: C,
      _payload: { _status: -1, _result: _ },
      _init: nt
    };
  }, ct.memo = function(_, Y) {
    return {
      $$typeof: x,
      type: _,
      compare: Y === void 0 ? null : Y
    };
  }, ct.startTransition = function(_) {
    var Y = g.T, et = {};
    g.T = et;
    try {
      var P = _(), tt = g.S;
      tt !== null && tt(et, P), typeof P == "object" && P !== null && typeof P.then == "function" && P.then(S, B);
    } catch (lt) {
      B(lt);
    } finally {
      Y !== null && et.types !== null && (Y.types = et.types), g.T = Y;
    }
  }, ct.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, ct.use = function(_) {
    return g.H.use(_);
  }, ct.useActionState = function(_, Y, et) {
    return g.H.useActionState(_, Y, et);
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
  }, ct.useImperativeHandle = function(_, Y, et) {
    return g.H.useImperativeHandle(_, Y, et);
  }, ct.useInsertionEffect = function(_, Y) {
    return g.H.useInsertionEffect(_, Y);
  }, ct.useLayoutEffect = function(_, Y) {
    return g.H.useLayoutEffect(_, Y);
  }, ct.useMemo = function(_, Y) {
    return g.H.useMemo(_, Y);
  }, ct.useOptimistic = function(_, Y) {
    return g.H.useOptimistic(_, Y);
  }, ct.useReducer = function(_, Y, et) {
    return g.H.useReducer(_, Y, et);
  }, ct.useRef = function(_) {
    return g.H.useRef(_);
  }, ct.useState = function(_) {
    return g.H.useState(_);
  }, ct.useSyncExternalStore = function(_, Y, et) {
    return g.H.useSyncExternalStore(
      _,
      Y,
      et
    );
  }, ct.useTransition = function() {
    return g.H.useTransition();
  }, ct.version = "19.2.8", ct;
}
var rd;
function Oh() {
  return rd || (rd = 1, zo.exports = Ah()), zo.exports;
}
var mt = Oh();
const Pd = /* @__PURE__ */ Po(mt), Rh = /* @__PURE__ */ Wo({
  __proto__: null,
  default: Pd
}, [mt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const Hh = Pd ?? Rh;
function ua(n, l) {
  return mt.useEffect(Fd(n), l);
}
function Bo(n, l) {
  return mt.useLayoutEffect(Fd(n), l);
}
const Dh = /* @__PURE__ */ Wo({
  __proto__: null,
  default: Hh,
  useEffect: ua,
  useLayoutEffect: Bo
}, [mt]);
var Eo = { exports: {} }, dl = {};
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
function Uh() {
  if (od) return dl;
  od = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
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
  return dl.Fragment = l, dl.jsx = o, dl.jsxs = o, dl;
}
var sd;
function Bh() {
  return sd || (sd = 1, Eo.exports = Uh()), Eo.exports;
}
var zt = Bh();
const qh = /* @__PURE__ */ Po(zt), qv = /* @__PURE__ */ Wo({
  __proto__: null,
  default: qh
}, [zt]);
var No = { exports: {} }, To = { exports: {} };
const Yh = /* @__PURE__ */ Mh(Dh);
var Co = { exports: {} }, jo = {};
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
function Gh() {
  return cd || (cd = 1, (function(n) {
    function l(Q, at) {
      var nt = Q.length;
      Q.push(at);
      t: for (; 0 < nt; ) {
        var B = nt - 1 >>> 1, q = Q[B];
        if (0 < s(q, at))
          Q[B] = at, Q[nt] = q, nt = B;
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
        t: for (var B = 0, q = Q.length, _ = q >>> 1; B < _; ) {
          var Y = 2 * (B + 1) - 1, et = Q[Y], P = Y + 1, tt = Q[P];
          if (0 > s(et, nt))
            P < q && 0 > s(tt, et) ? (Q[B] = tt, Q[P] = nt, B = P) : (Q[B] = et, Q[Y] = nt, B = Y);
          else if (P < q && 0 > s(tt, nt))
            Q[B] = tt, Q[P] = nt, B = P;
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
    var b = [], x = [], C = 1, M = null, N = 3, v = !1, z = !1, w = !1, y = !1, O = typeof setTimeout == "function" ? setTimeout : null, E = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
    function G(Q) {
      for (var at = o(x); at !== null; ) {
        if (at.callback === null) c(x);
        else if (at.startTime <= Q)
          c(x), at.sortIndex = at.expirationTime, l(b, at);
        else break;
        at = o(x);
      }
    }
    function U(Q) {
      if (w = !1, G(Q), !z)
        if (o(b) !== null)
          z = !0, S || (S = !0, $());
        else {
          var at = o(x);
          at !== null && jt(U, at.startTime - Q);
        }
    }
    var S = !1, g = -1, h = 5, D = -1;
    function Z() {
      return y ? !0 : !(n.unstable_now() - D < h);
    }
    function ot() {
      if (y = !1, S) {
        var Q = n.unstable_now();
        D = Q;
        var at = !0;
        try {
          t: {
            z = !1, w && (w = !1, E(g), g = -1), v = !0;
            var nt = N;
            try {
              e: {
                for (G(Q), M = o(b); M !== null && !(M.expirationTime > Q && Z()); ) {
                  var B = M.callback;
                  if (typeof B == "function") {
                    M.callback = null, N = M.priorityLevel;
                    var q = B(
                      M.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof q == "function") {
                      M.callback = q, G(Q), at = !0;
                      break e;
                    }
                    M === o(b) && c(b), G(Q);
                  } else c(b);
                  M = o(b);
                }
                if (M !== null) at = !0;
                else {
                  var _ = o(x);
                  _ !== null && jt(
                    U,
                    _.startTime - Q
                  ), at = !1;
                }
              }
              break t;
            } finally {
              M = null, N = nt, v = !1;
            }
            at = void 0;
          }
        } finally {
          at ? $() : S = !1;
        }
      }
    }
    var $;
    if (typeof j == "function")
      $ = function() {
        j(ot);
      };
    else if (typeof MessageChannel < "u") {
      var Et = new MessageChannel(), wt = Et.port2;
      Et.port1.onmessage = ot, $ = function() {
        wt.postMessage(null);
      };
    } else
      $ = function() {
        O(ot, 0);
      };
    function jt(Q, at) {
      g = O(function() {
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
      return N;
    }, n.unstable_next = function(Q) {
      switch (N) {
        case 1:
        case 2:
        case 3:
          var at = 3;
          break;
        default:
          at = N;
      }
      var nt = N;
      N = at;
      try {
        return Q();
      } finally {
        N = nt;
      }
    }, n.unstable_requestPaint = function() {
      y = !0;
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
      var nt = N;
      N = Q;
      try {
        return at();
      } finally {
        N = nt;
      }
    }, n.unstable_scheduleCallback = function(Q, at, nt) {
      var B = n.unstable_now();
      switch (typeof nt == "object" && nt !== null ? (nt = nt.delay, nt = typeof nt == "number" && 0 < nt ? B + nt : B) : nt = B, Q) {
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
        id: C++,
        callback: at,
        priorityLevel: Q,
        startTime: nt,
        expirationTime: q,
        sortIndex: -1
      }, nt > B ? (Q.sortIndex = nt, l(x, Q), o(b) === null && Q === o(x) && (w ? (E(g), g = -1) : w = !0, jt(U, nt - B))) : (Q.sortIndex = q, l(b, Q), z || v || (z = !0, S || (S = !0, $()))), Q;
    }, n.unstable_shouldYield = Z, n.unstable_wrapCallback = function(Q) {
      var at = N;
      return function() {
        var nt = N;
        N = at;
        try {
          return Q.apply(this, arguments);
        } finally {
          N = nt;
        }
      };
    };
  })(jo)), jo;
}
var ud;
function Kh() {
  return ud || (ud = 1, Co.exports = Gh()), Co.exports;
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
function Qh() {
  return dd || (dd = 1, (function(n) {
    n.exports = function(l) {
      function o(t, e, a, i) {
        return new bm(t, e, a, i);
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
            for (var f = !1, k = r.child; k; ) {
              if (k === a) {
                f = !0, a = r, i = u;
                break;
              }
              if (k === i) {
                f = !0, i = r, a = u;
                break;
              }
              k = k.sibling;
            }
            if (!f) {
              for (k = u.child; k; ) {
                if (k === a) {
                  f = !0, a = u, i = r;
                  break;
                }
                if (k === i) {
                  f = !0, i = u, a = r;
                  break;
                }
                k = k.sibling;
              }
              if (!f) throw Error(s(189));
            }
          }
          if (a.alternate !== i) throw Error(s(190));
        }
        if (a.tag !== 3) throw Error(s(188));
        return a.stateNode.current === a ? t : e;
      }
      function b(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = b(t), e !== null) return e;
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
      function C(t) {
        return t === null || typeof t != "object" ? null : (t = yu && t[yu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function M(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === _m ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case mn:
            return "Fragment";
          case Vr:
            return "Profiler";
          case bu:
            return "StrictMode";
          case Zr:
            return "Suspense";
          case Jr:
            return "SuspenseList";
          case Wr:
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
            case Xr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Lr:
              return e = t.displayName || null, e !== null ? e : M(t.type) || "Memo";
            case xa:
              e = t._payload, t = t._init;
              try {
                return M(t(e));
              } catch {
              }
          }
        return null;
      }
      function N(t) {
        return { current: t };
      }
      function v(t) {
        0 > gn || (t.current = eo[gn], eo[gn] = null, gn--);
      }
      function z(t, e) {
        gn++, eo[gn] = t.current, t.current = e;
      }
      function w(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Fp(t) / Ip | 0) | 0;
      }
      function y(t) {
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
      function O(t, e, a) {
        var i = t.pendingLanes;
        if (i === 0) return 0;
        var r = 0, u = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var k = i & 134217727;
        return k !== 0 ? (i = k & ~u, i !== 0 ? r = y(i) : (f &= k, f !== 0 ? r = y(f) : a || (a = k & ~t, a !== 0 && (r = y(a))))) : (k = i & ~u, k !== 0 ? r = y(k) : f !== 0 ? r = y(f) : a || (a = i & ~t, a !== 0 && (r = y(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function E(t, e) {
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
      function G() {
        var t = Fl;
        return Fl <<= 1, (Fl & 62914560) === 0 && (Fl = 4194304), t;
      }
      function U(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function S(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, a, i, r, u) {
        var f = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var k = t.entanglements, H = t.expirationTimes, K = t.hiddenUpdates;
        for (a = f & ~a; 0 < a; ) {
          var J = 31 - be(a), V = 1 << J;
          k[J] = 0, H[J] = -1;
          var L = K[J];
          if (L !== null)
            for (K[J] = null, J = 0; J < L.length; J++) {
              var dt = L[J];
              dt !== null && (dt.lane &= -536870913);
            }
          a &= ~V;
        }
        i !== 0 && h(t, i, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(f & ~e));
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
        if (typeof ah == "function" && nh(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode(Pn, t);
          } catch {
          }
      }
      function wt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function jt(t) {
        if (lo === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            lo = e && e[1] || "", Xu = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + lo + t + Xu;
      }
      function Q(t, e) {
        if (!t || io) return "";
        io = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var i = {
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
          var u = i.DetermineComponentFrameRoot(), f = u[0], k = u[1];
          if (f && k) {
            var H = f.split(`
`), K = k.split(`
`);
            for (r = i = 0; i < H.length && !H[i].includes("DetermineComponentFrameRoot"); )
              i++;
            for (; r < K.length && !K[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (i === H.length || r === K.length)
              for (i = H.length - 1, r = K.length - 1; 1 <= i && 0 <= r && H[i] !== K[r]; )
                r--;
            for (; 1 <= i && 0 <= r; i--, r--)
              if (H[i] !== K[r]) {
                if (i !== 1 || r !== 1)
                  do
                    if (i--, r--, 0 > r || H[i] !== K[r]) {
                      var J = `
` + H[i].replace(" at new ", " at ");
                      return t.displayName && J.includes("<anonymous>") && (J = J.replace("<anonymous>", t.displayName)), J;
                    }
                  while (1 <= i && 0 <= r);
                break;
              }
          }
        } finally {
          io = !1, Error.prepareStackTrace = a;
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
            stack: nt(e)
          }, Zu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: nt(e)
        };
      }
      function q(t, e) {
        vn[yn++] = tl, vn[yn++] = $l, $l = t, tl = e;
      }
      function _(t, e, a) {
        Ee[Ne++] = Ve, Ee[Ne++] = Xe, Ee[Ne++] = wa, wa = t;
        var i = Ve;
        t = Xe;
        var r = 32 - be(i) - 1;
        i &= ~(1 << r), a += 1;
        var u = 32 - be(e) + r;
        if (30 < u) {
          var f = r - r % 5;
          u = (i & (1 << f) - 1).toString(32), i >>= f, r -= f, Ve = 1 << 32 - be(e) + r | a << r | i, Xe = u + t;
        } else
          Ve = 1 << u | a << r | i, Xe = t;
      }
      function Y(t) {
        t.return !== null && (q(t, 1), _(t, 1, 0));
      }
      function et(t) {
        for (; t === $l; )
          $l = vn[--yn], vn[yn] = null, tl = vn[--yn], vn[yn] = null;
        for (; t === wa; )
          wa = Ee[--Ne], Ee[Ne] = null, Xe = Ee[--Ne], Ee[Ne] = null, Ve = Ee[--Ne], Ee[Ne] = null;
      }
      function P(t, e) {
        Ee[Ne++] = Ve, Ee[Ne++] = Xe, Ee[Ne++] = wa, Ve = e.id, Xe = e.overflow, wa = t;
      }
      function tt(t, e) {
        z(_a, e), z(el, t), z(Pt, null), t = zm(e), v(Pt), z(Pt, t);
      }
      function lt() {
        v(Pt), v(el), v(_a);
      }
      function xt(t) {
        t.memoizedState !== null && z(Pl, t);
        var e = Pt.current, a = Em(e, t.type);
        e !== a && (z(el, t), z(Pt, a));
      }
      function Jt(t) {
        el.current === t && (v(Pt), v(el)), Pl.current === t && (v(Pl), ta ? Va._currentValue = pn : Va._currentValue2 = pn);
      }
      function ut(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Hn(B(e, t)), ro;
      }
      function Ra(t, e) {
        if (!re) throw Error(s(175));
        Ep(
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
              Te = !1;
              return;
            case 27:
            case 3:
              Te = !0;
              return;
            default:
              te = te.return;
          }
      }
      function Oe(t) {
        if (!re || t !== te) return !1;
        if (!yt) return Ha(t), yt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Au(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ut(t) : e !== 3 && (e !== 5 || Au(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ut(t), Ha(t), e === 13) {
          if (!re) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Mp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = jp(t);
        } else
          Ot = Vt && e === 27 ? gp(
            t.type,
            Ot
          ) : te ? Mu(t.stateNode) : null;
        return !0;
      }
      function Re() {
        re && (Ot = te = null, yt = !1);
      }
      function da() {
        var t = Sa;
        return t !== null && (fe === null ? fe = t : fe.push.apply(
          fe,
          t
        ), Sa = null), t;
      }
      function Hn(t) {
        Sa === null ? Sa = [t] : Sa.push(t);
      }
      function fa(t, e, a) {
        ta ? (z(ti, e._currentValue), e._currentValue = a) : (z(ti, e._currentValue2), e._currentValue2 = a);
      }
      function Le(t) {
        var e = ti.current;
        ta ? t._currentValue = e : t._currentValue2 = e, v(ti);
      }
      function Gi(t, e, a) {
        for (; t !== null; ) {
          var i = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, i !== null && (i.childLanes |= e)) : i !== null && (i.childLanes & e) !== e && (i.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Ki(t, e, a, i) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var f = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var k = u;
              u = r;
              for (var H = 0; H < e.length; H++)
                if (k.context === e[H]) {
                  u.lanes |= a, k = u.alternate, k !== null && (k.lanes |= a), Gi(
                    u.return,
                    a,
                    t
                  ), i || (f = null);
                  break t;
                }
              u = k.next;
            }
          } else if (r.tag === 18) {
            if (f = r.return, f === null) throw Error(s(341));
            f.lanes |= a, u = f.alternate, u !== null && (u.lanes |= a), Gi(f, a, t), f = null;
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
      function rn(t, e, a, i) {
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
              var k = r.type;
              ye(r.pendingProps.value, f.value) || (t !== null ? t.push(k) : t = [k]);
            }
          } else if (r === Pl.current) {
            if (f = r.alternate, f === null) throw Error(s(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Va) : t = [Va]);
          }
          r = r.return;
        }
        t !== null && Ki(
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
        return is(Xa, t);
      }
      function bl(t, e) {
        return Xa === null && Da(t), is(t, e);
      }
      function is(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(s(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function Qi() {
        return {
          controller: new ih(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Dn(t) {
        t.refCount--, t.refCount === 0 && rh(oh, function() {
          t.controller.abort();
        });
      }
      function vl() {
      }
      function Ge(t) {
        t !== xn && t.next === null && (xn === null ? ei = xn = t : xn = xn.next = t), ai = !0, oo || (oo = !0, Jf());
      }
      function on(t, e) {
        if (!so && ai) {
          so = !0;
          do
            for (var a = !1, i = ei; i !== null; ) {
              if (t !== 0) {
                var r = i.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var f = i.suspendedLanes, k = i.pingedLanes;
                  u = (1 << 31 - be(42 | t) + 1) - 1, u &= r & ~(f & ~k), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, us(i, u));
              } else
                u = vt, u = O(
                  i,
                  i === Mt ? u : 0,
                  i.cancelPendingCommit !== null || i.timeoutHandle !== Qa
                ), (u & 3) === 0 || E(i, u) || (a = !0, us(i, u));
              i = i.next;
            }
          while (a);
          so = !1;
        }
      }
      function rs() {
        os();
      }
      function os() {
        ai = oo = !1;
        var t = 0;
        Za !== 0 && Hm() && (t = Za);
        for (var e = ue(), a = null, i = ei; i !== null; ) {
          var r = i.next, u = ss(i, e);
          u === 0 ? (i.next = null, a === null ? ei = r : a.next = r, r === null && (xn = a)) : (a = i, (t !== 0 || (u & 3) !== 0) && (ai = !0)), i = r;
        }
        Xt !== 0 && Xt !== 5 || on(t), Za !== 0 && (Za = 0);
      }
      function ss(t, e) {
        for (var a = t.suspendedLanes, i = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var f = 31 - be(u), k = 1 << f, H = r[f];
          H === -1 ? ((k & a) === 0 || (k & i) !== 0) && (r[f] = j(k, e)) : H <= e && (t.expiredLanes |= k), u &= ~k;
        }
        if (e = Mt, a = vt, a = O(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), i = t.callbackNode, a === 0 || t === e && (Tt === 2 || Tt === 9) || t.cancelPendingCommit !== null)
          return i !== null && i !== null && ao(i), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || E(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (i !== null && ao(i), $(a)) {
            case 2:
            case 8:
              a = th;
              break;
            case 32:
              a = no;
              break;
            case 268435456:
              a = eh;
              break;
            default:
              a = no;
          }
          return i = cs.bind(null, t), a = Il(a, i), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return i !== null && i !== null && ao(i), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function cs(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Wn() && t.callbackNode !== a)
          return null;
        var i = vt;
        return i = O(
          t,
          t === Mt ? i : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), i === 0 ? null : (Zc(t, i, e), ss(t, ue()), t.callbackNode != null && t.callbackNode === a ? cs.bind(null, t) : null);
      }
      function us(t, e) {
        if (Wn()) return null;
        Zc(t, e, !0);
      }
      function Jf() {
        Km ? Qm(function() {
          (gt & 6) !== 0 ? Il(
            Qu,
            rs
          ) : os();
        }) : Il(
          Qu,
          rs
        );
      }
      function Vi() {
        if (Za === 0) {
          var t = wn;
          t === 0 && (t = Ll, Ll <<= 1, (Ll & 261888) === 0 && (Ll = 256)), Za = t;
        }
        return Za;
      }
      function Lf(t, e) {
        if (al === null) {
          var a = al = [];
          co = 0, wn = Vi(), _n = {
            status: "pending",
            value: void 0,
            then: function(i) {
              a.push(i);
            }
          };
        }
        return co++, e.then(ds, ds), e;
      }
      function ds() {
        if (--co === 0 && al !== null) {
          _n !== null && (_n.status = "fulfilled");
          var t = al;
          al = null, wn = 0, _n = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Wf(t, e) {
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
      function Xi() {
        var t = Ja.current;
        return t !== null ? t : Mt.pooledCache;
      }
      function yl(t, e) {
        e === null ? z(Ja, Ja.current) : z(Ja, e.pool);
      }
      function fs() {
        var t = Xi();
        return t === null ? null : {
          parent: ta ? Rt._currentValue : Rt._currentValue2,
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
          if (!lh.call(e, r) || !ye(t[r], e[r]))
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
            throw La = e, Sn;
        }
      }
      function Ua(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (La = a, Sn) : a;
        }
      }
      function hs() {
        if (La === null) throw Error(s(459));
        var t = La;
        return La = null, t;
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
        throw e.$$typeof === xm ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function bs(t) {
        function e(A, T) {
          if (t) {
            var R = A.deletions;
            R === null ? (A.deletions = [T], A.flags |= 16) : R.push(T);
          }
        }
        function a(A, T) {
          if (!t) return null;
          for (; T !== null; )
            e(A, T), T = T.sibling;
          return null;
        }
        function i(A) {
          for (var T = /* @__PURE__ */ new Map(); A !== null; )
            A.key !== null ? T.set(A.key, A) : T.set(A.index, A), A = A.sibling;
          return T;
        }
        function r(A, T) {
          return A = Pe(A, T), A.index = 0, A.sibling = null, A;
        }
        function u(A, T, R) {
          return A.index = R, t ? (R = A.alternate, R !== null ? (R = R.index, R < T ? (A.flags |= 67108866, T) : R) : (A.flags |= 67108866, T)) : (A.flags |= 1048576, T);
        }
        function f(A) {
          return t && A.alternate === null && (A.flags |= 67108866), A;
        }
        function k(A, T, R, X) {
          return T === null || T.tag !== 6 ? (T = Yr(R, A.mode, X), T.return = A, T) : (T = r(T, R), T.return = A, T);
        }
        function H(A, T, R, X) {
          var rt = R.type;
          return rt === mn ? J(
            A,
            T,
            R.props.children,
            X,
            R.key
          ) : T !== null && (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === xa && Ua(rt) === T.type) ? (T = r(T, R.props), Un(T, R), T.return = A, T) : (T = Vl(
            R.type,
            R.key,
            R.props,
            null,
            A.mode,
            X
          ), Un(T, R), T.return = A, T);
        }
        function K(A, T, R, X) {
          return T === null || T.tag !== 4 || T.stateNode.containerInfo !== R.containerInfo || T.stateNode.implementation !== R.implementation ? (T = Gr(R, A.mode, X), T.return = A, T) : (T = r(T, R.children || []), T.return = A, T);
        }
        function J(A, T, R, X, rt) {
          return T === null || T.tag !== 7 ? (T = Ka(
            R,
            A.mode,
            X,
            rt
          ), T.return = A, T) : (T = r(T, R), T.return = A, T);
        }
        function V(A, T, R) {
          if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
            return T = Yr(
              "" + T,
              A.mode,
              R
            ), T.return = A, T;
          if (typeof T == "object" && T !== null) {
            switch (T.$$typeof) {
              case Xl:
                return R = Vl(
                  T.type,
                  T.key,
                  T.props,
                  null,
                  A.mode,
                  R
                ), Un(R, T), R.return = A, R;
              case fn:
                return T = Gr(
                  T,
                  A.mode,
                  R
                ), T.return = A, T;
              case xa:
                return T = Ua(T), V(A, T, R);
            }
            if (Zl(T) || C(T))
              return T = Ka(
                T,
                A.mode,
                R,
                null
              ), T.return = A, T;
            if (typeof T.then == "function")
              return V(A, wl(T), R);
            if (T.$$typeof === ya)
              return V(
                A,
                bl(A, T),
                R
              );
            _l(A, T);
          }
          return null;
        }
        function L(A, T, R, X) {
          var rt = T !== null ? T.key : null;
          if (typeof R == "string" && R !== "" || typeof R == "number" || typeof R == "bigint")
            return rt !== null ? null : k(A, T, "" + R, X);
          if (typeof R == "object" && R !== null) {
            switch (R.$$typeof) {
              case Xl:
                return R.key === rt ? H(A, T, R, X) : null;
              case fn:
                return R.key === rt ? K(A, T, R, X) : null;
              case xa:
                return R = Ua(R), L(A, T, R, X);
            }
            if (Zl(R) || C(R))
              return rt !== null ? null : J(A, T, R, X, null);
            if (typeof R.then == "function")
              return L(
                A,
                T,
                wl(R),
                X
              );
            if (R.$$typeof === ya)
              return L(
                A,
                T,
                bl(A, R),
                X
              );
            _l(A, R);
          }
          return null;
        }
        function dt(A, T, R, X, rt) {
          if (typeof X == "string" && X !== "" || typeof X == "number" || typeof X == "bigint")
            return A = A.get(R) || null, k(T, A, "" + X, rt);
          if (typeof X == "object" && X !== null) {
            switch (X.$$typeof) {
              case Xl:
                return A = A.get(
                  X.key === null ? R : X.key
                ) || null, H(T, A, X, rt);
              case fn:
                return A = A.get(
                  X.key === null ? R : X.key
                ) || null, K(T, A, X, rt);
              case xa:
                return X = Ua(X), dt(
                  A,
                  T,
                  R,
                  X,
                  rt
                );
            }
            if (Zl(X) || C(X))
              return A = A.get(R) || null, J(T, A, X, rt, null);
            if (typeof X.then == "function")
              return dt(
                A,
                T,
                R,
                wl(X),
                rt
              );
            if (X.$$typeof === ya)
              return dt(
                A,
                T,
                R,
                bl(T, X),
                rt
              );
            _l(T, X);
          }
          return null;
        }
        function ee(A, T, R, X) {
          for (var rt = null, Ht = null, st = T, St = T = 0, Ft = null; st !== null && St < R.length; St++) {
            st.index > St ? (Ft = st, st = null) : Ft = st.sibling;
            var kt = L(
              A,
              st,
              R[St],
              X
            );
            if (kt === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && kt.alternate === null && e(A, st), T = u(kt, T, St), Ht === null ? rt = kt : Ht.sibling = kt, Ht = kt, st = Ft;
          }
          if (St === R.length)
            return a(A, st), yt && q(A, St), rt;
          if (st === null) {
            for (; St < R.length; St++)
              st = V(A, R[St], X), st !== null && (T = u(
                st,
                T,
                St
              ), Ht === null ? rt = st : Ht.sibling = st, Ht = st);
            return yt && q(A, St), rt;
          }
          for (st = i(st); St < R.length; St++)
            Ft = dt(
              st,
              A,
              St,
              R[St],
              X
            ), Ft !== null && (t && Ft.alternate !== null && st.delete(
              Ft.key === null ? St : Ft.key
            ), T = u(
              Ft,
              T,
              St
            ), Ht === null ? rt = Ft : Ht.sibling = Ft, Ht = Ft);
          return t && st.forEach(function(Ca) {
            return e(A, Ca);
          }), yt && q(A, St), rt;
        }
        function ul(A, T, R, X) {
          if (R == null) throw Error(s(151));
          for (var rt = null, Ht = null, st = T, St = T = 0, Ft = null, kt = R.next(); st !== null && !kt.done; St++, kt = R.next()) {
            st.index > St ? (Ft = st, st = null) : Ft = st.sibling;
            var Ca = L(A, st, kt.value, X);
            if (Ca === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Ca.alternate === null && e(A, st), T = u(Ca, T, St), Ht === null ? rt = Ca : Ht.sibling = Ca, Ht = Ca, st = Ft;
          }
          if (kt.done)
            return a(A, st), yt && q(A, St), rt;
          if (st === null) {
            for (; !kt.done; St++, kt = R.next())
              kt = V(A, kt.value, X), kt !== null && (T = u(
                kt,
                T,
                St
              ), Ht === null ? rt = kt : Ht.sibling = kt, Ht = kt);
            return yt && q(A, St), rt;
          }
          for (st = i(st); !kt.done; St++, kt = R.next())
            kt = dt(
              st,
              A,
              St,
              kt.value,
              X
            ), kt !== null && (t && kt.alternate !== null && st.delete(kt.key === null ? St : kt.key), T = u(kt, T, St), Ht === null ? rt = kt : Ht.sibling = kt, Ht = kt);
          return t && st.forEach(function(dh) {
            return e(A, dh);
          }), yt && q(A, St), rt;
        }
        function $a(A, T, R, X) {
          if (typeof R == "object" && R !== null && R.type === mn && R.key === null && (R = R.props.children), typeof R == "object" && R !== null) {
            switch (R.$$typeof) {
              case Xl:
                t: {
                  for (var rt = R.key; T !== null; ) {
                    if (T.key === rt) {
                      if (rt = R.type, rt === mn) {
                        if (T.tag === 7) {
                          a(
                            A,
                            T.sibling
                          ), X = r(
                            T,
                            R.props.children
                          ), X.return = A, A = X;
                          break t;
                        }
                      } else if (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === xa && Ua(rt) === T.type) {
                        a(
                          A,
                          T.sibling
                        ), X = r(T, R.props), Un(X, R), X.return = A, A = X;
                        break t;
                      }
                      a(A, T);
                      break;
                    } else e(A, T);
                    T = T.sibling;
                  }
                  R.type === mn ? (X = Ka(
                    R.props.children,
                    A.mode,
                    X,
                    R.key
                  ), X.return = A, A = X) : (X = Vl(
                    R.type,
                    R.key,
                    R.props,
                    null,
                    A.mode,
                    X
                  ), Un(X, R), X.return = A, A = X);
                }
                return f(A);
              case fn:
                t: {
                  for (rt = R.key; T !== null; ) {
                    if (T.key === rt)
                      if (T.tag === 4 && T.stateNode.containerInfo === R.containerInfo && T.stateNode.implementation === R.implementation) {
                        a(
                          A,
                          T.sibling
                        ), X = r(
                          T,
                          R.children || []
                        ), X.return = A, A = X;
                        break t;
                      } else {
                        a(A, T);
                        break;
                      }
                    else e(A, T);
                    T = T.sibling;
                  }
                  X = Gr(R, A.mode, X), X.return = A, A = X;
                }
                return f(A);
              case xa:
                return R = Ua(R), $a(
                  A,
                  T,
                  R,
                  X
                );
            }
            if (Zl(R))
              return ee(
                A,
                T,
                R,
                X
              );
            if (C(R)) {
              if (rt = C(R), typeof rt != "function")
                throw Error(s(150));
              return R = rt.call(R), ul(
                A,
                T,
                R,
                X
              );
            }
            if (typeof R.then == "function")
              return $a(
                A,
                T,
                wl(R),
                X
              );
            if (R.$$typeof === ya)
              return $a(
                A,
                T,
                bl(A, R),
                X
              );
            _l(A, R);
          }
          return typeof R == "string" && R !== "" || typeof R == "number" || typeof R == "bigint" ? (R = "" + R, T !== null && T.tag === 6 ? (a(A, T.sibling), X = r(T, R), X.return = A, A = X) : (a(A, T), X = Yr(R, A.mode, X), X.return = A, A = X), f(A)) : a(A, T);
        }
        return function(A, T, R, X) {
          try {
            nl = 0;
            var rt = $a(
              A,
              T,
              R,
              X
            );
            return kn = null, rt;
          } catch (st) {
            if (st === Sn || st === ni) throw st;
            var Ht = o(29, st, null, A.mode);
            return Ht.lanes = X, Ht.return = A, Ht;
          } finally {
          }
        };
      }
      function Sl() {
        for (var t = zn, e = fo = zn = 0; e < t; ) {
          var a = Ce[e];
          Ce[e++] = null;
          var i = Ce[e];
          Ce[e++] = null;
          var r = Ce[e];
          Ce[e++] = null;
          var u = Ce[e];
          if (Ce[e++] = null, i !== null && r !== null) {
            var f = i.pending;
            f === null ? r.next = r : (r.next = f.next, f.next = r), i.pending = r;
          }
          u !== 0 && vs(a, r, u);
        }
      }
      function kl(t, e, a, i) {
        Ce[zn++] = t, Ce[zn++] = e, Ce[zn++] = a, Ce[zn++] = i, fo |= i, t.lanes |= i, t = t.alternate, t !== null && (t.lanes |= i);
      }
      function Zi(t, e, a, i) {
        return kl(t, e, a, i), zl(t);
      }
      function Ba(t, e) {
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
          throw cl = 0, ko = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Ji(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Li(t, e) {
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
        if (i = i.shared, (gt & 2) !== 0) {
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
      function Wi(t, e) {
        var a = t.updateQueue, i = t.alternate;
        if (i !== null && (i = i.updateQueue, a === i)) {
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
        if (mo) {
          var t = _n;
          if (t !== null) throw t;
        }
      }
      function Yn(t, e, a, i) {
        mo = !1;
        var r = t.updateQueue;
        ka = !1;
        var u = r.firstBaseUpdate, f = r.lastBaseUpdate, k = r.shared.pending;
        if (k !== null) {
          r.shared.pending = null;
          var H = k, K = H.next;
          H.next = null, f === null ? u = K : f.next = K, f = H;
          var J = t.alternate;
          J !== null && (J = J.updateQueue, k = J.lastBaseUpdate, k !== f && (k === null ? J.firstBaseUpdate = K : k.next = K, J.lastBaseUpdate = H));
        }
        if (u !== null) {
          var V = r.baseState;
          f = 0, J = K = H = null, k = u;
          do {
            var L = k.lane & -536870913, dt = L !== k.lane;
            if (dt ? (vt & L) === L : (i & L) === L) {
              L !== 0 && L === wn && (mo = !0), J !== null && (J = J.next = {
                lane: 0,
                tag: k.tag,
                payload: k.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, ul = k;
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
                    V = Qr({}, V, L);
                    break t;
                  case 2:
                    ka = !0;
                }
              }
              L = k.callback, L !== null && (t.flags |= 64, dt && (t.flags |= 8192), dt = r.callbacks, dt === null ? r.callbacks = [L] : dt.push(L));
            } else
              dt = {
                lane: L,
                tag: k.tag,
                payload: k.payload,
                callback: k.callback,
                next: null
              }, J === null ? (K = J = dt, H = V) : J = J.next = dt, f |= L;
            if (k = k.next, k === null) {
              if (k = r.shared.pending, k === null)
                break;
              dt = k, k = dt.next, dt.next = null, r.lastBaseUpdate = dt, r.shared.pending = null;
            }
          } while (!0);
          J === null && (H = V), r.baseState = H, r.firstBaseUpdate = K, r.lastBaseUpdate = J, u === null && (r.shared.lanes = 0), Ea |= f, t.lanes = f, t.memoizedState = V;
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
        t = ia, z(ii, t), z(En, e), ia = t | e.baseLanes;
      }
      function Fi() {
        z(ii, ia), z(En, En.current);
      }
      function Ii() {
        ia = ii.current, v(En), v(ii);
      }
      function ha(t) {
        var e = t.alternate;
        z(qt, qt.current & 1), z(xe, t), je === null && (e === null || En.current !== null || e.memoizedState !== null) && (je = t);
      }
      function $i(t) {
        z(qt, qt.current), z(xe, t), je === null && (je = t);
      }
      function _s(t) {
        t.tag === 22 ? (z(qt, qt.current), z(xe, t), je === null && (je = t)) : ga();
      }
      function ga() {
        z(qt, qt.current), z(xe, xe.current);
      }
      function pe(t) {
        v(xe), je === t && (je = null), v(qt);
      }
      function El(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || $r(a) || Pr(a)))
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
      function Pi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ye(t[a], e[a])) return !1;
        return !0;
      }
      function tr(t, e, a, i, r, u) {
        return na = u, ft = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, it.H = t === null || t.memoizedState === null ? Wu : po, Fa = !1, u = a(i, r), Fa = !1, Nn && (u = ks(
          e,
          a,
          i,
          r
        )), Ss(t), u;
      }
      function Ss(t) {
        it.H = il;
        var e = Ct !== null && Ct.next !== null;
        if (na = 0, Yt = Ct = ft = null, ri = !1, ll = 0, Tn = null, e) throw Error(s(300));
        t === null || Gt || (t = t.dependencies, t !== null && gl(t) && (Gt = !0));
      }
      function ks(t, e, a, i) {
        ft = t;
        var r = 0;
        do {
          if (Nn && (Tn = null), ll = 0, Nn = !1, 25 <= r) throw Error(s(301));
          if (r += 1, Yt = Ct = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          it.H = Fu, u = e(a, i);
        } while (Nn);
        return u;
      }
      function Ff() {
        var t = it.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Gn(e) : e, t = t.useState()[0], (Ct !== null ? Ct.memoizedState : null) !== t && (ft.flags |= 1024), e;
      }
      function er() {
        var t = oi !== 0;
        return oi = 0, t;
      }
      function ar(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function nr(t) {
        if (ri) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ri = !1;
        }
        na = 0, Yt = Ct = ft = null, Nn = !1, ll = oi = 0, Tn = null;
      }
      function oe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Yt === null ? ft.memoizedState = Yt = t : Yt = Yt.next = t, Yt;
      }
      function Bt() {
        if (Ct === null) {
          var t = ft.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Ct.next;
        var e = Yt === null ? ft.memoizedState : Yt.next;
        if (e !== null)
          Yt = e, Ct = t;
        else {
          if (t === null)
            throw ft.alternate === null ? Error(s(467)) : Error(s(310));
          Ct = t, t = {
            memoizedState: Ct.memoizedState,
            baseState: Ct.baseState,
            baseQueue: Ct.baseQueue,
            queue: Ct.queue,
            next: null
          }, Yt === null ? ft.memoizedState = Yt = t : Yt = Yt.next = t;
        }
        return Yt;
      }
      function Nl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Gn(t) {
        var e = ll;
        return ll += 1, Tn === null && (Tn = []), t = ps(Tn, t, e), e = ft, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, it.H = e === null || e.memoizedState === null ? Wu : po), t;
      }
      function Tl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Gn(t);
          if (t.$$typeof === ya) return It(t);
        }
        throw Error(s(438, String(t)));
      }
      function lr(t) {
        var e = null, a = ft.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var i = ft.alternate;
          i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (e = {
            data: i.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Nl(), ft.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), i = 0; i < t; i++)
            a[i] = wm;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Cl(t) {
        var e = Bt();
        return ir(e, Ct, t);
      }
      function ir(t, e, a) {
        var i = t.queue;
        if (i === null) throw Error(s(311));
        i.lastRenderedReducer = a;
        var r = t.baseQueue, u = i.pending;
        if (u !== null) {
          if (r !== null) {
            var f = r.next;
            r.next = u.next, u.next = f;
          }
          e.baseQueue = r = u, i.pending = null;
        }
        if (u = t.baseState, r === null) t.memoizedState = u;
        else {
          e = r.next;
          var k = f = null, H = null, K = e, J = !1;
          do {
            var V = K.lane & -536870913;
            if (V !== K.lane ? (vt & V) === V : (na & V) === V) {
              var L = K.revertLane;
              if (L === 0)
                H !== null && (H = H.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: K.action,
                  hasEagerState: K.hasEagerState,
                  eagerState: K.eagerState,
                  next: null
                }), V === wn && (J = !0);
              else if ((na & L) === L) {
                K = K.next, L === wn && (J = !0);
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
                }, H === null ? (k = H = V, f = u) : H = H.next = V, ft.lanes |= L, Ea |= L;
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
              }, H === null ? (k = H = L, f = u) : H = H.next = L, ft.lanes |= V, Ea |= V;
            K = K.next;
          } while (K !== null && K !== e);
          if (H === null ? f = u : H.next = k, !ye(u, t.memoizedState) && (Gt = !0, J && (a = _n, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = f, t.baseQueue = H, i.lastRenderedState = u;
        }
        return r === null && (i.lanes = 0), [t.memoizedState, i.dispatch];
      }
      function rr(t) {
        var e = Bt(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var i = a.dispatch, r = a.pending, u = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var f = r = r.next;
          do
            u = t(u, f.action), f = f.next;
          while (f !== r);
          ye(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, i];
      }
      function zs(t, e, a) {
        var i = ft, r = Bt(), u = yt;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var f = !ye(
          (Ct || r).memoizedState,
          a
        );
        if (f && (r.memoizedState = a, Gt = !0), r = r.queue, cr(Ts.bind(null, i, r, t), [
          t
        ]), r.getSnapshot !== e || f || Yt !== null && Yt.memoizedState.tag & 1) {
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
          u || (na & 127) !== 0 || Es(i, e, a);
        }
        return a;
      }
      function Es(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = ft.updateQueue, e === null ? (e = Nl(), ft.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
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
        var e = Ba(t, 2);
        e !== null && ce(e, t, 2);
      }
      function or(t) {
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
      function Ms(t, e, a, i) {
        return t.baseState = a, ir(
          t,
          Ct,
          typeof i == "function" ? i : We
        );
      }
      function If(t, e, a, i, r) {
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
          it.T !== null ? a(!0) : u.isTransition = !1, i(u), a = e.pending, a === null ? (u.next = e.pending = u, As(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function As(t, e) {
        var a = e.action, i = e.payload, r = t.state;
        if (e.isTransition) {
          var u = it.T, f = {};
          it.T = f;
          try {
            var k = a(r, i), H = it.S;
            H !== null && H(f, k), Os(t, e, k);
          } catch (K) {
            sr(t, e, K);
          } finally {
            u !== null && f.types !== null && (u.types = f.types), it.T = u;
          }
        } else
          try {
            u = a(r, i), Os(t, e, u);
          } catch (K) {
            sr(t, e, K);
          }
      }
      function Os(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(i) {
            Rs(t, e, i);
          },
          function(i) {
            return sr(t, e, i);
          }
        ) : Rs(t, e, a);
      }
      function Rs(t, e, a) {
        e.status = "fulfilled", e.value = a, Hs(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, As(t, a)));
      }
      function sr(t, e, a) {
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
        if (yt) {
          var a = Mt.formState;
          if (a !== null) {
            t: {
              var i = ft;
              if (yt) {
                if (Ot) {
                  var r = pp(
                    Ot,
                    Te
                  );
                  if (r) {
                    Ot = Mu(r), i = hp(r);
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
        a = oe(), a.memoizedState = a.baseState = e, i = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ds,
          lastRenderedState: e
        }, a.queue = i, a = ec.bind(
          null,
          ft,
          i
        ), i.dispatch = a, i = or(!1);
        var u = mr.bind(
          null,
          ft,
          !1,
          i.queue
        );
        return i = oe(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, i.queue = r, a = If.bind(
          null,
          ft,
          r,
          u,
          a
        ), r.dispatch = a, i.memoizedState = t, [e, a, !1];
      }
      function Bs(t) {
        var e = Bt();
        return qs(e, Ct, t);
      }
      function qs(t, e, a) {
        if (e = ir(
          t,
          e,
          Ds
        )[0], t = Cl(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var i = Gn(e);
          } catch (f) {
            throw f === Sn ? ni : f;
          }
        else i = e;
        e = Bt();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (ft.flags |= 2048, sn(
          9,
          { destroy: void 0 },
          $f.bind(null, r, a),
          null
        )), [i, u, t];
      }
      function $f(t, e) {
        t.action = e;
      }
      function Ys(t) {
        var e = Bt(), a = Ct;
        if (a !== null)
          return qs(e, a, t);
        Bt(), e = e.memoizedState, a = Bt();
        var i = a.queue.dispatch;
        return a.memoizedState = t, [e, i, !1];
      }
      function sn(t, e, a, i) {
        return t = { tag: t, create: a, deps: i, inst: e, next: null }, e = ft.updateQueue, e === null && (e = Nl(), ft.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (i = a.next, a.next = t, t.next = i, e.lastEffect = t), t;
      }
      function Gs() {
        return Bt().memoizedState;
      }
      function jl(t, e, a, i) {
        var r = oe();
        ft.flags |= t, r.memoizedState = sn(
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
        Ct !== null && i !== null && Pi(i, Ct.memoizedState.deps) ? r.memoizedState = sn(e, u, a, i) : (ft.flags |= t, r.memoizedState = sn(
          1 | e,
          u,
          a,
          i
        ));
      }
      function Ks(t, e) {
        jl(8390656, 8, t, e);
      }
      function cr(t, e) {
        Ml(2048, 8, t, e);
      }
      function Pf(t) {
        ft.flags |= 4;
        var e = ft.updateQueue;
        if (e === null)
          e = Nl(), ft.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Qs(t) {
        var e = Bt().memoizedState;
        return Pf({ ref: e, nextImpl: t }), function() {
          if ((gt & 2) !== 0)
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
      function ur() {
      }
      function Ls(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        return e !== null && Pi(e, i[1]) ? i[0] : (a.memoizedState = [t, e], t);
      }
      function Ws(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        if (e !== null && Pi(e, i[1]))
          return i[0];
        if (i = t(), Fa) {
          Et(!0);
          try {
            t();
          } finally {
            Et(!1);
          }
        }
        return a.memoizedState = [i, e], i;
      }
      function dr(t, e, a) {
        return a === void 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Xc(), ft.lanes |= t, Ea |= t, a);
      }
      function Fs(t, e, a, i) {
        return ye(a, e) ? a : En.current !== null ? (t = dr(t, a, i), ye(t, e) || (Gt = !0), t) : (na & 42) === 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = Xc(), ft.lanes |= t, Ea |= t, e);
      }
      function Is(t, e, a, i, r) {
        var u = ea();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var f = it.T, k = {};
        it.T = k, mr(t, !1, e, a);
        try {
          var H = r(), K = it.S;
          if (K !== null && K(k, H), H !== null && typeof H == "object" && typeof H.then == "function") {
            var J = Wf(
              H,
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
        } catch (V) {
          Kn(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: V },
            he()
          );
        } finally {
          Lt(u), f !== null && k.types !== null && (f.types = k.types), it.T = f;
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
            lastRenderedReducer: We,
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
            lastRenderedReducer: We,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function fr() {
        return It(Va);
      }
      function Ps() {
        return Bt().memoizedState;
      }
      function tc() {
        return Bt().memoizedState;
      }
      function tm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = he();
              t = ma(a);
              var i = pa(e, t, a);
              i !== null && (ce(i, e, a), Bn(i, e, a)), e = { cache: Qi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function em(t, e, a) {
        var i = he();
        a = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t) ? ac(e, a) : (a = Zi(t, e, a, i), a !== null && (ce(a, t, i), nc(a, e, i)));
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
              var f = e.lastRenderedState, k = u(f, a);
              if (r.hasEagerState = !0, r.eagerState = k, ye(k, f))
                return kl(t, e, r, 0), Mt === null && Sl(), !1;
            } catch {
            } finally {
            }
          if (a = Zi(t, e, r, i), a !== null)
            return ce(a, t, i), nc(a, e, i), !0;
        }
        return !1;
      }
      function mr(t, e, a, i) {
        if (i = {
          lane: 2,
          revertLane: Vi(),
          gesture: null,
          action: i,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t)) {
          if (e) throw Error(s(479));
        } else
          e = Zi(
            t,
            a,
            i,
            2
          ), e !== null && ce(e, t, 2);
      }
      function Al(t) {
        var e = t.alternate;
        return t === ft || e !== null && e === ft;
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
      function pr(t, e, a, i) {
        e = t.memoizedState, a = a(i, e), a = a == null ? e : Qr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function lc(t, e, a, i, r, u, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(i, u, f) : e.prototype && e.prototype.isPureReactComponent ? !xl(a, i) || !xl(r, u) : !0;
      }
      function ic(t, e, a, i) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, i), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, i), e.state !== t && ho.enqueueReplaceState(e, e.state, null);
      }
      function qa(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var i in e)
            i !== "ref" && (a[i] = e[i]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Qr({}, a));
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
      function hr(t, e, a) {
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
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          rc(e, a, i), typeof r != "function" && (Na === null ? Na = /* @__PURE__ */ new Set([this]) : Na.add(this));
          var k = i.stack;
          this.componentDidCatch(i.value, {
            componentStack: k !== null ? k : ""
          });
        });
      }
      function am(t, e, a, i, r) {
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
                return je === null ? Kl() : a.alternate === null && Ut === 0 && (Ut = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, i === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([i]) : e.add(i), Br(t, i, r)), !1;
              case 22:
                return a.flags |= 65536, i === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([i])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([i]) : a.add(i)), Br(t, i, r)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return Br(t, i, r), Kl(), !1;
        }
        if (yt)
          return e = xe.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, i !== ro && (t = Error(s(422), { cause: i }), Hn(
            B(t, a)
          ))) : (i !== ro && (e = Error(s(423), {
            cause: i
          }), Hn(
            B(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, i = B(i, a), r = hr(
            t.stateNode,
            i,
            r
          ), Wi(t, r), Ut !== 4 && (Ut = 2)), !1;
        var u = Error(s(520), { cause: i });
        if (u = B(u, a), ol === null ? ol = [u] : ol.push(u), Ut !== 4 && (Ut = 2), e === null) return !0;
        i = B(i, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = hr(a.stateNode, i, t), Wi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Na === null || !Na.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = oc(r), sc(
                  r,
                  t,
                  a,
                  i
                ), Wi(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, i) {
        e.child = t === null ? Lu(e, null, a, i) : Wa(
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
          var f = {};
          for (var k in i)
            k !== "ref" && (f[k] = i[k]);
        } else f = i;
        return Da(e), i = tr(
          t,
          e,
          a,
          f,
          u,
          r
        ), k = er(), t !== null && !Gt ? (ar(t, e, r), Fe(t, e, r)) : (yt && k && Y(e), e.flags |= 1, $t(t, e, i, r), e.child);
      }
      function uc(t, e, a, i, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !qr(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, dc(
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
        if (u = t.child, !_r(t, r)) {
          var f = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : xl, a(f, i) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(u, i), t.ref = e.ref, t.return = e, e.child = t;
      }
      function dc(t, e, a, i, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (xl(u, i) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = i = u, _r(t, r))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return gr(
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
            ), u !== null ? ws(e, u) : Fi(), _s(e);
          else
            return i = e.lanes = 536870912, mc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              i
            );
        } else
          u !== null ? (yl(e, u.cachePool), ws(e, u), ga(), e.memoizedState = null) : (t !== null && yl(e, null), Fi(), ga());
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
      function mc(t, e, a, i, r) {
        var u = Xi();
        return u = u === null ? null : {
          parent: ta ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && yl(e, null), Fi(), _s(e), t !== null && rn(t, e, i, !0), e.childLanes = r, null;
      }
      function Rl(t, e) {
        return e = Dl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function pc(t, e, a) {
        return Wa(e, t.child, null, a), t = Rl(
          e,
          e.pendingProps
        ), t.flags |= 2, pe(e), e.memoizedState = null, t;
      }
      function nm(t, e, a) {
        var i = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (yt) {
            if (i.mode === "hidden")
              return t = Rl(e, i), e.lanes = 536870912, Qn(null, t);
            if ($i(e), (t = Ot) ? (t = kp(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = du(t), a.return = e, e.child = a, te = e, Ot = null)) : t = null, t === null) throw ut(e);
            return e.lanes = 536870912, null;
          }
          return Rl(e, i);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var f = u.dehydrated;
          if ($i(e), r)
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
            if (i = Mt, i !== null && (f = Z(i, a), f !== 0 && f !== u.retryLane))
              throw u.retryLane = f, Ba(t, f), ce(i, t, f), go;
            Kl(), e = pc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, re && (Ot = yp(f), te = e, yt = !0, Sa = null, Te = !1, t !== null && P(e, t)), e = Rl(e, i), e.flags |= 4096;
          return e;
        }
        return t = Pe(t.child, {
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
      function gr(t, e, a, i, r) {
        return Da(e), a = tr(
          t,
          e,
          a,
          i,
          void 0,
          r
        ), i = er(), t !== null && !Gt ? (ar(t, e, r), Fe(t, e, r)) : (yt && i && Y(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function hc(t, e, a, i, r, u) {
        return Da(e), e.updateQueue = null, a = ks(
          e,
          i,
          a,
          r
        ), Ss(t), i = er(), t !== null && !Gt ? (ar(t, e, u), Fe(t, e, u)) : (yt && i && Y(e), e.flags |= 1, $t(t, e, a, u), e.child);
      }
      function gc(t, e, a, i, r) {
        if (Da(e), e.stateNode === null) {
          var u = bn, f = a.contextType;
          typeof f == "object" && f !== null && (u = It(f)), u = new a(i, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = ho, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = i, u.state = e.memoizedState, u.refs = {}, Ji(e), f = a.contextType, u.context = typeof f == "object" && f !== null ? It(f) : bn, u.state = e.memoizedState, f = a.getDerivedStateFromProps, typeof f == "function" && (pr(
            e,
            a,
            f,
            i
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (f = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), f !== u.state && ho.enqueueReplaceState(
            u,
            u.state,
            null
          ), Yn(e, i, u, r), qn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !0;
        } else if (t === null) {
          u = e.stateNode;
          var k = e.memoizedProps, H = qa(a, k);
          u.props = H;
          var K = u.context, J = a.contextType;
          f = bn, typeof J == "object" && J !== null && (f = It(J));
          var V = a.getDerivedStateFromProps;
          J = typeof V == "function" || typeof u.getSnapshotBeforeUpdate == "function", k = e.pendingProps !== k, J || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (k || K !== f) && ic(
            e,
            u,
            i,
            f
          ), ka = !1;
          var L = e.memoizedState;
          u.state = L, Yn(e, i, u, r), qn(), K = e.memoizedState, k || L !== K || ka ? (typeof V == "function" && (pr(
            e,
            a,
            V,
            i
          ), K = e.memoizedState), (H = ka || lc(
            e,
            a,
            H,
            i,
            L,
            K,
            f
          )) ? (J || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = i, e.memoizedState = K), u.props = i, u.state = K, u.context = f, i = H) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !1);
        } else {
          u = e.stateNode, Li(t, e), f = e.memoizedProps, J = qa(a, f), u.props = J, V = e.pendingProps, L = u.context, K = a.contextType, H = bn, typeof K == "object" && K !== null && (H = It(K)), k = a.getDerivedStateFromProps, (K = typeof k == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (f !== V || L !== H) && ic(
            e,
            u,
            i,
            H
          ), ka = !1, L = e.memoizedState, u.state = L, Yn(e, i, u, r), qn();
          var dt = e.memoizedState;
          f !== V || L !== dt || ka || t !== null && t.dependencies !== null && gl(t.dependencies) ? (typeof k == "function" && (pr(
            e,
            a,
            k,
            i
          ), dt = e.memoizedState), (J = ka || lc(
            e,
            a,
            J,
            i,
            L,
            dt,
            H
          ) || t !== null && t.dependencies !== null && gl(t.dependencies)) ? (K || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(i, dt, H), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            i,
            dt,
            H
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), e.memoizedProps = i, e.memoizedState = dt), u.props = i, u.state = dt, u.context = H, i = J) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), i = !1);
        }
        return u = i, Hl(t, e), i = (e.flags & 128) !== 0, u || i ? (u = e.stateNode, a = i && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && i ? (e.child = Wa(
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
      function bc(t, e, a, i) {
        return Re(), e.flags |= 256, $t(t, e, a, i), e.child;
      }
      function br(t) {
        return { baseLanes: t, cachePool: fs() };
      }
      function vr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= _e), t;
      }
      function vc(t, e, a) {
        var i = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, f;
        if ((f = u) || (f = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (yt) {
            if (r ? ha(e) : ga(), (t = Ot) ? (t = zp(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = du(t), a.return = e, e.child = a, te = e, Ot = null)) : t = null, t === null) throw ut(e);
            return Pr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var k = i.children;
          return i = i.fallback, r ? (ga(), r = e.mode, k = Dl(
            { mode: "hidden", children: k },
            r
          ), i = Ka(
            i,
            r,
            a,
            null
          ), k.return = e, i.return = e, k.sibling = i, e.child = k, i = e.child, i.memoizedState = br(a), i.childLanes = vr(
            t,
            f,
            a
          ), e.memoizedState = bo, Qn(null, i)) : (ha(e), yr(e, k));
        }
        var H = t.memoizedState;
        if (H !== null && (k = H.dehydrated, k !== null)) {
          if (u)
            e.flags & 256 ? (ha(e), e.flags &= -257, e = xr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ga(), e.child = t.child, e.flags |= 128, e = null) : (ga(), k = i.fallback, r = e.mode, i = Dl(
              { mode: "visible", children: i.children },
              r
            ), k = Ka(
              k,
              r,
              a,
              null
            ), k.flags |= 2, i.return = e, k.return = e, i.sibling = k, e.child = i, Wa(
              e,
              t.child,
              null,
              a
            ), i = e.child, i.memoizedState = br(a), i.childLanes = vr(
              t,
              f,
              a
            ), e.memoizedState = bo, e = Qn(null, i));
          else if (ha(e), Pr(k))
            f = fp(k).digest, i = Error(s(419)), i.stack = "", i.digest = f, Hn({ value: i, source: null, stack: null }), e = xr(
              t,
              e,
              a
            );
          else if (Gt || rn(
            t,
            e,
            a,
            !1
          ), f = (a & t.childLanes) !== 0, Gt || f) {
            if (f = Mt, f !== null && (i = Z(
              f,
              a
            ), i !== 0 && i !== H.retryLane))
              throw H.retryLane = i, Ba(t, i), ce(f, t, i), go;
            $r(k) || Kl(), e = xr(
              t,
              e,
              a
            );
          } else
            $r(k) ? (e.flags |= 192, e.child = t.child, e = null) : (t = H.treeContext, re && (Ot = xp(
              k
            ), te = e, yt = !0, Sa = null, Te = !1, t !== null && P(e, t)), e = yr(
              e,
              i.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ga(), k = i.fallback, r = e.mode, H = t.child, u = H.sibling, i = Pe(H, {
          mode: "hidden",
          children: i.children
        }), i.subtreeFlags = H.subtreeFlags & 65011712, u !== null ? k = Pe(
          u,
          k
        ) : (k = Ka(
          k,
          r,
          a,
          null
        ), k.flags |= 2), k.return = e, i.return = e, i.sibling = k, e.child = i, Qn(null, i), i = e.child, k = t.child.memoizedState, k === null ? k = br(a) : (r = k.cachePool, r !== null ? (H = ta ? Rt._currentValue : Rt._currentValue2, r = r.parent !== H ? { parent: H, pool: H } : r) : r = fs(), k = {
          baseLanes: k.baseLanes | a,
          cachePool: r
        }), i.memoizedState = k, i.childLanes = vr(
          t,
          f,
          a
        ), e.memoizedState = bo, Qn(t.child, i)) : (ha(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: i.children
        }), a.return = e, a.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function yr(t, e) {
        return e = Dl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Dl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function xr(t, e, a) {
        return Wa(e, t.child, null, a), t = yr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function yc(t, e, a) {
        t.lanes |= e;
        var i = t.alternate;
        i !== null && (i.lanes |= e), Gi(t.return, e, a);
      }
      function wr(t, e, a, i, r, u) {
        var f = t.memoizedState;
        f === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: i,
          tail: a,
          tailMode: r,
          treeForkCount: u
        } : (f.isBackwards = e, f.rendering = null, f.renderingStartTime = 0, f.last = i, f.tail = a, f.tailMode = r, f.treeForkCount = u);
      }
      function xc(t, e, a) {
        var i = e.pendingProps, r = i.revealOrder, u = i.tail;
        i = i.children;
        var f = qt.current, k = (f & 2) !== 0;
        if (k ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, z(qt, f), $t(t, e, i, a), i = yt ? tl : 0, !k && t !== null && (t.flags & 128) !== 0)
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
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), wr(
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
            wr(
              e,
              !0,
              a,
              null,
              u,
              i
            );
            break;
          case "together":
            wr(
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
      function Fe(t, e, a) {
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
          for (t = e.child, a = Pe(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Pe(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function _r(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && gl(t)));
      }
      function lm(t, e, a) {
        switch (e.tag) {
          case 3:
            tt(
              e,
              e.stateNode.containerInfo
            ), fa(e, Rt, t.memoizedState.cache), Re();
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
            fa(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, $i(e), null;
            break;
          case 13:
            var i = e.memoizedState;
            if (i !== null)
              return i.dehydrated !== null ? (ha(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? vc(
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
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), z(qt, qt.current), i) break;
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
        return Fe(t, e, a);
      }
      function wc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!_r(t, a) && (e.flags & 128) === 0)
              return Gt = !1, lm(
                t,
                e,
                a
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, yt && (e.flags & 1048576) !== 0 && _(e, tl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var i = e.pendingProps;
              if (t = Ua(e.elementType), e.type = t, typeof t == "function")
                qr(t) ? (i = qa(t, i), e.tag = 1, e = gc(
                  null,
                  e,
                  t,
                  i,
                  a
                )) : (e.tag = 0, e = gr(
                  null,
                  e,
                  t,
                  i,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Xr) {
                    e.tag = 11, e = cc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  } else if (r === Lr) {
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
                throw e = M(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return gr(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return i = e.type, r = qa(
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
              if (tt(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              r = e.memoizedState, i = r.element, Li(t, e), Yn(e, u, null, a);
              var f = e.memoizedState;
              if (u = f.cache, fa(e, Rt, u), u !== r.cache && Ki(
                e,
                [Rt],
                a,
                !0
              ), qn(), u = f.element, re && r.isDehydrated)
                if (r = {
                  element: u,
                  isDehydrated: !1,
                  cache: f.cache
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
                  for (re && (Ot = vp(
                    e.stateNode.containerInfo
                  ), te = e, yt = !0, Sa = null, Te = !0), a = Lu(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Re(), u === i) {
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
            if (Be)
              return Hl(t, e), t === null ? (a = Ru(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : yt || (e.stateNode = Xp(
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
              return xt(e), t === null && Vt && yt && (i = e.stateNode = Yu(
                e.type,
                e.pendingProps,
                _a.current,
                Pt.current,
                !1
              ), te = e, Te = !0, Ot = wp(
                e.type,
                i,
                Ot
              )), $t(
                t,
                e,
                e.pendingProps.children,
                a
              ), Hl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && yt && (Kp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = i = Ot) && (i = _p(
              i,
              e.type,
              e.pendingProps,
              Te
            ), i !== null ? (e.stateNode = i, te = e, Ot = bp(i), Te = !1, r = !0) : r = !1), r || ut(e)), xt(e), r = e.type, u = e.pendingProps, f = t !== null ? t.memoizedProps : null, i = u.children, Jl(r, u) ? i = null : f !== null && Jl(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = tr(
              t,
              e,
              Ff,
              null,
              null,
              a
            ), ta ? Va._currentValue = r : Va._currentValue2 = r), Hl(t, e), $t(t, e, i, a), e.child;
          case 6:
            return t === null && yt && (Qp(
              e.pendingProps,
              Pt.current
            ), (t = a = Ot) && (a = Sp(
              a,
              e.pendingProps,
              Te
            ), a !== null ? (e.stateNode = a, te = e, Ot = null, t = !0) : t = !1), t || ut(e)), null;
          case 13:
            return vc(t, e, a);
          case 4:
            return tt(
              e,
              e.stateNode.containerInfo
            ), i = e.pendingProps, t === null ? e.child = Wa(
              e,
              null,
              i,
              a
            ) : $t(t, e, i, a), e.child;
          case 11:
            return cc(
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
            return i = e.pendingProps, fa(e, e.type, i.value), $t(
              t,
              e,
              i.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, i = e.pendingProps.children, Da(e), r = It(r), i = i(r), e.flags |= 1, $t(t, e, i, a), e.child;
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
            return nm(t, e, a);
          case 22:
            return fc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Da(e), i = It(Rt), t === null ? (r = Xi(), r === null && (r = Mt, u = Qi(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: i,
              cache: r
            }, Ji(e), fa(e, Rt, r)) : ((t.lanes & a) !== 0 && (Li(t, e), Yn(e, null, null, a), qn()), r = t.memoizedState, u = e.memoizedState, r.parent !== i ? (r = { parent: i, cache: i }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), fa(e, Rt, i)) : (i = u.cache, fa(e, Rt, i), i !== r.cache && Ki(
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
      function He(t) {
        t.flags |= 4;
      }
      function Ul(t) {
        Qe && (t.flags |= 8);
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
      function Sr(t, e, a, i) {
        if (ie)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Fr(t, a.stateNode);
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
              a && i && (u = Cu(
                u,
                r.type,
                r.memoizedProps
              )), Fr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && i && (u = ju(
                u,
                r.memoizedProps
              )), Fr(t, u);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                u = r.child, u !== null && (u.return = r), Sr(t, r, !0, !0);
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
        if (Qe)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var f = u.stateNode;
              a && i && (f = Cu(
                f,
                u.type,
                u.memoizedProps
              )), Nu(t, f);
            } else if (u.tag === 6)
              f = u.stateNode, a && i && (f = ju(
                f,
                u.memoizedProps
              )), Nu(t, f);
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
        if (Qe && _c(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, i = Eu();
          Sc(i, e, !1, !1), t.pendingChildren = i, He(e), dp(a, i);
        }
      }
      function kr(t, e, a, i) {
        if (ie)
          t.memoizedProps !== i && He(e);
        else if (Qe) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = _c(t, e)) || u !== i) {
            var f = Pt.current;
            u = up(
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
              f
            ) && He(e), e.stateNode = u, t && Sr(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function zr(t, e, a, i, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Um(e, i) : Bm(e, a, i))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Ir(e, i))
            if (Su(t.stateNode, e, i))
              t.flags |= 8192;
            else if (Fc()) t.flags |= 8192;
            else
              throw La = li, uo;
        } else t.flags &= -16777217;
      }
      function zc(t, e) {
        if (Jp(e)) {
          if (t.flags |= 16777216, !qu(e))
            if (Fc()) t.flags |= 8192;
            else
              throw La = li, uo;
        } else t.flags &= -16777217;
      }
      function Bl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? G() : 536870912, t.lanes |= e, Mn |= e);
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
      function im(t, e, a) {
        var i = e.pendingProps;
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
            return a = e.stateNode, i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), Le(Rt), lt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Oe(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, da())), kc(t, e), At(e), null;
          case 26:
            if (Be) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (At(e), zc(
                e,
                u
              )) : (At(e), zr(
                e,
                r,
                null,
                i,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), At(e), zc(
                e,
                u
              )) : (At(e), e.flags &= -16777217) : (u = t.memoizedProps, ie ? u !== i && He(e) : kr(
                t,
                e,
                r,
                i
              ), At(e), zr(
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
                ie ? t.memoizedProps !== i && He(e) : kr(t, e, r, i);
              else {
                if (!i) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return At(e), null;
                }
                t = Pt.current, Oe(e) ? Ra(e, t) : (t = Yu(
                  r,
                  i,
                  a,
                  t,
                  !0
                ), e.stateNode = t, He(e));
              }
              return At(e), null;
            }
          case 5:
            if (Jt(e), r = e.type, t !== null && e.stateNode != null)
              kr(t, e, r, i);
            else {
              if (!i) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return At(e), null;
              }
              if (u = Pt.current, Oe(e))
                Ra(e, u), Dp(
                  e.stateNode,
                  r,
                  i,
                  u
                ) && (e.flags |= 64);
              else {
                var f = Cm(
                  r,
                  i,
                  _a.current,
                  u,
                  e
                );
                Ul(e), Sr(f, e, !1, !1), e.stateNode = f, wu(
                  f,
                  r,
                  i,
                  u
                ) && He(e);
              }
            }
            return At(e), zr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ie ? a !== i && He(e) : Qe && (a !== i ? (t = _a.current, a = Pt.current, Ul(e), e.stateNode = _u(
                i,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof i != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = _a.current, a = Pt.current, Oe(e)) {
                if (!re) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, i = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      i = r.memoizedProps;
                  }
                Np(
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
              if (i = Oe(e), a !== null) {
                if (t === null) {
                  if (!i) throw Error(s(318));
                  if (!re) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  Tp(t, e);
                } else
                  Re(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
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
              if (r = Oe(e), i !== null && i.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!re) throw Error(s(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(s(317));
                  Cp(r, e);
                } else
                  Re(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                At(e), r = !1;
              } else
                r = da(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
            }
            return pe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = i !== null, t = t !== null && t.memoizedState !== null, a && (i = e.child, r = null, i.alternate !== null && i.alternate.memoizedState !== null && i.alternate.memoizedState.cachePool !== null && (r = i.alternate.memoizedState.cachePool.pool), u = null, i.memoizedState !== null && i.memoizedState.cachePool !== null && (u = i.memoizedState.cachePool.pool), u !== r && (i.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Bl(e, e.updateQueue), At(e), null);
          case 4:
            return lt(), kc(t, e), t === null && Om(e.stateNode.containerInfo), At(e), null;
          case 10:
            return Le(e.type), At(e), null;
          case 19:
            if (v(qt), i = e.memoizedState, i === null) return At(e), null;
            if (r = (e.flags & 128) !== 0, u = i.rendering, u === null)
              if (r) Vn(i, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = El(t), u !== null) {
                      for (e.flags |= 128, Vn(i, !1), t = u.updateQueue, e.updateQueue = t, Bl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        uu(a, t), a = a.sibling;
                      return z(
                        qt,
                        qt.current & 1 | 2
                      ), yt && q(e, i.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                i.tail !== null && ue() > sl && (e.flags |= 128, r = !0, Vn(i, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = El(u), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Bl(e, t), Vn(i, !0), i.tail === null && i.tailMode === "hidden" && !u.alternate && !yt)
                    return At(e), null;
                } else
                  2 * ue() - i.renderingStartTime > sl && a !== 536870912 && (e.flags |= 128, r = !0, Vn(i, !1), e.lanes = 4194304);
              i.isBackwards ? (u.sibling = e.child, e.child = u) : (t = i.last, t !== null ? t.sibling = u : e.child = u, i.last = u);
            }
            return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = ue(), t.sibling = null, a = qt.current, z(
              qt,
              r ? a & 1 | 2 : a & 1
            ), yt && q(e, i.treeForkCount), t) : (At(e), null);
          case 22:
          case 23:
            return pe(e), Ii(), i = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== i && (e.flags |= 8192) : i && (e.flags |= 8192), i ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (At(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : At(e), a = e.updateQueue, a !== null && Bl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), i = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (i = e.memoizedState.cachePool.pool), i !== a && (e.flags |= 2048), t !== null && v(Ja), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(Rt), At(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function rm(t, e) {
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
              Re();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (pe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              Re();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return v(qt), null;
          case 4:
            return lt(), null;
          case 10:
            return Le(e.type), null;
          case 22:
          case 23:
            return pe(e), Ii(), t !== null && v(Ja), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Ec(t, e) {
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
            v(qt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            pe(e), Ii(), t !== null && v(Ja);
            break;
          case 24:
            Le(Rt);
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
                var u = a.create, f = a.inst;
                i = u(), f.destroy = i;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (k) {
          _t(e, e.return, k);
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
                var f = i.inst, k = f.destroy;
                if (k !== void 0) {
                  f.destroy = void 0, r = e;
                  var H = a, K = k;
                  try {
                    K();
                  } catch (J) {
                    _t(
                      r,
                      H,
                      J
                    );
                  }
                }
              }
              i = i.next;
            } while (i !== u);
          }
        } catch (J) {
          _t(e, e.return, J);
        }
      }
      function Nc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            xs(e, a);
          } catch (i) {
            _t(t, t.return, i);
          }
        }
      }
      function Tc(t, e, a) {
        a.props = qa(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (i) {
          _t(t, e, i);
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
          _t(t, e, r);
        }
      }
      function Ke(t, e) {
        var a = t.ref, i = t.refCleanup;
        if (a !== null)
          if (typeof i == "function")
            try {
              i();
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
      function Cc(t) {
        var e = t.type, a = t.memoizedProps, i = t.stateNode;
        try {
          Pm(i, e, a, t);
        } catch (r) {
          _t(t, t.return, r);
        }
      }
      function Er(t, e, a) {
        try {
          tp(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          _t(t, t.return, i);
        }
      }
      function jc(t) {
        return t.tag === 5 || t.tag === 3 || (Be ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && hn(t.type) : !1) || t.tag === 4;
      }
      function Nr(t) {
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
      function Tr(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? ap(a, t, e) : Im(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Tr(t, e, a), t = t.sibling; t !== null; )
            Tr(t, e, a), t = t.sibling;
      }
      function ql(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? ep(a, t, e) : Fm(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (ql(t, e, a), t = t.sibling; t !== null; )
            ql(t, e, a), t = t.sibling;
      }
      function Mc(t, e, a) {
        t = t.containerInfo;
        try {
          Tu(t, a);
        } catch (i) {
          _t(e, e.return, i);
        }
      }
      function Ac(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Wp(
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          _t(t, t.return, i);
        }
      }
      function om(t, e) {
        for (Nm(t.containerInfo), Wt = e; Wt !== null; )
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
                      var f = qa(
                        i.type,
                        r
                      );
                      e = u.getSnapshotBeforeUpdate(
                        f,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (k) {
                      _t(i, i.return, k);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ie && cp(t.stateNode.containerInfo);
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
            Ie(t, a), i & 4 && Xn(5, a);
            break;
          case 1:
            if (Ie(t, a), i & 4)
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
            i & 64 && Nc(a), i & 512 && Zn(a, a.return);
            break;
          case 3:
            if (Ie(t, a), i & 64 && (i = a.updateQueue, i !== null)) {
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
              } catch (f) {
                _t(a, a.return, f);
              }
            }
            break;
          case 27:
            Vt && e === null && i & 4 && Ac(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (i & 4) Cc(a);
              else if (i & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  Ap(
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
            i & 512 && Zn(a, a.return);
            break;
          case 12:
            Ie(t, a);
            break;
          case 31:
            Ie(t, a), i & 4 && Hc(t, a);
            break;
          case 13:
            Ie(t, a), i & 4 && Dc(t, a), i & 64 && (i = a.memoizedState, i !== null && (i = i.dehydrated, i !== null && (a = pm.bind(
              null,
              a
            ), mp(i, a))));
            break;
          case 22:
            if (i = a.memoizedState !== null || la, !i) {
              e = e !== null && e.memoizedState !== null || Kt, r = la;
              var u = Kt;
              la = i, (Kt = e) && !u ? $e(
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
      function Rc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Rc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Dm(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function De(t, e, a) {
        for (a = a.child; a !== null; )
          Cr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Cr(t, e, a) {
        if (ve && typeof ve.onCommitFiberUnmount == "function")
          try {
            ve.onCommitFiberUnmount(Pn, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Be) {
              Kt || Ke(a, e), De(
                t,
                e,
                a
              ), a.memoizedState ? Du(a.memoizedState) : a.stateNode && Bu(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Ke(a, e);
              var i = Qt, r = de;
              hn(a.type) && (Qt = a.stateNode, de = !1), De(
                t,
                e,
                a
              ), Gu(a.stateNode), Qt = i, de = r;
              break;
            }
          case 5:
            Kt || Ke(a, e);
          case 6:
            if (ie) {
              if (i = Qt, r = de, Qt = null, De(
                t,
                e,
                a
              ), Qt = i, de = r, Qt !== null)
                if (de)
                  try {
                    lp(Qt, a.stateNode);
                  } catch (u) {
                    _t(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    np(Qt, a.stateNode);
                  } catch (u) {
                    _t(
                      a,
                      e,
                      u
                    );
                  }
            } else
              De(
                t,
                e,
                a
              );
            break;
          case 18:
            ie && Qt !== null && (de ? qp(
              Qt,
              a.stateNode
            ) : Bp(Qt, a.stateNode));
            break;
          case 4:
            ie ? (i = Qt, r = de, Qt = a.stateNode.containerInfo, de = !0, De(
              t,
              e,
              a
            ), Qt = i, de = r) : (Qe && Mc(
              a.stateNode,
              a,
              Eu()
            ), De(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            ba(2, a, e), Kt || ba(4, a, e), De(
              t,
              e,
              a
            );
            break;
          case 1:
            Kt || (Ke(a, e), i = a.stateNode, typeof i.componentWillUnmount == "function" && Tc(
              a,
              e,
              i
            )), De(
              t,
              e,
              a
            );
            break;
          case 21:
            De(
              t,
              e,
              a
            );
            break;
          case 22:
            Kt = (i = Kt) || a.memoizedState !== null, De(
              t,
              e,
              a
            ), Kt = i;
            break;
          default:
            De(
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
            Rp(t);
          } catch (a) {
            _t(e, e.return, a);
          }
        }
      }
      function Dc(t, e) {
        if (re && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Hp(t);
          } catch (a) {
            _t(e, e.return, a);
          }
      }
      function sm(t) {
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
        var a = sm(t);
        e.forEach(function(i) {
          if (!a.has(i)) {
            a.add(i);
            var r = hm.bind(null, t, i);
            i.then(r, r);
          }
        });
      }
      function le(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var i = 0; i < a.length; i++) {
            var r = a[i], u = t, f = e;
            if (ie) {
              var k = f;
              t: for (; k !== null; ) {
                switch (k.tag) {
                  case 27:
                    if (Vt) {
                      if (hn(k.type)) {
                        Qt = k.stateNode, de = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = k.stateNode, de = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = k.stateNode.containerInfo, de = !0;
                    break t;
                }
                k = k.return;
              }
              if (Qt === null) throw Error(s(160));
              Cr(u, f, r), Qt = null, de = !1;
            } else Cr(u, f, r);
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
            le(e, t), se(t), i & 4 && (ba(3, t, t.return), Xn(3, t), ba(5, t, t.return));
            break;
          case 1:
            le(e, t), se(t), i & 512 && (Kt || a === null || Ke(a, a.return)), i & 64 && la && (t = t.updateQueue, t !== null && (i = t.callbacks, i !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? i : a.concat(i))));
            break;
          case 26:
            if (Be) {
              var r = qe;
              if (le(e, t), se(t), i & 512 && (Kt || a === null || Ke(a, a.return)), i & 4) {
                i = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Vp(
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
                )) : u === null && t.stateNode !== null && Er(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              le(e, t), se(t), i & 512 && (Kt || a === null || Ke(a, a.return)), a !== null && i & 4 && Er(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (le(e, t), se(t), i & 512 && (Kt || a === null || Ke(a, a.return)), ie) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  zu(r);
                } catch (V) {
                  _t(t, t.return, V);
                }
              }
              i & 4 && t.stateNode != null && (r = t.memoizedProps, Er(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), i & 1024 && (vo = !0);
            } else
              Qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (le(e, t), se(t), i & 4 && ie) {
              if (t.stateNode === null)
                throw Error(s(162));
              i = t.memoizedProps, a = a !== null ? a.memoizedProps : i, r = t.stateNode;
              try {
                $m(r, a, i);
              } catch (V) {
                _t(t, t.return, V);
              }
            }
            break;
          case 3:
            if (Be ? (Zp(), r = qe, qe = to(e.containerInfo), le(e, t), qe = r) : le(e, t), se(t), i & 4) {
              if (ie && re && a !== null && a.memoizedState.isDehydrated)
                try {
                  Op(e.containerInfo);
                } catch (V) {
                  _t(t, t.return, V);
                }
              if (Qe) {
                i = e.containerInfo, a = e.pendingChildren;
                try {
                  Tu(i, a);
                } catch (V) {
                  _t(t, t.return, V);
                }
              }
            }
            vo && (vo = !1, Bc(t));
            break;
          case 4:
            Be ? (a = qe, qe = to(
              t.stateNode.containerInfo
            ), le(e, t), se(t), qe = a) : (le(e, t), se(t)), i & 4 && Qe && Mc(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            le(e, t), se(t);
            break;
          case 31:
            le(e, t), se(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Yl(t, i)));
            break;
          case 13:
            le(e, t), se(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (mi = ue()), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Yl(t, i)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = a !== null && a.memoizedState !== null, k = la, H = Kt;
            if (la = k || r, Kt = H || f, le(e, t), Kt = H, la = k, se(t), i & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || f || la || Kt || Ya(t)), ie)) {
              t: if (a = null, ie)
                for (e = t; ; ) {
                  if (e.tag === 5 || Be && e.tag === 26) {
                    if (a === null) {
                      f = a = e;
                      try {
                        u = f.stateNode, r ? ip(u) : op(
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
                        r ? rp(K) : sp(K, f.memoizedProps);
                      } catch (V) {
                        _t(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      f = e;
                      try {
                        var J = f.stateNode;
                        r ? Yp(J) : Gp(f.stateNode);
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
            i & 4 && (i = t.updateQueue, i !== null && (a = i.retryQueue, a !== null && (i.retryQueue = null, Yl(t, a))));
            break;
          case 19:
            le(e, t), se(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, Yl(t, i)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            le(e, t), se(t);
        }
      }
      function se(t) {
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
                    var r = a.stateNode, u = Nr(t);
                    ql(t, u, r);
                    break;
                  }
                case 5:
                  var f = a.stateNode;
                  a.flags & 32 && (zu(f), a.flags &= -33);
                  var k = Nr(t);
                  ql(t, k, f);
                  break;
                case 3:
                case 4:
                  var H = a.stateNode.containerInfo, K = Nr(t);
                  Tr(
                    t,
                    K,
                    H
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
      function Bc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Bc(e), e.tag === 5 && e.flags & 1024 && Gm(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Oc(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && Tc(
                e,
                e.return,
                a
              ), Ya(e);
              break;
            case 27:
              Vt && Gu(e.stateNode);
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
          var i = e.alternate, r = t, u = e, f = u.flags;
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
              ), i = u, r = i.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (K) {
                  _t(i, i.return, K);
                }
              if (i = u, r = i.updateQueue, r !== null) {
                var k = i.stateNode;
                try {
                  var H = r.shared.hiddenCallbacks;
                  if (H !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < H.length; r++)
                      ys(H[r], k);
                } catch (K) {
                  _t(i, i.return, K);
                }
              }
              a && f & 64 && Nc(u), Zn(u, u.return);
              break;
            case 27:
              Vt && Ac(u);
            case 26:
            case 5:
              $e(
                r,
                u,
                a
              ), a && i === null && f & 4 && Cc(u), Zn(u, u.return);
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
              ), a && f & 4 && Hc(r, u);
              break;
            case 13:
              $e(
                r,
                u,
                a
              ), a && f & 4 && Dc(r, u);
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
      function jr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Dn(a));
      }
      function Mr(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Dn(t));
      }
      function Ue(t, e, a, i) {
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
            Ue(
              t,
              e,
              a,
              i
            ), r & 2048 && Xn(9, e);
            break;
          case 1:
            Ue(
              t,
              e,
              a,
              i
            );
            break;
          case 3:
            Ue(
              t,
              e,
              a,
              i
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Dn(t)));
            break;
          case 12:
            if (r & 2048) {
              Ue(
                t,
                e,
                a,
                i
              ), t = e.stateNode;
              try {
                var u = e.memoizedProps, f = u.id, k = u.onPostCommit;
                typeof k == "function" && k(
                  f,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (H) {
                _t(e, e.return, H);
              }
            } else
              Ue(
                t,
                e,
                a,
                i
              );
            break;
          case 31:
            Ue(
              t,
              e,
              a,
              i
            );
            break;
          case 13:
            Ue(
              t,
              e,
              a,
              i
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, f = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ue(
              t,
              e,
              a,
              i
            ) : Jn(
              t,
              e
            ) : u._visibility & 2 ? Ue(
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
            )), r & 2048 && jr(f, e);
            break;
          case 24:
            Ue(
              t,
              e,
              a,
              i
            ), r & 2048 && Mr(e.alternate, e);
            break;
          default:
            Ue(
              t,
              e,
              a,
              i
            );
        }
      }
      function cn(t, e, a, i, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, f = e, k = a, H = i, K = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              cn(
                u,
                f,
                k,
                H,
                r
              ), Xn(8, f);
              break;
            case 23:
              break;
            case 22:
              var J = f.stateNode;
              f.memoizedState !== null ? J._visibility & 2 ? cn(
                u,
                f,
                k,
                H,
                r
              ) : Jn(
                u,
                f
              ) : (J._visibility |= 2, cn(
                u,
                f,
                k,
                H,
                r
              )), r && K & 2048 && jr(
                f.alternate,
                f
              );
              break;
            case 24:
              cn(
                u,
                f,
                k,
                H,
                r
              ), r && K & 2048 && Mr(f.alternate, f);
              break;
            default:
              cn(
                u,
                f,
                k,
                H,
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
                Jn(a, i), r & 2048 && jr(
                  i.alternate,
                  i
                );
                break;
              case 24:
                Jn(a, i), r & 2048 && Mr(
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
      function Ga(t, e, a) {
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
            if (Ga(
              t,
              e,
              a
            ), t.flags & Cn)
              if (t.memoizedState !== null)
                Lp(
                  a,
                  qe,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var i = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Ir(r, t)) && ku(a, i, r, t);
              }
            break;
          case 5:
            Ga(
              t,
              e,
              a
            ), t.flags & Cn && (i = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Ir(r, t)) && ku(a, i, r, t));
            break;
          case 3:
          case 4:
            Be ? (i = qe, qe = to(
              t.stateNode.containerInfo
            ), Ga(
              t,
              e,
              a
            ), qe = i) : Ga(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (i = t.alternate, i !== null && i.memoizedState !== null ? (i = Cn, Cn = 16777216, Ga(
              t,
              e,
              a
            ), Cn = i) : Ga(
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
      function Ar(t) {
        var e = Am(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Vm(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function Or(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case si:
            if (t.type === e.value) return !0;
            break;
          case ci:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var i = t[a++], r = i.tag, u = t[a++], f = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !$n(i)) {
                  for (; f != null && Or(i, f); )
                    u++, f = e[u];
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
            if ((a === 5 || a === 26 || a === 27) && Jm(t.stateNode, e.value))
              return !0;
            break;
          case fi:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Zm(t), t !== null && 0 <= t.indexOf(e.value)))
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
      function Rr(t) {
        switch (t.$$typeof) {
          case si:
            return "<" + (M(t.value) || "Unknown") + ">";
          case ci:
            return ":has(" + (Rr(t) || "") + ")";
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
          var r = t[i++], u = r.tag, f = t[i++], k = e[f];
          if (u !== 5 && u !== 26 && u !== 27 || !$n(r)) {
            for (; k != null && Or(r, k); )
              f++, k = e[f];
            if (f === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return a;
      }
      function Hr(t, e) {
        if (!In) throw Error(s(363));
        t = Ar(t), t = Vc(t, e), e = [], t = Array.from(t);
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
        return (gt & 2) !== 0 && vt !== 0 ? vt & -vt : it.T !== null ? Vi() : Rm();
      }
      function Xc() {
        if (_e === 0)
          if ((vt & 536870912) === 0 || yt) {
            var t = Wl;
            Wl <<= 1, (Wl & 3932160) === 0 && (Wl = 262144), _e = t;
          } else _e = 536870912;
        return t = xe.current, t !== null && (t.flags |= 32), _e;
      }
      function ce(t, e, a) {
        (t === Mt && (Tt === 2 || Tt === 9) || t.cancelPendingCommit !== null) && (un(t, 0), va(
          t,
          vt,
          _e,
          !1
        )), S(t, a), ((gt & 2) === 0 || t !== Mt) && (t === Mt && ((gt & 2) === 0 && (Ia |= a), Ut === 4 && va(
          t,
          vt,
          _e,
          !1
        )), Ge(t));
      }
      function Zc(t, e, a) {
        if ((gt & 6) !== 0) throw Error(s(327));
        var i = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || E(t, e), r = i ? dm(t, e) : Ur(t, e, !0), u = i;
        do {
          if (r === 0) {
            jn && !i && va(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !cm(a)) {
              r = Ur(t, e, !1), u = !1;
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
                  var k = t;
                  r = ol;
                  var H = re && k.current.memoizedState.isDehydrated;
                  if (H && (un(k, f).flags |= 256), f = Ur(
                    k,
                    f,
                    !1
                  ), f !== 2) {
                    if (yo && !H) {
                      k.errorRecoveryDisabledLanes |= u, Ia |= u, r = 4;
                      break t;
                    }
                    u = fe, fe = r, u !== null && (fe === null ? fe = u : fe.push.apply(
                      fe,
                      u
                    ));
                  }
                  r = f;
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
                  fe = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (r = mi + 300 - ue(), 10 < r)) {
                if (va(
                  i,
                  e,
                  _e,
                  !za
                ), O(i, 0, !0) !== 0) break t;
                ra = e, i.timeoutHandle = jm(
                  Jc.bind(
                    null,
                    i,
                    a,
                    fe,
                    pi,
                    wo,
                    e,
                    _e,
                    Ia,
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
                fe,
                pi,
                wo,
                e,
                _e,
                Ia,
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
        Ge(t);
      }
      function Jc(t, e, a, i, r, u, f, k, H, K, J, V, L, dt) {
        if (t.timeoutHandle = Qa, V = e.subtreeFlags, V & 8192 || (V & 16785408) === 16785408) {
          V = qm(), Yc(
            e,
            u,
            V
          );
          var ee = (u & 62914560) === u ? mi - ue() : (u & 4194048) === u ? $u - ue() : 0;
          if (ee = Ym(
            V,
            ee
          ), ee !== null) {
            ra = u, t.cancelPendingCommit = ee(
              au.bind(
                null,
                t,
                e,
                u,
                a,
                i,
                r,
                f,
                k,
                H,
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
        au(
          t,
          e,
          u,
          a,
          i,
          r,
          f,
          k,
          H
        );
      }
      function cm(t) {
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
        e &= ~xo, e &= ~Ia, t.suspendedLanes |= e, t.pingedLanes &= ~e, i && (t.warmLanes |= e), i = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - be(r), f = 1 << u;
          i[u] = -1, r &= ~f;
        }
        a !== 0 && h(t, a, e);
      }
      function Lc() {
        return (gt & 6) === 0 ? (on(0), !1) : !0;
      }
      function Dr() {
        if (bt !== null) {
          if (Tt === 0)
            var t = bt.return;
          else
            t = bt, aa = Xa = null, nr(t), kn = null, nl = 0, t = bt;
          for (; t !== null; )
            Ec(t.alternate, t), t = t.return;
          bt = null;
        }
      }
      function un(t, e) {
        var a = t.timeoutHandle;
        a !== Qa && (t.timeoutHandle = Qa, Mm(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, Dr(), Mt = t, bt = a = Pe(t.current, null), vt = e, Tt = 0, we = null, za = !1, jn = E(t, e), yo = !1, Mn = _e = xo = Ia = Ea = Ut = 0, fe = ol = null, wo = !1, (e & 8) !== 0 && (e |= e & 32);
        var i = t.entangledLanes;
        if (i !== 0)
          for (t = t.entanglements, i &= e; 0 < i; ) {
            var r = 31 - be(i), u = 1 << r;
            e |= t[r], i &= ~u;
          }
        return ia = e, Sl(), a;
      }
      function Wc(t, e) {
        ft = null, it.H = il, e === Sn || e === ni ? (e = hs(), Tt = 3) : e === uo ? (e = hs(), Tt = 4) : Tt = e === go ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, we = e, bt === null && (Ut = 1, Ol(
          t,
          B(e, t.current)
        ));
      }
      function Fc() {
        var t = xe.current;
        return t === null ? !0 : (vt & 4194048) === vt ? je === null : (vt & 62914560) === vt || (vt & 536870912) !== 0 ? t === je : !1;
      }
      function Ic() {
        var t = it.H;
        return it.H = il, t === null ? il : t;
      }
      function $c() {
        var t = it.A;
        return it.A = ch, t;
      }
      function Kl() {
        Ut = 4, za || (vt & 4194048) !== vt && xe.current !== null || (jn = !0), (Ea & 134217727) === 0 && (Ia & 134217727) === 0 || Mt === null || va(
          Mt,
          vt,
          _e,
          !1
        );
      }
      function Ur(t, e, a) {
        var i = gt;
        gt |= 2;
        var r = Ic(), u = $c();
        (Mt !== t || vt !== e) && (pi = null, un(t, e)), e = !1;
        var f = Ut;
        t: do
          try {
            if (Tt !== 0 && bt !== null) {
              var k = bt, H = we;
              switch (Tt) {
                case 8:
                  Dr(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  xe.current === null && (e = !0);
                  var K = Tt;
                  if (Tt = 0, we = null, dn(t, k, H, K), a && jn) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  K = Tt, Tt = 0, we = null, dn(t, k, H, K);
              }
            }
            um(), f = Ut;
            break;
          } catch (J) {
            Wc(t, J);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Xa = null, gt = i, it.H = r, it.A = u, bt === null && (Mt = null, vt = 0, Sl()), f;
      }
      function um() {
        for (; bt !== null; ) Pc(bt);
      }
      function dm(t, e) {
        var a = gt;
        gt |= 2;
        var i = Ic(), r = $c();
        Mt !== t || vt !== e ? (pi = null, sl = ue() + 500, un(t, e)) : jn = E(
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
                  Tt = 0, we = null, dn(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (ms(u)) {
                    Tt = 0, we = null, tu(e);
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
                  ms(u) ? (Tt = 0, we = null, tu(e)) : (Tt = 0, we = null, dn(t, e, u, 7));
                  break;
                case 5:
                  var f = null;
                  switch (bt.tag) {
                    case 26:
                      f = bt.memoizedState;
                    case 5:
                    case 27:
                      var k = bt, H = k.type, K = k.pendingProps;
                      if (f ? qu(f) : Su(k.stateNode, H, K)) {
                        Tt = 0, we = null;
                        var J = k.sibling;
                        if (J !== null) bt = J;
                        else {
                          var V = k.return;
                          V !== null ? (bt = V, Ql(V)) : bt = null;
                        }
                        break e;
                      }
                  }
                  Tt = 0, we = null, dn(t, e, u, 5);
                  break;
                case 6:
                  Tt = 0, we = null, dn(t, e, u, 6);
                  break;
                case 8:
                  Dr(), Ut = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            fm();
            break;
          } catch (L) {
            Wc(t, L);
          }
        while (!0);
        return aa = Xa = null, it.H = i, it.A = r, gt = a, bt !== null ? 0 : (Mt = null, vt = 0, Sl(), Ut);
      }
      function fm() {
        for (; bt !== null && !$p(); )
          Pc(bt);
      }
      function Pc(t) {
        var e = wc(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
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
              vt
            );
            break;
          case 11:
            e = hc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              vt
            );
            break;
          case 5:
            nr(e);
          default:
            Ec(a, e), e = bt = uu(e, ia), e = wc(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function dn(t, e, a, i) {
        aa = Xa = null, nr(e), kn = null, nl = 0;
        var r = e.return;
        try {
          if (am(
            t,
            r,
            e,
            a,
            vt
          )) {
            Ut = 1, Ol(
              t,
              B(a, t.current)
            ), bt = null;
            return;
          }
        } catch (u) {
          if (r !== null) throw bt = r, u;
          Ut = 1, Ol(
            t,
            B(a, t.current)
          ), bt = null;
          return;
        }
        e.flags & 32768 ? (yt || i === 1 ? t = !0 : jn || (vt & 536870912) !== 0 ? t = !1 : (za = t = !0, (i === 2 || i === 9 || i === 3 || i === 6) && (i = xe.current, i !== null && i.tag === 13 && (i.flags |= 16384))), eu(e, t)) : Ql(e);
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
          var a = im(
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
      function eu(t, e) {
        do {
          var a = rm(t.alternate, t);
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
      function au(t, e, a, i, r, u, f, k, H) {
        t.cancelPendingCommit = null;
        do
          Wn();
        while (Xt !== 0);
        if ((gt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= fo, g(
            t,
            a,
            u,
            f,
            k,
            H
          ), t === Mt && (bt = Mt = null, vt = 0), An = e, Ta = t, ra = a, _o = u, So = r, Pu = i, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, gm(no, function() {
            return ou(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), i = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || i) {
            i = it.T, it.T = null, r = ea(), Lt(2), f = gt, gt |= 4;
            try {
              om(t, e, a);
            } finally {
              gt = f, Lt(r), it.T = i;
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
            a = it.T, it.T = null;
            var i = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Uc(e, t), Tm(t.containerInfo);
            } finally {
              gt = r, Lt(i), it.T = a;
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
            a = it.T, it.T = null;
            var i = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Oc(t, e.alternate, e);
            } finally {
              gt = r, Lt(i), it.T = a;
            }
          }
          Xt = 3;
        }
      }
      function iu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Pp();
          var t = Ta, e = An, a = ra, i = Pu;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, An = Ta = null, ru(t, t.pendingLanes));
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
          if (i !== null) {
            e = it.T, r = ea(), Lt(2), it.T = null;
            try {
              for (var u = t.onRecoverableError, f = 0; f < i.length; f++) {
                var k = i[f];
                u(k.value, {
                  componentStack: k.stack
                });
              }
            } finally {
              it.T = e, Lt(r);
            }
          }
          (ra & 3) !== 0 && Wn(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === ko ? cl++ : (cl = 0, ko = t) : cl = 0, re && Up(), on(0);
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
        var t = Ta, e = _o;
        _o = 0;
        var a = $(ra), i = 32 > a ? 32 : a;
        a = it.T;
        var r = ea();
        try {
          Lt(i), it.T = null, i = So, So = null;
          var u = Ta, f = ra;
          if (Xt = 0, An = Ta = null, ra = 0, (gt & 6) !== 0)
            throw Error(s(331));
          var k = gt;
          if (gt |= 4, Kc(u.current), qc(
            u,
            u.current,
            f,
            i
          ), gt = k, on(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot(Pn, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), it.T = a, ru(t, e);
        }
      }
      function su(t, e, a) {
        e = B(a, e), e = hr(t.stateNode, e, 2), t = pa(t, e, 2), t !== null && (S(t, 2), Ge(t));
      }
      function _t(t, e, a) {
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
                ), S(i, 2), Ge(i));
                break;
              }
            }
            e = e.return;
          }
      }
      function Br(t, e, a) {
        var i = t.pingCache;
        if (i === null) {
          i = t.pingCache = new uh();
          var r = /* @__PURE__ */ new Set();
          i.set(e, r);
        } else
          r = i.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), i.set(e, r));
        r.has(a) || (yo = !0, r.add(a), t = mm.bind(null, t, e, a), e.then(t, t));
      }
      function mm(t, e, a) {
        var i = t.pingCache;
        i !== null && i.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Mt === t && (vt & a) === a && (Ut === 4 || Ut === 3 && (vt & 62914560) === vt && 300 > ue() - mi ? (gt & 2) === 0 && un(t, 0) : xo |= a, Mn === vt && (Mn = 0)), Ge(t);
      }
      function cu(t, e) {
        e === 0 && (e = G()), t = Ba(t, e), t !== null && (S(t, e), Ge(t));
      }
      function pm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), cu(t, a);
      }
      function hm(t, e) {
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
      function gm(t, e) {
        return Il(t, e);
      }
      function bm(t, e, a, i) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function qr(t) {
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
      function uu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Vl(t, e, a, i, r, u) {
        var f = 0;
        if (i = t, typeof t == "function") qr(t) && (f = 1);
        else if (typeof t == "string")
          f = Be && Vt ? Ou(t, a, Pt.current) ? 26 : Ku(t) ? 27 : 5 : Be ? Ou(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Ku(t) ? 27 : 5;
        else
          t: switch (t) {
            case Wr:
              return t = o(31, a, e, r), t.elementType = Wr, t.lanes = u, t;
            case mn:
              return Ka(
                a.children,
                r,
                u,
                e
              );
            case bu:
              f = 8, r |= 24;
              break;
            case Vr:
              return t = o(12, a, e, r | 2), t.elementType = Vr, t.lanes = u, t;
            case Zr:
              return t = o(13, a, e, r), t.elementType = Zr, t.lanes = u, t;
            case Jr:
              return t = o(19, a, e, r), t.elementType = Jr, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ya:
                    f = 10;
                    break t;
                  case vu:
                    f = 9;
                    break t;
                  case Xr:
                    f = 11;
                    break t;
                  case Lr:
                    f = 14;
                    break t;
                  case xa:
                    f = 16, i = null;
                    break t;
                }
              f = 29, a = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), i = null;
          }
        return e = o(f, a, e, r), e.elementType = t, e.type = i, e.lanes = u, e;
      }
      function Ka(t, e, a, i) {
        return t = o(7, t, i, e), t.lanes = a, t;
      }
      function Yr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function du(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Gr(t, e, a) {
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
      function vm(t, e, a, i, r, u, f, k, H) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = U(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = U(0), this.hiddenUpdates = U(null), this.identifierPrefix = i, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = H, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function fu(t, e, a, i, r, u, f, k, H, K, J, V) {
        return t = new vm(
          t,
          e,
          a,
          f,
          H,
          K,
          J,
          V,
          k
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Qi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: i,
          isDehydrated: a,
          cache: e
        }, Ji(u), t;
      }
      function mu(t) {
        return t ? (t = bn, t) : bn;
      }
      function pu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = m(e), t = t !== null ? b(t) : null, t === null ? null : Fn(t.stateNode);
      }
      function hu(t, e, a, i, r, u) {
        r = mu(r), i.context === null ? i.context = r : i.pendingContext = r, i = ma(e), i.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (i.callback = u), a = pa(t, i, e), a !== null && (ce(a, t, e), Bn(a, t, e));
      }
      function gu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Kr(t, e) {
        gu(t, e), (t = t.alternate) && gu(t, e);
      }
      var ht = {}, ym = Yh, ge = Kh(), Qr = Object.assign, xm = Symbol.for("react.element"), Xl = Symbol.for("react.transitional.element"), fn = Symbol.for("react.portal"), mn = Symbol.for("react.fragment"), bu = Symbol.for("react.strict_mode"), Vr = Symbol.for("react.profiler"), vu = Symbol.for("react.consumer"), ya = Symbol.for("react.context"), Xr = Symbol.for("react.forward_ref"), Zr = Symbol.for("react.suspense"), Jr = Symbol.for("react.suspense_list"), Lr = Symbol.for("react.memo"), xa = Symbol.for("react.lazy"), Wr = Symbol.for("react.activity"), wm = Symbol.for("react.memo_cache_sentinel"), yu = Symbol.iterator, _m = Symbol.for("react.client.reference"), Zl = Array.isArray, it = ym.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Sm = l.rendererVersion, km = l.rendererPackageName, xu = l.extraDevToolsConfig, Fn = l.getPublicInstance, zm = l.getRootHostContext, Em = l.getChildHostContext, Nm = l.prepareForCommit, Tm = l.resetAfterCommit, Cm = l.createInstance;
      l.cloneMutableInstance;
      var Fr = l.appendInitialChild, wu = l.finalizeInitialChildren, Jl = l.shouldSetTextContent, _u = l.createTextInstance;
      l.cloneMutableTextInstance;
      var jm = l.scheduleTimeout, Mm = l.cancelTimeout, Qa = l.noTimeout, ta = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ie = l.supportsMutation, Qe = l.supportsPersistence, re = l.supportsHydration, Am = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Om = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Lt = l.setCurrentUpdatePriority, ea = l.getCurrentUpdatePriority, Rm = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var Hm = l.shouldAttemptEagerTransition, Dm = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Um = l.maySuspendCommit, Bm = l.maySuspendCommitOnUpdate, Ir = l.maySuspendCommitInSyncRender, Su = l.preloadInstance, qm = l.startSuspendingCommit, ku = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Ym = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var pn = l.NotPendingTransition, Va = l.HostTransitionContext, Gm = l.resetFormInstance;
      l.bindToConsole;
      var Km = l.supportsMicrotasks, Qm = l.scheduleMicrotask, In = l.supportsTestSelectors, Vm = l.findFiberRoot, Xm = l.getBoundingRect, Zm = l.getTextContent, $n = l.isHiddenSubtree, Jm = l.matchAccessibilityRole, Lm = l.setFocusIfFocusable, Wm = l.setupIntersectionObserver, Fm = l.appendChild, Im = l.appendChildToContainer, $m = l.commitTextUpdate, Pm = l.commitMount, tp = l.commitUpdate, ep = l.insertBefore, ap = l.insertInContainerBefore, np = l.removeChild, lp = l.removeChildFromContainer, zu = l.resetTextContent, ip = l.hideInstance, rp = l.hideTextInstance, op = l.unhideInstance, sp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var cp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var up = l.cloneInstance, Eu = l.createContainerChildSet, Nu = l.appendChildToContainerChildSet, dp = l.finalizeContainerChildren, Tu = l.replaceContainerChildren, Cu = l.cloneHiddenInstance, ju = l.cloneHiddenTextInstance, $r = l.isSuspenseInstancePending, Pr = l.isSuspenseInstanceFallback, fp = l.getSuspenseInstanceFallbackErrorDetails, mp = l.registerSuspenseInstanceRetry, pp = l.canHydrateFormStateMarker, hp = l.isFormStateMarkerMatching, Mu = l.getNextHydratableSibling, gp = l.getNextHydratableSiblingAfterSingleton, bp = l.getFirstHydratableChild, vp = l.getFirstHydratableChildWithinContainer, yp = l.getFirstHydratableChildWithinActivityInstance, xp = l.getFirstHydratableChildWithinSuspenseInstance, wp = l.getFirstHydratableChildWithinSingleton, _p = l.canHydrateInstance, Sp = l.canHydrateTextInstance, kp = l.canHydrateActivityInstance, zp = l.canHydrateSuspenseInstance, Ep = l.hydrateInstance, Np = l.hydrateTextInstance, Tp = l.hydrateActivityInstance, Cp = l.hydrateSuspenseInstance, jp = l.getNextHydratableInstanceAfterActivityInstance, Mp = l.getNextHydratableInstanceAfterSuspenseInstance, Ap = l.commitHydratedInstance, Op = l.commitHydratedContainer, Rp = l.commitHydratedActivityInstance, Hp = l.commitHydratedSuspenseInstance, Dp = l.finalizeHydratedChildren, Up = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Bp = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var qp = l.clearSuspenseBoundaryFromContainer, Yp = l.hideDehydratedBoundary, Gp = l.unhideDehydratedBoundary, Au = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Kp = l.validateHydratableInstance, Qp = l.validateHydratableTextInstance, Be = l.supportsResources, Ou = l.isHostHoistableType, to = l.getHoistableRoot, Ru = l.getResource, Hu = l.acquireResource, Du = l.releaseResource, Vp = l.hydrateHoistable, Uu = l.mountHoistable, Bu = l.unmountHoistable, Xp = l.createHoistableInstance, Zp = l.prepareToCommitHoistables, Jp = l.mayResourceSuspendCommit, qu = l.preloadResource, Lp = l.suspendResource, Vt = l.supportsSingletons, Yu = l.resolveSingletonInstance, Wp = l.acquireSingletonInstance, Gu = l.releaseSingletonInstance, Ku = l.isHostSingletonType, hn = l.isSingletonScope, eo = [], gn = -1, bn = {}, be = Math.clz32 ? Math.clz32 : w, Fp = Math.log, Ip = Math.LN2, Ll = 256, Wl = 262144, Fl = 4194304, Il = ge.unstable_scheduleCallback, ao = ge.unstable_cancelCallback, $p = ge.unstable_shouldYield, Pp = ge.unstable_requestPaint, ue = ge.unstable_now, Qu = ge.unstable_ImmediatePriority, th = ge.unstable_UserBlockingPriority, no = ge.unstable_NormalPriority, eh = ge.unstable_IdlePriority, ah = ge.log, nh = ge.unstable_setDisableYieldValue, Pn = null, ve = null, ye = typeof Object.is == "function" ? Object.is : wt, Vu = typeof reportError == "function" ? reportError : function(t) {
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
      }, lh = Object.prototype.hasOwnProperty, lo, Xu, io = !1, Zu = /* @__PURE__ */ new WeakMap(), vn = [], yn = 0, $l = null, tl = 0, Ee = [], Ne = 0, wa = null, Ve = 1, Xe = "", Pt = N(null), el = N(null), _a = N(null), Pl = N(null), te = null, Ot = null, yt = !1, Sa = null, Te = !1, ro = Error(s(519)), ti = N(null), Xa = null, aa = null, ih = typeof AbortController < "u" ? AbortController : function() {
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
      }, rh = ge.unstable_scheduleCallback, oh = ge.unstable_NormalPriority, Rt = {
        $$typeof: ya,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ei = null, xn = null, oo = !1, ai = !1, so = !1, Za = 0, al = null, co = 0, wn = 0, _n = null, Ju = it.S;
      it.S = function(t, e) {
        $u = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && Lf(t, e), Ju !== null && Ju(t, e);
      };
      var Ja = N(null), Sn = Error(s(460)), uo = Error(s(474)), ni = Error(s(542)), li = { then: function() {
      } }, La = null, kn = null, nl = 0, Wa = bs(!0), Lu = bs(!1), Ce = [], zn = 0, fo = 0, ka = !1, mo = !1, En = N(null), ii = N(0), xe = N(null), je = null, qt = N(0), na = 0, ft = null, Ct = null, Yt = null, ri = !1, Nn = !1, Fa = !1, oi = 0, ll = 0, Tn = null, sh = 0, il = {
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
      var Wu = {
        readContext: It,
        use: Tl,
        useCallback: function(t, e) {
          return oe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
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
          var a = oe();
          e = e === void 0 ? null : e;
          var i = t();
          if (Fa) {
            Et(!0);
            try {
              t();
            } finally {
              Et(!1);
            }
          }
          return a.memoizedState = [i, e], i;
        },
        useReducer: function(t, e, a) {
          var i = oe();
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
          return i.memoizedState = i.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, i.queue = t, t = t.dispatch = em.bind(
            null,
            ft,
            t
          ), [i.memoizedState, t];
        },
        useRef: function(t) {
          var e = oe();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = or(t);
          var e = t.queue, a = ec.bind(
            null,
            ft,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: ur,
        useDeferredValue: function(t, e) {
          var a = oe();
          return dr(a, t, e);
        },
        useTransition: function() {
          var t = or(!1);
          return t = Is.bind(
            null,
            ft,
            t.queue,
            !0,
            !1
          ), oe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var i = ft, r = oe();
          if (yt) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), Mt === null)
              throw Error(s(349));
            (vt & 127) !== 0 || Es(i, e, a);
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
          var t = oe(), e = Mt.identifierPrefix;
          if (yt) {
            var a = Xe, i = Ve;
            a = (i & ~(1 << 32 - be(i) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = oi++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = sh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: fr,
        useFormState: Us,
        useActionState: Us,
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
            ft,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: lr,
        useCacheRefresh: function() {
          return oe().memoizedState = tm.bind(
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
      }, po = {
        readContext: It,
        use: Tl,
        useCallback: Ls,
        useContext: It,
        useEffect: cr,
        useImperativeHandle: Js,
        useInsertionEffect: Vs,
        useLayoutEffect: Xs,
        useMemo: Ws,
        useReducer: Cl,
        useRef: Gs,
        useState: function() {
          return Cl(We);
        },
        useDebugValue: ur,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return Fs(
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
        useSyncExternalStore: zs,
        useId: Ps,
        useHostTransitionStatus: fr,
        useFormState: Bs,
        useActionState: Bs,
        useOptimistic: function(t, e) {
          var a = Bt();
          return Ms(a, Ct, t, e);
        },
        useMemoCache: lr,
        useCacheRefresh: tc
      };
      po.useEffectEvent = Qs;
      var Fu = {
        readContext: It,
        use: Tl,
        useCallback: Ls,
        useContext: It,
        useEffect: cr,
        useImperativeHandle: Js,
        useInsertionEffect: Vs,
        useLayoutEffect: Xs,
        useMemo: Ws,
        useReducer: rr,
        useRef: Gs,
        useState: function() {
          return rr(We);
        },
        useDebugValue: ur,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return Ct === null ? dr(a, t, e) : Fs(
            a,
            Ct.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = rr(We)[0], e = Bt().memoizedState;
          return [
            typeof t == "boolean" ? t : Gn(t),
            e
          ];
        },
        useSyncExternalStore: zs,
        useId: Ps,
        useHostTransitionStatus: fr,
        useFormState: Ys,
        useActionState: Ys,
        useOptimistic: function(t, e) {
          var a = Bt();
          return Ct !== null ? Ms(a, Ct, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: lr,
        useCacheRefresh: tc
      };
      Fu.useEffectEvent = Qs;
      var ho = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var i = he(), r = ma(i);
          r.payload = e, a != null && (r.callback = a), e = pa(t, r, i), e !== null && (ce(e, t, i), Bn(e, t, i));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var i = he(), r = ma(i);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = pa(t, r, i), e !== null && (ce(e, t, i), Bn(e, t, i));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = he(), i = ma(a);
          i.tag = 2, e != null && (i.callback = e), e = pa(t, i, a), e !== null && (ce(e, t, a), Bn(e, t, a));
        }
      }, go = Error(s(461)), Gt = !1, bo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, la = !1, Kt = !1, vo = !1, Iu = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, de = !1, qe = null, Cn = 8192, ch = {
        getCacheForType: function(t) {
          var e = It(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return It(Rt).controller.signal;
        }
      }, si = 0, ci = 1, ui = 2, di = 3, fi = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var rl = Symbol.for;
        si = rl("selector.component"), ci = rl("selector.has_pseudo_class"), ui = rl("selector.role"), di = rl("selector.test_id"), fi = rl("selector.text");
      }
      var uh = typeof WeakMap == "function" ? WeakMap : Map, gt = 0, Mt = null, bt = null, vt = 0, Tt = 0, we = null, za = !1, jn = !1, yo = !1, ia = 0, Ut = 0, Ea = 0, Ia = 0, xo = 0, _e = 0, Mn = 0, ol = null, fe = null, wo = !1, mi = 0, $u = 0, sl = 1 / 0, pi = null, Na = null, Xt = 0, Ta = null, An = null, ra = 0, _o = 0, So = null, Pu = null, cl = 0, ko = null;
      return ht.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ba(t, 67108864);
          e !== null && ce(e, t, 67108864), Kr(t, 67108864);
        }
      }, ht.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = he();
          e = ot(e);
          var a = Ba(t, e);
          a !== null && ce(a, t, e), Kr(t, e);
        }
      }, ht.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = y(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - be(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ge(t), (gt & 6) === 0 && (sl = ue() + 500, on(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ba(t, 2), e !== null && ce(e, t, 2), Lc(), Kr(t, 2);
        }
      }, ht.batchedUpdates = function(t, e) {
        return t(e);
      }, ht.createComponentSelector = function(t) {
        return { $$typeof: si, value: t };
      }, ht.createContainer = function(t, e, a, i, r, u, f, k, H, K) {
        return fu(
          t,
          e,
          !1,
          null,
          a,
          i,
          u,
          null,
          f,
          k,
          H,
          K
        );
      }, ht.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, ht.createHydrationContainer = function(t, e, a, i, r, u, f, k, H, K, J, V, L, dt) {
        return t = fu(
          a,
          i,
          !0,
          t,
          r,
          u,
          k,
          dt,
          H,
          K,
          J,
          V
        ), t.context = mu(null), a = t.current, i = he(), i = ot(i), r = ma(i), r.callback = e ?? null, pa(a, r, i), e = i, t.current.lanes = e, S(t, e), Ge(t), t;
      }, ht.createPortal = function(t, e, a) {
        var i = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: fn,
          key: i == null ? null : "" + i,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, ht.createRoleSelector = function(t) {
        return { $$typeof: ui, value: t };
      }, ht.createTestNameSelector = function(t) {
        return { $$typeof: di, value: t };
      }, ht.createTextSelector = function(t) {
        return { $$typeof: fi, value: t };
      }, ht.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ht.defaultOnRecoverableError = function(t) {
        Vu(t);
      }, ht.defaultOnUncaughtError = function(t) {
        Vu(t);
      }, ht.deferredUpdates = function(t) {
        var e = it.T, a = ea();
        try {
          return Lt(32), it.T = null, t();
        } finally {
          Lt(a), it.T = e;
        }
      }, ht.discreteUpdates = function(t, e, a, i, r) {
        var u = it.T, f = ea();
        try {
          return Lt(2), it.T = null, t(e, a, i, r);
        } finally {
          Lt(f), it.T = u, gt === 0 && (sl = ue() + 500);
        }
      }, ht.findAllNodes = Hr, ht.findBoundingRects = function(t, e) {
        if (!In) throw Error(s(363));
        e = Hr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Xm(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var i = a.x, r = i + a.width, u = a.y, f = u + a.height, k = e - 1; 0 <= k; k--)
            if (e !== k) {
              var H = t[k], K = H.x, J = K + H.width, V = H.y, L = V + H.height;
              if (i >= K && u >= V && r <= J && f <= L) {
                t.splice(e, 1);
                break;
              } else if (i !== K || a.width !== H.width || L < u || V > f) {
                if (!(u !== V || a.height !== H.height || J < i || K > r)) {
                  K > i && (H.width += K - i, H.x = i), J < r && (H.width = r - K), t.splice(e, 1);
                  break;
                }
              } else {
                V > u && (H.height += V - u, H.y = u), L < f && (H.height = f - V), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ht.findHostInstance = pu, ht.findHostInstanceWithNoPortals = function(t) {
        return t = m(t), t = t !== null ? x(t) : null, t === null ? null : Fn(t.stateNode);
      }, ht.findHostInstanceWithWarning = function(t) {
        return pu(t);
      }, ht.flushPassiveEffects = Wn, ht.flushSyncFromReconciler = function(t) {
        var e = gt;
        gt |= 1;
        var a = it.T, i = ea();
        try {
          if (Lt(2), it.T = null, t)
            return t();
        } finally {
          Lt(i), it.T = a, gt = e, (gt & 6) === 0 && on(0);
        }
      }, ht.flushSyncWork = Lc, ht.focusWithin = function(t, e) {
        if (!In) throw Error(s(363));
        for (t = Ar(t), e = Vc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], i = a.tag;
          if (!$n(a)) {
            if ((i === 5 || i === 26 || i === 27) && Lm(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ht.getFindAllNodesFailureDescription = function(t, e) {
        if (!In) throw Error(s(363));
        var a = 0, i = [];
        t = [Ar(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], f = u.tag, k = t[r++], H = e[k];
          if ((f !== 5 && f !== 26 && f !== 27 || !$n(u)) && (Or(u, H) && (i.push(Rr(H)), k++, k > a && (a = k)), k < e.length))
            for (u = u.child; u !== null; )
              t.push(u, k), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Rr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (i.join(" > ") + `

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
          version: Sm,
          rendererPackageName: km,
          currentDispatcherRef: it,
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
      }, ht.isAlreadyRendering = function() {
        return (gt & 6) !== 0;
      }, ht.observeVisibleRects = function(t, e, a, i) {
        if (!In) throw Error(s(363));
        t = Hr(t, e);
        var r = Wm(
          t,
          a,
          i
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
      }, ht.startHostTransition = function(t, e, a, i) {
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
      }, ht.updateContainer = function(t, e, a, i) {
        var r = e.current, u = he();
        return hu(
          r,
          u,
          t,
          e,
          a,
          i
        ), u;
      }, ht.updateContainerSync = function(t, e, a, i) {
        return hu(
          e.current,
          2,
          t,
          e,
          a,
          i
        ), 2;
      }, ht;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(To)), To.exports;
}
var fd;
function Vh() {
  return fd || (fd = 1, No.exports = Qh()), No.exports;
}
var Xh = Vh();
const Zh = /* @__PURE__ */ Po(Xh);
var Mo = { exports: {} }, oa = {};
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
function Jh() {
  return md || (md = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var pd;
function Lh() {
  return pd || (pd = 1, Mo.exports = Jh()), Mo.exports;
}
var hl = Lh();
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
const tf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], qo = 16, ef = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Wh = [
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
}, Fh = /* @__PURE__ */ new Set([
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
]), af = {
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
}, nf = {
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
}, Yo = ["font-size", "color", ...new Set([...Object.keys(af), ...Object.keys(nf)].filter((n) => n !== "font-size" && n !== "color"))], Ih = new Set(Yo);
function ae(n, l = " ") {
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
function Go(n, l, o = 0) {
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
    const b = n.slice(d + 4, m - 1), x = ae(b, ","), C = x[0].trim(), M = x.length > 1 ? b.slice(b.indexOf(",") + 1).trim() : null;
    let N = l(C);
    if ((N == null || N === "initial") && (N = M), N == null) return null;
    const v = Go(N, l, o + 1);
    if (v === null) return null;
    c += v, s = m;
  }
}
function $h(n) {
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
function an(n, l) {
  const o = $h(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let c = 0;
  const s = ({ num: N, unit: v }) => {
    switch (v) {
      case "":
        return { px: 0, pct: 0, num: N, unitless: !0 };
      case "px":
        return { px: N, pct: 0, num: 0 };
      case "rem":
        return { px: N * qo, pct: 0, num: 0 };
      case "em":
        return { px: N * (l.fontSize ?? qo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: N, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: N / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: N / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: N * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (N, v, z) => N && v ? { px: N.px + z * v.px, pct: N.pct + z * v.pct, num: N.num + z * v.num, unitless: N.unitless && v.unitless } : null, p = (N, v) => N ? { px: N.px * v, pct: N.pct * v, num: N.num * v, unitless: N.unitless } : null, m = (N) => N && N.unitless;
  function b() {
    const N = o[c++];
    if (!N) return null;
    if (N.num !== void 0) return s(N);
    if (N.op === "(") {
      const v = C();
      return o[c]?.op !== ")" ? null : (c++, v);
    }
    if (N.op === "-" || N.op === "+") {
      const v = b();
      return N.op === "-" ? p(v, -1) : v;
    }
    if (N.fn) {
      const v = [];
      for (; ; ) {
        v.push(C());
        const y = o[c++];
        if (!y) return null;
        if (y.op === ")") break;
        if (y.op !== ",") return null;
      }
      if (v.some((y) => !y)) return null;
      if (N.fn === "calc") return v[0];
      if (!(v.every((y) => !y.pct) || v.every((y) => !y.px && !y.num))) return null;
      const w = (y) => y.px + y.pct + y.num;
      return N.fn === "min" ? v.reduce((y, O) => w(O) < w(y) ? O : y) : N.fn === "max" ? v.reduce((y, O) => w(O) > w(y) ? O : y) : N.fn === "clamp" && v.length === 3 ? w(v[1]) < w(v[0]) ? v[0] : w(v[1]) > w(v[2]) ? v[2] : v[1] : null;
    }
    return null;
  }
  function x() {
    let N = b();
    for (; o[c] && (o[c].op === "*" || o[c].op === "/"); ) {
      const v = o[c++].op, z = b();
      if (!N || !z) return null;
      v === "*" ? N = m(z) ? p(N, z.num) : m(N) ? p(z, N.num) : null : N = m(z) && z.num !== 0 ? p(N, 1 / z.num) : null;
    }
    return N;
  }
  function C() {
    let N = x();
    for (; o[c] && (o[c].op === "+" || o[c].op === "-"); ) {
      const v = o[c++].op;
      N = d(N, x(), v === "-" ? -1 : 1);
    }
    return N;
  }
  const M = C();
  return c !== o.length || !M ? null : M;
}
function Ko(n, l) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const c = an(o, l);
  return c ? c.unitless ? c.num === 0 ? { px: 0 } : { expr: n.trim() } : c.pct && (c.px || c.num) ? { expr: n.trim() } : c.pct ? { pct: c.pct } : { px: Ph(c.px) } : { expr: n.trim() };
}
const Ph = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, bi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), tg = ([n, l, o, c]) => `#${bi(n)}${bi(l)}${bi(o)}${bi(c * 255)}`;
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
    const x = l(c[1]), C = x && gd(x);
    return C ? { rgba: C, token: c[1] } : null;
  }
  if (o.startsWith("#")) {
    const x = gd(o);
    return x ? { rgba: x, token: null } : null;
  }
  if (hd[o]) return { rgba: [...hd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const x = ae(s[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const C = (Et) => {
      const wt = ae(Et), jt = wt.findIndex((nt) => /%$/.test(nt)), Q = jt >= 0 ? parseFloat(wt[jt]) / 100 : null;
      return { color: Ni(wt.filter((nt, B) => B !== jt).join(" "), l), pct: Q };
    }, M = C(x[1]), N = C(x[2]);
    if (!M.color || !N.color || M.color === "currentcolor" || N.color === "currentcolor") return null;
    let v = M.pct, z = N.pct;
    v === null && z === null ? (v = 0.5, z = 0.5) : v === null ? v = 1 - z : z === null && (z = 1 - v);
    const w = v + z, y = w < 1 ? w : 1;
    v /= w, z /= w;
    const [O, E, j, G] = M.color.rgba, [U, S, g, h] = N.color.rgba, D = G * v + h * z, Z = (Et, wt) => D === 0 ? 0 : (Et * G * v + wt * h * z) / D, ot = [Z(O, U), Z(E, S), Z(j, g), D * y], $ = h === 0 ? M.color.token : G === 0 ? N.color.token : null;
    return { rgba: ot, token: $ };
  }
  const d = s[2].includes(",") ? ae(s[2], ",") : ae(s[2].replace("/", " / ")).filter((x) => x !== "/");
  if (d.length < 3) return null;
  const p = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), m = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), b = [p(d[0]), p(d[1]), p(d[2]), m];
  return b.some((x) => Number.isNaN(x)) ? null : { rgba: b, token: null };
}
const ml = ["top", "right", "bottom", "left"], eg = ["top-left", "top-right", "bottom-right", "bottom-left"], vi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], bd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Qo(n, l) {
  const o = l.trim(), c = () => ae(o);
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
        for (const b of c())
          bd.has(b) ? p = b : /^(thin|medium|thick|-?[\d.]|calc\()/.test(b) ? d = b : m = b;
      else o === "0" && (d = "0");
      return s.flatMap((b) => [[`border-${b}-width`, d], [`border-${b}-style`, p], [`border-${b}-color`, m]]);
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
      const s = vi(ae(o.split("/")[0]));
      return eg.map((d, p) => [`border-${d}-radius`, s[p]]);
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
      return Qo("gap", o);
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
        bd.has(m) || m === "auto" ? d = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? s = m : p = m;
      return [["outline-width", s], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ae(o, ","), d = s.map((m) => ae(m).find((b) => !/^[\d.]+m?s$/.test(b) && !/^(ease|linear|step|cubic)/.test(b)) ?? "all"), p = s.map((m) => ae(m).find((b) => /^[\d.]+m?s$/.test(b)) ?? "0s");
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
function ag(n, l) {
  return n ? ae(n, ",").some((o) => {
    let c = o.trim().toLowerCase(), s = !1;
    c.startsWith("not ") && (s = !0, c = c.slice(4)), c.startsWith("only ") && (c = c.slice(5));
    const d = c.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const m = /^\((.+)\)$/.exec(p);
      if (!m) return !1;
      const b = m[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(b);
      if (x) {
        const [, M, N] = x, v = (z) => {
          const w = Ko(z, { viewport: l });
          return typeof w == "object" && "px" in w ? w.px : NaN;
        };
        switch (M) {
          case "min-width":
            return l.width >= v(N);
          case "max-width":
            return l.width <= v(N);
          case "min-height":
            return l.height >= v(N);
          case "max-height":
            return l.height <= v(N);
          case "hover":
          case "any-hover":
            return N.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return N.trim() === "fine";
          case "prefers-reduced-motion":
            return N.trim() === "no-preference";
          case "prefers-color-scheme":
            return N.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const C = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(b);
      if (C) {
        const M = C[1] === "width" ? l.width : l.height, N = Ko(C[3], { viewport: l }), v = typeof N == "object" && "px" in N ? N.px : NaN;
        switch (C[2]) {
          case ">=":
            return M >= v;
          case "<=":
            return M <= v;
          case ">":
            return M > v;
          case "<":
            return M < v;
          default:
            return M === v;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function ng(n, l) {
  const o = l[l.length - 1].compound;
  return ts(o)[0] ?? n;
}
function lg(n) {
  const l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = (s, d) => {
    s.forEach(({ compound: p }, m) => {
      const b = d && m === s.length - 1;
      for (const x of p.pseudos)
        if (ef.has(x.name) && (b ? l : o).add(x.name), x.list && x.name !== "not") for (const C of x.list) c(C, b);
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
function ig(n, l) {
  const o = (c, s) => {
    c.forEach(({ compound: d }, p) => {
      const m = s && p === c.length - 1, b = d.pseudos.filter((x) => ef.has(x.name)).map((x) => x.name);
      if (!m) for (const x of b) for (const C of ts(d)) l.add(`${x}:${C}`);
      for (const x of d.pseudos) if (x.list && x.name !== "not") for (const C of x.list) o(C, m);
    });
  };
  o(n, !0);
}
class rg {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const m = p[p.length - 1].compound, b = m.classes.length ? `.${m.classes[0]}` : m.tag && m.tag !== "*" ? m.tag : "*";
      this.index.has(b) || this.index.set(b, []), this.index.get(b).push(d);
    };
    let c = 0;
    const s = (d, p) => {
      for (const [m, b, x, C] of d)
        for (const M of Fo(m)) {
          let N;
          try {
            N = Io(M);
          } catch (w) {
            if (w instanceof ke) {
              this.skipped++;
              continue;
            }
            throw w;
          }
          const v = lg(N);
          ig(N, this.trackedStates);
          const z = { steps: N, media: b, layer: x, origin: p, order: c++, specificity: Zd(N), decls: C, states: v, source: p === 0 ? `ua:${N[N.length - 1].compound.tag ?? "*"}` : ng(M, N) };
          this.rules.push(z), o(z, N);
        }
    };
    s(Wh.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), s(l.rules, 1);
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
const og = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function sg(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [o, c] of Object.entries(n)) {
    if (c == null || c === "" || typeof c == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof c == "number" && c !== 0 && !og.has(s) && !s.startsWith("--") ? `${c}px` : String(c);
    l.push([s, d]);
  }
  return l;
}
function cg(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const o of ["width", "height"]) {
    const c = n.getAttribute(o);
    c !== null && l.push([o, /^[\d.]+$/.test(c) ? `${c}px` : c]);
  }
  return l;
}
const ug = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class dg {
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
        const m = s.ownerDocument?.activeElement;
        return !!m && m !== s.ownerDocument.body && typeof s.contains == "function" && s.contains(m);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!s.state?.focus && !s.state?.pointerFocus : !!s.state?.[d];
    };
    return this.sheet.candidates(l).filter((s) => (!s.media || s.media.every((d) => ag(d, this.viewport))) && Jd(l, s.steps, { state: c }));
  }
  compute(l, o, c = /* @__PURE__ */ new Set()) {
    const s = this.matching(l, c), d = [];
    for (const g of s)
      for (const [h, D, Z] of g.decls) d.push({ prop: h, value: D, important: Z ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of cg(l)) d.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of sg(l.inlineStyle ?? l.props?.style)) d.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(ug);
    const p = this.sheet.properties, m = Object.create(o?.customs ?? null), b = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const g of d) g.prop.startsWith("--") && x.set(g.prop, g.value);
    if (!o && this.theme) for (const g of tf) this.theme[g] && x.set(`--${g}`, `perchtoken(${g})`);
    const C = (g) => {
      if (b.has(g)) return b.get(g);
      const h = p[g];
      return h && !h.inherits ? h.initial ?? null : g in m ? m[g] : h?.initial ?? null;
    }, M = /* @__PURE__ */ new Set(), N = (g) => {
      if (!x.has(g)) return C(g);
      if (M.has(g)) return null;
      M.add(g);
      const h = Go(x.get(g), N);
      return M.delete(g), x.delete(g), b.set(g, h), (!p[g] || p[g].inherits) && (m[g] = h), h;
    };
    for (const g of [...x.keys()]) N(g);
    const v = /* @__PURE__ */ new Map();
    for (const g of d) {
      if (g.prop.startsWith("--")) continue;
      const h = Go(g.value, C);
      if (h === null) {
        for (const [D] of Qo(g.prop, "unset")) v.set(D, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [D, Z] of Qo(g.prop, h)) v.set(D, { value: Z, source: g.source, origin: g.origin });
    }
    const z = {}, w = {}, y = /* @__PURE__ */ new Set(), O = /* @__PURE__ */ new Set(), E = o?.values, j = { fontSize: E?.["font-size"] ?? qo, viewport: this.viewport }, G = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, j, z, E);
      const D = `${g}\0${h}\0${j.fontSize}`;
      let Z = this.parsed.get(D);
      return Z === void 0 && this.parsed.set(D, Z = this.parseValue(g, h, j, z, E)), Z;
    }, U = v.size ? [...Yo, ...[...v.keys()].filter((g) => !Ih.has(g))] : Yo;
    for (const g of U) {
      const h = v.get(g);
      let D = h?.value;
      const Z = Fh.has(g);
      if ((D === void 0 || D === "unset" || D === "revert" || D === "revert-layer") && (D = Z ? "inherit" : "initial"), h && (w[g] = h.source, h.origin !== 0 && y.add(g)), D === "inherit" && E && g in E) {
        z[g] = E[g], O.add(g);
        continue;
      }
      (D === "inherit" || D === "initial") && (D = Z ? nf[g] : af[g]), z[g] = G(g, D), g === "font-size" && (j.fontSize = z["font-size"]);
    }
    for (const g of ml) {
      const h = z[`border-${g}-style`];
      (h === "none" || h === "hidden") && (z[`border-${g}-width`] = { px: 0 });
    }
    z["outline-style"] === "none" && (z["outline-width"] = { px: 0 });
    const S = E?.display;
    return (S === "flex" || S === "inline-flex" || S === "grid" || S === "inline-grid") && z.position !== "absolute" && z.position !== "fixed" && (z.display = vd(z.display)), (z.position === "absolute" || z.position === "fixed") && (z.display = vd(z.display)), { values: z, sources: w, own: y, inherited: O, customs: m, rules: s, element: l };
  }
  parseValue(l, o, c, s, d) {
    const p = String(o).trim();
    switch (l) {
      case "font-size": {
        const m = p.toLowerCase(), b = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (b[m]) return b[m];
        if (m === "smaller") return c.fontSize / 1.2;
        if (m === "larger") return c.fontSize * 1.2;
        const x = an(m, { fontSize: c.fontSize, viewport: c.viewport });
        return !x || x.num ? c.fontSize : x.px + x.pct / 100 * c.fontSize;
      }
      case "font-weight": {
        const m = p.toLowerCase();
        if (m === "normal") return 400;
        if (m === "bold") return 700;
        if (m === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (m === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const b = parseFloat(m);
        return Number.isFinite(b) ? b : 400;
      }
      case "line-height": {
        const m = p.toLowerCase();
        if (m === "normal") return { normal: !0 };
        const b = an(m, { fontSize: c.fontSize, viewport: c.viewport });
        return b ? b.unitless ? { factor: b.num } : { px: b.px + b.pct / 100 * c.fontSize } : { normal: !0 };
      }
      case "font-family":
        return p;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const m = p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p);
        return Number.isFinite(m) ? m : parseFloat(l === "flex-shrink" || l === "opacity" ? 1 : 0);
      }
      case "color": {
        const m = Ni(p, (b) => this.themeHex(b));
        return m === "currentcolor" || !m ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : m;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const m = Ni(p, (b) => this.themeHex(b));
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
        return Ko(p, c);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function vd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Ti = (n) => n && n.rgba ? { value: tg(n.rgba), token: n.token ?? null } : null, fg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function mg(n, l) {
  const o = l?.(n);
  if (Number.isFinite(o)) return o;
  const c = Math.round(n * 100) / 100;
  return fg[c] ?? Math.round(n * 1.2);
}
function Ci(n, l) {
  const o = n["line-height"], c = n["font-size"];
  return o.normal ? mg(c, l) : o.factor !== void 0 ? o.factor * c : o.px;
}
const pg = (n) => ae(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const hg = "perch-native-description/1", On = Symbol("display"), ji = {
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
}, gg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of gg) ji[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ji.rounded = 0;
const bg = /* @__PURE__ */ new Set([
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
]), vg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, yg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, xg = (n) => yg.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : vg.test(n) ? ".SystemUIFont" : pg(n).split(",")[0].trim(), wg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, yd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, lf = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const c = n.parentElement;
  return c && c.tagName !== "body" ? `${lf(c)} > ${n.tagName}` : n.tagName;
};
class _g {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, o, c, s, d, p = "") {
    const m = `${l}|${o}|${c}|${s}`, b = this.map.get(m);
    if (b) {
      !b.elements.includes(d) && b.elements.length < 4 && b.elements.push(d), b.count++;
      return;
    }
    this.map.set(m, { kind: l, property: o, value: String(c), class: s ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
  }
  list() {
    return [...this.map.values()].sort((l, o) => l.kind < o.kind ? -1 : l.kind > o.kind ? 1 : l.property < o.property ? -1 : l.property > o.property ? 1 : 0);
  }
}
const ca = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, Sg = /^(text|search|url|email|tel|password|number)$/, kg = 162.13 / 12.8;
function zg(n, l) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const c = ae(o[1], ",").map((s) => an(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return c.length ? Math.min(...c) : void 0;
}
function Eg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = an(n.expr, { fontSize: l["font-size"] }), c = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + c) < 0.01;
}
function rf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const c = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = c && ae(c[2], ",").map((d) => d.trim());
    return !s || s.length > (c[1] ? 1 : 2) ? null : c[1] === "X" ? [s[0], "0"] : c[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const c = ae(String(o).trim(), " ").filter(Boolean);
    return c.length > 3 || c[2] !== void 0 && an(c[2], {})?.px ? null : [c[0], c[1] ?? "0"];
  }
  return [];
}
function xd(n, l, o, c = !1) {
  const s = n.values, d = rf(s);
  if (d?.length === 0) return;
  const p = s.transform && s.transform !== "none" ? "transform" : "translate", m = { fontSize: s["font-size"] }, b = (M, N) => {
    const v = an(M, m);
    if (!(!v || v.unitless && v.num))
      return v.pct ? typeof N == "number" ? v.px + v.pct / 100 * N : void 0 : v.px;
  }, x = d ? b(d[0], l.w) : void 0, C = d ? b(d[1], l.h) : void 0;
  if (x === void 0 || C === void 0) {
    o("unsupported", p, s[p], n.sources[p]);
    return;
  }
  if (c) {
    x && (l.left = x), C && (l.top = C);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), C && (l.mt = (l.mt ?? 0) + C);
}
function wd(n, l, o = null) {
  const c = n.values, s = {}, d = (E) => n.sources[E], p = (E) => n.sources[E] !== void 0, m = c.display;
  m === "none" ? s.display = "hidden" : m === "flex" || m === "inline-flex" ? s.display = "flex" : (m === "grid" || m === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", m, d("display"), "one-column flex column"), c["grid-template-columns"] && c["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", c["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const b = s.display === "flex";
  if (b && s.flex_direction !== "col") {
    const E = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[c["flex-direction"]] ?? "row";
    s.flex_direction = E;
  }
  if (b) {
    (c["flex-wrap"] === "wrap" || c["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const E = m === "grid" || m === "inline-grid", j = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[c["align-items"]];
    j && (s.items = j);
    let G = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[c["justify-content"]];
    if (E) {
      const g = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[c["justify-items"]];
      g && (s.items = g), c["align-items"] === "center" && (G = "center");
    }
    G && (s.justify = G);
    const U = ca(c["row-gap"]), S = ca(c["column-gap"]);
    typeof U == "number" && U && (s.gap_y = U), typeof S == "number" && S && !E && (s.gap_x = S);
  }
  c["flex-grow"] && (s.flex_grow = c["flex-grow"]), c["flex-shrink"] !== 1 && (s.flex_shrink = c["flex-shrink"]);
  const x = ca(c["flex-basis"]);
  x !== void 0 && x !== "auto" && (s.flex_basis = x);
  const C = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[c["align-self"]];
  C && (s.self = C);
  for (const [E, j] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const G = c[j], U = ca(G);
    if (U === void 0 && j === "width" && Eg(G, c)) {
      s.self = "stretch", l("approximated", j, G.expr, d(j), "stretched across its parent, inside its margins");
      continue;
    }
    const S = U === void 0 && /^max-/.test(j) ? zg(G, c["font-size"]) : void 0;
    if (S !== void 0) {
      s[E] = S, l("approximated", j, G.expr, d(j), "the fixed bound of min()");
      continue;
    }
    if (U === void 0) {
      typeof G == "object" && G.expr ? l("unsupported", j, G.expr, d(j), "no calc() in the engine") : typeof G == "string" && !["auto", "none"].includes(G) && l("unsupported", j, G, d(j));
      continue;
    }
    U !== "auto" && (s[E] = U);
  }
  const M = ["top", "right", "bottom", "left"];
  for (const E of M) {
    const j = E[0];
    for (const [G, U] of [["p", "padding"], ["m", "margin"]]) {
      const S = c[`${U}-${E}`], g = ca(S);
      if (g === void 0) {
        S?.expr && l("unsupported", `${U}-${E}`, S.expr, d(`${U}-${E}`), "no calc() in the engine");
        continue;
      }
      g !== 0 && (s[`${G}${j}`] = g);
    }
  }
  const N = c.position;
  if (N === "absolute" || N === "fixed") {
    s.position = "absolute", N === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const E of M) {
      const j = ca(c[E]);
      j !== void 0 && j !== "auto" && (s[E] = j);
    }
    if (N === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const E = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, E) : E;
    }
    xd(n, s, l);
  } else N === "sticky" ? l("unsupported", "position", "sticky", d("position")) : rf(c)?.length !== 0 && (s.position = "relative", xd(n, s, l, !0));
  c["z-index"] !== "auto" && p("z-index") && l("unsupported", "z-index", c["z-index"], d("z-index"), "paint order is tree order");
  for (const [E, j] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const G = c[j];
    G === "hidden" || G === "clip" ? s[E] = "hidden" : (G === "auto" || G === "scroll") && (s[E] = "scroll");
  }
  (c.visibility === "hidden" || c.visibility === "collapse") && (s.visibility = "invisible");
  const v = c["background-color"];
  v?.unreadable ? l("unsupported", "background-color", v.unreadable, d("background-color")) : v?.rgba && v.rgba[3] > 0 && (s.bg = Ti(v)), c["background-image"] && c["background-image"] !== "none" && l("unsupported", "background-image", c["background-image"], d("background-image"));
  const z = M.map((E) => ca(c[`border-${E}-width`]) || 0), w = [];
  M.forEach((E, j) => {
    if (!z[j]) return;
    s[`border_${E[0]}`] = z[j];
    const G = c[`border-${E}-style`];
    G !== "solid" && l("approximated", `border-${E}-style`, G, d(`border-${E}-style`), "drawn solid");
    const U = Ti(c[`border-${E}-color`]);
    U && w.push(U);
  }), w.length && (s.border_color = w[0], w.some((E) => E.value !== w[0].value) && l("approximated", "border-color", w.map((E) => E.value).join(" "), d("border-top-color"), "one border colour"));
  const y = ["top-left", "top-right", "bottom-right", "bottom-left"].map((E) => ca(c[`border-${E}-radius`]) || 0);
  y.every((E) => E === y[0]) ? y[0] && (s.rounded = y[0]) : ["tl", "tr", "br", "bl"].forEach((E, j) => {
    y[j] && (s[`rounded_${E}`] = y[j]);
  }), c.opacity !== 1 && (s.opacity = Math.round(c.opacity * 1e3) / 1e3);
  const O = c["box-shadow"];
  if (O && O !== "none" && ae(O, ",").some((E) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(E.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", O, d("box-shadow"), "the engine's large shadow preset")), c.cursor && c.cursor !== "auto" && !n.inherited.has("cursor")) {
    const E = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[c.cursor];
    E ? s.cursor = E : l("unsupported", "cursor", c.cursor, d("cursor"));
  }
  return c["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), c["text-decoration-line"] === "underline" ? s.underline = !0 : c["text-decoration-line"] && c["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", c["text-decoration-line"], d("text-decoration-line")), s;
}
const Ng = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function of(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((o) => Ng[o]);
  return l.every(Boolean) ? l.join(",") : null;
}
function _d(n, l) {
  const o = n.values, c = o["line-height"];
  return {
    text_color: Ti(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: of(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: c.factor !== void 0 ? { factor: c.factor } : { px: Math.round(Ci(o, l) * 1e3) / 1e3 },
    font_family: xg(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const Sd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, sf = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function kd(n, l, o) {
  const c = {}, s = (m, b) => b.some((x) => !n.inherited.has(x));
  for (const [m, b] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(m, b) || !sf(l[m], o[m])) && (c[m] = l[m]);
  const d = Sd(l.line_height, l.text_size), p = o.line_height ? Sd(o.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (c.line_height = l.line_height), c;
}
const Tg = (n, l) => ({ ...n, ...l });
function zd(n, l) {
  const o = {};
  for (const [c, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[c] = s.value, s.token && (l[c] = s.token)) : c === "line_height" ? o[c] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : c === "italic" ? s && (o.italic = !0) : o[c] = s;
  return o.italic === !1 && delete o.italic, o;
}
function Cg(n, l) {
  const o = {};
  for (const c of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[c], d = l[c];
    sf(s, d) || (o[c] = d === void 0 ? c in ji ? ji[c] : null : d);
  }
  return o;
}
function Ed(n, l) {
  const o = n.values;
  for (const [c, s] of Object.entries(n.sources)) {
    if (c.startsWith("--") || bg.has(c) || s.startsWith("ua:")) continue;
    const d = o[c];
    switch (c) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", c, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && of(d) === null && l("unsupported", c, d, s);
        break;
      case "text-transform":
        d !== "none" && l("approximated", c, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        c === "transition-property" && p && ae(p, ",").some((m) => parseFloat(m) > 0) && o["transition-property"] !== "none" && l("unsupported", "transition", `${o["transition-property"]} ${p}`, s, "changes are instant (the engine animates only opacity and size)");
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
        o["outline-style"] !== "none" && c === "outline-style" && l("unsupported", "outline", `${ca(o["outline-width"])}px ${o["outline-style"]} ${Ti(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function jg(n, l, o, c) {
  const s = lf(n), d = [], p = (y, O, E, j, G) => d.push([y, O, E, j ?? "(user agent)", s, G]), m = c.cascade.compute(n, l), b = {}, x = wd(m, p, c.viewport);
  Ed(m, p);
  const C = _d(m, c.measure), M = kd(m, C, o), N = zd({ ...x, ...M }, b), v = {}, z = c.cascade.matching(n, "*").filter((y) => y.states.subject.size);
  for (const [y, O] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!z.some((S) => O.some((g) => S.states.subject.has(g)))) continue;
    const E = c.cascade.compute(n, l, new Set(O)), j = {}, G = zd({ ...wd(E, () => {
    }), ...kd(E, _d(E, c.measure), o) }, j);
    y === "focus" && Ed(E, p);
    const U = Cg(N, G);
    if (Object.keys(U).length) {
      v[y] = U;
      const S = Object.fromEntries(Object.entries(j).filter(([g]) => g in U));
      Object.keys(S).length && (v[`${y}_tokens`] = S);
    }
  }
  if (c.cascade.sheet.tracks(n, "hover") && (v.track_hover = !0), /tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (v.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (v.break_anywhere = !0), x.overflow_y === "scroll") {
    const y = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    y > 0 && (v.scrollbar = y);
  }
  m.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (v.blocks_pointer = !0);
  const w = Object.entries(wg).filter(([, y]) => y.some((O) => typeof n.props[O] == "function")).map(([y]) => y);
  return !w.includes("click") && Uo(n) && w.push("click"), w.length && (v.events = w), { computed: m, style: N, tokens: b, extra: v, meta: Rg(n), reports: d, childText: Tg(o, M), where: s };
}
function cf(n, l, o, c, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let p = c.cache.get(n);
  (!p || p.key !== d) && c.cache.set(n, p = { key: d, part: jg(n, l, o, c) });
  const { computed: m, tokens: b, extra: x, reports: C, childText: M, where: N } = p.part;
  for (const h of C) c.findings.add(...h);
  const v = (h, D, Z, ot, $) => c.findings.add(h, D, Z, ot, N, $), z = { ...p.part.style }, w = { kind: "div", id: n.id, style: z, tokens: b, meta: p.part.meta, ...x };
  Object.defineProperty(w, On, { value: m.values.display }), n.measured && n.ownerDocument?.measureKey && (w.measure = n.ownerDocument.measureKey(n));
  const y = n.tagName;
  if (y === "svg")
    return w.kind = n.props["data-perch-image"] ? "image" : "svg", w.markup = Dg(n), w;
  if (y === "input" || y === "textarea" || y === "select") {
    w.kind = "input", w.input_type = y === "input" ? String(n.props.type ?? "text") : y;
    for (const h of ["placeholder", "checked", "disabled"]) n.props[h] !== void 0 && (w[h] = n.props[h]);
    if (/^(checkbox|radio)$/.test(w.input_type) && (w.checked = n.checked), y !== "select" && (w.value = n.value), y === "input" && Sg.test(w.input_type) && (w.field_w = kg * m.values["font-size"]), y === "textarea" && z.h === void 0) {
      const h = m.values, D = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, Z = ($) => h[`border-${$}-style`] === "none" ? 0 : D(h[`border-${$}-width`]), ot = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      z.h = ot * Ci(h, c.measure) + D(h["padding-top"]) + D(h["padding-bottom"]) + Z("top") + Z("bottom");
    }
    return w;
  }
  if (y === "img") {
    w.kind = "image", w.src = n.props.src ?? null;
    for (const [h, D] of [["width", "w"], ["height", "h"]]) {
      const Z = Number(n.props[h]);
      z[D] === void 0 && n.props[h] != null && Number.isFinite(Z) && (z[D] = Z);
    }
    return w;
  }
  const O = m.values["text-transform"], E = [];
  let j = !1, G = !1;
  for (const h of n.childNodes) {
    if (h instanceof Ui) {
      if (h.hidden || h.data === "") continue;
      j = !0;
      const ot = E[E.length - 1];
      if (ot?.kind === "text")
        ot.source = (ot.source ?? ot.text) + h.data, ot.text = Nd(ot.source, O), ot.text === ot.source && delete ot.source;
      else {
        const $ = Nd(h.data, O);
        E.push($ === h.data ? { kind: "text", text: $ } : { kind: "text", text: $, source: h.data });
      }
      continue;
    }
    if (!(h instanceof ne)) continue;
    const D = cf(h, m, M, c, d), Z = D[On];
    Z === "inline" || Z === "inline-block" || Z === "inline-flex" ? j = !0 : Z !== "none" && (G = !0), E.push(D);
  }
  const U = E.some((h) => h.kind !== "text"), S = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][On]) ? E[0] : null;
  if (!z.display && S) {
    const h = c.cache.get(n.childNodes.find((Z) => Z.id === S.id))?.part.computed, D = h ? Ai(m.values, c.measure) - Og(h.values, c.measure, S) : 0;
    z.display = "flex", z.flex_direction = "col", z.items = "start", D > 0 && (S.style.mt = Math.round(((S.style.mt ?? 0) + D) * 100) / 100), v("approximated", "display", `${m.values.display} holding one ${S[On]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!z.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][On] === "inline" && typeof E[0].style.h == "number") {
    const h = E[0], D = Ai(m.values, c.measure), Z = Ci(m.values, c.measure) - D, ot = ($) => Math.round($ * 100) / 100;
    z.display = "flex", z.flex_direction = "col", z.items = "start", D > h.style.h && (h.style.mt = ot((h.style.mt ?? 0) + D - h.style.h)), Z > 0 && (h.style.mb = ot((h.style.mb ?? 0) + Z)), v("approximated", "display", `${m.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!z.display && j && U) {
    if (z.display = "flex", z.flex_direction = G ? "col" : "row", !G) z.items = "baseline";
    else for (const h of E) h.kind !== "text" && /^inline-(block|flex)$/.test(h[On]) && !h.style.self && (h.style.self = "start");
    v("approximated", "display", `${m.values.display} with inline content`, "(inline formatting)", G ? "a column of its children" : "a row on the text baseline");
  }
  const g = m.values["letter-spacing"]?.px;
  if (g)
    for (let h = 0; h < E.length; h++) {
      const D = E[h];
      if (D.kind !== "text") continue;
      const Z = Math.round(g * [...D.text].length * 1e3) / 1e3;
      E[h] = { kind: "div", style: { pr: Z }, tokens: {}, children: [D] };
    }
  return w.children = E, w;
}
function Mg(n, l) {
  if (!l) return null;
  let c = (l.self ? n : l.closest ? Ld(n, l.closest) : l.find ? pl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return c && l.strip && c.startsWith(l.strip) && (c = c.slice(l.strip.length)), c;
}
function Ag(n, l, o) {
  const c = l.map((p) => [p, Di(p.selector)]), s = /* @__PURE__ */ new Map(), d = (p) => {
    for (const m of p.children) {
      const b = o.get(m.id);
      if (b)
        for (const [x, C] of c) {
          const M = x.textRange ? "range_name" : "name";
          if (x.textRange && b[M] != null || !C.some((w) => Jd(m, w))) continue;
          const N = Mg(m, x.key), v = N == null ? s.get(x.name) ?? 0 : 0;
          N == null && s.set(x.name, v + 1);
          const z = N != null ? `${x.name}:${N}` : v ? `${x.name}@${v}` : x.name;
          b[M] == null ? b[M] = z : (b.also ??= []).push(z);
        }
      d(m);
    }
  };
  d(n.documentElement);
}
const Mi = 0.9521, uf = 0.2256, Ai = (n, l) => (Ci(n, l) - (Mi + uf) * n["font-size"]) / 2 + Mi * n["font-size"];
function Og(n, l, o) {
  const c = (b) => b && typeof b == "object" && "px" in b ? b.px : 0, s = n["border-top-style"] === "none" ? 0 : c(n["border-top-width"]), d = o?.children ?? [], p = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, m = p ? Math.max(Ai(n, l), (p.style.mt ?? 0) + p.style.h) : Ai(n, l);
  return c(n["padding-top"]) + s + m;
}
const Nd = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, df = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Rg(n) {
  const l = {};
  for (const [o, c] of Object.entries(n.props)) {
    if (df.has(o) || typeof c == "function" || c === void 0 || c === null || typeof c == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (c === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    l[d] = typeof c == "boolean" ? s ? String(c) : "" : String(c);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const Hg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Td = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Dg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (o) => {
    const c = [];
    for (const [d, p] of Object.entries(o.props))
      df.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || c.push(`${Hg(d)}="${Td(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && c.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof Ui ? Td(d.data) : l(d)).join("");
    return `<${o.tagName}${c.length ? ` ${c.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return l(n);
}
function Ug(n) {
  const l = n.theme?.() ?? {}, o = {};
  for (const c of tf) l[c] && (o[c] = l[c]);
  return o;
}
const Bg = { font_features: "" };
function qg(n, l, o, c = {}, s = null) {
  const d = Ug(l), p = l.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([d, p]);
  (c.look !== m || c.sheet !== o) && Object.assign(c, { look: m, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new dg(o, { theme: d, viewport: p }), top: null });
  const { cascade: b, cache: x } = c, C = { cascade: b, cache: x, viewport: p, findings: new _g(), measure: l.lineHeight ? (v) => l.lineHeight(v) : null };
  c.top ??= b.compute(n.body, b.compute(n.documentElement, null));
  const M = n.body.children.map((v) => cf(v, c.top, Bg, C));
  if (s?.length) {
    const v = /* @__PURE__ */ new Map(), z = (w) => {
      w.id && v.set(w.id, w);
      for (const y of w.children ?? []) z(y);
    };
    M.forEach(z), Ag(n, s, v);
  }
  const N = /* @__PURE__ */ new Set();
  for (const v of [n, n.defaultView])
    for (const { type: z } of v?.listeners ?? []) yd[z] && N.add(yd[z]);
  return { schema: hg, root: M[0] ?? null, overlays: M.slice(1), document_events: [...N].sort(), unsupported: C.findings.list() };
}
const Yg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Gg = null;
const Kg = () => Gg ??= new rg(Yg);
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
function Qg(n, l) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const c of o) {
    if (c === "children") continue;
    const s = n[c], d = l[c];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(c === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((m) => s[m] === d[m])))
      return !0;
  }
  return !1;
}
const Vg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Cd(n, l) {
  for (const o of kh(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const Xg = {
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
  createInstance: (n, l, o) => Cd(new ne(n, l, o.ownerDocument), l),
  createTextInstance: (n, l) => new Ui(n),
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
    Qg(o, c) && n.touch();
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
  bindToConsole: (n, l) => Function.prototype.bind.call(console[n], console, ...l)
}, Se = Zh(Xg), Bi = (n, l, o = null) => Se.createPortal(n, l, null, o), Zg = {
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
class Jg {
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
  if (n instanceof ne) {
    const c = Zg[l.type], s = c && n.props[o ? `${c}Capture` : c];
    typeof s == "function" && s(l);
  }
}
function Yv(n, l, o = {}) {
  const { document: c, window: s, globals: d } = Ch(n), p = new ne("div", { id: "root", style: o.container ?? {} }, c);
  c.body.appendChild(p);
  const m = [];
  let b = null;
  const x = () => [c, s].map((S) => S.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let C = "";
  const M = {}, N = `m${Math.random().toString(36).slice(2, 10)}:`;
  let v = 0, z = -1;
  c.measureKey = (S) => N + S.id, c.stale = () => z !== v, c.computed = (S) => {
    if (!M.cascade || !M.top) return null;
    const g = [];
    for (let D = S; D instanceof ne && D !== c.body; D = D.parentNode) g.unshift(D);
    let h = M.top;
    for (const D of g) h = M.cascade.compute(D, h);
    return h.values;
  };
  const w = () => (v += 1, b = qg(c, n, Kg(), M, o.names), C = x(), n.render?.(b), b), y = () => {
    Se.flushPassiveEffects(), Se.flushSyncWork(), x() !== C && w();
  };
  c.afterCommit = w;
  const O = (S) => {
    m.push(S), n.error?.(S);
  }, E = Se.createContainer(p, hl.ConcurrentRoot, null, !1, null, "", O, O, O, null);
  Se.updateContainerSync(mt.createElement(l, o.props ?? {}), E, null, null), Se.flushSyncWork(), y();
  const j = (S) => {
    const g = (h) => {
      if (h.id === S) return h;
      for (const D of h.children) {
        const Z = g(D);
        if (Z) return Z;
      }
      return null;
    };
    return g(c.documentElement);
  }, G = (S) => {
    const g = tn;
    tn = hl.DiscreteEventPriority;
    try {
      return S();
    } finally {
      tn = g, Se.flushSyncWork(), y();
    }
  }, U = {
    document: c,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: p,
    errors: m,
    /** The latest description (after the last commit or state change). */
    get description() {
      return b;
    },
    describe: w,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(S, g, h = {}) {
      const D = typeof S == "string" ? j(S) : S;
      if (!D) return !1;
      const Z = new Jg(g, h, D), ot = [];
      for (let wt = D; wt; wt = wt.parentNode) ot.push(wt);
      const $ = [...ot, c, s];
      G(() => {
        for (let wt = $.length - 1; wt > 0 && !Z.propagationStopped; wt--) yi($[wt], Z, !0);
        Z.propagationStopped || (yi(D, Z, !0), Z.propagationStopped || yi(D, Z, !1));
        for (let wt = 1; wt < $.length && !Z.propagationStopped; wt++) yi($[wt], Z, !1);
      });
      const Et = g === "click" && !Z.defaultPrevented ? Uo(D) : null;
      return Et && U.dispatch(Et, "submit", {}), !Z.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(S) {
      const g = c.activeElement && c.activeElement !== c.body ? c.activeElement : c.body;
      if (!U.dispatch(g, "keydown", S)) return !0;
      const D = S.key === "Enter" && !S.isComposing ? Uo(g, !0) : null;
      if (D)
        return U.dispatch(D, "submit", {}), !0;
      if (!$d(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((S.ctrlKey || S.metaKey) && !S.altKey && !S.shiftKey && S.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (S.ctrlKey || S.metaKey) return !1;
      const Z = g.selectedAll;
      g.selectedAll = !1;
      const ot = g.value, Et = S.key === "Backspace" || Z && S.key === "Delete" ? Z ? "" : ot.slice(0, -1) : [...S.key].length === 1 ? (Z ? "" : ot) + S.key : ot;
      return Et === ot ? !1 : (g.value = Et, U.dispatch(g, "input", { data: S.key }), U.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), w(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(S, g) {
      const h = j(S);
      h && (h.bounds = { x: g.x, y: g.y, width: g.width, height: g.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(S) {
      const g = j(S);
      if (!g || g.props.disabled || !U.dispatch(S, "click", { button: 0, detail: 1 })) return;
      const h = g.props.type === "radio";
      h && g.checked || (g.checked = h ? !0 : !g.checked, U.dispatch(S, "input", {}), U.dispatch(S, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), w());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(S, g = {}) {
      const h = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const D of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) U.dispatch(S, D, h);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (S) => !!j(S)?.state.hover,
    hover(S, g) {
      const h = j(S);
      !h || h.state.hover === g || (h.state.hover = g, h.touch(), w());
    },
    focus(S) {
      const g = j(S);
      g && (G(() => {
        const h = c.activeElement;
        h && h !== g && h !== c.body && U.dispatch(h, "blur"), c.focus(g), U.dispatch(g, "focus");
      }), w());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(S) {
      let h = typeof S == "string" ? j(S) : S;
      for (; h && !(h instanceof ne && typeof h.props.onKeyDown == "function" && Vg(h)); ) h = h.parentNode;
      !h || h === c.activeElement || (U.focus(h.id), h.state.pointerFocus = !0, h.touch(), w());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return z = v, c.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const S = c.retries.splice(0);
      for (const g of S) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: y,
    update(S) {
      Se.updateContainerSync(mt.createElement(l, S ?? {}), E, null, null), Se.flushSyncWork(), y();
    },
    unmount() {
      Se.updateContainerSync(null, E, null, null), Se.flushSyncWork(), Se.flushPassiveEffects(), c.afterCommit = null, c.retries.length = 0, n.forgetBounds?.(N);
    }
  };
  return U;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const ff = (n) => Se.flushSyncFromReconciler(n), Lg = { createPortal: Bi, flushSync: ff }, Gv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Bi,
  default: Lg,
  flushSync: ff
}, Symbol.toStringTag, { value: "Module" }));
function mf(n) {
  var l, o, c = "";
  if (typeof n == "string" || typeof n == "number") c += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (o = mf(n[l])) && (c && (c += " "), c += o);
  } else for (o in n) n[o] && (c && (c += " "), c += o);
  return c;
}
function pf() {
  for (var n, l, o = 0, c = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (l = mf(n)) && (c && (c += " "), c += l);
  return c;
}
const Wg = (n, l) => {
  const o = new Array(n.length + l.length);
  for (let c = 0; c < n.length; c++)
    o[c] = n[c];
  for (let c = 0; c < l.length; c++)
    o[n.length + c] = l[c];
  return o;
}, Fg = (n, l) => ({
  classGroupId: n,
  validator: l
}), hf = (n = /* @__PURE__ */ new Map(), l = null, o) => ({
  nextPart: n,
  validators: l,
  classGroupId: o
}), Oi = "-", jd = [], Ig = "arbitrary..", $g = (n) => {
  const l = t0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: c
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return Pg(p);
      const m = p.split(Oi), b = m[0] === "" && m.length > 1 ? 1 : 0;
      return gf(m, b, l);
    },
    getConflictingClassGroupIds: (p, m) => {
      if (m) {
        const b = c[p], x = o[p];
        return b ? x ? Wg(x, b) : b : x || jd;
      }
      return o[p] || jd;
    }
  };
}, gf = (n, l, o) => {
  if (n.length - l === 0)
    return o.classGroupId;
  const s = n[l], d = o.nextPart.get(s);
  if (d) {
    const x = gf(n, l + 1, d);
    if (x) return x;
  }
  const p = o.validators;
  if (p === null)
    return;
  const m = l === 0 ? n.join(Oi) : n.slice(l).join(Oi), b = p.length;
  for (let x = 0; x < b; x++) {
    const C = p[x];
    if (C.validator(m))
      return C.classGroupId;
  }
}, Pg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), o = l.indexOf(":"), c = l.slice(0, o);
  return c ? Ig + c : void 0;
})(), t0 = (n) => {
  const {
    theme: l,
    classGroups: o
  } = n;
  return e0(o, l);
}, e0 = (n, l) => {
  const o = hf();
  for (const c in n) {
    const s = n[c];
    es(s, o, c, l);
  }
  return o;
}, es = (n, l, o, c) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const p = n[d];
    a0(p, l, o, c);
  }
}, a0 = (n, l, o, c) => {
  if (typeof n == "string") {
    n0(n, l, o);
    return;
  }
  if (typeof n == "function") {
    l0(n, l, o, c);
    return;
  }
  i0(n, l, o, c);
}, n0 = (n, l, o) => {
  const c = n === "" ? l : bf(l, n);
  c.classGroupId = o;
}, l0 = (n, l, o, c) => {
  if (r0(n)) {
    es(n(c), l, o, c);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Fg(o, n));
}, i0 = (n, l, o, c) => {
  const s = Object.entries(n), d = s.length;
  for (let p = 0; p < d; p++) {
    const [m, b] = s[p];
    es(b, bf(l, m), o, c);
  }
}, bf = (n, l) => {
  let o = n;
  const c = l.split(Oi), s = c.length;
  for (let d = 0; d < s; d++) {
    const p = c[d];
    let m = o.nextPart.get(p);
    m || (m = hf(), o.nextPart.set(p, m)), o = m;
  }
  return o;
}, r0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, o0 = (n) => {
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
}, Vo = "!", Md = ":", s0 = [], Ad = (n, l, o, c, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: o,
  maybePostfixModifierPosition: c,
  isExternal: s
}), c0 = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: o
  } = n;
  let c = (s) => {
    const d = [];
    let p = 0, m = 0, b = 0, x;
    const C = s.length;
    for (let w = 0; w < C; w++) {
      const y = s[w];
      if (p === 0 && m === 0) {
        if (y === Md) {
          d.push(s.slice(b, w)), b = w + 1;
          continue;
        }
        if (y === "/") {
          x = w;
          continue;
        }
      }
      y === "[" ? p++ : y === "]" ? p-- : y === "(" ? m++ : y === ")" && m--;
    }
    const M = d.length === 0 ? s : s.slice(b);
    let N = M, v = !1;
    M.endsWith(Vo) ? (N = M.slice(0, -1), v = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      M.startsWith(Vo) && (N = M.slice(1), v = !0)
    );
    const z = x && x > b ? x - b : void 0;
    return Ad(d, v, N, z);
  };
  if (l) {
    const s = l + Md, d = c;
    c = (p) => p.startsWith(s) ? d(p.slice(s.length)) : Ad(s0, !1, p, void 0, !0);
  }
  if (o) {
    const s = c;
    c = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return c;
}, u0 = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, c) => {
    l.set(o, 1e6 + c);
  }), (o) => {
    const c = [];
    let s = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], m = p[0] === "[", b = l.has(p);
      m || b ? (s.length > 0 && (s.sort(), c.push(...s), s = []), c.push(p)) : s.push(p);
    }
    return s.length > 0 && (s.sort(), c.push(...s)), c;
  };
}, d0 = (n) => ({
  cache: o0(n.cacheSize),
  parseClassName: c0(n),
  sortModifiers: u0(n),
  postfixLookupClassGroupIds: f0(n),
  ...$g(n)
}), f0 = (n) => {
  const l = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let c = 0; c < o.length; c++)
      l[o[c]] = !0;
  return l;
}, m0 = /\s+/, p0 = (n, l) => {
  const {
    parseClassName: o,
    getClassGroupId: c,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = l, m = [], b = n.trim().split(m0);
  let x = "";
  for (let C = b.length - 1; C >= 0; C -= 1) {
    const M = b[C], {
      isExternal: N,
      modifiers: v,
      hasImportantModifier: z,
      baseClassName: w,
      maybePostfixModifierPosition: y
    } = o(M);
    if (N) {
      x = M + (x.length > 0 ? " " + x : x);
      continue;
    }
    let O = !!y, E;
    if (O) {
      const g = w.substring(0, y);
      E = c(g);
      const h = E && p[E] ? c(w) : void 0;
      h && h !== E && (E = h, O = !1);
    } else
      E = c(w);
    if (!E) {
      if (!O) {
        x = M + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (E = c(w), !E) {
        x = M + (x.length > 0 ? " " + x : x);
        continue;
      }
      O = !1;
    }
    const j = v.length === 0 ? "" : v.length === 1 ? v[0] : d(v).join(":"), G = z ? j + Vo : j, U = G + E;
    if (m.indexOf(U) > -1)
      continue;
    m.push(U);
    const S = s(E, O);
    for (let g = 0; g < S.length; ++g) {
      const h = S[g];
      m.push(G + h);
    }
    x = M + (x.length > 0 ? " " + x : x);
  }
  return x;
}, h0 = (...n) => {
  let l = 0, o, c, s = "";
  for (; l < n.length; )
    (o = n[l++]) && (c = vf(o)) && (s && (s += " "), s += c);
  return s;
}, vf = (n) => {
  if (typeof n == "string")
    return n;
  let l, o = "";
  for (let c = 0; c < n.length; c++)
    n[c] && (l = vf(n[c])) && (o && (o += " "), o += l);
  return o;
}, g0 = (n, ...l) => {
  let o, c, s, d;
  const p = (b) => {
    const x = l.reduce((C, M) => M(C), n());
    return o = d0(x), c = o.cache.get, s = o.cache.set, d = m, m(b);
  }, m = (b) => {
    const x = c(b);
    if (x)
      return x;
    const C = p0(b, o);
    return s(b, C), C;
  };
  return d = p, (...b) => d(h0(...b));
}, b0 = [], Zt = (n) => {
  const l = (o) => o[n] || b0;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, yf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, xf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, v0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, y0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, x0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, w0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, _0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, S0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, ja = (n) => v0.test(n), pt = (n) => !!n && !Number.isNaN(Number(n)), Je = (n) => !!n && Number.isInteger(Number(n)), Ao = (n) => n.endsWith("%") && pt(n.slice(0, -1)), sa = (n) => y0.test(n), wf = () => !0, k0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  x0.test(n) && !w0.test(n)
), as = () => !1, z0 = (n) => _0.test(n), E0 = (n) => S0.test(n), N0 = (n) => !W(n) && !F(n), T0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), C0 = (n) => Oa(n, kf, as), W = (n) => yf.test(n), Pa = (n) => Oa(n, zf, k0), Od = (n) => Oa(n, U0, pt), j0 = (n) => Oa(n, Nf, wf), M0 = (n) => Oa(n, Ef, as), Rd = (n) => Oa(n, _f, as), A0 = (n) => Oa(n, Sf, E0), xi = (n) => Oa(n, Tf, z0), F = (n) => xf.test(n), fl = (n) => nn(n, zf), O0 = (n) => nn(n, Ef), Hd = (n) => nn(n, _f), R0 = (n) => nn(n, kf), H0 = (n) => nn(n, Sf), wi = (n) => nn(n, Tf, !0), D0 = (n) => nn(n, Nf, !0), Oa = (n, l, o) => {
  const c = yf.exec(n);
  return c ? c[1] ? l(c[1]) : o(c[2]) : !1;
}, nn = (n, l, o = !1) => {
  const c = xf.exec(n);
  return c ? c[1] ? l(c[1]) : o : !1;
}, _f = (n) => n === "position" || n === "percentage", Sf = (n) => n === "image" || n === "url", kf = (n) => n === "length" || n === "size" || n === "bg-size", zf = (n) => n === "length", U0 = (n) => n === "number", Ef = (n) => n === "family-name", Nf = (n) => n === "number" || n === "weight", Tf = (n) => n === "shadow", B0 = () => {
  const n = Zt("color"), l = Zt("font"), o = Zt("text"), c = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), m = Zt("container"), b = Zt("spacing"), x = Zt("radius"), C = Zt("shadow"), M = Zt("inset-shadow"), N = Zt("text-shadow"), v = Zt("drop-shadow"), z = Zt("blur"), w = Zt("perspective"), y = Zt("aspect"), O = Zt("ease"), E = Zt("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], G = () => [
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
  ], U = () => [...G(), F, W], S = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [F, W, b], D = () => [ja, "full", "auto", ...h()], Z = () => [Je, "none", "subgrid", F, W], ot = () => ["auto", {
    span: ["full", Je, F, W]
  }, Je, F, W], $ = () => [Je, "auto", F, W], Et = () => ["auto", "min", "max", "fr", F, W], wt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], jt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...h()], at = () => [ja, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], nt = () => [m, ja, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], B = () => [ja, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], q = () => [n, F, W], _ = () => [...G(), Hd, Rd, {
    position: [F, W]
  }], Y = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", R0, C0, {
    size: [F, W]
  }], P = () => [Ao, fl, Pa], tt = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    F,
    W
  ], lt = () => ["", pt, fl, Pa], xt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ut = () => [pt, Ao, Hd, Rd], Ra = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    z,
    F,
    W
  ], Ha = () => ["none", pt, F, W], Oe = () => ["none", pt, F, W], Re = () => [pt, F, W], da = () => [ja, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [sa],
      breakpoint: [sa],
      color: [wf],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [N0],
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
        aspect: ["auto", "square", ja, W, F, y]
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
      "container-named": [T0],
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
        overflow: S()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": S()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": S()
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
        z: [Je, "auto", F, W]
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
        order: [Je, "first", "last", "none", F, W]
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
        text: ["base", o, fl, Pa]
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
        font: [c, D0, j0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Ao, W]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [O0, M0, l]
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
        "line-clamp": [pt, "none", F, Od]
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
        tab: [Je, F, W]
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
          }, Je, F, W],
          radial: ["", F, W],
          conic: ["", Je, F, W]
        }, H0, A0]
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
        outline: ["", pt, fl, Pa]
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
        "inset-shadow": ["none", M, wi, xi]
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
        "text-shadow": ["none", N, wi, xi]
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
        "mask-radial-at": G()
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
          v,
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
        ease: ["linear", "initial", O, F, W]
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
        animate: ["none", E, F, W]
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
        perspective: [w, F, W]
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
        scale: Oe()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": Oe()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": Oe()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": Oe()
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
        skew: Re()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Re()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Re()
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
        zoom: [Je, F, W]
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
        stroke: [pt, fl, Pa, Od]
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
}, q0 = /* @__PURE__ */ g0(B0);
function Ae(...n) {
  return q0(pf(n));
}
function Y0(n, l, o) {
  return n.filter((c, s) => s !== l && (c.start + c.end) / 2 < o).length;
}
function G0(n, l, o, c) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const p = n[l + 1], m = n[l - 1], b = d.end - d.start + (p ? p.start - d.end : m ? d.start - m.end : 0);
  return n.forEach((x, C) => {
    l < o && C > l && C <= o ? s[C] = -b : o < l && C >= o && C < l && (s[C] = b);
  }), s[l] = Math.min(Math.max(c, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const Dd = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function K0(n, l) {
  for (let o = n.parentElement; o; o = o.parentElement) {
    const c = getComputedStyle(o)[l === "x" ? "overflowX" : "overflowY"];
    if ((c === "auto" || c === "scroll") && (l === "x" ? o.scrollWidth > o.clientWidth : o.scrollHeight > o.clientHeight)) return o;
  }
  return null;
}
function Q0(n, l, o, c) {
  const s = n[l] ? K0(n[l], o) : null, d = () => s ? o === "x" ? s.scrollLeft : s.scrollTop : 0, p = (y) => (o === "x" ? y.clientX : y.clientY) + d(), m = p(c), b = d(), x = n.map((y) => {
    const O = y.getBoundingClientRect();
    return o === "x" ? { start: O.left + b, end: O.right + b } : { start: O.top + b, end: O.bottom + b };
  }), C = n.map((y) => Dd.map((O) => y.style[O])), M = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, N = o === "x" ? "translateX" : "translateY";
  let v = !1;
  const z = { to: l };
  n.forEach((y, O) => {
    if (y.style.pointerEvents = "none", O !== l) {
      M || (y.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(y).position === "static" && (y.style.position = "relative"), y.style.zIndex = "30", y.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const w = (y, O) => {
    z.to = y, G0(x, l, y, O).forEach((E, j) => {
      n[j].style.transform = E ? `${N}(${E}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return z.to;
    },
    slot: (y) => Y0(x, l, p(y)),
    apply: (y, O) => {
      v || w(y, p(O) - m);
    },
    rest: () => {
      v || w(l, 0);
    },
    end: () => {
      v || (v = !0, n.forEach((y, O) => Dd.forEach((E, j) => {
        y.style[E] = C[O][j];
      })));
    }
  };
}
const V0 = 5;
let Oo = !1;
function X0(n, l) {
  if (n.button !== 0 || Oo) return;
  const o = { clientX: n.clientX, clientY: n.clientY }, c = n.currentTarget, s = n.pointerId;
  let d = null, p, m = !1;
  const b = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (z) => {
    if (m) return;
    m = !0, window.removeEventListener("pointermove", C), window.removeEventListener("pointerup", M), window.removeEventListener("pointercancel", N), window.removeEventListener("keydown", v, !0), window.removeEventListener("blur", N), c.removeEventListener("lostpointercapture", N);
    try {
      c.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    Oo = !1, document.body.style.cursor = b.cursor, document.body.style.userSelect = b.userSelect, d.end();
    const w = (y) => y.stopPropagation();
    window.addEventListener("click", w, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", w, !0), 0), p?.(), l.onEnd(z, d);
  }, C = (z) => {
    if (!d) {
      if (Math.hypot(z.clientX - o.clientX, z.clientY - o.clientY) < V0) return;
      const w = l.items();
      d = Q0(w, l.from(w), l.axis, o), Oo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        c.setPointerCapture(s);
      } catch {
      }
      c.addEventListener("lostpointercapture", N);
      const y = l.onStart?.();
      p = typeof y == "function" ? y : void 0;
    }
    l.onMove(z, d);
  }, M = () => x(!0), N = () => x(!1), v = (z) => {
    z.key === "Escape" && (z.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", C), window.addEventListener("pointerup", M), window.addEventListener("pointercancel", N), window.addEventListener("keydown", v, !0), window.addEventListener("blur", N);
}
const Cf = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ri = {
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
for (let n = 1; n <= 12; n++) Ri[`f${n}`] = `F${n}`;
const Z0 = Object.fromEntries(Object.entries(Ri).map(([n, l]) => [l, n])), J0 = {
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
function L0(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Z0[n];
}
const Ud = /* @__PURE__ */ new Map();
function jf(n, l = Cf) {
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
    else if (Ri[d]) s.code = Ri[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Ud.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = jf(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function W0(n, l = Cf) {
  const o = jf(n, l), c = F0(L0(o.code) ?? "");
  return l ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${c}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", c].filter(Boolean).join("+");
}
const F0 = (n) => J0[n] ?? n.toUpperCase(), Bd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, qd = pf, qi = (n, l) => (o) => {
  var c;
  if (l?.variants == null) return qd(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = l, p = Object.keys(s).map((x) => {
    const C = o?.[x], M = d?.[x];
    if (C === null) return null;
    const N = Bd(C) || Bd(M);
    return s[x][N];
  }), m = o && Object.entries(o).reduce((x, C) => {
    let [M, N] = C;
    return N === void 0 || (x[M] = N), x;
  }, {}), b = l == null || (c = l.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((x, C) => {
    let { class: M, className: N, ...v } = C;
    return Object.entries(v).every((z) => {
      let [w, y] = z;
      return Array.isArray(y) ? y.includes({
        ...d,
        ...m
      }[w]) : {
        ...d,
        ...m
      }[w] === y;
    }) ? [
      ...x,
      M,
      N
    ] : x;
  }, []);
  return qd(n, p, b, o?.class, o?.className);
}, I0 = qi(
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
), $0 = qi(
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
function P0({ className: n, ...l } = {}) {
  return Ae($0(l), n);
}
const Mf = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Af = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", tb = qi(`${Af} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function eb({ className: n, ...l } = {}) {
  return Ae(tb(l), n);
}
const Of = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", ab = qi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), nb = "my-1 h-px bg-overlay-0";
function lb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function ib({ size: n = 16, className: l }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function rb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Rf({ size: n = 14, className: l }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Yd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function ob({ state: n, error: l }) {
  return /* @__PURE__ */ zt.jsx(
    "span",
    {
      className: Ae("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Yd[n] ?? Yd.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function sb({ title: n, onClose: l, children: o, testId: c }) {
  return Bi(
    /* @__PURE__ */ zt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
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
const _i = 4, Ma = 8, cb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Gd = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function ub({ value: n, onChange: l, options: o, className: c, ariaLabel: s, testId: d, id: p, title: m, disabled: b, placeholder: x, freeText: C, onKeyDown: M }) {
  const N = mt.useId(), [v, z] = mt.useState(!1), [w, y] = mt.useState(-1), [O, E] = mt.useState(!1), j = mt.useRef(null), G = mt.useRef(null), [U, S] = mt.useState({}), g = mt.useRef({ text: "", at: 0 }), h = C && O && n ? o.filter((B) => Gd(B).toLowerCase().includes(n.toLowerCase()) || B.value.toLowerCase().includes(n.toLowerCase())) : o, D = o.find((B) => B.value === n), Z = (B) => `${N}-${B}`;
  function ot(B) {
    b || (y(B), z(!0));
  }
  function $() {
    z(!1), E(!1), y(-1);
  }
  function Et(B) {
    !B || B.disabled || (l(B.value), $());
  }
  function wt(B, q) {
    for (let _ = 1; _ <= h.length; _++) {
      const Y = (B + q * _ + h.length * _) % h.length;
      if (!h[Y].disabled) return Y;
    }
    return B;
  }
  const jt = () => h.findIndex((B) => !B.disabled), Q = () => h.length - 1 - [...h].reverse().findIndex((B) => !B.disabled);
  Bo(() => {
    if (!v || !j.current) {
      S((et) => et.left === void 0 ? et : {});
      return;
    }
    const B = j.current.getBoundingClientRect(), q = window.innerHeight - B.bottom - _i - Ma, _ = B.top - _i - Ma, Y = q < 160 && _ > q;
    S({
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
  }, [v, h.length]), Bo(() => {
    const B = G.current;
    if (!v || !B || U.left === void 0) return;
    const q = B.getBoundingClientRect().right, _ = window.innerWidth - Ma;
    q > _ && S((Y) => ({ ...Y, left: Math.max(Ma, Number(Y.left) - (q - _)) }));
  }, [v, U]), ua(() => {
    if (!v) return;
    const B = (q) => {
      const _ = q.target;
      (_ === document || _ instanceof Node && j.current && _.contains(j.current)) && $();
    };
    return window.addEventListener("resize", $), window.addEventListener("scroll", B, !0), () => {
      window.removeEventListener("resize", $), window.removeEventListener("scroll", B, !0);
    };
  }, [v]), ua(() => {
    const B = v && w >= 0 ? document.getElementById(Z(w)) : null, q = G.current;
    !B || !q || (B.offsetTop < q.scrollTop ? q.scrollTop = B.offsetTop : B.offsetTop + B.offsetHeight > q.scrollTop + q.clientHeight && (q.scrollTop = B.offsetTop + B.offsetHeight - q.clientHeight));
  }, [v, w]), Df(v, (B) => {
    B || $();
  }, j, G);
  function at(B) {
    if (B.nativeEvent.isComposing) return;
    const q = () => {
      B.preventDefault(), B.stopPropagation();
    }, { key: _ } = B;
    if (v) {
      if (_ === "Escape") {
        q(), $();
        return;
      } else if (_ === "Tab")
        $();
      else if (_ === "ArrowDown" || _ === "ArrowUp") {
        q(), h.length && y(w < 0 ? _ === "ArrowDown" ? jt() : Q() : wt(w, _ === "ArrowDown" ? 1 : -1));
        return;
      } else if (_ === "Home" && !C) {
        q(), y(jt());
        return;
      } else if (_ === "End" && !C) {
        q(), y(Q());
        return;
      } else if (_ === "Enter" || _ === " " && !C) {
        if (w >= 0 && h[w]) {
          q(), Et(h[w]);
          return;
        }
        if (!C) {
          q(), $();
          return;
        }
      } else if (!C && _.length === 1 && !B.metaKey && !B.ctrlKey && !B.altKey) {
        const Y = Date.now();
        g.current = { text: (Y - g.current.at > 600 ? "" : g.current.text) + _.toLowerCase(), at: Y };
        const et = Math.max(w, 0), P = [...h.slice(et + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, et + 1)].find((tt) => !tt.disabled && Gd(tt).toLowerCase().startsWith(g.current.text));
        P && (q(), y(h.indexOf(P)));
        return;
      }
    } else if (_ === "ArrowDown" || _ === "ArrowUp" || !C && (_ === "Enter" || _ === " ")) {
      q(), ot(Math.max(0, h.findIndex((Y) => Y.value === n)));
      return;
    }
    M?.(B);
  }
  const nt = {
    ref: (B) => {
      j.current = B;
    },
    id: p,
    title: m,
    disabled: b,
    "aria-label": s,
    "aria-expanded": v,
    "aria-controls": v ? N : void 0,
    "aria-activedescendant": v && w >= 0 ? Z(w) : void 0,
    "data-testid": d,
    onKeyDown: at
  };
  return /* @__PURE__ */ zt.jsxs(zt.Fragment, { children: [
    C ? /* @__PURE__ */ zt.jsx(
      "input",
      {
        ...nt,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: c,
        value: n,
        onChange: (B) => {
          l(B.target.value), E(!0), v ? y(-1) : (y(-1), z(!0));
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
        className: Ae("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", c),
        onClick: () => v ? $() : ot(Math.max(0, h.findIndex((B) => B.value === n))),
        children: [
          /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 flex-1 truncate", children: D ? D.label : x ?? "" }),
          /* @__PURE__ */ zt.jsx(Hf, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    v && h.length > 0 && Bi(
      /* @__PURE__ */ zt.jsx(
        "div",
        {
          ref: G,
          id: N,
          role: "listbox",
          "aria-label": s,
          className: Ae("z-[9999]", Of),
          style: U,
          onMouseDown: (B) => {
            B.preventDefault(), B.stopPropagation();
          },
          onClick: (B) => B.stopPropagation(),
          children: h.map((B, q) => /* @__PURE__ */ zt.jsxs(
            "div",
            {
              id: Z(q),
              role: "option",
              "aria-selected": B.value === n,
              "aria-disabled": B.disabled || void 0,
              "data-value": B.value,
              className: Ae(cb, q === w && !B.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                B.disabled || y(q);
              },
              onClick: () => Et(B),
              children: [
                /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 truncate", children: B.label }),
                B.value === n && /* @__PURE__ */ zt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const db = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", fb = `${db} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function Hf({ open: n, size: l = 12, className: o }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: o, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function mb(n) {
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
function pb(n) {
  const l = /* @__PURE__ */ new Map();
  for (const o of n)
    Zo(o, n) && l.set(o.parentSessionId, [...l.get(o.parentSessionId) ?? [], o]);
  return l.size ? n.filter((o) => !Zo(o, n)).flatMap((o) => [o, ...l.get(o.id) ?? []]) : n;
}
const Si = 6, Kd = 8;
function hb(n, l = {}) {
  const { minWidth: o = 220, align: c = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), p = window.innerWidth, m = window.innerHeight, b = c === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, x = d.top - Si - Kd, C = m - d.bottom - Si - Kd;
  return x >= s ? {
    position: "fixed",
    bottom: m - d.top + Si,
    ...b,
    minWidth: o,
    maxHeight: Math.min(x, m * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Si,
    ...b,
    minWidth: o,
    maxHeight: Math.min(C, m * 0.75),
    overflowY: "auto"
  };
}
function Df(n, l, o, c) {
  ua(() => {
    if (!n) return;
    function s(p) {
      const m = p.target, b = o.current?.contains(m) ?? !1, x = c.current?.contains(m) ?? !1;
      !b && !x && l(!1);
    }
    function d(p) {
      p.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function gb({ icon: n, fallback: l }) {
  const [o, c] = mt.useState(!1);
  return ua(() => c(!1), [n]), !n || o ? /* @__PURE__ */ zt.jsx(zt.Fragment, { children: l }) : /* @__PURE__ */ zt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => c(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const bb = "1.3.0";
let Ei = null;
const vb = (n) => {
  Ei = n;
};
function Nt() {
  const n = (typeof Ei == "function" ? Ei() : Ei) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const yb = (n) => Nt().subscribe?.(n) ?? (() => {
}), xb = hb, wb = globalThis.perch?.isMac !== !1, _b = (n) => W0(n, Nt().isMac !== !1), Sb = (n) => I0(n), kb = ({ className: n, ...l } = {}) => Ae(P0(l), n), zb = eb, Eb = (n) => ab(n), Nb = nb, Tb = Af, Cb = Mf, jb = (n) => Xo[n].color, Mb = (n, l) => Nt().shortcutFor?.(n, l) ?? null, Ab = (n) => Nt().shortcutLabel?.(n) ?? null, Yi = (n, l) => Nt().command(n, l ?? {}) !== !1, Ob = (n, l, o) => Nt().startSession?.(n, l, o), Rb = globalThis.perch?.pickFolder ? (n) => Nt().pickFolder(n) : null;
function me(n) {
  const l = mt.useRef(n);
  return l.current = n, mt.useSyncExternalStore(yb, () => l.current(Nt()));
}
const Uf = (n = {}) => me((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Hb = () => me((n) => n.hosts()), Db = () => me((n) => n.sessionFolders());
function Ub() {
  const n = me((l) => l.addProject?.() ?? Bb);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, o, c) => {
      l.trim() && n.status !== "pending" && Nt().addProjectFolder?.(l, o, c);
    },
    clear: () => Nt().clearAddProject?.()
  };
}
const Bb = Object.freeze({ status: "idle" }), Bf = "perch.lastAgentChoice", qb = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Yb = () => {
  const n = Nt().storage?.getItem(Bf);
  return n === "claude" || n === "codex" ? n : "claude";
}, Gb = Object.freeze({ items: [] });
function Kb() {
  const n = me((l) => l.notifications?.() ?? Gb);
  return mt.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Nt().command("notification.open", { id: l }),
    dismiss: (l) => Nt().command("notification.dismiss", { id: l })
  }), [n]);
}
function Qb(n) {
  const l = me((s) => s.agentChoices?.(n) ?? qb), [o, c] = mt.useState(Yb);
  return mt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: o,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (Nt().storage?.setItem(Bf, s), c(s));
    },
    manage: () => Nt().command("agents.manage", {})
  }), [l, o]);
}
function Vb(n) {
  ua(() => Nt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Xb(n) {
  const l = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return pb(l).map((o) => ({ session: o.session, nested: Zo(o, l) }));
}
function Zb({ id: n, plain: l, className: o }) {
  const c = me((x) => x.session(n));
  if (!c) return null;
  const s = c.state ?? mb(c), d = Xo[s]?.color ?? Xo.unknown.color, p = c.provider, m = p === "claude" || p === "claude-agent-teams" || p === "omp", b = l ? Ae("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Ae("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return mt.createElement(
    "span",
    { className: b, style: l ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: l ? p ?? "Agent" : `${p ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    mt.createElement("span", { className: Ae("inline-flex text-fg", m && "rounded-full bg-[#161616]") }, mt.createElement(qf, { provider: p, size: 14 }))
  );
}
function qf({ provider: n, size: l = 14 }) {
  const o = Nt().agentIcon?.(n, l) ?? null, c = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return mt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": c, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Jb = ({ children: n }) => mt.createElement(mt.Fragment, null, n);
function Lb(n, l) {
  const o = mt.useRef(l);
  return o.current = l, ua(() => {
    const c = Nt();
    if (!c.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [p, m] of Object.entries(o.current))
      s[p] = typeof m == "function" ? (...b) => o.current[p]?.(...b) : m;
    const d = c.openOverlay(n, s);
    return () => c.closeOverlay?.(d);
  }, [n]), null;
}
const ln = (n) => function(o) {
  return Lb(n, o);
}, Wb = ln("session-menu"), Fb = ln("new-session-menu"), Ib = ln("confirm");
let Yf = null;
const $b = (n) => {
  Yf = n;
};
function Pb(n) {
  return mt.createElement(Yf ?? Ib, n);
}
function tv({ className: n = fb, ...l }) {
  return mt.createElement(ub, { ...l, className: n });
}
let Jo = null;
const ev = (n) => {
  Jo = n;
}, av = ln("folder-browser");
function nv(n) {
  return Jo ? mt.createElement(Jo, { ...n, browse: (l) => Nt().browse(n.hostId, l) }) : mt.createElement(av, n);
}
const lv = ln("instructions"), iv = ln("memory"), rv = sb;
let ns = null;
const ov = (n) => {
  ns = n;
};
function sv(n) {
  if (ns) return mt.createElement(cv, n);
  const { hostId: l, path: o, className: c } = n, s = mt.useRef(null);
  return mt.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Ae("worktree-menu__btn", Mf, c),
      "data-testid": `worktree-menu-${l}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Nt().openOverlay?.("worktree", { hostId: l, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    mt.createElement(Rf, null)
  );
}
const Gf = "Perch did not answer.";
function ki(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Gf };
}
function cv({ hostId: n, path: l, className: o, worktrees: c, request: s = null, parentChoices: d, emptyAgent: p, ...m }) {
  const [b, x] = mt.useState(c), C = (O) => !!Nt().coreCan?.(O, n), M = Uf(), N = mt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!C("workspace.nest")) return [];
    const O = M?.projects?.find((G) => G.hostId === n && G.repoPath === l), E = [], j = (G, U) => {
      for (const S of G ?? [])
        U && E.push({ id: S.id, name: S.name, path: S.path }), j(S.children, !0);
    };
    return j(O?.workspaces, !1), E;
  }, [d, M, n, l]), v = !1, z = m.deleteSupported ?? C("worktree.delete"), w = m.startFromSupported ?? C("worktree.startFrom"), y = mt.useMemo(() => {
    const O = (E, j) => Nt().ask(E, { hostId: n, repoPath: l, ...j });
    return {
      list: async () => {
        const E = await O("worktree.list", {});
        return E?.type === "worktree.list.result" && x({ worktrees: E.worktrees ?? [], defaultRoot: E.defaultRoot ?? "", baseRef: E.baseRef, refs: E.refs ?? [] }), ki(E);
      },
      create: async ({ branch: E, newBranch: j, path: G, extra: U, agent: S }) => {
        const g = await O("worktree.create", { branch: E, newBranch: !!j, path: G ?? null, name: U?.name ?? null, startFrom: U?.startFrom ?? null, parentWorkspaceId: U?.parentWorkspaceId ?? null });
        return g?.type !== "worktree.done" ? { error: ki(g).error ?? Gf } : (S && g.path && Nt().startSession?.(n, g.path, S), {});
      },
      remove: async (E, j) => {
        const G = await O("worktree.remove", { path: E, force: !!j, deleteBranch: z });
        return { ...ki(G), preservedBranch: G?.type === "worktree.done" ? G.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (E, j) => ki(await O("worktree.branch.delete", { branch: E, expectedHead: j })),
      open: (E) => Nt().startSession?.(n, E, "terminal"),
      // The request stays as given: clearing it re-renders the menu while its opening effect waits for the "+"'s
      // box (`measured`), and that new render drops the wait, so the menu never opens. The effect runs once per
      // mount, so the request is taken once. ponytail: a caller that sends a request to a mounted menu (the leader
      // key's) needs a new object per request, which this keeps working with.
      takeRequest: () => {
      }
    };
  }, [n, l, z]);
  return mt.createElement(ns, {
    hostId: n,
    cwd: l,
    projectKey: `${n}:${l}`,
    className: o,
    worktrees: b,
    background: v,
    startFromSupported: w,
    deleteSupported: z,
    parentChoices: N,
    emptyAgent: p,
    request: s,
    actions: y
  });
}
const uv = (n, l) => {
  if (!Nt().followPointer?.(n)) return;
  const o = l.items();
  for (const c of o) c.getBoundingClientRect();
  o[0]?.parentElement?.getBoundingClientRect(), X0(n, l);
}, dv = () => me((n) => n.workspaceTabs()), fv = () => me((n) => n.statusLine()), mv = () => me((n) => n.zoom()), pv = () => me((n) => n.paneLook()), hv = () => me((n) => n.keybindings?.() ?? []), gv = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function bv(n) {
  const l = !!n?.keepFresh, o = me((s) => s.statusLine?.().connected ?? !1), c = me((s) => s.planUsage?.() ?? gv);
  return ua(() => {
    if (!l || !o) return;
    let s;
    const d = () => {
      Nt().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, o]), c;
}
const vv = () => Nt().command("usage.get", { force: !0 }), yv = (n) => Nt().command("usage.redeemReset", { accountId: n }), xv = () => Yi("app.zoom_reset"), wv = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, _v = (n, l, o) => Nt().beginTabDrag?.(n, l, o);
function Sv(n) {
  ua(() => Nt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const kv = (n) => Yi("browser.open", { workspaceId: n }), zv = (n, l) => Yi("file.open", { workspaceId: n, path: l }), Ev = () => null, Nv = () => null, Tv = ln("new-file"), Kv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: qf,
  Chevron: Hf,
  CloseIcon: rb,
  ConfirmDialog: Pb,
  Dialog: rv,
  EllipsisIcon: lb,
  FolderBrowser: nv,
  GearIcon: ib,
  HostStateDot: ob,
  InstructionsDialog: lv,
  MemoryDialog: iv,
  NewFilePrompt: Tv,
  NewSessionMenu: Fb,
  PageIcon: gb,
  PlusIcon: Rf,
  Select: tv,
  SessionDot: Zb,
  SessionMenu: Wb,
  Slot: Jb,
  TabDragLayer: Nv,
  TabMenu: Ev,
  WorktreeMenu: sv,
  agentStateColor: jb,
  anchoredPopoverStyle: xb,
  beginReorderDrag: uv,
  beginTabDrag: _v,
  bindHost: vb,
  buttonClass: zb,
  cn: Ae,
  drawConfirmationsInPlace: $b,
  drawFolderBrowserInPlace: ev,
  drawWorktreeInPlace: ov,
  ghostButton: Tb,
  iconButton: Cb,
  isMac: wb,
  keyLabel: _b,
  menuDividerClass: Nb,
  menuItemClass: Eb,
  menuPanel: Of,
  nestSessions: Xb,
  openBrowserTab: kv,
  openFileTab: zv,
  pickFolder: Rb,
  redeemUsageReset: yv,
  refreshUsage: vv,
  resetZoom: xv,
  rowActionClass: kb,
  runCommand: Yi,
  segmentClass: Sb,
  shortcutFor: Mb,
  shortcutLabel: Ab,
  startSession: Ob,
  tabStateClass: wv,
  useAddProject: Ub,
  useAddProjectRequest: Vb,
  useAgentChoices: Qb,
  useDismissOnOutsideClick: Df,
  useHosts: Hb,
  useKeybindings: hv,
  useNavigation: Uf,
  useNewTabRequest: Sv,
  useNotifications: Kb,
  usePaneLook: pv,
  usePlanUsage: bv,
  useSessionFolders: Db,
  useStatusLine: fv,
  useWorkspaceTabs: dv,
  useZoom: mv,
  version: bb
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
const Qv = Object.keys(ls);
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
function Cv(n, l, o) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const c = n.meta?.attrs["data-testid"];
  return c ? `~${n.id}:${c}` : `~${n.id}`;
}
const Kf = (n, l = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !l || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && Kf(o, !0)), ze = (n) => n.style?.display !== "hidden";
function Lo(n, l, o, c, s = !1, d = !1, p = null, m = {}, b = !1, x = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return x.get(n)?.text ?? n.text;
  const C = Vd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), p = n.style.text_color ?? p;
  const M = !!n.hover?.text_color && Zf(n);
  M && o.hovered?.(n.id) && (p = n.hover.text_color), m = { ...m };
  for (const S of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[S] !== void 0 && (m[S] = n.style[S]);
  const N = new Set(n.events ?? []);
  let v;
  n.kind === "image" && !n.markup ? v = l.image(n.src) : v = l.div(), n.markup && (v = v.child(c.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const z = Cv(n, N, s);
  if (z && (v = v.id(z)), n.measure && (v = v.measure(n.measure)), n.name && v.also_named) for (const S of n.also ?? []) v = v.also_named(S);
  v = Qd(v, { ...n.style, ...x.get(n) });
  const w = m.whitespace !== "nowrap" && !m.text_ellipsis;
  b && w && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Kf(n) && (v = v.min_w(0));
  for (const S of ["hover", "focus", "active"]) n[S] && (v = v[S]((g) => Qd(g, n[S])));
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const S = o.document?.scrollTarget, g = S ? (n.children ?? []).filter(ze).findIndex((h) => Xf(h, S.id)) : -1;
    if (g >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, l.scroll.scroll_to_item(g)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      v = v.track_scroll(l.scroll);
      const h = (n.children ?? []).filter(ze).map((D) => D.id);
      o.document.itemBounds = (D) => h.includes(D) ? l.scroll.item_bounds?.(h.indexOf(D)) ?? null : null;
    }
  }
  n.kind === "input" && !n.disabled && (v = v.on_mouse_down("left", (S, g) => {
    S.bounds && o.setBounds(n.id, S.bounds), o.focus(n.id), g.notify();
  }));
  const y = n.kind === "input" ? n : n.meta?.tag === "label" ? Vf(n) : null;
  y && !y.disabled && /^(checkbox|radio)$/.test(y.input_type) && (v = v.on_click((S, g) => {
    g.stop_propagation?.(), o.toggle(y.id), g.notify();
  }));
  const O = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((S) => N.has(S));
  if (O || C) for (const S of n.children ?? []) S.kind !== "text" && Vd.add(S);
  if (O && (v = v.on_mouse_down("left", (S, g) => {
    g.stop_propagation?.(), S.bounds && o.setBounds(n.id, S.bounds);
    const h = { ...Aa(S), button: 0, buttons: 1, detail: S.click_count }, D = Xd(o, n.id, S);
    o.pressed = null, o.dispatch(D, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(D, "mousedown", h) && o.pressFocus?.(D), g.notify();
  }), v = v.on_mouse_down("right", (S, g) => {
    g.stop_propagation?.(), S.bounds && o.setBounds(n.id, S.bounds);
    const h = Xd(o, n.id, S);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Aa(S), button: 2 }), g.notify();
  }), v = v.on_mouse_up("left", (S, g) => {
    g.stop_propagation?.();
    const h = { ...Aa(S), button: 0 };
    o.dispatch(n.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", h), g.notify();
  }), v = v.on_click((S, g) => {
    o.dispatch(n.id, S.click_count === 2 && N.has("double_click") ? "dblclick" : "click", { detail: S.click_count, button: 0 }), g.notify();
  })), n.blocks_pointer && !O)
    for (const S of ["left", "right"]) v = v.on_mouse_down(S, (g, h) => h.stop_propagation?.());
  else if (C && !O)
    for (const S of ["left", "right"])
      v = v.on_mouse_down(S, (g) => {
        const h = Aa(g);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: n.id, x: h.clientX, y: h.clientY });
      });
  if (N.has("mouse_move") && (v = v.on_mouse_move((S, g) => {
    o.dispatch(n.id, "pointermove", { ...Aa(S), pointerType: "mouse" }), g.notify();
  })), (n.track_hover || M) && (v = v.on_hover((S, g) => {
    o.hover(n.id, S), g.notify();
  })), s && (v = v.on_mouse_down_out((S, g) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Aa(S), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Aa(S)), g.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const S = n.value ? String(n.value) : String(n.placeholder ?? "");
    let g = l.div().whitespace_nowrap().overflow_x_hidden();
    const h = en(m);
    h && (g = g.h(h)), !n.value && p && (g = g.text_color(Mv(p))), S && (v = v.child(g.child(n.input_type === "password" && n.value ? "•".repeat([...S].length) : S))), n.field_w && (v = v.child(l.div().w(n.field_w).h(0)));
  }
  const E = m.whitespace === "nowrap" ? en(m) : null, j = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let G = !n.range_name;
  const U = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const S of (n.children ?? []).filter(ze)) {
    const g = S.style?.flex_basis;
    U && S.style.flex_grow > 0 && (g === 0 || typeof g == "string" && g.endsWith("%")) && x.set(S, { ...x.get(S), flex_basis: "auto" });
    let h = Lo(S, l, o, c, !1, d, p, m, j && S.style?.position !== "absolute", x);
    const D = !G && (S.kind === "text" || !S.meta), Z = S.kind === "text" ? x.get(S)?.h ?? E : null, ot = S.kind === "text" ? x.get(S)?.w : void 0;
    if (D || Z || ot !== void 0) {
      let $ = l.div();
      D && ($ = $.id(n.range_name)), D && !j && n.style.display === "flex" && ($ = $[`self_${jv[m.text_align] ?? "start"}`]().max_w("100%")), Z && ($ = $.h(Z)), ot !== void 0 && ($ = $.w(ot).flex_none().whitespace_nowrap()), h = $.child(h), G ||= D;
    }
    v = v.child(h);
  }
  return v;
}
const jv = { center: "center", right: "end", end: "end" };
function Mv(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const o = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const Qf = /^(?:[!-,.-~]+|\S)$/u, Vf = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const o = l.kind === "text" ? null : Vf(l);
    if (o) return o;
  }
  return null;
}, Xf = (n, l) => n.id === l || (n.children ?? []).some((o) => o.kind !== "text" && Xf(o, l)), Zf = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Zf(l));
function en(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function Vv(n, l, o, c, s = 0, d = !1) {
  const p = [n.root, ...n.overlays], m = s > 0 ? Bv(p, s) : /* @__PURE__ */ new Map();
  s > 0 && c.measure && Av(p, s, c.measure, m), Dv(p, m), Hv(p, m), c.measure && Rv(p, c.measure, m);
  let b = l.div().relative().size_full().child(Lo(n.root, l, o, c, !1, !1, null, {}, !1, m)), x = d && n.overlays.length ? l.div().relative().size_full().window_layer() : b;
  for (const C of n.overlays) x = x.child(Lo(C, l, o, c, !0, !1, null, {}, !1, m));
  return x === b ? b : b.child(x);
}
function Av(n, l, o, c) {
  const s = (z, w) => c.set(z, { ...c.get(z), ...w }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(z, w, y) {
    if (z.kind === "text") {
      if (!(w.whitespace === "nowrap" || Qf.test(z.text)) || w.text_ellipsis || y || typeof w.text_size != "number") return NaN;
      const g = o(z.text, { size: w.text_size, weight: w.font_weight ?? 400, family: w.font_family ?? ".SystemUIFont", italic: !!w.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!ze(z) || z.kind === "input" || z.markup) return x(z);
    const O = { ...w };
    for (const S of m) z.style[S] !== void 0 && (O[S] = z.style[S]);
    O.text_ellipsis = !!z.style.text_ellipsis, p.set(z, O);
    const E = z.style, j = (z.children ?? []).filter(Ye), G = j.map((S) => b(S, O, y || !!z.tabular));
    let U = x(z);
    if (!Number.isFinite(U) && E.w === void 0) {
      const S = j.map((h, D) => G[D] + (h.kind === "text" ? 0 : I(h.style.ml) + I(h.style.mr)));
      let g;
      j.length ? Me(z) ? g = j.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || E.flex_wrap === "wrap" ? NaN : S.reduce((h, D) => h + D, 0) + I(E.gap_x) * (j.length - 1) : g = Math.max(...S) : g = 0, U = g + I(E.pl) + I(E.pr) + I(E.border_l) + I(E.border_r), typeof E.min_w == "number" && (U = Math.max(U, E.min_w)), typeof E.max_w == "number" && (U = Math.min(U, E.max_w));
    }
    return d.set(z, U), U;
  }
  const x = (z) => typeof z.style?.w == "number" ? z.style.w : NaN, C = () => ({ exact: 0, laid: 0 }), M = (z, w) => {
    if (!Number.isFinite(w))
      return Object.assign(z, C()), NaN;
    z.exact += w;
    const y = Math.round(z.exact * l + 1e-9) / l, O = y - z.laid;
    return z.laid = y, O;
  }, N = (z) => Me(z) && z.style.flex_wrap !== "wrap" && (z.style.justify ?? "start") === "start";
  function v(z) {
    if (!z || z.kind === "text" || !ze(z)) return;
    const w = (z.children ?? []).filter(Ye);
    if (N(z) && w.length > 1) {
      const y = I(z.style.gap_x), O = C(), E = !(y && w.some((j) => j.kind === "text"));
      s(z, { border_l: M(O, I(z.style.border_l)), pl: M(O, I(z.style.pl)) }), E && y && s(z, { gap_x: 0 }), w.forEach((j, G) => {
        const U = (G && E ? y : 0) + (j.kind === "text" ? 0 : I(j.style.ml));
        if (j.kind === "text")
          U && Object.assign(O, C());
        else {
          const D = M(O, U);
          Number.isFinite(D) && s(j, { ml: D });
        }
        const S = j.kind === "text" ? p.get(z) ?? {} : null, g = j.kind === "text" ? b(j, S, !!z.tabular) : d.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(g) ? s(j, { w: M(O, g) }) : Object.assign(O, C()), j.kind !== "text") {
          const D = M(O, I(j.style.mr));
          Number.isFinite(D) && s(j, { mr: D });
        }
      });
    }
    for (const y of z.children ?? []) y.kind !== "text" && v(y);
  }
  for (const z of n)
    z && (b(z, {}, !1), v(z));
}
const Ov = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Rv(n, l, o) {
  const c = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (m) => typeof m == "number" ? m : 0, d = (m, b) => b && Hi(b) && !Me(b) && m.style.position !== "absolute" && !["start", "center", "end"].includes(m.style.self) && !["start", "center", "end"].includes(b.style.items), p = (m, b, x, C) => {
    if (!m || m.kind === "text" || !ze(m)) return;
    const M = m.style;
    let N = typeof M.w == "number" ? M.w : M.w === "100%" ? x : d(m, b) ? x - s(M.ml) - s(M.mr) : NaN;
    typeof M.max_w == "number" && (N = Math.min(N, M.max_w));
    const v = N - s(M.pl) - s(M.pr) - s(M.border_l) - s(M.border_r), z = { ...C };
    for (const y of c) M[y] !== void 0 && (z[y] = M[y]);
    const w = m.children ?? [];
    if (m.break_anywhere && Number.isFinite(v) && v > 0 && typeof z.text_size == "number" && w.length && w.every((y) => y.kind === "text")) {
      const y = { size: z.text_size, weight: z.font_weight ?? 400, family: z.font_family ?? ".SystemUIFont", italic: !!z.italic }, O = (G) => l(G.trimEnd(), y) <= v + 0.01;
      let E = 0;
      for (const G of w) {
        const U = [];
        for (const g of G.text.split(`
`)) {
          let h = "";
          for (const D of g.split(Ov)) {
            if (O(h + D)) {
              h += D;
              continue;
            }
            h && U.push(h.trimEnd()), h = "";
            for (const Z of D)
              h && !O(h + Z) && (U.push(h), h = ""), h += Z;
          }
          U.push(h.trimEnd());
        }
        const S = U.join(`
`);
        U.every((g) => !g || O(g)) ? S !== G.text && o.set(G, { ...o.get(G), text: S }) : E = NaN, E += U.length;
      }
      const j = en(z);
      Number.isFinite(E) && j && M.h === void 0 && w.length === 1 && o.set(m, { ...o.get(m), h: E * j + s(M.pt) + s(M.pb) + s(M.border_t) + s(M.border_b) });
    }
    for (const y of w) p(y, m, Me(m) ? NaN : v, z);
  };
  for (const m of n) p(m, null, NaN, {});
}
function Hv(n, l) {
  const o = (c, s) => {
    if (!c || c.kind === "text" || !ze(c)) return;
    const d = c.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (p && Me(c))
      for (const m of c.children ?? []) {
        const b = m.kind === "text" ? void 0 : m.style.flex_basis;
        m.kind !== "text" && m.style.flex_grow > 0 && (b === 0 || typeof b == "string" && b.endsWith("%")) && l.set(m, { ...l.get(m), flex_basis: "auto" });
      }
    for (const m of c.children ?? []) o(m, p);
  };
  for (const c of n) o(c, !1);
}
function Dv(n, l) {
  const o = l.heights ?? /* @__PURE__ */ new Map(), c = (b) => o.get(b), s = (b) => {
    const x = c(b);
    if (Number.isFinite(x)) return x;
    if (b.kind === "text" || !ze(b)) return 0;
    const C = b.style, M = typeof C.min_h == "number" ? C.min_h : 0, N = (b.children ?? []).filter(Ye), v = N.map((y) => s(y) + (y.kind === "text" ? 0 : Math.max(0, I(y.style.mt) || 0) + Math.max(0, I(y.style.mb) || 0))), z = N.length ? Me(b) ? Math.max(...v) : v.reduce((y, O) => y + O, 0) + (C.display === "flex" ? (I(C.gap_y) || 0) * (N.length - 1) : 0) : 0, w = [C.pt, C.pb, C.border_t, C.border_b].reduce((y, O) => y + (I(O) || 0), 0);
    return Math.max(M, z + w);
  }, d = (b) => !(b.children ?? []).filter(Ye).length || Me(b) ? NaN : s({ ...b, style: { ...b.style, h: void 0, max_h: void 0, min_h: void 0 } }), p = (b, x) => {
    const C = b.style;
    if (typeof C.h == "number") return C.h;
    if (typeof C.max_h == "number") return C.max_h;
    if (!x || !Hi(x) || Me(x)) return NaN;
    const M = x.style, N = typeof M.h == "number" ? M.h : typeof M.max_h == "number" ? M.max_h : NaN, v = (x.children ?? []).filter(Ye);
    let z = 0;
    for (const y of v) {
      if (y === b) continue;
      const O = c(y);
      if (!Number.isFinite(O)) return NaN;
      z += O + (y.kind === "text" ? 0 : I(y.style.mt) + I(y.style.mb));
    }
    const w = M.display === "flex" ? I(M.gap_y) * Math.max(0, v.length - 1) : 0;
    return N - I(M.pt) - I(M.pb) - I(M.border_t) - I(M.border_b) - z - w - I(C.mt) - I(C.mb);
  }, m = (b, x) => {
    if (!(!b || b.kind === "text" || !ze(b))) {
      if (b.scrollbar > 0 && b.style.overflow_y === "scroll") {
        const C = d(b), M = p(b, x);
        Number.isFinite(C) && Number.isFinite(M) && C > M + 0.01 && l.set(b, { ...l.get(b), pr: I(b.style.pr) + b.scrollbar });
      }
      for (const C of b.children ?? []) m(C, b);
    }
  };
  for (const b of n) m(b, null);
}
const Uv = ["text_size", "line_height", "whitespace", "text_ellipsis"], I = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Hi = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Me = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ye = (n) => n.kind === "text" || ze(n) && n.style.position !== "absolute";
function Bv(n, l) {
  const o = /* @__PURE__ */ new Map(), c = (w, y) => o.set(w, { ...o.get(w), ...Object.fromEntries(Object.entries(y).filter(([, O]) => Number.isFinite(O))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(w, y) {
    if (w.kind === "text") return y.whitespace === "nowrap" || Qf.test(w.text) ? en(y) ?? NaN : NaN;
    const O = { ...y };
    for (const S of Uv) w.style[S] !== void 0 && (O[S] = w.style[S]);
    d.set(w, O);
    const E = w.style, j = (w.children ?? []).filter(Ye), G = j.map((S) => p(S, O));
    let U;
    if (E.h !== void 0 && E.h !== "auto") U = I(E.h);
    else if (w.kind === "input")
      U = (w.input_type === "textarea" || w.input_type === "select" ? NaN : en(O) ?? NaN) + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (U = Math.max(U, I(E.min_h)));
    else {
      const S = j.map((h, D) => (h.kind === "text" ? 0 : I(h.style.mt) + I(h.style.mb)) + G[D]);
      let g;
      if (Me(w)) g = E.flex_wrap === "wrap" ? NaN : E.items === "baseline" ? b(j, G, O) : Math.max(0, ...S);
      else if (Hi(w)) {
        const h = j.some((Z) => Z.kind !== "text" && (Z.style.flex_grow > 0 || Z.style.flex_basis !== void 0)), D = E.display !== "flex" && j.some((Z) => Z.kind !== "text" && (I(Z.style.mt) || I(Z.style.mb)));
        g = h || D ? NaN : S.reduce((Z, ot) => Z + ot, 0) + (E.display === "flex" ? I(E.gap_y) * Math.max(0, j.length - 1) : 0);
      } else g = NaN;
      U = g + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (U = Math.max(U, I(E.min_h))), E.max_h !== void 0 && (U = Math.min(U, I(E.max_h)));
    }
    return s.set(w, U), U;
  }
  const m = (w) => (en(w) - (Mi + uf) * w.text_size) / 2 + Mi * w.text_size;
  function b(w, y, O) {
    let E = 0, j = 0;
    for (const [G, U] of w.entries()) {
      const S = U.kind === "text" ? O : d.get(U);
      if (!(U.kind === "text" || (U.children ?? []).filter(Ye).every((Z) => Z.kind === "text")) || !Number.isFinite(y[G]) || typeof S.text_size != "number") return NaN;
      const h = U.kind === "text" ? {} : U.style, D = I(h.mt) + I(h.border_t) + I(h.pt) + m(S);
      E = Math.max(E, D), j = Math.max(j, I(h.mt) + y[G] + I(h.mb) - D);
    }
    return E + j;
  }
  const x = () => ({ exact: 0, laid: 0 }), C = (w, y) => {
    if (!Number.isFinite(y))
      return Object.assign(w, x()), NaN;
    w.exact += y;
    const O = Math.round(w.exact * l + 1e-9) / l, E = O - w.laid;
    return w.laid = O, E;
  };
  function M(w) {
    if (!(w.kind === "text" || !ze(w))) {
      for (const y of (w.children ?? []).filter((O) => O.kind !== "text" && ze(O) && O.style.position === "absolute")) M(y);
      if (Hi(w) && !Me(w)) {
        const y = x();
        c(w, { border_t: C(y, I(w.style.border_t)), pt: C(y, I(w.style.pt)) }), N(w, y);
      } else for (const y of (w.children ?? []).filter(Ye)) y.kind !== "text" && M(y);
    }
  }
  function N(w, y) {
    const O = (w.children ?? []).filter(Ye), E = w.style.display === "flex" ? I(w.style.gap_y) : 0;
    if (E && O.some((j) => j.kind === "text")) {
      for (const j of O) j.kind !== "text" && M(j);
      return !1;
    }
    return E && c(w, { gap_y: 0 }), O.forEach((j, G) => {
      if (j.kind === "text") {
        const U = s.get(j) ?? p(j, d.get(w) ?? {});
        Number.isFinite(U) ? c(j, { h: C(y, U) }) : Object.assign(y, x());
        return;
      }
      if (c(j, { mt: C(y, (G ? E : 0) + I(j.style.mt)) }), Number.isFinite(s.get(j))) z(j, y);
      else if (v(j)) {
        const U = j.style;
        c(j, { border_t: C(y, I(U.border_t)), pt: C(y, I(U.pt)) }), c(j, { pb: C(y, I(U.pb)), border_b: C(y, I(U.border_b)) });
      } else
        M(j), Object.assign(y, x());
      c(j, { mb: C(y, I(j.style.mb)) });
    }), !0;
  }
  function v(w) {
    const y = w.style, O = (w.children ?? []).filter(Ye), E = en(d.get(w) ?? {});
    return w.kind === "div" && !Me(w) && O.length > 0 && O.every((j) => j.kind === "text") && Number.isInteger(E) && [y.h, y.min_h, y.max_h].every((j) => j === void 0 || j === "auto");
  }
  function z(w, y) {
    const O = w.style;
    for (const S of (w.children ?? []).filter((g) => g.kind !== "text" && ze(g) && g.style.position === "absolute")) M(S);
    const E = y.laid, j = y.exact;
    c(w, { border_t: C(y, I(O.border_t)), pt: C(y, I(O.pt)) });
    const G = O.h !== void 0 && O.h !== "auto", U = s.get(w) - I(O.pt) - I(O.pb) - I(O.border_t) - I(O.border_b);
    if (w.kind === "input")
      G || C(y, U);
    else if (Me(w) || G && (O.justify ?? "start") !== "start") {
      for (const S of (w.children ?? []).filter(Ye)) S.kind !== "text" && M(S);
      G || C(y, U);
    } else !N(w, y) && !G && C(y, U);
    if (G) {
      y.exact = j + s.get(w), y.laid = Math.round(y.exact * l + 1e-9) / l, c(w, { h: y.laid - E });
      return;
    }
    c(w, { pb: C(y, I(O.pb)), border_b: C(y, I(O.border_b)) }), c(w, { h: y.laid - E });
  }
  for (const w of n)
    p(w, {}), M(w);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const Xv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }] };
export {
  Xv as NAMED_ELEMENTS,
  Dh as React,
  hg as SCHEMA,
  Qv as STYLE_KEYS,
  Vv as describeToGpui,
  qv as jsxRuntime,
  Yv as mount,
  Gv as reactDom,
  Kv as sdk
};
