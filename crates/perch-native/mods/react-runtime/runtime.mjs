function Io(n, a) {
  for (var r = 0; r < a.length; r++) {
    const i = a[r];
    if (typeof i != "string" && !Array.isArray(i)) {
      for (const s in i)
        if (s !== "default" && !(s in n)) {
          const c = Object.getOwnPropertyDescriptor(i, s);
          c && Object.defineProperty(n, s, c.get ? c : {
            enumerable: !0,
            get: () => i[s]
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
//! `:first-child`, `:last-child`, `:only-child`, `:nth-child(n)`, `:not()`, `:is()`, `:where()`, `:has()` (of a compound: a descendant that matches), `:root`, the state pseudo-classes
//! (`:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:enabled`, `:checked`), and the
//! descendant and child combinators. Anything else (`+`, `~`, `:has()` of a longer selector, pseudo-elements, ...) throws a
//! `SelectorError`, so a caller can skip a rule it cannot evaluate instead of guessing.
//!
//! An element is anything with `tagName` (lower case), `getAttribute(name)`, `parentElement` and `children`
//! (elements only). State pseudo-classes ask `options.state(element, name, isSubject)`; without it they never match.
class ot extends Error {
}
const u0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), d0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), f0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...u0]);
function To(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (a, r, i) => r ? String.fromCodePoint(parseInt(r, 16)) : i);
}
function Rl(n, a) {
  let r = a;
  for (; r < n.length; ) {
    const i = n[r];
    if (i === "\\") {
      r += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(i)) {
      r++;
      continue;
    }
    break;
  }
  if (r === a) throw new ot(`expected a name at ${a} in ${JSON.stringify(n)}`);
  return [To(n.slice(a, r)), r];
}
function p0(n, a) {
  let r = 1;
  for (let i = a; i < n.length; i++) {
    const s = n[i];
    if (s === "\\") {
      i++;
      continue;
    }
    if (s === '"' || s === "'") {
      if (i = n.indexOf(s, i + 1), i < 0) break;
      continue;
    }
    if (s === "(") r++;
    else if (s === ")" && --r === 0) return i;
  }
  throw new ot(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Po(n) {
  const a = [];
  let r = 0, i = 0;
  for (let s = 0; s < n.length; s++) {
    const c = n[s];
    if (c === "\\") {
      s++;
      continue;
    }
    if (c === '"' || c === "'") {
      if (s = n.indexOf(c, s + 1), s < 0) break;
      continue;
    }
    c === "(" || c === "[" ? r++ : c === ")" || c === "]" ? r-- : c === "," && r === 0 && (a.push(n.slice(i, s).trim()), i = s + 1);
  }
  return a.push(n.slice(i).trim()), a.filter(Boolean);
}
function m0(n, a) {
  const r = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; a < n.length; ) {
    const s = n[a];
    if (s === "*") {
      r.tag = "*", a++, i = !0;
      continue;
    }
    if (s === ".") {
      const [c, f] = Rl(n, a + 1);
      r.classes.push(c), a = f, i = !0;
      continue;
    }
    if (s === "#") {
      const [c, f] = Rl(n, a + 1);
      r.id = c, a = f, i = !0;
      continue;
    }
    if (s === "[") {
      const c = n.indexOf("]", a);
      if (c < 0) throw new ot(`unclosed [ in ${JSON.stringify(n)}`);
      const f = n.slice(a + 1, c).trim(), u = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(f);
      if (!u) throw new ot(`cannot read the attribute selector [${f}]`);
      const m = u[3] ?? u[4] ?? u[5];
      r.attrs.push({ name: To(u[1]).toLowerCase(), op: u[2] ?? null, value: m === void 0 ? null : To(m) }), a = c + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[a + 1] === ":") {
        const [m, h] = Rl(n, a + 2), k = m.toLowerCase();
        if (k !== "before" && k !== "after") throw new ot(`::${k} is not supported`);
        if (r.pseudoElement = k, a = h, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow ::${k} in ${JSON.stringify(n)}`);
        break;
      }
      const [c, f] = Rl(n, a + 1);
      a = f;
      const u = c.toLowerCase();
      if ((u === "before" || u === "after") && n[a] !== "(") {
        if (r.pseudoElement = u, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow :${u} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!d0.has(u)) throw new ot(`:${u}() is not supported`);
        const m = p0(n, a + 1), h = n.slice(a + 1, m).trim();
        if (a = m + 1, u === "nth-child") {
          if (!/^\d+$/.test(h)) throw new ot(`:nth-child(${h}) is not supported (only a number)`);
          r.pseudos.push({ name: u, n: Number(h) });
        } else {
          const k = Po(h).map(ec);
          if (u === "has" && k.some((g) => g.length !== 1)) throw new ot(`:has(${h}) is not supported (only a compound selector)`);
          r.pseudos.push({ name: u, list: k });
        }
      } else {
        if (!f0.has(u)) throw new ot(`:${u} is not supported`);
        r.pseudos.push({ name: u });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !i) {
      const [c, f] = Rl(n, a);
      r.tag = c.toLowerCase(), a = f, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new ot(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [r, a];
}
function ec(n) {
  const a = [];
  let r = 0, i = null;
  for (n = n.trim(); r < n.length; ) {
    const [s, c] = m0(n, r);
    if (a.at(-1)?.compound.pseudoElement) throw new ot(`::${a.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    a.push({ compound: s, combinator: i }), r = c;
    let f = !1;
    for (; n[r] === " " || n[r] === `
` || n[r] === "	"; )
      r++, f = !0;
    if (r >= n.length) break;
    const u = n[r];
    if (u === ">")
      for (i = ">", r++; n[r] === " "; ) r++;
    else {
      if (u === "+" || u === "~") throw new ot(`the ${u} combinator is not supported`);
      if (f) i = " ";
      else throw new ot(`unexpected ${JSON.stringify(u)} in ${JSON.stringify(n)}`);
    }
  }
  if (!a.length) throw new ot("empty selector");
  return a;
}
const yf = /* @__PURE__ */ new Map();
function zi(n) {
  let a = yf.get(n);
  return a || (a = Po(n).map(ec), yf.set(n, a)), a;
}
function Sp(n) {
  const a = [0, 0, 0], r = (i) => {
    a[0] += i[0], a[1] += i[1], a[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && a[0]++, a[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && a[2]++, i.pseudoElement && a[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const c = s.list.map(Sp).sort((f, u) => u[0] - f[0] || u[1] - f[1] || u[2] - f[2])[0];
          r(c);
        } else a[1]++;
  }
  return a;
}
function h0(n, { name: a, op: r, value: i }) {
  const s = n.getAttribute(a);
  if (s == null) return !1;
  if (r === null) return !0;
  switch (r) {
    case "=":
      return s === i;
    case "^=":
      return i !== "" && s.startsWith(i);
    case "$=":
      return i !== "" && s.endsWith(i);
    case "*=":
      return i !== "" && s.includes(i);
    case "~=":
      return s.split(/\s+/).includes(i);
    case "|=":
      return s === i || s.startsWith(`${i}-`);
    default:
      return !1;
  }
}
function Jr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Ep(n, a) {
  for (const r of n.children) if (a(r) || Ep(r, a)) return !0;
  return !1;
}
function zp(n, a, r, i) {
  if ((a.pseudoElement ?? null) !== (i ? r.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const c of a.classes) if (!s.has(c)) return !1;
  }
  for (const s of a.attrs) if (!h0(n, s)) return !1;
  for (const s of a.pseudos)
    switch (s.name) {
      case "first-child":
        if (Jr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Jr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const c = Jr(n);
        if (c[c.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Jr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((c) => Ia(n, c, r, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: c }]) => Ep(n, (f) => zp(f, c, r, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((c) => Ia(n, c, r, i))) return !1;
        break;
      default:
        if (!r.state || !r.state(n, s.name, i)) return !1;
    }
  return !0;
}
function Ia(n, a, r, i = !0) {
  const s = (c, f, u) => {
    const { compound: m, combinator: h } = a[f];
    if (!zp(c, m, r, u)) return !1;
    if (f === 0) return !0;
    if (h === ">") return !!c.parentElement && s(c.parentElement, f - 1, !1);
    for (let k = c.parentElement; k; k = k.parentElement) if (s(k, f - 1, !1)) return !0;
    return !1;
  };
  return s(n, a.length - 1, i);
}
function g0(n, a, r = {}) {
  return (typeof a == "string" ? zi(a) : a).some((s) => Ia(n, s, r));
}
function Co(n, a, r = {}) {
  return Ia(n, a, r);
}
function Yl(n, a, r = {}) {
  const i = zi(a), s = [], c = (f) => {
    for (const u of f.children)
      i.some((m) => Ia(u, m, r)) && s.push(u), c(u);
  };
  return c(n), s;
}
function Np(n, a, r = {}) {
  const i = zi(a);
  for (let s = n; s; s = s.parentElement) if (i.some((c) => Ia(s, c, r))) return s;
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
let b0 = 1;
class Ao {
  constructor(a = 0, r = 0, i = 0, s = 0) {
    this.x = a, this.y = r, this.width = i, this.height = s;
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
class tc {
  constructor() {
    this.listeners = [];
  }
  addEventListener(a, r, i) {
    const s = i === !0 || !!i?.capture;
    this.listeners.some((c) => c.type === a && c.listener === r && c.capture === s) || this.listeners.push({ type: a, listener: r, capture: s });
  }
  removeEventListener(a, r, i) {
    const s = i === !0 || !!i?.capture;
    this.listeners = this.listeners.filter((c) => !(c.type === a && c.listener === r && c.capture === s));
  }
}
let v0 = 0;
const Mo = () => ++v0;
class Ni {
  constructor(a) {
    this.nodeType = 3, this.parentNode = null, this.chars = String(a), this.hide = !1;
  }
  /** A text's change re-describes its element (`HostElement.mark`), not its style. */
  get data() {
    return this.chars;
  }
  set data(a) {
    this.chars = String(a), this.parentNode?.mark?.();
  }
  get hidden() {
    return this.hide;
  }
  set hidden(a) {
    this.hide = a, this.parentNode?.mark?.();
  }
  get parentElement() {
    return this.parentNode;
  }
  get textContent() {
    return this.data;
  }
}
class Je extends tc {
  constructor(a, r = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${b0++}`, this.tagName = a.toLowerCase(), this.props = r, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = Mo(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = Mo();
    for (let r = this; r instanceof Je; r = r.parentNode) r.stamp = a;
  }
  /** Its children changed: its own style (`:empty`-like reads, `:has()` below) and every ancestor whose style asked what
   * lies below it (`:has()`, `selector.mjs`). Its descendants keep theirs: a sibling moving changes only the first and
   * last children's positions, which their own cache keys read. */
  touchWatchers() {
    this.version++, this.mark();
    for (let a = this.parentElement; a; a = a.parentElement) a.watchesDescendants && a.touch();
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof Je ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((a) => a instanceof Je);
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
    const a = this.className;
    if (this.classCache?.name !== a) {
      const r = a.split(/\s+/).filter(Boolean);
      this.classCache = { name: a, list: r, set: new Set(r) };
    }
    return this.classCache.list;
  }
  /** The classes as a set, for selector matching. */
  get classSet() {
    return this.classList, this.classCache.set;
  }
  get textContent() {
    return this.childNodes.map((a) => a.textContent).join("");
  }
  get dataset() {
    const a = {};
    for (const [r, i] of Object.entries(this.props))
      r.startsWith("data-") && i != null && i !== !1 && (a[r.slice(5).replace(/-([a-z])/g, (s, c) => c.toUpperCase())] = String(i));
    return a;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(a) {
    const r = this.props;
    if (a === "class") return this.className || null;
    if (a === "id") return r.id != null ? String(r.id) : null;
    if (a === "style") return null;
    let s = r[a === "for" ? "htmlFor" : a === "tabindex" ? "tabIndex" : a];
    if (s === void 0 && !a.includes("-")) {
      const c = a.replace(/-([a-z])/g, (f, u) => u.toUpperCase());
      s = r[c];
    }
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? a.startsWith("aria-") || a.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(a) {
    return this.getAttribute(a) !== null;
  }
  appendChild(a) {
    return a.parentNode && a.parentNode.removeChild(a), a.parentNode = this, this.childNodes.push(a), this.touchWatchers(), a;
  }
  insertBefore(a, r) {
    a.parentNode && a.parentNode.removeChild(a);
    const i = this.childNodes.indexOf(r);
    return a.parentNode = this, i < 0 ? this.childNodes.push(a) : this.childNodes.splice(i, 0, a), this.touchWatchers(), a;
  }
  removeChild(a) {
    const r = this.childNodes.indexOf(a);
    return r >= 0 && this.childNodes.splice(r, 1), a.parentNode = null, this.touchWatchers(), a;
  }
  contains(a) {
    for (let r = a; r; r = r.parentNode) if (r === this) return !0;
    return !1;
  }
  matches(a) {
    return g0(this, a);
  }
  closest(a) {
    return Np(this, a);
  }
  querySelectorAll(a) {
    return Yl(this, a);
  }
  querySelector(a) {
    return Yl(this, a)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const a = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return a ? new Ao(a.x, a.y, a.width, a.height) : new Ao();
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
  set value(a) {
    this.edit = String(a);
  }
  /** A box's tick: what a click just made it (`ticked`, during the change event it causes), else its props'. */
  get checked() {
    return this.ticked ?? !!(this.props.checked ?? this.props.defaultChecked);
  }
  set checked(a) {
    this.ticked = !!a;
  }
  /** Selection in a field: the caret stays at the end of its text, and the one selection kept is all of it
   * (`selectedAll`: the next character typed replaces the text). */
  select() {
    this.selectedAll = !0;
  }
  setSelectionRange(a, r) {
    this.selectedAll = a === 0 && r >= this.value.length && r > 0;
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
    const a = this, r = (f) => String(f).startsWith("--") ? String(f) : String(f).replace(/-([a-z])/g, (u, m) => m.toUpperCase()), i = (f) => {
      const u = a.props.style?.[f];
      return u == null || typeof u == "boolean" ? "" : typeof u == "number" && u !== 0 ? `${u}px` : String(u);
    }, s = (f) => a.inline && f in a.inline ? a.inline[f] : i(f), c = (f, u) => {
      const m = u == null ? "" : String(u);
      s(f) !== m && (a.inline ??= {}, m === i(f) ? delete a.inline[f] : a.inline[f] = m, a.touch(), a.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (f, u) => {
        if (typeof u == "string")
          return u === "setProperty" ? (m, h) => c(r(m), h) : u === "removeProperty" ? (m) => {
            const h = s(r(m));
            return c(r(m), ""), h;
          } : u === "getPropertyValue" ? (m) => s(r(m)) : s(u);
      },
      set: (f, u, m) => (typeof u == "string" && c(u, m), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return xf(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return xf(this, a);
  }
}
const Tp = Symbol("perch.stale-layout"), Cp = 3;
let ii = !1;
function Ap(n) {
  return () => {
    let a, r = !1;
    const i = (s) => {
      const c = ii;
      ii = s < Cp;
      try {
        a = n();
      } catch (f) {
        const u = f?.[Tp];
        if (!u) throw f;
        u.retries.push(() => {
          r || i(s + 1);
        });
      } finally {
        ii = c;
      }
    };
    return i(0), () => {
      r = !0, typeof a == "function" && a();
    };
  };
}
const Ro = "perch-dom:", y0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), x0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function xf(n, a = []) {
  const r = new Set(a.map((s) => x0[s] ?? s)), i = (s) => {
    if (!(s instanceof Je)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const c = {};
    for (const [f, u] of Object.entries(s.props))
      y0.has(f) || r.has(f) || u == null || typeof u == "function" || typeof u == "symbol" || (c[f] = u);
    return { t: s.tagName, p: c, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return Ro + JSON.stringify(i(n));
}
function w0(n, a) {
  if (typeof n != "string" || !n.startsWith(Ro)) return null;
  let r;
  try {
    r = JSON.parse(n.slice(Ro.length));
  } catch {
    return null;
  }
  const i = (c) => !!c && typeof c == "object" && !Array.isArray(c), s = (c) => {
    if (!i(c)) throw new Error("not a node");
    let f;
    if (typeof c.x == "string") f = new Ni(c.x);
    else {
      if (typeof c.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(c.t) || !i(c.p) || !Array.isArray(c.c)) throw new Error("not an element");
      f = new Je(c.t, c.p, a);
      for (const u of c.c) f.appendChild(s(u));
    }
    return f.hidden = c.h === 1, f;
  };
  try {
    return [s(r)];
  } catch {
    return null;
  }
}
class k0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class _0 {
  constructor(a = {}) {
    this.map = new Map(Object.entries(a));
  }
  get length() {
    return this.map.size;
  }
  key(a) {
    return [...this.map.keys()][a] ?? null;
  }
  getItem(a) {
    return this.map.has(a) ? this.map.get(a) : null;
  }
  setItem(a, r) {
    this.map.set(a, String(r));
  }
  removeItem(a) {
    this.map.delete(a);
  }
  clear() {
    this.map.clear();
  }
}
function wf(n) {
  for (let a = n; a instanceof Je; a = a.parentElement) a.touch();
}
class S0 extends tc {
  constructor(a) {
    super(), this.perch = a, this.documentElement = new Je("html", {}, this), this.body = new Je("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(a) {
    return new Je(a, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(a) {
    const r = this.perch?.bounds;
    if (typeof r != "function" || !this.measureKey) return null;
    a.measured || (a.measured = !0, a.touch(), this.restyled());
    const i = r(this.measureKey(a));
    if (ii && (!i || this.stale?.())) throw { [Tp]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, wf(a), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, wf(a), this.activeElement === a && (this.activeElement = this.body);
  }
  querySelectorAll(a) {
    return Yl(this.documentElement, a);
  }
  querySelector(a) {
    return this.querySelectorAll(a)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(a) {
    return Yl(this.documentElement, "*").find((r) => r.props?.id === a) ?? null;
  }
}
class E0 extends tc {
  constructor(a, r) {
    super(), this.perch = a, this.document = r, this.location = { get hostname() {
      return a.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(a, r, ...i) {
    return globalThis.setTimeout(a, r, ...i);
  }
  clearTimeout(a) {
    return globalThis.clearTimeout(a);
  }
}
function Mp(n) {
  return {
    setTimeout: (a, r = 0, ...i) => n.setTimeout(() => a(...i), Math.max(0, Number(r) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const kf = Symbol.for("perch.react.globals");
function en(n, a, r) {
  Object.defineProperty(n, a, { value: r, configurable: !0, writable: !0, enumerable: !1 });
}
function z0(n, a = globalThis) {
  const r = new S0(n), i = new E0(n, r);
  r.defaultView = i;
  const s = n.storage ?? new _0();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const u = Mp(n);
    en(a, "setTimeout", u.setTimeout), en(a, "clearTimeout", u.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && en(a, "queueMicrotask", (u) => {
    Promise.resolve().then(u);
  }), en(a, "requestAnimationFrame", (u) => a.setTimeout(() => u(Date.now()), 0)), en(a, "cancelAnimationFrame", (u) => a.clearTimeout(u));
  const c = { document: r, window: i, localStorage: s, HTMLElement: Je, Element: Je };
  for (const u of Object.keys(c))
    Object.defineProperty(a, u, { get: () => a[kf]?.[u], configurable: !0, enumerable: !1 });
  a[kf] = c, en(a, "DOMRect", Ao), en(a, "getComputedStyle", N0), typeof a.ResizeObserver != "function" && en(a, "ResizeObserver", k0);
  const f = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!f.clipboard && n.clipboard)
    try {
      en(f, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || en(a, "navigator", f), { document: r, window: i, globals: c };
}
function N0(n) {
  const a = n?.ownerDocument?.computed?.(n) ?? {}, r = (i) => {
    const s = a[i];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (i, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (c) => r(String(c)) : r(s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
    }
  });
}
function jo(n, a = !1) {
  if (!(a ? n?.tagName === "input" && Rp(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Rp = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const _f = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof _f?.setTimeout == "function") {
  const n = Mp(_f);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function nc(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function T0(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var a = n.default;
  if (typeof a == "function") {
    var r = function i() {
      return this instanceof i ? Reflect.construct(a, arguments, this.constructor) : a.apply(this, arguments);
    };
    r.prototype = a.prototype;
  } else r = {};
  return Object.defineProperty(r, "__esModule", { value: !0 }), Object.keys(n).forEach(function(i) {
    var s = Object.getOwnPropertyDescriptor(n, i);
    Object.defineProperty(r, i, s.get ? s : {
      enumerable: !0,
      get: function() {
        return n[i];
      }
    });
  }), r;
}
var go = { exports: {} }, me = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Sf;
function C0() {
  if (Sf) return me;
  Sf = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), c = Symbol.for("react.consumer"), f = Symbol.for("react.context"), u = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), h = Symbol.for("react.memo"), k = Symbol.for("react.lazy"), g = Symbol.for("react.activity"), b = Symbol.iterator;
  function E(A) {
    return A === null || typeof A != "object" ? null : (A = b && A[b] || A["@@iterator"], typeof A == "function" ? A : null);
  }
  var _ = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, z = Object.assign, S = {};
  function N(A, K, ae) {
    this.props = A, this.context = K, this.refs = S, this.updater = ae || _;
  }
  N.prototype.isReactComponent = {}, N.prototype.setState = function(A, K) {
    if (typeof A != "object" && typeof A != "function" && A != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, A, K, "setState");
  }, N.prototype.forceUpdate = function(A) {
    this.updater.enqueueForceUpdate(this, A, "forceUpdate");
  };
  function D() {
  }
  D.prototype = N.prototype;
  function j(A, K, ae) {
    this.props = A, this.context = K, this.refs = S, this.updater = ae || _;
  }
  var X = j.prototype = new D();
  X.constructor = j, z(X, N.prototype), X.isPureReactComponent = !0;
  var U = Array.isArray;
  function V() {
  }
  var w = { H: null, A: null, T: null, S: null }, x = Object.prototype.hasOwnProperty;
  function y(A, K, ae) {
    var oe = ae.ref;
    return {
      $$typeof: n,
      type: A,
      key: K,
      ref: oe !== void 0 ? oe : null,
      props: ae
    };
  }
  function T(A, K) {
    return y(A.type, K, A.props);
  }
  function R(A) {
    return typeof A == "object" && A !== null && A.$$typeof === n;
  }
  function C(A) {
    var K = { "=": "=0", ":": "=2" };
    return "$" + A.replace(/[=:]/g, function(ae) {
      return K[ae];
    });
  }
  var B = /\/+/g;
  function W(A, K) {
    return typeof A == "object" && A !== null && A.key != null ? C("" + A.key) : K.toString(36);
  }
  function F(A) {
    switch (A.status) {
      case "fulfilled":
        return A.value;
      case "rejected":
        throw A.reason;
      default:
        switch (typeof A.status == "string" ? A.then(V, V) : (A.status = "pending", A.then(
          function(K) {
            A.status === "pending" && (A.status = "fulfilled", A.value = K);
          },
          function(K) {
            A.status === "pending" && (A.status = "rejected", A.reason = K);
          }
        )), A.status) {
          case "fulfilled":
            return A.value;
          case "rejected":
            throw A.reason;
        }
    }
    throw A;
  }
  function q(A, K, ae, oe, ce) {
    var ue = typeof A;
    (ue === "undefined" || ue === "boolean") && (A = null);
    var Ee = !1;
    if (A === null) Ee = !0;
    else
      switch (ue) {
        case "bigint":
        case "string":
        case "number":
          Ee = !0;
          break;
        case "object":
          switch (A.$$typeof) {
            case n:
            case a:
              Ee = !0;
              break;
            case k:
              return Ee = A._init, q(
                Ee(A._payload),
                K,
                ae,
                oe,
                ce
              );
          }
      }
    if (Ee)
      return ce = ce(A), Ee = oe === "" ? "." + W(A, 0) : oe, U(ce) ? (ae = "", Ee != null && (ae = Ee.replace(B, "$&/") + "/"), q(ce, K, ae, "", function($n) {
        return $n;
      })) : ce != null && (R(ce) && (ce = T(
        ce,
        ae + (ce.key == null || A && A.key === ce.key ? "" : ("" + ce.key).replace(
          B,
          "$&/"
        ) + "/") + Ee
      )), K.push(ce)), 1;
    Ee = 0;
    var Pe = oe === "" ? "." : oe + ":";
    if (U(A))
      for (var he = 0; he < A.length; he++)
        oe = A[he], ue = Pe + W(oe, he), Ee += q(
          oe,
          K,
          ae,
          ue,
          ce
        );
    else if (he = E(A), typeof he == "function")
      for (A = he.call(A), he = 0; !(oe = A.next()).done; )
        oe = oe.value, ue = Pe + W(oe, he++), Ee += q(
          oe,
          K,
          ae,
          ue,
          ce
        );
    else if (ue === "object") {
      if (typeof A.then == "function")
        return q(
          F(A),
          K,
          ae,
          oe,
          ce
        );
      throw K = String(A), Error(
        "Objects are not valid as a React child (found: " + (K === "[object Object]" ? "object with keys {" + Object.keys(A).join(", ") + "}" : K) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Ee;
  }
  function J(A, K, ae) {
    if (A == null) return A;
    var oe = [], ce = 0;
    return q(A, oe, "", "", function(ue) {
      return K.call(ae, ue, ce++);
    }), oe;
  }
  function I(A) {
    if (A._status === -1) {
      var K = A._result;
      K = K(), K.then(
        function(ae) {
          (A._status === 0 || A._status === -1) && (A._status = 1, A._result = ae);
        },
        function(ae) {
          (A._status === 0 || A._status === -1) && (A._status = 2, A._result = ae);
        }
      ), A._status === -1 && (A._status = 0, A._result = K);
    }
    if (A._status === 1) return A._result.default;
    throw A._result;
  }
  var Q = typeof reportError == "function" ? reportError : function(A) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var K = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof A == "object" && A !== null && typeof A.message == "string" ? String(A.message) : String(A),
        error: A
      });
      if (!window.dispatchEvent(K)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", A);
      return;
    }
    console.error(A);
  }, Z = {
    map: J,
    forEach: function(A, K, ae) {
      J(
        A,
        function() {
          K.apply(this, arguments);
        },
        ae
      );
    },
    count: function(A) {
      var K = 0;
      return J(A, function() {
        K++;
      }), K;
    },
    toArray: function(A) {
      return J(A, function(K) {
        return K;
      }) || [];
    },
    only: function(A) {
      if (!R(A))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return A;
    }
  };
  return me.Activity = g, me.Children = Z, me.Component = N, me.Fragment = r, me.Profiler = s, me.PureComponent = j, me.StrictMode = i, me.Suspense = m, me.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w, me.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(A) {
      return w.H.useMemoCache(A);
    }
  }, me.cache = function(A) {
    return function() {
      return A.apply(null, arguments);
    };
  }, me.cacheSignal = function() {
    return null;
  }, me.cloneElement = function(A, K, ae) {
    if (A == null)
      throw Error(
        "The argument must be a React element, but you passed " + A + "."
      );
    var oe = z({}, A.props), ce = A.key;
    if (K != null)
      for (ue in K.key !== void 0 && (ce = "" + K.key), K)
        !x.call(K, ue) || ue === "key" || ue === "__self" || ue === "__source" || ue === "ref" && K.ref === void 0 || (oe[ue] = K[ue]);
    var ue = arguments.length - 2;
    if (ue === 1) oe.children = ae;
    else if (1 < ue) {
      for (var Ee = Array(ue), Pe = 0; Pe < ue; Pe++)
        Ee[Pe] = arguments[Pe + 2];
      oe.children = Ee;
    }
    return y(A.type, ce, oe);
  }, me.createContext = function(A) {
    return A = {
      $$typeof: f,
      _currentValue: A,
      _currentValue2: A,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, A.Provider = A, A.Consumer = {
      $$typeof: c,
      _context: A
    }, A;
  }, me.createElement = function(A, K, ae) {
    var oe, ce = {}, ue = null;
    if (K != null)
      for (oe in K.key !== void 0 && (ue = "" + K.key), K)
        x.call(K, oe) && oe !== "key" && oe !== "__self" && oe !== "__source" && (ce[oe] = K[oe]);
    var Ee = arguments.length - 2;
    if (Ee === 1) ce.children = ae;
    else if (1 < Ee) {
      for (var Pe = Array(Ee), he = 0; he < Ee; he++)
        Pe[he] = arguments[he + 2];
      ce.children = Pe;
    }
    if (A && A.defaultProps)
      for (oe in Ee = A.defaultProps, Ee)
        ce[oe] === void 0 && (ce[oe] = Ee[oe]);
    return y(A, ue, ce);
  }, me.createRef = function() {
    return { current: null };
  }, me.forwardRef = function(A) {
    return { $$typeof: u, render: A };
  }, me.isValidElement = R, me.lazy = function(A) {
    return {
      $$typeof: k,
      _payload: { _status: -1, _result: A },
      _init: I
    };
  }, me.memo = function(A, K) {
    return {
      $$typeof: h,
      type: A,
      compare: K === void 0 ? null : K
    };
  }, me.startTransition = function(A) {
    var K = w.T, ae = {};
    w.T = ae;
    try {
      var oe = A(), ce = w.S;
      ce !== null && ce(ae, oe), typeof oe == "object" && oe !== null && typeof oe.then == "function" && oe.then(V, Q);
    } catch (ue) {
      Q(ue);
    } finally {
      K !== null && ae.types !== null && (K.types = ae.types), w.T = K;
    }
  }, me.unstable_useCacheRefresh = function() {
    return w.H.useCacheRefresh();
  }, me.use = function(A) {
    return w.H.use(A);
  }, me.useActionState = function(A, K, ae) {
    return w.H.useActionState(A, K, ae);
  }, me.useCallback = function(A, K) {
    return w.H.useCallback(A, K);
  }, me.useContext = function(A) {
    return w.H.useContext(A);
  }, me.useDebugValue = function() {
  }, me.useDeferredValue = function(A, K) {
    return w.H.useDeferredValue(A, K);
  }, me.useEffect = function(A, K) {
    return w.H.useEffect(A, K);
  }, me.useEffectEvent = function(A) {
    return w.H.useEffectEvent(A);
  }, me.useId = function() {
    return w.H.useId();
  }, me.useImperativeHandle = function(A, K, ae) {
    return w.H.useImperativeHandle(A, K, ae);
  }, me.useInsertionEffect = function(A, K) {
    return w.H.useInsertionEffect(A, K);
  }, me.useLayoutEffect = function(A, K) {
    return w.H.useLayoutEffect(A, K);
  }, me.useMemo = function(A, K) {
    return w.H.useMemo(A, K);
  }, me.useOptimistic = function(A, K) {
    return w.H.useOptimistic(A, K);
  }, me.useReducer = function(A, K, ae) {
    return w.H.useReducer(A, K, ae);
  }, me.useRef = function(A) {
    return w.H.useRef(A);
  }, me.useState = function(A) {
    return w.H.useState(A);
  }, me.useSyncExternalStore = function(A, K, ae) {
    return w.H.useSyncExternalStore(
      A,
      K,
      ae
    );
  }, me.useTransition = function() {
    return w.H.useTransition();
  }, me.version = "19.2.8", me;
}
var Ef;
function A0() {
  return Ef || (Ef = 1, go.exports = C0()), go.exports;
}
var G = A0();
const jp = /* @__PURE__ */ nc(G), M0 = /* @__PURE__ */ Io({
  __proto__: null,
  default: jp
}, [G]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const R0 = jp ?? M0;
function Ie(n, a) {
  return G.useEffect(Ap(n), a);
}
function mi(n, a) {
  return G.useLayoutEffect(Ap(n), a);
}
const j0 = /* @__PURE__ */ Io({
  __proto__: null,
  default: R0,
  useEffect: Ie,
  useLayoutEffect: mi
}, [G]);
var bo = { exports: {} }, jl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var zf;
function O0() {
  if (zf) return jl;
  zf = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.fragment");
  function r(i, s, c) {
    var f = null;
    if (c !== void 0 && (f = "" + c), s.key !== void 0 && (f = "" + s.key), "key" in s) {
      c = {};
      for (var u in s)
        u !== "key" && (c[u] = s[u]);
    } else c = s;
    return s = c.ref, {
      $$typeof: n,
      type: i,
      key: f,
      ref: s !== void 0 ? s : null,
      props: c
    };
  }
  return jl.Fragment = a, jl.jsx = r, jl.jsxs = r, jl;
}
var Nf;
function D0() {
  return Nf || (Nf = 1, bo.exports = O0()), bo.exports;
}
var te = D0();
const B0 = /* @__PURE__ */ nc(te), Pw = /* @__PURE__ */ Io({
  __proto__: null,
  default: B0
}, [te]);
var vo = { exports: {} }, yo = { exports: {} };
const H0 = /* @__PURE__ */ T0(j0);
var xo = { exports: {} }, wo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Tf;
function U0() {
  return Tf || (Tf = 1, (function(n) {
    function a(q, J) {
      var I = q.length;
      q.push(J);
      e: for (; 0 < I; ) {
        var Q = I - 1 >>> 1, Z = q[Q];
        if (0 < s(Z, J))
          q[Q] = J, q[I] = Z, I = Q;
        else break e;
      }
    }
    function r(q) {
      return q.length === 0 ? null : q[0];
    }
    function i(q) {
      if (q.length === 0) return null;
      var J = q[0], I = q.pop();
      if (I !== J) {
        q[0] = I;
        e: for (var Q = 0, Z = q.length, A = Z >>> 1; Q < A; ) {
          var K = 2 * (Q + 1) - 1, ae = q[K], oe = K + 1, ce = q[oe];
          if (0 > s(ae, I))
            oe < Z && 0 > s(ce, ae) ? (q[Q] = ce, q[oe] = I, Q = oe) : (q[Q] = ae, q[K] = I, Q = K);
          else if (oe < Z && 0 > s(ce, I))
            q[Q] = ce, q[oe] = I, Q = oe;
          else break e;
        }
      }
      return J;
    }
    function s(q, J) {
      var I = q.sortIndex - J.sortIndex;
      return I !== 0 ? I : q.id - J.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var c = performance;
      n.unstable_now = function() {
        return c.now();
      };
    } else {
      var f = Date, u = f.now();
      n.unstable_now = function() {
        return f.now() - u;
      };
    }
    var m = [], h = [], k = 1, g = null, b = 3, E = !1, _ = !1, z = !1, S = !1, N = typeof setTimeout == "function" ? setTimeout : null, D = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
    function X(q) {
      for (var J = r(h); J !== null; ) {
        if (J.callback === null) i(h);
        else if (J.startTime <= q)
          i(h), J.sortIndex = J.expirationTime, a(m, J);
        else break;
        J = r(h);
      }
    }
    function U(q) {
      if (z = !1, X(q), !_)
        if (r(m) !== null)
          _ = !0, V || (V = !0, C());
        else {
          var J = r(h);
          J !== null && F(U, J.startTime - q);
        }
    }
    var V = !1, w = -1, x = 5, y = -1;
    function T() {
      return S ? !0 : !(n.unstable_now() - y < x);
    }
    function R() {
      if (S = !1, V) {
        var q = n.unstable_now();
        y = q;
        var J = !0;
        try {
          e: {
            _ = !1, z && (z = !1, D(w), w = -1), E = !0;
            var I = b;
            try {
              t: {
                for (X(q), g = r(m); g !== null && !(g.expirationTime > q && T()); ) {
                  var Q = g.callback;
                  if (typeof Q == "function") {
                    g.callback = null, b = g.priorityLevel;
                    var Z = Q(
                      g.expirationTime <= q
                    );
                    if (q = n.unstable_now(), typeof Z == "function") {
                      g.callback = Z, X(q), J = !0;
                      break t;
                    }
                    g === r(m) && i(m), X(q);
                  } else i(m);
                  g = r(m);
                }
                if (g !== null) J = !0;
                else {
                  var A = r(h);
                  A !== null && F(
                    U,
                    A.startTime - q
                  ), J = !1;
                }
              }
              break e;
            } finally {
              g = null, b = I, E = !1;
            }
            J = void 0;
          }
        } finally {
          J ? C() : V = !1;
        }
      }
    }
    var C;
    if (typeof j == "function")
      C = function() {
        j(R);
      };
    else if (typeof MessageChannel < "u") {
      var B = new MessageChannel(), W = B.port2;
      B.port1.onmessage = R, C = function() {
        W.postMessage(null);
      };
    } else
      C = function() {
        N(R, 0);
      };
    function F(q, J) {
      w = N(function() {
        q(n.unstable_now());
      }, J);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(q) {
      q.callback = null;
    }, n.unstable_forceFrameRate = function(q) {
      0 > q || 125 < q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : x = 0 < q ? Math.floor(1e3 / q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return b;
    }, n.unstable_next = function(q) {
      switch (b) {
        case 1:
        case 2:
        case 3:
          var J = 3;
          break;
        default:
          J = b;
      }
      var I = b;
      b = J;
      try {
        return q();
      } finally {
        b = I;
      }
    }, n.unstable_requestPaint = function() {
      S = !0;
    }, n.unstable_runWithPriority = function(q, J) {
      switch (q) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          q = 3;
      }
      var I = b;
      b = q;
      try {
        return J();
      } finally {
        b = I;
      }
    }, n.unstable_scheduleCallback = function(q, J, I) {
      var Q = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? Q + I : Q) : I = Q, q) {
        case 1:
          var Z = -1;
          break;
        case 2:
          Z = 250;
          break;
        case 5:
          Z = 1073741823;
          break;
        case 4:
          Z = 1e4;
          break;
        default:
          Z = 5e3;
      }
      return Z = I + Z, q = {
        id: k++,
        callback: J,
        priorityLevel: q,
        startTime: I,
        expirationTime: Z,
        sortIndex: -1
      }, I > Q ? (q.sortIndex = I, a(h, q), r(m) === null && q === r(h) && (z ? (D(w), w = -1) : z = !0, F(U, I - Q))) : (q.sortIndex = Z, a(m, q), _ || E || (_ = !0, V || (V = !0, C()))), q;
    }, n.unstable_shouldYield = T, n.unstable_wrapCallback = function(q) {
      var J = b;
      return function() {
        var I = b;
        b = J;
        try {
          return q.apply(this, arguments);
        } finally {
          b = I;
        }
      };
    };
  })(wo)), wo;
}
var Cf;
function q0() {
  return Cf || (Cf = 1, xo.exports = U0()), xo.exports;
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
var Af;
function L0() {
  return Af || (Af = 1, (function(n) {
    n.exports = function(a) {
      function r(e, t, l, o) {
        return new hh(e, t, l, o);
      }
      function i() {
      }
      function s(e) {
        var t = "https://react.dev/errors/" + e;
        if (1 < arguments.length) {
          t += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var l = 2; l < arguments.length; l++)
            t += "&args[]=" + encodeURIComponent(arguments[l]);
        }
        return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function c(e) {
        var t = e, l = e;
        if (e.alternate) for (; t.return; ) t = t.return;
        else {
          e = t;
          do
            t = e, (t.flags & 4098) !== 0 && (l = t.return), e = t.return;
          while (e);
        }
        return t.tag === 3 ? l : null;
      }
      function f(e) {
        if (c(e) !== e)
          throw Error(s(188));
      }
      function u(e) {
        var t = e.alternate;
        if (!t) {
          if (t = c(e), t === null) throw Error(s(188));
          return t !== e ? null : e;
        }
        for (var l = e, o = t; ; ) {
          var d = l.return;
          if (d === null) break;
          var p = d.alternate;
          if (p === null) {
            if (o = d.return, o !== null) {
              l = o;
              continue;
            }
            break;
          }
          if (d.child === p.child) {
            for (p = d.child; p; ) {
              if (p === l) return f(d), e;
              if (p === o) return f(d), t;
              p = p.sibling;
            }
            throw Error(s(188));
          }
          if (l.return !== o.return) l = d, o = p;
          else {
            for (var v = !1, M = d.child; M; ) {
              if (M === l) {
                v = !0, l = d, o = p;
                break;
              }
              if (M === o) {
                v = !0, o = d, l = p;
                break;
              }
              M = M.sibling;
            }
            if (!v) {
              for (M = p.child; M; ) {
                if (M === l) {
                  v = !0, l = p, o = d;
                  break;
                }
                if (M === o) {
                  v = !0, o = p, l = d;
                  break;
                }
                M = M.sibling;
              }
              if (!v) throw Error(s(189));
            }
          }
          if (l.alternate !== o) throw Error(s(190));
        }
        if (l.tag !== 3) throw Error(s(188));
        return l.stateNode.current === l ? e : t;
      }
      function m(e) {
        var t = e.tag;
        if (t === 5 || t === 26 || t === 27 || t === 6) return e;
        for (e = e.child; e !== null; ) {
          if (t = m(e), t !== null) return t;
          e = e.sibling;
        }
        return null;
      }
      function h(e) {
        var t = e.tag;
        if (t === 5 || t === 26 || t === 27 || t === 6) return e;
        for (e = e.child; e !== null; ) {
          if (e.tag !== 4 && (t = h(e), t !== null))
            return t;
          e = e.sibling;
        }
        return null;
      }
      function k(e) {
        return e === null || typeof e != "object" ? null : (e = Hd && e[Hd] || e["@@iterator"], typeof e == "function" ? e : null);
      }
      function g(e) {
        if (e == null) return null;
        if (typeof e == "function")
          return e.$$typeof === xh ? null : e.displayName || e.name || null;
        if (typeof e == "string") return e;
        switch (e) {
          case Ma:
            return "Fragment";
          case Ds:
            return "Profiler";
          case Dd:
            return "StrictMode";
          case Hs:
            return "Suspense";
          case Us:
            return "SuspenseList";
          case Ls:
            return "Activity";
        }
        if (typeof e == "object")
          switch (e.$$typeof) {
            case Aa:
              return "Portal";
            case Cn:
              return e.displayName || "Context";
            case Bd:
              return (e._context.displayName || "Context") + ".Consumer";
            case Bs:
              var t = e.render;
              return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
            case qs:
              return t = e.displayName || null, t !== null ? t : g(e.type) || "Memo";
            case An:
              t = e._payload, e = e._init;
              try {
                return g(e(t));
              } catch {
              }
          }
        return null;
      }
      function b(e) {
        return { current: e };
      }
      function E(e) {
        0 > Oa || (e.current = Xs[Oa], Xs[Oa] = null, Oa--);
      }
      function _(e, t) {
        Oa++, Xs[Oa] = e.current, e.current = t;
      }
      function z(e) {
        return e >>>= 0, e === 0 ? 32 : 31 - (Jg(e) / Wg | 0) | 0;
      }
      function S(e) {
        var t = e & 42;
        if (t !== 0) return t;
        switch (e & -e) {
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
            return e & 261888;
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return e & 3932160;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return e & 62914560;
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
            return e;
        }
      }
      function N(e, t, l) {
        var o = e.pendingLanes;
        if (o === 0) return 0;
        var d = 0, p = e.suspendedLanes, v = e.pingedLanes;
        e = e.warmLanes;
        var M = o & 134217727;
        return M !== 0 ? (o = M & ~p, o !== 0 ? d = S(o) : (v &= M, v !== 0 ? d = S(v) : l || (l = M & ~e, l !== 0 && (d = S(l))))) : (M = o & ~p, M !== 0 ? d = S(M) : v !== 0 ? d = S(v) : l || (l = o & ~e, l !== 0 && (d = S(l)))), d === 0 ? 0 : t !== 0 && t !== d && (t & p) === 0 && (p = d & -d, l = t & -t, p >= l || p === 32 && (l & 4194048) !== 0) ? t : d;
      }
      function D(e, t) {
        return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
      }
      function j(e, t) {
        switch (e) {
          case 1:
          case 2:
          case 4:
          case 8:
          case 64:
            return t + 250;
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
            return t + 5e3;
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
      function X() {
        var e = Cr;
        return Cr <<= 1, (Cr & 62914560) === 0 && (Cr = 4194304), e;
      }
      function U(e) {
        for (var t = [], l = 0; 31 > l; l++) t.push(e);
        return t;
      }
      function V(e, t) {
        e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
      }
      function w(e, t, l, o, d, p) {
        var v = e.pendingLanes;
        e.pendingLanes = l, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= l, e.entangledLanes &= l, e.errorRecoveryDisabledLanes &= l, e.shellSuspendCounter = 0;
        var M = e.entanglements, Y = e.expirationTimes, $ = e.hiddenUpdates;
        for (l = v & ~l; 0 < l; ) {
          var ne = 31 - Et(l), P = 1 << ne;
          M[ne] = 0, Y[ne] = -1;
          var le = $[ne];
          if (le !== null)
            for ($[ne] = null, ne = 0; ne < le.length; ne++) {
              var ge = le[ne];
              ge !== null && (ge.lane &= -536870913);
            }
          l &= ~P;
        }
        o !== 0 && x(e, o, 0), p !== 0 && d === 0 && e.tag !== 0 && (e.suspendedLanes |= p & ~(v & ~t));
      }
      function x(e, t, l) {
        e.pendingLanes |= t, e.suspendedLanes &= ~t;
        var o = 31 - Et(t);
        e.entangledLanes |= t, e.entanglements[o] = e.entanglements[o] | 1073741824 | l & 261930;
      }
      function y(e, t) {
        var l = e.entangledLanes |= t;
        for (e = e.entanglements; l; ) {
          var o = 31 - Et(l), d = 1 << o;
          d & t | e[o] & t && (e[o] |= t), l &= ~d;
        }
      }
      function T(e, t) {
        var l = t & -t;
        return l = (l & 42) !== 0 ? 1 : R(l), (l & (e.suspendedLanes | t)) !== 0 ? 0 : l;
      }
      function R(e) {
        switch (e) {
          case 2:
            e = 1;
            break;
          case 8:
            e = 4;
            break;
          case 32:
            e = 16;
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
            e = 128;
            break;
          case 268435456:
            e = 134217728;
            break;
          default:
            e = 0;
        }
        return e;
      }
      function C(e) {
        return e &= -e, 2 < e ? 8 < e ? (e & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function B(e) {
        if (typeof e0 == "function" && t0(e), zt && typeof zt.setStrictMode == "function")
          try {
            zt.setStrictMode(xl, e);
          } catch {
          }
      }
      function W(e, t) {
        return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
      }
      function F(e) {
        if (Ws === void 0)
          try {
            throw Error();
          } catch (l) {
            var t = l.stack.trim().match(/\n( *(at )?)/);
            Ws = t && t[1] || "", uf = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Ws + e + uf;
      }
      function q(e, t) {
        if (!e || $s) return "";
        $s = !0;
        var l = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var o = {
            DetermineComponentFrameRoot: function() {
              try {
                if (t) {
                  var P = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(P.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(P, []);
                    } catch (ge) {
                      var le = ge;
                    }
                    Reflect.construct(e, [], P);
                  } else {
                    try {
                      P.call();
                    } catch (ge) {
                      le = ge;
                    }
                    e.call(P.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (ge) {
                    le = ge;
                  }
                  (P = e()) && typeof P.catch == "function" && P.catch(function() {
                  });
                }
              } catch (ge) {
                if (ge && le && typeof ge.stack == "string")
                  return [ge.stack, le.stack];
              }
              return [null, null];
            }
          };
          o.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var d = Object.getOwnPropertyDescriptor(
            o.DetermineComponentFrameRoot,
            "name"
          );
          d && d.configurable && Object.defineProperty(
            o.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var p = o.DetermineComponentFrameRoot(), v = p[0], M = p[1];
          if (v && M) {
            var Y = v.split(`
`), $ = M.split(`
`);
            for (d = o = 0; o < Y.length && !Y[o].includes("DetermineComponentFrameRoot"); )
              o++;
            for (; d < $.length && !$[d].includes(
              "DetermineComponentFrameRoot"
            ); )
              d++;
            if (o === Y.length || d === $.length)
              for (o = Y.length - 1, d = $.length - 1; 1 <= o && 0 <= d && Y[o] !== $[d]; )
                d--;
            for (; 1 <= o && 0 <= d; o--, d--)
              if (Y[o] !== $[d]) {
                if (o !== 1 || d !== 1)
                  do
                    if (o--, d--, 0 > d || Y[o] !== $[d]) {
                      var ne = `
` + Y[o].replace(" at new ", " at ");
                      return e.displayName && ne.includes("<anonymous>") && (ne = ne.replace("<anonymous>", e.displayName)), ne;
                    }
                  while (1 <= o && 0 <= d);
                break;
              }
          }
        } finally {
          $s = !1, Error.prepareStackTrace = l;
        }
        return (l = e ? e.displayName || e.name : "") ? F(l) : "";
      }
      function J(e, t) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            return F(e.type);
          case 16:
            return F("Lazy");
          case 13:
            return e.child !== t && t !== null ? F("Suspense Fallback") : F("Suspense");
          case 19:
            return F("SuspenseList");
          case 0:
          case 15:
            return q(e.type, !1);
          case 11:
            return q(e.type.render, !1);
          case 1:
            return q(e.type, !0);
          case 31:
            return F("Activity");
          default:
            return "";
        }
      }
      function I(e) {
        try {
          var t = "", l = null;
          do
            t += J(e, l), l = e, e = e.return;
          while (e);
          return t;
        } catch (o) {
          return `
Error generating stack: ` + o.message + `
` + o.stack;
        }
      }
      function Q(e, t) {
        if (typeof e == "object" && e !== null) {
          var l = df.get(e);
          return l !== void 0 ? l : (t = {
            value: e,
            source: t,
            stack: I(t)
          }, df.set(e, t), t);
        }
        return {
          value: e,
          source: t,
          stack: I(t)
        };
      }
      function Z(e, t) {
        Ba[Ha++] = wl, Ba[Ha++] = Mr, Mr = e, wl = t;
      }
      function A(e, t, l) {
        Rt[jt++] = It, Rt[jt++] = Pt, Rt[jt++] = Mn, Mn = e;
        var o = It;
        e = Pt;
        var d = 32 - Et(o) - 1;
        o &= ~(1 << d), l += 1;
        var p = 32 - Et(t) + d;
        if (30 < p) {
          var v = d - d % 5;
          p = (o & (1 << v) - 1).toString(32), o >>= v, d -= v, It = 1 << 32 - Et(t) + d | l << d | o, Pt = p + e;
        } else
          It = 1 << p | l << d | o, Pt = e;
      }
      function K(e) {
        e.return !== null && (Z(e, 1), A(e, 1, 0));
      }
      function ae(e) {
        for (; e === Mr; )
          Mr = Ba[--Ha], Ba[Ha] = null, wl = Ba[--Ha], Ba[Ha] = null;
        for (; e === Mn; )
          Mn = Rt[--jt], Rt[jt] = null, Pt = Rt[--jt], Rt[jt] = null, It = Rt[--jt], Rt[jt] = null;
      }
      function oe(e, t) {
        Rt[jt++] = It, Rt[jt++] = Pt, Rt[jt++] = Mn, It = t.id, Pt = t.overflow, Mn = e;
      }
      function ce(e, t) {
        _(Rn, t), _(kl, e), _(rt, null), e = _h(t), E(rt), _(rt, e);
      }
      function ue() {
        E(rt), E(kl), E(Rn);
      }
      function Ee(e) {
        e.memoizedState !== null && _(Rr, e);
        var t = rt.current, l = Sh(t, e.type);
        t !== l && (_(kl, e), _(rt, l));
      }
      function Pe(e) {
        kl.current === e && (E(rt), E(kl)), Rr.current === e && (E(Rr), dn ? ia._currentValue = Ra : ia._currentValue2 = Ra);
      }
      function he(e) {
        var t = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw nl(Q(t, e)), Fs;
      }
      function $n(e, t) {
        if (!ft) throw Error(s(175));
        Sg(
          e.stateNode,
          e.type,
          e.memoizedProps,
          t,
          e
        ) || he(e, !0);
      }
      function Fn(e) {
        for (it = e.return; it; )
          switch (it.tag) {
            case 5:
            case 31:
            case 13:
              Ot = !1;
              return;
            case 27:
            case 3:
              Ot = !0;
              return;
            default:
              it = it.return;
          }
      }
      function qt(e) {
        if (!ft || e !== it) return !1;
        if (!Se) return Fn(e), Se = !0, !1;
        var t = e.tag;
        if (We ? t !== 3 && t !== 27 && (t !== 5 || $d(e.type) && !zr(e.type, e.memoizedProps)) && Be && he(e) : t !== 3 && (t !== 5 || $d(e.type) && !zr(e.type, e.memoizedProps)) && Be && he(e), Fn(e), t === 13) {
          if (!ft) throw Error(s(316));
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          Be = Cg(e);
        } else if (t === 31) {
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          Be = Tg(e);
        } else
          Be = We && t === 27 ? mg(
            e.type,
            Be
          ) : it ? Wd(e.stateNode) : null;
        return !0;
      }
      function Lt() {
        ft && (Be = it = null, Se = !1);
      }
      function wn() {
        var e = jn;
        return e !== null && (wt === null ? wt = e : wt.push.apply(
          wt,
          e
        ), jn = null), e;
      }
      function nl(e) {
        jn === null ? jn = [e] : jn.push(e);
      }
      function kn(e, t, l) {
        dn ? (_(jr, t._currentValue), t._currentValue = l) : (_(jr, t._currentValue2), t._currentValue2 = l);
      }
      function ln(e) {
        var t = jr.current;
        dn ? e._currentValue = t : e._currentValue2 = t, E(jr);
      }
      function Ri(e, t, l) {
        for (; e !== null; ) {
          var o = e.alternate;
          if ((e.childLanes & t) !== t ? (e.childLanes |= t, o !== null && (o.childLanes |= t)) : o !== null && (o.childLanes & t) !== t && (o.childLanes |= t), e === l) break;
          e = e.return;
        }
      }
      function ji(e, t, l, o) {
        var d = e.child;
        for (d !== null && (d.return = e); d !== null; ) {
          var p = d.dependencies;
          if (p !== null) {
            var v = d.child;
            p = p.firstContext;
            e: for (; p !== null; ) {
              var M = p;
              p = d;
              for (var Y = 0; Y < t.length; Y++)
                if (M.context === t[Y]) {
                  p.lanes |= l, M = p.alternate, M !== null && (M.lanes |= l), Ri(
                    p.return,
                    l,
                    e
                  ), o || (v = null);
                  break e;
                }
              p = M.next;
            }
          } else if (d.tag === 18) {
            if (v = d.return, v === null) throw Error(s(341));
            v.lanes |= l, p = v.alternate, p !== null && (p.lanes |= l), Ri(v, l, e), v = null;
          } else v = d.child;
          if (v !== null) v.return = d;
          else
            for (v = d; v !== null; ) {
              if (v === e) {
                v = null;
                break;
              }
              if (d = v.sibling, d !== null) {
                d.return = v.return, v = d;
                break;
              }
              v = v.return;
            }
          d = v;
        }
      }
      function Sa(e, t, l, o) {
        e = null;
        for (var d = t, p = !1; d !== null; ) {
          if (!p) {
            if ((d.flags & 524288) !== 0) p = !0;
            else if ((d.flags & 262144) !== 0) break;
          }
          if (d.tag === 10) {
            var v = d.alternate;
            if (v === null) throw Error(s(387));
            if (v = v.memoizedProps, v !== null) {
              var M = d.type;
              Nt(d.pendingProps.value, v.value) || (e !== null ? e.push(M) : e = [M]);
            }
          } else if (d === Rr.current) {
            if (v = d.alternate, v === null) throw Error(s(387));
            v.memoizedState.memoizedState !== d.memoizedState.memoizedState && (e !== null ? e.push(ia) : e = [ia]);
          }
          d = d.return;
        }
        e !== null && ji(
          t,
          e,
          l,
          o
        ), t.flags |= 262144;
      }
      function Wl(e) {
        for (e = e.firstContext; e !== null; ) {
          var t = e.context;
          if (!Nt(
            dn ? t._currentValue : t._currentValue2,
            e.memoizedValue
          ))
            return !0;
          e = e.next;
        }
        return !1;
      }
      function In(e) {
        sa = e, pn = null, e = e.dependencies, e !== null && (e.firstContext = null);
      }
      function at(e) {
        return _c(sa, e);
      }
      function $l(e, t) {
        return sa === null && In(e), _c(e, t);
      }
      function _c(e, t) {
        var l = dn ? t._currentValue : t._currentValue2;
        if (t = { context: t, memoizedValue: l, next: null }, pn === null) {
          if (e === null) throw Error(s(308));
          pn = t, e.dependencies = { lanes: 0, firstContext: t }, e.flags |= 524288;
        } else pn = pn.next = t;
        return l;
      }
      function Oi() {
        return {
          controller: new a0(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function al(e) {
        e.refCount--, e.refCount === 0 && l0(r0, function() {
          e.controller.abort();
        });
      }
      function Fl() {
      }
      function Wt(e) {
        e !== Ua && e.next === null && (Ua === null ? Or = Ua = e : Ua = Ua.next = e), Dr = !0, Is || (Is = !0, Zm());
      }
      function Ea(e, t) {
        if (!Ps && Dr) {
          Ps = !0;
          do
            for (var l = !1, o = Or; o !== null; ) {
              if (e !== 0) {
                var d = o.pendingLanes;
                if (d === 0) var p = 0;
                else {
                  var v = o.suspendedLanes, M = o.pingedLanes;
                  p = (1 << 31 - Et(42 | e) + 1) - 1, p &= d & ~(v & ~M), p = p & 201326741 ? p & 201326741 | 1 : p ? p | 2 : 0;
                }
                p !== 0 && (l = !0, Tc(o, p));
              } else
                p = _e, p = N(
                  o,
                  o === je ? p : 0,
                  o.cancelPendingCommit !== null || o.timeoutHandle !== ra
                ), (p & 3) === 0 || D(o, p) || (l = !0, Tc(o, p));
              o = o.next;
            }
          while (l);
          Ps = !1;
        }
      }
      function Sc() {
        Ec();
      }
      function Ec() {
        Dr = Is = !1;
        var e = 0;
        oa !== 0 && jh() && (e = oa);
        for (var t = yt(), l = null, o = Or; o !== null; ) {
          var d = o.next, p = zc(o, t);
          p === 0 ? (o.next = null, l === null ? Or = d : l.next = d, d === null && (Ua = l)) : (l = o, (e !== 0 || (p & 3) !== 0) && (Dr = !0)), o = d;
        }
        $e !== 0 && $e !== 5 || Ea(e), oa !== 0 && (oa = 0);
      }
      function zc(e, t) {
        for (var l = e.suspendedLanes, o = e.pingedLanes, d = e.expirationTimes, p = e.pendingLanes & -62914561; 0 < p; ) {
          var v = 31 - Et(p), M = 1 << v, Y = d[v];
          Y === -1 ? ((M & l) === 0 || (M & o) !== 0) && (d[v] = j(M, t)) : Y <= t && (e.expiredLanes |= M), p &= ~M;
        }
        if (t = je, l = _e, l = N(
          e,
          e === t ? l : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ra
        ), o = e.callbackNode, l === 0 || e === t && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null)
          return o !== null && o !== null && Ks(o), e.callbackNode = null, e.callbackPriority = 0;
        if ((l & 3) === 0 || D(e, l)) {
          if (t = l & -l, t === e.callbackPriority) return t;
          switch (o !== null && Ks(o), C(l)) {
            case 2:
            case 8:
              l = Ig;
              break;
            case 32:
              l = Js;
              break;
            case 268435456:
              l = Pg;
              break;
            default:
              l = Js;
          }
          return o = Nc.bind(null, e), l = Ar(l, o), e.callbackPriority = t, e.callbackNode = l, t;
        }
        return o !== null && o !== null && Ks(o), e.callbackPriority = 2, e.callbackNode = null, 2;
      }
      function Nc(e, t) {
        if ($e !== 0 && $e !== 5)
          return e.callbackNode = null, e.callbackPriority = 0, null;
        var l = e.callbackNode;
        if (gl() && e.callbackNode !== l)
          return null;
        var o = _e;
        return o = N(
          e,
          e === je ? o : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ra
        ), o === 0 ? null : (ud(e, o, t), zc(e, yt()), e.callbackNode != null && e.callbackNode === l ? Nc.bind(null, e) : null);
      }
      function Tc(e, t) {
        if (gl()) return null;
        ud(e, t, !0);
      }
      function Zm() {
        Lh ? Gh(function() {
          (we & 6) !== 0 ? Ar(
            of,
            Sc
          ) : Ec();
        }) : Ar(
          of,
          Sc
        );
      }
      function Di() {
        if (oa === 0) {
          var e = qa;
          e === 0 && (e = Nr, Nr <<= 1, (Nr & 261888) === 0 && (Nr = 256)), oa = e;
        }
        return oa;
      }
      function Xm(e, t) {
        if (_l === null) {
          var l = _l = [];
          eo = 0, qa = Di(), La = {
            status: "pending",
            value: void 0,
            then: function(o) {
              l.push(o);
            }
          };
        }
        return eo++, t.then(Cc, Cc), t;
      }
      function Cc() {
        if (--eo === 0 && _l !== null) {
          La !== null && (La.status = "fulfilled");
          var e = _l;
          _l = null, qa = 0, La = null;
          for (var t = 0; t < e.length; t++) (0, e[t])();
        }
      }
      function Km(e, t) {
        var l = [], o = {
          status: "pending",
          value: null,
          reason: null,
          then: function(d) {
            l.push(d);
          }
        };
        return e.then(
          function() {
            o.status = "fulfilled", o.value = t;
            for (var d = 0; d < l.length; d++) (0, l[d])(t);
          },
          function(d) {
            for (o.status = "rejected", o.reason = d, d = 0; d < l.length; d++)
              (0, l[d])(void 0);
          }
        ), o;
      }
      function Bi() {
        var e = ca.current;
        return e !== null ? e : je.pooledCache;
      }
      function Il(e, t) {
        t === null ? _(ca, ca.current) : _(ca, t.pool);
      }
      function Ac() {
        var e = Bi();
        return e === null ? null : {
          parent: dn ? He._currentValue : He._currentValue2,
          pool: e
        };
      }
      function Pl(e, t) {
        if (Nt(e, t)) return !0;
        if (typeof e != "object" || e === null || typeof t != "object" || t === null)
          return !1;
        var l = Object.keys(e), o = Object.keys(t);
        if (l.length !== o.length) return !1;
        for (o = 0; o < l.length; o++) {
          var d = l[o];
          if (!n0.call(t, d) || !Nt(e[d], t[d]))
            return !1;
        }
        return !0;
      }
      function Mc(e) {
        return e = e.status, e === "fulfilled" || e === "rejected";
      }
      function Rc(e, t, l) {
        switch (l = e[l], l === void 0 ? e.push(t) : l !== t && (t.then(Fl, Fl), t = l), t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, Oc(e), e;
          default:
            if (typeof t.status == "string") t.then(Fl, Fl);
            else {
              if (e = je, e !== null && 100 < e.shellSuspendCounter)
                throw Error(s(482));
              e = t, e.status = "pending", e.then(
                function(o) {
                  if (t.status === "pending") {
                    var d = t;
                    d.status = "fulfilled", d.value = o;
                  }
                },
                function(o) {
                  if (t.status === "pending") {
                    var d = t;
                    d.status = "rejected", d.reason = o;
                  }
                }
              );
            }
            switch (t.status) {
              case "fulfilled":
                return t.value;
              case "rejected":
                throw e = t.reason, Oc(e), e;
            }
            throw ua = t, Ga;
        }
      }
      function Pn(e) {
        try {
          var t = e._init;
          return t(e._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (ua = l, Ga) : l;
        }
      }
      function jc() {
        if (ua === null) throw Error(s(459));
        var e = ua;
        return ua = null, e;
      }
      function Oc(e) {
        if (e === Ga || e === Br)
          throw Error(s(483));
      }
      function er(e) {
        var t = Sl;
        return Sl += 1, Ya === null && (Ya = []), Rc(Ya, e, t);
      }
      function ll(e, t) {
        t = t.props.ref, e.ref = t !== void 0 ? t : null;
      }
      function tr(e, t) {
        throw t.$$typeof === vh ? Error(s(525)) : (e = Object.prototype.toString.call(t), Error(
          s(
            31,
            e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e
          )
        ));
      }
      function Dc(e) {
        function t(H, O) {
          if (e) {
            var L = H.deletions;
            L === null ? (H.deletions = [O], H.flags |= 16) : L.push(O);
          }
        }
        function l(H, O) {
          if (!e) return null;
          for (; O !== null; )
            t(H, O), O = O.sibling;
          return null;
        }
        function o(H) {
          for (var O = /* @__PURE__ */ new Map(); H !== null; )
            H.key !== null ? O.set(H.key, H) : O.set(H.index, H), H = H.sibling;
          return O;
        }
        function d(H, O) {
          return H = un(H, O), H.index = 0, H.sibling = null, H;
        }
        function p(H, O, L) {
          return H.index = L, e ? (L = H.alternate, L !== null ? (L = L.index, L < O ? (H.flags |= 67108866, O) : L) : (H.flags |= 67108866, O)) : (H.flags |= 1048576, O);
        }
        function v(H) {
          return e && H.alternate === null && (H.flags |= 67108866), H;
        }
        function M(H, O, L, ee) {
          return O === null || O.tag !== 6 ? (O = Ms(L, H.mode, ee), O.return = H, O) : (O = d(O, L), O.return = H, O);
        }
        function Y(H, O, L, ee) {
          var fe = L.type;
          return fe === Ma ? ne(
            H,
            O,
            L.props.children,
            ee,
            L.key
          ) : O !== null && (O.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === An && Pn(fe) === O.type) ? (O = d(O, L.props), ll(O, L), O.return = H, O) : (O = _r(
            L.type,
            L.key,
            L.props,
            null,
            H.mode,
            ee
          ), ll(O, L), O.return = H, O);
        }
        function $(H, O, L, ee) {
          return O === null || O.tag !== 4 || O.stateNode.containerInfo !== L.containerInfo || O.stateNode.implementation !== L.implementation ? (O = Rs(L, H.mode, ee), O.return = H, O) : (O = d(O, L.children || []), O.return = H, O);
        }
        function ne(H, O, L, ee, fe) {
          return O === null || O.tag !== 7 ? (O = la(
            L,
            H.mode,
            ee,
            fe
          ), O.return = H, O) : (O = d(O, L), O.return = H, O);
        }
        function P(H, O, L) {
          if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
            return O = Ms(
              "" + O,
              H.mode,
              L
            ), O.return = H, O;
          if (typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case Sr:
                return L = _r(
                  O.type,
                  O.key,
                  O.props,
                  null,
                  H.mode,
                  L
                ), ll(L, O), L.return = H, L;
              case Aa:
                return O = Rs(
                  O,
                  H.mode,
                  L
                ), O.return = H, O;
              case An:
                return O = Pn(O), P(H, O, L);
            }
            if (Er(O) || k(O))
              return O = la(
                O,
                H.mode,
                L,
                null
              ), O.return = H, O;
            if (typeof O.then == "function")
              return P(H, er(O), L);
            if (O.$$typeof === Cn)
              return P(
                H,
                $l(H, O),
                L
              );
            tr(H, O);
          }
          return null;
        }
        function le(H, O, L, ee) {
          var fe = O !== null ? O.key : null;
          if (typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint")
            return fe !== null ? null : M(H, O, "" + L, ee);
          if (typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case Sr:
                return L.key === fe ? Y(H, O, L, ee) : null;
              case Aa:
                return L.key === fe ? $(H, O, L, ee) : null;
              case An:
                return L = Pn(L), le(H, O, L, ee);
            }
            if (Er(L) || k(L))
              return fe !== null ? null : ne(H, O, L, ee, null);
            if (typeof L.then == "function")
              return le(
                H,
                O,
                er(L),
                ee
              );
            if (L.$$typeof === Cn)
              return le(
                H,
                O,
                $l(H, L),
                ee
              );
            tr(H, L);
          }
          return null;
        }
        function ge(H, O, L, ee, fe) {
          if (typeof ee == "string" && ee !== "" || typeof ee == "number" || typeof ee == "bigint")
            return H = H.get(L) || null, M(O, H, "" + ee, fe);
          if (typeof ee == "object" && ee !== null) {
            switch (ee.$$typeof) {
              case Sr:
                return H = H.get(
                  ee.key === null ? L : ee.key
                ) || null, Y(O, H, ee, fe);
              case Aa:
                return H = H.get(
                  ee.key === null ? L : ee.key
                ) || null, $(O, H, ee, fe);
              case An:
                return ee = Pn(ee), ge(
                  H,
                  O,
                  L,
                  ee,
                  fe
                );
            }
            if (Er(ee) || k(ee))
              return H = H.get(L) || null, ne(O, H, ee, fe, null);
            if (typeof ee.then == "function")
              return ge(
                H,
                O,
                L,
                er(ee),
                fe
              );
            if (ee.$$typeof === Cn)
              return ge(
                H,
                O,
                L,
                $l(O, ee),
                fe
              );
            tr(O, ee);
          }
          return null;
        }
        function st(H, O, L, ee) {
          for (var fe = null, Ue = null, pe = O, Te = O = 0, nt = null; pe !== null && Te < L.length; Te++) {
            pe.index > Te ? (nt = pe, pe = null) : nt = pe.sibling;
            var Ce = le(
              H,
              pe,
              L[Te],
              ee
            );
            if (Ce === null) {
              pe === null && (pe = nt);
              break;
            }
            e && pe && Ce.alternate === null && t(H, pe), O = p(Ce, O, Te), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce, pe = nt;
          }
          if (Te === L.length)
            return l(H, pe), Se && Z(H, Te), fe;
          if (pe === null) {
            for (; Te < L.length; Te++)
              pe = P(H, L[Te], ee), pe !== null && (O = p(
                pe,
                O,
                Te
              ), Ue === null ? fe = pe : Ue.sibling = pe, Ue = pe);
            return Se && Z(H, Te), fe;
          }
          for (pe = o(pe); Te < L.length; Te++)
            nt = ge(
              pe,
              H,
              Te,
              L[Te],
              ee
            ), nt !== null && (e && nt.alternate !== null && pe.delete(
              nt.key === null ? Te : nt.key
            ), O = p(
              nt,
              O,
              Te
            ), Ue === null ? fe = nt : Ue.sibling = nt, Ue = nt);
          return e && pe.forEach(function(qn) {
            return t(H, qn);
          }), Se && Z(H, Te), fe;
        }
        function Ml(H, O, L, ee) {
          if (L == null) throw Error(s(151));
          for (var fe = null, Ue = null, pe = O, Te = O = 0, nt = null, Ce = L.next(); pe !== null && !Ce.done; Te++, Ce = L.next()) {
            pe.index > Te ? (nt = pe, pe = null) : nt = pe.sibling;
            var qn = le(H, pe, Ce.value, ee);
            if (qn === null) {
              pe === null && (pe = nt);
              break;
            }
            e && pe && qn.alternate === null && t(H, pe), O = p(qn, O, Te), Ue === null ? fe = qn : Ue.sibling = qn, Ue = qn, pe = nt;
          }
          if (Ce.done)
            return l(H, pe), Se && Z(H, Te), fe;
          if (pe === null) {
            for (; !Ce.done; Te++, Ce = L.next())
              Ce = P(H, Ce.value, ee), Ce !== null && (O = p(
                Ce,
                O,
                Te
              ), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce);
            return Se && Z(H, Te), fe;
          }
          for (pe = o(pe); !Ce.done; Te++, Ce = L.next())
            Ce = ge(
              pe,
              H,
              Te,
              Ce.value,
              ee
            ), Ce !== null && (e && Ce.alternate !== null && pe.delete(Ce.key === null ? Te : Ce.key), O = p(Ce, O, Te), Ue === null ? fe = Ce : Ue.sibling = Ce, Ue = Ce);
          return e && pe.forEach(function(c0) {
            return t(H, c0);
          }), Se && Z(H, Te), fe;
        }
        function ma(H, O, L, ee) {
          if (typeof L == "object" && L !== null && L.type === Ma && L.key === null && (L = L.props.children), typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case Sr:
                e: {
                  for (var fe = L.key; O !== null; ) {
                    if (O.key === fe) {
                      if (fe = L.type, fe === Ma) {
                        if (O.tag === 7) {
                          l(
                            H,
                            O.sibling
                          ), ee = d(
                            O,
                            L.props.children
                          ), ee.return = H, H = ee;
                          break e;
                        }
                      } else if (O.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === An && Pn(fe) === O.type) {
                        l(
                          H,
                          O.sibling
                        ), ee = d(O, L.props), ll(ee, L), ee.return = H, H = ee;
                        break e;
                      }
                      l(H, O);
                      break;
                    } else t(H, O);
                    O = O.sibling;
                  }
                  L.type === Ma ? (ee = la(
                    L.props.children,
                    H.mode,
                    ee,
                    L.key
                  ), ee.return = H, H = ee) : (ee = _r(
                    L.type,
                    L.key,
                    L.props,
                    null,
                    H.mode,
                    ee
                  ), ll(ee, L), ee.return = H, H = ee);
                }
                return v(H);
              case Aa:
                e: {
                  for (fe = L.key; O !== null; ) {
                    if (O.key === fe)
                      if (O.tag === 4 && O.stateNode.containerInfo === L.containerInfo && O.stateNode.implementation === L.implementation) {
                        l(
                          H,
                          O.sibling
                        ), ee = d(
                          O,
                          L.children || []
                        ), ee.return = H, H = ee;
                        break e;
                      } else {
                        l(H, O);
                        break;
                      }
                    else t(H, O);
                    O = O.sibling;
                  }
                  ee = Rs(L, H.mode, ee), ee.return = H, H = ee;
                }
                return v(H);
              case An:
                return L = Pn(L), ma(
                  H,
                  O,
                  L,
                  ee
                );
            }
            if (Er(L))
              return st(
                H,
                O,
                L,
                ee
              );
            if (k(L)) {
              if (fe = k(L), typeof fe != "function")
                throw Error(s(150));
              return L = fe.call(L), Ml(
                H,
                O,
                L,
                ee
              );
            }
            if (typeof L.then == "function")
              return ma(
                H,
                O,
                er(L),
                ee
              );
            if (L.$$typeof === Cn)
              return ma(
                H,
                O,
                $l(H, L),
                ee
              );
            tr(H, L);
          }
          return typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint" ? (L = "" + L, O !== null && O.tag === 6 ? (l(H, O.sibling), ee = d(O, L), ee.return = H, H = ee) : (l(H, O), ee = Ms(L, H.mode, ee), ee.return = H, H = ee), v(H)) : l(H, O);
        }
        return function(H, O, L, ee) {
          try {
            Sl = 0;
            var fe = ma(
              H,
              O,
              L,
              ee
            );
            return Ya = null, fe;
          } catch (pe) {
            if (pe === Ga || pe === Br) throw pe;
            var Ue = r(29, pe, null, H.mode);
            return Ue.lanes = ee, Ue.return = H, Ue;
          } finally {
          }
        };
      }
      function nr() {
        for (var e = Qa, t = no = Qa = 0; t < e; ) {
          var l = Dt[t];
          Dt[t++] = null;
          var o = Dt[t];
          Dt[t++] = null;
          var d = Dt[t];
          Dt[t++] = null;
          var p = Dt[t];
          if (Dt[t++] = null, o !== null && d !== null) {
            var v = o.pending;
            v === null ? d.next = d : (d.next = v.next, v.next = d), o.pending = d;
          }
          p !== 0 && Bc(l, d, p);
        }
      }
      function ar(e, t, l, o) {
        Dt[Qa++] = e, Dt[Qa++] = t, Dt[Qa++] = l, Dt[Qa++] = o, no |= o, e.lanes |= o, e = e.alternate, e !== null && (e.lanes |= o);
      }
      function Hi(e, t, l, o) {
        return ar(e, t, l, o), lr(e);
      }
      function ea(e, t) {
        return ar(e, null, null, t), lr(e);
      }
      function Bc(e, t, l) {
        e.lanes |= l;
        var o = e.alternate;
        o !== null && (o.lanes |= l);
        for (var d = !1, p = e.return; p !== null; )
          p.childLanes |= l, o = p.alternate, o !== null && (o.childLanes |= l), p.tag === 22 && (e = p.stateNode, e === null || e._visibility & 1 || (d = !0)), e = p, p = p.return;
        return e.tag === 3 ? (p = e.stateNode, d && t !== null && (d = 31 - Et(l), e = p.hiddenUpdates, o = e[d], o === null ? e[d] = [t] : o.push(t), t.lane = l | 536870912), p) : null;
      }
      function lr(e) {
        if (50 < Al)
          throw Al = 0, ho = null, Error(s(185));
        for (var t = e.return; t !== null; )
          e = t, t = e.return;
        return e.tag === 3 ? e.stateNode : null;
      }
      function Ui(e) {
        e.updateQueue = {
          baseState: e.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function qi(e, t) {
        e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
          baseState: e.baseState,
          firstBaseUpdate: e.firstBaseUpdate,
          lastBaseUpdate: e.lastBaseUpdate,
          shared: e.shared,
          callbacks: null
        });
      }
      function _n(e) {
        return { lane: e, tag: 0, payload: null, callback: null, next: null };
      }
      function Sn(e, t, l) {
        var o = e.updateQueue;
        if (o === null) return null;
        if (o = o.shared, (we & 2) !== 0) {
          var d = o.pending;
          return d === null ? t.next = t : (t.next = d.next, d.next = t), o.pending = t, t = lr(e), Bc(e, null, l), t;
        }
        return ar(e, o, t, l), lr(e);
      }
      function rl(e, t, l) {
        if (t = t.updateQueue, t !== null && (t = t.shared, (l & 4194048) !== 0)) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, y(e, l);
        }
      }
      function Li(e, t) {
        var l = e.updateQueue, o = e.alternate;
        if (o !== null && (o = o.updateQueue, l === o)) {
          var d = null, p = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var v = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              p === null ? d = p = v : p = p.next = v, l = l.next;
            } while (l !== null);
            p === null ? d = p = t : p = p.next = t;
          } else d = p = t;
          l = {
            baseState: o.baseState,
            firstBaseUpdate: d,
            lastBaseUpdate: p,
            shared: o.shared,
            callbacks: o.callbacks
          }, e.updateQueue = l;
          return;
        }
        e = l.lastBaseUpdate, e === null ? l.firstBaseUpdate = t : e.next = t, l.lastBaseUpdate = t;
      }
      function il() {
        if (ao) {
          var e = La;
          if (e !== null) throw e;
        }
      }
      function sl(e, t, l, o) {
        ao = !1;
        var d = e.updateQueue;
        On = !1;
        var p = d.firstBaseUpdate, v = d.lastBaseUpdate, M = d.shared.pending;
        if (M !== null) {
          d.shared.pending = null;
          var Y = M, $ = Y.next;
          Y.next = null, v === null ? p = $ : v.next = $, v = Y;
          var ne = e.alternate;
          ne !== null && (ne = ne.updateQueue, M = ne.lastBaseUpdate, M !== v && (M === null ? ne.firstBaseUpdate = $ : M.next = $, ne.lastBaseUpdate = Y));
        }
        if (p !== null) {
          var P = d.baseState;
          v = 0, ne = $ = Y = null, M = p;
          do {
            var le = M.lane & -536870913, ge = le !== M.lane;
            if (ge ? (_e & le) === le : (o & le) === le) {
              le !== 0 && le === qa && (ao = !0), ne !== null && (ne = ne.next = {
                lane: 0,
                tag: M.tag,
                payload: M.payload,
                callback: null,
                next: null
              });
              e: {
                var st = e, Ml = M;
                le = t;
                var ma = l;
                switch (Ml.tag) {
                  case 1:
                    if (st = Ml.payload, typeof st == "function") {
                      P = st.call(
                        ma,
                        P,
                        le
                      );
                      break e;
                    }
                    P = st;
                    break e;
                  case 3:
                    st.flags = st.flags & -65537 | 128;
                  case 0:
                    if (st = Ml.payload, le = typeof st == "function" ? st.call(ma, P, le) : st, le == null) break e;
                    P = Os({}, P, le);
                    break e;
                  case 2:
                    On = !0;
                }
              }
              le = M.callback, le !== null && (e.flags |= 64, ge && (e.flags |= 8192), ge = d.callbacks, ge === null ? d.callbacks = [le] : ge.push(le));
            } else
              ge = {
                lane: le,
                tag: M.tag,
                payload: M.payload,
                callback: M.callback,
                next: null
              }, ne === null ? ($ = ne = ge, Y = P) : ne = ne.next = ge, v |= le;
            if (M = M.next, M === null) {
              if (M = d.shared.pending, M === null)
                break;
              ge = M, M = ge.next, ge.next = null, d.lastBaseUpdate = ge, d.shared.pending = null;
            }
          } while (!0);
          ne === null && (Y = P), d.baseState = Y, d.firstBaseUpdate = $, d.lastBaseUpdate = ne, p === null && (d.shared.lanes = 0), Bn |= v, e.lanes = v, e.memoizedState = P;
        }
      }
      function Hc(e, t) {
        if (typeof e != "function")
          throw Error(s(191, e));
        e.call(t);
      }
      function Uc(e, t) {
        var l = e.callbacks;
        if (l !== null)
          for (e.callbacks = null, e = 0; e < l.length; e++)
            Hc(l[e], t);
      }
      function qc(e, t) {
        e = gn, _(Ur, e), _(Va, t), gn = e | t.baseLanes;
      }
      function Gi() {
        _(Ur, gn), _(Va, Va.current);
      }
      function Yi() {
        gn = Ur.current, E(Va), E(Ur);
      }
      function En(e) {
        var t = e.alternate;
        _(Ye, Ye.current & 1), _(Tt, e), Bt === null && (t === null || Va.current !== null || t.memoizedState !== null) && (Bt = e);
      }
      function Qi(e) {
        _(Ye, Ye.current), _(Tt, e), Bt === null && (Bt = e);
      }
      function Lc(e) {
        e.tag === 22 ? (_(Ye, Ye.current), _(Tt, e), Bt === null && (Bt = e)) : zn();
      }
      function zn() {
        _(Ye, Ye.current), _(Tt, Tt.current);
      }
      function kt(e) {
        E(Tt), Bt === e && (Bt = null), E(Ye);
      }
      function rr(e) {
        for (var t = e; t !== null; ) {
          if (t.tag === 13) {
            var l = t.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || Qs(l) || Vs(l)))
              return t;
          } else if (t.tag === 19 && (t.memoizedProps.revealOrder === "forwards" || t.memoizedProps.revealOrder === "backwards" || t.memoizedProps.revealOrder === "unstable_legacy-backwards" || t.memoizedProps.revealOrder === "together")) {
            if ((t.flags & 128) !== 0) return t;
          } else if (t.child !== null) {
            t.child.return = t, t = t.child;
            continue;
          }
          if (t === e) break;
          for (; t.sibling === null; ) {
            if (t.return === null || t.return === e) return null;
            t = t.return;
          }
          t.sibling.return = t.return, t = t.sibling;
        }
        return null;
      }
      function qe() {
        throw Error(s(321));
      }
      function Vi(e, t) {
        if (t === null) return !1;
        for (var l = 0; l < t.length && l < e.length; l++)
          if (!Nt(e[l], t[l])) return !1;
        return !0;
      }
      function Zi(e, t, l, o, d, p) {
        return mn = p, be = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, de.H = e === null || e.memoizedState === null ? mf : lo, fa = !1, p = l(o, d), fa = !1, Za && (p = Yc(
          t,
          l,
          o,
          d
        )), Gc(e), p;
      }
      function Gc(e) {
        de.H = zl;
        var t = Me !== null && Me.next !== null;
        if (mn = 0, Ve = Me = be = null, qr = !1, El = 0, Xa = null, t) throw Error(s(300));
        e === null || Ze || (e = e.dependencies, e !== null && Wl(e) && (Ze = !0));
      }
      function Yc(e, t, l, o) {
        be = e;
        var d = 0;
        do {
          if (Za && (Xa = null), El = 0, Za = !1, 25 <= d) throw Error(s(301));
          if (d += 1, Ve = Me = null, e.updateQueue != null) {
            var p = e.updateQueue;
            p.lastEffect = null, p.events = null, p.stores = null, p.memoCache != null && (p.memoCache.index = 0);
          }
          de.H = hf, p = t(l, o);
        } while (Za);
        return p;
      }
      function Jm() {
        var e = de.H, t = e.useState()[0];
        return t = typeof t.then == "function" ? ol(t) : t, e = e.useState()[0], (Me !== null ? Me.memoizedState : null) !== e && (be.flags |= 1024), t;
      }
      function Xi() {
        var e = Lr !== 0;
        return Lr = 0, e;
      }
      function Ki(e, t, l) {
        t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l;
      }
      function Ji(e) {
        if (qr) {
          for (e = e.memoizedState; e !== null; ) {
            var t = e.queue;
            t !== null && (t.pending = null), e = e.next;
          }
          qr = !1;
        }
        mn = 0, Ve = Me = be = null, Za = !1, El = Lr = 0, Xa = null;
      }
      function ht() {
        var e = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Ve === null ? be.memoizedState = Ve = e : Ve = Ve.next = e, Ve;
      }
      function Ge() {
        if (Me === null) {
          var e = be.alternate;
          e = e !== null ? e.memoizedState : null;
        } else e = Me.next;
        var t = Ve === null ? be.memoizedState : Ve.next;
        if (t !== null)
          Ve = t, Me = e;
        else {
          if (e === null)
            throw be.alternate === null ? Error(s(467)) : Error(s(310));
          Me = e, e = {
            memoizedState: Me.memoizedState,
            baseState: Me.baseState,
            baseQueue: Me.baseQueue,
            queue: Me.queue,
            next: null
          }, Ve === null ? be.memoizedState = Ve = e : Ve = Ve.next = e;
        }
        return Ve;
      }
      function ir() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function ol(e) {
        var t = El;
        return El += 1, Xa === null && (Xa = []), e = Rc(Xa, e, t), t = be, (Ve === null ? t.memoizedState : Ve.next) === null && (t = t.alternate, de.H = t === null || t.memoizedState === null ? mf : lo), e;
      }
      function sr(e) {
        if (e !== null && typeof e == "object") {
          if (typeof e.then == "function") return ol(e);
          if (e.$$typeof === Cn) return at(e);
        }
        throw Error(s(438, String(e)));
      }
      function Wi(e) {
        var t = null, l = be.updateQueue;
        if (l !== null && (t = l.memoCache), t == null) {
          var o = be.alternate;
          o !== null && (o = o.updateQueue, o !== null && (o = o.memoCache, o != null && (t = {
            data: o.data.map(function(d) {
              return d.slice();
            }),
            index: 0
          })));
        }
        if (t == null && (t = { data: [], index: 0 }), l === null && (l = ir(), be.updateQueue = l), l.memoCache = t, l = t.data[t.index], l === void 0)
          for (l = t.data[t.index] = Array(e), o = 0; o < e; o++)
            l[o] = yh;
        return t.index++, l;
      }
      function rn(e, t) {
        return typeof t == "function" ? t(e) : t;
      }
      function or(e) {
        var t = Ge();
        return $i(t, Me, e);
      }
      function $i(e, t, l) {
        var o = e.queue;
        if (o === null) throw Error(s(311));
        o.lastRenderedReducer = l;
        var d = e.baseQueue, p = o.pending;
        if (p !== null) {
          if (d !== null) {
            var v = d.next;
            d.next = p.next, p.next = v;
          }
          t.baseQueue = d = p, o.pending = null;
        }
        if (p = e.baseState, d === null) e.memoizedState = p;
        else {
          t = d.next;
          var M = v = null, Y = null, $ = t, ne = !1;
          do {
            var P = $.lane & -536870913;
            if (P !== $.lane ? (_e & P) === P : (mn & P) === P) {
              var le = $.revertLane;
              if (le === 0)
                Y !== null && (Y = Y.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: $.action,
                  hasEagerState: $.hasEagerState,
                  eagerState: $.eagerState,
                  next: null
                }), P === qa && (ne = !0);
              else if ((mn & le) === le) {
                $ = $.next, le === qa && (ne = !0);
                continue;
              } else
                P = {
                  lane: 0,
                  revertLane: $.revertLane,
                  gesture: null,
                  action: $.action,
                  hasEagerState: $.hasEagerState,
                  eagerState: $.eagerState,
                  next: null
                }, Y === null ? (M = Y = P, v = p) : Y = Y.next = P, be.lanes |= le, Bn |= le;
              P = $.action, fa && l(p, P), p = $.hasEagerState ? $.eagerState : l(p, P);
            } else
              le = {
                lane: P,
                revertLane: $.revertLane,
                gesture: $.gesture,
                action: $.action,
                hasEagerState: $.hasEagerState,
                eagerState: $.eagerState,
                next: null
              }, Y === null ? (M = Y = le, v = p) : Y = Y.next = le, be.lanes |= P, Bn |= P;
            $ = $.next;
          } while ($ !== null && $ !== t);
          if (Y === null ? v = p : Y.next = M, !Nt(p, e.memoizedState) && (Ze = !0, ne && (l = La, l !== null)))
            throw l;
          e.memoizedState = p, e.baseState = v, e.baseQueue = Y, o.lastRenderedState = p;
        }
        return d === null && (o.lanes = 0), [e.memoizedState, o.dispatch];
      }
      function Fi(e) {
        var t = Ge(), l = t.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = e;
        var o = l.dispatch, d = l.pending, p = t.memoizedState;
        if (d !== null) {
          l.pending = null;
          var v = d = d.next;
          do
            p = e(p, v.action), v = v.next;
          while (v !== d);
          Nt(p, t.memoizedState) || (Ze = !0), t.memoizedState = p, t.baseQueue === null && (t.baseState = p), l.lastRenderedState = p;
        }
        return [p, o];
      }
      function Qc(e, t, l) {
        var o = be, d = Ge(), p = Se;
        if (p) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = t();
        var v = !Nt(
          (Me || d).memoizedState,
          l
        );
        if (v && (d.memoizedState = l, Ze = !0), d = d.queue, es(Xc.bind(null, o, d, e), [
          e
        ]), d.getSnapshot !== t || v || Ve !== null && Ve.memoizedState.tag & 1) {
          if (o.flags |= 2048, za(
            9,
            { destroy: void 0 },
            Zc.bind(
              null,
              o,
              d,
              l,
              t
            ),
            null
          ), je === null) throw Error(s(349));
          p || (mn & 127) !== 0 || Vc(o, t, l);
        }
        return l;
      }
      function Vc(e, t, l) {
        e.flags |= 16384, e = { getSnapshot: t, value: l }, t = be.updateQueue, t === null ? (t = ir(), be.updateQueue = t, t.stores = [e]) : (l = t.stores, l === null ? t.stores = [e] : l.push(e));
      }
      function Zc(e, t, l, o) {
        t.value = l, t.getSnapshot = o, Kc(t) && Jc(e);
      }
      function Xc(e, t, l) {
        return l(function() {
          Kc(t) && Jc(e);
        });
      }
      function Kc(e) {
        var t = e.getSnapshot;
        e = e.value;
        try {
          var l = t();
          return !Nt(e, l);
        } catch {
          return !0;
        }
      }
      function Jc(e) {
        var t = ea(e, 2);
        t !== null && vt(t, e, 2);
      }
      function Ii(e) {
        var t = ht();
        if (typeof e == "function") {
          var l = e;
          if (e = l(), fa) {
            B(!0);
            try {
              l();
            } finally {
              B(!1);
            }
          }
        }
        return t.memoizedState = t.baseState = e, t.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: rn,
          lastRenderedState: e
        }, t;
      }
      function Wc(e, t, l, o) {
        return e.baseState = l, $i(
          e,
          Me,
          typeof o == "function" ? o : rn
        );
      }
      function Wm(e, t, l, o, d) {
        if (dr(e)) throw Error(s(485));
        if (e = t.action, e !== null) {
          var p = {
            payload: d,
            action: e,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(v) {
              p.listeners.push(v);
            }
          };
          de.T !== null ? l(!0) : p.isTransition = !1, o(p), l = t.pending, l === null ? (p.next = t.pending = p, $c(t, p)) : (p.next = l.next, t.pending = l.next = p);
        }
      }
      function $c(e, t) {
        var l = t.action, o = t.payload, d = e.state;
        if (t.isTransition) {
          var p = de.T, v = {};
          de.T = v;
          try {
            var M = l(d, o), Y = de.S;
            Y !== null && Y(v, M), Fc(e, t, M);
          } catch ($) {
            Pi(e, t, $);
          } finally {
            p !== null && v.types !== null && (p.types = v.types), de.T = p;
          }
        } else
          try {
            p = l(d, o), Fc(e, t, p);
          } catch ($) {
            Pi(e, t, $);
          }
      }
      function Fc(e, t, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(o) {
            Ic(e, t, o);
          },
          function(o) {
            return Pi(e, t, o);
          }
        ) : Ic(e, t, l);
      }
      function Ic(e, t, l) {
        t.status = "fulfilled", t.value = l, Pc(t), e.state = l, t = e.pending, t !== null && (l = t.next, l === t ? e.pending = null : (l = l.next, t.next = l, $c(e, l)));
      }
      function Pi(e, t, l) {
        var o = e.pending;
        if (e.pending = null, o !== null) {
          o = o.next;
          do
            t.status = "rejected", t.reason = l, Pc(t), t = t.next;
          while (t !== o);
        }
        e.action = null;
      }
      function Pc(e) {
        e = e.listeners;
        for (var t = 0; t < e.length; t++) (0, e[t])();
      }
      function eu(e, t) {
        return t;
      }
      function tu(e, t) {
        if (Se) {
          var l = je.formState;
          if (l !== null) {
            e: {
              var o = be;
              if (Se) {
                if (Be) {
                  var d = fg(
                    Be,
                    Ot
                  );
                  if (d) {
                    Be = Wd(d), o = pg(d);
                    break e;
                  }
                }
                he(o);
              }
              o = !1;
            }
            o && (t = l[0]);
          }
        }
        l = ht(), l.memoizedState = l.baseState = t, o = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: eu,
          lastRenderedState: t
        }, l.queue = o, l = yu.bind(
          null,
          be,
          o
        ), o.dispatch = l, o = Ii(!1);
        var p = ls.bind(
          null,
          be,
          !1,
          o.queue
        );
        return o = ht(), d = {
          state: t,
          dispatch: null,
          action: e,
          pending: null
        }, o.queue = d, l = Wm.bind(
          null,
          be,
          d,
          p,
          l
        ), d.dispatch = l, o.memoizedState = e, [t, l, !1];
      }
      function nu(e) {
        var t = Ge();
        return au(t, Me, e);
      }
      function au(e, t, l) {
        if (t = $i(
          e,
          t,
          eu
        )[0], e = or(rn)[0], typeof t == "object" && t !== null && typeof t.then == "function")
          try {
            var o = ol(t);
          } catch (v) {
            throw v === Ga ? Br : v;
          }
        else o = t;
        t = Ge();
        var d = t.queue, p = d.dispatch;
        return l !== t.memoizedState && (be.flags |= 2048, za(
          9,
          { destroy: void 0 },
          $m.bind(null, d, l),
          null
        )), [o, p, e];
      }
      function $m(e, t) {
        e.action = t;
      }
      function lu(e) {
        var t = Ge(), l = Me;
        if (l !== null)
          return au(t, l, e);
        Ge(), t = t.memoizedState, l = Ge();
        var o = l.queue.dispatch;
        return l.memoizedState = e, [t, o, !1];
      }
      function za(e, t, l, o) {
        return e = { tag: e, create: l, deps: o, inst: t, next: null }, t = be.updateQueue, t === null && (t = ir(), be.updateQueue = t), l = t.lastEffect, l === null ? t.lastEffect = e.next = e : (o = l.next, l.next = e, e.next = o, t.lastEffect = e), e;
      }
      function ru() {
        return Ge().memoizedState;
      }
      function cr(e, t, l, o) {
        var d = ht();
        be.flags |= e, d.memoizedState = za(
          1 | t,
          { destroy: void 0 },
          l,
          o === void 0 ? null : o
        );
      }
      function ur(e, t, l, o) {
        var d = Ge();
        o = o === void 0 ? null : o;
        var p = d.memoizedState.inst;
        Me !== null && o !== null && Vi(o, Me.memoizedState.deps) ? d.memoizedState = za(t, p, l, o) : (be.flags |= e, d.memoizedState = za(
          1 | t,
          p,
          l,
          o
        ));
      }
      function iu(e, t) {
        cr(8390656, 8, e, t);
      }
      function es(e, t) {
        ur(2048, 8, e, t);
      }
      function Fm(e) {
        be.flags |= 4;
        var t = be.updateQueue;
        if (t === null)
          t = ir(), be.updateQueue = t, t.events = [e];
        else {
          var l = t.events;
          l === null ? t.events = [e] : l.push(e);
        }
      }
      function su(e) {
        var t = Ge().memoizedState;
        return Fm({ ref: t, nextImpl: e }), function() {
          if ((we & 2) !== 0)
            throw Error(s(440));
          return t.impl.apply(void 0, arguments);
        };
      }
      function ou(e, t) {
        return ur(4, 2, e, t);
      }
      function cu(e, t) {
        return ur(4, 4, e, t);
      }
      function uu(e, t) {
        if (typeof t == "function") {
          e = e();
          var l = t(e);
          return function() {
            typeof l == "function" ? l() : t(null);
          };
        }
        if (t != null)
          return e = e(), t.current = e, function() {
            t.current = null;
          };
      }
      function du(e, t, l) {
        l = l != null ? l.concat([e]) : null, ur(
          4,
          4,
          uu.bind(null, t, e),
          l
        );
      }
      function ts() {
      }
      function fu(e, t) {
        var l = Ge();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        return t !== null && Vi(t, o[1]) ? o[0] : (l.memoizedState = [e, t], e);
      }
      function pu(e, t) {
        var l = Ge();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        if (t !== null && Vi(t, o[1]))
          return o[0];
        if (o = e(), fa) {
          B(!0);
          try {
            e();
          } finally {
            B(!1);
          }
        }
        return l.memoizedState = [o, t], o;
      }
      function ns(e, t, l) {
        return l === void 0 || (mn & 1073741824) !== 0 && (_e & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = l, e = cd(), be.lanes |= e, Bn |= e, l);
      }
      function mu(e, t, l, o) {
        return Nt(l, t) ? l : Va.current !== null ? (e = ns(e, l, o), Nt(e, t) || (Ze = !0), e) : (mn & 42) === 0 || (mn & 1073741824) !== 0 && (_e & 261930) === 0 ? (Ze = !0, e.memoizedState = l) : (e = cd(), be.lanes |= e, Bn |= e, t);
      }
      function hu(e, t, l, o, d) {
        var p = fn();
        et(
          p !== 0 && 8 > p ? p : 8
        );
        var v = de.T, M = {};
        de.T = M, ls(e, !1, t, l);
        try {
          var Y = d(), $ = de.S;
          if ($ !== null && $(M, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var ne = Km(
              Y,
              o
            );
            cl(
              e,
              t,
              ne,
              _t(e)
            );
          } else
            cl(
              e,
              t,
              o,
              _t(e)
            );
        } catch (P) {
          cl(
            e,
            t,
            { then: function() {
            }, status: "rejected", reason: P },
            _t()
          );
        } finally {
          et(p), v !== null && M.types !== null && (v.types = M.types), de.T = v;
        }
      }
      function gu(e) {
        var t = e.memoizedState;
        if (t !== null) return t;
        t = {
          memoizedState: Ra,
          baseState: Ra,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: rn,
            lastRenderedState: Ra
          },
          next: null
        };
        var l = {};
        return t.next = {
          memoizedState: l,
          baseState: l,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: rn,
            lastRenderedState: l
          },
          next: null
        }, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
      }
      function as() {
        return at(ia);
      }
      function bu() {
        return Ge().memoizedState;
      }
      function vu() {
        return Ge().memoizedState;
      }
      function Im(e) {
        for (var t = e.return; t !== null; ) {
          switch (t.tag) {
            case 24:
            case 3:
              var l = _t();
              e = _n(l);
              var o = Sn(t, e, l);
              o !== null && (vt(o, t, l), rl(o, t, l)), t = { cache: Oi() }, e.payload = t;
              return;
          }
          t = t.return;
        }
      }
      function Pm(e, t, l) {
        var o = _t();
        l = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, dr(e) ? xu(t, l) : (l = Hi(e, t, l, o), l !== null && (vt(l, e, o), wu(l, t, o)));
      }
      function yu(e, t, l) {
        var o = _t();
        cl(e, t, l, o);
      }
      function cl(e, t, l, o) {
        var d = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (dr(e)) xu(t, d);
        else {
          var p = e.alternate;
          if (e.lanes === 0 && (p === null || p.lanes === 0) && (p = t.lastRenderedReducer, p !== null))
            try {
              var v = t.lastRenderedState, M = p(v, l);
              if (d.hasEagerState = !0, d.eagerState = M, Nt(M, v))
                return ar(e, t, d, 0), je === null && nr(), !1;
            } catch {
            } finally {
            }
          if (l = Hi(e, t, d, o), l !== null)
            return vt(l, e, o), wu(l, t, o), !0;
        }
        return !1;
      }
      function ls(e, t, l, o) {
        if (o = {
          lane: 2,
          revertLane: Di(),
          gesture: null,
          action: o,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, dr(e)) {
          if (t) throw Error(s(479));
        } else
          t = Hi(
            e,
            l,
            o,
            2
          ), t !== null && vt(t, e, 2);
      }
      function dr(e) {
        var t = e.alternate;
        return e === be || t !== null && t === be;
      }
      function xu(e, t) {
        Za = qr = !0;
        var l = e.pending;
        l === null ? t.next = t : (t.next = l.next, l.next = t), e.pending = t;
      }
      function wu(e, t, l) {
        if ((l & 4194048) !== 0) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, y(e, l);
        }
      }
      function rs(e, t, l, o) {
        t = e.memoizedState, l = l(o, t), l = l == null ? t : Os({}, t, l), e.memoizedState = l, e.lanes === 0 && (e.updateQueue.baseState = l);
      }
      function ku(e, t, l, o, d, p, v) {
        return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(o, p, v) : t.prototype && t.prototype.isPureReactComponent ? !Pl(l, o) || !Pl(d, p) : !0;
      }
      function _u(e, t, l, o) {
        e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(l, o), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(l, o), t.state !== e && ro.enqueueReplaceState(t, t.state, null);
      }
      function ta(e, t) {
        var l = t;
        if ("ref" in t) {
          l = {};
          for (var o in t)
            o !== "ref" && (l[o] = t[o]);
        }
        if (e = e.defaultProps) {
          l === t && (l = Os({}, l));
          for (var d in e)
            l[d] === void 0 && (l[d] = e[d]);
        }
        return l;
      }
      function fr(e, t) {
        try {
          var l = e.onUncaughtError;
          l(t.value, { componentStack: t.stack });
        } catch (o) {
          setTimeout(function() {
            throw o;
          });
        }
      }
      function Su(e, t, l) {
        try {
          var o = e.onCaughtError;
          o(l.value, {
            componentStack: l.stack,
            errorBoundary: t.tag === 1 ? t.stateNode : null
          });
        } catch (d) {
          setTimeout(function() {
            throw d;
          });
        }
      }
      function is(e, t, l) {
        return l = _n(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          fr(e, t);
        }, l;
      }
      function Eu(e) {
        return e = _n(e), e.tag = 3, e;
      }
      function zu(e, t, l, o) {
        var d = l.type.getDerivedStateFromError;
        if (typeof d == "function") {
          var p = o.value;
          e.payload = function() {
            return d(p);
          }, e.callback = function() {
            Su(t, l, o);
          };
        }
        var v = l.stateNode;
        v !== null && typeof v.componentDidCatch == "function" && (e.callback = function() {
          Su(t, l, o), typeof d != "function" && (Hn === null ? Hn = /* @__PURE__ */ new Set([this]) : Hn.add(this));
          var M = o.stack;
          this.componentDidCatch(o.value, {
            componentStack: M !== null ? M : ""
          });
        });
      }
      function eh(e, t, l, o, d) {
        if (l.flags |= 32768, o !== null && typeof o == "object" && typeof o.then == "function") {
          if (t = l.alternate, t !== null && Sa(
            t,
            l,
            d,
            !0
          ), l = Tt.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return Bt === null ? wr() : l.alternate === null && Le === 0 && (Le = 3), l.flags &= -257, l.flags |= 65536, l.lanes = d, o === Hr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? l.updateQueue = /* @__PURE__ */ new Set([o]) : t.add(o), Cs(e, o, d)), !1;
              case 22:
                return l.flags |= 65536, o === Hr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? (t = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([o])
                }, l.updateQueue = t) : (l = t.retryQueue, l === null ? t.retryQueue = /* @__PURE__ */ new Set([o]) : l.add(o)), Cs(e, o, d)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return Cs(e, o, d), wr(), !1;
        }
        if (Se)
          return t = Tt.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = d, o !== Fs && (e = Error(s(422), { cause: o }), nl(
            Q(e, l)
          ))) : (o !== Fs && (t = Error(s(423), {
            cause: o
          }), nl(
            Q(t, l)
          )), e = e.current.alternate, e.flags |= 65536, d &= -d, e.lanes |= d, o = Q(o, l), d = is(
            e.stateNode,
            o,
            d
          ), Li(e, d), Le !== 4 && (Le = 2)), !1;
        var p = Error(s(520), { cause: o });
        if (p = Q(p, l), Tl === null ? Tl = [p] : Tl.push(p), Le !== 4 && (Le = 2), t === null) return !0;
        o = Q(o, l), l = t;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, e = d & -d, l.lanes |= e, e = is(l.stateNode, o, e), Li(l, e), !1;
            case 1:
              if (t = l.type, p = l.stateNode, (l.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || p !== null && typeof p.componentDidCatch == "function" && (Hn === null || !Hn.has(
                p
              ))))
                return l.flags |= 65536, d &= -d, l.lanes |= d, d = Eu(d), zu(
                  d,
                  e,
                  l,
                  o
                ), Li(l, d), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function lt(e, t, l, o) {
        t.child = e === null ? pf(t, null, l, o) : da(
          t,
          e.child,
          l,
          o
        );
      }
      function Nu(e, t, l, o, d) {
        l = l.render;
        var p = t.ref;
        if ("ref" in o) {
          var v = {};
          for (var M in o)
            M !== "ref" && (v[M] = o[M]);
        } else v = o;
        return In(t), o = Zi(
          e,
          t,
          l,
          v,
          p,
          d
        ), M = Xi(), e !== null && !Ze ? (Ki(e, t, d), sn(e, t, d)) : (Se && M && K(t), t.flags |= 1, lt(e, t, o, d), t.child);
      }
      function Tu(e, t, l, o, d) {
        if (e === null) {
          var p = l.type;
          return typeof p == "function" && !As(p) && p.defaultProps === void 0 && l.compare === null ? (t.tag = 15, t.type = p, Cu(
            e,
            t,
            p,
            o,
            d
          )) : (e = _r(
            l.type,
            null,
            o,
            t,
            t.mode,
            d
          ), e.ref = t.ref, e.return = t, t.child = e);
        }
        if (p = e.child, !ps(e, d)) {
          var v = p.memoizedProps;
          if (l = l.compare, l = l !== null ? l : Pl, l(v, o) && e.ref === t.ref)
            return sn(
              e,
              t,
              d
            );
        }
        return t.flags |= 1, e = un(p, o), e.ref = t.ref, e.return = t, t.child = e;
      }
      function Cu(e, t, l, o, d) {
        if (e !== null) {
          var p = e.memoizedProps;
          if (Pl(p, o) && e.ref === t.ref)
            if (Ze = !1, t.pendingProps = o = p, ps(e, d))
              (e.flags & 131072) !== 0 && (Ze = !0);
            else
              return t.lanes = e.lanes, sn(e, t, d);
        }
        return ss(
          e,
          t,
          l,
          o,
          d
        );
      }
      function Au(e, t, l, o) {
        var d = o.children, p = e !== null ? e.memoizedState : null;
        if (e === null && t.stateNode === null && (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), o.mode === "hidden") {
          if ((t.flags & 128) !== 0) {
            if (p = p !== null ? p.baseLanes | l : l, e !== null) {
              for (o = t.child = e.child, d = 0; o !== null; )
                d = d | o.lanes | o.childLanes, o = o.sibling;
              o = d & ~p;
            } else o = 0, t.child = null;
            return Mu(
              e,
              t,
              p,
              l,
              o
            );
          }
          if ((l & 536870912) !== 0)
            t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && Il(
              t,
              p !== null ? p.cachePool : null
            ), p !== null ? qc(t, p) : Gi(), Lc(t);
          else
            return o = t.lanes = 536870912, Mu(
              e,
              t,
              p !== null ? p.baseLanes | l : l,
              l,
              o
            );
        } else
          p !== null ? (Il(t, p.cachePool), qc(t, p), zn(), t.memoizedState = null) : (e !== null && Il(t, null), Gi(), zn());
        return lt(e, t, d, l), t.child;
      }
      function ul(e, t) {
        return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), t.sibling;
      }
      function Mu(e, t, l, o, d) {
        var p = Bi();
        return p = p === null ? null : {
          parent: dn ? He._currentValue : He._currentValue2,
          pool: p
        }, t.memoizedState = {
          baseLanes: l,
          cachePool: p
        }, e !== null && Il(t, null), Gi(), Lc(t), e !== null && Sa(e, t, o, !0), t.childLanes = d, null;
      }
      function pr(e, t) {
        return t = hr(
          { mode: t.mode, children: t.children },
          e.mode
        ), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Ru(e, t, l) {
        return da(t, e.child, null, l), e = pr(
          t,
          t.pendingProps
        ), e.flags |= 2, kt(t), t.memoizedState = null, e;
      }
      function th(e, t, l) {
        var o = t.pendingProps, d = (t.flags & 128) !== 0;
        if (t.flags &= -129, e === null) {
          if (Se) {
            if (o.mode === "hidden")
              return e = pr(t, o), t.lanes = 536870912, ul(null, e);
            if (Qi(t), (e = Be) ? (e = kg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Mn !== null ? { id: It, overflow: Pt } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Cd(e), l.return = t, t.child = l, it = t, Be = null)) : e = null, e === null) throw he(t);
            return t.lanes = 536870912, null;
          }
          return pr(t, o);
        }
        var p = e.memoizedState;
        if (p !== null) {
          var v = p.dehydrated;
          if (Qi(t), d)
            if (t.flags & 256)
              t.flags &= -257, t = Ru(
                e,
                t,
                l
              );
            else if (t.memoizedState !== null)
              t.child = e.child, t.flags |= 128, t = null;
            else throw Error(s(558));
          else if (Ze || Sa(
            e,
            t,
            l,
            !1
          ), d = (l & e.childLanes) !== 0, Ze || d) {
            if (o = je, o !== null && (v = T(o, l), v !== 0 && v !== p.retryLane))
              throw p.retryLane = v, ea(e, v), vt(o, e, v), io;
            wr(), t = Ru(
              e,
              t,
              l
            );
          } else
            e = p.treeContext, ft && (Be = bg(v), it = t, Se = !0, jn = null, Ot = !1, e !== null && oe(t, e)), t = pr(t, o), t.flags |= 4096;
          return t;
        }
        return e = un(e.child, {
          mode: o.mode,
          children: o.children
        }), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function mr(e, t) {
        var l = t.ref;
        if (l === null)
          e !== null && e.ref !== null && (t.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (e === null || e.ref !== l) && (t.flags |= 4194816);
        }
      }
      function ss(e, t, l, o, d) {
        return In(t), l = Zi(
          e,
          t,
          l,
          o,
          void 0,
          d
        ), o = Xi(), e !== null && !Ze ? (Ki(e, t, d), sn(e, t, d)) : (Se && o && K(t), t.flags |= 1, lt(e, t, l, d), t.child);
      }
      function ju(e, t, l, o, d, p) {
        return In(t), t.updateQueue = null, l = Yc(
          t,
          o,
          l,
          d
        ), Gc(e), o = Xi(), e !== null && !Ze ? (Ki(e, t, p), sn(e, t, p)) : (Se && o && K(t), t.flags |= 1, lt(e, t, l, p), t.child);
      }
      function Ou(e, t, l, o, d) {
        if (In(t), t.stateNode === null) {
          var p = Da, v = l.contextType;
          typeof v == "object" && v !== null && (p = at(v)), p = new l(o, p), t.memoizedState = p.state !== null && p.state !== void 0 ? p.state : null, p.updater = ro, t.stateNode = p, p._reactInternals = t, p = t.stateNode, p.props = o, p.state = t.memoizedState, p.refs = {}, Ui(t), v = l.contextType, p.context = typeof v == "object" && v !== null ? at(v) : Da, p.state = t.memoizedState, v = l.getDerivedStateFromProps, typeof v == "function" && (rs(
            t,
            l,
            v,
            o
          ), p.state = t.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof p.getSnapshotBeforeUpdate == "function" || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (v = p.state, typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount(), v !== p.state && ro.enqueueReplaceState(
            p,
            p.state,
            null
          ), sl(t, o, p, d), il(), p.state = t.memoizedState), typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !0;
        } else if (e === null) {
          p = t.stateNode;
          var M = t.memoizedProps, Y = ta(l, M);
          p.props = Y;
          var $ = p.context, ne = l.contextType;
          v = Da, typeof ne == "object" && ne !== null && (v = at(ne));
          var P = l.getDerivedStateFromProps;
          ne = typeof P == "function" || typeof p.getSnapshotBeforeUpdate == "function", M = t.pendingProps !== M, ne || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (M || $ !== v) && _u(
            t,
            p,
            o,
            v
          ), On = !1;
          var le = t.memoizedState;
          p.state = le, sl(t, o, p, d), il(), $ = t.memoizedState, M || le !== $ || On ? (typeof P == "function" && (rs(
            t,
            l,
            P,
            o
          ), $ = t.memoizedState), (Y = On || ku(
            t,
            l,
            Y,
            o,
            le,
            $,
            v
          )) ? (ne || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount()), typeof p.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = o, t.memoizedState = $), p.props = o, p.state = $, p.context = v, o = Y) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !1);
        } else {
          p = t.stateNode, qi(e, t), v = t.memoizedProps, ne = ta(l, v), p.props = ne, P = t.pendingProps, le = p.context, $ = l.contextType, Y = Da, typeof $ == "object" && $ !== null && (Y = at($)), M = l.getDerivedStateFromProps, ($ = typeof M == "function" || typeof p.getSnapshotBeforeUpdate == "function") || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (v !== P || le !== Y) && _u(
            t,
            p,
            o,
            Y
          ), On = !1, le = t.memoizedState, p.state = le, sl(t, o, p, d), il();
          var ge = t.memoizedState;
          v !== P || le !== ge || On || e !== null && e.dependencies !== null && Wl(e.dependencies) ? (typeof M == "function" && (rs(
            t,
            l,
            M,
            o
          ), ge = t.memoizedState), (ne = On || ku(
            t,
            l,
            ne,
            o,
            le,
            ge,
            Y
          ) || e !== null && e.dependencies !== null && Wl(e.dependencies)) ? ($ || typeof p.UNSAFE_componentWillUpdate != "function" && typeof p.componentWillUpdate != "function" || (typeof p.componentWillUpdate == "function" && p.componentWillUpdate(o, ge, Y), typeof p.UNSAFE_componentWillUpdate == "function" && p.UNSAFE_componentWillUpdate(
            o,
            ge,
            Y
          )), typeof p.componentDidUpdate == "function" && (t.flags |= 4), typeof p.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof p.componentDidUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), t.memoizedProps = o, t.memoizedState = ge), p.props = o, p.state = ge, p.context = Y, o = ne) : (typeof p.componentDidUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), o = !1);
        }
        return p = o, mr(e, t), o = (t.flags & 128) !== 0, p || o ? (p = t.stateNode, l = o && typeof l.getDerivedStateFromError != "function" ? null : p.render(), t.flags |= 1, e !== null && o ? (t.child = da(
          t,
          e.child,
          null,
          d
        ), t.child = da(
          t,
          null,
          l,
          d
        )) : lt(e, t, l, d), t.memoizedState = p.state, e = t.child) : e = sn(
          e,
          t,
          d
        ), e;
      }
      function Du(e, t, l, o) {
        return Lt(), t.flags |= 256, lt(e, t, l, o), t.child;
      }
      function os(e) {
        return { baseLanes: e, cachePool: Ac() };
      }
      function cs(e, t, l) {
        return e = e !== null ? e.childLanes & ~l : 0, t && (e |= At), e;
      }
      function Bu(e, t, l) {
        var o = t.pendingProps, d = !1, p = (t.flags & 128) !== 0, v;
        if ((v = p) || (v = e !== null && e.memoizedState === null ? !1 : (Ye.current & 2) !== 0), v && (d = !0, t.flags &= -129), v = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
          if (Se) {
            if (d ? En(t) : zn(), (e = Be) ? (e = _g(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Mn !== null ? { id: It, overflow: Pt } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Cd(e), l.return = t, t.child = l, it = t, Be = null)) : e = null, e === null) throw he(t);
            return Vs(e) ? t.lanes = 32 : t.lanes = 536870912, null;
          }
          var M = o.children;
          return o = o.fallback, d ? (zn(), d = t.mode, M = hr(
            { mode: "hidden", children: M },
            d
          ), o = la(
            o,
            d,
            l,
            null
          ), M.return = t, o.return = t, M.sibling = o, t.child = M, o = t.child, o.memoizedState = os(l), o.childLanes = cs(
            e,
            v,
            l
          ), t.memoizedState = so, ul(null, o)) : (En(t), us(t, M));
        }
        var Y = e.memoizedState;
        if (Y !== null && (M = Y.dehydrated, M !== null)) {
          if (p)
            t.flags & 256 ? (En(t), t.flags &= -257, t = ds(
              e,
              t,
              l
            )) : t.memoizedState !== null ? (zn(), t.child = e.child, t.flags |= 128, t = null) : (zn(), M = o.fallback, d = t.mode, o = hr(
              { mode: "visible", children: o.children },
              d
            ), M = la(
              M,
              d,
              l,
              null
            ), M.flags |= 2, o.return = t, M.return = t, o.sibling = M, t.child = o, da(
              t,
              e.child,
              null,
              l
            ), o = t.child, o.memoizedState = os(l), o.childLanes = cs(
              e,
              v,
              l
            ), t.memoizedState = so, t = ul(null, o));
          else if (En(t), Vs(M))
            v = ug(M).digest, o = Error(s(419)), o.stack = "", o.digest = v, nl({ value: o, source: null, stack: null }), t = ds(
              e,
              t,
              l
            );
          else if (Ze || Sa(
            e,
            t,
            l,
            !1
          ), v = (l & e.childLanes) !== 0, Ze || v) {
            if (v = je, v !== null && (o = T(
              v,
              l
            ), o !== 0 && o !== Y.retryLane))
              throw Y.retryLane = o, ea(e, o), vt(v, e, o), io;
            Qs(M) || wr(), t = ds(
              e,
              t,
              l
            );
          } else
            Qs(M) ? (t.flags |= 192, t.child = e.child, t = null) : (e = Y.treeContext, ft && (Be = vg(
              M
            ), it = t, Se = !0, jn = null, Ot = !1, e !== null && oe(t, e)), t = us(
              t,
              o.children
            ), t.flags |= 4096);
          return t;
        }
        return d ? (zn(), M = o.fallback, d = t.mode, Y = e.child, p = Y.sibling, o = un(Y, {
          mode: "hidden",
          children: o.children
        }), o.subtreeFlags = Y.subtreeFlags & 65011712, p !== null ? M = un(
          p,
          M
        ) : (M = la(
          M,
          d,
          l,
          null
        ), M.flags |= 2), M.return = t, o.return = t, o.sibling = M, t.child = o, ul(null, o), o = t.child, M = e.child.memoizedState, M === null ? M = os(l) : (d = M.cachePool, d !== null ? (Y = dn ? He._currentValue : He._currentValue2, d = d.parent !== Y ? { parent: Y, pool: Y } : d) : d = Ac(), M = {
          baseLanes: M.baseLanes | l,
          cachePool: d
        }), o.memoizedState = M, o.childLanes = cs(
          e,
          v,
          l
        ), t.memoizedState = so, ul(e.child, o)) : (En(t), l = e.child, e = l.sibling, l = un(l, {
          mode: "visible",
          children: o.children
        }), l.return = t, l.sibling = null, e !== null && (v = t.deletions, v === null ? (t.deletions = [e], t.flags |= 16) : v.push(e)), t.child = l, t.memoizedState = null, l);
      }
      function us(e, t) {
        return t = hr(
          { mode: "visible", children: t },
          e.mode
        ), t.return = e, e.child = t;
      }
      function hr(e, t) {
        return e = r(22, e, null, t), e.lanes = 0, e;
      }
      function ds(e, t, l) {
        return da(t, e.child, null, l), e = us(
          t,
          t.pendingProps.children
        ), e.flags |= 2, t.memoizedState = null, e;
      }
      function Hu(e, t, l) {
        e.lanes |= t;
        var o = e.alternate;
        o !== null && (o.lanes |= t), Ri(e.return, t, l);
      }
      function fs(e, t, l, o, d, p) {
        var v = e.memoizedState;
        v === null ? e.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: o,
          tail: l,
          tailMode: d,
          treeForkCount: p
        } : (v.isBackwards = t, v.rendering = null, v.renderingStartTime = 0, v.last = o, v.tail = l, v.tailMode = d, v.treeForkCount = p);
      }
      function Uu(e, t, l) {
        var o = t.pendingProps, d = o.revealOrder, p = o.tail;
        o = o.children;
        var v = Ye.current, M = (v & 2) !== 0;
        if (M ? (v = v & 1 | 2, t.flags |= 128) : v &= 1, _(Ye, v), lt(e, t, o, l), o = Se ? wl : 0, !M && e !== null && (e.flags & 128) !== 0)
          e: for (e = t.child; e !== null; ) {
            if (e.tag === 13)
              e.memoizedState !== null && Hu(e, l, t);
            else if (e.tag === 19)
              Hu(e, l, t);
            else if (e.child !== null) {
              e.child.return = e, e = e.child;
              continue;
            }
            if (e === t) break e;
            for (; e.sibling === null; ) {
              if (e.return === null || e.return === t)
                break e;
              e = e.return;
            }
            e.sibling.return = e.return, e = e.sibling;
          }
        switch (d) {
          case "forwards":
            for (l = t.child, d = null; l !== null; )
              e = l.alternate, e !== null && rr(e) === null && (d = l), l = l.sibling;
            l = d, l === null ? (d = t.child, t.child = null) : (d = l.sibling, l.sibling = null), fs(
              t,
              !1,
              d,
              l,
              p,
              o
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (l = null, d = t.child, t.child = null; d !== null; ) {
              if (e = d.alternate, e !== null && rr(e) === null) {
                t.child = d;
                break;
              }
              e = d.sibling, d.sibling = l, l = d, d = e;
            }
            fs(
              t,
              !0,
              l,
              null,
              p,
              o
            );
            break;
          case "together":
            fs(
              t,
              !1,
              null,
              null,
              void 0,
              o
            );
            break;
          default:
            t.memoizedState = null;
        }
        return t.child;
      }
      function sn(e, t, l) {
        if (e !== null && (t.dependencies = e.dependencies), Bn |= t.lanes, (l & t.childLanes) === 0)
          if (e !== null) {
            if (Sa(
              e,
              t,
              l,
              !1
            ), (l & t.childLanes) === 0)
              return null;
          } else return null;
        if (e !== null && t.child !== e.child)
          throw Error(s(153));
        if (t.child !== null) {
          for (e = t.child, l = un(e, e.pendingProps), t.child = l, l.return = t; e.sibling !== null; )
            e = e.sibling, l = l.sibling = un(e, e.pendingProps), l.return = t;
          l.sibling = null;
        }
        return t.child;
      }
      function ps(e, t) {
        return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Wl(e)));
      }
      function nh(e, t, l) {
        switch (t.tag) {
          case 3:
            ce(
              t,
              t.stateNode.containerInfo
            ), kn(t, He, e.memoizedState.cache), Lt();
            break;
          case 27:
          case 5:
            Ee(t);
            break;
          case 4:
            ce(
              t,
              t.stateNode.containerInfo
            );
            break;
          case 10:
            kn(
              t,
              t.type,
              t.memoizedProps.value
            );
            break;
          case 31:
            if (t.memoizedState !== null)
              return t.flags |= 128, Qi(t), null;
            break;
          case 13:
            var o = t.memoizedState;
            if (o !== null)
              return o.dehydrated !== null ? (En(t), t.flags |= 128, null) : (l & t.child.childLanes) !== 0 ? Bu(
                e,
                t,
                l
              ) : (En(t), e = sn(
                e,
                t,
                l
              ), e !== null ? e.sibling : null);
            En(t);
            break;
          case 19:
            var d = (e.flags & 128) !== 0;
            if (o = (l & t.childLanes) !== 0, o || (Sa(
              e,
              t,
              l,
              !1
            ), o = (l & t.childLanes) !== 0), d) {
              if (o)
                return Uu(
                  e,
                  t,
                  l
                );
              t.flags |= 128;
            }
            if (d = t.memoizedState, d !== null && (d.rendering = null, d.tail = null, d.lastEffect = null), _(Ye, Ye.current), o) break;
            return null;
          case 22:
            return t.lanes = 0, Au(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            kn(t, He, e.memoizedState.cache);
        }
        return sn(e, t, l);
      }
      function qu(e, t, l) {
        if (e !== null)
          if (e.memoizedProps !== t.pendingProps)
            Ze = !0;
          else {
            if (!ps(e, l) && (t.flags & 128) === 0)
              return Ze = !1, nh(
                e,
                t,
                l
              );
            Ze = (e.flags & 131072) !== 0;
          }
        else
          Ze = !1, Se && (t.flags & 1048576) !== 0 && A(t, wl, t.index);
        switch (t.lanes = 0, t.tag) {
          case 16:
            e: {
              var o = t.pendingProps;
              if (e = Pn(t.elementType), t.type = e, typeof e == "function")
                As(e) ? (o = ta(e, o), t.tag = 1, t = Ou(
                  null,
                  t,
                  e,
                  o,
                  l
                )) : (t.tag = 0, t = ss(
                  null,
                  t,
                  e,
                  o,
                  l
                ));
              else {
                if (e != null) {
                  var d = e.$$typeof;
                  if (d === Bs) {
                    t.tag = 11, t = Nu(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  } else if (d === qs) {
                    t.tag = 14, t = Tu(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  }
                }
                throw t = g(e) || e, Error(s(306, t, ""));
              }
            }
            return t;
          case 0:
            return ss(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 1:
            return o = t.type, d = ta(
              o,
              t.pendingProps
            ), Ou(
              e,
              t,
              o,
              d,
              l
            );
          case 3:
            e: {
              if (ce(
                t,
                t.stateNode.containerInfo
              ), e === null) throw Error(s(387));
              var p = t.pendingProps;
              d = t.memoizedState, o = d.element, qi(e, t), sl(t, p, null, l);
              var v = t.memoizedState;
              if (p = v.cache, kn(t, He, p), p !== d.cache && ji(
                t,
                [He],
                l,
                !0
              ), il(), p = v.element, ft && d.isDehydrated)
                if (d = {
                  element: p,
                  isDehydrated: !1,
                  cache: v.cache
                }, t.updateQueue.baseState = d, t.memoizedState = d, t.flags & 256) {
                  t = Du(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else if (p !== o) {
                  o = Q(
                    Error(s(424)),
                    t
                  ), nl(o), t = Du(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else
                  for (ft && (Be = gg(
                    t.stateNode.containerInfo
                  ), it = t, Se = !0, jn = null, Ot = !0), l = pf(
                    t,
                    null,
                    p,
                    l
                  ), t.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (Lt(), p === o) {
                  t = sn(
                    e,
                    t,
                    l
                  );
                  break e;
                }
                lt(e, t, p, l);
              }
              t = t.child;
            }
            return t;
          case 26:
            if (Vt)
              return mr(e, t), e === null ? (l = Id(
                t.type,
                null,
                t.pendingProps,
                null
              )) ? t.memoizedState = l : Se || (t.stateNode = Qg(
                t.type,
                t.pendingProps,
                Rn.current,
                t
              )) : t.memoizedState = Id(
                t.type,
                e.memoizedProps,
                t.pendingProps,
                e.memoizedState
              ), null;
          case 27:
            if (We)
              return Ee(t), e === null && We && Se && (o = t.stateNode = lf(
                t.type,
                t.pendingProps,
                Rn.current,
                rt.current,
                !1
              ), it = t, Ot = !0, Be = yg(
                t.type,
                o,
                Be
              )), lt(
                e,
                t,
                t.pendingProps.children,
                l
              ), mr(e, t), e === null && (t.flags |= 4194304), t.child;
          case 5:
            return e === null && Se && (Lg(
              t.type,
              t.pendingProps,
              rt.current
            ), (d = o = Be) && (o = xg(
              o,
              t.type,
              t.pendingProps,
              Ot
            ), o !== null ? (t.stateNode = o, it = t, Be = hg(o), Ot = !1, d = !0) : d = !1), d || he(t)), Ee(t), d = t.type, p = t.pendingProps, v = e !== null ? e.memoizedProps : null, o = p.children, zr(d, p) ? o = null : v !== null && zr(d, v) && (t.flags |= 32), t.memoizedState !== null && (d = Zi(
              e,
              t,
              Jm,
              null,
              null,
              l
            ), dn ? ia._currentValue = d : ia._currentValue2 = d), mr(e, t), lt(e, t, o, l), t.child;
          case 6:
            return e === null && Se && (Gg(
              t.pendingProps,
              rt.current
            ), (e = l = Be) && (l = wg(
              l,
              t.pendingProps,
              Ot
            ), l !== null ? (t.stateNode = l, it = t, Be = null, e = !0) : e = !1), e || he(t)), null;
          case 13:
            return Bu(e, t, l);
          case 4:
            return ce(
              t,
              t.stateNode.containerInfo
            ), o = t.pendingProps, e === null ? t.child = da(
              t,
              null,
              o,
              l
            ) : lt(e, t, o, l), t.child;
          case 11:
            return Nu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 7:
            return lt(
              e,
              t,
              t.pendingProps,
              l
            ), t.child;
          case 8:
            return lt(
              e,
              t,
              t.pendingProps.children,
              l
            ), t.child;
          case 12:
            return lt(
              e,
              t,
              t.pendingProps.children,
              l
            ), t.child;
          case 10:
            return o = t.pendingProps, kn(t, t.type, o.value), lt(
              e,
              t,
              o.children,
              l
            ), t.child;
          case 9:
            return d = t.type._context, o = t.pendingProps.children, In(t), d = at(d), o = o(d), t.flags |= 1, lt(e, t, o, l), t.child;
          case 14:
            return Tu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 15:
            return Cu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 19:
            return Uu(
              e,
              t,
              l
            );
          case 31:
            return th(e, t, l);
          case 22:
            return Au(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            return In(t), o = at(He), e === null ? (d = Bi(), d === null && (d = je, p = Oi(), d.pooledCache = p, p.refCount++, p !== null && (d.pooledCacheLanes |= l), d = p), t.memoizedState = {
              parent: o,
              cache: d
            }, Ui(t), kn(t, He, d)) : ((e.lanes & l) !== 0 && (qi(e, t), sl(t, null, null, l), il()), d = e.memoizedState, p = t.memoizedState, d.parent !== o ? (d = { parent: o, cache: o }, t.memoizedState = d, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = d), kn(t, He, o)) : (o = p.cache, kn(t, He, o), o !== d.cache && ji(
              t,
              [He],
              l,
              !0
            ))), lt(
              e,
              t,
              t.pendingProps.children,
              l
            ), t.child;
          case 29:
            throw t.pendingProps;
        }
        throw Error(s(156, t.tag));
      }
      function Gt(e) {
        e.flags |= 4;
      }
      function gr(e) {
        Ft && (e.flags |= 8);
      }
      function Lu(e, t) {
        if (e !== null && e.child === t.child) return !1;
        if ((t.flags & 16) !== 0) return !0;
        for (e = t.child; e !== null; ) {
          if ((e.flags & 8218) !== 0 || (e.subtreeFlags & 8218) !== 0)
            return !0;
          e = e.sibling;
        }
        return !1;
      }
      function ms(e, t, l, o) {
        if (dt)
          for (l = t.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              Gs(e, l.stateNode);
            else if (!(l.tag === 4 || We && l.tag === 27) && l.child !== null) {
              l.child.return = l, l = l.child;
              continue;
            }
            if (l === t) break;
            for (; l.sibling === null; ) {
              if (l.return === null || l.return === t)
                return;
              l = l.return;
            }
            l.sibling.return = l.return, l = l.sibling;
          }
        else if (Ft)
          for (var d = t.child; d !== null; ) {
            if (d.tag === 5) {
              var p = d.stateNode;
              l && o && (p = Kd(
                p,
                d.type,
                d.memoizedProps
              )), Gs(e, p);
            } else if (d.tag === 6)
              p = d.stateNode, l && o && (p = Jd(
                p,
                d.memoizedProps
              )), Gs(e, p);
            else if (d.tag !== 4) {
              if (d.tag === 22 && d.memoizedState !== null)
                p = d.child, p !== null && (p.return = d), ms(e, d, !0, !0);
              else if (d.child !== null) {
                d.child.return = d, d = d.child;
                continue;
              }
            }
            if (d === t) break;
            for (; d.sibling === null; ) {
              if (d.return === null || d.return === t)
                return;
              d = d.return;
            }
            d.sibling.return = d.return, d = d.sibling;
          }
      }
      function Gu(e, t, l, o) {
        var d = !1;
        if (Ft)
          for (var p = t.child; p !== null; ) {
            if (p.tag === 5) {
              var v = p.stateNode;
              l && o && (v = Kd(
                v,
                p.type,
                p.memoizedProps
              )), Zd(e, v);
            } else if (p.tag === 6)
              v = p.stateNode, l && o && (v = Jd(
                v,
                p.memoizedProps
              )), Zd(e, v);
            else if (p.tag !== 4) {
              if (p.tag === 22 && p.memoizedState !== null)
                d = p.child, d !== null && (d.return = p), Gu(e, p, !0, !0), d = !0;
              else if (p.child !== null) {
                p.child.return = p, p = p.child;
                continue;
              }
            }
            if (p === t) break;
            for (; p.sibling === null; ) {
              if (p.return === null || p.return === t)
                return d;
              p = p.return;
            }
            p.sibling.return = p.return, p = p.sibling;
          }
        return d;
      }
      function Yu(e, t) {
        if (Ft && Lu(e, t)) {
          e = t.stateNode;
          var l = e.containerInfo, o = Vd();
          Gu(o, t, !1, !1), e.pendingChildren = o, Gt(t), cg(l, o);
        }
      }
      function hs(e, t, l, o) {
        if (dt)
          e.memoizedProps !== o && Gt(t);
        else if (Ft) {
          var d = e.stateNode, p = e.memoizedProps;
          if ((e = Lu(e, t)) || p !== o) {
            var v = rt.current;
            p = og(
              d,
              l,
              p,
              o,
              !e,
              null
            ), p === d ? t.stateNode = d : (gr(t), qd(
              p,
              l,
              o,
              v
            ) && Gt(t), t.stateNode = p, e && ms(p, t, !1, !1));
          } else t.stateNode = d;
        }
      }
      function gs(e, t, l, o, d) {
        if ((e.mode & 32) !== 0 && (l === null ? Dh(t, o) : Bh(t, l, o))) {
          if (e.flags |= 16777216, (d & 335544128) === d || Ys(t, o))
            if (Gd(e.stateNode, t, o))
              e.flags |= 8192;
            else if (md()) e.flags |= 8192;
            else
              throw ua = Hr, to;
        } else e.flags &= -16777217;
      }
      function Qu(e, t) {
        if (Zg(t)) {
          if (e.flags |= 16777216, !af(t))
            if (md()) e.flags |= 8192;
            else
              throw ua = Hr, to;
        } else e.flags &= -16777217;
      }
      function br(e, t) {
        t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? X() : 536870912, e.lanes |= t, Wa |= t);
      }
      function dl(e, t) {
        if (!Se)
          switch (e.tailMode) {
            case "hidden":
              t = e.tail;
              for (var l = null; t !== null; )
                t.alternate !== null && (l = t), t = t.sibling;
              l === null ? e.tail = null : l.sibling = null;
              break;
            case "collapsed":
              l = e.tail;
              for (var o = null; l !== null; )
                l.alternate !== null && (o = l), l = l.sibling;
              o === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : o.sibling = null;
          }
      }
      function De(e) {
        var t = e.alternate !== null && e.alternate.child === e.child, l = 0, o = 0;
        if (t)
          for (var d = e.child; d !== null; )
            l |= d.lanes | d.childLanes, o |= d.subtreeFlags & 65011712, o |= d.flags & 65011712, d.return = e, d = d.sibling;
        else
          for (d = e.child; d !== null; )
            l |= d.lanes | d.childLanes, o |= d.subtreeFlags, o |= d.flags, d.return = e, d = d.sibling;
        return e.subtreeFlags |= o, e.childLanes = l, t;
      }
      function ah(e, t, l) {
        var o = t.pendingProps;
        switch (ae(t), t.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return De(t), null;
          case 1:
            return De(t), null;
          case 3:
            return l = t.stateNode, o = null, e !== null && (o = e.memoizedState.cache), t.memoizedState.cache !== o && (t.flags |= 2048), ln(He), ue(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (e === null || e.child === null) && (qt(t) ? Gt(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, wn())), Yu(e, t), De(t), null;
          case 26:
            if (Vt) {
              var d = t.type, p = t.memoizedState;
              return e === null ? (Gt(t), p !== null ? (De(t), Qu(
                t,
                p
              )) : (De(t), gs(
                t,
                d,
                null,
                o,
                l
              ))) : p ? p !== e.memoizedState ? (Gt(t), De(t), Qu(
                t,
                p
              )) : (De(t), t.flags &= -16777217) : (p = e.memoizedProps, dt ? p !== o && Gt(t) : hs(
                e,
                t,
                d,
                o
              ), De(t), gs(
                t,
                d,
                p,
                o,
                l
              )), null;
            }
          case 27:
            if (We) {
              if (Pe(t), l = Rn.current, d = t.type, e !== null && t.stateNode != null)
                dt ? e.memoizedProps !== o && Gt(t) : hs(e, t, d, o);
              else {
                if (!o) {
                  if (t.stateNode === null)
                    throw Error(s(166));
                  return De(t), null;
                }
                e = rt.current, qt(t) ? $n(t, e) : (e = lf(
                  d,
                  o,
                  l,
                  e,
                  !0
                ), t.stateNode = e, Gt(t));
              }
              return De(t), null;
            }
          case 5:
            if (Pe(t), d = t.type, e !== null && t.stateNode != null)
              hs(e, t, d, o);
            else {
              if (!o) {
                if (t.stateNode === null)
                  throw Error(s(166));
                return De(t), null;
              }
              if (p = rt.current, qt(t))
                $n(t, p), Og(
                  t.stateNode,
                  d,
                  o,
                  p
                ) && (t.flags |= 64);
              else {
                var v = Nh(
                  d,
                  o,
                  Rn.current,
                  p,
                  t
                );
                gr(t), ms(v, t, !1, !1), t.stateNode = v, qd(
                  v,
                  d,
                  o,
                  p
                ) && Gt(t);
              }
            }
            return De(t), gs(
              t,
              t.type,
              e === null ? null : e.memoizedProps,
              t.pendingProps,
              l
            ), null;
          case 6:
            if (e && t.stateNode != null)
              l = e.memoizedProps, dt ? l !== o && Gt(t) : Ft && (l !== o ? (e = Rn.current, l = rt.current, gr(t), t.stateNode = Ld(
                o,
                e,
                l,
                t
              )) : t.stateNode = e.stateNode);
            else {
              if (typeof o != "string" && t.stateNode === null)
                throw Error(s(166));
              if (e = Rn.current, l = rt.current, qt(t)) {
                if (!ft) throw Error(s(176));
                if (e = t.stateNode, l = t.memoizedProps, o = null, d = it, d !== null)
                  switch (d.tag) {
                    case 27:
                    case 5:
                      o = d.memoizedProps;
                  }
                Eg(
                  e,
                  l,
                  t,
                  o
                ) || he(t, !0);
              } else
                gr(t), t.stateNode = Ld(
                  o,
                  e,
                  l,
                  t
                );
            }
            return De(t), null;
          case 31:
            if (l = t.memoizedState, e === null || e.memoizedState !== null) {
              if (o = qt(t), l !== null) {
                if (e === null) {
                  if (!o) throw Error(s(318));
                  if (!ft) throw Error(s(556));
                  if (e = t.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(557));
                  zg(e, t);
                } else
                  Lt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                De(t), e = !1;
              } else
                l = wn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = l), e = !0;
              if (!e)
                return t.flags & 256 ? (kt(t), t) : (kt(t), null);
              if ((t.flags & 128) !== 0)
                throw Error(s(558));
            }
            return De(t), null;
          case 13:
            if (o = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
              if (d = qt(t), o !== null && o.dehydrated !== null) {
                if (e === null) {
                  if (!d) throw Error(s(318));
                  if (!ft) throw Error(s(344));
                  if (d = t.memoizedState, d = d !== null ? d.dehydrated : null, !d) throw Error(s(317));
                  Ng(d, t);
                } else
                  Lt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                De(t), d = !1;
              } else
                d = wn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = d), d = !0;
              if (!d)
                return t.flags & 256 ? (kt(t), t) : (kt(t), null);
            }
            return kt(t), (t.flags & 128) !== 0 ? (t.lanes = l, t) : (l = o !== null, e = e !== null && e.memoizedState !== null, l && (o = t.child, d = null, o.alternate !== null && o.alternate.memoizedState !== null && o.alternate.memoizedState.cachePool !== null && (d = o.alternate.memoizedState.cachePool.pool), p = null, o.memoizedState !== null && o.memoizedState.cachePool !== null && (p = o.memoizedState.cachePool.pool), p !== d && (o.flags |= 2048)), l !== e && l && (t.child.flags |= 8192), br(t, t.updateQueue), De(t), null);
          case 4:
            return ue(), Yu(e, t), e === null && Mh(t.stateNode.containerInfo), De(t), null;
          case 10:
            return ln(t.type), De(t), null;
          case 19:
            if (E(Ye), o = t.memoizedState, o === null) return De(t), null;
            if (d = (t.flags & 128) !== 0, p = o.rendering, p === null)
              if (d) dl(o, !1);
              else {
                if (Le !== 0 || e !== null && (e.flags & 128) !== 0)
                  for (e = t.child; e !== null; ) {
                    if (p = rr(e), p !== null) {
                      for (t.flags |= 128, dl(o, !1), e = p.updateQueue, t.updateQueue = e, br(t, e), t.subtreeFlags = 0, e = l, l = t.child; l !== null; )
                        Td(l, e), l = l.sibling;
                      return _(
                        Ye,
                        Ye.current & 1 | 2
                      ), Se && Z(t, o.treeForkCount), t.child;
                    }
                    e = e.sibling;
                  }
                o.tail !== null && yt() > Cl && (t.flags |= 128, d = !0, dl(o, !1), t.lanes = 4194304);
              }
            else {
              if (!d)
                if (e = rr(p), e !== null) {
                  if (t.flags |= 128, d = !0, e = e.updateQueue, t.updateQueue = e, br(t, e), dl(o, !0), o.tail === null && o.tailMode === "hidden" && !p.alternate && !Se)
                    return De(t), null;
                } else
                  2 * yt() - o.renderingStartTime > Cl && l !== 536870912 && (t.flags |= 128, d = !0, dl(o, !1), t.lanes = 4194304);
              o.isBackwards ? (p.sibling = t.child, t.child = p) : (e = o.last, e !== null ? e.sibling = p : t.child = p, o.last = p);
            }
            return o.tail !== null ? (e = o.tail, o.rendering = e, o.tail = e.sibling, o.renderingStartTime = yt(), e.sibling = null, l = Ye.current, _(
              Ye,
              d ? l & 1 | 2 : l & 1
            ), Se && Z(t, o.treeForkCount), e) : (De(t), null);
          case 22:
          case 23:
            return kt(t), Yi(), o = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== o && (t.flags |= 8192) : o && (t.flags |= 8192), o ? (l & 536870912) !== 0 && (t.flags & 128) === 0 && (De(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : De(t), l = t.updateQueue, l !== null && br(t, l.retryQueue), l = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), o = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (o = t.memoizedState.cachePool.pool), o !== l && (t.flags |= 2048), e !== null && E(ca), null;
          case 24:
            return l = null, e !== null && (l = e.memoizedState.cache), t.memoizedState.cache !== l && (t.flags |= 2048), ln(He), De(t), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, t.tag));
      }
      function lh(e, t) {
        switch (ae(t), t.tag) {
          case 1:
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 3:
            return ln(He), ue(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
          case 26:
          case 27:
          case 5:
            return Pe(t), null;
          case 31:
            if (t.memoizedState !== null) {
              if (kt(t), t.alternate === null)
                throw Error(s(340));
              Lt();
            }
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 13:
            if (kt(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
              if (t.alternate === null)
                throw Error(s(340));
              Lt();
            }
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 19:
            return E(Ye), null;
          case 4:
            return ue(), null;
          case 10:
            return ln(t.type), null;
          case 22:
          case 23:
            return kt(t), Yi(), e !== null && E(ca), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 24:
            return ln(He), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Vu(e, t) {
        switch (ae(t), t.tag) {
          case 3:
            ln(He), ue();
            break;
          case 26:
          case 27:
          case 5:
            Pe(t);
            break;
          case 4:
            ue();
            break;
          case 31:
            t.memoizedState !== null && kt(t);
            break;
          case 13:
            kt(t);
            break;
          case 19:
            E(Ye);
            break;
          case 10:
            ln(t.type);
            break;
          case 22:
          case 23:
            kt(t), Yi(), e !== null && E(ca);
            break;
          case 24:
            ln(He);
        }
      }
      function fl(e, t) {
        try {
          var l = t.updateQueue, o = l !== null ? l.lastEffect : null;
          if (o !== null) {
            var d = o.next;
            l = d;
            do {
              if ((l.tag & e) === e) {
                o = void 0;
                var p = l.create, v = l.inst;
                o = p(), v.destroy = o;
              }
              l = l.next;
            } while (l !== d);
          }
        } catch (M) {
          Ne(t, t.return, M);
        }
      }
      function Nn(e, t, l) {
        try {
          var o = t.updateQueue, d = o !== null ? o.lastEffect : null;
          if (d !== null) {
            var p = d.next;
            o = p;
            do {
              if ((o.tag & e) === e) {
                var v = o.inst, M = v.destroy;
                if (M !== void 0) {
                  v.destroy = void 0, d = t;
                  var Y = l, $ = M;
                  try {
                    $();
                  } catch (ne) {
                    Ne(
                      d,
                      Y,
                      ne
                    );
                  }
                }
              }
              o = o.next;
            } while (o !== p);
          }
        } catch (ne) {
          Ne(t, t.return, ne);
        }
      }
      function Zu(e) {
        var t = e.updateQueue;
        if (t !== null) {
          var l = e.stateNode;
          try {
            Uc(t, l);
          } catch (o) {
            Ne(e, e.return, o);
          }
        }
      }
      function Xu(e, t, l) {
        l.props = ta(
          e.type,
          e.memoizedProps
        ), l.state = e.memoizedState;
        try {
          l.componentWillUnmount();
        } catch (o) {
          Ne(e, t, o);
        }
      }
      function pl(e, t) {
        try {
          var l = e.ref;
          if (l !== null) {
            switch (e.tag) {
              case 26:
              case 27:
              case 5:
                var o = bl(e.stateNode);
                break;
              case 30:
                o = e.stateNode;
                break;
              default:
                o = e.stateNode;
            }
            typeof l == "function" ? e.refCleanup = l(o) : l.current = o;
          }
        } catch (d) {
          Ne(e, t, d);
        }
      }
      function $t(e, t) {
        var l = e.ref, o = e.refCleanup;
        if (l !== null)
          if (typeof o == "function")
            try {
              o();
            } catch (d) {
              Ne(e, t, d);
            } finally {
              e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
            }
          else if (typeof l == "function")
            try {
              l(null);
            } catch (d) {
              Ne(e, t, d);
            }
          else l.current = null;
      }
      function Ku(e) {
        var t = e.type, l = e.memoizedProps, o = e.stateNode;
        try {
          Fh(o, t, l, e);
        } catch (d) {
          Ne(e, e.return, d);
        }
      }
      function bs(e, t, l) {
        try {
          Ih(
            e.stateNode,
            e.type,
            l,
            t,
            e
          );
        } catch (o) {
          Ne(e, e.return, o);
        }
      }
      function Ju(e) {
        return e.tag === 5 || e.tag === 3 || (Vt ? e.tag === 26 : !1) || (We ? e.tag === 27 && ja(e.type) : !1) || e.tag === 4;
      }
      function vs(e) {
        e: for (; ; ) {
          for (; e.sibling === null; ) {
            if (e.return === null || Ju(e.return)) return null;
            e = e.return;
          }
          for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
            if (We && e.tag === 27 && ja(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
            e.child.return = e, e = e.child;
          }
          if (!(e.flags & 2)) return e.stateNode;
        }
      }
      function ys(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? eg(l, e, t) : Wh(l, e);
        else if (o !== 4 && (We && o === 27 && ja(e.type) && (l = e.stateNode, t = null), e = e.child, e !== null))
          for (ys(e, t, l), e = e.sibling; e !== null; )
            ys(e, t, l), e = e.sibling;
      }
      function vr(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? Ph(l, e, t) : Jh(l, e);
        else if (o !== 4 && (We && o === 27 && ja(e.type) && (l = e.stateNode), e = e.child, e !== null))
          for (vr(e, t, l), e = e.sibling; e !== null; )
            vr(e, t, l), e = e.sibling;
      }
      function Wu(e, t, l) {
        e = e.containerInfo;
        try {
          Xd(e, l);
        } catch (o) {
          Ne(t, t.return, o);
        }
      }
      function $u(e) {
        var t = e.stateNode, l = e.memoizedProps;
        try {
          Kg(
            e.type,
            l,
            t,
            e
          );
        } catch (o) {
          Ne(e, e.return, o);
        }
      }
      function rh(e, t) {
        for (Eh(e.containerInfo), tt = t; tt !== null; )
          if (e = tt, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null)
            t.return = e, tt = t;
          else
            for (; tt !== null; ) {
              e = tt;
              var l = e.alternate;
              switch (t = e.flags, e.tag) {
                case 0:
                  if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null))
                    for (var o = 0; o < t.length; o++) {
                      var d = t[o];
                      d.ref.impl = d.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((t & 1024) !== 0 && l !== null) {
                    t = void 0, o = e, d = l.memoizedProps, l = l.memoizedState;
                    var p = o.stateNode;
                    try {
                      var v = ta(
                        o.type,
                        d
                      );
                      t = p.getSnapshotBeforeUpdate(
                        v,
                        l
                      ), p.__reactInternalSnapshotBeforeUpdate = t;
                    } catch (M) {
                      Ne(o, o.return, M);
                    }
                  }
                  break;
                case 3:
                  (t & 1024) !== 0 && dt && sg(e.stateNode.containerInfo);
                  break;
                case 5:
                case 26:
                case 27:
                case 6:
                case 4:
                case 17:
                  break;
                default:
                  if ((t & 1024) !== 0)
                    throw Error(s(163));
              }
              if (t = e.sibling, t !== null) {
                t.return = e.return, tt = t;
                break;
              }
              tt = e.return;
            }
      }
      function Fu(e, t, l) {
        var o = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            on(e, l), o & 4 && fl(5, l);
            break;
          case 1:
            if (on(e, l), o & 4)
              if (e = l.stateNode, t === null)
                try {
                  e.componentDidMount();
                } catch (v) {
                  Ne(l, l.return, v);
                }
              else {
                var d = ta(
                  l.type,
                  t.memoizedProps
                );
                t = t.memoizedState;
                try {
                  e.componentDidUpdate(
                    d,
                    t,
                    e.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (v) {
                  Ne(
                    l,
                    l.return,
                    v
                  );
                }
              }
            o & 64 && Zu(l), o & 512 && pl(l, l.return);
            break;
          case 3:
            if (on(e, l), o & 64 && (o = l.updateQueue, o !== null)) {
              if (e = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    e = bl(l.child.stateNode);
                    break;
                  case 1:
                    e = l.child.stateNode;
                }
              try {
                Uc(o, e);
              } catch (v) {
                Ne(l, l.return, v);
              }
            }
            break;
          case 27:
            We && t === null && o & 4 && $u(l);
          case 26:
          case 5:
            if (on(e, l), t === null) {
              if (o & 4) Ku(l);
              else if (o & 64) {
                e = l.type, t = l.memoizedProps, d = l.stateNode;
                try {
                  Ag(
                    d,
                    e,
                    t,
                    l
                  );
                } catch (v) {
                  Ne(l, l.return, v);
                }
              }
            }
            o & 512 && pl(l, l.return);
            break;
          case 12:
            on(e, l);
            break;
          case 31:
            on(e, l), o & 4 && Pu(e, l);
            break;
          case 13:
            on(e, l), o & 4 && ed(e, l), o & 64 && (o = l.memoizedState, o !== null && (o = o.dehydrated, o !== null && (l = fh.bind(
              null,
              l
            ), dg(o, l))));
            break;
          case 22:
            if (o = l.memoizedState !== null || hn, !o) {
              t = t !== null && t.memoizedState !== null || Xe, d = hn;
              var p = Xe;
              hn = o, (Xe = t) && !p ? cn(
                e,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : on(e, l), hn = d, Xe = p;
            }
            break;
          case 30:
            break;
          default:
            on(e, l);
        }
      }
      function Iu(e) {
        var t = e.alternate;
        t !== null && (e.alternate = null, Iu(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Oh(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
      }
      function Yt(e, t, l) {
        for (l = l.child; l !== null; )
          xs(
            e,
            t,
            l
          ), l = l.sibling;
      }
      function xs(e, t, l) {
        if (zt && typeof zt.onCommitFiberUnmount == "function")
          try {
            zt.onCommitFiberUnmount(xl, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Vt) {
              Xe || $t(l, t), Yt(
                e,
                t,
                l
              ), l.memoizedState ? ef(l.memoizedState) : l.stateNode && nf(l.stateNode);
              break;
            }
          case 27:
            if (We) {
              Xe || $t(l, t);
              var o = Ke, d = xt;
              ja(l.type) && (Ke = l.stateNode, xt = !1), Yt(
                e,
                t,
                l
              ), rf(l.stateNode), Ke = o, xt = d;
              break;
            }
          case 5:
            Xe || $t(l, t);
          case 6:
            if (dt) {
              if (o = Ke, d = xt, Ke = null, Yt(
                e,
                t,
                l
              ), Ke = o, xt = d, Ke !== null)
                if (xt)
                  try {
                    ng(Ke, l.stateNode);
                  } catch (p) {
                    Ne(
                      l,
                      t,
                      p
                    );
                  }
                else
                  try {
                    tg(Ke, l.stateNode);
                  } catch (p) {
                    Ne(
                      l,
                      t,
                      p
                    );
                  }
            } else
              Yt(
                e,
                t,
                l
              );
            break;
          case 18:
            dt && Ke !== null && (xt ? Hg(
              Ke,
              l.stateNode
            ) : Bg(Ke, l.stateNode));
            break;
          case 4:
            dt ? (o = Ke, d = xt, Ke = l.stateNode.containerInfo, xt = !0, Yt(
              e,
              t,
              l
            ), Ke = o, xt = d) : (Ft && Wu(
              l.stateNode,
              l,
              Vd()
            ), Yt(
              e,
              t,
              l
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            Nn(2, l, t), Xe || Nn(4, l, t), Yt(
              e,
              t,
              l
            );
            break;
          case 1:
            Xe || ($t(l, t), o = l.stateNode, typeof o.componentWillUnmount == "function" && Xu(
              l,
              t,
              o
            )), Yt(
              e,
              t,
              l
            );
            break;
          case 21:
            Yt(
              e,
              t,
              l
            );
            break;
          case 22:
            Xe = (o = Xe) || l.memoizedState !== null, Yt(
              e,
              t,
              l
            ), Xe = o;
            break;
          default:
            Yt(
              e,
              t,
              l
            );
        }
      }
      function Pu(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
          e = e.dehydrated;
          try {
            Rg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
        }
      }
      function ed(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
          try {
            jg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
      }
      function ih(e) {
        switch (e.tag) {
          case 31:
          case 13:
          case 19:
            var t = e.stateNode;
            return t === null && (t = e.stateNode = new gf()), t;
          case 22:
            return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new gf()), t;
          default:
            throw Error(s(435, e.tag));
        }
      }
      function yr(e, t) {
        var l = ih(e);
        t.forEach(function(o) {
          if (!l.has(o)) {
            l.add(o);
            var d = ph.bind(null, e, o);
            o.then(d, d);
          }
        });
      }
      function ut(e, t) {
        var l = t.deletions;
        if (l !== null)
          for (var o = 0; o < l.length; o++) {
            var d = l[o], p = e, v = t;
            if (dt) {
              var M = v;
              e: for (; M !== null; ) {
                switch (M.tag) {
                  case 27:
                    if (We) {
                      if (ja(M.type)) {
                        Ke = M.stateNode, xt = !1;
                        break e;
                      }
                      break;
                    }
                  case 5:
                    Ke = M.stateNode, xt = !1;
                    break e;
                  case 3:
                  case 4:
                    Ke = M.stateNode.containerInfo, xt = !0;
                    break e;
                }
                M = M.return;
              }
              if (Ke === null) throw Error(s(160));
              xs(p, v, d), Ke = null, xt = !1;
            } else xs(p, v, d);
            p = d.alternate, p !== null && (p.return = null), d.return = null;
          }
        if (t.subtreeFlags & 13886)
          for (t = t.child; t !== null; )
            td(t, e), t = t.sibling;
      }
      function td(e, t) {
        var l = e.alternate, o = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ut(t, e), gt(e), o & 4 && (Nn(3, e, e.return), fl(3, e), Nn(5, e, e.return));
            break;
          case 1:
            ut(t, e), gt(e), o & 512 && (Xe || l === null || $t(l, l.return)), o & 64 && hn && (e = e.updateQueue, e !== null && (o = e.callbacks, o !== null && (l = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = l === null ? o : l.concat(o))));
            break;
          case 26:
            if (Vt) {
              var d = Zt;
              if (ut(t, e), gt(e), o & 512 && (Xe || l === null || $t(l, l.return)), o & 4) {
                o = l !== null ? l.memoizedState : null;
                var p = e.memoizedState;
                l === null ? p === null ? e.stateNode === null ? e.stateNode = Yg(
                  d,
                  e.type,
                  e.memoizedProps,
                  e
                ) : tf(
                  d,
                  e.type,
                  e.stateNode
                ) : e.stateNode = Pd(
                  d,
                  p,
                  e.memoizedProps
                ) : o !== p ? (o === null ? l.stateNode !== null && nf(l.stateNode) : ef(o), p === null ? tf(
                  d,
                  e.type,
                  e.stateNode
                ) : Pd(
                  d,
                  p,
                  e.memoizedProps
                )) : p === null && e.stateNode !== null && bs(
                  e,
                  e.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (We) {
              ut(t, e), gt(e), o & 512 && (Xe || l === null || $t(l, l.return)), l !== null && o & 4 && bs(
                e,
                e.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (ut(t, e), gt(e), o & 512 && (Xe || l === null || $t(l, l.return)), dt) {
              if (e.flags & 32) {
                d = e.stateNode;
                try {
                  Qd(d);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
              o & 4 && e.stateNode != null && (d = e.memoizedProps, bs(
                e,
                d,
                l !== null ? l.memoizedProps : d
              )), o & 1024 && (oo = !0);
            } else
              Ft && e.alternate !== null && (e.alternate.stateNode = e.stateNode);
            break;
          case 6:
            if (ut(t, e), gt(e), o & 4 && dt) {
              if (e.stateNode === null)
                throw Error(s(162));
              o = e.memoizedProps, l = l !== null ? l.memoizedProps : o, d = e.stateNode;
              try {
                $h(d, l, o);
              } catch (P) {
                Ne(e, e.return, P);
              }
            }
            break;
          case 3:
            if (Vt ? (Vg(), d = Zt, Zt = Zs(t.containerInfo), ut(t, e), Zt = d) : ut(t, e), gt(e), o & 4) {
              if (dt && ft && l !== null && l.memoizedState.isDehydrated)
                try {
                  Mg(t.containerInfo);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              if (Ft) {
                o = t.containerInfo, l = t.pendingChildren;
                try {
                  Xd(o, l);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
            }
            oo && (oo = !1, nd(e));
            break;
          case 4:
            Vt ? (l = Zt, Zt = Zs(
              e.stateNode.containerInfo
            ), ut(t, e), gt(e), Zt = l) : (ut(t, e), gt(e)), o & 4 && Ft && Wu(
              e.stateNode,
              e,
              e.stateNode.pendingChildren
            );
            break;
          case 12:
            ut(t, e), gt(e);
            break;
          case 31:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, yr(e, o)));
            break;
          case 13:
            ut(t, e), gt(e), e.child.flags & 8192 && e.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Xr = yt()), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, yr(e, o)));
            break;
          case 22:
            d = e.memoizedState !== null;
            var v = l !== null && l.memoizedState !== null, M = hn, Y = Xe;
            if (hn = M || d, Xe = Y || v, ut(t, e), Xe = Y, hn = M, gt(e), o & 8192 && (t = e.stateNode, t._visibility = d ? t._visibility & -2 : t._visibility | 1, d && (l === null || v || hn || Xe || na(e)), dt)) {
              e: if (l = null, dt)
                for (t = e; ; ) {
                  if (t.tag === 5 || Vt && t.tag === 26) {
                    if (l === null) {
                      v = l = t;
                      try {
                        p = v.stateNode, d ? ag(p) : rg(
                          v.stateNode,
                          v.memoizedProps
                        );
                      } catch (P) {
                        Ne(v, v.return, P);
                      }
                    }
                  } else if (t.tag === 6) {
                    if (l === null) {
                      v = t;
                      try {
                        var $ = v.stateNode;
                        d ? lg($) : ig($, v.memoizedProps);
                      } catch (P) {
                        Ne(v, v.return, P);
                      }
                    }
                  } else if (t.tag === 18) {
                    if (l === null) {
                      v = t;
                      try {
                        var ne = v.stateNode;
                        d ? Ug(ne) : qg(v.stateNode);
                      } catch (P) {
                        Ne(v, v.return, P);
                      }
                    }
                  } else if ((t.tag !== 22 && t.tag !== 23 || t.memoizedState === null || t === e) && t.child !== null) {
                    t.child.return = t, t = t.child;
                    continue;
                  }
                  if (t === e) break e;
                  for (; t.sibling === null; ) {
                    if (t.return === null || t.return === e)
                      break e;
                    l === t && (l = null), t = t.return;
                  }
                  l === t && (l = null), t.sibling.return = t.return, t = t.sibling;
                }
            }
            o & 4 && (o = e.updateQueue, o !== null && (l = o.retryQueue, l !== null && (o.retryQueue = null, yr(e, l))));
            break;
          case 19:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, yr(e, o)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            ut(t, e), gt(e);
        }
      }
      function gt(e) {
        var t = e.flags;
        if (t & 2) {
          try {
            for (var l, o = e.return; o !== null; ) {
              if (Ju(o)) {
                l = o;
                break;
              }
              o = o.return;
            }
            if (dt) {
              if (l == null) throw Error(s(160));
              switch (l.tag) {
                case 27:
                  if (We) {
                    var d = l.stateNode, p = vs(e);
                    vr(e, p, d);
                    break;
                  }
                case 5:
                  var v = l.stateNode;
                  l.flags & 32 && (Qd(v), l.flags &= -33);
                  var M = vs(e);
                  vr(e, M, v);
                  break;
                case 3:
                case 4:
                  var Y = l.stateNode.containerInfo, $ = vs(e);
                  ys(
                    e,
                    $,
                    Y
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (ne) {
            Ne(e, e.return, ne);
          }
          e.flags &= -3;
        }
        t & 4096 && (e.flags &= -4097);
      }
      function nd(e) {
        if (e.subtreeFlags & 1024)
          for (e = e.child; e !== null; ) {
            var t = e;
            nd(t), t.tag === 5 && t.flags & 1024 && qh(t.stateNode), e = e.sibling;
          }
      }
      function on(e, t) {
        if (t.subtreeFlags & 8772)
          for (t = t.child; t !== null; )
            Fu(e, t.alternate, t), t = t.sibling;
      }
      function na(e) {
        for (e = e.child; e !== null; ) {
          var t = e;
          switch (t.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              Nn(4, t, t.return), na(t);
              break;
            case 1:
              $t(t, t.return);
              var l = t.stateNode;
              typeof l.componentWillUnmount == "function" && Xu(
                t,
                t.return,
                l
              ), na(t);
              break;
            case 27:
              We && rf(t.stateNode);
            case 26:
            case 5:
              $t(t, t.return), na(t);
              break;
            case 22:
              t.memoizedState === null && na(t);
              break;
            case 30:
              na(t);
              break;
            default:
              na(t);
          }
          e = e.sibling;
        }
      }
      function cn(e, t, l) {
        for (l = l && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; ) {
          var o = t.alternate, d = e, p = t, v = p.flags;
          switch (p.tag) {
            case 0:
            case 11:
            case 15:
              cn(
                d,
                p,
                l
              ), fl(4, p);
              break;
            case 1:
              if (cn(
                d,
                p,
                l
              ), o = p, d = o.stateNode, typeof d.componentDidMount == "function")
                try {
                  d.componentDidMount();
                } catch ($) {
                  Ne(o, o.return, $);
                }
              if (o = p, d = o.updateQueue, d !== null) {
                var M = o.stateNode;
                try {
                  var Y = d.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (d.shared.hiddenCallbacks = null, d = 0; d < Y.length; d++)
                      Hc(Y[d], M);
                } catch ($) {
                  Ne(o, o.return, $);
                }
              }
              l && v & 64 && Zu(p), pl(p, p.return);
              break;
            case 27:
              We && $u(p);
            case 26:
            case 5:
              cn(
                d,
                p,
                l
              ), l && o === null && v & 4 && Ku(p), pl(p, p.return);
              break;
            case 12:
              cn(
                d,
                p,
                l
              );
              break;
            case 31:
              cn(
                d,
                p,
                l
              ), l && v & 4 && Pu(d, p);
              break;
            case 13:
              cn(
                d,
                p,
                l
              ), l && v & 4 && ed(d, p);
              break;
            case 22:
              p.memoizedState === null && cn(
                d,
                p,
                l
              ), pl(p, p.return);
              break;
            case 30:
              break;
            default:
              cn(
                d,
                p,
                l
              );
          }
          t = t.sibling;
        }
      }
      function ws(e, t) {
        var l = null;
        e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== l && (e != null && e.refCount++, l != null && al(l));
      }
      function ks(e, t) {
        e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && al(e));
      }
      function Qt(e, t, l, o) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            ad(
              e,
              t,
              l,
              o
            ), t = t.sibling;
      }
      function ad(e, t, l, o) {
        var d = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Qt(
              e,
              t,
              l,
              o
            ), d & 2048 && fl(9, t);
            break;
          case 1:
            Qt(
              e,
              t,
              l,
              o
            );
            break;
          case 3:
            Qt(
              e,
              t,
              l,
              o
            ), d & 2048 && (e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && al(e)));
            break;
          case 12:
            if (d & 2048) {
              Qt(
                e,
                t,
                l,
                o
              ), e = t.stateNode;
              try {
                var p = t.memoizedProps, v = p.id, M = p.onPostCommit;
                typeof M == "function" && M(
                  v,
                  t.alternate === null ? "mount" : "update",
                  e.passiveEffectDuration,
                  -0
                );
              } catch (Y) {
                Ne(t, t.return, Y);
              }
            } else
              Qt(
                e,
                t,
                l,
                o
              );
            break;
          case 31:
            Qt(
              e,
              t,
              l,
              o
            );
            break;
          case 13:
            Qt(
              e,
              t,
              l,
              o
            );
            break;
          case 23:
            break;
          case 22:
            p = t.stateNode, v = t.alternate, t.memoizedState !== null ? p._visibility & 2 ? Qt(
              e,
              t,
              l,
              o
            ) : ml(
              e,
              t
            ) : p._visibility & 2 ? Qt(
              e,
              t,
              l,
              o
            ) : (p._visibility |= 2, Na(
              e,
              t,
              l,
              o,
              (t.subtreeFlags & 10256) !== 0 || !1
            )), d & 2048 && ws(v, t);
            break;
          case 24:
            Qt(
              e,
              t,
              l,
              o
            ), d & 2048 && ks(t.alternate, t);
            break;
          default:
            Qt(
              e,
              t,
              l,
              o
            );
        }
      }
      function Na(e, t, l, o, d) {
        for (d = d && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child; t !== null; ) {
          var p = e, v = t, M = l, Y = o, $ = v.flags;
          switch (v.tag) {
            case 0:
            case 11:
            case 15:
              Na(
                p,
                v,
                M,
                Y,
                d
              ), fl(8, v);
              break;
            case 23:
              break;
            case 22:
              var ne = v.stateNode;
              v.memoizedState !== null ? ne._visibility & 2 ? Na(
                p,
                v,
                M,
                Y,
                d
              ) : ml(
                p,
                v
              ) : (ne._visibility |= 2, Na(
                p,
                v,
                M,
                Y,
                d
              )), d && $ & 2048 && ws(
                v.alternate,
                v
              );
              break;
            case 24:
              Na(
                p,
                v,
                M,
                Y,
                d
              ), d && $ & 2048 && ks(v.alternate, v);
              break;
            default:
              Na(
                p,
                v,
                M,
                Y,
                d
              );
          }
          t = t.sibling;
        }
      }
      function ml(e, t) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; ) {
            var l = e, o = t, d = o.flags;
            switch (o.tag) {
              case 22:
                ml(l, o), d & 2048 && ws(
                  o.alternate,
                  o
                );
                break;
              case 24:
                ml(l, o), d & 2048 && ks(
                  o.alternate,
                  o
                );
                break;
              default:
                ml(l, o);
            }
            t = t.sibling;
          }
      }
      function aa(e, t, l) {
        if (e.subtreeFlags & Ka)
          for (e = e.child; e !== null; )
            ld(
              e,
              t,
              l
            ), e = e.sibling;
      }
      function ld(e, t, l) {
        switch (e.tag) {
          case 26:
            if (aa(
              e,
              t,
              l
            ), e.flags & Ka)
              if (e.memoizedState !== null)
                Xg(
                  l,
                  Zt,
                  e.memoizedState,
                  e.memoizedProps
                );
              else {
                var o = e.stateNode, d = e.type;
                e = e.memoizedProps, ((t & 335544128) === t || Ys(d, e)) && Yd(l, o, d, e);
              }
            break;
          case 5:
            aa(
              e,
              t,
              l
            ), e.flags & Ka && (o = e.stateNode, d = e.type, e = e.memoizedProps, ((t & 335544128) === t || Ys(d, e)) && Yd(l, o, d, e));
            break;
          case 3:
          case 4:
            Vt ? (o = Zt, Zt = Zs(
              e.stateNode.containerInfo
            ), aa(
              e,
              t,
              l
            ), Zt = o) : aa(
              e,
              t,
              l
            );
            break;
          case 22:
            e.memoizedState === null && (o = e.alternate, o !== null && o.memoizedState !== null ? (o = Ka, Ka = 16777216, aa(
              e,
              t,
              l
            ), Ka = o) : aa(
              e,
              t,
              l
            ));
            break;
          default:
            aa(
              e,
              t,
              l
            );
        }
      }
      function rd(e) {
        var t = e.alternate;
        if (t !== null && (e = t.child, e !== null)) {
          t.child = null;
          do
            t = e.sibling, e.sibling = null, e = t;
          while (e !== null);
        }
      }
      function hl(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              tt = o, sd(
                o,
                e
              );
            }
          rd(e);
        }
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            id(e), e = e.sibling;
      }
      function id(e) {
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            hl(e), e.flags & 2048 && Nn(9, e, e.return);
            break;
          case 3:
            hl(e);
            break;
          case 12:
            hl(e);
            break;
          case 22:
            var t = e.stateNode;
            e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, xr(e)) : hl(e);
            break;
          default:
            hl(e);
        }
      }
      function xr(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              tt = o, sd(
                o,
                e
              );
            }
          rd(e);
        }
        for (e = e.child; e !== null; ) {
          switch (t = e, t.tag) {
            case 0:
            case 11:
            case 15:
              Nn(8, t, t.return), xr(t);
              break;
            case 22:
              l = t.stateNode, l._visibility & 2 && (l._visibility &= -3, xr(t));
              break;
            default:
              xr(t);
          }
          e = e.sibling;
        }
      }
      function sd(e, t) {
        for (; tt !== null; ) {
          var l = tt;
          switch (l.tag) {
            case 0:
            case 11:
            case 15:
              Nn(8, l, t);
              break;
            case 23:
            case 22:
              if (l.memoizedState !== null && l.memoizedState.cachePool !== null) {
                var o = l.memoizedState.cachePool.pool;
                o != null && o.refCount++;
              }
              break;
            case 24:
              al(l.memoizedState.cache);
          }
          if (o = l.child, o !== null) o.return = l, tt = o;
          else
            e: for (l = e; tt !== null; ) {
              o = tt;
              var d = o.sibling, p = o.return;
              if (Iu(o), o === l) {
                tt = null;
                break e;
              }
              if (d !== null) {
                d.return = p, tt = d;
                break e;
              }
              tt = p;
            }
        }
      }
      function _s(e) {
        var t = Ah(e);
        if (t != null) {
          if (typeof t.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return t;
        }
        if (e = Yh(e), e === null) throw Error(s(362));
        return e.stateNode.current;
      }
      function Ss(e, t) {
        var l = e.tag;
        switch (t.$$typeof) {
          case Gr:
            if (e.type === t.value) return !0;
            break;
          case Yr:
            e: {
              for (t = t.value, e = [e, 0], l = 0; l < e.length; ) {
                var o = e[l++], d = o.tag, p = e[l++], v = t[p];
                if (d !== 5 && d !== 26 && d !== 27 || !yl(o)) {
                  for (; v != null && Ss(o, v); )
                    p++, v = t[p];
                  if (p === t.length) {
                    t = !0;
                    break e;
                  } else
                    for (o = o.child; o !== null; )
                      e.push(o, p), o = o.sibling;
                }
              }
              t = !1;
            }
            return t;
          case Qr:
            if ((l === 5 || l === 26 || l === 27) && Zh(e.stateNode, t.value))
              return !0;
            break;
          case Zr:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (e = Vh(e), e !== null && 0 <= e.indexOf(t.value)))
              return !0;
            break;
          case Vr:
            if ((l === 5 || l === 26 || l === 27) && (e = e.memoizedProps["data-testname"], typeof e == "string" && e.toLowerCase() === t.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function Es(e) {
        switch (e.$$typeof) {
          case Gr:
            return "<" + (g(e.value) || "Unknown") + ">";
          case Yr:
            return ":has(" + (Es(e) || "") + ")";
          case Qr:
            return '[role="' + e.value + '"]';
          case Zr:
            return '"' + e.value + '"';
          case Vr:
            return '[data-testname="' + e.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function od(e, t) {
        var l = [];
        e = [e, 0];
        for (var o = 0; o < e.length; ) {
          var d = e[o++], p = d.tag, v = e[o++], M = t[v];
          if (p !== 5 && p !== 26 && p !== 27 || !yl(d)) {
            for (; M != null && Ss(d, M); )
              v++, M = t[v];
            if (v === t.length) l.push(d);
            else
              for (d = d.child; d !== null; )
                e.push(d, v), d = d.sibling;
          }
        }
        return l;
      }
      function zs(e, t) {
        if (!vl) throw Error(s(363));
        e = _s(e), e = od(e, t), t = [], e = Array.from(e);
        for (var l = 0; l < e.length; ) {
          var o = e[l++], d = o.tag;
          if (d === 5 || d === 26 || d === 27)
            yl(o) || t.push(o.stateNode);
          else
            for (o = o.child; o !== null; )
              e.push(o), o = o.sibling;
        }
        return t;
      }
      function _t() {
        return (we & 2) !== 0 && _e !== 0 ? _e & -_e : de.T !== null ? Di() : Rh();
      }
      function cd() {
        if (At === 0)
          if ((_e & 536870912) === 0 || Se) {
            var e = Tr;
            Tr <<= 1, (Tr & 3932160) === 0 && (Tr = 262144), At = e;
          } else At = 536870912;
        return e = Tt.current, e !== null && (e.flags |= 32), At;
      }
      function vt(e, t, l) {
        (e === je && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null) && (Ta(e, 0), Tn(
          e,
          _e,
          At,
          !1
        )), V(e, l), ((we & 2) === 0 || e !== je) && (e === je && ((we & 2) === 0 && (pa |= l), Le === 4 && Tn(
          e,
          _e,
          At,
          !1
        )), Wt(e));
      }
      function ud(e, t, l) {
        if ((we & 6) !== 0) throw Error(s(327));
        var o = !l && (t & 127) === 0 && (t & e.expiredLanes) === 0 || D(e, t), d = o ? ch(e, t) : Ts(e, t, !0), p = o;
        do {
          if (d === 0) {
            Ja && !o && Tn(e, t, 0, !1);
            break;
          } else {
            if (l = e.current.alternate, p && !sh(l)) {
              d = Ts(e, t, !1), p = !1;
              continue;
            }
            if (d === 2) {
              if (p = t, e.errorRecoveryDisabledLanes & p)
                var v = 0;
              else
                v = e.pendingLanes & -536870913, v = v !== 0 ? v : v & 536870912 ? 536870912 : 0;
              if (v !== 0) {
                t = v;
                e: {
                  var M = e;
                  d = Tl;
                  var Y = ft && M.current.memoizedState.isDehydrated;
                  if (Y && (Ta(M, v).flags |= 256), v = Ts(
                    M,
                    v,
                    !1
                  ), v !== 2) {
                    if (co && !Y) {
                      M.errorRecoveryDisabledLanes |= p, pa |= p, d = 4;
                      break e;
                    }
                    p = wt, wt = d, p !== null && (wt === null ? wt = p : wt.push.apply(
                      wt,
                      p
                    ));
                  }
                  d = v;
                }
                if (p = !1, d !== 2) continue;
              }
            }
            if (d === 1) {
              Ta(e, 0), Tn(e, t, 0, !0);
              break;
            }
            e: {
              switch (o = e, p = d, p) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((t & 4194048) !== t) break;
                case 6:
                  Tn(
                    o,
                    t,
                    At,
                    !Dn
                  );
                  break e;
                case 2:
                  wt = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(s(329));
              }
              if ((t & 62914560) === t && (d = Xr + 300 - yt(), 10 < d)) {
                if (Tn(
                  o,
                  t,
                  At,
                  !Dn
                ), N(o, 0, !0) !== 0) break e;
                bn = t, o.timeoutHandle = Th(
                  dd.bind(
                    null,
                    o,
                    l,
                    wt,
                    Kr,
                    fo,
                    t,
                    At,
                    pa,
                    Wa,
                    Dn,
                    p,
                    "Throttled",
                    -0,
                    0
                  ),
                  d
                );
                break e;
              }
              dd(
                o,
                l,
                wt,
                Kr,
                fo,
                t,
                At,
                pa,
                Wa,
                Dn,
                p,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Wt(e);
      }
      function dd(e, t, l, o, d, p, v, M, Y, $, ne, P, le, ge) {
        if (e.timeoutHandle = ra, P = t.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = Hh(), ld(
            t,
            p,
            P
          );
          var st = (p & 62914560) === p ? Xr - yt() : (p & 4194048) === p ? bf - yt() : 0;
          if (st = Uh(
            P,
            st
          ), st !== null) {
            bn = p, e.cancelPendingCommit = st(
              xd.bind(
                null,
                e,
                t,
                p,
                l,
                o,
                d,
                v,
                M,
                Y,
                ne,
                P,
                null,
                le,
                ge
              )
            ), Tn(e, p, v, !$);
            return;
          }
        }
        xd(
          e,
          t,
          p,
          l,
          o,
          d,
          v,
          M,
          Y
        );
      }
      function sh(e) {
        for (var t = e; ; ) {
          var l = t.tag;
          if ((l === 0 || l === 11 || l === 15) && t.flags & 16384 && (l = t.updateQueue, l !== null && (l = l.stores, l !== null)))
            for (var o = 0; o < l.length; o++) {
              var d = l[o], p = d.getSnapshot;
              d = d.value;
              try {
                if (!Nt(p(), d)) return !1;
              } catch {
                return !1;
              }
            }
          if (l = t.child, t.subtreeFlags & 16384 && l !== null)
            l.return = t, t = l;
          else {
            if (t === e) break;
            for (; t.sibling === null; ) {
              if (t.return === null || t.return === e) return !0;
              t = t.return;
            }
            t.sibling.return = t.return, t = t.sibling;
          }
        }
        return !0;
      }
      function Tn(e, t, l, o) {
        t &= ~uo, t &= ~pa, e.suspendedLanes |= t, e.pingedLanes &= ~t, o && (e.warmLanes |= t), o = e.expirationTimes;
        for (var d = t; 0 < d; ) {
          var p = 31 - Et(d), v = 1 << p;
          o[p] = -1, d &= ~v;
        }
        l !== 0 && x(e, l, t);
      }
      function fd() {
        return (we & 6) === 0 ? (Ea(0), !1) : !0;
      }
      function Ns() {
        if (ke !== null) {
          if (Ae === 0)
            var e = ke.return;
          else
            e = ke, pn = sa = null, Ji(e), Ya = null, Sl = 0, e = ke;
          for (; e !== null; )
            Vu(e.alternate, e), e = e.return;
          ke = null;
        }
      }
      function Ta(e, t) {
        var l = e.timeoutHandle;
        l !== ra && (e.timeoutHandle = ra, Ch(l)), l = e.cancelPendingCommit, l !== null && (e.cancelPendingCommit = null, l()), bn = 0, Ns(), je = e, ke = l = un(e.current, null), _e = t, Ae = 0, Ct = null, Dn = !1, Ja = D(e, t), co = !1, Wa = At = uo = pa = Bn = Le = 0, wt = Tl = null, fo = !1, (t & 8) !== 0 && (t |= t & 32);
        var o = e.entangledLanes;
        if (o !== 0)
          for (e = e.entanglements, o &= t; 0 < o; ) {
            var d = 31 - Et(o), p = 1 << d;
            t |= e[d], o &= ~p;
          }
        return gn = t, nr(), l;
      }
      function pd(e, t) {
        be = null, de.H = zl, t === Ga || t === Br ? (t = jc(), Ae = 3) : t === to ? (t = jc(), Ae = 4) : Ae = t === io ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, Ct = t, ke === null && (Le = 1, fr(
          e,
          Q(t, e.current)
        ));
      }
      function md() {
        var e = Tt.current;
        return e === null ? !0 : (_e & 4194048) === _e ? Bt === null : (_e & 62914560) === _e || (_e & 536870912) !== 0 ? e === Bt : !1;
      }
      function hd() {
        var e = de.H;
        return de.H = zl, e === null ? zl : e;
      }
      function gd() {
        var e = de.A;
        return de.A = s0, e;
      }
      function wr() {
        Le = 4, Dn || (_e & 4194048) !== _e && Tt.current !== null || (Ja = !0), (Bn & 134217727) === 0 && (pa & 134217727) === 0 || je === null || Tn(
          je,
          _e,
          At,
          !1
        );
      }
      function Ts(e, t, l) {
        var o = we;
        we |= 2;
        var d = hd(), p = gd();
        (je !== e || _e !== t) && (Kr = null, Ta(e, t)), t = !1;
        var v = Le;
        e: do
          try {
            if (Ae !== 0 && ke !== null) {
              var M = ke, Y = Ct;
              switch (Ae) {
                case 8:
                  Ns(), v = 6;
                  break e;
                case 3:
                case 2:
                case 9:
                case 6:
                  Tt.current === null && (t = !0);
                  var $ = Ae;
                  if (Ae = 0, Ct = null, Ca(e, M, Y, $), l && Ja) {
                    v = 0;
                    break e;
                  }
                  break;
                default:
                  $ = Ae, Ae = 0, Ct = null, Ca(e, M, Y, $);
              }
            }
            oh(), v = Le;
            break;
          } catch (ne) {
            pd(e, ne);
          }
        while (!0);
        return t && e.shellSuspendCounter++, pn = sa = null, we = o, de.H = d, de.A = p, ke === null && (je = null, _e = 0, nr()), v;
      }
      function oh() {
        for (; ke !== null; ) bd(ke);
      }
      function ch(e, t) {
        var l = we;
        we |= 2;
        var o = hd(), d = gd();
        je !== e || _e !== t ? (Kr = null, Cl = yt() + 500, Ta(e, t)) : Ja = D(
          e,
          t
        );
        e: do
          try {
            if (Ae !== 0 && ke !== null) {
              t = ke;
              var p = Ct;
              t: switch (Ae) {
                case 1:
                  Ae = 0, Ct = null, Ca(e, t, p, 1);
                  break;
                case 2:
                case 9:
                  if (Mc(p)) {
                    Ae = 0, Ct = null, vd(t);
                    break;
                  }
                  t = function() {
                    Ae !== 2 && Ae !== 9 || je !== e || (Ae = 7), Wt(e);
                  }, p.then(t, t);
                  break e;
                case 3:
                  Ae = 7;
                  break e;
                case 4:
                  Ae = 5;
                  break e;
                case 7:
                  Mc(p) ? (Ae = 0, Ct = null, vd(t)) : (Ae = 0, Ct = null, Ca(e, t, p, 7));
                  break;
                case 5:
                  var v = null;
                  switch (ke.tag) {
                    case 26:
                      v = ke.memoizedState;
                    case 5:
                    case 27:
                      var M = ke, Y = M.type, $ = M.pendingProps;
                      if (v ? af(v) : Gd(M.stateNode, Y, $)) {
                        Ae = 0, Ct = null;
                        var ne = M.sibling;
                        if (ne !== null) ke = ne;
                        else {
                          var P = M.return;
                          P !== null ? (ke = P, kr(P)) : ke = null;
                        }
                        break t;
                      }
                  }
                  Ae = 0, Ct = null, Ca(e, t, p, 5);
                  break;
                case 6:
                  Ae = 0, Ct = null, Ca(e, t, p, 6);
                  break;
                case 8:
                  Ns(), Le = 6;
                  break e;
                default:
                  throw Error(s(462));
              }
            }
            uh();
            break;
          } catch (le) {
            pd(e, le);
          }
        while (!0);
        return pn = sa = null, de.H = o, de.A = d, we = l, ke !== null ? 0 : (je = null, _e = 0, nr(), Le);
      }
      function uh() {
        for (; ke !== null && !$g(); )
          bd(ke);
      }
      function bd(e) {
        var t = qu(
          e.alternate,
          e,
          gn
        );
        e.memoizedProps = e.pendingProps, t === null ? kr(e) : ke = t;
      }
      function vd(e) {
        var t = e, l = t.alternate;
        switch (t.tag) {
          case 15:
          case 0:
            t = ju(
              l,
              t,
              t.pendingProps,
              t.type,
              void 0,
              _e
            );
            break;
          case 11:
            t = ju(
              l,
              t,
              t.pendingProps,
              t.type.render,
              t.ref,
              _e
            );
            break;
          case 5:
            Ji(t);
          default:
            Vu(l, t), t = ke = Td(t, gn), t = qu(l, t, gn);
        }
        e.memoizedProps = e.pendingProps, t === null ? kr(e) : ke = t;
      }
      function Ca(e, t, l, o) {
        pn = sa = null, Ji(t), Ya = null, Sl = 0;
        var d = t.return;
        try {
          if (eh(
            e,
            d,
            t,
            l,
            _e
          )) {
            Le = 1, fr(
              e,
              Q(l, e.current)
            ), ke = null;
            return;
          }
        } catch (p) {
          if (d !== null) throw ke = d, p;
          Le = 1, fr(
            e,
            Q(l, e.current)
          ), ke = null;
          return;
        }
        t.flags & 32768 ? (Se || o === 1 ? e = !0 : Ja || (_e & 536870912) !== 0 ? e = !1 : (Dn = e = !0, (o === 2 || o === 9 || o === 3 || o === 6) && (o = Tt.current, o !== null && o.tag === 13 && (o.flags |= 16384))), yd(t, e)) : kr(t);
      }
      function kr(e) {
        var t = e;
        do {
          if ((t.flags & 32768) !== 0) {
            yd(
              t,
              Dn
            );
            return;
          }
          e = t.return;
          var l = ah(
            t.alternate,
            t,
            gn
          );
          if (l !== null) {
            ke = l;
            return;
          }
          if (t = t.sibling, t !== null) {
            ke = t;
            return;
          }
          ke = t = e;
        } while (t !== null);
        Le === 0 && (Le = 5);
      }
      function yd(e, t) {
        do {
          var l = lh(e.alternate, e);
          if (l !== null) {
            l.flags &= 32767, ke = l;
            return;
          }
          if (l = e.return, l !== null && (l.flags |= 32768, l.subtreeFlags = 0, l.deletions = null), !t && (e = e.sibling, e !== null)) {
            ke = e;
            return;
          }
          ke = e = l;
        } while (e !== null);
        Le = 6, ke = null;
      }
      function xd(e, t, l, o, d, p, v, M, Y) {
        e.cancelPendingCommit = null;
        do
          gl();
        while ($e !== 0);
        if ((we & 6) !== 0) throw Error(s(327));
        if (t !== null) {
          if (t === e.current)
            throw Error(s(177));
          if (p = t.lanes | t.childLanes, p |= no, w(
            e,
            l,
            p,
            v,
            M,
            Y
          ), e === je && (ke = je = null, _e = 0), $a = t, Un = e, bn = l, po = p, mo = d, vf = o, (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, mh(Js, function() {
            return Ed(), null;
          })) : (e.callbackNode = null, e.callbackPriority = 0), o = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || o) {
            o = de.T, de.T = null, d = fn(), et(2), v = we, we |= 4;
            try {
              rh(e, t, l);
            } finally {
              we = v, et(d), de.T = o;
            }
          }
          $e = 1, wd(), kd(), _d();
        }
      }
      function wd() {
        if ($e === 1) {
          $e = 0;
          var e = Un, t = $a, l = (t.flags & 13878) !== 0;
          if ((t.subtreeFlags & 13878) !== 0 || l) {
            l = de.T, de.T = null;
            var o = fn();
            et(2);
            var d = we;
            we |= 4;
            try {
              td(t, e), zh(e.containerInfo);
            } finally {
              we = d, et(o), de.T = l;
            }
          }
          e.current = t, $e = 2;
        }
      }
      function kd() {
        if ($e === 2) {
          $e = 0;
          var e = Un, t = $a, l = (t.flags & 8772) !== 0;
          if ((t.subtreeFlags & 8772) !== 0 || l) {
            l = de.T, de.T = null;
            var o = fn();
            et(2);
            var d = we;
            we |= 4;
            try {
              Fu(e, t.alternate, t);
            } finally {
              we = d, et(o), de.T = l;
            }
          }
          $e = 3;
        }
      }
      function _d() {
        if ($e === 4 || $e === 3) {
          $e = 0, Fg();
          var e = Un, t = $a, l = bn, o = vf;
          (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? $e = 5 : ($e = 0, $a = Un = null, Sd(e, e.pendingLanes));
          var d = e.pendingLanes;
          if (d === 0 && (Hn = null), C(l), t = t.stateNode, zt && typeof zt.onCommitFiberRoot == "function")
            try {
              zt.onCommitFiberRoot(
                xl,
                t,
                void 0,
                (t.current.flags & 128) === 128
              );
            } catch {
            }
          if (o !== null) {
            t = de.T, d = fn(), et(2), de.T = null;
            try {
              for (var p = e.onRecoverableError, v = 0; v < o.length; v++) {
                var M = o[v];
                p(M.value, {
                  componentStack: M.stack
                });
              }
            } finally {
              de.T = t, et(d);
            }
          }
          (bn & 3) !== 0 && gl(), Wt(e), d = e.pendingLanes, (l & 261930) !== 0 && (d & 42) !== 0 ? e === ho ? Al++ : (Al = 0, ho = e) : Al = 0, ft && Dg(), Ea(0);
        }
      }
      function Sd(e, t) {
        (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, al(t)));
      }
      function gl() {
        return wd(), kd(), _d(), Ed();
      }
      function Ed() {
        if ($e !== 5) return !1;
        var e = Un, t = po;
        po = 0;
        var l = C(bn), o = 32 > l ? 32 : l;
        l = de.T;
        var d = fn();
        try {
          et(o), de.T = null, o = mo, mo = null;
          var p = Un, v = bn;
          if ($e = 0, $a = Un = null, bn = 0, (we & 6) !== 0)
            throw Error(s(331));
          var M = we;
          if (we |= 4, id(p.current), ad(
            p,
            p.current,
            v,
            o
          ), we = M, Ea(0, !1), zt && typeof zt.onPostCommitFiberRoot == "function")
            try {
              zt.onPostCommitFiberRoot(xl, p);
            } catch {
            }
          return !0;
        } finally {
          et(d), de.T = l, Sd(e, t);
        }
      }
      function zd(e, t, l) {
        t = Q(l, t), t = is(e.stateNode, t, 2), e = Sn(e, t, 2), e !== null && (V(e, 2), Wt(e));
      }
      function Ne(e, t, l) {
        if (e.tag === 3)
          zd(e, e, l);
        else
          for (; t !== null; ) {
            if (t.tag === 3) {
              zd(
                t,
                e,
                l
              );
              break;
            } else if (t.tag === 1) {
              var o = t.stateNode;
              if (typeof t.type.getDerivedStateFromError == "function" || typeof o.componentDidCatch == "function" && (Hn === null || !Hn.has(o))) {
                e = Q(l, e), l = Eu(2), o = Sn(t, l, 2), o !== null && (zu(
                  l,
                  o,
                  t,
                  e
                ), V(o, 2), Wt(o));
                break;
              }
            }
            t = t.return;
          }
      }
      function Cs(e, t, l) {
        var o = e.pingCache;
        if (o === null) {
          o = e.pingCache = new o0();
          var d = /* @__PURE__ */ new Set();
          o.set(t, d);
        } else
          d = o.get(t), d === void 0 && (d = /* @__PURE__ */ new Set(), o.set(t, d));
        d.has(l) || (co = !0, d.add(l), e = dh.bind(null, e, t, l), t.then(e, e));
      }
      function dh(e, t, l) {
        var o = e.pingCache;
        o !== null && o.delete(t), e.pingedLanes |= e.suspendedLanes & l, e.warmLanes &= ~l, je === e && (_e & l) === l && (Le === 4 || Le === 3 && (_e & 62914560) === _e && 300 > yt() - Xr ? (we & 2) === 0 && Ta(e, 0) : uo |= l, Wa === _e && (Wa = 0)), Wt(e);
      }
      function Nd(e, t) {
        t === 0 && (t = X()), e = ea(e, t), e !== null && (V(e, t), Wt(e));
      }
      function fh(e) {
        var t = e.memoizedState, l = 0;
        t !== null && (l = t.retryLane), Nd(e, l);
      }
      function ph(e, t) {
        var l = 0;
        switch (e.tag) {
          case 31:
          case 13:
            var o = e.stateNode, d = e.memoizedState;
            d !== null && (l = d.retryLane);
            break;
          case 19:
            o = e.stateNode;
            break;
          case 22:
            o = e.stateNode._retryCache;
            break;
          default:
            throw Error(s(314));
        }
        o !== null && o.delete(t), Nd(e, l);
      }
      function mh(e, t) {
        return Ar(e, t);
      }
      function hh(e, t, l, o) {
        this.tag = e, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = o, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function As(e) {
        return e = e.prototype, !(!e || !e.isReactComponent);
      }
      function un(e, t) {
        var l = e.alternate;
        return l === null ? (l = r(
          e.tag,
          t,
          e.key,
          e.mode
        ), l.elementType = e.elementType, l.type = e.type, l.stateNode = e.stateNode, l.alternate = e, e.alternate = l) : (l.pendingProps = t, l.type = e.type, l.flags = 0, l.subtreeFlags = 0, l.deletions = null), l.flags = e.flags & 65011712, l.childLanes = e.childLanes, l.lanes = e.lanes, l.child = e.child, l.memoizedProps = e.memoizedProps, l.memoizedState = e.memoizedState, l.updateQueue = e.updateQueue, t = e.dependencies, l.dependencies = t === null ? null : {
          lanes: t.lanes,
          firstContext: t.firstContext
        }, l.sibling = e.sibling, l.index = e.index, l.ref = e.ref, l.refCleanup = e.refCleanup, l;
      }
      function Td(e, t) {
        e.flags &= 65011714;
        var l = e.alternate;
        return l === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = l.childLanes, e.lanes = l.lanes, e.child = l.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = l.memoizedProps, e.memoizedState = l.memoizedState, e.updateQueue = l.updateQueue, e.type = l.type, t = l.dependencies, e.dependencies = t === null ? null : {
          lanes: t.lanes,
          firstContext: t.firstContext
        }), e;
      }
      function _r(e, t, l, o, d, p) {
        var v = 0;
        if (o = e, typeof e == "function") As(e) && (v = 1);
        else if (typeof e == "string")
          v = Vt && We ? Fd(e, l, rt.current) ? 26 : sf(e) ? 27 : 5 : Vt ? Fd(
            e,
            l,
            rt.current
          ) ? 26 : 5 : We && sf(e) ? 27 : 5;
        else
          e: switch (e) {
            case Ls:
              return e = r(31, l, t, d), e.elementType = Ls, e.lanes = p, e;
            case Ma:
              return la(
                l.children,
                d,
                p,
                t
              );
            case Dd:
              v = 8, d |= 24;
              break;
            case Ds:
              return e = r(12, l, t, d | 2), e.elementType = Ds, e.lanes = p, e;
            case Hs:
              return e = r(13, l, t, d), e.elementType = Hs, e.lanes = p, e;
            case Us:
              return e = r(19, l, t, d), e.elementType = Us, e.lanes = p, e;
            default:
              if (typeof e == "object" && e !== null)
                switch (e.$$typeof) {
                  case Cn:
                    v = 10;
                    break e;
                  case Bd:
                    v = 9;
                    break e;
                  case Bs:
                    v = 11;
                    break e;
                  case qs:
                    v = 14;
                    break e;
                  case An:
                    v = 16, o = null;
                    break e;
                }
              v = 29, l = Error(
                s(
                  130,
                  e === null ? "null" : typeof e,
                  ""
                )
              ), o = null;
          }
        return t = r(v, l, t, d), t.elementType = e, t.type = o, t.lanes = p, t;
      }
      function la(e, t, l, o) {
        return e = r(7, e, o, t), e.lanes = l, e;
      }
      function Ms(e, t, l) {
        return e = r(6, e, null, t), e.lanes = l, e;
      }
      function Cd(e) {
        var t = r(18, null, null, 0);
        return t.stateNode = e, t;
      }
      function Rs(e, t, l) {
        return t = r(
          4,
          e.children !== null ? e.children : [],
          e.key,
          t
        ), t.lanes = l, t.stateNode = {
          containerInfo: e.containerInfo,
          pendingChildren: null,
          implementation: e.implementation
        }, t;
      }
      function gh(e, t, l, o, d, p, v, M, Y) {
        this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = ra, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = U(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = U(0), this.hiddenUpdates = U(null), this.identifierPrefix = o, this.onUncaughtError = d, this.onCaughtError = p, this.onRecoverableError = v, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Ad(e, t, l, o, d, p, v, M, Y, $, ne, P) {
        return e = new gh(
          e,
          t,
          l,
          v,
          Y,
          $,
          ne,
          P,
          M
        ), t = 1, p === !0 && (t |= 24), p = r(3, null, null, t), e.current = p, p.stateNode = e, t = Oi(), t.refCount++, e.pooledCache = t, t.refCount++, p.memoizedState = {
          element: o,
          isDehydrated: l,
          cache: t
        }, Ui(p), e;
      }
      function Md(e) {
        return e ? (e = Da, e) : Da;
      }
      function Rd(e) {
        var t = e._reactInternals;
        if (t === void 0)
          throw typeof e.render == "function" ? Error(s(188)) : (e = Object.keys(e).join(","), Error(s(268, e)));
        return e = u(t), e = e !== null ? m(e) : null, e === null ? null : bl(e.stateNode);
      }
      function jd(e, t, l, o, d, p) {
        d = Md(d), o.context === null ? o.context = d : o.pendingContext = d, o = _n(t), o.payload = { element: l }, p = p === void 0 ? null : p, p !== null && (o.callback = p), l = Sn(e, o, t), l !== null && (vt(l, e, t), rl(l, e, t));
      }
      function Od(e, t) {
        if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
          var l = e.retryLane;
          e.retryLane = l !== 0 && l < t ? l : t;
        }
      }
      function js(e, t) {
        Od(e, t), (e = e.alternate) && Od(e, t);
      }
      var xe = {}, bh = H0, St = q0(), Os = Object.assign, vh = Symbol.for("react.element"), Sr = Symbol.for("react.transitional.element"), Aa = Symbol.for("react.portal"), Ma = Symbol.for("react.fragment"), Dd = Symbol.for("react.strict_mode"), Ds = Symbol.for("react.profiler"), Bd = Symbol.for("react.consumer"), Cn = Symbol.for("react.context"), Bs = Symbol.for("react.forward_ref"), Hs = Symbol.for("react.suspense"), Us = Symbol.for("react.suspense_list"), qs = Symbol.for("react.memo"), An = Symbol.for("react.lazy"), Ls = Symbol.for("react.activity"), yh = Symbol.for("react.memo_cache_sentinel"), Hd = Symbol.iterator, xh = Symbol.for("react.client.reference"), Er = Array.isArray, de = bh.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, wh = a.rendererVersion, kh = a.rendererPackageName, Ud = a.extraDevToolsConfig, bl = a.getPublicInstance, _h = a.getRootHostContext, Sh = a.getChildHostContext, Eh = a.prepareForCommit, zh = a.resetAfterCommit, Nh = a.createInstance;
      a.cloneMutableInstance;
      var Gs = a.appendInitialChild, qd = a.finalizeInitialChildren, zr = a.shouldSetTextContent, Ld = a.createTextInstance;
      a.cloneMutableTextInstance;
      var Th = a.scheduleTimeout, Ch = a.cancelTimeout, ra = a.noTimeout, dn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var dt = a.supportsMutation, Ft = a.supportsPersistence, ft = a.supportsHydration, Ah = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var Mh = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var et = a.setCurrentUpdatePriority, fn = a.getCurrentUpdatePriority, Rh = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var jh = a.shouldAttemptEagerTransition, Oh = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var Dh = a.maySuspendCommit, Bh = a.maySuspendCommitOnUpdate, Ys = a.maySuspendCommitInSyncRender, Gd = a.preloadInstance, Hh = a.startSuspendingCommit, Yd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var Uh = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var Ra = a.NotPendingTransition, ia = a.HostTransitionContext, qh = a.resetFormInstance;
      a.bindToConsole;
      var Lh = a.supportsMicrotasks, Gh = a.scheduleMicrotask, vl = a.supportsTestSelectors, Yh = a.findFiberRoot, Qh = a.getBoundingRect, Vh = a.getTextContent, yl = a.isHiddenSubtree, Zh = a.matchAccessibilityRole, Xh = a.setFocusIfFocusable, Kh = a.setupIntersectionObserver, Jh = a.appendChild, Wh = a.appendChildToContainer, $h = a.commitTextUpdate, Fh = a.commitMount, Ih = a.commitUpdate, Ph = a.insertBefore, eg = a.insertInContainerBefore, tg = a.removeChild, ng = a.removeChildFromContainer, Qd = a.resetTextContent, ag = a.hideInstance, lg = a.hideTextInstance, rg = a.unhideInstance, ig = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var sg = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var og = a.cloneInstance, Vd = a.createContainerChildSet, Zd = a.appendChildToContainerChildSet, cg = a.finalizeContainerChildren, Xd = a.replaceContainerChildren, Kd = a.cloneHiddenInstance, Jd = a.cloneHiddenTextInstance, Qs = a.isSuspenseInstancePending, Vs = a.isSuspenseInstanceFallback, ug = a.getSuspenseInstanceFallbackErrorDetails, dg = a.registerSuspenseInstanceRetry, fg = a.canHydrateFormStateMarker, pg = a.isFormStateMarkerMatching, Wd = a.getNextHydratableSibling, mg = a.getNextHydratableSiblingAfterSingleton, hg = a.getFirstHydratableChild, gg = a.getFirstHydratableChildWithinContainer, bg = a.getFirstHydratableChildWithinActivityInstance, vg = a.getFirstHydratableChildWithinSuspenseInstance, yg = a.getFirstHydratableChildWithinSingleton, xg = a.canHydrateInstance, wg = a.canHydrateTextInstance, kg = a.canHydrateActivityInstance, _g = a.canHydrateSuspenseInstance, Sg = a.hydrateInstance, Eg = a.hydrateTextInstance, zg = a.hydrateActivityInstance, Ng = a.hydrateSuspenseInstance, Tg = a.getNextHydratableInstanceAfterActivityInstance, Cg = a.getNextHydratableInstanceAfterSuspenseInstance, Ag = a.commitHydratedInstance, Mg = a.commitHydratedContainer, Rg = a.commitHydratedActivityInstance, jg = a.commitHydratedSuspenseInstance, Og = a.finalizeHydratedChildren, Dg = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var Bg = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var Hg = a.clearSuspenseBoundaryFromContainer, Ug = a.hideDehydratedBoundary, qg = a.unhideDehydratedBoundary, $d = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var Lg = a.validateHydratableInstance, Gg = a.validateHydratableTextInstance, Vt = a.supportsResources, Fd = a.isHostHoistableType, Zs = a.getHoistableRoot, Id = a.getResource, Pd = a.acquireResource, ef = a.releaseResource, Yg = a.hydrateHoistable, tf = a.mountHoistable, nf = a.unmountHoistable, Qg = a.createHoistableInstance, Vg = a.prepareToCommitHoistables, Zg = a.mayResourceSuspendCommit, af = a.preloadResource, Xg = a.suspendResource, We = a.supportsSingletons, lf = a.resolveSingletonInstance, Kg = a.acquireSingletonInstance, rf = a.releaseSingletonInstance, sf = a.isHostSingletonType, ja = a.isSingletonScope, Xs = [], Oa = -1, Da = {}, Et = Math.clz32 ? Math.clz32 : z, Jg = Math.log, Wg = Math.LN2, Nr = 256, Tr = 262144, Cr = 4194304, Ar = St.unstable_scheduleCallback, Ks = St.unstable_cancelCallback, $g = St.unstable_shouldYield, Fg = St.unstable_requestPaint, yt = St.unstable_now, of = St.unstable_ImmediatePriority, Ig = St.unstable_UserBlockingPriority, Js = St.unstable_NormalPriority, Pg = St.unstable_IdlePriority, e0 = St.log, t0 = St.unstable_setDisableYieldValue, xl = null, zt = null, Nt = typeof Object.is == "function" ? Object.is : W, cf = typeof reportError == "function" ? reportError : function(e) {
        if (typeof window == "object" && typeof window.ErrorEvent == "function") {
          var t = new window.ErrorEvent("error", {
            bubbles: !0,
            cancelable: !0,
            message: typeof e == "object" && e !== null && typeof e.message == "string" ? String(e.message) : String(e),
            error: e
          });
          if (!window.dispatchEvent(t)) return;
        } else if (typeof process == "object" && typeof process.emit == "function") {
          process.emit("uncaughtException", e);
          return;
        }
        console.error(e);
      }, n0 = Object.prototype.hasOwnProperty, Ws, uf, $s = !1, df = /* @__PURE__ */ new WeakMap(), Ba = [], Ha = 0, Mr = null, wl = 0, Rt = [], jt = 0, Mn = null, It = 1, Pt = "", rt = b(null), kl = b(null), Rn = b(null), Rr = b(null), it = null, Be = null, Se = !1, jn = null, Ot = !1, Fs = Error(s(519)), jr = b(null), sa = null, pn = null, a0 = typeof AbortController < "u" ? AbortController : function() {
        var e = [], t = this.signal = {
          aborted: !1,
          addEventListener: function(l, o) {
            e.push(o);
          }
        };
        this.abort = function() {
          t.aborted = !0, e.forEach(function(l) {
            return l();
          });
        };
      }, l0 = St.unstable_scheduleCallback, r0 = St.unstable_NormalPriority, He = {
        $$typeof: Cn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Or = null, Ua = null, Is = !1, Dr = !1, Ps = !1, oa = 0, _l = null, eo = 0, qa = 0, La = null, ff = de.S;
      de.S = function(e, t) {
        bf = yt(), typeof t == "object" && t !== null && typeof t.then == "function" && Xm(e, t), ff !== null && ff(e, t);
      };
      var ca = b(null), Ga = Error(s(460)), to = Error(s(474)), Br = Error(s(542)), Hr = { then: function() {
      } }, ua = null, Ya = null, Sl = 0, da = Dc(!0), pf = Dc(!1), Dt = [], Qa = 0, no = 0, On = !1, ao = !1, Va = b(null), Ur = b(0), Tt = b(null), Bt = null, Ye = b(0), mn = 0, be = null, Me = null, Ve = null, qr = !1, Za = !1, fa = !1, Lr = 0, El = 0, Xa = null, i0 = 0, zl = {
        readContext: at,
        use: sr,
        useCallback: qe,
        useContext: qe,
        useEffect: qe,
        useImperativeHandle: qe,
        useLayoutEffect: qe,
        useInsertionEffect: qe,
        useMemo: qe,
        useReducer: qe,
        useRef: qe,
        useState: qe,
        useDebugValue: qe,
        useDeferredValue: qe,
        useTransition: qe,
        useSyncExternalStore: qe,
        useId: qe,
        useHostTransitionStatus: qe,
        useFormState: qe,
        useActionState: qe,
        useOptimistic: qe,
        useMemoCache: qe,
        useCacheRefresh: qe
      };
      zl.useEffectEvent = qe;
      var mf = {
        readContext: at,
        use: sr,
        useCallback: function(e, t) {
          return ht().memoizedState = [
            e,
            t === void 0 ? null : t
          ], e;
        },
        useContext: at,
        useEffect: iu,
        useImperativeHandle: function(e, t, l) {
          l = l != null ? l.concat([e]) : null, cr(
            4194308,
            4,
            uu.bind(null, t, e),
            l
          );
        },
        useLayoutEffect: function(e, t) {
          return cr(4194308, 4, e, t);
        },
        useInsertionEffect: function(e, t) {
          cr(4, 2, e, t);
        },
        useMemo: function(e, t) {
          var l = ht();
          t = t === void 0 ? null : t;
          var o = e();
          if (fa) {
            B(!0);
            try {
              e();
            } finally {
              B(!1);
            }
          }
          return l.memoizedState = [o, t], o;
        },
        useReducer: function(e, t, l) {
          var o = ht();
          if (l !== void 0) {
            var d = l(t);
            if (fa) {
              B(!0);
              try {
                l(t);
              } finally {
                B(!1);
              }
            }
          } else d = t;
          return o.memoizedState = o.baseState = d, e = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: e,
            lastRenderedState: d
          }, o.queue = e, e = e.dispatch = Pm.bind(
            null,
            be,
            e
          ), [o.memoizedState, e];
        },
        useRef: function(e) {
          var t = ht();
          return e = { current: e }, t.memoizedState = e;
        },
        useState: function(e) {
          e = Ii(e);
          var t = e.queue, l = yu.bind(
            null,
            be,
            t
          );
          return t.dispatch = l, [e.memoizedState, l];
        },
        useDebugValue: ts,
        useDeferredValue: function(e, t) {
          var l = ht();
          return ns(l, e, t);
        },
        useTransition: function() {
          var e = Ii(!1);
          return e = hu.bind(
            null,
            be,
            e.queue,
            !0,
            !1
          ), ht().memoizedState = e, [!1, e];
        },
        useSyncExternalStore: function(e, t, l) {
          var o = be, d = ht();
          if (Se) {
            if (l === void 0)
              throw Error(s(407));
            l = l();
          } else {
            if (l = t(), je === null)
              throw Error(s(349));
            (_e & 127) !== 0 || Vc(o, t, l);
          }
          d.memoizedState = l;
          var p = { value: l, getSnapshot: t };
          return d.queue = p, iu(Xc.bind(null, o, p, e), [
            e
          ]), o.flags |= 2048, za(
            9,
            { destroy: void 0 },
            Zc.bind(
              null,
              o,
              p,
              l,
              t
            ),
            null
          ), l;
        },
        useId: function() {
          var e = ht(), t = je.identifierPrefix;
          if (Se) {
            var l = Pt, o = It;
            l = (o & ~(1 << 32 - Et(o) - 1)).toString(32) + l, t = "_" + t + "R_" + l, l = Lr++, 0 < l && (t += "H" + l.toString(32)), t += "_";
          } else
            l = i0++, t = "_" + t + "r_" + l.toString(32) + "_";
          return e.memoizedState = t;
        },
        useHostTransitionStatus: as,
        useFormState: tu,
        useActionState: tu,
        useOptimistic: function(e) {
          var t = ht();
          t.memoizedState = t.baseState = e;
          var l = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return t.queue = l, t = ls.bind(
            null,
            be,
            !0,
            l
          ), l.dispatch = t, [e, t];
        },
        useMemoCache: Wi,
        useCacheRefresh: function() {
          return ht().memoizedState = Im.bind(
            null,
            be
          );
        },
        useEffectEvent: function(e) {
          var t = ht(), l = { impl: e };
          return t.memoizedState = l, function() {
            if ((we & 2) !== 0)
              throw Error(s(440));
            return l.impl.apply(void 0, arguments);
          };
        }
      }, lo = {
        readContext: at,
        use: sr,
        useCallback: fu,
        useContext: at,
        useEffect: es,
        useImperativeHandle: du,
        useInsertionEffect: ou,
        useLayoutEffect: cu,
        useMemo: pu,
        useReducer: or,
        useRef: ru,
        useState: function() {
          return or(rn);
        },
        useDebugValue: ts,
        useDeferredValue: function(e, t) {
          var l = Ge();
          return mu(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = or(rn)[0], t = Ge().memoizedState;
          return [
            typeof e == "boolean" ? e : ol(e),
            t
          ];
        },
        useSyncExternalStore: Qc,
        useId: bu,
        useHostTransitionStatus: as,
        useFormState: nu,
        useActionState: nu,
        useOptimistic: function(e, t) {
          var l = Ge();
          return Wc(l, Me, e, t);
        },
        useMemoCache: Wi,
        useCacheRefresh: vu
      };
      lo.useEffectEvent = su;
      var hf = {
        readContext: at,
        use: sr,
        useCallback: fu,
        useContext: at,
        useEffect: es,
        useImperativeHandle: du,
        useInsertionEffect: ou,
        useLayoutEffect: cu,
        useMemo: pu,
        useReducer: Fi,
        useRef: ru,
        useState: function() {
          return Fi(rn);
        },
        useDebugValue: ts,
        useDeferredValue: function(e, t) {
          var l = Ge();
          return Me === null ? ns(l, e, t) : mu(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = Fi(rn)[0], t = Ge().memoizedState;
          return [
            typeof e == "boolean" ? e : ol(e),
            t
          ];
        },
        useSyncExternalStore: Qc,
        useId: bu,
        useHostTransitionStatus: as,
        useFormState: lu,
        useActionState: lu,
        useOptimistic: function(e, t) {
          var l = Ge();
          return Me !== null ? Wc(l, Me, e, t) : (l.baseState = e, [e, l.queue.dispatch]);
        },
        useMemoCache: Wi,
        useCacheRefresh: vu
      };
      hf.useEffectEvent = su;
      var ro = {
        enqueueSetState: function(e, t, l) {
          e = e._reactInternals;
          var o = _t(), d = _n(o);
          d.payload = t, l != null && (d.callback = l), t = Sn(e, d, o), t !== null && (vt(t, e, o), rl(t, e, o));
        },
        enqueueReplaceState: function(e, t, l) {
          e = e._reactInternals;
          var o = _t(), d = _n(o);
          d.tag = 1, d.payload = t, l != null && (d.callback = l), t = Sn(e, d, o), t !== null && (vt(t, e, o), rl(t, e, o));
        },
        enqueueForceUpdate: function(e, t) {
          e = e._reactInternals;
          var l = _t(), o = _n(l);
          o.tag = 2, t != null && (o.callback = t), t = Sn(e, o, l), t !== null && (vt(t, e, l), rl(t, e, l));
        }
      }, io = Error(s(461)), Ze = !1, so = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, hn = !1, Xe = !1, oo = !1, gf = typeof WeakSet == "function" ? WeakSet : Set, tt = null, Ke = null, xt = !1, Zt = null, Ka = 8192, s0 = {
        getCacheForType: function(e) {
          var t = at(He), l = t.data.get(e);
          return l === void 0 && (l = e(), t.data.set(e, l)), l;
        },
        cacheSignal: function() {
          return at(He).controller.signal;
        }
      }, Gr = 0, Yr = 1, Qr = 2, Vr = 3, Zr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Nl = Symbol.for;
        Gr = Nl("selector.component"), Yr = Nl("selector.has_pseudo_class"), Qr = Nl("selector.role"), Vr = Nl("selector.test_id"), Zr = Nl("selector.text");
      }
      var o0 = typeof WeakMap == "function" ? WeakMap : Map, we = 0, je = null, ke = null, _e = 0, Ae = 0, Ct = null, Dn = !1, Ja = !1, co = !1, gn = 0, Le = 0, Bn = 0, pa = 0, uo = 0, At = 0, Wa = 0, Tl = null, wt = null, fo = !1, Xr = 0, bf = 0, Cl = 1 / 0, Kr = null, Hn = null, $e = 0, Un = null, $a = null, bn = 0, po = 0, mo = null, vf = null, Al = 0, ho = null;
      return xe.attemptContinuousHydration = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = ea(e, 67108864);
          t !== null && vt(t, e, 67108864), js(e, 67108864);
        }
      }, xe.attemptHydrationAtCurrentPriority = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = _t();
          t = R(t);
          var l = ea(e, t);
          l !== null && vt(l, e, t), js(e, t);
        }
      }, xe.attemptSynchronousHydration = function(e) {
        switch (e.tag) {
          case 3:
            if (e = e.stateNode, e.current.memoizedState.isDehydrated) {
              var t = S(e.pendingLanes);
              if (t !== 0) {
                for (e.pendingLanes |= 2, e.entangledLanes |= 2; t; ) {
                  var l = 1 << 31 - Et(t);
                  e.entanglements[1] |= l, t &= ~l;
                }
                Wt(e), (we & 6) === 0 && (Cl = yt() + 500, Ea(0));
              }
            }
            break;
          case 31:
          case 13:
            t = ea(e, 2), t !== null && vt(t, e, 2), fd(), js(e, 2);
        }
      }, xe.batchedUpdates = function(e, t) {
        return e(t);
      }, xe.createComponentSelector = function(e) {
        return { $$typeof: Gr, value: e };
      }, xe.createContainer = function(e, t, l, o, d, p, v, M, Y, $) {
        return Ad(
          e,
          t,
          !1,
          null,
          l,
          o,
          p,
          null,
          v,
          M,
          Y,
          $
        );
      }, xe.createHasPseudoClassSelector = function(e) {
        return { $$typeof: Yr, value: e };
      }, xe.createHydrationContainer = function(e, t, l, o, d, p, v, M, Y, $, ne, P, le, ge) {
        return e = Ad(
          l,
          o,
          !0,
          e,
          d,
          p,
          M,
          ge,
          Y,
          $,
          ne,
          P
        ), e.context = Md(null), l = e.current, o = _t(), o = R(o), d = _n(o), d.callback = t ?? null, Sn(l, d, o), t = o, e.current.lanes = t, V(e, t), Wt(e), e;
      }, xe.createPortal = function(e, t, l) {
        var o = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: Aa,
          key: o == null ? null : "" + o,
          children: e,
          containerInfo: t,
          implementation: l
        };
      }, xe.createRoleSelector = function(e) {
        return { $$typeof: Qr, value: e };
      }, xe.createTestNameSelector = function(e) {
        return { $$typeof: Vr, value: e };
      }, xe.createTextSelector = function(e) {
        return { $$typeof: Zr, value: e };
      }, xe.defaultOnCaughtError = function(e) {
        console.error(e);
      }, xe.defaultOnRecoverableError = function(e) {
        cf(e);
      }, xe.defaultOnUncaughtError = function(e) {
        cf(e);
      }, xe.deferredUpdates = function(e) {
        var t = de.T, l = fn();
        try {
          return et(32), de.T = null, e();
        } finally {
          et(l), de.T = t;
        }
      }, xe.discreteUpdates = function(e, t, l, o, d) {
        var p = de.T, v = fn();
        try {
          return et(2), de.T = null, e(t, l, o, d);
        } finally {
          et(v), de.T = p, we === 0 && (Cl = yt() + 500);
        }
      }, xe.findAllNodes = zs, xe.findBoundingRects = function(e, t) {
        if (!vl) throw Error(s(363));
        t = zs(e, t), e = [];
        for (var l = 0; l < t.length; l++)
          e.push(Qh(t[l]));
        for (t = e.length - 1; 0 < t; t--) {
          l = e[t];
          for (var o = l.x, d = o + l.width, p = l.y, v = p + l.height, M = t - 1; 0 <= M; M--)
            if (t !== M) {
              var Y = e[M], $ = Y.x, ne = $ + Y.width, P = Y.y, le = P + Y.height;
              if (o >= $ && p >= P && d <= ne && v <= le) {
                e.splice(t, 1);
                break;
              } else if (o !== $ || l.width !== Y.width || le < p || P > v) {
                if (!(p !== P || l.height !== Y.height || ne < o || $ > d)) {
                  $ > o && (Y.width += $ - o, Y.x = o), ne < d && (Y.width = d - $), e.splice(t, 1);
                  break;
                }
              } else {
                P > p && (Y.height += P - p, Y.y = p), le < v && (Y.height = v - P), e.splice(t, 1);
                break;
              }
            }
        }
        return e;
      }, xe.findHostInstance = Rd, xe.findHostInstanceWithNoPortals = function(e) {
        return e = u(e), e = e !== null ? h(e) : null, e === null ? null : bl(e.stateNode);
      }, xe.findHostInstanceWithWarning = function(e) {
        return Rd(e);
      }, xe.flushPassiveEffects = gl, xe.flushSyncFromReconciler = function(e) {
        var t = we;
        we |= 1;
        var l = de.T, o = fn();
        try {
          if (et(2), de.T = null, e)
            return e();
        } finally {
          et(o), de.T = l, we = t, (we & 6) === 0 && Ea(0);
        }
      }, xe.flushSyncWork = fd, xe.focusWithin = function(e, t) {
        if (!vl) throw Error(s(363));
        for (e = _s(e), t = od(e, t), t = Array.from(t), e = 0; e < t.length; ) {
          var l = t[e++], o = l.tag;
          if (!yl(l)) {
            if ((o === 5 || o === 26 || o === 27) && Xh(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
          }
        }
        return !1;
      }, xe.getFindAllNodesFailureDescription = function(e, t) {
        if (!vl) throw Error(s(363));
        var l = 0, o = [];
        e = [_s(e), 0];
        for (var d = 0; d < e.length; ) {
          var p = e[d++], v = p.tag, M = e[d++], Y = t[M];
          if ((v !== 5 && v !== 26 && v !== 27 || !yl(p)) && (Ss(p, Y) && (o.push(Es(Y)), M++, M > l && (l = M)), M < t.length))
            for (p = p.child; p !== null; )
              e.push(p, M), p = p.sibling;
        }
        if (l < t.length) {
          for (e = []; l < t.length; l++)
            e.push(Es(t[l]));
          return `findAllNodes was able to match part of the selector:
  ` + (o.join(" > ") + `

No matching component was found for:
  `) + e.join(" > ");
        }
        return null;
      }, xe.getPublicRootInstance = function(e) {
        if (e = e.current, !e.child) return null;
        switch (e.child.tag) {
          case 27:
          case 5:
            return bl(e.child.stateNode);
          default:
            return e.child.stateNode;
        }
      }, xe.injectIntoDevTools = function() {
        var e = {
          bundleType: 0,
          version: wh,
          rendererPackageName: kh,
          currentDispatcherRef: de,
          reconcilerVersion: "19.2.0"
        };
        if (Ud !== null && (e.rendererConfig = Ud), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") e = !1;
        else {
          var t = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (t.isDisabled || !t.supportsFiber) e = !0;
          else {
            try {
              xl = t.inject(e), zt = t;
            } catch {
            }
            e = !!t.checkDCE;
          }
        }
        return e;
      }, xe.isAlreadyRendering = function() {
        return (we & 6) !== 0;
      }, xe.observeVisibleRects = function(e, t, l, o) {
        if (!vl) throw Error(s(363));
        e = zs(e, t);
        var d = Kh(
          e,
          l,
          o
        ).disconnect;
        return {
          disconnect: function() {
            d();
          }
        };
      }, xe.shouldError = function() {
        return null;
      }, xe.shouldSuspend = function() {
        return !1;
      }, xe.startHostTransition = function(e, t, l, o) {
        if (e.tag !== 5) throw Error(s(476));
        var d = gu(e).queue;
        hu(
          e,
          d,
          t,
          Ra,
          l === null ? i : function() {
            var p = gu(e);
            return p.next === null && (p = e.alternate.memoizedState), cl(
              e,
              p.next.queue,
              {},
              _t()
            ), l(o);
          }
        );
      }, xe.updateContainer = function(e, t, l, o) {
        var d = t.current, p = _t();
        return jd(
          d,
          p,
          e,
          t,
          l,
          o
        ), p;
      }, xe.updateContainerSync = function(e, t, l, o) {
        return jd(
          t.current,
          2,
          e,
          t,
          l,
          o
        ), 2;
      }, xe;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(yo)), yo.exports;
}
var Mf;
function G0() {
  return Mf || (Mf = 1, vo.exports = L0()), vo.exports;
}
var Y0 = G0();
const Op = /* @__PURE__ */ nc(Y0);
var ko = { exports: {} }, vn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Rf;
function Q0() {
  return Rf || (Rf = 1, vn.ConcurrentRoot = 1, vn.ContinuousEventPriority = 8, vn.DefaultEventPriority = 32, vn.DiscreteEventPriority = 2, vn.IdleEventPriority = 268435456, vn.LegacyRoot = 0, vn.NoEventPriority = 0), vn;
}
var jf;
function V0() {
  return jf || (jf = 1, ko.exports = Q0()), ko.exports;
}
var Pa = V0();
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
const Dp = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Oo = 16, ac = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), Z0 = [
  ["html", { display: "block", "font-size": "16px", "font-family": "Times", color: "#000000", "line-height": "normal" }],
  ["body", { display: "block", margin: "8px" }],
  ["div, section, aside, p, nav, header, footer, main, ul, ol, li, form, label[hidden]", { display: "block" }],
  ["datalist, template, script, style, head, title", { display: "none" }],
  ["p", { "margin-top": "1em", "margin-bottom": "1em" }],
  ["strong, b", { "font-weight": "bold" }],
  ["em, i", { "font-style": "italic" }],
  ["kbd, code, samp, pre", { "font-family": "monospace" }],
  ["button, input, select, textarea", {
    display: "inline-block",
    "font-family": "system-ui",
    "font-size": "11px",
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
  // A check box or radio button is WebKit's 12 px control with its margins (the reference's memory switch: 12 x 12,
  // 2 px from the label's edge, its row 18 px high).
  ['input[type="checkbox"], input[type="radio"]', { width: "12px", height: "12px", margin: "3px 2px", padding: "0", "border-width": "0", "box-sizing": "border-box" }],
  ["svg", { overflow: "hidden" }],
  ["[hidden]", { display: "none" }]
], Of = {
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
}, X0 = /* @__PURE__ */ new Set([
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
]), Bp = {
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
}, Hp = {
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
}, Do = ["font-size", "color", ...new Set([...Object.keys(Bp), ...Object.keys(Hp)].filter((n) => n !== "font-size" && n !== "color"))], K0 = new Set(Do);
function ct(n, a = " ") {
  const r = [];
  let i = 0, s = "";
  for (let c = 0; c < n.length; c++) {
    const f = n[c];
    if (f === "(" ? i++ : f === ")" && i--, i === 0 && (a === " " ? /\s/.test(f) : f === a)) {
      (s.trim() || a !== " ") && r.push(s.trim()), s = "";
      continue;
    }
    s += f;
  }
  return (s.trim() || a !== " " && r.length) && r.push(s.trim()), r;
}
function Bo(n, a, r = 0) {
  if (r > 32) return null;
  let i = "", s = 0;
  for (; ; ) {
    const c = n.indexOf("var(", s);
    if (c < 0)
      return i += n.slice(s), i;
    i += n.slice(s, c);
    let f = 1, u = c + 4;
    for (; u < n.length && f; u++)
      n[u] === "(" ? f++ : n[u] === ")" && f--;
    const m = n.slice(c + 4, u - 1), h = ct(m, ","), k = h[0].trim(), g = h.length > 1 ? m.slice(m.indexOf(",") + 1).trim() : null;
    let b = a(k);
    if ((b == null || b === "initial") && (b = g), b == null) return null;
    const E = Bo(b, a, r + 1);
    if (E === null) return null;
    i += E, s = u;
  }
}
function J0(n) {
  const a = [], r = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let i, s = 0;
  for (; s < n.length; ) {
    if (r.lastIndex = s, i = r.exec(n), !i || i.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = r.lastIndex, i[1] !== void 0 ? a.push({ num: parseFloat(i[1]), unit: (i[2] ?? "").toLowerCase() }) : i[3] ? a.push({ fn: i[3].toLowerCase() }) : i[4] ? a.push({ num: 1 / 0, unit: "" }) : a.push({ op: i[5] ?? i[6] });
  }
  return a;
}
function Kn(n, a) {
  const r = J0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!r) return null;
  let i = 0;
  const s = ({ num: b, unit: E }) => {
    switch (E) {
      case "":
        return { px: 0, pct: 0, num: b, unitless: !0 };
      case "px":
        return { px: b, pct: 0, num: 0 };
      case "rem":
        return { px: b * Oo, pct: 0, num: 0 };
      case "em":
        return { px: b * (a.fontSize ?? Oo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: b, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: b / 100 * (a.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: b / 100 * (a.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: b * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, c = (b, E, _) => b && E ? { px: b.px + _ * E.px, pct: b.pct + _ * E.pct, num: b.num + _ * E.num, unitless: b.unitless && E.unitless } : null, f = (b, E) => b ? { px: b.px * E, pct: b.pct * E, num: b.num * E, unitless: b.unitless } : null, u = (b) => b && b.unitless;
  function m() {
    const b = r[i++];
    if (!b) return null;
    if (b.num !== void 0) return s(b);
    if (b.op === "(") {
      const E = k();
      return r[i]?.op !== ")" ? null : (i++, E);
    }
    if (b.op === "-" || b.op === "+") {
      const E = m();
      return b.op === "-" ? f(E, -1) : E;
    }
    if (b.fn) {
      const E = [];
      for (; ; ) {
        E.push(k());
        const S = r[i++];
        if (!S) return null;
        if (S.op === ")") break;
        if (S.op !== ",") return null;
      }
      if (E.some((S) => !S)) return null;
      if (b.fn === "calc") return E[0];
      if (!(E.every((S) => !S.pct) || E.every((S) => !S.px && !S.num))) return null;
      const z = (S) => S.px + S.pct + S.num;
      return b.fn === "min" ? E.reduce((S, N) => z(N) < z(S) ? N : S) : b.fn === "max" ? E.reduce((S, N) => z(N) > z(S) ? N : S) : b.fn === "clamp" && E.length === 3 ? z(E[1]) < z(E[0]) ? E[0] : z(E[1]) > z(E[2]) ? E[2] : E[1] : null;
    }
    return null;
  }
  function h() {
    let b = m();
    for (; r[i] && (r[i].op === "*" || r[i].op === "/"); ) {
      const E = r[i++].op, _ = m();
      if (!b || !_) return null;
      E === "*" ? b = u(_) ? f(b, _.num) : u(b) ? f(_, b.num) : null : b = u(_) && _.num !== 0 ? f(b, 1 / _.num) : null;
    }
    return b;
  }
  function k() {
    let b = h();
    for (; r[i] && (r[i].op === "+" || r[i].op === "-"); ) {
      const E = r[i++].op;
      b = c(b, h(), E === "-" ? -1 : 1);
    }
    return b;
  }
  const g = k();
  return i !== r.length || !g ? null : g;
}
function Ho(n, a) {
  const r = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(r))
    return r === "thin" ? { px: 1 } : r === "medium" ? { px: 3 } : r === "thick" ? { px: 5 } : r;
  const i = Kn(r, a);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: W0(i.px) } : { expr: n.trim() };
}
const W0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Wr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), $0 = ([n, a, r, i]) => `#${Wr(n)}${Wr(a)}${Wr(r)}${Wr(i * 255)}`;
function Df(n) {
  const a = n.slice(1), r = a.length <= 4 ? a.split("").map((s) => s + s).join("") : a;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(r)) return null;
  const i = (s) => parseInt(r.slice(s, s + 2), 16);
  return [i(0), i(2), i(4), r.length === 8 ? i(6) / 255 : 1];
}
function hi(n, a) {
  const r = n.trim().toLowerCase();
  if (r === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(r);
  if (i) {
    const h = a(i[1]), k = h && Df(h);
    return k ? { rgba: k, token: i[1] } : null;
  }
  if (r.startsWith("#")) {
    const h = Df(r);
    return h ? { rgba: h, token: null } : null;
  }
  if (Of[r]) return { rgba: [...Of[r]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(r);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const h = ct(s[2], ",");
    if (h.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(h[0])) return null;
    const k = (B) => {
      const W = ct(B), F = W.findIndex((I) => /%$/.test(I)), q = F >= 0 ? parseFloat(W[F]) / 100 : null;
      return { color: hi(W.filter((I, Q) => Q !== F).join(" "), a), pct: q };
    }, g = k(h[1]), b = k(h[2]);
    if (!g.color || !b.color || g.color === "currentcolor" || b.color === "currentcolor") return null;
    let E = g.pct, _ = b.pct;
    E === null && _ === null ? (E = 0.5, _ = 0.5) : E === null ? E = 1 - _ : _ === null && (_ = 1 - E);
    const z = E + _, S = z < 1 ? z : 1;
    E /= z, _ /= z;
    const [N, D, j, X] = g.color.rgba, [U, V, w, x] = b.color.rgba, y = X * E + x * _, T = (B, W) => y === 0 ? 0 : (B * X * E + W * x * _) / y, R = [T(N, U), T(D, V), T(j, w), y * S], C = x === 0 ? g.color.token : X === 0 ? b.color.token : null;
    return { rgba: R, token: C };
  }
  const c = s[2].includes(",") ? ct(s[2], ",") : ct(s[2].replace("/", " / ")).filter((h) => h !== "/");
  if (c.length < 3) return null;
  const f = (h) => h.endsWith("%") ? parseFloat(h) / 100 * 255 : parseFloat(h), u = c[3] === void 0 ? 1 : c[3].endsWith("%") ? parseFloat(c[3]) / 100 : parseFloat(c[3]), m = [f(c[0]), f(c[1]), f(c[2]), u];
  return m.some((h) => Number.isNaN(h)) ? null : { rgba: m, token: null };
}
const Bl = ["top", "right", "bottom", "left"], F0 = ["top-left", "top-right", "bottom-right", "bottom-left"], $r = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Bf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Uo(n, a) {
  const r = a.trim(), i = () => ct(r);
  switch (n) {
    case "padding":
    case "margin": {
      const s = $r(i());
      return Bl.map((c, f) => [`${n}-${c}`, s[f]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = i(), c = n.split("-")[0];
      return [[`${c}-left`, s[0]], [`${c}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = i(), c = n.split("-")[0];
      return [[`${c}-top`, s[0]], [`${c}-bottom`, s[1] ?? s[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${n.split("-")[0]}-left`, r]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, r]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, r]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, r]];
    case "inset": {
      const s = $r(i());
      return Bl.map((c, f) => [c, s[f]]);
    }
    case "inset-inline": {
      const s = i();
      return [["left", s[0]], ["right", s[1] ?? s[0]]];
    }
    case "inset-block": {
      const s = i();
      return [["top", s[0]], ["bottom", s[1] ?? s[0]]];
    }
    case "inset-inline-start":
      return [["left", r]];
    case "inset-inline-end":
      return [["right", r]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const s = n.split("-")[1], c = $r(i());
      return Bl.map((f, u) => [`border-${f}-${s}`, c[u]]);
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
      const s = n === "border" ? Bl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let c = "medium", f = "none", u = "currentcolor";
      if (r !== "none" && r !== "0")
        for (const m of i())
          Bf.has(m) ? f = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? c = m : u = m;
      else r === "0" && (c = "0");
      return s.flatMap((m) => [[`border-${m}-width`, c], [`border-${m}-style`, f], [`border-${m}-color`, u]]);
    }
    case "border-inline-width": {
      const s = i();
      return [["border-left-width", s[0]], ["border-right-width", s[1] ?? s[0]]];
    }
    case "border-block-width": {
      const s = i();
      return [["border-top-width", s[0]], ["border-bottom-width", s[1] ?? s[0]]];
    }
    case "border-inline-style": {
      const s = i();
      return [["border-left-style", s[0]], ["border-right-style", s[1] ?? s[0]]];
    }
    case "border-inline-color": {
      const s = i();
      return [["border-left-color", s[0]], ["border-right-color", s[1] ?? s[0]]];
    }
    case "border-radius": {
      const s = $r(ct(r.split("/")[0]));
      return F0.map((c, f) => [`border-${c}-radius`, s[f]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", r]];
    case "border-start-end-radius":
      return [["border-top-right-radius", r]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", r]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", r]];
    case "background":
      return r === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : hi(r, () => "#000000") ? [["background-color", r], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", r]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(r) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((s) => [s, r]) : [[n, r]];
    case "overflow": {
      const s = i();
      return [["overflow-x", s[0]], ["overflow-y", s[1] ?? s[0]]];
    }
    case "gap": {
      const s = i();
      return [["row-gap", s[0]], ["column-gap", s[1] ?? s[0]]];
    }
    case "grid-gap":
      return Uo("gap", r);
    case "place-items": {
      const s = i();
      return [["align-items", s[0]], ["justify-items", s[1] ?? s[0]]];
    }
    case "place-self": {
      const s = i();
      return [["align-self", s[0]], ["justify-self", s[1] ?? s[0]]];
    }
    case "place-content": {
      const s = i();
      return [["align-content", s[0]], ["justify-content", s[1] ?? s[0]]];
    }
    case "flex": {
      if (r === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (r === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (r === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const s = i(), c = s.filter((u) => /^[\d.]+$/.test(u)), f = s.find((u) => !/^[\d.]+$/.test(u));
      return [["flex-grow", c[0] ?? "1"], ["flex-shrink", c[1] ?? "1"], ["flex-basis", f ?? (c.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const c of i()) s.push(/wrap/.test(c) ? ["flex-wrap", c] : ["flex-direction", c]);
      return s;
    }
    case "outline": {
      if (r === "none" || r === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", c = "none", f = "currentcolor";
      for (const u of i())
        Bf.has(u) || u === "auto" ? c = u : /^(thin|medium|thick|-?[\d.]|calc\()/.test(u) ? s = u : f = u;
      return [["outline-width", s], ["outline-style", c], ["outline-color", f]];
    }
    case "transition": {
      if (r === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ct(r, ","), c = s.map((u) => ct(u).find((m) => !/^[\d.]+m?s$/.test(m) && !/^(ease|linear|step|cubic)/.test(m)) ?? "all"), f = s.map((u) => ct(u).find((m) => /^[\d.]+m?s$/.test(m)) ?? "0s");
      return [["transition-property", c.join(", ")], ["transition-duration", f.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", i()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", r]];
    case "word-wrap":
      return [["overflow-wrap", r]];
    default:
      return [[n, r]];
  }
}
function I0(n, a) {
  return n ? ct(n, ",").some((r) => {
    let i = r.trim().toLowerCase(), s = !1;
    i.startsWith("not ") && (s = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const c = i.split(/\s+and\s+/).every((f) => {
      if (f = f.trim(), f === "all" || f === "screen") return !0;
      if (f === "print") return !1;
      const u = /^\((.+)\)$/.exec(f);
      if (!u) return !1;
      const m = u[1].trim(), h = /^([a-z-]+)\s*:\s*(.+)$/.exec(m);
      if (h) {
        const [, g, b] = h, E = (_) => {
          const z = Ho(_, { viewport: a });
          return typeof z == "object" && "px" in z ? z.px : NaN;
        };
        switch (g) {
          case "min-width":
            return a.width >= E(b);
          case "max-width":
            return a.width <= E(b);
          case "min-height":
            return a.height >= E(b);
          case "max-height":
            return a.height <= E(b);
          case "hover":
          case "any-hover":
            return b.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return b.trim() === "fine";
          case "prefers-reduced-motion":
            return b.trim() === "no-preference";
          case "prefers-color-scheme":
            return b.trim() === (a.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const k = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(m);
      if (k) {
        const g = k[1] === "width" ? a.width : a.height, b = Ho(k[3], { viewport: a }), E = typeof b == "object" && "px" in b ? b.px : NaN;
        switch (k[2]) {
          case ">=":
            return g >= E;
          case "<=":
            return g <= E;
          case ">":
            return g > E;
          case "<":
            return g < E;
          default:
            return g === E;
        }
      }
      return !1;
    });
    return s ? !c : c;
  }) : !0;
}
function P0(n, a) {
  const r = a[a.length - 1].compound;
  return lc(r)[0] ?? n;
}
function eb(n) {
  const a = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = (s, c) => {
    s.forEach(({ compound: f }, u) => {
      const m = c && u === s.length - 1;
      for (const h of f.pseudos)
        if (ac.has(h.name) && (m ? a : r).add(h.name), h.list && h.name !== "not") for (const k of h.list) i(k, m);
    });
  };
  return i(n, !0), { subject: a, ancestor: r };
}
function lc(n) {
  const a = [...n.classes];
  for (const r of n.pseudos)
    if (!(r.name !== "is" && r.name !== "where"))
      for (const i of r.list) i.length === 1 && a.push(...lc(i[0].compound));
  return a;
}
function tb(n, a) {
  const r = (i, s) => {
    i.forEach(({ compound: c }, f) => {
      const u = s && f === i.length - 1, m = c.pseudos.filter((h) => ac.has(h.name)).map((h) => h.name);
      if (!u) for (const h of m) for (const k of lc(c)) a.add(`${h}:${k}`);
      for (const h of c.pseudos) if (h.list && h.name !== "not") for (const k of h.list) r(k, u);
    });
  };
  r(n, !0);
}
class nb {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const r = (c, f) => {
      const u = f[f.length - 1].compound, m = u.classes.length ? `.${u.classes[0]}` : u.tag && u.tag !== "*" ? u.tag : "*";
      this.index.has(m) || this.index.set(m, []), this.index.get(m).push(c);
    };
    let i = 0;
    const s = (c, f) => {
      for (const [u, m, h, k] of c)
        for (const g of Po(u)) {
          let b;
          try {
            b = ec(g);
          } catch (S) {
            if (S instanceof ot) {
              this.skipped++;
              continue;
            }
            throw S;
          }
          const E = eb(b);
          tb(b, this.trackedStates);
          const _ = b[b.length - 1].compound.pseudoElement, z = { steps: b, media: m, layer: h, origin: f, order: i++, specificity: Sp(b), decls: k, states: E, pseudo: _, own: ib(b), above: lb(b), source: f === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : P0(g, b) };
          this.rules.push(z), r(z, b);
        }
    };
    s(Z0.map(([c, f]) => [c, null, 0, Object.entries(f)]), 0), s(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, r = null) {
    const i = `${a.tagName} ${a.className}|${r ?? ""}`, s = this.candidateCache.get(i);
    if (s) return s;
    const c = [], f = /* @__PURE__ */ new Set(), u = (m) => {
      if (m) for (const h of m) !f.has(h) && h.pseudo === r && (f.add(h), c.push(h));
    };
    for (const m of a.classList) u(this.index.get(`.${m}`));
    return u(this.index.get(a.tagName)), u(this.index.get("*")), this.candidateCache.set(i, c), c;
  }
  /** What the rules that may match `element` (any pseudo-element) read besides the element and its parent's computed
   * style: `anc`, an ancestor's attributes or state; `pos`, whether it is its parent's first or last child; `nth`, its
   * index; `ancPos`, an ancestor's position. The description's cache keys on exactly these (`describe.mjs`). */
  depends(a) {
    const r = `${a.tagName} ${a.className}`;
    let i = this.dependsCache.get(r);
    if (i) return i;
    i = { anc: !1, pos: !1, nth: !1, ancPos: !1 };
    const s = /* @__PURE__ */ new Set(), c = (f) => {
      for (const u of f ?? []) {
        if (s.has(u)) continue;
        s.add(u);
        const m = u.reads ??= qp(u.steps);
        i.anc ||= m.anc, i.pos ||= m.pos, i.nth ||= m.nth, i.ancPos ||= m.ancPos;
      }
    };
    for (const f of a.classList) c(this.index.get(`.${f}`));
    return c(this.index.get(a.tagName)), c(this.index.get("*")), this.dependsCache.set(r, i), i;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(a, r) {
    return this.candidates(a).some((i) => i.states.ancestor.has(r));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(a, r) {
    for (const i of a.classList) if (this.trackedStates.has(`${r}:${i}`)) return !0;
    return !1;
  }
}
const ab = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function lb(n) {
  const a = [];
  for (let r = n.length - 1; r > 0 && !(n[r].combinator !== " " && n[r].combinator !== ">"); r--)
    a.push(...n[r - 1].compound.classes);
  return a;
}
function Up(n) {
  const a = n.parentElement;
  if (!a) return rb;
  const r = Up(a), i = n.aboveCache;
  if (i && i.parent === a && i.name === a.className && i.base === r) return i.set;
  const s = a.classSet, c = s.size === 0 ? r : /* @__PURE__ */ new Set([...r, ...s]);
  return n.aboveCache = { parent: a, name: a.className, base: r, set: c }, c;
}
const rb = /* @__PURE__ */ new Set();
function ib(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((r) => ac.has(r.name) && r.name !== "focus-within");
}
function qp(n, a = !0, r = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((i, s) => {
    const c = a && s === n.length - 1;
    c || (r.anc = !0);
    for (const f of i.compound.pseudos)
      if (ab.has(f.name) && (c ? r.pos = !0 : r.ancPos = !0, f.name === "nth-child" && c && (r.nth = !0)), f.list && f.name !== "has") for (const u of f.list) qp(u, c, r);
  }), r;
}
const sb = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function ob(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [r, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = r.startsWith("--") ? r : r.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), c = typeof i == "number" && i !== 0 && !sb.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    a.push([s, c]);
  }
  return a;
}
function cb(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const r of ["width", "height"]) {
    const i = n.getAttribute(r);
    i !== null && a.push([r, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return a;
}
const ub = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class db {
  constructor(a, { theme: r, viewport: i }) {
    this.sheet = a, this.theme = r, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const r of a.media) {
      let i = this.media.get(r);
      if (i === void 0 && this.media.set(r, i = I0(r, this.viewport)), !i) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, r, i = null) {
    const c = { state: (g, b, E) => {
      if (b === "disabled") return !!g.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(g.tagName);
      if (b === "enabled") return !g.props?.disabled && ["button", "input", "select", "textarea"].includes(g.tagName);
      if (b === "checked") return !!g.props?.checked;
      if (r === "*") return !0;
      if (b === "focus-within") {
        const _ = g.ownerDocument?.activeElement;
        return !!_ && _ !== g.ownerDocument.body && typeof g.contains == "function" && g.contains(_);
      }
      return E ? r.has(b) : b === "focus-visible" ? !!g.state?.focus && !g.state?.pointerFocus : !!g.state?.[b];
    }, pseudo: i }, f = this.sheet.candidates(a, i), u = `${a.tagName} ${a.className}|${i ?? ""}|${r === "*" ? "*" : [...r].sort().join(",")}`;
    let m = this.ownMatches.get(u);
    m || (m = new Set(f.filter((g) => g.own && this.mediaHolds(g) && Co(a, g.steps, c))), this.ownMatches.set(u, m));
    let h = null;
    const k = (g) => g.above.length ? (h ??= Up(a), g.above.every((b) => h.has(b))) : !0;
    return f.filter((g) => g.own ? m.has(g) : this.mediaHolds(g) && k(g) && Co(a, g.steps, c));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, r, i = /* @__PURE__ */ new Set(), s = null) {
    const c = this.matching(a, i, s), f = s ? [] : cb(a), u = s ? [] : ob(a.inlineStyle ?? a.props?.style);
    let m = this.rootComputed;
    r && (m = this.computed.get(r.values), m || this.computed.set(r.values, m = /* @__PURE__ */ new Map()));
    const h = `${c.map((g) => g.order).join(",")}|${f.length ? JSON.stringify(f) : ""}|${u.length ? JSON.stringify(u) : ""}`;
    let k = m.get(h);
    return k || m.set(h, k = this.cascade(c, f, u, r)), { ...k, rules: c, element: a };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, r, i, s) {
    const c = [];
    for (const w of a)
      for (const [x, y, T] of w.decls) c.push({ prop: x, value: y, important: T ? 1 : 0, origin: w.origin === 0 ? 0 : 2, layer: w.layer, specificity: w.specificity, order: w.order, source: w.source });
    for (const [w, x] of r) c.push({ prop: w, value: x, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${w}` });
    for (const [w, x] of i) c.push({ prop: w, value: x, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    c.sort(ub);
    const f = this.sheet.properties, u = Object.create(s?.customs ?? null), m = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map();
    for (const w of c) w.prop.startsWith("--") && h.set(w.prop, w.value);
    if (!s && this.theme) for (const w of Dp) this.theme[w] && h.set(`--${w}`, `perchtoken(${w})`);
    const k = (w) => {
      if (m.has(w)) return m.get(w);
      const x = f[w];
      return x && !x.inherits ? x.initial ?? null : w in u ? u[w] : x?.initial ?? null;
    }, g = /* @__PURE__ */ new Set(), b = (w) => {
      if (!h.has(w)) return k(w);
      if (g.has(w)) return null;
      g.add(w);
      const x = Bo(h.get(w), b);
      return g.delete(w), h.delete(w), m.set(w, x), (!f[w] || f[w].inherits) && (u[w] = x), x;
    };
    for (const w of [...h.keys()]) b(w);
    const E = /* @__PURE__ */ new Map();
    for (const w of c) {
      if (w.prop.startsWith("--")) continue;
      const x = Bo(w.value, k);
      if (x === null) {
        for (const [y] of Uo(w.prop, "unset")) E.set(y, { value: "unset", source: w.source, origin: w.origin });
        continue;
      }
      for (const [y, T] of Uo(w.prop, x)) E.set(y, { value: T, source: w.source, origin: w.origin });
    }
    const _ = {}, z = {}, S = /* @__PURE__ */ new Set(), N = /* @__PURE__ */ new Set(), D = s?.values, j = { fontSize: D?.["font-size"] ?? Oo, viewport: this.viewport }, X = (w, x) => {
      if (/currentcolor/i.test(x)) return this.parseValue(w, x, j, _, D);
      const y = `${w}\0${x}\0${j.fontSize}`;
      let T = this.parsed.get(y);
      return T === void 0 && this.parsed.set(y, T = this.parseValue(w, x, j, _, D)), T;
    }, U = E.size ? [...Do, ...[...E.keys()].filter((w) => !K0.has(w))] : Do;
    for (const w of U) {
      const x = E.get(w);
      let y = x?.value;
      const T = X0.has(w);
      if ((y === void 0 || y === "unset" || y === "revert" || y === "revert-layer") && (y = T ? "inherit" : "initial"), x && (z[w] = x.source, x.origin !== 0 && S.add(w)), y === "inherit" && D && w in D) {
        _[w] = D[w], N.add(w);
        continue;
      }
      (y === "inherit" || y === "initial") && (y = T ? Hp[w] : Bp[w]), _[w] = X(w, y), w === "font-size" && (j.fontSize = _["font-size"]);
    }
    for (const w of Bl) {
      const x = _[`border-${w}-style`];
      (x === "none" || x === "hidden") && (_[`border-${w}-width`] = { px: 0 });
    }
    _["outline-style"] === "none" && (_["outline-width"] = { px: 0 });
    const V = D?.display;
    return (V === "flex" || V === "inline-flex" || V === "grid" || V === "inline-grid") && _.position !== "absolute" && _.position !== "fixed" && (_.display = Hf(_.display)), (_.position === "absolute" || _.position === "fixed") && (_.display = Hf(_.display)), { values: _, sources: z, own: S, inherited: N, customs: u };
  }
  parseValue(a, r, i, s, c) {
    const f = String(r).trim();
    switch (a) {
      case "font-size": {
        const u = f.toLowerCase(), m = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (m[u]) return m[u];
        if (u === "smaller") return i.fontSize / 1.2;
        if (u === "larger") return i.fontSize * 1.2;
        const h = Kn(u, { fontSize: i.fontSize, viewport: i.viewport });
        return !h || h.num ? i.fontSize : h.px + h.pct / 100 * i.fontSize;
      }
      case "font-weight": {
        const u = f.toLowerCase();
        if (u === "normal") return 400;
        if (u === "bold") return 700;
        if (u === "bolder") return (c?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (u === "lighter") return (c?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const m = parseFloat(u);
        return Number.isFinite(m) ? m : 400;
      }
      case "line-height": {
        const u = f.toLowerCase();
        if (u === "normal") return { normal: !0 };
        const m = Kn(u, { fontSize: i.fontSize, viewport: i.viewport });
        return m ? m.unitless ? { factor: m.num } : { px: m.px + m.pct / 100 * i.fontSize } : { normal: !0 };
      }
      case "font-family":
        return f;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const u = f.endsWith("%") ? parseFloat(f) / 100 : parseFloat(f);
        return Number.isFinite(u) ? u : parseFloat(a === "flex-shrink" || a === "opacity" ? 1 : 0);
      }
      case "color": {
        const u = hi(f, (m) => this.themeHex(m));
        return u === "currentcolor" || !u ? c?.color ?? { rgba: [0, 0, 0, 1], token: null } : u;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const u = hi(f, (m) => this.themeHex(m));
        return u === "currentcolor" ? s.color : u ?? { rgba: [0, 0, 0, 0], token: null, unreadable: f };
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
        return Ho(f, i);
      default:
        return f.toLowerCase().startsWith("var(") ? f : /^[a-z-]+$/i.test(f) ? f.toLowerCase() : f;
    }
  }
}
function Hf(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const gi = (n) => n && n.rgba ? { value: $0(n.rgba), token: n.token ?? null } : null, fb = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function pb(n, a) {
  const r = a?.(n);
  if (Number.isFinite(r)) return r;
  const i = Math.round(n * 100) / 100;
  return fb[i] ?? Math.round(n * 1.2);
}
function ql(n, a) {
  const r = n["line-height"], i = n["font-size"];
  return r.normal ? pb(i, a) : r.factor !== void 0 ? r.factor * i : r.px;
}
const mb = (n) => ct(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
//! - `{ kind: "engine", id, engine, key, style }`: a box the host fills with a native element (`data-perch-engine`,
//!   `data-perch-key`; `gpui.mjs` draws `files.engine(engine, key)` in it)
//! - `{ kind: "input", id, value, placeholder, checked, input_type, style, ... }` (`value`: what the field holds,
//!   typed text included; `field_w`: a line field's content width when its content sizes it)
//! - `break_anywhere` on a node whose text breaks a word too long for its line anywhere (`overflow-wrap`)
//! - `blocks_pointer` on a node that takes pointer events under an ancestor that lets them through; `pointer_none` on
//!   one that lets them through (the wheel too); `tabular` on one
//!   whose digits are tabular; `scrollbar` (its width) on a vertical scroller
//! - a node `mount` was given a parity table for (`options.names`) carries `name` (`name` or `name:key`, the engine
//!   id tests find it by) and, for a name that is the element's own text, `range_name`.
//! - letter-spaced text is a `div` (no `id`) around the run with the spacing as room after it.
//!
//! Text styles follow GPUI's inheritance: a node carries a text style when it sets one itself (so an ancestor's
//! hover colour does not reach it, as in CSS) or when the inherited value would differ (`line-height: normal`, a
//! multiplier under a new size). `tokens` names the theme token each colour came from.
const hb = "perch-native-description/1", Xt = Symbol("display"), bi = {
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
}, gb = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of gb) bi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
bi.rounded = 0;
const bb = /* @__PURE__ */ new Set([
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
]), vb = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, yb = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, xb = (n) => yb.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : vb.test(n) ? ".SystemUIFont" : mb(n).split(",")[0].trim(), wb = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"],
  scroll: ["onScroll"]
}, Uf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, rc = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const r = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (r) return `${n.tagName}.${r}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${rc(i)} > ${n.tagName}` : n.tagName;
};
class kb {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(a, r, i, s, c, f = "") {
    const u = `${a}|${r}|${i}|${s}`, m = this.map.get(u);
    if (m) {
      !m.elements.includes(c) && m.elements.length < 4 && m.elements.push(c), m.count++;
      return;
    }
    this.map.set(u, { kind: a, property: r, value: String(i), class: s ?? null, elements: [c], count: 1, ...f ? { note: f } : {} });
  }
  list() {
    return [...this.map.values()].sort((a, r) => a.kind < r.kind ? -1 : a.kind > r.kind ? 1 : a.property < r.property ? -1 : a.property > r.property ? 1 : 0);
  }
}
const xn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, _b = /^(text|search|url|email|tel|password|number)$/, Sb = 162.13 / 12.8;
function Eb(n, a) {
  const r = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!r) return;
  const i = ct(r[1], ",").map((s) => Kn(s.trim(), { fontSize: a })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function zb(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const r = Kn(n.expr, { fontSize: a["font-size"] }), i = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!r && !r.num && r.pct === 100 && Math.abs(r.px + i) < 0.01;
}
function Lp(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), s = i && ct(i[2], ",").map((c) => c.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const r = n.translate;
  if (r && r !== "none") {
    const i = ct(String(r).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Kn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function qf(n, a, r, i = !1) {
  const s = n.values, c = Lp(s);
  if (c?.length === 0) return;
  const f = s.transform && s.transform !== "none" ? "transform" : "translate", u = { fontSize: s["font-size"] }, m = (g, b) => {
    const E = Kn(g, u);
    if (!(!E || E.unitless && E.num))
      return E.pct ? typeof b == "number" ? E.px + E.pct / 100 * b : void 0 : E.px;
  }, h = c ? m(c[0], a.w) : void 0, k = c ? m(c[1], a.h) : void 0;
  if (h === void 0 || k === void 0) {
    const g = !i && c ? c.map((b) => Kn(b, u)) : null;
    if (g?.every((b) => b && !(b.unitless && b.num))) {
      a[Gp] = g.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    r("unsupported", f, s[f], n.sources[f]);
    return;
  }
  if (i) {
    h && (a.left = h), k && (a.top = k);
    return;
  }
  h && (a.ml = (a.ml ?? 0) + h), k && (a.mt = (a.mt ?? 0) + k);
}
const Gp = Symbol("perch.shift");
function Nb(n, a, r) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[f, u], [m, h]] = r, k = f + u / 100 * s.width, g = m + h / 100 * s.height;
    k && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + k), g && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + g);
  }
  const c = s ? `${s.width}x${s.height}` : "";
  c === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Cp && i?.retries && (n.shiftSeen = c, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function si(n, a, r = null) {
  const i = n.values, s = {}, c = (j) => n.sources[j], f = (j) => n.sources[j] !== void 0, u = i.display;
  u === "none" ? s.display = "hidden" : u === "flex" || u === "inline-flex" ? s.display = "flex" : (u === "grid" || u === "inline-grid") && (s.display = "flex", s.flex_direction = "col", a("approximated", "display", u, c("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && a("unsupported", "grid-template-columns", i["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const m = s.display === "flex";
  if (m && s.flex_direction !== "col") {
    const j = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = j;
  }
  if (m) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const j = u === "grid" || u === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    X && (s.items = X);
    let U = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (j) {
      const x = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      x && (s.items = x), i["align-items"] === "center" && (U = "center");
    }
    U && (s.justify = U);
    const V = xn(i["row-gap"]), w = xn(i["column-gap"]);
    typeof V == "number" && V && (s.gap_y = V), typeof w == "number" && w && !j && (s.gap_x = w);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const h = xn(i["flex-basis"]);
  h !== void 0 && h !== "auto" && (s.flex_basis = h);
  const k = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  k && (s.self = k);
  for (const [j, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const U = i[X], V = xn(U);
    if (V === void 0 && X === "width" && zb(U, i)) {
      s.self = "stretch", a("approximated", X, U.expr, c(X), "stretched across its parent, inside its margins");
      continue;
    }
    const w = V === void 0 && /^max-/.test(X) ? Eb(U, i["font-size"]) : void 0;
    if (w !== void 0) {
      s[j] = w, a("approximated", X, U.expr, c(X), "the fixed bound of min()");
      continue;
    }
    if (V === void 0) {
      typeof U == "object" && U.expr ? a("unsupported", X, U.expr, c(X), "no calc() in the engine") : typeof U == "string" && !["auto", "none"].includes(U) && a("unsupported", X, U, c(X));
      continue;
    }
    V !== "auto" && (s[j] = V);
  }
  const g = ["top", "right", "bottom", "left"];
  for (const j of g) {
    const X = j[0];
    for (const [U, V] of [["p", "padding"], ["m", "margin"]]) {
      const w = i[`${V}-${j}`], x = xn(w);
      if (x === void 0) {
        w?.expr && a("unsupported", `${V}-${j}`, w.expr, c(`${V}-${j}`), "no calc() in the engine");
        continue;
      }
      x !== 0 && (s[`${U}${X}`] = x);
    }
  }
  const b = i.position;
  if (b === "absolute" || b === "fixed") {
    s.position = "absolute", b === "fixed" && a("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const j of g) {
      const X = xn(i[j]);
      X !== void 0 && X !== "auto" && (s[j] = X);
    }
    if (b === "fixed" && r && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const j = r.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, j) : j;
    }
    qf(n, s, a);
  } else b === "sticky" ? a("unsupported", "position", "sticky", c("position")) : Lp(i)?.length !== 0 && (s.position = "relative", qf(n, s, a, !0));
  i["z-index"] !== "auto" && f("z-index") && a("unsupported", "z-index", i["z-index"], c("z-index"), "paint order is tree order");
  for (const [j, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const U = i[X];
    U === "hidden" || U === "clip" ? s[j] = "hidden" : (U === "auto" || U === "scroll") && (s[j] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const E = i["background-color"];
  E?.unreadable ? a("unsupported", "background-color", E.unreadable, c("background-color")) : E?.rgba && E.rgba[3] > 0 && (s.bg = gi(E)), i["background-image"] && i["background-image"] !== "none" && a("unsupported", "background-image", i["background-image"], c("background-image"));
  const _ = g.map((j) => xn(i[`border-${j}-width`]) || 0), z = [];
  g.forEach((j, X) => {
    if (!_[X]) return;
    s[`border_${j[0]}`] = _[X];
    const U = i[`border-${j}-style`];
    U !== "solid" && a("approximated", `border-${j}-style`, U, c(`border-${j}-style`), "drawn solid");
    const V = gi(i[`border-${j}-color`]);
    V && z.push(V);
  }), z.length && (s.border_color = z[0], z.some((j) => j.value !== z[0].value) && a("approximated", "border-color", z.map((j) => j.value).join(" "), c("border-top-color"), "one border colour"));
  const S = (j) => {
    const X = xn(i[`border-${j}-radius`]) || 0;
    if (typeof X != "string") return X;
    const U = parseFloat(X) / 100, V = [s.w, s.h].filter((w) => typeof w == "number");
    return X === "auto" || !(U > 0) ? 0 : V.length ? Math.round(Math.min(U, 0.5) * Math.min(...V) * 100) / 100 : 9999;
  }, N = ["top-left", "top-right", "bottom-right", "bottom-left"].map(S);
  N.every((j) => j === N[0]) ? N[0] && (s.rounded = N[0]) : ["tl", "tr", "br", "bl"].forEach((j, X) => {
    N[X] && (s[`rounded_${j}`] = N[X]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const D = i["box-shadow"];
  if (D && D !== "none" && ct(D, ",").some((j) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(j.trim())) && (s.shadow = "lg", a("approximated", "box-shadow", D, c("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const j = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    j ? s.cursor = j : a("unsupported", "cursor", i.cursor, c("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && a("unsupported", "text-decoration-line", i["text-decoration-line"], c("text-decoration-line")), s;
}
const Tb = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Yp(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((r) => Tb[r]);
  return a.every(Boolean) ? a.join(",") : null;
}
function oi(n, a) {
  const r = n.values, i = r["line-height"];
  return {
    text_color: gi(r.color),
    text_size: Math.round(r["font-size"] * 1e3) / 1e3,
    font_features: Yp(r["font-variant-numeric"]) ?? "",
    font_weight: r["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(ql(r, a) * 1e3) / 1e3 },
    font_family: xb(r["font-family"]),
    italic: r["font-style"] === "italic" || r["font-style"] === "oblique",
    whitespace: r["white-space"] === "nowrap" || r["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[r["text-align"]] ?? "left"
  };
}
const Lf = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, ic = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function ci(n, a, r) {
  const i = {}, s = (u, m) => m.some((h) => !n.inherited.has(h));
  for (const [u, m] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(u, m) || !ic(a[u], r[u])) && (i[u] = a[u]);
  const c = Lf(a.line_height, a.text_size), f = r.line_height ? Lf(r.line_height, a.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(c - f) <= 1e-3)) && (i.line_height = a.line_height), i;
}
const Cb = (n, a) => ({ ...n, ...a });
function ui(n, a) {
  const r = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (r[i] = s.value, s.token && (a[i] = s.token)) : i === "line_height" ? r[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (r.italic = !0) : r[i] = s;
  return r.italic === !1 && delete r.italic, r;
}
function Gf(n, a) {
  const r = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const s = n[i], c = a[i];
    ic(s, c) || (r[i] = c === void 0 ? i in bi ? bi[i] : null : c);
  }
  return r;
}
function Yf(n, a) {
  const r = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || bb.has(i) || s.startsWith("ua:")) continue;
    const c = r[i];
    switch (i) {
      case "letter-spacing":
        c !== "normal" && c?.px !== 0 && a("approximated", i, c?.px !== void 0 ? `${Math.round(c.px * 1e3) / 1e3}px` : c, s, c?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        c !== "normal" && Yp(c) === null && a("unsupported", i, c, s);
        break;
      case "text-transform":
        c !== "none" && a("approximated", i, c, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const f = r["transition-duration"];
        i === "transition-property" && f && ct(f, ",").some((u) => parseFloat(u) > 0) && r["transition-property"] !== "none" && a("unsupported", "transition", `${r["transition-property"]} ${f}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        c !== "none" && a("unsupported", i, c, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        i === "overflow-wrap" && c !== "normal" && a("approximated", i, c, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        r["outline-style"] !== "none" && i === "outline-style" && a("unsupported", "outline", `${xn(r["outline-width"])}px ${r["outline-style"]} ${gi(r["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        c && c !== "none" && c !== "auto" && c !== "normal" && c !== "initial" && a("unsupported", i, c, s);
        break;
    }
  }
}
function Ab(n, a, r, i) {
  const s = rc(n), c = [], f = (N, D, j, X, U) => c.push([N, D, j, X ?? "(user agent)", s, U]), u = i.cascade.compute(n, a), m = {}, h = si(u, f, i.viewport), k = h[Gp];
  Yf(u, f);
  const g = oi(u, i.measure), b = ci(u, g, r), E = ui({ ...h, ...b }, m), _ = {}, z = i.cascade.matching(n, "*").filter((N) => N.states.subject.size);
  for (const [N, D] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!z.some((w) => D.some((x) => w.states.subject.has(x)))) continue;
    const j = i.cascade.compute(n, a, new Set(D)), X = {}, U = ui({ ...si(j, () => {
    }), ...ci(j, oi(j, i.measure), r) }, X);
    N === "focus" && Yf(j, f);
    const V = Gf(E, U);
    if (Object.keys(V).length) {
      _[N] = V;
      const w = Object.fromEntries(Object.entries(X).filter(([x]) => x in V));
      Object.keys(w).length && (_[`${N}_tokens`] = w);
    }
  }
  if (i.cascade.sheet.tracks(n, "hover") && (_.group = Qf(n), _.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let N = n.parentNode; N?.state; N = N.parentNode) {
      if (!i.cascade.sheet.tracks(N, "hover")) continue;
      const D = N.state.hover;
      N.state.hover = !0;
      let j;
      try {
        j = i.cascade.compute(n, a);
      } finally {
        N.state.hover = D;
      }
      const X = {}, U = ui({ ...si(j, () => {
      }), ...ci(j, oi(j, i.measure), r) }, X), V = Gf(E, U);
      if (!Object.keys(V).length) continue;
      const w = Object.fromEntries(Object.entries(X).filter(([x]) => x in V));
      (_.group_hover ??= []).push({ group: Qf(N), style: V, ...Object.keys(w).length ? { tokens: w } : {} });
    }
  if (/tabular/.test(String(u.values["font-variant-numeric"] ?? "")) && (_.tabular = !0), /^(anywhere|break-word)$/.test(String(u.values["overflow-wrap"] ?? "")) && (_.break_anywhere = !0), h.overflow_y === "scroll") {
    const N = Number.parseFloat(u.customs?.["--scrollbar-size"] ?? "");
    N > 0 && (_.scrollbar = N);
  }
  u.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (_.blocks_pointer = !0), u.values["pointer-events"] === "none" && (_.pointer_none = !0);
  const S = Object.entries(wb).filter(([, N]) => N.some((D) => typeof n.props[D] == "function")).map(([N]) => N);
  return !S.includes("click") && jo(n) && S.push("click"), S.length && (_.events = S), { computed: u, style: E, tokens: m, extra: _, meta: Ub(n), reports: c, childText: Cb(r, b), where: s, shift: k };
}
function Mb(n, a, r, i) {
  const s = { before: null, after: null };
  for (const c of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), c).length) continue;
    const f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), c), u = String(f.values.content ?? "none").trim();
    if (u === "none" || u === "normal") continue;
    const m = /^(["'])(.*)\1$/.exec(u)?.[2] ?? "", h = (_, z, S, N, D) => i.add(_, z, S, N ?? "(user agent)", `${rc(n)}::${c}`, D), k = {}, g = si(f, h, i.viewport), E = { kind: "div", style: ui({ ...g, ...ci(f, oi(f, i.measure), r) }, k), tokens: k, children: m ? [{ kind: "text", text: m }] : [] };
    Object.defineProperty(E, Xt, { value: f.values.display }), s[c] = E;
  }
  return s;
}
const Qf = (n) => `~g${n.id}`, Rb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function jb(n) {
  return n.kind === "div" && n[Xt] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !Rb.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function Fr(n, a) {
  const r = n[a], i = { ...r, style: { ...r.style } };
  return Object.defineProperty(i, Xt, { value: r[Xt] }), n[a] = i, i;
}
function Ob(n) {
  const a = [];
  for (let r = n.parentElement; r?.parentElement; r = r.parentElement) {
    const i = r.parentElement.children;
    a.push(`${+(i[0] === r)}${+(i[i.length - 1] === r)}`);
  }
  return a.join("");
}
function Qp(n, a, r, i, s = 0, c = !0, f = !0, u = 0) {
  const m = i.cascade.sheet.depends(n), h = m.pos ? `${+c}${+f}${m.nth ? `:${u}` : ""}` : "", k = m.ancPos ? Ob(n) : "";
  let g = i.cache.get(n);
  const b = g && g.version === n.version && g.parentValues === a?.values && g.inheritedText === r && g.pos === h && g.ancPos === k && (!m.anc || s <= g.at);
  if (b && g.node && g.stamp === n.stamp && !g.volatile && (!g.subAnc || s <= g.subAt)) {
    for (const S of g.log) i.add(...S);
    return g.node;
  }
  if (!b) {
    const S = Ab(n, a, r, i);
    g && ic(g.part.childText, S.childText) && (S.childText = g.part.childText), g = { version: n.version, parentValues: a?.values, inheritedText: r, pos: h, ancPos: k, at: i.now, part: S }, i.cache.set(n, g);
  }
  const E = i.log.length, _ = { volatile: !!g.part.shift || m.ancPos, subAnc: m.anc }, z = Db(n, g, i, Math.max(s, n.attrStamp), _);
  return Object.assign(g, { node: z, stamp: n.stamp, subAt: i.now, log: i.log.slice(E), volatile: _.volatile, subAnc: _.subAnc }), z;
}
function Db(n, a, r, i, s) {
  const { computed: c, tokens: f, extra: u, reports: m, childText: h, where: k } = a.part;
  for (const y of m) r.add(...y);
  const g = (y, T, R, C, B) => r.add(y, T, R, C, k, B), b = { ...a.part.style };
  a.part.shift && Nb(n, b, a.part.shift);
  const E = { kind: "div", id: n.id, style: b, tokens: f, meta: a.part.meta, ...u };
  Object.defineProperty(E, Xt, { value: c.values.display }), n.measured && n.ownerDocument?.measureKey && (E.measure = n.ownerDocument.measureKey(n));
  const _ = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return E.kind = "engine", E.engine = String(n.props["data-perch-engine"]), E.key = String(n.props["data-perch-key"] ?? ""), E;
  if (_ === "svg")
    return E.kind = n.props["data-perch-image"] ? "image" : "svg", E.markup = Lb(n), E;
  if (_ === "input" || _ === "textarea" || _ === "select") {
    E.kind = "input", E.input_type = _ === "input" ? String(n.props.type ?? "text") : _;
    for (const R of ["placeholder", "checked", "disabled"]) n.props[R] !== void 0 && (E[R] = n.props[R]);
    if (/^(checkbox|radio)$/.test(E.input_type) && (E.checked = n.checked), _ !== "select" && (E.value = n.value), _ === "input" && _b.test(E.input_type) && (E.field_w = Sb * c.values["font-size"]), _ === "textarea" && b.h === void 0) {
      const R = c.values, C = (F) => F && typeof F == "object" && "px" in F ? F.px : 0, B = (F) => R[`border-${F}-style`] === "none" ? 0 : C(R[`border-${F}-width`]), W = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      b.h = W * ql(R, r.measure) + C(R["padding-top"]) + C(R["padding-bottom"]) + B("top") + B("bottom");
    }
    const { before: y, after: T } = Mb(n, c, h, r);
    return (y || T) && (E.children = [y, T].filter(Boolean)), E;
  }
  if (_ === "img") {
    E.kind = "image", E.src = n.props.src ?? null;
    for (const [y, T] of [["width", "w"], ["height", "h"]]) {
      const R = Number(n.props[y]);
      b[T] === void 0 && n.props[y] != null && Number.isFinite(R) && (b[T] = R);
    }
    return E;
  }
  const z = c.values["text-transform"], S = [];
  let N = !1, D = !1;
  const j = n.childNodes.reduce((y, T) => y + (T instanceof Je ? 1 : 0), 0);
  let X = 0;
  for (const y of n.childNodes) {
    if (y instanceof Ni) {
      if (y.hidden || y.data === "") continue;
      N = !0;
      const B = S[S.length - 1];
      if (B?.kind === "text")
        B.source = (B.source ?? B.text) + y.data, B.text = Zf(B.source, z), B.text === B.source && delete B.source;
      else {
        const W = Zf(y.data, z);
        S.push(W === y.data ? { kind: "text", text: W } : { kind: "text", text: W, source: y.data });
      }
      continue;
    }
    if (!(y instanceof Je)) continue;
    const T = Qp(y, c, h, r, i, X === 0, X === j - 1, X);
    X++;
    const R = r.cache.get(y);
    s.volatile ||= R.volatile, s.subAnc ||= R.subAnc;
    const C = T[Xt];
    C === "inline" || C === "inline-block" || C === "inline-flex" ? N = !0 : C !== "none" && (D = !0), S.push(T);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && b.w === void 0) {
    for (let y = 0; y < S.length; y++)
      if (S[y].style?.flex_grow && S[y].style.min_w === 0 && S[y].style.overflow_x === "hidden") {
        const T = Fr(S, y);
        delete T.style.min_w, delete T.style.flex_grow, delete T.style.flex_basis, delete T.style.overflow_x, delete T.style.overflow_y;
      }
  }
  if (!b.display && N && S.some((y) => y.kind !== "text") && S.every((y) => y.kind === "text" || jb(y))) {
    const y = S.map((T) => T.kind === "text" ? T.text : T.children.map((R) => R.text).join("")).join("");
    g("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), S.splice(0, S.length, { kind: "text", text: y });
  }
  const U = S.some((y) => y.kind !== "text");
  let V = S.length === 1 && S[0].kind !== "text" && /^inline-(block|flex)$/.test(S[0][Xt]) ? S[0] : null;
  if (!b.display && V) {
    V = Fr(S, 0);
    const y = r.cache.get(n.childNodes.find((R) => R.id === V.id))?.part.computed, T = y ? Ll(c.values, r.measure) - Vf(y.values, r.measure, V) : 0;
    b.display = "flex", b.flex_direction = "col", b.items = "start", T > 0 && (V.style.mt = Math.round(((V.style.mt ?? 0) + T) * 100) / 100), g("approximated", "display", `${c.values.display} holding one ${V[Xt]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!b.display && S.length === 1 && (S[0].kind === "svg" || S[0].kind === "image") && S[0][Xt] === "inline" && typeof S[0].style.h == "number") {
    const y = Fr(S, 0), T = Ll(c.values, r.measure), R = ql(c.values, r.measure) - T, C = (B) => Math.round(B * 100) / 100;
    b.display = "flex", b.flex_direction = "col", b.items = "start", T > y.style.h && (y.style.mt = C((y.style.mt ?? 0) + T - y.style.h)), R > 0 && (y.style.mb = C((y.style.mb ?? 0) + R)), g("approximated", "display", `${c.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!b.display && N && U) {
    if (b.display = "flex", b.flex_direction = D ? "col" : "row", !D) b.items = "baseline";
    else {
      const y = (T) => S[T] && (S[T].kind === "text" || !/^(block|flex|grid|table|list-item)$/.test(S[T][Xt] ?? "block"));
      for (let T = 0; T < S.length; T++) {
        if (S[T].kind === "text" || !/^inline-(block|flex)$/.test(S[T][Xt])) continue;
        const R = Fr(S, T);
        if (R.style.self ??= "start", y(T - 1) || y(T + 1)) continue;
        const C = r.cache.get(n.childNodes.find((W) => W.id === R.id))?.part.computed, B = C ? Ll(c.values, r.measure) - Vf(C.values, r.measure, R) : 0;
        B > 0 && (R.style.mt = Math.round(((R.style.mt ?? 0) + B) * 100) / 100);
      }
    }
    g("approximated", "display", `${c.values.display} with inline content`, "(inline formatting)", D ? "a column of its children" : "a row on the text baseline");
  }
  const w = c.values["letter-spacing"]?.px, x = c.values["overflow-x"] !== "visible";
  if (w)
    for (let y = 0; y < S.length; y++) {
      const T = S[y];
      if (T.kind !== "text") continue;
      const R = Math.round(w * [...T.text].length * 1e3) / 1e3;
      if (w > 0 || !x) {
        S[y] = { kind: "div", style: { pr: R }, tokens: {}, children: [T] };
        continue;
      }
      const C = c.values["font-size"], B = Math.max(0.8, 1 + w / (0.55 * C)), W = Math.round(ql(c.values, r.measure) * 1e3) / 1e3;
      S[y] = { kind: "div", style: { text_size: Math.round(C * B * 1e3) / 1e3, line_height: `${W}px` }, tokens: {}, children: [T] };
    }
  return E.children = S, E;
}
function Bb(n, a) {
  if (!a) return null;
  let i = (a.self ? n : a.closest ? Np(n, a.closest) : a.find ? Yl(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return i && a.strip && i.startsWith(a.strip) && (i = i.slice(a.strip.length)), i;
}
function Hb(n, a, r) {
  const i = a.map((f) => [f, zi(f.selector)]), s = /* @__PURE__ */ new Map(), c = (f) => {
    for (const u of f.children) {
      const m = r.get(u.id);
      if (m)
        for (const [h, k] of i) {
          const g = h.textRange ? "range_name" : "name";
          if (h.textRange && m[g] != null || !k.some((z) => Co(u, z))) continue;
          const b = Bb(u, h.key), E = b == null ? s.get(h.name) ?? 0 : 0;
          b == null && s.set(h.name, E + 1);
          const _ = b != null ? `${h.name}:${b}` : E ? `${h.name}@${E}` : h.name;
          m[g] == null ? m[g] = _ : (m.also ??= []).push(_);
        }
      c(u);
    }
  };
  c(n.documentElement);
}
const vi = 0.9521, Vp = 0.2256, Ll = (n, a) => (ql(n, a) - (vi + Vp) * n["font-size"]) / 2 + vi * n["font-size"];
function Vf(n, a, r) {
  const i = (m) => m && typeof m == "object" && "px" in m ? m.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), c = r?.children ?? [], f = c.length === 1 && (c[0].kind === "svg" || c[0].kind === "image") && typeof c[0].style.h == "number" ? c[0] : null, u = f ? Math.max(Ll(n, a), (f.style.mt ?? 0) + f.style.h) : Ll(n, a);
  return i(n["padding-top"]) + s + u;
}
const Zf = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (r) => r.toUpperCase()) : n, Zp = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Ub(n) {
  const a = {};
  for (const [r, i] of Object.entries(n.props)) {
    if (Zp.has(r) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = r.startsWith("aria-") || r.startsWith("data-");
    if (i === !1 && !s) continue;
    const c = r === "htmlFor" ? "for" : r === "tabIndex" ? "tabindex" : r;
    a[c] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: a };
}
const qb = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), Xf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Lb(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (r) => {
    const i = [];
    for (const [c, f] of Object.entries(r.props))
      Zp.has(c) || typeof f == "function" || f === void 0 || f === null || f === !1 || typeof f == "object" || c.startsWith("data-") || c.startsWith("aria-") || c === "focusable" || c === "role" || c === "title" || i.push(`${qb(c)}="${Xf(f === !0 ? "" : f)}"`);
    r.tagName === "svg" && !r.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = r.childNodes.map((c) => c instanceof Ni ? Xf(c.data) : a(c)).join("");
    return `<${r.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${r.tagName}>`;
  };
  return a(n);
}
function Gb(n) {
  const a = n.theme?.() ?? {}, r = {};
  for (const i of Dp) a[i] && (r[i] = a[i]);
  return r;
}
const Yb = { font_features: "" };
function Qb(n, a, r, i = {}, s = null) {
  const c = Gb(a), f = a.viewport?.() ?? { width: 1e3, height: 800 }, u = JSON.stringify([c, f]);
  (i.look !== u || i.sheet !== r) && Object.assign(i, { look: u, sheet: r, cache: /* @__PURE__ */ new WeakMap(), cascade: new db(r, { theme: c, viewport: f }), top: null });
  const { cascade: m, cache: h } = i, k = new kb(), g = [], E = { cascade: m, cache: h, viewport: f, findings: k, log: g, add: (...N) => {
    g.push(N), k.add(...N);
  }, now: Mo(), measure: a.lineHeight ? (N) => a.lineHeight(N) : null };
  i.top ??= m.compute(n.body, m.compute(n.documentElement, null));
  const _ = n.body.children, z = _.map((N, D) => Qp(N, i.top, Yb, E, 0, D === 0, D === _.length - 1, D));
  if (s?.length) {
    const N = /* @__PURE__ */ new Map(), D = (j) => {
      j.id && (N.set(j.id, j), delete j.name, delete j.range_name, delete j.also);
      for (const X of j.children ?? []) D(X);
    };
    z.forEach(D), Hb(n, s, N);
  }
  const S = /* @__PURE__ */ new Set();
  for (const N of [n, n.defaultView])
    for (const { type: D } of N?.listeners ?? []) Uf[D] && S.add(Uf[D]);
  return { schema: hb, root: z[0] ?? null, overlays: z.slice(1), document_events: [...S].sort(), unsupported: E.findings.list() };
}
const Vb = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Zb = null;
const Xb = () => Zb ??= new nb(Vb);
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
let Xn = Pa.NoEventPriority;
function Kb(n, a) {
  const r = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const i of r) {
    if (i === "children") continue;
    const s = n[i], c = a[i];
    if (!(s === c || typeof s == "function" && typeof c == "function") && !(i === "style" && s && c && typeof s == "object" && typeof c == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(c)])].every((u) => s[u] === c[u])))
      return !0;
  }
  return !1;
}
const Jb = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Kf(n, a) {
  for (const r of w0(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(r);
  return n;
}
const Xp = {
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
  scheduleTimeout: (n, a) => setTimeout(n, a),
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
  createInstance: (n, a, r) => Kf(new Je(n, a, r.ownerDocument), a),
  createTextInstance: (n, a) => new Ni(n),
  appendInitialChild: (n, a) => {
    n.appendChild(a);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, a, r) => !!r.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, a) => {
    n.appendChild(a);
  },
  appendChildToContainer: (n, a) => {
    n.appendChild(a);
  },
  insertBefore: (n, a, r) => {
    n.insertBefore(a, r);
  },
  insertInContainerBefore: (n, a, r) => {
    n.insertBefore(a, r);
  },
  removeChild: (n, a) => {
    n.removeChild(a);
  },
  removeChildFromContainer: (n, a) => {
    n.removeChild(a);
  },
  clearContainer: (n) => {
    for (const a of [...n.childNodes]) n.removeChild(a);
  },
  commitUpdate: (n, a, r, i) => {
    if (n.props = i, n.inline) for (const s of Object.keys(n.inline)) r.style?.[s] !== i.style?.[s] && delete n.inline[s];
    if (r.dangerouslySetInnerHTML?.__html !== i.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      Kf(n, i);
    }
    Kb(r, i) && n.touch();
  },
  commitTextUpdate: (n, a, r) => {
    n.data = String(r);
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
    Xn = n;
  },
  getCurrentUpdatePriority: () => Xn,
  resolveUpdatePriority: () => Xn !== Pa.NoEventPriority ? Xn : Pa.DefaultEventPriority,
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
  bindToConsole: (n, a) => Function.prototype.bind.call(console[n], console, ...a)
};
let bt = Op(Xp), qo = 0;
function Jf() {
  bt.isAlreadyRendering() && (bt = Op(Xp), qo += 1, Xn = Pa.NoEventPriority);
}
const Zl = (n, a, r = null) => bt.createPortal(n, a, null, r), Wb = {
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
  submit: "onSubmit",
  scroll: "onScroll"
}, $b = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Fb = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Ib = (n) => {
  for (let a = n; a instanceof Je; a = a.parentNode) if (a.props.disabled && Fb.has(a.tagName)) return !0;
  return !1;
};
class Pb {
  constructor(a, r, i) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, r), this.type = a, this.target = i, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Ir(n, a, r) {
  a.currentTarget = n;
  for (const { type: i, listener: s, capture: c } of [...n.listeners ?? []])
    i === a.type && c === r && s.call(n, a);
  if (n instanceof Je) {
    const i = Wb[a.type], s = i && n.props[r ? `${i}Capture` : i];
    typeof s == "function" && s(a);
  }
}
function e4(n, a, r = {}) {
  const { document: i, window: s, globals: c } = z0(n), f = new Je("div", { id: "root", style: r.container ?? {} }, i);
  i.body.appendChild(f);
  const u = [];
  let m = null;
  const h = () => [i, s].map((x) => x.listeners.map((y) => `${y.type}:${y.capture}`).sort().join(",")).join("|");
  let k = "";
  const g = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let E = 0, _ = -1;
  i.measureKey = (x) => b + x.id, i.stale = () => _ !== E, i.computed = (x) => {
    if (!g.cascade || !g.top) return null;
    const y = [];
    for (let R = x; R instanceof Je && R !== i.body; R = R.parentNode) y.unshift(R);
    let T = g.top;
    for (const R of y) T = g.cascade.compute(R, T);
    return T.values;
  };
  const z = () => (E += 1, m = Qb(i, n, Xb(), g, r.names), k = h(), n.render?.(m), m);
  Jf();
  const S = qo, N = () => (Jf(), S === qo), D = () => {
    N() && (bt.flushPassiveEffects(), bt.flushSyncWork(), h() !== k && z());
  };
  i.afterCommit = z;
  const j = (x) => {
    u.push(x), n.error?.(x);
  }, X = bt.createContainer(f, Pa.ConcurrentRoot, null, !1, null, "", j, j, j, null);
  bt.updateContainerSync(G.createElement(a, r.props ?? {}), X, null, null), bt.flushSyncWork(), D();
  const U = (x) => {
    const y = (T) => {
      if (T.id === x) return T;
      for (const R of T.children) {
        const C = y(R);
        if (C) return C;
      }
      return null;
    };
    return y(i.documentElement);
  }, V = (x) => {
    if (!N()) return;
    const y = Xn;
    Xn = Pa.DiscreteEventPriority;
    try {
      return x();
    } finally {
      Xn = y, bt.flushSyncWork(), D();
    }
  }, w = {
    document: i,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: c,
    container: f,
    errors: u,
    /** The latest description (after the last commit or state change). */
    get description() {
      return m;
    },
    describe: z,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(x, y, T = {}) {
      const R = typeof x == "string" ? U(x) : x;
      if (!R || $b.has(y) && Ib(R)) return !1;
      const C = new Pb(y, T, R), B = [];
      for (let q = R; q; q = y === "scroll" ? null : q.parentNode) B.push(q);
      const W = [...B, i, s];
      V(() => {
        for (let q = W.length - 1; q > 0 && !C.propagationStopped; q--) Ir(W[q], C, !0);
        C.propagationStopped || (Ir(R, C, !0), C.propagationStopped || Ir(R, C, !1));
        for (let q = 1; q < W.length && !C.propagationStopped; q++) Ir(W[q], C, !1);
      });
      const F = y === "click" && !C.defaultPrevented ? jo(R) : null;
      if (F && w.dispatch(F, "submit", {}), y === "click" && !C.defaultPrevented)
        for (let q = R; q; q = q.parentNode) {
          if (q.tagName !== "a") continue;
          const J = q.props?.href;
          typeof J == "string" && /^https:\/\/\S+$/.test(J) && n.openLink?.(J);
          break;
        }
      return !C.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (x) => [i, s].some((y) => y.listeners.some((T) => T.type === x)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(x) {
      const y = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!w.dispatch(y, "keydown", x)) return !0;
      const R = x.key === "Enter" && !x.isComposing ? jo(y, !0) : null;
      if (R)
        return w.dispatch(R, "submit", {}), !0;
      if (!Rp(y) || y.props.disabled || y.props.readOnly) return !1;
      if ((x.ctrlKey || x.metaKey) && !x.altKey && !x.shiftKey && x.key.toLowerCase() === "a")
        return y.selectedAll = !0, !0;
      if (x.ctrlKey || x.metaKey) return !1;
      const C = y.selectedAll;
      y.selectedAll = !1;
      const B = y.value, F = x.key === "Backspace" || C && x.key === "Delete" ? C ? "" : B.slice(0, -1) : [...x.key].length === 1 ? (C ? "" : B) + x.key : B;
      return F === B ? !1 : (y.value = F, w.dispatch(y, "input", { data: x.key }), w.dispatch(y, "change", {}), y.props.value !== void 0 && delete y.edit, y.touch(), z(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(x, y) {
      const T = U(x);
      T && (T.bounds = { x: y.x, y: y.y, width: y.width, height: y.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(x) {
      const y = U(x);
      if (!y || y.props.disabled || !w.dispatch(x, "click", { button: 0, detail: 1 })) return;
      const T = y.props.type === "radio";
      T && y.checked || (y.checked = T ? !0 : !y.checked, w.dispatch(x, "input", {}), w.dispatch(x, "change", {}), y.props.checked !== void 0 && delete y.ticked, y.touch(), z());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(x, y = {}) {
      const T = { button: 0, buttons: 1, pointerType: "mouse", ...y };
      for (const R of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) w.dispatch(x, R, T);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (x) => !!U(x)?.state.hover,
    hover(x, y) {
      const T = U(x);
      !T || T.state.hover === y || (T.state.hover = y, T.touch(), z());
    },
    focus(x) {
      const y = U(x);
      y && (V(() => {
        const T = i.activeElement;
        T && T !== y && T !== i.body && w.dispatch(T, "blur"), i.focus(y), w.dispatch(y, "focus");
      }), z());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(x) {
      let T = typeof x == "string" ? U(x) : x;
      for (; T && !(T instanceof Je && typeof T.props.onKeyDown == "function" && Jb(T)); ) T = T.parentNode;
      !T || T === i.activeElement || (w.focus(T.id), T.state.pointerFocus = !0, T.touch(), z());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return _ = E, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const x = i.retries.splice(0);
      for (const y of x) y();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: D,
    /** React was replaced since this tree was mounted (`fresh`): the tree is to be mounted again. */
    dead: () => !N(),
    update(x) {
      N() && (bt.updateContainerSync(G.createElement(a, x ?? {}), X, null, null), bt.flushSyncWork(), D());
    },
    unmount() {
      N() && (bt.updateContainerSync(null, X, null, null), bt.flushSyncWork(), bt.flushPassiveEffects()), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(b);
    }
  };
  return w;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Kp = (n) => bt.flushSyncFromReconciler(n), e1 = { createPortal: Zl, flushSync: Kp }, t4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Zl,
  default: e1,
  flushSync: Kp
}, Symbol.toStringTag, { value: "Module" }));
function Jp(n) {
  var a, r, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (a = 0; a < s; a++) n[a] && (r = Jp(n[a])) && (i && (i += " "), i += r);
  } else for (r in n) n[r] && (i && (i += " "), i += r);
  return i;
}
function Wp() {
  for (var n, a, r = 0, i = "", s = arguments.length; r < s; r++) (n = arguments[r]) && (a = Jp(n)) && (i && (i += " "), i += a);
  return i;
}
const t1 = (n, a) => {
  const r = new Array(n.length + a.length);
  for (let i = 0; i < n.length; i++)
    r[i] = n[i];
  for (let i = 0; i < a.length; i++)
    r[n.length + i] = a[i];
  return r;
}, n1 = (n, a) => ({
  classGroupId: n,
  validator: a
}), $p = (n = /* @__PURE__ */ new Map(), a = null, r) => ({
  nextPart: n,
  validators: a,
  classGroupId: r
}), yi = "-", Wf = [], a1 = "arbitrary..", l1 = (n) => {
  const a = i1(n), {
    conflictingClassGroups: r,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return r1(f);
      const u = f.split(yi), m = u[0] === "" && u.length > 1 ? 1 : 0;
      return Fp(u, m, a);
    },
    getConflictingClassGroupIds: (f, u) => {
      if (u) {
        const m = i[f], h = r[f];
        return m ? h ? t1(h, m) : m : h || Wf;
      }
      return r[f] || Wf;
    }
  };
}, Fp = (n, a, r) => {
  if (n.length - a === 0)
    return r.classGroupId;
  const s = n[a], c = r.nextPart.get(s);
  if (c) {
    const h = Fp(n, a + 1, c);
    if (h) return h;
  }
  const f = r.validators;
  if (f === null)
    return;
  const u = a === 0 ? n.join(yi) : n.slice(a).join(yi), m = f.length;
  for (let h = 0; h < m; h++) {
    const k = f[h];
    if (k.validator(u))
      return k.classGroupId;
  }
}, r1 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), r = a.indexOf(":"), i = a.slice(0, r);
  return i ? a1 + i : void 0;
})(), i1 = (n) => {
  const {
    theme: a,
    classGroups: r
  } = n;
  return s1(r, a);
}, s1 = (n, a) => {
  const r = $p();
  for (const i in n) {
    const s = n[i];
    sc(s, r, i, a);
  }
  return r;
}, sc = (n, a, r, i) => {
  const s = n.length;
  for (let c = 0; c < s; c++) {
    const f = n[c];
    o1(f, a, r, i);
  }
}, o1 = (n, a, r, i) => {
  if (typeof n == "string") {
    c1(n, a, r);
    return;
  }
  if (typeof n == "function") {
    u1(n, a, r, i);
    return;
  }
  d1(n, a, r, i);
}, c1 = (n, a, r) => {
  const i = n === "" ? a : Ip(a, n);
  i.classGroupId = r;
}, u1 = (n, a, r, i) => {
  if (f1(n)) {
    sc(n(i), a, r, i);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(n1(r, n));
}, d1 = (n, a, r, i) => {
  const s = Object.entries(n), c = s.length;
  for (let f = 0; f < c; f++) {
    const [u, m] = s[f];
    sc(m, Ip(a, u), r, i);
  }
}, Ip = (n, a) => {
  let r = n;
  const i = a.split(yi), s = i.length;
  for (let c = 0; c < s; c++) {
    const f = i[c];
    let u = r.nextPart.get(f);
    u || (u = $p(), r.nextPart.set(f, u)), r = u;
  }
  return r;
}, f1 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, p1 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let a = 0, r = /* @__PURE__ */ Object.create(null), i = /* @__PURE__ */ Object.create(null);
  const s = (c, f) => {
    r[c] = f, a++, a > n && (a = 0, i = r, r = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(c) {
      let f = r[c];
      if (f !== void 0)
        return f;
      if ((f = i[c]) !== void 0)
        return s(c, f), f;
    },
    set(c, f) {
      c in r ? r[c] = f : s(c, f);
    }
  };
}, Lo = "!", $f = ":", m1 = [], Ff = (n, a, r, i, s) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: r,
  maybePostfixModifierPosition: i,
  isExternal: s
}), h1 = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: r
  } = n;
  let i = (s) => {
    const c = [];
    let f = 0, u = 0, m = 0, h;
    const k = s.length;
    for (let z = 0; z < k; z++) {
      const S = s[z];
      if (f === 0 && u === 0) {
        if (S === $f) {
          c.push(s.slice(m, z)), m = z + 1;
          continue;
        }
        if (S === "/") {
          h = z;
          continue;
        }
      }
      S === "[" ? f++ : S === "]" ? f-- : S === "(" ? u++ : S === ")" && u--;
    }
    const g = c.length === 0 ? s : s.slice(m);
    let b = g, E = !1;
    g.endsWith(Lo) ? (b = g.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      g.startsWith(Lo) && (b = g.slice(1), E = !0)
    );
    const _ = h && h > m ? h - m : void 0;
    return Ff(c, E, b, _);
  };
  if (a) {
    const s = a + $f, c = i;
    i = (f) => f.startsWith(s) ? c(f.slice(s.length)) : Ff(m1, !1, f, void 0, !0);
  }
  if (r) {
    const s = i;
    i = (c) => r({
      className: c,
      parseClassName: s
    });
  }
  return i;
}, g1 = (n) => {
  const a = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((r, i) => {
    a.set(r, 1e6 + i);
  }), (r) => {
    const i = [];
    let s = [];
    for (let c = 0; c < r.length; c++) {
      const f = r[c], u = f[0] === "[", m = a.has(f);
      u || m ? (s.length > 0 && (s.sort(), i.push(...s), s = []), i.push(f)) : s.push(f);
    }
    return s.length > 0 && (s.sort(), i.push(...s)), i;
  };
}, b1 = (n) => ({
  cache: p1(n.cacheSize),
  parseClassName: h1(n),
  sortModifiers: g1(n),
  postfixLookupClassGroupIds: v1(n),
  ...l1(n)
}), v1 = (n) => {
  const a = /* @__PURE__ */ Object.create(null), r = n.postfixLookupClassGroups;
  if (r)
    for (let i = 0; i < r.length; i++)
      a[r[i]] = !0;
  return a;
}, y1 = /\s+/, x1 = (n, a) => {
  const {
    parseClassName: r,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: c,
    postfixLookupClassGroupIds: f
  } = a, u = [], m = n.trim().split(y1);
  let h = "";
  for (let k = m.length - 1; k >= 0; k -= 1) {
    const g = m[k], {
      isExternal: b,
      modifiers: E,
      hasImportantModifier: _,
      baseClassName: z,
      maybePostfixModifierPosition: S
    } = r(g);
    if (b) {
      h = g + (h.length > 0 ? " " + h : h);
      continue;
    }
    let N = !!S, D;
    if (N) {
      const w = z.substring(0, S);
      D = i(w);
      const x = D && f[D] ? i(z) : void 0;
      x && x !== D && (D = x, N = !1);
    } else
      D = i(z);
    if (!D) {
      if (!N) {
        h = g + (h.length > 0 ? " " + h : h);
        continue;
      }
      if (D = i(z), !D) {
        h = g + (h.length > 0 ? " " + h : h);
        continue;
      }
      N = !1;
    }
    const j = E.length === 0 ? "" : E.length === 1 ? E[0] : c(E).join(":"), X = _ ? j + Lo : j, U = X + D;
    if (u.indexOf(U) > -1)
      continue;
    u.push(U);
    const V = s(D, N);
    for (let w = 0; w < V.length; ++w) {
      const x = V[w];
      u.push(X + x);
    }
    h = g + (h.length > 0 ? " " + h : h);
  }
  return h;
}, w1 = (...n) => {
  let a = 0, r, i, s = "";
  for (; a < n.length; )
    (r = n[a++]) && (i = Pp(r)) && (s && (s += " "), s += i);
  return s;
}, Pp = (n) => {
  if (typeof n == "string")
    return n;
  let a, r = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (a = Pp(n[i])) && (r && (r += " "), r += a);
  return r;
}, k1 = (n, ...a) => {
  let r, i, s, c;
  const f = (m) => {
    const h = a.reduce((k, g) => g(k), n());
    return r = b1(h), i = r.cache.get, s = r.cache.set, c = u, u(m);
  }, u = (m) => {
    const h = i(m);
    if (h)
      return h;
    const k = x1(m, r);
    return s(m, k), k;
  };
  return c = f, (...m) => c(w1(...m));
}, _1 = [], Fe = (n) => {
  const a = (r) => r[n] || _1;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, em = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, tm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, S1 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, E1 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, z1 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, N1 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, T1 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, C1 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ln = (n) => S1.test(n), ye = (n) => !!n && !Number.isNaN(Number(n)), tn = (n) => !!n && Number.isInteger(Number(n)), _o = (n) => n.endsWith("%") && ye(n.slice(0, -1)), yn = (n) => E1.test(n), nm = () => !0, A1 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  z1.test(n) && !N1.test(n)
), oc = () => !1, M1 = (n) => T1.test(n), R1 = (n) => C1.test(n), j1 = (n) => !re(n) && !ie(n), O1 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), D1 = (n) => Jn(n, rm, oc), re = (n) => em.test(n), ha = (n) => Jn(n, im, A1), If = (n) => Jn(n, Q1, ye), B1 = (n) => Jn(n, om, nm), H1 = (n) => Jn(n, sm, oc), Pf = (n) => Jn(n, am, oc), U1 = (n) => Jn(n, lm, R1), Pr = (n) => Jn(n, cm, M1), ie = (n) => tm.test(n), Ol = (n) => ka(n, im), q1 = (n) => ka(n, sm), ep = (n) => ka(n, am), L1 = (n) => ka(n, rm), G1 = (n) => ka(n, lm), ei = (n) => ka(n, cm, !0), Y1 = (n) => ka(n, om, !0), Jn = (n, a, r) => {
  const i = em.exec(n);
  return i ? i[1] ? a(i[1]) : r(i[2]) : !1;
}, ka = (n, a, r = !1) => {
  const i = tm.exec(n);
  return i ? i[1] ? a(i[1]) : r : !1;
}, am = (n) => n === "position" || n === "percentage", lm = (n) => n === "image" || n === "url", rm = (n) => n === "length" || n === "size" || n === "bg-size", im = (n) => n === "length", Q1 = (n) => n === "number", sm = (n) => n === "family-name", om = (n) => n === "number" || n === "weight", cm = (n) => n === "shadow", V1 = () => {
  const n = Fe("color"), a = Fe("font"), r = Fe("text"), i = Fe("font-weight"), s = Fe("tracking"), c = Fe("leading"), f = Fe("breakpoint"), u = Fe("container"), m = Fe("spacing"), h = Fe("radius"), k = Fe("shadow"), g = Fe("inset-shadow"), b = Fe("text-shadow"), E = Fe("drop-shadow"), _ = Fe("blur"), z = Fe("perspective"), S = Fe("aspect"), N = Fe("ease"), D = Fe("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], U = () => [...X(), ie, re], V = () => ["auto", "hidden", "clip", "visible", "scroll"], w = () => ["auto", "contain", "none"], x = () => [ie, re, m], y = () => [Ln, "full", "auto", ...x()], T = () => [tn, "none", "subgrid", ie, re], R = () => ["auto", {
    span: ["full", tn, ie, re]
  }, tn, ie, re], C = () => [tn, "auto", ie, re], B = () => ["auto", "min", "max", "fr", ie, re], W = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], F = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], q = () => ["auto", ...x()], J = () => [Ln, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...x()], I = () => [u, Ln, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...x()], Q = () => [Ln, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...x()], Z = () => [n, ie, re], A = () => [...X(), ep, Pf, {
    position: [ie, re]
  }], K = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], ae = () => ["auto", "cover", "contain", L1, D1, {
    size: [ie, re]
  }], oe = () => [_o, Ol, ha], ce = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    h,
    ie,
    re
  ], ue = () => ["", ye, Ol, ha], Ee = () => ["solid", "dashed", "dotted", "double"], Pe = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], he = () => [ye, _o, ep, Pf], $n = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    _,
    ie,
    re
  ], Fn = () => ["none", ye, ie, re], qt = () => ["none", ye, ie, re], Lt = () => [ye, ie, re], wn = () => [Ln, "full", ...x()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [yn],
      breakpoint: [yn],
      color: [nm],
      container: [yn],
      "drop-shadow": [yn],
      ease: ["in", "out", "in-out"],
      font: [j1],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [yn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [yn],
      shadow: [yn],
      spacing: ["px", ye],
      text: [yn],
      "text-shadow": [yn],
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
        aspect: ["auto", "square", Ln, re, ie, S]
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
        "@container": ["", "normal", "size", ie, re]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [O1],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [ye, "auto", re, ie, u]
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
        overflow: V()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": V()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": V()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: w()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": w()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": w()
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
        inset: y()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": y()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": y()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": y(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: y()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": y(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: y()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": y()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": y()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: y()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: y()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: y()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: y()
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
        z: [tn, "auto", ie, re]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Ln, "full", "auto", u, ...x()]
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
        flex: [ye, Ln, "auto", "initial", "none", re]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ye, ie, re]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ye, ie, re]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [tn, "first", "last", "none", ie, re]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": T()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: R()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": C()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": C()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": T()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: R()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": C()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": C()
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
        "auto-cols": B()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": B()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: x()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": x()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": x()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...W(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...F(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...F()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...W()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...F(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...F(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": W()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...F(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...F()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: x()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: x()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: x()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: x()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: x()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: x()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: x()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: x()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: x()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: x()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: x()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: q()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: q()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: q()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: q()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: q()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: q()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: q()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: q()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: q()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: q()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: q()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": x()
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
        "space-y": x()
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
        size: J()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...I()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...I()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...I()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/block-size
       */
      "block-size": [{
        block: ["auto", ...Q()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...Q()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...Q()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [u, "screen", ...J()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          u,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...J()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          u,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [f]
          },
          ...J()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...J()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...J()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...J()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", r, Ol, ha]
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
        font: [i, Y1, B1]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", _o, re]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [q1, H1, a]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [re]
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
        tracking: [s, ie, re]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [ye, "none", ie, If]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          c,
          ...x()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", ie, re]
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
        list: ["disc", "decimal", "none", ie, re]
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
        placeholder: Z()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: Z()
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
        decoration: [...Ee(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [ye, "from-font", "auto", ie, ha]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: Z()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [ye, "auto", ie, re]
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
        indent: x()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [tn, ie, re]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", ie, re]
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
        content: ["none", ie, re]
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
        bg: A()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: K()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: ae()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, tn, ie, re],
          radial: ["", ie, re],
          conic: ["", tn, ie, re]
        }, G1, U1]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: Z()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: oe()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: oe()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: oe()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: Z()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: Z()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: Z()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: ce()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": ce()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": ce()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": ce()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": ce()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": ce()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": ce()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": ce()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": ce()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": ce()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": ce()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": ce()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": ce()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": ce()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": ce()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: ue()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": ue()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": ue()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": ue()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": ue()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": ue()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": ue()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": ue()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": ue()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": ue()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": ue()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": ue()
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
        "divide-y": ue()
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
        border: [...Ee(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...Ee(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: Z()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": Z()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": Z()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": Z()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": Z()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": Z()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": Z()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": Z()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": Z()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": Z()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": Z()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: Z()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...Ee(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [ye, ie, re]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ye, Ol, ha]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: Z()
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
          k,
          ei,
          Pr
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: Z()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", g, ei, Pr]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": Z()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: ue()
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
        ring: Z()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [ye, ha]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": Z()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": ue()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": Z()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", b, ei, Pr]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": Z()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [ye, ie, re]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Pe(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Pe()
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
        "mask-linear": [ye]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": he()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": he()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": Z()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": Z()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": he()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": he()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": Z()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": Z()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": he()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": he()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": Z()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": Z()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": he()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": he()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": Z()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": Z()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": he()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": he()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": Z()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": Z()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": he()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": he()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": Z()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": Z()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": he()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": he()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": Z()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": Z()
      }],
      "mask-image-radial": [{
        "mask-radial": [ie, re]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": he()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": he()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": Z()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": Z()
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
        "mask-radial-at": X()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [ye]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": he()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": he()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": Z()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": Z()
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
        mask: A()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: K()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: ae()
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
        mask: ["none", ie, re]
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
          ie,
          re
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: $n()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [ye, ie, re]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ye, ie, re]
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
          ei,
          Pr
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": Z()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", ye, ie, re]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ye, ie, re]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ye, ie, re]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ye, ie, re]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ye, ie, re]
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
          ie,
          re
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": $n()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [ye, ie, re]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ye, ie, re]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ye, ie, re]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ye, ie, re]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ye, ie, re]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ye, ie, re]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ye, ie, re]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ye, ie, re]
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
        "border-spacing": x()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": x()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": x()
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", ie, re]
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
        duration: [ye, "initial", ie, re]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", N, ie, re]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [ye, ie, re]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", D, ie, re]
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
        perspective: [z, ie, re]
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
        rotate: Fn()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Fn()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Fn()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Fn()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: qt()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": qt()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": qt()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": qt()
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
        skew: Lt()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Lt()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Lt()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [ie, re, "", "none", "gpu", "cpu"]
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
        translate: wn()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": wn()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": wn()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": wn()
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
        zoom: [tn, ie, re]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: Z()
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
        caret: Z()
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", ie, re]
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
        "scrollbar-thumb": Z()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": Z()
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
        "scroll-m": x()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": x()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": x()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": x()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": x()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": x()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": x()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": x()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": x()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": x()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": x()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": x()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": x()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": x()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": x()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": x()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": x()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": x()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": x()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": x()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": x()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": x()
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
        "will-change": ["auto", "scroll", "contents", "transform", ie, re]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...Z()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [ye, Ol, ha, If]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...Z()]
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
}, Z1 = /* @__PURE__ */ k1(V1);
function Oe(...n) {
  return Z1(Wp(n));
}
function X1(n, a, r) {
  return n.filter((i, s) => s !== a && (i.start + i.end) / 2 < r).length;
}
function K1(n, a, r, i) {
  const s = n.map(() => 0), c = n[a];
  if (!c) return s;
  const f = n[a + 1], u = n[a - 1], m = c.end - c.start + (f ? f.start - c.end : u ? c.start - u.end : 0);
  return n.forEach((h, k) => {
    a < r && k > a && k <= r ? s[k] = -m : r < a && k >= r && k < a && (s[k] = m);
  }), s[a] = Math.min(Math.max(i, n[0].start - c.start), n[n.length - 1].end - c.end), s;
}
const tp = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function J1(n, a) {
  for (let r = n.parentElement; r; r = r.parentElement) {
    const i = getComputedStyle(r)[a === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (a === "x" ? r.scrollWidth > r.clientWidth : r.scrollHeight > r.clientHeight)) return r;
  }
  return null;
}
function W1(n, a, r, i) {
  const s = n[a] ? J1(n[a], r) : null, c = () => s ? r === "x" ? s.scrollLeft : s.scrollTop : 0, f = (S) => (r === "x" ? S.clientX : S.clientY) + c(), u = f(i), m = c(), h = n.map((S) => {
    const N = S.getBoundingClientRect();
    return r === "x" ? { start: N.left + m, end: N.right + m } : { start: N.top + m, end: N.bottom + m };
  }), k = n.map((S) => tp.map((N) => S.style[N])), g = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = r === "x" ? "translateX" : "translateY";
  let E = !1;
  const _ = { to: a };
  n.forEach((S, N) => {
    if (S.style.pointerEvents = "none", N !== a) {
      g || (S.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(S).position === "static" && (S.style.position = "relative"), S.style.zIndex = "30", S.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const z = (S, N) => {
    _.to = S, K1(h, a, S, N).forEach((D, j) => {
      n[j].style.transform = D ? `${b}(${D}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return _.to;
    },
    slot: (S) => X1(h, a, f(S)),
    apply: (S, N) => {
      E || z(S, f(N) - u);
    },
    rest: () => {
      E || z(a, 0);
    },
    end: () => {
      E || (E = !0, n.forEach((S, N) => tp.forEach((D, j) => {
        S.style[D] = k[N][j];
      })));
    }
  };
}
const $1 = 5;
let So = !1;
function F1(n, a) {
  if (n.button !== 0 || So) return;
  const r = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let c = null, f, u = !1;
  const m = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, h = (_) => {
    if (u) return;
    u = !0, window.removeEventListener("pointermove", k), window.removeEventListener("pointerup", g), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", E, !0), window.removeEventListener("blur", b), i.removeEventListener("lostpointercapture", b);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!c) return;
    So = !1, document.body.style.cursor = m.cursor, document.body.style.userSelect = m.userSelect, c.end();
    const z = (S) => S.stopPropagation();
    window.addEventListener("click", z, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", z, !0), 0), f?.(), a.onEnd(_, c);
  }, k = (_) => {
    if (!c) {
      if (Math.hypot(_.clientX - r.clientX, _.clientY - r.clientY) < $1) return;
      const z = a.items();
      c = W1(z, a.from(z), a.axis, r), So = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", b);
      const S = a.onStart?.();
      f = typeof S == "function" ? S : void 0;
    }
    a.onMove(_, c);
  }, g = () => h(!0), b = () => h(!1), E = (_) => {
    _.key === "Escape" && (_.stopPropagation(), h(!1));
  };
  window.addEventListener("pointermove", k), window.addEventListener("pointerup", g), window.addEventListener("pointercancel", b), window.addEventListener("keydown", E, !0), window.addEventListener("blur", b);
}
const um = typeof navigator < "u" && /Mac/i.test(navigator.platform), xi = {
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
for (let n = 1; n <= 12; n++) xi[`f${n}`] = `F${n}`;
const I1 = Object.fromEntries(Object.entries(xi).map(([n, a]) => [a, n])), P1 = {
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
function ev(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : I1[n];
}
const np = /* @__PURE__ */ new Map();
function dm(n, a = um) {
  const r = `${a}|${n}`, i = np.get(r);
  if (i) return i;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const c of n.split("+"))
    if (c === "mod")
      a ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (c === "cmd" || c === "ctrl" || c === "shift" || c === "alt") s[c] = !0;
    else if (/^[a-z]$/.test(c))
      s.code = `Key${c.toUpperCase()}`, s.letter = c;
    else if (/^[0-9]$/.test(c)) s.code = `Digit${c}`;
    else if (xi[c]) s.code = xi[c];
    else throw new Error(`unknown key "${c}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return np.set(r, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = dm(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function tv(n, a = um) {
  const r = dm(n, a), i = nv(ev(r.code) ?? "");
  return a ? `${r.ctrl ? "⌃" : ""}${r.alt ? "⌥" : ""}${r.shift ? "⇧" : ""}${r.cmd ? "⌘" : ""}${i}` : [r.ctrl && "Ctrl", r.alt && "Alt", r.shift && "Shift", i].filter(Boolean).join("+");
}
const nv = (n) => P1[n] ?? n.toUpperCase(), ap = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, lp = Wp, Ti = (n, a) => (r) => {
  var i;
  if (a?.variants == null) return lp(n, r?.class, r?.className);
  const { variants: s, defaultVariants: c } = a, f = Object.keys(s).map((h) => {
    const k = r?.[h], g = c?.[h];
    if (k === null) return null;
    const b = ap(k) || ap(g);
    return s[h][b];
  }), u = r && Object.entries(r).reduce((h, k) => {
    let [g, b] = k;
    return b === void 0 || (h[g] = b), h;
  }, {}), m = a == null || (i = a.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((h, k) => {
    let { class: g, className: b, ...E } = k;
    return Object.entries(E).every((_) => {
      let [z, S] = _;
      return Array.isArray(S) ? S.includes({
        ...c,
        ...u
      }[z]) : {
        ...c,
        ...u
      }[z] === S;
    }) ? [
      ...h,
      g,
      b
    ] : h;
  }, []);
  return lp(n, f, m, r?.class, r?.className);
}, av = Ti(
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
), lv = Ti(
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
function rv({ className: n, ...a } = {}) {
  return Oe(lv(a), n);
}
const fm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Xl = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", iv = Ti(`${Xl} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function sv({ className: n, ...a } = {}) {
  return Oe(iv(a), n);
}
const Ci = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Go = Ti(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), ov = "my-1 h-px bg-overlay-0";
function cv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function uv({ size: n = 16, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function dv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function pm({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const rp = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function fv({ state: n, error: a }) {
  return /* @__PURE__ */ te.jsx(
    "span",
    {
      className: Oe("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", rp[n] ?? rp.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function pv({ title: n, onClose: a, children: r, testId: i }) {
  return Zl(
    /* @__PURE__ */ te.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && a();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && a();
        },
        children: /* @__PURE__ */ te.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": i,
            children: [
              /* @__PURE__ */ te.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              r
            ]
          }
        )
      }
    ),
    document.body
  );
}
function cc() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var _a = cc();
function mm(n) {
  _a = n;
}
var va = { exec: () => null };
function Fa(n) {
  let a = [];
  return (r) => {
    let i = Math.max(0, Math.min(3, r - 1)), s = a[i];
    return s || (s = n(i), a[i] = s), s;
  };
}
function ze(n, a = "") {
  let r = typeof n == "string" ? n : n.source, i = { replace: (s, c) => {
    let f = typeof c == "string" ? c : c.source;
    return f = f.replace(mt.caret, "$1"), r = r.replace(s, f), i;
  }, getRegex: () => new RegExp(r, a) };
  return i;
}
var mv = ((n = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + n);
  } catch {
    return !1;
  }
})(), mt = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (n) => new RegExp(`^( {0,3}${n})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: Fa((n) => new RegExp(`^ {0,${n}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: Fa((n) => new RegExp(`^ {0,${n}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: Fa((n) => new RegExp(`^ {0,${n}}(?:\`\`\`|~~~)`)), headingBeginRegex: Fa((n) => new RegExp(`^ {0,${n}}#`)), htmlBeginRegex: Fa((n) => new RegExp(`^ {0,${n}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: Fa((n) => new RegExp(`^ {0,${n}}>`)) }, hv = /^(?:[ \t]*(?:\n|$))+/, gv = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, bv = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, Kl = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, vv = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, uc = / {0,3}(?:[*+-]|\d{1,9}[.)])/, hm = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, gm = ze(hm).replace(/bull/g, uc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), yv = ze(hm).replace(/bull/g, uc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), dc = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, xv = /^[^\n]+/, fc = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, wv = ze(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", fc).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), kv = ze(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, uc).getRegex(), Ai = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", pc = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, _v = ze("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", pc).replace("tag", Ai).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), bm = (n) => ze(dc).replace("hr", Kl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", n).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ai).getRegex(), Sv = bm(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), Ev = bm(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), zv = ze(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Ev).getRegex(), mc = { blockquote: zv, code: gv, def: wv, fences: bv, heading: vv, hr: Kl, html: _v, lheading: gm, list: kv, newline: hv, paragraph: Sv, table: va, text: xv }, ip = ze("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", Kl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ai).getRegex(), Nv = { ...mc, lheading: yv, table: ip, paragraph: ze(dc).replace("hr", Kl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", ip).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ai).getRegex() }, Tv = { ...mc, html: ze(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", pc).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: va, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: ze(dc).replace("hr", Kl).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", gm).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, Cv = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, Av = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, vm = /^( {2,}|\\)\n(?!\s*$)/, Mv = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, el = /[\p{P}\p{S}]/u, Mi = /[\s\p{P}\p{S}]/u, hc = /[^\s\p{P}\p{S}]/u, Rv = ze(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Mi).getRegex(), ym = /(?!~)[\p{P}\p{S}]/u, jv = /(?!~)[\s\p{P}\p{S}]/u, Ov = /(?:[^\s\p{P}\p{S}]|~)/u, Dv = ze(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", mv ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), xm = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, Bv = ze(xm, "u").replace(/punct/g, el).getRegex(), Hv = ze(xm, "u").replace(/punct/g, ym).getRegex(), wm = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", Uv = ze(wm, "gu").replace(/notPunctSpace/g, hc).replace(/punctSpace/g, Mi).replace(/punct/g, el).getRegex(), qv = ze(wm, "gu").replace(/notPunctSpace/g, Ov).replace(/punctSpace/g, jv).replace(/punct/g, ym).getRegex(), Lv = ze("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, hc).replace(/punctSpace/g, Mi).replace(/punct/g, el).getRegex(), Gv = ze(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, el).getRegex(), Yv = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", Qv = ze(Yv, "gu").replace(/notPunctSpace/g, hc).replace(/punctSpace/g, Mi).replace(/punct/g, el).getRegex(), Vv = ze(/\\(punct)/, "gu").replace(/punct/g, el).getRegex(), Zv = ze(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), Xv = ze(pc).replace("(?:-->|$)", "-->").getRegex(), Kv = ze("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Xv).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), wi = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, Jv = ze(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", wi).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), km = ze(/^!?\[(label)\]\[(ref)\]/).replace("label", wi).replace("ref", fc).getRegex(), _m = ze(/^!?\[(ref)\](?:\[\])?/).replace("ref", fc).getRegex(), Wv = ze("reflink|nolink(?!\\()", "g").replace("reflink", km).replace("nolink", _m).getRegex(), sp = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, gc = { _backpedal: va, anyPunctuation: Vv, autolink: Zv, blockSkip: Dv, br: vm, code: Av, del: va, delLDelim: va, delRDelim: va, emStrongLDelim: Bv, emStrongRDelimAst: Uv, emStrongRDelimUnd: Lv, escape: Cv, link: Jv, nolink: _m, punctuation: Rv, reflink: km, reflinkSearch: Wv, tag: Kv, text: Mv, url: va }, $v = { ...gc, link: ze(/^!?\[(label)\]\((.*?)\)/).replace("label", wi).getRegex(), reflink: ze(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", wi).getRegex() }, Yo = { ...gc, emStrongRDelimAst: qv, emStrongLDelim: Hv, delLDelim: Gv, delRDelim: Qv, url: ze(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", sp).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: ze(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", sp).getRegex() }, Fv = { ...Yo, br: ze(vm).replace("{2,}", "*").getRegex(), text: ze(Yo.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, ti = { normal: mc, gfm: Nv, pedantic: Tv }, Dl = { normal: gc, gfm: Yo, breaks: Fv, pedantic: $v }, Iv = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, op = (n) => Iv[n];
function nn(n, a) {
  if (a) {
    if (mt.escapeTest.test(n)) return n.replace(mt.escapeReplace, op);
  } else if (mt.escapeTestNoEncode.test(n)) return n.replace(mt.escapeReplaceNoEncode, op);
  return n;
}
function cp(n) {
  try {
    n = encodeURI(n).replace(mt.percentDecode, "%");
  } catch {
    return null;
  }
  return n;
}
function up(n, a) {
  let r = n.replace(mt.findPipe, (c, f, u) => {
    let m = !1, h = f;
    for (; --h >= 0 && u[h] === "\\"; ) m = !m;
    return m ? "|" : " |";
  }), i = r.split(mt.splitPipe), s = 0;
  if (i[0].trim() || i.shift(), i.length > 0 && !i.at(-1)?.trim() && i.pop(), a) if (i.length > a) i.splice(a);
  else for (; i.length < a; ) i.push("");
  for (; s < i.length; s++) i[s] = i[s].trim().replace(mt.slashPipe, "|");
  return i;
}
function Gn(n, a, r) {
  let i = n.length;
  if (i === 0) return "";
  let s = 0;
  for (; s < i && n.charAt(i - s - 1) === a; )
    s++;
  return n.slice(0, i - s);
}
function dp(n) {
  let a = n.split(`
`), r = a.length - 1;
  for (; r >= 0 && mt.blankLine.test(a[r]); ) r--;
  return a.length - r <= 2 ? n : a.slice(0, r + 1).join(`
`);
}
function Pv(n, a) {
  if (n.indexOf(a[1]) === -1) return -1;
  let r = 0;
  for (let i = 0; i < n.length; i++) if (n[i] === "\\") i++;
  else if (n[i] === a[0]) r++;
  else if (n[i] === a[1] && (r--, r < 0)) return i;
  return r > 0 ? -2 : -1;
}
function ey(n, a = 0) {
  let r = a, i = "";
  for (let s of n) if (s === "	") {
    let c = 4 - r % 4;
    i += " ".repeat(c), r += c;
  } else i += s, r++;
  return i;
}
function fp(n, a, r, i, s) {
  let c = a.href, f = a.title || null, u = n[1].replace(s.other.outputLinkReplace, "$1");
  i.state.inLink = !0;
  let m = { type: n[0].charAt(0) === "!" ? "image" : "link", raw: r, href: c, title: f, text: u, tokens: i.inlineTokens(u) };
  return i.state.inLink = !1, m;
}
function ty(n, a, r) {
  let i = n.match(r.other.indentCodeCompensation);
  if (i === null) return a;
  let s = i[1];
  return a.split(`
`).map((c) => {
    let f = c.match(r.other.beginningSpace);
    if (f === null) return c;
    let [u] = f;
    return u.length >= s.length ? c.slice(s.length) : c;
  }).join(`
`);
}
var ki = class {
  options;
  rules;
  lexer;
  constructor(n) {
    this.options = n || _a;
  }
  space(n) {
    let a = this.rules.block.newline.exec(n);
    if (a && a[0].length > 0) return { type: "space", raw: a[0] };
  }
  code(n) {
    let a = this.rules.block.code.exec(n);
    if (a) {
      let r = this.options.pedantic ? a[0] : dp(a[0]), i = r.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: r, codeBlockStyle: "indented", text: i };
    }
  }
  fences(n) {
    let a = this.rules.block.fences.exec(n);
    if (a) {
      let r = a[0], i = ty(r, a[3] || "", this.rules);
      return { type: "code", raw: r, lang: a[2] ? a[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : a[2], text: i };
    }
  }
  heading(n) {
    let a = this.rules.block.heading.exec(n);
    if (a) {
      let r = a[2].trim();
      if (this.rules.other.endingHash.test(r)) {
        let i = Gn(r, "#");
        (this.options.pedantic || !i || this.rules.other.endingSpaceChar.test(i)) && (r = i.trim());
      }
      return { type: "heading", raw: Gn(a[0], `
`), depth: a[1].length, text: r, tokens: this.lexer.inline(r) };
    }
  }
  hr(n) {
    let a = this.rules.block.hr.exec(n);
    if (a) return { type: "hr", raw: Gn(a[0], `
`) };
  }
  blockquote(n) {
    let a = this.rules.block.blockquote.exec(n);
    if (a) {
      let r = Gn(a[0], `
`).split(`
`), i = "", s = "", c = [];
      for (; r.length > 0; ) {
        let f = !1, u = [], m;
        for (m = 0; m < r.length; m++) if (this.rules.other.blockquoteStart.test(r[m])) u.push(r[m]), f = !0;
        else if (!f) u.push(r[m]);
        else break;
        r = r.slice(m);
        let h = u.join(`
`), k = h.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        i = i ? `${i}
${h}` : h, s = s ? `${s}
${k}` : k;
        let g = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(k, c, !0), this.lexer.state.top = g, r.length === 0) break;
        let b = c.at(-1);
        if (b?.type === "code") break;
        if (b?.type === "blockquote") {
          let E = b, _ = E.raw + `
` + r.join(`
`), z = this.blockquote(_);
          c[c.length - 1] = z, i = i.substring(0, i.length - E.raw.length) + z.raw, s = s.substring(0, s.length - E.text.length) + z.text;
          break;
        } else if (b?.type === "list") {
          let E = b, _ = E.raw + `
` + r.join(`
`), z = this.list(_);
          c[c.length - 1] = z, i = i.substring(0, i.length - b.raw.length) + z.raw, s = s.substring(0, s.length - E.raw.length) + z.raw, r = _.substring(c.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: i, tokens: c, text: s };
    }
  }
  list(n) {
    let a = this.rules.block.list.exec(n);
    if (a) {
      let r = a[1].trim(), i = r.length > 1, s = { type: "list", raw: "", ordered: i, start: i ? +r.slice(0, -1) : "", loose: !1, items: [] };
      r = i ? `\\d{1,9}\\${r.slice(-1)}` : `\\${r}`, this.options.pedantic && (r = i ? r : "[*+-]");
      let c = this.rules.other.listItemRegex(r), f = !1;
      for (; n; ) {
        let m = !1, h = "", k = "";
        if (!(a = c.exec(n)) || this.rules.block.hr.test(n)) break;
        h = a[0], n = n.substring(h.length);
        let g = ey(a[2].split(`
`, 1)[0], a[1].length), b = n.split(`
`, 1)[0], E = !g.trim(), _ = 0;
        if (this.options.pedantic ? (_ = 2, k = g.trimStart()) : E ? _ = a[1].length + 1 : (_ = g.search(this.rules.other.nonSpaceChar), _ = _ > 4 ? 1 : _, k = g.slice(_), _ += a[1].length), E && this.rules.other.blankLine.test(b) && (h += b + `
`, n = n.substring(b.length + 1), m = !0), !m) {
          let z = this.rules.other.nextBulletRegex(_), S = this.rules.other.hrRegex(_), N = this.rules.other.fencesBeginRegex(_), D = this.rules.other.headingBeginRegex(_), j = this.rules.other.htmlBeginRegex(_), X = this.rules.other.blockquoteBeginRegex(_);
          for (; n; ) {
            let U = n.split(`
`, 1)[0], V;
            if (b = U, this.options.pedantic ? (b = b.replace(this.rules.other.listReplaceNesting, "  "), V = b) : V = b.replace(this.rules.other.tabCharGlobal, "    "), N.test(b) || D.test(b) || j.test(b) || X.test(b) || z.test(b) || S.test(b)) break;
            if (V.search(this.rules.other.nonSpaceChar) >= _ || !b.trim()) k += `
` + V.slice(_);
            else {
              if (E || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || N.test(g) || D.test(g) || S.test(g)) break;
              k += `
` + b;
            }
            E = !b.trim(), h += U + `
`, n = n.substring(U.length + 1), g = V.slice(_);
          }
        }
        s.loose || (f ? s.loose = !0 : this.rules.other.doubleBlankLine.test(h) && (f = !0)), s.items.push({ type: "list_item", raw: h, task: !!this.options.gfm && this.rules.other.listIsTask.test(k), loose: !1, text: k, tokens: [] }), s.raw += h;
      }
      let u = s.items.at(-1);
      if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
      else return;
      s.raw = s.raw.trimEnd();
      for (let m of s.items) {
        this.lexer.state.top = !1, m.tokens = this.lexer.blockTokens(m.text, []);
        let h = m.tokens[0];
        if (m.task && (h?.type === "text" || h?.type === "paragraph")) {
          m.text = m.text.replace(this.rules.other.listReplaceTask, ""), h.raw = h.raw.replace(this.rules.other.listReplaceTask, ""), h.text = h.text.replace(this.rules.other.listReplaceTask, "");
          for (let g = this.lexer.inlineQueue.length - 1; g >= 0; g--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[g].src)) {
            this.lexer.inlineQueue[g].src = this.lexer.inlineQueue[g].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let k = this.rules.other.listTaskCheckbox.exec(m.raw);
          if (k) {
            let g = { type: "checkbox", raw: k[0] + " ", checked: k[0] !== "[ ]" };
            m.checked = g.checked, s.loose ? m.tokens[0] && ["paragraph", "text"].includes(m.tokens[0].type) && "tokens" in m.tokens[0] && m.tokens[0].tokens ? (m.tokens[0].raw = g.raw + m.tokens[0].raw, m.tokens[0].text = g.raw + m.tokens[0].text, m.tokens[0].tokens.unshift(g)) : m.tokens.unshift({ type: "paragraph", raw: g.raw, text: g.raw, tokens: [g] }) : m.tokens.unshift(g);
          }
        } else m.task && (m.task = !1);
        if (!s.loose) {
          let k = m.tokens.filter((b) => b.type === "space"), g = k.length > 0 && k.some((b) => this.rules.other.anyLine.test(b.raw));
          s.loose = g;
        }
      }
      if (s.loose) for (let m of s.items) {
        m.loose = !0;
        for (let h of m.tokens) h.type === "text" && (h.type = "paragraph");
      }
      return s;
    }
  }
  html(n) {
    let a = this.rules.block.html.exec(n);
    if (a) {
      let r = dp(a[0]);
      return { type: "html", block: !0, raw: r, pre: a[1] === "pre" || a[1] === "script" || a[1] === "style", text: r };
    }
  }
  def(n) {
    let a = this.rules.block.def.exec(n);
    if (a) {
      let r = a[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), i = a[2] ? a[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", s = a[3] ? a[3].substring(1, a[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : a[3];
      return { type: "def", tag: r, raw: Gn(a[0], `
`), href: i, title: s };
    }
  }
  table(n) {
    let a = this.rules.block.table.exec(n);
    if (!a || !this.rules.other.tableDelimiter.test(a[2])) return;
    let r = up(a[1]), i = a[2].replace(this.rules.other.tableAlignChars, "").split("|"), s = a[3]?.trim() ? a[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], c = { type: "table", raw: Gn(a[0], `
`), header: [], align: [], rows: [] };
    if (r.length === i.length) {
      for (let f of i) this.rules.other.tableAlignRight.test(f) ? c.align.push("right") : this.rules.other.tableAlignCenter.test(f) ? c.align.push("center") : this.rules.other.tableAlignLeft.test(f) ? c.align.push("left") : c.align.push(null);
      for (let f = 0; f < r.length; f++) c.header.push({ text: r[f], tokens: this.lexer.inline(r[f]), header: !0, align: c.align[f] });
      for (let f of s) c.rows.push(up(f, c.header.length).map((u, m) => ({ text: u, tokens: this.lexer.inline(u), header: !1, align: c.align[m] })));
      return c;
    }
  }
  lheading(n) {
    let a = this.rules.block.lheading.exec(n);
    if (a) {
      let r = a[1].trim();
      return { type: "heading", raw: Gn(a[0], `
`), depth: a[2].charAt(0) === "=" ? 1 : 2, text: r, tokens: this.lexer.inline(r) };
    }
  }
  paragraph(n) {
    let a = this.rules.block.paragraph.exec(n);
    if (a) {
      let r = a[1].charAt(a[1].length - 1) === `
` ? a[1].slice(0, -1) : a[1];
      return { type: "paragraph", raw: a[0], text: r, tokens: this.lexer.inline(r) };
    }
  }
  text(n) {
    let a = this.rules.block.text.exec(n);
    if (a) return { type: "text", raw: a[0], text: a[0], tokens: this.lexer.inline(a[0]) };
  }
  escape(n) {
    let a = this.rules.inline.escape.exec(n);
    if (a) return { type: "escape", raw: a[0], text: a[1] };
  }
  tag(n) {
    let a = this.rules.inline.tag.exec(n);
    if (a) return !this.lexer.state.inLink && this.rules.other.startATag.test(a[0]) ? this.lexer.state.inLink = !0 : this.lexer.state.inLink && this.rules.other.endATag.test(a[0]) && (this.lexer.state.inLink = !1), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(a[0]) ? this.lexer.state.inRawBlock = !0 : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(a[0]) && (this.lexer.state.inRawBlock = !1), { type: "html", raw: a[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: !1, text: a[0] };
  }
  link(n) {
    let a = this.rules.inline.link.exec(n);
    if (a) {
      let r = a[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(r)) {
        if (!this.rules.other.endAngleBracket.test(r)) return;
        let c = Gn(r.slice(0, -1), "\\");
        if ((r.length - c.length) % 2 === 0) return;
      } else {
        let c = Pv(a[2], "()");
        if (c === -2) return;
        if (c > -1) {
          let f = (a[0].indexOf("!") === 0 ? 5 : 4) + a[1].length + c;
          a[2] = a[2].substring(0, c), a[0] = a[0].substring(0, f).trim(), a[3] = "";
        }
      }
      let i = a[2], s = "";
      if (this.options.pedantic) {
        let c = this.rules.other.pedanticHrefTitle.exec(i);
        c && (i = c[1], s = c[3]);
      } else s = a[3] ? a[3].slice(1, -1) : "";
      return i = i.trim(), this.rules.other.startAngleBracket.test(i) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(r) ? i = i.slice(1) : i = i.slice(1, -1)), fp(a, { href: i && i.replace(this.rules.inline.anyPunctuation, "$1"), title: s && s.replace(this.rules.inline.anyPunctuation, "$1") }, a[0], this.lexer, this.rules);
    }
  }
  reflink(n, a) {
    let r;
    if ((r = this.rules.inline.reflink.exec(n)) || (r = this.rules.inline.nolink.exec(n))) {
      let i = (r[2] || r[1]).replace(this.rules.other.multipleSpaceGlobal, " "), s = a[i.toLowerCase()];
      if (!s) {
        let c = r[0].charAt(0);
        return { type: "text", raw: c, text: c };
      }
      return fp(r, s, r[0], this.lexer, this.rules);
    }
  }
  emStrong(n, a, r = "") {
    let i = this.rules.inline.emStrongLDelim.exec(n);
    if (!(!i || !i[1] && !i[2] && !i[3] && !i[4] || i[4] && r.match(this.rules.other.unicodeAlphaNumeric)) && (!(i[1] || i[3]) || !r || this.rules.inline.punctuation.exec(r))) {
      let s = [...i[0]].length - 1, c, f, u = s, m = 0, h = i[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (h.lastIndex = 0, a = a.slice(-1 * n.length + s); (i = h.exec(a)) !== null; ) {
        if (c = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !c) continue;
        if (f = [...c].length, i[3] || i[4]) {
          u += f;
          continue;
        } else if ((i[5] || i[6]) && s % 3 && !((s + f) % 3)) {
          m += f;
          continue;
        }
        if (u -= f, u > 0) continue;
        f = Math.min(f, f + u + m);
        let k = [...i[0]][0].length, g = n.slice(0, s + i.index + k + f);
        if (Math.min(s, f) % 2) {
          let E = g.slice(1, -1);
          return { type: "em", raw: g, text: E, tokens: this.lexer.inlineTokens(E) };
        }
        let b = g.slice(2, -2);
        return { type: "strong", raw: g, text: b, tokens: this.lexer.inlineTokens(b) };
      }
    }
  }
  codespan(n) {
    let a = this.rules.inline.code.exec(n);
    if (a) {
      let r = a[2].replace(this.rules.other.newLineCharGlobal, " "), i = this.rules.other.nonSpaceChar.test(r), s = this.rules.other.startingSpaceChar.test(r) && this.rules.other.endingSpaceChar.test(r);
      return i && s && (r = r.substring(1, r.length - 1)), { type: "codespan", raw: a[0], text: r };
    }
  }
  br(n) {
    let a = this.rules.inline.br.exec(n);
    if (a) return { type: "br", raw: a[0] };
  }
  del(n, a, r = "") {
    let i = this.rules.inline.delLDelim.exec(n);
    if (i && (!i[1] || !r || this.rules.inline.punctuation.exec(r))) {
      let s = [...i[0]].length - 1, c, f, u = s, m = this.rules.inline.delRDelim;
      for (m.lastIndex = 0, a = a.slice(-1 * n.length + s); (i = m.exec(a)) !== null; ) {
        if (c = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !c || (f = [...c].length, f !== s)) continue;
        if (i[3] || i[4]) {
          u += f;
          continue;
        }
        if (u -= f, u > 0) continue;
        f = Math.min(f, f + u);
        let h = [...i[0]][0].length, k = n.slice(0, s + i.index + h + f), g = k.slice(s, -s);
        return { type: "del", raw: k, text: g, tokens: this.lexer.inlineTokens(g) };
      }
    }
  }
  autolink(n) {
    let a = this.rules.inline.autolink.exec(n);
    if (a) {
      let r, i;
      return a[2] === "@" ? (r = a[1], i = "mailto:" + r) : (r = a[1], i = r), { type: "link", raw: a[0], text: r, href: i, tokens: [{ type: "text", raw: r, text: r }] };
    }
  }
  url(n) {
    let a;
    if (a = this.rules.inline.url.exec(n)) {
      let r, i;
      if (a[2] === "@") r = a[0], i = "mailto:" + r;
      else {
        let s;
        do
          s = a[0], a[0] = this.rules.inline._backpedal.exec(a[0])?.[0] ?? "";
        while (s !== a[0]);
        r = a[0], a[1] === "www." ? i = "http://" + a[0] : i = a[0];
      }
      return { type: "link", raw: a[0], text: r, href: i, tokens: [{ type: "text", raw: r, text: r }] };
    }
  }
  inlineText(n) {
    let a = this.rules.inline.text.exec(n);
    if (a) {
      let r = this.lexer.state.inRawBlock;
      return { type: "text", raw: a[0], text: a[0], escaped: r };
    }
  }
}, Ht = class Qo {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(a) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = a || _a, this.options.tokenizer = this.options.tokenizer || new ki(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, top: !0 };
    let r = { other: mt, block: ti.normal, inline: Dl.normal };
    this.options.pedantic ? (r.block = ti.pedantic, r.inline = Dl.pedantic) : this.options.gfm && (r.block = ti.gfm, this.options.breaks ? r.inline = Dl.breaks : r.inline = Dl.gfm), this.tokenizer.rules = r;
  }
  static get rules() {
    return { block: ti, inline: Dl };
  }
  static lex(a, r) {
    return new Qo(r).lex(a);
  }
  static lexInline(a, r) {
    return new Qo(r).inlineTokens(a);
  }
  lex(a) {
    a = a.replace(mt.carriageReturn, `
`), this.blockTokens(a, this.tokens);
    for (let r = 0; r < this.inlineQueue.length; r++) {
      let i = this.inlineQueue[r];
      this.inlineTokens(i.src, i.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(a, r = [], i = !1) {
    this.tokenizer.lexer = this, this.options.pedantic && (a = a.replace(mt.tabCharGlobal, "    ").replace(mt.spaceLine, ""));
    let s = 1 / 0;
    for (; a; ) {
      if (a.length < s) s = a.length;
      else {
        this.infiniteLoopError(a.charCodeAt(0));
        break;
      }
      let c;
      if (this.options.extensions?.block?.some((u) => (c = u.call({ lexer: this }, a, r)) ? (a = a.substring(c.raw.length), r.push(c), !0) : !1)) continue;
      if (c = this.tokenizer.space(a)) {
        a = a.substring(c.raw.length);
        let u = r.at(-1);
        c.raw.length === 1 && u !== void 0 ? u.raw += `
` : r.push(c);
        continue;
      }
      if (c = this.tokenizer.code(a)) {
        a = a.substring(c.raw.length);
        let u = r.at(-1);
        u?.type === "paragraph" || u?.type === "text" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + c.raw, u.text += `
` + c.text, this.inlineQueue.at(-1).src = u.text) : r.push(c);
        continue;
      }
      if (c = this.tokenizer.fences(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      if (c = this.tokenizer.heading(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      if (c = this.tokenizer.hr(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      if (c = this.tokenizer.blockquote(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      if (c = this.tokenizer.list(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      if (c = this.tokenizer.html(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      if (c = this.tokenizer.def(a)) {
        a = a.substring(c.raw.length);
        let u = r.at(-1);
        u?.type === "paragraph" || u?.type === "text" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + c.raw, u.text += `
` + c.raw, this.inlineQueue.at(-1).src = u.text) : this.tokens.links[c.tag] || (this.tokens.links[c.tag] = { href: c.href, title: c.title }, r.push(c));
        continue;
      }
      if (c = this.tokenizer.table(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      if (c = this.tokenizer.lheading(a)) {
        a = a.substring(c.raw.length), r.push(c);
        continue;
      }
      let f = a;
      if (this.options.extensions?.startBlock) {
        let u = 1 / 0, m = a.slice(1), h;
        this.options.extensions.startBlock.forEach((k) => {
          h = k.call({ lexer: this }, m), typeof h == "number" && h >= 0 && (u = Math.min(u, h));
        }), u < 1 / 0 && u >= 0 && (f = a.substring(0, u + 1));
      }
      if (this.state.top && (c = this.tokenizer.paragraph(f))) {
        let u = r.at(-1);
        i && u?.type === "paragraph" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + c.raw, u.text += `
` + c.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = u.text) : r.push(c), i = f.length !== a.length, a = a.substring(c.raw.length);
        continue;
      }
      if (c = this.tokenizer.text(a)) {
        a = a.substring(c.raw.length);
        let u = r.at(-1);
        u?.type === "text" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + c.raw, u.text += `
` + c.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = u.text) : r.push(c);
        continue;
      }
      if (a) {
        this.infiniteLoopError(a.charCodeAt(0));
        break;
      }
    }
    return this.state.top = !0, r;
  }
  inline(a, r = []) {
    return this.inlineQueue.push({ src: a, tokens: r }), r;
  }
  inlineTokens(a, r = []) {
    this.tokenizer.lexer = this;
    let i = a;
    if (this.tokens.links) {
      let u = Object.keys(this.tokens.links);
      u.length > 0 && (i = i.replace(this.tokenizer.rules.inline.reflinkSearch, (m) => u.includes(m.slice(m.lastIndexOf("[") + 1, -1)) ? "[" + "a".repeat(m.length - 2) + "]" : m));
    }
    i = i.replace(this.tokenizer.rules.inline.anyPunctuation, "++"), i = i.replace(this.tokenizer.rules.inline.blockSkip, (u, m, h) => {
      let k = h ? h.length : 0;
      return u.slice(0, k) + "[" + "a".repeat(u.length - k - 2) + "]";
    }), i = this.options.hooks?.emStrongMask?.call({ lexer: this }, i) ?? i;
    let s = !1, c = "", f = 1 / 0;
    for (; a; ) {
      if (a.length < f) f = a.length;
      else {
        this.infiniteLoopError(a.charCodeAt(0));
        break;
      }
      s || (c = ""), s = !1;
      let u;
      if (this.options.extensions?.inline?.some((h) => (u = h.call({ lexer: this }, a, r)) ? (a = a.substring(u.raw.length), r.push(u), !0) : !1)) continue;
      if (u = this.tokenizer.escape(a)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (u = this.tokenizer.tag(a)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (u = this.tokenizer.link(a)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (u = this.tokenizer.reflink(a, this.tokens.links)) {
        a = a.substring(u.raw.length);
        let h = r.at(-1);
        u.type === "text" && h?.type === "text" ? (h.raw += u.raw, h.text += u.text) : r.push(u);
        continue;
      }
      if (u = this.tokenizer.emStrong(a, i, c)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (u = this.tokenizer.codespan(a)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (u = this.tokenizer.br(a)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (u = this.tokenizer.del(a, i, c)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (u = this.tokenizer.autolink(a)) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      if (!this.state.inLink && (u = this.tokenizer.url(a))) {
        a = a.substring(u.raw.length), r.push(u);
        continue;
      }
      let m = a;
      if (this.options.extensions?.startInline) {
        let h = 1 / 0, k = a.slice(1), g;
        this.options.extensions.startInline.forEach((b) => {
          g = b.call({ lexer: this }, k), typeof g == "number" && g >= 0 && (h = Math.min(h, g));
        }), h < 1 / 0 && h >= 0 && (m = a.substring(0, h + 1));
      }
      if (u = this.tokenizer.inlineText(m)) {
        a = a.substring(u.raw.length), u.raw.slice(-1) !== "_" && (c = u.raw.slice(-1)), s = !0;
        let h = r.at(-1);
        h?.type === "text" ? (h.raw += u.raw, h.text += u.text) : r.push(u);
        continue;
      }
      if (a) {
        this.infiniteLoopError(a.charCodeAt(0));
        break;
      }
    }
    return r;
  }
  infiniteLoopError(a) {
    let r = "Infinite loop on byte: " + a;
    if (this.options.silent) console.error(r);
    else throw new Error(r);
  }
}, _i = class {
  options;
  parser;
  constructor(n) {
    this.options = n || _a;
  }
  space(n) {
    return "";
  }
  code({ text: n, lang: a, escaped: r }) {
    let i = (a || "").match(mt.notSpaceStart)?.[0], s = n.replace(mt.endingNewline, "") + `
`;
    return i ? '<pre><code class="language-' + nn(i) + '">' + (r ? s : nn(s, !0)) + `</code></pre>
` : "<pre><code>" + (r ? s : nn(s, !0)) + `</code></pre>
`;
  }
  blockquote({ tokens: n }) {
    return `<blockquote>
${this.parser.parse(n)}</blockquote>
`;
  }
  html({ text: n }) {
    return n;
  }
  def(n) {
    return "";
  }
  heading({ tokens: n, depth: a }) {
    return `<h${a}>${this.parser.parseInline(n)}</h${a}>
`;
  }
  hr(n) {
    return `<hr>
`;
  }
  list(n) {
    let a = n.ordered, r = n.start, i = "";
    for (let f = 0; f < n.items.length; f++) {
      let u = n.items[f];
      i += this.listitem(u);
    }
    let s = a ? "ol" : "ul", c = a && r !== 1 ? ' start="' + r + '"' : "";
    return "<" + s + c + `>
` + i + "</" + s + `>
`;
  }
  listitem(n) {
    return `<li>${this.parser.parse(n.tokens)}</li>
`;
  }
  checkbox({ checked: n }) {
    return "<input " + (n ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: n }) {
    return `<p>${this.parser.parseInline(n)}</p>
`;
  }
  table(n) {
    let a = "", r = "";
    for (let s = 0; s < n.header.length; s++) r += this.tablecell(n.header[s]);
    a += this.tablerow({ text: r });
    let i = "";
    for (let s = 0; s < n.rows.length; s++) {
      let c = n.rows[s];
      r = "";
      for (let f = 0; f < c.length; f++) r += this.tablecell(c[f]);
      i += this.tablerow({ text: r });
    }
    return i && (i = `<tbody>${i}</tbody>`), `<table>
<thead>
` + a + `</thead>
` + i + `</table>
`;
  }
  tablerow({ text: n }) {
    return `<tr>
${n}</tr>
`;
  }
  tablecell(n) {
    let a = this.parser.parseInline(n.tokens), r = n.header ? "th" : "td";
    return (n.align ? `<${r} align="${n.align}">` : `<${r}>`) + a + `</${r}>
`;
  }
  strong({ tokens: n }) {
    return `<strong>${this.parser.parseInline(n)}</strong>`;
  }
  em({ tokens: n }) {
    return `<em>${this.parser.parseInline(n)}</em>`;
  }
  codespan({ text: n }) {
    return `<code>${nn(n, !0)}</code>`;
  }
  br(n) {
    return "<br>";
  }
  del({ tokens: n }) {
    return `<del>${this.parser.parseInline(n)}</del>`;
  }
  link({ href: n, title: a, tokens: r }) {
    let i = this.parser.parseInline(r), s = cp(n);
    if (s === null) return i;
    n = s;
    let c = '<a href="' + n + '"';
    return a && (c += ' title="' + nn(a) + '"'), c += ">" + i + "</a>", c;
  }
  image({ href: n, title: a, text: r, tokens: i }) {
    i && (r = this.parser.parseInline(i, this.parser.textRenderer));
    let s = cp(n);
    if (s === null) return nn(r);
    n = s;
    let c = `<img src="${n}" alt="${nn(r)}"`;
    return a && (c += ` title="${nn(a)}"`), c += ">", c;
  }
  text(n) {
    return "tokens" in n && n.tokens ? this.parser.parseInline(n.tokens) : "escaped" in n && n.escaped ? n.text : nn(n.text);
  }
}, bc = class {
  strong({ text: n }) {
    return n;
  }
  em({ text: n }) {
    return n;
  }
  codespan({ text: n }) {
    return n;
  }
  del({ text: n }) {
    return n;
  }
  html({ text: n }) {
    return n;
  }
  text({ text: n }) {
    return n;
  }
  link({ text: n }) {
    return "" + n;
  }
  image({ text: n }) {
    return "" + n;
  }
  br() {
    return "";
  }
  checkbox({ raw: n }) {
    return n;
  }
}, Kt = class Vo {
  options;
  renderer;
  textRenderer;
  constructor(a) {
    this.options = a || _a, this.options.renderer = this.options.renderer || new _i(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new bc();
  }
  static parse(a, r) {
    return new Vo(r).parse(a);
  }
  static parseInline(a, r) {
    return new Vo(r).parseInline(a);
  }
  parse(a) {
    this.renderer.parser = this;
    let r = "";
    for (let i = 0; i < a.length; i++) {
      let s = a[i];
      if (this.options.extensions?.renderers?.[s.type]) {
        let f = s, u = this.options.extensions.renderers[f.type].call({ parser: this }, f);
        if (u !== !1 || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(f.type)) {
          r += u || "";
          continue;
        }
      }
      let c = s;
      switch (c.type) {
        case "space": {
          r += this.renderer.space(c);
          break;
        }
        case "hr": {
          r += this.renderer.hr(c);
          break;
        }
        case "heading": {
          r += this.renderer.heading(c);
          break;
        }
        case "code": {
          r += this.renderer.code(c);
          break;
        }
        case "table": {
          r += this.renderer.table(c);
          break;
        }
        case "blockquote": {
          r += this.renderer.blockquote(c);
          break;
        }
        case "list": {
          r += this.renderer.list(c);
          break;
        }
        case "checkbox": {
          r += this.renderer.checkbox(c);
          break;
        }
        case "html": {
          r += this.renderer.html(c);
          break;
        }
        case "def": {
          r += this.renderer.def(c);
          break;
        }
        case "paragraph": {
          r += this.renderer.paragraph(c);
          break;
        }
        case "text": {
          r += this.renderer.text(c);
          break;
        }
        default: {
          let f = 'Token with "' + c.type + '" type was not found.';
          if (this.options.silent) return console.error(f), "";
          throw new Error(f);
        }
      }
    }
    return r;
  }
  parseInline(a, r = this.renderer) {
    this.renderer.parser = this;
    let i = "";
    for (let s = 0; s < a.length; s++) {
      let c = a[s];
      if (this.options.extensions?.renderers?.[c.type]) {
        let u = this.options.extensions.renderers[c.type].call({ parser: this }, c);
        if (u !== !1 || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(c.type)) {
          i += u || "";
          continue;
        }
      }
      let f = c;
      switch (f.type) {
        case "escape": {
          i += r.text(f);
          break;
        }
        case "html": {
          i += r.html(f);
          break;
        }
        case "link": {
          i += r.link(f);
          break;
        }
        case "image": {
          i += r.image(f);
          break;
        }
        case "checkbox": {
          i += r.checkbox(f);
          break;
        }
        case "strong": {
          i += r.strong(f);
          break;
        }
        case "em": {
          i += r.em(f);
          break;
        }
        case "codespan": {
          i += r.codespan(f);
          break;
        }
        case "br": {
          i += r.br(f);
          break;
        }
        case "del": {
          i += r.del(f);
          break;
        }
        case "text": {
          i += r.text(f);
          break;
        }
        default: {
          let u = 'Token with "' + f.type + '" type was not found.';
          if (this.options.silent) return console.error(u), "";
          throw new Error(u);
        }
      }
    }
    return i;
  }
}, Hl = class {
  options;
  block;
  constructor(n) {
    this.options = n || _a;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(n) {
    return n;
  }
  postprocess(n) {
    return n;
  }
  processAllTokens(n) {
    return n;
  }
  emStrongMask(n) {
    return n;
  }
  provideLexer(n = this.block) {
    return n ? Ht.lex : Ht.lexInline;
  }
  provideParser(n = this.block) {
    return n ? Kt.parse : Kt.parseInline;
  }
}, ny = class {
  defaults = cc();
  options = this.setOptions;
  parse = this.parseMarkdown(!0);
  parseInline = this.parseMarkdown(!1);
  Parser = Kt;
  Renderer = _i;
  TextRenderer = bc;
  Lexer = Ht;
  Tokenizer = ki;
  Hooks = Hl;
  constructor(...n) {
    this.use(...n);
  }
  walkTokens(n, a) {
    let r = [];
    for (let i of n) switch (r = r.concat(a.call(this, i)), i.type) {
      case "table": {
        let s = i;
        for (let c of s.header) r = r.concat(this.walkTokens(c.tokens, a));
        for (let c of s.rows) for (let f of c) r = r.concat(this.walkTokens(f.tokens, a));
        break;
      }
      case "list": {
        let s = i;
        r = r.concat(this.walkTokens(s.items, a));
        break;
      }
      default: {
        let s = i;
        this.defaults.extensions?.childTokens?.[s.type] ? this.defaults.extensions.childTokens[s.type].forEach((c) => {
          let f = s[c].flat(1 / 0);
          r = r.concat(this.walkTokens(f, a));
        }) : s.tokens && (r = r.concat(this.walkTokens(s.tokens, a)));
      }
    }
    return r;
  }
  use(...n) {
    let a = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return n.forEach((r) => {
      let i = { ...r };
      if (i.async = this.defaults.async || i.async || !1, r.extensions && (r.extensions.forEach((s) => {
        if (!s.name) throw new Error("extension name required");
        if ("renderer" in s) {
          let c = a.renderers[s.name];
          c ? a.renderers[s.name] = function(...f) {
            let u = s.renderer.apply(this, f);
            return u === !1 && (u = c.apply(this, f)), u;
          } : a.renderers[s.name] = s.renderer;
        }
        if ("tokenizer" in s) {
          if (!s.level || s.level !== "block" && s.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let c = a[s.level];
          c ? c.unshift(s.tokenizer) : a[s.level] = [s.tokenizer], s.start && (s.level === "block" ? a.startBlock ? a.startBlock.push(s.start) : a.startBlock = [s.start] : s.level === "inline" && (a.startInline ? a.startInline.push(s.start) : a.startInline = [s.start]));
        }
        "childTokens" in s && s.childTokens && (a.childTokens[s.name] = s.childTokens);
      }), i.extensions = a), r.renderer) {
        let s = this.defaults.renderer || new _i(this.defaults);
        for (let c in r.renderer) {
          if (!(c in s)) throw new Error(`renderer '${c}' does not exist`);
          if (["options", "parser"].includes(c)) continue;
          let f = c, u = r.renderer[f], m = s[f];
          s[f] = (...h) => {
            let k = u.apply(s, h);
            return k === !1 && (k = m.apply(s, h)), k || "";
          };
        }
        i.renderer = s;
      }
      if (r.tokenizer) {
        let s = this.defaults.tokenizer || new ki(this.defaults);
        for (let c in r.tokenizer) {
          if (!(c in s)) throw new Error(`tokenizer '${c}' does not exist`);
          if (["options", "rules", "lexer"].includes(c)) continue;
          let f = c, u = r.tokenizer[f], m = s[f];
          s[f] = (...h) => {
            let k = u.apply(s, h);
            return k === !1 && (k = m.apply(s, h)), k;
          };
        }
        i.tokenizer = s;
      }
      if (r.hooks) {
        let s = this.defaults.hooks || new Hl();
        for (let c in r.hooks) {
          if (!(c in s)) throw new Error(`hook '${c}' does not exist`);
          if (["options", "block"].includes(c)) continue;
          let f = c, u = r.hooks[f], m = s[f];
          Hl.passThroughHooks.has(c) ? s[f] = (h) => {
            if (this.defaults.async && Hl.passThroughHooksRespectAsync.has(c)) return (async () => {
              let g = await u.call(s, h);
              return m.call(s, g);
            })();
            let k = u.call(s, h);
            return m.call(s, k);
          } : s[f] = (...h) => {
            if (this.defaults.async) return (async () => {
              let g = await u.apply(s, h);
              return g === !1 && (g = await m.apply(s, h)), g;
            })();
            let k = u.apply(s, h);
            return k === !1 && (k = m.apply(s, h)), k;
          };
        }
        i.hooks = s;
      }
      if (r.walkTokens) {
        let s = this.defaults.walkTokens, c = r.walkTokens;
        i.walkTokens = function(f) {
          let u = [];
          return u.push(c.call(this, f)), s && (u = u.concat(s.call(this, f))), u;
        };
      }
      this.defaults = { ...this.defaults, ...i };
    }), this;
  }
  setOptions(n) {
    return this.defaults = { ...this.defaults, ...n }, this;
  }
  lexer(n, a) {
    return Ht.lex(n, a ?? this.defaults);
  }
  parser(n, a) {
    return Kt.parse(n, a ?? this.defaults);
  }
  parseMarkdown(n) {
    return (a, r) => {
      let i = { ...r }, s = { ...this.defaults, ...i }, c = this.onError(!!s.silent, !!s.async);
      if (this.defaults.async === !0 && i.async === !1) return c(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof a > "u" || a === null) return c(new Error("marked(): input parameter is undefined or null"));
      if (typeof a != "string") return c(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(a) + ", string expected"));
      if (s.hooks && (s.hooks.options = s, s.hooks.block = n), s.async) return (async () => {
        let f = s.hooks ? await s.hooks.preprocess(a) : a, u = await (s.hooks ? await s.hooks.provideLexer(n) : n ? Ht.lex : Ht.lexInline)(f, s), m = s.hooks ? await s.hooks.processAllTokens(u) : u;
        s.walkTokens && await Promise.all(this.walkTokens(m, s.walkTokens));
        let h = await (s.hooks ? await s.hooks.provideParser(n) : n ? Kt.parse : Kt.parseInline)(m, s);
        return s.hooks ? await s.hooks.postprocess(h) : h;
      })().catch(c);
      try {
        s.hooks && (a = s.hooks.preprocess(a));
        let f = (s.hooks ? s.hooks.provideLexer(n) : n ? Ht.lex : Ht.lexInline)(a, s);
        s.hooks && (f = s.hooks.processAllTokens(f)), s.walkTokens && this.walkTokens(f, s.walkTokens);
        let u = (s.hooks ? s.hooks.provideParser(n) : n ? Kt.parse : Kt.parseInline)(f, s);
        return s.hooks && (u = s.hooks.postprocess(u)), u;
      } catch (f) {
        return c(f);
      }
    };
  }
  onError(n, a) {
    return (r) => {
      if (r.message += `
Please report this to https://github.com/markedjs/marked.`, n) {
        let i = "<p>An error occurred:</p><pre>" + nn(r.message + "", !0) + "</pre>";
        return a ? Promise.resolve(i) : i;
      }
      if (a) return Promise.reject(r);
      throw r;
    };
  }
}, wa = new ny();
function Re(n, a) {
  return wa.parse(n, a);
}
Re.options = Re.setOptions = function(n) {
  return wa.setOptions(n), Re.defaults = wa.defaults, mm(Re.defaults), Re;
};
Re.getDefaults = cc;
Re.defaults = _a;
Re.use = function(...n) {
  return wa.use(...n), Re.defaults = wa.defaults, mm(Re.defaults), Re;
};
Re.walkTokens = function(n, a) {
  return wa.walkTokens(n, a);
};
Re.parseInline = wa.parseInline;
Re.Parser = Kt;
Re.parser = Kt.parse;
Re.Renderer = _i;
Re.TextRenderer = bc;
Re.Lexer = Ht;
Re.lexer = Ht.lex;
Re.Tokenizer = ki;
Re.Hooks = Hl;
Re.parse = Re;
Re.options;
Re.setOptions;
Re.use;
Re.walkTokens;
Re.parseInline;
Kt.parse;
Ht.lex;
//! markdown.mjs: a Markdown file's rendered preview, drawn from `marked`'s tokens into a fixed set of elements, the
//! ones the web's sanitised preview keeps (`renderFilePreview` in `packages/web/src/markdown.ts`), so the web's
//! `.file-markdown` rules style both. Nothing is parsed as HTML: an HTML token is drawn as its text. Nothing loads on
//! its own: an image is the web's text placeholder (`[image: alt] url`). A link is drawn only for an absolute
//! http(s) address and opens on an explicit click through the window (`link.open`); any other keeps its address as
//! its title, as the web's does.
const di = 2e5;
function ay(n) {
  if (n.length <= di) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, di);
  return { source: n.slice(0, a > 0 ? a : di), truncated: !0 };
}
const ly = (n, a, r) => {
  const i = r.startsWith("data:") ? "data URL" : r.length > 200 ? `${r.slice(0, 200)}…` : r;
  return `[${n}${a ? `: ${a}` : ""}]${i ? ` ${i}` : ""}`;
};
function ya(n, a) {
  return (n ?? []).map((r, i) => ry(r, i, a));
}
function ga(n, a) {
  return n.tokens ? ya(n.tokens, a) : n.text;
}
function ry(n, a, r) {
  switch (n.type) {
    case "space":
      return null;
    case "heading":
      return G.createElement(`h${n.depth}`, { key: a }, ga(n, r));
    case "paragraph":
      return G.createElement("p", { key: a }, ga(n, r));
    case "text":
      return n.tokens ? G.createElement(G.Fragment, { key: a }, ya(n.tokens, r)) : n.text;
    case "escape":
      return n.text;
    case "strong":
      return G.createElement("strong", { key: a }, ga(n, r));
    case "em":
      return G.createElement("em", { key: a }, ga(n, r));
    case "del":
      return G.createElement("del", { key: a }, ga(n, r));
    case "codespan":
      return G.createElement("code", { key: a }, n.text);
    case "br":
      return G.createElement("br", { key: a });
    case "hr":
      return G.createElement("hr", { key: a });
    case "code": {
      const i = /^[\w#+.-]+$/.test(n.lang ?? "") ? `language-${n.lang}` : void 0;
      return G.createElement("pre", { key: a }, G.createElement("code", i ? { className: i } : null, n.text));
    }
    case "blockquote":
      return G.createElement("blockquote", { key: a }, ya(n.tokens, r));
    case "list": {
      const i = n.items.map((s, c) => G.createElement(
        "li",
        { key: c },
        s.task ? G.createElement("input", { type: "checkbox", checked: !!s.checked, disabled: !0, readOnly: !0 }) : null,
        s.task ? " " : null,
        ya(s.tokens, r)
      ));
      return n.ordered ? G.createElement("ol", { key: a, start: n.start === "" || n.start === 1 ? void 0 : n.start }, i) : G.createElement("ul", { key: a }, i);
    }
    case "table": {
      const i = (s) => n.align[s] ? { textAlign: n.align[s] } : void 0;
      return G.createElement(
        "table",
        { key: a },
        G.createElement("thead", null, G.createElement("tr", null, n.header.map((s, c) => G.createElement("th", { key: c, style: i(c) }, ya(s.tokens, r))))),
        G.createElement("tbody", null, n.rows.map((s, c) => G.createElement("tr", { key: c }, s.map((f, u) => G.createElement("td", { key: u, style: i(u) }, ya(f.tokens, r))))))
      );
    }
    case "link": {
      const i = n.href ?? "";
      if (!/^https?:\/\//i.test(i)) return G.createElement("a", { key: a, title: i || void 0 }, ga(n, r));
      const s = (c) => {
        c.preventDefault?.(), r(i);
      };
      return G.createElement("a", { key: a, href: i, rel: "noopener noreferrer", onClick: s }, ga(n, r));
    }
    case "image":
      return G.createElement("span", { key: a, className: "md-placeholder" }, ly("image", n.text, n.href ?? ""));
    // Raw HTML is never parsed: it is drawn as written.
    case "html":
      return n.block ? G.createElement("p", { key: a }, n.text) : n.text;
    default:
      return n.raw ?? null;
  }
}
function iy(n, a) {
  return ya(Ht.lex(n, { gfm: !0 }), a);
}
const ni = 4, Yn = 8, sy = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", pp = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function oy({ value: n, onChange: a, options: r, className: i, ariaLabel: s, testId: c, id: f, title: u, disabled: m, placeholder: h, freeText: k, onKeyDown: g }) {
  const b = G.useId(), [E, _] = G.useState(!1), [z, S] = G.useState(-1), [N, D] = G.useState(!1), j = G.useRef(null), X = G.useRef(null), [U, V] = G.useState({}), w = G.useRef({ text: "", at: 0 }), x = k && N && n ? r.filter((Q) => pp(Q).toLowerCase().includes(n.toLowerCase()) || Q.value.toLowerCase().includes(n.toLowerCase())) : r, y = r.find((Q) => Q.value === n), T = (Q) => `${b}-${Q}`;
  function R(Q) {
    m || (S(Q), _(!0));
  }
  function C() {
    _(!1), D(!1), S(-1);
  }
  function B(Q) {
    !Q || Q.disabled || (a(Q.value), C());
  }
  function W(Q, Z) {
    for (let A = 1; A <= x.length; A++) {
      const K = (Q + Z * A + x.length * A) % x.length;
      if (!x[K].disabled) return K;
    }
    return Q;
  }
  const F = () => x.findIndex((Q) => !Q.disabled), q = () => x.length - 1 - [...x].reverse().findIndex((Q) => !Q.disabled);
  mi(() => {
    if (!E || !j.current) {
      V((ae) => ae.left === void 0 ? ae : {});
      return;
    }
    const Q = j.current.getBoundingClientRect(), Z = window.innerHeight - Q.bottom - ni - Yn, A = Q.top - ni - Yn, K = Z < 160 && A > Z;
    V({
      position: "fixed",
      left: Math.min(Math.max(Yn, Q.left), Math.max(Yn, window.innerWidth - Q.width - Yn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: Q.width,
      maxWidth: window.innerWidth - 2 * Yn,
      maxHeight: Math.min(K ? A : Z, 320),
      ...K ? { bottom: window.innerHeight - Q.top + ni } : { top: Q.bottom + ni },
      overflowY: "auto"
    });
  }, [E, x.length]), mi(() => {
    const Q = X.current;
    if (!E || !Q || U.left === void 0) return;
    const Z = Q.getBoundingClientRect().right, A = window.innerWidth - Yn;
    Z > A && V((K) => ({ ...K, left: Math.max(Yn, Number(K.left) - (Z - A)) }));
  }, [E, U]), Ie(() => {
    if (!E) return;
    const Q = (Z) => {
      const A = Z.target;
      (A === document || A instanceof Node && j.current && A.contains(j.current)) && C();
    };
    return window.addEventListener("resize", C), window.addEventListener("scroll", Q, !0), () => {
      window.removeEventListener("resize", C), window.removeEventListener("scroll", Q, !0);
    };
  }, [E]), Ie(() => {
    const Q = E && z >= 0 ? document.getElementById(T(z)) : null, Z = X.current;
    !Q || !Z || (Q.offsetTop < Z.scrollTop ? Z.scrollTop = Q.offsetTop : Q.offsetTop + Q.offsetHeight > Z.scrollTop + Z.clientHeight && (Z.scrollTop = Q.offsetTop + Q.offsetHeight - Z.clientHeight));
  }, [E, z]), zm(E, (Q) => {
    Q || C();
  }, j, X);
  function J(Q) {
    if (Q.nativeEvent.isComposing) return;
    const Z = () => {
      Q.preventDefault(), Q.stopPropagation();
    }, { key: A } = Q;
    if (E) {
      if (A === "Escape") {
        Z(), C();
        return;
      } else if (A === "Tab")
        C();
      else if (A === "ArrowDown" || A === "ArrowUp") {
        Z(), x.length && S(z < 0 ? A === "ArrowDown" ? F() : q() : W(z, A === "ArrowDown" ? 1 : -1));
        return;
      } else if (A === "Home" && !k) {
        Z(), S(F());
        return;
      } else if (A === "End" && !k) {
        Z(), S(q());
        return;
      } else if (A === "Enter" || A === " " && !k) {
        if (z >= 0 && x[z]) {
          Z(), B(x[z]);
          return;
        }
        if (!k) {
          Z(), C();
          return;
        }
      } else if (!k && A.length === 1 && !Q.metaKey && !Q.ctrlKey && !Q.altKey) {
        const K = Date.now();
        w.current = { text: (K - w.current.at > 600 ? "" : w.current.text) + A.toLowerCase(), at: K };
        const ae = Math.max(z, 0), oe = [...x.slice(ae + (w.current.text.length === 1 ? 1 : 0)), ...x.slice(0, ae + 1)].find((ce) => !ce.disabled && pp(ce).toLowerCase().startsWith(w.current.text));
        oe && (Z(), S(x.indexOf(oe)));
        return;
      }
    } else if (A === "ArrowDown" || A === "ArrowUp" || !k && (A === "Enter" || A === " ")) {
      Z(), R(Math.max(0, x.findIndex((K) => K.value === n)));
      return;
    }
    g?.(Q);
  }
  const I = {
    ref: (Q) => {
      j.current = Q;
    },
    id: f,
    title: u,
    disabled: m,
    "aria-label": s,
    "aria-expanded": E,
    "aria-controls": E ? b : void 0,
    "aria-activedescendant": E && z >= 0 ? T(z) : void 0,
    "data-testid": c,
    onKeyDown: J
  };
  return /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
    k ? /* @__PURE__ */ te.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: h,
        className: i,
        value: n,
        onChange: (Q) => {
          a(Q.target.value), D(!0), E ? S(-1) : (S(-1), _(!0));
        },
        onBlur: () => C()
      }
    ) : /* @__PURE__ */ te.jsxs(
      "button",
      {
        ...I,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Oe("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => E ? C() : R(Math.max(0, x.findIndex((Q) => Q.value === n))),
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "min-w-0 flex-1 truncate", children: y ? y.label : h ?? "" }),
          /* @__PURE__ */ te.jsx(xc, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    E && x.length > 0 && Zl(
      /* @__PURE__ */ te.jsx(
        "div",
        {
          ref: X,
          id: b,
          role: "listbox",
          "aria-label": s,
          className: Oe("z-[9999]", Ci),
          style: U,
          onMouseDown: (Q) => {
            Q.preventDefault(), Q.stopPropagation();
          },
          onClick: (Q) => Q.stopPropagation(),
          children: x.map((Q, Z) => /* @__PURE__ */ te.jsxs(
            "div",
            {
              id: T(Z),
              role: "option",
              "aria-selected": Q.value === n,
              "aria-disabled": Q.disabled || void 0,
              "data-value": Q.value,
              className: Oe(sy, Z === z && !Q.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                Q.disabled || S(Z);
              },
              onClick: () => B(Q),
              children: [
                /* @__PURE__ */ te.jsx("span", { className: "min-w-0 truncate", children: Q.label }),
                Q.value === n && /* @__PURE__ */ te.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            Q.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const mp = 230, cy = 370;
function uy({ x: n, y: a, readOnly: r, canUndo: i, canRedo: s, hasSelection: c, onClose: f, actions: u }) {
  const m = G.useRef(null);
  Ie(() => {
    const b = (_) => {
      m.current?.contains(_.target) || f();
    }, E = (_) => {
      _.key === "Escape" && (_.preventDefault(), f());
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", E), window.addEventListener("blur", f), window.addEventListener("resize", f), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", E), window.removeEventListener("blur", f), window.removeEventListener("resize", f);
    };
  }, [f]);
  const h = (b, E) => Jo(Mm ? b : E), k = (b, E, _, z, S = !1) => /* @__PURE__ */ te.jsxs("button", { type: "button", className: Oe(Rm(), "flex items-center justify-between gap-6"), "data-testid": _, disabled: S, onClick: E, children: [
    /* @__PURE__ */ te.jsx("span", { children: b }),
    /* @__PURE__ */ te.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: z })
  ] }), g = u.askAgent;
  return Zl(
    /* @__PURE__ */ te.jsxs(
      "div",
      {
        ref: m,
        className: Ci,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - cy - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - mp - 8)),
          zIndex: 9999,
          minWidth: mp
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          g && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
            k(c ? "Ask agent about selection…" : "Ask agent about file…", g, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ te.jsx("div", { className: pi })
          ] }),
          k("Undo", u.undo, "editor-menu-undo", h("cmd+z", "ctrl+z"), r || !i),
          k("Redo", u.redo, "editor-menu-redo", h("cmd+shift+z", "ctrl+y"), r || !s),
          /* @__PURE__ */ te.jsx("div", { className: pi }),
          k("Cut", u.cut, "editor-menu-cut", h("cmd+x", "ctrl+x"), r || !c),
          k("Copy", u.copy, "editor-menu-copy", h("cmd+c", "ctrl+c"), !c),
          k("Paste", u.paste, "editor-menu-paste", h("cmd+v", "ctrl+v"), r),
          k("Select All", u.selectAll, "editor-menu-select-all", h("cmd+a", "ctrl+a")),
          /* @__PURE__ */ te.jsx("div", { className: pi }),
          k("Find…", u.find, "editor-menu-find", h("cmd+f", "ctrl+f")),
          !r && k("Replace…", u.replace, "editor-menu-replace", h("cmd+alt+f", "ctrl+h")),
          k("Go to Line…", u.gotoLine, "editor-menu-goto", Jo("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const dy = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", fy = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", py = "m-0 mb-2 text-[0.82rem] text-subtext-0", Sm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", vc = `${Sm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, my = `${vc} min-w-[5.5rem] shrink-0`, yc = `${Sm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, hy = `${yc} flex-1 max-[700px]:flex-[1_1_100%]`, gy = `${yc} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, by = `${yc} flex-[1_1_100%]`, vy = "flex flex-wrap items-center gap-[0.4rem]", yy = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", xy = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", wy = `settings-modal__host-row ${xy}`, ky = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", _y = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Em = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", Sy = `${Em} bg-accent`, Ey = `${Em} ml-auto bg-red`;
function xc({ open: n, size: a = 12, className: r }) {
  return /* @__PURE__ */ te.jsx("svg", { className: r, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function zy({ label: n, items: a, testId: r, side: i = "right", up: s = !1, maxHeight: c = 320 }) {
  const [f, u] = G.useState(!1), [m, h] = G.useState(!1), k = G.useRef(null), g = G.useRef(null), b = () => [...g.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Ie(() => {
    f && m && (b()[0]?.focus(), h(!1));
  }, [f, m]);
  const E = () => {
    u(!0), h(!0);
  }, _ = (S) => {
    (S.key === "ArrowRight" || S.key === "Enter" || S.key === " ") && (S.preventDefault(), E());
  }, z = (S) => {
    const N = b(), D = N.findIndex((j) => j === document.activeElement);
    S.key === "ArrowDown" || S.key === "ArrowUp" ? (S.preventDefault(), N[(D + (S.key === "ArrowDown" ? 1 : N.length - 1)) % N.length]?.focus()) : (S.key === "ArrowLeft" || S.key === "Escape") && (S.preventDefault(), S.stopPropagation(), u(!1), k.current?.focus());
  };
  return /* @__PURE__ */ te.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ te.jsxs(
      "button",
      {
        ref: k,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": f,
        className: Oe(Go(), "flex items-center justify-between gap-2"),
        "data-testid": r,
        onClick: () => f ? u(!1) : E(),
        onKeyDown: _,
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ te.jsx(xc, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ te.jsx(
      "div",
      {
        ref: g,
        role: "menu",
        "aria-label": n,
        className: Oe(
          Ci,
          "absolute z-10 w-60 overflow-y-auto",
          i === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          f ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: c },
        onKeyDown: z,
        children: a.map((S) => /* @__PURE__ */ te.jsx("button", { type: "button", role: "menuitem", className: Go(), "data-testid": S.testId, onClick: S.onSelect, children: /* @__PURE__ */ te.jsx("span", { className: "block truncate", children: S.label }) }, S.key))
      }
    )
  ] });
}
function Ny(n) {
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
function Xo(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((r) => r.id === n.parentSessionId);
}
function Ty(n) {
  const a = /* @__PURE__ */ new Map();
  for (const r of n)
    Xo(r, n) && a.set(r.parentSessionId, [...a.get(r.parentSessionId) ?? [], r]);
  return a.size ? n.filter((r) => !Xo(r, n)).flatMap((r) => [r, ...a.get(r.id) ?? []]) : n;
}
const ai = 6, hp = 8;
function Cy(n, a = {}) {
  const { minWidth: r = 220, align: i = "right", minSpaceAbove: s = 100 } = a, c = n.getBoundingClientRect(), f = window.innerWidth, u = window.innerHeight, m = i === "right" ? { right: Math.max(0, f - c.right) } : { left: Math.max(0, c.left) }, h = c.top - ai - hp, k = u - c.bottom - ai - hp;
  return h >= s ? {
    position: "fixed",
    bottom: u - c.top + ai,
    ...m,
    minWidth: r,
    maxHeight: Math.min(h, u * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: c.bottom + ai,
    ...m,
    minWidth: r,
    maxHeight: Math.min(k, u * 0.75),
    overflowY: "auto"
  };
}
function zm(n, a, r, i) {
  Ie(() => {
    if (!n) return;
    function s(f) {
      const u = f.target, m = r.current?.contains(u) ?? !1, h = i.current?.contains(u) ?? !1;
      !m && !h && a(!1);
    }
    function c(f) {
      f.key === "Escape" && a(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", c), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", c);
    };
  }, [n]);
}
function Ay({ icon: n, fallback: a }) {
  const [r, i] = G.useState(!1);
  return Ie(() => i(!1), [n]), !n || r ? /* @__PURE__ */ te.jsx(te.Fragment, { children: a }) : /* @__PURE__ */ te.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
const My = ["application/zip", "application/x-tar", "application/gzip"];
function Nm(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (My.includes(a)) return "archive";
}
//! `FileAsset` for the native client: the web's `WorkspaceFileAsset` (same markup and classes, so the parity gate
//! names the same boxes) with what a browser did natively done by the host's `perch-media` module (`perch.media`):
//! the image is an engine node drawn by `perch-media`'s `Image`, and PDF, audio and video are a card whose buttons
//! open the workspace's real file in Quick Look or its default app. The web's Fit / 100% / zoom arithmetic, keys and
//! messages are its own, line for line.
//!
//! From the host: `perch.media` (the module), `perch.mediaFile(workspaceId, path)` →
//! `{ root: string | null, extraction: { state, destination?, error? } | null }` (`root` is the workspace's absolute
//! folder on this computer, null for a remote workspace), and the command `files.extract { workspaceId, path }`.
const Ry = 50 * 1024 * 1024, gp = 1.25, jy = 0.05, Oy = 16384, Dy = "inline-flex items-center justify-center", li = Oe(Xl, Dy, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), Eo = Oe(Xl, "inline-flex min-h-8 items-center px-2"), By = { pdf: "PDF document", audio: "Audio", video: "Video" };
let Hy = 0;
function Uy(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function qy(n, a, r) {
  const i = a ? Math.min(8, Oy / Math.max(a.width, a.height)) : 1, s = r === "in" ? n * gp : r === "out" ? n / gp : 1;
  return Math.min(i, Math.max(Math.min(jy, i), s));
}
function Ly(n, a) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${a.replace(/^\/+/, "")}`;
}
function Gy({ media: n, workspaceId: a, metadata: r, onFail: i }) {
  const s = G.useMemo(() => `media-${++Hy}`, []), [c, f] = G.useState(null), [u, m] = G.useState("fit");
  Ie(() => {
    let _ = !0;
    return n.open(s, { workspaceId: a, path: r.path, mediaType: r.mediaType ?? "", size: r.size }).then((z) => {
      _ && f(z ?? { width: 0, height: 0 });
    }, (z) => {
      _ && i(String(z?.message ?? z));
    }), () => {
      _ = !1, n.release(s);
    };
  }, [s]), Ie(() => {
    n.setZoom(s, u === "fit" ? null : u);
  }, [s, u]);
  const h = c !== null && c.width > 0 && c.height > 0, k = () => u !== "fit" ? u : n.fitScale(s) ?? 1, g = (_) => m(qy(k(), c, _)), b = (_) => {
    if (!(_.metaKey || _.ctrlKey || _.altKey || !h)) {
      if (_.key === "+" || _.key === "=") g("in");
      else if (_.key === "-") g("out");
      else if (_.key === "0") g("actual");
      else return;
      _.preventDefault();
    }
  }, E = u === "fit" ? "Fit" : `${Math.round(u * 100)}%`;
  return G.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    G.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      G.createElement("button", { type: "button", className: li, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !h, onClick: () => g("out") }, "−"),
      G.createElement("button", { type: "button", className: li, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !h, onClick: () => g("in") }, "+"),
      G.createElement("button", { type: "button", className: Oe(li, u === "fit" && "text-fg"), "aria-pressed": u === "fit", onClick: () => m("fit") }, "Fit"),
      G.createElement("button", { type: "button", className: Oe(li, u === 1 && "text-fg"), "aria-pressed": u === 1, title: "Actual size (0)", disabled: !h, onClick: () => g("actual") }, "100%"),
      G.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, h ? `${c.width} × ${c.height} · ${E}` : "")
    ),
    G.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${r.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: b
    }, c === null ? G.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : G.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function Yy({ workspaceId: n, metadata: a, perch: r }) {
  const [i, s] = G.useState(!1), c = r.mediaFile?.(n, a.path) ?? { root: null, extraction: null }, f = c.extraction, u = Nm(a.mediaType), m = Ly(c.root, a.path), h = m === null, k = u === "archive", g = u === "image" && a.size > Ry, b = u !== void 0 && !k && !h && !g;
  let E = "Open this file in Quick Look or its default app.";
  h ? E = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : k && (E = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let _ = "No preview for this file type";
  h ? _ = "Remote media is not available yet" : k ? _ = "Compressed archive" : g ? (_ = "Image too large to preview", E = `This image is ${Math.round(a.size / 1048576)} MB. Open it in Quick Look or its default app.`) : i && (_ = "Preview unavailable", u === "image" && (E = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const z = (N) => {
    try {
      r.media[N](m);
    } catch (D) {
      console.error(`perch-media ${N}: ${D?.message ?? D}`);
    }
  }, S = u === "pdf" || u === "audio" || u === "video";
  return G.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${a.path}`, "data-testid": "workspace-file-asset" },
    G.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      G.createElement("strong", { className: "min-w-0 flex-1 truncate", title: a.path }, a.path),
      k && G.createElement(
        "button",
        { type: "button", className: Eo, disabled: f?.state === "loading", onClick: () => r.command("files.extract", { workspaceId: n, path: a.path }) },
        f?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !h && G.createElement("button", { type: "button", className: Eo, onClick: () => z("quickLook") }, "Quick Look"),
      !h && G.createElement("button", { type: "button", className: Eo, onClick: () => z("openDefault") }, "Open with Default App")
    ),
    f?.state === "ready" && G.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${f.destination}. Find it in the file tree.`),
    f?.state === "error" && G.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, f.error),
    !b || i ? G.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      G.createElement("strong", { className: "text-fg" }, _),
      G.createElement("span", null, E)
    ) : u === "image" ? G.createElement(Gy, { media: r.media, workspaceId: n, metadata: a, onFail: () => s(!0) }) : S && G.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      G.createElement("strong", { className: "text-fg" }, a.name),
      G.createElement("span", null, `${By[u]} · ${Uy(a.size)}`),
      G.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function Qy(n, a = !1) {
  const r = n.toLowerCase();
  if (a) return { kind: /^(node_modules|packages|crates|vendor)$/.test(r) ? "package" : r === "lib" ? "library" : "folder", tone: "text-subtext-0" };
  if (/^(package\.json|cargo\.toml|go\.mod|pyproject\.toml|gemfile|composer\.json)$/.test(r)) return { kind: "package", tone: "text-peach" };
  if (/^(dockerfile|containerfile)(\.|$)/.test(r)) return { kind: "package", tone: "text-blue" };
  if (/^(\.gitignore|\.gitattributes|\.gitmodules)$/.test(r)) return { kind: "branch", tone: "text-subtext-0" };
  if (/\.(tsx|jsx)$/.test(r)) return { kind: "react", tone: "text-blue" };
  if (/\.(css|scss|sass|less)$/.test(r)) return { kind: "style", tone: "text-mauve" };
  if (/\.(md|mdx|txt|rst)$/.test(r) || /^(readme|license|copying)(\.|$)/.test(r)) return { kind: "book", tone: "text-subtext-0" };
  if (/\.(json|jsonc|ya?ml|toml|lock|ini|conf)$/.test(r) || /^\.env(\.|$)/.test(r)) return { kind: "config", tone: "text-yellow" };
  if (/\.(png|jpe?g|gif|webp|svg|ico|avif)$/.test(r)) return { kind: "image", tone: "text-mauve" };
  const i = r.split(".").at(-1) ?? "", s = {
    ts: ["TS", "text-blue"],
    mts: ["TS", "text-blue"],
    cts: ["TS", "text-blue"],
    js: ["JS", "text-yellow"],
    mjs: ["JS", "text-yellow"],
    cjs: ["JS", "text-yellow"],
    rs: ["RS", "text-peach"],
    py: ["PY", "text-blue"],
    go: ["GO", "text-blue"],
    sh: ["SH", "text-green"],
    bash: ["SH", "text-green"],
    zsh: ["SH", "text-green"],
    c: ["C", "text-blue"],
    h: ["C", "text-blue"],
    cpp: ["C+", "text-blue"],
    java: ["J", "text-peach"]
  }, c = n.includes(".") && Object.hasOwn(s, i) ? s[i] : void 0;
  return c ? { kind: "language", tone: c[1], text: c[0] } : /\.(html?|vue|svelte)$/.test(r) ? { kind: "code", tone: "text-peach" } : { kind: "file", tone: "text-subtext-0" };
}
const Vy = {
  file: "M9 2H3v12h10V6zM9 2v4h4",
  folder: "M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z",
  package: "m8 1 6 3.5v7L8 15l-6-3.5v-7zM2 4.5 8 8l6-3.5M8 8v7M5 2.75l6 3.5v3",
  library: "M2 2h3v12H2zM7 2h3v12H7zM11 3l2-1 2 11-2 1z",
  style: "m6 2-2 12M12 2l-2 12M2 6h12M1 10h12",
  book: "M2 3h5l1 1 1-1h5v10H9l-1 1-1-1H2zM8 4v10",
  code: "m5 5-3 3 3 3m6-6 3 3-3 3M9 3 7 13",
  config: "M5 2H4a1 1 0 0 0-1 1v3L1 8l2 2v3a1 1 0 0 0 1 1h1M11 2h1a1 1 0 0 1 1 1v3l2 2-2 2v3a1 1 0 0 1-1 1h-1",
  branch: "M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5",
  image: "M2 2h12v12H2zM2 11l4-4 3 3 2-2 3 3"
};
function Zy({ name: n, directory: a = !1, open: r = !1 }) {
  const { kind: i, tone: s, text: c } = Qy(n, a);
  return /* @__PURE__ */ te.jsxs("svg", { className: Oe("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": i, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    i === "react" ? /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : c ? /* @__PURE__ */ te.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: c }) : /* @__PURE__ */ te.jsx("path", { d: i === "folder" && r ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : Vy[i] }),
    i === "branch" && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    i === "image" && /* @__PURE__ */ te.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const Xy = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, bp = (n) => typeof n == "string" ? Xy[n] ?? "?" : "?", vp = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function Ky(n) {
  const a = bp(n.index), r = bp(n.worktree), i = a === "!" || r === "!", s = i ? "!" : n.staged && n.unstaged ? `${a || "?"}/${r || "?"}` : n.staged ? a : r || a, c = `Git · Index: ${vp(n.index)}; working tree: ${vp(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, f = i || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: c, tone: f };
}
function Jy({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ te.jsx("span", { className: Oe("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: r, title: i, tone: s } = Ky(n.entry);
  return r ? /* @__PURE__ */ te.jsx("span", { className: Oe("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": i, title: i, "data-testid": "file-git-marker", children: r }) : null;
}
const Wy = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Tm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", $y = `${Tm} group-aria-[checked=false]:text-accent`, Fy = `${Tm} group-aria-checked:text-accent`, Iy = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", Py = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function ex({
  mode: n,
  onChange: a,
  testId: r = "mode-switch",
  disabled: i = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ te.jsxs(
    "button",
    {
      type: "button",
      className: Wy,
      "data-testid": r,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => a(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__label mode-switch__label--ui", $y), children: "UI" }),
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__track", Iy), children: /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__thumb", Py) }) }),
        /* @__PURE__ */ te.jsx("span", { className: Oe("mode-switch__label mode-switch__label--cli", Fy), children: "CLI" })
      ]
    }
  );
}
const tl = function(n, a) {
  let s = n;
  const c = Ul[a];
  let f = null, u = 0, m = null;
  const h = [], k = {}, g = function(w, x) {
    u = s * 4 + 17, f = (function(y) {
      const T = new Array(y);
      for (let R = 0; R < y; R += 1) {
        T[R] = new Array(y);
        for (let C = 0; C < y; C += 1)
          T[R][C] = null;
      }
      return T;
    })(u), b(0, 0), b(u - 7, 0), b(0, u - 7), z(), _(), N(w, x), s >= 7 && S(w), m == null && (m = X(s, c, h)), D(m, x);
  }, b = function(w, x) {
    for (let y = -1; y <= 7; y += 1)
      if (!(w + y <= -1 || u <= w + y))
        for (let T = -1; T <= 7; T += 1)
          x + T <= -1 || u <= x + T || (0 <= y && y <= 6 && (T == 0 || T == 6) || 0 <= T && T <= 6 && (y == 0 || y == 6) || 2 <= y && y <= 4 && 2 <= T && T <= 4 ? f[w + y][x + T] = !0 : f[w + y][x + T] = !1);
  }, E = function() {
    let w = 0, x = 0;
    for (let y = 0; y < 8; y += 1) {
      g(!0, y);
      const T = Vn.getLostPoint(k);
      (y == 0 || w > T) && (w = T, x = y);
    }
    return x;
  }, _ = function() {
    for (let w = 8; w < u - 8; w += 1)
      f[w][6] == null && (f[w][6] = w % 2 == 0);
    for (let w = 8; w < u - 8; w += 1)
      f[6][w] == null && (f[6][w] = w % 2 == 0);
  }, z = function() {
    const w = Vn.getPatternPosition(s);
    for (let x = 0; x < w.length; x += 1)
      for (let y = 0; y < w.length; y += 1) {
        const T = w[x], R = w[y];
        if (f[T][R] == null)
          for (let C = -2; C <= 2; C += 1)
            for (let B = -2; B <= 2; B += 1)
              C == -2 || C == 2 || B == -2 || B == 2 || C == 0 && B == 0 ? f[T + C][R + B] = !0 : f[T + C][R + B] = !1;
      }
  }, S = function(w) {
    const x = Vn.getBCHTypeNumber(s);
    for (let y = 0; y < 18; y += 1) {
      const T = !w && (x >> y & 1) == 1;
      f[Math.floor(y / 3)][y % 3 + u - 8 - 3] = T;
    }
    for (let y = 0; y < 18; y += 1) {
      const T = !w && (x >> y & 1) == 1;
      f[y % 3 + u - 8 - 3][Math.floor(y / 3)] = T;
    }
  }, N = function(w, x) {
    const y = c << 3 | x, T = Vn.getBCHTypeInfo(y);
    for (let R = 0; R < 15; R += 1) {
      const C = !w && (T >> R & 1) == 1;
      R < 6 ? f[R][8] = C : R < 8 ? f[R + 1][8] = C : f[u - 15 + R][8] = C;
    }
    for (let R = 0; R < 15; R += 1) {
      const C = !w && (T >> R & 1) == 1;
      R < 8 ? f[8][u - R - 1] = C : R < 9 ? f[8][15 - R - 1 + 1] = C : f[8][15 - R - 1] = C;
    }
    f[u - 8][8] = !w;
  }, D = function(w, x) {
    let y = -1, T = u - 1, R = 7, C = 0;
    const B = Vn.getMaskFunction(x);
    for (let W = u - 1; W > 0; W -= 2)
      for (W == 6 && (W -= 1); ; ) {
        for (let F = 0; F < 2; F += 1)
          if (f[T][W - F] == null) {
            let q = !1;
            C < w.length && (q = (w[C] >>> R & 1) == 1), B(T, W - F) && (q = !q), f[T][W - F] = q, R -= 1, R == -1 && (C += 1, R = 7);
          }
        if (T += y, T < 0 || u <= T) {
          T -= y, y = -y;
          break;
        }
      }
  }, j = function(w, x) {
    let y = 0, T = 0, R = 0;
    const C = new Array(x.length), B = new Array(x.length);
    for (let J = 0; J < x.length; J += 1) {
      const I = x[J].dataCount, Q = x[J].totalCount - I;
      T = Math.max(T, I), R = Math.max(R, Q), C[J] = new Array(I);
      for (let ae = 0; ae < C[J].length; ae += 1)
        C[J][ae] = 255 & w.getBuffer()[ae + y];
      y += I;
      const Z = Vn.getErrorCorrectPolynomial(Q), K = Ql(C[J], Z.getLength() - 1).mod(Z);
      B[J] = new Array(Z.getLength() - 1);
      for (let ae = 0; ae < B[J].length; ae += 1) {
        const oe = ae + K.getLength() - B[J].length;
        B[J][ae] = oe >= 0 ? K.getAt(oe) : 0;
      }
    }
    let W = 0;
    for (let J = 0; J < x.length; J += 1)
      W += x[J].totalCount;
    const F = new Array(W);
    let q = 0;
    for (let J = 0; J < T; J += 1)
      for (let I = 0; I < x.length; I += 1)
        J < C[I].length && (F[q] = C[I][J], q += 1);
    for (let J = 0; J < R; J += 1)
      for (let I = 0; I < x.length; I += 1)
        J < B[I].length && (F[q] = B[I][J], q += 1);
    return F;
  }, X = function(w, x, y) {
    const T = yp.getRSBlocks(w, x), R = xp();
    for (let B = 0; B < y.length; B += 1) {
      const W = y[B];
      R.put(W.getMode(), 4), R.put(W.getLength(), Vn.getLengthInBits(W.getMode(), w)), W.write(R);
    }
    let C = 0;
    for (let B = 0; B < T.length; B += 1)
      C += T[B].dataCount;
    if (R.getLengthInBits() > C * 8)
      throw "code length overflow. (" + R.getLengthInBits() + ">" + C * 8 + ")";
    for (R.getLengthInBits() + 4 <= C * 8 && R.put(0, 4); R.getLengthInBits() % 8 != 0; )
      R.putBit(!1);
    for (; !(R.getLengthInBits() >= C * 8 || (R.put(236, 8), R.getLengthInBits() >= C * 8)); )
      R.put(17, 8);
    return j(R, T);
  };
  k.addData = function(w, x) {
    x = x || "Byte";
    let y = null;
    switch (x) {
      case "Numeric":
        y = tx(w);
        break;
      case "Alphanumeric":
        y = nx(w);
        break;
      case "Byte":
        y = ax(w);
        break;
      case "Kanji":
        y = lx(w);
        break;
      default:
        throw "mode:" + x;
    }
    h.push(y), m = null;
  }, k.isDark = function(w, x) {
    if (w < 0 || u <= w || x < 0 || u <= x)
      throw w + "," + x;
    return f[w][x];
  }, k.getModuleCount = function() {
    return u;
  }, k.make = function() {
    if (s < 1) {
      let w = 1;
      for (; w < 40; w++) {
        const x = yp.getRSBlocks(w, c), y = xp();
        for (let R = 0; R < h.length; R++) {
          const C = h[R];
          y.put(C.getMode(), 4), y.put(C.getLength(), Vn.getLengthInBits(C.getMode(), w)), C.write(y);
        }
        let T = 0;
        for (let R = 0; R < x.length; R++)
          T += x[R].dataCount;
        if (y.getLengthInBits() <= T * 8)
          break;
      }
      s = w;
    }
    g(!1, E());
  }, k.createTableTag = function(w, x) {
    w = w || 2, x = typeof x > "u" ? w * 4 : x;
    let y = "";
    y += '<table style="', y += " border-width: 0px; border-style: none;", y += " border-collapse: collapse;", y += " padding: 0px; margin: " + x + "px;", y += '">', y += "<tbody>";
    for (let T = 0; T < k.getModuleCount(); T += 1) {
      y += "<tr>";
      for (let R = 0; R < k.getModuleCount(); R += 1)
        y += '<td style="', y += " border-width: 0px; border-style: none;", y += " border-collapse: collapse;", y += " padding: 0px; margin: 0px;", y += " width: " + w + "px;", y += " height: " + w + "px;", y += " background-color: ", y += k.isDark(T, R) ? "#000000" : "#ffffff", y += ";", y += '"/>';
      y += "</tr>";
    }
    return y += "</tbody>", y += "</table>", y;
  }, k.createSvgTag = function(w, x, y, T) {
    let R = {};
    typeof arguments[0] == "object" && (R = arguments[0], w = R.cellSize, x = R.margin, y = R.alt, T = R.title), w = w || 2, x = typeof x > "u" ? w * 4 : x, y = typeof y == "string" ? { text: y } : y || {}, y.text = y.text || null, y.id = y.text ? y.id || "qrcode-description" : null, T = typeof T == "string" ? { text: T } : T || {}, T.text = T.text || null, T.id = T.text ? T.id || "qrcode-title" : null;
    const C = k.getModuleCount() * w + x * 2;
    let B, W, F, q, J = "", I;
    for (I = "l" + w + ",0 0," + w + " -" + w + ",0 0,-" + w + "z ", J += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', J += R.scalable ? "" : ' width="' + C + 'px" height="' + C + 'px"', J += ' viewBox="0 0 ' + C + " " + C + '" ', J += ' preserveAspectRatio="xMinYMin meet"', J += T.text || y.text ? ' role="img" aria-labelledby="' + U([T.id, y.id].join(" ").trim()) + '"' : "", J += ">", J += T.text ? '<title id="' + U(T.id) + '">' + U(T.text) + "</title>" : "", J += y.text ? '<description id="' + U(y.id) + '">' + U(y.text) + "</description>" : "", J += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', J += '<path d="', F = 0; F < k.getModuleCount(); F += 1)
      for (q = F * w + x, B = 0; B < k.getModuleCount(); B += 1)
        k.isDark(F, B) && (W = B * w + x, J += "M" + W + "," + q + I);
    return J += '" stroke="transparent" fill="black"/>', J += "</svg>", J;
  }, k.createDataURL = function(w, x) {
    w = w || 2, x = typeof x > "u" ? w * 4 : x;
    const y = k.getModuleCount() * w + x * 2, T = x, R = y - x;
    return ox(y, y, function(C, B) {
      if (T <= C && C < R && T <= B && B < R) {
        const W = Math.floor((C - T) / w), F = Math.floor((B - T) / w);
        return k.isDark(F, W) ? 0 : 1;
      } else
        return 1;
    });
  }, k.createImgTag = function(w, x, y) {
    w = w || 2, x = typeof x > "u" ? w * 4 : x;
    const T = k.getModuleCount() * w + x * 2;
    let R = "";
    return R += "<img", R += ' src="', R += k.createDataURL(w, x), R += '"', R += ' width="', R += T, R += '"', R += ' height="', R += T, R += '"', y && (R += ' alt="', R += U(y), R += '"'), R += "/>", R;
  };
  const U = function(w) {
    let x = "";
    for (let y = 0; y < w.length; y += 1) {
      const T = w.charAt(y);
      switch (T) {
        case "<":
          x += "&lt;";
          break;
        case ">":
          x += "&gt;";
          break;
        case "&":
          x += "&amp;";
          break;
        case '"':
          x += "&quot;";
          break;
        default:
          x += T;
          break;
      }
    }
    return x;
  }, V = function(w) {
    w = typeof w > "u" ? 2 : w;
    const y = k.getModuleCount() * 1 + w * 2, T = w, R = y - w;
    let C, B, W, F, q;
    const J = {
      "██": "█",
      "█ ": "▀",
      " █": "▄",
      "  ": " "
    }, I = {
      "██": "▀",
      "█ ": "▀",
      " █": " ",
      "  ": " "
    };
    let Q = "";
    for (C = 0; C < y; C += 2) {
      for (W = Math.floor((C - T) / 1), F = Math.floor((C + 1 - T) / 1), B = 0; B < y; B += 1)
        q = "█", T <= B && B < R && T <= C && C < R && k.isDark(W, Math.floor((B - T) / 1)) && (q = " "), T <= B && B < R && T <= C + 1 && C + 1 < R && k.isDark(F, Math.floor((B - T) / 1)) ? q += " " : q += "█", Q += w < 1 && C + 1 >= R ? I[q] : J[q];
      Q += `
`;
    }
    return y % 2 && w > 0 ? Q.substring(0, Q.length - y - 1) + Array(y + 1).join("▀") : Q.substring(0, Q.length - 1);
  };
  return k.createASCII = function(w, x) {
    if (w = w || 1, w < 2)
      return V(x);
    w -= 1, x = typeof x > "u" ? w * 2 : x;
    const y = k.getModuleCount() * w + x * 2, T = x, R = y - x;
    let C, B, W, F;
    const q = Array(w + 1).join("██"), J = Array(w + 1).join("  ");
    let I = "", Q = "";
    for (C = 0; C < y; C += 1) {
      for (W = Math.floor((C - T) / w), Q = "", B = 0; B < y; B += 1)
        F = 1, T <= B && B < R && T <= C && C < R && k.isDark(W, Math.floor((B - T) / w)) && (F = 0), Q += F ? q : J;
      for (W = 0; W < w; W += 1)
        I += Q + `
`;
    }
    return I.substring(0, I.length - 1);
  }, k.renderTo2dContext = function(w, x) {
    x = x || 2;
    const y = k.getModuleCount();
    for (let T = 0; T < y; T++)
      for (let R = 0; R < y; R++)
        w.fillStyle = k.isDark(T, R) ? "black" : "white", w.fillRect(R * x, T * x, x, x);
  }, k;
};
tl.stringToBytes = function(n) {
  const a = [];
  for (let r = 0; r < n.length; r += 1) {
    const i = n.charCodeAt(r);
    a.push(i & 255);
  }
  return a;
};
tl.createStringToBytes = function(n, a) {
  const r = (function() {
    const s = ix(n), c = function() {
      const m = s.read();
      if (m == -1) throw "eof";
      return m;
    };
    let f = 0;
    const u = {};
    for (; ; ) {
      const m = s.read();
      if (m == -1) break;
      const h = c(), k = c(), g = c(), b = String.fromCharCode(m << 8 | h), E = k << 8 | g;
      u[b] = E, f += 1;
    }
    if (f != a)
      throw f + " != " + a;
    return u;
  })(), i = 63;
  return function(s) {
    const c = [];
    for (let f = 0; f < s.length; f += 1) {
      const u = s.charCodeAt(f);
      if (u < 128)
        c.push(u);
      else {
        const m = r[s.charAt(f)];
        typeof m == "number" ? (m & 255) == m ? c.push(m) : (c.push(m >>> 8), c.push(m & 255)) : c.push(i);
      }
    }
    return c;
  };
};
const pt = {
  MODE_NUMBER: 1,
  MODE_ALPHA_NUM: 2,
  MODE_8BIT_BYTE: 4,
  MODE_KANJI: 8
}, Ul = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
}, Qn = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
}, Vn = (function() {
  const n = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170]
  ], a = 1335, r = 7973, i = 21522, s = {}, c = function(f) {
    let u = 0;
    for (; f != 0; )
      u += 1, f >>>= 1;
    return u;
  };
  return s.getBCHTypeInfo = function(f) {
    let u = f << 10;
    for (; c(u) - c(a) >= 0; )
      u ^= a << c(u) - c(a);
    return (f << 10 | u) ^ i;
  }, s.getBCHTypeNumber = function(f) {
    let u = f << 12;
    for (; c(u) - c(r) >= 0; )
      u ^= r << c(u) - c(r);
    return f << 12 | u;
  }, s.getPatternPosition = function(f) {
    return n[f - 1];
  }, s.getMaskFunction = function(f) {
    switch (f) {
      case Qn.PATTERN000:
        return function(u, m) {
          return (u + m) % 2 == 0;
        };
      case Qn.PATTERN001:
        return function(u, m) {
          return u % 2 == 0;
        };
      case Qn.PATTERN010:
        return function(u, m) {
          return m % 3 == 0;
        };
      case Qn.PATTERN011:
        return function(u, m) {
          return (u + m) % 3 == 0;
        };
      case Qn.PATTERN100:
        return function(u, m) {
          return (Math.floor(u / 2) + Math.floor(m / 3)) % 2 == 0;
        };
      case Qn.PATTERN101:
        return function(u, m) {
          return u * m % 2 + u * m % 3 == 0;
        };
      case Qn.PATTERN110:
        return function(u, m) {
          return (u * m % 2 + u * m % 3) % 2 == 0;
        };
      case Qn.PATTERN111:
        return function(u, m) {
          return (u * m % 3 + (u + m) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + f;
    }
  }, s.getErrorCorrectPolynomial = function(f) {
    let u = Ql([1], 0);
    for (let m = 0; m < f; m += 1)
      u = u.multiply(Ql([1, Zn.gexp(m)], 0));
    return u;
  }, s.getLengthInBits = function(f, u) {
    if (1 <= u && u < 10)
      switch (f) {
        case pt.MODE_NUMBER:
          return 10;
        case pt.MODE_ALPHA_NUM:
          return 9;
        case pt.MODE_8BIT_BYTE:
          return 8;
        case pt.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + f;
      }
    else if (u < 27)
      switch (f) {
        case pt.MODE_NUMBER:
          return 12;
        case pt.MODE_ALPHA_NUM:
          return 11;
        case pt.MODE_8BIT_BYTE:
          return 16;
        case pt.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + f;
      }
    else if (u < 41)
      switch (f) {
        case pt.MODE_NUMBER:
          return 14;
        case pt.MODE_ALPHA_NUM:
          return 13;
        case pt.MODE_8BIT_BYTE:
          return 16;
        case pt.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + f;
      }
    else
      throw "type:" + u;
  }, s.getLostPoint = function(f) {
    const u = f.getModuleCount();
    let m = 0;
    for (let g = 0; g < u; g += 1)
      for (let b = 0; b < u; b += 1) {
        let E = 0;
        const _ = f.isDark(g, b);
        for (let z = -1; z <= 1; z += 1)
          if (!(g + z < 0 || u <= g + z))
            for (let S = -1; S <= 1; S += 1)
              b + S < 0 || u <= b + S || z == 0 && S == 0 || _ == f.isDark(g + z, b + S) && (E += 1);
        E > 5 && (m += 3 + E - 5);
      }
    for (let g = 0; g < u - 1; g += 1)
      for (let b = 0; b < u - 1; b += 1) {
        let E = 0;
        f.isDark(g, b) && (E += 1), f.isDark(g + 1, b) && (E += 1), f.isDark(g, b + 1) && (E += 1), f.isDark(g + 1, b + 1) && (E += 1), (E == 0 || E == 4) && (m += 3);
      }
    for (let g = 0; g < u; g += 1)
      for (let b = 0; b < u - 6; b += 1)
        f.isDark(g, b) && !f.isDark(g, b + 1) && f.isDark(g, b + 2) && f.isDark(g, b + 3) && f.isDark(g, b + 4) && !f.isDark(g, b + 5) && f.isDark(g, b + 6) && (m += 40);
    for (let g = 0; g < u; g += 1)
      for (let b = 0; b < u - 6; b += 1)
        f.isDark(b, g) && !f.isDark(b + 1, g) && f.isDark(b + 2, g) && f.isDark(b + 3, g) && f.isDark(b + 4, g) && !f.isDark(b + 5, g) && f.isDark(b + 6, g) && (m += 40);
    let h = 0;
    for (let g = 0; g < u; g += 1)
      for (let b = 0; b < u; b += 1)
        f.isDark(b, g) && (h += 1);
    const k = Math.abs(100 * h / u / u - 50) / 5;
    return m += k * 10, m;
  }, s;
})(), Zn = (function() {
  const n = new Array(256), a = new Array(256);
  for (let i = 0; i < 8; i += 1)
    n[i] = 1 << i;
  for (let i = 8; i < 256; i += 1)
    n[i] = n[i - 4] ^ n[i - 5] ^ n[i - 6] ^ n[i - 8];
  for (let i = 0; i < 255; i += 1)
    a[n[i]] = i;
  const r = {};
  return r.glog = function(i) {
    if (i < 1)
      throw "glog(" + i + ")";
    return a[i];
  }, r.gexp = function(i) {
    for (; i < 0; )
      i += 255;
    for (; i >= 256; )
      i -= 255;
    return n[i];
  }, r;
})(), Ql = function(n, a) {
  if (typeof n.length > "u")
    throw n.length + "/" + a;
  const r = (function() {
    let s = 0;
    for (; s < n.length && n[s] == 0; )
      s += 1;
    const c = new Array(n.length - s + a);
    for (let f = 0; f < n.length - s; f += 1)
      c[f] = n[f + s];
    return c;
  })(), i = {};
  return i.getAt = function(s) {
    return r[s];
  }, i.getLength = function() {
    return r.length;
  }, i.multiply = function(s) {
    const c = new Array(i.getLength() + s.getLength() - 1);
    for (let f = 0; f < i.getLength(); f += 1)
      for (let u = 0; u < s.getLength(); u += 1)
        c[f + u] ^= Zn.gexp(Zn.glog(i.getAt(f)) + Zn.glog(s.getAt(u)));
    return Ql(c, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const c = Zn.glog(i.getAt(0)) - Zn.glog(s.getAt(0)), f = new Array(i.getLength());
    for (let u = 0; u < i.getLength(); u += 1)
      f[u] = i.getAt(u);
    for (let u = 0; u < s.getLength(); u += 1)
      f[u] ^= Zn.gexp(Zn.glog(s.getAt(u)) + c);
    return Ql(f, 0).mod(s);
  }, i;
}, yp = (function() {
  const n = [
    // L
    // M
    // Q
    // H
    // 1
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
    // 2
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
    // 3
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
    // 4
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
    // 5
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
    // 6
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
    // 7
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
    // 8
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
    // 9
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
    // 10
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
    // 11
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],
    // 12
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],
    // 13
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],
    // 14
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],
    // 15
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12, 7, 37, 13],
    // 16
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],
    // 17
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],
    // 18
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],
    // 19
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],
    // 20
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],
    // 21
    [4, 144, 116, 4, 145, 117],
    [17, 68, 42],
    [17, 50, 22, 6, 51, 23],
    [19, 46, 16, 6, 47, 17],
    // 22
    [2, 139, 111, 7, 140, 112],
    [17, 74, 46],
    [7, 54, 24, 16, 55, 25],
    [34, 37, 13],
    // 23
    [4, 151, 121, 5, 152, 122],
    [4, 75, 47, 14, 76, 48],
    [11, 54, 24, 14, 55, 25],
    [16, 45, 15, 14, 46, 16],
    // 24
    [6, 147, 117, 4, 148, 118],
    [6, 73, 45, 14, 74, 46],
    [11, 54, 24, 16, 55, 25],
    [30, 46, 16, 2, 47, 17],
    // 25
    [8, 132, 106, 4, 133, 107],
    [8, 75, 47, 13, 76, 48],
    [7, 54, 24, 22, 55, 25],
    [22, 45, 15, 13, 46, 16],
    // 26
    [10, 142, 114, 2, 143, 115],
    [19, 74, 46, 4, 75, 47],
    [28, 50, 22, 6, 51, 23],
    [33, 46, 16, 4, 47, 17],
    // 27
    [8, 152, 122, 4, 153, 123],
    [22, 73, 45, 3, 74, 46],
    [8, 53, 23, 26, 54, 24],
    [12, 45, 15, 28, 46, 16],
    // 28
    [3, 147, 117, 10, 148, 118],
    [3, 73, 45, 23, 74, 46],
    [4, 54, 24, 31, 55, 25],
    [11, 45, 15, 31, 46, 16],
    // 29
    [7, 146, 116, 7, 147, 117],
    [21, 73, 45, 7, 74, 46],
    [1, 53, 23, 37, 54, 24],
    [19, 45, 15, 26, 46, 16],
    // 30
    [5, 145, 115, 10, 146, 116],
    [19, 75, 47, 10, 76, 48],
    [15, 54, 24, 25, 55, 25],
    [23, 45, 15, 25, 46, 16],
    // 31
    [13, 145, 115, 3, 146, 116],
    [2, 74, 46, 29, 75, 47],
    [42, 54, 24, 1, 55, 25],
    [23, 45, 15, 28, 46, 16],
    // 32
    [17, 145, 115],
    [10, 74, 46, 23, 75, 47],
    [10, 54, 24, 35, 55, 25],
    [19, 45, 15, 35, 46, 16],
    // 33
    [17, 145, 115, 1, 146, 116],
    [14, 74, 46, 21, 75, 47],
    [29, 54, 24, 19, 55, 25],
    [11, 45, 15, 46, 46, 16],
    // 34
    [13, 145, 115, 6, 146, 116],
    [14, 74, 46, 23, 75, 47],
    [44, 54, 24, 7, 55, 25],
    [59, 46, 16, 1, 47, 17],
    // 35
    [12, 151, 121, 7, 152, 122],
    [12, 75, 47, 26, 76, 48],
    [39, 54, 24, 14, 55, 25],
    [22, 45, 15, 41, 46, 16],
    // 36
    [6, 151, 121, 14, 152, 122],
    [6, 75, 47, 34, 76, 48],
    [46, 54, 24, 10, 55, 25],
    [2, 45, 15, 64, 46, 16],
    // 37
    [17, 152, 122, 4, 153, 123],
    [29, 74, 46, 14, 75, 47],
    [49, 54, 24, 10, 55, 25],
    [24, 45, 15, 46, 46, 16],
    // 38
    [4, 152, 122, 18, 153, 123],
    [13, 74, 46, 32, 75, 47],
    [48, 54, 24, 14, 55, 25],
    [42, 45, 15, 32, 46, 16],
    // 39
    [20, 147, 117, 4, 148, 118],
    [40, 75, 47, 7, 76, 48],
    [43, 54, 24, 22, 55, 25],
    [10, 45, 15, 67, 46, 16],
    // 40
    [19, 148, 118, 6, 149, 119],
    [18, 75, 47, 31, 76, 48],
    [34, 54, 24, 34, 55, 25],
    [20, 45, 15, 61, 46, 16]
  ], a = function(s, c) {
    const f = {};
    return f.totalCount = s, f.dataCount = c, f;
  }, r = {}, i = function(s, c) {
    switch (c) {
      case Ul.L:
        return n[(s - 1) * 4 + 0];
      case Ul.M:
        return n[(s - 1) * 4 + 1];
      case Ul.Q:
        return n[(s - 1) * 4 + 2];
      case Ul.H:
        return n[(s - 1) * 4 + 3];
      default:
        return;
    }
  };
  return r.getRSBlocks = function(s, c) {
    const f = i(s, c);
    if (typeof f > "u")
      throw "bad rs block @ typeNumber:" + s + "/errorCorrectionLevel:" + c;
    const u = f.length / 3, m = [];
    for (let h = 0; h < u; h += 1) {
      const k = f[h * 3 + 0], g = f[h * 3 + 1], b = f[h * 3 + 2];
      for (let E = 0; E < k; E += 1)
        m.push(a(g, b));
    }
    return m;
  }, r;
})(), xp = function() {
  const n = [];
  let a = 0;
  const r = {};
  return r.getBuffer = function() {
    return n;
  }, r.getAt = function(i) {
    const s = Math.floor(i / 8);
    return (n[s] >>> 7 - i % 8 & 1) == 1;
  }, r.put = function(i, s) {
    for (let c = 0; c < s; c += 1)
      r.putBit((i >>> s - c - 1 & 1) == 1);
  }, r.getLengthInBits = function() {
    return a;
  }, r.putBit = function(i) {
    const s = Math.floor(a / 8);
    n.length <= s && n.push(0), i && (n[s] |= 128 >>> a % 8), a += 1;
  }, r;
}, tx = function(n) {
  const a = pt.MODE_NUMBER, r = n, i = {};
  i.getMode = function() {
    return a;
  }, i.getLength = function(f) {
    return r.length;
  }, i.write = function(f) {
    const u = r;
    let m = 0;
    for (; m + 2 < u.length; )
      f.put(s(u.substring(m, m + 3)), 10), m += 3;
    m < u.length && (u.length - m == 1 ? f.put(s(u.substring(m, m + 1)), 4) : u.length - m == 2 && f.put(s(u.substring(m, m + 2)), 7));
  };
  const s = function(f) {
    let u = 0;
    for (let m = 0; m < f.length; m += 1)
      u = u * 10 + c(f.charAt(m));
    return u;
  }, c = function(f) {
    if ("0" <= f && f <= "9")
      return f.charCodeAt(0) - 48;
    throw "illegal char :" + f;
  };
  return i;
}, nx = function(n) {
  const a = pt.MODE_ALPHA_NUM, r = n, i = {};
  i.getMode = function() {
    return a;
  }, i.getLength = function(c) {
    return r.length;
  }, i.write = function(c) {
    const f = r;
    let u = 0;
    for (; u + 1 < f.length; )
      c.put(
        s(f.charAt(u)) * 45 + s(f.charAt(u + 1)),
        11
      ), u += 2;
    u < f.length && c.put(s(f.charAt(u)), 6);
  };
  const s = function(c) {
    if ("0" <= c && c <= "9")
      return c.charCodeAt(0) - 48;
    if ("A" <= c && c <= "Z")
      return c.charCodeAt(0) - 65 + 10;
    switch (c) {
      case " ":
        return 36;
      case "$":
        return 37;
      case "%":
        return 38;
      case "*":
        return 39;
      case "+":
        return 40;
      case "-":
        return 41;
      case ".":
        return 42;
      case "/":
        return 43;
      case ":":
        return 44;
      default:
        throw "illegal char :" + c;
    }
  };
  return i;
}, ax = function(n) {
  const a = pt.MODE_8BIT_BYTE, r = tl.stringToBytes(n), i = {};
  return i.getMode = function() {
    return a;
  }, i.getLength = function(s) {
    return r.length;
  }, i.write = function(s) {
    for (let c = 0; c < r.length; c += 1)
      s.put(r[c], 8);
  }, i;
}, lx = function(n) {
  const a = pt.MODE_KANJI, r = tl.stringToBytes;
  (function(c, f) {
    const u = r(c);
    if (u.length != 2 || (u[0] << 8 | u[1]) != f)
      throw "sjis not supported.";
  })("友", 38726);
  const i = r(n), s = {};
  return s.getMode = function() {
    return a;
  }, s.getLength = function(c) {
    return ~~(i.length / 2);
  }, s.write = function(c) {
    const f = i;
    let u = 0;
    for (; u + 1 < f.length; ) {
      let m = (255 & f[u]) << 8 | 255 & f[u + 1];
      if (33088 <= m && m <= 40956)
        m -= 33088;
      else if (57408 <= m && m <= 60351)
        m -= 49472;
      else
        throw "illegal char at " + (u + 1) + "/" + m;
      m = (m >>> 8 & 255) * 192 + (m & 255), c.put(m, 13), u += 2;
    }
    if (u < f.length)
      throw "illegal char at " + (u + 1);
  }, s;
}, Cm = function() {
  const n = [], a = {};
  return a.writeByte = function(r) {
    n.push(r & 255);
  }, a.writeShort = function(r) {
    a.writeByte(r), a.writeByte(r >>> 8);
  }, a.writeBytes = function(r, i, s) {
    i = i || 0, s = s || r.length;
    for (let c = 0; c < s; c += 1)
      a.writeByte(r[c + i]);
  }, a.writeString = function(r) {
    for (let i = 0; i < r.length; i += 1)
      a.writeByte(r.charCodeAt(i));
  }, a.toByteArray = function() {
    return n;
  }, a.toString = function() {
    let r = "";
    r += "[";
    for (let i = 0; i < n.length; i += 1)
      i > 0 && (r += ","), r += n[i];
    return r += "]", r;
  }, a;
}, rx = function() {
  let n = 0, a = 0, r = 0, i = "";
  const s = {}, c = function(u) {
    i += String.fromCharCode(f(u & 63));
  }, f = function(u) {
    if (u < 0)
      throw "n:" + u;
    if (u < 26)
      return 65 + u;
    if (u < 52)
      return 97 + (u - 26);
    if (u < 62)
      return 48 + (u - 52);
    if (u == 62)
      return 43;
    if (u == 63)
      return 47;
    throw "n:" + u;
  };
  return s.writeByte = function(u) {
    for (n = n << 8 | u & 255, a += 8, r += 1; a >= 6; )
      c(n >>> a - 6), a -= 6;
  }, s.flush = function() {
    if (a > 0 && (c(n << 6 - a), n = 0, a = 0), r % 3 != 0) {
      const u = 3 - r % 3;
      for (let m = 0; m < u; m += 1)
        i += "=";
    }
  }, s.toString = function() {
    return i;
  }, s;
}, ix = function(n) {
  const a = n;
  let r = 0, i = 0, s = 0;
  const c = {};
  c.read = function() {
    for (; s < 8; ) {
      if (r >= a.length) {
        if (s == 0)
          return -1;
        throw "unexpected end of file./" + s;
      }
      const m = a.charAt(r);
      if (r += 1, m == "=")
        return s = 0, -1;
      if (m.match(/^\s$/))
        continue;
      i = i << 6 | f(m.charCodeAt(0)), s += 6;
    }
    const u = i >>> s - 8 & 255;
    return s -= 8, u;
  };
  const f = function(u) {
    if (65 <= u && u <= 90)
      return u - 65;
    if (97 <= u && u <= 122)
      return u - 97 + 26;
    if (48 <= u && u <= 57)
      return u - 48 + 52;
    if (u == 43)
      return 62;
    if (u == 47)
      return 63;
    throw "c:" + u;
  };
  return c;
}, sx = function(n, a) {
  const r = n, i = a, s = new Array(n * a), c = {};
  c.setPixel = function(h, k, g) {
    s[k * r + h] = g;
  }, c.write = function(h) {
    h.writeString("GIF87a"), h.writeShort(r), h.writeShort(i), h.writeByte(128), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(255), h.writeByte(255), h.writeByte(255), h.writeString(","), h.writeShort(0), h.writeShort(0), h.writeShort(r), h.writeShort(i), h.writeByte(0);
    const k = 2, g = u(k);
    h.writeByte(k);
    let b = 0;
    for (; g.length - b > 255; )
      h.writeByte(255), h.writeBytes(g, b, 255), b += 255;
    h.writeByte(g.length - b), h.writeBytes(g, b, g.length - b), h.writeByte(0), h.writeString(";");
  };
  const f = function(h) {
    const k = h;
    let g = 0, b = 0;
    const E = {};
    return E.write = function(_, z) {
      if (_ >>> z)
        throw "length over";
      for (; g + z >= 8; )
        k.writeByte(255 & (_ << g | b)), z -= 8 - g, _ >>>= 8 - g, b = 0, g = 0;
      b = _ << g | b, g = g + z;
    }, E.flush = function() {
      g > 0 && k.writeByte(b);
    }, E;
  }, u = function(h) {
    const k = 1 << h, g = (1 << h) + 1;
    let b = h + 1;
    const E = m();
    for (let D = 0; D < k; D += 1)
      E.add(String.fromCharCode(D));
    E.add(String.fromCharCode(k)), E.add(String.fromCharCode(g));
    const _ = Cm(), z = f(_);
    z.write(k, b);
    let S = 0, N = String.fromCharCode(s[S]);
    for (S += 1; S < s.length; ) {
      const D = String.fromCharCode(s[S]);
      S += 1, E.contains(N + D) ? N = N + D : (z.write(E.indexOf(N), b), E.size() < 4095 && (E.size() == 1 << b && (b += 1), E.add(N + D)), N = D);
    }
    return z.write(E.indexOf(N), b), z.write(g, b), z.flush(), _.toByteArray();
  }, m = function() {
    const h = {};
    let k = 0;
    const g = {};
    return g.add = function(b) {
      if (g.contains(b))
        throw "dup key:" + b;
      h[b] = k, k += 1;
    }, g.size = function() {
      return k;
    }, g.indexOf = function(b) {
      return h[b];
    }, g.contains = function(b) {
      return typeof h[b] < "u";
    }, g;
  };
  return c;
}, ox = function(n, a, r) {
  const i = sx(n, a);
  for (let u = 0; u < a; u += 1)
    for (let m = 0; m < n; m += 1)
      i.setPixel(m, u, r(m, u));
  const s = Cm();
  i.write(s);
  const c = rx(), f = s.toByteArray();
  for (let u = 0; u < f.length; u += 1)
    c.writeByte(f[u]);
  return c.flush(), "data:image/gif;base64," + c;
};
tl.stringToBytes;
function cx({ text: n }) {
  const { size: a, path: r } = G.useMemo(() => {
    const i = tl(0, "M");
    i.addData(n), i.make();
    const s = i.getModuleCount();
    let c = "";
    for (let f = 0; f < s; f++)
      for (let u = 0; u < s; u++) i.isDark(f, u) && (c += `M${u} ${f}h1v1h-1z`);
    return { size: s, path: c };
  }, [n]);
  return /* @__PURE__ */ te.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${a + 8} ${a + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ te.jsx("rect", { x: -4, y: -4, width: a + 8, height: a + 8, fill: "#fff" }),
        /* @__PURE__ */ te.jsx("path", { d: r, fill: "#000" })
      ]
    }
  );
}
const Vl = G.createContext(""), Ko = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function ux({ title: n, children: a, testId: r, ariaLabel: i }) {
  const s = G.useContext(Vl), c = s !== "" && Ko(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ te.jsxs("section", { className: s && !c ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": r, "aria-label": i, children: [
      n && /* @__PURE__ */ te.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ te.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ te.jsx(Vl.Provider, { value: c ? "" : s, children: a }) })
    ] })
  );
}
function dx({ title: n, description: a, children: r, testId: i }) {
  const s = G.useContext(Vl);
  return s && !Ko(n, s) && !Ko(a, s) ? null : /* @__PURE__ */ te.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ te.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ te.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ te.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    r && /* @__PURE__ */ te.jsx("div", { className: "flex shrink-0 items-center gap-2", children: r })
  ] });
}
function fx({ checked: n, onChange: a, testId: r, label: i }) {
  return /* @__PURE__ */ te.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": i,
      "data-testid": r,
      checked: n,
      onChange: (s) => a(s.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const px = () => G.useContext(Vl), mx = {
  select: vc,
  selectHost: my,
  input: hy,
  inputPort: gy,
  inputWide: by,
  addRow: vy,
  list: yy,
  hostRow: wy,
  name: ky,
  addr: _y,
  muted: fy,
  empty: py,
  primary: Sy,
  danger: Ey,
  catalogToggle: dy
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const hx = 512, an = /* @__PURE__ */ new Map(), Gl = /* @__PURE__ */ new Map();
function Am(n, a) {
  an.delete(n), an.set(n, a);
  for (const r of an.keys()) {
    if (an.size <= hx) break;
    Gl.get(r)?.size || an.delete(r);
  }
}
function gx(n, a) {
  return an.has(n) ? an.get(n) : a;
}
function bx(n, a, r) {
  const i = gx(n, r), s = typeof a == "function" ? a(i) : a;
  if (!(an.has(n) && Object.is(s, i))) {
    Am(n, s);
    for (const c of [...Gl.get(n) ?? []]) c();
  }
}
function vx(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  an.has(n) || Am(n, a);
  const r = G.useCallback((c) => {
    const f = Gl.get(n) ?? /* @__PURE__ */ new Set();
    return Gl.set(n, f), f.add(c), () => {
      f.delete(c), f.size || Gl.delete(n);
    };
  }, [n]), i = G.useSyncExternalStore(r, () => an.get(n)), s = G.useCallback((c) => bx(n, c, a), [n]);
  return [i, s];
}
const yx = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", xx = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const wx = "1.3.0";
let fi = null;
const kx = (n) => {
  fi = n;
};
function ve() {
  const n = (typeof fi == "function" ? fi() : fi) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const _x = (n) => ve().subscribe?.(n) ?? (() => {
}), Sx = Cy;
function Ex() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const Mm = globalThis.perch?.isMac !== !1, Jo = (n) => tv(n, ve().isMac !== !1), zx = (n) => av(n), Nx = ({ className: n, ...a } = {}) => Oe(rv(a), n), Tx = sv, Rm = (n) => Go(n), pi = ov, Cx = Xl, Ax = fm, Mx = (n) => Zo[n].color, Rx = (n, a) => ve().shortcutFor?.(n, a) ?? null, jx = (n) => ve().shortcutLabel?.(n) ?? null, Jl = (n, a) => ve().command(n, a ?? {}) !== !1, Ox = (n, a, r) => ve().startSession?.(n, a, r), Dx = globalThis.perch?.pickFolder ? (n) => ve().pickFolder(n) : null;
function Qe(n) {
  const a = G.useRef(n);
  return a.current = n, G.useSyncExternalStore(_x, () => a.current(ve()));
}
const jm = (n = {}) => Qe((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Bx = () => Qe((n) => n.hosts()), Hx = () => Qe((n) => n.sessionFolders());
function Ux() {
  const n = Qe((a) => a.addProject?.() ?? qx);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (a, r, i) => {
      a.trim() && n.status !== "pending" && ve().addProjectFolder?.(a, r, i);
    },
    clear: () => ve().clearAddProject?.()
  };
}
const qx = Object.freeze({ status: "idle" }), Om = "perch.lastAgentChoice", Lx = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Gx = () => {
  const n = ve().storage?.getItem(Om);
  return n === "claude" || n === "codex" ? n : "claude";
}, Yx = Object.freeze({ items: [] });
function Qx() {
  const n = Qe((a) => a.notifications?.() ?? Yx);
  return G.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => ve().command("notification.open", { id: a }),
    dismiss: (a) => ve().command("notification.dismiss", { id: a })
  }), [n]);
}
function Vx(n) {
  const a = Qe((s) => s.agentChoices?.(n) ?? Lx), [r, i] = G.useState(Gx);
  return G.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: r,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (ve().storage?.setItem(Om, s), i(s));
    },
    manage: () => ve().command("agents.manage", {})
  }), [a, r]);
}
function Zx(n) {
  Ie(() => ve().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Xx(n) {
  const a = n.map((r) => ({ id: r.id, parentSessionId: r.parentId, session: r }));
  return Ty(a).map((r) => ({ session: r.session, nested: Xo(r, a) }));
}
function Kx({ id: n, plain: a, className: r }) {
  const i = Qe((h) => h.session(n));
  if (!i) return null;
  const s = i.state ?? Ny(i), c = Zo[s]?.color ?? Zo.unknown.color, f = i.provider, u = f === "claude" || f === "claude-agent-teams" || f === "omp", m = a ? Oe("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", r) : Oe("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", r);
  return G.createElement(
    "span",
    { className: m, style: a ? void 0 : { borderColor: c }, "data-provider": f ?? "unknown", title: a ? f ?? "Agent" : `${f ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    G.createElement("span", { className: Oe("inline-flex text-fg", u && "rounded-full bg-[#161616]") }, G.createElement(Dm, { provider: f, size: 14 }))
  );
}
function Dm({ provider: n, size: a = 14 }) {
  const r = ve().agentIcon?.(n, a) ?? null, i = r?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return G.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...r && r.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Jx = ({ children: n }) => G.createElement(G.Fragment, null, n);
function Wx(n, a) {
  const r = G.useRef(a);
  return r.current = a, Ie(() => {
    const i = ve();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [f, u] of Object.entries(r.current))
      s[f] = typeof u == "function" ? (...m) => r.current[f]?.(...m) : u;
    const c = i.openOverlay(n, s);
    return () => i.closeOverlay?.(c);
  }, [n]), null;
}
const Wn = (n) => function(r) {
  return Wx(n, r);
}, $x = Wn("session-menu"), Fx = Wn("new-session-menu"), Ix = Wn("confirm");
let Bm = null;
const Px = (n) => {
  Bm = n;
};
function ew(n) {
  return G.createElement(Bm ?? Ix, n);
}
function tw({ className: n = vc, ...a }) {
  return G.createElement(oy, { ...a, className: n });
}
let Wo = null;
const nw = (n) => {
  Wo = n;
}, aw = Wn("folder-browser");
function lw(n) {
  return Wo ? G.createElement(Wo, { ...n, browse: (a) => ve().browse(n.hostId, a) }) : G.createElement(aw, n);
}
const rw = Wn("instructions"), iw = Wn("memory"), sw = pv;
let wc = null;
const ow = (n) => {
  wc = n;
};
function cw(n) {
  if (wc) return G.createElement(dw, n);
  const { hostId: a, path: r, className: i } = n, s = G.useRef(null);
  return G.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Oe("worktree-menu__btn", fm, i),
      "data-testid": `worktree-menu-${a}-${r}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => ve().openOverlay?.("worktree", { hostId: a, cwd: r, anchor: s.current?.getBoundingClientRect() })
    },
    G.createElement(pm, null)
  );
}
const Hm = "Perch did not answer.";
function ri(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Hm };
}
function uw(n, a, r = ve()) {
  const i = (s) => {
    for (const c of s ?? []) {
      if (c.path === a) return c;
      const f = i(c.children);
      if (f) return f;
    }
    return null;
  };
  for (const s of r.navigation({})?.projects ?? []) {
    if (s.hostId !== n) continue;
    const c = i(s.workspaces) ?? i(s.hidden);
    if (c) return c;
  }
  return null;
}
const wp = 5 * 6e4;
function Um(n, a, r, i = ve()) {
  const s = Date.now() + wp;
  let c = !1, f = () => {
  };
  const u = () => {
    c = !0, f(), clearTimeout(h);
  }, m = () => {
    if (!c) {
      if (Date.now() >= s) return u();
      uw(n, a, i) && (u(), i.startSession?.(n, a, r));
    }
  }, h = setTimeout(u, wp);
  f = i.subscribe?.(m) ?? (() => {
  }), m();
}
function dw({ hostId: n, path: a, className: r, worktrees: i, request: s, parentChoices: c, emptyAgent: f, ...u }) {
  const [m, h] = G.useState(i), k = (T) => !!ve().coreCan?.(T, n), g = jm(), b = `${n}:${a}`, E = G.useMemo(() => {
    if (Array.isArray(c)) return c;
    if (!k("workspace.nest")) return [];
    const T = g?.projects?.find((B) => B.hostId === n && B.repoPath === a), R = [], C = (B, W) => {
      for (const F of B ?? [])
        W && R.push({ id: F.id, name: F.name, path: F.path }), C(F.children, !0);
    };
    return C(T?.workspaces, !1), R;
  }, [c, g, n, a]), _ = n === "local" && k("worktree.job"), z = u.deleteSupported ?? k("worktree.delete"), S = u.startFromSupported ?? k("worktree.startFrom"), N = Qe((T) => T.emptyWorkspaceAgent?.() ?? void 0), D = f ?? N ?? void 0, j = Qe((T) => T.worktreeMenuRequest?.() ?? null), X = j?.projectKey === b ? j.nonce : null, U = G.useMemo(() => s ?? (X == null ? null : j), [s, X]), [V, w] = G.useState(U);
  Ie(() => {
    U && w(U);
  }, [U]);
  const x = G.useRef({});
  x.current = { background: _, deleteSupported: z };
  const y = G.useMemo(() => {
    const T = (R, C) => ve().ask(R, { hostId: n, repoPath: a, ...C });
    return {
      list: async () => {
        const R = await T("worktree.list", {});
        return R?.type === "worktree.list.result" && h({ worktrees: R.worktrees ?? [], defaultRoot: R.defaultRoot ?? "", baseRef: R.baseRef, refs: R.refs ?? [] }), ri(R);
      },
      create: async ({ branch: R, newBranch: C, path: B, extra: W, agent: F }) => {
        const q = { branch: R, newBranch: !!C, path: B ?? null, name: W?.name ?? null, startFrom: W?.startFrom ?? null, parentWorkspaceId: W?.parentWorkspaceId ?? null }, { background: J } = x.current, I = await T(J ? "worktree.job.start" : "worktree.create", q), Q = J ? "worktree.job.started" : "worktree.done";
        if (I?.type !== Q) return { error: ri(I).error ?? Hm };
        const Z = J ? I.job?.path : I.path;
        return F && Z && Um(n, Z, F), { background: J };
      },
      remove: async (R, C) => {
        const B = await T("worktree.remove", { path: R, force: !!C, deleteBranch: x.current.deleteSupported });
        return { ...ri(B), preservedBranch: B?.type === "worktree.done" ? B.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (R, C) => ri(await T("worktree.branch.delete", { branch: R, expectedHead: C })),
      open: (R) => ve().startSession?.(n, R, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => ve().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return G.createElement(wc, {
    hostId: n,
    cwd: a,
    projectKey: b,
    className: r,
    worktrees: m,
    background: _,
    startFromSupported: S,
    deleteSupported: z,
    parentChoices: E,
    emptyAgent: D,
    request: V,
    actions: y
  });
}
const fw = (n, a) => {
  if (!ve().followPointer?.(n)) return;
  const r = a.items();
  for (const i of r) i.getBoundingClientRect();
  r[0]?.parentElement?.getBoundingClientRect(), F1(n, a);
}, pw = () => Qe((n) => n.workspaceTabs());
function mw({ path: n, content: a }) {
  const { source: r, truncated: i } = ay(a ?? ""), s = G.useMemo(() => iy(r, (c) => Jl("link.open", { url: c })), [r]);
  return G.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    i && G.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${di.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    G.createElement("div", { className: "message__markdown file-markdown" }, s)
  );
}
const hw = Wn("file-menu"), gw = /* @__PURE__ */ new Map(), bw = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function vw(n, a = {}) {
  const r = Qe((h) => h.workspaceFiles(n)), i = !!a.git, s = r.git?.decorations, c = G.useMemo(() => i && s?.length ? new Map(s) : gw, [s, i]), f = G.useMemo(() => Object.fromEntries(bw.map((h) => [h, (...k) => (ve().filesDo(h, n, ...k), null)])), [n]), u = Qe((h) => !!h.contextBridgeAvailable?.(n)), m = G.useMemo(() => u ? (h) => {
    if (h.kind !== "editor") return ve().askAgent(n, h);
    const k = ve().workspaceFiles(n)?.documents?.[h.path];
    return ve().askAgent(n, { ...h, dirty: k?.content !== k?.savedContent });
  } : void 0, [u, n]);
  return G.useMemo(() => ({
    workspace: r.workspace,
    connected: r.connected,
    trees: r.trees,
    documents: r.documents,
    previews: r.previews,
    search: r.search ?? void 0,
    wrap: r.wrap,
    git: { ...r.git, decorations: c },
    actions: f,
    askAgent: m
  }), [r, c, f, m]);
}
const yw = () => Qe((n) => n.statusLine()), xw = () => Qe((n) => n.zoom()), ww = () => Qe((n) => n.paneLook()), kw = () => Qe((n) => n.keybindings?.() ?? []), _w = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Sw(n) {
  const a = !!n?.keepFresh, r = Qe((s) => s.statusLine?.().connected ?? !1), i = Qe((s) => s.planUsage?.() ?? _w);
  return Ie(() => {
    if (!a || !r) return;
    let s;
    const c = () => {
      ve().command("usage.get"), s = setTimeout(c, 18e4);
    };
    return c(), () => clearTimeout(s);
  }, [a, r]), i;
}
const Ew = () => ve().command("usage.get", { force: !0 }), zw = (n) => ve().command("usage.redeemReset", { accountId: n }), Nw = () => Jl("app.zoom_reset"), Tw = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Cw = (n, a, r) => ve().beginTabDrag?.(n, a, r);
function Aw(n) {
  Ie(() => ve().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Mw = (n) => Jl("browser.open", { workspaceId: n }), Rw = (n, a) => Jl("file.open", { workspaceId: n, path: a }), jw = () => null, Ow = () => null, Dw = Wn("new-file");
function Bw(n) {
  return G.createElement(Yy, { ...n, perch: ve() });
}
function Hw(n, a) {
  const r = n.selection(a);
  if (r) return r;
  const i = n.value(a), s = i.split(`
`).length - (i.endsWith(`
`) && i.length ? 1 : 0);
  return { text: i, startLine: 1, endLine: Math.max(1, s) };
}
function Uw({ onGo: n, onClose: a }) {
  const [r, i] = G.useState(""), s = (c) => {
    c?.preventDefault?.();
    const [f, u] = r.split(":").map((m) => Number.parseInt(m, 10));
    Number.isFinite(f) ? n(f, Number.isFinite(u) ? u : 1) : a();
  };
  return G.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    G.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    G.createElement("input", {
      id: "perch-editor-goto",
      "data-testid": "editor-goto-line",
      autoFocus: !0,
      value: r,
      className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (c) => i(c.target.value),
      onKeyDown: (c) => {
        c.key === "Escape" ? (c.preventDefault(), a()) : c.key === "Enter" && s(c);
      }
    }),
    G.createElement("button", { type: "button", className: Xl, onClick: s }, "OK")
  );
}
function qw({ value: n, onChange: a, onSave: r, onCaret: i, readOnly: s, wrap: c, label: f, path: u, docKey: m, onAskAgent: h, ref: k }) {
  const g = ve().editor, b = G.useRef(null);
  b.current = { onChange: a, onSave: r, onCaret: i, onAskAgent: h };
  const [E, , _] = String(m).split("\0"), z = !!g && _ !== void 0 && /^\d+$/.test(_), S = Qe((y) => z ? y.workspaceFiles(E)?.carets?.[m] ?? null : null);
  Ie(() => {
    S && b.current.onCaret?.({ line: S.line, col: S.col });
  }, [S?.line, S?.col]);
  const N = G.useRef(n), [D, j] = G.useState(null), [X, U] = G.useState(!1), V = () => {
    if (!g || !b.current.onAskAgent) return;
    const { text: y, startLine: T, endLine: R } = Hw(g, m);
    b.current.onAskAgent(y, T, R);
  };
  if (G.useImperativeHandle(k, () => ({
    openGoto: () => U(!0),
    focus: () => g?.focus(m),
    askAgent: V
  }), [m]), mi(() => {
    if (!g) return;
    g.open(m, { path: u, value: n, readonly: !!s, wrap: !!c, label: f }), N.current = n;
    const y = g.watch(m, (T) => {
      for (const R of T)
        if (R.type === "change") {
          const C = g.value(m);
          N.current = C, b.current.onChange?.(C);
        } else R.type === "caret" ? b.current.onCaret?.({ line: R.line, col: R.col }) : R.type === "save" ? b.current.onSave?.() : R.type === "goto" ? U(!0) : R.type === "contextmenu" && j({ x: R.x, y: R.y });
    });
    return () => {
      y(), g.park(m);
    };
  }, [m]), Ie(() => {
    !g || z || n === N.current || (N.current = n, g.setValue(m, n, { external: !0 }));
  }, [m, n]), Ie(() => {
    g?.setReadonly(m, !!s);
  }, [m, s]), Ie(() => {
    g?.setWrap(m, !!c);
  }, [m, c]), !g)
    return G.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": f, value: n, readOnly: s, onChange: (y) => a?.(y.target.value) });
  const w = (y) => () => {
    j(null), y(), g.focus(m);
  }, x = D ? !!g.selection(m) : !1;
  return G.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": f },
    X && G.createElement(Uw, {
      onGo: (y, T) => {
        U(!1), g.goTo(m, y, T), g.focus(m);
      },
      onClose: () => {
        U(!1), g.focus(m);
      }
    }),
    G.createElement("div", { "data-perch-engine": "editor", "data-perch-key": m, className: "min-h-0 min-w-0 flex-1" }),
    D && G.createElement(uy, {
      x: D.x,
      y: D.y,
      readOnly: !!s,
      canUndo: g.canUndo(m),
      canRedo: g.canRedo(m),
      hasSelection: x,
      onClose: () => j(null),
      actions: {
        undo: w(() => g.undo(m)),
        redo: w(() => g.redo(m)),
        cut: w(() => g.cut(m)),
        copy: w(() => g.copy(m)),
        paste: w(() => g.paste(m)),
        selectAll: w(() => g.selectAll(m)),
        find: w(() => g.openSearch(m, !1)),
        replace: w(() => g.openSearch(m, !0)),
        gotoLine: () => {
          j(null), U(!0);
        },
        ...h ? { askAgent: () => {
          j(null), V();
        } } : {}
      }
    })
  );
}
const Lw = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Gw(n) {
  const a = Qe((r) => r.browserPages?.(n) ?? Lw);
  return G.useMemo(() => {
    const r = (i, s) => ve().command(i, { workspaceId: n, ...s });
    return {
      pages: a.pages ?? [],
      shownId: a.shownId ?? null,
      tabCount: a.tabCount ?? 0,
      open: () => {
        const i = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        return r("browser.drawer.open", { id: i }), i;
      },
      select: (i) => r("browser.drawer.select", { id: i }),
      close: (i) => r("browser.drawer.close", { id: i }),
      closeAll: () => r("browser.drawer.closeAll", {}),
      // The window follows the page itself; nothing to keep here.
      setUrl: () => {
      }
    };
  }, [a, n]);
}
function Yw({ pageId: n, active: a }) {
  const r = `drawer
${n}`;
  return Ie(() => {
    a && ve().command("browser.focus", { key: r });
  }, [a, r]), G.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": r,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const n4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Dm,
  BrowserPage: Yw,
  Chevron: xc,
  CloseIcon: dv,
  CodeEditor: qw,
  ConfirmDialog: ew,
  Dialog: sw,
  EllipsisIcon: cv,
  FileAsset: Bw,
  FileEntryMenu: hw,
  FileIcon: Zy,
  FolderBrowser: lw,
  GearIcon: uv,
  GitMarker: Jy,
  HostStateDot: fv,
  InstructionsDialog: rw,
  MarkdownPreview: mw,
  MemoryDialog: iw,
  ModeSwitch: ex,
  NewFilePrompt: Dw,
  NewSessionMenu: Fx,
  PageIcon: Ay,
  PlusIcon: pm,
  QrCode: cx,
  Select: tw,
  SessionDot: Kx,
  SessionMenu: $x,
  SettingRow: dx,
  SettingsGroup: ux,
  SettingsQuery: Vl,
  Slot: Jx,
  Submenu: zy,
  Switch: fx,
  TabDragLayer: Ow,
  TabMenu: jw,
  WorktreeMenu: cw,
  agentStateColor: Mx,
  anchoredPopoverStyle: Sx,
  assetKind: Nm,
  beginReorderDrag: fw,
  beginTabDrag: Cw,
  bindHost: kx,
  buttonClass: Tx,
  cn: Oe,
  drawConfirmationsInPlace: Px,
  drawFolderBrowserInPlace: nw,
  drawWorktreeInPlace: ow,
  ghostButton: Cx,
  glassClass: yx,
  iconButton: Ax,
  isMac: Mm,
  keyLabel: Jo,
  menuDividerClass: pi,
  menuItemClass: Rm,
  menuPanel: Ci,
  nestSessions: Xx,
  newId: Ex,
  openBrowserTab: Mw,
  openFileTab: Rw,
  pickFolder: Dx,
  redeemUsageReset: zw,
  refreshUsage: Ew,
  resetZoom: Nw,
  rowActionClass: Nx,
  runCommand: Jl,
  segmentClass: zx,
  settingsClass: mx,
  shortcutFor: Rx,
  shortcutLabel: jx,
  startPaneWhenReady: Um,
  startSession: Ox,
  tabStateClass: Tw,
  tapButtonClass: xx,
  useAddProject: Ux,
  useAddProjectRequest: Zx,
  useAgentChoices: Vx,
  useBrowserPages: Gw,
  useDismissOnOutsideClick: zm,
  useHostSnapshot: Qe,
  useHosts: Bx,
  useKeybindings: kw,
  useNavigation: jm,
  useNewTabRequest: Aw,
  useNotifications: Qx,
  usePaneLook: ww,
  usePlanUsage: Sw,
  useResourceState: vx,
  useSessionFolders: Hx,
  useSettingsQuery: px,
  useStatusLine: yw,
  useWorkspaceFiles: vw,
  useWorkspaceTabs: pw,
  useZoom: xw,
  version: wx
}, Symbol.toStringTag, { value: "Module" }));
//! The description as GPUI elements: one gpui-kit builder chain per node, for a mod's `render()`. Every key the
//! description can carry has exactly one entry in `STYLE` (a key it does not know throws, so a new key cannot be
//! dropped silently), and the events a node asks for become the kit's handlers, which run the event through the
//! React tree (`handle.dispatch`) and ask for a new frame.
//!
//! Pointer events: the deepest node with a pointer handler takes a press (`cx.stop_propagation()`), and the DOM-shaped
//! event then bubbles through the React tree, so ancestors see it as on the web; its target is that node rather than
//! a plain child without handlers. A press also stores the node's box (`event.bounds`), which `getBoundingClientRect`
//! returns when the click that follows opens a menu under it. A press outside an overlay (its box and the absolute boxes
//! in it, a submenu past its edge) is a `pointerdown` on the
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
//! `kit` is `{ div, image }` from `gpui-kit`; `files.engine(engine, key)` gives the host's native element for an
//! engine slot (`perch-engine`); `files.icon(id, markup, color)` gives the element that draws an icon's
//! markup (`currentColor` as `color`; the mod's `perch-react` `Icon`), as gpui-kit's `svg()` and `image()` read
//! files through an asset source the host may not have. An icon is drawn once per colour it is described with; one
//! under a node whose own `hover:` changes the text colour is drawn twice, the hover copy shown by the engine while the
//! pointer is over that node (a hover group), so a hover never calls back into the script.
const kc = {
  display: (n, a) => a === "hidden" ? n.hidden() : a === "flex" ? n.flex() : n.block(),
  flex_direction: (n, a) => n[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[a]](),
  flex_wrap: (n, a) => a === "wrap" ? n.flex_wrap() : n.flex_nowrap(),
  items: (n, a) => n[`items_${a}`](),
  justify: (n, a) => n[`justify_${a}`](),
  self: (n, a) => a === "auto" ? n : n[`self_${a}`](),
  flex_grow: (n, a) => n.flex_grow(a),
  flex_shrink: (n, a) => n.flex_shrink(a),
  flex_basis: (n, a) => n.flex_basis(a),
  position: (n, a) => a === "absolute" ? n.absolute() : n.relative(),
  overflow_x: (n, a) => a === "hidden" ? n.overflow_x_hidden() : a === "scroll" ? n.overflow_x_scroll() : n,
  overflow_y: (n, a) => a === "hidden" ? n.overflow_y_hidden() : a === "scroll" ? n.overflow_y_scroll() : n,
  visibility: (n, a) => a === "invisible" ? n.invisible() : n.visible(),
  bg: (n, a) => n.bg(a),
  opacity: (n, a) => n.opacity(a),
  shadow: (n, a) => a === "none" ? n.shadow_none() : n[`shadow_${a}`](),
  cursor: (n, a) => n[`cursor_${a}`](),
  border_color: (n, a) => n.border_color(a),
  text_ellipsis: (n, a) => a ? n.text_ellipsis() : n,
  underline: (n, a) => a ? n.underline() : n,
  text_color: (n, a) => n.text_color(a),
  text_size: (n, a) => n.text_size(a),
  font_weight: (n, a) => n.font_weight(a),
  font_family: (n, a) => n.font_family(a),
  font_features: (n, a) => n.font_features(a),
  line_height: (n, a) => n.line_height(a),
  italic: (n, a) => a ? n.italic() : n.not_italic(),
  whitespace: (n, a) => a === "nowrap" ? n.whitespace_nowrap() : n.whitespace_normal(),
  text_align: (n, a) => n[`text_${a}`](),
  rounded: (n, a) => n.rounded(a)
};
for (const n of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  kc[n] = (a, r) => a[n](r);
const a4 = Object.keys(kc);
function zo(n, a) {
  for (const [r, i] of Object.entries(a)) {
    const s = kc[r];
    if (!s) throw new Error(`the description key ${r} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const ba = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), kp = /* @__PURE__ */ new WeakSet(), No = /* @__PURE__ */ new WeakSet();
function _p(n, a, r) {
  const i = n.pressed, s = ba(r);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : a;
}
function Qw(n, a, r) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && Si.has(n.group) || r)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const qm = (n, a = !1) => (n.children ?? []).some((r) => r.kind === "text" ? !a || /\s/.test(String(r.text ?? "").trim()) : r.kind === "div" && r.style?.flex_direction !== "row" && r.style?.whitespace !== "nowrap" && qm(r, !0)), Mt = (n) => n.style?.display !== "hidden";
let Si = /* @__PURE__ */ new Set(), $o = null;
function Lm(n, a = /* @__PURE__ */ new Set()) {
  for (const { group: r, style: i } of n.group_hover ?? []) "display" in i && a.add(r);
  for (const r of n.children ?? []) r.kind !== "text" && Lm(r, a);
  return a;
}
function Fo(n, a, r, i, s = !1, c = !1, f = null, u = {}, m = !1, h = /* @__PURE__ */ new Map(), k = null) {
  if (n.kind === "text") return h.get(n)?.text ?? n.text;
  const g = kp.has(n);
  c ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", c && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (k = null), f = n.style.text_color ?? f;
  const b = !!n.hover?.text_color && Vm(n), E = n.group ?? (b ? `~g${n.id}` : null);
  b && (k = { group: E, color: n.hover.text_color }), u = { ...u };
  for (const C of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[C] !== void 0 && (u[C] = n.style[C]);
  const _ = new Set(n.events ?? []), z = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !c && !n.pointer_none && n.style.position === "absolute" ? $o : null, S = z ? z.count++ : -1;
  s && ($o = z);
  let N;
  if (n.kind === "image" && !n.markup ? N = a.image(n.src) : N = a.div(), n.kind === "engine" && (N = N.child(i.engine ? i.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && k && k.color !== f) {
    const { group: C, color: B } = k, W = () => a.div().absolute().top(0).left(0).size_full();
    N = N.child(W().group_hover(C, (F) => F.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, f))).child(W().invisible().group_hover(C, (F) => F.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, B)));
  } else n.markup && (N = N.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? f : "")));
  const D = Qw(n, _, !!z);
  if (D && (N = N.id(D)), n.measure && (N = N.measure(n.measure)), n.name && N.also_named) for (const C of n.also ?? []) N = N.also_named(C);
  N = zo(N, { ...n.style, ...h.get(n) });
  const j = u.whitespace !== "nowrap" && !u.text_ellipsis;
  m && j && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && qm(n) && (N = N.min_w(0));
  for (const C of ["hover", "focus", "active"]) n[C] && (N = N[C]((B) => zo(B, n[C])));
  E && (N = N.group(E));
  for (const { group: C, style: B } of n.group_hover ?? []) {
    const { display: W, ...F } = B;
    Object.keys(F).length && (N = N.group_hover(C, (q) => zo(q, F)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const C = r.document?.scrollTarget, B = C ? (n.children ?? []).filter(Mt).findIndex((W) => Qm(W, C.id)) : -1;
    if (B >= 0 && (r.scroller ?? n.id) === n.id && (r.document.scrollTarget = null, r.scroller = n.id, a.scroll.scroll_to_item(B)), r.scroller ??= n.id, r.scroller === n.id && r.document) {
      N = N.track_scroll(a.scroll);
      const W = (n.children ?? []).filter(Mt).map((F) => F.id);
      r.document.itemBounds = (F) => W.includes(F) ? a.scroll.item_bounds?.(W.indexOf(F)) ?? null : null;
    }
  }
  const X = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", U = s && !n.pointer_none || n.blocks_pointer;
  if ((X && No.has(n) || U) && (N = N.on_scroll_wheel((C, B) => B.stop_propagation?.())), X && _.has("scroll") && (N = N.on_scroll_wheel((C, B) => {
    r.dispatch(n.id, "scroll", {}), B.notify();
  })), X || No.has(n)) for (const C of n.children ?? []) C.kind !== "text" && No.add(C);
  n.kind === "input" && !n.disabled && (N = N.on_mouse_down("left", (C, B) => {
    C.bounds && r.setBounds(n.id, C.bounds), r.focus(n.id), B.notify();
  }));
  const V = n.kind === "input" ? n : n.meta?.tag === "label" ? Ym(n) : null;
  V && !V.disabled && /^(checkbox|radio)$/.test(V.input_type) && (N = N.on_click((C, B) => {
    B.stop_propagation?.(), r.toggle(V.id), B.notify();
  }));
  const w = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((C) => _.has(C));
  if (w || g) for (const C of n.children ?? []) C.kind !== "text" && kp.add(C);
  if (w && (N = N.on_mouse_down("left", (C, B) => {
    B.stop_propagation?.(), C.bounds && r.setBounds(n.id, C.bounds);
    const W = { ...ba(C), button: 0, buttons: 1, detail: C.click_count }, F = _p(r, n.id, C);
    r.pressed = null, r.dispatch(F, "pointerdown", { ...W, pointerType: "mouse" }), r.dispatch(F, "mousedown", W) && r.pressFocus?.(F), B.notify();
  }), N = N.on_mouse_down("right", (C, B) => {
    B.stop_propagation?.(), C.bounds && r.setBounds(n.id, C.bounds);
    const W = _p(r, n.id, C);
    r.pressed = null, r.dispatch(W, "contextmenu", { ...ba(C), button: 2 }), B.notify();
  }), N = N.on_mouse_up("left", (C, B) => {
    B.stop_propagation?.();
    const W = { ...ba(C), button: 0 };
    r.dispatch(n.id, "pointerup", { ...W, pointerType: "mouse" }), r.dispatch(n.id, "mouseup", W), B.notify();
  }), N = N.on_click((C, B) => {
    r.dispatch(n.id, C.click_count === 2 && _.has("double_click") ? "dblclick" : "click", { detail: C.click_count, button: 0 }), B.notify();
  })), n.blocks_pointer && !w)
    for (const C of ["left", "right"]) N = N.on_mouse_down(C, (B, W) => W.stop_propagation?.());
  else if (g && !w)
    for (const C of ["left", "right"])
      N = N.on_mouse_down(C, (B) => {
        const W = ba(B);
        (r.pressed?.x !== W.clientX || r.pressed?.y !== W.clientY) && (r.pressed = { id: n.id, x: W.clientX, y: W.clientY });
      });
  if (_.has("mouse_move") && (N = N.on_mouse_move((C) => {
    r.dispatch(n.id, "pointermove", { ...ba(C), pointerType: "mouse" });
  })), n.track_hover && Si.has(n.group) && (N = N.on_hover((C, B) => {
    r.hover(n.id, C), B.notify();
  })), z && (N = N.on_mouse_down_out((C, B) => {
    const W = ba(C), F = `${W.clientX},${W.clientY}`;
    z.at !== F && (z.at = F, z.hits = /* @__PURE__ */ new Set()), z.hits.add(S), !(z.hits.size < z.count) && (z.at = null, r.dispatch(r.document.body.id, "pointerdown", { ...W, pointerType: "mouse" }), r.dispatch(r.document.body.id, "mousedown", W), B.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const C = n.value ? String(n.value) : String(n.placeholder ?? "");
    let B = a.div().whitespace_nowrap().overflow_x_hidden();
    const W = xa(u);
    W && (B = B.h(W)), !n.value && f && (B = B.text_color(Zw(f))), C && (N = N.child(B.child(n.input_type === "password" && n.value ? "•".repeat([...C].length) : C))), n.field_w && (N = N.child(a.div().w(n.field_w).h(0)));
  }
  const x = u.whitespace === "nowrap" ? xa(u) : null, y = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let T = !n.range_name;
  const R = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const C of (n.children ?? []).filter(Mt)) {
    const B = C.style?.flex_basis;
    R && C.style.flex_grow > 0 && (B === 0 || typeof B == "string" && B.endsWith("%")) && h.set(C, { ...h.get(C), flex_basis: "auto" });
    let W = Fo(C, a, r, i, !1, c, f, u, y && C.style?.position !== "absolute", h, k);
    const F = !T && (C.kind === "text" || !C.meta), q = C.kind === "text" ? h.get(C)?.h ?? x : null, J = C.kind === "text" ? h.get(C)?.w : void 0;
    if (F || q || J !== void 0) {
      let I = a.div();
      F && (I = I.id(n.range_name)), F && !y && n.style.display === "flex" && (I = I[`self_${Vw[u.text_align] ?? "start"}`]().max_w("100%")), q && (I = I.h(q)), J !== void 0 && (I = I.w(J).flex_none().whitespace_nowrap()), W = I.child(W), T ||= F;
    }
    N = N.child(W);
  }
  return N;
}
const Vw = { center: "center", right: "end", end: "end" };
function Zw(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const r = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(r / 2).toString(16).padStart(2, "0")}`;
}
const Gm = /^(?:[!-,.-~]+|\S)$/u, Ym = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const r = a.kind === "text" ? null : Ym(a);
    if (r) return r;
  }
  return null;
}, Qm = (n, a) => n.id === a || (n.children ?? []).some((r) => r.kind !== "text" && Qm(r, a)), Vm = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && Vm(a));
function xa(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function l4(n, a, r, i, s = 0, c = !1) {
  const f = [n.root, ...n.overlays];
  Si = /* @__PURE__ */ new Set(), $o = null;
  for (const k of f) Lm(k, Si);
  const u = s > 0 ? Iw(f, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && Xw(f, s, i.measure, u), $w(f, u), Ww(f, u), i.measure && Jw(f, i.measure, u);
  let m = a.div().relative().size_full().child(Fo(n.root, a, r, i, !1, !1, null, {}, !1, u)), h = c && n.overlays.length ? a.div().relative().size_full().window_layer() : m;
  for (const k of n.overlays) h = h.child(Fo(k, a, r, i, !0, !1, null, {}, !1, u));
  return h === m ? m : m.child(h);
}
function Xw(n, a, r, i) {
  const s = (_, z) => i.set(_, { ...i.get(_), ...z }), c = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map(), u = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function m(_, z, S) {
    if (_.kind === "text") {
      if (!(z.whitespace === "nowrap" || Gm.test(_.text)) || z.text_ellipsis || S || typeof z.text_size != "number") return NaN;
      const w = r(_.text, { size: z.text_size, weight: z.font_weight ?? 400, family: z.font_family ?? ".SystemUIFont", italic: !!z.italic });
      return Number.isFinite(w) ? w : NaN;
    }
    if (!Mt(_) || _.kind === "input" || _.kind === "engine" || _.markup) return h(_);
    const N = { ...z };
    for (const V of u) _.style[V] !== void 0 && (N[V] = _.style[V]);
    N.text_ellipsis = !!_.style.text_ellipsis, f.set(_, N);
    const D = _.style, j = (_.children ?? []).filter(Jt), X = j.map((V) => m(V, N, S || !!_.tabular));
    let U = h(_);
    if (!Number.isFinite(U) && D.w === void 0) {
      const V = j.map((x, y) => X[y] + (x.kind === "text" ? 0 : se(x.style.ml) + se(x.style.mr)));
      let w;
      j.length ? Ut(_) ? w = j.some((x) => x.kind !== "text" && x.style.flex_grow > 0) || D.flex_wrap === "wrap" ? NaN : V.reduce((x, y) => x + y, 0) + se(D.gap_x) * (j.length - 1) : w = Math.max(...V) : w = 0, U = w + se(D.pl) + se(D.pr) + se(D.border_l) + se(D.border_r), typeof D.min_w == "number" && (U = Math.max(U, D.min_w)), typeof D.max_w == "number" && (U = Math.min(U, D.max_w));
    }
    return c.set(_, U), U;
  }
  const h = (_) => typeof _.style?.w == "number" ? _.style.w : NaN, k = () => ({ exact: 0, laid: 0 }), g = (_, z) => {
    if (!Number.isFinite(z))
      return Object.assign(_, k()), NaN;
    _.exact += z;
    const S = Math.round(_.exact * a + 1e-9) / a, N = S - _.laid;
    return _.laid = S, N;
  }, b = (_) => Ut(_) && _.style.flex_wrap !== "wrap" && (_.style.justify ?? "start") === "start";
  function E(_) {
    if (!_ || _.kind === "text" || !Mt(_)) return;
    const z = (_.children ?? []).filter(Jt);
    if (b(_) && z.length > 1) {
      const S = se(_.style.gap_x), N = k(), D = !(S && z.some((j) => j.kind === "text" || !Number.isFinite(se(j.style.ml))));
      s(_, { border_l: g(N, se(_.style.border_l)), pl: g(N, se(_.style.pl)) }), D && S && s(_, { gap_x: 0 }), z.forEach((j, X) => {
        const U = (X && D ? S : 0) + (j.kind === "text" ? 0 : se(j.style.ml));
        if (j.kind === "text")
          U && Object.assign(N, k());
        else {
          const y = g(N, U);
          Number.isFinite(y) && s(j, { ml: y });
        }
        const V = j.kind === "text" ? f.get(_) ?? {} : null, w = j.kind === "text" ? m(j, V, !!_.tabular) : c.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(w)) {
          const y = { w: g(N, w) };
          j.kind !== "text" && typeof j.style.w != "number" && j.style.min_w === void 0 && (y.whitespace = "nowrap", y.flex_shrink = 0), s(j, y);
        } else Object.assign(N, k());
        if (j.kind !== "text") {
          const y = g(N, se(j.style.mr));
          Number.isFinite(y) && s(j, { mr: y });
        }
      });
    }
    for (const S of _.children ?? []) S.kind !== "text" && E(S);
  }
  for (const _ of n)
    _ && (m(_, {}, !1), E(_));
}
const Kw = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Jw(n, a, r) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (u) => typeof u == "number" ? u : 0, c = (u, m) => m && Ei(m) && !Ut(m) && u.style.position !== "absolute" && !["start", "center", "end"].includes(u.style.self) && !["start", "center", "end"].includes(m.style.items), f = (u, m, h, k) => {
    if (!u || u.kind === "text" || !Mt(u)) return;
    const g = u.style;
    let b = typeof g.w == "number" ? g.w : g.w === "100%" ? h : c(u, m) ? h - s(g.ml) - s(g.mr) : NaN;
    typeof g.max_w == "number" && (b = Math.min(b, g.max_w));
    const E = b - s(g.pl) - s(g.pr) - s(g.border_l) - s(g.border_r), _ = { ...k };
    for (const S of i) g[S] !== void 0 && (_[S] = g[S]);
    const z = u.children ?? [];
    if (u.break_anywhere && Number.isFinite(E) && E > 0 && typeof _.text_size == "number" && z.length && z.every((S) => S.kind === "text")) {
      const S = { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic }, N = (X) => a(X.trimEnd(), S) <= E + 0.01;
      let D = 0;
      for (const X of z) {
        const U = [];
        for (const w of X.text.split(`
`)) {
          let x = "";
          for (const y of w.split(Kw)) {
            if (N(x + y)) {
              x += y;
              continue;
            }
            x && U.push(x.trimEnd()), x = "";
            for (const T of y)
              x && !N(x + T) && (U.push(x), x = ""), x += T;
          }
          U.push(x.trimEnd());
        }
        const V = U.join(`
`);
        U.every((w) => !w || N(w)) ? V !== X.text && r.set(X, { ...r.get(X), text: V }) : D = NaN, D += U.length;
      }
      const j = xa(_);
      Number.isFinite(D) && j && g.h === void 0 && z.length === 1 && r.set(u, { ...r.get(u), h: D * j + s(g.pt) + s(g.pb) + s(g.border_t) + s(g.border_b) });
    }
    for (const S of z) f(S, u, Ut(u) ? NaN : E, _);
  };
  for (const u of n) f(u, null, NaN, {});
}
function Ww(n, a) {
  const r = (i, s) => {
    if (!i || i.kind === "text" || !Mt(i)) return;
    const c = i.style, f = c.position === "absolute" ? c.w === void 0 && (c.left === void 0 || c.right === void 0) : s && typeof c.w != "number";
    if (f && Ut(i))
      for (const u of i.children ?? []) {
        const m = u.kind === "text" ? void 0 : u.style.flex_basis;
        u.kind !== "text" && u.style.flex_grow > 0 && (m === 0 || typeof m == "string" && m.endsWith("%")) && a.set(u, { ...a.get(u), flex_basis: "auto" });
      }
    for (const u of i.children ?? []) r(u, f);
  };
  for (const i of n) r(i, !1);
}
function $w(n, a) {
  const r = a.heights ?? /* @__PURE__ */ new Map(), i = (m) => r.get(m), s = (m) => {
    const h = i(m);
    if (Number.isFinite(h)) return h;
    if (m.kind === "text" || !Mt(m)) return 0;
    const k = m.style, g = typeof k.min_h == "number" ? k.min_h : 0, b = (m.children ?? []).filter(Jt), E = b.map((S) => s(S) + (S.kind === "text" ? 0 : Math.max(0, se(S.style.mt) || 0) + Math.max(0, se(S.style.mb) || 0))), _ = b.length ? Ut(m) ? Math.max(...E) : E.reduce((S, N) => S + N, 0) + (k.display === "flex" ? (se(k.gap_y) || 0) * (b.length - 1) : 0) : 0, z = [k.pt, k.pb, k.border_t, k.border_b].reduce((S, N) => S + (se(N) || 0), 0);
    return Math.max(g, _ + z);
  }, c = (m) => !(m.children ?? []).filter(Jt).length || Ut(m) ? NaN : s({ ...m, style: { ...m.style, h: void 0, max_h: void 0, min_h: void 0 } }), f = (m, h) => {
    const k = m.style;
    if (typeof k.h == "number") return k.h;
    if (typeof k.max_h == "number") return k.max_h;
    if (!h || !Ei(h) || Ut(h)) return NaN;
    const g = h.style, b = typeof g.h == "number" ? g.h : typeof g.max_h == "number" ? g.max_h : NaN, E = (h.children ?? []).filter(Jt);
    let _ = 0;
    for (const S of E) {
      if (S === m) continue;
      const N = i(S);
      if (!Number.isFinite(N)) return NaN;
      _ += N + (S.kind === "text" ? 0 : se(S.style.mt) + se(S.style.mb));
    }
    const z = g.display === "flex" ? se(g.gap_y) * Math.max(0, E.length - 1) : 0;
    return b - se(g.pt) - se(g.pb) - se(g.border_t) - se(g.border_b) - _ - z - se(k.mt) - se(k.mb);
  }, u = (m, h) => {
    if (!(!m || m.kind === "text" || !Mt(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const k = c(m), g = f(m, h);
        Number.isFinite(k) && Number.isFinite(g) && k > g + 0.01 && a.set(m, { ...a.get(m), pr: se(m.style.pr) + m.scrollbar });
      }
      for (const k of m.children ?? []) u(k, m);
    }
  };
  for (const m of n) u(m, null);
}
const Fw = ["text_size", "line_height", "whitespace", "text_ellipsis"], se = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ei = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ut = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Jt = (n) => n.kind === "text" || Mt(n) && n.style.position !== "absolute";
function Iw(n, a) {
  const r = /* @__PURE__ */ new Map(), i = (z, S) => r.set(z, { ...r.get(z), ...Object.fromEntries(Object.entries(S).filter(([, N]) => Number.isFinite(N))) }), s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
  function f(z, S) {
    if (z.kind === "text") return S.whitespace === "nowrap" || Gm.test(z.text) ? xa(S) ?? NaN : NaN;
    const N = { ...S };
    for (const V of Fw) z.style[V] !== void 0 && (N[V] = z.style[V]);
    c.set(z, N);
    const D = z.style, j = (z.children ?? []).filter(Jt), X = j.map((V) => f(V, N));
    let U;
    if (D.h !== void 0 && D.h !== "auto") U = se(D.h);
    else if (z.kind === "engine") U = NaN;
    else if (z.kind === "input")
      U = (z.input_type === "textarea" || z.input_type === "select" ? NaN : xa(N) ?? NaN) + se(D.pt) + se(D.pb) + se(D.border_t) + se(D.border_b), D.min_h !== void 0 && (U = Math.max(U, se(D.min_h)));
    else {
      const V = j.map((x, y) => (x.kind === "text" ? 0 : se(x.style.mt) + se(x.style.mb)) + X[y]);
      let w;
      if (Ut(z)) w = D.flex_wrap === "wrap" ? NaN : D.items === "baseline" ? m(j, X, N) : Math.max(0, ...V);
      else if (Ei(z)) {
        const x = j.some((T) => T.kind !== "text" && (T.style.flex_grow > 0 || T.style.flex_basis !== void 0)), y = D.display !== "flex" && j.some((T) => T.kind !== "text" && (se(T.style.mt) || se(T.style.mb)));
        w = x || y ? NaN : V.reduce((T, R) => T + R, 0) + (D.display === "flex" ? se(D.gap_y) * Math.max(0, j.length - 1) : 0);
      } else w = NaN;
      U = w + se(D.pt) + se(D.pb) + se(D.border_t) + se(D.border_b), D.min_h !== void 0 && (U = Math.max(U, se(D.min_h))), D.max_h !== void 0 && (U = Math.min(U, se(D.max_h)));
    }
    return s.set(z, U), U;
  }
  const u = (z) => (xa(z) - (vi + Vp) * z.text_size) / 2 + vi * z.text_size;
  function m(z, S, N) {
    let D = 0, j = 0;
    for (const [X, U] of z.entries()) {
      const V = U.kind === "text" ? N : c.get(U);
      if (!(U.kind === "text" || (U.children ?? []).filter(Jt).every((T) => T.kind === "text")) || !Number.isFinite(S[X]) || typeof V.text_size != "number") return NaN;
      const x = U.kind === "text" ? {} : U.style, y = se(x.mt) + se(x.border_t) + se(x.pt) + u(V);
      D = Math.max(D, y), j = Math.max(j, se(x.mt) + S[X] + se(x.mb) - y);
    }
    return D + j;
  }
  const h = () => ({ exact: 0, laid: 0 }), k = (z, S) => {
    if (!Number.isFinite(S))
      return Object.assign(z, h()), NaN;
    z.exact += S;
    const N = Math.round(z.exact * a + 1e-9) / a, D = N - z.laid;
    return z.laid = N, D;
  };
  function g(z) {
    if (!(z.kind === "text" || !Mt(z))) {
      for (const S of (z.children ?? []).filter((N) => N.kind !== "text" && Mt(N) && N.style.position === "absolute")) g(S);
      if (Ei(z) && !Ut(z)) {
        const S = h();
        i(z, { border_t: k(S, se(z.style.border_t)), pt: k(S, se(z.style.pt)) }), b(z, S);
      } else for (const S of (z.children ?? []).filter(Jt)) S.kind !== "text" && g(S);
    }
  }
  function b(z, S) {
    const N = (z.children ?? []).filter(Jt), D = z.style.display === "flex" ? se(z.style.gap_y) : 0;
    if (D && N.some((j) => j.kind === "text")) {
      for (const j of N) j.kind !== "text" && g(j);
      return !1;
    }
    return D && i(z, { gap_y: 0 }), N.forEach((j, X) => {
      if (j.kind === "text") {
        const U = s.get(j) ?? f(j, c.get(z) ?? {});
        Number.isFinite(U) ? i(j, { h: k(S, U) }) : Object.assign(S, h());
        return;
      }
      if (i(j, { mt: k(S, (X ? D : 0) + se(j.style.mt)) }), Number.isFinite(s.get(j))) _(j, S);
      else if (E(j)) {
        const U = j.style;
        i(j, { border_t: k(S, se(U.border_t)), pt: k(S, se(U.pt)) }), i(j, { pb: k(S, se(U.pb)), border_b: k(S, se(U.border_b)) });
      } else
        g(j), Object.assign(S, h());
      i(j, { mb: k(S, se(j.style.mb)) });
    }), !0;
  }
  function E(z) {
    const S = z.style, N = (z.children ?? []).filter(Jt), D = xa(c.get(z) ?? {});
    return z.kind === "div" && !Ut(z) && N.length > 0 && N.every((j) => j.kind === "text") && Number.isInteger(D) && [S.h, S.min_h, S.max_h].every((j) => j === void 0 || j === "auto");
  }
  function _(z, S) {
    const N = z.style;
    for (const V of (z.children ?? []).filter((w) => w.kind !== "text" && Mt(w) && w.style.position === "absolute")) g(V);
    const D = S.laid, j = S.exact;
    i(z, { border_t: k(S, se(N.border_t)), pt: k(S, se(N.pt)) });
    const X = N.h !== void 0 && N.h !== "auto", U = s.get(z) - se(N.pt) - se(N.pb) - se(N.border_t) - se(N.border_b);
    if (z.kind === "input")
      X || k(S, U);
    else if (Ut(z) || X && (N.justify ?? "start") !== "start") {
      for (const V of (z.children ?? []).filter(Jt)) V.kind !== "text" && g(V);
      X || k(S, U);
    } else !b(z, S) && !X && k(S, U);
    if (X) {
      S.exact = j + s.get(z), S.laid = Math.round(S.exact * a + 1e-9) / a, i(z, { h: S.laid - D });
      return;
    }
    i(z, { pb: k(S, se(N.pb)), border_b: k(S, se(N.border_b)) }), i(z, { h: S.laid - D });
  }
  for (const z of n)
    f(z, {}), g(z);
  return Object.defineProperty(r, "heights", { value: s }), r;
}
const r4 = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }] };
export {
  r4 as NAMED_ELEMENTS,
  j0 as React,
  hb as SCHEMA,
  a4 as STYLE_KEYS,
  l4 as describeToGpui,
  Pw as jsxRuntime,
  e4 as mount,
  t4 as reactDom,
  n4 as sdk
};
