function Fo(n, l) {
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
const bh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), vh = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), yh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...bh]);
function Ho(n) {
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
  return [Ho(n.slice(l, o)), o];
}
function xh(n, l) {
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
function Io(n) {
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
function wh(n, l) {
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
      const b = f[3] ?? f[4] ?? f[5];
      o.attrs.push({ name: Ho(f[1]).toLowerCase(), op: f[2] ?? null, value: b === void 0 ? null : Ho(b) }), l = d + 1, c = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") throw new ke(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = hi(n, l + 1);
      l = p;
      const f = d.toLowerCase();
      if (n[l] === "(") {
        if (!vh.has(f)) throw new ke(`:${f}() is not supported`);
        const b = xh(n, l + 1), y = n.slice(l + 1, b).trim();
        if (l = b + 1, f === "nth-child") {
          if (!/^\d+$/.test(y)) throw new ke(`:nth-child(${y}) is not supported (only a number)`);
          o.pseudos.push({ name: f, n: Number(y) });
        } else
          o.pseudos.push({ name: f, list: Io(y).map($o) });
      } else {
        if (!yh.has(f)) throw new ke(`:${f} is not supported`);
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
function $o(n) {
  const l = [];
  let o = 0, c = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, d] = wh(n, o);
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
const ed = /* @__PURE__ */ new Map();
function Di(n) {
  let l = ed.get(n);
  return l || (l = Io(n).map($o), ed.set(n, l)), l;
}
function Ld(n) {
  const l = [0, 0, 0], o = (c) => {
    l[0] += c[0], l[1] += c[1], l[2] += c[2];
  };
  for (const { compound: c } of n) {
    c.id && l[0]++, l[1] += c.classes.length + c.attrs.length, c.tag && c.tag !== "*" && l[2]++;
    for (const s of c.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(Ld).sort((p, f) => f[0] - p[0] || f[1] - p[1] || f[2] - p[2])[0];
          o(d);
        } else l[1]++;
  }
  return l;
}
function _h(n, { name: l, op: o, value: c }) {
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
function Sh(n, l, o, c) {
  if (l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classList ?? [];
    for (const d of l.classes) if (!s.includes(d)) return !1;
  }
  for (const s of l.attrs) if (!_h(n, s)) return !1;
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
    const { compound: b, combinator: y } = l[p];
    if (!Sh(d, b, o, f)) return !1;
    if (p === 0) return !0;
    if (y === ">") return !!d.parentElement && s(d.parentElement, p - 1, !1);
    for (let T = d.parentElement; T; T = T.parentElement) if (s(T, p - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, c);
}
function kh(n, l, o = {}) {
  return (typeof l == "string" ? Di(l) : l).some((s) => Rn(n, s, o));
}
function Wd(n, l, o = {}) {
  return Rn(n, l, o);
}
function pl(n, l, o = {}) {
  const c = Di(l), s = [], d = (p) => {
    for (const f of p.children)
      c.some((b) => Rn(f, b, o)) && s.push(f), d(f);
  };
  return d(n), s;
}
function Fd(n, l, o = {}) {
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
let zh = 1;
class Do {
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
class Po {
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
class It extends Po {
  constructor(l, o = {}, c = null) {
    super(), this.nodeType = 1, this.id = `n${zh++}`, this.tagName = l.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = c, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return kh(this, l);
  }
  closest(l) {
    return Fd(this, l);
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
    return l ? new Do(l.x, l.y, l.width, l.height) : new Do();
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
    const l = this, o = (p) => String(p).startsWith("--") ? String(p) : String(p).replace(/-([a-z])/g, (f, b) => b.toUpperCase()), c = (p) => {
      const f = l.props.style?.[p];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, s = (p) => l.inline && p in l.inline ? l.inline[p] : c(p), d = (p, f) => {
      const b = f == null ? "" : String(f);
      s(p) !== b && (l.inline ??= {}, b === c(p) ? delete l.inline[p] : l.inline[p] = b, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (p, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (b, y) => d(o(b), y) : f === "removeProperty" ? (b) => {
            const y = s(o(b));
            return d(o(b), ""), y;
          } : f === "getPropertyValue" ? (b) => s(o(b)) : s(f);
      },
      set: (p, f, b) => (typeof f == "string" && d(f, b), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return ad(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return ad(this, l);
  }
}
const Id = Symbol("perch.stale-layout"), $d = 3;
let zi = !1;
function Pd(n) {
  return () => {
    let l, o = !1;
    const c = (s) => {
      const d = zi;
      zi = s < $d;
      try {
        l = n();
      } catch (p) {
        const f = p?.[Id];
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
const Uo = "perch-dom:", Eh = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), Nh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function ad(n, l = []) {
  const o = new Set(l.map((s) => Nh[s] ?? s)), c = (s) => {
    if (!(s instanceof It)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [p, f] of Object.entries(s.props))
      Eh.has(p) || o.has(p) || f == null || typeof f == "function" || typeof f == "symbol" || (d[p] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(c), ...s.hidden ? { h: 1 } : {} };
  };
  return Uo + JSON.stringify(c(n));
}
function Th(n, l) {
  if (typeof n != "string" || !n.startsWith(Uo)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(Uo.length));
  } catch {
    return null;
  }
  const c = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!c(d)) throw new Error("not a node");
    let p;
    if (typeof d.x == "string") p = new Ui(d.x);
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
class Ch {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class jh {
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
function nd(n) {
  for (let l = n; l instanceof It; l = l.parentElement) l.touch();
}
class Mh extends Po {
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
    if (zi && (!c || this.stale?.())) throw { [Id]: this };
    return c ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, nd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, nd(l), this.activeElement === l && (this.activeElement = this.body);
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
class Ah extends Po {
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
function tf(n) {
  return {
    setTimeout: (l, o = 0, ...c) => n.setTimeout(() => l(...c), Math.max(0, Number(o) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const ld = Symbol.for("perch.react.globals");
function Ze(n, l, o) {
  Object.defineProperty(n, l, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function Oh(n, l = globalThis) {
  const o = new Mh(n), c = new Ah(n, o);
  o.defaultView = c;
  const s = n.storage ?? new jh();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = tf(n);
    Ze(l, "setTimeout", f.setTimeout), Ze(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ze(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: o, window: c, localStorage: s, HTMLElement: It, Element: It };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[ld]?.[f], configurable: !0, enumerable: !1 });
  l[ld] = d, Ze(l, "DOMRect", Do), Ze(l, "getComputedStyle", Rh), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", Ch);
  const p = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      Ze(p, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", p), { document: o, window: c, globals: d };
}
function Rh(n) {
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
function Bo(n, l = !1) {
  if (!(l ? n?.tagName === "input" && ef(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let c = n.parentElement; c; c = c.parentElement) if (c.tagName === "form") return c;
  return null;
}
const ef = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const id = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof id?.setTimeout == "function") {
  const n = tf(id);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function ts(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function Hh(n) {
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
var zo = { exports: {} }, ut = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var rd;
function Dh() {
  if (rd) return ut;
  rd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), c = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), b = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), T = Symbol.for("react.lazy"), C = Symbol.for("react.activity"), z = Symbol.iterator;
  function v(w) {
    return w === null || typeof w != "object" ? null : (w = z && w[z] || w["@@iterator"], typeof w == "function" ? w : null);
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
  }, _ = Object.assign, S = {};
  function R(w, Y, nt) {
    this.props = w, this.context = Y, this.refs = S, this.updater = nt || x;
  }
  R.prototype.isReactComponent = {}, R.prototype.setState = function(w, Y) {
    if (typeof w != "object" && typeof w != "function" && w != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, w, Y, "setState");
  }, R.prototype.forceUpdate = function(w) {
    this.updater.enqueueForceUpdate(this, w, "forceUpdate");
  };
  function E() {
  }
  E.prototype = R.prototype;
  function j(w, Y, nt) {
    this.props = w, this.context = Y, this.refs = S, this.updater = nt || x;
  }
  var Q = j.prototype = new E();
  Q.constructor = j, _(Q, R.prototype), Q.isPureReactComponent = !0;
  var U = Array.isArray;
  function O() {
  }
  var h = { H: null, A: null, T: null, S: null }, g = Object.prototype.hasOwnProperty;
  function A(w, Y, nt) {
    var tt = nt.ref;
    return {
      $$typeof: n,
      type: w,
      key: Y,
      ref: tt !== void 0 ? tt : null,
      props: nt
    };
  }
  function G(w, Y) {
    return A(w.type, Y, w.props);
  }
  function L(w) {
    return typeof w == "object" && w !== null && w.$$typeof === n;
  }
  function F(w) {
    var Y = { "=": "=0", ":": "=2" };
    return "$" + w.replace(/[=:]/g, function(nt) {
      return Y[nt];
    });
  }
  var it = /\/+/g;
  function gt(w, Y) {
    return typeof w == "object" && w !== null && w.key != null ? F("" + w.key) : Y.toString(36);
  }
  function wt(w) {
    switch (w.status) {
      case "fulfilled":
        return w.value;
      case "rejected":
        throw w.reason;
      default:
        switch (typeof w.status == "string" ? w.then(O, O) : (w.status = "pending", w.then(
          function(Y) {
            w.status === "pending" && (w.status = "fulfilled", w.value = Y);
          },
          function(Y) {
            w.status === "pending" && (w.status = "rejected", w.reason = Y);
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
  function V(w, Y, nt, tt, at) {
    var rt = typeof w;
    (rt === "undefined" || rt === "boolean") && (w = null);
    var St = !1;
    if (w === null) St = !0;
    else
      switch (rt) {
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
              return St = w._init, V(
                St(w._payload),
                Y,
                nt,
                tt,
                at
              );
          }
      }
    if (St)
      return at = at(w), St = tt === "" ? "." + gt(w, 0) : tt, U(at) ? (nt = "", St != null && (nt = St.replace(it, "$&/") + "/"), V(at, Y, nt, "", function(Ha) {
        return Ha;
      })) : at != null && (L(at) && (at = G(
        at,
        nt + (at.key == null || w && w.key === at.key ? "" : ("" + at.key).replace(
          it,
          "$&/"
        ) + "/") + St
      )), Y.push(at)), 1;
    St = 0;
    var Jt = tt === "" ? "." : tt + ":";
    if (U(w))
      for (var dt = 0; dt < w.length; dt++)
        tt = w[dt], rt = Jt + gt(tt, dt), St += V(
          tt,
          Y,
          nt,
          rt,
          at
        );
    else if (dt = v(w), typeof dt == "function")
      for (w = dt.call(w), dt = 0; !(tt = w.next()).done; )
        tt = tt.value, rt = Jt + gt(tt, dt++), St += V(
          tt,
          Y,
          nt,
          rt,
          at
        );
    else if (rt === "object") {
      if (typeof w.then == "function")
        return V(
          wt(w),
          Y,
          nt,
          tt,
          at
        );
      throw Y = String(w), Error(
        "Objects are not valid as a React child (found: " + (Y === "[object Object]" ? "object with keys {" + Object.keys(w).join(", ") + "}" : Y) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return St;
  }
  function et(w, Y, nt) {
    if (w == null) return w;
    var tt = [], at = 0;
    return V(w, tt, "", "", function(rt) {
      return Y.call(nt, rt, at++);
    }), tt;
  }
  function lt(w) {
    if (w._status === -1) {
      var Y = w._result;
      Y = Y(), Y.then(
        function(nt) {
          (w._status === 0 || w._status === -1) && (w._status = 1, w._result = nt);
        },
        function(nt) {
          (w._status === 0 || w._status === -1) && (w._status = 2, w._result = nt);
        }
      ), w._status === -1 && (w._status = 0, w._result = Y);
    }
    if (w._status === 1) return w._result.default;
    throw w._result;
  }
  var B = typeof reportError == "function" ? reportError : function(w) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var Y = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof w == "object" && w !== null && typeof w.message == "string" ? String(w.message) : String(w),
        error: w
      });
      if (!window.dispatchEvent(Y)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", w);
      return;
    }
    console.error(w);
  }, q = {
    map: et,
    forEach: function(w, Y, nt) {
      et(
        w,
        function() {
          Y.apply(this, arguments);
        },
        nt
      );
    },
    count: function(w) {
      var Y = 0;
      return et(w, function() {
        Y++;
      }), Y;
    },
    toArray: function(w) {
      return et(w, function(Y) {
        return Y;
      }) || [];
    },
    only: function(w) {
      if (!L(w))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return w;
    }
  };
  return ut.Activity = C, ut.Children = q, ut.Component = R, ut.Fragment = o, ut.Profiler = s, ut.PureComponent = j, ut.StrictMode = c, ut.Suspense = b, ut.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, ut.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(w) {
      return h.H.useMemoCache(w);
    }
  }, ut.cache = function(w) {
    return function() {
      return w.apply(null, arguments);
    };
  }, ut.cacheSignal = function() {
    return null;
  }, ut.cloneElement = function(w, Y, nt) {
    if (w == null)
      throw Error(
        "The argument must be a React element, but you passed " + w + "."
      );
    var tt = _({}, w.props), at = w.key;
    if (Y != null)
      for (rt in Y.key !== void 0 && (at = "" + Y.key), Y)
        !g.call(Y, rt) || rt === "key" || rt === "__self" || rt === "__source" || rt === "ref" && Y.ref === void 0 || (tt[rt] = Y[rt]);
    var rt = arguments.length - 2;
    if (rt === 1) tt.children = nt;
    else if (1 < rt) {
      for (var St = Array(rt), Jt = 0; Jt < rt; Jt++)
        St[Jt] = arguments[Jt + 2];
      tt.children = St;
    }
    return A(w.type, at, tt);
  }, ut.createContext = function(w) {
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
  }, ut.createElement = function(w, Y, nt) {
    var tt, at = {}, rt = null;
    if (Y != null)
      for (tt in Y.key !== void 0 && (rt = "" + Y.key), Y)
        g.call(Y, tt) && tt !== "key" && tt !== "__self" && tt !== "__source" && (at[tt] = Y[tt]);
    var St = arguments.length - 2;
    if (St === 1) at.children = nt;
    else if (1 < St) {
      for (var Jt = Array(St), dt = 0; dt < St; dt++)
        Jt[dt] = arguments[dt + 2];
      at.children = Jt;
    }
    if (w && w.defaultProps)
      for (tt in St = w.defaultProps, St)
        at[tt] === void 0 && (at[tt] = St[tt]);
    return A(w, rt, at);
  }, ut.createRef = function() {
    return { current: null };
  }, ut.forwardRef = function(w) {
    return { $$typeof: f, render: w };
  }, ut.isValidElement = L, ut.lazy = function(w) {
    return {
      $$typeof: T,
      _payload: { _status: -1, _result: w },
      _init: lt
    };
  }, ut.memo = function(w, Y) {
    return {
      $$typeof: y,
      type: w,
      compare: Y === void 0 ? null : Y
    };
  }, ut.startTransition = function(w) {
    var Y = h.T, nt = {};
    h.T = nt;
    try {
      var tt = w(), at = h.S;
      at !== null && at(nt, tt), typeof tt == "object" && tt !== null && typeof tt.then == "function" && tt.then(O, B);
    } catch (rt) {
      B(rt);
    } finally {
      Y !== null && nt.types !== null && (Y.types = nt.types), h.T = Y;
    }
  }, ut.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, ut.use = function(w) {
    return h.H.use(w);
  }, ut.useActionState = function(w, Y, nt) {
    return h.H.useActionState(w, Y, nt);
  }, ut.useCallback = function(w, Y) {
    return h.H.useCallback(w, Y);
  }, ut.useContext = function(w) {
    return h.H.useContext(w);
  }, ut.useDebugValue = function() {
  }, ut.useDeferredValue = function(w, Y) {
    return h.H.useDeferredValue(w, Y);
  }, ut.useEffect = function(w, Y) {
    return h.H.useEffect(w, Y);
  }, ut.useEffectEvent = function(w) {
    return h.H.useEffectEvent(w);
  }, ut.useId = function() {
    return h.H.useId();
  }, ut.useImperativeHandle = function(w, Y, nt) {
    return h.H.useImperativeHandle(w, Y, nt);
  }, ut.useInsertionEffect = function(w, Y) {
    return h.H.useInsertionEffect(w, Y);
  }, ut.useLayoutEffect = function(w, Y) {
    return h.H.useLayoutEffect(w, Y);
  }, ut.useMemo = function(w, Y) {
    return h.H.useMemo(w, Y);
  }, ut.useOptimistic = function(w, Y) {
    return h.H.useOptimistic(w, Y);
  }, ut.useReducer = function(w, Y, nt) {
    return h.H.useReducer(w, Y, nt);
  }, ut.useRef = function(w) {
    return h.H.useRef(w);
  }, ut.useState = function(w) {
    return h.H.useState(w);
  }, ut.useSyncExternalStore = function(w, Y, nt) {
    return h.H.useSyncExternalStore(
      w,
      Y,
      nt
    );
  }, ut.useTransition = function() {
    return h.H.useTransition();
  }, ut.version = "19.2.8", ut;
}
var od;
function Uh() {
  return od || (od = 1, zo.exports = Dh()), zo.exports;
}
var mt = Uh();
const af = /* @__PURE__ */ ts(mt), Bh = /* @__PURE__ */ Fo({
  __proto__: null,
  default: af
}, [mt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const qh = af ?? Bh;
function Le(n, l) {
  return mt.useEffect(Pd(n), l);
}
function qo(n, l) {
  return mt.useLayoutEffect(Pd(n), l);
}
const Yh = /* @__PURE__ */ Fo({
  __proto__: null,
  default: qh,
  useEffect: Le,
  useLayoutEffect: qo
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
var sd;
function Gh() {
  if (sd) return dl;
  sd = 1;
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
var cd;
function Kh() {
  return cd || (cd = 1, Eo.exports = Gh()), Eo.exports;
}
var Nt = Kh();
const Qh = /* @__PURE__ */ ts(Nt), Fv = /* @__PURE__ */ Fo({
  __proto__: null,
  default: Qh
}, [Nt]);
var No = { exports: {} }, To = { exports: {} };
const Vh = /* @__PURE__ */ Hh(Yh);
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
var ud;
function Xh() {
  return ud || (ud = 1, (function(n) {
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
        t: for (var B = 0, q = V.length, w = q >>> 1; B < w; ) {
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
    var b = [], y = [], T = 1, C = null, z = 3, v = !1, x = !1, _ = !1, S = !1, R = typeof setTimeout == "function" ? setTimeout : null, E = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
    function Q(V) {
      for (var et = o(y); et !== null; ) {
        if (et.callback === null) c(y);
        else if (et.startTime <= V)
          c(y), et.sortIndex = et.expirationTime, l(b, et);
        else break;
        et = o(y);
      }
    }
    function U(V) {
      if (_ = !1, Q(V), !x)
        if (o(b) !== null)
          x = !0, O || (O = !0, F());
        else {
          var et = o(y);
          et !== null && wt(U, et.startTime - V);
        }
    }
    var O = !1, h = -1, g = 5, A = -1;
    function G() {
      return S ? !0 : !(n.unstable_now() - A < g);
    }
    function L() {
      if (S = !1, O) {
        var V = n.unstable_now();
        A = V;
        var et = !0;
        try {
          t: {
            x = !1, _ && (_ = !1, E(h), h = -1), v = !0;
            var lt = z;
            try {
              e: {
                for (Q(V), C = o(b); C !== null && !(C.expirationTime > V && G()); ) {
                  var B = C.callback;
                  if (typeof B == "function") {
                    C.callback = null, z = C.priorityLevel;
                    var q = B(
                      C.expirationTime <= V
                    );
                    if (V = n.unstable_now(), typeof q == "function") {
                      C.callback = q, Q(V), et = !0;
                      break e;
                    }
                    C === o(b) && c(b), Q(V);
                  } else c(b);
                  C = o(b);
                }
                if (C !== null) et = !0;
                else {
                  var w = o(y);
                  w !== null && wt(
                    U,
                    w.startTime - V
                  ), et = !1;
                }
              }
              break t;
            } finally {
              C = null, z = lt, v = !1;
            }
            et = void 0;
          }
        } finally {
          et ? F() : O = !1;
        }
      }
    }
    var F;
    if (typeof j == "function")
      F = function() {
        j(L);
      };
    else if (typeof MessageChannel < "u") {
      var it = new MessageChannel(), gt = it.port2;
      it.port1.onmessage = L, F = function() {
        gt.postMessage(null);
      };
    } else
      F = function() {
        R(L, 0);
      };
    function wt(V, et) {
      h = R(function() {
        V(n.unstable_now());
      }, et);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(V) {
      V.callback = null;
    }, n.unstable_forceFrameRate = function(V) {
      0 > V || 125 < V ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : g = 0 < V ? Math.floor(1e3 / V) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return z;
    }, n.unstable_next = function(V) {
      switch (z) {
        case 1:
        case 2:
        case 3:
          var et = 3;
          break;
        default:
          et = z;
      }
      var lt = z;
      z = et;
      try {
        return V();
      } finally {
        z = lt;
      }
    }, n.unstable_requestPaint = function() {
      S = !0;
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
      var lt = z;
      z = V;
      try {
        return et();
      } finally {
        z = lt;
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
        id: T++,
        callback: et,
        priorityLevel: V,
        startTime: lt,
        expirationTime: q,
        sortIndex: -1
      }, lt > B ? (V.sortIndex = lt, l(y, V), o(b) === null && V === o(y) && (_ ? (E(h), h = -1) : _ = !0, wt(U, lt - B))) : (V.sortIndex = q, l(b, V), x || v || (x = !0, O || (O = !0, F()))), V;
    }, n.unstable_shouldYield = G, n.unstable_wrapCallback = function(V) {
      var et = z;
      return function() {
        var lt = z;
        z = et;
        try {
          return V.apply(this, arguments);
        } finally {
          z = lt;
        }
      };
    };
  })(jo)), jo;
}
var dd;
function Zh() {
  return dd || (dd = 1, Co.exports = Xh()), Co.exports;
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
var fd;
function Jh() {
  return fd || (fd = 1, (function(n) {
    n.exports = function(l) {
      function o(t, e, a, i) {
        return new _m(t, e, a, i);
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
            for (var m = !1, k = r.child; k; ) {
              if (k === a) {
                m = !0, a = r, i = u;
                break;
              }
              if (k === i) {
                m = !0, i = r, a = u;
                break;
              }
              k = k.sibling;
            }
            if (!m) {
              for (k = u.child; k; ) {
                if (k === a) {
                  m = !0, a = u, i = r;
                  break;
                }
                if (k === i) {
                  m = !0, i = u, a = r;
                  break;
                }
                k = k.sibling;
              }
              if (!m) throw Error(s(189));
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
      function T(t) {
        return t === null || typeof t != "object" ? null : (t = xu && t[xu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function C(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Nm ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case mn:
            return "Fragment";
          case Vr:
            return "Profiler";
          case vu:
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
            case yu:
              return (t._context.displayName || "Context") + ".Consumer";
            case Xr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Lr:
              return e = t.displayName || null, e !== null ? e : C(t.type) || "Memo";
            case xa:
              e = t._payload, t = t._init;
              try {
                return C(t(e));
              } catch {
              }
          }
        return null;
      }
      function z(t) {
        return { current: t };
      }
      function v(t) {
        0 > gn || (t.current = eo[gn], eo[gn] = null, gn--);
      }
      function x(t, e) {
        gn++, eo[gn] = t.current, t.current = e;
      }
      function _(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (eh(t) / ah | 0) | 0;
      }
      function S(t) {
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
      function R(t, e, a) {
        var i = t.pendingLanes;
        if (i === 0) return 0;
        var r = 0, u = t.suspendedLanes, m = t.pingedLanes;
        t = t.warmLanes;
        var k = i & 134217727;
        return k !== 0 ? (i = k & ~u, i !== 0 ? r = S(i) : (m &= k, m !== 0 ? r = S(m) : a || (a = k & ~t, a !== 0 && (r = S(a))))) : (k = i & ~u, k !== 0 ? r = S(k) : m !== 0 ? r = S(m) : a || (a = i & ~t, a !== 0 && (r = S(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
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
      function Q() {
        var t = Fl;
        return Fl <<= 1, (Fl & 62914560) === 0 && (Fl = 4194304), t;
      }
      function U(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function O(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, a, i, r, u) {
        var m = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var k = t.entanglements, D = t.expirationTimes, K = t.hiddenUpdates;
        for (a = m & ~a; 0 < a; ) {
          var J = 31 - be(a), X = 1 << J;
          k[J] = 0, D[J] = -1;
          var W = K[J];
          if (W !== null)
            for (K[J] = null, J = 0; J < W.length; J++) {
              var ft = W[J];
              ft !== null && (ft.lane &= -536870913);
            }
          a &= ~X;
        }
        i !== 0 && g(t, i, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(m & ~e));
      }
      function g(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var i = 31 - be(e);
        t.entangledLanes |= e, t.entanglements[i] = t.entanglements[i] | 1073741824 | a & 261930;
      }
      function A(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var i = 31 - be(a), r = 1 << i;
          r & e | t[i] & e && (t[i] |= e), a &= ~r;
        }
      }
      function G(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : L(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function L(t) {
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
      function F(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function it(t) {
        if (typeof oh == "function" && sh(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode(Pn, t);
          } catch {
          }
      }
      function gt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function wt(t) {
        if (lo === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            lo = e && e[1] || "", Zu = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + lo + t + Zu;
      }
      function V(t, e) {
        if (!t || io) return "";
        io = !0;
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
                    } catch (ft) {
                      var W = ft;
                    }
                    Reflect.construct(t, [], X);
                  } else {
                    try {
                      X.call();
                    } catch (ft) {
                      W = ft;
                    }
                    t.call(X.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ft) {
                    W = ft;
                  }
                  (X = t()) && typeof X.catch == "function" && X.catch(function() {
                  });
                }
              } catch (ft) {
                if (ft && W && typeof ft.stack == "string")
                  return [ft.stack, W.stack];
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
          var u = i.DetermineComponentFrameRoot(), m = u[0], k = u[1];
          if (m && k) {
            var D = m.split(`
`), K = k.split(`
`);
            for (r = i = 0; i < D.length && !D[i].includes("DetermineComponentFrameRoot"); )
              i++;
            for (; r < K.length && !K[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (i === D.length || r === K.length)
              for (i = D.length - 1, r = K.length - 1; 1 <= i && 0 <= r && D[i] !== K[r]; )
                r--;
            for (; 1 <= i && 0 <= r; i--, r--)
              if (D[i] !== K[r]) {
                if (i !== 1 || r !== 1)
                  do
                    if (i--, r--, 0 > r || D[i] !== K[r]) {
                      var J = `
` + D[i].replace(" at new ", " at ");
                      return t.displayName && J.includes("<anonymous>") && (J = J.replace("<anonymous>", t.displayName)), J;
                    }
                  while (1 <= i && 0 <= r);
                break;
              }
          }
        } finally {
          io = !1, Error.prepareStackTrace = a;
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
          var a = Ju.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: lt(e)
          }, Ju.set(t, e), e);
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
      function Y(t) {
        t.return !== null && (q(t, 1), w(t, 1, 0));
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
        x(_a, e), x(el, t), x(te, null), t = jm(e), v(te), x(te, t);
      }
      function rt() {
        v(te), v(el), v(_a);
      }
      function St(t) {
        t.memoizedState !== null && x(Pl, t);
        var e = te.current, a = Mm(e, t.type);
        e !== a && (x(el, t), x(te, a));
      }
      function Jt(t) {
        el.current === t && (v(te), v(el)), Pl.current === t && (v(Pl), ea ? Xa._currentValue = pn : Xa._currentValue2 = pn);
      }
      function dt(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Hn(B(e, t)), ro;
      }
      function Ha(t, e) {
        if (!re) throw Error(s(175));
        Mp(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || dt(t, !0);
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
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Ou(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && dt(t) : e !== 3 && (e !== 5 || Ou(t.type) && !Jl(t.type, t.memoizedProps)) && Ot && dt(t), Da(t), e === 13) {
          if (!re) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Dp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Hp(t);
        } else
          Ot = Vt && e === 27 ? wp(
            t.type,
            Ot
          ) : ee ? Au(t.stateNode) : null;
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
        ea ? (x(ti, e._currentValue), e._currentValue = a) : (x(ti, e._currentValue2), e._currentValue2 = a);
      }
      function We(t) {
        var e = ti.current;
        ea ? t._currentValue = e : t._currentValue2 = e, v(ti);
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
            var m = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var k = u;
              u = r;
              for (var D = 0; D < e.length; D++)
                if (k.context === e[D]) {
                  u.lanes |= a, k = u.alternate, k !== null && (k.lanes |= a), Gi(
                    u.return,
                    a,
                    t
                  ), i || (m = null);
                  break t;
                }
              u = k.next;
            }
          } else if (r.tag === 18) {
            if (m = r.return, m === null) throw Error(s(341));
            m.lanes |= a, u = m.alternate, u !== null && (u.lanes |= a), Gi(m, a, t), m = null;
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
              var k = r.type;
              ye(r.pendingProps.value, m.value) || (t !== null ? t.push(k) : t = [k]);
            }
          } else if (r === Pl.current) {
            if (m = r.alternate, m === null) throw Error(s(387));
            m.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Xa) : t = [Xa]);
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
        return rs(Za, t);
      }
      function bl(t, e) {
        return Za === null && Ua(t), rs(t, e);
      }
      function rs(t, e) {
        var a = ea ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, na === null) {
          if (t === null) throw Error(s(308));
          na = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else na = na.next = e;
        return a;
      }
      function Qi() {
        return {
          controller: new uh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Dn(t) {
        t.refCount--, t.refCount === 0 && dh(fh, function() {
          t.controller.abort();
        });
      }
      function vl() {
      }
      function Ge(t) {
        t !== xn && t.next === null && (xn === null ? ei = xn = t : xn = xn.next = t), ai = !0, oo || (oo = !0, $f());
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
                  var m = i.suspendedLanes, k = i.pingedLanes;
                  u = (1 << 31 - be(42 | t) + 1) - 1, u &= r & ~(m & ~k), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, ds(i, u));
              } else
                u = xt, u = R(
                  i,
                  i === Mt ? u : 0,
                  i.cancelPendingCommit !== null || i.timeoutHandle !== Va
                ), (u & 3) === 0 || E(i, u) || (a = !0, ds(i, u));
              i = i.next;
            }
          while (a);
          so = !1;
        }
      }
      function os() {
        ss();
      }
      function ss() {
        ai = oo = !1;
        var t = 0;
        Ja !== 0 && Ym() && (t = Ja);
        for (var e = de(), a = null, i = ei; i !== null; ) {
          var r = i.next, u = cs(i, e);
          u === 0 ? (i.next = null, a === null ? ei = r : a.next = r, r === null && (xn = a)) : (a = i, (t !== 0 || (u & 3) !== 0) && (ai = !0)), i = r;
        }
        Xt !== 0 && Xt !== 5 || on(t), Ja !== 0 && (Ja = 0);
      }
      function cs(t, e) {
        for (var a = t.suspendedLanes, i = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var m = 31 - be(u), k = 1 << m, D = r[m];
          D === -1 ? ((k & a) === 0 || (k & i) !== 0) && (r[m] = j(k, e)) : D <= e && (t.expiredLanes |= k), u &= ~k;
        }
        if (e = Mt, a = xt, a = R(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Va
        ), i = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return i !== null && i !== null && ao(i), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || E(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (i !== null && ao(i), F(a)) {
            case 2:
            case 8:
              a = ih;
              break;
            case 32:
              a = no;
              break;
            case 268435456:
              a = rh;
              break;
            default:
              a = no;
          }
          return i = us.bind(null, t), a = Il(a, i), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return i !== null && i !== null && ao(i), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function us(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Wn() && t.callbackNode !== a)
          return null;
        var i = xt;
        return i = R(
          t,
          t === Mt ? i : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Va
        ), i === 0 ? null : (Jc(t, i, e), cs(t, de()), t.callbackNode != null && t.callbackNode === a ? us.bind(null, t) : null);
      }
      function ds(t, e) {
        if (Wn()) return null;
        Jc(t, e, !0);
      }
      function $f() {
        Jm ? Lm(function() {
          (vt & 6) !== 0 ? Il(
            Vu,
            os
          ) : ss();
        }) : Il(
          Vu,
          os
        );
      }
      function Vi() {
        if (Ja === 0) {
          var t = wn;
          t === 0 && (t = Ll, Ll <<= 1, (Ll & 261888) === 0 && (Ll = 256)), Ja = t;
        }
        return Ja;
      }
      function Pf(t, e) {
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
        return co++, e.then(fs, fs), e;
      }
      function fs() {
        if (--co === 0 && al !== null) {
          _n !== null && (_n.status = "fulfilled");
          var t = al;
          al = null, wn = 0, _n = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function tm(t, e) {
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
        var t = La.current;
        return t !== null ? t : Mt.pooledCache;
      }
      function yl(t, e) {
        e === null ? x(La, La.current) : x(La, e.pool);
      }
      function ms() {
        var t = Xi();
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
          if (!ch.call(e, r) || !ye(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function ps(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function hs(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(vl, vl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, bs(t), t;
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
                throw t = e.reason, bs(t), t;
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
      function gs() {
        if (Wa === null) throw Error(s(459));
        var t = Wa;
        return Wa = null, t;
      }
      function bs(t) {
        if (t === Sn || t === ni)
          throw Error(s(483));
      }
      function wl(t) {
        var e = nl;
        return nl += 1, kn === null && (kn = []), hs(kn, t, e);
      }
      function Un(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function _l(t, e) {
        throw e.$$typeof === zm ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function vs(t) {
        function e(M, N) {
          if (t) {
            var H = M.deletions;
            H === null ? (M.deletions = [N], M.flags |= 16) : H.push(N);
          }
        }
        function a(M, N) {
          if (!t) return null;
          for (; N !== null; )
            e(M, N), N = N.sibling;
          return null;
        }
        function i(M) {
          for (var N = /* @__PURE__ */ new Map(); M !== null; )
            M.key !== null ? N.set(M.key, M) : N.set(M.index, M), M = M.sibling;
          return N;
        }
        function r(M, N) {
          return M = ta(M, N), M.index = 0, M.sibling = null, M;
        }
        function u(M, N, H) {
          return M.index = H, t ? (H = M.alternate, H !== null ? (H = H.index, H < N ? (M.flags |= 67108866, N) : H) : (M.flags |= 67108866, N)) : (M.flags |= 1048576, N);
        }
        function m(M) {
          return t && M.alternate === null && (M.flags |= 67108866), M;
        }
        function k(M, N, H, Z) {
          return N === null || N.tag !== 6 ? (N = Yr(H, M.mode, Z), N.return = M, N) : (N = r(N, H), N.return = M, N);
        }
        function D(M, N, H, Z) {
          var st = H.type;
          return st === mn ? J(
            M,
            N,
            H.props.children,
            Z,
            H.key
          ) : N !== null && (N.elementType === st || typeof st == "object" && st !== null && st.$$typeof === xa && Ba(st) === N.type) ? (N = r(N, H.props), Un(N, H), N.return = M, N) : (N = Vl(
            H.type,
            H.key,
            H.props,
            null,
            M.mode,
            Z
          ), Un(N, H), N.return = M, N);
        }
        function K(M, N, H, Z) {
          return N === null || N.tag !== 4 || N.stateNode.containerInfo !== H.containerInfo || N.stateNode.implementation !== H.implementation ? (N = Gr(H, M.mode, Z), N.return = M, N) : (N = r(N, H.children || []), N.return = M, N);
        }
        function J(M, N, H, Z, st) {
          return N === null || N.tag !== 7 ? (N = Qa(
            H,
            M.mode,
            Z,
            st
          ), N.return = M, N) : (N = r(N, H), N.return = M, N);
        }
        function X(M, N, H) {
          if (typeof N == "string" && N !== "" || typeof N == "number" || typeof N == "bigint")
            return N = Yr(
              "" + N,
              M.mode,
              H
            ), N.return = M, N;
          if (typeof N == "object" && N !== null) {
            switch (N.$$typeof) {
              case Xl:
                return H = Vl(
                  N.type,
                  N.key,
                  N.props,
                  null,
                  M.mode,
                  H
                ), Un(H, N), H.return = M, H;
              case fn:
                return N = Gr(
                  N,
                  M.mode,
                  H
                ), N.return = M, N;
              case xa:
                return N = Ba(N), X(M, N, H);
            }
            if (Zl(N) || T(N))
              return N = Qa(
                N,
                M.mode,
                H,
                null
              ), N.return = M, N;
            if (typeof N.then == "function")
              return X(M, wl(N), H);
            if (N.$$typeof === ya)
              return X(
                M,
                bl(M, N),
                H
              );
            _l(M, N);
          }
          return null;
        }
        function W(M, N, H, Z) {
          var st = N !== null ? N.key : null;
          if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
            return st !== null ? null : k(M, N, "" + H, Z);
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case Xl:
                return H.key === st ? D(M, N, H, Z) : null;
              case fn:
                return H.key === st ? K(M, N, H, Z) : null;
              case xa:
                return H = Ba(H), W(M, N, H, Z);
            }
            if (Zl(H) || T(H))
              return st !== null ? null : J(M, N, H, Z, null);
            if (typeof H.then == "function")
              return W(
                M,
                N,
                wl(H),
                Z
              );
            if (H.$$typeof === ya)
              return W(
                M,
                N,
                bl(M, H),
                Z
              );
            _l(M, H);
          }
          return null;
        }
        function ft(M, N, H, Z, st) {
          if (typeof Z == "string" && Z !== "" || typeof Z == "number" || typeof Z == "bigint")
            return M = M.get(H) || null, k(N, M, "" + Z, st);
          if (typeof Z == "object" && Z !== null) {
            switch (Z.$$typeof) {
              case Xl:
                return M = M.get(
                  Z.key === null ? H : Z.key
                ) || null, D(N, M, Z, st);
              case fn:
                return M = M.get(
                  Z.key === null ? H : Z.key
                ) || null, K(N, M, Z, st);
              case xa:
                return Z = Ba(Z), ft(
                  M,
                  N,
                  H,
                  Z,
                  st
                );
            }
            if (Zl(Z) || T(Z))
              return M = M.get(H) || null, J(N, M, Z, st, null);
            if (typeof Z.then == "function")
              return ft(
                M,
                N,
                H,
                wl(Z),
                st
              );
            if (Z.$$typeof === ya)
              return ft(
                M,
                N,
                H,
                bl(N, Z),
                st
              );
            _l(N, Z);
          }
          return null;
        }
        function ae(M, N, H, Z) {
          for (var st = null, Ht = null, ct = N, zt = N = 0, Ft = null; ct !== null && zt < H.length; zt++) {
            ct.index > zt ? (Ft = ct, ct = null) : Ft = ct.sibling;
            var Et = W(
              M,
              ct,
              H[zt],
              Z
            );
            if (Et === null) {
              ct === null && (ct = Ft);
              break;
            }
            t && ct && Et.alternate === null && e(M, ct), N = u(Et, N, zt), Ht === null ? st = Et : Ht.sibling = Et, Ht = Et, ct = Ft;
          }
          if (zt === H.length)
            return a(M, ct), _t && q(M, zt), st;
          if (ct === null) {
            for (; zt < H.length; zt++)
              ct = X(M, H[zt], Z), ct !== null && (N = u(
                ct,
                N,
                zt
              ), Ht === null ? st = ct : Ht.sibling = ct, Ht = ct);
            return _t && q(M, zt), st;
          }
          for (ct = i(ct); zt < H.length; zt++)
            Ft = ft(
              ct,
              M,
              zt,
              H[zt],
              Z
            ), Ft !== null && (t && Ft.alternate !== null && ct.delete(
              Ft.key === null ? zt : Ft.key
            ), N = u(
              Ft,
              N,
              zt
            ), Ht === null ? st = Ft : Ht.sibling = Ft, Ht = Ft);
          return t && ct.forEach(function(Ca) {
            return e(M, Ca);
          }), _t && q(M, zt), st;
        }
        function ul(M, N, H, Z) {
          if (H == null) throw Error(s(151));
          for (var st = null, Ht = null, ct = N, zt = N = 0, Ft = null, Et = H.next(); ct !== null && !Et.done; zt++, Et = H.next()) {
            ct.index > zt ? (Ft = ct, ct = null) : Ft = ct.sibling;
            var Ca = W(M, ct, Et.value, Z);
            if (Ca === null) {
              ct === null && (ct = Ft);
              break;
            }
            t && ct && Ca.alternate === null && e(M, ct), N = u(Ca, N, zt), Ht === null ? st = Ca : Ht.sibling = Ca, Ht = Ca, ct = Ft;
          }
          if (Et.done)
            return a(M, ct), _t && q(M, zt), st;
          if (ct === null) {
            for (; !Et.done; zt++, Et = H.next())
              Et = X(M, Et.value, Z), Et !== null && (N = u(
                Et,
                N,
                zt
              ), Ht === null ? st = Et : Ht.sibling = Et, Ht = Et);
            return _t && q(M, zt), st;
          }
          for (ct = i(ct); !Et.done; zt++, Et = H.next())
            Et = ft(
              ct,
              M,
              zt,
              Et.value,
              Z
            ), Et !== null && (t && Et.alternate !== null && ct.delete(Et.key === null ? zt : Et.key), N = u(Et, N, zt), Ht === null ? st = Et : Ht.sibling = Et, Ht = Et);
          return t && ct.forEach(function(gh) {
            return e(M, gh);
          }), _t && q(M, zt), st;
        }
        function Pa(M, N, H, Z) {
          if (typeof H == "object" && H !== null && H.type === mn && H.key === null && (H = H.props.children), typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case Xl:
                t: {
                  for (var st = H.key; N !== null; ) {
                    if (N.key === st) {
                      if (st = H.type, st === mn) {
                        if (N.tag === 7) {
                          a(
                            M,
                            N.sibling
                          ), Z = r(
                            N,
                            H.props.children
                          ), Z.return = M, M = Z;
                          break t;
                        }
                      } else if (N.elementType === st || typeof st == "object" && st !== null && st.$$typeof === xa && Ba(st) === N.type) {
                        a(
                          M,
                          N.sibling
                        ), Z = r(N, H.props), Un(Z, H), Z.return = M, M = Z;
                        break t;
                      }
                      a(M, N);
                      break;
                    } else e(M, N);
                    N = N.sibling;
                  }
                  H.type === mn ? (Z = Qa(
                    H.props.children,
                    M.mode,
                    Z,
                    H.key
                  ), Z.return = M, M = Z) : (Z = Vl(
                    H.type,
                    H.key,
                    H.props,
                    null,
                    M.mode,
                    Z
                  ), Un(Z, H), Z.return = M, M = Z);
                }
                return m(M);
              case fn:
                t: {
                  for (st = H.key; N !== null; ) {
                    if (N.key === st)
                      if (N.tag === 4 && N.stateNode.containerInfo === H.containerInfo && N.stateNode.implementation === H.implementation) {
                        a(
                          M,
                          N.sibling
                        ), Z = r(
                          N,
                          H.children || []
                        ), Z.return = M, M = Z;
                        break t;
                      } else {
                        a(M, N);
                        break;
                      }
                    else e(M, N);
                    N = N.sibling;
                  }
                  Z = Gr(H, M.mode, Z), Z.return = M, M = Z;
                }
                return m(M);
              case xa:
                return H = Ba(H), Pa(
                  M,
                  N,
                  H,
                  Z
                );
            }
            if (Zl(H))
              return ae(
                M,
                N,
                H,
                Z
              );
            if (T(H)) {
              if (st = T(H), typeof st != "function")
                throw Error(s(150));
              return H = st.call(H), ul(
                M,
                N,
                H,
                Z
              );
            }
            if (typeof H.then == "function")
              return Pa(
                M,
                N,
                wl(H),
                Z
              );
            if (H.$$typeof === ya)
              return Pa(
                M,
                N,
                bl(M, H),
                Z
              );
            _l(M, H);
          }
          return typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint" ? (H = "" + H, N !== null && N.tag === 6 ? (a(M, N.sibling), Z = r(N, H), Z.return = M, M = Z) : (a(M, N), Z = Yr(H, M.mode, Z), Z.return = M, M = Z), m(M)) : a(M, N);
        }
        return function(M, N, H, Z) {
          try {
            nl = 0;
            var st = Pa(
              M,
              N,
              H,
              Z
            );
            return kn = null, st;
          } catch (ct) {
            if (ct === Sn || ct === ni) throw ct;
            var Ht = o(29, ct, null, M.mode);
            return Ht.lanes = Z, Ht.return = M, Ht;
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
            var m = i.pending;
            m === null ? r.next = r : (r.next = m.next, m.next = r), i.pending = r;
          }
          u !== 0 && ys(a, r, u);
        }
      }
      function kl(t, e, a, i) {
        Ce[zn++] = t, Ce[zn++] = e, Ce[zn++] = a, Ce[zn++] = i, fo |= i, t.lanes |= i, t = t.alternate, t !== null && (t.lanes |= i);
      }
      function Zi(t, e, a, i) {
        return kl(t, e, a, i), zl(t);
      }
      function qa(t, e) {
        return kl(t, null, null, e), zl(t);
      }
      function ys(t, e, a) {
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
        if (i = i.shared, (vt & 2) !== 0) {
          var r = i.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), i.pending = e, e = zl(t), ys(t, null, a), e;
        }
        return kl(t, i, e, a), zl(t);
      }
      function Bn(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, A(t, a);
        }
      }
      function Wi(t, e) {
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
        if (mo) {
          var t = _n;
          if (t !== null) throw t;
        }
      }
      function Yn(t, e, a, i) {
        mo = !1;
        var r = t.updateQueue;
        ka = !1;
        var u = r.firstBaseUpdate, m = r.lastBaseUpdate, k = r.shared.pending;
        if (k !== null) {
          r.shared.pending = null;
          var D = k, K = D.next;
          D.next = null, m === null ? u = K : m.next = K, m = D;
          var J = t.alternate;
          J !== null && (J = J.updateQueue, k = J.lastBaseUpdate, k !== m && (k === null ? J.firstBaseUpdate = K : k.next = K, J.lastBaseUpdate = D));
        }
        if (u !== null) {
          var X = r.baseState;
          m = 0, J = K = D = null, k = u;
          do {
            var W = k.lane & -536870913, ft = W !== k.lane;
            if (ft ? (xt & W) === W : (i & W) === W) {
              W !== 0 && W === wn && (mo = !0), J !== null && (J = J.next = {
                lane: 0,
                tag: k.tag,
                payload: k.payload,
                callback: null,
                next: null
              });
              t: {
                var ae = t, ul = k;
                W = e;
                var Pa = a;
                switch (ul.tag) {
                  case 1:
                    if (ae = ul.payload, typeof ae == "function") {
                      X = ae.call(
                        Pa,
                        X,
                        W
                      );
                      break t;
                    }
                    X = ae;
                    break t;
                  case 3:
                    ae.flags = ae.flags & -65537 | 128;
                  case 0:
                    if (ae = ul.payload, W = typeof ae == "function" ? ae.call(Pa, X, W) : ae, W == null) break t;
                    X = Qr({}, X, W);
                    break t;
                  case 2:
                    ka = !0;
                }
              }
              W = k.callback, W !== null && (t.flags |= 64, ft && (t.flags |= 8192), ft = r.callbacks, ft === null ? r.callbacks = [W] : ft.push(W));
            } else
              ft = {
                lane: W,
                tag: k.tag,
                payload: k.payload,
                callback: k.callback,
                next: null
              }, J === null ? (K = J = ft, D = X) : J = J.next = ft, m |= W;
            if (k = k.next, k === null) {
              if (k = r.shared.pending, k === null)
                break;
              ft = k, k = ft.next, ft.next = null, r.lastBaseUpdate = ft, r.shared.pending = null;
            }
          } while (!0);
          J === null && (D = X), r.baseState = D, r.firstBaseUpdate = K, r.lastBaseUpdate = J, u === null && (r.shared.lanes = 0), Ea |= m, t.lanes = m, t.memoizedState = X;
        }
      }
      function xs(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function ws(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            xs(a[t], e);
      }
      function _s(t, e) {
        t = ra, x(ii, t), x(En, e), ra = t | e.baseLanes;
      }
      function Fi() {
        x(ii, ra), x(En, En.current);
      }
      function Ii() {
        ra = ii.current, v(En), v(ii);
      }
      function ha(t) {
        var e = t.alternate;
        x(qt, qt.current & 1), x(xe, t), je === null && (e === null || En.current !== null || e.memoizedState !== null) && (je = t);
      }
      function $i(t) {
        x(qt, qt.current), x(xe, t), je === null && (je = t);
      }
      function Ss(t) {
        t.tag === 22 ? (x(qt, qt.current), x(xe, t), je === null && (je = t)) : ga();
      }
      function ga() {
        x(qt, qt.current), x(xe, xe.current);
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
        return la = u, pt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, ot.H = t === null || t.memoizedState === null ? Fu : po, Ia = !1, u = a(i, r), Ia = !1, Nn && (u = zs(
          e,
          a,
          i,
          r
        )), ks(t), u;
      }
      function ks(t) {
        ot.H = il;
        var e = jt !== null && jt.next !== null;
        if (la = 0, Yt = jt = pt = null, ri = !1, ll = 0, Tn = null, e) throw Error(s(300));
        t === null || Gt || (t = t.dependencies, t !== null && gl(t) && (Gt = !0));
      }
      function zs(t, e, a, i) {
        pt = t;
        var r = 0;
        do {
          if (Nn && (Tn = null), ll = 0, Nn = !1, 25 <= r) throw Error(s(301));
          if (r += 1, Yt = jt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          ot.H = Iu, u = e(a, i);
        } while (Nn);
        return u;
      }
      function em() {
        var t = ot.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Gn(e) : e, t = t.useState()[0], (jt !== null ? jt.memoizedState : null) !== t && (pt.flags |= 1024), e;
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
        la = 0, Yt = jt = pt = null, Nn = !1, ll = oi = 0, Tn = null;
      }
      function se() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Yt === null ? pt.memoizedState = Yt = t : Yt = Yt.next = t, Yt;
      }
      function Bt() {
        if (jt === null) {
          var t = pt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = jt.next;
        var e = Yt === null ? pt.memoizedState : Yt.next;
        if (e !== null)
          Yt = e, jt = t;
        else {
          if (t === null)
            throw pt.alternate === null ? Error(s(467)) : Error(s(310));
          jt = t, t = {
            memoizedState: jt.memoizedState,
            baseState: jt.baseState,
            baseQueue: jt.baseQueue,
            queue: jt.queue,
            next: null
          }, Yt === null ? pt.memoizedState = Yt = t : Yt = Yt.next = t;
        }
        return Yt;
      }
      function Nl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Gn(t) {
        var e = ll;
        return ll += 1, Tn === null && (Tn = []), t = hs(Tn, t, e), e = pt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, ot.H = e === null || e.memoizedState === null ? Fu : po), t;
      }
      function Tl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Gn(t);
          if (t.$$typeof === ya) return $t(t);
        }
        throw Error(s(438, String(t)));
      }
      function lr(t) {
        var e = null, a = pt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var i = pt.alternate;
          i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (e = {
            data: i.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Nl(), pt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), i = 0; i < t; i++)
            a[i] = Em;
        return e.index++, a;
      }
      function Fe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Cl(t) {
        var e = Bt();
        return ir(e, jt, t);
      }
      function ir(t, e, a) {
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
          var k = m = null, D = null, K = e, J = !1;
          do {
            var X = K.lane & -536870913;
            if (X !== K.lane ? (xt & X) === X : (la & X) === X) {
              var W = K.revertLane;
              if (W === 0)
                D !== null && (D = D.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: K.action,
                  hasEagerState: K.hasEagerState,
                  eagerState: K.eagerState,
                  next: null
                }), X === wn && (J = !0);
              else if ((la & W) === W) {
                K = K.next, W === wn && (J = !0);
                continue;
              } else
                X = {
                  lane: 0,
                  revertLane: K.revertLane,
                  gesture: null,
                  action: K.action,
                  hasEagerState: K.hasEagerState,
                  eagerState: K.eagerState,
                  next: null
                }, D === null ? (k = D = X, m = u) : D = D.next = X, pt.lanes |= W, Ea |= W;
              X = K.action, Ia && a(u, X), u = K.hasEagerState ? K.eagerState : a(u, X);
            } else
              W = {
                lane: X,
                revertLane: K.revertLane,
                gesture: K.gesture,
                action: K.action,
                hasEagerState: K.hasEagerState,
                eagerState: K.eagerState,
                next: null
              }, D === null ? (k = D = W, m = u) : D = D.next = W, pt.lanes |= X, Ea |= X;
            K = K.next;
          } while (K !== null && K !== e);
          if (D === null ? m = u : D.next = k, !ye(u, t.memoizedState) && (Gt = !0, J && (a = _n, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = m, t.baseQueue = D, i.lastRenderedState = u;
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
          var m = r = r.next;
          do
            u = t(u, m.action), m = m.next;
          while (m !== r);
          ye(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, i];
      }
      function Es(t, e, a) {
        var i = pt, r = Bt(), u = _t;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var m = !ye(
          (jt || r).memoizedState,
          a
        );
        if (m && (r.memoizedState = a, Gt = !0), r = r.queue, cr(Cs.bind(null, i, r, t), [
          t
        ]), r.getSnapshot !== e || m || Yt !== null && Yt.memoizedState.tag & 1) {
          if (i.flags |= 2048, sn(
            9,
            { destroy: void 0 },
            Ts.bind(
              null,
              i,
              r,
              a,
              e
            ),
            null
          ), Mt === null) throw Error(s(349));
          u || (la & 127) !== 0 || Ns(i, e, a);
        }
        return a;
      }
      function Ns(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = pt.updateQueue, e === null ? (e = Nl(), pt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function Ts(t, e, a, i) {
        e.value = a, e.getSnapshot = i, js(e) && Ms(t);
      }
      function Cs(t, e, a) {
        return a(function() {
          js(e) && Ms(t);
        });
      }
      function js(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ye(t, a);
        } catch {
          return !0;
        }
      }
      function Ms(t) {
        var e = qa(t, 2);
        e !== null && ue(e, t, 2);
      }
      function or(t) {
        var e = se();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Ia) {
            it(!0);
            try {
              a();
            } finally {
              it(!1);
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
      function As(t, e, a, i) {
        return t.baseState = a, ir(
          t,
          jt,
          typeof i == "function" ? i : Fe
        );
      }
      function am(t, e, a, i, r) {
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
          ot.T !== null ? a(!0) : u.isTransition = !1, i(u), a = e.pending, a === null ? (u.next = e.pending = u, Os(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function Os(t, e) {
        var a = e.action, i = e.payload, r = t.state;
        if (e.isTransition) {
          var u = ot.T, m = {};
          ot.T = m;
          try {
            var k = a(r, i), D = ot.S;
            D !== null && D(m, k), Rs(t, e, k);
          } catch (K) {
            sr(t, e, K);
          } finally {
            u !== null && m.types !== null && (u.types = m.types), ot.T = u;
          }
        } else
          try {
            u = a(r, i), Rs(t, e, u);
          } catch (K) {
            sr(t, e, K);
          }
      }
      function Rs(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(i) {
            Hs(t, e, i);
          },
          function(i) {
            return sr(t, e, i);
          }
        ) : Hs(t, e, a);
      }
      function Hs(t, e, a) {
        e.status = "fulfilled", e.value = a, Ds(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Os(t, a)));
      }
      function sr(t, e, a) {
        var i = t.pending;
        if (t.pending = null, i !== null) {
          i = i.next;
          do
            e.status = "rejected", e.reason = a, Ds(e), e = e.next;
          while (e !== i);
        }
        t.action = null;
      }
      function Ds(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Us(t, e) {
        return e;
      }
      function Bs(t, e) {
        if (_t) {
          var a = Mt.formState;
          if (a !== null) {
            t: {
              var i = pt;
              if (_t) {
                if (Ot) {
                  var r = yp(
                    Ot,
                    Te
                  );
                  if (r) {
                    Ot = Au(r), i = xp(r);
                    break t;
                  }
                }
                dt(i);
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
          lastRenderedReducer: Us,
          lastRenderedState: e
        }, a.queue = i, a = ac.bind(
          null,
          pt,
          i
        ), i.dispatch = a, i = or(!1);
        var u = mr.bind(
          null,
          pt,
          !1,
          i.queue
        );
        return i = se(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, i.queue = r, a = am.bind(
          null,
          pt,
          r,
          u,
          a
        ), r.dispatch = a, i.memoizedState = t, [e, a, !1];
      }
      function qs(t) {
        var e = Bt();
        return Ys(e, jt, t);
      }
      function Ys(t, e, a) {
        if (e = ir(
          t,
          e,
          Us
        )[0], t = Cl(Fe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var i = Gn(e);
          } catch (m) {
            throw m === Sn ? ni : m;
          }
        else i = e;
        e = Bt();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (pt.flags |= 2048, sn(
          9,
          { destroy: void 0 },
          nm.bind(null, r, a),
          null
        )), [i, u, t];
      }
      function nm(t, e) {
        t.action = e;
      }
      function Gs(t) {
        var e = Bt(), a = jt;
        if (a !== null)
          return Ys(e, a, t);
        Bt(), e = e.memoizedState, a = Bt();
        var i = a.queue.dispatch;
        return a.memoizedState = t, [e, i, !1];
      }
      function sn(t, e, a, i) {
        return t = { tag: t, create: a, deps: i, inst: e, next: null }, e = pt.updateQueue, e === null && (e = Nl(), pt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (i = a.next, a.next = t, t.next = i, e.lastEffect = t), t;
      }
      function Ks() {
        return Bt().memoizedState;
      }
      function jl(t, e, a, i) {
        var r = se();
        pt.flags |= t, r.memoizedState = sn(
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
        jt !== null && i !== null && Pi(i, jt.memoizedState.deps) ? r.memoizedState = sn(e, u, a, i) : (pt.flags |= t, r.memoizedState = sn(
          1 | e,
          u,
          a,
          i
        ));
      }
      function Qs(t, e) {
        jl(8390656, 8, t, e);
      }
      function cr(t, e) {
        Ml(2048, 8, t, e);
      }
      function lm(t) {
        pt.flags |= 4;
        var e = pt.updateQueue;
        if (e === null)
          e = Nl(), pt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Vs(t) {
        var e = Bt().memoizedState;
        return lm({ ref: e, nextImpl: t }), function() {
          if ((vt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Xs(t, e) {
        return Ml(4, 2, t, e);
      }
      function Zs(t, e) {
        return Ml(4, 4, t, e);
      }
      function Js(t, e) {
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
      function Ls(t, e, a) {
        a = a != null ? a.concat([t]) : null, Ml(
          4,
          4,
          Js.bind(null, e, t),
          a
        );
      }
      function ur() {
      }
      function Ws(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        return e !== null && Pi(e, i[1]) ? i[0] : (a.memoizedState = [t, e], t);
      }
      function Fs(t, e) {
        var a = Bt();
        e = e === void 0 ? null : e;
        var i = a.memoizedState;
        if (e !== null && Pi(e, i[1]))
          return i[0];
        if (i = t(), Ia) {
          it(!0);
          try {
            t();
          } finally {
            it(!1);
          }
        }
        return a.memoizedState = [i, e], i;
      }
      function dr(t, e, a) {
        return a === void 0 || (la & 1073741824) !== 0 && (xt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Zc(), pt.lanes |= t, Ea |= t, a);
      }
      function Is(t, e, a, i) {
        return ye(a, e) ? a : En.current !== null ? (t = dr(t, a, i), ye(t, e) || (Gt = !0), t) : (la & 42) === 0 || (la & 1073741824) !== 0 && (xt & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = Zc(), pt.lanes |= t, Ea |= t, e);
      }
      function $s(t, e, a, i, r) {
        var u = aa();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var m = ot.T, k = {};
        ot.T = k, mr(t, !1, e, a);
        try {
          var D = r(), K = ot.S;
          if (K !== null && K(k, D), D !== null && typeof D == "object" && typeof D.then == "function") {
            var J = tm(
              D,
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
          Lt(u), m !== null && k.types !== null && (m.types = k.types), ot.T = m;
        }
      }
      function Ps(t) {
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
      function fr() {
        return $t(Xa);
      }
      function tc() {
        return Bt().memoizedState;
      }
      function ec() {
        return Bt().memoizedState;
      }
      function im(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = he();
              t = ma(a);
              var i = pa(e, t, a);
              i !== null && (ue(i, e, a), Bn(i, e, a)), e = { cache: Qi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function rm(t, e, a) {
        var i = he();
        a = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Al(t) ? nc(e, a) : (a = Zi(t, e, a, i), a !== null && (ue(a, t, i), lc(a, e, i)));
      }
      function ac(t, e, a) {
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
        if (Al(t)) nc(e, r);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var m = e.lastRenderedState, k = u(m, a);
              if (r.hasEagerState = !0, r.eagerState = k, ye(k, m))
                return kl(t, e, r, 0), Mt === null && Sl(), !1;
            } catch {
            } finally {
            }
          if (a = Zi(t, e, r, i), a !== null)
            return ue(a, t, i), lc(a, e, i), !0;
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
          ), e !== null && ue(e, t, 2);
      }
      function Al(t) {
        var e = t.alternate;
        return t === pt || e !== null && e === pt;
      }
      function nc(t, e) {
        Nn = ri = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function lc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var i = e.lanes;
          i &= t.pendingLanes, a |= i, e.lanes = a, A(t, a);
        }
      }
      function pr(t, e, a, i) {
        e = t.memoizedState, a = a(i, e), a = a == null ? e : Qr({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function ic(t, e, a, i, r, u, m) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(i, u, m) : e.prototype && e.prototype.isPureReactComponent ? !xl(a, i) || !xl(r, u) : !0;
      }
      function rc(t, e, a, i) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, i), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, i), e.state !== t && ho.enqueueReplaceState(e, e.state, null);
      }
      function Ya(t, e) {
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
      function oc(t, e, a) {
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
      function sc(t) {
        return t = ma(t), t.tag = 3, t;
      }
      function cc(t, e, a, i) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = i.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            oc(e, a, i);
          };
        }
        var m = a.stateNode;
        m !== null && typeof m.componentDidCatch == "function" && (t.callback = function() {
          oc(e, a, i), typeof r != "function" && (Na === null ? Na = /* @__PURE__ */ new Set([this]) : Na.add(this));
          var k = i.stack;
          this.componentDidCatch(i.value, {
            componentStack: k !== null ? k : ""
          });
        });
      }
      function om(t, e, a, i, r) {
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
        if (_t)
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
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = sc(r), cc(
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
      function Pt(t, e, a, i) {
        e.child = t === null ? Wu(e, null, a, i) : Fa(
          e,
          t.child,
          a,
          i
        );
      }
      function uc(t, e, a, i, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in i) {
          var m = {};
          for (var k in i)
            k !== "ref" && (m[k] = i[k]);
        } else m = i;
        return Ua(e), i = tr(
          t,
          e,
          a,
          m,
          u,
          r
        ), k = er(), t !== null && !Gt ? (ar(t, e, r), Ie(t, e, r)) : (_t && k && Y(e), e.flags |= 1, Pt(t, e, i, r), e.child);
      }
      function dc(t, e, a, i, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !qr(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, fc(
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
      function fc(t, e, a, i, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (xl(u, i) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = i = u, _r(t, r))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, Ie(t, e, r);
        }
        return gr(
          t,
          e,
          a,
          i,
          r
        );
      }
      function mc(t, e, a, i) {
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
            return pc(
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
            ), u !== null ? _s(e, u) : Fi(), Ss(e);
          else
            return i = e.lanes = 536870912, pc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              i
            );
        } else
          u !== null ? (yl(e, u.cachePool), _s(e, u), ga(), e.memoizedState = null) : (t !== null && yl(e, null), Fi(), ga());
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
      function pc(t, e, a, i, r) {
        var u = Xi();
        return u = u === null ? null : {
          parent: ea ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && yl(e, null), Fi(), Ss(e), t !== null && rn(t, e, i, !0), e.childLanes = r, null;
      }
      function Rl(t, e) {
        return e = Dl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function hc(t, e, a) {
        return Fa(e, t.child, null, a), t = Rl(
          e,
          e.pendingProps
        ), t.flags |= 2, pe(e), e.memoizedState = null, t;
      }
      function sm(t, e, a) {
        var i = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (_t) {
            if (i.mode === "hidden")
              return t = Rl(e, i), e.lanes = 536870912, Qn(null, t);
            if ($i(e), (t = Ot) ? (t = Cp(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = fu(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw dt(e);
            return e.lanes = 536870912, null;
          }
          return Rl(e, i);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var m = u.dehydrated;
          if ($i(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = hc(
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
            if (i = Mt, i !== null && (m = G(i, a), m !== 0 && m !== u.retryLane))
              throw u.retryLane = m, qa(t, m), ue(i, t, m), go;
            Kl(), e = hc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, re && (Ot = kp(m), ee = e, _t = !0, Sa = null, Te = !1, t !== null && tt(e, t)), e = Rl(e, i), e.flags |= 4096;
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
      function gr(t, e, a, i, r) {
        return Ua(e), a = tr(
          t,
          e,
          a,
          i,
          void 0,
          r
        ), i = er(), t !== null && !Gt ? (ar(t, e, r), Ie(t, e, r)) : (_t && i && Y(e), e.flags |= 1, Pt(t, e, a, r), e.child);
      }
      function gc(t, e, a, i, r, u) {
        return Ua(e), e.updateQueue = null, a = zs(
          e,
          i,
          a,
          r
        ), ks(t), i = er(), t !== null && !Gt ? (ar(t, e, u), Ie(t, e, u)) : (_t && i && Y(e), e.flags |= 1, Pt(t, e, a, u), e.child);
      }
      function bc(t, e, a, i, r) {
        if (Ua(e), e.stateNode === null) {
          var u = bn, m = a.contextType;
          typeof m == "object" && m !== null && (u = $t(m)), u = new a(i, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = ho, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = i, u.state = e.memoizedState, u.refs = {}, Ji(e), m = a.contextType, u.context = typeof m == "object" && m !== null ? $t(m) : bn, u.state = e.memoizedState, m = a.getDerivedStateFromProps, typeof m == "function" && (pr(
            e,
            a,
            m,
            i
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (m = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), m !== u.state && ho.enqueueReplaceState(
            u,
            u.state,
            null
          ), Yn(e, i, u, r), qn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !0;
        } else if (t === null) {
          u = e.stateNode;
          var k = e.memoizedProps, D = Ya(a, k);
          u.props = D;
          var K = u.context, J = a.contextType;
          m = bn, typeof J == "object" && J !== null && (m = $t(J));
          var X = a.getDerivedStateFromProps;
          J = typeof X == "function" || typeof u.getSnapshotBeforeUpdate == "function", k = e.pendingProps !== k, J || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (k || K !== m) && rc(
            e,
            u,
            i,
            m
          ), ka = !1;
          var W = e.memoizedState;
          u.state = W, Yn(e, i, u, r), qn(), K = e.memoizedState, k || W !== K || ka ? (typeof X == "function" && (pr(
            e,
            a,
            X,
            i
          ), K = e.memoizedState), (D = ka || ic(
            e,
            a,
            D,
            i,
            W,
            K,
            m
          )) ? (J || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = i, e.memoizedState = K), u.props = i, u.state = K, u.context = m, i = D) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), i = !1);
        } else {
          u = e.stateNode, Li(t, e), m = e.memoizedProps, J = Ya(a, m), u.props = J, X = e.pendingProps, W = u.context, K = a.contextType, D = bn, typeof K == "object" && K !== null && (D = $t(K)), k = a.getDerivedStateFromProps, (K = typeof k == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (m !== X || W !== D) && rc(
            e,
            u,
            i,
            D
          ), ka = !1, W = e.memoizedState, u.state = W, Yn(e, i, u, r), qn();
          var ft = e.memoizedState;
          m !== X || W !== ft || ka || t !== null && t.dependencies !== null && gl(t.dependencies) ? (typeof k == "function" && (pr(
            e,
            a,
            k,
            i
          ), ft = e.memoizedState), (J = ka || ic(
            e,
            a,
            J,
            i,
            W,
            ft,
            D
          ) || t !== null && t.dependencies !== null && gl(t.dependencies)) ? (K || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(i, ft, D), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            i,
            ft,
            D
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && W === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && W === t.memoizedState || (e.flags |= 1024), e.memoizedProps = i, e.memoizedState = ft), u.props = i, u.state = ft, u.context = D, i = J) : (typeof u.componentDidUpdate != "function" || m === t.memoizedProps && W === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || m === t.memoizedProps && W === t.memoizedState || (e.flags |= 1024), i = !1);
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
      function vc(t, e, a, i) {
        return Re(), e.flags |= 256, Pt(t, e, a, i), e.child;
      }
      function br(t) {
        return { baseLanes: t, cachePool: ms() };
      }
      function vr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= _e), t;
      }
      function yc(t, e, a) {
        var i = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, m;
        if ((m = u) || (m = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), m && (r = !0, e.flags &= -129), m = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (_t) {
            if (r ? ha(e) : ga(), (t = Ot) ? (t = jp(
              t,
              Te
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: wa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = fu(t), a.return = e, e.child = a, ee = e, Ot = null)) : t = null, t === null) throw dt(e);
            return Pr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var k = i.children;
          return i = i.fallback, r ? (ga(), r = e.mode, k = Dl(
            { mode: "hidden", children: k },
            r
          ), i = Qa(
            i,
            r,
            a,
            null
          ), k.return = e, i.return = e, k.sibling = i, e.child = k, i = e.child, i.memoizedState = br(a), i.childLanes = vr(
            t,
            m,
            a
          ), e.memoizedState = bo, Qn(null, i)) : (ha(e), yr(e, k));
        }
        var D = t.memoizedState;
        if (D !== null && (k = D.dehydrated, k !== null)) {
          if (u)
            e.flags & 256 ? (ha(e), e.flags &= -257, e = xr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ga(), e.child = t.child, e.flags |= 128, e = null) : (ga(), k = i.fallback, r = e.mode, i = Dl(
              { mode: "visible", children: i.children },
              r
            ), k = Qa(
              k,
              r,
              a,
              null
            ), k.flags |= 2, i.return = e, k.return = e, i.sibling = k, e.child = i, Fa(
              e,
              t.child,
              null,
              a
            ), i = e.child, i.memoizedState = br(a), i.childLanes = vr(
              t,
              m,
              a
            ), e.memoizedState = bo, e = Qn(null, i));
          else if (ha(e), Pr(k))
            m = bp(k).digest, i = Error(s(419)), i.stack = "", i.digest = m, Hn({ value: i, source: null, stack: null }), e = xr(
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
            if (m = Mt, m !== null && (i = G(
              m,
              a
            ), i !== 0 && i !== D.retryLane))
              throw D.retryLane = i, qa(t, i), ue(m, t, i), go;
            $r(k) || Kl(), e = xr(
              t,
              e,
              a
            );
          } else
            $r(k) ? (e.flags |= 192, e.child = t.child, e = null) : (t = D.treeContext, re && (Ot = zp(
              k
            ), ee = e, _t = !0, Sa = null, Te = !1, t !== null && tt(e, t)), e = yr(
              e,
              i.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ga(), k = i.fallback, r = e.mode, D = t.child, u = D.sibling, i = ta(D, {
          mode: "hidden",
          children: i.children
        }), i.subtreeFlags = D.subtreeFlags & 65011712, u !== null ? k = ta(
          u,
          k
        ) : (k = Qa(
          k,
          r,
          a,
          null
        ), k.flags |= 2), k.return = e, i.return = e, i.sibling = k, e.child = i, Qn(null, i), i = e.child, k = t.child.memoizedState, k === null ? k = br(a) : (r = k.cachePool, r !== null ? (D = ea ? Rt._currentValue : Rt._currentValue2, r = r.parent !== D ? { parent: D, pool: D } : r) : r = ms(), k = {
          baseLanes: k.baseLanes | a,
          cachePool: r
        }), i.memoizedState = k, i.childLanes = vr(
          t,
          m,
          a
        ), e.memoizedState = bo, Qn(t.child, i)) : (ha(e), a = t.child, t = a.sibling, a = ta(a, {
          mode: "visible",
          children: i.children
        }), a.return = e, a.sibling = null, t !== null && (m = e.deletions, m === null ? (e.deletions = [t], e.flags |= 16) : m.push(t)), e.child = a, e.memoizedState = null, a);
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
        return Fa(e, t.child, null, a), t = yr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function xc(t, e, a) {
        t.lanes |= e;
        var i = t.alternate;
        i !== null && (i.lanes |= e), Gi(t.return, e, a);
      }
      function wr(t, e, a, i, r, u) {
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
      function wc(t, e, a) {
        var i = e.pendingProps, r = i.revealOrder, u = i.tail;
        i = i.children;
        var m = qt.current, k = (m & 2) !== 0;
        if (k ? (m = m & 1 | 2, e.flags |= 128) : m &= 1, x(qt, m), Pt(t, e, i, a), i = _t ? tl : 0, !k && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && xc(t, a, e);
            else if (t.tag === 19)
              xc(t, a, e);
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
      function _r(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && gl(t)));
      }
      function cm(t, e, a) {
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
              return e.flags |= 128, $i(e), null;
            break;
          case 13:
            var i = e.memoizedState;
            if (i !== null)
              return i.dehydrated !== null ? (ha(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? yc(
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
                return wc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), x(qt, qt.current), i) break;
            return null;
          case 22:
            return e.lanes = 0, mc(
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
      function _c(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!_r(t, a) && (e.flags & 128) === 0)
              return Gt = !1, cm(
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
                qr(t) ? (i = Ya(t, i), e.tag = 1, e = bc(
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
                    e.tag = 11, e = uc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  } else if (r === Lr) {
                    e.tag = 14, e = dc(
                      null,
                      e,
                      t,
                      i,
                      a
                    );
                    break t;
                  }
                }
                throw e = C(t) || t, Error(s(306, e, ""));
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
            return i = e.type, r = Ya(
              i,
              e.pendingProps
            ), bc(
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
              r = e.memoizedState, i = r.element, Li(t, e), Yn(e, u, null, a);
              var m = e.memoizedState;
              if (u = m.cache, fa(e, Rt, u), u !== r.cache && Ki(
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
                  e = vc(
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
                  ), Hn(i), e = vc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (re && (Ot = Sp(
                    e.stateNode.containerInfo
                  ), ee = e, _t = !0, Sa = null, Te = !0), a = Wu(
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
              return Hl(t, e), t === null ? (a = Hu(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : _t || (e.stateNode = Fp(
                e.type,
                e.pendingProps,
                _a.current,
                e
              )) : e.memoizedState = Hu(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return St(e), t === null && Vt && _t && (i = e.stateNode = Gu(
                e.type,
                e.pendingProps,
                _a.current,
                te.current,
                !1
              ), ee = e, Te = !0, Ot = Ep(
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
            return t === null && _t && (Jp(
              e.type,
              e.pendingProps,
              te.current
            ), (r = i = Ot) && (i = Np(
              i,
              e.type,
              e.pendingProps,
              Te
            ), i !== null ? (e.stateNode = i, ee = e, Ot = _p(i), Te = !1, r = !0) : r = !1), r || dt(e)), St(e), r = e.type, u = e.pendingProps, m = t !== null ? t.memoizedProps : null, i = u.children, Jl(r, u) ? i = null : m !== null && Jl(r, m) && (e.flags |= 32), e.memoizedState !== null && (r = tr(
              t,
              e,
              em,
              null,
              null,
              a
            ), ea ? Xa._currentValue = r : Xa._currentValue2 = r), Hl(t, e), Pt(t, e, i, a), e.child;
          case 6:
            return t === null && _t && (Lp(
              e.pendingProps,
              te.current
            ), (t = a = Ot) && (a = Tp(
              a,
              e.pendingProps,
              Te
            ), a !== null ? (e.stateNode = a, ee = e, Ot = null, t = !0) : t = !1), t || dt(e)), null;
          case 13:
            return yc(t, e, a);
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
            return uc(
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
            return dc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return fc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return wc(
              t,
              e,
              a
            );
          case 31:
            return sm(t, e, a);
          case 22:
            return mc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ua(e), i = $t(Rt), t === null ? (r = Xi(), r === null && (r = Mt, u = Qi(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: i,
              cache: r
            }, Ji(e), fa(e, Rt, r)) : ((t.lanes & a) !== 0 && (Li(t, e), Yn(e, null, null, a), qn()), r = t.memoizedState, u = e.memoizedState, r.parent !== i ? (r = { parent: i, cache: i }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), fa(e, Rt, i)) : (i = u.cache, fa(e, Rt, i), i !== r.cache && Ki(
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
      function He(t) {
        t.flags |= 4;
      }
      function Ul(t) {
        Qe && (t.flags |= 8);
      }
      function Sc(t, e) {
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
              a && i && (u = ju(
                u,
                r.type,
                r.memoizedProps
              )), Fr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && i && (u = Mu(
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
      function kc(t, e, a, i) {
        var r = !1;
        if (Qe)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var m = u.stateNode;
              a && i && (m = ju(
                m,
                u.type,
                u.memoizedProps
              )), Tu(t, m);
            } else if (u.tag === 6)
              m = u.stateNode, a && i && (m = Mu(
                m,
                u.memoizedProps
              )), Tu(t, m);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), kc(t, u, !0, !0), r = !0;
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
      function zc(t, e) {
        if (Qe && Sc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, i = Nu();
          kc(i, e, !1, !1), t.pendingChildren = i, He(e), gp(a, i);
        }
      }
      function kr(t, e, a, i) {
        if (ie)
          t.memoizedProps !== i && He(e);
        else if (Qe) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = Sc(t, e)) || u !== i) {
            var m = te.current;
            u = hp(
              r,
              a,
              u,
              i,
              !t,
              null
            ), u === r ? e.stateNode = r : (Ul(e), _u(
              u,
              a,
              i,
              m
            ) && He(e), e.stateNode = u, t && Sr(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function zr(t, e, a, i, r) {
        if ((t.mode & 32) !== 0 && (a === null ? Km(e, i) : Qm(e, a, i))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Ir(e, i))
            if (ku(t.stateNode, e, i))
              t.flags |= 8192;
            else if (Ic()) t.flags |= 8192;
            else
              throw Wa = li, uo;
        } else t.flags &= -16777217;
      }
      function Ec(t, e) {
        if ($p(e)) {
          if (t.flags |= 16777216, !Yu(e))
            if (Ic()) t.flags |= 8192;
            else
              throw Wa = li, uo;
        } else t.flags &= -16777217;
      }
      function Bl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? Q() : 536870912, t.lanes |= e, Mn |= e);
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
      function um(t, e, a) {
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
            return a = e.stateNode, i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), We(Rt), rt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Oe(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, da())), zc(t, e), At(e), null;
          case 26:
            if (Be) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (At(e), Ec(
                e,
                u
              )) : (At(e), zr(
                e,
                r,
                null,
                i,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), At(e), Ec(
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
                t = te.current, Oe(e) ? Ha(e, t) : (t = Gu(
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
              if (u = te.current, Oe(e))
                Ha(e, u), Gp(
                  e.stateNode,
                  r,
                  i,
                  u
                ) && (e.flags |= 64);
              else {
                var m = Rm(
                  r,
                  i,
                  _a.current,
                  u,
                  e
                );
                Ul(e), Sr(m, e, !1, !1), e.stateNode = m, _u(
                  m,
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
              a = t.memoizedProps, ie ? a !== i && He(e) : Qe && (a !== i ? (t = _a.current, a = te.current, Ul(e), e.stateNode = Su(
                i,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof i != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = _a.current, a = te.current, Oe(e)) {
                if (!re) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, i = null, r = ee, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      i = r.memoizedProps;
                  }
                Ap(
                  t,
                  a,
                  e,
                  i
                ) || dt(e, !0);
              } else
                Ul(e), e.stateNode = Su(
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
                  Op(t, e);
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
                  Rp(r, e);
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
            return rt(), zc(t, e), t === null && Bm(e.stateNode.containerInfo), At(e), null;
          case 10:
            return We(e.type), At(e), null;
          case 19:
            if (v(qt), i = e.memoizedState, i === null) return At(e), null;
            if (r = (e.flags & 128) !== 0, u = i.rendering, u === null)
              if (r) Vn(i, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = El(t), u !== null) {
                      for (e.flags |= 128, Vn(i, !1), t = u.updateQueue, e.updateQueue = t, Bl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        du(a, t), a = a.sibling;
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
            return pe(e), Ii(), i = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== i && (e.flags |= 8192) : i && (e.flags |= 8192), i ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (At(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : At(e), a = e.updateQueue, a !== null && Bl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), i = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (i = e.memoizedState.cachePool.pool), i !== a && (e.flags |= 2048), t !== null && v(La), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), We(Rt), At(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function dm(t, e) {
        switch (nt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return We(Rt), rt(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
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
            return rt(), null;
          case 10:
            return We(e.type), null;
          case 22:
          case 23:
            return pe(e), Ii(), t !== null && v(La), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return We(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Nc(t, e) {
        switch (nt(e), e.tag) {
          case 3:
            We(Rt), rt();
            break;
          case 26:
          case 27:
          case 5:
            Jt(e);
            break;
          case 4:
            rt();
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
            We(e.type);
            break;
          case 22:
          case 23:
            pe(e), Ii(), t !== null && v(La);
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
        } catch (k) {
          kt(e, e.return, k);
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
                var m = i.inst, k = m.destroy;
                if (k !== void 0) {
                  m.destroy = void 0, r = e;
                  var D = a, K = k;
                  try {
                    K();
                  } catch (J) {
                    kt(
                      r,
                      D,
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
      function Tc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            ws(e, a);
          } catch (i) {
            kt(t, t.return, i);
          }
        }
      }
      function Cc(t, e, a) {
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
      function jc(t) {
        var e = t.type, a = t.memoizedProps, i = t.stateNode;
        try {
          lp(i, e, a, t);
        } catch (r) {
          kt(t, t.return, r);
        }
      }
      function Er(t, e, a) {
        try {
          ip(
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
      function Mc(t) {
        return t.tag === 5 || t.tag === 3 || (Be ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && hn(t.type) : !1) || t.tag === 4;
      }
      function Nr(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Mc(t.return)) return null;
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
          t = t.stateNode, e ? op(a, t, e) : ap(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Tr(t, e, a), t = t.sibling; t !== null; )
            Tr(t, e, a), t = t.sibling;
      }
      function ql(t, e, a) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? rp(a, t, e) : ep(a, t);
        else if (i !== 4 && (Vt && i === 27 && hn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (ql(t, e, a), t = t.sibling; t !== null; )
            ql(t, e, a), t = t.sibling;
      }
      function Ac(t, e, a) {
        t = t.containerInfo;
        try {
          Cu(t, a);
        } catch (i) {
          kt(e, e.return, i);
        }
      }
      function Oc(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          th(
            t.type,
            a,
            e,
            t
          );
        } catch (i) {
          kt(t, t.return, i);
        }
      }
      function fm(t, e) {
        for (Am(t.containerInfo), Wt = e; Wt !== null; )
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
                    } catch (k) {
                      kt(i, i.return, k);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ie && pp(t.stateNode.containerInfo);
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
      function Rc(t, e, a) {
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
            i & 64 && Tc(a), i & 512 && Zn(a, a.return);
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
                ws(i, t);
              } catch (m) {
                kt(a, a.return, m);
              }
            }
            break;
          case 27:
            Vt && e === null && i & 4 && Oc(a);
          case 26:
          case 5:
            if ($e(t, a), e === null) {
              if (i & 4) jc(a);
              else if (i & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  Up(
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
            $e(t, a), i & 4 && Dc(t, a);
            break;
          case 13:
            $e(t, a), i & 4 && Uc(t, a), i & 64 && (i = a.memoizedState, i !== null && (i = i.dehydrated, i !== null && (a = ym.bind(
              null,
              a
            ), vp(i, a))));
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
      function Hc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Hc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Gm(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
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
              ), a.memoizedState ? Uu(a.memoizedState) : a.stateNode && qu(a.stateNode);
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
              ), Ku(a.stateNode), Qt = i, fe = r;
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
                    cp(Qt, a.stateNode);
                  } catch (u) {
                    kt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    sp(Qt, a.stateNode);
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
            ie && Qt !== null && (fe ? Vp(
              Qt,
              a.stateNode
            ) : Qp(Qt, a.stateNode));
            break;
          case 4:
            ie ? (i = Qt, r = fe, Qt = a.stateNode.containerInfo, fe = !0, De(
              t,
              e,
              a
            ), Qt = i, fe = r) : (Qe && Ac(
              a.stateNode,
              a,
              Nu()
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
            Kt || (Ke(a, e), i = a.stateNode, typeof i.componentWillUnmount == "function" && Cc(
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
      function Dc(t, e) {
        if (re && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            qp(t);
          } catch (a) {
            kt(e, e.return, a);
          }
        }
      }
      function Uc(t, e) {
        if (re && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Yp(t);
          } catch (a) {
            kt(e, e.return, a);
          }
      }
      function mm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new $u()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new $u()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function Yl(t, e) {
        var a = mm(t);
        e.forEach(function(i) {
          if (!a.has(i)) {
            a.add(i);
            var r = xm.bind(null, t, i);
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
              var k = m;
              t: for (; k !== null; ) {
                switch (k.tag) {
                  case 27:
                    if (Vt) {
                      if (hn(k.type)) {
                        Qt = k.stateNode, fe = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = k.stateNode, fe = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = k.stateNode.containerInfo, fe = !0;
                    break t;
                }
                k = k.return;
              }
              if (Qt === null) throw Error(s(160));
              Cr(u, m, r), Qt = null, fe = !1;
            } else Cr(u, m, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Bc(e, t), e = e.sibling;
      }
      function Bc(t, e) {
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
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Wp(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Bu(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Du(
                  r,
                  u,
                  t.memoizedProps
                ) : i !== u ? (i === null ? a.stateNode !== null && qu(a.stateNode) : Uu(i), u === null ? Bu(
                  r,
                  t.type,
                  t.stateNode
                ) : Du(
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
              le(e, t), ce(t), i & 512 && (Kt || a === null || Ke(a, a.return)), a !== null && i & 4 && Er(
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
                  Eu(r);
                } catch (X) {
                  kt(t, t.return, X);
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
            if (le(e, t), ce(t), i & 4 && ie) {
              if (t.stateNode === null)
                throw Error(s(162));
              i = t.memoizedProps, a = a !== null ? a.memoizedProps : i, r = t.stateNode;
              try {
                np(r, a, i);
              } catch (X) {
                kt(t, t.return, X);
              }
            }
            break;
          case 3:
            if (Be ? (Ip(), r = qe, qe = to(e.containerInfo), le(e, t), qe = r) : le(e, t), ce(t), i & 4) {
              if (ie && re && a !== null && a.memoizedState.isDehydrated)
                try {
                  Bp(e.containerInfo);
                } catch (X) {
                  kt(t, t.return, X);
                }
              if (Qe) {
                i = e.containerInfo, a = e.pendingChildren;
                try {
                  Cu(i, a);
                } catch (X) {
                  kt(t, t.return, X);
                }
              }
            }
            vo && (vo = !1, qc(t));
            break;
          case 4:
            Be ? (a = qe, qe = to(
              t.stateNode.containerInfo
            ), le(e, t), ce(t), qe = a) : (le(e, t), ce(t)), i & 4 && Qe && Ac(
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
            var m = a !== null && a.memoizedState !== null, k = ia, D = Kt;
            if (ia = k || r, Kt = D || m, le(e, t), Kt = D, ia = k, ce(t), i & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || m || ia || Kt || Ga(t)), ie)) {
              t: if (a = null, ie)
                for (e = t; ; ) {
                  if (e.tag === 5 || Be && e.tag === 26) {
                    if (a === null) {
                      m = a = e;
                      try {
                        u = m.stateNode, r ? up(u) : fp(
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
                        var K = m.stateNode;
                        r ? dp(K) : mp(K, m.memoizedProps);
                      } catch (X) {
                        kt(m, m.return, X);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      m = e;
                      try {
                        var J = m.stateNode;
                        r ? Xp(J) : Zp(m.stateNode);
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
              if (Mc(i)) {
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
                  var m = a.stateNode;
                  a.flags & 32 && (Eu(m), a.flags &= -33);
                  var k = Nr(t);
                  ql(t, k, m);
                  break;
                case 3:
                case 4:
                  var D = a.stateNode.containerInfo, K = Nr(t);
                  Tr(
                    t,
                    K,
                    D
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
      function qc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            qc(e), e.tag === 5 && e.flags & 1024 && Zm(e.stateNode), t = t.sibling;
          }
      }
      function $e(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Rc(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && Cc(
                e,
                e.return,
                a
              ), Ga(e);
              break;
            case 27:
              Vt && Ku(e.stateNode);
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
                } catch (K) {
                  kt(i, i.return, K);
                }
              if (i = u, r = i.updateQueue, r !== null) {
                var k = i.stateNode;
                try {
                  var D = r.shared.hiddenCallbacks;
                  if (D !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < D.length; r++)
                      xs(D[r], k);
                } catch (K) {
                  kt(i, i.return, K);
                }
              }
              a && m & 64 && Tc(u), Zn(u, u.return);
              break;
            case 27:
              Vt && Oc(u);
            case 26:
            case 5:
              Pe(
                r,
                u,
                a
              ), a && i === null && m & 4 && jc(u), Zn(u, u.return);
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
              ), a && m & 4 && Dc(r, u);
              break;
            case 13:
              Pe(
                r,
                u,
                a
              ), a && m & 4 && Uc(r, u);
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
            Yc(
              t,
              e,
              a,
              i
            ), e = e.sibling;
      }
      function Yc(t, e, a, i) {
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
                var u = e.memoizedProps, m = u.id, k = u.onPostCommit;
                typeof k == "function" && k(
                  m,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (D) {
                kt(e, e.return, D);
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
            )), r & 2048 && jr(m, e);
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
          var u = t, m = e, k = a, D = i, K = m.flags;
          switch (m.tag) {
            case 0:
            case 11:
            case 15:
              cn(
                u,
                m,
                k,
                D,
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
                k,
                D,
                r
              ) : Jn(
                u,
                m
              ) : (J._visibility |= 2, cn(
                u,
                m,
                k,
                D,
                r
              )), r && K & 2048 && jr(
                m.alternate,
                m
              );
              break;
            case 24:
              cn(
                u,
                m,
                k,
                D,
                r
              ), r && K & 2048 && Mr(m.alternate, m);
              break;
            default:
              cn(
                u,
                m,
                k,
                D,
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
      function Ka(t, e, a) {
        if (t.subtreeFlags & Cn)
          for (t = t.child; t !== null; )
            Gc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Gc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ka(
              t,
              e,
              a
            ), t.flags & Cn)
              if (t.memoizedState !== null)
                Pp(
                  a,
                  qe,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var i = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Ir(r, t)) && zu(a, i, r, t);
              }
            break;
          case 5:
            Ka(
              t,
              e,
              a
            ), t.flags & Cn && (i = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Ir(r, t)) && zu(a, i, r, t));
            break;
          case 3:
          case 4:
            Be ? (i = qe, qe = to(
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
      function Kc(t) {
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
              Wt = i, Vc(
                i,
                t
              );
            }
          Kc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Qc(t), t = t.sibling;
      }
      function Qc(t) {
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
              Wt = i, Vc(
                i,
                t
              );
            }
          Kc(t);
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
      function Vc(t, e) {
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
              if (Hc(i), i === a) {
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
        var e = Um(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Wm(t), t === null) throw Error(s(362));
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
                var i = t[a++], r = i.tag, u = t[a++], m = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !$n(i)) {
                  for (; m != null && Or(i, m); )
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
            if ((a === 5 || a === 26 || a === 27) && $m(t.stateNode, e.value))
              return !0;
            break;
          case fi:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Im(t), t !== null && 0 <= t.indexOf(e.value)))
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
            return "<" + (C(t.value) || "Unknown") + ">";
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
      function Xc(t, e) {
        var a = [];
        t = [t, 0];
        for (var i = 0; i < t.length; ) {
          var r = t[i++], u = r.tag, m = t[i++], k = e[m];
          if (u !== 5 && u !== 26 && u !== 27 || !$n(r)) {
            for (; k != null && Or(r, k); )
              m++, k = e[m];
            if (m === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, m), r = r.sibling;
          }
        }
        return a;
      }
      function Hr(t, e) {
        if (!In) throw Error(s(363));
        t = Ar(t), t = Xc(t, e), e = [], t = Array.from(t);
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
        return (vt & 2) !== 0 && xt !== 0 ? xt & -xt : ot.T !== null ? Vi() : qm();
      }
      function Zc() {
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
        )), O(t, a), ((vt & 2) === 0 || t !== Mt) && (t === Mt && ((vt & 2) === 0 && ($a |= a), Ut === 4 && va(
          t,
          xt,
          _e,
          !1
        )), Ge(t));
      }
      function Jc(t, e, a) {
        if ((vt & 6) !== 0) throw Error(s(327));
        var i = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || E(t, e), r = i ? gm(t, e) : Ur(t, e, !0), u = i;
        do {
          if (r === 0) {
            jn && !i && va(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !pm(a)) {
              r = Ur(t, e, !1), u = !1;
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
                  var k = t;
                  r = ol;
                  var D = re && k.current.memoizedState.isDehydrated;
                  if (D && (un(k, m).flags |= 256), m = Ur(
                    k,
                    m,
                    !1
                  ), m !== 2) {
                    if (yo && !D) {
                      k.errorRecoveryDisabledLanes |= u, $a |= u, r = 4;
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
                ), R(i, 0, !0) !== 0) break t;
                oa = e, i.timeoutHandle = Hm(
                  Lc.bind(
                    null,
                    i,
                    a,
                    me,
                    pi,
                    wo,
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
              Lc(
                i,
                a,
                me,
                pi,
                wo,
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
      function Lc(t, e, a, i, r, u, m, k, D, K, J, X, W, ft) {
        if (t.timeoutHandle = Va, X = e.subtreeFlags, X & 8192 || (X & 16785408) === 16785408) {
          X = Vm(), Gc(
            e,
            u,
            X
          );
          var ae = (u & 62914560) === u ? mi - de() : (u & 4194048) === u ? Pu - de() : 0;
          if (ae = Xm(
            X,
            ae
          ), ae !== null) {
            oa = u, t.cancelPendingCommit = ae(
              nu.bind(
                null,
                t,
                e,
                u,
                a,
                i,
                r,
                m,
                k,
                D,
                J,
                X,
                null,
                W,
                ft
              )
            ), va(t, u, m, !K);
            return;
          }
        }
        nu(
          t,
          e,
          u,
          a,
          i,
          r,
          m,
          k,
          D
        );
      }
      function pm(t) {
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
        e &= ~xo, e &= ~$a, t.suspendedLanes |= e, t.pingedLanes &= ~e, i && (t.warmLanes |= e), i = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - be(r), m = 1 << u;
          i[u] = -1, r &= ~m;
        }
        a !== 0 && g(t, a, e);
      }
      function Wc() {
        return (vt & 6) === 0 ? (on(0), !1) : !0;
      }
      function Dr() {
        if (yt !== null) {
          if (Ct === 0)
            var t = yt.return;
          else
            t = yt, na = Za = null, nr(t), kn = null, nl = 0, t = yt;
          for (; t !== null; )
            Nc(t.alternate, t), t = t.return;
          yt = null;
        }
      }
      function un(t, e) {
        var a = t.timeoutHandle;
        a !== Va && (t.timeoutHandle = Va, Dm(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), oa = 0, Dr(), Mt = t, yt = a = ta(t.current, null), xt = e, Ct = 0, we = null, za = !1, jn = E(t, e), yo = !1, Mn = _e = xo = $a = Ea = Ut = 0, me = ol = null, wo = !1, (e & 8) !== 0 && (e |= e & 32);
        var i = t.entangledLanes;
        if (i !== 0)
          for (t = t.entanglements, i &= e; 0 < i; ) {
            var r = 31 - be(i), u = 1 << r;
            e |= t[r], i &= ~u;
          }
        return ra = e, Sl(), a;
      }
      function Fc(t, e) {
        pt = null, ot.H = il, e === Sn || e === ni ? (e = gs(), Ct = 3) : e === uo ? (e = gs(), Ct = 4) : Ct = e === go ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, we = e, yt === null && (Ut = 1, Ol(
          t,
          B(e, t.current)
        ));
      }
      function Ic() {
        var t = xe.current;
        return t === null ? !0 : (xt & 4194048) === xt ? je === null : (xt & 62914560) === xt || (xt & 536870912) !== 0 ? t === je : !1;
      }
      function $c() {
        var t = ot.H;
        return ot.H = il, t === null ? il : t;
      }
      function Pc() {
        var t = ot.A;
        return ot.A = ph, t;
      }
      function Kl() {
        Ut = 4, za || (xt & 4194048) !== xt && xe.current !== null || (jn = !0), (Ea & 134217727) === 0 && ($a & 134217727) === 0 || Mt === null || va(
          Mt,
          xt,
          _e,
          !1
        );
      }
      function Ur(t, e, a) {
        var i = vt;
        vt |= 2;
        var r = $c(), u = Pc();
        (Mt !== t || xt !== e) && (pi = null, un(t, e)), e = !1;
        var m = Ut;
        t: do
          try {
            if (Ct !== 0 && yt !== null) {
              var k = yt, D = we;
              switch (Ct) {
                case 8:
                  Dr(), m = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  xe.current === null && (e = !0);
                  var K = Ct;
                  if (Ct = 0, we = null, dn(t, k, D, K), a && jn) {
                    m = 0;
                    break t;
                  }
                  break;
                default:
                  K = Ct, Ct = 0, we = null, dn(t, k, D, K);
              }
            }
            hm(), m = Ut;
            break;
          } catch (J) {
            Fc(t, J);
          }
        while (!0);
        return e && t.shellSuspendCounter++, na = Za = null, vt = i, ot.H = r, ot.A = u, yt === null && (Mt = null, xt = 0, Sl()), m;
      }
      function hm() {
        for (; yt !== null; ) tu(yt);
      }
      function gm(t, e) {
        var a = vt;
        vt |= 2;
        var i = $c(), r = Pc();
        Mt !== t || xt !== e ? (pi = null, sl = de() + 500, un(t, e)) : jn = E(
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
                  if (ps(u)) {
                    Ct = 0, we = null, eu(e);
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
                  ps(u) ? (Ct = 0, we = null, eu(e)) : (Ct = 0, we = null, dn(t, e, u, 7));
                  break;
                case 5:
                  var m = null;
                  switch (yt.tag) {
                    case 26:
                      m = yt.memoizedState;
                    case 5:
                    case 27:
                      var k = yt, D = k.type, K = k.pendingProps;
                      if (m ? Yu(m) : ku(k.stateNode, D, K)) {
                        Ct = 0, we = null;
                        var J = k.sibling;
                        if (J !== null) yt = J;
                        else {
                          var X = k.return;
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
                  Dr(), Ut = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            bm();
            break;
          } catch (W) {
            Fc(t, W);
          }
        while (!0);
        return na = Za = null, ot.H = i, ot.A = r, vt = a, yt !== null ? 0 : (Mt = null, xt = 0, Sl(), Ut);
      }
      function bm() {
        for (; yt !== null && !nh(); )
          tu(yt);
      }
      function tu(t) {
        var e = _c(
          t.alternate,
          t,
          ra
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : yt = e;
      }
      function eu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = gc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              xt
            );
            break;
          case 11:
            e = gc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              xt
            );
            break;
          case 5:
            nr(e);
          default:
            Nc(a, e), e = yt = du(e, ra), e = _c(a, e, ra);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : yt = e;
      }
      function dn(t, e, a, i) {
        na = Za = null, nr(e), kn = null, nl = 0;
        var r = e.return;
        try {
          if (om(
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
        e.flags & 32768 ? (_t || i === 1 ? t = !0 : jn || (xt & 536870912) !== 0 ? t = !1 : (za = t = !0, (i === 2 || i === 9 || i === 3 || i === 6) && (i = xe.current, i !== null && i.tag === 13 && (i.flags |= 16384))), au(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            au(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = um(
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
      function au(t, e) {
        do {
          var a = dm(t.alternate, t);
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
      function nu(t, e, a, i, r, u, m, k, D) {
        t.cancelPendingCommit = null;
        do
          Wn();
        while (Xt !== 0);
        if ((vt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= fo, h(
            t,
            a,
            u,
            m,
            k,
            D
          ), t === Mt && (yt = Mt = null, xt = 0), An = e, Ta = t, oa = a, _o = u, So = r, td = i, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, wm(no, function() {
            return su(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), i = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || i) {
            i = ot.T, ot.T = null, r = aa(), Lt(2), m = vt, vt |= 4;
            try {
              fm(t, e, a);
            } finally {
              vt = m, Lt(r), ot.T = i;
            }
          }
          Xt = 1, lu(), iu(), ru();
        }
      }
      function lu() {
        if (Xt === 1) {
          Xt = 0;
          var t = Ta, e = An, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = ot.T, ot.T = null;
            var i = aa();
            Lt(2);
            var r = vt;
            vt |= 4;
            try {
              Bc(e, t), Om(t.containerInfo);
            } finally {
              vt = r, Lt(i), ot.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function iu() {
        if (Xt === 2) {
          Xt = 0;
          var t = Ta, e = An, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = ot.T, ot.T = null;
            var i = aa();
            Lt(2);
            var r = vt;
            vt |= 4;
            try {
              Rc(t, e.alternate, e);
            } finally {
              vt = r, Lt(i), ot.T = a;
            }
          }
          Xt = 3;
        }
      }
      function ru() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, lh();
          var t = Ta, e = An, a = oa, i = td;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, An = Ta = null, ou(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Na = null), F(a), e = e.stateNode, ve && typeof ve.onCommitFiberRoot == "function")
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
            e = ot.T, r = aa(), Lt(2), ot.T = null;
            try {
              for (var u = t.onRecoverableError, m = 0; m < i.length; m++) {
                var k = i[m];
                u(k.value, {
                  componentStack: k.stack
                });
              }
            } finally {
              ot.T = e, Lt(r);
            }
          }
          (oa & 3) !== 0 && Wn(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === ko ? cl++ : (cl = 0, ko = t) : cl = 0, re && Kp(), on(0);
        }
      }
      function ou(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Dn(e)));
      }
      function Wn() {
        return lu(), iu(), ru(), su();
      }
      function su() {
        if (Xt !== 5) return !1;
        var t = Ta, e = _o;
        _o = 0;
        var a = F(oa), i = 32 > a ? 32 : a;
        a = ot.T;
        var r = aa();
        try {
          Lt(i), ot.T = null, i = So, So = null;
          var u = Ta, m = oa;
          if (Xt = 0, An = Ta = null, oa = 0, (vt & 6) !== 0)
            throw Error(s(331));
          var k = vt;
          if (vt |= 4, Qc(u.current), Yc(
            u,
            u.current,
            m,
            i
          ), vt = k, on(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot(Pn, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), ot.T = a, ou(t, e);
        }
      }
      function cu(t, e, a) {
        e = B(a, e), e = hr(t.stateNode, e, 2), t = pa(t, e, 2), t !== null && (O(t, 2), Ge(t));
      }
      function kt(t, e, a) {
        if (t.tag === 3)
          cu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              cu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var i = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof i.componentDidCatch == "function" && (Na === null || !Na.has(i))) {
                t = B(a, t), a = sc(2), i = pa(e, a, 2), i !== null && (cc(
                  a,
                  i,
                  e,
                  t
                ), O(i, 2), Ge(i));
                break;
              }
            }
            e = e.return;
          }
      }
      function Br(t, e, a) {
        var i = t.pingCache;
        if (i === null) {
          i = t.pingCache = new hh();
          var r = /* @__PURE__ */ new Set();
          i.set(e, r);
        } else
          r = i.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), i.set(e, r));
        r.has(a) || (yo = !0, r.add(a), t = vm.bind(null, t, e, a), e.then(t, t));
      }
      function vm(t, e, a) {
        var i = t.pingCache;
        i !== null && i.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Mt === t && (xt & a) === a && (Ut === 4 || Ut === 3 && (xt & 62914560) === xt && 300 > de() - mi ? (vt & 2) === 0 && un(t, 0) : xo |= a, Mn === xt && (Mn = 0)), Ge(t);
      }
      function uu(t, e) {
        e === 0 && (e = Q()), t = qa(t, e), t !== null && (O(t, e), Ge(t));
      }
      function ym(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), uu(t, a);
      }
      function xm(t, e) {
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
        i !== null && i.delete(e), uu(t, a);
      }
      function wm(t, e) {
        return Il(t, e);
      }
      function _m(t, e, a, i) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function qr(t) {
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
      function du(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Vl(t, e, a, i, r, u) {
        var m = 0;
        if (i = t, typeof t == "function") qr(t) && (m = 1);
        else if (typeof t == "string")
          m = Be && Vt ? Ru(t, a, te.current) ? 26 : Qu(t) ? 27 : 5 : Be ? Ru(
            t,
            a,
            te.current
          ) ? 26 : 5 : Vt && Qu(t) ? 27 : 5;
        else
          t: switch (t) {
            case Wr:
              return t = o(31, a, e, r), t.elementType = Wr, t.lanes = u, t;
            case mn:
              return Qa(
                a.children,
                r,
                u,
                e
              );
            case vu:
              m = 8, r |= 24;
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
                    m = 10;
                    break t;
                  case yu:
                    m = 9;
                    break t;
                  case Xr:
                    m = 11;
                    break t;
                  case Lr:
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
      function Yr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function fu(t) {
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
      function Sm(t, e, a, i, r, u, m, k, D) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Va, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = U(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = U(0), this.hiddenUpdates = U(null), this.identifierPrefix = i, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = m, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = D, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function mu(t, e, a, i, r, u, m, k, D, K, J, X) {
        return t = new Sm(
          t,
          e,
          a,
          m,
          D,
          K,
          J,
          X,
          k
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Qi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: i,
          isDehydrated: a,
          cache: e
        }, Ji(u), t;
      }
      function pu(t) {
        return t ? (t = bn, t) : bn;
      }
      function hu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? b(t) : null, t === null ? null : Fn(t.stateNode);
      }
      function gu(t, e, a, i, r, u) {
        r = pu(r), i.context === null ? i.context = r : i.pendingContext = r, i = ma(e), i.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (i.callback = u), a = pa(t, i, e), a !== null && (ue(a, t, e), Bn(a, t, e));
      }
      function bu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Kr(t, e) {
        bu(t, e), (t = t.alternate) && bu(t, e);
      }
      var bt = {}, km = Vh, ge = Zh(), Qr = Object.assign, zm = Symbol.for("react.element"), Xl = Symbol.for("react.transitional.element"), fn = Symbol.for("react.portal"), mn = Symbol.for("react.fragment"), vu = Symbol.for("react.strict_mode"), Vr = Symbol.for("react.profiler"), yu = Symbol.for("react.consumer"), ya = Symbol.for("react.context"), Xr = Symbol.for("react.forward_ref"), Zr = Symbol.for("react.suspense"), Jr = Symbol.for("react.suspense_list"), Lr = Symbol.for("react.memo"), xa = Symbol.for("react.lazy"), Wr = Symbol.for("react.activity"), Em = Symbol.for("react.memo_cache_sentinel"), xu = Symbol.iterator, Nm = Symbol.for("react.client.reference"), Zl = Array.isArray, ot = km.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Tm = l.rendererVersion, Cm = l.rendererPackageName, wu = l.extraDevToolsConfig, Fn = l.getPublicInstance, jm = l.getRootHostContext, Mm = l.getChildHostContext, Am = l.prepareForCommit, Om = l.resetAfterCommit, Rm = l.createInstance;
      l.cloneMutableInstance;
      var Fr = l.appendInitialChild, _u = l.finalizeInitialChildren, Jl = l.shouldSetTextContent, Su = l.createTextInstance;
      l.cloneMutableTextInstance;
      var Hm = l.scheduleTimeout, Dm = l.cancelTimeout, Va = l.noTimeout, ea = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ie = l.supportsMutation, Qe = l.supportsPersistence, re = l.supportsHydration, Um = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Bm = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Lt = l.setCurrentUpdatePriority, aa = l.getCurrentUpdatePriority, qm = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var Ym = l.shouldAttemptEagerTransition, Gm = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Km = l.maySuspendCommit, Qm = l.maySuspendCommitOnUpdate, Ir = l.maySuspendCommitInSyncRender, ku = l.preloadInstance, Vm = l.startSuspendingCommit, zu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Xm = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var pn = l.NotPendingTransition, Xa = l.HostTransitionContext, Zm = l.resetFormInstance;
      l.bindToConsole;
      var Jm = l.supportsMicrotasks, Lm = l.scheduleMicrotask, In = l.supportsTestSelectors, Wm = l.findFiberRoot, Fm = l.getBoundingRect, Im = l.getTextContent, $n = l.isHiddenSubtree, $m = l.matchAccessibilityRole, Pm = l.setFocusIfFocusable, tp = l.setupIntersectionObserver, ep = l.appendChild, ap = l.appendChildToContainer, np = l.commitTextUpdate, lp = l.commitMount, ip = l.commitUpdate, rp = l.insertBefore, op = l.insertInContainerBefore, sp = l.removeChild, cp = l.removeChildFromContainer, Eu = l.resetTextContent, up = l.hideInstance, dp = l.hideTextInstance, fp = l.unhideInstance, mp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var pp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var hp = l.cloneInstance, Nu = l.createContainerChildSet, Tu = l.appendChildToContainerChildSet, gp = l.finalizeContainerChildren, Cu = l.replaceContainerChildren, ju = l.cloneHiddenInstance, Mu = l.cloneHiddenTextInstance, $r = l.isSuspenseInstancePending, Pr = l.isSuspenseInstanceFallback, bp = l.getSuspenseInstanceFallbackErrorDetails, vp = l.registerSuspenseInstanceRetry, yp = l.canHydrateFormStateMarker, xp = l.isFormStateMarkerMatching, Au = l.getNextHydratableSibling, wp = l.getNextHydratableSiblingAfterSingleton, _p = l.getFirstHydratableChild, Sp = l.getFirstHydratableChildWithinContainer, kp = l.getFirstHydratableChildWithinActivityInstance, zp = l.getFirstHydratableChildWithinSuspenseInstance, Ep = l.getFirstHydratableChildWithinSingleton, Np = l.canHydrateInstance, Tp = l.canHydrateTextInstance, Cp = l.canHydrateActivityInstance, jp = l.canHydrateSuspenseInstance, Mp = l.hydrateInstance, Ap = l.hydrateTextInstance, Op = l.hydrateActivityInstance, Rp = l.hydrateSuspenseInstance, Hp = l.getNextHydratableInstanceAfterActivityInstance, Dp = l.getNextHydratableInstanceAfterSuspenseInstance, Up = l.commitHydratedInstance, Bp = l.commitHydratedContainer, qp = l.commitHydratedActivityInstance, Yp = l.commitHydratedSuspenseInstance, Gp = l.finalizeHydratedChildren, Kp = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Qp = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var Vp = l.clearSuspenseBoundaryFromContainer, Xp = l.hideDehydratedBoundary, Zp = l.unhideDehydratedBoundary, Ou = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Jp = l.validateHydratableInstance, Lp = l.validateHydratableTextInstance, Be = l.supportsResources, Ru = l.isHostHoistableType, to = l.getHoistableRoot, Hu = l.getResource, Du = l.acquireResource, Uu = l.releaseResource, Wp = l.hydrateHoistable, Bu = l.mountHoistable, qu = l.unmountHoistable, Fp = l.createHoistableInstance, Ip = l.prepareToCommitHoistables, $p = l.mayResourceSuspendCommit, Yu = l.preloadResource, Pp = l.suspendResource, Vt = l.supportsSingletons, Gu = l.resolveSingletonInstance, th = l.acquireSingletonInstance, Ku = l.releaseSingletonInstance, Qu = l.isHostSingletonType, hn = l.isSingletonScope, eo = [], gn = -1, bn = {}, be = Math.clz32 ? Math.clz32 : _, eh = Math.log, ah = Math.LN2, Ll = 256, Wl = 262144, Fl = 4194304, Il = ge.unstable_scheduleCallback, ao = ge.unstable_cancelCallback, nh = ge.unstable_shouldYield, lh = ge.unstable_requestPaint, de = ge.unstable_now, Vu = ge.unstable_ImmediatePriority, ih = ge.unstable_UserBlockingPriority, no = ge.unstable_NormalPriority, rh = ge.unstable_IdlePriority, oh = ge.log, sh = ge.unstable_setDisableYieldValue, Pn = null, ve = null, ye = typeof Object.is == "function" ? Object.is : gt, Xu = typeof reportError == "function" ? reportError : function(t) {
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
      }, ch = Object.prototype.hasOwnProperty, lo, Zu, io = !1, Ju = /* @__PURE__ */ new WeakMap(), vn = [], yn = 0, $l = null, tl = 0, Ee = [], Ne = 0, wa = null, Ve = 1, Xe = "", te = z(null), el = z(null), _a = z(null), Pl = z(null), ee = null, Ot = null, _t = !1, Sa = null, Te = !1, ro = Error(s(519)), ti = z(null), Za = null, na = null, uh = typeof AbortController < "u" ? AbortController : function() {
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
      }, dh = ge.unstable_scheduleCallback, fh = ge.unstable_NormalPriority, Rt = {
        $$typeof: ya,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ei = null, xn = null, oo = !1, ai = !1, so = !1, Ja = 0, al = null, co = 0, wn = 0, _n = null, Lu = ot.S;
      ot.S = function(t, e) {
        Pu = de(), typeof e == "object" && e !== null && typeof e.then == "function" && Pf(t, e), Lu !== null && Lu(t, e);
      };
      var La = z(null), Sn = Error(s(460)), uo = Error(s(474)), ni = Error(s(542)), li = { then: function() {
      } }, Wa = null, kn = null, nl = 0, Fa = vs(!0), Wu = vs(!1), Ce = [], zn = 0, fo = 0, ka = !1, mo = !1, En = z(null), ii = z(0), xe = z(null), je = null, qt = z(0), la = 0, pt = null, jt = null, Yt = null, ri = !1, Nn = !1, Ia = !1, oi = 0, ll = 0, Tn = null, mh = 0, il = {
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
      var Fu = {
        readContext: $t,
        use: Tl,
        useCallback: function(t, e) {
          return se().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: $t,
        useEffect: Qs,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, jl(
            4194308,
            4,
            Js.bind(null, e, t),
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
            it(!0);
            try {
              t();
            } finally {
              it(!1);
            }
          }
          return a.memoizedState = [i, e], i;
        },
        useReducer: function(t, e, a) {
          var i = se();
          if (a !== void 0) {
            var r = a(e);
            if (Ia) {
              it(!0);
              try {
                a(e);
              } finally {
                it(!1);
              }
            }
          } else r = e;
          return i.memoizedState = i.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, i.queue = t, t = t.dispatch = rm.bind(
            null,
            pt,
            t
          ), [i.memoizedState, t];
        },
        useRef: function(t) {
          var e = se();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = or(t);
          var e = t.queue, a = ac.bind(
            null,
            pt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: ur,
        useDeferredValue: function(t, e) {
          var a = se();
          return dr(a, t, e);
        },
        useTransition: function() {
          var t = or(!1);
          return t = $s.bind(
            null,
            pt,
            t.queue,
            !0,
            !1
          ), se().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var i = pt, r = se();
          if (_t) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), Mt === null)
              throw Error(s(349));
            (xt & 127) !== 0 || Ns(i, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Qs(Cs.bind(null, i, u, t), [
            t
          ]), i.flags |= 2048, sn(
            9,
            { destroy: void 0 },
            Ts.bind(
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
            a = mh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: fr,
        useFormState: Bs,
        useActionState: Bs,
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
          return e.queue = a, e = mr.bind(
            null,
            pt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: lr,
        useCacheRefresh: function() {
          return se().memoizedState = im.bind(
            null,
            pt
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
      }, po = {
        readContext: $t,
        use: Tl,
        useCallback: Ws,
        useContext: $t,
        useEffect: cr,
        useImperativeHandle: Ls,
        useInsertionEffect: Xs,
        useLayoutEffect: Zs,
        useMemo: Fs,
        useReducer: Cl,
        useRef: Ks,
        useState: function() {
          return Cl(Fe);
        },
        useDebugValue: ur,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return Is(
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
        useSyncExternalStore: Es,
        useId: tc,
        useHostTransitionStatus: fr,
        useFormState: qs,
        useActionState: qs,
        useOptimistic: function(t, e) {
          var a = Bt();
          return As(a, jt, t, e);
        },
        useMemoCache: lr,
        useCacheRefresh: ec
      };
      po.useEffectEvent = Vs;
      var Iu = {
        readContext: $t,
        use: Tl,
        useCallback: Ws,
        useContext: $t,
        useEffect: cr,
        useImperativeHandle: Ls,
        useInsertionEffect: Xs,
        useLayoutEffect: Zs,
        useMemo: Fs,
        useReducer: rr,
        useRef: Ks,
        useState: function() {
          return rr(Fe);
        },
        useDebugValue: ur,
        useDeferredValue: function(t, e) {
          var a = Bt();
          return jt === null ? dr(a, t, e) : Is(
            a,
            jt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = rr(Fe)[0], e = Bt().memoizedState;
          return [
            typeof t == "boolean" ? t : Gn(t),
            e
          ];
        },
        useSyncExternalStore: Es,
        useId: tc,
        useHostTransitionStatus: fr,
        useFormState: Gs,
        useActionState: Gs,
        useOptimistic: function(t, e) {
          var a = Bt();
          return jt !== null ? As(a, jt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: lr,
        useCacheRefresh: ec
      };
      Iu.useEffectEvent = Vs;
      var ho = {
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
      }, go = Error(s(461)), Gt = !1, bo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, ia = !1, Kt = !1, vo = !1, $u = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, fe = !1, qe = null, Cn = 8192, ph = {
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
      var hh = typeof WeakMap == "function" ? WeakMap : Map, vt = 0, Mt = null, yt = null, xt = 0, Ct = 0, we = null, za = !1, jn = !1, yo = !1, ra = 0, Ut = 0, Ea = 0, $a = 0, xo = 0, _e = 0, Mn = 0, ol = null, me = null, wo = !1, mi = 0, Pu = 0, sl = 1 / 0, pi = null, Na = null, Xt = 0, Ta = null, An = null, oa = 0, _o = 0, So = null, td = null, cl = 0, ko = null;
      return bt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = qa(t, 67108864);
          e !== null && ue(e, t, 67108864), Kr(t, 67108864);
        }
      }, bt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = he();
          e = L(e);
          var a = qa(t, e);
          a !== null && ue(a, t, e), Kr(t, e);
        }
      }, bt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = S(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - be(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ge(t), (vt & 6) === 0 && (sl = de() + 500, on(0));
              }
            }
            break;
          case 31:
          case 13:
            e = qa(t, 2), e !== null && ue(e, t, 2), Wc(), Kr(t, 2);
        }
      }, bt.batchedUpdates = function(t, e) {
        return t(e);
      }, bt.createComponentSelector = function(t) {
        return { $$typeof: si, value: t };
      }, bt.createContainer = function(t, e, a, i, r, u, m, k, D, K) {
        return mu(
          t,
          e,
          !1,
          null,
          a,
          i,
          u,
          null,
          m,
          k,
          D,
          K
        );
      }, bt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, bt.createHydrationContainer = function(t, e, a, i, r, u, m, k, D, K, J, X, W, ft) {
        return t = mu(
          a,
          i,
          !0,
          t,
          r,
          u,
          k,
          ft,
          D,
          K,
          J,
          X
        ), t.context = pu(null), a = t.current, i = he(), i = L(i), r = ma(i), r.callback = e ?? null, pa(a, r, i), e = i, t.current.lanes = e, O(t, e), Ge(t), t;
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
        Xu(t);
      }, bt.defaultOnUncaughtError = function(t) {
        Xu(t);
      }, bt.deferredUpdates = function(t) {
        var e = ot.T, a = aa();
        try {
          return Lt(32), ot.T = null, t();
        } finally {
          Lt(a), ot.T = e;
        }
      }, bt.discreteUpdates = function(t, e, a, i, r) {
        var u = ot.T, m = aa();
        try {
          return Lt(2), ot.T = null, t(e, a, i, r);
        } finally {
          Lt(m), ot.T = u, vt === 0 && (sl = de() + 500);
        }
      }, bt.findAllNodes = Hr, bt.findBoundingRects = function(t, e) {
        if (!In) throw Error(s(363));
        e = Hr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Fm(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var i = a.x, r = i + a.width, u = a.y, m = u + a.height, k = e - 1; 0 <= k; k--)
            if (e !== k) {
              var D = t[k], K = D.x, J = K + D.width, X = D.y, W = X + D.height;
              if (i >= K && u >= X && r <= J && m <= W) {
                t.splice(e, 1);
                break;
              } else if (i !== K || a.width !== D.width || W < u || X > m) {
                if (!(u !== X || a.height !== D.height || J < i || K > r)) {
                  K > i && (D.width += K - i, D.x = i), J < r && (D.width = r - K), t.splice(e, 1);
                  break;
                }
              } else {
                X > u && (D.height += X - u, D.y = u), W < m && (D.height = m - X), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, bt.findHostInstance = hu, bt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? y(t) : null, t === null ? null : Fn(t.stateNode);
      }, bt.findHostInstanceWithWarning = function(t) {
        return hu(t);
      }, bt.flushPassiveEffects = Wn, bt.flushSyncFromReconciler = function(t) {
        var e = vt;
        vt |= 1;
        var a = ot.T, i = aa();
        try {
          if (Lt(2), ot.T = null, t)
            return t();
        } finally {
          Lt(i), ot.T = a, vt = e, (vt & 6) === 0 && on(0);
        }
      }, bt.flushSyncWork = Wc, bt.focusWithin = function(t, e) {
        if (!In) throw Error(s(363));
        for (t = Ar(t), e = Xc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], i = a.tag;
          if (!$n(a)) {
            if ((i === 5 || i === 26 || i === 27) && Pm(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, bt.getFindAllNodesFailureDescription = function(t, e) {
        if (!In) throw Error(s(363));
        var a = 0, i = [];
        t = [Ar(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], m = u.tag, k = t[r++], D = e[k];
          if ((m !== 5 && m !== 26 && m !== 27 || !$n(u)) && (Or(u, D) && (i.push(Rr(D)), k++, k > a && (a = k)), k < e.length))
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
          version: Tm,
          rendererPackageName: Cm,
          currentDispatcherRef: ot,
          reconcilerVersion: "19.2.0"
        };
        if (wu !== null && (t.rendererConfig = wu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
        t = Hr(t, e);
        var r = tp(
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
        var r = Ps(t).queue;
        $s(
          t,
          r,
          e,
          pn,
          a === null ? c : function() {
            var u = Ps(t);
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
        return gu(
          r,
          u,
          t,
          e,
          a,
          i
        ), u;
      }, bt.updateContainerSync = function(t, e, a, i) {
        return gu(
          e.current,
          2,
          t,
          e,
          a,
          i
        ), 2;
      }, bt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(To)), To.exports;
}
var md;
function Lh() {
  return md || (md = 1, No.exports = Jh()), No.exports;
}
var Wh = Lh();
const Fh = /* @__PURE__ */ ts(Wh);
var Mo = { exports: {} }, sa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var pd;
function Ih() {
  return pd || (pd = 1, sa.ConcurrentRoot = 1, sa.ContinuousEventPriority = 8, sa.DefaultEventPriority = 32, sa.DiscreteEventPriority = 2, sa.IdleEventPriority = 268435456, sa.LegacyRoot = 0, sa.NoEventPriority = 0), sa;
}
var hd;
function $h() {
  return hd || (hd = 1, Mo.exports = Ih()), Mo.exports;
}
var hl = $h();
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
const nf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Yo = 16, lf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Ph = [
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
], gd = {
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
}, tg = /* @__PURE__ */ new Set([
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
]), rf = {
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
}, of = {
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
}, Go = ["font-size", "color", ...new Set([...Object.keys(rf), ...Object.keys(of)].filter((n) => n !== "font-size" && n !== "color"))], eg = new Set(Go);
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
function Ko(n, l, o = 0) {
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
    const b = n.slice(d + 4, f - 1), y = ne(b, ","), T = y[0].trim(), C = y.length > 1 ? b.slice(b.indexOf(",") + 1).trim() : null;
    let z = l(T);
    if ((z == null || z === "initial") && (z = C), z == null) return null;
    const v = Ko(z, l, o + 1);
    if (v === null) return null;
    c += v, s = f;
  }
}
function ag(n) {
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
  const o = ag(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let c = 0;
  const s = ({ num: z, unit: v }) => {
    switch (v) {
      case "":
        return { px: 0, pct: 0, num: z, unitless: !0 };
      case "px":
        return { px: z, pct: 0, num: 0 };
      case "rem":
        return { px: z * Yo, pct: 0, num: 0 };
      case "em":
        return { px: z * (l.fontSize ?? Yo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: z, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: z / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: z / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: z * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (z, v, x) => z && v ? { px: z.px + x * v.px, pct: z.pct + x * v.pct, num: z.num + x * v.num, unitless: z.unitless && v.unitless } : null, p = (z, v) => z ? { px: z.px * v, pct: z.pct * v, num: z.num * v, unitless: z.unitless } : null, f = (z) => z && z.unitless;
  function b() {
    const z = o[c++];
    if (!z) return null;
    if (z.num !== void 0) return s(z);
    if (z.op === "(") {
      const v = T();
      return o[c]?.op !== ")" ? null : (c++, v);
    }
    if (z.op === "-" || z.op === "+") {
      const v = b();
      return z.op === "-" ? p(v, -1) : v;
    }
    if (z.fn) {
      const v = [];
      for (; ; ) {
        v.push(T());
        const S = o[c++];
        if (!S) return null;
        if (S.op === ")") break;
        if (S.op !== ",") return null;
      }
      if (v.some((S) => !S)) return null;
      if (z.fn === "calc") return v[0];
      if (!(v.every((S) => !S.pct) || v.every((S) => !S.px && !S.num))) return null;
      const _ = (S) => S.px + S.pct + S.num;
      return z.fn === "min" ? v.reduce((S, R) => _(R) < _(S) ? R : S) : z.fn === "max" ? v.reduce((S, R) => _(R) > _(S) ? R : S) : z.fn === "clamp" && v.length === 3 ? _(v[1]) < _(v[0]) ? v[0] : _(v[1]) > _(v[2]) ? v[2] : v[1] : null;
    }
    return null;
  }
  function y() {
    let z = b();
    for (; o[c] && (o[c].op === "*" || o[c].op === "/"); ) {
      const v = o[c++].op, x = b();
      if (!z || !x) return null;
      v === "*" ? z = f(x) ? p(z, x.num) : f(z) ? p(x, z.num) : null : z = f(x) && x.num !== 0 ? p(z, 1 / x.num) : null;
    }
    return z;
  }
  function T() {
    let z = y();
    for (; o[c] && (o[c].op === "+" || o[c].op === "-"); ) {
      const v = o[c++].op;
      z = d(z, y(), v === "-" ? -1 : 1);
    }
    return z;
  }
  const C = T();
  return c !== o.length || !C ? null : C;
}
function Qo(n, l) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const c = Oa(o, l);
  return c ? c.unitless ? c.num === 0 ? { px: 0 } : { expr: n.trim() } : c.pct && (c.px || c.num) ? { expr: n.trim() } : c.pct ? { pct: c.pct } : { px: ng(c.px) } : { expr: n.trim() };
}
const ng = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, bi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), lg = ([n, l, o, c]) => `#${bi(n)}${bi(l)}${bi(o)}${bi(c * 255)}`;
function bd(n) {
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
    const y = l(c[1]), T = y && bd(y);
    return T ? { rgba: T, token: c[1] } : null;
  }
  if (o.startsWith("#")) {
    const y = bd(o);
    return y ? { rgba: y, token: null } : null;
  }
  if (gd[o]) return { rgba: [...gd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = ne(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const T = (it) => {
      const gt = ne(it), wt = gt.findIndex((lt) => /%$/.test(lt)), V = wt >= 0 ? parseFloat(gt[wt]) / 100 : null;
      return { color: Ni(gt.filter((lt, B) => B !== wt).join(" "), l), pct: V };
    }, C = T(y[1]), z = T(y[2]);
    if (!C.color || !z.color || C.color === "currentcolor" || z.color === "currentcolor") return null;
    let v = C.pct, x = z.pct;
    v === null && x === null ? (v = 0.5, x = 0.5) : v === null ? v = 1 - x : x === null && (x = 1 - v);
    const _ = v + x, S = _ < 1 ? _ : 1;
    v /= _, x /= _;
    const [R, E, j, Q] = C.color.rgba, [U, O, h, g] = z.color.rgba, A = Q * v + g * x, G = (it, gt) => A === 0 ? 0 : (it * Q * v + gt * g * x) / A, L = [G(R, U), G(E, O), G(j, h), A * S], F = g === 0 ? C.color.token : Q === 0 ? z.color.token : null;
    return { rgba: L, token: F };
  }
  const d = s[2].includes(",") ? ne(s[2], ",") : ne(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const p = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), b = [p(d[0]), p(d[1]), p(d[2]), f];
  return b.some((y) => Number.isNaN(y)) ? null : { rgba: b, token: null };
}
const ml = ["top", "right", "bottom", "left"], ig = ["top-left", "top-right", "bottom-right", "bottom-left"], vi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], vd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Vo(n, l) {
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
        for (const b of c())
          vd.has(b) ? p = b : /^(thin|medium|thick|-?[\d.]|calc\()/.test(b) ? d = b : f = b;
      else o === "0" && (d = "0");
      return s.flatMap((b) => [[`border-${b}-width`, d], [`border-${b}-style`, p], [`border-${b}-color`, f]]);
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
      return ig.map((d, p) => [`border-${d}-radius`, s[p]]);
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
      return Vo("gap", o);
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
        vd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : p = f;
      return [["outline-width", s], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ne(o, ","), d = s.map((f) => ne(f).find((b) => !/^[\d.]+m?s$/.test(b) && !/^(ease|linear|step|cubic)/.test(b)) ?? "all"), p = s.map((f) => ne(f).find((b) => /^[\d.]+m?s$/.test(b)) ?? "0s");
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
function rg(n, l) {
  return n ? ne(n, ",").some((o) => {
    let c = o.trim().toLowerCase(), s = !1;
    c.startsWith("not ") && (s = !0, c = c.slice(4)), c.startsWith("only ") && (c = c.slice(5));
    const d = c.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const f = /^\((.+)\)$/.exec(p);
      if (!f) return !1;
      const b = f[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(b);
      if (y) {
        const [, C, z] = y, v = (x) => {
          const _ = Qo(x, { viewport: l });
          return typeof _ == "object" && "px" in _ ? _.px : NaN;
        };
        switch (C) {
          case "min-width":
            return l.width >= v(z);
          case "max-width":
            return l.width <= v(z);
          case "min-height":
            return l.height >= v(z);
          case "max-height":
            return l.height <= v(z);
          case "hover":
          case "any-hover":
            return z.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return z.trim() === "fine";
          case "prefers-reduced-motion":
            return z.trim() === "no-preference";
          case "prefers-color-scheme":
            return z.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const T = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(b);
      if (T) {
        const C = T[1] === "width" ? l.width : l.height, z = Qo(T[3], { viewport: l }), v = typeof z == "object" && "px" in z ? z.px : NaN;
        switch (T[2]) {
          case ">=":
            return C >= v;
          case "<=":
            return C <= v;
          case ">":
            return C > v;
          case "<":
            return C < v;
          default:
            return C === v;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function og(n, l) {
  const o = l[l.length - 1].compound;
  return es(o)[0] ?? n;
}
function sg(n) {
  const l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = (s, d) => {
    s.forEach(({ compound: p }, f) => {
      const b = d && f === s.length - 1;
      for (const y of p.pseudos)
        if (lf.has(y.name) && (b ? l : o).add(y.name), y.list && y.name !== "not") for (const T of y.list) c(T, b);
    });
  };
  return c(n, !0), { subject: l, ancestor: o };
}
function es(n) {
  const l = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const c of o.list) c.length === 1 && l.push(...es(c[0].compound));
  return l;
}
function cg(n, l) {
  const o = (c, s) => {
    c.forEach(({ compound: d }, p) => {
      const f = s && p === c.length - 1, b = d.pseudos.filter((y) => lf.has(y.name)).map((y) => y.name);
      if (!f) for (const y of b) for (const T of es(d)) l.add(`${y}:${T}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const T of y.list) o(T, f);
    });
  };
  o(n, !0);
}
class ug {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const f = p[p.length - 1].compound, b = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(b) || this.index.set(b, []), this.index.get(b).push(d);
    };
    let c = 0;
    const s = (d, p) => {
      for (const [f, b, y, T] of d)
        for (const C of Io(f)) {
          let z;
          try {
            z = $o(C);
          } catch (_) {
            if (_ instanceof ke) {
              this.skipped++;
              continue;
            }
            throw _;
          }
          const v = sg(z);
          cg(z, this.trackedStates);
          const x = { steps: z, media: b, layer: y, origin: p, order: c++, specificity: Ld(z), decls: T, states: v, source: p === 0 ? `ua:${z[z.length - 1].compound.tag ?? "*"}` : og(C, z) };
          this.rules.push(x), o(x, z);
        }
    };
    s(Ph.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), s(l.rules, 1);
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
const dg = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function fg(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [o, c] of Object.entries(n)) {
    if (c == null || c === "" || typeof c == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof c == "number" && c !== 0 && !dg.has(s) && !s.startsWith("--") ? `${c}px` : String(c);
    l.push([s, d]);
  }
  return l;
}
function mg(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const o of ["width", "height"]) {
    const c = n.getAttribute(o);
    c !== null && l.push([o, /^[\d.]+$/.test(c) ? `${c}px` : c]);
  }
  return l;
}
const pg = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class hg {
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
    return this.sheet.candidates(l).filter((s) => (!s.media || s.media.every((d) => rg(d, this.viewport))) && Wd(l, s.steps, { state: c }));
  }
  compute(l, o, c = /* @__PURE__ */ new Set()) {
    const s = this.matching(l, c), d = [];
    for (const h of s)
      for (const [g, A, G] of h.decls) d.push({ prop: g, value: A, important: G ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, g] of mg(l)) d.push({ prop: h, value: g, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, g] of fg(l.inlineStyle ?? l.props?.style)) d.push({ prop: h, value: g, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(pg);
    const p = this.sheet.properties, f = Object.create(o?.customs ?? null), b = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const h of d) h.prop.startsWith("--") && y.set(h.prop, h.value);
    if (!o && this.theme) for (const h of nf) this.theme[h] && y.set(`--${h}`, `perchtoken(${h})`);
    const T = (h) => {
      if (b.has(h)) return b.get(h);
      const g = p[h];
      return g && !g.inherits ? g.initial ?? null : h in f ? f[h] : g?.initial ?? null;
    }, C = /* @__PURE__ */ new Set(), z = (h) => {
      if (!y.has(h)) return T(h);
      if (C.has(h)) return null;
      C.add(h);
      const g = Ko(y.get(h), z);
      return C.delete(h), y.delete(h), b.set(h, g), (!p[h] || p[h].inherits) && (f[h] = g), g;
    };
    for (const h of [...y.keys()]) z(h);
    const v = /* @__PURE__ */ new Map();
    for (const h of d) {
      if (h.prop.startsWith("--")) continue;
      const g = Ko(h.value, T);
      if (g === null) {
        for (const [A] of Vo(h.prop, "unset")) v.set(A, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [A, G] of Vo(h.prop, g)) v.set(A, { value: G, source: h.source, origin: h.origin });
    }
    const x = {}, _ = {}, S = /* @__PURE__ */ new Set(), R = /* @__PURE__ */ new Set(), E = o?.values, j = { fontSize: E?.["font-size"] ?? Yo, viewport: this.viewport }, Q = (h, g) => {
      if (/currentcolor/i.test(g)) return this.parseValue(h, g, j, x, E);
      const A = `${h}\0${g}\0${j.fontSize}`;
      let G = this.parsed.get(A);
      return G === void 0 && this.parsed.set(A, G = this.parseValue(h, g, j, x, E)), G;
    }, U = v.size ? [...Go, ...[...v.keys()].filter((h) => !eg.has(h))] : Go;
    for (const h of U) {
      const g = v.get(h);
      let A = g?.value;
      const G = tg.has(h);
      if ((A === void 0 || A === "unset" || A === "revert" || A === "revert-layer") && (A = G ? "inherit" : "initial"), g && (_[h] = g.source, g.origin !== 0 && S.add(h)), A === "inherit" && E && h in E) {
        x[h] = E[h], R.add(h);
        continue;
      }
      (A === "inherit" || A === "initial") && (A = G ? of[h] : rf[h]), x[h] = Q(h, A), h === "font-size" && (j.fontSize = x["font-size"]);
    }
    for (const h of ml) {
      const g = x[`border-${h}-style`];
      (g === "none" || g === "hidden") && (x[`border-${h}-width`] = { px: 0 });
    }
    x["outline-style"] === "none" && (x["outline-width"] = { px: 0 });
    const O = E?.display;
    return (O === "flex" || O === "inline-flex" || O === "grid" || O === "inline-grid") && x.position !== "absolute" && x.position !== "fixed" && (x.display = yd(x.display)), (x.position === "absolute" || x.position === "fixed") && (x.display = yd(x.display)), { values: x, sources: _, own: S, inherited: R, customs: f, rules: s, element: l };
  }
  parseValue(l, o, c, s, d) {
    const p = String(o).trim();
    switch (l) {
      case "font-size": {
        const f = p.toLowerCase(), b = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (b[f]) return b[f];
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
        const b = parseFloat(f);
        return Number.isFinite(b) ? b : 400;
      }
      case "line-height": {
        const f = p.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const b = Oa(f, { fontSize: c.fontSize, viewport: c.viewport });
        return b ? b.unitless ? { factor: b.num } : { px: b.px + b.pct / 100 * c.fontSize } : { normal: !0 };
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
        const f = Ni(p, (b) => this.themeHex(b));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Ni(p, (b) => this.themeHex(b));
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
        return Qo(p, c);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function yd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Ti = (n) => n && n.rgba ? { value: lg(n.rgba), token: n.token ?? null } : null, gg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function bg(n, l) {
  const o = l?.(n);
  if (Number.isFinite(o)) return o;
  const c = Math.round(n * 100) / 100;
  return gg[c] ?? Math.round(n * 1.2);
}
function Ci(n, l) {
  const o = n["line-height"], c = n["font-size"];
  return o.normal ? bg(c, l) : o.factor !== void 0 ? o.factor * c : o.px;
}
const vg = (n) => ne(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const yg = "perch-native-description/1", On = Symbol("display"), ji = {
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
}, xg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of xg) ji[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ji.rounded = 0;
const wg = /* @__PURE__ */ new Set([
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
]), _g = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Sg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, kg = (n) => Sg.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : _g.test(n) ? ".SystemUIFont" : vg(n).split(",")[0].trim(), zg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, xd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, sf = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const c = n.parentElement;
  return c && c.tagName !== "body" ? `${sf(c)} > ${n.tagName}` : n.tagName;
};
class Eg {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, o, c, s, d, p = "") {
    const f = `${l}|${o}|${c}|${s}`, b = this.map.get(f);
    if (b) {
      !b.elements.includes(d) && b.elements.length < 4 && b.elements.push(d), b.count++;
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
}, Ng = /^(text|search|url|email|tel|password|number)$/, Tg = 162.13 / 12.8;
function Cg(n, l) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const c = ne(o[1], ",").map((s) => Oa(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return c.length ? Math.min(...c) : void 0;
}
function jg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = Oa(n.expr, { fontSize: l["font-size"] }), c = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + c) < 0.01;
}
function cf(n) {
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
function wd(n, l, o, c = !1) {
  const s = n.values, d = cf(s);
  if (d?.length === 0) return;
  const p = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, b = (C, z) => {
    const v = Oa(C, f);
    if (!(!v || v.unitless && v.num))
      return v.pct ? typeof z == "number" ? v.px + v.pct / 100 * z : void 0 : v.px;
  }, y = d ? b(d[0], l.w) : void 0, T = d ? b(d[1], l.h) : void 0;
  if (y === void 0 || T === void 0) {
    const C = !c && d ? d.map((z) => Oa(z, f)) : null;
    if (C?.every((z) => z && !(z.unitless && z.num))) {
      l[uf] = C.map((z) => [z.px, z.pct ?? 0]);
      return;
    }
    o("unsupported", p, s[p], n.sources[p]);
    return;
  }
  if (c) {
    y && (l.left = y), T && (l.top = T);
    return;
  }
  y && (l.ml = (l.ml ?? 0) + y), T && (l.mt = (l.mt ?? 0) + T);
}
const uf = Symbol("perch.shift");
function Mg(n, l, o) {
  const c = n.ownerDocument, s = c?.measure?.(n) ?? null;
  if (s) {
    const [[p, f], [b, y]] = o, T = p + f / 100 * s.width, C = b + y / 100 * s.height;
    T && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + T), C && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + C);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < $d && c?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, c.retries.push(() => c.afterCommit?.()));
}
function _d(n, l, o = null) {
  const c = n.values, s = {}, d = (E) => n.sources[E], p = (E) => n.sources[E] !== void 0, f = c.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), c["grid-template-columns"] && c["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", c["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const b = s.display === "flex";
  if (b && s.flex_direction !== "col") {
    const E = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[c["flex-direction"]] ?? "row";
    s.flex_direction = E;
  }
  if (b) {
    (c["flex-wrap"] === "wrap" || c["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const E = f === "grid" || f === "inline-grid", j = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[c["align-items"]];
    j && (s.items = j);
    let Q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[c["justify-content"]];
    if (E) {
      const h = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[c["justify-items"]];
      h && (s.items = h), c["align-items"] === "center" && (Q = "center");
    }
    Q && (s.justify = Q);
    const U = ua(c["row-gap"]), O = ua(c["column-gap"]);
    typeof U == "number" && U && (s.gap_y = U), typeof O == "number" && O && !E && (s.gap_x = O);
  }
  c["flex-grow"] && (s.flex_grow = c["flex-grow"]), c["flex-shrink"] !== 1 && (s.flex_shrink = c["flex-shrink"]);
  const y = ua(c["flex-basis"]);
  y !== void 0 && y !== "auto" && (s.flex_basis = y);
  const T = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[c["align-self"]];
  T && (s.self = T);
  for (const [E, j] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const Q = c[j], U = ua(Q);
    if (U === void 0 && j === "width" && jg(Q, c)) {
      s.self = "stretch", l("approximated", j, Q.expr, d(j), "stretched across its parent, inside its margins");
      continue;
    }
    const O = U === void 0 && /^max-/.test(j) ? Cg(Q, c["font-size"]) : void 0;
    if (O !== void 0) {
      s[E] = O, l("approximated", j, Q.expr, d(j), "the fixed bound of min()");
      continue;
    }
    if (U === void 0) {
      typeof Q == "object" && Q.expr ? l("unsupported", j, Q.expr, d(j), "no calc() in the engine") : typeof Q == "string" && !["auto", "none"].includes(Q) && l("unsupported", j, Q, d(j));
      continue;
    }
    U !== "auto" && (s[E] = U);
  }
  const C = ["top", "right", "bottom", "left"];
  for (const E of C) {
    const j = E[0];
    for (const [Q, U] of [["p", "padding"], ["m", "margin"]]) {
      const O = c[`${U}-${E}`], h = ua(O);
      if (h === void 0) {
        O?.expr && l("unsupported", `${U}-${E}`, O.expr, d(`${U}-${E}`), "no calc() in the engine");
        continue;
      }
      h !== 0 && (s[`${Q}${j}`] = h);
    }
  }
  const z = c.position;
  if (z === "absolute" || z === "fixed") {
    s.position = "absolute", z === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const E of C) {
      const j = ua(c[E]);
      j !== void 0 && j !== "auto" && (s[E] = j);
    }
    if (z === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const E = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, E) : E;
    }
    wd(n, s, l);
  } else z === "sticky" ? l("unsupported", "position", "sticky", d("position")) : cf(c)?.length !== 0 && (s.position = "relative", wd(n, s, l, !0));
  c["z-index"] !== "auto" && p("z-index") && l("unsupported", "z-index", c["z-index"], d("z-index"), "paint order is tree order");
  for (const [E, j] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const Q = c[j];
    Q === "hidden" || Q === "clip" ? s[E] = "hidden" : (Q === "auto" || Q === "scroll") && (s[E] = "scroll");
  }
  (c.visibility === "hidden" || c.visibility === "collapse") && (s.visibility = "invisible");
  const v = c["background-color"];
  v?.unreadable ? l("unsupported", "background-color", v.unreadable, d("background-color")) : v?.rgba && v.rgba[3] > 0 && (s.bg = Ti(v)), c["background-image"] && c["background-image"] !== "none" && l("unsupported", "background-image", c["background-image"], d("background-image"));
  const x = C.map((E) => ua(c[`border-${E}-width`]) || 0), _ = [];
  C.forEach((E, j) => {
    if (!x[j]) return;
    s[`border_${E[0]}`] = x[j];
    const Q = c[`border-${E}-style`];
    Q !== "solid" && l("approximated", `border-${E}-style`, Q, d(`border-${E}-style`), "drawn solid");
    const U = Ti(c[`border-${E}-color`]);
    U && _.push(U);
  }), _.length && (s.border_color = _[0], _.some((E) => E.value !== _[0].value) && l("approximated", "border-color", _.map((E) => E.value).join(" "), d("border-top-color"), "one border colour"));
  const S = ["top-left", "top-right", "bottom-right", "bottom-left"].map((E) => ua(c[`border-${E}-radius`]) || 0);
  S.every((E) => E === S[0]) ? S[0] && (s.rounded = S[0]) : ["tl", "tr", "br", "bl"].forEach((E, j) => {
    S[j] && (s[`rounded_${E}`] = S[j]);
  }), c.opacity !== 1 && (s.opacity = Math.round(c.opacity * 1e3) / 1e3);
  const R = c["box-shadow"];
  if (R && R !== "none" && ne(R, ",").some((E) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(E.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", R, d("box-shadow"), "the engine's large shadow preset")), c.cursor && c.cursor !== "auto" && !n.inherited.has("cursor")) {
    const E = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[c.cursor];
    E ? s.cursor = E : l("unsupported", "cursor", c.cursor, d("cursor"));
  }
  return c["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), c["text-decoration-line"] === "underline" ? s.underline = !0 : c["text-decoration-line"] && c["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", c["text-decoration-line"], d("text-decoration-line")), s;
}
const Ag = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function df(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((o) => Ag[o]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Sd(n, l) {
  const o = n.values, c = o["line-height"];
  return {
    text_color: Ti(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: df(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: c.factor !== void 0 ? { factor: c.factor } : { px: Math.round(Ci(o, l) * 1e3) / 1e3 },
    font_family: kg(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const kd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, ff = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function zd(n, l, o) {
  const c = {}, s = (f, b) => b.some((y) => !n.inherited.has(y));
  for (const [f, b] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, b) || !ff(l[f], o[f])) && (c[f] = l[f]);
  const d = kd(l.line_height, l.text_size), p = o.line_height ? kd(o.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (c.line_height = l.line_height), c;
}
const Og = (n, l) => ({ ...n, ...l });
function Ed(n, l) {
  const o = {};
  for (const [c, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[c] = s.value, s.token && (l[c] = s.token)) : c === "line_height" ? o[c] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : c === "italic" ? s && (o.italic = !0) : o[c] = s;
  return o.italic === !1 && delete o.italic, o;
}
function Rg(n, l) {
  const o = {};
  for (const c of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[c], d = l[c];
    ff(s, d) || (o[c] = d === void 0 ? c in ji ? ji[c] : null : d);
  }
  return o;
}
function Nd(n, l) {
  const o = n.values;
  for (const [c, s] of Object.entries(n.sources)) {
    if (c.startsWith("--") || wg.has(c) || s.startsWith("ua:")) continue;
    const d = o[c];
    switch (c) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", c, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && df(d) === null && l("unsupported", c, d, s);
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
function Hg(n, l, o, c) {
  const s = sf(n), d = [], p = (R, E, j, Q, U) => d.push([R, E, j, Q ?? "(user agent)", s, U]), f = c.cascade.compute(n, l), b = {}, y = _d(f, p, c.viewport), T = y[uf];
  Nd(f, p);
  const C = Sd(f, c.measure), z = zd(f, C, o), v = Ed({ ...y, ...z }, b), x = {}, _ = c.cascade.matching(n, "*").filter((R) => R.states.subject.size);
  for (const [R, E] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!_.some((h) => E.some((g) => h.states.subject.has(g)))) continue;
    const j = c.cascade.compute(n, l, new Set(E)), Q = {}, U = Ed({ ..._d(j, () => {
    }), ...zd(j, Sd(j, c.measure), o) }, Q);
    R === "focus" && Nd(j, p);
    const O = Rg(v, U);
    if (Object.keys(O).length) {
      x[R] = O;
      const h = Object.fromEntries(Object.entries(Q).filter(([g]) => g in O));
      Object.keys(h).length && (x[`${R}_tokens`] = h);
    }
  }
  if (c.cascade.sheet.tracks(n, "hover") && (x.track_hover = !0), /tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (x.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (x.break_anywhere = !0), y.overflow_y === "scroll") {
    const R = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    R > 0 && (x.scrollbar = R);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (x.blocks_pointer = !0);
  const S = Object.entries(zg).filter(([, R]) => R.some((E) => typeof n.props[E] == "function")).map(([R]) => R);
  return !S.includes("click") && Bo(n) && S.push("click"), S.length && (x.events = S), { computed: f, style: v, tokens: b, extra: x, meta: qg(n), reports: d, childText: Og(o, z), where: s, shift: T };
}
function mf(n, l, o, c, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let p = c.cache.get(n);
  (!p || p.key !== d) && c.cache.set(n, p = { key: d, part: Hg(n, l, o, c) });
  const { computed: f, tokens: b, extra: y, reports: T, childText: C, where: z } = p.part;
  for (const g of T) c.findings.add(...g);
  const v = (g, A, G, L, F) => c.findings.add(g, A, G, L, z, F), x = { ...p.part.style };
  p.part.shift && Mg(n, x, p.part.shift);
  const _ = { kind: "div", id: n.id, style: x, tokens: b, meta: p.part.meta, ...y };
  Object.defineProperty(_, On, { value: f.values.display }), n.measured && n.ownerDocument?.measureKey && (_.measure = n.ownerDocument.measureKey(n));
  const S = n.tagName;
  if (S === "svg")
    return _.kind = n.props["data-perch-image"] ? "image" : "svg", _.markup = Gg(n), _;
  if (S === "input" || S === "textarea" || S === "select") {
    _.kind = "input", _.input_type = S === "input" ? String(n.props.type ?? "text") : S;
    for (const g of ["placeholder", "checked", "disabled"]) n.props[g] !== void 0 && (_[g] = n.props[g]);
    if (/^(checkbox|radio)$/.test(_.input_type) && (_.checked = n.checked), S !== "select" && (_.value = n.value), S === "input" && Ng.test(_.input_type) && (_.field_w = Tg * f.values["font-size"]), S === "textarea" && x.h === void 0) {
      const g = f.values, A = (F) => F && typeof F == "object" && "px" in F ? F.px : 0, G = (F) => g[`border-${F}-style`] === "none" ? 0 : A(g[`border-${F}-width`]), L = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      x.h = L * Ci(g, c.measure) + A(g["padding-top"]) + A(g["padding-bottom"]) + G("top") + G("bottom");
    }
    return _;
  }
  if (S === "img") {
    _.kind = "image", _.src = n.props.src ?? null;
    for (const [g, A] of [["width", "w"], ["height", "h"]]) {
      const G = Number(n.props[g]);
      x[A] === void 0 && n.props[g] != null && Number.isFinite(G) && (x[A] = G);
    }
    return _;
  }
  const R = f.values["text-transform"], E = [];
  let j = !1, Q = !1;
  for (const g of n.childNodes) {
    if (g instanceof Ui) {
      if (g.hidden || g.data === "") continue;
      j = !0;
      const L = E[E.length - 1];
      if (L?.kind === "text")
        L.source = (L.source ?? L.text) + g.data, L.text = Td(L.source, R), L.text === L.source && delete L.source;
      else {
        const F = Td(g.data, R);
        E.push(F === g.data ? { kind: "text", text: F } : { kind: "text", text: F, source: g.data });
      }
      continue;
    }
    if (!(g instanceof It)) continue;
    const A = mf(g, f, C, c, d), G = A[On];
    G === "inline" || G === "inline-block" || G === "inline-flex" ? j = !0 : G !== "none" && (Q = !0), E.push(A);
  }
  const U = E.some((g) => g.kind !== "text"), O = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][On]) ? E[0] : null;
  if (!x.display && O) {
    const g = c.cache.get(n.childNodes.find((G) => G.id === O.id))?.part.computed, A = g ? Ai(f.values, c.measure) - Bg(g.values, c.measure, O) : 0;
    x.display = "flex", x.flex_direction = "col", x.items = "start", A > 0 && (O.style.mt = Math.round(((O.style.mt ?? 0) + A) * 100) / 100), v("approximated", "display", `${f.values.display} holding one ${O[On]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!x.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][On] === "inline" && typeof E[0].style.h == "number") {
    const g = E[0], A = Ai(f.values, c.measure), G = Ci(f.values, c.measure) - A, L = (F) => Math.round(F * 100) / 100;
    x.display = "flex", x.flex_direction = "col", x.items = "start", A > g.style.h && (g.style.mt = L((g.style.mt ?? 0) + A - g.style.h)), G > 0 && (g.style.mb = L((g.style.mb ?? 0) + G)), v("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!x.display && j && U) {
    if (x.display = "flex", x.flex_direction = Q ? "col" : "row", !Q) x.items = "baseline";
    else for (const g of E) g.kind !== "text" && /^inline-(block|flex)$/.test(g[On]) && !g.style.self && (g.style.self = "start");
    v("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", Q ? "a column of its children" : "a row on the text baseline");
  }
  const h = f.values["letter-spacing"]?.px;
  if (h)
    for (let g = 0; g < E.length; g++) {
      const A = E[g];
      if (A.kind !== "text") continue;
      const G = Math.round(h * [...A.text].length * 1e3) / 1e3;
      E[g] = { kind: "div", style: { pr: G }, tokens: {}, children: [A] };
    }
  return _.children = E, _;
}
function Dg(n, l) {
  if (!l) return null;
  let c = (l.self ? n : l.closest ? Fd(n, l.closest) : l.find ? pl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return c && l.strip && c.startsWith(l.strip) && (c = c.slice(l.strip.length)), c;
}
function Ug(n, l, o) {
  const c = l.map((p) => [p, Di(p.selector)]), s = /* @__PURE__ */ new Map(), d = (p) => {
    for (const f of p.children) {
      const b = o.get(f.id);
      if (b)
        for (const [y, T] of c) {
          const C = y.textRange ? "range_name" : "name";
          if (y.textRange && b[C] != null || !T.some((_) => Wd(f, _))) continue;
          const z = Dg(f, y.key), v = z == null ? s.get(y.name) ?? 0 : 0;
          z == null && s.set(y.name, v + 1);
          const x = z != null ? `${y.name}:${z}` : v ? `${y.name}@${v}` : y.name;
          b[C] == null ? b[C] = x : (b.also ??= []).push(x);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Mi = 0.9521, pf = 0.2256, Ai = (n, l) => (Ci(n, l) - (Mi + pf) * n["font-size"]) / 2 + Mi * n["font-size"];
function Bg(n, l, o) {
  const c = (b) => b && typeof b == "object" && "px" in b ? b.px : 0, s = n["border-top-style"] === "none" ? 0 : c(n["border-top-width"]), d = o?.children ?? [], p = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = p ? Math.max(Ai(n, l), (p.style.mt ?? 0) + p.style.h) : Ai(n, l);
  return c(n["padding-top"]) + s + f;
}
const Td = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, hf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function qg(n) {
  const l = {};
  for (const [o, c] of Object.entries(n.props)) {
    if (hf.has(o) || typeof c == "function" || c === void 0 || c === null || typeof c == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (c === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    l[d] = typeof c == "boolean" ? s ? String(c) : "" : String(c);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const Yg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Cd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Gg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (o) => {
    const c = [];
    for (const [d, p] of Object.entries(o.props))
      hf.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || c.push(`${Yg(d)}="${Cd(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && c.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof Ui ? Cd(d.data) : l(d)).join("");
    return `<${o.tagName}${c.length ? ` ${c.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return l(n);
}
function Kg(n) {
  const l = n.theme?.() ?? {}, o = {};
  for (const c of nf) l[c] && (o[c] = l[c]);
  return o;
}
const Qg = { font_features: "" };
function Vg(n, l, o, c = {}, s = null) {
  const d = Kg(l), p = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, p]);
  (c.look !== f || c.sheet !== o) && Object.assign(c, { look: f, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new hg(o, { theme: d, viewport: p }), top: null });
  const { cascade: b, cache: y } = c, T = { cascade: b, cache: y, viewport: p, findings: new Eg(), measure: l.lineHeight ? (v) => l.lineHeight(v) : null };
  c.top ??= b.compute(n.body, b.compute(n.documentElement, null));
  const C = n.body.children.map((v) => mf(v, c.top, Qg, T));
  if (s?.length) {
    const v = /* @__PURE__ */ new Map(), x = (_) => {
      _.id && v.set(_.id, _);
      for (const S of _.children ?? []) x(S);
    };
    C.forEach(x), Ug(n, s, v);
  }
  const z = /* @__PURE__ */ new Set();
  for (const v of [n, n.defaultView])
    for (const { type: x } of v?.listeners ?? []) xd[x] && z.add(xd[x]);
  return { schema: yg, root: C[0] ?? null, overlays: C.slice(1), document_events: [...z].sort(), unsupported: T.findings.list() };
}
const Xg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[2\\.35rem\\]", null, 4, [["padding-left", "2.35rem"]]], [".pl-\\[2\\.45rem\\]", null, 4, [["padding-left", "2.45rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Zg = null;
const Jg = () => Zg ??= new ug(Xg);
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
function Lg(n, l) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const c of o) {
    if (c === "children") continue;
    const s = n[c], d = l[c];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(c === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const Wg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function jd(n, l) {
  for (const o of Th(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const Fg = {
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
  createInstance: (n, l, o) => jd(new It(n, l, o.ownerDocument), l),
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
      jd(n, c);
    }
    Lg(o, c) && n.touch();
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
}, Se = Fh(Fg), Bi = (n, l, o = null) => Se.createPortal(n, l, null, o), Ig = {
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
}, $g = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Pg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), t0 = (n) => {
  for (let l = n; l instanceof It; l = l.parentNode) if (l.props.disabled && Pg.has(l.tagName)) return !0;
  return !1;
};
class e0 {
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
    const c = Ig[l.type], s = c && n.props[o ? `${c}Capture` : c];
    typeof s == "function" && s(l);
  }
}
function Iv(n, l, o = {}) {
  const { document: c, window: s, globals: d } = Oh(n), p = new It("div", { id: "root", style: o.container ?? {} }, c);
  c.body.appendChild(p);
  const f = [];
  let b = null;
  const y = () => [c, s].map((O) => O.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let T = "";
  const C = {}, z = `m${Math.random().toString(36).slice(2, 10)}:`;
  let v = 0, x = -1;
  c.measureKey = (O) => z + O.id, c.stale = () => x !== v, c.computed = (O) => {
    if (!C.cascade || !C.top) return null;
    const h = [];
    for (let A = O; A instanceof It && A !== c.body; A = A.parentNode) h.unshift(A);
    let g = C.top;
    for (const A of h) g = C.cascade.compute(A, g);
    return g.values;
  };
  const _ = () => (v += 1, b = Vg(c, n, Jg(), C, o.names), T = y(), n.render?.(b), b), S = () => {
    Se.flushPassiveEffects(), Se.flushSyncWork(), y() !== T && _();
  };
  c.afterCommit = _;
  const R = (O) => {
    f.push(O), n.error?.(O);
  }, E = Se.createContainer(p, hl.ConcurrentRoot, null, !1, null, "", R, R, R, null);
  Se.updateContainerSync(mt.createElement(l, o.props ?? {}), E, null, null), Se.flushSyncWork(), S();
  const j = (O) => {
    const h = (g) => {
      if (g.id === O) return g;
      for (const A of g.children) {
        const G = h(A);
        if (G) return G;
      }
      return null;
    };
    return h(c.documentElement);
  }, Q = (O) => {
    const h = en;
    en = hl.DiscreteEventPriority;
    try {
      return O();
    } finally {
      en = h, Se.flushSyncWork(), S();
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
      return b;
    },
    describe: _,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(O, h, g = {}) {
      const A = typeof O == "string" ? j(O) : O;
      if (!A || $g.has(h) && t0(A)) return !1;
      const G = new e0(h, g, A), L = [];
      for (let gt = A; gt; gt = gt.parentNode) L.push(gt);
      const F = [...L, c, s];
      Q(() => {
        for (let gt = F.length - 1; gt > 0 && !G.propagationStopped; gt--) yi(F[gt], G, !0);
        G.propagationStopped || (yi(A, G, !0), G.propagationStopped || yi(A, G, !1));
        for (let gt = 1; gt < F.length && !G.propagationStopped; gt++) yi(F[gt], G, !1);
      });
      const it = h === "click" && !G.defaultPrevented ? Bo(A) : null;
      return it && U.dispatch(it, "submit", {}), !G.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(O) {
      const h = c.activeElement && c.activeElement !== c.body ? c.activeElement : c.body;
      if (!U.dispatch(h, "keydown", O)) return !0;
      const A = O.key === "Enter" && !O.isComposing ? Bo(h, !0) : null;
      if (A)
        return U.dispatch(A, "submit", {}), !0;
      if (!ef(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((O.ctrlKey || O.metaKey) && !O.altKey && !O.shiftKey && O.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (O.ctrlKey || O.metaKey) return !1;
      const G = h.selectedAll;
      h.selectedAll = !1;
      const L = h.value, it = O.key === "Backspace" || G && O.key === "Delete" ? G ? "" : L.slice(0, -1) : [...O.key].length === 1 ? (G ? "" : L) + O.key : L;
      return it === L ? !1 : (h.value = it, U.dispatch(h, "input", { data: O.key }), U.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), _(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(O, h) {
      const g = j(O);
      g && (g.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(O) {
      const h = j(O);
      if (!h || h.props.disabled || !U.dispatch(O, "click", { button: 0, detail: 1 })) return;
      const g = h.props.type === "radio";
      g && h.checked || (h.checked = g ? !0 : !h.checked, U.dispatch(O, "input", {}), U.dispatch(O, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), _());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(O, h = {}) {
      const g = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const A of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) U.dispatch(O, A, g);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (O) => !!j(O)?.state.hover,
    hover(O, h) {
      const g = j(O);
      !g || g.state.hover === h || (g.state.hover = h, g.touch(), _());
    },
    focus(O) {
      const h = j(O);
      h && (Q(() => {
        const g = c.activeElement;
        g && g !== h && g !== c.body && U.dispatch(g, "blur"), c.focus(h), U.dispatch(h, "focus");
      }), _());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(O) {
      let g = typeof O == "string" ? j(O) : O;
      for (; g && !(g instanceof It && typeof g.props.onKeyDown == "function" && Wg(g)); ) g = g.parentNode;
      !g || g === c.activeElement || (U.focus(g.id), g.state.pointerFocus = !0, g.touch(), _());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return x = v, c.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const O = c.retries.splice(0);
      for (const h of O) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: S,
    update(O) {
      Se.updateContainerSync(mt.createElement(l, O ?? {}), E, null, null), Se.flushSyncWork(), S();
    },
    unmount() {
      Se.updateContainerSync(null, E, null, null), Se.flushSyncWork(), Se.flushPassiveEffects(), c.afterCommit = null, c.retries.length = 0, n.forgetBounds?.(z);
    }
  };
  return U;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const gf = (n) => Se.flushSyncFromReconciler(n), a0 = { createPortal: Bi, flushSync: gf }, $v = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Bi,
  default: a0,
  flushSync: gf
}, Symbol.toStringTag, { value: "Module" }));
function bf(n) {
  var l, o, c = "";
  if (typeof n == "string" || typeof n == "number") c += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (o = bf(n[l])) && (c && (c += " "), c += o);
  } else for (o in n) n[o] && (c && (c += " "), c += o);
  return c;
}
function vf() {
  for (var n, l, o = 0, c = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (l = bf(n)) && (c && (c += " "), c += l);
  return c;
}
const n0 = (n, l) => {
  const o = new Array(n.length + l.length);
  for (let c = 0; c < n.length; c++)
    o[c] = n[c];
  for (let c = 0; c < l.length; c++)
    o[n.length + c] = l[c];
  return o;
}, l0 = (n, l) => ({
  classGroupId: n,
  validator: l
}), yf = (n = /* @__PURE__ */ new Map(), l = null, o) => ({
  nextPart: n,
  validators: l,
  classGroupId: o
}), Oi = "-", Md = [], i0 = "arbitrary..", r0 = (n) => {
  const l = s0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: c
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return o0(p);
      const f = p.split(Oi), b = f[0] === "" && f.length > 1 ? 1 : 0;
      return xf(f, b, l);
    },
    getConflictingClassGroupIds: (p, f) => {
      if (f) {
        const b = c[p], y = o[p];
        return b ? y ? n0(y, b) : b : y || Md;
      }
      return o[p] || Md;
    }
  };
}, xf = (n, l, o) => {
  if (n.length - l === 0)
    return o.classGroupId;
  const s = n[l], d = o.nextPart.get(s);
  if (d) {
    const y = xf(n, l + 1, d);
    if (y) return y;
  }
  const p = o.validators;
  if (p === null)
    return;
  const f = l === 0 ? n.join(Oi) : n.slice(l).join(Oi), b = p.length;
  for (let y = 0; y < b; y++) {
    const T = p[y];
    if (T.validator(f))
      return T.classGroupId;
  }
}, o0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), o = l.indexOf(":"), c = l.slice(0, o);
  return c ? i0 + c : void 0;
})(), s0 = (n) => {
  const {
    theme: l,
    classGroups: o
  } = n;
  return c0(o, l);
}, c0 = (n, l) => {
  const o = yf();
  for (const c in n) {
    const s = n[c];
    as(s, o, c, l);
  }
  return o;
}, as = (n, l, o, c) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const p = n[d];
    u0(p, l, o, c);
  }
}, u0 = (n, l, o, c) => {
  if (typeof n == "string") {
    d0(n, l, o);
    return;
  }
  if (typeof n == "function") {
    f0(n, l, o, c);
    return;
  }
  m0(n, l, o, c);
}, d0 = (n, l, o) => {
  const c = n === "" ? l : wf(l, n);
  c.classGroupId = o;
}, f0 = (n, l, o, c) => {
  if (p0(n)) {
    as(n(c), l, o, c);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(l0(o, n));
}, m0 = (n, l, o, c) => {
  const s = Object.entries(n), d = s.length;
  for (let p = 0; p < d; p++) {
    const [f, b] = s[p];
    as(b, wf(l, f), o, c);
  }
}, wf = (n, l) => {
  let o = n;
  const c = l.split(Oi), s = c.length;
  for (let d = 0; d < s; d++) {
    const p = c[d];
    let f = o.nextPart.get(p);
    f || (f = yf(), o.nextPart.set(p, f)), o = f;
  }
  return o;
}, p0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, h0 = (n) => {
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
}, Xo = "!", Ad = ":", g0 = [], Od = (n, l, o, c, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: o,
  maybePostfixModifierPosition: c,
  isExternal: s
}), b0 = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: o
  } = n;
  let c = (s) => {
    const d = [];
    let p = 0, f = 0, b = 0, y;
    const T = s.length;
    for (let _ = 0; _ < T; _++) {
      const S = s[_];
      if (p === 0 && f === 0) {
        if (S === Ad) {
          d.push(s.slice(b, _)), b = _ + 1;
          continue;
        }
        if (S === "/") {
          y = _;
          continue;
        }
      }
      S === "[" ? p++ : S === "]" ? p-- : S === "(" ? f++ : S === ")" && f--;
    }
    const C = d.length === 0 ? s : s.slice(b);
    let z = C, v = !1;
    C.endsWith(Xo) ? (z = C.slice(0, -1), v = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      C.startsWith(Xo) && (z = C.slice(1), v = !0)
    );
    const x = y && y > b ? y - b : void 0;
    return Od(d, v, z, x);
  };
  if (l) {
    const s = l + Ad, d = c;
    c = (p) => p.startsWith(s) ? d(p.slice(s.length)) : Od(g0, !1, p, void 0, !0);
  }
  if (o) {
    const s = c;
    c = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return c;
}, v0 = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, c) => {
    l.set(o, 1e6 + c);
  }), (o) => {
    const c = [];
    let s = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], f = p[0] === "[", b = l.has(p);
      f || b ? (s.length > 0 && (s.sort(), c.push(...s), s = []), c.push(p)) : s.push(p);
    }
    return s.length > 0 && (s.sort(), c.push(...s)), c;
  };
}, y0 = (n) => ({
  cache: h0(n.cacheSize),
  parseClassName: b0(n),
  sortModifiers: v0(n),
  postfixLookupClassGroupIds: x0(n),
  ...r0(n)
}), x0 = (n) => {
  const l = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let c = 0; c < o.length; c++)
      l[o[c]] = !0;
  return l;
}, w0 = /\s+/, _0 = (n, l) => {
  const {
    parseClassName: o,
    getClassGroupId: c,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = l, f = [], b = n.trim().split(w0);
  let y = "";
  for (let T = b.length - 1; T >= 0; T -= 1) {
    const C = b[T], {
      isExternal: z,
      modifiers: v,
      hasImportantModifier: x,
      baseClassName: _,
      maybePostfixModifierPosition: S
    } = o(C);
    if (z) {
      y = C + (y.length > 0 ? " " + y : y);
      continue;
    }
    let R = !!S, E;
    if (R) {
      const h = _.substring(0, S);
      E = c(h);
      const g = E && p[E] ? c(_) : void 0;
      g && g !== E && (E = g, R = !1);
    } else
      E = c(_);
    if (!E) {
      if (!R) {
        y = C + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (E = c(_), !E) {
        y = C + (y.length > 0 ? " " + y : y);
        continue;
      }
      R = !1;
    }
    const j = v.length === 0 ? "" : v.length === 1 ? v[0] : d(v).join(":"), Q = x ? j + Xo : j, U = Q + E;
    if (f.indexOf(U) > -1)
      continue;
    f.push(U);
    const O = s(E, R);
    for (let h = 0; h < O.length; ++h) {
      const g = O[h];
      f.push(Q + g);
    }
    y = C + (y.length > 0 ? " " + y : y);
  }
  return y;
}, S0 = (...n) => {
  let l = 0, o, c, s = "";
  for (; l < n.length; )
    (o = n[l++]) && (c = _f(o)) && (s && (s += " "), s += c);
  return s;
}, _f = (n) => {
  if (typeof n == "string")
    return n;
  let l, o = "";
  for (let c = 0; c < n.length; c++)
    n[c] && (l = _f(n[c])) && (o && (o += " "), o += l);
  return o;
}, k0 = (n, ...l) => {
  let o, c, s, d;
  const p = (b) => {
    const y = l.reduce((T, C) => C(T), n());
    return o = y0(y), c = o.cache.get, s = o.cache.set, d = f, f(b);
  }, f = (b) => {
    const y = c(b);
    if (y)
      return y;
    const T = _0(b, o);
    return s(b, T), T;
  };
  return d = p, (...b) => d(S0(...b));
}, z0 = [], Zt = (n) => {
  const l = (o) => o[n] || z0;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Sf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, kf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, E0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, N0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, T0 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, C0 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, j0 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, M0 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, ja = (n) => E0.test(n), ht = (n) => !!n && !Number.isNaN(Number(n)), Je = (n) => !!n && Number.isInteger(Number(n)), Ao = (n) => n.endsWith("%") && ht(n.slice(0, -1)), ca = (n) => N0.test(n), zf = () => !0, A0 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  T0.test(n) && !C0.test(n)
), ns = () => !1, O0 = (n) => j0.test(n), R0 = (n) => M0.test(n), H0 = (n) => !I(n) && !$(n), D0 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), U0 = (n) => Ra(n, Tf, ns), I = (n) => Sf.test(n), tn = (n) => Ra(n, Cf, A0), Rd = (n) => Ra(n, X0, ht), B0 = (n) => Ra(n, Mf, zf), q0 = (n) => Ra(n, jf, ns), Hd = (n) => Ra(n, Ef, ns), Y0 = (n) => Ra(n, Nf, R0), xi = (n) => Ra(n, Af, O0), $ = (n) => kf.test(n), fl = (n) => nn(n, Cf), G0 = (n) => nn(n, jf), Dd = (n) => nn(n, Ef), K0 = (n) => nn(n, Tf), Q0 = (n) => nn(n, Nf), wi = (n) => nn(n, Af, !0), V0 = (n) => nn(n, Mf, !0), Ra = (n, l, o) => {
  const c = Sf.exec(n);
  return c ? c[1] ? l(c[1]) : o(c[2]) : !1;
}, nn = (n, l, o = !1) => {
  const c = kf.exec(n);
  return c ? c[1] ? l(c[1]) : o : !1;
}, Ef = (n) => n === "position" || n === "percentage", Nf = (n) => n === "image" || n === "url", Tf = (n) => n === "length" || n === "size" || n === "bg-size", Cf = (n) => n === "length", X0 = (n) => n === "number", jf = (n) => n === "family-name", Mf = (n) => n === "number" || n === "weight", Af = (n) => n === "shadow", Z0 = () => {
  const n = Zt("color"), l = Zt("font"), o = Zt("text"), c = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), f = Zt("container"), b = Zt("spacing"), y = Zt("radius"), T = Zt("shadow"), C = Zt("inset-shadow"), z = Zt("text-shadow"), v = Zt("drop-shadow"), x = Zt("blur"), _ = Zt("perspective"), S = Zt("aspect"), R = Zt("ease"), E = Zt("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], Q = () => [
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
  ], U = () => [...Q(), $, I], O = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], g = () => [$, I, b], A = () => [ja, "full", "auto", ...g()], G = () => [Je, "none", "subgrid", $, I], L = () => ["auto", {
    span: ["full", Je, $, I]
  }, Je, $, I], F = () => [Je, "auto", $, I], it = () => ["auto", "min", "max", "fr", $, I], gt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], wt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], V = () => ["auto", ...g()], et = () => [ja, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...g()], lt = () => [f, ja, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...g()], B = () => [ja, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...g()], q = () => [n, $, I], w = () => [...Q(), Dd, Hd, {
    position: [$, I]
  }], Y = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], nt = () => ["auto", "cover", "contain", K0, U0, {
    size: [$, I]
  }], tt = () => [Ao, fl, tn], at = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    $,
    I
  ], rt = () => ["", ht, fl, tn], St = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], dt = () => [ht, Ao, Dd, Hd], Ha = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    x,
    $,
    I
  ], Da = () => ["none", ht, $, I], Oe = () => ["none", ht, $, I], Re = () => [ht, $, I], da = () => [ja, "full", ...g()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [ca],
      breakpoint: [ca],
      color: [zf],
      container: [ca],
      "drop-shadow": [ca],
      ease: ["in", "out", "in-out"],
      font: [H0],
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
        aspect: ["auto", "square", ja, I, $, S]
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
      "container-named": [D0],
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
        overflow: O()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": O()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": O()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: h()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": h()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": h()
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
        inset: A()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": A()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": A()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": A(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: A()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": A(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: A()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": A()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": A()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: A()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: A()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: A()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: A()
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
        basis: [ja, "full", "auto", f, ...g()]
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
        order: [Je, "first", "last", "none", $, I]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": G()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: L()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": F()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": F()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": G()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: L()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": F()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": F()
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
        "auto-cols": it()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": it()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: g()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": g()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": g()
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
        p: g()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: g()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: g()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: g()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: g()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: g()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: g()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: g()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: g()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: g()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: g()
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
        "space-x": g()
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
        "space-y": g()
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
        font: [c, V0, B0]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Ao, I]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [G0, q0, l]
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
        "line-clamp": [ht, "none", $, Rd]
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
          ...g()
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
        indent: g()
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
          }, Je, $, I],
          radial: ["", $, I],
          conic: ["", Je, $, I]
        }, Q0, Y0]
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
        border: rt()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": rt()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": rt()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": rt()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": rt()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": rt()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": rt()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": rt()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": rt()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": rt()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": rt()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": rt()
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
        "divide-y": rt()
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
        shadow: q()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", C, wi, xi]
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
        ring: rt()
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
        "inset-ring": rt()
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
        "text-shadow": ["none", z, wi, xi]
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
        "mask-linear-from": dt()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": dt()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": q()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": q()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": dt()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": dt()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": q()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": q()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": dt()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": dt()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": q()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": q()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": dt()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": dt()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": q()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": q()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": dt()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": dt()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": q()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": q()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": dt()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": dt()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": q()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": q()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": dt()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": dt()
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
        "mask-radial-from": dt()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": dt()
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
        "mask-radial-at": Q()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [ht]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": dt()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": dt()
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
        mask: w()
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
        "border-spacing": g()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": g()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": g()
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
        ease: ["linear", "initial", R, $, I]
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
        animate: ["none", E, $, I]
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
        perspective: [_, $, I]
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
        "scroll-m": g()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": g()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": g()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": g()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": g()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": g()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": g()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": g()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": g()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": g()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": g()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": g()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": g()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": g()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": g()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": g()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": g()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": g()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": g()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": g()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": g()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": g()
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
        stroke: [ht, fl, tn, Rd]
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
}, J0 = /* @__PURE__ */ k0(Z0);
function Ae(...n) {
  return J0(vf(n));
}
function L0(n, l, o) {
  return n.filter((c, s) => s !== l && (c.start + c.end) / 2 < o).length;
}
function W0(n, l, o, c) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const p = n[l + 1], f = n[l - 1], b = d.end - d.start + (p ? p.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((y, T) => {
    l < o && T > l && T <= o ? s[T] = -b : o < l && T >= o && T < l && (s[T] = b);
  }), s[l] = Math.min(Math.max(c, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const Ud = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function F0(n, l) {
  for (let o = n.parentElement; o; o = o.parentElement) {
    const c = getComputedStyle(o)[l === "x" ? "overflowX" : "overflowY"];
    if ((c === "auto" || c === "scroll") && (l === "x" ? o.scrollWidth > o.clientWidth : o.scrollHeight > o.clientHeight)) return o;
  }
  return null;
}
function I0(n, l, o, c) {
  const s = n[l] ? F0(n[l], o) : null, d = () => s ? o === "x" ? s.scrollLeft : s.scrollTop : 0, p = (S) => (o === "x" ? S.clientX : S.clientY) + d(), f = p(c), b = d(), y = n.map((S) => {
    const R = S.getBoundingClientRect();
    return o === "x" ? { start: R.left + b, end: R.right + b } : { start: R.top + b, end: R.bottom + b };
  }), T = n.map((S) => Ud.map((R) => S.style[R])), C = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, z = o === "x" ? "translateX" : "translateY";
  let v = !1;
  const x = { to: l };
  n.forEach((S, R) => {
    if (S.style.pointerEvents = "none", R !== l) {
      C || (S.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(S).position === "static" && (S.style.position = "relative"), S.style.zIndex = "30", S.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const _ = (S, R) => {
    x.to = S, W0(y, l, S, R).forEach((E, j) => {
      n[j].style.transform = E ? `${z}(${E}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return x.to;
    },
    slot: (S) => L0(y, l, p(S)),
    apply: (S, R) => {
      v || _(S, p(R) - f);
    },
    rest: () => {
      v || _(l, 0);
    },
    end: () => {
      v || (v = !0, n.forEach((S, R) => Ud.forEach((E, j) => {
        S.style[E] = T[R][j];
      })));
    }
  };
}
const $0 = 5;
let Oo = !1;
function P0(n, l) {
  if (n.button !== 0 || Oo) return;
  const o = { clientX: n.clientX, clientY: n.clientY }, c = n.currentTarget, s = n.pointerId;
  let d = null, p, f = !1;
  const b = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, y = (x) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", T), window.removeEventListener("pointerup", C), window.removeEventListener("pointercancel", z), window.removeEventListener("keydown", v, !0), window.removeEventListener("blur", z), c.removeEventListener("lostpointercapture", z);
    try {
      c.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    Oo = !1, document.body.style.cursor = b.cursor, document.body.style.userSelect = b.userSelect, d.end();
    const _ = (S) => S.stopPropagation();
    window.addEventListener("click", _, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", _, !0), 0), p?.(), l.onEnd(x, d);
  }, T = (x) => {
    if (!d) {
      if (Math.hypot(x.clientX - o.clientX, x.clientY - o.clientY) < $0) return;
      const _ = l.items();
      d = I0(_, l.from(_), l.axis, o), Oo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        c.setPointerCapture(s);
      } catch {
      }
      c.addEventListener("lostpointercapture", z);
      const S = l.onStart?.();
      p = typeof S == "function" ? S : void 0;
    }
    l.onMove(x, d);
  }, C = () => y(!0), z = () => y(!1), v = (x) => {
    x.key === "Escape" && (x.stopPropagation(), y(!1));
  };
  window.addEventListener("pointermove", T), window.addEventListener("pointerup", C), window.addEventListener("pointercancel", z), window.addEventListener("keydown", v, !0), window.addEventListener("blur", z);
}
const Of = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ri = {
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
const tb = Object.fromEntries(Object.entries(Ri).map(([n, l]) => [l, n])), eb = {
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
function ab(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : tb[n];
}
const Bd = /* @__PURE__ */ new Map();
function Rf(n, l = Of) {
  const o = `${l}|${n}`, c = Bd.get(o);
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
  return Bd.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = Rf(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function nb(n, l = Of) {
  const o = Rf(n, l), c = lb(ab(o.code) ?? "");
  return l ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${c}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", c].filter(Boolean).join("+");
}
const lb = (n) => eb[n] ?? n.toUpperCase(), qd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Yd = vf, qi = (n, l) => (o) => {
  var c;
  if (l?.variants == null) return Yd(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = l, p = Object.keys(s).map((y) => {
    const T = o?.[y], C = d?.[y];
    if (T === null) return null;
    const z = qd(T) || qd(C);
    return s[y][z];
  }), f = o && Object.entries(o).reduce((y, T) => {
    let [C, z] = T;
    return z === void 0 || (y[C] = z), y;
  }, {}), b = l == null || (c = l.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((y, T) => {
    let { class: C, className: z, ...v } = T;
    return Object.entries(v).every((x) => {
      let [_, S] = x;
      return Array.isArray(S) ? S.includes({
        ...d,
        ...f
      }[_]) : {
        ...d,
        ...f
      }[_] === S;
    }) ? [
      ...y,
      C,
      z
    ] : y;
  }, []);
  return Yd(n, p, b, o?.class, o?.className);
}, ib = qi(
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
), rb = qi(
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
function ob({ className: n, ...l } = {}) {
  return Ae(rb(l), n);
}
const Hf = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Df = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", sb = qi(`${Df} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function cb({ className: n, ...l } = {}) {
  return Ae(sb(l), n);
}
const Uf = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", ub = qi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), db = "my-1 h-px bg-overlay-0";
function fb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ Nt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function mb({ size: n = 16, className: l }) {
  return /* @__PURE__ */ Nt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ Nt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ Nt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function pb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Bf({ size: n = 14, className: l }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Gd = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function hb({ state: n, error: l }) {
  return /* @__PURE__ */ Nt.jsx(
    "span",
    {
      className: Ae("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Gd[n] ?? Gd.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function gb({ title: n, onClose: l, children: o, testId: c }) {
  return Bi(
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
const _i = 4, Ma = 8, bb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Kd = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function vb({ value: n, onChange: l, options: o, className: c, ariaLabel: s, testId: d, id: p, title: f, disabled: b, placeholder: y, freeText: T, onKeyDown: C }) {
  const z = mt.useId(), [v, x] = mt.useState(!1), [_, S] = mt.useState(-1), [R, E] = mt.useState(!1), j = mt.useRef(null), Q = mt.useRef(null), [U, O] = mt.useState({}), h = mt.useRef({ text: "", at: 0 }), g = T && R && n ? o.filter((B) => Kd(B).toLowerCase().includes(n.toLowerCase()) || B.value.toLowerCase().includes(n.toLowerCase())) : o, A = o.find((B) => B.value === n), G = (B) => `${z}-${B}`;
  function L(B) {
    b || (S(B), x(!0));
  }
  function F() {
    x(!1), E(!1), S(-1);
  }
  function it(B) {
    !B || B.disabled || (l(B.value), F());
  }
  function gt(B, q) {
    for (let w = 1; w <= g.length; w++) {
      const Y = (B + q * w + g.length * w) % g.length;
      if (!g[Y].disabled) return Y;
    }
    return B;
  }
  const wt = () => g.findIndex((B) => !B.disabled), V = () => g.length - 1 - [...g].reverse().findIndex((B) => !B.disabled);
  qo(() => {
    if (!v || !j.current) {
      O((nt) => nt.left === void 0 ? nt : {});
      return;
    }
    const B = j.current.getBoundingClientRect(), q = window.innerHeight - B.bottom - _i - Ma, w = B.top - _i - Ma, Y = q < 160 && w > q;
    O({
      position: "fixed",
      left: Math.min(Math.max(Ma, B.left), Math.max(Ma, window.innerWidth - B.width - Ma)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: B.width,
      maxWidth: window.innerWidth - 2 * Ma,
      maxHeight: Math.min(Y ? w : q, 320),
      ...Y ? { bottom: window.innerHeight - B.top + _i } : { top: B.bottom + _i },
      overflowY: "auto"
    });
  }, [v, g.length]), qo(() => {
    const B = Q.current;
    if (!v || !B || U.left === void 0) return;
    const q = B.getBoundingClientRect().right, w = window.innerWidth - Ma;
    q > w && O((Y) => ({ ...Y, left: Math.max(Ma, Number(Y.left) - (q - w)) }));
  }, [v, U]), Le(() => {
    if (!v) return;
    const B = (q) => {
      const w = q.target;
      (w === document || w instanceof Node && j.current && w.contains(j.current)) && F();
    };
    return window.addEventListener("resize", F), window.addEventListener("scroll", B, !0), () => {
      window.removeEventListener("resize", F), window.removeEventListener("scroll", B, !0);
    };
  }, [v]), Le(() => {
    const B = v && _ >= 0 ? document.getElementById(G(_)) : null, q = Q.current;
    !B || !q || (B.offsetTop < q.scrollTop ? q.scrollTop = B.offsetTop : B.offsetTop + B.offsetHeight > q.scrollTop + q.clientHeight && (q.scrollTop = B.offsetTop + B.offsetHeight - q.clientHeight));
  }, [v, _]), Yf(v, (B) => {
    B || F();
  }, j, Q);
  function et(B) {
    if (B.nativeEvent.isComposing) return;
    const q = () => {
      B.preventDefault(), B.stopPropagation();
    }, { key: w } = B;
    if (v) {
      if (w === "Escape") {
        q(), F();
        return;
      } else if (w === "Tab")
        F();
      else if (w === "ArrowDown" || w === "ArrowUp") {
        q(), g.length && S(_ < 0 ? w === "ArrowDown" ? wt() : V() : gt(_, w === "ArrowDown" ? 1 : -1));
        return;
      } else if (w === "Home" && !T) {
        q(), S(wt());
        return;
      } else if (w === "End" && !T) {
        q(), S(V());
        return;
      } else if (w === "Enter" || w === " " && !T) {
        if (_ >= 0 && g[_]) {
          q(), it(g[_]);
          return;
        }
        if (!T) {
          q(), F();
          return;
        }
      } else if (!T && w.length === 1 && !B.metaKey && !B.ctrlKey && !B.altKey) {
        const Y = Date.now();
        h.current = { text: (Y - h.current.at > 600 ? "" : h.current.text) + w.toLowerCase(), at: Y };
        const nt = Math.max(_, 0), tt = [...g.slice(nt + (h.current.text.length === 1 ? 1 : 0)), ...g.slice(0, nt + 1)].find((at) => !at.disabled && Kd(at).toLowerCase().startsWith(h.current.text));
        tt && (q(), S(g.indexOf(tt)));
        return;
      }
    } else if (w === "ArrowDown" || w === "ArrowUp" || !T && (w === "Enter" || w === " ")) {
      q(), L(Math.max(0, g.findIndex((Y) => Y.value === n)));
      return;
    }
    C?.(B);
  }
  const lt = {
    ref: (B) => {
      j.current = B;
    },
    id: p,
    title: f,
    disabled: b,
    "aria-label": s,
    "aria-expanded": v,
    "aria-controls": v ? z : void 0,
    "aria-activedescendant": v && _ >= 0 ? G(_) : void 0,
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
        placeholder: y,
        className: c,
        value: n,
        onChange: (B) => {
          l(B.target.value), E(!0), v ? S(-1) : (S(-1), x(!0));
        },
        onBlur: () => F()
      }
    ) : /* @__PURE__ */ Nt.jsxs(
      "button",
      {
        ...lt,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Ae("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", c),
        onClick: () => v ? F() : L(Math.max(0, g.findIndex((B) => B.value === n))),
        children: [
          /* @__PURE__ */ Nt.jsx("span", { className: "min-w-0 flex-1 truncate", children: A ? A.label : y ?? "" }),
          /* @__PURE__ */ Nt.jsx(qf, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    v && g.length > 0 && Bi(
      /* @__PURE__ */ Nt.jsx(
        "div",
        {
          ref: Q,
          id: z,
          role: "listbox",
          "aria-label": s,
          className: Ae("z-[9999]", Uf),
          style: U,
          onMouseDown: (B) => {
            B.preventDefault(), B.stopPropagation();
          },
          onClick: (B) => B.stopPropagation(),
          children: g.map((B, q) => /* @__PURE__ */ Nt.jsxs(
            "div",
            {
              id: G(q),
              role: "option",
              "aria-selected": B.value === n,
              "aria-disabled": B.disabled || void 0,
              "data-value": B.value,
              className: Ae(bb, q === _ && !B.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                B.disabled || S(q);
              },
              onClick: () => it(B),
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
const yb = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", xb = `${yb} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function qf({ open: n, size: l = 12, className: o }) {
  return /* @__PURE__ */ Nt.jsx("svg", { className: o, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ Nt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function wb(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Zo = {
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
function Jo(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((o) => o.id === n.parentSessionId);
}
function _b(n) {
  const l = /* @__PURE__ */ new Map();
  for (const o of n)
    Jo(o, n) && l.set(o.parentSessionId, [...l.get(o.parentSessionId) ?? [], o]);
  return l.size ? n.filter((o) => !Jo(o, n)).flatMap((o) => [o, ...l.get(o.id) ?? []]) : n;
}
const Si = 6, Qd = 8;
function Sb(n, l = {}) {
  const { minWidth: o = 220, align: c = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), p = window.innerWidth, f = window.innerHeight, b = c === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, y = d.top - Si - Qd, T = f - d.bottom - Si - Qd;
  return y >= s ? {
    position: "fixed",
    bottom: f - d.top + Si,
    ...b,
    minWidth: o,
    maxHeight: Math.min(y, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Si,
    ...b,
    minWidth: o,
    maxHeight: Math.min(T, f * 0.75),
    overflowY: "auto"
  };
}
function Yf(n, l, o, c) {
  Le(() => {
    if (!n) return;
    function s(p) {
      const f = p.target, b = o.current?.contains(f) ?? !1, y = c.current?.contains(f) ?? !1;
      !b && !y && l(!1);
    }
    function d(p) {
      p.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function kb({ icon: n, fallback: l }) {
  const [o, c] = mt.useState(!1);
  return Le(() => c(!1), [n]), !n || o ? /* @__PURE__ */ Nt.jsx(Nt.Fragment, { children: l }) : /* @__PURE__ */ Nt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => c(!0) });
}
const zb = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Eb = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Nb = "1.3.0";
let Ei = null;
const Tb = (n) => {
  Ei = n;
};
function Tt() {
  const n = (typeof Ei == "function" ? Ei() : Ei) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Cb = (n) => Tt().subscribe?.(n) ?? (() => {
}), jb = Sb, Mb = globalThis.perch?.isMac !== !1, Ab = (n) => nb(n, Tt().isMac !== !1), Ob = (n) => ib(n), Rb = ({ className: n, ...l } = {}) => Ae(ob(l), n), Hb = cb, Db = (n) => ub(n), Ub = db, Bb = Df, qb = Hf, Yb = (n) => Zo[n].color, Gb = (n, l) => Tt().shortcutFor?.(n, l) ?? null, Kb = (n) => Tt().shortcutLabel?.(n) ?? null, Yi = (n, l) => Tt().command(n, l ?? {}) !== !1, Qb = (n, l, o) => Tt().startSession?.(n, l, o), Vb = globalThis.perch?.pickFolder ? (n) => Tt().pickFolder(n) : null;
function oe(n) {
  const l = mt.useRef(n);
  return l.current = n, mt.useSyncExternalStore(Cb, () => l.current(Tt()));
}
const Gf = (n = {}) => oe((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Xb = () => oe((n) => n.hosts()), Zb = () => oe((n) => n.sessionFolders());
function Jb() {
  const n = oe((l) => l.addProject?.() ?? Lb);
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
const Lb = Object.freeze({ status: "idle" }), Kf = "perch.lastAgentChoice", Wb = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Fb = () => {
  const n = Tt().storage?.getItem(Kf);
  return n === "claude" || n === "codex" ? n : "claude";
}, Ib = Object.freeze({ items: [] });
function $b() {
  const n = oe((l) => l.notifications?.() ?? Ib);
  return mt.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Tt().command("notification.open", { id: l }),
    dismiss: (l) => Tt().command("notification.dismiss", { id: l })
  }), [n]);
}
function Pb(n) {
  const l = oe((s) => s.agentChoices?.(n) ?? Wb), [o, c] = mt.useState(Fb);
  return mt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: o,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (Tt().storage?.setItem(Kf, s), c(s));
    },
    manage: () => Tt().command("agents.manage", {})
  }), [l, o]);
}
function tv(n) {
  Le(() => Tt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function ev(n) {
  const l = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return _b(l).map((o) => ({ session: o.session, nested: Jo(o, l) }));
}
function av({ id: n, plain: l, className: o }) {
  const c = oe((y) => y.session(n));
  if (!c) return null;
  const s = c.state ?? wb(c), d = Zo[s]?.color ?? Zo.unknown.color, p = c.provider, f = p === "claude" || p === "claude-agent-teams" || p === "omp", b = l ? Ae("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Ae("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return mt.createElement(
    "span",
    { className: b, style: l ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: l ? p ?? "Agent" : `${p ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    mt.createElement("span", { className: Ae("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, mt.createElement(Qf, { provider: p, size: 14 }))
  );
}
function Qf({ provider: n, size: l = 14 }) {
  const o = Tt().agentIcon?.(n, l) ?? null, c = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return mt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": c, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const nv = ({ children: n }) => mt.createElement(mt.Fragment, null, n);
function lv(n, l) {
  const o = mt.useRef(l);
  return o.current = l, Le(() => {
    const c = Tt();
    if (!c.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [p, f] of Object.entries(o.current))
      s[p] = typeof f == "function" ? (...b) => o.current[p]?.(...b) : f;
    const d = c.openOverlay(n, s);
    return () => c.closeOverlay?.(d);
  }, [n]), null;
}
const ln = (n) => function(o) {
  return lv(n, o);
}, iv = ln("session-menu"), rv = ln("new-session-menu"), ov = ln("confirm");
let Vf = null;
const sv = (n) => {
  Vf = n;
};
function cv(n) {
  return mt.createElement(Vf ?? ov, n);
}
function uv({ className: n = xb, ...l }) {
  return mt.createElement(vb, { ...l, className: n });
}
let Lo = null;
const dv = (n) => {
  Lo = n;
}, fv = ln("folder-browser");
function mv(n) {
  return Lo ? mt.createElement(Lo, { ...n, browse: (l) => Tt().browse(n.hostId, l) }) : mt.createElement(fv, n);
}
const pv = ln("instructions"), hv = ln("memory"), gv = gb;
let ls = null;
const bv = (n) => {
  ls = n;
};
function vv(n) {
  if (ls) return mt.createElement(xv, n);
  const { hostId: l, path: o, className: c } = n, s = mt.useRef(null);
  return mt.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Ae("worktree-menu__btn", Hf, c),
      "data-testid": `worktree-menu-${l}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Tt().openOverlay?.("worktree", { hostId: l, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    mt.createElement(Bf, null)
  );
}
const Xf = "Perch did not answer.";
function ki(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Xf };
}
function yv(n, l, o = Tt()) {
  const c = (s) => {
    for (const d of s ?? []) {
      if (d.path === l) return d;
      const p = c(d.children);
      if (p) return p;
    }
    return null;
  };
  for (const s of o.navigation({})?.projects ?? []) {
    if (s.hostId !== n) continue;
    const d = c(s.workspaces) ?? c(s.hidden);
    if (d) return d;
  }
  return null;
}
const Vd = 5 * 6e4;
function Zf(n, l, o, c = Tt()) {
  const s = Date.now() + Vd;
  let d = !1, p = () => {
  };
  const f = () => {
    d = !0, p(), clearTimeout(y);
  }, b = () => {
    if (!d) {
      if (Date.now() >= s) return f();
      yv(n, l, c) && (f(), c.startSession?.(n, l, o));
    }
  }, y = setTimeout(f, Vd);
  p = c.subscribe?.(b) ?? (() => {
  }), b();
}
function xv({ hostId: n, path: l, className: o, worktrees: c, request: s, parentChoices: d, emptyAgent: p, ...f }) {
  const [b, y] = mt.useState(c), T = (G) => !!Tt().coreCan?.(G, n), C = Gf(), z = `${n}:${l}`, v = mt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!T("workspace.nest")) return [];
    const G = C?.projects?.find((it) => it.hostId === n && it.repoPath === l), L = [], F = (it, gt) => {
      for (const wt of it ?? [])
        gt && L.push({ id: wt.id, name: wt.name, path: wt.path }), F(wt.children, !0);
    };
    return F(G?.workspaces, !1), L;
  }, [d, C, n, l]), x = n === "local" && T("worktree.job"), _ = f.deleteSupported ?? T("worktree.delete"), S = f.startFromSupported ?? T("worktree.startFrom"), R = oe((G) => G.emptyWorkspaceAgent?.() ?? void 0), E = p ?? R ?? void 0, j = oe((G) => G.worktreeMenuRequest?.() ?? null), Q = j?.projectKey === z ? j.nonce : null, U = mt.useMemo(() => s ?? (Q == null ? null : j), [s, Q]), [O, h] = mt.useState(U);
  Le(() => {
    U && h(U);
  }, [U]);
  const g = mt.useRef({});
  g.current = { background: x, deleteSupported: _ };
  const A = mt.useMemo(() => {
    const G = (L, F) => Tt().ask(L, { hostId: n, repoPath: l, ...F });
    return {
      list: async () => {
        const L = await G("worktree.list", {});
        return L?.type === "worktree.list.result" && y({ worktrees: L.worktrees ?? [], defaultRoot: L.defaultRoot ?? "", baseRef: L.baseRef, refs: L.refs ?? [] }), ki(L);
      },
      create: async ({ branch: L, newBranch: F, path: it, extra: gt, agent: wt }) => {
        const V = { branch: L, newBranch: !!F, path: it ?? null, name: gt?.name ?? null, startFrom: gt?.startFrom ?? null, parentWorkspaceId: gt?.parentWorkspaceId ?? null }, { background: et } = g.current, lt = await G(et ? "worktree.job.start" : "worktree.create", V), B = et ? "worktree.job.started" : "worktree.done";
        if (lt?.type !== B) return { error: ki(lt).error ?? Xf };
        const q = et ? lt.job?.path : lt.path;
        return wt && q && Zf(n, q, wt), { background: et };
      },
      remove: async (L, F) => {
        const it = await G("worktree.remove", { path: L, force: !!F, deleteBranch: g.current.deleteSupported });
        return { ...ki(it), preservedBranch: it?.type === "worktree.done" ? it.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (L, F) => ki(await G("worktree.branch.delete", { branch: L, expectedHead: F })),
      open: (L) => Tt().startSession?.(n, L, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Tt().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return mt.createElement(ls, {
    hostId: n,
    cwd: l,
    projectKey: z,
    className: o,
    worktrees: b,
    background: x,
    startFromSupported: S,
    deleteSupported: _,
    parentChoices: v,
    emptyAgent: E,
    request: O,
    actions: A
  });
}
const wv = (n, l) => {
  if (!Tt().followPointer?.(n)) return;
  const o = l.items();
  for (const c of o) c.getBoundingClientRect();
  o[0]?.parentElement?.getBoundingClientRect(), P0(n, l);
}, _v = () => oe((n) => n.workspaceTabs()), Sv = () => oe((n) => n.statusLine()), kv = () => oe((n) => n.zoom()), zv = () => oe((n) => n.paneLook()), Ev = () => oe((n) => n.keybindings?.() ?? []), Nv = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Tv(n) {
  const l = !!n?.keepFresh, o = oe((s) => s.statusLine?.().connected ?? !1), c = oe((s) => s.planUsage?.() ?? Nv);
  return Le(() => {
    if (!l || !o) return;
    let s;
    const d = () => {
      Tt().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, o]), c;
}
const Cv = () => Tt().command("usage.get", { force: !0 }), jv = (n) => Tt().command("usage.redeemReset", { accountId: n }), Mv = () => Yi("app.zoom_reset"), Av = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Ov = (n, l, o) => Tt().beginTabDrag?.(n, l, o);
function Rv(n) {
  Le(() => Tt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Hv = (n) => Yi("browser.open", { workspaceId: n }), Dv = (n, l) => Yi("file.open", { workspaceId: n, path: l }), Uv = () => null, Bv = () => null, qv = ln("new-file"), Pv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Qf,
  Chevron: qf,
  CloseIcon: pb,
  ConfirmDialog: cv,
  Dialog: gv,
  EllipsisIcon: fb,
  FolderBrowser: mv,
  GearIcon: mb,
  HostStateDot: hb,
  InstructionsDialog: pv,
  MemoryDialog: hv,
  NewFilePrompt: qv,
  NewSessionMenu: rv,
  PageIcon: kb,
  PlusIcon: Bf,
  Select: uv,
  SessionDot: av,
  SessionMenu: iv,
  Slot: nv,
  TabDragLayer: Bv,
  TabMenu: Uv,
  WorktreeMenu: vv,
  agentStateColor: Yb,
  anchoredPopoverStyle: jb,
  beginReorderDrag: wv,
  beginTabDrag: Ov,
  bindHost: Tb,
  buttonClass: Hb,
  cn: Ae,
  drawConfirmationsInPlace: sv,
  drawFolderBrowserInPlace: dv,
  drawWorktreeInPlace: bv,
  ghostButton: Bb,
  glassClass: zb,
  iconButton: qb,
  isMac: Mb,
  keyLabel: Ab,
  menuDividerClass: Ub,
  menuItemClass: Db,
  menuPanel: Uf,
  nestSessions: ev,
  openBrowserTab: Hv,
  openFileTab: Dv,
  pickFolder: Vb,
  redeemUsageReset: jv,
  refreshUsage: Cv,
  resetZoom: Mv,
  rowActionClass: Rb,
  runCommand: Yi,
  segmentClass: Ob,
  shortcutFor: Gb,
  shortcutLabel: Kb,
  startPaneWhenReady: Zf,
  startSession: Qb,
  tabStateClass: Av,
  tapButtonClass: Eb,
  useAddProject: Jb,
  useAddProjectRequest: tv,
  useAgentChoices: Pb,
  useDismissOnOutsideClick: Yf,
  useHosts: Xb,
  useKeybindings: Ev,
  useNavigation: Gf,
  useNewTabRequest: Rv,
  useNotifications: $b,
  usePaneLook: zv,
  usePlanUsage: Tv,
  useSessionFolders: Zb,
  useStatusLine: Sv,
  useWorkspaceTabs: _v,
  useZoom: kv,
  version: Nb
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
const is = {
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
  is[n] = (l, o) => l[n](o);
const ty = Object.keys(is);
function Xd(n, l) {
  for (const [o, c] of Object.entries(l)) {
    const s = is[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    c != null && (n = s(n, c));
  }
  return n;
}
const Aa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Zd = /* @__PURE__ */ new WeakSet(), Ro = /* @__PURE__ */ new WeakSet();
function Jd(n, l, o) {
  const c = n.pressed, s = Aa(o);
  return c && c.x === s.clientX && c.y === s.clientY ? c.id : l;
}
function Yv(n, l, o) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const c = n.meta?.attrs["data-testid"];
  return c ? `~${n.id}:${c}` : `~${n.id}`;
}
const Jf = (n, l = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !l || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && Jf(o, !0)), ze = (n) => n.style?.display !== "hidden";
function Wo(n, l, o, c, s = !1, d = !1, p = null, f = {}, b = !1, y = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return y.get(n)?.text ?? n.text;
  const T = Zd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), p = n.style.text_color ?? p;
  const C = !!n.hover?.text_color && If(n);
  C && o.hovered?.(n.id) && (p = n.hover.text_color), f = { ...f };
  for (const h of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[h] !== void 0 && (f[h] = n.style[h]);
  const z = new Set(n.events ?? []);
  let v;
  n.kind === "image" && !n.markup ? v = l.image(n.src) : v = l.div(), n.markup && (v = v.child(c.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const x = Yv(n, z, s);
  if (x && (v = v.id(x)), n.measure && (v = v.measure(n.measure)), n.name && v.also_named) for (const h of n.also ?? []) v = v.also_named(h);
  v = Xd(v, { ...n.style, ...y.get(n) });
  const _ = f.whitespace !== "nowrap" && !f.text_ellipsis;
  b && _ && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Jf(n) && (v = v.min_w(0));
  for (const h of ["hover", "focus", "active"]) n[h] && (v = v[h]((g) => Xd(g, n[h])));
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const h = o.document?.scrollTarget, g = h ? (n.children ?? []).filter(ze).findIndex((A) => Ff(A, h.id)) : -1;
    if (g >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, l.scroll.scroll_to_item(g)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      v = v.track_scroll(l.scroll);
      const A = (n.children ?? []).filter(ze).map((G) => G.id);
      o.document.itemBounds = (G) => A.includes(G) ? l.scroll.item_bounds?.(A.indexOf(G)) ?? null : null;
    }
  }
  const S = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll";
  if (S && Ro.has(n) && (v = v.on_scroll_wheel((h, g) => g.stop_propagation?.())), S || Ro.has(n)) for (const h of n.children ?? []) h.kind !== "text" && Ro.add(h);
  n.kind === "input" && !n.disabled && (v = v.on_mouse_down("left", (h, g) => {
    h.bounds && o.setBounds(n.id, h.bounds), o.focus(n.id), g.notify();
  }));
  const R = n.kind === "input" ? n : n.meta?.tag === "label" ? Wf(n) : null;
  R && !R.disabled && /^(checkbox|radio)$/.test(R.input_type) && (v = v.on_click((h, g) => {
    g.stop_propagation?.(), o.toggle(R.id), g.notify();
  }));
  const E = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((h) => z.has(h));
  if (E || T) for (const h of n.children ?? []) h.kind !== "text" && Zd.add(h);
  if (E && (v = v.on_mouse_down("left", (h, g) => {
    g.stop_propagation?.(), h.bounds && o.setBounds(n.id, h.bounds);
    const A = { ...Aa(h), button: 0, buttons: 1, detail: h.click_count }, G = Jd(o, n.id, h);
    o.pressed = null, o.dispatch(G, "pointerdown", { ...A, pointerType: "mouse" }), o.dispatch(G, "mousedown", A) && o.pressFocus?.(G), g.notify();
  }), v = v.on_mouse_down("right", (h, g) => {
    g.stop_propagation?.(), h.bounds && o.setBounds(n.id, h.bounds);
    const A = Jd(o, n.id, h);
    o.pressed = null, o.dispatch(A, "contextmenu", { ...Aa(h), button: 2 }), g.notify();
  }), v = v.on_mouse_up("left", (h, g) => {
    g.stop_propagation?.();
    const A = { ...Aa(h), button: 0 };
    o.dispatch(n.id, "pointerup", { ...A, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", A), g.notify();
  }), v = v.on_click((h, g) => {
    o.dispatch(n.id, h.click_count === 2 && z.has("double_click") ? "dblclick" : "click", { detail: h.click_count, button: 0 }), g.notify();
  })), n.blocks_pointer && !E)
    for (const h of ["left", "right"]) v = v.on_mouse_down(h, (g, A) => A.stop_propagation?.());
  else if (T && !E)
    for (const h of ["left", "right"])
      v = v.on_mouse_down(h, (g) => {
        const A = Aa(g);
        (o.pressed?.x !== A.clientX || o.pressed?.y !== A.clientY) && (o.pressed = { id: n.id, x: A.clientX, y: A.clientY });
      });
  if (z.has("mouse_move") && (v = v.on_mouse_move((h, g) => {
    o.dispatch(n.id, "pointermove", { ...Aa(h), pointerType: "mouse" }), g.notify();
  })), (n.track_hover || C) && (v = v.on_hover((h, g) => {
    o.hover(n.id, h), g.notify();
  })), s && (v = v.on_mouse_down_out((h, g) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Aa(h), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Aa(h)), g.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const h = n.value ? String(n.value) : String(n.placeholder ?? "");
    let g = l.div().whitespace_nowrap().overflow_x_hidden();
    const A = an(f);
    A && (g = g.h(A)), !n.value && p && (g = g.text_color(Kv(p))), h && (v = v.child(g.child(n.input_type === "password" && n.value ? "•".repeat([...h].length) : h))), n.field_w && (v = v.child(l.div().w(n.field_w).h(0)));
  }
  const j = f.whitespace === "nowrap" ? an(f) : null, Q = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let U = !n.range_name;
  const O = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const h of (n.children ?? []).filter(ze)) {
    const g = h.style?.flex_basis;
    O && h.style.flex_grow > 0 && (g === 0 || typeof g == "string" && g.endsWith("%")) && y.set(h, { ...y.get(h), flex_basis: "auto" });
    let A = Wo(h, l, o, c, !1, d, p, f, Q && h.style?.position !== "absolute", y);
    const G = !U && (h.kind === "text" || !h.meta), L = h.kind === "text" ? y.get(h)?.h ?? j : null, F = h.kind === "text" ? y.get(h)?.w : void 0;
    if (G || L || F !== void 0) {
      let it = l.div();
      G && (it = it.id(n.range_name)), G && !Q && n.style.display === "flex" && (it = it[`self_${Gv[f.text_align] ?? "start"}`]().max_w("100%")), L && (it = it.h(L)), F !== void 0 && (it = it.w(F).flex_none().whitespace_nowrap()), A = it.child(A), U ||= G;
    }
    v = v.child(A);
  }
  return v;
}
const Gv = { center: "center", right: "end", end: "end" };
function Kv(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const o = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const Lf = /^(?:[!-,.-~]+|\S)$/u, Wf = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const o = l.kind === "text" ? null : Wf(l);
    if (o) return o;
  }
  return null;
}, Ff = (n, l) => n.id === l || (n.children ?? []).some((o) => o.kind !== "text" && Ff(o, l)), If = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && If(l));
function an(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function ey(n, l, o, c, s = 0, d = !1) {
  const p = [n.root, ...n.overlays], f = s > 0 ? Wv(p, s) : /* @__PURE__ */ new Map();
  s > 0 && c.measure && Qv(p, s, c.measure, f), Jv(p, f), Zv(p, f), c.measure && Xv(p, c.measure, f);
  let b = l.div().relative().size_full().child(Wo(n.root, l, o, c, !1, !1, null, {}, !1, f)), y = d && n.overlays.length ? l.div().relative().size_full().window_layer() : b;
  for (const T of n.overlays) y = y.child(Wo(T, l, o, c, !0, !1, null, {}, !1, f));
  return y === b ? b : b.child(y);
}
function Qv(n, l, o, c) {
  const s = (x, _) => c.set(x, { ...c.get(x), ..._ }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(x, _, S) {
    if (x.kind === "text") {
      if (!(_.whitespace === "nowrap" || Lf.test(x.text)) || _.text_ellipsis || S || typeof _.text_size != "number") return NaN;
      const h = o(x.text, { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!ze(x) || x.kind === "input" || x.markup) return y(x);
    const R = { ..._ };
    for (const O of f) x.style[O] !== void 0 && (R[O] = x.style[O]);
    R.text_ellipsis = !!x.style.text_ellipsis, p.set(x, R);
    const E = x.style, j = (x.children ?? []).filter(Ye), Q = j.map((O) => b(O, R, S || !!x.tabular));
    let U = y(x);
    if (!Number.isFinite(U) && E.w === void 0) {
      const O = j.map((g, A) => Q[A] + (g.kind === "text" ? 0 : P(g.style.ml) + P(g.style.mr)));
      let h;
      j.length ? Me(x) ? h = j.some((g) => g.kind !== "text" && g.style.flex_grow > 0) || E.flex_wrap === "wrap" ? NaN : O.reduce((g, A) => g + A, 0) + P(E.gap_x) * (j.length - 1) : h = Math.max(...O) : h = 0, U = h + P(E.pl) + P(E.pr) + P(E.border_l) + P(E.border_r), typeof E.min_w == "number" && (U = Math.max(U, E.min_w)), typeof E.max_w == "number" && (U = Math.min(U, E.max_w));
    }
    return d.set(x, U), U;
  }
  const y = (x) => typeof x.style?.w == "number" ? x.style.w : NaN, T = () => ({ exact: 0, laid: 0 }), C = (x, _) => {
    if (!Number.isFinite(_))
      return Object.assign(x, T()), NaN;
    x.exact += _;
    const S = Math.round(x.exact * l + 1e-9) / l, R = S - x.laid;
    return x.laid = S, R;
  }, z = (x) => Me(x) && x.style.flex_wrap !== "wrap" && (x.style.justify ?? "start") === "start";
  function v(x) {
    if (!x || x.kind === "text" || !ze(x)) return;
    const _ = (x.children ?? []).filter(Ye);
    if (z(x) && _.length > 1) {
      const S = P(x.style.gap_x), R = T(), E = !(S && _.some((j) => j.kind === "text" || !Number.isFinite(P(j.style.ml))));
      s(x, { border_l: C(R, P(x.style.border_l)), pl: C(R, P(x.style.pl)) }), E && S && s(x, { gap_x: 0 }), _.forEach((j, Q) => {
        const U = (Q && E ? S : 0) + (j.kind === "text" ? 0 : P(j.style.ml));
        if (j.kind === "text")
          U && Object.assign(R, T());
        else {
          const A = C(R, U);
          Number.isFinite(A) && s(j, { ml: A });
        }
        const O = j.kind === "text" ? p.get(x) ?? {} : null, h = j.kind === "text" ? b(j, O, !!x.tabular) : d.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(h)) {
          const A = { w: C(R, h) };
          j.kind !== "text" && typeof j.style.w != "number" && j.style.min_w === void 0 && (A.whitespace = "nowrap", A.flex_shrink = 0), s(j, A);
        } else Object.assign(R, T());
        if (j.kind !== "text") {
          const A = C(R, P(j.style.mr));
          Number.isFinite(A) && s(j, { mr: A });
        }
      });
    }
    for (const S of x.children ?? []) S.kind !== "text" && v(S);
  }
  for (const x of n)
    x && (b(x, {}, !1), v(x));
}
const Vv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Xv(n, l, o) {
  const c = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (f) => typeof f == "number" ? f : 0, d = (f, b) => b && Hi(b) && !Me(b) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(b.style.items), p = (f, b, y, T) => {
    if (!f || f.kind === "text" || !ze(f)) return;
    const C = f.style;
    let z = typeof C.w == "number" ? C.w : C.w === "100%" ? y : d(f, b) ? y - s(C.ml) - s(C.mr) : NaN;
    typeof C.max_w == "number" && (z = Math.min(z, C.max_w));
    const v = z - s(C.pl) - s(C.pr) - s(C.border_l) - s(C.border_r), x = { ...T };
    for (const S of c) C[S] !== void 0 && (x[S] = C[S]);
    const _ = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(v) && v > 0 && typeof x.text_size == "number" && _.length && _.every((S) => S.kind === "text")) {
      const S = { size: x.text_size, weight: x.font_weight ?? 400, family: x.font_family ?? ".SystemUIFont", italic: !!x.italic }, R = (Q) => l(Q.trimEnd(), S) <= v + 0.01;
      let E = 0;
      for (const Q of _) {
        const U = [];
        for (const h of Q.text.split(`
`)) {
          let g = "";
          for (const A of h.split(Vv)) {
            if (R(g + A)) {
              g += A;
              continue;
            }
            g && U.push(g.trimEnd()), g = "";
            for (const G of A)
              g && !R(g + G) && (U.push(g), g = ""), g += G;
          }
          U.push(g.trimEnd());
        }
        const O = U.join(`
`);
        U.every((h) => !h || R(h)) ? O !== Q.text && o.set(Q, { ...o.get(Q), text: O }) : E = NaN, E += U.length;
      }
      const j = an(x);
      Number.isFinite(E) && j && C.h === void 0 && _.length === 1 && o.set(f, { ...o.get(f), h: E * j + s(C.pt) + s(C.pb) + s(C.border_t) + s(C.border_b) });
    }
    for (const S of _) p(S, f, Me(f) ? NaN : v, x);
  };
  for (const f of n) p(f, null, NaN, {});
}
function Zv(n, l) {
  const o = (c, s) => {
    if (!c || c.kind === "text" || !ze(c)) return;
    const d = c.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (p && Me(c))
      for (const f of c.children ?? []) {
        const b = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (b === 0 || typeof b == "string" && b.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of c.children ?? []) o(f, p);
  };
  for (const c of n) o(c, !1);
}
function Jv(n, l) {
  const o = l.heights ?? /* @__PURE__ */ new Map(), c = (b) => o.get(b), s = (b) => {
    const y = c(b);
    if (Number.isFinite(y)) return y;
    if (b.kind === "text" || !ze(b)) return 0;
    const T = b.style, C = typeof T.min_h == "number" ? T.min_h : 0, z = (b.children ?? []).filter(Ye), v = z.map((S) => s(S) + (S.kind === "text" ? 0 : Math.max(0, P(S.style.mt) || 0) + Math.max(0, P(S.style.mb) || 0))), x = z.length ? Me(b) ? Math.max(...v) : v.reduce((S, R) => S + R, 0) + (T.display === "flex" ? (P(T.gap_y) || 0) * (z.length - 1) : 0) : 0, _ = [T.pt, T.pb, T.border_t, T.border_b].reduce((S, R) => S + (P(R) || 0), 0);
    return Math.max(C, x + _);
  }, d = (b) => !(b.children ?? []).filter(Ye).length || Me(b) ? NaN : s({ ...b, style: { ...b.style, h: void 0, max_h: void 0, min_h: void 0 } }), p = (b, y) => {
    const T = b.style;
    if (typeof T.h == "number") return T.h;
    if (typeof T.max_h == "number") return T.max_h;
    if (!y || !Hi(y) || Me(y)) return NaN;
    const C = y.style, z = typeof C.h == "number" ? C.h : typeof C.max_h == "number" ? C.max_h : NaN, v = (y.children ?? []).filter(Ye);
    let x = 0;
    for (const S of v) {
      if (S === b) continue;
      const R = c(S);
      if (!Number.isFinite(R)) return NaN;
      x += R + (S.kind === "text" ? 0 : P(S.style.mt) + P(S.style.mb));
    }
    const _ = C.display === "flex" ? P(C.gap_y) * Math.max(0, v.length - 1) : 0;
    return z - P(C.pt) - P(C.pb) - P(C.border_t) - P(C.border_b) - x - _ - P(T.mt) - P(T.mb);
  }, f = (b, y) => {
    if (!(!b || b.kind === "text" || !ze(b))) {
      if (b.scrollbar > 0 && b.style.overflow_y === "scroll") {
        const T = d(b), C = p(b, y);
        Number.isFinite(T) && Number.isFinite(C) && T > C + 0.01 && l.set(b, { ...l.get(b), pr: P(b.style.pr) + b.scrollbar });
      }
      for (const T of b.children ?? []) f(T, b);
    }
  };
  for (const b of n) f(b, null);
}
const Lv = ["text_size", "line_height", "whitespace", "text_ellipsis"], P = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Hi = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Me = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ye = (n) => n.kind === "text" || ze(n) && n.style.position !== "absolute";
function Wv(n, l) {
  const o = /* @__PURE__ */ new Map(), c = (_, S) => o.set(_, { ...o.get(_), ...Object.fromEntries(Object.entries(S).filter(([, R]) => Number.isFinite(R))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(_, S) {
    if (_.kind === "text") return S.whitespace === "nowrap" || Lf.test(_.text) ? an(S) ?? NaN : NaN;
    const R = { ...S };
    for (const O of Lv) _.style[O] !== void 0 && (R[O] = _.style[O]);
    d.set(_, R);
    const E = _.style, j = (_.children ?? []).filter(Ye), Q = j.map((O) => p(O, R));
    let U;
    if (E.h !== void 0 && E.h !== "auto") U = P(E.h);
    else if (_.kind === "input")
      U = (_.input_type === "textarea" || _.input_type === "select" ? NaN : an(R) ?? NaN) + P(E.pt) + P(E.pb) + P(E.border_t) + P(E.border_b), E.min_h !== void 0 && (U = Math.max(U, P(E.min_h)));
    else {
      const O = j.map((g, A) => (g.kind === "text" ? 0 : P(g.style.mt) + P(g.style.mb)) + Q[A]);
      let h;
      if (Me(_)) h = E.flex_wrap === "wrap" ? NaN : E.items === "baseline" ? b(j, Q, R) : Math.max(0, ...O);
      else if (Hi(_)) {
        const g = j.some((G) => G.kind !== "text" && (G.style.flex_grow > 0 || G.style.flex_basis !== void 0)), A = E.display !== "flex" && j.some((G) => G.kind !== "text" && (P(G.style.mt) || P(G.style.mb)));
        h = g || A ? NaN : O.reduce((G, L) => G + L, 0) + (E.display === "flex" ? P(E.gap_y) * Math.max(0, j.length - 1) : 0);
      } else h = NaN;
      U = h + P(E.pt) + P(E.pb) + P(E.border_t) + P(E.border_b), E.min_h !== void 0 && (U = Math.max(U, P(E.min_h))), E.max_h !== void 0 && (U = Math.min(U, P(E.max_h)));
    }
    return s.set(_, U), U;
  }
  const f = (_) => (an(_) - (Mi + pf) * _.text_size) / 2 + Mi * _.text_size;
  function b(_, S, R) {
    let E = 0, j = 0;
    for (const [Q, U] of _.entries()) {
      const O = U.kind === "text" ? R : d.get(U);
      if (!(U.kind === "text" || (U.children ?? []).filter(Ye).every((G) => G.kind === "text")) || !Number.isFinite(S[Q]) || typeof O.text_size != "number") return NaN;
      const g = U.kind === "text" ? {} : U.style, A = P(g.mt) + P(g.border_t) + P(g.pt) + f(O);
      E = Math.max(E, A), j = Math.max(j, P(g.mt) + S[Q] + P(g.mb) - A);
    }
    return E + j;
  }
  const y = () => ({ exact: 0, laid: 0 }), T = (_, S) => {
    if (!Number.isFinite(S))
      return Object.assign(_, y()), NaN;
    _.exact += S;
    const R = Math.round(_.exact * l + 1e-9) / l, E = R - _.laid;
    return _.laid = R, E;
  };
  function C(_) {
    if (!(_.kind === "text" || !ze(_))) {
      for (const S of (_.children ?? []).filter((R) => R.kind !== "text" && ze(R) && R.style.position === "absolute")) C(S);
      if (Hi(_) && !Me(_)) {
        const S = y();
        c(_, { border_t: T(S, P(_.style.border_t)), pt: T(S, P(_.style.pt)) }), z(_, S);
      } else for (const S of (_.children ?? []).filter(Ye)) S.kind !== "text" && C(S);
    }
  }
  function z(_, S) {
    const R = (_.children ?? []).filter(Ye), E = _.style.display === "flex" ? P(_.style.gap_y) : 0;
    if (E && R.some((j) => j.kind === "text")) {
      for (const j of R) j.kind !== "text" && C(j);
      return !1;
    }
    return E && c(_, { gap_y: 0 }), R.forEach((j, Q) => {
      if (j.kind === "text") {
        const U = s.get(j) ?? p(j, d.get(_) ?? {});
        Number.isFinite(U) ? c(j, { h: T(S, U) }) : Object.assign(S, y());
        return;
      }
      if (c(j, { mt: T(S, (Q ? E : 0) + P(j.style.mt)) }), Number.isFinite(s.get(j))) x(j, S);
      else if (v(j)) {
        const U = j.style;
        c(j, { border_t: T(S, P(U.border_t)), pt: T(S, P(U.pt)) }), c(j, { pb: T(S, P(U.pb)), border_b: T(S, P(U.border_b)) });
      } else
        C(j), Object.assign(S, y());
      c(j, { mb: T(S, P(j.style.mb)) });
    }), !0;
  }
  function v(_) {
    const S = _.style, R = (_.children ?? []).filter(Ye), E = an(d.get(_) ?? {});
    return _.kind === "div" && !Me(_) && R.length > 0 && R.every((j) => j.kind === "text") && Number.isInteger(E) && [S.h, S.min_h, S.max_h].every((j) => j === void 0 || j === "auto");
  }
  function x(_, S) {
    const R = _.style;
    for (const O of (_.children ?? []).filter((h) => h.kind !== "text" && ze(h) && h.style.position === "absolute")) C(O);
    const E = S.laid, j = S.exact;
    c(_, { border_t: T(S, P(R.border_t)), pt: T(S, P(R.pt)) });
    const Q = R.h !== void 0 && R.h !== "auto", U = s.get(_) - P(R.pt) - P(R.pb) - P(R.border_t) - P(R.border_b);
    if (_.kind === "input")
      Q || T(S, U);
    else if (Me(_) || Q && (R.justify ?? "start") !== "start") {
      for (const O of (_.children ?? []).filter(Ye)) O.kind !== "text" && C(O);
      Q || T(S, U);
    } else !z(_, S) && !Q && T(S, U);
    if (Q) {
      S.exact = j + s.get(_), S.laid = Math.round(S.exact * l + 1e-9) / l, c(_, { h: S.laid - E });
      return;
    }
    c(_, { pb: T(S, P(R.pb)), border_b: T(S, P(R.border_b)) }), c(_, { h: S.laid - E });
  }
  for (const _ of n)
    p(_, {}), C(_);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const ay = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }] };
export {
  ay as NAMED_ELEMENTS,
  Yh as React,
  yg as SCHEMA,
  ty as STYLE_KEYS,
  ey as describeToGpui,
  Fv as jsxRuntime,
  Iv as mount,
  $v as reactDom,
  Pv as sdk
};
