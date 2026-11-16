function as(n, l) {
  for (var o = 0; o < l.length; o++) {
    const s = l[o];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const c in s)
        if (c !== "default" && !(c in n)) {
          const d = Object.getOwnPropertyDescriptor(s, c);
          d && Object.defineProperty(n, c, d.get ? d : {
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
//! `:first-child`, `:last-child`, `:only-child`, `:nth-child(n)`, `:not()`, `:is()`, `:where()`, `:root`, the state pseudo-classes
//! (`:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:enabled`, `:checked`), and the
//! descendant and child combinators. Anything else (`+`, `~`, `:has()`, pseudo-elements, ...) throws a
//! `SelectorError`, so a caller can skip a rule it cannot evaluate instead of guessing.
//!
//! An element is anything with `tagName` (lower case), `getAttribute(name)`, `parentElement` and `children`
//! (elements only). State pseudo-classes ask `options.state(element, name, isSubject)`; without it they never match.
class ke extends Error {
}
const wh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), _h = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), Sh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...wh]);
function Go(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, o, s) => o ? String.fromCodePoint(parseInt(o, 16)) : s);
}
function hi(n, l) {
  let o = l;
  for (; o < n.length; ) {
    const s = n[o];
    if (s === "\\") {
      o += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(s)) {
      o++;
      continue;
    }
    break;
  }
  if (o === l) throw new ke(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [Go(n.slice(l, o)), o];
}
function kh(n, l) {
  let o = 1;
  for (let s = l; s < n.length; s++) {
    const c = n[s];
    if (c === "\\") {
      s++;
      continue;
    }
    if (c === '"' || c === "'") {
      if (s = n.indexOf(c, s + 1), s < 0) break;
      continue;
    }
    if (c === "(") o++;
    else if (c === ")" && --o === 0) return s;
  }
  throw new ke(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function ns(n) {
  const l = [];
  let o = 0, s = 0;
  for (let c = 0; c < n.length; c++) {
    const d = n[c];
    if (d === "\\") {
      c++;
      continue;
    }
    if (d === '"' || d === "'") {
      if (c = n.indexOf(d, c + 1), c < 0) break;
      continue;
    }
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (l.push(n.slice(s, c).trim()), s = c + 1);
  }
  return l.push(n.slice(s).trim()), l.filter(Boolean);
}
function zh(n, l) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let s = !1;
  for (; l < n.length; ) {
    const c = n[l];
    if (c === "*") {
      o.tag = "*", l++, s = !0;
      continue;
    }
    if (c === ".") {
      const [d, p] = hi(n, l + 1);
      o.classes.push(d), l = p, s = !0;
      continue;
    }
    if (c === "#") {
      const [d, p] = hi(n, l + 1);
      o.id = d, l = p, s = !0;
      continue;
    }
    if (c === "[") {
      const d = n.indexOf("]", l);
      if (d < 0) throw new ke(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!f) throw new ke(`cannot read the attribute selector [${p}]`);
      const g = f[3] ?? f[4] ?? f[5];
      o.attrs.push({ name: Go(f[1]).toLowerCase(), op: f[2] ?? null, value: g === void 0 ? null : Go(g) }), l = d + 1, s = !0;
      continue;
    }
    if (c === ":") {
      if (n[l + 1] === ":") throw new ke(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = hi(n, l + 1);
      l = p;
      const f = d.toLowerCase();
      if (n[l] === "(") {
        if (!_h.has(f)) throw new ke(`:${f}() is not supported`);
        const g = kh(n, l + 1), x = n.slice(l + 1, g).trim();
        if (l = g + 1, f === "nth-child") {
          if (!/^\d+$/.test(x)) throw new ke(`:nth-child(${x}) is not supported (only a number)`);
          o.pseudos.push({ name: f, n: Number(x) });
        } else
          o.pseudos.push({ name: f, list: ns(x).map(ls) });
      } else {
        if (!Sh.has(f)) throw new ke(`:${f} is not supported`);
        o.pseudos.push({ name: f });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !s) {
      const [d, p] = hi(n, l);
      o.tag = d.toLowerCase(), l = p, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new ke(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [o, l];
}
function ls(n) {
  const l = [];
  let o = 0, s = null;
  for (n = n.trim(); o < n.length; ) {
    const [c, d] = zh(n, o);
    l.push({ compound: c, combinator: s }), o = d;
    let p = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, p = !0;
    if (o >= n.length) break;
    const f = n[o];
    if (f === ">")
      for (s = ">", o++; n[o] === " "; ) o++;
    else {
      if (f === "+" || f === "~") throw new ke(`the ${f} combinator is not supported`);
      if (p) s = " ";
      else throw new ke(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new ke("empty selector");
  return l;
}
const od = /* @__PURE__ */ new Map();
function Ui(n) {
  let l = od.get(n);
  return l || (l = ns(n).map(ls), od.set(n, l)), l;
}
function Id(n) {
  const l = [0, 0, 0], o = (s) => {
    l[0] += s[0], l[1] += s[1], l[2] += s[2];
  };
  for (const { compound: s } of n) {
    s.id && l[0]++, l[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && l[2]++;
    for (const c of s.pseudos)
      if (c.name !== "where")
        if (c.list) {
          const d = c.list.map(Id).sort((p, f) => f[0] - p[0] || f[1] - p[1] || f[2] - p[2])[0];
          o(d);
        } else l[1]++;
  }
  return l;
}
function Eh(n, { name: l, op: o, value: s }) {
  const c = n.getAttribute(l);
  if (c == null) return !1;
  if (o === null) return !0;
  switch (o) {
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
function gi(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Nh(n, l, o, s) {
  if (l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const c = n.classList ?? [];
    for (const d of l.classes) if (!c.includes(d)) return !1;
  }
  for (const c of l.attrs) if (!Eh(n, c)) return !1;
  for (const c of l.pseudos)
    switch (c.name) {
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
        if (gi(n).indexOf(n) !== c.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (c.list.some((d) => Rn(n, d, o, s))) return !1;
        break;
      case "is":
      case "where":
        if (!c.list.some((d) => Rn(n, d, o, s))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, c.name, s)) return !1;
    }
  return !0;
}
function Rn(n, l, o, s = !0) {
  const c = (d, p, f) => {
    const { compound: g, combinator: x } = l[p];
    if (!Nh(d, g, o, f)) return !1;
    if (p === 0) return !0;
    if (x === ">") return !!d.parentElement && c(d.parentElement, p - 1, !1);
    for (let T = d.parentElement; T; T = T.parentElement) if (c(T, p - 1, !1)) return !0;
    return !1;
  };
  return c(n, l.length - 1, s);
}
function Th(n, l, o = {}) {
  return (typeof l == "string" ? Ui(l) : l).some((c) => Rn(n, c, o));
}
function $d(n, l, o = {}) {
  return Rn(n, l, o);
}
function pl(n, l, o = {}) {
  const s = Ui(l), c = [], d = (p) => {
    for (const f of p.children)
      s.some((g) => Rn(f, g, o)) && c.push(f), d(f);
  };
  return d(n), c;
}
function Pd(n, l, o = {}) {
  const s = Ui(l);
  for (let c = n; c; c = c.parentElement) if (s.some((d) => Rn(c, d, o))) return c;
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
let Ch = 1;
class Ko {
  constructor(l = 0, o = 0, s = 0, c = 0) {
    this.x = l, this.y = o, this.width = s, this.height = c;
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
class is {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, o, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners.some((d) => d.type === l && d.listener === o && d.capture === c) || this.listeners.push({ type: l, listener: o, capture: c });
  }
  removeEventListener(l, o, s) {
    const c = s === !0 || !!s?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === l && d.listener === o && d.capture === c));
  }
}
class Bi {
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
class It extends is {
  constructor(l, o = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${Ch++}`, this.tagName = l.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    for (const [o, s] of Object.entries(this.props))
      o.startsWith("data-") && s != null && s !== !1 && (l[o.slice(5).replace(/-([a-z])/g, (c, d) => d.toUpperCase())] = String(s));
    return l;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(l) {
    const o = this.props;
    if (l === "class") return this.className || null;
    if (l === "id") return o.id != null ? String(o.id) : null;
    if (l === "style") return null;
    let c = o[l === "for" ? "htmlFor" : l === "tabindex" ? "tabIndex" : l];
    if (c === void 0 && !l.includes("-")) {
      const d = l.replace(/-([a-z])/g, (p, f) => f.toUpperCase());
      c = o[d];
    }
    return c == null || typeof c == "function" ? null : typeof c == "boolean" ? l.startsWith("aria-") || l.startsWith("data-") ? String(c) : c ? "" : null : String(c);
  }
  hasAttribute(l) {
    return this.getAttribute(l) !== null;
  }
  appendChild(l) {
    return l.parentNode && l.parentNode.removeChild(l), l.parentNode = this, this.childNodes.push(l), this.touch(), l;
  }
  insertBefore(l, o) {
    l.parentNode && l.parentNode.removeChild(l);
    const s = this.childNodes.indexOf(o);
    return l.parentNode = this, s < 0 ? this.childNodes.push(l) : this.childNodes.splice(s, 0, l), this.touch(), l;
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
    return Th(this, l);
  }
  closest(l) {
    return Pd(this, l);
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
    return l ? new Ko(l.x, l.y, l.width, l.height) : new Ko();
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
    const l = this, o = (p) => String(p).startsWith("--") ? String(p) : String(p).replace(/-([a-z])/g, (f, g) => g.toUpperCase()), s = (p) => {
      const f = l.props.style?.[p];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, c = (p) => l.inline && p in l.inline ? l.inline[p] : s(p), d = (p, f) => {
      const g = f == null ? "" : String(f);
      c(p) !== g && (l.inline ??= {}, g === s(p) ? delete l.inline[p] : l.inline[p] = g, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (p, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (g, x) => d(o(g), x) : f === "removeProperty" ? (g) => {
            const x = c(o(g));
            return d(o(g), ""), x;
          } : f === "getPropertyValue" ? (g) => c(o(g)) : c(f);
      },
      set: (p, f, g) => (typeof f == "string" && d(f, g), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return sd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return sd(this, l);
  }
}
const tf = Symbol("perch.stale-layout"), ef = 3;
let zi = !1;
function af(n) {
  return () => {
    let l, o = !1;
    const s = (c) => {
      const d = zi;
      zi = c < ef;
      try {
        l = n();
      } catch (p) {
        const f = p?.[tf];
        if (!f) throw p;
        f.retries.push(() => {
          o || s(c + 1);
        });
      } finally {
        zi = d;
      }
    };
    return s(0), () => {
      o = !0, typeof l == "function" && l();
    };
  };
}
const Qo = "perch-dom:", jh = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), Mh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function sd(n, l = []) {
  const o = new Set(l.map((c) => Mh[c] ?? c)), s = (c) => {
    if (!(c instanceof It)) return { x: c.data, ...c.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [p, f] of Object.entries(c.props))
      jh.has(p) || o.has(p) || f == null || typeof f == "function" || typeof f == "symbol" || (d[p] = f);
    return { t: c.tagName, p: d, c: c.childNodes.map(s), ...c.hidden ? { h: 1 } : {} };
  };
  return Qo + JSON.stringify(s(n));
}
function Ah(n, l) {
  if (typeof n != "string" || !n.startsWith(Qo)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(Qo.length));
  } catch {
    return null;
  }
  const s = (d) => !!d && typeof d == "object" && !Array.isArray(d), c = (d) => {
    if (!s(d)) throw new Error("not a node");
    let p;
    if (typeof d.x == "string") p = new Bi(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !s(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      p = new It(d.t, d.p, l);
      for (const f of d.c) p.appendChild(c(f));
    }
    return p.hidden = d.h === 1, p;
  };
  try {
    return [c(o)];
  } catch {
    return null;
  }
}
class Oh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class Rh {
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
function cd(n) {
  for (let l = n; l instanceof It; l = l.parentElement) l.touch();
}
class Hh extends is {
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
    const s = o(this.measureKey(l));
    if (zi && (!s || this.stale?.())) throw { [tf]: this };
    return s ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, cd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, cd(l), this.activeElement === l && (this.activeElement = this.body);
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
class Dh extends is {
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
  setTimeout(l, o, ...s) {
    return globalThis.setTimeout(l, o, ...s);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function nf(n) {
  return {
    setTimeout: (l, o = 0, ...s) => n.setTimeout(() => l(...s), Math.max(0, Number(o) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const ud = Symbol.for("perch.react.globals");
function Ze(n, l, o) {
  Object.defineProperty(n, l, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function Uh(n, l = globalThis) {
  const o = new Hh(n), s = new Dh(n, o);
  o.defaultView = s;
  const c = n.storage ?? new Rh();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = nf(n);
    Ze(l, "setTimeout", f.setTimeout), Ze(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ze(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: o, window: s, localStorage: c, HTMLElement: It, Element: It };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[ud]?.[f], configurable: !0, enumerable: !1 });
  l[ud] = d, Ze(l, "DOMRect", Ko), Ze(l, "getComputedStyle", Bh), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", Oh);
  const p = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      Ze(p, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", p), { document: o, window: s, globals: d };
}
function Bh(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, o = (s) => {
    const c = l[s];
    return typeof c == "string" || typeof c == "number" ? String(c) : "";
  };
  return new Proxy({}, {
    get: (s, c) => {
      if (typeof c == "string")
        return c === "getPropertyValue" ? (d) => o(String(d)) : o(c.replace(/[A-Z]/g, (d) => `-${d.toLowerCase()}`));
    }
  });
}
function Vo(n, l = !1) {
  if (!(l ? n?.tagName === "input" && lf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let s = n.parentElement; s; s = s.parentElement) if (s.tagName === "form") return s;
  return null;
}
const lf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const dd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof dd?.setTimeout == "function") {
  const n = nf(dd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function rs(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function qh(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var l = n.default;
  if (typeof l == "function") {
    var o = function s() {
      return this instanceof s ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    o.prototype = l.prototype;
  } else o = {};
  return Object.defineProperty(o, "__esModule", { value: !0 }), Object.keys(n).forEach(function(s) {
    var c = Object.getOwnPropertyDescriptor(n, s);
    Object.defineProperty(o, s, c.get ? c : {
      enumerable: !0,
      get: function() {
        return n[s];
      }
    });
  }), o;
}
var Eo = { exports: {} }, dt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var fd;
function Yh() {
  if (fd) return dt;
  fd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), c = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), g = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), T = Symbol.for("react.lazy"), M = Symbol.for("react.activity"), k = Symbol.iterator;
  function E(w) {
    return w === null || typeof w != "object" ? null : (w = k && w[k] || w["@@iterator"], typeof w == "function" ? w : null);
  }
  var y = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, h = Object.assign, _ = {};
  function O(w, G, nt) {
    this.props = w, this.context = G, this.refs = _, this.updater = nt || y;
  }
  O.prototype.isReactComponent = {}, O.prototype.setState = function(w, G) {
    if (typeof w != "object" && typeof w != "function" && w != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, w, G, "setState");
  }, O.prototype.forceUpdate = function(w) {
    this.updater.enqueueForceUpdate(this, w, "forceUpdate");
  };
  function N() {
  }
  N.prototype = O.prototype;
  function j(w, G, nt) {
    this.props = w, this.context = G, this.refs = _, this.updater = nt || y;
  }
  var K = j.prototype = new N();
  K.constructor = j, h(K, O.prototype), K.isPureReactComponent = !0;
  var B = Array.isArray;
  function A() {
  }
  var v = { H: null, A: null, T: null, S: null }, b = Object.prototype.hasOwnProperty;
  function z(w, G, nt) {
    var tt = nt.ref;
    return {
      $$typeof: n,
      type: w,
      key: G,
      ref: tt !== void 0 ? tt : null,
      props: nt
    };
  }
  function D(w, G) {
    return z(w.type, G, w.props);
  }
  function V(w) {
    return typeof w == "object" && w !== null && w.$$typeof === n;
  }
  function L(w) {
    var G = { "=": "=0", ":": "=2" };
    return "$" + w.replace(/[=:]/g, function(nt) {
      return G[nt];
    });
  }
  var ct = /\/+/g;
  function ht(w, G) {
    return typeof w == "object" && w !== null && w.key != null ? L("" + w.key) : G.toString(36);
  }
  function ut(w) {
    switch (w.status) {
      case "fulfilled":
        return w.value;
      case "rejected":
        throw w.reason;
      default:
        switch (typeof w.status == "string" ? w.then(A, A) : (w.status = "pending", w.then(
          function(G) {
            w.status === "pending" && (w.status = "fulfilled", w.value = G);
          },
          function(G) {
            w.status === "pending" && (w.status = "rejected", w.reason = G);
          }
        )), w.status) {
          case "fulfilled":
            return w.value;
          case "rejected":
            throw w.reason;
        }
    }
    throw w;
  }
  function X(w, G, nt, tt, at) {
    var it = typeof w;
    (it === "undefined" || it === "boolean") && (w = null);
    var St = !1;
    if (w === null) St = !0;
    else
      switch (it) {
        case "bigint":
        case "string":
        case "number":
          St = !0;
          break;
        case "object":
          switch (w.$$typeof) {
            case n:
            case l:
              St = !0;
              break;
            case T:
              return St = w._init, X(
                St(w._payload),
                G,
                nt,
                tt,
                at
              );
          }
      }
    if (St)
      return at = at(w), St = tt === "" ? "." + ht(w, 0) : tt, B(at) ? (nt = "", St != null && (nt = St.replace(ct, "$&/") + "/"), X(at, G, nt, "", function(Ha) {
        return Ha;
      })) : at != null && (V(at) && (at = D(
        at,
        nt + (at.key == null || w && w.key === at.key ? "" : ("" + at.key).replace(
          ct,
          "$&/"
        ) + "/") + St
      )), G.push(at)), 1;
    St = 0;
    var Jt = tt === "" ? "." : tt + ":";
    if (B(w))
      for (var ft = 0; ft < w.length; ft++)
        tt = w[ft], it = Jt + ht(tt, ft), St += X(
          tt,
          G,
          nt,
          it,
          at
        );
    else if (ft = E(w), typeof ft == "function")
      for (w = ft.call(w), ft = 0; !(tt = w.next()).done; )
        tt = tt.value, it = Jt + ht(tt, ft++), St += X(
          tt,
          G,
          nt,
          it,
          at
        );
    else if (it === "object") {
      if (typeof w.then == "function")
        return X(
          ut(w),
          G,
          nt,
          tt,
          at
        );
      throw G = String(w), Error(
        "Objects are not valid as a React child (found: " + (G === "[object Object]" ? "object with keys {" + Object.keys(w).join(", ") + "}" : G) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return St;
  }
  function et(w, G, nt) {
    if (w == null) return w;
    var tt = [], at = 0;
    return X(w, tt, "", "", function(it) {
      return G.call(nt, it, at++);
    }), tt;
  }
  function lt(w) {
    if (w._status === -1) {
      var G = w._result;
      G = G(), G.then(
        function(nt) {
          (w._status === 0 || w._status === -1) && (w._status = 1, w._result = nt);
        },
        function(nt) {
          (w._status === 0 || w._status === -1) && (w._status = 2, w._result = nt);
        }
      ), w._status === -1 && (w._status = 0, w._result = G);
    }
    if (w._status === 1) return w._result.default;
    throw w._result;
  }
  var q = typeof reportError == "function" ? reportError : function(w) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var G = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof w == "object" && w !== null && typeof w.message == "string" ? String(w.message) : String(w),
        error: w
      });
      if (!window.dispatchEvent(G)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", w);
      return;
    }
    console.error(w);
  }, Y = {
    map: et,
    forEach: function(w, G, nt) {
      et(
        w,
        function() {
          G.apply(this, arguments);
        },
        nt
      );
    },
    count: function(w) {
      var G = 0;
      return et(w, function() {
        G++;
      }), G;
    },
    toArray: function(w) {
      return et(w, function(G) {
        return G;
      }) || [];
    },
    only: function(w) {
      if (!V(w))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return w;
    }
  };
  return dt.Activity = M, dt.Children = Y, dt.Component = O, dt.Fragment = o, dt.Profiler = c, dt.PureComponent = j, dt.StrictMode = s, dt.Suspense = g, dt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = v, dt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(w) {
      return v.H.useMemoCache(w);
    }
  }, dt.cache = function(w) {
    return function() {
      return w.apply(null, arguments);
    };
  }, dt.cacheSignal = function() {
    return null;
  }, dt.cloneElement = function(w, G, nt) {
    if (w == null)
      throw Error(
        "The argument must be a React element, but you passed " + w + "."
      );
    var tt = h({}, w.props), at = w.key;
    if (G != null)
      for (it in G.key !== void 0 && (at = "" + G.key), G)
        !b.call(G, it) || it === "key" || it === "__self" || it === "__source" || it === "ref" && G.ref === void 0 || (tt[it] = G[it]);
    var it = arguments.length - 2;
    if (it === 1) tt.children = nt;
    else if (1 < it) {
      for (var St = Array(it), Jt = 0; Jt < it; Jt++)
        St[Jt] = arguments[Jt + 2];
      tt.children = St;
    }
    return z(w.type, at, tt);
  }, dt.createContext = function(w) {
    return w = {
      $$typeof: p,
      _currentValue: w,
      _currentValue2: w,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, w.Provider = w, w.Consumer = {
      $$typeof: d,
      _context: w
    }, w;
  }, dt.createElement = function(w, G, nt) {
    var tt, at = {}, it = null;
    if (G != null)
      for (tt in G.key !== void 0 && (it = "" + G.key), G)
        b.call(G, tt) && tt !== "key" && tt !== "__self" && tt !== "__source" && (at[tt] = G[tt]);
    var St = arguments.length - 2;
    if (St === 1) at.children = nt;
    else if (1 < St) {
      for (var Jt = Array(St), ft = 0; ft < St; ft++)
        Jt[ft] = arguments[ft + 2];
      at.children = Jt;
    }
    if (w && w.defaultProps)
      for (tt in St = w.defaultProps, St)
        at[tt] === void 0 && (at[tt] = St[tt]);
    return z(w, it, at);
  }, dt.createRef = function() {
    return { current: null };
  }, dt.forwardRef = function(w) {
    return { $$typeof: f, render: w };
  }, dt.isValidElement = V, dt.lazy = function(w) {
    return {
      $$typeof: T,
      _payload: { _status: -1, _result: w },
      _init: lt
    };
  }, dt.memo = function(w, G) {
    return {
      $$typeof: x,
      type: w,
      compare: G === void 0 ? null : G
    };
  }, dt.startTransition = function(w) {
    var G = v.T, nt = {};
    v.T = nt;
    try {
      var tt = w(), at = v.S;
      at !== null && at(nt, tt), typeof tt == "object" && tt !== null && typeof tt.then == "function" && tt.then(A, q);
    } catch (it) {
      q(it);
    } finally {
      G !== null && nt.types !== null && (G.types = nt.types), v.T = G;
    }
  }, dt.unstable_useCacheRefresh = function() {
    return v.H.useCacheRefresh();
  }, dt.use = function(w) {
    return v.H.use(w);
  }, dt.useActionState = function(w, G, nt) {
    return v.H.useActionState(w, G, nt);
  }, dt.useCallback = function(w, G) {
    return v.H.useCallback(w, G);
  }, dt.useContext = function(w) {
    return v.H.useContext(w);
  }, dt.useDebugValue = function() {
  }, dt.useDeferredValue = function(w, G) {
    return v.H.useDeferredValue(w, G);
  }, dt.useEffect = function(w, G) {
    return v.H.useEffect(w, G);
  }, dt.useEffectEvent = function(w) {
    return v.H.useEffectEvent(w);
  }, dt.useId = function() {
    return v.H.useId();
  }, dt.useImperativeHandle = function(w, G, nt) {
    return v.H.useImperativeHandle(w, G, nt);
  }, dt.useInsertionEffect = function(w, G) {
    return v.H.useInsertionEffect(w, G);
  }, dt.useLayoutEffect = function(w, G) {
    return v.H.useLayoutEffect(w, G);
  }, dt.useMemo = function(w, G) {
    return v.H.useMemo(w, G);
  }, dt.useOptimistic = function(w, G) {
    return v.H.useOptimistic(w, G);
  }, dt.useReducer = function(w, G, nt) {
    return v.H.useReducer(w, G, nt);
  }, dt.useRef = function(w) {
    return v.H.useRef(w);
  }, dt.useState = function(w) {
    return v.H.useState(w);
  }, dt.useSyncExternalStore = function(w, G, nt) {
    return v.H.useSyncExternalStore(
      w,
      G,
      nt
    );
  }, dt.useTransition = function() {
    return v.H.useTransition();
  }, dt.version = "19.2.8", dt;
}
var md;
function Gh() {
  return md || (md = 1, Eo.exports = Yh()), Eo.exports;
}
var pt = Gh();
const rf = /* @__PURE__ */ rs(pt), Kh = /* @__PURE__ */ as({
  __proto__: null,
  default: rf
}, [pt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const Qh = rf ?? Kh;
function Le(n, l) {
  return pt.useEffect(af(n), l);
}
function Xo(n, l) {
  return pt.useLayoutEffect(af(n), l);
}
const Vh = /* @__PURE__ */ as({
  __proto__: null,
  default: Qh,
  useEffect: Le,
  useLayoutEffect: Xo
}, [pt]);
var No = { exports: {} }, dl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var pd;
function Xh() {
  if (pd) return dl;
  pd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function o(s, c, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), c.key !== void 0 && (p = "" + c.key), "key" in c) {
      d = {};
      for (var f in c)
        f !== "key" && (d[f] = c[f]);
    } else d = c;
    return c = d.ref, {
      $$typeof: n,
      type: s,
      key: p,
      ref: c !== void 0 ? c : null,
      props: d
    };
  }
  return dl.Fragment = l, dl.jsx = o, dl.jsxs = o, dl;
}
var hd;
function Zh() {
  return hd || (hd = 1, No.exports = Xh()), No.exports;
}
var Nt = Zh();
const Jh = /* @__PURE__ */ rs(Nt), Pv = /* @__PURE__ */ as({
  __proto__: null,
  default: Jh
}, [Nt]);
var To = { exports: {} }, Co = { exports: {} };
const Lh = /* @__PURE__ */ qh(Vh);
var jo = { exports: {} }, Mo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var gd;
function Wh() {
  return gd || (gd = 1, (function(n) {
    function l(X, et) {
      var lt = X.length;
      X.push(et);
      t: for (; 0 < lt; ) {
        var q = lt - 1 >>> 1, Y = X[q];
        if (0 < c(Y, et))
          X[q] = et, X[lt] = Y, lt = q;
        else break t;
      }
    }
    function o(X) {
      return X.length === 0 ? null : X[0];
    }
    function s(X) {
      if (X.length === 0) return null;
      var et = X[0], lt = X.pop();
      if (lt !== et) {
        X[0] = lt;
        t: for (var q = 0, Y = X.length, w = Y >>> 1; q < w; ) {
          var G = 2 * (q + 1) - 1, nt = X[G], tt = G + 1, at = X[tt];
          if (0 > c(nt, lt))
            tt < Y && 0 > c(at, nt) ? (X[q] = at, X[tt] = lt, q = tt) : (X[q] = nt, X[G] = lt, q = G);
          else if (tt < Y && 0 > c(at, lt))
            X[q] = at, X[tt] = lt, q = tt;
          else break t;
        }
      }
      return et;
    }
    function c(X, et) {
      var lt = X.sortIndex - et.sortIndex;
      return lt !== 0 ? lt : X.id - et.id;
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
    var g = [], x = [], T = 1, M = null, k = 3, E = !1, y = !1, h = !1, _ = !1, O = typeof setTimeout == "function" ? setTimeout : null, N = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
    function K(X) {
      for (var et = o(x); et !== null; ) {
        if (et.callback === null) s(x);
        else if (et.startTime <= X)
          s(x), et.sortIndex = et.expirationTime, l(g, et);
        else break;
        et = o(x);
      }
    }
    function B(X) {
      if (h = !1, K(X), !y)
        if (o(g) !== null)
          y = !0, A || (A = !0, L());
        else {
          var et = o(x);
          et !== null && ut(B, et.startTime - X);
        }
    }
    var A = !1, v = -1, b = 5, z = -1;
    function D() {
      return _ ? !0 : !(n.unstable_now() - z < b);
    }
    function V() {
      if (_ = !1, A) {
        var X = n.unstable_now();
        z = X;
        var et = !0;
        try {
          t: {
            y = !1, h && (h = !1, N(v), v = -1), E = !0;
            var lt = k;
            try {
              e: {
                for (K(X), M = o(g); M !== null && !(M.expirationTime > X && D()); ) {
                  var q = M.callback;
                  if (typeof q == "function") {
                    M.callback = null, k = M.priorityLevel;
                    var Y = q(
                      M.expirationTime <= X
                    );
                    if (X = n.unstable_now(), typeof Y == "function") {
                      M.callback = Y, K(X), et = !0;
                      break e;
                    }
                    M === o(g) && s(g), K(X);
                  } else s(g);
                  M = o(g);
                }
                if (M !== null) et = !0;
                else {
                  var w = o(x);
                  w !== null && ut(
                    B,
                    w.startTime - X
                  ), et = !1;
                }
              }
              break t;
            } finally {
              M = null, k = lt, E = !1;
            }
            et = void 0;
          }
        } finally {
          et ? L() : A = !1;
        }
      }
    }
    var L;
    if (typeof j == "function")
      L = function() {
        j(V);
      };
    else if (typeof MessageChannel < "u") {
      var ct = new MessageChannel(), ht = ct.port2;
      ct.port1.onmessage = V, L = function() {
        ht.postMessage(null);
      };
    } else
      L = function() {
        O(V, 0);
      };
    function ut(X, et) {
      v = O(function() {
        X(n.unstable_now());
      }, et);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(X) {
      X.callback = null;
    }, n.unstable_forceFrameRate = function(X) {
      0 > X || 125 < X ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : b = 0 < X ? Math.floor(1e3 / X) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return k;
    }, n.unstable_next = function(X) {
      switch (k) {
        case 1:
        case 2:
        case 3:
          var et = 3;
          break;
        default:
          et = k;
      }
      var lt = k;
      k = et;
      try {
        return X();
      } finally {
        k = lt;
      }
    }, n.unstable_requestPaint = function() {
      _ = !0;
    }, n.unstable_runWithPriority = function(X, et) {
      switch (X) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          X = 3;
      }
      var lt = k;
      k = X;
      try {
        return et();
      } finally {
        k = lt;
      }
    }, n.unstable_scheduleCallback = function(X, et, lt) {
      var q = n.unstable_now();
      switch (typeof lt == "object" && lt !== null ? (lt = lt.delay, lt = typeof lt == "number" && 0 < lt ? q + lt : q) : lt = q, X) {
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
      return Y = lt + Y, X = {
        id: T++,
        callback: et,
        priorityLevel: X,
        startTime: lt,
        expirationTime: Y,
        sortIndex: -1
      }, lt > q ? (X.sortIndex = lt, l(x, X), o(g) === null && X === o(x) && (h ? (N(v), v = -1) : h = !0, ut(B, lt - q))) : (X.sortIndex = Y, l(g, X), y || E || (y = !0, A || (A = !0, L()))), X;
    }, n.unstable_shouldYield = D, n.unstable_wrapCallback = function(X) {
      var et = k;
      return function() {
        var lt = k;
        k = et;
        try {
          return X.apply(this, arguments);
        } finally {
          k = lt;
        }
      };
    };
  })(Mo)), Mo;
}
var bd;
function Fh() {
  return bd || (bd = 1, jo.exports = Wh()), jo.exports;
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
var vd;
function Ih() {
  return vd || (vd = 1, (function(n) {
    n.exports = function(l) {
      function o(t, e, a, i) {
        return new Em(t, e, a, i);
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
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(c(188));
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
            throw Error(c(188));
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
              if (!m) throw Error(c(189));
            }
          }
          if (a.alternate !== i) throw Error(c(190));
        }
        if (a.tag !== 3) throw Error(c(188));
        return a.stateNode.current === a ? t : e;
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
      function T(t) {
        return t === null || typeof t != "object" ? null : (t = Eu && t[Eu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function M(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Mm ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case mn:
            return "Fragment";
          case Xr:
            return "Profiler";
          case ku:
            return "StrictMode";
          case Jr:
            return "Suspense";
          case Lr:
            return "SuspenseList";
          case Fr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case fn:
              return "Portal";
            case ya:
              return t.displayName || "Context";
            case zu:
              return (t._context.displayName || "Context") + ".Consumer";
            case Zr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Wr:
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
      function k(t) {
        return { current: t };
      }
      function E(t) {
        0 > gn || (t.current = ao[gn], ao[gn] = null, gn--);
      }
      function y(t, e) {
        gn++, ao[gn] = t.current, t.current = e;
      }
      function h(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (ih(t) / rh | 0) | 0;
      }
      function _(t) {
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
        var r = 0, u = t.suspendedLanes, m = t.pingedLanes;
        t = t.warmLanes;
        var S = i & 134217727;
        return S !== 0 ? (i = S & ~u, i !== 0 ? r = _(i) : (m &= S, m !== 0 ? r = _(m) : a || (a = S & ~t, a !== 0 && (r = _(a))))) : (S = i & ~u, S !== 0 ? r = _(S) : m !== 0 ? r = _(m) : a || (a = i & ~t, a !== 0 && (r = _(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
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
      function B(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function A(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function v(t, e, a, i, r, u) {
        var m = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var S = t.entanglements, U = t.expirationTimes, Q = t.hiddenUpdates;
        for (a = m & ~a; 0 < a; ) {
          var W = 31 - be(a), Z = 1 << W;
          S[W] = 0, U[W] = -1;
          var F = Q[W];
          if (F !== null)
            for (Q[W] = null, W = 0; W < F.length; W++) {
              var mt = F[W];
              mt !== null && (mt.lane &= -536870913);
            }
          a &= ~Z;
        }
        i !== 0 && b(t, i, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(m & ~e));
      }
      function b(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var i = 31 - be(e);
        t.entangledLanes |= e, t.entanglements[i] = t.entanglements[i] | 1073741824 | a & 261930;
      }
      function z(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var i = 31 - be(a), r = 1 << i;
          r & e | t[i] & e && (t[i] |= e), a &= ~r;
        }
      }
      function D(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : V(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function V(t) {
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
      function ct(t) {
        if (typeof dh == "function" && fh(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode(Pn, t);
          } catch {
          }
      }
      function ht(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function ut(t) {
        if (io === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            io = e && e[1] || "", $u = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + io + t + $u;
      }
      function X(t, e) {
        if (!t || ro) return "";
        ro = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var i = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var Z = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(Z.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(Z, []);
                    } catch (mt) {
                      var F = mt;
                    }
                    Reflect.construct(t, [], Z);
                  } else {
                    try {
                      Z.call();
                    } catch (mt) {
                      F = mt;
                    }
                    t.call(Z.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (mt) {
                    F = mt;
                  }
                  (Z = t()) && typeof Z.catch == "function" && Z.catch(function() {
                  });
                }
              } catch (mt) {
                if (mt && F && typeof mt.stack == "string")
                  return [mt.stack, F.stack];
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
            var U = m.split(`
`), Q = S.split(`
`);
            for (r = i = 0; i < U.length && !U[i].includes("DetermineComponentFrameRoot"); )
              i++;
            for (; r < Q.length && !Q[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (i === U.length || r === Q.length)
              for (i = U.length - 1, r = Q.length - 1; 1 <= i && 0 <= r && U[i] !== Q[r]; )
                r--;
            for (; 1 <= i && 0 <= r; i--, r--)
              if (U[i] !== Q[r]) {
                if (i !== 1 || r !== 1)
                  do
                    if (i--, r--, 0 > r || U[i] !== Q[r]) {
                      var W = `
` + U[i].replace(" at new ", " at ");
                      return t.displayName && W.includes("<anonymous>") && (W = W.replace("<anonymous>", t.displayName)), W;
                    }
                  while (1 <= i && 0 <= r);
                break;
              }
          }
        } finally {
          ro = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? ut(a) : "";
      }
      function et(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return ut(t.type);
          case 16:
            return ut("Lazy");
          case 13:
            return t.child !== e && e !== null ? ut("Suspense Fallback") : ut("Suspense");
          case 19:
            return ut("SuspenseList");
          case 0:
          case 15:
            return X(t.type, !1);
          case 11:
            return X(t.type.render, !1);
          case 1:
            return X(t.type, !0);
          case 31:
            return ut("Activity");
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
      function q(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Pu.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: lt(e)
          }, Pu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: lt(e)
        };
      }
      function Y(t, e) {
        vn[yn++] = tl, vn[yn++] = $l, $l = t, tl = e;
      }
      function w(t, e, a) {
        Ee[Ne++] = Ve, Ee[Ne++] = Xe, Ee[Ne++] = wa, wa = t;
        var i = Ve;
        t = Xe;
        var r = 32 - be(i) - 1;
        i &= ~(1 << r), a += 1;
        var u = 32 - be(e) + r;
        if (30 < u) {
          var m = r - r % 5;
          u = (i & (1 << m) - 1).toString(32), i >>= m, r -= m, Ve = 1 << 32 - be(e) + r | a << r | i, Xe = u + t;
        } else
          Ve = 1 << u | a << r | i, Xe = t;
      }
      function G(t) {
        t.return !== null && (Y(t, 1), w(t, 1, 0));
      }
      function nt(t) {
        for (; t === $l; )
          $l = vn[--yn], vn[yn] = null, tl = vn[--yn], vn[yn] = null;
        for (; t === wa; )
          wa = Ee[--Ne], Ee[Ne] = null, Xe = Ee[--Ne], Ee[Ne] = null, Ve = Ee[--Ne], Ee[Ne] = null;
      }
      function tt(t, e) {
        Ee[Ne++] = Ve, Ee[Ne++] = Xe, Ee[Ne++] = wa, Ve = e.id, Xe = e.overflow, wa = t;
      }
      function at(t, e) {
        y(_a, e), y(el, t), y(te, null), t = Rm(e), E(te), y(te, t);
      }
      function it() {
        E(te), E(el), E(_a);
      }
      function St(t) {
        t.memoizedState !== null && y(Pl, t);
        var e = te.current, a = Hm(e, t.type);
        e !== a && (y(el, t), y(te, a));
      }
      function Jt(t) {
        el.current === t && (E(te), E(el)), Pl.current === t && (E(Pl), ea ? Xa._currentValue = pn : Xa._currentValue2 = pn);
      }
      function ft(t) {
        var e = Error(
          c(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Hn(q(e, t)), oo;
      }
      function Ha(t, e) {
        if (!re) throw Error(c(175));
        Hp(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ft(t, !0);
      }
      function Da(t) {
        for (ee = t.return; ee; )
          switch (ee.tag) {
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
              ee = ee.return;
          }
      }
      function Oe(t) {
        if (!re || t !== ee) return !1;
        if (!_t) return Da(t), _t = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || qu(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ft(t) : e !== 3 && (e !== 5 || qu(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && ft(t), Da(t), e === 13) {
          if (!re) throw Error(c(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Ot = Yp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(317));
          Ot = qp(t);
        } else
          Ot = Vt && e === 27 ? zp(
            t.type,
            Ot
          ) : ee ? Bu(t.stateNode) : null;
        return !0;
      }
      function Re() {
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
        ea ? (y(ti, e._currentValue), e._currentValue = a) : (y(ti, e._currentValue2), e._currentValue2 = a);
      }
      function We(t) {
        var e = ti.current;
        ea ? t._currentValue = e : t._currentValue2 = e, E(ti);
      }
      function Ki(t, e, a) {
        for (; t !== null; ) {
          var i = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, i !== null && (i.childLanes |= e)) : i !== null && (i.childLanes & e) !== e && (i.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Qi(t, e, a, i) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var m = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var S = u;
              u = r;
              for (var U = 0; U < e.length; U++)
                if (S.context === e[U]) {
                  u.lanes |= a, S = u.alternate, S !== null && (S.lanes |= a), Ki(
                    u.return,
                    a,
                    t
                  ), i || (m = null);
                  break t;
                }
              u = S.next;
            }
          } else if (r.tag === 18) {
            if (m = r.return, m === null) throw Error(c(341));
            m.lanes |= a, u = m.alternate, u !== null && (u.lanes |= a), Ki(m, a, t), m = null;
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
            if (m === null) throw Error(c(387));
            if (m = m.memoizedProps, m !== null) {
              var S = r.type;
              ye(r.pendingProps.value, m.value) || (t !== null ? t.push(S) : t = [S]);
            }
          } else if (r === Pl.current) {
            if (m = r.alternate, m === null) throw Error(c(387));
            m.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Xa) : t = [Xa]);
          }
          r = r.return;
        }
        t !== null && Qi(
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
        return fs(Za, t);
      }
      function bl(t, e) {
        return Za === null && Ua(t), fs(t, e);
      }
      function fs(t, e) {
        var a = ea ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, na === null) {
          if (t === null) throw Error(c(308));
          na = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else na = na.next = e;
        return a;
      }
      function Vi() {
        return {
          controller: new ph(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Dn(t) {
        t.refCount--, t.refCount === 0 && hh(gh, function() {
          t.controller.abort();
        });
      }
      function vl() {
      }
      function Ge(t) {
        t !== xn && t.next === null && (xn === null ? ei = xn = t : xn = xn.next = t), ai = !0, so || (so = !0, am());
      }
      function on(t, e) {
        if (!co && ai) {
          co = !0;
          do
            for (var a = !1, i = ei; i !== null; ) {
              if (t !== 0) {
                var r = i.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var m = i.suspendedLanes, S = i.pingedLanes;
                  u = (1 << 31 - be(42 | t) + 1) - 1, u &= r & ~(m & ~S), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, bs(i, u));
              } else
                u = wt, u = O(
                  i,
                  i === Mt ? u : 0,
                  i.cancelPendingCommit !== null || i.timeoutHandle !== Va
                ), (u & 3) === 0 || N(i, u) || (a = !0, bs(i, u));
              i = i.next;
            }
          while (a);
          co = !1;
        }
      }
      function ms() {
        ps();
      }
      function ps() {
        ai = so = !1;
        var t = 0;
        Ja !== 0 && Vm() && (t = Ja);
        for (var e = de(), a = null, i = ei; i !== null; ) {
          var r = i.next, u = hs(i, e);
          u === 0 ? (i.next = null, a === null ? ei = r : a.next = r, r === null && (xn = a)) : (a = i, (t !== 0 || (u & 3) !== 0) && (ai = !0)), i = r;
        }
        Xt !== 0 && Xt !== 5 || on(t), Ja !== 0 && (Ja = 0);
      }
      function hs(t, e) {
        for (var a = t.suspendedLanes, i = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var m = 31 - be(u), S = 1 << m, U = r[m];
          U === -1 ? ((S & a) === 0 || (S & i) !== 0) && (r[m] = j(S, e)) : U <= e && (t.expiredLanes |= S), u &= ~S;
        }
        if (e = Mt, a = wt, a = O(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Va
        ), i = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return i !== null && i !== null && no(i), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || N(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (i !== null && no(i), L(a)) {
            case 2:
            case 8:
              a = ch;
              break;
            case 32:
              a = lo;
              break;
            case 268435456:
              a = uh;
              break;
            default:
              a = lo;
          }
          return i = gs.bind(null, t), a = Il(a, i), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return i !== null && i !== null && no(i), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function gs(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Wn() && t.callbackNode !== a)
          return null;
        var i = wt;
        return i = O(
          t,
          t === Mt ? i : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Va
        ), i === 0 ? null : (Pc(t, i, e), hs(t, de()), t.callbackNode != null && t.callbackNode === a ? gs.bind(null, t) : null);
      }
      function bs(t, e) {
        if (Wn()) return null;
        Pc(t, e, !0);
      }
      function am() {
        Im ? $m(function() {
          (yt & 6) !== 0 ? Il(
            Fu,
            ms
          ) : ps();
        }) : Il(
          Fu,
          ms
        );
      }
      function Xi() {
        if (Ja === 0) {
          var t = wn;
          t === 0 && (t = Ll, Ll <<= 1, (Ll & 261888) === 0 && (Ll = 256)), Ja = t;
        }
        return Ja;
      }
      function nm(t, e) {
        if (al === null) {
          var a = al = [];
          uo = 0, wn = Xi(), _n = {
            status: "pending",
            value: void 0,
            then: function(i) {
              a.push(i);
            }
          };
        }
        return uo++, e.then(vs, vs), e;
      }
      function vs() {
        if (--uo === 0 && al !== null) {
          _n !== null && (_n.status = "fulfilled");
          var t = al;
          al = null, wn = 0, _n = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function lm(t, e) {
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
      function Zi() {
        var t = La.current;
        return t !== null ? t : Mt.pooledCache;
      }
      function yl(t, e) {
        e === null ? y(La, La.current) : y(La, e.pool);
      }
      function ys() {
        var t = Zi();
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
          if (!mh.call(e, r) || !ye(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function xs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function ws(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(vl, vl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Ss(t), t;
          default:
            if (typeof e.status == "string") e.then(vl, vl);
            else {
              if (t = Mt, t !== null && 100 < t.shellSuspendCounter)
                throw Error(c(482));
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
                throw t = e.reason, Ss(t), t;
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
      function _s() {
        if (Wa === null) throw Error(c(459));
        var t = Wa;
        return Wa = null, t;
      }
      function Ss(t) {
        if (t === Sn || t === ni)
          throw Error(c(483));
      }
      function wl(t) {
        var e = nl;
        return nl += 1, kn === null && (kn = []), ws(kn, t, e);
      }
      function Un(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function _l(t, e) {
        throw e.$$typeof === Cm ? Error(c(525)) : (t = Object.prototype.toString.call(e), Error(
          c(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function ks(t) {
        function e(R, C) {
          if (t) {
            var H = R.deletions;
            H === null ? (R.deletions = [C], R.flags |= 16) : H.push(C);
          }
        }
        function a(R, C) {
          if (!t) return null;
          for (; C !== null; )
            e(R, C), C = C.sibling;
          return null;
        }
        function i(R) {
          for (var C = /* @__PURE__ */ new Map(); R !== null; )
            R.key !== null ? C.set(R.key, R) : C.set(R.index, R), R = R.sibling;
          return C;
        }
        function r(R, C) {
          return R = ta(R, C), R.index = 0, R.sibling = null, R;
        }
        function u(R, C, H) {
          return R.index = H, t ? (H = R.alternate, H !== null ? (H = H.index, H < C ? (R.flags |= 67108866, C) : H) : (R.flags |= 67108866, C)) : (R.flags |= 1048576, C);
        }
        function m(R) {
          return t && R.alternate === null && (R.flags |= 67108866), R;
        }
        function S(R, C, H, J) {
          return C === null || C.tag !== 6 ? (C = Gr(H, R.mode, J), C.return = R, C) : (C = r(C, H), C.return = R, C);
        }
        function U(R, C, H, J) {
          var ot = H.type;
          return ot === mn ? W(
            R,
            C,
            H.props.children,
            J,
            H.key
          ) : C !== null && (C.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === xa && Ba(ot) === C.type) ? (C = r(C, H.props), Un(C, H), C.return = R, C) : (C = Vl(
            H.type,
            H.key,
            H.props,
            null,
            R.mode,
            J
          ), Un(C, H), C.return = R, C);
        }
        function Q(R, C, H, J) {
          return C === null || C.tag !== 4 || C.stateNode.containerInfo !== H.containerInfo || C.stateNode.implementation !== H.implementation ? (C = Kr(H, R.mode, J), C.return = R, C) : (C = r(C, H.children || []), C.return = R, C);
        }
        function W(R, C, H, J, ot) {
          return C === null || C.tag !== 7 ? (C = Qa(
            H,
            R.mode,
            J,
            ot
          ), C.return = R, C) : (C = r(C, H), C.return = R, C);
        }
        function Z(R, C, H) {
          if (typeof C == "string" && C !== "" || typeof C == "number" || typeof C == "bigint")
            return C = Gr(
              "" + C,
              R.mode,
              H
            ), C.return = R, C;
          if (typeof C == "object" && C !== null) {
            switch (C.$$typeof) {
              case Xl:
                return H = Vl(
                  C.type,
                  C.key,
                  C.props,
                  null,
                  R.mode,
                  H
                ), Un(H, C), H.return = R, H;
              case fn:
                return C = Kr(
                  C,
                  R.mode,
                  H
                ), C.return = R, C;
              case xa:
                return C = Ba(C), Z(R, C, H);
            }
            if (Zl(C) || T(C))
              return C = Qa(
                C,
                R.mode,
                H,
                null
              ), C.return = R, C;
            if (typeof C.then == "function")
              return Z(R, wl(C), H);
            if (C.$$typeof === ya)
              return Z(
                R,
                bl(R, C),
                H
              );
            _l(R, C);
          }
          return null;
        }
        function F(R, C, H, J) {
          var ot = C !== null ? C.key : null;
          if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
            return ot !== null ? null : S(R, C, "" + H, J);
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case Xl:
                return H.key === ot ? U(R, C, H, J) : null;
              case fn:
                return H.key === ot ? Q(R, C, H, J) : null;
              case xa:
                return H = Ba(H), F(R, C, H, J);
            }
            if (Zl(H) || T(H))
              return ot !== null ? null : W(R, C, H, J, null);
            if (typeof H.then == "function")
              return F(
                R,
                C,
                wl(H),
                J
              );
            if (H.$$typeof === ya)
              return F(
                R,
                C,
                bl(R, H),
                J
              );
            _l(R, H);
          }
          return null;
        }
        function mt(R, C, H, J, ot) {
          if (typeof J == "string" && J !== "" || typeof J == "number" || typeof J == "bigint")
            return R = R.get(H) || null, S(C, R, "" + J, ot);
          if (typeof J == "object" && J !== null) {
            switch (J.$$typeof) {
              case Xl:
                return R = R.get(
                  J.key === null ? H : J.key
                ) || null, U(C, R, J, ot);
              case fn:
                return R = R.get(
                  J.key === null ? H : J.key
                ) || null, Q(C, R, J, ot);
              case xa:
                return J = Ba(J), mt(
                  R,
                  C,
                  H,
                  J,
                  ot
                );
            }
            if (Zl(J) || T(J))
              return R = R.get(H) || null, W(C, R, J, ot, null);
            if (typeof J.then == "function")
              return mt(
                R,
                C,
                H,
                wl(J),
                ot
              );
            if (J.$$typeof === ya)
              return mt(
                R,
                C,
                H,
                bl(C, J),
                ot
              );
            _l(C, J);
          }
          return null;
        }
        function ae(R, C, H, J) {
          for (var ot = null, Ht = null, st = C, zt = C = 0, Ft = null; st !== null && zt < H.length; zt++) {
            st.index > zt ? (Ft = st, st = null) : Ft = st.sibling;
            var Et = F(
              R,
              st,
              H[zt],
              J
            );
            if (Et === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Et.alternate === null && e(R, st), C = u(Et, C, zt), Ht === null ? ot = Et : Ht.sibling = Et, Ht = Et, st = Ft;
          }
          if (zt === H.length)
            return a(R, st), _t && Y(R, zt), ot;
          if (st === null) {
            for (; zt < H.length; zt++)
              st = Z(R, H[zt], J), st !== null && (C = u(
                st,
                C,
                zt
              ), Ht === null ? ot = st : Ht.sibling = st, Ht = st);
            return _t && Y(R, zt), ot;
          }
          for (st = i(st); zt < H.length; zt++)
            Ft = mt(
              st,
              R,
              zt,
              H[zt],
              J
            ), Ft !== null && (t && Ft.alternate !== null && st.delete(
              Ft.key === null ? zt : Ft.key
            ), C = u(
              Ft,
              C,
              zt
            ), Ht === null ? ot = Ft : Ht.sibling = Ft, Ht = Ft);
          return t && st.forEach(function(Ca) {
            return e(R, Ca);
          }), _t && Y(R, zt), ot;
        }
        function ul(R, C, H, J) {
          if (H == null) throw Error(c(151));
          for (var ot = null, Ht = null, st = C, zt = C = 0, Ft = null, Et = H.next(); st !== null && !Et.done; zt++, Et = H.next()) {
            st.index > zt ? (Ft = st, st = null) : Ft = st.sibling;
            var Ca = F(R, st, Et.value, J);
            if (Ca === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Ca.alternate === null && e(R, st), C = u(Ca, C, zt), Ht === null ? ot = Ca : Ht.sibling = Ca, Ht = Ca, st = Ft;
          }
          if (Et.done)
            return a(R, st), _t && Y(R, zt), ot;
          if (st === null) {
            for (; !Et.done; zt++, Et = H.next())
              Et = Z(R, Et.value, J), Et !== null && (C = u(
                Et,
                C,
                zt
              ), Ht === null ? ot = Et : Ht.sibling = Et, Ht = Et);
            return _t && Y(R, zt), ot;
          }
          for (st = i(st); !Et.done; zt++, Et = H.next())
            Et = mt(
              st,
              R,
              zt,
              Et.value,
              J
            ), Et !== null && (t && Et.alternate !== null && st.delete(Et.key === null ? zt : Et.key), C = u(Et, C, zt), Ht === null ? ot = Et : Ht.sibling = Et, Ht = Et);
          return t && st.forEach(function(xh) {
            return e(R, xh);
          }), _t && Y(R, zt), ot;
        }
        function Pa(R, C, H, J) {
          if (typeof H == "object" && H !== null && H.type === mn && H.key === null && (H = H.props.children), typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case Xl:
                t: {
                  for (var ot = H.key; C !== null; ) {
                    if (C.key === ot) {
                      if (ot = H.type, ot === mn) {
                        if (C.tag === 7) {
                          a(
                            R,
                            C.sibling
                          ), J = r(
                            C,
                            H.props.children
                          ), J.return = R, R = J;
                          break t;
                        }
                      } else if (C.elementType === ot || typeof ot == "object" && ot !== null && ot.$$typeof === xa && Ba(ot) === C.type) {
                        a(
                          R,
                          C.sibling
                        ), J = r(C, H.props), Un(J, H), J.return = R, R = J;
                        break t;
                      }
                      a(R, C);
                      break;
                    } else e(R, C);
                    C = C.sibling;
                  }
                  H.type === mn ? (J = Qa(
                    H.props.children,
                    R.mode,
                    J,
                    H.key
                  ), J.return = R, R = J) : (J = Vl(
                    H.type,
                    H.key,
                    H.props,
                    null,
                    R.mode,
                    J
                  ), Un(J, H), J.return = R, R = J);
                }
                return m(R);
              case fn:
                t: {
                  for (ot = H.key; C !== null; ) {
                    if (C.key === ot)
                      if (C.tag === 4 && C.stateNode.containerInfo === H.containerInfo && C.stateNode.implementation === H.implementation) {
                        a(
                          R,
                          C.sibling
                        ), J = r(
                          C,
                          H.children || []
                        ), J.return = R, R = J;
                        break t;
                      } else {
                        a(R, C);
                        break;
                      }
                    else e(R, C);
                    C = C.sibling;
                  }
                  J = Kr(H, R.mode, J), J.return = R, R = J;
                }
                return m(R);
              case xa:
                return H = Ba(H), Pa(
                  R,
                  C,
                  H,
                  J
                );
            }
            if (Zl(H))
              return ae(
                R,
                C,
                H,
                J
              );
            if (T(H)) {
              if (ot = T(H), typeof ot != "function")
                throw Error(c(150));
              return H = ot.call(H), ul(
                R,
                C,
                H,
                J
              );
            }
            if (typeof H.then == "function")
              return Pa(
                R,
                C,
                wl(H),
                J
              );
            if (H.$$typeof === ya)
              return Pa(
                R,
                C,
                bl(R, H),
                J
              );
            _l(R, H);
          }
          return typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint" ? (H = "" + H, C !== null && C.tag === 6 ? (a(R, C.sibling), J = r(C, H), J.return = R, R = J) : (a(R, C), J = Gr(H, R.mode, J), J.return = R, R = J), m(R)) : a(R, C);
        }
        return function(R, C, H, J) {
          try {
            nl = 0;
            var ot = Pa(
              R,
              C,
              H,
              J
            );
            return kn = null, ot;
          } catch (st) {
            if (st === Sn || st === ni) throw st;
            var Ht = o(29, st, null, R.mode);
            return Ht.lanes = J, Ht.return = R, Ht;
          } finally {
          }
        };
      }
      function Sl() {
        for (var t = zn, e = mo = zn = 0; e < t; ) {
          var a = Ce[e];
          Ce[e++] = null;
          var i = Ce[e];
          Ce[e++] = null;
          var r = Ce[e];
          Ce[e++] = null;
          var u = Ce[e];
          if (Ce[e++] = null, i !== null && r !== null) {
            var m = i.pending;
            m === null ? r.next = r : (r.next = m.next, m.next = r), i.pending = r;
          }
          u !== 0 && zs(a, r, u);
        }
      }
      function kl(t, e, a, i) {
        Ce[zn++] = t, Ce[zn++] = e, Ce[zn++] = a, Ce[zn++] = i, mo |= i, t.lanes |= i, t = t.alternate, t !== null && (t.lanes |= i);
      }
      function Ji(t, e, a, i) {
        return kl(t, e, a, i), zl(t);
      }
      function qa(t, e) {
        return kl(t, null, null, e), zl(t);
      }
      function zs(t, e, a) {
        t.lanes |= a;
        var i = t.alternate;
        i !== null && (i.lanes |= a);
        for (var r = !1, u = t.return; u !== null; )
          u.childLanes |= a, i = u.alternate, i !== null && (i.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - be(a), t = u.hiddenUpdates, i = t[r], i === null ? t[r] = [e] : i.push(e), e.lane = a | 536870912), u) : null;
      }
      function zl(t) {
        if (50 < cl)
          throw cl = 0, zo = null, Error(c(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Li(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Wi(t, e) {
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
        if (i = i.shared, (yt & 2) !== 0) {
          var r = i.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), i.pending = e, e = zl(t), zs(t, null, a), e;
        }
        return kl(t, i, e, a), zl(t);
      }
      function Bn(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, z(t, a);
        }
      }
      function Fi(t, e) {
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
        if (po) {
          var t = _n;
          if (t !== null) throw t;
        }
      }
      function Yn(t, e, a, i) {
        po = !1;
        var r = t.updateQueue;
        ka = !1;
        var u = r.firstBaseUpdate, m = r.lastBaseUpdate, S = r.shared.pending;
        if (S !== null) {
          r.shared.pending = null;
          var U = S, Q = U.next;
          U.next = null, m === null ? u = Q : m.next = Q, m = U;
          var W = t.alternate;
          W !== null && (W = W.updateQueue, S = W.lastBaseUpdate, S !== m && (S === null ? W.firstBaseUpdate = Q : S.next = Q, W.lastBaseUpdate = U));
        }
        if (u !== null) {
          var Z = r.baseState;
          m = 0, W = Q = U = null, S = u;
          do {
            var F = S.lane & -536870913, mt = F !== S.lane;
            if (mt ? (wt & F) === F : (i & F) === F) {
              F !== 0 && F === wn && (po = !0), W !== null && (W = W.next = {
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
                      Z = ae.call(
                        Pa,
                        Z,
                        F
                      );
                      break t;
                    }
                    Z = ae;
                    break t;
                  case 3:
                    ae.flags = ae.flags & -65537 | 128;
                  case 0:
                    if (ae = ul.payload, F = typeof ae == "function" ? ae.call(Pa, Z, F) : ae, F == null) break t;
                    Z = Vr({}, Z, F);
                    break t;
                  case 2:
                    ka = !0;
                }
              }
              F = S.callback, F !== null && (t.flags |= 64, mt && (t.flags |= 8192), mt = r.callbacks, mt === null ? r.callbacks = [F] : mt.push(F));
            } else
              mt = {
                lane: F,
                tag: S.tag,
                payload: S.payload,
                callback: S.callback,
                next: null
              }, W === null ? (Q = W = mt, U = Z) : W = W.next = mt, m |= F;
            if (S = S.next, S === null) {
              if (S = r.shared.pending, S === null)
                break;
              mt = S, S = mt.next, mt.next = null, r.lastBaseUpdate = mt, r.shared.pending = null;
            }
          } while (!0);
          W === null && (U = Z), r.baseState = U, r.firstBaseUpdate = Q, r.lastBaseUpdate = W, u === null && (r.shared.lanes = 0), Ea |= m, t.lanes = m, t.memoizedState = Z;
        }
      }
      function Es(t, e) {
        if (typeof t != "function")
          throw Error(c(191, t));
        t.call(e);
      }
      function Ns(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Es(a[t], e);
      }
      function Ts(t, e) {
        t = ra, y(ii, t), y(En, e), ra = t | e.baseLanes;
      }
      function Ii() {
        y(ii, ra), y(En, En.current);
      }
      function $i() {
        ra = ii.current, E(En), E(ii);
      }
      function ha(t) {
        var e = t.alternate;
        y(qt, qt.current & 1), y(xe, t), je === null && (e === null || En.current !== null || e.memoizedState !== null) && (je = t);
      }
      function Pi(t) {
        y(qt, qt.current), y(xe, t), je === null && (je = t);
      }
      function Cs(t) {
        t.tag === 22 ? (y(qt, qt.current), y(xe, t), je === null && (je = t)) : ga();
      }
      function ga() {
        y(qt, qt.current), y(xe, xe.current);
      }
      function pe(t) {
        E(xe), je === t && (je = null), E(qt);
      }
      function El(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Pr(a) || to(a)))
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
        throw Error(c(321));
      }
      function tr(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ye(t[a], e[a])) return !1;
        return !0;
      }
      function er(t, e, a, i, r, u) {
        return la = u, gt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, rt.H = t === null || t.memoizedState === null ? ad : ho, Ia = !1, u = a(i, r), Ia = !1, Nn && (u = Ms(
          e,
          a,
          i,
          r
        )), js(t), u;
      }
      function js(t) {
        rt.H = il;
        var e = jt !== null && jt.next !== null;
        if (la = 0, Yt = jt = gt = null, ri = !1, ll = 0, Tn = null, e) throw Error(c(300));
        t === null || Gt || (t = t.dependencies, t !== null && gl(t) && (Gt = !0));
      }
      function Ms(t, e, a, i) {
        gt = t;
        var r = 0;
        do {
          if (Nn && (Tn = null), ll = 0, Nn = !1, 25 <= r) throw Error(c(301));
          if (r += 1, Yt = jt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          rt.H = nd, u = e(a, i);
        } while (Nn);
        return u;
      }
      function im() {
        var t = rt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Gn(e) : e, t = t.useState()[0], (jt !== null ? jt.memoizedState : null) !== t && (gt.flags |= 1024), e;
      }
      function ar() {
        var t = oi !== 0;
        return oi = 0, t;
      }
      function nr(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function lr(t) {
        if (ri) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ri = !1;
        }
        la = 0, Yt = jt = gt = null, Nn = !1, ll = oi = 0, Tn = null;
      }
      function se() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Yt === null ? gt.memoizedState = Yt = t : Yt = Yt.next = t, Yt;
      }
      function Bt() {
        if (jt === null) {
          var t = gt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = jt.next;
        var e = Yt === null ? gt.memoizedState : Yt.next;
        if (e !== null)
          Yt = e, jt = t;
        else {
          if (t === null)
            throw gt.alternate === null ? Error(c(467)) : Error(c(310));
          jt = t, t = {
            memoizedState: jt.memoizedState,
            baseState: jt.baseState,
            baseQueue: jt.baseQueue,
            queue: jt.queue,
            next: null
          }, Yt === null ? gt.memoizedState = Yt = t : Yt = Yt.next = t;
        }
        return Yt;
      }
      function Nl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Gn(t) {
        var e = ll;
        return ll += 1, Tn === null && (Tn = []), t = ws(Tn, t, e), e = gt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, rt.H = e === null || e.memoizedState === null ? ad : ho), t;
      }
      function Tl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Gn(t);
          if (t.$$typeof === ya) return $t(t);
        }
        throw Error(c(438, String(t)));
      }
      function ir(t) {
        var e = null, a = gt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var i = gt.alternate;
          i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (e = {
            data: i.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Nl(), gt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), i = 0; i < t; i++)
            a[i] = jm;
        return e.index++, a;
      }
      function Fe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Cl(t) {
        var e = Bt();
        return rr(e, jt, t);
      }
      function rr(t, e, a) {
        var i = t.queue;
        if (i === null) throw Error(c(311));
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
          var S = m = null, U = null, Q = e, W = !1;
          do {
            var Z = Q.lane & -536870913;
            if (Z !== Q.lane ? (wt & Z) === Z : (la & Z) === Z) {
              var F = Q.revertLane;
              if (F === 0)
                U !== null && (U = U.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }), Z === wn && (W = !0);
              else if ((la & F) === F) {
                Q = Q.next, F === wn && (W = !0);
                continue;
              } else
                Z = {
                  lane: 0,
                  revertLane: Q.revertLane,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }, U === null ? (S = U = Z, m = u) : U = U.next = Z, gt.lanes |= F, Ea |= F;
              Z = Q.action, Ia && a(u, Z), u = Q.hasEagerState ? Q.eagerState : a(u, Z);
            } else
              F = {
                lane: Z,
                revertLane: Q.revertLane,
                gesture: Q.gesture,
                action: Q.action,
                hasEagerState: Q.hasEagerState,
                eagerState: Q.eagerState,
                next: null
              }, U === null ? (S = U = F, m = u) : U = U.next = F, gt.lanes |= Z, Ea |= Z;
            Q = Q.next;
          } while (Q !== null && Q !== e);
          if (U === null ? m = u : U.next = S, !ye(u, t.memoizedState) && (Gt = !0, W && (a = _n, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = m, t.baseQueue = U, i.lastRenderedState = u;
        }
        return r === null && (i.lanes = 0), [t.memoizedState, i.dispatch];
      }
      function or(t) {
        var e = Bt(), a = e.queue;
        if (a === null) throw Error(c(311));
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
      function As(t, e, a) {
        var i = gt, r = Bt(), u = _t;
        if (u) {
          if (a === void 0)
            throw Error(c(407));
          a = a();
        } else a = e();
        var m = !ye(
          (jt || r).memoizedState,
          a
        );
        if (m && (r.memoizedState = a, Gt = !0), r = r.queue, ur(Hs.bind(null, i, r, t), [
          t
        ]), r.getSnapshot !== e || m || Yt !== null && Yt.memoizedState.tag & 1) {
          if (i.flags |= 2048, sn(
            9,
            { destroy: void 0 },
            Rs.bind(
              null,
              i,
              r,
              a,
              e
            ),
            null
          ), Mt === null) throw Error(c(349));
          u || (la & 127) !== 0 || Os(i, e, a);
        }
        return a;
      }
      function Os(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = gt.updateQueue, e === null ? (e = Nl(), gt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function Rs(t, e, a, i) {
        e.value = a, e.getSnapshot = i, Ds(e) && Us(t);
      }
      function Hs(t, e, a) {
        return a(function() {
          Ds(e) && Us(t);
        });
      }
      function Ds(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ye(t, a);
        } catch {
          return !0;
        }
      }
      function Us(t) {
        var e = qa(t, 2);
        e !== null && ue(e, t, 2);
      }
      function sr(t) {
        var e = se();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Ia) {
            ct(!0);
            try {
              a();
            } finally {
              ct(!1);
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
      function Bs(t, e, a, i) {
        return t.baseState = a, rr(
          t,
          jt,
          typeof i == "function" ? i : Fe
        );
      }
      function rm(t, e, a, i, r) {
        if (Al(t)) throw Error(c(485));
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
          rt.T !== null ? a(!0) : u.isTransition = !1, i(u), a = e.pending, a === null ? (u.next = e.pending = u, qs(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function qs(t, e) {
        var a = e.action, i = e.payload, r = t.state;
        if (e.isTransition) {
          var u = rt.T, m = {};
          rt.T = m;
          try {
            var S = a(r, i), U = rt.S;
            U !== null && U(m, S), Ys(t, e, S);
          } catch (Q) {
            cr(t, e, Q);
          } finally {
            u !== null && m.types !== null && (u.types = m.types), rt.T = u;
          }
        } else
          try {
            u = a(r, i), Ys(t, e, u);
          } catch (Q) {
            cr(t, e, Q);
          }
      }
      function Ys(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(i) {
            Gs(t, e, i);
          },
          function(i) {
            return cr(t, e, i);
          }
        ) : Gs(t, e, a);
      }
      function Gs(t, e, a) {
        e.status = "fulfilled", e.value = a, Ks(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, qs(t, a)));
      }
      function cr(t, e, a) {
        var i = t.pending;
        if (t.pending = null, i !== null) {
          i = i.next;
          do
            e.status = "rejected", e.reason = a, Ks(e), e = e.next;
          while (e !== i);
        }
        t.action = null;
      }
      function Ks(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Qs(t, e) {
        return e;
      }
      function Vs(t, e) {
        if (_t) {
          var a = Mt.formState;
          if (a !== null) {
            t: {
              var i = gt;
              if (_t) {
                if (Ot) {
                  var r = Sp(
                    Ot,
                    Te
                  );
                  if (r) {
                    Ot = Bu(r), i = kp(r);
                    break t;
                  }
                }
                ft(i);
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
          lastRenderedReducer: Qs,
          lastRenderedState: e
        }, a.queue = i, a = sc.bind(
          null,
          gt,
          i
        ), i.dispatch = a, i = sr(!1);
        var u = pr.bind(
          null,
          gt,
          !1,
          i.queue
        );
        return i = se(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, i.queue = r, a = rm.bind(
          null,
          gt,
          r,
          u,
          a
        ), r.dispatch = a, i.memoizedState = t, [e, a, !1];
      }
      function Xs(t) {
        var e = Bt();
        return Zs(e, jt, t);
      }
      function Zs(t, e, a) {
        if (e = rr(
          t,
          e,
          Qs
        )[0], t = Cl(Fe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var i = Gn(e);
          } catch (m) {
            throw m === Sn ? ni : m;
          }
        else i = e;
        e = Bt();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (gt.flags |= 2048, sn(
          9,
          { destroy: void 0 },
          om.bind(null, r, a),
          null
        )), [i, u, t];
      }
      function om(t, e) {
        t.action = e;
      }
      function Js(t) {
        var e = Bt(), a = jt;
        if (a !== null)
          return Zs(e, a, t);
        Bt(), e = e.memoizedState, a = Bt();
        var i = a.queue.dispatch;
        return a.memoizedState = t, [e, i, !1];
      }
      function sn(t, e, a, i) {
        return t = { tag: t, create: a, deps: i, inst: e, next: null }, e = gt.updateQueue, e === null && (e = Nl(), gt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (i = a.next, a.next = t, t.next = i, e.lastEffect = t), t;
      }
      function Ls() {
        return Bt().memoizedState;
      }
      function jl(t, e, a, i) {
        var r = se();
        gt.flags |= t, r.memoizedState = sn(
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
        jt !== null && i !== null && tr(i, jt.memoizedState.deps) ? r.memoizedState = sn(e, u, a, i) : (gt.flags |= t, r.memoizedState = sn(
          1 | e,
          u,
          a,
          i
        ));
      }
      function Ws(t, e) {
        jl(8390656, 8, t, e);
      }
      function ur(t, e) {
        Ml(2048, 8, t, e);
      }
      function sm(t) {
        gt.flags |= 4;
        var e = gt.updateQueue;
        if (e === null)
          e = Nl(), gt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Fs(t) {
        var e = Bt().memoizedState;
        return sm({ ref: e, nextImpl: t }), function() {
          if ((yt & 2) !== 0)
            throw Error(c(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Is(t, e) {
        return Ml(4, 2, t, e);
      }
      function $s(t, e) {
        return Ml(4, 4, t, e);
      }
      function Ps(t, e) {
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
      function tc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Ml(
          4,
          4,
          Ps.bind(null, e, t),
          a
        );
      }
      function dr() {
      }
      function ec(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        return e !== null && tr(e, i[1]) ? i[0] : (a.memoizedState = [t, e], t);
      }
      function ac(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        if (e !== null && tr(e, i[1]))
          return i[0];
        if (i = t(), Ia) {
          ct(!0);
          try {
            t();
          } finally {
            ct(!1);
          }
        }
        return a.memoizedState = [i, e], i;
      }
      function fr(t, e, a) {
        return a === void 0 || (la & 1073741824) !== 0 && (wt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = $c(), gt.lanes |= t, Ea |= t, a);
      }
      function nc(t, e, a, i) {
        return ye(a, e) ? a : En.current !== null ? (t = fr(t, a, i), ye(t, e) || (Gt = !0), t) : (la & 42) === 0 || (la & 1073741824) !== 0 && (wt & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = $c(), gt.lanes |= t, Ea |= t, e);
      }
      function lc(t, e, a, i, r) {
        var u = aa();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var m = rt.T, S = {};
        rt.T = S, pr(t, !1, e, a);
        try {
          var U = r(), Q = rt.S;
          if (Q !== null && Q(S, U), U !== null && typeof U == "object" && typeof U.then == "function") {
            var W = lm(
              U,
              i
            );
            Kn(
              t,
              e,
              W,
              he(t)
            );
          } else
            Kn(
              t,
              e,
              i,
              he(t)
            );
        } catch (Z) {
          Kn(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: Z },
            he()
          );
        } finally {
          Lt(u), m !== null && S.types !== null && (m.types = S.types), rt.T = m;
        }
      }
      function ic(t) {
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
      function mr() {
        return $t(Xa);
      }
      function rc() {
        return Bt().memoizedState;
      }
      function oc() {
        return Bt().memoizedState;
      }
      function cm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = he();
              t = ma(a);
              var i = pa(e, t, a);
              i !== null && (ue(i, e, a), Bn(i, e, a)), e = { cache: Vi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function um(t, e, a) {
        var i = he();
        a = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t) ? cc(e, a) : (a = Ji(t, e, a, i), a !== null && (ue(a, t, i), uc(a, e, i)));
      }
      function sc(t, e, a) {
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
        if (Al(t)) cc(e, r);
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
          if (a = Ji(t, e, r, i), a !== null)
            return ue(a, t, i), uc(a, e, i), !0;
        }
        return !1;
      }
      function pr(t, e, a, i) {
        if (i = {
          lane: 2,
          revertLane: Xi(),
          gesture: null,
          action: i,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t)) {
          if (e) throw Error(c(479));
        } else
          e = Ji(
            t,
            a,
            i,
            2
          ), e !== null && ue(e, t, 2);
      }
      function Al(t) {
        var e = t.alternate;
        return t === gt || e !== null && e === gt;
      }
      function cc(t, e) {
        Nn = ri = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function uc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, z(t, a);
        }
      }
      function hr(t, e, a, i) {
        e = t.memoizedState, a = a(i, e), a = a == null ? e : Vr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function dc(t, e, a, i, r, u, m) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(i, u, m) : e.prototype && e.prototype.isPureReactComponent ? !xl(a, i) || !xl(r, u) : !0;
      }
      function fc(t, e, a, i) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, i), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, i), e.state !== t && go.enqueueReplaceState(e, e.state, null);
      }
      function Ya(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var i in e)
            i !== "ref" && (a[i] = e[i]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Vr({}, a));
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
      function mc(t, e, a) {
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
      function gr(t, e, a) {
        return a = ma(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Ol(t, e);
        }, a;
      }
      function pc(t) {
        return t = ma(t), t.tag = 3, t;
      }
      function hc(t, e, a, i) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = i.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            mc(e, a, i);
          };
        }
        var m = a.stateNode;
        m !== null && typeof m.componentDidCatch == "function" && (t.callback = function() {
          mc(e, a, i), typeof r != "function" && (Na === null ? Na = /* @__PURE__ */ new Set([this]) : Na.add(this));
          var S = i.stack;
          this.componentDidCatch(i.value, {
            componentStack: S !== null ? S : ""
          });
        });
      }
      function dm(t, e, a, i, r) {
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
                return je === null ? Kl() : a.alternate === null && Ut === 0 && (Ut = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, i === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([i]) : e.add(i), qr(t, i, r)), !1;
              case 22:
                return a.flags |= 65536, i === li ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([i])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([i]) : a.add(i)), qr(t, i, r)), !1;
            }
            throw Error(c(435, a.tag));
          }
          return qr(t, i, r), Kl(), !1;
        }
        if (_t)
          return e = xe.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, i !== oo && (t = Error(c(422), { cause: i }), Hn(
            q(t, a)
          ))) : (i !== oo && (e = Error(c(423), {
            cause: i
          }), Hn(
            q(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, i = q(i, a), r = gr(
            t.stateNode,
            i,
            r
          ), Fi(t, r), Ut !== 4 && (Ut = 2)), !1;
        var u = Error(c(520), { cause: i });
        if (u = q(u, a), ol === null ? ol = [u] : ol.push(u), Ut !== 4 && (Ut = 2), e === null) return !0;
        i = q(i, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = gr(a.stateNode, i, t), Fi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Na === null || !Na.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = pc(r), hc(
                  r,
                  t,
                  a,
                  i
                ), Fi(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function Pt(t, e, a, i) {
        e.child = t === null ? ed(e, null, a, i) : Fa(
          e,
          t.child,
          a,
          i
        );
      }
      function gc(t, e, a, i, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in i) {
          var m = {};
          for (var S in i)
            S !== "ref" && (m[S] = i[S]);
        } else m = i;
        return Ua(e), i = er(
          t,
          e,
          a,
          m,
          u,
          r
        ), S = ar(), t !== null && !Gt ? (nr(t, e, r), Ie(t, e, r)) : (_t && S && G(e), e.flags |= 1, Pt(t, e, i, r), e.child);
      }
      function bc(t, e, a, i, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !Yr(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, vc(
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
        if (u = t.child, !Sr(t, r)) {
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
      function vc(t, e, a, i, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (xl(u, i) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = i = u, Sr(t, r))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, Ie(t, e, r);
        }
        return br(
          t,
          e,
          a,
          i,
          r
        );
      }
      function yc(t, e, a, i) {
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
            return xc(
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
            ), u !== null ? Ts(e, u) : Ii(), Cs(e);
          else
            return i = e.lanes = 536870912, xc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              i
            );
        } else
          u !== null ? (yl(e, u.cachePool), Ts(e, u), ga(), e.memoizedState = null) : (t !== null && yl(e, null), Ii(), ga());
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
      function xc(t, e, a, i, r) {
        var u = Zi();
        return u = u === null ? null : {
          parent: ea ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && yl(e, null), Ii(), Cs(e), t !== null && rn(t, e, i, !0), e.childLanes = r, null;
      }
      function Rl(t, e) {
        return e = Dl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function wc(t, e, a) {
        return Fa(e, t.child, null, a), t = Rl(
          e,
          e.pendingProps
        ), t.flags |= 2, pe(e), e.memoizedState = null, t;
      }
      function fm(t, e, a) {
        var i = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (_t) {
            if (i.mode === "hidden")
              return t = Rl(e, i), e.lanes = 536870912, Qn(null, t);
            if (Pi(e), (t = Ot) ? (t = Op(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = vu(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw ft(e);
            return e.lanes = 536870912, null;
          }
          return Rl(e, i);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var m = u.dehydrated;
          if (Pi(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = wc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(c(558));
          else if (Gt || rn(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Gt || r) {
            if (i = Mt, i !== null && (m = D(i, a), m !== 0 && m !== u.retryLane))
              throw u.retryLane = m, qa(t, m), ue(i, t, m), bo;
            Kl(), e = wc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, re && (Ot = Tp(m), ee = e, _t = !0, Sa = null, Te = !1, t !== null && tt(e, t)), e = Rl(e, i), e.flags |= 4096;
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
            throw Error(c(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function br(t, e, a, i, r) {
        return Ua(e), a = er(
          t,
          e,
          a,
          i,
          void 0,
          r
        ), i = ar(), t !== null && !Gt ? (nr(t, e, r), Ie(t, e, r)) : (_t && i && G(e), e.flags |= 1, Pt(t, e, a, r), e.child);
      }
      function _c(t, e, a, i, r, u) {
        return Ua(e), e.updateQueue = null, a = Ms(
          e,
          i,
          a,
          r
        ), js(t), i = ar(), t !== null && !Gt ? (nr(t, e, u), Ie(t, e, u)) : (_t && i && G(e), e.flags |= 1, Pt(t, e, a, u), e.child);
      }
      function Sc(t, e, a, i, r) {
        if (Ua(e), e.stateNode === null) {
          var u = bn, m = a.contextType;
          typeof m == "object" && m !== null && (u = $t(m)), u = new a(i, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = go, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = i, u.state = e.memoizedState, u.refs = {}, Li(e), m = a.contextType, u.context = typeof m == "object" && m !== null ? $t(m) : bn, u.state = e.memoizedState, m = a.getDerivedStateFromProps, typeof m == "function" && (hr(
            e,
            a,
            m,
            i
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (m = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), m !== u.state && go.enqueueReplaceState(
            u,
            u.state,
            null
          ), Yn(e, i, u, r), qn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !0;
        } else if (t === null) {
          u = e.stateNode;
          var S = e.memoizedProps, U = Ya(a, S);
          u.props = U;
          var Q = u.context, W = a.contextType;
          m = bn, typeof W == "object" && W !== null && (m = $t(W));
          var Z = a.getDerivedStateFromProps;
          W = typeof Z == "function" || typeof u.getSnapshotBeforeUpdate == "function", S = e.pendingProps !== S, W || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (S || Q !== m) && fc(
            e,
            u,
            i,
            m
          ), ka = !1;
          var F = e.memoizedState;
          u.state = F, Yn(e, i, u, r), qn(), Q = e.memoizedState, S || F !== Q || ka ? (typeof Z == "function" && (hr(
            e,
            a,
            Z,
            i
          ), Q = e.memoizedState), (U = ka || dc(
            e,
            a,
            U,
            i,
            F,
            Q,
            m
          )) ? (W || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = i, e.memoizedState = Q), u.props = i, u.state = Q, u.context = m, i = U) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !1);
        } else {
          u = e.stateNode, Wi(t, e), m = e.memoizedProps, W = Ya(a, m), u.props = W, Z = e.pendingProps, F = u.context, Q = a.contextType, U = bn, typeof Q == "object" && Q !== null && (U = $t(Q)), S = a.getDerivedStateFromProps, (Q = typeof S == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (m !== Z || F !== U) && fc(
            e,
            u,
            i,
            U
          ), ka = !1, F = e.memoizedState, u.state = F, Yn(e, i, u, r), qn();
          var mt = e.memoizedState;
          m !== Z || F !== mt || ka || t !== null && t.dependencies !== null && gl(t.dependencies) ? (typeof S == "function" && (hr(
            e,
            a,
            S,
            i
          ), mt = e.memoizedState), (W = ka || dc(
            e,
            a,
            W,
            i,
            F,
            mt,
            U
          ) || t !== null && t.dependencies !== null && gl(t.dependencies)) ? (Q || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(i, mt, U), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            i,
            mt,
            U
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 1024), e.memoizedProps = i, e.memoizedState = mt), u.props = i, u.state = mt, u.context = U, i = W) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && F === t.memoizedState || (e.flags |= 1024), i = !1);
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
      function kc(t, e, a, i) {
        return Re(), e.flags |= 256, Pt(t, e, a, i), e.child;
      }
      function vr(t) {
        return { baseLanes: t, cachePool: ys() };
      }
      function yr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= _e), t;
      }
      function zc(t, e, a) {
        var i = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, m;
        if ((m = u) || (m = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), m && (r = !0, e.flags &= -129), m = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (_t) {
            if (r ? ha(e) : ga(), (t = Ot) ? (t = Rp(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = vu(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw ft(e);
            return to(t) ? e.lanes = 32 : e.lanes = 536870912, null;
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
          ), S.return = e, i.return = e, S.sibling = i, e.child = S, i = e.child, i.memoizedState = vr(a), i.childLanes = yr(
            t,
            m,
            a
          ), e.memoizedState = vo, Qn(null, i)) : (ha(e), xr(e, S));
        }
        var U = t.memoizedState;
        if (U !== null && (S = U.dehydrated, S !== null)) {
          if (u)
            e.flags & 256 ? (ha(e), e.flags &= -257, e = wr(
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
            ), i = e.child, i.memoizedState = vr(a), i.childLanes = yr(
              t,
              m,
              a
            ), e.memoizedState = vo, e = Qn(null, i));
          else if (ha(e), to(S))
            m = wp(S).digest, i = Error(c(419)), i.stack = "", i.digest = m, Hn({ value: i, source: null, stack: null }), e = wr(
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
            if (m = Mt, m !== null && (i = D(
              m,
              a
            ), i !== 0 && i !== U.retryLane))
              throw U.retryLane = i, qa(t, i), ue(m, t, i), bo;
            Pr(S) || Kl(), e = wr(
              t,
              e,
              a
            );
          } else
            Pr(S) ? (e.flags |= 192, e.child = t.child, e = null) : (t = U.treeContext, re && (Ot = Cp(
              S
            ), ee = e, _t = !0, Sa = null, Te = !1, t !== null && tt(e, t)), e = xr(
              e,
              i.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ga(), S = i.fallback, r = e.mode, U = t.child, u = U.sibling, i = ta(U, {
          mode: "hidden",
          children: i.children
        }), i.subtreeFlags = U.subtreeFlags & 65011712, u !== null ? S = ta(
          u,
          S
        ) : (S = Qa(
          S,
          r,
          a,
          null
        ), S.flags |= 2), S.return = e, i.return = e, i.sibling = S, e.child = i, Qn(null, i), i = e.child, S = t.child.memoizedState, S === null ? S = vr(a) : (r = S.cachePool, r !== null ? (U = ea ? Rt._currentValue : Rt._currentValue2, r = r.parent !== U ? { parent: U, pool: U } : r) : r = ys(), S = {
          baseLanes: S.baseLanes | a,
          cachePool: r
        }), i.memoizedState = S, i.childLanes = yr(
          t,
          m,
          a
        ), e.memoizedState = vo, Qn(t.child, i)) : (ha(e), a = t.child, t = a.sibling, a = ta(a, {
          mode: "visible",
          children: i.children
        }), a.return = e, a.sibling = null, t !== null && (m = e.deletions, m === null ? (e.deletions = [t], e.flags |= 16) : m.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function xr(t, e) {
        return e = Dl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Dl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function wr(t, e, a) {
        return Fa(e, t.child, null, a), t = xr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Ec(t, e, a) {
        t.lanes |= e;
        var i = t.alternate;
        i !== null && (i.lanes |= e), Ki(t.return, e, a);
      }
      function _r(t, e, a, i, r, u) {
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
      function Nc(t, e, a) {
        var i = e.pendingProps, r = i.revealOrder, u = i.tail;
        i = i.children;
        var m = qt.current, S = (m & 2) !== 0;
        if (S ? (m = m & 1 | 2, e.flags |= 128) : m &= 1, y(qt, m), Pt(t, e, i, a), i = _t ? tl : 0, !S && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Ec(t, a, e);
            else if (t.tag === 19)
              Ec(t, a, e);
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
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), _r(
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
            _r(
              e,
              !0,
              a,
              null,
              u,
              i
            );
            break;
          case "together":
            _r(
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
          throw Error(c(153));
        if (e.child !== null) {
          for (t = e.child, a = ta(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = ta(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function Sr(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && gl(t)));
      }
      function mm(t, e, a) {
        switch (e.tag) {
          case 3:
            at(
              e,
              e.stateNode.containerInfo
            ), fa(e, Rt, t.memoizedState.cache), Re();
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
              return e.flags |= 128, Pi(e), null;
            break;
          case 13:
            var i = e.memoizedState;
            if (i !== null)
              return i.dehydrated !== null ? (ha(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? zc(
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
                return Nc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), y(qt, qt.current), i) break;
            return null;
          case 22:
            return e.lanes = 0, yc(
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
      function Tc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!Sr(t, a) && (e.flags & 128) === 0)
              return Gt = !1, mm(
                t,
                e,
                a
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, _t && (e.flags & 1048576) !== 0 && w(e, tl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var i = e.pendingProps;
              if (t = Ba(e.elementType), e.type = t, typeof t == "function")
                Yr(t) ? (i = Ya(t, i), e.tag = 1, e = Sc(
                  null,
                  e,
                  t,
                  i,
                  a
                )) : (e.tag = 0, e = br(
                  null,
                  e,
                  t,
                  i,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Zr) {
                    e.tag = 11, e = gc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  } else if (r === Wr) {
                    e.tag = 14, e = bc(
                      null,
                      e,
                      t,
                      i,
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
            return br(
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
            ), Sc(
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
              ), t === null) throw Error(c(387));
              var u = e.pendingProps;
              r = e.memoizedState, i = r.element, Wi(t, e), Yn(e, u, null, a);
              var m = e.memoizedState;
              if (u = m.cache, fa(e, Rt, u), u !== r.cache && Qi(
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
                  e = kc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== i) {
                  i = q(
                    Error(c(424)),
                    e
                  ), Hn(i), e = kc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (re && (Ot = Np(
                    e.stateNode.containerInfo
                  ), ee = e, _t = !0, Sa = null, Te = !0), a = ed(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Re(), u === i) {
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
            if (Be)
              return Hl(t, e), t === null ? (a = Gu(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : _t || (e.stateNode = th(
                e.type,
                e.pendingProps,
                _a.current,
                e
              )) : e.memoizedState = Gu(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return St(e), t === null && Vt && _t && (i = e.stateNode = Ju(
                e.type,
                e.pendingProps,
                _a.current,
                te.current,
                !1
              ), ee = e, Te = !0, Ot = jp(
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
            return t === null && _t && (Ip(
              e.type,
              e.pendingProps,
              te.current
            ), (r = i = Ot) && (i = Mp(
              i,
              e.type,
              e.pendingProps,
              Te
            ), i !== null ? (e.stateNode = i, ee = e, Ot = Ep(i), Te = !1, r = !0) : r = !1), r || ft(e)), St(e), r = e.type, u = e.pendingProps, m = t !== null ? t.memoizedProps : null, i = u.children, Jl(r, u) ? i = null : m !== null && Jl(r, m) && (e.flags |= 32), e.memoizedState !== null && (r = er(
              t,
              e,
              im,
              null,
              null,
              a
            ), ea ? Xa._currentValue = r : Xa._currentValue2 = r), Hl(t, e), Pt(t, e, i, a), e.child;
          case 6:
            return t === null && _t && ($p(
              e.pendingProps,
              te.current
            ), (t = a = Ot) && (a = Ap(
              a,
              e.pendingProps,
              Te
            ), a !== null ? (e.stateNode = a, ee = e, Ot = null, t = !0) : t = !1), t || ft(e)), null;
          case 13:
            return zc(t, e, a);
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
            return gc(
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
            return bc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return vc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return Nc(
              t,
              e,
              a
            );
          case 31:
            return fm(t, e, a);
          case 22:
            return yc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ua(e), i = $t(Rt), t === null ? (r = Zi(), r === null && (r = Mt, u = Vi(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: i,
              cache: r
            }, Li(e), fa(e, Rt, r)) : ((t.lanes & a) !== 0 && (Wi(t, e), Yn(e, null, null, a), qn()), r = t.memoizedState, u = e.memoizedState, r.parent !== i ? (r = { parent: i, cache: i }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), fa(e, Rt, i)) : (i = u.cache, fa(e, Rt, i), i !== r.cache && Qi(
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
        throw Error(c(156, e.tag));
      }
      function He(t) {
        t.flags |= 4;
      }
      function Ul(t) {
        Qe && (t.flags |= 8);
      }
      function Cc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function kr(t, e, a, i) {
        if (ie)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Ir(t, a.stateNode);
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
              a && i && (u = Du(
                u,
                r.type,
                r.memoizedProps
              )), Ir(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && i && (u = Uu(
                u,
                r.memoizedProps
              )), Ir(t, u);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                u = r.child, u !== null && (u.return = r), kr(t, r, !0, !0);
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
      function jc(t, e, a, i) {
        var r = !1;
        if (Qe)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var m = u.stateNode;
              a && i && (m = Du(
                m,
                u.type,
                u.memoizedProps
              )), Ru(t, m);
            } else if (u.tag === 6)
              m = u.stateNode, a && i && (m = Uu(
                m,
                u.memoizedProps
              )), Ru(t, m);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), jc(t, u, !0, !0), r = !0;
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
      function Mc(t, e) {
        if (Qe && Cc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, i = Ou();
          jc(i, e, !1, !1), t.pendingChildren = i, He(e), xp(a, i);
        }
      }
      function zr(t, e, a, i) {
        if (ie)
          t.memoizedProps !== i && He(e);
        else if (Qe) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = Cc(t, e)) || u !== i) {
            var m = te.current;
            u = yp(
              r,
              a,
              u,
              i,
              !t,
              null
            ), u === r ? e.stateNode = r : (Ul(e), Tu(
              u,
              a,
              i,
              m
            ) && He(e), e.stateNode = u, t && kr(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function Er(t, e, a, i, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Zm(e, i) : Jm(e, a, i))) {
          if (t.flags |= 16777216, (r & 335544128) === r || $r(e, i))
            if (ju(t.stateNode, e, i))
              t.flags |= 8192;
            else if (nu()) t.flags |= 8192;
            else
              throw Wa = li, fo;
        } else t.flags &= -16777217;
      }
      function Ac(t, e) {
        if (ah(e)) {
          if (t.flags |= 16777216, !Zu(e))
            if (nu()) t.flags |= 8192;
            else
              throw Wa = li, fo;
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
      function pm(t, e, a) {
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
            return a = e.stateNode, i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), We(Rt), it(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Oe(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, da())), Mc(t, e), At(e), null;
          case 26:
            if (Be) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (At(e), Ac(
                e,
                u
              )) : (At(e), Er(
                e,
                r,
                null,
                i,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), At(e), Ac(
                e,
                u
              )) : (At(e), e.flags &= -16777217) : (u = t.memoizedProps, ie ? u !== i && He(e) : zr(
                t,
                e,
                r,
                i
              ), At(e), Er(
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
                ie ? t.memoizedProps !== i && He(e) : zr(t, e, r, i);
              else {
                if (!i) {
                  if (e.stateNode === null)
                    throw Error(c(166));
                  return At(e), null;
                }
                t = te.current, Oe(e) ? Ha(e, t) : (t = Ju(
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
              zr(t, e, r, i);
            else {
              if (!i) {
                if (e.stateNode === null)
                  throw Error(c(166));
                return At(e), null;
              }
              if (u = te.current, Oe(e))
                Ha(e, u), Xp(
                  e.stateNode,
                  r,
                  i,
                  u
                ) && (e.flags |= 64);
              else {
                var m = Bm(
                  r,
                  i,
                  _a.current,
                  u,
                  e
                );
                Ul(e), kr(m, e, !1, !1), e.stateNode = m, Tu(
                  m,
                  r,
                  i,
                  u
                ) && He(e);
              }
            }
            return At(e), Er(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ie ? a !== i && He(e) : Qe && (a !== i ? (t = _a.current, a = te.current, Ul(e), e.stateNode = Cu(
                i,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof i != "string" && e.stateNode === null)
                throw Error(c(166));
              if (t = _a.current, a = te.current, Oe(e)) {
                if (!re) throw Error(c(176));
                if (t = e.stateNode, a = e.memoizedProps, i = null, r = ee, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      i = r.memoizedProps;
                  }
                Dp(
                  t,
                  a,
                  e,
                  i
                ) || ft(e, !0);
              } else
                Ul(e), e.stateNode = Cu(
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
                  if (!i) throw Error(c(318));
                  if (!re) throw Error(c(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(c(557));
                  Up(t, e);
                } else
                  Re(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                At(e), t = !1;
              } else
                a = da(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(c(558));
            }
            return At(e), null;
          case 13:
            if (i = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Oe(e), i !== null && i.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(c(318));
                  if (!re) throw Error(c(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(c(317));
                  Bp(r, e);
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
            return it(), Mc(t, e), t === null && Km(e.stateNode.containerInfo), At(e), null;
          case 10:
            return We(e.type), At(e), null;
          case 19:
            if (E(qt), i = e.memoizedState, i === null) return At(e), null;
            if (r = (e.flags & 128) !== 0, u = i.rendering, u === null)
              if (r) Vn(i, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = El(t), u !== null) {
                      for (e.flags |= 128, Vn(i, !1), t = u.updateQueue, e.updateQueue = t, Bl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        bu(a, t), a = a.sibling;
                      return y(
                        qt,
                        qt.current & 1 | 2
                      ), _t && Y(e, i.treeForkCount), e.child;
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
            return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = de(), t.sibling = null, a = qt.current, y(
              qt,
              r ? a & 1 | 2 : a & 1
            ), _t && Y(e, i.treeForkCount), t) : (At(e), null);
          case 22:
          case 23:
            return pe(e), $i(), i = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== i && (e.flags |= 8192) : i && (e.flags |= 8192), i ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (At(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : At(e), a = e.updateQueue, a !== null && Bl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), i = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (i = e.memoizedState.cachePool.pool), i !== a && (e.flags |= 2048), t !== null && E(La), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), We(Rt), At(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(c(156, e.tag));
      }
      function hm(t, e) {
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
                throw Error(c(340));
              Re();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (pe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(c(340));
              Re();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return E(qt), null;
          case 4:
            return it(), null;
          case 10:
            return We(e.type), null;
          case 22:
          case 23:
            return pe(e), $i(), t !== null && E(La), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return We(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Oc(t, e) {
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
            E(qt);
            break;
          case 10:
            We(e.type);
            break;
          case 22:
          case 23:
            pe(e), $i(), t !== null && E(La);
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
                  var U = a, Q = S;
                  try {
                    Q();
                  } catch (W) {
                    kt(
                      r,
                      U,
                      W
                    );
                  }
                }
              }
              i = i.next;
            } while (i !== u);
          }
        } catch (W) {
          kt(e, e.return, W);
        }
      }
      function Rc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Ns(e, a);
          } catch (i) {
            kt(t, t.return, i);
          }
        }
      }
      function Hc(t, e, a) {
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
      function Ke(t, e) {
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
      function Dc(t) {
        var e = t.type, a = t.memoizedProps, i = t.stateNode;
        try {
          sp(i, e, a, t);
        } catch (r) {
          kt(t, t.return, r);
        }
      }
      function Nr(t, e, a) {
        try {
          cp(
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
      function Uc(t) {
        return t.tag === 5 || t.tag === 3 || (Be ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && hn(t.type) : !1) || t.tag === 4;
      }
      function Tr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Uc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && hn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Cr(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? dp(a, t, e) : rp(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Cr(t, e, a), t = t.sibling; t !== null; )
            Cr(t, e, a), t = t.sibling;
      }
      function ql(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? up(a, t, e) : ip(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (ql(t, e, a), t = t.sibling; t !== null; )
            ql(t, e, a), t = t.sibling;
      }
      function Bc(t, e, a) {
        t = t.containerInfo;
        try {
          Hu(t, a);
        } catch (i) {
          kt(e, e.return, i);
        }
      }
      function qc(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          lh(
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          kt(t, t.return, i);
        }
      }
      function gm(t, e) {
        for (Dm(t.containerInfo), Wt = e; Wt !== null; )
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
                  (e & 1024) !== 0 && ie && vp(t.stateNode.containerInfo);
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
                e.return = t.return, Wt = e;
                break;
              }
              Wt = t.return;
            }
      }
      function Yc(t, e, a) {
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
            i & 64 && Rc(a), i & 512 && Zn(a, a.return);
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
                Ns(i, t);
              } catch (m) {
                kt(a, a.return, m);
              }
            }
            break;
          case 27:
            Vt && e === null && i & 4 && qc(a);
          case 26:
          case 5:
            if ($e(t, a), e === null) {
              if (i & 4) Dc(a);
              else if (i & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  Gp(
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
            $e(t, a), i & 4 && Kc(t, a);
            break;
          case 13:
            $e(t, a), i & 4 && Qc(t, a), i & 64 && (i = a.memoizedState, i !== null && (i = i.dehydrated, i !== null && (a = Sm.bind(
              null,
              a
            ), _p(i, a))));
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
      function Gc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Gc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Xm(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function De(t, e, a) {
        for (a = a.child; a !== null; )
          jr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function jr(t, e, a) {
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
              ), a.memoizedState ? Qu(a.memoizedState) : a.stateNode && Xu(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Ke(a, e);
              var i = Qt, r = fe;
              hn(a.type) && (Qt = a.stateNode, fe = !1), De(
                t,
                e,
                a
              ), Lu(a.stateNode), Qt = i, fe = r;
              break;
            }
          case 5:
            Kt || Ke(a, e);
          case 6:
            if (ie) {
              if (i = Qt, r = fe, Qt = null, De(
                t,
                e,
                a
              ), Qt = i, fe = r, Qt !== null)
                if (fe)
                  try {
                    mp(Qt, a.stateNode);
                  } catch (u) {
                    kt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    fp(Qt, a.stateNode);
                  } catch (u) {
                    kt(
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
            ie && Qt !== null && (fe ? Lp(
              Qt,
              a.stateNode
            ) : Jp(Qt, a.stateNode));
            break;
          case 4:
            ie ? (i = Qt, r = fe, Qt = a.stateNode.containerInfo, fe = !0, De(
              t,
              e,
              a
            ), Qt = i, fe = r) : (Qe && Bc(
              a.stateNode,
              a,
              Ou()
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
            Kt || (Ke(a, e), i = a.stateNode, typeof i.componentWillUnmount == "function" && Hc(
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
      function Kc(t, e) {
        if (re && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Qp(t);
          } catch (a) {
            kt(e, e.return, a);
          }
        }
      }
      function Qc(t, e) {
        if (re && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Vp(t);
          } catch (a) {
            kt(e, e.return, a);
          }
      }
      function bm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new ld()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new ld()), e;
          default:
            throw Error(c(435, t.tag));
        }
      }
      function Yl(t, e) {
        var a = bm(t);
        e.forEach(function(i) {
          if (!a.has(i)) {
            a.add(i);
            var r = km.bind(null, t, i);
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
              if (Qt === null) throw Error(c(160));
              jr(u, m, r), Qt = null, fe = !1;
            } else jr(u, m, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Vc(e, t), e = e.sibling;
      }
      function Vc(t, e) {
        var a = t.alternate, i = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            le(e, t), ce(t), i & 4 && (ba(3, t, t.return), Xn(3, t), ba(5, t, t.return));
            break;
          case 1:
            le(e, t), ce(t), i & 512 && (Kt || a === null || Ke(a, a.return)), i & 64 && ia && (t = t.updateQueue, t !== null && (i = t.callbacks, i !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? i : a.concat(i))));
            break;
          case 26:
            if (Be) {
              var r = qe;
              if (le(e, t), ce(t), i & 512 && (Kt || a === null || Ke(a, a.return)), i & 4) {
                i = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Pp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Vu(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Ku(
                  r,
                  u,
                  t.memoizedProps
                ) : i !== u ? (i === null ? a.stateNode !== null && Xu(a.stateNode) : Qu(i), u === null ? Vu(
                  r,
                  t.type,
                  t.stateNode
                ) : Ku(
                  r,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Nr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              le(e, t), ce(t), i & 512 && (Kt || a === null || Ke(a, a.return)), a !== null && i & 4 && Nr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (le(e, t), ce(t), i & 512 && (Kt || a === null || Ke(a, a.return)), ie) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  Au(r);
                } catch (Z) {
                  kt(t, t.return, Z);
                }
              }
              i & 4 && t.stateNode != null && (r = t.memoizedProps, Nr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), i & 1024 && (yo = !0);
            } else
              Qe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (le(e, t), ce(t), i & 4 && ie) {
              if (t.stateNode === null)
                throw Error(c(162));
              i = t.memoizedProps, a = a !== null ? a.memoizedProps : i, r = t.stateNode;
              try {
                op(r, a, i);
              } catch (Z) {
                kt(t, t.return, Z);
              }
            }
            break;
          case 3:
            if (Be ? (eh(), r = qe, qe = eo(e.containerInfo), le(e, t), qe = r) : le(e, t), ce(t), i & 4) {
              if (ie && re && a !== null && a.memoizedState.isDehydrated)
                try {
                  Kp(e.containerInfo);
                } catch (Z) {
                  kt(t, t.return, Z);
                }
              if (Qe) {
                i = e.containerInfo, a = e.pendingChildren;
                try {
                  Hu(i, a);
                } catch (Z) {
                  kt(t, t.return, Z);
                }
              }
            }
            yo && (yo = !1, Xc(t));
            break;
          case 4:
            Be ? (a = qe, qe = eo(
              t.stateNode.containerInfo
            ), le(e, t), ce(t), qe = a) : (le(e, t), ce(t)), i & 4 && Qe && Bc(
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
            var m = a !== null && a.memoizedState !== null, S = ia, U = Kt;
            if (ia = S || r, Kt = U || m, le(e, t), Kt = U, ia = S, ce(t), i & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || m || ia || Kt || Ga(t)), ie)) {
              t: if (a = null, ie)
                for (e = t; ; ) {
                  if (e.tag === 5 || Be && e.tag === 26) {
                    if (a === null) {
                      m = a = e;
                      try {
                        u = m.stateNode, r ? pp(u) : gp(
                          m.stateNode,
                          m.memoizedProps
                        );
                      } catch (Z) {
                        kt(m, m.return, Z);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      m = e;
                      try {
                        var Q = m.stateNode;
                        r ? hp(Q) : bp(Q, m.memoizedProps);
                      } catch (Z) {
                        kt(m, m.return, Z);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      m = e;
                      try {
                        var W = m.stateNode;
                        r ? Wp(W) : Fp(m.stateNode);
                      } catch (Z) {
                        kt(m, m.return, Z);
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
              if (Uc(i)) {
                a = i;
                break;
              }
              i = i.return;
            }
            if (ie) {
              if (a == null) throw Error(c(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, u = Tr(t);
                    ql(t, u, r);
                    break;
                  }
                case 5:
                  var m = a.stateNode;
                  a.flags & 32 && (Au(m), a.flags &= -33);
                  var S = Tr(t);
                  ql(t, S, m);
                  break;
                case 3:
                case 4:
                  var U = a.stateNode.containerInfo, Q = Tr(t);
                  Cr(
                    t,
                    Q,
                    U
                  );
                  break;
                default:
                  throw Error(c(161));
              }
            }
          } catch (W) {
            kt(t, t.return, W);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Xc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Xc(e), e.tag === 5 && e.flags & 1024 && Fm(e.stateNode), t = t.sibling;
          }
      }
      function $e(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Yc(t, e.alternate, e), e = e.sibling;
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
              Ke(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && Hc(
                e,
                e.return,
                a
              ), Ga(e);
              break;
            case 27:
              Vt && Lu(e.stateNode);
            case 26:
            case 5:
              Ke(e, e.return), Ga(e);
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
                } catch (Q) {
                  kt(i, i.return, Q);
                }
              if (i = u, r = i.updateQueue, r !== null) {
                var S = i.stateNode;
                try {
                  var U = r.shared.hiddenCallbacks;
                  if (U !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < U.length; r++)
                      Es(U[r], S);
                } catch (Q) {
                  kt(i, i.return, Q);
                }
              }
              a && m & 64 && Rc(u), Zn(u, u.return);
              break;
            case 27:
              Vt && qc(u);
            case 26:
            case 5:
              Pe(
                r,
                u,
                a
              ), a && i === null && m & 4 && Dc(u), Zn(u, u.return);
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
              ), a && m & 4 && Kc(r, u);
              break;
            case 13:
              Pe(
                r,
                u,
                a
              ), a && m & 4 && Qc(r, u);
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
      function Mr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Dn(a));
      }
      function Ar(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Dn(t));
      }
      function Ue(t, e, a, i) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Zc(
              t,
              e,
              a,
              i
            ), e = e.sibling;
      }
      function Zc(t, e, a, i) {
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
                var u = e.memoizedProps, m = u.id, S = u.onPostCommit;
                typeof S == "function" && S(
                  m,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (U) {
                kt(e, e.return, U);
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
            u = e.stateNode, m = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ue(
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
            )), r & 2048 && Mr(m, e);
            break;
          case 24:
            Ue(
              t,
              e,
              a,
              i
            ), r & 2048 && Ar(e.alternate, e);
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
          var u = t, m = e, S = a, U = i, Q = m.flags;
          switch (m.tag) {
            case 0:
            case 11:
            case 15:
              cn(
                u,
                m,
                S,
                U,
                r
              ), Xn(8, m);
              break;
            case 23:
              break;
            case 22:
              var W = m.stateNode;
              m.memoizedState !== null ? W._visibility & 2 ? cn(
                u,
                m,
                S,
                U,
                r
              ) : Jn(
                u,
                m
              ) : (W._visibility |= 2, cn(
                u,
                m,
                S,
                U,
                r
              )), r && Q & 2048 && Mr(
                m.alternate,
                m
              );
              break;
            case 24:
              cn(
                u,
                m,
                S,
                U,
                r
              ), r && Q & 2048 && Ar(m.alternate, m);
              break;
            default:
              cn(
                u,
                m,
                S,
                U,
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
                Jn(a, i), r & 2048 && Mr(
                  i.alternate,
                  i
                );
                break;
              case 24:
                Jn(a, i), r & 2048 && Ar(
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
            Jc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Jc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ka(
              t,
              e,
              a
            ), t.flags & Cn)
              if (t.memoizedState !== null)
                nh(
                  a,
                  qe,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var i = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || $r(r, t)) && Mu(a, i, r, t);
              }
            break;
          case 5:
            Ka(
              t,
              e,
              a
            ), t.flags & Cn && (i = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || $r(r, t)) && Mu(a, i, r, t));
            break;
          case 3:
          case 4:
            Be ? (i = qe, qe = eo(
              t.stateNode.containerInfo
            ), Ka(
              t,
              e,
              a
            ), qe = i) : Ka(
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
      function Lc(t) {
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
              Wt = i, Fc(
                i,
                t
              );
            }
          Lc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Wc(t), t = t.sibling;
      }
      function Wc(t) {
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
              Wt = i, Fc(
                i,
                t
              );
            }
          Lc(t);
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
      function Fc(t, e) {
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
              if (Gc(i), i === a) {
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
      function Or(t) {
        var e = Gm(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(c(364));
          return e;
        }
        if (t = Pm(t), t === null) throw Error(c(362));
        return t.stateNode.current;
      }
      function Rr(t, e) {
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
                  for (; m != null && Rr(i, m); )
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
            if ((a === 5 || a === 26 || a === 27) && ap(t.stateNode, e.value))
              return !0;
            break;
          case fi:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = ep(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case di:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(c(365));
        }
        return !1;
      }
      function Hr(t) {
        switch (t.$$typeof) {
          case si:
            return "<" + (M(t.value) || "Unknown") + ">";
          case ci:
            return ":has(" + (Hr(t) || "") + ")";
          case ui:
            return '[role="' + t.value + '"]';
          case fi:
            return '"' + t.value + '"';
          case di:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(c(365));
        }
      }
      function Ic(t, e) {
        var a = [];
        t = [t, 0];
        for (var i = 0; i < t.length; ) {
          var r = t[i++], u = r.tag, m = t[i++], S = e[m];
          if (u !== 5 && u !== 26 && u !== 27 || !$n(r)) {
            for (; S != null && Rr(r, S); )
              m++, S = e[m];
            if (m === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, m), r = r.sibling;
          }
        }
        return a;
      }
      function Dr(t, e) {
        if (!In) throw Error(c(363));
        t = Or(t), t = Ic(t, e), e = [], t = Array.from(t);
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
        return (yt & 2) !== 0 && wt !== 0 ? wt & -wt : rt.T !== null ? Xi() : Qm();
      }
      function $c() {
        if (_e === 0)
          if ((wt & 536870912) === 0 || _t) {
            var t = Wl;
            Wl <<= 1, (Wl & 3932160) === 0 && (Wl = 262144), _e = t;
          } else _e = 536870912;
        return t = xe.current, t !== null && (t.flags |= 32), _e;
      }
      function ue(t, e, a) {
        (t === Mt && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (un(t, 0), va(
          t,
          wt,
          _e,
          !1
        )), A(t, a), ((yt & 2) === 0 || t !== Mt) && (t === Mt && ((yt & 2) === 0 && ($a |= a), Ut === 4 && va(
          t,
          wt,
          _e,
          !1
        )), Ge(t));
      }
      function Pc(t, e, a) {
        if ((yt & 6) !== 0) throw Error(c(327));
        var i = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || N(t, e), r = i ? xm(t, e) : Br(t, e, !0), u = i;
        do {
          if (r === 0) {
            jn && !i && va(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !vm(a)) {
              r = Br(t, e, !1), u = !1;
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
                  var U = re && S.current.memoizedState.isDehydrated;
                  if (U && (un(S, m).flags |= 256), m = Br(
                    S,
                    m,
                    !1
                  ), m !== 2) {
                    if (xo && !U) {
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
                  throw Error(c(345));
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
                  throw Error(c(329));
              }
              if ((e & 62914560) === e && (r = mi + 300 - de(), 10 < r)) {
                if (va(
                  i,
                  e,
                  _e,
                  !za
                ), O(i, 0, !0) !== 0) break t;
                oa = e, i.timeoutHandle = qm(
                  tu.bind(
                    null,
                    i,
                    a,
                    me,
                    pi,
                    _o,
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
              tu(
                i,
                a,
                me,
                pi,
                _o,
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
        Ge(t);
      }
      function tu(t, e, a, i, r, u, m, S, U, Q, W, Z, F, mt) {
        if (t.timeoutHandle = Va, Z = e.subtreeFlags, Z & 8192 || (Z & 16785408) === 16785408) {
          Z = Lm(), Jc(
            e,
            u,
            Z
          );
          var ae = (u & 62914560) === u ? mi - de() : (u & 4194048) === u ? id - de() : 0;
          if (ae = Wm(
            Z,
            ae
          ), ae !== null) {
            oa = u, t.cancelPendingCommit = ae(
              cu.bind(
                null,
                t,
                e,
                u,
                a,
                i,
                r,
                m,
                S,
                U,
                W,
                Z,
                null,
                F,
                mt
              )
            ), va(t, u, m, !Q);
            return;
          }
        }
        cu(
          t,
          e,
          u,
          a,
          i,
          r,
          m,
          S,
          U
        );
      }
      function vm(t) {
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
        e &= ~wo, e &= ~$a, t.suspendedLanes |= e, t.pingedLanes &= ~e, i && (t.warmLanes |= e), i = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - be(r), m = 1 << u;
          i[u] = -1, r &= ~m;
        }
        a !== 0 && b(t, a, e);
      }
      function eu() {
        return (yt & 6) === 0 ? (on(0), !1) : !0;
      }
      function Ur() {
        if (xt !== null) {
          if (Ct === 0)
            var t = xt.return;
          else
            t = xt, na = Za = null, lr(t), kn = null, nl = 0, t = xt;
          for (; t !== null; )
            Oc(t.alternate, t), t = t.return;
          xt = null;
        }
      }
      function un(t, e) {
        var a = t.timeoutHandle;
        a !== Va && (t.timeoutHandle = Va, Ym(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), oa = 0, Ur(), Mt = t, xt = a = ta(t.current, null), wt = e, Ct = 0, we = null, za = !1, jn = N(t, e), xo = !1, Mn = _e = wo = $a = Ea = Ut = 0, me = ol = null, _o = !1, (e & 8) !== 0 && (e |= e & 32);
        var i = t.entangledLanes;
        if (i !== 0)
          for (t = t.entanglements, i &= e; 0 < i; ) {
            var r = 31 - be(i), u = 1 << r;
            e |= t[r], i &= ~u;
          }
        return ra = e, Sl(), a;
      }
      function au(t, e) {
        gt = null, rt.H = il, e === Sn || e === ni ? (e = _s(), Ct = 3) : e === fo ? (e = _s(), Ct = 4) : Ct = e === bo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, we = e, xt === null && (Ut = 1, Ol(
          t,
          q(e, t.current)
        ));
      }
      function nu() {
        var t = xe.current;
        return t === null ? !0 : (wt & 4194048) === wt ? je === null : (wt & 62914560) === wt || (wt & 536870912) !== 0 ? t === je : !1;
      }
      function lu() {
        var t = rt.H;
        return rt.H = il, t === null ? il : t;
      }
      function iu() {
        var t = rt.A;
        return rt.A = vh, t;
      }
      function Kl() {
        Ut = 4, za || (wt & 4194048) !== wt && xe.current !== null || (jn = !0), (Ea & 134217727) === 0 && ($a & 134217727) === 0 || Mt === null || va(
          Mt,
          wt,
          _e,
          !1
        );
      }
      function Br(t, e, a) {
        var i = yt;
        yt |= 2;
        var r = lu(), u = iu();
        (Mt !== t || wt !== e) && (pi = null, un(t, e)), e = !1;
        var m = Ut;
        t: do
          try {
            if (Ct !== 0 && xt !== null) {
              var S = xt, U = we;
              switch (Ct) {
                case 8:
                  Ur(), m = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  xe.current === null && (e = !0);
                  var Q = Ct;
                  if (Ct = 0, we = null, dn(t, S, U, Q), a && jn) {
                    m = 0;
                    break t;
                  }
                  break;
                default:
                  Q = Ct, Ct = 0, we = null, dn(t, S, U, Q);
              }
            }
            ym(), m = Ut;
            break;
          } catch (W) {
            au(t, W);
          }
        while (!0);
        return e && t.shellSuspendCounter++, na = Za = null, yt = i, rt.H = r, rt.A = u, xt === null && (Mt = null, wt = 0, Sl()), m;
      }
      function ym() {
        for (; xt !== null; ) ru(xt);
      }
      function xm(t, e) {
        var a = yt;
        yt |= 2;
        var i = lu(), r = iu();
        Mt !== t || wt !== e ? (pi = null, sl = de() + 500, un(t, e)) : jn = N(
          t,
          e
        );
        t: do
          try {
            if (Ct !== 0 && xt !== null) {
              e = xt;
              var u = we;
              e: switch (Ct) {
                case 1:
                  Ct = 0, we = null, dn(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (xs(u)) {
                    Ct = 0, we = null, ou(e);
                    break;
                  }
                  e = function() {
                    Ct !== 2 && Ct !== 9 || Mt !== t || (Ct = 7), Ge(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Ct = 7;
                  break t;
                case 4:
                  Ct = 5;
                  break t;
                case 7:
                  xs(u) ? (Ct = 0, we = null, ou(e)) : (Ct = 0, we = null, dn(t, e, u, 7));
                  break;
                case 5:
                  var m = null;
                  switch (xt.tag) {
                    case 26:
                      m = xt.memoizedState;
                    case 5:
                    case 27:
                      var S = xt, U = S.type, Q = S.pendingProps;
                      if (m ? Zu(m) : ju(S.stateNode, U, Q)) {
                        Ct = 0, we = null;
                        var W = S.sibling;
                        if (W !== null) xt = W;
                        else {
                          var Z = S.return;
                          Z !== null ? (xt = Z, Ql(Z)) : xt = null;
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
                  Ur(), Ut = 6;
                  break t;
                default:
                  throw Error(c(462));
              }
            }
            wm();
            break;
          } catch (F) {
            au(t, F);
          }
        while (!0);
        return na = Za = null, rt.H = i, rt.A = r, yt = a, xt !== null ? 0 : (Mt = null, wt = 0, Sl(), Ut);
      }
      function wm() {
        for (; xt !== null && !oh(); )
          ru(xt);
      }
      function ru(t) {
        var e = Tc(
          t.alternate,
          t,
          ra
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : xt = e;
      }
      function ou(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = _c(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              wt
            );
            break;
          case 11:
            e = _c(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              wt
            );
            break;
          case 5:
            lr(e);
          default:
            Oc(a, e), e = xt = bu(e, ra), e = Tc(a, e, ra);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : xt = e;
      }
      function dn(t, e, a, i) {
        na = Za = null, lr(e), kn = null, nl = 0;
        var r = e.return;
        try {
          if (dm(
            t,
            r,
            e,
            a,
            wt
          )) {
            Ut = 1, Ol(
              t,
              q(a, t.current)
            ), xt = null;
            return;
          }
        } catch (u) {
          if (r !== null) throw xt = r, u;
          Ut = 1, Ol(
            t,
            q(a, t.current)
          ), xt = null;
          return;
        }
        e.flags & 32768 ? (_t || i === 1 ? t = !0 : jn || (wt & 536870912) !== 0 ? t = !1 : (za = t = !0, (i === 2 || i === 9 || i === 3 || i === 6) && (i = xe.current, i !== null && i.tag === 13 && (i.flags |= 16384))), su(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            su(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = pm(
            e.alternate,
            e,
            ra
          );
          if (a !== null) {
            xt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            xt = e;
            return;
          }
          xt = e = t;
        } while (e !== null);
        Ut === 0 && (Ut = 5);
      }
      function su(t, e) {
        do {
          var a = hm(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, xt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            xt = t;
            return;
          }
          xt = t = a;
        } while (t !== null);
        Ut = 6, xt = null;
      }
      function cu(t, e, a, i, r, u, m, S, U) {
        t.cancelPendingCommit = null;
        do
          Wn();
        while (Xt !== 0);
        if ((yt & 6) !== 0) throw Error(c(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(c(177));
          if (u = e.lanes | e.childLanes, u |= mo, v(
            t,
            a,
            u,
            m,
            S,
            U
          ), t === Mt && (xt = Mt = null, wt = 0), An = e, Ta = t, oa = a, So = u, ko = r, rd = i, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, zm(lo, function() {
            return pu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), i = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || i) {
            i = rt.T, rt.T = null, r = aa(), Lt(2), m = yt, yt |= 4;
            try {
              gm(t, e, a);
            } finally {
              yt = m, Lt(r), rt.T = i;
            }
          }
          Xt = 1, uu(), du(), fu();
        }
      }
      function uu() {
        if (Xt === 1) {
          Xt = 0;
          var t = Ta, e = An, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = rt.T, rt.T = null;
            var i = aa();
            Lt(2);
            var r = yt;
            yt |= 4;
            try {
              Vc(e, t), Um(t.containerInfo);
            } finally {
              yt = r, Lt(i), rt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function du() {
        if (Xt === 2) {
          Xt = 0;
          var t = Ta, e = An, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = rt.T, rt.T = null;
            var i = aa();
            Lt(2);
            var r = yt;
            yt |= 4;
            try {
              Yc(t, e.alternate, e);
            } finally {
              yt = r, Lt(i), rt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function fu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, sh();
          var t = Ta, e = An, a = oa, i = rd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, An = Ta = null, mu(t, t.pendingLanes));
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
          (oa & 3) !== 0 && Wn(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === zo ? cl++ : (cl = 0, zo = t) : cl = 0, re && Zp(), on(0);
        }
      }
      function mu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Dn(e)));
      }
      function Wn() {
        return uu(), du(), fu(), pu();
      }
      function pu() {
        if (Xt !== 5) return !1;
        var t = Ta, e = So;
        So = 0;
        var a = L(oa), i = 32 > a ? 32 : a;
        a = rt.T;
        var r = aa();
        try {
          Lt(i), rt.T = null, i = ko, ko = null;
          var u = Ta, m = oa;
          if (Xt = 0, An = Ta = null, oa = 0, (yt & 6) !== 0)
            throw Error(c(331));
          var S = yt;
          if (yt |= 4, Wc(u.current), Zc(
            u,
            u.current,
            m,
            i
          ), yt = S, on(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot(Pn, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), rt.T = a, mu(t, e);
        }
      }
      function hu(t, e, a) {
        e = q(a, e), e = gr(t.stateNode, e, 2), t = pa(t, e, 2), t !== null && (A(t, 2), Ge(t));
      }
      function kt(t, e, a) {
        if (t.tag === 3)
          hu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              hu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var i = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof i.componentDidCatch == "function" && (Na === null || !Na.has(i))) {
                t = q(a, t), a = pc(2), i = pa(e, a, 2), i !== null && (hc(
                  a,
                  i,
                  e,
                  t
                ), A(i, 2), Ge(i));
                break;
              }
            }
            e = e.return;
          }
      }
      function qr(t, e, a) {
        var i = t.pingCache;
        if (i === null) {
          i = t.pingCache = new yh();
          var r = /* @__PURE__ */ new Set();
          i.set(e, r);
        } else
          r = i.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), i.set(e, r));
        r.has(a) || (xo = !0, r.add(a), t = _m.bind(null, t, e, a), e.then(t, t));
      }
      function _m(t, e, a) {
        var i = t.pingCache;
        i !== null && i.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Mt === t && (wt & a) === a && (Ut === 4 || Ut === 3 && (wt & 62914560) === wt && 300 > de() - mi ? (yt & 2) === 0 && un(t, 0) : wo |= a, Mn === wt && (Mn = 0)), Ge(t);
      }
      function gu(t, e) {
        e === 0 && (e = K()), t = qa(t, e), t !== null && (A(t, e), Ge(t));
      }
      function Sm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), gu(t, a);
      }
      function km(t, e) {
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
            throw Error(c(314));
        }
        i !== null && i.delete(e), gu(t, a);
      }
      function zm(t, e) {
        return Il(t, e);
      }
      function Em(t, e, a, i) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Yr(t) {
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
      function bu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Vl(t, e, a, i, r, u) {
        var m = 0;
        if (i = t, typeof t == "function") Yr(t) && (m = 1);
        else if (typeof t == "string")
          m = Be && Vt ? Yu(t, a, te.current) ? 26 : Wu(t) ? 27 : 5 : Be ? Yu(
            t,
            a,
            te.current
          ) ? 26 : 5 : Vt && Wu(t) ? 27 : 5;
        else
          t: switch (t) {
            case Fr:
              return t = o(31, a, e, r), t.elementType = Fr, t.lanes = u, t;
            case mn:
              return Qa(
                a.children,
                r,
                u,
                e
              );
            case ku:
              m = 8, r |= 24;
              break;
            case Xr:
              return t = o(12, a, e, r | 2), t.elementType = Xr, t.lanes = u, t;
            case Jr:
              return t = o(13, a, e, r), t.elementType = Jr, t.lanes = u, t;
            case Lr:
              return t = o(19, a, e, r), t.elementType = Lr, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case ya:
                    m = 10;
                    break t;
                  case zu:
                    m = 9;
                    break t;
                  case Zr:
                    m = 11;
                    break t;
                  case Wr:
                    m = 14;
                    break t;
                  case xa:
                    m = 16, i = null;
                    break t;
                }
              m = 29, a = Error(
                c(
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
      function Gr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function vu(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Kr(t, e, a) {
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
      function Nm(t, e, a, i, r, u, m, S, U) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Va, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = B(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = B(0), this.hiddenUpdates = B(null), this.identifierPrefix = i, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = m, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = U, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function yu(t, e, a, i, r, u, m, S, U, Q, W, Z) {
        return t = new Nm(
          t,
          e,
          a,
          m,
          U,
          Q,
          W,
          Z,
          S
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Vi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: i,
          isDehydrated: a,
          cache: e
        }, Li(u), t;
      }
      function xu(t) {
        return t ? (t = bn, t) : bn;
      }
      function wu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(c(188)) : (t = Object.keys(t).join(","), Error(c(268, t)));
        return t = f(e), t = t !== null ? g(t) : null, t === null ? null : Fn(t.stateNode);
      }
      function _u(t, e, a, i, r, u) {
        r = xu(r), i.context === null ? i.context = r : i.pendingContext = r, i = ma(e), i.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (i.callback = u), a = pa(t, i, e), a !== null && (ue(a, t, e), Bn(a, t, e));
      }
      function Su(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Qr(t, e) {
        Su(t, e), (t = t.alternate) && Su(t, e);
      }
      var vt = {}, Tm = Lh, ge = Fh(), Vr = Object.assign, Cm = Symbol.for("react.element"), Xl = Symbol.for("react.transitional.element"), fn = Symbol.for("react.portal"), mn = Symbol.for("react.fragment"), ku = Symbol.for("react.strict_mode"), Xr = Symbol.for("react.profiler"), zu = Symbol.for("react.consumer"), ya = Symbol.for("react.context"), Zr = Symbol.for("react.forward_ref"), Jr = Symbol.for("react.suspense"), Lr = Symbol.for("react.suspense_list"), Wr = Symbol.for("react.memo"), xa = Symbol.for("react.lazy"), Fr = Symbol.for("react.activity"), jm = Symbol.for("react.memo_cache_sentinel"), Eu = Symbol.iterator, Mm = Symbol.for("react.client.reference"), Zl = Array.isArray, rt = Tm.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Am = l.rendererVersion, Om = l.rendererPackageName, Nu = l.extraDevToolsConfig, Fn = l.getPublicInstance, Rm = l.getRootHostContext, Hm = l.getChildHostContext, Dm = l.prepareForCommit, Um = l.resetAfterCommit, Bm = l.createInstance;
      l.cloneMutableInstance;
      var Ir = l.appendInitialChild, Tu = l.finalizeInitialChildren, Jl = l.shouldSetTextContent, Cu = l.createTextInstance;
      l.cloneMutableTextInstance;
      var qm = l.scheduleTimeout, Ym = l.cancelTimeout, Va = l.noTimeout, ea = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ie = l.supportsMutation, Qe = l.supportsPersistence, re = l.supportsHydration, Gm = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Km = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Lt = l.setCurrentUpdatePriority, aa = l.getCurrentUpdatePriority, Qm = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var Vm = l.shouldAttemptEagerTransition, Xm = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Zm = l.maySuspendCommit, Jm = l.maySuspendCommitOnUpdate, $r = l.maySuspendCommitInSyncRender, ju = l.preloadInstance, Lm = l.startSuspendingCommit, Mu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Wm = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var pn = l.NotPendingTransition, Xa = l.HostTransitionContext, Fm = l.resetFormInstance;
      l.bindToConsole;
      var Im = l.supportsMicrotasks, $m = l.scheduleMicrotask, In = l.supportsTestSelectors, Pm = l.findFiberRoot, tp = l.getBoundingRect, ep = l.getTextContent, $n = l.isHiddenSubtree, ap = l.matchAccessibilityRole, np = l.setFocusIfFocusable, lp = l.setupIntersectionObserver, ip = l.appendChild, rp = l.appendChildToContainer, op = l.commitTextUpdate, sp = l.commitMount, cp = l.commitUpdate, up = l.insertBefore, dp = l.insertInContainerBefore, fp = l.removeChild, mp = l.removeChildFromContainer, Au = l.resetTextContent, pp = l.hideInstance, hp = l.hideTextInstance, gp = l.unhideInstance, bp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var vp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var yp = l.cloneInstance, Ou = l.createContainerChildSet, Ru = l.appendChildToContainerChildSet, xp = l.finalizeContainerChildren, Hu = l.replaceContainerChildren, Du = l.cloneHiddenInstance, Uu = l.cloneHiddenTextInstance, Pr = l.isSuspenseInstancePending, to = l.isSuspenseInstanceFallback, wp = l.getSuspenseInstanceFallbackErrorDetails, _p = l.registerSuspenseInstanceRetry, Sp = l.canHydrateFormStateMarker, kp = l.isFormStateMarkerMatching, Bu = l.getNextHydratableSibling, zp = l.getNextHydratableSiblingAfterSingleton, Ep = l.getFirstHydratableChild, Np = l.getFirstHydratableChildWithinContainer, Tp = l.getFirstHydratableChildWithinActivityInstance, Cp = l.getFirstHydratableChildWithinSuspenseInstance, jp = l.getFirstHydratableChildWithinSingleton, Mp = l.canHydrateInstance, Ap = l.canHydrateTextInstance, Op = l.canHydrateActivityInstance, Rp = l.canHydrateSuspenseInstance, Hp = l.hydrateInstance, Dp = l.hydrateTextInstance, Up = l.hydrateActivityInstance, Bp = l.hydrateSuspenseInstance, qp = l.getNextHydratableInstanceAfterActivityInstance, Yp = l.getNextHydratableInstanceAfterSuspenseInstance, Gp = l.commitHydratedInstance, Kp = l.commitHydratedContainer, Qp = l.commitHydratedActivityInstance, Vp = l.commitHydratedSuspenseInstance, Xp = l.finalizeHydratedChildren, Zp = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Jp = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var Lp = l.clearSuspenseBoundaryFromContainer, Wp = l.hideDehydratedBoundary, Fp = l.unhideDehydratedBoundary, qu = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Ip = l.validateHydratableInstance, $p = l.validateHydratableTextInstance, Be = l.supportsResources, Yu = l.isHostHoistableType, eo = l.getHoistableRoot, Gu = l.getResource, Ku = l.acquireResource, Qu = l.releaseResource, Pp = l.hydrateHoistable, Vu = l.mountHoistable, Xu = l.unmountHoistable, th = l.createHoistableInstance, eh = l.prepareToCommitHoistables, ah = l.mayResourceSuspendCommit, Zu = l.preloadResource, nh = l.suspendResource, Vt = l.supportsSingletons, Ju = l.resolveSingletonInstance, lh = l.acquireSingletonInstance, Lu = l.releaseSingletonInstance, Wu = l.isHostSingletonType, hn = l.isSingletonScope, ao = [], gn = -1, bn = {}, be = Math.clz32 ? Math.clz32 : h, ih = Math.log, rh = Math.LN2, Ll = 256, Wl = 262144, Fl = 4194304, Il = ge.unstable_scheduleCallback, no = ge.unstable_cancelCallback, oh = ge.unstable_shouldYield, sh = ge.unstable_requestPaint, de = ge.unstable_now, Fu = ge.unstable_ImmediatePriority, ch = ge.unstable_UserBlockingPriority, lo = ge.unstable_NormalPriority, uh = ge.unstable_IdlePriority, dh = ge.log, fh = ge.unstable_setDisableYieldValue, Pn = null, ve = null, ye = typeof Object.is == "function" ? Object.is : ht, Iu = typeof reportError == "function" ? reportError : function(t) {
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
      }, mh = Object.prototype.hasOwnProperty, io, $u, ro = !1, Pu = /* @__PURE__ */ new WeakMap(), vn = [], yn = 0, $l = null, tl = 0, Ee = [], Ne = 0, wa = null, Ve = 1, Xe = "", te = k(null), el = k(null), _a = k(null), Pl = k(null), ee = null, Ot = null, _t = !1, Sa = null, Te = !1, oo = Error(c(519)), ti = k(null), Za = null, na = null, ph = typeof AbortController < "u" ? AbortController : function() {
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
      }, hh = ge.unstable_scheduleCallback, gh = ge.unstable_NormalPriority, Rt = {
        $$typeof: ya,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ei = null, xn = null, so = !1, ai = !1, co = !1, Ja = 0, al = null, uo = 0, wn = 0, _n = null, td = rt.S;
      rt.S = function(t, e) {
        id = de(), typeof e == "object" && e !== null && typeof e.then == "function" && nm(t, e), td !== null && td(t, e);
      };
      var La = k(null), Sn = Error(c(460)), fo = Error(c(474)), ni = Error(c(542)), li = { then: function() {
      } }, Wa = null, kn = null, nl = 0, Fa = ks(!0), ed = ks(!1), Ce = [], zn = 0, mo = 0, ka = !1, po = !1, En = k(null), ii = k(0), xe = k(null), je = null, qt = k(0), la = 0, gt = null, jt = null, Yt = null, ri = !1, Nn = !1, Ia = !1, oi = 0, ll = 0, Tn = null, bh = 0, il = {
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
      var ad = {
        readContext: $t,
        use: Tl,
        useCallback: function(t, e) {
          return se().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: $t,
        useEffect: Ws,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, jl(
            4194308,
            4,
            Ps.bind(null, e, t),
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
            ct(!0);
            try {
              t();
            } finally {
              ct(!1);
            }
          }
          return a.memoizedState = [i, e], i;
        },
        useReducer: function(t, e, a) {
          var i = se();
          if (a !== void 0) {
            var r = a(e);
            if (Ia) {
              ct(!0);
              try {
                a(e);
              } finally {
                ct(!1);
              }
            }
          } else r = e;
          return i.memoizedState = i.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, i.queue = t, t = t.dispatch = um.bind(
            null,
            gt,
            t
          ), [i.memoizedState, t];
        },
        useRef: function(t) {
          var e = se();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = sr(t);
          var e = t.queue, a = sc.bind(
            null,
            gt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: dr,
        useDeferredValue: function(t, e) {
          var a = se();
          return fr(a, t, e);
        },
        useTransition: function() {
          var t = sr(!1);
          return t = lc.bind(
            null,
            gt,
            t.queue,
            !0,
            !1
          ), se().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var i = gt, r = se();
          if (_t) {
            if (a === void 0)
              throw Error(c(407));
            a = a();
          } else {
            if (a = e(), Mt === null)
              throw Error(c(349));
            (wt & 127) !== 0 || Os(i, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Ws(Hs.bind(null, i, u, t), [
            t
          ]), i.flags |= 2048, sn(
            9,
            { destroy: void 0 },
            Rs.bind(
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
            var a = Xe, i = Ve;
            a = (i & ~(1 << 32 - be(i) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = oi++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = bh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: mr,
        useFormState: Vs,
        useActionState: Vs,
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
          return e.queue = a, e = pr.bind(
            null,
            gt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: ir,
        useCacheRefresh: function() {
          return se().memoizedState = cm.bind(
            null,
            gt
          );
        },
        useEffectEvent: function(t) {
          var e = se(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((yt & 2) !== 0)
              throw Error(c(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, ho = {
        readContext: $t,
        use: Tl,
        useCallback: ec,
        useContext: $t,
        useEffect: ur,
        useImperativeHandle: tc,
        useInsertionEffect: Is,
        useLayoutEffect: $s,
        useMemo: ac,
        useReducer: Cl,
        useRef: Ls,
        useState: function() {
          return Cl(Fe);
        },
        useDebugValue: dr,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return nc(
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
        useSyncExternalStore: As,
        useId: rc,
        useHostTransitionStatus: mr,
        useFormState: Xs,
        useActionState: Xs,
        useOptimistic: function(t, e) {
          var a = Bt();
          return Bs(a, jt, t, e);
        },
        useMemoCache: ir,
        useCacheRefresh: oc
      };
      ho.useEffectEvent = Fs;
      var nd = {
        readContext: $t,
        use: Tl,
        useCallback: ec,
        useContext: $t,
        useEffect: ur,
        useImperativeHandle: tc,
        useInsertionEffect: Is,
        useLayoutEffect: $s,
        useMemo: ac,
        useReducer: or,
        useRef: Ls,
        useState: function() {
          return or(Fe);
        },
        useDebugValue: dr,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return jt === null ? fr(a, t, e) : nc(
            a,
            jt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = or(Fe)[0], e = Bt().memoizedState;
          return [
            typeof t == "boolean" ? t : Gn(t),
            e
          ];
        },
        useSyncExternalStore: As,
        useId: rc,
        useHostTransitionStatus: mr,
        useFormState: Js,
        useActionState: Js,
        useOptimistic: function(t, e) {
          var a = Bt();
          return jt !== null ? Bs(a, jt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: ir,
        useCacheRefresh: oc
      };
      nd.useEffectEvent = Fs;
      var go = {
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
      }, bo = Error(c(461)), Gt = !1, vo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, ia = !1, Kt = !1, yo = !1, ld = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, fe = !1, qe = null, Cn = 8192, vh = {
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
      var yh = typeof WeakMap == "function" ? WeakMap : Map, yt = 0, Mt = null, xt = null, wt = 0, Ct = 0, we = null, za = !1, jn = !1, xo = !1, ra = 0, Ut = 0, Ea = 0, $a = 0, wo = 0, _e = 0, Mn = 0, ol = null, me = null, _o = !1, mi = 0, id = 0, sl = 1 / 0, pi = null, Na = null, Xt = 0, Ta = null, An = null, oa = 0, So = 0, ko = null, rd = null, cl = 0, zo = null;
      return vt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = qa(t, 67108864);
          e !== null && ue(e, t, 67108864), Qr(t, 67108864);
        }
      }, vt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = he();
          e = V(e);
          var a = qa(t, e);
          a !== null && ue(a, t, e), Qr(t, e);
        }
      }, vt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = _(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - be(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ge(t), (yt & 6) === 0 && (sl = de() + 500, on(0));
              }
            }
            break;
          case 31:
          case 13:
            e = qa(t, 2), e !== null && ue(e, t, 2), eu(), Qr(t, 2);
        }
      }, vt.batchedUpdates = function(t, e) {
        return t(e);
      }, vt.createComponentSelector = function(t) {
        return { $$typeof: si, value: t };
      }, vt.createContainer = function(t, e, a, i, r, u, m, S, U, Q) {
        return yu(
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
          U,
          Q
        );
      }, vt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, vt.createHydrationContainer = function(t, e, a, i, r, u, m, S, U, Q, W, Z, F, mt) {
        return t = yu(
          a,
          i,
          !0,
          t,
          r,
          u,
          S,
          mt,
          U,
          Q,
          W,
          Z
        ), t.context = xu(null), a = t.current, i = he(), i = V(i), r = ma(i), r.callback = e ?? null, pa(a, r, i), e = i, t.current.lanes = e, A(t, e), Ge(t), t;
      }, vt.createPortal = function(t, e, a) {
        var i = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: fn,
          key: i == null ? null : "" + i,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, vt.createRoleSelector = function(t) {
        return { $$typeof: ui, value: t };
      }, vt.createTestNameSelector = function(t) {
        return { $$typeof: di, value: t };
      }, vt.createTextSelector = function(t) {
        return { $$typeof: fi, value: t };
      }, vt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, vt.defaultOnRecoverableError = function(t) {
        Iu(t);
      }, vt.defaultOnUncaughtError = function(t) {
        Iu(t);
      }, vt.deferredUpdates = function(t) {
        var e = rt.T, a = aa();
        try {
          return Lt(32), rt.T = null, t();
        } finally {
          Lt(a), rt.T = e;
        }
      }, vt.discreteUpdates = function(t, e, a, i, r) {
        var u = rt.T, m = aa();
        try {
          return Lt(2), rt.T = null, t(e, a, i, r);
        } finally {
          Lt(m), rt.T = u, yt === 0 && (sl = de() + 500);
        }
      }, vt.findAllNodes = Dr, vt.findBoundingRects = function(t, e) {
        if (!In) throw Error(c(363));
        e = Dr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(tp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var i = a.x, r = i + a.width, u = a.y, m = u + a.height, S = e - 1; 0 <= S; S--)
            if (e !== S) {
              var U = t[S], Q = U.x, W = Q + U.width, Z = U.y, F = Z + U.height;
              if (i >= Q && u >= Z && r <= W && m <= F) {
                t.splice(e, 1);
                break;
              } else if (i !== Q || a.width !== U.width || F < u || Z > m) {
                if (!(u !== Z || a.height !== U.height || W < i || Q > r)) {
                  Q > i && (U.width += Q - i, U.x = i), W < r && (U.width = r - Q), t.splice(e, 1);
                  break;
                }
              } else {
                Z > u && (U.height += Z - u, U.y = u), F < m && (U.height = m - Z), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, vt.findHostInstance = wu, vt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? x(t) : null, t === null ? null : Fn(t.stateNode);
      }, vt.findHostInstanceWithWarning = function(t) {
        return wu(t);
      }, vt.flushPassiveEffects = Wn, vt.flushSyncFromReconciler = function(t) {
        var e = yt;
        yt |= 1;
        var a = rt.T, i = aa();
        try {
          if (Lt(2), rt.T = null, t)
            return t();
        } finally {
          Lt(i), rt.T = a, yt = e, (yt & 6) === 0 && on(0);
        }
      }, vt.flushSyncWork = eu, vt.focusWithin = function(t, e) {
        if (!In) throw Error(c(363));
        for (t = Or(t), e = Ic(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], i = a.tag;
          if (!$n(a)) {
            if ((i === 5 || i === 26 || i === 27) && np(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, vt.getFindAllNodesFailureDescription = function(t, e) {
        if (!In) throw Error(c(363));
        var a = 0, i = [];
        t = [Or(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], m = u.tag, S = t[r++], U = e[S];
          if ((m !== 5 && m !== 26 && m !== 27 || !$n(u)) && (Rr(u, U) && (i.push(Hr(U)), S++, S > a && (a = S)), S < e.length))
            for (u = u.child; u !== null; )
              t.push(u, S), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Hr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (i.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, vt.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Fn(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, vt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Am,
          rendererPackageName: Om,
          currentDispatcherRef: rt,
          reconcilerVersion: "19.2.0"
        };
        if (Nu !== null && (t.rendererConfig = Nu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
      }, vt.isAlreadyRendering = function() {
        return (yt & 6) !== 0;
      }, vt.observeVisibleRects = function(t, e, a, i) {
        if (!In) throw Error(c(363));
        t = Dr(t, e);
        var r = lp(
          t,
          a,
          i
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, vt.shouldError = function() {
        return null;
      }, vt.shouldSuspend = function() {
        return !1;
      }, vt.startHostTransition = function(t, e, a, i) {
        if (t.tag !== 5) throw Error(c(476));
        var r = ic(t).queue;
        lc(
          t,
          r,
          e,
          pn,
          a === null ? s : function() {
            var u = ic(t);
            return u.next === null && (u = t.alternate.memoizedState), Kn(
              t,
              u.next.queue,
              {},
              he()
            ), a(i);
          }
        );
      }, vt.updateContainer = function(t, e, a, i) {
        var r = e.current, u = he();
        return _u(
          r,
          u,
          t,
          e,
          a,
          i
        ), u;
      }, vt.updateContainerSync = function(t, e, a, i) {
        return _u(
          e.current,
          2,
          t,
          e,
          a,
          i
        ), 2;
      }, vt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Co)), Co.exports;
}
var yd;
function $h() {
  return yd || (yd = 1, To.exports = Ih()), To.exports;
}
var Ph = $h();
const tg = /* @__PURE__ */ rs(Ph);
var Ao = { exports: {} }, sa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var xd;
function eg() {
  return xd || (xd = 1, sa.ConcurrentRoot = 1, sa.ContinuousEventPriority = 8, sa.DefaultEventPriority = 32, sa.DiscreteEventPriority = 2, sa.IdleEventPriority = 268435456, sa.LegacyRoot = 0, sa.NoEventPriority = 0), sa;
}
var wd;
function ag() {
  return wd || (wd = 1, Ao.exports = eg()), Ao.exports;
}
var hl = ag();
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
const of = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Zo = 16, sf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), ng = [
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
], _d = {
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
}, lg = /* @__PURE__ */ new Set([
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
]), cf = {
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
}, uf = {
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
}, Jo = ["font-size", "color", ...new Set([...Object.keys(cf), ...Object.keys(uf)].filter((n) => n !== "font-size" && n !== "color"))], ig = new Set(Jo);
function ne(n, l = " ") {
  const o = [];
  let s = 0, c = "";
  for (let d = 0; d < n.length; d++) {
    const p = n[d];
    if (p === "(" ? s++ : p === ")" && s--, s === 0 && (l === " " ? /\s/.test(p) : p === l)) {
      (c.trim() || l !== " ") && o.push(c.trim()), c = "";
      continue;
    }
    c += p;
  }
  return (c.trim() || l !== " " && o.length) && o.push(c.trim()), o;
}
function Lo(n, l, o = 0) {
  if (o > 32) return null;
  let s = "", c = 0;
  for (; ; ) {
    const d = n.indexOf("var(", c);
    if (d < 0)
      return s += n.slice(c), s;
    s += n.slice(c, d);
    let p = 1, f = d + 4;
    for (; f < n.length && p; f++)
      n[f] === "(" ? p++ : n[f] === ")" && p--;
    const g = n.slice(d + 4, f - 1), x = ne(g, ","), T = x[0].trim(), M = x.length > 1 ? g.slice(g.indexOf(",") + 1).trim() : null;
    let k = l(T);
    if ((k == null || k === "initial") && (k = M), k == null) return null;
    const E = Lo(k, l, o + 1);
    if (E === null) return null;
    s += E, c = f;
  }
}
function rg(n) {
  const l = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, c = 0;
  for (; c < n.length; ) {
    if (o.lastIndex = c, s = o.exec(n), !s || s.index !== c) {
      if (/^\s+$/.test(n.slice(c))) break;
      return null;
    }
    c = o.lastIndex, s[1] !== void 0 ? l.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? l.push({ fn: s[3].toLowerCase() }) : s[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: s[5] ?? s[6] });
  }
  return l;
}
function Oa(n, l) {
  const o = rg(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let s = 0;
  const c = ({ num: k, unit: E }) => {
    switch (E) {
      case "":
        return { px: 0, pct: 0, num: k, unitless: !0 };
      case "px":
        return { px: k, pct: 0, num: 0 };
      case "rem":
        return { px: k * Zo, pct: 0, num: 0 };
      case "em":
        return { px: k * (l.fontSize ?? Zo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: k, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: k / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: k / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: k * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (k, E, y) => k && E ? { px: k.px + y * E.px, pct: k.pct + y * E.pct, num: k.num + y * E.num, unitless: k.unitless && E.unitless } : null, p = (k, E) => k ? { px: k.px * E, pct: k.pct * E, num: k.num * E, unitless: k.unitless } : null, f = (k) => k && k.unitless;
  function g() {
    const k = o[s++];
    if (!k) return null;
    if (k.num !== void 0) return c(k);
    if (k.op === "(") {
      const E = T();
      return o[s]?.op !== ")" ? null : (s++, E);
    }
    if (k.op === "-" || k.op === "+") {
      const E = g();
      return k.op === "-" ? p(E, -1) : E;
    }
    if (k.fn) {
      const E = [];
      for (; ; ) {
        E.push(T());
        const _ = o[s++];
        if (!_) return null;
        if (_.op === ")") break;
        if (_.op !== ",") return null;
      }
      if (E.some((_) => !_)) return null;
      if (k.fn === "calc") return E[0];
      if (!(E.every((_) => !_.pct) || E.every((_) => !_.px && !_.num))) return null;
      const h = (_) => _.px + _.pct + _.num;
      return k.fn === "min" ? E.reduce((_, O) => h(O) < h(_) ? O : _) : k.fn === "max" ? E.reduce((_, O) => h(O) > h(_) ? O : _) : k.fn === "clamp" && E.length === 3 ? h(E[1]) < h(E[0]) ? E[0] : h(E[1]) > h(E[2]) ? E[2] : E[1] : null;
    }
    return null;
  }
  function x() {
    let k = g();
    for (; o[s] && (o[s].op === "*" || o[s].op === "/"); ) {
      const E = o[s++].op, y = g();
      if (!k || !y) return null;
      E === "*" ? k = f(y) ? p(k, y.num) : f(k) ? p(y, k.num) : null : k = f(y) && y.num !== 0 ? p(k, 1 / y.num) : null;
    }
    return k;
  }
  function T() {
    let k = x();
    for (; o[s] && (o[s].op === "+" || o[s].op === "-"); ) {
      const E = o[s++].op;
      k = d(k, x(), E === "-" ? -1 : 1);
    }
    return k;
  }
  const M = T();
  return s !== o.length || !M ? null : M;
}
function Wo(n, l) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const s = Oa(o, l);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: n.trim() } : s.pct && (s.px || s.num) ? { expr: n.trim() } : s.pct ? { pct: s.pct } : { px: og(s.px) } : { expr: n.trim() };
}
const og = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, bi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), sg = ([n, l, o, s]) => `#${bi(n)}${bi(l)}${bi(o)}${bi(s * 255)}`;
function Sd(n) {
  const l = n.slice(1), o = l.length <= 4 ? l.split("").map((c) => c + c).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const s = (c) => parseInt(o.slice(c, c + 2), 16);
  return [s(0), s(2), s(4), o.length === 8 ? s(6) / 255 : 1];
}
function Ni(n, l) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (s) {
    const x = l(s[1]), T = x && Sd(x);
    return T ? { rgba: T, token: s[1] } : null;
  }
  if (o.startsWith("#")) {
    const x = Sd(o);
    return x ? { rgba: x, token: null } : null;
  }
  if (_d[o]) return { rgba: [..._d[o]], token: null };
  const c = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!c) return null;
  if (c[1] === "color-mix") {
    const x = ne(c[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const T = (ct) => {
      const ht = ne(ct), ut = ht.findIndex((lt) => /%$/.test(lt)), X = ut >= 0 ? parseFloat(ht[ut]) / 100 : null;
      return { color: Ni(ht.filter((lt, q) => q !== ut).join(" "), l), pct: X };
    }, M = T(x[1]), k = T(x[2]);
    if (!M.color || !k.color || M.color === "currentcolor" || k.color === "currentcolor") return null;
    let E = M.pct, y = k.pct;
    E === null && y === null ? (E = 0.5, y = 0.5) : E === null ? E = 1 - y : y === null && (y = 1 - E);
    const h = E + y, _ = h < 1 ? h : 1;
    E /= h, y /= h;
    const [O, N, j, K] = M.color.rgba, [B, A, v, b] = k.color.rgba, z = K * E + b * y, D = (ct, ht) => z === 0 ? 0 : (ct * K * E + ht * b * y) / z, V = [D(O, B), D(N, A), D(j, v), z * _], L = b === 0 ? M.color.token : K === 0 ? k.color.token : null;
    return { rgba: V, token: L };
  }
  const d = c[2].includes(",") ? ne(c[2], ",") : ne(c[2].replace("/", " / ")).filter((x) => x !== "/");
  if (d.length < 3) return null;
  const p = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), g = [p(d[0]), p(d[1]), p(d[2]), f];
  return g.some((x) => Number.isNaN(x)) ? null : { rgba: g, token: null };
}
const ml = ["top", "right", "bottom", "left"], cg = ["top-left", "top-right", "bottom-right", "bottom-left"], vi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], kd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Fo(n, l) {
  const o = l.trim(), s = () => ne(o);
  switch (n) {
    case "padding":
    case "margin": {
      const c = vi(s());
      return ml.map((d, p) => [`${n}-${d}`, c[p]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const c = s(), d = n.split("-")[0];
      return [[`${d}-left`, c[0]], [`${d}-right`, c[1] ?? c[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const c = s(), d = n.split("-")[0];
      return [[`${d}-top`, c[0]], [`${d}-bottom`, c[1] ?? c[0]]];
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
      const c = vi(s());
      return ml.map((d, p) => [d, c[p]]);
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
      return [["left", o]];
    case "inset-inline-end":
      return [["right", o]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const c = n.split("-")[1], d = vi(s());
      return ml.map((p, f) => [`border-${p}-${c}`, d[f]]);
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
      const c = n === "border" ? ml : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", p = "none", f = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const g of s())
          kd.has(g) ? p = g : /^(thin|medium|thick|-?[\d.]|calc\()/.test(g) ? d = g : f = g;
      else o === "0" && (d = "0");
      return c.flatMap((g) => [[`border-${g}-width`, d], [`border-${g}-style`, p], [`border-${g}-color`, f]]);
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
      const c = vi(ne(o.split("/")[0]));
      return cg.map((d, p) => [`border-${d}-radius`, c[p]]);
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
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(o) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((c) => [c, o]) : [[n, o]];
    case "overflow": {
      const c = s();
      return [["overflow-x", c[0]], ["overflow-y", c[1] ?? c[0]]];
    }
    case "gap": {
      const c = s();
      return [["row-gap", c[0]], ["column-gap", c[1] ?? c[0]]];
    }
    case "grid-gap":
      return Fo("gap", o);
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
      if (o === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (o === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (o === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const c = s(), d = c.filter((f) => /^[\d.]+$/.test(f)), p = c.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", p ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const c = [];
      for (const d of s()) c.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return c;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let c = "medium", d = "none", p = "currentcolor";
      for (const f of s())
        kd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? c = f : p = f;
      return [["outline-width", c], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const c = ne(o, ","), d = c.map((f) => ne(f).find((g) => !/^[\d.]+m?s$/.test(g) && !/^(ease|linear|step|cubic)/.test(g)) ?? "all"), p = c.map((f) => ne(f).find((g) => /^[\d.]+m?s$/.test(g)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", p.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", s()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", o]];
    case "word-wrap":
      return [["overflow-wrap", o]];
    default:
      return [[n, o]];
  }
}
function ug(n, l) {
  return n ? ne(n, ",").some((o) => {
    let s = o.trim().toLowerCase(), c = !1;
    s.startsWith("not ") && (c = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const d = s.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const f = /^\((.+)\)$/.exec(p);
      if (!f) return !1;
      const g = f[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(g);
      if (x) {
        const [, M, k] = x, E = (y) => {
          const h = Wo(y, { viewport: l });
          return typeof h == "object" && "px" in h ? h.px : NaN;
        };
        switch (M) {
          case "min-width":
            return l.width >= E(k);
          case "max-width":
            return l.width <= E(k);
          case "min-height":
            return l.height >= E(k);
          case "max-height":
            return l.height <= E(k);
          case "hover":
          case "any-hover":
            return k.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return k.trim() === "fine";
          case "prefers-reduced-motion":
            return k.trim() === "no-preference";
          case "prefers-color-scheme":
            return k.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const T = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(g);
      if (T) {
        const M = T[1] === "width" ? l.width : l.height, k = Wo(T[3], { viewport: l }), E = typeof k == "object" && "px" in k ? k.px : NaN;
        switch (T[2]) {
          case ">=":
            return M >= E;
          case "<=":
            return M <= E;
          case ">":
            return M > E;
          case "<":
            return M < E;
          default:
            return M === E;
        }
      }
      return !1;
    });
    return c ? !d : d;
  }) : !0;
}
function dg(n, l) {
  const o = l[l.length - 1].compound;
  return os(o)[0] ?? n;
}
function fg(n) {
  const l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), s = (c, d) => {
    c.forEach(({ compound: p }, f) => {
      const g = d && f === c.length - 1;
      for (const x of p.pseudos)
        if (sf.has(x.name) && (g ? l : o).add(x.name), x.list && x.name !== "not") for (const T of x.list) s(T, g);
    });
  };
  return s(n, !0), { subject: l, ancestor: o };
}
function os(n) {
  const l = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const s of o.list) s.length === 1 && l.push(...os(s[0].compound));
  return l;
}
function mg(n, l) {
  const o = (s, c) => {
    s.forEach(({ compound: d }, p) => {
      const f = c && p === s.length - 1, g = d.pseudos.filter((x) => sf.has(x.name)).map((x) => x.name);
      if (!f) for (const x of g) for (const T of os(d)) l.add(`${x}:${T}`);
      for (const x of d.pseudos) if (x.list && x.name !== "not") for (const T of x.list) o(T, f);
    });
  };
  o(n, !0);
}
class pg {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const f = p[p.length - 1].compound, g = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(g) || this.index.set(g, []), this.index.get(g).push(d);
    };
    let s = 0;
    const c = (d, p) => {
      for (const [f, g, x, T] of d)
        for (const M of ns(f)) {
          let k;
          try {
            k = ls(M);
          } catch (h) {
            if (h instanceof ke) {
              this.skipped++;
              continue;
            }
            throw h;
          }
          const E = fg(k);
          mg(k, this.trackedStates);
          const y = { steps: k, media: g, layer: x, origin: p, order: s++, specificity: Id(k), decls: T, states: E, source: p === 0 ? `ua:${k[k.length - 1].compound.tag ?? "*"}` : dg(M, k) };
          this.rules.push(y), o(y, k);
        }
    };
    c(ng.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), c(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(l) {
    const o = [], s = /* @__PURE__ */ new Set(), c = (d) => {
      if (d) for (const p of d) s.has(p) || (s.add(p), o.push(p));
    };
    for (const d of l.classList) c(this.index.get(`.${d}`));
    return c(this.index.get(l.tagName)), c(this.index.get("*")), o;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(l, o) {
    return this.candidates(l).some((s) => s.states.ancestor.has(o));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, o) {
    for (const s of l.classList) if (this.trackedStates.has(`${o}:${s}`)) return !0;
    return !1;
  }
}
const hg = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function gg(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [o, s] of Object.entries(n)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const c = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof s == "number" && s !== 0 && !hg.has(c) && !c.startsWith("--") ? `${s}px` : String(s);
    l.push([c, d]);
  }
  return l;
}
function bg(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const o of ["width", "height"]) {
    const s = n.getAttribute(o);
    s !== null && l.push([o, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return l;
}
const vg = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class yg {
  constructor(l, { theme: o, viewport: s }) {
    this.sheet = l, this.theme = o, this.viewport = s, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, o) {
    const s = (c, d, p) => {
      if (d === "disabled") return !!c.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(c.tagName);
      if (d === "enabled") return !c.props?.disabled && ["button", "input", "select", "textarea"].includes(c.tagName);
      if (d === "checked") return !!c.props?.checked;
      if (o === "*") return !0;
      if (d === "focus-within") {
        const f = c.ownerDocument?.activeElement;
        return !!f && f !== c.ownerDocument.body && typeof c.contains == "function" && c.contains(f);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!c.state?.focus && !c.state?.pointerFocus : !!c.state?.[d];
    };
    return this.sheet.candidates(l).filter((c) => (!c.media || c.media.every((d) => ug(d, this.viewport))) && $d(l, c.steps, { state: s }));
  }
  compute(l, o, s = /* @__PURE__ */ new Set()) {
    const c = this.matching(l, s), d = [];
    for (const v of c)
      for (const [b, z, D] of v.decls) d.push({ prop: b, value: z, important: D ? 1 : 0, origin: v.origin === 0 ? 0 : 2, layer: v.layer, specificity: v.specificity, order: v.order, source: v.source });
    for (const [v, b] of bg(l)) d.push({ prop: v, value: b, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${v}` });
    for (const [v, b] of gg(l.inlineStyle ?? l.props?.style)) d.push({ prop: v, value: b, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(vg);
    const p = this.sheet.properties, f = Object.create(o?.customs ?? null), g = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const v of d) v.prop.startsWith("--") && x.set(v.prop, v.value);
    if (!o && this.theme) for (const v of of) this.theme[v] && x.set(`--${v}`, `perchtoken(${v})`);
    const T = (v) => {
      if (g.has(v)) return g.get(v);
      const b = p[v];
      return b && !b.inherits ? b.initial ?? null : v in f ? f[v] : b?.initial ?? null;
    }, M = /* @__PURE__ */ new Set(), k = (v) => {
      if (!x.has(v)) return T(v);
      if (M.has(v)) return null;
      M.add(v);
      const b = Lo(x.get(v), k);
      return M.delete(v), x.delete(v), g.set(v, b), (!p[v] || p[v].inherits) && (f[v] = b), b;
    };
    for (const v of [...x.keys()]) k(v);
    const E = /* @__PURE__ */ new Map();
    for (const v of d) {
      if (v.prop.startsWith("--")) continue;
      const b = Lo(v.value, T);
      if (b === null) {
        for (const [z] of Fo(v.prop, "unset")) E.set(z, { value: "unset", source: v.source, origin: v.origin });
        continue;
      }
      for (const [z, D] of Fo(v.prop, b)) E.set(z, { value: D, source: v.source, origin: v.origin });
    }
    const y = {}, h = {}, _ = /* @__PURE__ */ new Set(), O = /* @__PURE__ */ new Set(), N = o?.values, j = { fontSize: N?.["font-size"] ?? Zo, viewport: this.viewport }, K = (v, b) => {
      if (/currentcolor/i.test(b)) return this.parseValue(v, b, j, y, N);
      const z = `${v}\0${b}\0${j.fontSize}`;
      let D = this.parsed.get(z);
      return D === void 0 && this.parsed.set(z, D = this.parseValue(v, b, j, y, N)), D;
    }, B = E.size ? [...Jo, ...[...E.keys()].filter((v) => !ig.has(v))] : Jo;
    for (const v of B) {
      const b = E.get(v);
      let z = b?.value;
      const D = lg.has(v);
      if ((z === void 0 || z === "unset" || z === "revert" || z === "revert-layer") && (z = D ? "inherit" : "initial"), b && (h[v] = b.source, b.origin !== 0 && _.add(v)), z === "inherit" && N && v in N) {
        y[v] = N[v], O.add(v);
        continue;
      }
      (z === "inherit" || z === "initial") && (z = D ? uf[v] : cf[v]), y[v] = K(v, z), v === "font-size" && (j.fontSize = y["font-size"]);
    }
    for (const v of ml) {
      const b = y[`border-${v}-style`];
      (b === "none" || b === "hidden") && (y[`border-${v}-width`] = { px: 0 });
    }
    y["outline-style"] === "none" && (y["outline-width"] = { px: 0 });
    const A = N?.display;
    return (A === "flex" || A === "inline-flex" || A === "grid" || A === "inline-grid") && y.position !== "absolute" && y.position !== "fixed" && (y.display = zd(y.display)), (y.position === "absolute" || y.position === "fixed") && (y.display = zd(y.display)), { values: y, sources: h, own: _, inherited: O, customs: f, rules: c, element: l };
  }
  parseValue(l, o, s, c, d) {
    const p = String(o).trim();
    switch (l) {
      case "font-size": {
        const f = p.toLowerCase(), g = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (g[f]) return g[f];
        if (f === "smaller") return s.fontSize / 1.2;
        if (f === "larger") return s.fontSize * 1.2;
        const x = Oa(f, { fontSize: s.fontSize, viewport: s.viewport });
        return !x || x.num ? s.fontSize : x.px + x.pct / 100 * s.fontSize;
      }
      case "font-weight": {
        const f = p.toLowerCase();
        if (f === "normal") return 400;
        if (f === "bold") return 700;
        if (f === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (f === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const g = parseFloat(f);
        return Number.isFinite(g) ? g : 400;
      }
      case "line-height": {
        const f = p.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const g = Oa(f, { fontSize: s.fontSize, viewport: s.viewport });
        return g ? g.unitless ? { factor: g.num } : { px: g.px + g.pct / 100 * s.fontSize } : { normal: !0 };
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
        const f = Ni(p, (g) => this.themeHex(g));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Ni(p, (g) => this.themeHex(g));
        return f === "currentcolor" ? c.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
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
        return Wo(p, s);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function zd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Ti = (n) => n && n.rgba ? { value: sg(n.rgba), token: n.token ?? null } : null, xg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function wg(n, l) {
  const o = l?.(n);
  if (Number.isFinite(o)) return o;
  const s = Math.round(n * 100) / 100;
  return xg[s] ?? Math.round(n * 1.2);
}
function Ci(n, l) {
  const o = n["line-height"], s = n["font-size"];
  return o.normal ? wg(s, l) : o.factor !== void 0 ? o.factor * s : o.px;
}
const _g = (n) => ne(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
//! The description: the host tree after a commit, as the engine draws it. Each element's computed style
//! (`css.mjs`) becomes engine styles in the vocabulary of the GPUI kit (`div()` with `.flex()`, `.px(8)`,
//! `.text_color(...)`, `.hover(|s| ...)`), keyed so the engine maps each key to one builder call; a key's value says
//! which (`display: "flex"` is `.flex()`, `pt: 4` is `.pt(px(4))`, `w: "100%"`, `line_height: 1.3` a multiplier,
//! `line_height: "15px"` absolute). Everything CSS says that the engine cannot draw is listed in `unsupported`, with
//! the class that asked for it and the element; nothing is dropped silently.
//!
//! Node shapes (`id` is the host element's, the one `dispatch`/`hover`/`perch.bounds` take):
//! - `{ kind: "div", id, style, hover?, focus?, active?, group?, group_hover?, track_hover?, tokens, events, meta,
//!   children }` (`group`: the hover group the element is, `track_hover` with it; `group_hover`:
//!   `[{ group, style, tokens? }]`, its styles while that ancestor group is under the pointer)
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
const Sg = "perch-native-description/1", On = Symbol("display"), ji = {
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
}, kg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of kg) ji[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ji.rounded = 0;
const zg = /* @__PURE__ */ new Set([
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
]), Eg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Ng = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Tg = (n) => Ng.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : Eg.test(n) ? ".SystemUIFont" : _g(n).split(",")[0].trim(), Cg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, Ed = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, df = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((c) => !c.includes(":") && !c.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const s = n.parentElement;
  return s && s.tagName !== "body" ? `${df(s)} > ${n.tagName}` : n.tagName;
};
class jg {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, o, s, c, d, p = "") {
    const f = `${l}|${o}|${s}|${c}`, g = this.map.get(f);
    if (g) {
      !g.elements.includes(d) && g.elements.length < 4 && g.elements.push(d), g.count++;
      return;
    }
    this.map.set(f, { kind: l, property: o, value: String(s), class: c ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
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
}, Mg = /^(text|search|url|email|tel|password|number)$/, Ag = 162.13 / 12.8;
function Og(n, l) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const s = ne(o[1], ",").map((c) => Oa(c.trim(), { fontSize: l })).filter((c) => c && !c.pct && !c.num).map((c) => c.px);
  return s.length ? Math.min(...s) : void 0;
}
function Rg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = Oa(n.expr, { fontSize: l["font-size"] }), s = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + s) < 0.01;
}
function ff(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const s = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), c = s && ne(s[2], ",").map((d) => d.trim());
    return !c || c.length > (s[1] ? 1 : 2) ? null : s[1] === "X" ? [c[0], "0"] : s[1] === "Y" ? ["0", c[0]] : [c[0], c[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const s = ne(String(o).trim(), " ").filter(Boolean);
    return s.length > 3 || s[2] !== void 0 && Oa(s[2], {})?.px ? null : [s[0], s[1] ?? "0"];
  }
  return [];
}
function Nd(n, l, o, s = !1) {
  const c = n.values, d = ff(c);
  if (d?.length === 0) return;
  const p = c.transform && c.transform !== "none" ? "transform" : "translate", f = { fontSize: c["font-size"] }, g = (M, k) => {
    const E = Oa(M, f);
    if (!(!E || E.unitless && E.num))
      return E.pct ? typeof k == "number" ? E.px + E.pct / 100 * k : void 0 : E.px;
  }, x = d ? g(d[0], l.w) : void 0, T = d ? g(d[1], l.h) : void 0;
  if (x === void 0 || T === void 0) {
    const M = !s && d ? d.map((k) => Oa(k, f)) : null;
    if (M?.every((k) => k && !(k.unitless && k.num))) {
      l[mf] = M.map((k) => [k.px, k.pct ?? 0]);
      return;
    }
    o("unsupported", p, c[p], n.sources[p]);
    return;
  }
  if (s) {
    x && (l.left = x), T && (l.top = T);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), T && (l.mt = (l.mt ?? 0) + T);
}
const mf = Symbol("perch.shift");
function Hg(n, l, o) {
  const s = n.ownerDocument, c = s?.measure?.(n) ?? null;
  if (c) {
    const [[p, f], [g, x]] = o, T = p + f / 100 * c.width, M = g + x / 100 * c.height;
    T && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + T), M && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + M);
  }
  const d = c ? `${c.width}x${c.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < ef && s?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, s.retries.push(() => s.afterCommit?.()));
}
function Oo(n, l, o = null) {
  const s = n.values, c = {}, d = (N) => n.sources[N], p = (N) => n.sources[N] !== void 0, f = s.display;
  f === "none" ? c.display = "hidden" : f === "flex" || f === "inline-flex" ? c.display = "flex" : (f === "grid" || f === "inline-grid") && (c.display = "flex", c.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", s["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (c.display = "hidden");
  const g = c.display === "flex";
  if (g && c.flex_direction !== "col") {
    const N = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    c.flex_direction = N;
  }
  if (g) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (c.flex_wrap = "wrap");
    const N = f === "grid" || f === "inline-grid", j = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    j && (c.items = j);
    let K = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (N) {
      const v = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      v && (c.items = v), s["align-items"] === "center" && (K = "center");
    }
    K && (c.justify = K);
    const B = ua(s["row-gap"]), A = ua(s["column-gap"]);
    typeof B == "number" && B && (c.gap_y = B), typeof A == "number" && A && !N && (c.gap_x = A);
  }
  s["flex-grow"] && (c.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (c.flex_shrink = s["flex-shrink"]);
  const x = ua(s["flex-basis"]);
  x !== void 0 && x !== "auto" && (c.flex_basis = x);
  const T = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  T && (c.self = T);
  for (const [N, j] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const K = s[j], B = ua(K);
    if (B === void 0 && j === "width" && Rg(K, s)) {
      c.self = "stretch", l("approximated", j, K.expr, d(j), "stretched across its parent, inside its margins");
      continue;
    }
    const A = B === void 0 && /^max-/.test(j) ? Og(K, s["font-size"]) : void 0;
    if (A !== void 0) {
      c[N] = A, l("approximated", j, K.expr, d(j), "the fixed bound of min()");
      continue;
    }
    if (B === void 0) {
      typeof K == "object" && K.expr ? l("unsupported", j, K.expr, d(j), "no calc() in the engine") : typeof K == "string" && !["auto", "none"].includes(K) && l("unsupported", j, K, d(j));
      continue;
    }
    B !== "auto" && (c[N] = B);
  }
  const M = ["top", "right", "bottom", "left"];
  for (const N of M) {
    const j = N[0];
    for (const [K, B] of [["p", "padding"], ["m", "margin"]]) {
      const A = s[`${B}-${N}`], v = ua(A);
      if (v === void 0) {
        A?.expr && l("unsupported", `${B}-${N}`, A.expr, d(`${B}-${N}`), "no calc() in the engine");
        continue;
      }
      v !== 0 && (c[`${K}${j}`] = v);
    }
  }
  const k = s.position;
  if (k === "absolute" || k === "fixed") {
    c.position = "absolute", k === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const N of M) {
      const j = ua(s[N]);
      j !== void 0 && j !== "auto" && (c[N] = j);
    }
    if (k === "fixed" && o && c.w === void 0 && c.right === void 0 && typeof c.left == "number") {
      const N = o.width - c.left - (typeof c.ml == "number" ? c.ml : 0) - (typeof c.mr == "number" ? c.mr : 0);
      c.max_w = typeof c.max_w == "number" ? Math.min(c.max_w, N) : N;
    }
    Nd(n, c, l);
  } else k === "sticky" ? l("unsupported", "position", "sticky", d("position")) : ff(s)?.length !== 0 && (c.position = "relative", Nd(n, c, l, !0));
  s["z-index"] !== "auto" && p("z-index") && l("unsupported", "z-index", s["z-index"], d("z-index"), "paint order is tree order");
  for (const [N, j] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const K = s[j];
    K === "hidden" || K === "clip" ? c[N] = "hidden" : (K === "auto" || K === "scroll") && (c[N] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (c.visibility = "invisible");
  const E = s["background-color"];
  E?.unreadable ? l("unsupported", "background-color", E.unreadable, d("background-color")) : E?.rgba && E.rgba[3] > 0 && (c.bg = Ti(E)), s["background-image"] && s["background-image"] !== "none" && l("unsupported", "background-image", s["background-image"], d("background-image"));
  const y = M.map((N) => ua(s[`border-${N}-width`]) || 0), h = [];
  M.forEach((N, j) => {
    if (!y[j]) return;
    c[`border_${N[0]}`] = y[j];
    const K = s[`border-${N}-style`];
    K !== "solid" && l("approximated", `border-${N}-style`, K, d(`border-${N}-style`), "drawn solid");
    const B = Ti(s[`border-${N}-color`]);
    B && h.push(B);
  }), h.length && (c.border_color = h[0], h.some((N) => N.value !== h[0].value) && l("approximated", "border-color", h.map((N) => N.value).join(" "), d("border-top-color"), "one border colour"));
  const _ = ["top-left", "top-right", "bottom-right", "bottom-left"].map((N) => ua(s[`border-${N}-radius`]) || 0);
  _.every((N) => N === _[0]) ? _[0] && (c.rounded = _[0]) : ["tl", "tr", "br", "bl"].forEach((N, j) => {
    _[j] && (c[`rounded_${N}`] = _[j]);
  }), s.opacity !== 1 && (c.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const O = s["box-shadow"];
  if (O && O !== "none" && ne(O, ",").some((N) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(N.trim())) && (c.shadow = "lg", l("approximated", "box-shadow", O, d("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !n.inherited.has("cursor")) {
    const N = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    N ? c.cursor = N : l("unsupported", "cursor", s.cursor, d("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (c.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? c.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", s["text-decoration-line"], d("text-decoration-line")), c;
}
const Dg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function pf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((o) => Dg[o]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Ro(n, l) {
  const o = n.values, s = o["line-height"];
  return {
    text_color: Ti(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: pf(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(Ci(o, l) * 1e3) / 1e3 },
    font_family: Tg(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const Td = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, hf = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function Ho(n, l, o) {
  const s = {}, c = (f, g) => g.some((x) => !n.inherited.has(x));
  for (const [f, g] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (c(f, g) || !hf(l[f], o[f])) && (s[f] = l[f]);
  const d = Td(l.line_height, l.text_size), p = o.line_height ? Td(o.line_height, l.text_size) : NaN;
  return (c("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (s.line_height = l.line_height), s;
}
const Ug = (n, l) => ({ ...n, ...l });
function Do(n, l) {
  const o = {};
  for (const [s, c] of Object.entries(n))
    c && typeof c == "object" && "value" in c ? (o[s] = c.value, c.token && (l[s] = c.token)) : s === "line_height" ? o[s] = c.factor !== void 0 ? Math.round(c.factor * 1e3) / 1e3 : `${c.px}px` : s === "italic" ? c && (o.italic = !0) : o[s] = c;
  return o.italic === !1 && delete o.italic, o;
}
function Cd(n, l) {
  const o = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const c = n[s], d = l[s];
    hf(c, d) || (o[s] = d === void 0 ? s in ji ? ji[s] : null : d);
  }
  return o;
}
function jd(n, l) {
  const o = n.values;
  for (const [s, c] of Object.entries(n.sources)) {
    if (s.startsWith("--") || zg.has(s) || c.startsWith("ua:")) continue;
    const d = o[s];
    switch (s) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", s, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, c, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && pf(d) === null && l("unsupported", s, d, c);
        break;
      case "text-transform":
        d !== "none" && l("approximated", s, d, c, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        s === "transition-property" && p && ne(p, ",").some((f) => parseFloat(f) > 0) && o["transition-property"] !== "none" && l("unsupported", "transition", `${o["transition-property"]} ${p}`, c, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && l("unsupported", s, d, c, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        s === "overflow-wrap" && d !== "normal" && l("approximated", s, d, c, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && s === "outline-style" && l("unsupported", "outline", `${ua(o["outline-width"])}px ${o["outline-style"]} ${Ti(o["outline-color"])?.value ?? ""}`.trim(), c, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && l("unsupported", s, d, c);
        break;
    }
  }
}
function Bg(n, l, o, s) {
  const c = df(n), d = [], p = (O, N, j, K, B) => d.push([O, N, j, K ?? "(user agent)", c, B]), f = s.cascade.compute(n, l), g = {}, x = Oo(f, p, s.viewport), T = x[mf];
  jd(f, p);
  const M = Ro(f, s.measure), k = Ho(f, M, o), E = Do({ ...x, ...k }, g), y = {}, h = s.cascade.matching(n, "*").filter((O) => O.states.subject.size);
  for (const [O, N] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!h.some((v) => N.some((b) => v.states.subject.has(b)))) continue;
    const j = s.cascade.compute(n, l, new Set(N)), K = {}, B = Do({ ...Oo(j, () => {
    }), ...Ho(j, Ro(j, s.measure), o) }, K);
    O === "focus" && jd(j, p);
    const A = Cd(E, B);
    if (Object.keys(A).length) {
      y[O] = A;
      const v = Object.fromEntries(Object.entries(K).filter(([b]) => b in A));
      Object.keys(v).length && (y[`${O}_tokens`] = v);
    }
  }
  if (s.cascade.sheet.tracks(n, "hover") && (y.group = Md(n), y.track_hover = !0), s.cascade.sheet.readsAncestor(n, "hover"))
    for (let O = n.parentNode; O?.state; O = O.parentNode) {
      if (!s.cascade.sheet.tracks(O, "hover")) continue;
      const N = O.state.hover;
      O.state.hover = !0;
      let j;
      try {
        j = s.cascade.compute(n, l);
      } finally {
        O.state.hover = N;
      }
      const K = {}, B = Do({ ...Oo(j, () => {
      }), ...Ho(j, Ro(j, s.measure), o) }, K), A = Cd(E, B);
      if (!Object.keys(A).length) continue;
      const v = Object.fromEntries(Object.entries(K).filter(([b]) => b in A));
      (y.group_hover ??= []).push({ group: Md(O), style: A, ...Object.keys(v).length ? { tokens: v } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (y.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (y.break_anywhere = !0), x.overflow_y === "scroll") {
    const O = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (y.scrollbar = O);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (y.blocks_pointer = !0);
  const _ = Object.entries(Cg).filter(([, O]) => O.some((N) => typeof n.props[N] == "function")).map(([O]) => O);
  return !_.includes("click") && Vo(n) && _.push("click"), _.length && (y.events = _), { computed: f, style: E, tokens: g, extra: y, meta: Kg(n), reports: d, childText: Ug(o, k), where: c, shift: T };
}
const Md = (n) => `~g${n.id}`;
function gf(n, l, o, s, c = "") {
  const d = `${c}/${n.id}.${n.version}`;
  let p = s.cache.get(n);
  (!p || p.key !== d) && s.cache.set(n, p = { key: d, part: Bg(n, l, o, s) });
  const { computed: f, tokens: g, extra: x, reports: T, childText: M, where: k } = p.part;
  for (const b of T) s.findings.add(...b);
  const E = (b, z, D, V, L) => s.findings.add(b, z, D, V, k, L), y = { ...p.part.style };
  p.part.shift && Hg(n, y, p.part.shift);
  const h = { kind: "div", id: n.id, style: y, tokens: g, meta: p.part.meta, ...x };
  Object.defineProperty(h, On, { value: f.values.display }), n.measured && n.ownerDocument?.measureKey && (h.measure = n.ownerDocument.measureKey(n));
  const _ = n.tagName;
  if (_ === "svg")
    return h.kind = n.props["data-perch-image"] ? "image" : "svg", h.markup = Vg(n), h;
  if (_ === "input" || _ === "textarea" || _ === "select") {
    h.kind = "input", h.input_type = _ === "input" ? String(n.props.type ?? "text") : _;
    for (const b of ["placeholder", "checked", "disabled"]) n.props[b] !== void 0 && (h[b] = n.props[b]);
    if (/^(checkbox|radio)$/.test(h.input_type) && (h.checked = n.checked), _ !== "select" && (h.value = n.value), _ === "input" && Mg.test(h.input_type) && (h.field_w = Ag * f.values["font-size"]), _ === "textarea" && y.h === void 0) {
      const b = f.values, z = (L) => L && typeof L == "object" && "px" in L ? L.px : 0, D = (L) => b[`border-${L}-style`] === "none" ? 0 : z(b[`border-${L}-width`]), V = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      y.h = V * Ci(b, s.measure) + z(b["padding-top"]) + z(b["padding-bottom"]) + D("top") + D("bottom");
    }
    return h;
  }
  if (_ === "img") {
    h.kind = "image", h.src = n.props.src ?? null;
    for (const [b, z] of [["width", "w"], ["height", "h"]]) {
      const D = Number(n.props[b]);
      y[z] === void 0 && n.props[b] != null && Number.isFinite(D) && (y[z] = D);
    }
    return h;
  }
  const O = f.values["text-transform"], N = [];
  let j = !1, K = !1;
  for (const b of n.childNodes) {
    if (b instanceof Bi) {
      if (b.hidden || b.data === "") continue;
      j = !0;
      const V = N[N.length - 1];
      if (V?.kind === "text")
        V.source = (V.source ?? V.text) + b.data, V.text = Ad(V.source, O), V.text === V.source && delete V.source;
      else {
        const L = Ad(b.data, O);
        N.push(L === b.data ? { kind: "text", text: L } : { kind: "text", text: L, source: b.data });
      }
      continue;
    }
    if (!(b instanceof It)) continue;
    const z = gf(b, f, M, s, d), D = z[On];
    D === "inline" || D === "inline-block" || D === "inline-flex" ? j = !0 : D !== "none" && (K = !0), N.push(z);
  }
  const B = N.some((b) => b.kind !== "text"), A = N.length === 1 && N[0].kind !== "text" && /^inline-(block|flex)$/.test(N[0][On]) ? N[0] : null;
  if (!y.display && A) {
    const b = s.cache.get(n.childNodes.find((D) => D.id === A.id))?.part.computed, z = b ? Ai(f.values, s.measure) - Gg(b.values, s.measure, A) : 0;
    y.display = "flex", y.flex_direction = "col", y.items = "start", z > 0 && (A.style.mt = Math.round(((A.style.mt ?? 0) + z) * 100) / 100), E("approximated", "display", `${f.values.display} holding one ${A[On]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!y.display && N.length === 1 && (N[0].kind === "svg" || N[0].kind === "image") && N[0][On] === "inline" && typeof N[0].style.h == "number") {
    const b = N[0], z = Ai(f.values, s.measure), D = Ci(f.values, s.measure) - z, V = (L) => Math.round(L * 100) / 100;
    y.display = "flex", y.flex_direction = "col", y.items = "start", z > b.style.h && (b.style.mt = V((b.style.mt ?? 0) + z - b.style.h)), D > 0 && (b.style.mb = V((b.style.mb ?? 0) + D)), E("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!y.display && j && B) {
    if (y.display = "flex", y.flex_direction = K ? "col" : "row", !K) y.items = "baseline";
    else for (const b of N) b.kind !== "text" && /^inline-(block|flex)$/.test(b[On]) && !b.style.self && (b.style.self = "start");
    E("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", K ? "a column of its children" : "a row on the text baseline");
  }
  const v = f.values["letter-spacing"]?.px;
  if (v)
    for (let b = 0; b < N.length; b++) {
      const z = N[b];
      if (z.kind !== "text") continue;
      const D = Math.round(v * [...z.text].length * 1e3) / 1e3;
      N[b] = { kind: "div", style: { pr: D }, tokens: {}, children: [z] };
    }
  return h.children = N, h;
}
function qg(n, l) {
  if (!l) return null;
  let s = (l.self ? n : l.closest ? Pd(n, l.closest) : l.find ? pl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return s && l.strip && s.startsWith(l.strip) && (s = s.slice(l.strip.length)), s;
}
function Yg(n, l, o) {
  const s = l.map((p) => [p, Ui(p.selector)]), c = /* @__PURE__ */ new Map(), d = (p) => {
    for (const f of p.children) {
      const g = o.get(f.id);
      if (g)
        for (const [x, T] of s) {
          const M = x.textRange ? "range_name" : "name";
          if (x.textRange && g[M] != null || !T.some((h) => $d(f, h))) continue;
          const k = qg(f, x.key), E = k == null ? c.get(x.name) ?? 0 : 0;
          k == null && c.set(x.name, E + 1);
          const y = k != null ? `${x.name}:${k}` : E ? `${x.name}@${E}` : x.name;
          g[M] == null ? g[M] = y : (g.also ??= []).push(y);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Mi = 0.9521, bf = 0.2256, Ai = (n, l) => (Ci(n, l) - (Mi + bf) * n["font-size"]) / 2 + Mi * n["font-size"];
function Gg(n, l, o) {
  const s = (g) => g && typeof g == "object" && "px" in g ? g.px : 0, c = n["border-top-style"] === "none" ? 0 : s(n["border-top-width"]), d = o?.children ?? [], p = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = p ? Math.max(Ai(n, l), (p.style.mt ?? 0) + p.style.h) : Ai(n, l);
  return s(n["padding-top"]) + c + f;
}
const Ad = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, vf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Kg(n) {
  const l = {};
  for (const [o, s] of Object.entries(n.props)) {
    if (vf.has(o) || typeof s == "function" || s === void 0 || s === null || typeof s == "object") continue;
    const c = o.startsWith("aria-") || o.startsWith("data-");
    if (s === !1 && !c) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    l[d] = typeof s == "boolean" ? c ? String(s) : "" : String(s);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const Qg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Od = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Vg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (o) => {
    const s = [];
    for (const [d, p] of Object.entries(o.props))
      vf.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || s.push(`${Qg(d)}="${Od(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const c = o.childNodes.map((d) => d instanceof Bi ? Od(d.data) : l(d)).join("");
    return `<${o.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${c}</${o.tagName}>`;
  };
  return l(n);
}
function Xg(n) {
  const l = n.theme?.() ?? {}, o = {};
  for (const s of of) l[s] && (o[s] = l[s]);
  return o;
}
const Zg = { font_features: "" };
function Jg(n, l, o, s = {}, c = null) {
  const d = Xg(l), p = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, p]);
  (s.look !== f || s.sheet !== o) && Object.assign(s, { look: f, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new yg(o, { theme: d, viewport: p }), top: null });
  const { cascade: g, cache: x } = s, T = { cascade: g, cache: x, viewport: p, findings: new jg(), measure: l.lineHeight ? (E) => l.lineHeight(E) : null };
  s.top ??= g.compute(n.body, g.compute(n.documentElement, null));
  const M = n.body.children.map((E) => gf(E, s.top, Zg, T));
  if (c?.length) {
    const E = /* @__PURE__ */ new Map(), y = (h) => {
      h.id && E.set(h.id, h);
      for (const _ of h.children ?? []) y(_);
    };
    M.forEach(y), Yg(n, c, E);
  }
  const k = /* @__PURE__ */ new Set();
  for (const E of [n, n.defaultView])
    for (const { type: y } of E?.listeners ?? []) Ed[y] && k.add(Ed[y]);
  return { schema: Sg, root: M[0] ?? null, overlays: M.slice(1), document_events: [...k].sort(), unsupported: T.findings.list() };
}
const Lg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[2\\.35rem\\]", null, 4, [["padding-left", "2.35rem"]]], [".pl-\\[2\\.45rem\\]", null, 4, [["padding-left", "2.45rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Wg = null;
const Fg = () => Wg ??= new pg(Lg);
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
function Ig(n, l) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const s of o) {
    if (s === "children") continue;
    const c = n[s], d = l[s];
    if (!(c === d || typeof c == "function" && typeof d == "function") && !(s === "style" && c && d && typeof c == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(c), ...Object.keys(d)])].every((f) => c[f] === d[f])))
      return !0;
  }
  return !1;
}
const $g = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Rd(n, l) {
  for (const o of Ah(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const Pg = {
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
  createInstance: (n, l, o) => Rd(new It(n, l, o.ownerDocument), l),
  createTextInstance: (n, l) => new Bi(n),
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
  commitUpdate: (n, l, o, s) => {
    if (n.props = s, n.inline) for (const c of Object.keys(n.inline)) o.style?.[c] !== s.style?.[c] && delete n.inline[c];
    if (o.dangerouslySetInnerHTML?.__html !== s.dangerouslySetInnerHTML?.__html) {
      for (const c of [...n.childNodes]) n.removeChild(c);
      Rd(n, s);
    }
    Ig(o, s) && n.touch();
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
}, Se = tg(Pg), qi = (n, l, o = null) => Se.createPortal(n, l, null, o), t0 = {
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
}, e0 = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), a0 = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), n0 = (n) => {
  for (let l = n; l instanceof It; l = l.parentNode) if (l.props.disabled && a0.has(l.tagName)) return !0;
  return !1;
};
class l0 {
  constructor(l, o, s) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, o), this.type = l, this.target = s, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
  for (const { type: s, listener: c, capture: d } of [...n.listeners ?? []])
    s === l.type && d === o && c.call(n, l);
  if (n instanceof It) {
    const s = t0[l.type], c = s && n.props[o ? `${s}Capture` : s];
    typeof c == "function" && c(l);
  }
}
function ty(n, l, o = {}) {
  const { document: s, window: c, globals: d } = Uh(n), p = new It("div", { id: "root", style: o.container ?? {} }, s);
  s.body.appendChild(p);
  const f = [];
  let g = null;
  const x = () => [s, c].map((A) => A.listeners.map((v) => `${v.type}:${v.capture}`).sort().join(",")).join("|");
  let T = "";
  const M = {}, k = `m${Math.random().toString(36).slice(2, 10)}:`;
  let E = 0, y = -1;
  s.measureKey = (A) => k + A.id, s.stale = () => y !== E, s.computed = (A) => {
    if (!M.cascade || !M.top) return null;
    const v = [];
    for (let z = A; z instanceof It && z !== s.body; z = z.parentNode) v.unshift(z);
    let b = M.top;
    for (const z of v) b = M.cascade.compute(z, b);
    return b.values;
  };
  const h = () => (E += 1, g = Jg(s, n, Fg(), M, o.names), T = x(), n.render?.(g), g), _ = () => {
    Se.flushPassiveEffects(), Se.flushSyncWork(), x() !== T && h();
  };
  s.afterCommit = h;
  const O = (A) => {
    f.push(A), n.error?.(A);
  }, N = Se.createContainer(p, hl.ConcurrentRoot, null, !1, null, "", O, O, O, null);
  Se.updateContainerSync(pt.createElement(l, o.props ?? {}), N, null, null), Se.flushSyncWork(), _();
  const j = (A) => {
    const v = (b) => {
      if (b.id === A) return b;
      for (const z of b.children) {
        const D = v(z);
        if (D) return D;
      }
      return null;
    };
    return v(s.documentElement);
  }, K = (A) => {
    const v = en;
    en = hl.DiscreteEventPriority;
    try {
      return A();
    } finally {
      en = v, Se.flushSyncWork(), _();
    }
  }, B = {
    document: s,
    window: c,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: p,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return g;
    },
    describe: h,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(A, v, b = {}) {
      const z = typeof A == "string" ? j(A) : A;
      if (!z || e0.has(v) && n0(z)) return !1;
      const D = new l0(v, b, z), V = [];
      for (let ht = z; ht; ht = ht.parentNode) V.push(ht);
      const L = [...V, s, c];
      K(() => {
        for (let ht = L.length - 1; ht > 0 && !D.propagationStopped; ht--) yi(L[ht], D, !0);
        D.propagationStopped || (yi(z, D, !0), D.propagationStopped || yi(z, D, !1));
        for (let ht = 1; ht < L.length && !D.propagationStopped; ht++) yi(L[ht], D, !1);
      });
      const ct = v === "click" && !D.defaultPrevented ? Vo(z) : null;
      return ct && B.dispatch(ct, "submit", {}), !D.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(A) {
      const v = s.activeElement && s.activeElement !== s.body ? s.activeElement : s.body;
      if (!B.dispatch(v, "keydown", A)) return !0;
      const z = A.key === "Enter" && !A.isComposing ? Vo(v, !0) : null;
      if (z)
        return B.dispatch(z, "submit", {}), !0;
      if (!lf(v) || v.props.disabled || v.props.readOnly) return !1;
      if ((A.ctrlKey || A.metaKey) && !A.altKey && !A.shiftKey && A.key.toLowerCase() === "a")
        return v.selectedAll = !0, !0;
      if (A.ctrlKey || A.metaKey) return !1;
      const D = v.selectedAll;
      v.selectedAll = !1;
      const V = v.value, ct = A.key === "Backspace" || D && A.key === "Delete" ? D ? "" : V.slice(0, -1) : [...A.key].length === 1 ? (D ? "" : V) + A.key : V;
      return ct === V ? !1 : (v.value = ct, B.dispatch(v, "input", { data: A.key }), B.dispatch(v, "change", {}), v.props.value !== void 0 && delete v.edit, v.touch(), h(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(A, v) {
      const b = j(A);
      b && (b.bounds = { x: v.x, y: v.y, width: v.width, height: v.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(A) {
      const v = j(A);
      if (!v || v.props.disabled || !B.dispatch(A, "click", { button: 0, detail: 1 })) return;
      const b = v.props.type === "radio";
      b && v.checked || (v.checked = b ? !0 : !v.checked, B.dispatch(A, "input", {}), B.dispatch(A, "change", {}), v.props.checked !== void 0 && delete v.ticked, v.touch(), h());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(A, v = {}) {
      const b = { button: 0, buttons: 1, pointerType: "mouse", ...v };
      for (const z of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) B.dispatch(A, z, b);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (A) => !!j(A)?.state.hover,
    hover(A, v) {
      const b = j(A);
      !b || b.state.hover === v || (b.state.hover = v, b.touch(), h());
    },
    focus(A) {
      const v = j(A);
      v && (K(() => {
        const b = s.activeElement;
        b && b !== v && b !== s.body && B.dispatch(b, "blur"), s.focus(v), B.dispatch(v, "focus");
      }), h());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(A) {
      let b = typeof A == "string" ? j(A) : A;
      for (; b && !(b instanceof It && typeof b.props.onKeyDown == "function" && $g(b)); ) b = b.parentNode;
      !b || b === s.activeElement || (B.focus(b.id), b.state.pointerFocus = !0, b.touch(), h());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return y = E, s.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const A = s.retries.splice(0);
      for (const v of A) v();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: _,
    update(A) {
      Se.updateContainerSync(pt.createElement(l, A ?? {}), N, null, null), Se.flushSyncWork(), _();
    },
    unmount() {
      Se.updateContainerSync(null, N, null, null), Se.flushSyncWork(), Se.flushPassiveEffects(), s.afterCommit = null, s.retries.length = 0, n.forgetBounds?.(k);
    }
  };
  return B;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const yf = (n) => Se.flushSyncFromReconciler(n), i0 = { createPortal: qi, flushSync: yf }, ey = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: qi,
  default: i0,
  flushSync: yf
}, Symbol.toStringTag, { value: "Module" }));
function xf(n) {
  var l, o, s = "";
  if (typeof n == "string" || typeof n == "number") s += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var c = n.length;
    for (l = 0; l < c; l++) n[l] && (o = xf(n[l])) && (s && (s += " "), s += o);
  } else for (o in n) n[o] && (s && (s += " "), s += o);
  return s;
}
function wf() {
  for (var n, l, o = 0, s = "", c = arguments.length; o < c; o++) (n = arguments[o]) && (l = xf(n)) && (s && (s += " "), s += l);
  return s;
}
const r0 = (n, l) => {
  const o = new Array(n.length + l.length);
  for (let s = 0; s < n.length; s++)
    o[s] = n[s];
  for (let s = 0; s < l.length; s++)
    o[n.length + s] = l[s];
  return o;
}, o0 = (n, l) => ({
  classGroupId: n,
  validator: l
}), _f = (n = /* @__PURE__ */ new Map(), l = null, o) => ({
  nextPart: n,
  validators: l,
  classGroupId: o
}), Oi = "-", Hd = [], s0 = "arbitrary..", c0 = (n) => {
  const l = d0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: s
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return u0(p);
      const f = p.split(Oi), g = f[0] === "" && f.length > 1 ? 1 : 0;
      return Sf(f, g, l);
    },
    getConflictingClassGroupIds: (p, f) => {
      if (f) {
        const g = s[p], x = o[p];
        return g ? x ? r0(x, g) : g : x || Hd;
      }
      return o[p] || Hd;
    }
  };
}, Sf = (n, l, o) => {
  if (n.length - l === 0)
    return o.classGroupId;
  const c = n[l], d = o.nextPart.get(c);
  if (d) {
    const x = Sf(n, l + 1, d);
    if (x) return x;
  }
  const p = o.validators;
  if (p === null)
    return;
  const f = l === 0 ? n.join(Oi) : n.slice(l).join(Oi), g = p.length;
  for (let x = 0; x < g; x++) {
    const T = p[x];
    if (T.validator(f))
      return T.classGroupId;
  }
}, u0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), o = l.indexOf(":"), s = l.slice(0, o);
  return s ? s0 + s : void 0;
})(), d0 = (n) => {
  const {
    theme: l,
    classGroups: o
  } = n;
  return f0(o, l);
}, f0 = (n, l) => {
  const o = _f();
  for (const s in n) {
    const c = n[s];
    ss(c, o, s, l);
  }
  return o;
}, ss = (n, l, o, s) => {
  const c = n.length;
  for (let d = 0; d < c; d++) {
    const p = n[d];
    m0(p, l, o, s);
  }
}, m0 = (n, l, o, s) => {
  if (typeof n == "string") {
    p0(n, l, o);
    return;
  }
  if (typeof n == "function") {
    h0(n, l, o, s);
    return;
  }
  g0(n, l, o, s);
}, p0 = (n, l, o) => {
  const s = n === "" ? l : kf(l, n);
  s.classGroupId = o;
}, h0 = (n, l, o, s) => {
  if (b0(n)) {
    ss(n(s), l, o, s);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(o0(o, n));
}, g0 = (n, l, o, s) => {
  const c = Object.entries(n), d = c.length;
  for (let p = 0; p < d; p++) {
    const [f, g] = c[p];
    ss(g, kf(l, f), o, s);
  }
}, kf = (n, l) => {
  let o = n;
  const s = l.split(Oi), c = s.length;
  for (let d = 0; d < c; d++) {
    const p = s[d];
    let f = o.nextPart.get(p);
    f || (f = _f(), o.nextPart.set(p, f)), o = f;
  }
  return o;
}, b0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, v0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, o = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const c = (d, p) => {
    o[d] = p, l++, l > n && (l = 0, s = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let p = o[d];
      if (p !== void 0)
        return p;
      if ((p = s[d]) !== void 0)
        return c(d, p), p;
    },
    set(d, p) {
      d in o ? o[d] = p : c(d, p);
    }
  };
}, Io = "!", Dd = ":", y0 = [], Ud = (n, l, o, s, c) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: o,
  maybePostfixModifierPosition: s,
  isExternal: c
}), x0 = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: o
  } = n;
  let s = (c) => {
    const d = [];
    let p = 0, f = 0, g = 0, x;
    const T = c.length;
    for (let h = 0; h < T; h++) {
      const _ = c[h];
      if (p === 0 && f === 0) {
        if (_ === Dd) {
          d.push(c.slice(g, h)), g = h + 1;
          continue;
        }
        if (_ === "/") {
          x = h;
          continue;
        }
      }
      _ === "[" ? p++ : _ === "]" ? p-- : _ === "(" ? f++ : _ === ")" && f--;
    }
    const M = d.length === 0 ? c : c.slice(g);
    let k = M, E = !1;
    M.endsWith(Io) ? (k = M.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      M.startsWith(Io) && (k = M.slice(1), E = !0)
    );
    const y = x && x > g ? x - g : void 0;
    return Ud(d, E, k, y);
  };
  if (l) {
    const c = l + Dd, d = s;
    s = (p) => p.startsWith(c) ? d(p.slice(c.length)) : Ud(y0, !1, p, void 0, !0);
  }
  if (o) {
    const c = s;
    s = (d) => o({
      className: d,
      parseClassName: c
    });
  }
  return s;
}, w0 = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, s) => {
    l.set(o, 1e6 + s);
  }), (o) => {
    const s = [];
    let c = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], f = p[0] === "[", g = l.has(p);
      f || g ? (c.length > 0 && (c.sort(), s.push(...c), c = []), s.push(p)) : c.push(p);
    }
    return c.length > 0 && (c.sort(), s.push(...c)), s;
  };
}, _0 = (n) => ({
  cache: v0(n.cacheSize),
  parseClassName: x0(n),
  sortModifiers: w0(n),
  postfixLookupClassGroupIds: S0(n),
  ...c0(n)
}), S0 = (n) => {
  const l = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let s = 0; s < o.length; s++)
      l[o[s]] = !0;
  return l;
}, k0 = /\s+/, z0 = (n, l) => {
  const {
    parseClassName: o,
    getClassGroupId: s,
    getConflictingClassGroupIds: c,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = l, f = [], g = n.trim().split(k0);
  let x = "";
  for (let T = g.length - 1; T >= 0; T -= 1) {
    const M = g[T], {
      isExternal: k,
      modifiers: E,
      hasImportantModifier: y,
      baseClassName: h,
      maybePostfixModifierPosition: _
    } = o(M);
    if (k) {
      x = M + (x.length > 0 ? " " + x : x);
      continue;
    }
    let O = !!_, N;
    if (O) {
      const v = h.substring(0, _);
      N = s(v);
      const b = N && p[N] ? s(h) : void 0;
      b && b !== N && (N = b, O = !1);
    } else
      N = s(h);
    if (!N) {
      if (!O) {
        x = M + (x.length > 0 ? " " + x : x);
        continue;
      }
      if (N = s(h), !N) {
        x = M + (x.length > 0 ? " " + x : x);
        continue;
      }
      O = !1;
    }
    const j = E.length === 0 ? "" : E.length === 1 ? E[0] : d(E).join(":"), K = y ? j + Io : j, B = K + N;
    if (f.indexOf(B) > -1)
      continue;
    f.push(B);
    const A = c(N, O);
    for (let v = 0; v < A.length; ++v) {
      const b = A[v];
      f.push(K + b);
    }
    x = M + (x.length > 0 ? " " + x : x);
  }
  return x;
}, E0 = (...n) => {
  let l = 0, o, s, c = "";
  for (; l < n.length; )
    (o = n[l++]) && (s = zf(o)) && (c && (c += " "), c += s);
  return c;
}, zf = (n) => {
  if (typeof n == "string")
    return n;
  let l, o = "";
  for (let s = 0; s < n.length; s++)
    n[s] && (l = zf(n[s])) && (o && (o += " "), o += l);
  return o;
}, N0 = (n, ...l) => {
  let o, s, c, d;
  const p = (g) => {
    const x = l.reduce((T, M) => M(T), n());
    return o = _0(x), s = o.cache.get, c = o.cache.set, d = f, f(g);
  }, f = (g) => {
    const x = s(g);
    if (x)
      return x;
    const T = z0(g, o);
    return c(g, T), T;
  };
  return d = p, (...g) => d(E0(...g));
}, T0 = [], Zt = (n) => {
  const l = (o) => o[n] || T0;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Ef = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Nf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, C0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, j0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, M0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, A0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, O0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, R0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, ja = (n) => C0.test(n), bt = (n) => !!n && !Number.isNaN(Number(n)), Je = (n) => !!n && Number.isInteger(Number(n)), Uo = (n) => n.endsWith("%") && bt(n.slice(0, -1)), ca = (n) => j0.test(n), Tf = () => !0, H0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  M0.test(n) && !A0.test(n)
), cs = () => !1, D0 = (n) => O0.test(n), U0 = (n) => R0.test(n), B0 = (n) => !I(n) && !$(n), q0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), Y0 = (n) => Ra(n, Mf, cs), I = (n) => Ef.test(n), tn = (n) => Ra(n, Af, H0), Bd = (n) => Ra(n, L0, bt), G0 = (n) => Ra(n, Rf, Tf), K0 = (n) => Ra(n, Of, cs), qd = (n) => Ra(n, Cf, cs), Q0 = (n) => Ra(n, jf, U0), xi = (n) => Ra(n, Hf, D0), $ = (n) => Nf.test(n), fl = (n) => nn(n, Af), V0 = (n) => nn(n, Of), Yd = (n) => nn(n, Cf), X0 = (n) => nn(n, Mf), Z0 = (n) => nn(n, jf), wi = (n) => nn(n, Hf, !0), J0 = (n) => nn(n, Rf, !0), Ra = (n, l, o) => {
  const s = Ef.exec(n);
  return s ? s[1] ? l(s[1]) : o(s[2]) : !1;
}, nn = (n, l, o = !1) => {
  const s = Nf.exec(n);
  return s ? s[1] ? l(s[1]) : o : !1;
}, Cf = (n) => n === "position" || n === "percentage", jf = (n) => n === "image" || n === "url", Mf = (n) => n === "length" || n === "size" || n === "bg-size", Af = (n) => n === "length", L0 = (n) => n === "number", Of = (n) => n === "family-name", Rf = (n) => n === "number" || n === "weight", Hf = (n) => n === "shadow", W0 = () => {
  const n = Zt("color"), l = Zt("font"), o = Zt("text"), s = Zt("font-weight"), c = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), f = Zt("container"), g = Zt("spacing"), x = Zt("radius"), T = Zt("shadow"), M = Zt("inset-shadow"), k = Zt("text-shadow"), E = Zt("drop-shadow"), y = Zt("blur"), h = Zt("perspective"), _ = Zt("aspect"), O = Zt("ease"), N = Zt("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], K = () => [
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
  ], B = () => [...K(), $, I], A = () => ["auto", "hidden", "clip", "visible", "scroll"], v = () => ["auto", "contain", "none"], b = () => [$, I, g], z = () => [ja, "full", "auto", ...b()], D = () => [Je, "none", "subgrid", $, I], V = () => ["auto", {
    span: ["full", Je, $, I]
  }, Je, $, I], L = () => [Je, "auto", $, I], ct = () => ["auto", "min", "max", "fr", $, I], ht = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], ut = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], X = () => ["auto", ...b()], et = () => [ja, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...b()], lt = () => [f, ja, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...b()], q = () => [ja, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...b()], Y = () => [n, $, I], w = () => [...K(), Yd, qd, {
    position: [$, I]
  }], G = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], nt = () => ["auto", "cover", "contain", X0, Y0, {
    size: [$, I]
  }], tt = () => [Uo, fl, tn], at = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    $,
    I
  ], it = () => ["", bt, fl, tn], St = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ft = () => [bt, Uo, Yd, qd], Ha = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    y,
    $,
    I
  ], Da = () => ["none", bt, $, I], Oe = () => ["none", bt, $, I], Re = () => [bt, $, I], da = () => [ja, "full", ...b()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [ca],
      breakpoint: [ca],
      color: [Tf],
      container: [ca],
      "drop-shadow": [ca],
      ease: ["in", "out", "in-out"],
      font: [B0],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [ca],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [ca],
      shadow: [ca],
      spacing: ["px", bt],
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
        aspect: ["auto", "square", ja, I, $, _]
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
      "container-named": [q0],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [bt, "auto", I, $, f]
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
        object: B()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: A()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": A()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": A()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: v()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": v()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": v()
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
        inset: z()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": z()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": z()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": z(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: z()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": z(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: z()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": z()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": z()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: z()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: z()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: z()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: z()
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
        z: [Je, "auto", $, I]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [ja, "full", "auto", f, ...b()]
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
        flex: [bt, ja, "auto", "initial", "none", I]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", bt, $, I]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", bt, $, I]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Je, "first", "last", "none", $, I]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": D()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: V()
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
        "grid-rows": D()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: V()
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
        "auto-cols": ct()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": ct()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: b()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": b()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": b()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...ht(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...ut(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...ut()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...ht()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...ut(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...ut(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": ht()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...ut(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...ut()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: b()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: b()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: b()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: b()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: b()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: b()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: b()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: b()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: b()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: b()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: b()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: X()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: X()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: X()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: X()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: X()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: X()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: X()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: X()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: X()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: X()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: X()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": b()
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
        "space-y": b()
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
        block: ["auto", ...q()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...q()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...q()]
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
        font: [s, J0, G0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Uo, I]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [V0, K0, l]
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
        tracking: [c, $, I]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [bt, "none", $, Bd]
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
          ...b()
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
        decoration: [...St(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [bt, "from-font", "auto", $, tn]
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
        "underline-offset": [bt, "auto", $, I]
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
        indent: b()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [Je, $, I]
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
        bg: w()
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
          }, Je, $, I],
          radial: ["", $, I],
          conic: ["", Je, $, I]
        }, Z0, Q0]
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
        outline: [...St(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [bt, $, I]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", bt, fl, tn]
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
          T,
          wi,
          xi
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
        "inset-shadow": ["none", M, wi, xi]
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
        "ring-offset": [bt, tn]
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
        "text-shadow": ["none", k, wi, xi]
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
        opacity: [bt, $, I]
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
        "mask-linear": [bt]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": ft()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": ft()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": Y()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": Y()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": ft()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": ft()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": Y()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": Y()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": ft()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": ft()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": Y()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": Y()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": ft()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": ft()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": Y()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": Y()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": ft()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": ft()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": Y()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": Y()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": ft()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": ft()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": Y()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": Y()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": ft()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": ft()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": Y()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": Y()
      }],
      "mask-image-radial": [{
        "mask-radial": [$, I]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": ft()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": ft()
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
        "mask-radial-at": K()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [bt]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": ft()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": ft()
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
        mask: w()
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
        brightness: [bt, $, I]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [bt, $, I]
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
          wi,
          xi
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
        grayscale: ["", bt, $, I]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [bt, $, I]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", bt, $, I]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [bt, $, I]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", bt, $, I]
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
        "backdrop-brightness": [bt, $, I]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [bt, $, I]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", bt, $, I]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [bt, $, I]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", bt, $, I]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [bt, $, I]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [bt, $, I]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", bt, $, I]
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
        "border-spacing": b()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": b()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": b()
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
        duration: [bt, "initial", $, I]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", O, $, I]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [bt, $, I]
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
        perspective: [h, $, I]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": B()
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
        transform: [$, I, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: B()
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
        zoom: [Je, $, I]
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
        "scroll-m": b()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": b()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": b()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": b()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": b()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": b()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": b()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": b()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": b()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": b()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": b()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": b()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": b()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": b()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": b()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": b()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": b()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": b()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": b()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": b()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": b()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": b()
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
        fill: ["none", ...Y()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [bt, fl, tn, Bd]
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
}, F0 = /* @__PURE__ */ N0(W0);
function Ae(...n) {
  return F0(wf(n));
}
function I0(n, l, o) {
  return n.filter((s, c) => c !== l && (s.start + s.end) / 2 < o).length;
}
function $0(n, l, o, s) {
  const c = n.map(() => 0), d = n[l];
  if (!d) return c;
  const p = n[l + 1], f = n[l - 1], g = d.end - d.start + (p ? p.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((x, T) => {
    l < o && T > l && T <= o ? c[T] = -g : o < l && T >= o && T < l && (c[T] = g);
  }), c[l] = Math.min(Math.max(s, n[0].start - d.start), n[n.length - 1].end - d.end), c;
}
const Gd = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function P0(n, l) {
  for (let o = n.parentElement; o; o = o.parentElement) {
    const s = getComputedStyle(o)[l === "x" ? "overflowX" : "overflowY"];
    if ((s === "auto" || s === "scroll") && (l === "x" ? o.scrollWidth > o.clientWidth : o.scrollHeight > o.clientHeight)) return o;
  }
  return null;
}
function tb(n, l, o, s) {
  const c = n[l] ? P0(n[l], o) : null, d = () => c ? o === "x" ? c.scrollLeft : c.scrollTop : 0, p = (_) => (o === "x" ? _.clientX : _.clientY) + d(), f = p(s), g = d(), x = n.map((_) => {
    const O = _.getBoundingClientRect();
    return o === "x" ? { start: O.left + g, end: O.right + g } : { start: O.top + g, end: O.bottom + g };
  }), T = n.map((_) => Gd.map((O) => _.style[O])), M = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, k = o === "x" ? "translateX" : "translateY";
  let E = !1;
  const y = { to: l };
  n.forEach((_, O) => {
    if (_.style.pointerEvents = "none", O !== l) {
      M || (_.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(_).position === "static" && (_.style.position = "relative"), _.style.zIndex = "30", _.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const h = (_, O) => {
    y.to = _, $0(x, l, _, O).forEach((N, j) => {
      n[j].style.transform = N ? `${k}(${N}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return y.to;
    },
    slot: (_) => I0(x, l, p(_)),
    apply: (_, O) => {
      E || h(_, p(O) - f);
    },
    rest: () => {
      E || h(l, 0);
    },
    end: () => {
      E || (E = !0, n.forEach((_, O) => Gd.forEach((N, j) => {
        _.style[N] = T[O][j];
      })));
    }
  };
}
const eb = 5;
let Bo = !1;
function ab(n, l) {
  if (n.button !== 0 || Bo) return;
  const o = { clientX: n.clientX, clientY: n.clientY }, s = n.currentTarget, c = n.pointerId;
  let d = null, p, f = !1;
  const g = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (y) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", T), window.removeEventListener("pointerup", M), window.removeEventListener("pointercancel", k), window.removeEventListener("keydown", E, !0), window.removeEventListener("blur", k), s.removeEventListener("lostpointercapture", k);
    try {
      s.releasePointerCapture(c);
    } catch {
    }
    if (!d) return;
    Bo = !1, document.body.style.cursor = g.cursor, document.body.style.userSelect = g.userSelect, d.end();
    const h = (_) => _.stopPropagation();
    window.addEventListener("click", h, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", h, !0), 0), p?.(), l.onEnd(y, d);
  }, T = (y) => {
    if (!d) {
      if (Math.hypot(y.clientX - o.clientX, y.clientY - o.clientY) < eb) return;
      const h = l.items();
      d = tb(h, l.from(h), l.axis, o), Bo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        s.setPointerCapture(c);
      } catch {
      }
      s.addEventListener("lostpointercapture", k);
      const _ = l.onStart?.();
      p = typeof _ == "function" ? _ : void 0;
    }
    l.onMove(y, d);
  }, M = () => x(!0), k = () => x(!1), E = (y) => {
    y.key === "Escape" && (y.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", T), window.addEventListener("pointerup", M), window.addEventListener("pointercancel", k), window.addEventListener("keydown", E, !0), window.addEventListener("blur", k);
}
const Df = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ri = {
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
const nb = Object.fromEntries(Object.entries(Ri).map(([n, l]) => [l, n])), lb = {
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
function ib(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : nb[n];
}
const Kd = /* @__PURE__ */ new Map();
function Uf(n, l = Df) {
  const o = `${l}|${n}`, s = Kd.get(o);
  if (s) return s;
  const c = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? c.cmd = !0 : (c.ctrl = !0, c.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") c[d] = !0;
    else if (/^[a-z]$/.test(d))
      c.code = `Key${d.toUpperCase()}`, c.letter = d;
    else if (/^[0-9]$/.test(d)) c.code = `Digit${d}`;
    else if (Ri[d]) c.code = Ri[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!c.code) throw new Error(`no key in "${n}"`);
  return Kd.set(o, c), c;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = Uf(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function rb(n, l = Df) {
  const o = Uf(n, l), s = ob(ib(o.code) ?? "");
  return l ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${s}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", s].filter(Boolean).join("+");
}
const ob = (n) => lb[n] ?? n.toUpperCase(), Qd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Vd = wf, Yi = (n, l) => (o) => {
  var s;
  if (l?.variants == null) return Vd(n, o?.class, o?.className);
  const { variants: c, defaultVariants: d } = l, p = Object.keys(c).map((x) => {
    const T = o?.[x], M = d?.[x];
    if (T === null) return null;
    const k = Qd(T) || Qd(M);
    return c[x][k];
  }), f = o && Object.entries(o).reduce((x, T) => {
    let [M, k] = T;
    return k === void 0 || (x[M] = k), x;
  }, {}), g = l == null || (s = l.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((x, T) => {
    let { class: M, className: k, ...E } = T;
    return Object.entries(E).every((y) => {
      let [h, _] = y;
      return Array.isArray(_) ? _.includes({
        ...d,
        ...f
      }[h]) : {
        ...d,
        ...f
      }[h] === _;
    }) ? [
      ...x,
      M,
      k
    ] : x;
  }, []);
  return Vd(n, p, g, o?.class, o?.className);
}, sb = Yi(
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
), cb = Yi(
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
function ub({ className: n, ...l } = {}) {
  return Ae(cb(l), n);
}
const Bf = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", qf = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", db = Yi(`${qf} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function fb({ className: n, ...l } = {}) {
  return Ae(db(l), n);
}
const Yf = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", mb = Yi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), pb = "my-1 h-px bg-overlay-0";
function hb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ Nt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function gb({ size: n = 16, className: l }) {
  return /* @__PURE__ */ Nt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ Nt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function bb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Gf({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Xd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function vb({ state: n, error: l }) {
  return /* @__PURE__ */ Nt.jsx(
    "span",
    {
      className: Ae("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Xd[n] ?? Xd.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function yb({ title: n, onClose: l, children: o, testId: s }) {
  return qi(
    /* @__PURE__ */ Nt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (c) => {
          c.target === c.currentTarget && l();
        },
        onKeyDown: (c) => {
          c.key === "Escape" && l();
        },
        children: /* @__PURE__ */ Nt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": s,
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
const _i = 4, Ma = 8, xb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Zd = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function wb({ value: n, onChange: l, options: o, className: s, ariaLabel: c, testId: d, id: p, title: f, disabled: g, placeholder: x, freeText: T, onKeyDown: M }) {
  const k = pt.useId(), [E, y] = pt.useState(!1), [h, _] = pt.useState(-1), [O, N] = pt.useState(!1), j = pt.useRef(null), K = pt.useRef(null), [B, A] = pt.useState({}), v = pt.useRef({ text: "", at: 0 }), b = T && O && n ? o.filter((q) => Zd(q).toLowerCase().includes(n.toLowerCase()) || q.value.toLowerCase().includes(n.toLowerCase())) : o, z = o.find((q) => q.value === n), D = (q) => `${k}-${q}`;
  function V(q) {
    g || (_(q), y(!0));
  }
  function L() {
    y(!1), N(!1), _(-1);
  }
  function ct(q) {
    !q || q.disabled || (l(q.value), L());
  }
  function ht(q, Y) {
    for (let w = 1; w <= b.length; w++) {
      const G = (q + Y * w + b.length * w) % b.length;
      if (!b[G].disabled) return G;
    }
    return q;
  }
  const ut = () => b.findIndex((q) => !q.disabled), X = () => b.length - 1 - [...b].reverse().findIndex((q) => !q.disabled);
  Xo(() => {
    if (!E || !j.current) {
      A((nt) => nt.left === void 0 ? nt : {});
      return;
    }
    const q = j.current.getBoundingClientRect(), Y = window.innerHeight - q.bottom - _i - Ma, w = q.top - _i - Ma, G = Y < 160 && w > Y;
    A({
      position: "fixed",
      left: Math.min(Math.max(Ma, q.left), Math.max(Ma, window.innerWidth - q.width - Ma)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: q.width,
      maxWidth: window.innerWidth - 2 * Ma,
      maxHeight: Math.min(G ? w : Y, 320),
      ...G ? { bottom: window.innerHeight - q.top + _i } : { top: q.bottom + _i },
      overflowY: "auto"
    });
  }, [E, b.length]), Xo(() => {
    const q = K.current;
    if (!E || !q || B.left === void 0) return;
    const Y = q.getBoundingClientRect().right, w = window.innerWidth - Ma;
    Y > w && A((G) => ({ ...G, left: Math.max(Ma, Number(G.left) - (Y - w)) }));
  }, [E, B]), Le(() => {
    if (!E) return;
    const q = (Y) => {
      const w = Y.target;
      (w === document || w instanceof Node && j.current && w.contains(j.current)) && L();
    };
    return window.addEventListener("resize", L), window.addEventListener("scroll", q, !0), () => {
      window.removeEventListener("resize", L), window.removeEventListener("scroll", q, !0);
    };
  }, [E]), Le(() => {
    const q = E && h >= 0 ? document.getElementById(D(h)) : null, Y = K.current;
    !q || !Y || (q.offsetTop < Y.scrollTop ? Y.scrollTop = q.offsetTop : q.offsetTop + q.offsetHeight > Y.scrollTop + Y.clientHeight && (Y.scrollTop = q.offsetTop + q.offsetHeight - Y.clientHeight));
  }, [E, h]), Qf(E, (q) => {
    q || L();
  }, j, K);
  function et(q) {
    if (q.nativeEvent.isComposing) return;
    const Y = () => {
      q.preventDefault(), q.stopPropagation();
    }, { key: w } = q;
    if (E) {
      if (w === "Escape") {
        Y(), L();
        return;
      } else if (w === "Tab")
        L();
      else if (w === "ArrowDown" || w === "ArrowUp") {
        Y(), b.length && _(h < 0 ? w === "ArrowDown" ? ut() : X() : ht(h, w === "ArrowDown" ? 1 : -1));
        return;
      } else if (w === "Home" && !T) {
        Y(), _(ut());
        return;
      } else if (w === "End" && !T) {
        Y(), _(X());
        return;
      } else if (w === "Enter" || w === " " && !T) {
        if (h >= 0 && b[h]) {
          Y(), ct(b[h]);
          return;
        }
        if (!T) {
          Y(), L();
          return;
        }
      } else if (!T && w.length === 1 && !q.metaKey && !q.ctrlKey && !q.altKey) {
        const G = Date.now();
        v.current = { text: (G - v.current.at > 600 ? "" : v.current.text) + w.toLowerCase(), at: G };
        const nt = Math.max(h, 0), tt = [...b.slice(nt + (v.current.text.length === 1 ? 1 : 0)), ...b.slice(0, nt + 1)].find((at) => !at.disabled && Zd(at).toLowerCase().startsWith(v.current.text));
        tt && (Y(), _(b.indexOf(tt)));
        return;
      }
    } else if (w === "ArrowDown" || w === "ArrowUp" || !T && (w === "Enter" || w === " ")) {
      Y(), V(Math.max(0, b.findIndex((G) => G.value === n)));
      return;
    }
    M?.(q);
  }
  const lt = {
    ref: (q) => {
      j.current = q;
    },
    id: p,
    title: f,
    disabled: g,
    "aria-label": c,
    "aria-expanded": E,
    "aria-controls": E ? k : void 0,
    "aria-activedescendant": E && h >= 0 ? D(h) : void 0,
    "data-testid": d,
    onKeyDown: et
  };
  return /* @__PURE__ */ Nt.jsxs(Nt.Fragment, { children: [
    T ? /* @__PURE__ */ Nt.jsx(
      "input",
      {
        ...lt,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: s,
        value: n,
        onChange: (q) => {
          l(q.target.value), N(!0), E ? _(-1) : (_(-1), y(!0));
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
        className: Ae("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
        onClick: () => E ? L() : V(Math.max(0, b.findIndex((q) => q.value === n))),
        children: [
          /* @__PURE__ */ Nt.jsx("span", { className: "min-w-0 flex-1 truncate", children: z ? z.label : x ?? "" }),
          /* @__PURE__ */ Nt.jsx(Kf, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    E && b.length > 0 && qi(
      /* @__PURE__ */ Nt.jsx(
        "div",
        {
          ref: K,
          id: k,
          role: "listbox",
          "aria-label": c,
          className: Ae("z-[9999]", Yf),
          style: B,
          onMouseDown: (q) => {
            q.preventDefault(), q.stopPropagation();
          },
          onClick: (q) => q.stopPropagation(),
          children: b.map((q, Y) => /* @__PURE__ */ Nt.jsxs(
            "div",
            {
              id: D(Y),
              role: "option",
              "aria-selected": q.value === n,
              "aria-disabled": q.disabled || void 0,
              "data-value": q.value,
              className: Ae(xb, Y === h && !q.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                q.disabled || _(Y);
              },
              onClick: () => ct(q),
              children: [
                /* @__PURE__ */ Nt.jsx("span", { className: "min-w-0 truncate", children: q.label }),
                q.value === n && /* @__PURE__ */ Nt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            q.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const _b = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Sb = `${_b} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function Kf({ open: n, size: l = 12, className: o }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: o, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function kb(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const $o = {
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
function Po(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((o) => o.id === n.parentSessionId);
}
function zb(n) {
  const l = /* @__PURE__ */ new Map();
  for (const o of n)
    Po(o, n) && l.set(o.parentSessionId, [...l.get(o.parentSessionId) ?? [], o]);
  return l.size ? n.filter((o) => !Po(o, n)).flatMap((o) => [o, ...l.get(o.id) ?? []]) : n;
}
const Si = 6, Jd = 8;
function Eb(n, l = {}) {
  const { minWidth: o = 220, align: s = "right", minSpaceAbove: c = 100 } = l, d = n.getBoundingClientRect(), p = window.innerWidth, f = window.innerHeight, g = s === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, x = d.top - Si - Jd, T = f - d.bottom - Si - Jd;
  return x >= c ? {
    position: "fixed",
    bottom: f - d.top + Si,
    ...g,
    minWidth: o,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Si,
    ...g,
    minWidth: o,
    maxHeight: Math.min(T, f * 0.75),
    overflowY: "auto"
  };
}
function Qf(n, l, o, s) {
  Le(() => {
    if (!n) return;
    function c(p) {
      const f = p.target, g = o.current?.contains(f) ?? !1, x = s.current?.contains(f) ?? !1;
      !g && !x && l(!1);
    }
    function d(p) {
      p.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", c), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", c), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function Nb({ icon: n, fallback: l }) {
  const [o, s] = pt.useState(!1);
  return Le(() => s(!1), [n]), !n || o ? /* @__PURE__ */ Nt.jsx(Nt.Fragment, { children: l }) : /* @__PURE__ */ Nt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => s(!0) });
}
const Tb = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Cb = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const jb = "1.3.0";
let Ei = null;
const Mb = (n) => {
  Ei = n;
};
function Tt() {
  const n = (typeof Ei == "function" ? Ei() : Ei) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Ab = (n) => Tt().subscribe?.(n) ?? (() => {
}), Ob = Eb, Rb = globalThis.perch?.isMac !== !1, Hb = (n) => rb(n, Tt().isMac !== !1), Db = (n) => sb(n), Ub = ({ className: n, ...l } = {}) => Ae(ub(l), n), Bb = fb, qb = (n) => mb(n), Yb = pb, Gb = qf, Kb = Bf, Qb = (n) => $o[n].color, Vb = (n, l) => Tt().shortcutFor?.(n, l) ?? null, Xb = (n) => Tt().shortcutLabel?.(n) ?? null, Gi = (n, l) => Tt().command(n, l ?? {}) !== !1, Zb = (n, l, o) => Tt().startSession?.(n, l, o), Jb = globalThis.perch?.pickFolder ? (n) => Tt().pickFolder(n) : null;
function oe(n) {
  const l = pt.useRef(n);
  return l.current = n, pt.useSyncExternalStore(Ab, () => l.current(Tt()));
}
const Vf = (n = {}) => oe((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Lb = () => oe((n) => n.hosts()), Wb = () => oe((n) => n.sessionFolders());
function Fb() {
  const n = oe((l) => l.addProject?.() ?? Ib);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, o, s) => {
      l.trim() && n.status !== "pending" && Tt().addProjectFolder?.(l, o, s);
    },
    clear: () => Tt().clearAddProject?.()
  };
}
const Ib = Object.freeze({ status: "idle" }), Xf = "perch.lastAgentChoice", $b = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Pb = () => {
  const n = Tt().storage?.getItem(Xf);
  return n === "claude" || n === "codex" ? n : "claude";
}, tv = Object.freeze({ items: [] });
function ev() {
  const n = oe((l) => l.notifications?.() ?? tv);
  return pt.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [n]);
}
function av(n) {
  const l = oe((c) => c.agentChoices?.(n) ?? $b), [o, s] = pt.useState(Pb);
  return pt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: o,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (c) => {
      c !== "claude" && c !== "codex" || (Tt().storage?.setItem(Xf, c), s(c));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, o]);
}
function nv(n) {
  Le(() => Tt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function lv(n) {
  const l = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return zb(l).map((o) => ({ session: o.session, nested: Po(o, l) }));
}
function iv({ id: n, plain: l, className: o }) {
  const s = oe((x) => x.session(n));
  if (!s) return null;
  const c = s.state ?? kb(s), d = $o[c]?.color ?? $o.unknown.color, p = s.provider, f = p === "claude" || p === "claude-agent-teams" || p === "omp", g = l ? Ae("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Ae("agent-status-dot", `agent-status-dot--${c}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return pt.createElement(
    "span",
    { className: g, style: l ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: l ? p ?? "Agent" : `${p ?? "Agent"} · ${c}`, "aria-hidden": "true" },
    pt.createElement("span", { className: Ae("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, pt.createElement(Zf, { provider: p, size: 14 }))
  );
}
function Zf({ provider: n, size: l = 14 }) {
  const o = Tt().agentIcon?.(n, l) ?? null, s = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return pt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": s, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const rv = ({ children: n }) => pt.createElement(pt.Fragment, null, n);
function ov(n, l) {
  const o = pt.useRef(l);
  return o.current = l, Le(() => {
    const s = Tt();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const c = {};
    for (const [p, f] of Object.entries(o.current))
      c[p] = typeof f == "function" ? (...g) => o.current[p]?.(...g) : f;
    const d = s.openOverlay(n, c);
    return () => s.closeOverlay?.(d);
  }, [n]), null;
}
const ln = (n) => function(o) {
  return ov(n, o);
}, sv = ln("session-menu"), cv = ln("new-session-menu"), uv = ln("confirm");
let Jf = null;
const dv = (n) => {
  Jf = n;
};
function fv(n) {
  return pt.createElement(Jf ?? uv, n);
}
function mv({ className: n = Sb, ...l }) {
  return pt.createElement(wb, { ...l, className: n });
}
let ts = null;
const pv = (n) => {
  ts = n;
}, hv = ln("folder-browser");
function gv(n) {
  return ts ? pt.createElement(ts, { ...n, browse: (l) => Tt().browse(n.hostId, l) }) : pt.createElement(hv, n);
}
const bv = ln("instructions"), vv = ln("memory"), yv = yb;
let us = null;
const xv = (n) => {
  us = n;
};
function wv(n) {
  if (us) return pt.createElement(Sv, n);
  const { hostId: l, path: o, className: s } = n, c = pt.useRef(null);
  return pt.createElement(
    "button",
    {
      type: "button",
      ref: c,
      className: Ae("worktree-menu__btn", Bf, s),
      "data-testid": `worktree-menu-${l}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: o, anchor: c.current?.getBoundingClientRect() })
    },
    pt.createElement(Gf, null)
  );
}
const Lf = "Perch did not answer.";
function ki(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Lf };
}
function _v(n, l, o = Tt()) {
  const s = (c) => {
    for (const d of c ?? []) {
      if (d.path === l) return d;
      const p = s(d.children);
      if (p) return p;
    }
    return null;
  };
  for (const c of o.navigation({})?.projects ?? []) {
    if (c.hostId !== n) continue;
    const d = s(c.workspaces) ?? s(c.hidden);
    if (d) return d;
  }
  return null;
}
const Ld = 5 * 6e4;
function Wf(n, l, o, s = Tt()) {
  const c = Date.now() + Ld;
  let d = !1, p = () => {
  };
  const f = () => {
    d = !0, p(), clearTimeout(x);
  }, g = () => {
    if (!d) {
      if (Date.now() >= c) return f();
      _v(n, l, s) && (f(), s.startSession?.(n, l, o));
    }
  }, x = setTimeout(f, Ld);
  p = s.subscribe?.(g) ?? (() => {
  }), g();
}
function Sv({ hostId: n, path: l, className: o, worktrees: s, request: c, parentChoices: d, emptyAgent: p, ...f }) {
  const [g, x] = pt.useState(s), T = (D) => !!Tt().coreCan?.(D, n), M = Vf(), k = `${n}:${l}`, E = pt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!T("workspace.nest")) return [];
    const D = M?.projects?.find((ct) => ct.hostId === n && ct.repoPath === l), V = [], L = (ct, ht) => {
      for (const ut of ct ?? [])
        ht && V.push({ id: ut.id, name: ut.name, path: ut.path }), L(ut.children, !0);
    };
    return L(D?.workspaces, !1), V;
  }, [d, M, n, l]), y = n === "local" && T("worktree.job"), h = f.deleteSupported ?? T("worktree.delete"), _ = f.startFromSupported ?? T("worktree.startFrom"), O = oe((D) => D.emptyWorkspaceAgent?.() ?? void 0), N = p ?? O ?? void 0, j = oe((D) => D.worktreeMenuRequest?.() ?? null), K = j?.projectKey === k ? j.nonce : null, B = pt.useMemo(() => c ?? (K == null ? null : j), [c, K]), [A, v] = pt.useState(B);
  Le(() => {
    B && v(B);
  }, [B]);
  const b = pt.useRef({});
  b.current = { background: y, deleteSupported: h };
  const z = pt.useMemo(() => {
    const D = (V, L) => Tt().ask(V, { hostId: n, repoPath: l, ...L });
    return {
      list: async () => {
        const V = await D("worktree.list", {});
        return V?.type === "worktree.list.result" && x({ worktrees: V.worktrees ?? [], defaultRoot: V.defaultRoot ?? "", baseRef: V.baseRef, refs: V.refs ?? [] }), ki(V);
      },
      create: async ({ branch: V, newBranch: L, path: ct, extra: ht, agent: ut }) => {
        const X = { branch: V, newBranch: !!L, path: ct ?? null, name: ht?.name ?? null, startFrom: ht?.startFrom ?? null, parentWorkspaceId: ht?.parentWorkspaceId ?? null }, { background: et } = b.current, lt = await D(et ? "worktree.job.start" : "worktree.create", X), q = et ? "worktree.job.started" : "worktree.done";
        if (lt?.type !== q) return { error: ki(lt).error ?? Lf };
        const Y = et ? lt.job?.path : lt.path;
        return ut && Y && Wf(n, Y, ut), { background: et };
      },
      remove: async (V, L) => {
        const ct = await D("worktree.remove", { path: V, force: !!L, deleteBranch: b.current.deleteSupported });
        return { ...ki(ct), preservedBranch: ct?.type === "worktree.done" ? ct.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (V, L) => ki(await D("worktree.branch.delete", { branch: V, expectedHead: L })),
      open: (V) => Tt().startSession?.(n, V, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return pt.createElement(us, {
    hostId: n,
    cwd: l,
    projectKey: k,
    className: o,
    worktrees: g,
    background: y,
    startFromSupported: _,
    deleteSupported: h,
    parentChoices: E,
    emptyAgent: N,
    request: A,
    actions: z
  });
}
const kv = (n, l) => {
  if (!Tt().followPointer?.(n)) return;
  const o = l.items();
  for (const s of o) s.getBoundingClientRect();
  o[0]?.parentElement?.getBoundingClientRect(), ab(n, l);
}, zv = () => oe((n) => n.workspaceTabs()), Ev = () => oe((n) => n.statusLine()), Nv = () => oe((n) => n.zoom()), Tv = () => oe((n) => n.paneLook()), Cv = () => oe((n) => n.keybindings?.() ?? []), jv = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Mv(n) {
  const l = !!n?.keepFresh, o = oe((c) => c.statusLine?.().connected ?? !1), s = oe((c) => c.planUsage?.() ?? jv);
  return Le(() => {
    if (!l || !o) return;
    let c;
    const d = () => {
      Tt().command("usage.get"), c = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(c);
  }, [l, o]), s;
}
const Av = () => Tt().command("usage.get", { force: !0 }), Ov = (n) => Tt().command("usage.redeemReset", { accountId: n }), Rv = () => Gi("app.zoom_reset"), Hv = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Dv = (n, l, o) => Tt().beginTabDrag?.(n, l, o);
function Uv(n) {
  Le(() => Tt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Bv = (n) => Gi("browser.open", { workspaceId: n }), qv = (n, l) => Gi("file.open", { workspaceId: n, path: l }), Yv = () => null, Gv = () => null, Kv = ln("new-file"), ay = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Zf,
  Chevron: Kf,
  CloseIcon: bb,
  ConfirmDialog: fv,
  Dialog: yv,
  EllipsisIcon: hb,
  FolderBrowser: gv,
  GearIcon: gb,
  HostStateDot: vb,
  InstructionsDialog: bv,
  MemoryDialog: vv,
  NewFilePrompt: Kv,
  NewSessionMenu: cv,
  PageIcon: Nb,
  PlusIcon: Gf,
  Select: mv,
  SessionDot: iv,
  SessionMenu: sv,
  Slot: rv,
  TabDragLayer: Gv,
  TabMenu: Yv,
  WorktreeMenu: wv,
  agentStateColor: Qb,
  anchoredPopoverStyle: Ob,
  beginReorderDrag: kv,
  beginTabDrag: Dv,
  bindHost: Mb,
  buttonClass: Bb,
  cn: Ae,
  drawConfirmationsInPlace: dv,
  drawFolderBrowserInPlace: pv,
  drawWorktreeInPlace: xv,
  ghostButton: Gb,
  glassClass: Tb,
  iconButton: Kb,
  isMac: Rb,
  keyLabel: Hb,
  menuDividerClass: Yb,
  menuItemClass: qb,
  menuPanel: Yf,
  nestSessions: lv,
  openBrowserTab: Bv,
  openFileTab: qv,
  pickFolder: Jb,
  redeemUsageReset: Ov,
  refreshUsage: Av,
  resetZoom: Rv,
  rowActionClass: Ub,
  runCommand: Gi,
  segmentClass: Db,
  shortcutFor: Vb,
  shortcutLabel: Xb,
  startPaneWhenReady: Wf,
  startSession: Zb,
  tabStateClass: Hv,
  tapButtonClass: Cb,
  useAddProject: Fb,
  useAddProjectRequest: nv,
  useAgentChoices: av,
  useDismissOnOutsideClick: Qf,
  useHosts: Lb,
  useKeybindings: Cv,
  useNavigation: Vf,
  useNewTabRequest: Uv,
  useNotifications: ev,
  usePaneLook: Tv,
  usePlanUsage: Mv,
  useSessionFolders: Wb,
  useStatusLine: Ev,
  useWorkspaceTabs: zv,
  useZoom: Nv,
  version: jb
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
//! files through an asset source the host may not have. An icon is drawn once per colour it is described with; one
//! under a node whose own `hover:` changes the text colour is drawn twice, the hover copy shown by the engine while the
//! pointer is over that node (a hover group), so a hover never calls back into the script.
const ds = {
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
  ds[n] = (l, o) => l[n](o);
const ny = Object.keys(ds);
function qo(n, l) {
  for (const [o, s] of Object.entries(l)) {
    const c = ds[o];
    if (!c) throw new Error(`the description key ${o} has no GPUI builder`);
    s != null && (n = c(n, s));
  }
  return n;
}
const Aa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Wd = /* @__PURE__ */ new WeakSet(), Yo = /* @__PURE__ */ new WeakSet();
function Fd(n, l, o) {
  const s = n.pressed, c = Aa(o);
  return s && s.x === c.clientX && s.y === c.clientY ? s.id : l;
}
function Qv(n, l, o) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && Hi.has(n.group) || o)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const Ff = (n, l = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !l || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && Ff(o, !0)), ze = (n) => n.style?.display !== "hidden";
let Hi = /* @__PURE__ */ new Set();
function If(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: o, style: s } of n.group_hover ?? []) "display" in s && l.add(o);
  for (const o of n.children ?? []) o.kind !== "text" && If(o, l);
  return l;
}
function es(n, l, o, s, c = !1, d = !1, p = null, f = {}, g = !1, x = /* @__PURE__ */ new Map(), T = null) {
  if (n.kind === "text") return x.get(n)?.text ?? n.text;
  const M = Wd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (T = null), p = n.style.text_color ?? p;
  const k = !!n.hover?.text_color && em(n), E = n.group ?? (k ? `~g${n.id}` : null);
  k && (T = { group: E, color: n.hover.text_color }), f = { ...f };
  for (const z of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[z] !== void 0 && (f[z] = n.style[z]);
  const y = new Set(n.events ?? []);
  let h;
  if (n.kind === "image" && !n.markup ? h = l.image(n.src) : h = l.div(), n.markup && n.kind === "svg" && T && T.color !== p) {
    const { group: z, color: D } = T, V = () => l.div().absolute().top(0).left(0).size_full();
    h = h.child(V().group_hover(z, (L) => L.invisible()).child(s.icon(`~icon-${n.id}`, n.markup, p))).child(V().invisible().group_hover(z, (L) => L.visible()).child(s.icon(`~icon-${n.id}-hover`, n.markup, D)));
  } else n.markup && (h = h.child(s.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const _ = Qv(n, y, c);
  if (_ && (h = h.id(_)), n.measure && (h = h.measure(n.measure)), n.name && h.also_named) for (const z of n.also ?? []) h = h.also_named(z);
  h = qo(h, { ...n.style, ...x.get(n) });
  const O = f.whitespace !== "nowrap" && !f.text_ellipsis;
  g && O && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Ff(n) && (h = h.min_w(0));
  for (const z of ["hover", "focus", "active"]) n[z] && (h = h[z]((D) => qo(D, n[z])));
  E && (h = h.group(E));
  for (const { group: z, style: D } of n.group_hover ?? []) {
    const { display: V, ...L } = D;
    Object.keys(L).length && (h = h.group_hover(z, (ct) => qo(ct, L)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const z = o.document?.scrollTarget, D = z ? (n.children ?? []).filter(ze).findIndex((V) => tm(V, z.id)) : -1;
    if (D >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, l.scroll.scroll_to_item(D)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      h = h.track_scroll(l.scroll);
      const V = (n.children ?? []).filter(ze).map((L) => L.id);
      o.document.itemBounds = (L) => V.includes(L) ? l.scroll.item_bounds?.(V.indexOf(L)) ?? null : null;
    }
  }
  const N = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll";
  if (N && Yo.has(n) && (h = h.on_scroll_wheel((z, D) => D.stop_propagation?.())), N || Yo.has(n)) for (const z of n.children ?? []) z.kind !== "text" && Yo.add(z);
  n.kind === "input" && !n.disabled && (h = h.on_mouse_down("left", (z, D) => {
    z.bounds && o.setBounds(n.id, z.bounds), o.focus(n.id), D.notify();
  }));
  const j = n.kind === "input" ? n : n.meta?.tag === "label" ? Pf(n) : null;
  j && !j.disabled && /^(checkbox|radio)$/.test(j.input_type) && (h = h.on_click((z, D) => {
    D.stop_propagation?.(), o.toggle(j.id), D.notify();
  }));
  const K = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((z) => y.has(z));
  if (K || M) for (const z of n.children ?? []) z.kind !== "text" && Wd.add(z);
  if (K && (h = h.on_mouse_down("left", (z, D) => {
    D.stop_propagation?.(), z.bounds && o.setBounds(n.id, z.bounds);
    const V = { ...Aa(z), button: 0, buttons: 1, detail: z.click_count }, L = Fd(o, n.id, z);
    o.pressed = null, o.dispatch(L, "pointerdown", { ...V, pointerType: "mouse" }), o.dispatch(L, "mousedown", V) && o.pressFocus?.(L), D.notify();
  }), h = h.on_mouse_down("right", (z, D) => {
    D.stop_propagation?.(), z.bounds && o.setBounds(n.id, z.bounds);
    const V = Fd(o, n.id, z);
    o.pressed = null, o.dispatch(V, "contextmenu", { ...Aa(z), button: 2 }), D.notify();
  }), h = h.on_mouse_up("left", (z, D) => {
    D.stop_propagation?.();
    const V = { ...Aa(z), button: 0 };
    o.dispatch(n.id, "pointerup", { ...V, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", V), D.notify();
  }), h = h.on_click((z, D) => {
    o.dispatch(n.id, z.click_count === 2 && y.has("double_click") ? "dblclick" : "click", { detail: z.click_count, button: 0 }), D.notify();
  })), n.blocks_pointer && !K)
    for (const z of ["left", "right"]) h = h.on_mouse_down(z, (D, V) => V.stop_propagation?.());
  else if (M && !K)
    for (const z of ["left", "right"])
      h = h.on_mouse_down(z, (D) => {
        const V = Aa(D);
        (o.pressed?.x !== V.clientX || o.pressed?.y !== V.clientY) && (o.pressed = { id: n.id, x: V.clientX, y: V.clientY });
      });
  if (y.has("mouse_move") && (h = h.on_mouse_move((z) => {
    o.dispatch(n.id, "pointermove", { ...Aa(z), pointerType: "mouse" });
  })), n.track_hover && Hi.has(n.group) && (h = h.on_hover((z, D) => {
    o.hover(n.id, z), D.notify();
  })), c && (h = h.on_mouse_down_out((z, D) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Aa(z), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Aa(z)), D.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const z = n.value ? String(n.value) : String(n.placeholder ?? "");
    let D = l.div().whitespace_nowrap().overflow_x_hidden();
    const V = an(f);
    V && (D = D.h(V)), !n.value && p && (D = D.text_color(Xv(p))), z && (h = h.child(D.child(n.input_type === "password" && n.value ? "•".repeat([...z].length) : z))), n.field_w && (h = h.child(l.div().w(n.field_w).h(0)));
  }
  const B = f.whitespace === "nowrap" ? an(f) : null, A = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let v = !n.range_name;
  const b = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const z of (n.children ?? []).filter(ze)) {
    const D = z.style?.flex_basis;
    b && z.style.flex_grow > 0 && (D === 0 || typeof D == "string" && D.endsWith("%")) && x.set(z, { ...x.get(z), flex_basis: "auto" });
    let V = es(z, l, o, s, !1, d, p, f, A && z.style?.position !== "absolute", x, T);
    const L = !v && (z.kind === "text" || !z.meta), ct = z.kind === "text" ? x.get(z)?.h ?? B : null, ht = z.kind === "text" ? x.get(z)?.w : void 0;
    if (L || ct || ht !== void 0) {
      let ut = l.div();
      L && (ut = ut.id(n.range_name)), L && !A && n.style.display === "flex" && (ut = ut[`self_${Vv[f.text_align] ?? "start"}`]().max_w("100%")), ct && (ut = ut.h(ct)), ht !== void 0 && (ut = ut.w(ht).flex_none().whitespace_nowrap()), V = ut.child(V), v ||= L;
    }
    h = h.child(V);
  }
  return h;
}
const Vv = { center: "center", right: "end", end: "end" };
function Xv(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const o = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const $f = /^(?:[!-,.-~]+|\S)$/u, Pf = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const o = l.kind === "text" ? null : Pf(l);
    if (o) return o;
  }
  return null;
}, tm = (n, l) => n.id === l || (n.children ?? []).some((o) => o.kind !== "text" && tm(o, l)), em = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && em(l));
function an(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function ly(n, l, o, s, c = 0, d = !1) {
  const p = [n.root, ...n.overlays];
  Hi = /* @__PURE__ */ new Set();
  for (const T of p) If(T, Hi);
  const f = c > 0 ? $v(p, c) : /* @__PURE__ */ new Map();
  c > 0 && s.measure && Zv(p, c, s.measure, f), Fv(p, f), Wv(p, f), s.measure && Lv(p, s.measure, f);
  let g = l.div().relative().size_full().child(es(n.root, l, o, s, !1, !1, null, {}, !1, f)), x = d && n.overlays.length ? l.div().relative().size_full().window_layer() : g;
  for (const T of n.overlays) x = x.child(es(T, l, o, s, !0, !1, null, {}, !1, f));
  return x === g ? g : g.child(x);
}
function Zv(n, l, o, s) {
  const c = (y, h) => s.set(y, { ...s.get(y), ...h }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function g(y, h, _) {
    if (y.kind === "text") {
      if (!(h.whitespace === "nowrap" || $f.test(y.text)) || h.text_ellipsis || _ || typeof h.text_size != "number") return NaN;
      const v = o(y.text, { size: h.text_size, weight: h.font_weight ?? 400, family: h.font_family ?? ".SystemUIFont", italic: !!h.italic });
      return Number.isFinite(v) ? v : NaN;
    }
    if (!ze(y) || y.kind === "input" || y.markup) return x(y);
    const O = { ...h };
    for (const A of f) y.style[A] !== void 0 && (O[A] = y.style[A]);
    O.text_ellipsis = !!y.style.text_ellipsis, p.set(y, O);
    const N = y.style, j = (y.children ?? []).filter(Ye), K = j.map((A) => g(A, O, _ || !!y.tabular));
    let B = x(y);
    if (!Number.isFinite(B) && N.w === void 0) {
      const A = j.map((b, z) => K[z] + (b.kind === "text" ? 0 : P(b.style.ml) + P(b.style.mr)));
      let v;
      j.length ? Me(y) ? v = j.some((b) => b.kind !== "text" && b.style.flex_grow > 0) || N.flex_wrap === "wrap" ? NaN : A.reduce((b, z) => b + z, 0) + P(N.gap_x) * (j.length - 1) : v = Math.max(...A) : v = 0, B = v + P(N.pl) + P(N.pr) + P(N.border_l) + P(N.border_r), typeof N.min_w == "number" && (B = Math.max(B, N.min_w)), typeof N.max_w == "number" && (B = Math.min(B, N.max_w));
    }
    return d.set(y, B), B;
  }
  const x = (y) => typeof y.style?.w == "number" ? y.style.w : NaN, T = () => ({ exact: 0, laid: 0 }), M = (y, h) => {
    if (!Number.isFinite(h))
      return Object.assign(y, T()), NaN;
    y.exact += h;
    const _ = Math.round(y.exact * l + 1e-9) / l, O = _ - y.laid;
    return y.laid = _, O;
  }, k = (y) => Me(y) && y.style.flex_wrap !== "wrap" && (y.style.justify ?? "start") === "start";
  function E(y) {
    if (!y || y.kind === "text" || !ze(y)) return;
    const h = (y.children ?? []).filter(Ye);
    if (k(y) && h.length > 1) {
      const _ = P(y.style.gap_x), O = T(), N = !(_ && h.some((j) => j.kind === "text" || !Number.isFinite(P(j.style.ml))));
      c(y, { border_l: M(O, P(y.style.border_l)), pl: M(O, P(y.style.pl)) }), N && _ && c(y, { gap_x: 0 }), h.forEach((j, K) => {
        const B = (K && N ? _ : 0) + (j.kind === "text" ? 0 : P(j.style.ml));
        if (j.kind === "text")
          B && Object.assign(O, T());
        else {
          const z = M(O, B);
          Number.isFinite(z) && c(j, { ml: z });
        }
        const A = j.kind === "text" ? p.get(y) ?? {} : null, v = j.kind === "text" ? g(j, A, !!y.tabular) : d.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(v)) {
          const z = { w: M(O, v) };
          j.kind !== "text" && typeof j.style.w != "number" && j.style.min_w === void 0 && (z.whitespace = "nowrap", z.flex_shrink = 0), c(j, z);
        } else Object.assign(O, T());
        if (j.kind !== "text") {
          const z = M(O, P(j.style.mr));
          Number.isFinite(z) && c(j, { mr: z });
        }
      });
    }
    for (const _ of y.children ?? []) _.kind !== "text" && E(_);
  }
  for (const y of n)
    y && (g(y, {}, !1), E(y));
}
const Jv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Lv(n, l, o) {
  const s = ["text_size", "font_weight", "font_family", "italic", "line_height"], c = (f) => typeof f == "number" ? f : 0, d = (f, g) => g && Di(g) && !Me(g) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(g.style.items), p = (f, g, x, T) => {
    if (!f || f.kind === "text" || !ze(f)) return;
    const M = f.style;
    let k = typeof M.w == "number" ? M.w : M.w === "100%" ? x : d(f, g) ? x - c(M.ml) - c(M.mr) : NaN;
    typeof M.max_w == "number" && (k = Math.min(k, M.max_w));
    const E = k - c(M.pl) - c(M.pr) - c(M.border_l) - c(M.border_r), y = { ...T };
    for (const _ of s) M[_] !== void 0 && (y[_] = M[_]);
    const h = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(E) && E > 0 && typeof y.text_size == "number" && h.length && h.every((_) => _.kind === "text")) {
      const _ = { size: y.text_size, weight: y.font_weight ?? 400, family: y.font_family ?? ".SystemUIFont", italic: !!y.italic }, O = (K) => l(K.trimEnd(), _) <= E + 0.01;
      let N = 0;
      for (const K of h) {
        const B = [];
        for (const v of K.text.split(`
`)) {
          let b = "";
          for (const z of v.split(Jv)) {
            if (O(b + z)) {
              b += z;
              continue;
            }
            b && B.push(b.trimEnd()), b = "";
            for (const D of z)
              b && !O(b + D) && (B.push(b), b = ""), b += D;
          }
          B.push(b.trimEnd());
        }
        const A = B.join(`
`);
        B.every((v) => !v || O(v)) ? A !== K.text && o.set(K, { ...o.get(K), text: A }) : N = NaN, N += B.length;
      }
      const j = an(y);
      Number.isFinite(N) && j && M.h === void 0 && h.length === 1 && o.set(f, { ...o.get(f), h: N * j + c(M.pt) + c(M.pb) + c(M.border_t) + c(M.border_b) });
    }
    for (const _ of h) p(_, f, Me(f) ? NaN : E, y);
  };
  for (const f of n) p(f, null, NaN, {});
}
function Wv(n, l) {
  const o = (s, c) => {
    if (!s || s.kind === "text" || !ze(s)) return;
    const d = s.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : c && typeof d.w != "number";
    if (p && Me(s))
      for (const f of s.children ?? []) {
        const g = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (g === 0 || typeof g == "string" && g.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of s.children ?? []) o(f, p);
  };
  for (const s of n) o(s, !1);
}
function Fv(n, l) {
  const o = l.heights ?? /* @__PURE__ */ new Map(), s = (g) => o.get(g), c = (g) => {
    const x = s(g);
    if (Number.isFinite(x)) return x;
    if (g.kind === "text" || !ze(g)) return 0;
    const T = g.style, M = typeof T.min_h == "number" ? T.min_h : 0, k = (g.children ?? []).filter(Ye), E = k.map((_) => c(_) + (_.kind === "text" ? 0 : Math.max(0, P(_.style.mt) || 0) + Math.max(0, P(_.style.mb) || 0))), y = k.length ? Me(g) ? Math.max(...E) : E.reduce((_, O) => _ + O, 0) + (T.display === "flex" ? (P(T.gap_y) || 0) * (k.length - 1) : 0) : 0, h = [T.pt, T.pb, T.border_t, T.border_b].reduce((_, O) => _ + (P(O) || 0), 0);
    return Math.max(M, y + h);
  }, d = (g) => !(g.children ?? []).filter(Ye).length || Me(g) ? NaN : c({ ...g, style: { ...g.style, h: void 0, max_h: void 0, min_h: void 0 } }), p = (g, x) => {
    const T = g.style;
    if (typeof T.h == "number") return T.h;
    if (typeof T.max_h == "number") return T.max_h;
    if (!x || !Di(x) || Me(x)) return NaN;
    const M = x.style, k = typeof M.h == "number" ? M.h : typeof M.max_h == "number" ? M.max_h : NaN, E = (x.children ?? []).filter(Ye);
    let y = 0;
    for (const _ of E) {
      if (_ === g) continue;
      const O = s(_);
      if (!Number.isFinite(O)) return NaN;
      y += O + (_.kind === "text" ? 0 : P(_.style.mt) + P(_.style.mb));
    }
    const h = M.display === "flex" ? P(M.gap_y) * Math.max(0, E.length - 1) : 0;
    return k - P(M.pt) - P(M.pb) - P(M.border_t) - P(M.border_b) - y - h - P(T.mt) - P(T.mb);
  }, f = (g, x) => {
    if (!(!g || g.kind === "text" || !ze(g))) {
      if (g.scrollbar > 0 && g.style.overflow_y === "scroll") {
        const T = d(g), M = p(g, x);
        Number.isFinite(T) && Number.isFinite(M) && T > M + 0.01 && l.set(g, { ...l.get(g), pr: P(g.style.pr) + g.scrollbar });
      }
      for (const T of g.children ?? []) f(T, g);
    }
  };
  for (const g of n) f(g, null);
}
const Iv = ["text_size", "line_height", "whitespace", "text_ellipsis"], P = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Di = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Me = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ye = (n) => n.kind === "text" || ze(n) && n.style.position !== "absolute";
function $v(n, l) {
  const o = /* @__PURE__ */ new Map(), s = (h, _) => o.set(h, { ...o.get(h), ...Object.fromEntries(Object.entries(_).filter(([, O]) => Number.isFinite(O))) }), c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(h, _) {
    if (h.kind === "text") return _.whitespace === "nowrap" || $f.test(h.text) ? an(_) ?? NaN : NaN;
    const O = { ..._ };
    for (const A of Iv) h.style[A] !== void 0 && (O[A] = h.style[A]);
    d.set(h, O);
    const N = h.style, j = (h.children ?? []).filter(Ye), K = j.map((A) => p(A, O));
    let B;
    if (N.h !== void 0 && N.h !== "auto") B = P(N.h);
    else if (h.kind === "input")
      B = (h.input_type === "textarea" || h.input_type === "select" ? NaN : an(O) ?? NaN) + P(N.pt) + P(N.pb) + P(N.border_t) + P(N.border_b), N.min_h !== void 0 && (B = Math.max(B, P(N.min_h)));
    else {
      const A = j.map((b, z) => (b.kind === "text" ? 0 : P(b.style.mt) + P(b.style.mb)) + K[z]);
      let v;
      if (Me(h)) v = N.flex_wrap === "wrap" ? NaN : N.items === "baseline" ? g(j, K, O) : Math.max(0, ...A);
      else if (Di(h)) {
        const b = j.some((D) => D.kind !== "text" && (D.style.flex_grow > 0 || D.style.flex_basis !== void 0)), z = N.display !== "flex" && j.some((D) => D.kind !== "text" && (P(D.style.mt) || P(D.style.mb)));
        v = b || z ? NaN : A.reduce((D, V) => D + V, 0) + (N.display === "flex" ? P(N.gap_y) * Math.max(0, j.length - 1) : 0);
      } else v = NaN;
      B = v + P(N.pt) + P(N.pb) + P(N.border_t) + P(N.border_b), N.min_h !== void 0 && (B = Math.max(B, P(N.min_h))), N.max_h !== void 0 && (B = Math.min(B, P(N.max_h)));
    }
    return c.set(h, B), B;
  }
  const f = (h) => (an(h) - (Mi + bf) * h.text_size) / 2 + Mi * h.text_size;
  function g(h, _, O) {
    let N = 0, j = 0;
    for (const [K, B] of h.entries()) {
      const A = B.kind === "text" ? O : d.get(B);
      if (!(B.kind === "text" || (B.children ?? []).filter(Ye).every((D) => D.kind === "text")) || !Number.isFinite(_[K]) || typeof A.text_size != "number") return NaN;
      const b = B.kind === "text" ? {} : B.style, z = P(b.mt) + P(b.border_t) + P(b.pt) + f(A);
      N = Math.max(N, z), j = Math.max(j, P(b.mt) + _[K] + P(b.mb) - z);
    }
    return N + j;
  }
  const x = () => ({ exact: 0, laid: 0 }), T = (h, _) => {
    if (!Number.isFinite(_))
      return Object.assign(h, x()), NaN;
    h.exact += _;
    const O = Math.round(h.exact * l + 1e-9) / l, N = O - h.laid;
    return h.laid = O, N;
  };
  function M(h) {
    if (!(h.kind === "text" || !ze(h))) {
      for (const _ of (h.children ?? []).filter((O) => O.kind !== "text" && ze(O) && O.style.position === "absolute")) M(_);
      if (Di(h) && !Me(h)) {
        const _ = x();
        s(h, { border_t: T(_, P(h.style.border_t)), pt: T(_, P(h.style.pt)) }), k(h, _);
      } else for (const _ of (h.children ?? []).filter(Ye)) _.kind !== "text" && M(_);
    }
  }
  function k(h, _) {
    const O = (h.children ?? []).filter(Ye), N = h.style.display === "flex" ? P(h.style.gap_y) : 0;
    if (N && O.some((j) => j.kind === "text")) {
      for (const j of O) j.kind !== "text" && M(j);
      return !1;
    }
    return N && s(h, { gap_y: 0 }), O.forEach((j, K) => {
      if (j.kind === "text") {
        const B = c.get(j) ?? p(j, d.get(h) ?? {});
        Number.isFinite(B) ? s(j, { h: T(_, B) }) : Object.assign(_, x());
        return;
      }
      if (s(j, { mt: T(_, (K ? N : 0) + P(j.style.mt)) }), Number.isFinite(c.get(j))) y(j, _);
      else if (E(j)) {
        const B = j.style;
        s(j, { border_t: T(_, P(B.border_t)), pt: T(_, P(B.pt)) }), s(j, { pb: T(_, P(B.pb)), border_b: T(_, P(B.border_b)) });
      } else
        M(j), Object.assign(_, x());
      s(j, { mb: T(_, P(j.style.mb)) });
    }), !0;
  }
  function E(h) {
    const _ = h.style, O = (h.children ?? []).filter(Ye), N = an(d.get(h) ?? {});
    return h.kind === "div" && !Me(h) && O.length > 0 && O.every((j) => j.kind === "text") && Number.isInteger(N) && [_.h, _.min_h, _.max_h].every((j) => j === void 0 || j === "auto");
  }
  function y(h, _) {
    const O = h.style;
    for (const A of (h.children ?? []).filter((v) => v.kind !== "text" && ze(v) && v.style.position === "absolute")) M(A);
    const N = _.laid, j = _.exact;
    s(h, { border_t: T(_, P(O.border_t)), pt: T(_, P(O.pt)) });
    const K = O.h !== void 0 && O.h !== "auto", B = c.get(h) - P(O.pt) - P(O.pb) - P(O.border_t) - P(O.border_b);
    if (h.kind === "input")
      K || T(_, B);
    else if (Me(h) || K && (O.justify ?? "start") !== "start") {
      for (const A of (h.children ?? []).filter(Ye)) A.kind !== "text" && M(A);
      K || T(_, B);
    } else !k(h, _) && !K && T(_, B);
    if (K) {
      _.exact = j + c.get(h), _.laid = Math.round(_.exact * l + 1e-9) / l, s(h, { h: _.laid - N });
      return;
    }
    s(h, { pb: T(_, P(O.pb)), border_b: T(_, P(O.border_b)) }), s(h, { h: _.laid - N });
  }
  for (const h of n)
    p(h, {}), M(h);
  return Object.defineProperty(o, "heights", { value: c }), o;
}
const iy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }] };
export {
  iy as NAMED_ELEMENTS,
  Vh as React,
  Sg as SCHEMA,
  ny as STYLE_KEYS,
  ly as describeToGpui,
  Pv as jsxRuntime,
  ty as mount,
  ey as reactDom,
  ay as sdk
};
