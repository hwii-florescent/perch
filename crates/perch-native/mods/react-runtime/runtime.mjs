function Go(n, a) {
  for (var i = 0; i < a.length; i++) {
    const s = a[i];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const o in s)
        if (o !== "default" && !(o in n)) {
          const u = Object.getOwnPropertyDescriptor(s, o);
          u && Object.defineProperty(n, o, u.get ? u : {
            enumerable: !0,
            get: () => s[o]
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
class ie extends Error {
}
const Ug = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Gg = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), qg = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Ug]);
function go(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (a, i, s) => i ? String.fromCodePoint(parseInt(i, 16)) : s);
}
function wl(n, a) {
  let i = a;
  for (; i < n.length; ) {
    const s = n[i];
    if (s === "\\") {
      i += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(s)) {
      i++;
      continue;
    }
    break;
  }
  if (i === a) throw new ie(`expected a name at ${a} in ${JSON.stringify(n)}`);
  return [go(n.slice(a, i)), i];
}
function Yg(n, a) {
  let i = 1;
  for (let s = a; s < n.length; s++) {
    const o = n[s];
    if (o === "\\") {
      s++;
      continue;
    }
    if (o === '"' || o === "'") {
      if (s = n.indexOf(o, s + 1), s < 0) break;
      continue;
    }
    if (o === "(") i++;
    else if (o === ")" && --i === 0) return s;
  }
  throw new ie(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function qo(n) {
  const a = [];
  let i = 0, s = 0;
  for (let o = 0; o < n.length; o++) {
    const u = n[o];
    if (u === "\\") {
      o++;
      continue;
    }
    if (u === '"' || u === "'") {
      if (o = n.indexOf(u, o + 1), o < 0) break;
      continue;
    }
    u === "(" || u === "[" ? i++ : u === ")" || u === "]" ? i-- : u === "," && i === 0 && (a.push(n.slice(s, o).trim()), s = o + 1);
  }
  return a.push(n.slice(s).trim()), a.filter(Boolean);
}
function Lg(n, a) {
  const i = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let s = !1;
  for (; a < n.length; ) {
    const o = n[a];
    if (o === "*") {
      i.tag = "*", a++, s = !0;
      continue;
    }
    if (o === ".") {
      const [u, m] = wl(n, a + 1);
      i.classes.push(u), a = m, s = !0;
      continue;
    }
    if (o === "#") {
      const [u, m] = wl(n, a + 1);
      i.id = u, a = m, s = !0;
      continue;
    }
    if (o === "[") {
      const u = n.indexOf("]", a);
      if (u < 0) throw new ie(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(a + 1, u).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new ie(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      i.attrs.push({ name: go(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : go(p) }), a = u + 1, s = !0;
      continue;
    }
    if (o === ":") {
      if (n[a + 1] === ":") {
        const [p, v] = wl(n, a + 2), w = p.toLowerCase();
        if (w !== "before" && w !== "after") throw new ie(`::${w} is not supported`);
        if (i.pseudoElement = w, a = v, s = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ie(`nothing may follow ::${w} in ${JSON.stringify(n)}`);
        break;
      }
      const [u, m] = wl(n, a + 1);
      a = m;
      const f = u.toLowerCase();
      if ((f === "before" || f === "after") && n[a] !== "(") {
        if (i.pseudoElement = f, s = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ie(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!Gg.has(f)) throw new ie(`:${f}() is not supported`);
        const p = Yg(n, a + 1), v = n.slice(a + 1, p).trim();
        if (a = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(v)) throw new ie(`:nth-child(${v}) is not supported (only a number)`);
          i.pseudos.push({ name: f, n: Number(v) });
        } else {
          const w = qo(v).map(Yo);
          if (f === "has" && w.some((y) => y.length !== 1)) throw new ie(`:has(${v}) is not supported (only a compound selector)`);
          i.pseudos.push({ name: f, list: w });
        }
      } else {
        if (!qg.has(f)) throw new ie(`:${f} is not supported`);
        i.pseudos.push({ name: f });
      }
      s = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(o) && !s) {
      const [u, m] = wl(n, a);
      i.tag = u.toLowerCase(), a = m, s = !0;
      continue;
    }
    break;
  }
  if (!s) throw new ie(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [i, a];
}
function Yo(n) {
  const a = [];
  let i = 0, s = null;
  for (n = n.trim(); i < n.length; ) {
    const [o, u] = Lg(n, i);
    if (a.at(-1)?.compound.pseudoElement) throw new ie(`::${a.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    a.push({ compound: o, combinator: s }), i = u;
    let m = !1;
    for (; n[i] === " " || n[i] === `
` || n[i] === "	"; )
      i++, m = !0;
    if (i >= n.length) break;
    const f = n[i];
    if (f === ">")
      for (s = ">", i++; n[i] === " "; ) i++;
    else {
      if (f === "+" || f === "~") throw new ie(`the ${f} combinator is not supported`);
      if (m) s = " ";
      else throw new ie(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!a.length) throw new ie("empty selector");
  return a;
}
const Jd = /* @__PURE__ */ new Map();
function pi(n) {
  let a = Jd.get(n);
  return a || (a = qo(n).map(Yo), Jd.set(n, a)), a;
}
function tm(n) {
  const a = [0, 0, 0], i = (s) => {
    a[0] += s[0], a[1] += s[1], a[2] += s[2];
  };
  for (const { compound: s } of n) {
    s.id && a[0]++, a[1] += s.classes.length + s.attrs.length, s.tag && s.tag !== "*" && a[2]++, s.pseudoElement && a[2]++;
    for (const o of s.pseudos)
      if (o.name !== "where")
        if (o.list) {
          const u = o.list.map(tm).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          i(u);
        } else a[1]++;
  }
  return a;
}
function Qg(n, { name: a, op: i, value: s }) {
  const o = n.getAttribute(a);
  if (o == null) return !1;
  if (i === null) return !0;
  switch (i) {
    case "=":
      return o === s;
    case "^=":
      return s !== "" && o.startsWith(s);
    case "$=":
      return s !== "" && o.endsWith(s);
    case "*=":
      return s !== "" && o.includes(s);
    case "~=":
      return o.split(/\s+/).includes(s);
    case "|=":
      return o === s || o.startsWith(`${s}-`);
    default:
      return !1;
  }
}
function Br(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function em(n, a) {
  for (const i of n.children) if (a(i) || em(i, a)) return !0;
  return !1;
}
function nm(n, a, i, s) {
  if ((a.pseudoElement ?? null) !== (s ? i.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const o = n.classSet ?? new Set(n.classList ?? []);
    for (const u of a.classes) if (!o.has(u)) return !1;
  }
  for (const o of a.attrs) if (!Qg(n, o)) return !1;
  for (const o of a.pseudos)
    switch (o.name) {
      case "first-child":
        if (Br(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Br(n).length !== 1) return !1;
        break;
      case "last-child": {
        const u = Br(n);
        if (u[u.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Br(n).indexOf(n) !== o.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (o.list.some((u) => La(n, u, i, s))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !o.list.some(([{ compound: u }]) => em(n, (m) => nm(m, u, i, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!o.list.some((u) => La(n, u, i, s))) return !1;
        break;
      default:
        if (!i.state || !i.state(n, o.name, s)) return !1;
    }
  return !0;
}
function La(n, a, i, s = !0) {
  const o = (u, m, f) => {
    const { compound: p, combinator: v } = a[m];
    if (!nm(u, p, i, f)) return !1;
    if (m === 0) return !0;
    if (v === ">") return !!u.parentElement && o(u.parentElement, m - 1, !1);
    for (let w = u.parentElement; w; w = w.parentElement) if (o(w, m - 1, !1)) return !0;
    return !1;
  };
  return o(n, a.length - 1, s);
}
function Vg(n, a, i = {}) {
  return (typeof a == "string" ? pi(a) : a).some((o) => La(n, o, i));
}
function bo(n, a, i = {}) {
  return La(n, a, i);
}
function Al(n, a, i = {}) {
  const s = pi(a), o = [], u = (m) => {
    for (const f of m.children)
      s.some((p) => La(f, p, i)) && o.push(f), u(f);
  };
  return u(n), o;
}
function am(n, a, i = {}) {
  const s = pi(a);
  for (let o = n; o; o = o.parentElement) if (s.some((u) => La(o, u, i))) return o;
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
let Kg = 1;
class vo {
  constructor(a = 0, i = 0, s = 0, o = 0) {
    this.x = a, this.y = i, this.width = s, this.height = o;
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
class Lo {
  constructor() {
    this.listeners = [];
  }
  addEventListener(a, i, s) {
    const o = s === !0 || !!s?.capture;
    this.listeners.some((u) => u.type === a && u.listener === i && u.capture === o) || this.listeners.push({ type: a, listener: i, capture: o });
  }
  removeEventListener(a, i, s) {
    const o = s === !0 || !!s?.capture;
    this.listeners = this.listeners.filter((u) => !(u.type === a && u.listener === i && u.capture === o));
  }
}
let Xg = 0;
const yo = () => ++Xg;
class hi {
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
class Zt extends Lo {
  constructor(a, i = {}, s = null) {
    super(), this.nodeType = 1, this.id = `n${Kg++}`, this.tagName = a.toLowerCase(), this.props = i, this.childNodes = [], this.parentNode = null, this.ownerDocument = s, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = yo(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = yo();
    for (let i = this; i instanceof Zt; i = i.parentNode) i.stamp = a;
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
    return this.parentNode instanceof Zt ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((a) => a instanceof Zt);
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
      const i = a.split(/\s+/).filter(Boolean);
      this.classCache = { name: a, list: i, set: new Set(i) };
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
    for (const [i, s] of Object.entries(this.props))
      i.startsWith("data-") && s != null && s !== !1 && (a[i.slice(5).replace(/-([a-z])/g, (o, u) => u.toUpperCase())] = String(s));
    return a;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(a) {
    const i = this.props;
    if (a === "class") return this.className || null;
    if (a === "id") return i.id != null ? String(i.id) : null;
    if (a === "style") return null;
    const o = i[a === "for" ? "htmlFor" : a === "tabindex" ? "tabIndex" : a];
    return o == null || typeof o == "function" ? null : typeof o == "boolean" ? a.startsWith("aria-") || a.startsWith("data-") ? String(o) : o ? "" : null : String(o);
  }
  hasAttribute(a) {
    return this.getAttribute(a) !== null;
  }
  appendChild(a) {
    return a.parentNode && a.parentNode.removeChild(a), a.parentNode = this, this.childNodes.push(a), this.touchWatchers(), a;
  }
  insertBefore(a, i) {
    a.parentNode && a.parentNode.removeChild(a);
    const s = this.childNodes.indexOf(i);
    return a.parentNode = this, s < 0 ? this.childNodes.push(a) : this.childNodes.splice(s, 0, a), this.touchWatchers(), a;
  }
  removeChild(a) {
    const i = this.childNodes.indexOf(a);
    return i >= 0 && this.childNodes.splice(i, 1), a.parentNode = null, this.touchWatchers(), a;
  }
  contains(a) {
    for (let i = a; i; i = i.parentNode) if (i === this) return !0;
    return !1;
  }
  matches(a) {
    return Vg(this, a);
  }
  closest(a) {
    return am(this, a);
  }
  querySelectorAll(a) {
    return Al(this, a);
  }
  querySelector(a) {
    return Al(this, a)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const a = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return a ? new vo(a.x, a.y, a.width, a.height) : new vo();
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
  setSelectionRange(a, i) {
    this.selectedAll = a === 0 && i >= this.value.length && i > 0;
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
    const a = this, i = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, p) => p.toUpperCase()), s = (m) => {
      const f = a.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, o = (m) => a.inline && m in a.inline ? a.inline[m] : s(m), u = (m, f) => {
      const p = f == null ? "" : String(f);
      o(m) !== p && (a.inline ??= {}, p === s(m) ? delete a.inline[m] : a.inline[m] = p, a.touch(), a.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (p, v) => u(i(p), v) : f === "removeProperty" ? (p) => {
            const v = o(i(p));
            return u(i(p), ""), v;
          } : f === "getPropertyValue" ? (p) => o(i(p)) : o(f);
      },
      set: (m, f, p) => (typeof f == "string" && u(f, p), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return Wd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return Wd(this, a);
  }
}
const lm = Symbol("perch.stale-layout"), rm = 3;
let Fr = !1;
function im(n) {
  return () => {
    let a, i = !1;
    const s = (o) => {
      const u = Fr;
      Fr = o < rm;
      try {
        a = n();
      } catch (m) {
        const f = m?.[lm];
        if (!f) throw m;
        f.retries.push(() => {
          i || s(o + 1);
        });
      } finally {
        Fr = u;
      }
    };
    return s(0), () => {
      i = !0, typeof a == "function" && a();
    };
  };
}
const xo = "perch-dom:", Zg = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), Jg = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Wd(n, a = []) {
  const i = new Set(a.map((o) => Jg[o] ?? o)), s = (o) => {
    if (!(o instanceof Zt)) return { x: o.data, ...o.hidden ? { h: 1 } : {} };
    const u = {};
    for (const [m, f] of Object.entries(o.props))
      Zg.has(m) || i.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (u[m] = f);
    return { t: o.tagName, p: u, c: o.childNodes.map(s), ...o.hidden ? { h: 1 } : {} };
  };
  return xo + JSON.stringify(s(n));
}
function Wg(n, a) {
  if (typeof n != "string" || !n.startsWith(xo)) return null;
  let i;
  try {
    i = JSON.parse(n.slice(xo.length));
  } catch {
    return null;
  }
  const s = (u) => !!u && typeof u == "object" && !Array.isArray(u), o = (u) => {
    if (!s(u)) throw new Error("not a node");
    let m;
    if (typeof u.x == "string") m = new hi(u.x);
    else {
      if (typeof u.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(u.t) || !s(u.p) || !Array.isArray(u.c)) throw new Error("not an element");
      m = new Zt(u.t, u.p, a);
      for (const f of u.c) m.appendChild(o(f));
    }
    return m.hidden = u.h === 1, m;
  };
  try {
    return [o(i)];
  } catch {
    return null;
  }
}
class Fg {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class $g {
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
  setItem(a, i) {
    this.map.set(a, String(i));
  }
  removeItem(a) {
    this.map.delete(a);
  }
  clear() {
    this.map.clear();
  }
}
function Fd(n) {
  for (let a = n; a instanceof Zt; a = a.parentElement) a.touch();
}
class Ig extends Lo {
  constructor(a) {
    super(), this.perch = a, this.documentElement = new Zt("html", {}, this), this.body = new Zt("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(a) {
    return new Zt(a, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(a) {
    const i = this.perch?.bounds;
    if (typeof i != "function" || !this.measureKey) return null;
    a.measured || (a.measured = !0, a.touch(), this.restyled());
    const s = i(this.measureKey(a));
    if (Fr && (!s || this.stale?.())) throw { [lm]: this };
    return s ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, Fd(a), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, Fd(a), this.activeElement === a && (this.activeElement = this.body);
  }
  querySelectorAll(a) {
    return Al(this.documentElement, a);
  }
  querySelector(a) {
    return this.querySelectorAll(a)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(a) {
    return Al(this.documentElement, "*").find((i) => i.props?.id === a) ?? null;
  }
}
class Pg extends Lo {
  constructor(a, i) {
    super(), this.perch = a, this.document = i, this.location = { get hostname() {
      return a.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(a, i, ...s) {
    return globalThis.setTimeout(a, i, ...s);
  }
  clearTimeout(a) {
    return globalThis.clearTimeout(a);
  }
}
function sm(n) {
  return {
    setTimeout: (a, i = 0, ...s) => n.setTimeout(() => a(...s), Math.max(0, Number(i) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const $d = Symbol.for("perch.react.globals");
function We(n, a, i) {
  Object.defineProperty(n, a, { value: i, configurable: !0, writable: !0, enumerable: !1 });
}
function t0(n, a = globalThis) {
  const i = new Ig(n), s = new Pg(n, i);
  i.defaultView = s;
  const o = n.storage ?? new $g();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = sm(n);
    We(a, "setTimeout", f.setTimeout), We(a, "clearTimeout", f.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && We(a, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), We(a, "requestAnimationFrame", (f) => a.setTimeout(() => f(Date.now()), 0)), We(a, "cancelAnimationFrame", (f) => a.clearTimeout(f));
  const u = { document: i, window: s, localStorage: o, HTMLElement: Zt, Element: Zt };
  for (const f of Object.keys(u))
    Object.defineProperty(a, f, { get: () => a[$d]?.[f], configurable: !0, enumerable: !1 });
  a[$d] = u, We(a, "DOMRect", vo), We(a, "getComputedStyle", e0), typeof a.ResizeObserver != "function" && We(a, "ResizeObserver", Fg);
  const m = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      We(m, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || We(a, "navigator", m), { document: i, window: s, globals: u };
}
function e0(n) {
  const a = n?.ownerDocument?.computed?.(n) ?? {}, i = (s) => {
    const o = a[s];
    return typeof o == "string" || typeof o == "number" ? String(o) : "";
  };
  return new Proxy({}, {
    get: (s, o) => {
      if (typeof o == "string")
        return o === "getPropertyValue" ? (u) => i(String(u)) : i(o.replace(/[A-Z]/g, (u) => `-${u.toLowerCase()}`));
    }
  });
}
function wo(n, a = !1) {
  if (!(a ? n?.tagName === "input" && om(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let s = n.parentElement; s; s = s.parentElement) if (s.tagName === "form") return s;
  return null;
}
const om = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Id = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Id?.setTimeout == "function") {
  const n = sm(Id);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Qo(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function n0(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var a = n.default;
  if (typeof a == "function") {
    var i = function s() {
      return this instanceof s ? Reflect.construct(a, arguments, this.constructor) : a.apply(this, arguments);
    };
    i.prototype = a.prototype;
  } else i = {};
  return Object.defineProperty(i, "__esModule", { value: !0 }), Object.keys(n).forEach(function(s) {
    var o = Object.getOwnPropertyDescriptor(n, s);
    Object.defineProperty(i, s, o.get ? o : {
      enumerable: !0,
      get: function() {
        return n[s];
      }
    });
  }), i;
}
var ao = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Pd;
function a0() {
  if (Pd) return pt;
  Pd = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), s = Symbol.for("react.strict_mode"), o = Symbol.for("react.profiler"), u = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), v = Symbol.for("react.memo"), w = Symbol.for("react.lazy"), y = Symbol.for("react.activity"), b = Symbol.iterator;
  function S(C) {
    return C === null || typeof C != "object" ? null : (C = b && C[b] || C["@@iterator"], typeof C == "function" ? C : null);
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
  }, z = Object.assign, M = {};
  function j(C, Z, at) {
    this.props = C, this.context = Z, this.refs = M, this.updater = at || T;
  }
  j.prototype.isReactComponent = {}, j.prototype.setState = function(C, Z) {
    if (typeof C != "object" && typeof C != "function" && C != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, C, Z, "setState");
  }, j.prototype.forceUpdate = function(C) {
    this.updater.enqueueForceUpdate(this, C, "forceUpdate");
  };
  function O() {
  }
  O.prototype = j.prototype;
  function B(C, Z, at) {
    this.props = C, this.context = Z, this.refs = M, this.updater = at || T;
  }
  var W = B.prototype = new O();
  W.constructor = B, z(W, j.prototype), W.isPureReactComponent = !0;
  var J = Array.isArray;
  function D() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function _(C, Z, at) {
    var ot = at.ref;
    return {
      $$typeof: n,
      type: C,
      key: Z,
      ref: ot !== void 0 ? ot : null,
      props: at
    };
  }
  function k(C, Z) {
    return _(C.type, Z, C.props);
  }
  function N(C) {
    return typeof C == "object" && C !== null && C.$$typeof === n;
  }
  function E(C) {
    var Z = { "=": "=0", ":": "=2" };
    return "$" + C.replace(/[=:]/g, function(at) {
      return Z[at];
    });
  }
  var R = /\/+/g;
  function Q(C, Z) {
    return typeof C == "object" && C !== null && C.key != null ? E("" + C.key) : Z.toString(36);
  }
  function $(C) {
    switch (C.status) {
      case "fulfilled":
        return C.value;
      case "rejected":
        throw C.reason;
      default:
        switch (typeof C.status == "string" ? C.then(D, D) : (C.status = "pending", C.then(
          function(Z) {
            C.status === "pending" && (C.status = "fulfilled", C.value = Z);
          },
          function(Z) {
            C.status === "pending" && (C.status = "rejected", C.reason = Z);
          }
        )), C.status) {
          case "fulfilled":
            return C.value;
          case "rejected":
            throw C.reason;
        }
    }
    throw C;
  }
  function U(C, Z, at, ot, ct) {
    var ut = typeof C;
    (ut === "undefined" || ut === "boolean") && (C = null);
    var Et = !1;
    if (C === null) Et = !0;
    else
      switch (ut) {
        case "bigint":
        case "string":
        case "number":
          Et = !0;
          break;
        case "object":
          switch (C.$$typeof) {
            case n:
            case a:
              Et = !0;
              break;
            case w:
              return Et = C._init, U(
                Et(C._payload),
                Z,
                at,
                ot,
                ct
              );
          }
      }
    if (Et)
      return ct = ct(C), Et = ot === "" ? "." + Q(C, 0) : ot, J(ct) ? (at = "", Et != null && (at = Et.replace(R, "$&/") + "/"), U(ct, Z, at, "", function(Vn) {
        return Vn;
      })) : ct != null && (N(ct) && (ct = k(
        ct,
        at + (ct.key == null || C && C.key === ct.key ? "" : ("" + ct.key).replace(
          R,
          "$&/"
        ) + "/") + Et
      )), Z.push(ct)), 1;
    Et = 0;
    var $t = ot === "" ? "." : ot + ":";
    if (J(C))
      for (var ht = 0; ht < C.length; ht++)
        ot = C[ht], ut = $t + Q(ot, ht), Et += U(
          ot,
          Z,
          at,
          ut,
          ct
        );
    else if (ht = S(C), typeof ht == "function")
      for (C = ht.call(C), ht = 0; !(ot = C.next()).done; )
        ot = ot.value, ut = $t + Q(ot, ht++), Et += U(
          ot,
          Z,
          at,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof C.then == "function")
        return U(
          $(C),
          Z,
          at,
          ot,
          ct
        );
      throw Z = String(C), Error(
        "Objects are not valid as a React child (found: " + (Z === "[object Object]" ? "object with keys {" + Object.keys(C).join(", ") + "}" : Z) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function V(C, Z, at) {
    if (C == null) return C;
    var ot = [], ct = 0;
    return U(C, ot, "", "", function(ut) {
      return Z.call(at, ut, ct++);
    }), ot;
  }
  function I(C) {
    if (C._status === -1) {
      var Z = C._result;
      Z = Z(), Z.then(
        function(at) {
          (C._status === 0 || C._status === -1) && (C._status = 1, C._result = at);
        },
        function(at) {
          (C._status === 0 || C._status === -1) && (C._status = 2, C._result = at);
        }
      ), C._status === -1 && (C._status = 0, C._result = Z);
    }
    if (C._status === 1) return C._result.default;
    throw C._result;
  }
  var L = typeof reportError == "function" ? reportError : function(C) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var Z = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof C == "object" && C !== null && typeof C.message == "string" ? String(C.message) : String(C),
        error: C
      });
      if (!window.dispatchEvent(Z)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", C);
      return;
    }
    console.error(C);
  }, K = {
    map: V,
    forEach: function(C, Z, at) {
      V(
        C,
        function() {
          Z.apply(this, arguments);
        },
        at
      );
    },
    count: function(C) {
      var Z = 0;
      return V(C, function() {
        Z++;
      }), Z;
    },
    toArray: function(C) {
      return V(C, function(Z) {
        return Z;
      }) || [];
    },
    only: function(C) {
      if (!N(C))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return C;
    }
  };
  return pt.Activity = y, pt.Children = K, pt.Component = j, pt.Fragment = i, pt.Profiler = o, pt.PureComponent = B, pt.StrictMode = s, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, pt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(C) {
      return g.H.useMemoCache(C);
    }
  }, pt.cache = function(C) {
    return function() {
      return C.apply(null, arguments);
    };
  }, pt.cacheSignal = function() {
    return null;
  }, pt.cloneElement = function(C, Z, at) {
    if (C == null)
      throw Error(
        "The argument must be a React element, but you passed " + C + "."
      );
    var ot = z({}, C.props), ct = C.key;
    if (Z != null)
      for (ut in Z.key !== void 0 && (ct = "" + Z.key), Z)
        !h.call(Z, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && Z.ref === void 0 || (ot[ut] = Z[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) ot.children = at;
    else if (1 < ut) {
      for (var Et = Array(ut), $t = 0; $t < ut; $t++)
        Et[$t] = arguments[$t + 2];
      ot.children = Et;
    }
    return _(C.type, ct, ot);
  }, pt.createContext = function(C) {
    return C = {
      $$typeof: m,
      _currentValue: C,
      _currentValue2: C,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, C.Provider = C, C.Consumer = {
      $$typeof: u,
      _context: C
    }, C;
  }, pt.createElement = function(C, Z, at) {
    var ot, ct = {}, ut = null;
    if (Z != null)
      for (ot in Z.key !== void 0 && (ut = "" + Z.key), Z)
        h.call(Z, ot) && ot !== "key" && ot !== "__self" && ot !== "__source" && (ct[ot] = Z[ot]);
    var Et = arguments.length - 2;
    if (Et === 1) ct.children = at;
    else if (1 < Et) {
      for (var $t = Array(Et), ht = 0; ht < Et; ht++)
        $t[ht] = arguments[ht + 2];
      ct.children = $t;
    }
    if (C && C.defaultProps)
      for (ot in Et = C.defaultProps, Et)
        ct[ot] === void 0 && (ct[ot] = Et[ot]);
    return _(C, ut, ct);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(C) {
    return { $$typeof: f, render: C };
  }, pt.isValidElement = N, pt.lazy = function(C) {
    return {
      $$typeof: w,
      _payload: { _status: -1, _result: C },
      _init: I
    };
  }, pt.memo = function(C, Z) {
    return {
      $$typeof: v,
      type: C,
      compare: Z === void 0 ? null : Z
    };
  }, pt.startTransition = function(C) {
    var Z = g.T, at = {};
    g.T = at;
    try {
      var ot = C(), ct = g.S;
      ct !== null && ct(at, ot), typeof ot == "object" && ot !== null && typeof ot.then == "function" && ot.then(D, L);
    } catch (ut) {
      L(ut);
    } finally {
      Z !== null && at.types !== null && (Z.types = at.types), g.T = Z;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, pt.use = function(C) {
    return g.H.use(C);
  }, pt.useActionState = function(C, Z, at) {
    return g.H.useActionState(C, Z, at);
  }, pt.useCallback = function(C, Z) {
    return g.H.useCallback(C, Z);
  }, pt.useContext = function(C) {
    return g.H.useContext(C);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(C, Z) {
    return g.H.useDeferredValue(C, Z);
  }, pt.useEffect = function(C, Z) {
    return g.H.useEffect(C, Z);
  }, pt.useEffectEvent = function(C) {
    return g.H.useEffectEvent(C);
  }, pt.useId = function() {
    return g.H.useId();
  }, pt.useImperativeHandle = function(C, Z, at) {
    return g.H.useImperativeHandle(C, Z, at);
  }, pt.useInsertionEffect = function(C, Z) {
    return g.H.useInsertionEffect(C, Z);
  }, pt.useLayoutEffect = function(C, Z) {
    return g.H.useLayoutEffect(C, Z);
  }, pt.useMemo = function(C, Z) {
    return g.H.useMemo(C, Z);
  }, pt.useOptimistic = function(C, Z) {
    return g.H.useOptimistic(C, Z);
  }, pt.useReducer = function(C, Z, at) {
    return g.H.useReducer(C, Z, at);
  }, pt.useRef = function(C) {
    return g.H.useRef(C);
  }, pt.useState = function(C) {
    return g.H.useState(C);
  }, pt.useSyncExternalStore = function(C, Z, at) {
    return g.H.useSyncExternalStore(
      C,
      Z,
      at
    );
  }, pt.useTransition = function() {
    return g.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var tf;
function l0() {
  return tf || (tf = 1, ao.exports = a0()), ao.exports;
}
var X = l0();
const cm = /* @__PURE__ */ Qo(X), r0 = /* @__PURE__ */ Go({
  __proto__: null,
  default: cm
}, [X]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const i0 = cm ?? r0;
function Lt(n, a) {
  return X.useEffect(im(n), a);
}
function jl(n, a) {
  return X.useLayoutEffect(im(n), a);
}
const s0 = /* @__PURE__ */ Go({
  __proto__: null,
  default: i0,
  useEffect: Lt,
  useLayoutEffect: jl
}, [X]);
var lo = { exports: {} }, _l = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ef;
function o0() {
  if (ef) return _l;
  ef = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.fragment");
  function i(s, o, u) {
    var m = null;
    if (u !== void 0 && (m = "" + u), o.key !== void 0 && (m = "" + o.key), "key" in o) {
      u = {};
      for (var f in o)
        f !== "key" && (u[f] = o[f]);
    } else u = o;
    return o = u.ref, {
      $$typeof: n,
      type: s,
      key: m,
      ref: o !== void 0 ? o : null,
      props: u
    };
  }
  return _l.Fragment = a, _l.jsx = i, _l.jsxs = i, _l;
}
var nf;
function c0() {
  return nf || (nf = 1, lo.exports = o0()), lo.exports;
}
var et = c0();
const u0 = /* @__PURE__ */ Qo(et), Vx = /* @__PURE__ */ Go({
  __proto__: null,
  default: u0
}, [et]);
var ro = { exports: {} }, io = { exports: {} };
const d0 = /* @__PURE__ */ n0(s0);
var so = { exports: {} }, oo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var af;
function f0() {
  return af || (af = 1, (function(n) {
    function a(U, V) {
      var I = U.length;
      U.push(V);
      t: for (; 0 < I; ) {
        var L = I - 1 >>> 1, K = U[L];
        if (0 < o(K, V))
          U[L] = V, U[I] = K, I = L;
        else break t;
      }
    }
    function i(U) {
      return U.length === 0 ? null : U[0];
    }
    function s(U) {
      if (U.length === 0) return null;
      var V = U[0], I = U.pop();
      if (I !== V) {
        U[0] = I;
        t: for (var L = 0, K = U.length, C = K >>> 1; L < C; ) {
          var Z = 2 * (L + 1) - 1, at = U[Z], ot = Z + 1, ct = U[ot];
          if (0 > o(at, I))
            ot < K && 0 > o(ct, at) ? (U[L] = ct, U[ot] = I, L = ot) : (U[L] = at, U[Z] = I, L = Z);
          else if (ot < K && 0 > o(ct, I))
            U[L] = ct, U[ot] = I, L = ot;
          else break t;
        }
      }
      return V;
    }
    function o(U, V) {
      var I = U.sortIndex - V.sortIndex;
      return I !== 0 ? I : U.id - V.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var u = performance;
      n.unstable_now = function() {
        return u.now();
      };
    } else {
      var m = Date, f = m.now();
      n.unstable_now = function() {
        return m.now() - f;
      };
    }
    var p = [], v = [], w = 1, y = null, b = 3, S = !1, T = !1, z = !1, M = !1, j = typeof setTimeout == "function" ? setTimeout : null, O = typeof clearTimeout == "function" ? clearTimeout : null, B = typeof setImmediate < "u" ? setImmediate : null;
    function W(U) {
      for (var V = i(v); V !== null; ) {
        if (V.callback === null) s(v);
        else if (V.startTime <= U)
          s(v), V.sortIndex = V.expirationTime, a(p, V);
        else break;
        V = i(v);
      }
    }
    function J(U) {
      if (z = !1, W(U), !T)
        if (i(p) !== null)
          T = !0, D || (D = !0, E());
        else {
          var V = i(v);
          V !== null && $(J, V.startTime - U);
        }
    }
    var D = !1, g = -1, h = 5, _ = -1;
    function k() {
      return M ? !0 : !(n.unstable_now() - _ < h);
    }
    function N() {
      if (M = !1, D) {
        var U = n.unstable_now();
        _ = U;
        var V = !0;
        try {
          t: {
            T = !1, z && (z = !1, O(g), g = -1), S = !0;
            var I = b;
            try {
              e: {
                for (W(U), y = i(p); y !== null && !(y.expirationTime > U && k()); ) {
                  var L = y.callback;
                  if (typeof L == "function") {
                    y.callback = null, b = y.priorityLevel;
                    var K = L(
                      y.expirationTime <= U
                    );
                    if (U = n.unstable_now(), typeof K == "function") {
                      y.callback = K, W(U), V = !0;
                      break e;
                    }
                    y === i(p) && s(p), W(U);
                  } else s(p);
                  y = i(p);
                }
                if (y !== null) V = !0;
                else {
                  var C = i(v);
                  C !== null && $(
                    J,
                    C.startTime - U
                  ), V = !1;
                }
              }
              break t;
            } finally {
              y = null, b = I, S = !1;
            }
            V = void 0;
          }
        } finally {
          V ? E() : D = !1;
        }
      }
    }
    var E;
    if (typeof B == "function")
      E = function() {
        B(N);
      };
    else if (typeof MessageChannel < "u") {
      var R = new MessageChannel(), Q = R.port2;
      R.port1.onmessage = N, E = function() {
        Q.postMessage(null);
      };
    } else
      E = function() {
        j(N, 0);
      };
    function $(U, V) {
      g = j(function() {
        U(n.unstable_now());
      }, V);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(U) {
      U.callback = null;
    }, n.unstable_forceFrameRate = function(U) {
      0 > U || 125 < U ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < U ? Math.floor(1e3 / U) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return b;
    }, n.unstable_next = function(U) {
      switch (b) {
        case 1:
        case 2:
        case 3:
          var V = 3;
          break;
        default:
          V = b;
      }
      var I = b;
      b = V;
      try {
        return U();
      } finally {
        b = I;
      }
    }, n.unstable_requestPaint = function() {
      M = !0;
    }, n.unstable_runWithPriority = function(U, V) {
      switch (U) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          U = 3;
      }
      var I = b;
      b = U;
      try {
        return V();
      } finally {
        b = I;
      }
    }, n.unstable_scheduleCallback = function(U, V, I) {
      var L = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? L + I : L) : I = L, U) {
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
      return K = I + K, U = {
        id: w++,
        callback: V,
        priorityLevel: U,
        startTime: I,
        expirationTime: K,
        sortIndex: -1
      }, I > L ? (U.sortIndex = I, a(v, U), i(p) === null && U === i(v) && (z ? (O(g), g = -1) : z = !0, $(J, I - L))) : (U.sortIndex = K, a(p, U), T || S || (T = !0, D || (D = !0, E()))), U;
    }, n.unstable_shouldYield = k, n.unstable_wrapCallback = function(U) {
      var V = b;
      return function() {
        var I = b;
        b = V;
        try {
          return U.apply(this, arguments);
        } finally {
          b = I;
        }
      };
    }, n.unstable_recoverFromCut = function() {
      !S && !D || (S = !1, y = null, T = !1, D = !1, i(p) !== null && (T = !0, D = !0, E()));
    };
  })(oo)), oo;
}
var lf;
function um() {
  return lf || (lf = 1, so.exports = f0()), so.exports;
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
var rf;
function m0() {
  return rf || (rf = 1, (function(n) {
    n.exports = function(a) {
      function i(t, e, l, r) {
        return new Qp(t, e, l, r);
      }
      function s() {
      }
      function o(t) {
        var e = "https://react.dev/errors/" + t;
        if (1 < arguments.length) {
          e += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var l = 2; l < arguments.length; l++)
            e += "&args[]=" + encodeURIComponent(arguments[l]);
        }
        return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function u(t) {
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
        if (u(t) !== t)
          throw Error(o(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = u(t), e === null) throw Error(o(188));
          return e !== t ? null : t;
        }
        for (var l = t, r = e; ; ) {
          var c = l.return;
          if (c === null) break;
          var d = c.alternate;
          if (d === null) {
            if (r = c.return, r !== null) {
              l = r;
              continue;
            }
            break;
          }
          if (c.child === d.child) {
            for (d = c.child; d; ) {
              if (d === l) return m(c), t;
              if (d === r) return m(c), e;
              d = d.sibling;
            }
            throw Error(o(188));
          }
          if (l.return !== r.return) l = c, r = d;
          else {
            for (var x = !1, A = c.child; A; ) {
              if (A === l) {
                x = !0, l = c, r = d;
                break;
              }
              if (A === r) {
                x = !0, r = c, l = d;
                break;
              }
              A = A.sibling;
            }
            if (!x) {
              for (A = d.child; A; ) {
                if (A === l) {
                  x = !0, l = d, r = c;
                  break;
                }
                if (A === r) {
                  x = !0, r = d, l = c;
                  break;
                }
                A = A.sibling;
              }
              if (!x) throw Error(o(189));
            }
          }
          if (l.alternate !== r) throw Error(o(190));
        }
        if (l.tag !== 3) throw Error(o(188));
        return l.stateNode.current === l ? t : e;
      }
      function p(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = p(t), e !== null) return e;
          t = t.sibling;
        }
        return null;
      }
      function v(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = v(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function w(t) {
        return t === null || typeof t != "object" ? null : (t = md && t[md] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function y(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Jp ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case xa:
            return "Fragment";
          case ks:
            return "Profiler";
          case dd:
            return "StrictMode";
          case Es:
            return "Suspense";
          case zs:
            return "SuspenseList";
          case Ts:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ya:
              return "Portal";
            case Sn:
              return t.displayName || "Context";
            case fd:
              return (t._context.displayName || "Context") + ".Consumer";
            case Ss:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Ns:
              return e = t.displayName || null, e !== null ? e : y(t.type) || "Memo";
            case En:
              e = t._payload, t = t._init;
              try {
                return y(t(e));
              } catch {
              }
          }
        return null;
      }
      function b(t) {
        return { current: t };
      }
      function S(t) {
        0 > ka || (t.current = Rs[ka], Rs[ka] = null, ka--);
      }
      function T(t, e) {
        ka++, Rs[ka] = t.current, t.current = e;
      }
      function z(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (_g(t) / kg | 0) | 0;
      }
      function M(t) {
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
      function j(t, e, l) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, d = t.suspendedLanes, x = t.pingedLanes;
        t = t.warmLanes;
        var A = r & 134217727;
        return A !== 0 ? (r = A & ~d, r !== 0 ? c = M(r) : (x &= A, x !== 0 ? c = M(x) : l || (l = A & ~t, l !== 0 && (c = M(l))))) : (A = r & ~d, A !== 0 ? c = M(A) : x !== 0 ? c = M(x) : l || (l = r & ~t, l !== 0 && (c = M(l)))), c === 0 ? 0 : e !== 0 && e !== c && (e & d) === 0 && (d = c & -c, l = e & -e, d >= l || d === 32 && (l & 4194048) !== 0) ? e : c;
      }
      function O(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function B(t, e) {
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
      function W() {
        var t = vr;
        return vr <<= 1, (vr & 62914560) === 0 && (vr = 4194304), t;
      }
      function J(t) {
        for (var e = [], l = 0; 31 > l; l++) e.push(t);
        return e;
      }
      function D(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, l, r, c, d) {
        var x = t.pendingLanes;
        t.pendingLanes = l, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= l, t.entangledLanes &= l, t.errorRecoveryDisabledLanes &= l, t.shellSuspendCounter = 0;
        var A = t.entanglements, Y = t.expirationTimes, F = t.hiddenUpdates;
        for (l = x & ~l; 0 < l; ) {
          var nt = 31 - _e(l), P = 1 << nt;
          A[nt] = 0, Y[nt] = -1;
          var lt = F[nt];
          if (lt !== null)
            for (F[nt] = null, nt = 0; nt < lt.length; nt++) {
              var gt = lt[nt];
              gt !== null && (gt.lane &= -536870913);
            }
          l &= ~P;
        }
        r !== 0 && h(t, r, 0), d !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= d & ~(x & ~e));
      }
      function h(t, e, l) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - _e(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | l & 261930;
      }
      function _(t, e) {
        var l = t.entangledLanes |= e;
        for (t = t.entanglements; l; ) {
          var r = 31 - _e(l), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), l &= ~c;
        }
      }
      function k(t, e) {
        var l = e & -e;
        return l = (l & 42) !== 0 ? 1 : N(l), (l & (t.suspendedLanes | e)) !== 0 ? 0 : l;
      }
      function N(t) {
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
      function E(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function R(t) {
        if (typeof Tg == "function" && Mg(t), ke && typeof ke.setStrictMode == "function")
          try {
            ke.setStrictMode(cl, t);
          } catch {
          }
      }
      function Q(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function $(t) {
        if (Bs === void 0)
          try {
            throw Error();
          } catch (l) {
            var e = l.stack.trim().match(/\n( *(at )?)/);
            Bs = e && e[1] || "", Gd = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Bs + t + Gd;
      }
      function U(t, e) {
        if (!t || Us) return "";
        Us = !0;
        var l = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var r = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
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
                    } catch (gt) {
                      var lt = gt;
                    }
                    Reflect.construct(t, [], P);
                  } else {
                    try {
                      P.call();
                    } catch (gt) {
                      lt = gt;
                    }
                    t.call(P.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    lt = gt;
                  }
                  (P = t()) && typeof P.catch == "function" && P.catch(function() {
                  });
                }
              } catch (gt) {
                if (gt && lt && typeof gt.stack == "string")
                  return [gt.stack, lt.stack];
              }
              return [null, null];
            }
          };
          r.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var c = Object.getOwnPropertyDescriptor(
            r.DetermineComponentFrameRoot,
            "name"
          );
          c && c.configurable && Object.defineProperty(
            r.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var d = r.DetermineComponentFrameRoot(), x = d[0], A = d[1];
          if (x && A) {
            var Y = x.split(`
`), F = A.split(`
`);
            for (c = r = 0; r < Y.length && !Y[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < F.length && !F[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === Y.length || c === F.length)
              for (r = Y.length - 1, c = F.length - 1; 1 <= r && 0 <= c && Y[r] !== F[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (Y[r] !== F[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || Y[r] !== F[c]) {
                      var nt = `
` + Y[r].replace(" at new ", " at ");
                      return t.displayName && nt.includes("<anonymous>") && (nt = nt.replace("<anonymous>", t.displayName)), nt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          Us = !1, Error.prepareStackTrace = l;
        }
        return (l = t ? t.displayName || t.name : "") ? $(l) : "";
      }
      function V(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return $(t.type);
          case 16:
            return $("Lazy");
          case 13:
            return t.child !== e && e !== null ? $("Suspense Fallback") : $("Suspense");
          case 19:
            return $("SuspenseList");
          case 0:
          case 15:
            return U(t.type, !1);
          case 11:
            return U(t.type.render, !1);
          case 1:
            return U(t.type, !0);
          case 31:
            return $("Activity");
          default:
            return "";
        }
      }
      function I(t) {
        try {
          var e = "", l = null;
          do
            e += V(t, l), l = t, t = t.return;
          while (t);
          return e;
        } catch (r) {
          return `
Error generating stack: ` + r.message + `
` + r.stack;
        }
      }
      function L(t, e) {
        if (typeof t == "object" && t !== null) {
          var l = qd.get(t);
          return l !== void 0 ? l : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, qd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function K(t, e) {
        Ea[za++] = ul, Ea[za++] = xr, xr = t, ul = e;
      }
      function C(t, e, l) {
        Me[Ce++] = Ze, Me[Ce++] = Je, Me[Ce++] = zn, zn = t;
        var r = Ze;
        t = Je;
        var c = 32 - _e(r) - 1;
        r &= ~(1 << c), l += 1;
        var d = 32 - _e(e) + c;
        if (30 < d) {
          var x = c - c % 5;
          d = (r & (1 << x) - 1).toString(32), r >>= x, c -= x, Ze = 1 << 32 - _e(e) + c | l << c | r, Je = d + t;
        } else
          Ze = 1 << d | l << c | r, Je = t;
      }
      function Z(t) {
        t.return !== null && (K(t, 1), C(t, 1, 0));
      }
      function at(t) {
        for (; t === xr; )
          xr = Ea[--za], Ea[za] = null, ul = Ea[--za], Ea[za] = null;
        for (; t === zn; )
          zn = Me[--Ce], Me[Ce] = null, Je = Me[--Ce], Me[Ce] = null, Ze = Me[--Ce], Me[Ce] = null;
      }
      function ot(t, e) {
        Me[Ce++] = Ze, Me[Ce++] = Je, Me[Ce++] = zn, Ze = e.id, Je = e.overflow, zn = t;
      }
      function ct(t, e) {
        T(Nn, e), T(dl, t), T(ae, null), t = $p(e), S(ae), T(ae, t);
      }
      function ut() {
        S(ae), S(dl), S(Nn);
      }
      function Et(t) {
        t.memoizedState !== null && T(wr, t);
        var e = ae.current, l = Ip(e, t.type);
        e !== l && (T(dl, t), T(ae, l));
      }
      function $t(t) {
        dl.current === t && (S(ae), S(dl)), wr.current === t && (S(wr), rn ? ta._currentValue = wa : ta._currentValue2 = wa);
      }
      function ht(t) {
        var e = Error(
          o(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ka(L(e, t)), Gs;
      }
      function Vn(t, e) {
        if (!ue) throw Error(o(175));
        Ih(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Kn(t) {
        for (le = t.return; le; )
          switch (le.tag) {
            case 5:
            case 31:
            case 13:
              Ae = !1;
              return;
            case 27:
            case 3:
              Ae = !0;
              return;
            default:
              le = le.return;
          }
      }
      function De(t) {
        if (!ue || t !== le) return !1;
        if (!St) return Kn(t), St = !0, !1;
        var e = t.tag;
        if (Jt ? e !== 3 && e !== 27 && (e !== 5 || zd(t.type) && !hr(t.type, t.memoizedProps)) && Rt && ht(t) : e !== 3 && (e !== 5 || zd(t.type) && !hr(t.type, t.memoizedProps)) && Rt && ht(t), Kn(t), e === 13) {
          if (!ue) throw Error(o(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Rt = ag(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(317));
          Rt = ng(t);
        } else
          Rt = Jt && e === 27 ? Lh(
            t.type,
            Rt
          ) : le ? Ed(t.stateNode) : null;
        return !0;
      }
      function He() {
        ue && (Rt = le = null, St = !1);
      }
      function gn() {
        var t = Tn;
        return t !== null && (ve === null ? ve = t : ve.push.apply(
          ve,
          t
        ), Tn = null), t;
      }
      function Ka(t) {
        Tn === null ? Tn = [t] : Tn.push(t);
      }
      function bn(t, e, l) {
        rn ? (T(_r, e._currentValue), e._currentValue = l) : (T(_r, e._currentValue2), e._currentValue2 = l);
      }
      function Pe(t) {
        var e = _r.current;
        rn ? t._currentValue = e : t._currentValue2 = e, S(_r);
      }
      function xi(t, e, l) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === l) break;
          t = t.return;
        }
      }
      function wi(t, e, l, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var d = c.dependencies;
          if (d !== null) {
            var x = c.child;
            d = d.firstContext;
            t: for (; d !== null; ) {
              var A = d;
              d = c;
              for (var Y = 0; Y < e.length; Y++)
                if (A.context === e[Y]) {
                  d.lanes |= l, A = d.alternate, A !== null && (A.lanes |= l), xi(
                    d.return,
                    l,
                    t
                  ), r || (x = null);
                  break t;
                }
              d = A.next;
            }
          } else if (c.tag === 18) {
            if (x = c.return, x === null) throw Error(o(341));
            x.lanes |= l, d = x.alternate, d !== null && (d.lanes |= l), xi(x, l, t), x = null;
          } else x = c.child;
          if (x !== null) x.return = c;
          else
            for (x = c; x !== null; ) {
              if (x === t) {
                x = null;
                break;
              }
              if (c = x.sibling, c !== null) {
                c.return = x.return, x = c;
                break;
              }
              x = x.return;
            }
          c = x;
        }
      }
      function ma(t, e, l, r) {
        t = null;
        for (var c = e, d = !1; c !== null; ) {
          if (!d) {
            if ((c.flags & 524288) !== 0) d = !0;
            else if ((c.flags & 262144) !== 0) break;
          }
          if (c.tag === 10) {
            var x = c.alternate;
            if (x === null) throw Error(o(387));
            if (x = x.memoizedProps, x !== null) {
              var A = c.type;
              Se(c.pendingProps.value, x.value) || (t !== null ? t.push(A) : t = [A]);
            }
          } else if (c === wr.current) {
            if (x = c.alternate, x === null) throw Error(o(387));
            x.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(ta) : t = [ta]);
          }
          c = c.return;
        }
        t !== null && wi(
          e,
          t,
          l,
          r
        ), e.flags |= 262144;
      }
      function Ul(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!Se(
            rn ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Xn(t) {
        ea = t, on = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function ee(t) {
        return Po(ea, t);
      }
      function Gl(t, e) {
        return ea === null && Xn(t), Po(t, e);
      }
      function Po(t, e) {
        var l = rn ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: l, next: null }, on === null) {
          if (t === null) throw Error(o(308));
          on = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else on = on.next = e;
        return l;
      }
      function _i() {
        return {
          controller: new Ag(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Xa(t) {
        t.refCount--, t.refCount === 0 && jg(Og, function() {
          t.controller.abort();
        });
      }
      function ql() {
      }
      function Ve(t) {
        t !== Na && t.next === null && (Na === null ? kr = Na = t : Na = Na.next = t), Sr = !0, qs || (qs = !0, yp());
      }
      function pa(t, e) {
        if (!Ys && Sr) {
          Ys = !0;
          do
            for (var l = !1, r = kr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var d = 0;
                else {
                  var x = r.suspendedLanes, A = r.pingedLanes;
                  d = (1 << 31 - _e(42 | t) + 1) - 1, d &= c & ~(x & ~A), d = d & 201326741 ? d & 201326741 | 1 : d ? d | 2 : 0;
                }
                d !== 0 && (l = !0, lc(r, d));
              } else
                d = kt, d = j(
                  r,
                  r === At ? d : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Pn
                ), (d & 3) === 0 || O(r, d) || (l = !0, lc(r, d));
              r = r.next;
            }
          while (l);
          Ys = !1;
        }
      }
      function tc() {
        ec();
      }
      function ec() {
        Sr = qs = !1;
        var t = 0;
        na !== 0 && sh() && (t = na);
        for (var e = ge(), l = null, r = kr; r !== null; ) {
          var c = r.next, d = nc(r, e);
          d === 0 ? (r.next = null, l === null ? kr = c : l.next = c, c === null && (Na = l)) : (l = r, (t !== 0 || (d & 3) !== 0) && (Sr = !0)), r = c;
        }
        Wt !== 0 && Wt !== 5 || pa(t), na !== 0 && (na = 0);
      }
      function nc(t, e) {
        for (var l = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, d = t.pendingLanes & -62914561; 0 < d; ) {
          var x = 31 - _e(d), A = 1 << x, Y = c[x];
          Y === -1 ? ((A & l) === 0 || (A & r) !== 0) && (c[x] = B(A, e)) : Y <= e && (t.expiredLanes |= A), d &= ~A;
        }
        if (e = At, l = kt, l = j(
          t,
          t === e ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Pn
        ), r = t.callbackNode, l === 0 || t === e && (Mt === 2 || Mt === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && Ds(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((l & 3) === 0 || O(t, l)) {
          if (e = l & -l, e === t.callbackPriority) return e;
          switch (r !== null && Ds(r), E(l)) {
            case 2:
            case 8:
              l = zg;
              break;
            case 32:
              l = Hs;
              break;
            case 268435456:
              l = Ng;
              break;
            default:
              l = Hs;
          }
          return r = ac.bind(null, t), l = yr(l, r), t.callbackPriority = e, t.callbackNode = l, e;
        }
        return r !== null && r !== null && Ds(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function ac(t, e) {
        if (Wt !== 0 && Wt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var l = t.callbackNode;
        if (rl() && t.callbackNode !== l)
          return null;
        var r = kt;
        return r = j(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Pn
        ), r === 0 ? null : (qu(t, r, e), nc(t, ge()), t.callbackNode != null && t.callbackNode === l ? ac.bind(null, t) : null);
      }
      function lc(t, e) {
        if (rl()) return null;
        qu(t, e, !0);
      }
      function yp() {
        ph ? hh(function() {
          (wt & 6) !== 0 ? yr(
            Bd,
            tc
          ) : ec();
        }) : yr(
          Bd,
          tc
        );
      }
      function ki() {
        if (na === 0) {
          var t = Ta;
          t === 0 && (t = gr, gr <<= 1, (gr & 261888) === 0 && (gr = 256)), na = t;
        }
        return na;
      }
      function xp(t, e) {
        if (fl === null) {
          var l = fl = [];
          Ls = 0, Ta = ki(), Ma = {
            status: "pending",
            value: void 0,
            then: function(r) {
              l.push(r);
            }
          };
        }
        return Ls++, e.then(rc, rc), e;
      }
      function rc() {
        if (--Ls === 0 && fl !== null) {
          Ma !== null && (Ma.status = "fulfilled");
          var t = fl;
          fl = null, Ta = 0, Ma = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function wp(t, e) {
        var l = [], r = {
          status: "pending",
          value: null,
          reason: null,
          then: function(c) {
            l.push(c);
          }
        };
        return t.then(
          function() {
            r.status = "fulfilled", r.value = e;
            for (var c = 0; c < l.length; c++) (0, l[c])(e);
          },
          function(c) {
            for (r.status = "rejected", r.reason = c, c = 0; c < l.length; c++)
              (0, l[c])(void 0);
          }
        ), r;
      }
      function Si() {
        var t = aa.current;
        return t !== null ? t : At.pooledCache;
      }
      function Yl(t, e) {
        e === null ? T(aa, aa.current) : T(aa, e.pool);
      }
      function ic() {
        var t = Si();
        return t === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: t
        };
      }
      function Ll(t, e) {
        if (Se(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var l = Object.keys(t), r = Object.keys(e);
        if (l.length !== r.length) return !1;
        for (r = 0; r < l.length; r++) {
          var c = l[r];
          if (!Cg.call(e, c) || !Se(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function sc(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function oc(t, e, l) {
        switch (l = t[l], l === void 0 ? t.push(e) : l !== e && (e.then(ql, ql), e = l), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, uc(t), t;
          default:
            if (typeof e.status == "string") e.then(ql, ql);
            else {
              if (t = At, t !== null && 100 < t.shellSuspendCounter)
                throw Error(o(482));
              t = e, t.status = "pending", t.then(
                function(r) {
                  if (e.status === "pending") {
                    var c = e;
                    c.status = "fulfilled", c.value = r;
                  }
                },
                function(r) {
                  if (e.status === "pending") {
                    var c = e;
                    c.status = "rejected", c.reason = r;
                  }
                }
              );
            }
            switch (e.status) {
              case "fulfilled":
                return e.value;
              case "rejected":
                throw t = e.reason, uc(t), t;
            }
            throw la = e, Ca;
        }
      }
      function Zn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (la = l, Ca) : l;
        }
      }
      function cc() {
        if (la === null) throw Error(o(459));
        var t = la;
        return la = null, t;
      }
      function uc(t) {
        if (t === Ca || t === Er)
          throw Error(o(483));
      }
      function Ql(t) {
        var e = ml;
        return ml += 1, Aa === null && (Aa = []), oc(Aa, t, e);
      }
      function Za(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Vl(t, e) {
        throw e.$$typeof === Xp ? Error(o(525)) : (t = Object.prototype.toString.call(e), Error(
          o(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function dc(t) {
        function e(G, H) {
          if (t) {
            var q = G.deletions;
            q === null ? (G.deletions = [H], G.flags |= 16) : q.push(H);
          }
        }
        function l(G, H) {
          if (!t) return null;
          for (; H !== null; )
            e(G, H), H = H.sibling;
          return null;
        }
        function r(G) {
          for (var H = /* @__PURE__ */ new Map(); G !== null; )
            G.key !== null ? H.set(G.key, G) : H.set(G.index, G), G = G.sibling;
          return H;
        }
        function c(G, H) {
          return G = ln(G, H), G.index = 0, G.sibling = null, G;
        }
        function d(G, H, q) {
          return G.index = q, t ? (q = G.alternate, q !== null ? (q = q.index, q < H ? (G.flags |= 67108866, H) : q) : (G.flags |= 67108866, H)) : (G.flags |= 1048576, H);
        }
        function x(G) {
          return t && G.alternate === null && (G.flags |= 67108866), G;
        }
        function A(G, H, q, tt) {
          return H === null || H.tag !== 6 ? (H = ys(q, G.mode, tt), H.return = G, H) : (H = c(H, q), H.return = G, H);
        }
        function Y(G, H, q, tt) {
          var ft = q.type;
          return ft === xa ? nt(
            G,
            H,
            q.props.children,
            tt,
            q.key
          ) : H !== null && (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Zn(ft) === H.type) ? (H = c(H, q.props), Za(H, q), H.return = G, H) : (H = fr(
            q.type,
            q.key,
            q.props,
            null,
            G.mode,
            tt
          ), Za(H, q), H.return = G, H);
        }
        function F(G, H, q, tt) {
          return H === null || H.tag !== 4 || H.stateNode.containerInfo !== q.containerInfo || H.stateNode.implementation !== q.implementation ? (H = xs(q, G.mode, tt), H.return = G, H) : (H = c(H, q.children || []), H.return = G, H);
        }
        function nt(G, H, q, tt, ft) {
          return H === null || H.tag !== 7 ? (H = In(
            q,
            G.mode,
            tt,
            ft
          ), H.return = G, H) : (H = c(H, q), H.return = G, H);
        }
        function P(G, H, q) {
          if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
            return H = ys(
              "" + H,
              G.mode,
              q
            ), H.return = G, H;
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case mr:
                return q = fr(
                  H.type,
                  H.key,
                  H.props,
                  null,
                  G.mode,
                  q
                ), Za(q, H), q.return = G, q;
              case ya:
                return H = xs(
                  H,
                  G.mode,
                  q
                ), H.return = G, H;
              case En:
                return H = Zn(H), P(G, H, q);
            }
            if (pr(H) || w(H))
              return H = In(
                H,
                G.mode,
                q,
                null
              ), H.return = G, H;
            if (typeof H.then == "function")
              return P(G, Ql(H), q);
            if (H.$$typeof === Sn)
              return P(
                G,
                Gl(G, H),
                q
              );
            Vl(G, H);
          }
          return null;
        }
        function lt(G, H, q, tt) {
          var ft = H !== null ? H.key : null;
          if (typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint")
            return ft !== null ? null : A(G, H, "" + q, tt);
          if (typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case mr:
                return q.key === ft ? Y(G, H, q, tt) : null;
              case ya:
                return q.key === ft ? F(G, H, q, tt) : null;
              case En:
                return q = Zn(q), lt(G, H, q, tt);
            }
            if (pr(q) || w(q))
              return ft !== null ? null : nt(G, H, q, tt, null);
            if (typeof q.then == "function")
              return lt(
                G,
                H,
                Ql(q),
                tt
              );
            if (q.$$typeof === Sn)
              return lt(
                G,
                H,
                Gl(G, q),
                tt
              );
            Vl(G, q);
          }
          return null;
        }
        function gt(G, H, q, tt, ft) {
          if (typeof tt == "string" && tt !== "" || typeof tt == "number" || typeof tt == "bigint")
            return G = G.get(q) || null, A(H, G, "" + tt, ft);
          if (typeof tt == "object" && tt !== null) {
            switch (tt.$$typeof) {
              case mr:
                return G = G.get(
                  tt.key === null ? q : tt.key
                ) || null, Y(H, G, tt, ft);
              case ya:
                return G = G.get(
                  tt.key === null ? q : tt.key
                ) || null, F(H, G, tt, ft);
              case En:
                return tt = Zn(tt), gt(
                  G,
                  H,
                  q,
                  tt,
                  ft
                );
            }
            if (pr(tt) || w(tt))
              return G = G.get(q) || null, nt(H, G, tt, ft, null);
            if (typeof tt.then == "function")
              return gt(
                G,
                H,
                q,
                Ql(tt),
                ft
              );
            if (tt.$$typeof === Sn)
              return gt(
                G,
                H,
                q,
                Gl(H, tt),
                ft
              );
            Vl(H, tt);
          }
          return null;
        }
        function re(G, H, q, tt) {
          for (var ft = null, Ht = null, mt = H, Nt = H = 0, te = null; mt !== null && Nt < q.length; Nt++) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var Tt = lt(
              G,
              mt,
              q[Nt],
              tt
            );
            if (Tt === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && Tt.alternate === null && e(G, mt), H = d(Tt, H, Nt), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt, mt = te;
          }
          if (Nt === q.length)
            return l(G, mt), St && K(G, Nt), ft;
          if (mt === null) {
            for (; Nt < q.length; Nt++)
              mt = P(G, q[Nt], tt), mt !== null && (H = d(
                mt,
                H,
                Nt
              ), Ht === null ? ft = mt : Ht.sibling = mt, Ht = mt);
            return St && K(G, Nt), ft;
          }
          for (mt = r(mt); Nt < q.length; Nt++)
            te = gt(
              mt,
              G,
              Nt,
              q[Nt],
              tt
            ), te !== null && (t && te.alternate !== null && mt.delete(
              te.key === null ? Nt : te.key
            ), H = d(
              te,
              H,
              Nt
            ), Ht === null ? ft = te : Ht.sibling = te, Ht = te);
          return t && mt.forEach(function(Rn) {
            return e(G, Rn);
          }), St && K(G, Nt), ft;
        }
        function xl(G, H, q, tt) {
          if (q == null) throw Error(o(151));
          for (var ft = null, Ht = null, mt = H, Nt = H = 0, te = null, Tt = q.next(); mt !== null && !Tt.done; Nt++, Tt = q.next()) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var Rn = lt(G, mt, Tt.value, tt);
            if (Rn === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && Rn.alternate === null && e(G, mt), H = d(Rn, H, Nt), Ht === null ? ft = Rn : Ht.sibling = Rn, Ht = Rn, mt = te;
          }
          if (Tt.done)
            return l(G, mt), St && K(G, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = q.next())
              Tt = P(G, Tt.value, tt), Tt !== null && (H = d(
                Tt,
                H,
                Nt
              ), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt);
            return St && K(G, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = q.next())
            Tt = gt(
              mt,
              G,
              Nt,
              Tt.value,
              tt
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), H = d(Tt, H, Nt), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt);
          return t && mt.forEach(function(Bg) {
            return e(G, Bg);
          }), St && K(G, Nt), ft;
        }
        function oa(G, H, q, tt) {
          if (typeof q == "object" && q !== null && q.type === xa && q.key === null && (q = q.props.children), typeof q == "object" && q !== null) {
            switch (q.$$typeof) {
              case mr:
                t: {
                  for (var ft = q.key; H !== null; ) {
                    if (H.key === ft) {
                      if (ft = q.type, ft === xa) {
                        if (H.tag === 7) {
                          l(
                            G,
                            H.sibling
                          ), tt = c(
                            H,
                            q.props.children
                          ), tt.return = G, G = tt;
                          break t;
                        }
                      } else if (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Zn(ft) === H.type) {
                        l(
                          G,
                          H.sibling
                        ), tt = c(H, q.props), Za(tt, q), tt.return = G, G = tt;
                        break t;
                      }
                      l(G, H);
                      break;
                    } else e(G, H);
                    H = H.sibling;
                  }
                  q.type === xa ? (tt = In(
                    q.props.children,
                    G.mode,
                    tt,
                    q.key
                  ), tt.return = G, G = tt) : (tt = fr(
                    q.type,
                    q.key,
                    q.props,
                    null,
                    G.mode,
                    tt
                  ), Za(tt, q), tt.return = G, G = tt);
                }
                return x(G);
              case ya:
                t: {
                  for (ft = q.key; H !== null; ) {
                    if (H.key === ft)
                      if (H.tag === 4 && H.stateNode.containerInfo === q.containerInfo && H.stateNode.implementation === q.implementation) {
                        l(
                          G,
                          H.sibling
                        ), tt = c(
                          H,
                          q.children || []
                        ), tt.return = G, G = tt;
                        break t;
                      } else {
                        l(G, H);
                        break;
                      }
                    else e(G, H);
                    H = H.sibling;
                  }
                  tt = xs(q, G.mode, tt), tt.return = G, G = tt;
                }
                return x(G);
              case En:
                return q = Zn(q), oa(
                  G,
                  H,
                  q,
                  tt
                );
            }
            if (pr(q))
              return re(
                G,
                H,
                q,
                tt
              );
            if (w(q)) {
              if (ft = w(q), typeof ft != "function")
                throw Error(o(150));
              return q = ft.call(q), xl(
                G,
                H,
                q,
                tt
              );
            }
            if (typeof q.then == "function")
              return oa(
                G,
                H,
                Ql(q),
                tt
              );
            if (q.$$typeof === Sn)
              return oa(
                G,
                H,
                Gl(G, q),
                tt
              );
            Vl(G, q);
          }
          return typeof q == "string" && q !== "" || typeof q == "number" || typeof q == "bigint" ? (q = "" + q, H !== null && H.tag === 6 ? (l(G, H.sibling), tt = c(H, q), tt.return = G, G = tt) : (l(G, H), tt = ys(q, G.mode, tt), tt.return = G, G = tt), x(G)) : l(G, H);
        }
        return function(G, H, q, tt) {
          try {
            ml = 0;
            var ft = oa(
              G,
              H,
              q,
              tt
            );
            return Aa = null, ft;
          } catch (mt) {
            if (mt === Ca || mt === Er) throw mt;
            var Ht = i(29, mt, null, G.mode);
            return Ht.lanes = tt, Ht.return = G, Ht;
          } finally {
          }
        };
      }
      function Kl() {
        for (var t = ja, e = Vs = ja = 0; e < t; ) {
          var l = je[e];
          je[e++] = null;
          var r = je[e];
          je[e++] = null;
          var c = je[e];
          je[e++] = null;
          var d = je[e];
          if (je[e++] = null, r !== null && c !== null) {
            var x = r.pending;
            x === null ? c.next = c : (c.next = x.next, x.next = c), r.pending = c;
          }
          d !== 0 && fc(l, c, d);
        }
      }
      function Xl(t, e, l, r) {
        je[ja++] = t, je[ja++] = e, je[ja++] = l, je[ja++] = r, Vs |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function Ei(t, e, l, r) {
        return Xl(t, e, l, r), Zl(t);
      }
      function Jn(t, e) {
        return Xl(t, null, null, e), Zl(t);
      }
      function fc(t, e, l) {
        t.lanes |= l;
        var r = t.alternate;
        r !== null && (r.lanes |= l);
        for (var c = !1, d = t.return; d !== null; )
          d.childLanes |= l, r = d.alternate, r !== null && (r.childLanes |= l), d.tag === 22 && (t = d.stateNode, t === null || t._visibility & 1 || (c = !0)), t = d, d = d.return;
        return t.tag === 3 ? (d = t.stateNode, c && e !== null && (c = 31 - _e(l), t = d.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = l | 536870912), d) : null;
      }
      function Zl(t) {
        if (50 < yl)
          throw yl = 0, no = null, Error(o(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function zi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Ni(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function vn(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function yn(t, e, l) {
        var r = t.updateQueue;
        if (r === null) return null;
        if (r = r.shared, (wt & 2) !== 0) {
          var c = r.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Zl(t), fc(t, null, l), e;
        }
        return Xl(t, r, e, l), Zl(t);
      }
      function Ja(t, e, l) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (l & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, l |= r, e.lanes = l, _(t, l);
        }
      }
      function Ti(t, e) {
        var l = t.updateQueue, r = t.alternate;
        if (r !== null && (r = r.updateQueue, l === r)) {
          var c = null, d = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var x = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              d === null ? c = d = x : d = d.next = x, l = l.next;
            } while (l !== null);
            d === null ? c = d = e : d = d.next = e;
          } else c = d = e;
          l = {
            baseState: r.baseState,
            firstBaseUpdate: c,
            lastBaseUpdate: d,
            shared: r.shared,
            callbacks: r.callbacks
          }, t.updateQueue = l;
          return;
        }
        t = l.lastBaseUpdate, t === null ? l.firstBaseUpdate = e : t.next = e, l.lastBaseUpdate = e;
      }
      function Wa() {
        if (Ks) {
          var t = Ma;
          if (t !== null) throw t;
        }
      }
      function Fa(t, e, l, r) {
        Ks = !1;
        var c = t.updateQueue;
        Mn = !1;
        var d = c.firstBaseUpdate, x = c.lastBaseUpdate, A = c.shared.pending;
        if (A !== null) {
          c.shared.pending = null;
          var Y = A, F = Y.next;
          Y.next = null, x === null ? d = F : x.next = F, x = Y;
          var nt = t.alternate;
          nt !== null && (nt = nt.updateQueue, A = nt.lastBaseUpdate, A !== x && (A === null ? nt.firstBaseUpdate = F : A.next = F, nt.lastBaseUpdate = Y));
        }
        if (d !== null) {
          var P = c.baseState;
          x = 0, nt = F = Y = null, A = d;
          do {
            var lt = A.lane & -536870913, gt = lt !== A.lane;
            if (gt ? (kt & lt) === lt : (r & lt) === lt) {
              lt !== 0 && lt === Ta && (Ks = !0), nt !== null && (nt = nt.next = {
                lane: 0,
                tag: A.tag,
                payload: A.payload,
                callback: null,
                next: null
              });
              t: {
                var re = t, xl = A;
                lt = e;
                var oa = l;
                switch (xl.tag) {
                  case 1:
                    if (re = xl.payload, typeof re == "function") {
                      P = re.call(
                        oa,
                        P,
                        lt
                      );
                      break t;
                    }
                    P = re;
                    break t;
                  case 3:
                    re.flags = re.flags & -65537 | 128;
                  case 0:
                    if (re = xl.payload, lt = typeof re == "function" ? re.call(oa, P, lt) : re, lt == null) break t;
                    P = _s({}, P, lt);
                    break t;
                  case 2:
                    Mn = !0;
                }
              }
              lt = A.callback, lt !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [lt] : gt.push(lt));
            } else
              gt = {
                lane: lt,
                tag: A.tag,
                payload: A.payload,
                callback: A.callback,
                next: null
              }, nt === null ? (F = nt = gt, Y = P) : nt = nt.next = gt, x |= lt;
            if (A = A.next, A === null) {
              if (A = c.shared.pending, A === null)
                break;
              gt = A, A = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          nt === null && (Y = P), c.baseState = Y, c.firstBaseUpdate = F, c.lastBaseUpdate = nt, d === null && (c.shared.lanes = 0), An |= x, t.lanes = x, t.memoizedState = P;
        }
      }
      function mc(t, e) {
        if (typeof t != "function")
          throw Error(o(191, t));
        t.call(e);
      }
      function pc(t, e) {
        var l = t.callbacks;
        if (l !== null)
          for (t.callbacks = null, t = 0; t < l.length; t++)
            mc(l[t], e);
      }
      function hc(t, e) {
        t = dn, T(Nr, t), T(Oa, e), dn = t | e.baseLanes;
      }
      function Mi() {
        T(Nr, dn), T(Oa, Oa.current);
      }
      function Ci() {
        dn = Nr.current, S(Oa), S(Nr);
      }
      function xn(t) {
        var e = t.alternate;
        T(Yt, Yt.current & 1), T(Ee, t), Oe === null && (e === null || Oa.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function Ai(t) {
        T(Yt, Yt.current), T(Ee, t), Oe === null && (Oe = t);
      }
      function gc(t) {
        t.tag === 22 ? (T(Yt, Yt.current), T(Ee, t), Oe === null && (Oe = t)) : wn();
      }
      function wn() {
        T(Yt, Yt.current), T(Ee, Ee.current);
      }
      function ye(t) {
        S(Ee), Oe === t && (Oe = null), S(Yt);
      }
      function Jl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var l = e.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || As(l) || js(l)))
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
      function Ut() {
        throw Error(o(321));
      }
      function ji(t, e) {
        if (e === null) return !1;
        for (var l = 0; l < e.length && l < t.length; l++)
          if (!Se(t[l], e[l])) return !1;
        return !0;
      }
      function Oi(t, e, l, r, c, d) {
        return cn = d, vt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? Qd : Xs, ia = !1, d = l(r, c), ia = !1, Ra && (d = vc(
          e,
          l,
          r,
          c
        )), bc(t), d;
      }
      function bc(t) {
        dt.H = hl;
        var e = Ct !== null && Ct.next !== null;
        if (cn = 0, Qt = Ct = vt = null, Tr = !1, pl = 0, Da = null, e) throw Error(o(300));
        t === null || Vt || (t = t.dependencies, t !== null && Ul(t) && (Vt = !0));
      }
      function vc(t, e, l, r) {
        vt = t;
        var c = 0;
        do {
          if (Ra && (Da = null), pl = 0, Ra = !1, 25 <= c) throw Error(o(301));
          if (c += 1, Qt = Ct = null, t.updateQueue != null) {
            var d = t.updateQueue;
            d.lastEffect = null, d.events = null, d.stores = null, d.memoCache != null && (d.memoCache.index = 0);
          }
          dt.H = Vd, d = e(l, r);
        } while (Ra);
        return d;
      }
      function _p() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? $a(e) : e, t = t.useState()[0], (Ct !== null ? Ct.memoizedState : null) !== t && (vt.flags |= 1024), e;
      }
      function Ri() {
        var t = Mr !== 0;
        return Mr = 0, t;
      }
      function Di(t, e, l) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~l;
      }
      function Hi(t) {
        if (Tr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          Tr = !1;
        }
        cn = 0, Qt = Ct = vt = null, Ra = !1, pl = Mr = 0, Da = null;
      }
      function fe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Qt === null ? vt.memoizedState = Qt = t : Qt = Qt.next = t, Qt;
      }
      function qt() {
        if (Ct === null) {
          var t = vt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Ct.next;
        var e = Qt === null ? vt.memoizedState : Qt.next;
        if (e !== null)
          Qt = e, Ct = t;
        else {
          if (t === null)
            throw vt.alternate === null ? Error(o(467)) : Error(o(310));
          Ct = t, t = {
            memoizedState: Ct.memoizedState,
            baseState: Ct.baseState,
            baseQueue: Ct.baseQueue,
            queue: Ct.queue,
            next: null
          }, Qt === null ? vt.memoizedState = Qt = t : Qt = Qt.next = t;
        }
        return Qt;
      }
      function Wl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function $a(t) {
        var e = pl;
        return pl += 1, Da === null && (Da = []), t = oc(Da, t, e), e = vt, (Qt === null ? e.memoizedState : Qt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? Qd : Xs), t;
      }
      function Fl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return $a(t);
          if (t.$$typeof === Sn) return ee(t);
        }
        throw Error(o(438, String(t)));
      }
      function Bi(t) {
        var e = null, l = vt.updateQueue;
        if (l !== null && (e = l.memoCache), e == null) {
          var r = vt.alternate;
          r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (e = {
            data: r.data.map(function(c) {
              return c.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), l === null && (l = Wl(), vt.updateQueue = l), l.memoCache = e, l = e.data[e.index], l === void 0)
          for (l = e.data[e.index] = Array(t), r = 0; r < t; r++)
            l[r] = Zp;
        return e.index++, l;
      }
      function tn(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function $l(t) {
        var e = qt();
        return Ui(e, Ct, t);
      }
      function Ui(t, e, l) {
        var r = t.queue;
        if (r === null) throw Error(o(311));
        r.lastRenderedReducer = l;
        var c = t.baseQueue, d = r.pending;
        if (d !== null) {
          if (c !== null) {
            var x = c.next;
            c.next = d.next, d.next = x;
          }
          e.baseQueue = c = d, r.pending = null;
        }
        if (d = t.baseState, c === null) t.memoizedState = d;
        else {
          e = c.next;
          var A = x = null, Y = null, F = e, nt = !1;
          do {
            var P = F.lane & -536870913;
            if (P !== F.lane ? (kt & P) === P : (cn & P) === P) {
              var lt = F.revertLane;
              if (lt === 0)
                Y !== null && (Y = Y.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: F.action,
                  hasEagerState: F.hasEagerState,
                  eagerState: F.eagerState,
                  next: null
                }), P === Ta && (nt = !0);
              else if ((cn & lt) === lt) {
                F = F.next, lt === Ta && (nt = !0);
                continue;
              } else
                P = {
                  lane: 0,
                  revertLane: F.revertLane,
                  gesture: null,
                  action: F.action,
                  hasEagerState: F.hasEagerState,
                  eagerState: F.eagerState,
                  next: null
                }, Y === null ? (A = Y = P, x = d) : Y = Y.next = P, vt.lanes |= lt, An |= lt;
              P = F.action, ia && l(d, P), d = F.hasEagerState ? F.eagerState : l(d, P);
            } else
              lt = {
                lane: P,
                revertLane: F.revertLane,
                gesture: F.gesture,
                action: F.action,
                hasEagerState: F.hasEagerState,
                eagerState: F.eagerState,
                next: null
              }, Y === null ? (A = Y = lt, x = d) : Y = Y.next = lt, vt.lanes |= P, An |= P;
            F = F.next;
          } while (F !== null && F !== e);
          if (Y === null ? x = d : Y.next = A, !Se(d, t.memoizedState) && (Vt = !0, nt && (l = Ma, l !== null)))
            throw l;
          t.memoizedState = d, t.baseState = x, t.baseQueue = Y, r.lastRenderedState = d;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function Gi(t) {
        var e = qt(), l = e.queue;
        if (l === null) throw Error(o(311));
        l.lastRenderedReducer = t;
        var r = l.dispatch, c = l.pending, d = e.memoizedState;
        if (c !== null) {
          l.pending = null;
          var x = c = c.next;
          do
            d = t(d, x.action), x = x.next;
          while (x !== c);
          Se(d, e.memoizedState) || (Vt = !0), e.memoizedState = d, e.baseQueue === null && (e.baseState = d), l.lastRenderedState = d;
        }
        return [d, r];
      }
      function yc(t, e, l) {
        var r = vt, c = qt(), d = St;
        if (d) {
          if (l === void 0)
            throw Error(o(407));
          l = l();
        } else l = e();
        var x = !Se(
          (Ct || c).memoizedState,
          l
        );
        if (x && (c.memoizedState = l, Vt = !0), c = c.queue, Li(_c.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || x || Qt !== null && Qt.memoizedState.tag & 1) {
          if (r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            wc.bind(
              null,
              r,
              c,
              l,
              e
            ),
            null
          ), At === null) throw Error(o(349));
          d || (cn & 127) !== 0 || xc(r, e, l);
        }
        return l;
      }
      function xc(t, e, l) {
        t.flags |= 16384, t = { getSnapshot: e, value: l }, e = vt.updateQueue, e === null ? (e = Wl(), vt.updateQueue = e, e.stores = [t]) : (l = e.stores, l === null ? e.stores = [t] : l.push(t));
      }
      function wc(t, e, l, r) {
        e.value = l, e.getSnapshot = r, kc(e) && Sc(t);
      }
      function _c(t, e, l) {
        return l(function() {
          kc(e) && Sc(t);
        });
      }
      function kc(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var l = e();
          return !Se(t, l);
        } catch {
          return !0;
        }
      }
      function Sc(t) {
        var e = Jn(t, 2);
        e !== null && he(e, t, 2);
      }
      function qi(t) {
        var e = fe();
        if (typeof t == "function") {
          var l = t;
          if (t = l(), ia) {
            R(!0);
            try {
              l();
            } finally {
              R(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: tn,
          lastRenderedState: t
        }, e;
      }
      function Ec(t, e, l, r) {
        return t.baseState = l, Ui(
          t,
          Ct,
          typeof r == "function" ? r : tn
        );
      }
      function kp(t, e, l, r, c) {
        if (tr(t)) throw Error(o(485));
        if (t = e.action, t !== null) {
          var d = {
            payload: c,
            action: t,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(x) {
              d.listeners.push(x);
            }
          };
          dt.T !== null ? l(!0) : d.isTransition = !1, r(d), l = e.pending, l === null ? (d.next = e.pending = d, zc(e, d)) : (d.next = l.next, e.pending = l.next = d);
        }
      }
      function zc(t, e) {
        var l = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var d = dt.T, x = {};
          dt.T = x;
          try {
            var A = l(c, r), Y = dt.S;
            Y !== null && Y(x, A), Nc(t, e, A);
          } catch (F) {
            Yi(t, e, F);
          } finally {
            d !== null && x.types !== null && (d.types = x.types), dt.T = d;
          }
        } else
          try {
            d = l(c, r), Nc(t, e, d);
          } catch (F) {
            Yi(t, e, F);
          }
      }
      function Nc(t, e, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(r) {
            Tc(t, e, r);
          },
          function(r) {
            return Yi(t, e, r);
          }
        ) : Tc(t, e, l);
      }
      function Tc(t, e, l) {
        e.status = "fulfilled", e.value = l, Mc(e), t.state = l, e = t.pending, e !== null && (l = e.next, l === e ? t.pending = null : (l = l.next, e.next = l, zc(t, l)));
      }
      function Yi(t, e, l) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = l, Mc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function Mc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Cc(t, e) {
        return e;
      }
      function Ac(t, e) {
        if (St) {
          var l = At.formState;
          if (l !== null) {
            t: {
              var r = vt;
              if (St) {
                if (Rt) {
                  var c = qh(
                    Rt,
                    Ae
                  );
                  if (c) {
                    Rt = Ed(c), r = Yh(c);
                    break t;
                  }
                }
                ht(r);
              }
              r = !1;
            }
            r && (e = l[0]);
          }
        }
        l = fe(), l.memoizedState = l.baseState = e, r = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Cc,
          lastRenderedState: e
        }, l.queue = r, l = Wc.bind(
          null,
          vt,
          r
        ), r.dispatch = l, r = qi(!1);
        var d = Xi.bind(
          null,
          vt,
          !1,
          r.queue
        );
        return r = fe(), c = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, r.queue = c, l = kp.bind(
          null,
          vt,
          c,
          d,
          l
        ), c.dispatch = l, r.memoizedState = t, [e, l, !1];
      }
      function jc(t) {
        var e = qt();
        return Oc(e, Ct, t);
      }
      function Oc(t, e, l) {
        if (e = Ui(
          t,
          e,
          Cc
        )[0], t = $l(tn)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = $a(e);
          } catch (x) {
            throw x === Ca ? Er : x;
          }
        else r = e;
        e = qt();
        var c = e.queue, d = c.dispatch;
        return l !== e.memoizedState && (vt.flags |= 2048, ha(
          9,
          { destroy: void 0 },
          Sp.bind(null, c, l),
          null
        )), [r, d, t];
      }
      function Sp(t, e) {
        t.action = e;
      }
      function Rc(t) {
        var e = qt(), l = Ct;
        if (l !== null)
          return Oc(e, l, t);
        qt(), e = e.memoizedState, l = qt();
        var r = l.queue.dispatch;
        return l.memoizedState = t, [e, r, !1];
      }
      function ha(t, e, l, r) {
        return t = { tag: t, create: l, deps: r, inst: e, next: null }, e = vt.updateQueue, e === null && (e = Wl(), vt.updateQueue = e), l = e.lastEffect, l === null ? e.lastEffect = t.next = t : (r = l.next, l.next = t, t.next = r, e.lastEffect = t), t;
      }
      function Dc() {
        return qt().memoizedState;
      }
      function Il(t, e, l, r) {
        var c = fe();
        vt.flags |= t, c.memoizedState = ha(
          1 | e,
          { destroy: void 0 },
          l,
          r === void 0 ? null : r
        );
      }
      function Pl(t, e, l, r) {
        var c = qt();
        r = r === void 0 ? null : r;
        var d = c.memoizedState.inst;
        Ct !== null && r !== null && ji(r, Ct.memoizedState.deps) ? c.memoizedState = ha(e, d, l, r) : (vt.flags |= t, c.memoizedState = ha(
          1 | e,
          d,
          l,
          r
        ));
      }
      function Hc(t, e) {
        Il(8390656, 8, t, e);
      }
      function Li(t, e) {
        Pl(2048, 8, t, e);
      }
      function Ep(t) {
        vt.flags |= 4;
        var e = vt.updateQueue;
        if (e === null)
          e = Wl(), vt.updateQueue = e, e.events = [t];
        else {
          var l = e.events;
          l === null ? e.events = [t] : l.push(t);
        }
      }
      function Bc(t) {
        var e = qt().memoizedState;
        return Ep({ ref: e, nextImpl: t }), function() {
          if ((wt & 2) !== 0)
            throw Error(o(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Uc(t, e) {
        return Pl(4, 2, t, e);
      }
      function Gc(t, e) {
        return Pl(4, 4, t, e);
      }
      function qc(t, e) {
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
      function Yc(t, e, l) {
        l = l != null ? l.concat([t]) : null, Pl(
          4,
          4,
          qc.bind(null, e, t),
          l
        );
      }
      function Qi() {
      }
      function Lc(t, e) {
        var l = qt();
        e = e === void 0 ? null : e;
        var r = l.memoizedState;
        return e !== null && ji(e, r[1]) ? r[0] : (l.memoizedState = [t, e], t);
      }
      function Qc(t, e) {
        var l = qt();
        e = e === void 0 ? null : e;
        var r = l.memoizedState;
        if (e !== null && ji(e, r[1]))
          return r[0];
        if (r = t(), ia) {
          R(!0);
          try {
            t();
          } finally {
            R(!1);
          }
        }
        return l.memoizedState = [r, e], r;
      }
      function Vi(t, e, l) {
        return l === void 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = l, t = Gu(), vt.lanes |= t, An |= t, l);
      }
      function Vc(t, e, l, r) {
        return Se(l, e) ? l : Oa.current !== null ? (t = Vi(t, l, r), Se(t, e) || (Vt = !0), t) : (cn & 42) === 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? (Vt = !0, t.memoizedState = l) : (t = Gu(), vt.lanes |= t, An |= t, e);
      }
      function Kc(t, e, l, r, c) {
        var d = sn();
        It(
          d !== 0 && 8 > d ? d : 8
        );
        var x = dt.T, A = {};
        dt.T = A, Xi(t, !1, e, l);
        try {
          var Y = c(), F = dt.S;
          if (F !== null && F(A, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var nt = wp(
              Y,
              r
            );
            Ia(
              t,
              e,
              nt,
              xe(t)
            );
          } else
            Ia(
              t,
              e,
              r,
              xe(t)
            );
        } catch (P) {
          Ia(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: P },
            xe()
          );
        } finally {
          It(d), x !== null && A.types !== null && (x.types = A.types), dt.T = x;
        }
      }
      function Xc(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: wa,
          baseState: wa,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: tn,
            lastRenderedState: wa
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
            lastRenderedReducer: tn,
            lastRenderedState: l
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Ki() {
        return ee(ta);
      }
      function Zc() {
        return qt().memoizedState;
      }
      function Jc() {
        return qt().memoizedState;
      }
      function zp(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var l = xe();
              t = vn(l);
              var r = yn(e, t, l);
              r !== null && (he(r, e, l), Ja(r, e, l)), e = { cache: _i() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Np(t, e, l) {
        var r = xe();
        l = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, tr(t) ? Fc(e, l) : (l = Ei(t, e, l, r), l !== null && (he(l, t, r), $c(l, e, r)));
      }
      function Wc(t, e, l) {
        var r = xe();
        Ia(t, e, l, r);
      }
      function Ia(t, e, l, r) {
        var c = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (tr(t)) Fc(e, c);
        else {
          var d = t.alternate;
          if (t.lanes === 0 && (d === null || d.lanes === 0) && (d = e.lastRenderedReducer, d !== null))
            try {
              var x = e.lastRenderedState, A = d(x, l);
              if (c.hasEagerState = !0, c.eagerState = A, Se(A, x))
                return Xl(t, e, c, 0), At === null && Kl(), !1;
            } catch {
            } finally {
            }
          if (l = Ei(t, e, c, r), l !== null)
            return he(l, t, r), $c(l, e, r), !0;
        }
        return !1;
      }
      function Xi(t, e, l, r) {
        if (r = {
          lane: 2,
          revertLane: ki(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, tr(t)) {
          if (e) throw Error(o(479));
        } else
          e = Ei(
            t,
            l,
            r,
            2
          ), e !== null && he(e, t, 2);
      }
      function tr(t) {
        var e = t.alternate;
        return t === vt || e !== null && e === vt;
      }
      function Fc(t, e) {
        Ra = Tr = !0;
        var l = t.pending;
        l === null ? e.next = e : (e.next = l.next, l.next = e), t.pending = e;
      }
      function $c(t, e, l) {
        if ((l & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, l |= r, e.lanes = l, _(t, l);
        }
      }
      function Zi(t, e, l, r) {
        e = t.memoizedState, l = l(r, e), l = l == null ? e : _s({}, e, l), t.memoizedState = l, t.lanes === 0 && (t.updateQueue.baseState = l);
      }
      function Ic(t, e, l, r, c, d, x) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, d, x) : e.prototype && e.prototype.isPureReactComponent ? !Ll(l, r) || !Ll(c, d) : !0;
      }
      function Pc(t, e, l, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(l, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(l, r), e.state !== t && Zs.enqueueReplaceState(e, e.state, null);
      }
      function Wn(t, e) {
        var l = e;
        if ("ref" in e) {
          l = {};
          for (var r in e)
            r !== "ref" && (l[r] = e[r]);
        }
        if (t = t.defaultProps) {
          l === e && (l = _s({}, l));
          for (var c in t)
            l[c] === void 0 && (l[c] = t[c]);
        }
        return l;
      }
      function er(t, e) {
        try {
          var l = t.onUncaughtError;
          l(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function tu(t, e, l) {
        try {
          var r = t.onCaughtError;
          r(l.value, {
            componentStack: l.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      function Ji(t, e, l) {
        return l = vn(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          er(t, e);
        }, l;
      }
      function eu(t) {
        return t = vn(t), t.tag = 3, t;
      }
      function nu(t, e, l, r) {
        var c = l.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var d = r.value;
          t.payload = function() {
            return c(d);
          }, t.callback = function() {
            tu(e, l, r);
          };
        }
        var x = l.stateNode;
        x !== null && typeof x.componentDidCatch == "function" && (t.callback = function() {
          tu(e, l, r), typeof c != "function" && (jn === null ? jn = /* @__PURE__ */ new Set([this]) : jn.add(this));
          var A = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: A !== null ? A : ""
          });
        });
      }
      function Tp(t, e, l, r, c) {
        if (l.flags |= 32768, r !== null && typeof r == "object" && typeof r.then == "function") {
          if (e = l.alternate, e !== null && ma(
            e,
            l,
            c,
            !0
          ), l = Ee.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return Oe === null ? ur() : l.alternate === null && Gt === 0 && (Gt = 3), l.flags &= -257, l.flags |= 65536, l.lanes = c, r === zr ? l.flags |= 16384 : (e = l.updateQueue, e === null ? l.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), bs(t, r, c)), !1;
              case 22:
                return l.flags |= 65536, r === zr ? l.flags |= 16384 : (e = l.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, l.updateQueue = e) : (l = e.retryQueue, l === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : l.add(r)), bs(t, r, c)), !1;
            }
            throw Error(o(435, l.tag));
          }
          return bs(t, r, c), ur(), !1;
        }
        if (St)
          return e = Ee.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== Gs && (t = Error(o(422), { cause: r }), Ka(
            L(t, l)
          ))) : (r !== Gs && (e = Error(o(423), {
            cause: r
          }), Ka(
            L(e, l)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = L(r, l), c = Ji(
            t.stateNode,
            r,
            c
          ), Ti(t, c), Gt !== 4 && (Gt = 2)), !1;
        var d = Error(o(520), { cause: r });
        if (d = L(d, l), bl === null ? bl = [d] : bl.push(d), Gt !== 4 && (Gt = 2), e === null) return !0;
        r = L(r, l), l = e;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, t = c & -c, l.lanes |= t, t = Ji(l.stateNode, r, t), Ti(l, t), !1;
            case 1:
              if (e = l.type, d = l.stateNode, (l.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || d !== null && typeof d.componentDidCatch == "function" && (jn === null || !jn.has(
                d
              ))))
                return l.flags |= 65536, c &= -c, l.lanes |= c, c = eu(c), nu(
                  c,
                  t,
                  l,
                  r
                ), Ti(l, c), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function ne(t, e, l, r) {
        e.child = t === null ? Ld(e, null, l, r) : ra(
          e,
          t.child,
          l,
          r
        );
      }
      function au(t, e, l, r, c) {
        l = l.render;
        var d = e.ref;
        if ("ref" in r) {
          var x = {};
          for (var A in r)
            A !== "ref" && (x[A] = r[A]);
        } else x = r;
        return Xn(e), r = Oi(
          t,
          e,
          l,
          x,
          d,
          c
        ), A = Ri(), t !== null && !Vt ? (Di(t, e, c), en(t, e, c)) : (St && A && Z(e), e.flags |= 1, ne(t, e, r, c), e.child);
      }
      function lu(t, e, l, r, c) {
        if (t === null) {
          var d = l.type;
          return typeof d == "function" && !vs(d) && d.defaultProps === void 0 && l.compare === null ? (e.tag = 15, e.type = d, ru(
            t,
            e,
            d,
            r,
            c
          )) : (t = fr(
            l.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (d = t.child, !es(t, c)) {
          var x = d.memoizedProps;
          if (l = l.compare, l = l !== null ? l : Ll, l(x, r) && t.ref === e.ref)
            return en(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = ln(d, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function ru(t, e, l, r, c) {
        if (t !== null) {
          var d = t.memoizedProps;
          if (Ll(d, r) && t.ref === e.ref)
            if (Vt = !1, e.pendingProps = r = d, es(t, c))
              (t.flags & 131072) !== 0 && (Vt = !0);
            else
              return e.lanes = t.lanes, en(t, e, c);
        }
        return Wi(
          t,
          e,
          l,
          r,
          c
        );
      }
      function iu(t, e, l, r) {
        var c = r.children, d = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), r.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (d = d !== null ? d.baseLanes | l : l, t !== null) {
              for (r = e.child = t.child, c = 0; r !== null; )
                c = c | r.lanes | r.childLanes, r = r.sibling;
              r = c & ~d;
            } else r = 0, e.child = null;
            return su(
              t,
              e,
              d,
              l,
              r
            );
          }
          if ((l & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Yl(
              e,
              d !== null ? d.cachePool : null
            ), d !== null ? hc(e, d) : Mi(), gc(e);
          else
            return r = e.lanes = 536870912, su(
              t,
              e,
              d !== null ? d.baseLanes | l : l,
              l,
              r
            );
        } else
          d !== null ? (Yl(e, d.cachePool), hc(e, d), wn(), e.memoizedState = null) : (t !== null && Yl(e, null), Mi(), wn());
        return ne(t, e, c, l), e.child;
      }
      function Pa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function su(t, e, l, r, c) {
        var d = Si();
        return d = d === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: d
        }, e.memoizedState = {
          baseLanes: l,
          cachePool: d
        }, t !== null && Yl(e, null), Mi(), gc(e), t !== null && ma(t, e, r, !0), e.childLanes = c, null;
      }
      function nr(t, e) {
        return e = lr(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function ou(t, e, l) {
        return ra(e, t.child, null, l), t = nr(
          e,
          e.pendingProps
        ), t.flags |= 2, ye(e), e.memoizedState = null, t;
      }
      function Mp(t, e, l) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = nr(e, r), e.lanes = 536870912, Pa(null, t);
            if (Ai(e), (t = Rt) ? (t = Fh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = rd(t), l.return = e, e.child = l, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return nr(e, r);
        }
        var d = t.memoizedState;
        if (d !== null) {
          var x = d.dehydrated;
          if (Ai(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = ou(
                t,
                e,
                l
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(o(558));
          else if (Vt || ma(
            t,
            e,
            l,
            !1
          ), c = (l & t.childLanes) !== 0, Vt || c) {
            if (r = At, r !== null && (x = k(r, l), x !== 0 && x !== d.retryLane))
              throw d.retryLane = x, Jn(t, x), he(r, t, x), Js;
            ur(), e = ou(
              t,
              e,
              l
            );
          } else
            t = d.treeContext, ue && (Rt = Kh(x), le = e, St = !0, Tn = null, Ae = !1, t !== null && ot(e, t)), e = nr(e, r), e.flags |= 4096;
          return e;
        }
        return t = ln(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function ar(t, e) {
        var l = e.ref;
        if (l === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(o(284));
          (t === null || t.ref !== l) && (e.flags |= 4194816);
        }
      }
      function Wi(t, e, l, r, c) {
        return Xn(e), l = Oi(
          t,
          e,
          l,
          r,
          void 0,
          c
        ), r = Ri(), t !== null && !Vt ? (Di(t, e, c), en(t, e, c)) : (St && r && Z(e), e.flags |= 1, ne(t, e, l, c), e.child);
      }
      function cu(t, e, l, r, c, d) {
        return Xn(e), e.updateQueue = null, l = vc(
          e,
          r,
          l,
          c
        ), bc(t), r = Ri(), t !== null && !Vt ? (Di(t, e, d), en(t, e, d)) : (St && r && Z(e), e.flags |= 1, ne(t, e, l, d), e.child);
      }
      function uu(t, e, l, r, c) {
        if (Xn(e), e.stateNode === null) {
          var d = Sa, x = l.contextType;
          typeof x == "object" && x !== null && (d = ee(x)), d = new l(r, d), e.memoizedState = d.state !== null && d.state !== void 0 ? d.state : null, d.updater = Zs, e.stateNode = d, d._reactInternals = e, d = e.stateNode, d.props = r, d.state = e.memoizedState, d.refs = {}, zi(e), x = l.contextType, d.context = typeof x == "object" && x !== null ? ee(x) : Sa, d.state = e.memoizedState, x = l.getDerivedStateFromProps, typeof x == "function" && (Zi(
            e,
            l,
            x,
            r
          ), d.state = e.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof d.getSnapshotBeforeUpdate == "function" || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (x = d.state, typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount(), x !== d.state && Zs.enqueueReplaceState(
            d,
            d.state,
            null
          ), Fa(e, r, d, c), Wa(), d.state = e.memoizedState), typeof d.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          d = e.stateNode;
          var A = e.memoizedProps, Y = Wn(l, A);
          d.props = Y;
          var F = d.context, nt = l.contextType;
          x = Sa, typeof nt == "object" && nt !== null && (x = ee(nt));
          var P = l.getDerivedStateFromProps;
          nt = typeof P == "function" || typeof d.getSnapshotBeforeUpdate == "function", A = e.pendingProps !== A, nt || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (A || F !== x) && Pc(
            e,
            d,
            r,
            x
          ), Mn = !1;
          var lt = e.memoizedState;
          d.state = lt, Fa(e, r, d, c), Wa(), F = e.memoizedState, A || lt !== F || Mn ? (typeof P == "function" && (Zi(
            e,
            l,
            P,
            r
          ), F = e.memoizedState), (Y = Mn || Ic(
            e,
            l,
            Y,
            r,
            lt,
            F,
            x
          )) ? (nt || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount()), typeof d.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = F), d.props = r, d.state = F, d.context = x, r = Y) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          d = e.stateNode, Ni(t, e), x = e.memoizedProps, nt = Wn(l, x), d.props = nt, P = e.pendingProps, lt = d.context, F = l.contextType, Y = Sa, typeof F == "object" && F !== null && (Y = ee(F)), A = l.getDerivedStateFromProps, (F = typeof A == "function" || typeof d.getSnapshotBeforeUpdate == "function") || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (x !== P || lt !== Y) && Pc(
            e,
            d,
            r,
            Y
          ), Mn = !1, lt = e.memoizedState, d.state = lt, Fa(e, r, d, c), Wa();
          var gt = e.memoizedState;
          x !== P || lt !== gt || Mn || t !== null && t.dependencies !== null && Ul(t.dependencies) ? (typeof A == "function" && (Zi(
            e,
            l,
            A,
            r
          ), gt = e.memoizedState), (nt = Mn || Ic(
            e,
            l,
            nt,
            r,
            lt,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && Ul(t.dependencies)) ? (F || typeof d.UNSAFE_componentWillUpdate != "function" && typeof d.componentWillUpdate != "function" || (typeof d.componentWillUpdate == "function" && d.componentWillUpdate(r, gt, Y), typeof d.UNSAFE_componentWillUpdate == "function" && d.UNSAFE_componentWillUpdate(
            r,
            gt,
            Y
          )), typeof d.componentDidUpdate == "function" && (e.flags |= 4), typeof d.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof d.componentDidUpdate != "function" || x === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || x === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), d.props = r, d.state = gt, d.context = Y, r = nt) : (typeof d.componentDidUpdate != "function" || x === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || x === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return d = r, ar(t, e), r = (e.flags & 128) !== 0, d || r ? (d = e.stateNode, l = r && typeof l.getDerivedStateFromError != "function" ? null : d.render(), e.flags |= 1, t !== null && r ? (e.child = ra(
          e,
          t.child,
          null,
          c
        ), e.child = ra(
          e,
          null,
          l,
          c
        )) : ne(t, e, l, c), e.memoizedState = d.state, t = e.child) : t = en(
          t,
          e,
          c
        ), t;
      }
      function du(t, e, l, r) {
        return He(), e.flags |= 256, ne(t, e, l, r), e.child;
      }
      function Fi(t) {
        return { baseLanes: t, cachePool: ic() };
      }
      function $i(t, e, l) {
        return t = t !== null ? t.childLanes & ~l : 0, e && (t |= Ne), t;
      }
      function fu(t, e, l) {
        var r = e.pendingProps, c = !1, d = (e.flags & 128) !== 0, x;
        if ((x = d) || (x = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), x && (c = !0, e.flags &= -129), x = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? xn(e) : wn(), (t = Rt) ? (t = $h(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = rd(t), l.return = e, e.child = l, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return js(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var A = r.children;
          return r = r.fallback, c ? (wn(), c = e.mode, A = lr(
            { mode: "hidden", children: A },
            c
          ), r = In(
            r,
            c,
            l,
            null
          ), A.return = e, r.return = e, A.sibling = r, e.child = A, r = e.child, r.memoizedState = Fi(l), r.childLanes = $i(
            t,
            x,
            l
          ), e.memoizedState = Ws, Pa(null, r)) : (xn(e), Ii(e, A));
        }
        var Y = t.memoizedState;
        if (Y !== null && (A = Y.dehydrated, A !== null)) {
          if (d)
            e.flags & 256 ? (xn(e), e.flags &= -257, e = Pi(
              t,
              e,
              l
            )) : e.memoizedState !== null ? (wn(), e.child = t.child, e.flags |= 128, e = null) : (wn(), A = r.fallback, c = e.mode, r = lr(
              { mode: "visible", children: r.children },
              c
            ), A = In(
              A,
              c,
              l,
              null
            ), A.flags |= 2, r.return = e, A.return = e, r.sibling = A, e.child = r, ra(
              e,
              t.child,
              null,
              l
            ), r = e.child, r.memoizedState = Fi(l), r.childLanes = $i(
              t,
              x,
              l
            ), e.memoizedState = Ws, e = Pa(null, r));
          else if (xn(e), js(A))
            x = Uh(A).digest, r = Error(o(419)), r.stack = "", r.digest = x, Ka({ value: r, source: null, stack: null }), e = Pi(
              t,
              e,
              l
            );
          else if (Vt || ma(
            t,
            e,
            l,
            !1
          ), x = (l & t.childLanes) !== 0, Vt || x) {
            if (x = At, x !== null && (r = k(
              x,
              l
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Jn(t, r), he(x, t, r), Js;
            As(A) || ur(), e = Pi(
              t,
              e,
              l
            );
          } else
            As(A) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, ue && (Rt = Xh(
              A
            ), le = e, St = !0, Tn = null, Ae = !1, t !== null && ot(e, t)), e = Ii(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (wn(), A = r.fallback, c = e.mode, Y = t.child, d = Y.sibling, r = ln(Y, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = Y.subtreeFlags & 65011712, d !== null ? A = ln(
          d,
          A
        ) : (A = In(
          A,
          c,
          l,
          null
        ), A.flags |= 2), A.return = e, r.return = e, r.sibling = A, e.child = r, Pa(null, r), r = e.child, A = t.child.memoizedState, A === null ? A = Fi(l) : (c = A.cachePool, c !== null ? (Y = rn ? Dt._currentValue : Dt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = ic(), A = {
          baseLanes: A.baseLanes | l,
          cachePool: c
        }), r.memoizedState = A, r.childLanes = $i(
          t,
          x,
          l
        ), e.memoizedState = Ws, Pa(t.child, r)) : (xn(e), l = t.child, t = l.sibling, l = ln(l, {
          mode: "visible",
          children: r.children
        }), l.return = e, l.sibling = null, t !== null && (x = e.deletions, x === null ? (e.deletions = [t], e.flags |= 16) : x.push(t)), e.child = l, e.memoizedState = null, l);
      }
      function Ii(t, e) {
        return e = lr(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function lr(t, e) {
        return t = i(22, t, null, e), t.lanes = 0, t;
      }
      function Pi(t, e, l) {
        return ra(e, t.child, null, l), t = Ii(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function mu(t, e, l) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), xi(t.return, e, l);
      }
      function ts(t, e, l, r, c, d) {
        var x = t.memoizedState;
        x === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: r,
          tail: l,
          tailMode: c,
          treeForkCount: d
        } : (x.isBackwards = e, x.rendering = null, x.renderingStartTime = 0, x.last = r, x.tail = l, x.tailMode = c, x.treeForkCount = d);
      }
      function pu(t, e, l) {
        var r = e.pendingProps, c = r.revealOrder, d = r.tail;
        r = r.children;
        var x = Yt.current, A = (x & 2) !== 0;
        if (A ? (x = x & 1 | 2, e.flags |= 128) : x &= 1, T(Yt, x), ne(t, e, r, l), r = St ? ul : 0, !A && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && mu(t, l, e);
            else if (t.tag === 19)
              mu(t, l, e);
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
        switch (c) {
          case "forwards":
            for (l = e.child, c = null; l !== null; )
              t = l.alternate, t !== null && Jl(t) === null && (c = l), l = l.sibling;
            l = c, l === null ? (c = e.child, e.child = null) : (c = l.sibling, l.sibling = null), ts(
              e,
              !1,
              c,
              l,
              d,
              r
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (l = null, c = e.child, e.child = null; c !== null; ) {
              if (t = c.alternate, t !== null && Jl(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = l, l = c, c = t;
            }
            ts(
              e,
              !0,
              l,
              null,
              d,
              r
            );
            break;
          case "together":
            ts(
              e,
              !1,
              null,
              null,
              void 0,
              r
            );
            break;
          default:
            e.memoizedState = null;
        }
        return e.child;
      }
      function en(t, e, l) {
        if (t !== null && (e.dependencies = t.dependencies), An |= e.lanes, (l & e.childLanes) === 0)
          if (t !== null) {
            if (ma(
              t,
              e,
              l,
              !1
            ), (l & e.childLanes) === 0)
              return null;
          } else return null;
        if (t !== null && e.child !== t.child)
          throw Error(o(153));
        if (e.child !== null) {
          for (t = e.child, l = ln(t, t.pendingProps), e.child = l, l.return = e; t.sibling !== null; )
            t = t.sibling, l = l.sibling = ln(t, t.pendingProps), l.return = e;
          l.sibling = null;
        }
        return e.child;
      }
      function es(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Ul(t)));
      }
      function Cp(t, e, l) {
        switch (e.tag) {
          case 3:
            ct(
              e,
              e.stateNode.containerInfo
            ), bn(e, Dt, t.memoizedState.cache), He();
            break;
          case 27:
          case 5:
            Et(e);
            break;
          case 4:
            ct(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            bn(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, Ai(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (xn(e), e.flags |= 128, null) : (l & e.child.childLanes) !== 0 ? fu(
                t,
                e,
                l
              ) : (xn(e), t = en(
                t,
                e,
                l
              ), t !== null ? t.sibling : null);
            xn(e);
            break;
          case 19:
            var c = (t.flags & 128) !== 0;
            if (r = (l & e.childLanes) !== 0, r || (ma(
              t,
              e,
              l,
              !1
            ), r = (l & e.childLanes) !== 0), c) {
              if (r)
                return pu(
                  t,
                  e,
                  l
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), T(Yt, Yt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, iu(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            bn(e, Dt, t.memoizedState.cache);
        }
        return en(t, e, l);
      }
      function hu(t, e, l) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Vt = !0;
          else {
            if (!es(t, l) && (e.flags & 128) === 0)
              return Vt = !1, Cp(
                t,
                e,
                l
              );
            Vt = (t.flags & 131072) !== 0;
          }
        else
          Vt = !1, St && (e.flags & 1048576) !== 0 && C(e, ul, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Zn(e.elementType), e.type = t, typeof t == "function")
                vs(t) ? (r = Wn(t, r), e.tag = 1, e = uu(
                  null,
                  e,
                  t,
                  r,
                  l
                )) : (e.tag = 0, e = Wi(
                  null,
                  e,
                  t,
                  r,
                  l
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === Ss) {
                    e.tag = 11, e = au(
                      null,
                      e,
                      t,
                      r,
                      l
                    );
                    break t;
                  } else if (c === Ns) {
                    e.tag = 14, e = lu(
                      null,
                      e,
                      t,
                      r,
                      l
                    );
                    break t;
                  }
                }
                throw e = y(t) || t, Error(o(306, e, ""));
              }
            }
            return e;
          case 0:
            return Wi(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 1:
            return r = e.type, c = Wn(
              r,
              e.pendingProps
            ), uu(
              t,
              e,
              r,
              c,
              l
            );
          case 3:
            t: {
              if (ct(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(o(387));
              var d = e.pendingProps;
              c = e.memoizedState, r = c.element, Ni(t, e), Fa(e, d, null, l);
              var x = e.memoizedState;
              if (d = x.cache, bn(e, Dt, d), d !== c.cache && wi(
                e,
                [Dt],
                l,
                !0
              ), Wa(), d = x.element, ue && c.isDehydrated)
                if (c = {
                  element: d,
                  isDehydrated: !1,
                  cache: x.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = du(
                    t,
                    e,
                    d,
                    l
                  );
                  break t;
                } else if (d !== r) {
                  r = L(
                    Error(o(424)),
                    e
                  ), Ka(r), e = du(
                    t,
                    e,
                    d,
                    l
                  );
                  break t;
                } else
                  for (ue && (Rt = Vh(
                    e.stateNode.containerInfo
                  ), le = e, St = !0, Tn = null, Ae = !0), l = Ld(
                    e,
                    null,
                    d,
                    l
                  ), e.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (He(), d === r) {
                  e = en(
                    t,
                    e,
                    l
                  );
                  break t;
                }
                ne(t, e, d, l);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (qe)
              return ar(t, e), t === null ? (l = Td(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = l : St || (e.stateNode = bg(
                e.type,
                e.pendingProps,
                Nn.current,
                e
              )) : e.memoizedState = Td(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Jt)
              return Et(e), t === null && Jt && St && (r = e.stateNode = Rd(
                e.type,
                e.pendingProps,
                Nn.current,
                ae.current,
                !1
              ), le = e, Ae = !0, Rt = Zh(
                e.type,
                r,
                Rt
              )), ne(
                t,
                e,
                e.pendingProps.children,
                l
              ), ar(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (pg(
              e.type,
              e.pendingProps,
              ae.current
            ), (c = r = Rt) && (r = Jh(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, le = e, Rt = Qh(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, d = e.pendingProps, x = t !== null ? t.memoizedProps : null, r = d.children, hr(c, d) ? r = null : x !== null && hr(c, x) && (e.flags |= 32), e.memoizedState !== null && (c = Oi(
              t,
              e,
              _p,
              null,
              null,
              l
            ), rn ? ta._currentValue = c : ta._currentValue2 = c), ar(t, e), ne(t, e, r, l), e.child;
          case 6:
            return t === null && St && (hg(
              e.pendingProps,
              ae.current
            ), (t = l = Rt) && (l = Wh(
              l,
              e.pendingProps,
              Ae
            ), l !== null ? (e.stateNode = l, le = e, Rt = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return fu(t, e, l);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = ra(
              e,
              null,
              r,
              l
            ) : ne(t, e, r, l), e.child;
          case 11:
            return au(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 7:
            return ne(
              t,
              e,
              e.pendingProps,
              l
            ), e.child;
          case 8:
            return ne(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 12:
            return ne(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 10:
            return r = e.pendingProps, bn(e, e.type, r.value), ne(
              t,
              e,
              r.children,
              l
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Xn(e), c = ee(c), r = r(c), e.flags |= 1, ne(t, e, r, l), e.child;
          case 14:
            return lu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 15:
            return ru(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 19:
            return pu(
              t,
              e,
              l
            );
          case 31:
            return Mp(t, e, l);
          case 22:
            return iu(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            return Xn(e), r = ee(Dt), t === null ? (c = Si(), c === null && (c = At, d = _i(), c.pooledCache = d, d.refCount++, d !== null && (c.pooledCacheLanes |= l), c = d), e.memoizedState = {
              parent: r,
              cache: c
            }, zi(e), bn(e, Dt, c)) : ((t.lanes & l) !== 0 && (Ni(t, e), Fa(e, null, null, l), Wa()), c = t.memoizedState, d = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), bn(e, Dt, r)) : (r = d.cache, bn(e, Dt, r), r !== c.cache && wi(
              e,
              [Dt],
              l,
              !0
            ))), ne(
              t,
              e,
              e.pendingProps.children,
              l
            ), e.child;
          case 29:
            throw e.pendingProps;
        }
        throw Error(o(156, e.tag));
      }
      function Be(t) {
        t.flags |= 4;
      }
      function rr(t) {
        Xe && (t.flags |= 8);
      }
      function gu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function ns(t, e, l, r) {
        if (ce)
          for (l = e.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              Ms(t, l.stateNode);
            else if (!(l.tag === 4 || Jt && l.tag === 27) && l.child !== null) {
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
        else if (Xe)
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var d = c.stateNode;
              l && r && (d = kd(
                d,
                c.type,
                c.memoizedProps
              )), Ms(t, d);
            } else if (c.tag === 6)
              d = c.stateNode, l && r && (d = Sd(
                d,
                c.memoizedProps
              )), Ms(t, d);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                d = c.child, d !== null && (d.return = c), ns(t, c, !0, !0);
              else if (c.child !== null) {
                c.child.return = c, c = c.child;
                continue;
              }
            }
            if (c === e) break;
            for (; c.sibling === null; ) {
              if (c.return === null || c.return === e)
                return;
              c = c.return;
            }
            c.sibling.return = c.return, c = c.sibling;
          }
      }
      function bu(t, e, l, r) {
        var c = !1;
        if (Xe)
          for (var d = e.child; d !== null; ) {
            if (d.tag === 5) {
              var x = d.stateNode;
              l && r && (x = kd(
                x,
                d.type,
                d.memoizedProps
              )), wd(t, x);
            } else if (d.tag === 6)
              x = d.stateNode, l && r && (x = Sd(
                x,
                d.memoizedProps
              )), wd(t, x);
            else if (d.tag !== 4) {
              if (d.tag === 22 && d.memoizedState !== null)
                c = d.child, c !== null && (c.return = d), bu(t, d, !0, !0), c = !0;
              else if (d.child !== null) {
                d.child.return = d, d = d.child;
                continue;
              }
            }
            if (d === e) break;
            for (; d.sibling === null; ) {
              if (d.return === null || d.return === e)
                return c;
              d = d.return;
            }
            d.sibling.return = d.return, d = d.sibling;
          }
        return c;
      }
      function vu(t, e) {
        if (Xe && gu(t, e)) {
          t = e.stateNode;
          var l = t.containerInfo, r = xd();
          bu(r, e, !1, !1), t.pendingChildren = r, Be(e), Bh(l, r);
        }
      }
      function as(t, e, l, r) {
        if (ce)
          t.memoizedProps !== r && Be(e);
        else if (Xe) {
          var c = t.stateNode, d = t.memoizedProps;
          if ((t = gu(t, e)) || d !== r) {
            var x = ae.current;
            d = Hh(
              c,
              l,
              d,
              r,
              !t,
              null
            ), d === c ? e.stateNode = c : (rr(e), hd(
              d,
              l,
              r,
              x
            ) && Be(e), e.stateNode = d, t && ns(d, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function ls(t, e, l, r, c) {
        if ((t.mode & 32) !== 0 && (l === null ? ch(e, r) : uh(e, l, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || Cs(e, r))
            if (bd(t.stateNode, e, r))
              t.flags |= 8192;
            else if (Vu()) t.flags |= 8192;
            else
              throw la = zr, Qs;
        } else t.flags &= -16777217;
      }
      function yu(t, e) {
        if (yg(e)) {
          if (t.flags |= 16777216, !Od(e))
            if (Vu()) t.flags |= 8192;
            else
              throw la = zr, Qs;
        } else t.flags &= -16777217;
      }
      function ir(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? W() : 536870912, t.lanes |= e, Ua |= e);
      }
      function tl(t, e) {
        if (!St)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var l = null; e !== null; )
                e.alternate !== null && (l = e), e = e.sibling;
              l === null ? t.tail = null : l.sibling = null;
              break;
            case "collapsed":
              l = t.tail;
              for (var r = null; l !== null; )
                l.alternate !== null && (r = l), l = l.sibling;
              r === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : r.sibling = null;
          }
      }
      function Ot(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, l = 0, r = 0;
        if (e)
          for (var c = t.child; c !== null; )
            l |= c.lanes | c.childLanes, r |= c.subtreeFlags & 65011712, r |= c.flags & 65011712, c.return = t, c = c.sibling;
        else
          for (c = t.child; c !== null; )
            l |= c.lanes | c.childLanes, r |= c.subtreeFlags, r |= c.flags, c.return = t, c = c.sibling;
        return t.subtreeFlags |= r, t.childLanes = l, e;
      }
      function Ap(t, e, l) {
        var r = e.pendingProps;
        switch (at(e), e.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return Ot(e), null;
          case 1:
            return Ot(e), null;
          case 3:
            return l = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Pe(Dt), ut(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (t === null || t.child === null) && (De(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, gn())), vu(t, e), Ot(e), null;
          case 26:
            if (qe) {
              var c = e.type, d = e.memoizedState;
              return t === null ? (Be(e), d !== null ? (Ot(e), yu(
                e,
                d
              )) : (Ot(e), ls(
                e,
                c,
                null,
                r,
                l
              ))) : d ? d !== t.memoizedState ? (Be(e), Ot(e), yu(
                e,
                d
              )) : (Ot(e), e.flags &= -16777217) : (d = t.memoizedProps, ce ? d !== r && Be(e) : as(
                t,
                e,
                c,
                r
              ), Ot(e), ls(
                e,
                c,
                d,
                r,
                l
              )), null;
            }
          case 27:
            if (Jt) {
              if ($t(e), l = Nn.current, c = e.type, t !== null && e.stateNode != null)
                ce ? t.memoizedProps !== r && Be(e) : as(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(o(166));
                  return Ot(e), null;
                }
                t = ae.current, De(e) ? Vn(e, t) : (t = Rd(
                  c,
                  r,
                  l,
                  t,
                  !0
                ), e.stateNode = t, Be(e));
              }
              return Ot(e), null;
            }
          case 5:
            if ($t(e), c = e.type, t !== null && e.stateNode != null)
              as(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(o(166));
                return Ot(e), null;
              }
              if (d = ae.current, De(e))
                Vn(e, d), og(
                  e.stateNode,
                  c,
                  r,
                  d
                ) && (e.flags |= 64);
              else {
                var x = eh(
                  c,
                  r,
                  Nn.current,
                  d,
                  e
                );
                rr(e), ns(x, e, !1, !1), e.stateNode = x, hd(
                  x,
                  c,
                  r,
                  d
                ) && Be(e);
              }
            }
            return Ot(e), ls(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              l
            ), null;
          case 6:
            if (t && e.stateNode != null)
              l = t.memoizedProps, ce ? l !== r && Be(e) : Xe && (l !== r ? (t = Nn.current, l = ae.current, rr(e), e.stateNode = gd(
                r,
                t,
                l,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(o(166));
              if (t = Nn.current, l = ae.current, De(e)) {
                if (!ue) throw Error(o(176));
                if (t = e.stateNode, l = e.memoizedProps, r = null, c = le, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                Ph(
                  t,
                  l,
                  e,
                  r
                ) || ht(e, !0);
              } else
                rr(e), e.stateNode = gd(
                  r,
                  t,
                  l,
                  e
                );
            }
            return Ot(e), null;
          case 31:
            if (l = e.memoizedState, t === null || t.memoizedState !== null) {
              if (r = De(e), l !== null) {
                if (t === null) {
                  if (!r) throw Error(o(318));
                  if (!ue) throw Error(o(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(o(557));
                  tg(t, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), t = !1;
              } else
                l = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = l), t = !0;
              if (!t)
                return e.flags & 256 ? (ye(e), e) : (ye(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(o(558));
            }
            return Ot(e), null;
          case 13:
            if (r = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = De(e), r !== null && r.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(o(318));
                  if (!ue) throw Error(o(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(o(317));
                  eg(c, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), c = !1;
              } else
                c = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ye(e), e) : (ye(e), null);
            }
            return ye(e), (e.flags & 128) !== 0 ? (e.lanes = l, e) : (l = r !== null, t = t !== null && t.memoizedState !== null, l && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), d = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (d = r.memoizedState.cachePool.pool), d !== c && (r.flags |= 2048)), l !== t && l && (e.child.flags |= 8192), ir(e, e.updateQueue), Ot(e), null);
          case 4:
            return ut(), vu(t, e), t === null && rh(e.stateNode.containerInfo), Ot(e), null;
          case 10:
            return Pe(e.type), Ot(e), null;
          case 19:
            if (S(Yt), r = e.memoizedState, r === null) return Ot(e), null;
            if (c = (e.flags & 128) !== 0, d = r.rendering, d === null)
              if (c) tl(r, !1);
              else {
                if (Gt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (d = Jl(t), d !== null) {
                      for (e.flags |= 128, tl(r, !1), t = d.updateQueue, e.updateQueue = t, ir(e, t), e.subtreeFlags = 0, t = l, l = e.child; l !== null; )
                        ld(l, t), l = l.sibling;
                      return T(
                        Yt,
                        Yt.current & 1 | 2
                      ), St && K(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && ge() > vl && (e.flags |= 128, c = !0, tl(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Jl(d), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, ir(e, t), tl(r, !0), r.tail === null && r.tailMode === "hidden" && !d.alternate && !St)
                    return Ot(e), null;
                } else
                  2 * ge() - r.renderingStartTime > vl && l !== 536870912 && (e.flags |= 128, c = !0, tl(r, !1), e.lanes = 4194304);
              r.isBackwards ? (d.sibling = e.child, e.child = d) : (t = r.last, t !== null ? t.sibling = d : e.child = d, r.last = d);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = ge(), t.sibling = null, l = Yt.current, T(
              Yt,
              c ? l & 1 | 2 : l & 1
            ), St && K(e, r.treeForkCount), t) : (Ot(e), null);
          case 22:
          case 23:
            return ye(e), Ci(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (l & 536870912) !== 0 && (e.flags & 128) === 0 && (Ot(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ot(e), l = e.updateQueue, l !== null && ir(e, l.retryQueue), l = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== l && (e.flags |= 2048), t !== null && S(aa), null;
          case 24:
            return l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Pe(Dt), Ot(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(o(156, e.tag));
      }
      function jp(t, e) {
        switch (at(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Pe(Dt), ut(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return $t(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (ye(e), e.alternate === null)
                throw Error(o(340));
              He();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (ye(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(o(340));
              He();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return S(Yt), null;
          case 4:
            return ut(), null;
          case 10:
            return Pe(e.type), null;
          case 22:
          case 23:
            return ye(e), Ci(), t !== null && S(aa), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Pe(Dt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function xu(t, e) {
        switch (at(e), e.tag) {
          case 3:
            Pe(Dt), ut();
            break;
          case 26:
          case 27:
          case 5:
            $t(e);
            break;
          case 4:
            ut();
            break;
          case 31:
            e.memoizedState !== null && ye(e);
            break;
          case 13:
            ye(e);
            break;
          case 19:
            S(Yt);
            break;
          case 10:
            Pe(e.type);
            break;
          case 22:
          case 23:
            ye(e), Ci(), t !== null && S(aa);
            break;
          case 24:
            Pe(Dt);
        }
      }
      function el(t, e) {
        try {
          var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
          if (r !== null) {
            var c = r.next;
            l = c;
            do {
              if ((l.tag & t) === t) {
                r = void 0;
                var d = l.create, x = l.inst;
                r = d(), x.destroy = r;
              }
              l = l.next;
            } while (l !== c);
          }
        } catch (A) {
          zt(e, e.return, A);
        }
      }
      function _n(t, e, l) {
        try {
          var r = e.updateQueue, c = r !== null ? r.lastEffect : null;
          if (c !== null) {
            var d = c.next;
            r = d;
            do {
              if ((r.tag & t) === t) {
                var x = r.inst, A = x.destroy;
                if (A !== void 0) {
                  x.destroy = void 0, c = e;
                  var Y = l, F = A;
                  try {
                    F();
                  } catch (nt) {
                    zt(
                      c,
                      Y,
                      nt
                    );
                  }
                }
              }
              r = r.next;
            } while (r !== d);
          }
        } catch (nt) {
          zt(e, e.return, nt);
        }
      }
      function wu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var l = t.stateNode;
          try {
            pc(e, l);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function _u(t, e, l) {
        l.props = Wn(
          t.type,
          t.memoizedProps
        ), l.state = t.memoizedState;
        try {
          l.componentWillUnmount();
        } catch (r) {
          zt(t, e, r);
        }
      }
      function nl(t, e) {
        try {
          var l = t.ref;
          if (l !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var r = il(t.stateNode);
                break;
              case 30:
                r = t.stateNode;
                break;
              default:
                r = t.stateNode;
            }
            typeof l == "function" ? t.refCleanup = l(r) : l.current = r;
          }
        } catch (c) {
          zt(t, e, c);
        }
      }
      function Ke(t, e) {
        var l = t.ref, r = t.refCleanup;
        if (l !== null)
          if (typeof r == "function")
            try {
              r();
            } catch (c) {
              zt(t, e, c);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof l == "function")
            try {
              l(null);
            } catch (c) {
              zt(t, e, c);
            }
          else l.current = null;
      }
      function ku(t) {
        var e = t.type, l = t.memoizedProps, r = t.stateNode;
        try {
          Eh(r, e, l, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function rs(t, e, l) {
        try {
          zh(
            t.stateNode,
            t.type,
            l,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function Su(t) {
        return t.tag === 5 || t.tag === 3 || (qe ? t.tag === 26 : !1) || (Jt ? t.tag === 27 && _a(t.type) : !1) || t.tag === 4;
      }
      function is(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Su(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Jt && t.tag === 27 && _a(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function ss(t, e, l) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Th(l, t, e) : kh(l, t);
        else if (r !== 4 && (Jt && r === 27 && _a(t.type) && (l = t.stateNode, e = null), t = t.child, t !== null))
          for (ss(t, e, l), t = t.sibling; t !== null; )
            ss(t, e, l), t = t.sibling;
      }
      function sr(t, e, l) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Nh(l, t, e) : _h(l, t);
        else if (r !== 4 && (Jt && r === 27 && _a(t.type) && (l = t.stateNode), t = t.child, t !== null))
          for (sr(t, e, l), t = t.sibling; t !== null; )
            sr(t, e, l), t = t.sibling;
      }
      function Eu(t, e, l) {
        t = t.containerInfo;
        try {
          _d(t, l);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function zu(t) {
        var e = t.stateNode, l = t.memoizedProps;
        try {
          wg(
            t.type,
            l,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function Op(t, e) {
        for (Pp(t.containerInfo), Pt = e; Pt !== null; )
          if (t = Pt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Pt = e;
          else
            for (; Pt !== null; ) {
              t = Pt;
              var l = t.alternate;
              switch (e = t.flags, t.tag) {
                case 0:
                  if ((e & 4) !== 0 && (e = t.updateQueue, e = e !== null ? e.events : null, e !== null))
                    for (var r = 0; r < e.length; r++) {
                      var c = e[r];
                      c.ref.impl = c.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((e & 1024) !== 0 && l !== null) {
                    e = void 0, r = t, c = l.memoizedProps, l = l.memoizedState;
                    var d = r.stateNode;
                    try {
                      var x = Wn(
                        r.type,
                        c
                      );
                      e = d.getSnapshotBeforeUpdate(
                        x,
                        l
                      ), d.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (A) {
                      zt(r, r.return, A);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && Dh(t.stateNode.containerInfo);
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
                    throw Error(o(163));
              }
              if (e = t.sibling, e !== null) {
                e.return = t.return, Pt = e;
                break;
              }
              Pt = t.return;
            }
      }
      function Nu(t, e, l) {
        var r = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            nn(t, l), r & 4 && el(5, l);
            break;
          case 1:
            if (nn(t, l), r & 4)
              if (t = l.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (x) {
                  zt(l, l.return, x);
                }
              else {
                var c = Wn(
                  l.type,
                  e.memoizedProps
                );
                e = e.memoizedState;
                try {
                  t.componentDidUpdate(
                    c,
                    e,
                    t.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (x) {
                  zt(
                    l,
                    l.return,
                    x
                  );
                }
              }
            r & 64 && wu(l), r & 512 && nl(l, l.return);
            break;
          case 3:
            if (nn(t, l), r & 64 && (r = l.updateQueue, r !== null)) {
              if (t = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    t = il(l.child.stateNode);
                    break;
                  case 1:
                    t = l.child.stateNode;
                }
              try {
                pc(r, t);
              } catch (x) {
                zt(l, l.return, x);
              }
            }
            break;
          case 27:
            Jt && e === null && r & 4 && zu(l);
          case 26:
          case 5:
            if (nn(t, l), e === null) {
              if (r & 4) ku(l);
              else if (r & 64) {
                t = l.type, e = l.memoizedProps, c = l.stateNode;
                try {
                  lg(
                    c,
                    t,
                    e,
                    l
                  );
                } catch (x) {
                  zt(l, l.return, x);
                }
              }
            }
            r & 512 && nl(l, l.return);
            break;
          case 12:
            nn(t, l);
            break;
          case 31:
            nn(t, l), r & 4 && Mu(t, l);
            break;
          case 13:
            nn(t, l), r & 4 && Cu(t, l), r & 64 && (r = l.memoizedState, r !== null && (r = r.dehydrated, r !== null && (l = qp.bind(
              null,
              l
            ), Gh(r, l))));
            break;
          case 22:
            if (r = l.memoizedState !== null || un, !r) {
              e = e !== null && e.memoizedState !== null || Kt, c = un;
              var d = Kt;
              un = r, (Kt = e) && !d ? an(
                t,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : nn(t, l), un = c, Kt = d;
            }
            break;
          case 30:
            break;
          default:
            nn(t, l);
        }
      }
      function Tu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Tu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && oh(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, l) {
        for (l = l.child; l !== null; )
          os(
            t,
            e,
            l
          ), l = l.sibling;
      }
      function os(t, e, l) {
        if (ke && typeof ke.onCommitFiberUnmount == "function")
          try {
            ke.onCommitFiberUnmount(cl, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (qe) {
              Kt || Ke(l, e), Ue(
                t,
                e,
                l
              ), l.memoizedState ? Cd(l.memoizedState) : l.stateNode && jd(l.stateNode);
              break;
            }
          case 27:
            if (Jt) {
              Kt || Ke(l, e);
              var r = Xt, c = be;
              _a(l.type) && (Xt = l.stateNode, be = !1), Ue(
                t,
                e,
                l
              ), Dd(l.stateNode), Xt = r, be = c;
              break;
            }
          case 5:
            Kt || Ke(l, e);
          case 6:
            if (ce) {
              if (r = Xt, c = be, Xt = null, Ue(
                t,
                e,
                l
              ), Xt = r, be = c, Xt !== null)
                if (be)
                  try {
                    Ch(Xt, l.stateNode);
                  } catch (d) {
                    zt(
                      l,
                      e,
                      d
                    );
                  }
                else
                  try {
                    Mh(Xt, l.stateNode);
                  } catch (d) {
                    zt(
                      l,
                      e,
                      d
                    );
                  }
            } else
              Ue(
                t,
                e,
                l
              );
            break;
          case 18:
            ce && Xt !== null && (be ? dg(
              Xt,
              l.stateNode
            ) : ug(Xt, l.stateNode));
            break;
          case 4:
            ce ? (r = Xt, c = be, Xt = l.stateNode.containerInfo, be = !0, Ue(
              t,
              e,
              l
            ), Xt = r, be = c) : (Xe && Eu(
              l.stateNode,
              l,
              xd()
            ), Ue(
              t,
              e,
              l
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            _n(2, l, e), Kt || _n(4, l, e), Ue(
              t,
              e,
              l
            );
            break;
          case 1:
            Kt || (Ke(l, e), r = l.stateNode, typeof r.componentWillUnmount == "function" && _u(
              l,
              e,
              r
            )), Ue(
              t,
              e,
              l
            );
            break;
          case 21:
            Ue(
              t,
              e,
              l
            );
            break;
          case 22:
            Kt = (r = Kt) || l.memoizedState !== null, Ue(
              t,
              e,
              l
            ), Kt = r;
            break;
          default:
            Ue(
              t,
              e,
              l
            );
        }
      }
      function Mu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            ig(t);
          } catch (l) {
            zt(e, e.return, l);
          }
        }
      }
      function Cu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            sg(t);
          } catch (l) {
            zt(e, e.return, l);
          }
      }
      function Rp(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Kd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Kd()), e;
          default:
            throw Error(o(435, t.tag));
        }
      }
      function or(t, e) {
        var l = Rp(t);
        e.forEach(function(r) {
          if (!l.has(r)) {
            l.add(r);
            var c = Yp.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function oe(t, e) {
        var l = e.deletions;
        if (l !== null)
          for (var r = 0; r < l.length; r++) {
            var c = l[r], d = t, x = e;
            if (ce) {
              var A = x;
              t: for (; A !== null; ) {
                switch (A.tag) {
                  case 27:
                    if (Jt) {
                      if (_a(A.type)) {
                        Xt = A.stateNode, be = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Xt = A.stateNode, be = !1;
                    break t;
                  case 3:
                  case 4:
                    Xt = A.stateNode.containerInfo, be = !0;
                    break t;
                }
                A = A.return;
              }
              if (Xt === null) throw Error(o(160));
              os(d, x, c), Xt = null, be = !1;
            } else os(d, x, c);
            d = c.alternate, d !== null && (d.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Au(e, t), e = e.sibling;
      }
      function Au(t, e) {
        var l = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            oe(e, t), me(t), r & 4 && (_n(3, t, t.return), el(3, t), _n(5, t, t.return));
            break;
          case 1:
            oe(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), r & 64 && un && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (l = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = l === null ? r : l.concat(r))));
            break;
          case 26:
            if (qe) {
              var c = Ye;
              if (oe(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), r & 4) {
                r = l !== null ? l.memoizedState : null;
                var d = t.memoizedState;
                l === null ? d === null ? t.stateNode === null ? t.stateNode = gg(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Ad(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Md(
                  c,
                  d,
                  t.memoizedProps
                ) : r !== d ? (r === null ? l.stateNode !== null && jd(l.stateNode) : Cd(r), d === null ? Ad(
                  c,
                  t.type,
                  t.stateNode
                ) : Md(
                  c,
                  d,
                  t.memoizedProps
                )) : d === null && t.stateNode !== null && rs(
                  t,
                  t.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Jt) {
              oe(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), l !== null && r & 4 && rs(
                t,
                t.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (oe(e, t), me(t), r & 512 && (Kt || l === null || Ke(l, l.return)), ce) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  yd(c);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, rs(
                t,
                c,
                l !== null ? l.memoizedProps : c
              )), r & 1024 && (Fs = !0);
            } else
              Xe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (oe(e, t), me(t), r & 4 && ce) {
              if (t.stateNode === null)
                throw Error(o(162));
              r = t.memoizedProps, l = l !== null ? l.memoizedProps : r, c = t.stateNode;
              try {
                Sh(c, l, r);
              } catch (P) {
                zt(t, t.return, P);
              }
            }
            break;
          case 3:
            if (qe ? (vg(), c = Ye, Ye = Os(e.containerInfo), oe(e, t), Ye = c) : oe(e, t), me(t), r & 4) {
              if (ce && ue && l !== null && l.memoizedState.isDehydrated)
                try {
                  rg(e.containerInfo);
                } catch (P) {
                  zt(t, t.return, P);
                }
              if (Xe) {
                r = e.containerInfo, l = e.pendingChildren;
                try {
                  _d(r, l);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
            }
            Fs && (Fs = !1, ju(t));
            break;
          case 4:
            qe ? (l = Ye, Ye = Os(
              t.stateNode.containerInfo
            ), oe(e, t), me(t), Ye = l) : (oe(e, t), me(t)), r & 4 && Xe && Eu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            oe(e, t), me(t);
            break;
          case 31:
            oe(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, or(t, r)));
            break;
          case 13:
            oe(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Dr = ge()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, or(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var x = l !== null && l.memoizedState !== null, A = un, Y = Kt;
            if (un = A || c, Kt = Y || x, oe(e, t), Kt = Y, un = A, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (l === null || x || un || Kt || Fn(t)), ce)) {
              t: if (l = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || qe && e.tag === 26) {
                    if (l === null) {
                      x = l = e;
                      try {
                        d = x.stateNode, c ? Ah(d) : Oh(
                          x.stateNode,
                          x.memoizedProps
                        );
                      } catch (P) {
                        zt(x, x.return, P);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (l === null) {
                      x = e;
                      try {
                        var F = x.stateNode;
                        c ? jh(F) : Rh(F, x.memoizedProps);
                      } catch (P) {
                        zt(x, x.return, P);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (l === null) {
                      x = e;
                      try {
                        var nt = x.stateNode;
                        c ? fg(nt) : mg(x.stateNode);
                      } catch (P) {
                        zt(x, x.return, P);
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
            r & 4 && (r = t.updateQueue, r !== null && (l = r.retryQueue, l !== null && (r.retryQueue = null, or(t, l))));
            break;
          case 19:
            oe(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, or(t, r)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            oe(e, t), me(t);
        }
      }
      function me(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var l, r = t.return; r !== null; ) {
              if (Su(r)) {
                l = r;
                break;
              }
              r = r.return;
            }
            if (ce) {
              if (l == null) throw Error(o(160));
              switch (l.tag) {
                case 27:
                  if (Jt) {
                    var c = l.stateNode, d = is(t);
                    sr(t, d, c);
                    break;
                  }
                case 5:
                  var x = l.stateNode;
                  l.flags & 32 && (yd(x), l.flags &= -33);
                  var A = is(t);
                  sr(t, A, x);
                  break;
                case 3:
                case 4:
                  var Y = l.stateNode.containerInfo, F = is(t);
                  ss(
                    t,
                    F,
                    Y
                  );
                  break;
                default:
                  throw Error(o(161));
              }
            }
          } catch (nt) {
            zt(t, t.return, nt);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function ju(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            ju(e), e.tag === 5 && e.flags & 1024 && mh(e.stateNode), t = t.sibling;
          }
      }
      function nn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Nu(t, e.alternate, e), e = e.sibling;
      }
      function Fn(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              _n(4, e, e.return), Fn(e);
              break;
            case 1:
              Ke(e, e.return);
              var l = e.stateNode;
              typeof l.componentWillUnmount == "function" && _u(
                e,
                e.return,
                l
              ), Fn(e);
              break;
            case 27:
              Jt && Dd(e.stateNode);
            case 26:
            case 5:
              Ke(e, e.return), Fn(e);
              break;
            case 22:
              e.memoizedState === null && Fn(e);
              break;
            case 30:
              Fn(e);
              break;
            default:
              Fn(e);
          }
          t = t.sibling;
        }
      }
      function an(t, e, l) {
        for (l = l && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, d = e, x = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              an(
                c,
                d,
                l
              ), el(4, d);
              break;
            case 1:
              if (an(
                c,
                d,
                l
              ), r = d, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch (F) {
                  zt(r, r.return, F);
                }
              if (r = d, c = r.updateQueue, c !== null) {
                var A = r.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      mc(Y[c], A);
                } catch (F) {
                  zt(r, r.return, F);
                }
              }
              l && x & 64 && wu(d), nl(d, d.return);
              break;
            case 27:
              Jt && zu(d);
            case 26:
            case 5:
              an(
                c,
                d,
                l
              ), l && r === null && x & 4 && ku(d), nl(d, d.return);
              break;
            case 12:
              an(
                c,
                d,
                l
              );
              break;
            case 31:
              an(
                c,
                d,
                l
              ), l && x & 4 && Mu(c, d);
              break;
            case 13:
              an(
                c,
                d,
                l
              ), l && x & 4 && Cu(c, d);
              break;
            case 22:
              d.memoizedState === null && an(
                c,
                d,
                l
              ), nl(d, d.return);
              break;
            case 30:
              break;
            default:
              an(
                c,
                d,
                l
              );
          }
          e = e.sibling;
        }
      }
      function cs(t, e) {
        var l = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== l && (t != null && t.refCount++, l != null && Xa(l));
      }
      function us(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Xa(t));
      }
      function Ge(t, e, l, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Ou(
              t,
              e,
              l,
              r
            ), e = e.sibling;
      }
      function Ou(t, e, l, r) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            Ge(
              t,
              e,
              l,
              r
            ), c & 2048 && el(9, e);
            break;
          case 1:
            Ge(
              t,
              e,
              l,
              r
            );
            break;
          case 3:
            Ge(
              t,
              e,
              l,
              r
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Xa(t)));
            break;
          case 12:
            if (c & 2048) {
              Ge(
                t,
                e,
                l,
                r
              ), t = e.stateNode;
              try {
                var d = e.memoizedProps, x = d.id, A = d.onPostCommit;
                typeof A == "function" && A(
                  x,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (Y) {
                zt(e, e.return, Y);
              }
            } else
              Ge(
                t,
                e,
                l,
                r
              );
            break;
          case 31:
            Ge(
              t,
              e,
              l,
              r
            );
            break;
          case 13:
            Ge(
              t,
              e,
              l,
              r
            );
            break;
          case 23:
            break;
          case 22:
            d = e.stateNode, x = e.alternate, e.memoizedState !== null ? d._visibility & 2 ? Ge(
              t,
              e,
              l,
              r
            ) : al(
              t,
              e
            ) : d._visibility & 2 ? Ge(
              t,
              e,
              l,
              r
            ) : (d._visibility |= 2, ga(
              t,
              e,
              l,
              r,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), c & 2048 && cs(x, e);
            break;
          case 24:
            Ge(
              t,
              e,
              l,
              r
            ), c & 2048 && us(e.alternate, e);
            break;
          default:
            Ge(
              t,
              e,
              l,
              r
            );
        }
      }
      function ga(t, e, l, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var d = t, x = e, A = l, Y = r, F = x.flags;
          switch (x.tag) {
            case 0:
            case 11:
            case 15:
              ga(
                d,
                x,
                A,
                Y,
                c
              ), el(8, x);
              break;
            case 23:
              break;
            case 22:
              var nt = x.stateNode;
              x.memoizedState !== null ? nt._visibility & 2 ? ga(
                d,
                x,
                A,
                Y,
                c
              ) : al(
                d,
                x
              ) : (nt._visibility |= 2, ga(
                d,
                x,
                A,
                Y,
                c
              )), c && F & 2048 && cs(
                x.alternate,
                x
              );
              break;
            case 24:
              ga(
                d,
                x,
                A,
                Y,
                c
              ), c && F & 2048 && us(x.alternate, x);
              break;
            default:
              ga(
                d,
                x,
                A,
                Y,
                c
              );
          }
          e = e.sibling;
        }
      }
      function al(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var l = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                al(l, r), c & 2048 && cs(
                  r.alternate,
                  r
                );
                break;
              case 24:
                al(l, r), c & 2048 && us(
                  r.alternate,
                  r
                );
                break;
              default:
                al(l, r);
            }
            e = e.sibling;
          }
      }
      function $n(t, e, l) {
        if (t.subtreeFlags & Ha)
          for (t = t.child; t !== null; )
            Ru(
              t,
              e,
              l
            ), t = t.sibling;
      }
      function Ru(t, e, l) {
        switch (t.tag) {
          case 26:
            if ($n(
              t,
              e,
              l
            ), t.flags & Ha)
              if (t.memoizedState !== null)
                xg(
                  l,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Cs(c, t)) && vd(l, r, c, t);
              }
            break;
          case 5:
            $n(
              t,
              e,
              l
            ), t.flags & Ha && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || Cs(c, t)) && vd(l, r, c, t));
            break;
          case 3:
          case 4:
            qe ? (r = Ye, Ye = Os(
              t.stateNode.containerInfo
            ), $n(
              t,
              e,
              l
            ), Ye = r) : $n(
              t,
              e,
              l
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Ha, Ha = 16777216, $n(
              t,
              e,
              l
            ), Ha = r) : $n(
              t,
              e,
              l
            ));
            break;
          default:
            $n(
              t,
              e,
              l
            );
        }
      }
      function Du(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function ll(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var r = e[l];
              Pt = r, Bu(
                r,
                t
              );
            }
          Du(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Hu(t), t = t.sibling;
      }
      function Hu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            ll(t), t.flags & 2048 && _n(9, t, t.return);
            break;
          case 3:
            ll(t);
            break;
          case 12:
            ll(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, cr(t)) : ll(t);
            break;
          default:
            ll(t);
        }
      }
      function cr(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var r = e[l];
              Pt = r, Bu(
                r,
                t
              );
            }
          Du(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              _n(8, e, e.return), cr(e);
              break;
            case 22:
              l = e.stateNode, l._visibility & 2 && (l._visibility &= -3, cr(e));
              break;
            default:
              cr(e);
          }
          t = t.sibling;
        }
      }
      function Bu(t, e) {
        for (; Pt !== null; ) {
          var l = Pt;
          switch (l.tag) {
            case 0:
            case 11:
            case 15:
              _n(8, l, e);
              break;
            case 23:
            case 22:
              if (l.memoizedState !== null && l.memoizedState.cachePool !== null) {
                var r = l.memoizedState.cachePool.pool;
                r != null && r.refCount++;
              }
              break;
            case 24:
              Xa(l.memoizedState.cache);
          }
          if (r = l.child, r !== null) r.return = l, Pt = r;
          else
            t: for (l = t; Pt !== null; ) {
              r = Pt;
              var c = r.sibling, d = r.return;
              if (Tu(r), r === l) {
                Pt = null;
                break t;
              }
              if (c !== null) {
                c.return = d, Pt = c;
                break t;
              }
              Pt = d;
            }
        }
      }
      function ds(t) {
        var e = lh(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(o(364));
          return e;
        }
        if (t = gh(t), t === null) throw Error(o(362));
        return t.stateNode.current;
      }
      function fs(t, e) {
        var l = t.tag;
        switch (e.$$typeof) {
          case Cr:
            if (t.type === e.value) return !0;
            break;
          case Ar:
            t: {
              for (e = e.value, t = [t, 0], l = 0; l < t.length; ) {
                var r = t[l++], c = r.tag, d = t[l++], x = e[d];
                if (c !== 5 && c !== 26 && c !== 27 || !ol(r)) {
                  for (; x != null && fs(r, x); )
                    d++, x = e[d];
                  if (d === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (r = r.child; r !== null; )
                      t.push(r, d), r = r.sibling;
                }
              }
              e = !1;
            }
            return e;
          case jr:
            if ((l === 5 || l === 26 || l === 27) && yh(t.stateNode, e.value))
              return !0;
            break;
          case Rr:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (t = vh(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Or:
            if ((l === 5 || l === 26 || l === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(o(365));
        }
        return !1;
      }
      function ms(t) {
        switch (t.$$typeof) {
          case Cr:
            return "<" + (y(t.value) || "Unknown") + ">";
          case Ar:
            return ":has(" + (ms(t) || "") + ")";
          case jr:
            return '[role="' + t.value + '"]';
          case Rr:
            return '"' + t.value + '"';
          case Or:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(o(365));
        }
      }
      function Uu(t, e) {
        var l = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], d = c.tag, x = t[r++], A = e[x];
          if (d !== 5 && d !== 26 && d !== 27 || !ol(c)) {
            for (; A != null && fs(c, A); )
              x++, A = e[x];
            if (x === e.length) l.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, x), c = c.sibling;
          }
        }
        return l;
      }
      function ps(t, e) {
        if (!sl) throw Error(o(363));
        t = ds(t), t = Uu(t, e), e = [], t = Array.from(t);
        for (var l = 0; l < t.length; ) {
          var r = t[l++], c = r.tag;
          if (c === 5 || c === 26 || c === 27)
            ol(r) || e.push(r.stateNode);
          else
            for (r = r.child; r !== null; )
              t.push(r), r = r.sibling;
        }
        return e;
      }
      function xe() {
        return (wt & 2) !== 0 && kt !== 0 ? kt & -kt : dt.T !== null ? ki() : ih();
      }
      function Gu() {
        if (Ne === 0)
          if ((kt & 536870912) === 0 || St) {
            var t = br;
            br <<= 1, (br & 3932160) === 0 && (br = 262144), Ne = t;
          } else Ne = 536870912;
        return t = Ee.current, t !== null && (t.flags |= 32), Ne;
      }
      function he(t, e, l) {
        (t === At && (Mt === 2 || Mt === 9) || t.cancelPendingCommit !== null) && (ba(t, 0), kn(
          t,
          kt,
          Ne,
          !1
        )), D(t, l), ((wt & 2) === 0 || t !== At) && (t === At && ((wt & 2) === 0 && (sa |= l), Gt === 4 && kn(
          t,
          kt,
          Ne,
          !1
        )), Ve(t));
      }
      function qu(t, e, l) {
        if ((wt & 6) !== 0) throw Error(o(327));
        var r = !l && (e & 127) === 0 && (e & t.expiredLanes) === 0 || O(t, e), c = r ? Bp(t, e) : gs(t, e, !0), d = r;
        do {
          if (c === 0) {
            Ba && !r && kn(t, e, 0, !1);
            break;
          } else {
            if (l = t.current.alternate, d && !Dp(l)) {
              c = gs(t, e, !1), d = !1;
              continue;
            }
            if (c === 2) {
              if (d = e, t.errorRecoveryDisabledLanes & d)
                var x = 0;
              else
                x = t.pendingLanes & -536870913, x = x !== 0 ? x : x & 536870912 ? 536870912 : 0;
              if (x !== 0) {
                e = x;
                t: {
                  var A = t;
                  c = bl;
                  var Y = ue && A.current.memoizedState.isDehydrated;
                  if (Y && (ba(A, x).flags |= 256), x = gs(
                    A,
                    x,
                    !1
                  ), x !== 2) {
                    if ($s && !Y) {
                      A.errorRecoveryDisabledLanes |= d, sa |= d, c = 4;
                      break t;
                    }
                    d = ve, ve = c, d !== null && (ve === null ? ve = d : ve.push.apply(
                      ve,
                      d
                    ));
                  }
                  c = x;
                }
                if (d = !1, c !== 2) continue;
              }
            }
            if (c === 1) {
              ba(t, 0), kn(t, e, 0, !0);
              break;
            }
            t: {
              switch (r = t, d = c, d) {
                case 0:
                case 1:
                  throw Error(o(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  kn(
                    r,
                    e,
                    Ne,
                    !Cn
                  );
                  break t;
                case 2:
                  ve = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(o(329));
              }
              if ((e & 62914560) === e && (c = Dr + 300 - ge(), 10 < c)) {
                if (kn(
                  r,
                  e,
                  Ne,
                  !Cn
                ), j(r, 0, !0) !== 0) break t;
                fn = e, r.timeoutHandle = nh(
                  Yu.bind(
                    null,
                    r,
                    l,
                    ve,
                    Hr,
                    Ps,
                    e,
                    Ne,
                    sa,
                    Ua,
                    Cn,
                    d,
                    "Throttled",
                    -0,
                    0
                  ),
                  c
                );
                break t;
              }
              Yu(
                r,
                l,
                ve,
                Hr,
                Ps,
                e,
                Ne,
                sa,
                Ua,
                Cn,
                d,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Ve(t);
      }
      function Yu(t, e, l, r, c, d, x, A, Y, F, nt, P, lt, gt) {
        if (t.timeoutHandle = Pn, P = e.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = dh(), Ru(
            e,
            d,
            P
          );
          var re = (d & 62914560) === d ? Dr - ge() : (d & 4194048) === d ? Xd - ge() : 0;
          if (re = fh(
            P,
            re
          ), re !== null) {
            fn = d, t.cancelPendingCommit = re(
              Fu.bind(
                null,
                t,
                e,
                d,
                l,
                r,
                c,
                x,
                A,
                Y,
                nt,
                P,
                null,
                lt,
                gt
              )
            ), kn(t, d, x, !F);
            return;
          }
        }
        Fu(
          t,
          e,
          d,
          l,
          r,
          c,
          x,
          A,
          Y
        );
      }
      function Dp(t) {
        for (var e = t; ; ) {
          var l = e.tag;
          if ((l === 0 || l === 11 || l === 15) && e.flags & 16384 && (l = e.updateQueue, l !== null && (l = l.stores, l !== null)))
            for (var r = 0; r < l.length; r++) {
              var c = l[r], d = c.getSnapshot;
              c = c.value;
              try {
                if (!Se(d(), c)) return !1;
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
      function kn(t, e, l, r) {
        e &= ~Is, e &= ~sa, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var d = 31 - _e(c), x = 1 << d;
          r[d] = -1, c &= ~x;
        }
        l !== 0 && h(t, l, e);
      }
      function Lu() {
        return (wt & 6) === 0 ? (pa(0), !1) : !0;
      }
      function hs() {
        if (_t !== null) {
          if (Mt === 0)
            var t = _t.return;
          else
            t = _t, on = ea = null, Hi(t), Aa = null, ml = 0, t = _t;
          for (; t !== null; )
            xu(t.alternate, t), t = t.return;
          _t = null;
        }
      }
      function ba(t, e) {
        var l = t.timeoutHandle;
        l !== Pn && (t.timeoutHandle = Pn, ah(l)), l = t.cancelPendingCommit, l !== null && (t.cancelPendingCommit = null, l()), fn = 0, hs(), At = t, _t = l = ln(t.current, null), kt = e, Mt = 0, ze = null, Cn = !1, Ba = O(t, e), $s = !1, Ua = Ne = Is = sa = An = Gt = 0, ve = bl = null, Ps = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - _e(r), d = 1 << c;
            e |= t[c], r &= ~d;
          }
        return dn = e, Kl(), l;
      }
      function Qu(t, e) {
        vt = null, dt.H = hl, e === Ca || e === Er ? (e = cc(), Mt = 3) : e === Qs ? (e = cc(), Mt = 4) : Mt = e === Js ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ze = e, _t === null && (Gt = 1, er(
          t,
          L(e, t.current)
        ));
      }
      function Vu() {
        var t = Ee.current;
        return t === null ? !0 : (kt & 4194048) === kt ? Oe === null : (kt & 62914560) === kt || (kt & 536870912) !== 0 ? t === Oe : !1;
      }
      function Ku() {
        var t = dt.H;
        return dt.H = hl, t === null ? hl : t;
      }
      function Xu() {
        var t = dt.A;
        return dt.A = Dg, t;
      }
      function ur() {
        Gt = 4, Cn || (kt & 4194048) !== kt && Ee.current !== null || (Ba = !0), (An & 134217727) === 0 && (sa & 134217727) === 0 || At === null || kn(
          At,
          kt,
          Ne,
          !1
        );
      }
      function gs(t, e, l) {
        var r = wt;
        wt |= 2;
        var c = Ku(), d = Xu();
        (At !== t || kt !== e) && (Hr = null, ba(t, e)), e = !1;
        var x = Gt;
        t: do
          try {
            if (Mt !== 0 && _t !== null) {
              var A = _t, Y = ze;
              switch (Mt) {
                case 8:
                  hs(), x = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Ee.current === null && (e = !0);
                  var F = Mt;
                  if (Mt = 0, ze = null, va(t, A, Y, F), l && Ba) {
                    x = 0;
                    break t;
                  }
                  break;
                default:
                  F = Mt, Mt = 0, ze = null, va(t, A, Y, F);
              }
            }
            Hp(), x = Gt;
            break;
          } catch (nt) {
            Qu(t, nt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, on = ea = null, wt = r, dt.H = c, dt.A = d, _t === null && (At = null, kt = 0, Kl()), x;
      }
      function Hp() {
        for (; _t !== null; ) Zu(_t);
      }
      function Bp(t, e) {
        var l = wt;
        wt |= 2;
        var r = Ku(), c = Xu();
        At !== t || kt !== e ? (Hr = null, vl = ge() + 500, ba(t, e)) : Ba = O(
          t,
          e
        );
        t: do
          try {
            if (Mt !== 0 && _t !== null) {
              e = _t;
              var d = ze;
              e: switch (Mt) {
                case 1:
                  Mt = 0, ze = null, va(t, e, d, 1);
                  break;
                case 2:
                case 9:
                  if (sc(d)) {
                    Mt = 0, ze = null, Ju(e);
                    break;
                  }
                  e = function() {
                    Mt !== 2 && Mt !== 9 || At !== t || (Mt = 7), Ve(t);
                  }, d.then(e, e);
                  break t;
                case 3:
                  Mt = 7;
                  break t;
                case 4:
                  Mt = 5;
                  break t;
                case 7:
                  sc(d) ? (Mt = 0, ze = null, Ju(e)) : (Mt = 0, ze = null, va(t, e, d, 7));
                  break;
                case 5:
                  var x = null;
                  switch (_t.tag) {
                    case 26:
                      x = _t.memoizedState;
                    case 5:
                    case 27:
                      var A = _t, Y = A.type, F = A.pendingProps;
                      if (x ? Od(x) : bd(A.stateNode, Y, F)) {
                        Mt = 0, ze = null;
                        var nt = A.sibling;
                        if (nt !== null) _t = nt;
                        else {
                          var P = A.return;
                          P !== null ? (_t = P, dr(P)) : _t = null;
                        }
                        break e;
                      }
                  }
                  Mt = 0, ze = null, va(t, e, d, 5);
                  break;
                case 6:
                  Mt = 0, ze = null, va(t, e, d, 6);
                  break;
                case 8:
                  hs(), Gt = 6;
                  break t;
                default:
                  throw Error(o(462));
              }
            }
            Up();
            break;
          } catch (lt) {
            Qu(t, lt);
          }
        while (!0);
        return on = ea = null, dt.H = r, dt.A = c, wt = l, _t !== null ? 0 : (At = null, kt = 0, Kl(), Gt);
      }
      function Up() {
        for (; _t !== null && !Sg(); )
          Zu(_t);
      }
      function Zu(t) {
        var e = hu(
          t.alternate,
          t,
          dn
        );
        t.memoizedProps = t.pendingProps, e === null ? dr(t) : _t = e;
      }
      function Ju(t) {
        var e = t, l = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = cu(
              l,
              e,
              e.pendingProps,
              e.type,
              void 0,
              kt
            );
            break;
          case 11:
            e = cu(
              l,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              kt
            );
            break;
          case 5:
            Hi(e);
          default:
            xu(l, e), e = _t = ld(e, dn), e = hu(l, e, dn);
        }
        t.memoizedProps = t.pendingProps, e === null ? dr(t) : _t = e;
      }
      function va(t, e, l, r) {
        on = ea = null, Hi(e), Aa = null, ml = 0;
        var c = e.return;
        try {
          if (Tp(
            t,
            c,
            e,
            l,
            kt
          )) {
            Gt = 1, er(
              t,
              L(l, t.current)
            ), _t = null;
            return;
          }
        } catch (d) {
          if (c !== null) throw _t = c, d;
          Gt = 1, er(
            t,
            L(l, t.current)
          ), _t = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ba || (kt & 536870912) !== 0 ? t = !1 : (Cn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Ee.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Wu(e, t)) : dr(e);
      }
      function dr(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Wu(
              e,
              Cn
            );
            return;
          }
          t = e.return;
          var l = Ap(
            e.alternate,
            e,
            dn
          );
          if (l !== null) {
            _t = l;
            return;
          }
          if (e = e.sibling, e !== null) {
            _t = e;
            return;
          }
          _t = e = t;
        } while (e !== null);
        Gt === 0 && (Gt = 5);
      }
      function Wu(t, e) {
        do {
          var l = jp(t.alternate, t);
          if (l !== null) {
            l.flags &= 32767, _t = l;
            return;
          }
          if (l = t.return, l !== null && (l.flags |= 32768, l.subtreeFlags = 0, l.deletions = null), !e && (t = t.sibling, t !== null)) {
            _t = t;
            return;
          }
          _t = t = l;
        } while (t !== null);
        Gt = 6, _t = null;
      }
      function Fu(t, e, l, r, c, d, x, A, Y) {
        t.cancelPendingCommit = null;
        do
          rl();
        while (Wt !== 0);
        if ((wt & 6) !== 0) throw Error(o(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(o(177));
          if (d = e.lanes | e.childLanes, d |= Vs, g(
            t,
            l,
            d,
            x,
            A,
            Y
          ), t === At && (_t = At = null, kt = 0), Ga = e, On = t, fn = l, to = d, eo = c, Zd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Lp(Hs, function() {
            return ed(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = sn(), It(2), x = wt, wt |= 4;
            try {
              Op(t, e, l);
            } finally {
              wt = x, It(c), dt.T = r;
            }
          }
          Wt = 1, $u(), Iu(), Pu();
        }
      }
      function $u() {
        if (Wt === 1) {
          Wt = 0;
          var t = On, e = Ga, l = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || l) {
            l = dt.T, dt.T = null;
            var r = sn();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              Au(e, t), th(t.containerInfo);
            } finally {
              wt = c, It(r), dt.T = l;
            }
          }
          t.current = e, Wt = 2;
        }
      }
      function Iu() {
        if (Wt === 2) {
          Wt = 0;
          var t = On, e = Ga, l = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || l) {
            l = dt.T, dt.T = null;
            var r = sn();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              Nu(t, e.alternate, e);
            } finally {
              wt = c, It(r), dt.T = l;
            }
          }
          Wt = 3;
        }
      }
      function Pu() {
        if (Wt === 4 || Wt === 3) {
          Wt = 0, Eg();
          var t = On, e = Ga, l = fn, r = Zd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Wt = 5 : (Wt = 0, Ga = On = null, td(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (jn = null), E(l), e = e.stateNode, ke && typeof ke.onCommitFiberRoot == "function")
            try {
              ke.onCommitFiberRoot(
                cl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (r !== null) {
            e = dt.T, c = sn(), It(2), dt.T = null;
            try {
              for (var d = t.onRecoverableError, x = 0; x < r.length; x++) {
                var A = r[x];
                d(A.value, {
                  componentStack: A.stack
                });
              }
            } finally {
              dt.T = e, It(c);
            }
          }
          (fn & 3) !== 0 && rl(), Ve(t), c = t.pendingLanes, (l & 261930) !== 0 && (c & 42) !== 0 ? t === no ? yl++ : (yl = 0, no = t) : yl = 0, ue && cg(), pa(0);
        }
      }
      function td(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Xa(e)));
      }
      function rl() {
        return $u(), Iu(), Pu(), ed();
      }
      function ed() {
        if (Wt !== 5) return !1;
        var t = On, e = to;
        to = 0;
        var l = E(fn), r = 32 > l ? 32 : l;
        l = dt.T;
        var c = sn();
        try {
          It(r), dt.T = null, r = eo, eo = null;
          var d = On, x = fn;
          if (Wt = 0, Ga = On = null, fn = 0, (wt & 6) !== 0)
            throw Error(o(331));
          var A = wt;
          if (wt |= 4, Hu(d.current), Ou(
            d,
            d.current,
            x,
            r
          ), wt = A, pa(0, !1), ke && typeof ke.onPostCommitFiberRoot == "function")
            try {
              ke.onPostCommitFiberRoot(cl, d);
            } catch {
            }
          return !0;
        } finally {
          It(c), dt.T = l, td(t, e);
        }
      }
      function nd(t, e, l) {
        e = L(l, e), e = Ji(t.stateNode, e, 2), t = yn(t, e, 2), t !== null && (D(t, 2), Ve(t));
      }
      function zt(t, e, l) {
        if (t.tag === 3)
          nd(t, t, l);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              nd(
                e,
                t,
                l
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (jn === null || !jn.has(r))) {
                t = L(l, t), l = eu(2), r = yn(e, l, 2), r !== null && (nu(
                  l,
                  r,
                  e,
                  t
                ), D(r, 2), Ve(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function bs(t, e, l) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Hg();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(l) || ($s = !0, c.add(l), t = Gp.bind(null, t, e, l), e.then(t, t));
      }
      function Gp(t, e, l) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & l, t.warmLanes &= ~l, At === t && (kt & l) === l && (Gt === 4 || Gt === 3 && (kt & 62914560) === kt && 300 > ge() - Dr ? (wt & 2) === 0 && ba(t, 0) : Is |= l, Ua === kt && (Ua = 0)), Ve(t);
      }
      function ad(t, e) {
        e === 0 && (e = W()), t = Jn(t, e), t !== null && (D(t, e), Ve(t));
      }
      function qp(t) {
        var e = t.memoizedState, l = 0;
        e !== null && (l = e.retryLane), ad(t, l);
      }
      function Yp(t, e) {
        var l = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var r = t.stateNode, c = t.memoizedState;
            c !== null && (l = c.retryLane);
            break;
          case 19:
            r = t.stateNode;
            break;
          case 22:
            r = t.stateNode._retryCache;
            break;
          default:
            throw Error(o(314));
        }
        r !== null && r.delete(e), ad(t, l);
      }
      function Lp(t, e) {
        return yr(t, e);
      }
      function Qp(t, e, l, r) {
        this.tag = t, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function vs(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function ln(t, e) {
        var l = t.alternate;
        return l === null ? (l = i(
          t.tag,
          e,
          t.key,
          t.mode
        ), l.elementType = t.elementType, l.type = t.type, l.stateNode = t.stateNode, l.alternate = t, t.alternate = l) : (l.pendingProps = e, l.type = t.type, l.flags = 0, l.subtreeFlags = 0, l.deletions = null), l.flags = t.flags & 65011712, l.childLanes = t.childLanes, l.lanes = t.lanes, l.child = t.child, l.memoizedProps = t.memoizedProps, l.memoizedState = t.memoizedState, l.updateQueue = t.updateQueue, e = t.dependencies, l.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, l.sibling = t.sibling, l.index = t.index, l.ref = t.ref, l.refCleanup = t.refCleanup, l;
      }
      function ld(t, e) {
        t.flags &= 65011714;
        var l = t.alternate;
        return l === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = l.childLanes, t.lanes = l.lanes, t.child = l.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = l.memoizedProps, t.memoizedState = l.memoizedState, t.updateQueue = l.updateQueue, t.type = l.type, e = l.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function fr(t, e, l, r, c, d) {
        var x = 0;
        if (r = t, typeof t == "function") vs(t) && (x = 1);
        else if (typeof t == "string")
          x = qe && Jt ? Nd(t, l, ae.current) ? 26 : Hd(t) ? 27 : 5 : qe ? Nd(
            t,
            l,
            ae.current
          ) ? 26 : 5 : Jt && Hd(t) ? 27 : 5;
        else
          t: switch (t) {
            case Ts:
              return t = i(31, l, e, c), t.elementType = Ts, t.lanes = d, t;
            case xa:
              return In(
                l.children,
                c,
                d,
                e
              );
            case dd:
              x = 8, c |= 24;
              break;
            case ks:
              return t = i(12, l, e, c | 2), t.elementType = ks, t.lanes = d, t;
            case Es:
              return t = i(13, l, e, c), t.elementType = Es, t.lanes = d, t;
            case zs:
              return t = i(19, l, e, c), t.elementType = zs, t.lanes = d, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case Sn:
                    x = 10;
                    break t;
                  case fd:
                    x = 9;
                    break t;
                  case Ss:
                    x = 11;
                    break t;
                  case Ns:
                    x = 14;
                    break t;
                  case En:
                    x = 16, r = null;
                    break t;
                }
              x = 29, l = Error(
                o(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = i(x, l, e, c), e.elementType = t, e.type = r, e.lanes = d, e;
      }
      function In(t, e, l, r) {
        return t = i(7, t, r, e), t.lanes = l, t;
      }
      function ys(t, e, l) {
        return t = i(6, t, null, e), t.lanes = l, t;
      }
      function rd(t) {
        var e = i(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function xs(t, e, l) {
        return e = i(
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
      function Vp(t, e, l, r, c, d, x, A, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Pn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = J(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = J(0), this.hiddenUpdates = J(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = d, this.onRecoverableError = x, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function id(t, e, l, r, c, d, x, A, Y, F, nt, P) {
        return t = new Vp(
          t,
          e,
          l,
          x,
          Y,
          F,
          nt,
          P,
          A
        ), e = 1, d === !0 && (e |= 24), d = i(3, null, null, e), t.current = d, d.stateNode = t, e = _i(), e.refCount++, t.pooledCache = e, e.refCount++, d.memoizedState = {
          element: r,
          isDehydrated: l,
          cache: e
        }, zi(d), t;
      }
      function sd(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function od(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(o(188)) : (t = Object.keys(t).join(","), Error(o(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : il(t.stateNode);
      }
      function cd(t, e, l, r, c, d) {
        c = sd(c), r.context === null ? r.context = c : r.pendingContext = c, r = vn(e), r.payload = { element: l }, d = d === void 0 ? null : d, d !== null && (r.callback = d), l = yn(t, r, e), l !== null && (he(l, t, e), Ja(l, t, e));
      }
      function ud(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var l = t.retryLane;
          t.retryLane = l !== 0 && l < e ? l : e;
        }
      }
      function ws(t, e) {
        ud(t, e), (t = t.alternate) && ud(t, e);
      }
      var xt = {}, Kp = d0, we = um(), _s = Object.assign, Xp = Symbol.for("react.element"), mr = Symbol.for("react.transitional.element"), ya = Symbol.for("react.portal"), xa = Symbol.for("react.fragment"), dd = Symbol.for("react.strict_mode"), ks = Symbol.for("react.profiler"), fd = Symbol.for("react.consumer"), Sn = Symbol.for("react.context"), Ss = Symbol.for("react.forward_ref"), Es = Symbol.for("react.suspense"), zs = Symbol.for("react.suspense_list"), Ns = Symbol.for("react.memo"), En = Symbol.for("react.lazy"), Ts = Symbol.for("react.activity"), Zp = Symbol.for("react.memo_cache_sentinel"), md = Symbol.iterator, Jp = Symbol.for("react.client.reference"), pr = Array.isArray, dt = Kp.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Wp = a.rendererVersion, Fp = a.rendererPackageName, pd = a.extraDevToolsConfig, il = a.getPublicInstance, $p = a.getRootHostContext, Ip = a.getChildHostContext, Pp = a.prepareForCommit, th = a.resetAfterCommit, eh = a.createInstance;
      a.cloneMutableInstance;
      var Ms = a.appendInitialChild, hd = a.finalizeInitialChildren, hr = a.shouldSetTextContent, gd = a.createTextInstance;
      a.cloneMutableTextInstance;
      var nh = a.scheduleTimeout, ah = a.cancelTimeout, Pn = a.noTimeout, rn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var ce = a.supportsMutation, Xe = a.supportsPersistence, ue = a.supportsHydration, lh = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var rh = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var It = a.setCurrentUpdatePriority, sn = a.getCurrentUpdatePriority, ih = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var sh = a.shouldAttemptEagerTransition, oh = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var ch = a.maySuspendCommit, uh = a.maySuspendCommitOnUpdate, Cs = a.maySuspendCommitInSyncRender, bd = a.preloadInstance, dh = a.startSuspendingCommit, vd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var fh = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var wa = a.NotPendingTransition, ta = a.HostTransitionContext, mh = a.resetFormInstance;
      a.bindToConsole;
      var ph = a.supportsMicrotasks, hh = a.scheduleMicrotask, sl = a.supportsTestSelectors, gh = a.findFiberRoot, bh = a.getBoundingRect, vh = a.getTextContent, ol = a.isHiddenSubtree, yh = a.matchAccessibilityRole, xh = a.setFocusIfFocusable, wh = a.setupIntersectionObserver, _h = a.appendChild, kh = a.appendChildToContainer, Sh = a.commitTextUpdate, Eh = a.commitMount, zh = a.commitUpdate, Nh = a.insertBefore, Th = a.insertInContainerBefore, Mh = a.removeChild, Ch = a.removeChildFromContainer, yd = a.resetTextContent, Ah = a.hideInstance, jh = a.hideTextInstance, Oh = a.unhideInstance, Rh = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var Dh = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var Hh = a.cloneInstance, xd = a.createContainerChildSet, wd = a.appendChildToContainerChildSet, Bh = a.finalizeContainerChildren, _d = a.replaceContainerChildren, kd = a.cloneHiddenInstance, Sd = a.cloneHiddenTextInstance, As = a.isSuspenseInstancePending, js = a.isSuspenseInstanceFallback, Uh = a.getSuspenseInstanceFallbackErrorDetails, Gh = a.registerSuspenseInstanceRetry, qh = a.canHydrateFormStateMarker, Yh = a.isFormStateMarkerMatching, Ed = a.getNextHydratableSibling, Lh = a.getNextHydratableSiblingAfterSingleton, Qh = a.getFirstHydratableChild, Vh = a.getFirstHydratableChildWithinContainer, Kh = a.getFirstHydratableChildWithinActivityInstance, Xh = a.getFirstHydratableChildWithinSuspenseInstance, Zh = a.getFirstHydratableChildWithinSingleton, Jh = a.canHydrateInstance, Wh = a.canHydrateTextInstance, Fh = a.canHydrateActivityInstance, $h = a.canHydrateSuspenseInstance, Ih = a.hydrateInstance, Ph = a.hydrateTextInstance, tg = a.hydrateActivityInstance, eg = a.hydrateSuspenseInstance, ng = a.getNextHydratableInstanceAfterActivityInstance, ag = a.getNextHydratableInstanceAfterSuspenseInstance, lg = a.commitHydratedInstance, rg = a.commitHydratedContainer, ig = a.commitHydratedActivityInstance, sg = a.commitHydratedSuspenseInstance, og = a.finalizeHydratedChildren, cg = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var ug = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var dg = a.clearSuspenseBoundaryFromContainer, fg = a.hideDehydratedBoundary, mg = a.unhideDehydratedBoundary, zd = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var pg = a.validateHydratableInstance, hg = a.validateHydratableTextInstance, qe = a.supportsResources, Nd = a.isHostHoistableType, Os = a.getHoistableRoot, Td = a.getResource, Md = a.acquireResource, Cd = a.releaseResource, gg = a.hydrateHoistable, Ad = a.mountHoistable, jd = a.unmountHoistable, bg = a.createHoistableInstance, vg = a.prepareToCommitHoistables, yg = a.mayResourceSuspendCommit, Od = a.preloadResource, xg = a.suspendResource, Jt = a.supportsSingletons, Rd = a.resolveSingletonInstance, wg = a.acquireSingletonInstance, Dd = a.releaseSingletonInstance, Hd = a.isHostSingletonType, _a = a.isSingletonScope, Rs = [], ka = -1, Sa = {}, _e = Math.clz32 ? Math.clz32 : z, _g = Math.log, kg = Math.LN2, gr = 256, br = 262144, vr = 4194304, yr = we.unstable_scheduleCallback, Ds = we.unstable_cancelCallback, Sg = we.unstable_shouldYield, Eg = we.unstable_requestPaint, ge = we.unstable_now, Bd = we.unstable_ImmediatePriority, zg = we.unstable_UserBlockingPriority, Hs = we.unstable_NormalPriority, Ng = we.unstable_IdlePriority, Tg = we.log, Mg = we.unstable_setDisableYieldValue, cl = null, ke = null, Se = typeof Object.is == "function" ? Object.is : Q, Ud = typeof reportError == "function" ? reportError : function(t) {
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
      }, Cg = Object.prototype.hasOwnProperty, Bs, Gd, Us = !1, qd = /* @__PURE__ */ new WeakMap(), Ea = [], za = 0, xr = null, ul = 0, Me = [], Ce = 0, zn = null, Ze = 1, Je = "", ae = b(null), dl = b(null), Nn = b(null), wr = b(null), le = null, Rt = null, St = !1, Tn = null, Ae = !1, Gs = Error(o(519)), _r = b(null), ea = null, on = null, Ag = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(l, r) {
            t.push(r);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(l) {
            return l();
          });
        };
      }, jg = we.unstable_scheduleCallback, Og = we.unstable_NormalPriority, Dt = {
        $$typeof: Sn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, kr = null, Na = null, qs = !1, Sr = !1, Ys = !1, na = 0, fl = null, Ls = 0, Ta = 0, Ma = null, Yd = dt.S;
      dt.S = function(t, e) {
        Xd = ge(), typeof e == "object" && e !== null && typeof e.then == "function" && xp(t, e), Yd !== null && Yd(t, e);
      };
      var aa = b(null), Ca = Error(o(460)), Qs = Error(o(474)), Er = Error(o(542)), zr = { then: function() {
      } }, la = null, Aa = null, ml = 0, ra = dc(!0), Ld = dc(!1), je = [], ja = 0, Vs = 0, Mn = !1, Ks = !1, Oa = b(null), Nr = b(0), Ee = b(null), Oe = null, Yt = b(0), cn = 0, vt = null, Ct = null, Qt = null, Tr = !1, Ra = !1, ia = !1, Mr = 0, pl = 0, Da = null, Rg = 0, hl = {
        readContext: ee,
        use: Fl,
        useCallback: Ut,
        useContext: Ut,
        useEffect: Ut,
        useImperativeHandle: Ut,
        useLayoutEffect: Ut,
        useInsertionEffect: Ut,
        useMemo: Ut,
        useReducer: Ut,
        useRef: Ut,
        useState: Ut,
        useDebugValue: Ut,
        useDeferredValue: Ut,
        useTransition: Ut,
        useSyncExternalStore: Ut,
        useId: Ut,
        useHostTransitionStatus: Ut,
        useFormState: Ut,
        useActionState: Ut,
        useOptimistic: Ut,
        useMemoCache: Ut,
        useCacheRefresh: Ut
      };
      hl.useEffectEvent = Ut;
      var Qd = {
        readContext: ee,
        use: Fl,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: ee,
        useEffect: Hc,
        useImperativeHandle: function(t, e, l) {
          l = l != null ? l.concat([t]) : null, Il(
            4194308,
            4,
            qc.bind(null, e, t),
            l
          );
        },
        useLayoutEffect: function(t, e) {
          return Il(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Il(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var l = fe();
          e = e === void 0 ? null : e;
          var r = t();
          if (ia) {
            R(!0);
            try {
              t();
            } finally {
              R(!1);
            }
          }
          return l.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, l) {
          var r = fe();
          if (l !== void 0) {
            var c = l(e);
            if (ia) {
              R(!0);
              try {
                l(e);
              } finally {
                R(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = Np.bind(
            null,
            vt,
            t
          ), [r.memoizedState, t];
        },
        useRef: function(t) {
          var e = fe();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = qi(t);
          var e = t.queue, l = Wc.bind(
            null,
            vt,
            e
          );
          return e.dispatch = l, [t.memoizedState, l];
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var l = fe();
          return Vi(l, t, e);
        },
        useTransition: function() {
          var t = qi(!1);
          return t = Kc.bind(
            null,
            vt,
            t.queue,
            !0,
            !1
          ), fe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, l) {
          var r = vt, c = fe();
          if (St) {
            if (l === void 0)
              throw Error(o(407));
            l = l();
          } else {
            if (l = e(), At === null)
              throw Error(o(349));
            (kt & 127) !== 0 || xc(r, e, l);
          }
          c.memoizedState = l;
          var d = { value: l, getSnapshot: e };
          return c.queue = d, Hc(_c.bind(null, r, d, t), [
            t
          ]), r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            wc.bind(
              null,
              r,
              d,
              l,
              e
            ),
            null
          ), l;
        },
        useId: function() {
          var t = fe(), e = At.identifierPrefix;
          if (St) {
            var l = Je, r = Ze;
            l = (r & ~(1 << 32 - _e(r) - 1)).toString(32) + l, e = "_" + e + "R_" + l, l = Mr++, 0 < l && (e += "H" + l.toString(32)), e += "_";
          } else
            l = Rg++, e = "_" + e + "r_" + l.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ki,
        useFormState: Ac,
        useActionState: Ac,
        useOptimistic: function(t) {
          var e = fe();
          e.memoizedState = e.baseState = t;
          var l = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = l, e = Xi.bind(
            null,
            vt,
            !0,
            l
          ), l.dispatch = e, [t, e];
        },
        useMemoCache: Bi,
        useCacheRefresh: function() {
          return fe().memoizedState = zp.bind(
            null,
            vt
          );
        },
        useEffectEvent: function(t) {
          var e = fe(), l = { impl: t };
          return e.memoizedState = l, function() {
            if ((wt & 2) !== 0)
              throw Error(o(440));
            return l.impl.apply(void 0, arguments);
          };
        }
      }, Xs = {
        readContext: ee,
        use: Fl,
        useCallback: Lc,
        useContext: ee,
        useEffect: Li,
        useImperativeHandle: Yc,
        useInsertionEffect: Uc,
        useLayoutEffect: Gc,
        useMemo: Qc,
        useReducer: $l,
        useRef: Dc,
        useState: function() {
          return $l(tn);
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var l = qt();
          return Vc(
            l,
            Ct.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = $l(tn)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : $a(t),
            e
          ];
        },
        useSyncExternalStore: yc,
        useId: Zc,
        useHostTransitionStatus: Ki,
        useFormState: jc,
        useActionState: jc,
        useOptimistic: function(t, e) {
          var l = qt();
          return Ec(l, Ct, t, e);
        },
        useMemoCache: Bi,
        useCacheRefresh: Jc
      };
      Xs.useEffectEvent = Bc;
      var Vd = {
        readContext: ee,
        use: Fl,
        useCallback: Lc,
        useContext: ee,
        useEffect: Li,
        useImperativeHandle: Yc,
        useInsertionEffect: Uc,
        useLayoutEffect: Gc,
        useMemo: Qc,
        useReducer: Gi,
        useRef: Dc,
        useState: function() {
          return Gi(tn);
        },
        useDebugValue: Qi,
        useDeferredValue: function(t, e) {
          var l = qt();
          return Ct === null ? Vi(l, t, e) : Vc(
            l,
            Ct.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Gi(tn)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : $a(t),
            e
          ];
        },
        useSyncExternalStore: yc,
        useId: Zc,
        useHostTransitionStatus: Ki,
        useFormState: Rc,
        useActionState: Rc,
        useOptimistic: function(t, e) {
          var l = qt();
          return Ct !== null ? Ec(l, Ct, t, e) : (l.baseState = t, [t, l.queue.dispatch]);
        },
        useMemoCache: Bi,
        useCacheRefresh: Jc
      };
      Vd.useEffectEvent = Bc;
      var Zs = {
        enqueueSetState: function(t, e, l) {
          t = t._reactInternals;
          var r = xe(), c = vn(r);
          c.payload = e, l != null && (c.callback = l), e = yn(t, c, r), e !== null && (he(e, t, r), Ja(e, t, r));
        },
        enqueueReplaceState: function(t, e, l) {
          t = t._reactInternals;
          var r = xe(), c = vn(r);
          c.tag = 1, c.payload = e, l != null && (c.callback = l), e = yn(t, c, r), e !== null && (he(e, t, r), Ja(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var l = xe(), r = vn(l);
          r.tag = 2, e != null && (r.callback = e), e = yn(t, r, l), e !== null && (he(e, t, l), Ja(e, t, l));
        }
      }, Js = Error(o(461)), Vt = !1, Ws = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, un = !1, Kt = !1, Fs = !1, Kd = typeof WeakSet == "function" ? WeakSet : Set, Pt = null, Xt = null, be = !1, Ye = null, Ha = 8192, Dg = {
        getCacheForType: function(t) {
          var e = ee(Dt), l = e.data.get(t);
          return l === void 0 && (l = t(), e.data.set(t, l)), l;
        },
        cacheSignal: function() {
          return ee(Dt).controller.signal;
        }
      }, Cr = 0, Ar = 1, jr = 2, Or = 3, Rr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var gl = Symbol.for;
        Cr = gl("selector.component"), Ar = gl("selector.has_pseudo_class"), jr = gl("selector.role"), Or = gl("selector.test_id"), Rr = gl("selector.text");
      }
      var Hg = typeof WeakMap == "function" ? WeakMap : Map, wt = 0, At = null, _t = null, kt = 0, Mt = 0, ze = null, Cn = !1, Ba = !1, $s = !1, dn = 0, Gt = 0, An = 0, sa = 0, Is = 0, Ne = 0, Ua = 0, bl = null, ve = null, Ps = !1, Dr = 0, Xd = 0, vl = 1 / 0, Hr = null, jn = null, Wt = 0, On = null, Ga = null, fn = 0, to = 0, eo = null, Zd = null, yl = 0, no = null;
      return xt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Jn(t, 67108864);
          e !== null && he(e, t, 67108864), ws(t, 67108864);
        }
      }, xt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = xe();
          e = N(e);
          var l = Jn(t, e);
          l !== null && he(l, t, e), ws(t, e);
        }
      }, xt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = M(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var l = 1 << 31 - _e(e);
                  t.entanglements[1] |= l, e &= ~l;
                }
                Ve(t), (wt & 6) === 0 && (vl = ge() + 500, pa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Jn(t, 2), e !== null && he(e, t, 2), Lu(), ws(t, 2);
        }
      }, xt.batchedUpdates = function(t, e) {
        return t(e);
      }, xt.createComponentSelector = function(t) {
        return { $$typeof: Cr, value: t };
      }, xt.createContainer = function(t, e, l, r, c, d, x, A, Y, F) {
        return id(
          t,
          e,
          !1,
          null,
          l,
          r,
          d,
          null,
          x,
          A,
          Y,
          F
        );
      }, xt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: Ar, value: t };
      }, xt.createHydrationContainer = function(t, e, l, r, c, d, x, A, Y, F, nt, P, lt, gt) {
        return t = id(
          l,
          r,
          !0,
          t,
          c,
          d,
          A,
          gt,
          Y,
          F,
          nt,
          P
        ), t.context = sd(null), l = t.current, r = xe(), r = N(r), c = vn(r), c.callback = e ?? null, yn(l, c, r), e = r, t.current.lanes = e, D(t, e), Ve(t), t;
      }, xt.createPortal = function(t, e, l) {
        var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ya,
          key: r == null ? null : "" + r,
          children: t,
          containerInfo: e,
          implementation: l
        };
      }, xt.createRoleSelector = function(t) {
        return { $$typeof: jr, value: t };
      }, xt.createTestNameSelector = function(t) {
        return { $$typeof: Or, value: t };
      }, xt.createTextSelector = function(t) {
        return { $$typeof: Rr, value: t };
      }, xt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, xt.defaultOnRecoverableError = function(t) {
        Ud(t);
      }, xt.defaultOnUncaughtError = function(t) {
        Ud(t);
      }, xt.deferredUpdates = function(t) {
        var e = dt.T, l = sn();
        try {
          return It(32), dt.T = null, t();
        } finally {
          It(l), dt.T = e;
        }
      }, xt.discreteUpdates = function(t, e, l, r, c) {
        var d = dt.T, x = sn();
        try {
          return It(2), dt.T = null, t(e, l, r, c);
        } finally {
          It(x), dt.T = d, wt === 0 && (vl = ge() + 500);
        }
      }, xt.findAllNodes = ps, xt.findBoundingRects = function(t, e) {
        if (!sl) throw Error(o(363));
        e = ps(t, e), t = [];
        for (var l = 0; l < e.length; l++)
          t.push(bh(e[l]));
        for (e = t.length - 1; 0 < e; e--) {
          l = t[e];
          for (var r = l.x, c = r + l.width, d = l.y, x = d + l.height, A = e - 1; 0 <= A; A--)
            if (e !== A) {
              var Y = t[A], F = Y.x, nt = F + Y.width, P = Y.y, lt = P + Y.height;
              if (r >= F && d >= P && c <= nt && x <= lt) {
                t.splice(e, 1);
                break;
              } else if (r !== F || l.width !== Y.width || lt < d || P > x) {
                if (!(d !== P || l.height !== Y.height || nt < r || F > c)) {
                  F > r && (Y.width += F - r, Y.x = r), nt < c && (Y.width = c - F), t.splice(e, 1);
                  break;
                }
              } else {
                P > d && (Y.height += P - d, Y.y = d), lt < x && (Y.height = x - P), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, xt.findHostInstance = od, xt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? v(t) : null, t === null ? null : il(t.stateNode);
      }, xt.findHostInstanceWithWarning = function(t) {
        return od(t);
      }, xt.flushPassiveEffects = rl, xt.flushSyncFromReconciler = function(t) {
        var e = wt;
        wt |= 1;
        var l = dt.T, r = sn();
        try {
          if (It(2), dt.T = null, t)
            return t();
        } finally {
          It(r), dt.T = l, wt = e, (wt & 6) === 0 && pa(0);
        }
      }, xt.flushSyncWork = Lu, xt.focusWithin = function(t, e) {
        if (!sl) throw Error(o(363));
        for (t = ds(t), e = Uu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var l = e[t++], r = l.tag;
          if (!ol(l)) {
            if ((r === 5 || r === 26 || r === 27) && xh(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              e.push(l), l = l.sibling;
          }
        }
        return !1;
      }, xt.getFindAllNodesFailureDescription = function(t, e) {
        if (!sl) throw Error(o(363));
        var l = 0, r = [];
        t = [ds(t), 0];
        for (var c = 0; c < t.length; ) {
          var d = t[c++], x = d.tag, A = t[c++], Y = e[A];
          if ((x !== 5 && x !== 26 && x !== 27 || !ol(d)) && (fs(d, Y) && (r.push(ms(Y)), A++, A > l && (l = A)), A < e.length))
            for (d = d.child; d !== null; )
              t.push(d, A), d = d.sibling;
        }
        if (l < e.length) {
          for (t = []; l < e.length; l++)
            t.push(ms(e[l]));
          return `findAllNodes was able to match part of the selector:
  ` + (r.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, xt.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return il(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, xt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Wp,
          rendererPackageName: Fp,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (pd !== null && (t.rendererConfig = pd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              cl = e.inject(t), ke = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, xt.isAlreadyRendering = function() {
        return (wt & 6) !== 0;
      }, xt.observeVisibleRects = function(t, e, l, r) {
        if (!sl) throw Error(o(363));
        t = ps(t, e);
        var c = wh(
          t,
          l,
          r
        ).disconnect;
        return {
          disconnect: function() {
            c();
          }
        };
      }, xt.shouldError = function() {
        return null;
      }, xt.shouldSuspend = function() {
        return !1;
      }, xt.startHostTransition = function(t, e, l, r) {
        if (t.tag !== 5) throw Error(o(476));
        var c = Xc(t).queue;
        Kc(
          t,
          c,
          e,
          wa,
          l === null ? s : function() {
            var d = Xc(t);
            return d.next === null && (d = t.alternate.memoizedState), Ia(
              t,
              d.next.queue,
              {},
              xe()
            ), l(r);
          }
        );
      }, xt.updateContainer = function(t, e, l, r) {
        var c = e.current, d = xe();
        return cd(
          c,
          d,
          t,
          e,
          l,
          r
        ), d;
      }, xt.updateContainerSync = function(t, e, l, r) {
        return cd(
          e.current,
          2,
          t,
          e,
          l,
          r
        ), 2;
      }, xt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(io)), io.exports;
}
var sf;
function p0() {
  return sf || (sf = 1, ro.exports = m0()), ro.exports;
}
var h0 = p0();
const dm = /* @__PURE__ */ Qo(h0);
var g0 = um(), co = { exports: {} }, mn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var of;
function b0() {
  return of || (of = 1, mn.ConcurrentRoot = 1, mn.ContinuousEventPriority = 8, mn.DefaultEventPriority = 32, mn.DiscreteEventPriority = 2, mn.IdleEventPriority = 268435456, mn.LegacyRoot = 0, mn.NoEventPriority = 0), mn;
}
var cf;
function v0() {
  return cf || (cf = 1, co.exports = b0()), co.exports;
}
var Qa = v0();
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
const fm = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], _o = 16, gi = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), y0 = [
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
], uf = {
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
}, x0 = /* @__PURE__ */ new Set([
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
]), mm = {
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
}, pm = {
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
}, ko = ["font-size", "color", ...new Set([...Object.keys(mm), ...Object.keys(pm)].filter((n) => n !== "font-size" && n !== "color"))], w0 = new Set(ko);
function se(n, a = " ") {
  const i = [];
  let s = 0, o = "";
  for (let u = 0; u < n.length; u++) {
    const m = n[u];
    if (m === "(" ? s++ : m === ")" && s--, s === 0 && (a === " " ? /\s/.test(m) : m === a)) {
      (o.trim() || a !== " ") && i.push(o.trim()), o = "";
      continue;
    }
    o += m;
  }
  return (o.trim() || a !== " " && i.length) && i.push(o.trim()), i;
}
function So(n, a, i = 0) {
  if (i > 32) return null;
  let s = "", o = 0;
  for (; ; ) {
    const u = n.indexOf("var(", o);
    if (u < 0)
      return s += n.slice(o), s;
    s += n.slice(o, u);
    let m = 1, f = u + 4;
    for (; f < n.length && m; f++)
      n[f] === "(" ? m++ : n[f] === ")" && m--;
    const p = n.slice(u + 4, f - 1), v = se(p, ","), w = v[0].trim(), y = v.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let b = a(w);
    if ((b == null || b === "initial") && (b = y), b == null) return null;
    const S = So(b, a, i + 1);
    if (S === null) return null;
    s += S, o = f;
  }
}
function _0(n) {
  const a = [], i = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let s, o = 0;
  for (; o < n.length; ) {
    if (i.lastIndex = o, s = i.exec(n), !s || s.index !== o) {
      if (/^\s+$/.test(n.slice(o))) break;
      return null;
    }
    o = i.lastIndex, s[1] !== void 0 ? a.push({ num: parseFloat(s[1]), unit: (s[2] ?? "").toLowerCase() }) : s[3] ? a.push({ fn: s[3].toLowerCase() }) : s[4] ? a.push({ num: 1 / 0, unit: "" }) : a.push({ op: s[5] ?? s[6] });
  }
  return a;
}
function Yn(n, a) {
  const i = _0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!i) return null;
  let s = 0;
  const o = ({ num: b, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: b, unitless: !0 };
      case "px":
        return { px: b, pct: 0, num: 0 };
      case "rem":
        return { px: b * _o, pct: 0, num: 0 };
      case "em":
        return { px: b * (a.fontSize ?? _o), pct: 0, num: 0 };
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
  }, u = (b, S, T) => b && S ? { px: b.px + T * S.px, pct: b.pct + T * S.pct, num: b.num + T * S.num, unitless: b.unitless && S.unitless } : null, m = (b, S) => b ? { px: b.px * S, pct: b.pct * S, num: b.num * S, unitless: b.unitless } : null, f = (b) => b && b.unitless;
  function p() {
    const b = i[s++];
    if (!b) return null;
    if (b.num !== void 0) return o(b);
    if (b.op === "(") {
      const S = w();
      return i[s]?.op !== ")" ? null : (s++, S);
    }
    if (b.op === "-" || b.op === "+") {
      const S = p();
      return b.op === "-" ? m(S, -1) : S;
    }
    if (b.fn) {
      const S = [];
      for (; ; ) {
        S.push(w());
        const M = i[s++];
        if (!M) return null;
        if (M.op === ")") break;
        if (M.op !== ",") return null;
      }
      if (S.some((M) => !M)) return null;
      if (b.fn === "calc") return S[0];
      if (!(S.every((M) => !M.pct) || S.every((M) => !M.px && !M.num))) return null;
      const z = (M) => M.px + M.pct + M.num;
      return b.fn === "min" ? S.reduce((M, j) => z(j) < z(M) ? j : M) : b.fn === "max" ? S.reduce((M, j) => z(j) > z(M) ? j : M) : b.fn === "clamp" && S.length === 3 ? z(S[1]) < z(S[0]) ? S[0] : z(S[1]) > z(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function v() {
    let b = p();
    for (; i[s] && (i[s].op === "*" || i[s].op === "/"); ) {
      const S = i[s++].op, T = p();
      if (!b || !T) return null;
      S === "*" ? b = f(T) ? m(b, T.num) : f(b) ? m(T, b.num) : null : b = f(T) && T.num !== 0 ? m(b, 1 / T.num) : null;
    }
    return b;
  }
  function w() {
    let b = v();
    for (; i[s] && (i[s].op === "+" || i[s].op === "-"); ) {
      const S = i[s++].op;
      b = u(b, v(), S === "-" ? -1 : 1);
    }
    return b;
  }
  const y = w();
  return s !== i.length || !y ? null : y;
}
function Eo(n, a) {
  const i = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(i))
    return i === "thin" ? { px: 1 } : i === "medium" ? { px: 3 } : i === "thick" ? { px: 5 } : i;
  const s = Yn(i, a);
  return s ? s.unitless ? s.num === 0 ? { px: 0 } : { expr: n.trim() } : s.pct && (s.px || s.num) ? { expr: n.trim() } : s.pct ? { pct: s.pct } : { px: k0(s.px) } : { expr: n.trim() };
}
const k0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Ur = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), S0 = ([n, a, i, s]) => `#${Ur(n)}${Ur(a)}${Ur(i)}${Ur(s * 255)}`;
function df(n) {
  const a = n.slice(1), i = a.length <= 4 ? a.split("").map((o) => o + o).join("") : a;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return null;
  const s = (o) => parseInt(i.slice(o, o + 2), 16);
  return [s(0), s(2), s(4), i.length === 8 ? s(6) / 255 : 1];
}
function ei(n, a) {
  const i = n.trim().toLowerCase();
  if (i === "currentcolor") return "currentcolor";
  const s = /^perchtoken\(([a-z0-9-]+)\)$/.exec(i);
  if (s) {
    const v = a(s[1]), w = v && df(v);
    return w ? { rgba: w, token: s[1] } : null;
  }
  if (i.startsWith("#")) {
    const v = df(i);
    return v ? { rgba: v, token: null } : null;
  }
  if (uf[i]) return { rgba: [...uf[i]], token: null };
  const o = /^(rgba?|color-mix)\((.*)\)$/s.exec(i);
  if (!o) return null;
  if (o[1] === "color-mix") {
    const v = se(o[2], ",");
    if (v.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(v[0])) return null;
    const w = (R) => {
      const Q = se(R), $ = Q.findIndex((I) => /%$/.test(I)), U = $ >= 0 ? parseFloat(Q[$]) / 100 : null;
      return { color: ei(Q.filter((I, L) => L !== $).join(" "), a), pct: U };
    }, y = w(v[1]), b = w(v[2]);
    if (!y.color || !b.color || y.color === "currentcolor" || b.color === "currentcolor") return null;
    let S = y.pct, T = b.pct;
    S === null && T === null ? (S = 0.5, T = 0.5) : S === null ? S = 1 - T : T === null && (T = 1 - S);
    const z = S + T, M = z < 1 ? z : 1;
    S /= z, T /= z;
    const [j, O, B, W] = y.color.rgba, [J, D, g, h] = b.color.rgba, _ = W * S + h * T, k = (R, Q) => _ === 0 ? 0 : (R * W * S + Q * h * T) / _, N = [k(j, J), k(O, D), k(B, g), _ * M], E = h === 0 ? y.color.token : W === 0 ? b.color.token : null;
    return { rgba: N, token: E };
  }
  const u = o[2].includes(",") ? se(o[2], ",") : se(o[2].replace("/", " / ")).filter((v) => v !== "/");
  if (u.length < 3) return null;
  const m = (v) => v.endsWith("%") ? parseFloat(v) / 100 * 255 : parseFloat(v), f = u[3] === void 0 ? 1 : u[3].endsWith("%") ? parseFloat(u[3]) / 100 : parseFloat(u[3]), p = [m(u[0]), m(u[1]), m(u[2]), f];
  return p.some((v) => Number.isNaN(v)) ? null : { rgba: p, token: null };
}
const El = ["top", "right", "bottom", "left"], E0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Gr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], ff = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function zo(n, a) {
  const i = a.trim(), s = () => se(i);
  switch (n) {
    case "padding":
    case "margin": {
      const o = Gr(s());
      return El.map((u, m) => [`${n}-${u}`, o[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const o = s(), u = n.split("-")[0];
      return [[`${u}-left`, o[0]], [`${u}-right`, o[1] ?? o[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const o = s(), u = n.split("-")[0];
      return [[`${u}-top`, o[0]], [`${u}-bottom`, o[1] ?? o[0]]];
    }
    case "padding-inline-start":
    case "margin-inline-start":
      return [[`${n.split("-")[0]}-left`, i]];
    case "padding-inline-end":
    case "margin-inline-end":
      return [[`${n.split("-")[0]}-right`, i]];
    case "padding-block-start":
    case "margin-block-start":
      return [[`${n.split("-")[0]}-top`, i]];
    case "padding-block-end":
    case "margin-block-end":
      return [[`${n.split("-")[0]}-bottom`, i]];
    case "inset": {
      const o = Gr(s());
      return El.map((u, m) => [u, o[m]]);
    }
    case "inset-inline": {
      const o = s();
      return [["left", o[0]], ["right", o[1] ?? o[0]]];
    }
    case "inset-block": {
      const o = s();
      return [["top", o[0]], ["bottom", o[1] ?? o[0]]];
    }
    case "inset-inline-start":
      return [["left", i]];
    case "inset-inline-end":
      return [["right", i]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const o = n.split("-")[1], u = Gr(s());
      return El.map((m, f) => [`border-${m}-${o}`, u[f]]);
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
      const o = n === "border" ? El : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let u = "medium", m = "none", f = "currentcolor";
      if (i !== "none" && i !== "0")
        for (const p of s())
          ff.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? u = p : f = p;
      else i === "0" && (u = "0");
      return o.flatMap((p) => [[`border-${p}-width`, u], [`border-${p}-style`, m], [`border-${p}-color`, f]]);
    }
    case "border-inline-width": {
      const o = s();
      return [["border-left-width", o[0]], ["border-right-width", o[1] ?? o[0]]];
    }
    case "border-block-width": {
      const o = s();
      return [["border-top-width", o[0]], ["border-bottom-width", o[1] ?? o[0]]];
    }
    case "border-inline-style": {
      const o = s();
      return [["border-left-style", o[0]], ["border-right-style", o[1] ?? o[0]]];
    }
    case "border-inline-color": {
      const o = s();
      return [["border-left-color", o[0]], ["border-right-color", o[1] ?? o[0]]];
    }
    case "border-radius": {
      const o = Gr(se(i.split("/")[0]));
      return E0.map((u, m) => [`border-${u}-radius`, o[m]]);
    }
    case "border-start-start-radius":
      return [["border-top-left-radius", i]];
    case "border-start-end-radius":
      return [["border-top-right-radius", i]];
    case "border-end-start-radius":
      return [["border-bottom-left-radius", i]];
    case "border-end-end-radius":
      return [["border-bottom-right-radius", i]];
    case "background":
      return i === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : ei(i, () => "#000000") ? [["background-color", i], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", i]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(i) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((o) => [o, i]) : [[n, i]];
    case "overflow": {
      const o = s();
      return [["overflow-x", o[0]], ["overflow-y", o[1] ?? o[0]]];
    }
    case "gap": {
      const o = s();
      return [["row-gap", o[0]], ["column-gap", o[1] ?? o[0]]];
    }
    case "grid-gap":
      return zo("gap", i);
    case "place-items": {
      const o = s();
      return [["align-items", o[0]], ["justify-items", o[1] ?? o[0]]];
    }
    case "place-self": {
      const o = s();
      return [["align-self", o[0]], ["justify-self", o[1] ?? o[0]]];
    }
    case "place-content": {
      const o = s();
      return [["align-content", o[0]], ["justify-content", o[1] ?? o[0]]];
    }
    case "flex": {
      if (i === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (i === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (i === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const o = s(), u = o.filter((f) => /^[\d.]+$/.test(f)), m = o.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", u[0] ?? "1"], ["flex-shrink", u[1] ?? "1"], ["flex-basis", m ?? (u.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const o = [];
      for (const u of s()) o.push(/wrap/.test(u) ? ["flex-wrap", u] : ["flex-direction", u]);
      return o;
    }
    case "outline": {
      if (i === "none" || i === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let o = "medium", u = "none", m = "currentcolor";
      for (const f of s())
        ff.has(f) || f === "auto" ? u = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? o = f : m = f;
      return [["outline-width", o], ["outline-style", u], ["outline-color", m]];
    }
    case "transition": {
      if (i === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const o = se(i, ","), u = o.map((f) => se(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = o.map((f) => se(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", u.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", s()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", i]];
    case "word-wrap":
      return [["overflow-wrap", i]];
    default:
      return [[n, i]];
  }
}
function z0(n, a) {
  return n ? se(n, ",").some((i) => {
    let s = i.trim().toLowerCase(), o = !1;
    s.startsWith("not ") && (o = !0, s = s.slice(4)), s.startsWith("only ") && (s = s.slice(5));
    const u = s.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), v = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (v) {
        const [, y, b] = v, S = (T) => {
          const z = Eo(T, { viewport: a });
          return typeof z == "object" && "px" in z ? z.px : NaN;
        };
        switch (y) {
          case "min-width":
            return a.width >= S(b);
          case "max-width":
            return a.width <= S(b);
          case "min-height":
            return a.height >= S(b);
          case "max-height":
            return a.height <= S(b);
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
      const w = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (w) {
        const y = w[1] === "width" ? a.width : a.height, b = Eo(w[3], { viewport: a }), S = typeof b == "object" && "px" in b ? b.px : NaN;
        switch (w[2]) {
          case ">=":
            return y >= S;
          case "<=":
            return y <= S;
          case ">":
            return y > S;
          case "<":
            return y < S;
          default:
            return y === S;
        }
      }
      return !1;
    });
    return o ? !u : u;
  }) : !0;
}
function N0(n, a) {
  const i = a[a.length - 1].compound;
  return Vo(i)[0] ?? n;
}
function T0(n) {
  const a = (i) => i.some((s) => gi.has(s.name) || (s.list ?? []).some((o) => o.some(({ compound: u }) => a(u.pseudos))));
  return a(n[n.length - 1].compound.pseudos);
}
function M0(n) {
  const a = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), s = (o, u) => {
    o.forEach(({ compound: m }, f) => {
      const p = u && f === o.length - 1;
      for (const v of m.pseudos)
        if (gi.has(v.name) && (p ? a : i).add(v.name), v.list && v.name !== "not") for (const w of v.list) s(w, p);
    });
  };
  return s(n, !0), { subject: a, ancestor: i };
}
function Vo(n) {
  const a = [...n.classes];
  for (const i of n.pseudos)
    if (!(i.name !== "is" && i.name !== "where"))
      for (const s of i.list) s.length === 1 && a.push(...Vo(s[0].compound));
  return a;
}
function C0(n, a) {
  const i = (s, o) => {
    s.forEach(({ compound: u }, m) => {
      const f = o && m === s.length - 1, p = u.pseudos.filter((v) => gi.has(v.name)).map((v) => v.name);
      if (!f) for (const v of p) for (const w of Vo(u)) a.add(`${v}:${w}`);
      for (const v of u.pseudos) if (v.list && v.name !== "not") for (const w of v.list) i(w, f);
    });
  };
  i(n, !0);
}
class A0 {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map(), this.selectorAttrs = /* @__PURE__ */ new Set(), this.subjectAttrs = /* @__PURE__ */ new Set();
    const i = (u, m) => {
      const f = m[m.length - 1].compound;
      for (const v of f.attrs) this.subjectAttrs.add(v.name);
      const p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(u);
    };
    let s = 0;
    const o = (u, m) => {
      for (const [f, p, v, w] of u)
        for (const y of qo(f)) {
          let b;
          try {
            b = Yo(y);
          } catch (M) {
            if (M instanceof ie) {
              this.skipped++;
              continue;
            }
            throw M;
          }
          const S = M0(b);
          bm(b, this.selectorAttrs), C0(b, this.trackedStates);
          const T = b[b.length - 1].compound.pseudoElement, z = { steps: b, media: p, layer: v, origin: m, order: s++, specificity: tm(b), decls: w, states: S, pseudo: T, own: D0(b), assumed: T0(b), above: O0(b), source: m === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : N0(y, b) };
          this.rules.push(z), i(z, b);
        }
    };
    o(y0.map(([u, m]) => [u, null, 0, Object.entries(m)]), 0), o(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, i = null, s = null) {
    const o = `${a.tagName} ${a.className}|${i ?? ""}|${s ?? ""}`, u = this.candidateCache.get(o);
    if (u) return u;
    if (s !== null) {
      const w = this.candidates(a, i).filter((y) => {
        const b = y.reads ??= No(y.steps);
        return (b.has || b.focusWithin) === s;
      });
      return this.candidateCache.set(o, w), w;
    }
    const m = [], f = /* @__PURE__ */ new Set(), p = new Set(a.classList), v = (w) => {
      if (w) for (const y of w) !f.has(y) && y.pseudo === i && (f.add(y), hm(y.steps[y.steps.length - 1].compound, a.tagName, p) && m.push(y));
    };
    for (const w of a.classList) v(this.index.get(`.${w}`));
    return v(this.index.get(a.tagName)), v(this.index.get("*")), this.candidateCache.set(o, m), m;
  }
  /** What the rules that may match `element` (any pseudo-element) read besides the element and its parent's computed
   * style: `anc`, an ancestor's attributes or state; `pos`, whether it is its parent's first or last child; `nth`, its
   * index; `ancPos`, an ancestor's position. The description's cache keys on exactly these (`describe.mjs`). */
  depends(a) {
    const i = a.dependsIn;
    if (i && i.sheet === this && i.version === a.version) return i.deps;
    const s = this.dependsOf(a);
    return a.version !== void 0 && (a.dependsIn = { sheet: this, version: a.version, deps: s }), s;
  }
  dependsOf(a) {
    const i = (f) => a.getAttribute?.(f) != null;
    let s = `${a.tagName} ${a.className}`;
    for (const f of this.subjectAttrs) i(f) && (s += ` [${f}]`);
    let o = this.dependsCache.get(s);
    if (o) return o;
    o = { anc: !1, pos: !1, nth: !1, ancPos: !1, has: !1, focusWithin: !1 };
    const u = /* @__PURE__ */ new Set(), m = (f) => {
      for (const p of f ?? []) {
        if (u.has(p) || !p.steps[p.steps.length - 1].compound.attrs.every((w) => i(w.name))) continue;
        u.add(p);
        const v = p.reads ??= No(p.steps);
        o.anc ||= v.anc, o.pos ||= v.pos, o.nth ||= v.nth, o.ancPos ||= v.ancPos, o.has ||= v.has, o.focusWithin ||= v.focusWithin;
      }
    };
    for (const f of a.classList) m(this.index.get(`.${f}`));
    return m(this.index.get(a.tagName)), m(this.index.get("*")), this.dependsCache.set(s, o), o;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(a, i) {
    return this.candidates(a).some((s) => s.states.ancestor.has(i));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(a, i) {
    for (const s of a.classList) if (this.trackedStates.has(`${i}:${s}`)) return !0;
    return !1;
  }
}
function hm(n, a, i) {
  if (n.tag && n.tag !== "*" && n.tag !== a) return !1;
  for (const s of n.classes) if (!i.has(s)) return !1;
  for (const s of n.pseudos) {
    if (s.name === "has") return !0;
    if (s.name === "root" && a !== "html" || (s.name === "where" || s.name === "is") && s.list.every((o) => o.length === 1 && !hm(o[0].compound, a, i))) return !1;
  }
  return !0;
}
const j0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function O0(n) {
  const a = [];
  for (let i = n.length - 1; i > 0 && !(n[i].combinator !== " " && n[i].combinator !== ">"); i--)
    a.push(...n[i - 1].compound.classes);
  return a;
}
function gm(n) {
  const a = n.parentElement;
  if (!a) return R0;
  const i = gm(a), s = n.aboveCache;
  if (s && s.parent === a && s.name === a.className && s.base === i) return s.set;
  const o = a.classSet, u = o.size === 0 ? i : /* @__PURE__ */ new Set([...i, ...o]);
  return n.aboveCache = { parent: a, name: a.className, base: i, set: u }, u;
}
const R0 = /* @__PURE__ */ new Set();
function D0(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((i) => gi.has(i.name) && i.name !== "focus-within");
}
function bm(n, a) {
  for (const { compound: i } of n) {
    for (const s of i.attrs) a.add(s.name);
    for (const s of i.pseudos) for (const o of s.list ?? []) bm(o, a);
  }
}
function No(n, a = !0, i = { anc: !1, pos: !1, nth: !1, ancPos: !1, has: !1, focusWithin: !1 }) {
  return n.forEach((s, o) => {
    const u = a && o === n.length - 1;
    u || (i.anc = !0);
    for (const m of s.compound.pseudos)
      if (j0.has(m.name) && (u ? i.pos = !0 : i.ancPos = !0, m.name === "nth-child" && u && (i.nth = !0)), m.name === "has" && (i.has = !0), m.name === "focus-within" && (i.focusWithin = !0), m.list && m.name !== "has") for (const f of m.list) No(f, u, i);
  }), i;
}
const H0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function mf(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [i, s] of Object.entries(n)) {
    if (s == null || s === "" || typeof s == "boolean") continue;
    const o = i.startsWith("--") ? i : i.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), u = typeof s == "number" && s !== 0 && !H0.has(o) && !o.startsWith("--") ? `${s}px` : String(s);
    a.push([o, u]);
  }
  return a;
}
const B0 = { className: "class", htmlFor: "for", tabIndex: "tabindex" };
function pf(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const i of ["width", "height"]) {
    const s = n.getAttribute(i);
    s !== null && a.push([i, /^[\d.]+$/.test(s) ? `${s}px` : s]);
  }
  return a;
}
const U0 = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class G0 {
  constructor(a, { theme: i, viewport: s }) {
    this.sheet = a, this.theme = i, this.viewport = s, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map(), this.pass = null, this.matched = /* @__PURE__ */ new Map(), this.signatures = /* @__PURE__ */ new Map(), this.nextSignature = 0;
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const i of a.media) {
      let s = this.media.get(i);
      if (s === void 0 && this.media.set(i, s = z0(i, this.viewport)), !s) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, i, s = null, o = null) {
    if (!this.pass) return this.match(a, i, s, o);
    const u = `${this.signature(a)}|${s ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let m = this.matched.get(u);
    m || (this.matched.size > 2e4 && (this.matched.clear(), this.signatures.clear()), this.matched.set(u, m = this.match(a, i, s, o, !1)));
    const f = this.match(a, i, s, o, !0);
    return f.length ? [...m, ...f] : m;
  }
  /** A number for what a selector can read of `element` and its ancestors (tag, classes, id, the attributes some
   * selector reads, state, position among its siblings, being the root): equal numbers match the same rules. Worked
   * out once per element per describe pass. */
  signature(a) {
    if (!a) return -1;
    const i = a.signatureIn;
    if (i && i.pass === this.pass) return i.id;
    const s = a.parentElement, o = this.sheet.depends(a), u = (b) => {
      let S = b.parentElement.kidsIn;
      return (!S || S.pass !== this.pass) && (b.parentElement.kidsIn = S = { pass: this.pass, list: b.parentElement.children }), `${S.list.indexOf(b)}/${S.list.length}.`;
    };
    let m = o.pos && s ? u(a) : "";
    if (o.ancPos) for (let b = s; b?.parentElement; b = b.parentElement) m += u(b);
    let f = "";
    for (const b in a.props ?? {}) {
      const S = B0[b] ?? b;
      if (!this.sheet.selectorAttrs.has(S)) continue;
      const T = a.getAttribute(S);
      T !== null && (f += `${S}=${T}`);
    }
    const p = a.state, v = a.props ?? {}, w = `${this.signature(s)}\0${a.tagName} ${a.className}#${a.getAttribute?.("id") ?? ""}[${f}]${+!!p?.hover}${+!!p?.focus}${+!!p?.active}${+!!p?.pointerFocus}${+!!v.disabled}${+!!v.checked}${+!!a.isDocumentRoot}@${m}`;
    let y = this.signatures.get(w);
    return y === void 0 && this.signatures.set(w, y = this.nextSignature++), a.signatureIn = { pass: this.pass, id: y }, y;
  }
  /** Everything of `element` its own style is computed from, its parent's style aside (`signature`, presentational
   * attributes, inline style, `hidden`): elements with equal keys under one parent style compute alike. */
  partKey(a) {
    const i = pf(a), s = mf(a.inlineStyle ?? a.props?.style);
    return `${this.signature(a)}|${i.length ? JSON.stringify(i) : ""}|${s.length ? JSON.stringify(s) : ""}|${+!!a.hidden}`;
  }
  /** `matching` without the memo; with `live` true only the rules that read descendants or focus, false the others. */
  match(a, i, s = null, o = null, u = null) {
    const f = { state: (z, M, j) => {
      if (M === "disabled") return !!z.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(z.tagName);
      if (M === "enabled") return !z.props?.disabled && ["button", "input", "select", "textarea"].includes(z.tagName);
      if (M === "checked") return !!z.props?.checked;
      if (i === "*") return !0;
      if (M === "focus-within") {
        const O = z.ownerDocument?.activeElement;
        return !!O && O !== z.ownerDocument.body && typeof z.contains == "function" && z.contains(O);
      }
      return j ? i.has(M) : M === "focus-visible" ? !!z.state?.focus && !z.state?.pointerFocus : !!z.state?.[M];
    }, pseudo: s }, p = u === null ? this.sheet.candidates(a, s) : this.sheet.candidates(a, s, u), v = `${a.tagName} ${a.className}|${s ?? ""}|${u ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let w = this.ownMatches.get(v);
    w || (w = new Set(p.filter((z) => z.own && this.mediaHolds(z) && bo(a, z.steps, f))), this.ownMatches.set(v, w));
    let y = null;
    const b = (z) => z.above.length ? (y ??= gm(a), z.above.every((M) => y.has(M))) : !0, S = o && i !== "*" ? o[s ?? ""] ??= /* @__PURE__ */ new Map() : null, T = (z) => this.mediaHolds(z) && b(z) && bo(a, z.steps, f);
    return p.filter((z) => {
      if (z.own) return w.has(z);
      if (!S || z.assumed) return T(z);
      let M = S.get(z);
      return M === void 0 && S.set(z, M = T(z)), M;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, i, s = /* @__PURE__ */ new Set(), o = null, u = null) {
    const m = this.matching(a, s, o, u), f = o ? [] : pf(a), p = o ? [] : mf(a.inlineStyle ?? a.props?.style);
    let v = this.rootComputed;
    i && (v = this.computed.get(i.values), v || this.computed.set(i.values, v = /* @__PURE__ */ new Map()));
    const w = `${m.map((b) => b.order).join(",")}|${f.length ? JSON.stringify(f) : ""}|${p.length ? JSON.stringify(p) : ""}`;
    let y = v.get(w);
    return y || v.set(w, y = this.cascade(m, f, p, i)), { ...y, rules: m, element: a, shared: y };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, i, s, o) {
    const u = [];
    for (const g of a)
      for (const [h, _, k] of g.decls) u.push({ prop: h, value: _, important: k ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of i) u.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of s) u.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    u.sort(U0);
    const m = this.sheet.properties, f = Object.create(o?.customs ?? null), p = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
    for (const g of u) g.prop.startsWith("--") && v.set(g.prop, g.value);
    if (!o && this.theme) for (const g of fm) this.theme[g] && v.set(`--${g}`, `perchtoken(${g})`);
    const w = (g) => {
      if (p.has(g)) return p.get(g);
      const h = m[g];
      return h && !h.inherits ? h.initial ?? null : g in f ? f[g] : h?.initial ?? null;
    }, y = /* @__PURE__ */ new Set(), b = (g) => {
      if (!v.has(g)) return w(g);
      if (y.has(g)) return null;
      y.add(g);
      const h = So(v.get(g), b);
      return y.delete(g), v.delete(g), p.set(g, h), (!m[g] || m[g].inherits) && (f[g] = h), h;
    };
    for (const g of [...v.keys()]) b(g);
    const S = /* @__PURE__ */ new Map();
    for (const g of u) {
      if (g.prop.startsWith("--")) continue;
      const h = So(g.value, w);
      if (h === null) {
        for (const [_] of zo(g.prop, "unset")) S.set(_, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [_, k] of zo(g.prop, h)) S.set(_, { value: k, source: g.source, origin: g.origin });
    }
    const T = {}, z = {}, M = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), O = o?.values, B = { fontSize: O?.["font-size"] ?? _o, viewport: this.viewport }, W = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, B, T, O);
      const _ = `${g}\0${h}\0${B.fontSize}`;
      let k = this.parsed.get(_);
      return k === void 0 && this.parsed.set(_, k = this.parseValue(g, h, B, T, O)), k;
    }, J = S.size ? [...ko, ...[...S.keys()].filter((g) => !w0.has(g))] : ko;
    for (const g of J) {
      const h = S.get(g);
      let _ = h?.value;
      const k = x0.has(g);
      if ((_ === void 0 || _ === "unset" || _ === "revert" || _ === "revert-layer") && (_ = k ? "inherit" : "initial"), h && (z[g] = h.source, h.origin !== 0 && M.add(g)), _ === "inherit" && O && g in O) {
        T[g] = O[g], j.add(g);
        continue;
      }
      (_ === "inherit" || _ === "initial") && (_ = k ? pm[g] : mm[g]), T[g] = W(g, _), g === "font-size" && (B.fontSize = T["font-size"]);
    }
    for (const g of El) {
      const h = T[`border-${g}-style`];
      (h === "none" || h === "hidden") && (T[`border-${g}-width`] = { px: 0 });
    }
    T["outline-style"] === "none" && (T["outline-width"] = { px: 0 });
    const D = O?.display;
    return (D === "flex" || D === "inline-flex" || D === "grid" || D === "inline-grid") && T.position !== "absolute" && T.position !== "fixed" && (T.display = hf(T.display)), (T.position === "absolute" || T.position === "fixed") && (T.display = hf(T.display)), { values: T, sources: z, own: M, inherited: j, customs: f };
  }
  parseValue(a, i, s, o, u) {
    const m = String(i).trim();
    switch (a) {
      case "font-size": {
        const f = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[f]) return p[f];
        if (f === "smaller") return s.fontSize / 1.2;
        if (f === "larger") return s.fontSize * 1.2;
        const v = Yn(f, { fontSize: s.fontSize, viewport: s.viewport });
        return !v || v.num ? s.fontSize : v.px + v.pct / 100 * s.fontSize;
      }
      case "font-weight": {
        const f = m.toLowerCase();
        if (f === "normal") return 400;
        if (f === "bold") return 700;
        if (f === "bolder") return (u?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (f === "lighter") return (u?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const p = parseFloat(f);
        return Number.isFinite(p) ? p : 400;
      }
      case "line-height": {
        const f = m.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const p = Yn(f, { fontSize: s.fontSize, viewport: s.viewport });
        return p ? p.unitless ? { factor: p.num } : { px: p.px + p.pct / 100 * s.fontSize } : { normal: !0 };
      }
      case "font-family":
        return m;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const f = m.endsWith("%") ? parseFloat(m) / 100 : parseFloat(m);
        return Number.isFinite(f) ? f : parseFloat(a === "flex-shrink" || a === "opacity" ? 1 : 0);
      }
      case "color": {
        const f = ei(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? u?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = ei(m, (p) => this.themeHex(p));
        return f === "currentcolor" ? o.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return Eo(m, s);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function hf(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const ni = (n) => n && n.rgba ? { value: S0(n.rgba), token: n.token ?? null } : null, q0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Y0(n, a) {
  const i = a?.(n);
  if (Number.isFinite(i)) return i;
  const s = Math.round(n * 100) / 100;
  return q0[s] ?? Math.round(n * 1.2);
}
function Nl(n, a) {
  const i = n["line-height"], s = n["font-size"];
  return i.normal ? Y0(s, a) : i.factor !== void 0 ? i.factor * s : i.px;
}
const L0 = (n) => se(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Q0 = "perch-native-description/1", Le = Symbol("display"), ai = {
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
}, V0 = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of V0) ai[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ai.rounded = 0;
const K0 = /* @__PURE__ */ new Set([
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
]), X0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Z0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, J0 = /^\s*["']?(ui-monospace|sfmono-regular|sf mono)["']?\s*(,|$)/i, W0 = (n) => J0.test(n ?? "") ? ".AppleSystemUIFontMonospaced" : Z0.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : X0.test(n) ? ".SystemUIFont" : L0(n).split(",")[0].trim(), vm = {
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
}, gf = Object.keys(vm), bf = Object.fromEntries(Object.entries(vm).flatMap(([n, a], i) => a.map((s) => [s, 1 << i]))), vf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Dl = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const i = n.classList.find((o) => !o.includes(":") && !o.includes("[")) ?? n.classList[0];
  if (i) return `${n.tagName}.${i}`;
  const s = n.parentElement;
  return s && s.tagName !== "body" ? `${Dl(s)} > ${n.tagName}` : n.tagName;
};
class F0 {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(a, i, s, o, u, m = "") {
    const f = `${a}|${i}|${s}|${o}`, p = this.map.get(f);
    if (p) {
      !p.elements.includes(u) && p.elements.length < 4 && p.elements.push(u), p.count++;
      return;
    }
    this.map.set(f, { kind: a, property: i, value: String(s), class: o ?? null, elements: [u], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((a, i) => a.kind < i.kind ? -1 : a.kind > i.kind ? 1 : a.property < i.property ? -1 : a.property > i.property ? 1 : 0);
  }
}
const hn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, $0 = /^(text|search|url|email|tel|password|number)$/, I0 = 162.13 / 12.8;
function P0(n, a) {
  const i = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!i) return;
  const s = se(i[1], ",").map((o) => Yn(o.trim(), { fontSize: a })).filter((o) => o && !o.pct && !o.num).map((o) => o.px);
  return s.length ? Math.min(...s) : void 0;
}
function tb(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const i = Yn(n.expr, { fontSize: a["font-size"] }), s = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!i && !i.num && i.pct === 100 && Math.abs(i.px + s) < 0.01;
}
function ym(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const s = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), o = s && se(s[2], ",").map((u) => u.trim());
    return !o || o.length > (s[1] ? 1 : 2) ? null : s[1] === "X" ? [o[0], "0"] : s[1] === "Y" ? ["0", o[0]] : [o[0], o[1] ?? "0"];
  }
  const i = n.translate;
  if (i && i !== "none") {
    const s = se(String(i).trim(), " ").filter(Boolean);
    return s.length > 3 || s[2] !== void 0 && Yn(s[2], {})?.px ? null : [s[0], s[1] ?? "0"];
  }
  return [];
}
function yf(n, a, i, s = !1) {
  const o = n.values, u = ym(o);
  if (u?.length === 0) return;
  const m = o.transform && o.transform !== "none" ? "transform" : "translate", f = { fontSize: o["font-size"] }, p = (y, b) => {
    const S = Yn(y, f);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof b == "number" ? S.px + S.pct / 100 * b : void 0 : S.px;
  }, v = u ? p(u[0], a.w) : void 0, w = u ? p(u[1], a.h) : void 0;
  if (v === void 0 || w === void 0) {
    const y = !s && u ? u.map((b) => Yn(b, f)) : null;
    if (y?.every((b) => b && !(b.unitless && b.num))) {
      a[xm] = y.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    i("unsupported", m, o[m], n.sources[m]);
    return;
  }
  if (s) {
    v && (a.left = v), w && (a.top = w);
    return;
  }
  v && (a.ml = (a.ml ?? 0) + v), w && (a.mt = (a.mt ?? 0) + w);
}
const xm = Symbol("perch.shift");
function eb(n, a, i) {
  const s = n.ownerDocument, o = s?.measure?.(n) ?? null;
  if (o) {
    const [[m, f], [p, v]] = i, w = m + f / 100 * o.width, y = p + v / 100 * o.height;
    w && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + w), y && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + y);
  }
  const u = o ? `${o.width}x${o.height}` : "";
  u === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < rm && s?.retries && (n.shiftSeen = u, n.shiftTries = (n.shiftTries ?? 0) + 1, s.retries.push(() => s.afterCommit?.()));
}
function li(n, a, i = null) {
  const s = n.values, o = {}, u = (B) => n.sources[B], m = (B) => n.sources[B] !== void 0, f = s.display;
  f === "none" ? o.display = "hidden" : f === "flex" || f === "inline-flex" ? o.display = "flex" : (f === "grid" || f === "inline-grid") && (o.display = "flex", o.flex_direction = "col", a("approximated", "display", f, u("display"), "one-column flex column"), s["grid-template-columns"] && s["grid-template-columns"] !== "none" && a("unsupported", "grid-template-columns", s["grid-template-columns"], u("grid-template-columns"))), n.element.hidden && (o.display = "hidden");
  const p = o.display === "flex";
  if (p && o.flex_direction !== "col") {
    const B = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[s["flex-direction"]] ?? "row";
    o.flex_direction = B;
  }
  if (p) {
    (s["flex-wrap"] === "wrap" || s["flex-wrap"] === "wrap-reverse") && (o.flex_wrap = "wrap");
    const B = f === "grid" || f === "inline-grid", W = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[s["align-items"]];
    W && (o.items = W);
    let J = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[s["justify-content"]];
    if (B) {
      const h = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[s["justify-items"]];
      h && (o.items = h), s["align-items"] === "center" && (J = "center");
    }
    J && (o.justify = J);
    const D = hn(s["row-gap"]), g = hn(s["column-gap"]);
    typeof D == "number" && D && (o.gap_y = D), typeof g == "number" && g && !B && (o.gap_x = g);
  }
  s["flex-grow"] && (o.flex_grow = s["flex-grow"]), s["flex-shrink"] !== 1 && (o.flex_shrink = s["flex-shrink"]);
  const v = hn(s["flex-basis"]);
  v !== void 0 && v !== "auto" && (o.flex_basis = v);
  const w = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[s["align-self"]];
  w && (o.self = w);
  for (const [B, W] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const J = s[W], D = hn(J);
    if (D === void 0 && W === "width" && tb(J, s)) {
      o.self = "stretch", a("approximated", W, J.expr, u(W), "stretched across its parent, inside its margins");
      continue;
    }
    const g = D === void 0 && /^max-/.test(W) ? P0(J, s["font-size"]) : void 0;
    if (g !== void 0) {
      o[B] = g, a("approximated", W, J.expr, u(W), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof J == "object" && J.expr ? a("unsupported", W, J.expr, u(W), "no calc() in the engine") : typeof J == "string" && !["auto", "none"].includes(J) && a("unsupported", W, J, u(W));
      continue;
    }
    D !== "auto" && (o[B] = D);
  }
  const y = ["top", "right", "bottom", "left"];
  for (const B of y) {
    const W = B[0];
    for (const [J, D] of [["p", "padding"], ["m", "margin"]]) {
      const g = s[`${D}-${B}`], h = hn(g);
      if (h === void 0) {
        g?.expr && a("unsupported", `${D}-${B}`, g.expr, u(`${D}-${B}`), "no calc() in the engine");
        continue;
      }
      h !== 0 && (o[`${J}${W}`] = h);
    }
  }
  const b = s.position;
  if (b === "absolute" || b === "fixed") {
    o.position = "absolute", b === "fixed" && a("approximated", "position", "fixed", u("position"), "absolute in the overlay layer");
    for (const B of y) {
      const W = hn(s[B]);
      W !== void 0 && W !== "auto" && (o[B] = W);
    }
    if (b === "fixed" && i && o.w === void 0 && o.right === void 0 && typeof o.left == "number") {
      const B = i.width - o.left - (typeof o.ml == "number" ? o.ml : 0) - (typeof o.mr == "number" ? o.mr : 0);
      o.max_w = typeof o.max_w == "number" ? Math.min(o.max_w, B) : B;
    }
    yf(n, o, a);
  } else b === "sticky" ? a("unsupported", "position", "sticky", u("position")) : ym(s)?.length !== 0 && (o.position = "relative", yf(n, o, a, !0));
  s["z-index"] !== "auto" && m("z-index") && a("unsupported", "z-index", s["z-index"], u("z-index"), "paint order is tree order");
  for (const [B, W] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const J = s[W];
    J === "hidden" || J === "clip" ? o[B] = "hidden" : (J === "auto" || J === "scroll") && (o[B] = "scroll");
  }
  (s.visibility === "hidden" || s.visibility === "collapse") && (o.visibility = "invisible");
  const S = s["background-color"];
  S?.unreadable ? a("unsupported", "background-color", S.unreadable, u("background-color")) : S?.rgba && S.rgba[3] > 0 && (o.bg = ni(S)), s["background-image"] && s["background-image"] !== "none" && a("unsupported", "background-image", s["background-image"], u("background-image"));
  const T = y.map((B) => hn(s[`border-${B}-width`]) || 0), z = [];
  y.forEach((B, W) => {
    if (!T[W]) return;
    o[`border_${B[0]}`] = T[W];
    const J = s[`border-${B}-style`];
    J !== "solid" && a("approximated", `border-${B}-style`, J, u(`border-${B}-style`), "drawn solid");
    const D = ni(s[`border-${B}-color`]);
    D && z.push(D);
  }), z.length && (o.border_color = z[0], z.some((B) => B.value !== z[0].value) && a("approximated", "border-color", z.map((B) => B.value).join(" "), u("border-top-color"), "one border colour"));
  const M = (B) => {
    const W = hn(s[`border-${B}-radius`]) || 0;
    if (typeof W != "string") return W;
    const J = parseFloat(W) / 100, D = [o.w, o.h].filter((g) => typeof g == "number");
    return W === "auto" || !(J > 0) ? 0 : D.length ? Math.round(Math.min(J, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, j = ["top-left", "top-right", "bottom-right", "bottom-left"].map(M);
  j.every((B) => B === j[0]) ? j[0] && (o.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((B, W) => {
    j[W] && (o[`rounded_${B}`] = j[W]);
  }), s.opacity !== 1 && (o.opacity = Math.round(s.opacity * 1e3) / 1e3);
  const O = s["box-shadow"];
  if (O && O !== "none" && se(O, ",").some((B) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(B.trim())) && (o.shadow = "lg", a("approximated", "box-shadow", O, u("box-shadow"), "the engine's large shadow preset")), s.cursor && s.cursor !== "auto" && !n.inherited.has("cursor")) {
    const B = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[s.cursor];
    B ? o.cursor = B : a("unsupported", "cursor", s.cursor, u("cursor"));
  }
  return s["text-overflow"] === "ellipsis" && (o.text_ellipsis = !0), s["text-decoration-line"] === "underline" ? o.underline = !0 : s["text-decoration-line"] && s["text-decoration-line"] !== "none" && a("unsupported", "text-decoration-line", s["text-decoration-line"], u("text-decoration-line")), o;
}
const nb = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function wm(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((i) => nb[i]);
  return a.every(Boolean) ? a.join(",") : null;
}
function ri(n, a) {
  const i = n.values, s = i["line-height"];
  return {
    text_color: ni(i.color),
    text_size: Math.round(i["font-size"] * 1e3) / 1e3,
    font_features: wm(i["font-variant-numeric"]) ?? "",
    font_weight: i["font-weight"],
    line_height: s.factor !== void 0 ? { factor: s.factor } : { px: Math.round(Nl(i, a) * 1e3) / 1e3 },
    font_family: W0(i["font-family"]),
    italic: i["font-style"] === "italic" || i["font-style"] === "oblique",
    whitespace: i["white-space"] === "nowrap" || i["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[i["text-align"]] ?? "left"
  };
}
const xf = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, Ko = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function ii(n, a, i) {
  const s = {}, o = (f, p) => p.some((v) => !n.inherited.has(v));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (o(f, p) || !Ko(a[f], i[f])) && (s[f] = a[f]);
  const u = xf(a.line_height, a.text_size), m = i.line_height ? xf(i.line_height, a.text_size) : NaN;
  return (o("line_height", ["line-height"]) || !(Math.abs(u - m) <= 1e-3)) && (s.line_height = a.line_height), s;
}
const ab = (n, a) => ({ ...n, ...a });
function si(n, a) {
  const i = {};
  for (const [s, o] of Object.entries(n))
    o && typeof o == "object" && "value" in o ? (i[s] = o.value, o.token && (a[s] = o.token)) : s === "line_height" ? i[s] = o.factor !== void 0 ? Math.round(o.factor * 1e3) / 1e3 : `${o.px}px` : s === "italic" ? o && (i.italic = !0) : i[s] = o;
  return i.italic === !1 && delete i.italic, i;
}
function _m(n, a) {
  const i = {};
  for (const s of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const o = n[s], u = a[s];
    Ko(o, u) || (i[s] = u === void 0 ? s in ai ? ai[s] : null : u);
  }
  return i;
}
function wf(n, a) {
  const i = n.values;
  for (const [s, o] of Object.entries(n.sources)) {
    if (s.startsWith("--") || K0.has(s) || o.startsWith("ua:")) continue;
    const u = i[s];
    switch (s) {
      case "letter-spacing":
        u !== "normal" && u?.px !== 0 && a("approximated", s, u?.px !== void 0 ? `${Math.round(u.px * 1e3) / 1e3}px` : u, o, u?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        u !== "normal" && wm(u) === null && a("unsupported", s, u, o);
        break;
      case "text-transform":
        u !== "none" && a("approximated", s, u, o, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = i["transition-duration"];
        s === "transition-property" && m && se(m, ",").some((f) => parseFloat(f) > 0) && i["transition-property"] !== "none" && a("unsupported", "transition", `${i["transition-property"]} ${m}`, o, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        u !== "none" && a("unsupported", s, u, o, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        s === "overflow-wrap" && u !== "normal" && a("approximated", s, u, o, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        i["outline-style"] !== "none" && s === "outline-style" && a("unsupported", "outline", `${hn(i["outline-width"])}px ${i["outline-style"]} ${ni(i["outline-color"])?.value ?? ""}`.trim(), o, "no outline in the engine (no focus ring)");
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
        u && u !== "none" && u !== "auto" && u !== "normal" && u !== "initial" && a("unsupported", s, u, o);
        break;
    }
  }
}
function lb(n, a, i, s) {
  const o = s.cascade.sheet.depends(n), u = n.ownerDocument?.activeElement, m = !!u && u !== n.ownerDocument.body;
  if (o.has || o.focusWithin && m || !s.cascade.pass) {
    const b = kf(n, a, i, s), S = _f(n);
    return b.meta = S.meta, S.events.length && (b.extra.events = S.events), b;
  }
  const f = s.cascade.parts ??= /* @__PURE__ */ new Map(), p = `${s.cascade.partKey(n)}|${a ? Tl(a.values) : ""}|${i ? Tl(i) : ""}`;
  let v = f.get(p);
  v || (f.size > 2e4 && f.clear(), v = kf(n, a, i, s), v.computed = { ...v.computed, element: { hidden: !!n.hidden } }, f.set(p, v));
  const w = { ...v.extra };
  w.group && (w.group = oi(n)), w.group_hover && (w.group_hover = w.group_hover.map((b, S) => {
    let T = n;
    for (let z = 0; z < v.groupsUp[S]; z++) T = T.parentNode;
    return { ...b, group: oi(T) };
  }));
  const y = _f(n);
  return y.events.length && (w.events = y.events), {
    ...v,
    extra: w,
    meta: y.meta,
    reports: v.reports.length ? v.reports.map(([b, S, T, z, , M]) => [b, S, T, z, Dl(n), M]) : v.reports
  };
}
function _f(n) {
  const a = n.props, i = {};
  let s = 0;
  for (const u in a) {
    const m = a[u];
    if (typeof m == "function") {
      s |= bf[u] ?? 0;
      continue;
    }
    if (Em.has(u) || m === void 0 || m === null || typeof m == "object") continue;
    const f = u.startsWith("aria-") || u.startsWith("data-");
    if (m === !1 && !f) continue;
    const p = u === "htmlFor" ? "for" : u === "tabIndex" ? "tabindex" : u;
    i[p] = typeof m == "boolean" ? f ? String(m) : "" : String(m);
  }
  const o = [];
  if (s) for (let u = 0; u < gf.length; u++) s & 1 << u && o.push(gf[u]);
  return !(s & bf.onClick) && wo(n) && o.push("click"), { meta: { tag: n.tagName, get classes() {
    return n.classList;
  }, attrs: i }, events: o };
}
function kf(n, a, i, s) {
  const o = Dl(n), u = {}, m = s.cascade.compute(n, a, /* @__PURE__ */ new Set(), null, u), f = s.cascade.matching(n, "*").filter((O) => O.states.subject.size), p = [];
  for (const [O, B] of rb)
    f.some((W) => B.some((J) => W.states.subject.has(J))) && p.push([O, s.cascade.compute(n, a, new Set(B), null, u)]);
  const v = `${Tl(m.shared)}|${Tl(i)}|${+!!m.element.hidden}|${p.map(([O, B]) => `${O}${Tl(B.shared)}`).join(",")}`;
  let w = (s.cascade.styled ??= /* @__PURE__ */ new Map()).get(v);
  w || s.cascade.styled.set(v, w = sb(m, p, i, s));
  const { style: y, tokens: b, shift: S, childText: T } = w, z = w.reports.map(([O, B, W, J, D]) => [O, B, W, J, o, D]), M = { ...w.extra }, j = [];
  if (s.cascade.sheet.tracks(n, "hover") && (M.group = oi(n), M.track_hover = !0), s.cascade.sheet.readsAncestor(n, "hover"))
    for (let O = n.parentNode, B = 1; O?.state; O = O.parentNode, B++) {
      if (!s.cascade.sheet.tracks(O, "hover")) continue;
      const W = O.state.hover;
      O.state.hover = !0;
      let J;
      const D = s.cascade.pass;
      s.cascade.pass = null;
      try {
        J = s.cascade.compute(n, a);
      } finally {
        O.state.hover = W, s.cascade.pass = D;
      }
      const g = {}, h = si({ ...li(J, () => {
      }), ...ii(J, ri(J, s.measure), i) }, g), _ = _m(y, h);
      if (!Object.keys(_).length) continue;
      const k = Object.fromEntries(Object.entries(g).filter(([N]) => N in _));
      (M.group_hover ??= []).push({ group: oi(O), style: _, ...Object.keys(k).length ? { tokens: k } : {} }), j.push(B);
    }
  if (/tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (M.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (M.break_anywhere = !0), w.scrolls) {
    const O = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (M.scrollbar = O);
  }
  return m.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (M.blocks_pointer = !0), m.values["pointer-events"] === "none" && (M.pointer_none = !0), { computed: m, style: y, tokens: b, extra: M, reports: z, childText: T, shift: S, groupsUp: j };
}
const rb = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], Sf = /* @__PURE__ */ new WeakMap();
let ib = 0;
function Tl(n) {
  let a = Sf.get(n);
  return a === void 0 && Sf.set(n, a = ++ib), a;
}
function sb(n, a, i, s) {
  const o = [], u = (b, S, T, z, M) => o.push([b, S, T, z ?? "(user agent)", M]), m = {}, f = li(n, u, s.viewport);
  wf(n, u);
  const p = ri(n, s.measure), v = ii(n, p, i), w = si({ ...f, ...v }, m), y = {};
  for (const [b, S] of a) {
    const T = {}, z = si({ ...li(S, () => {
    }), ...ii(S, ri(S, s.measure), i) }, T);
    b === "focus" && wf(S, u);
    const M = _m(w, z);
    if (Object.keys(M).length) {
      y[b] = M;
      const j = Object.fromEntries(Object.entries(T).filter(([O]) => O in M));
      Object.keys(j).length && (y[`${b}_tokens`] = j);
    }
  }
  return { style: w, tokens: m, shift: f[xm], childText: ab(i, v), extra: y, scrolls: f.overflow_y === "scroll", reports: o };
}
function ob(n, a, i, s) {
  const o = { before: null, after: null };
  for (const u of ["before", "after"]) {
    if (!s.cascade.matching(n, /* @__PURE__ */ new Set(), u).length) continue;
    const m = s.cascade.compute(n, a, /* @__PURE__ */ new Set(), u), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", v = (T, z, M, j, O) => s.add(T, z, M, j ?? "(user agent)", `${Dl(n)}::${u}`, O), w = {}, y = li(m, v, s.viewport), S = { kind: "div", style: si({ ...y, ...ii(m, ri(m, s.measure), i) }, w), tokens: w, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(S, Le, { value: m.values.display }), o[u] = S;
  }
  return o;
}
const oi = (n) => `~g${n.id}`, cb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function ub(n) {
  return n.kind === "div" && n[Le] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !cb.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function qr(n, a) {
  const i = n[a], s = { ...i, style: { ...i.style } };
  return Object.defineProperty(s, Le, { value: i[Le] }), n[a] = s, s;
}
function db(n) {
  const a = [];
  for (let i = n.parentElement; i?.parentElement; i = i.parentElement) {
    const s = i.parentElement.children;
    a.push(`${+(s[0] === i)}${+(s[s.length - 1] === i)}`);
  }
  return a.join("");
}
function km(n, a, i, s, o = 0, u = !0, m = !0, f = 0) {
  const p = s.cascade.sheet.depends(n), v = p.pos ? `${+u}${+m}${p.nth ? `:${f}` : ""}` : "", w = p.ancPos ? db(n) : "";
  let y = s.cache.get(n);
  const b = y && y.version === n.version && y.parentValues === a?.values && y.inheritedText === i && y.pos === v && y.ancPos === w && (!p.anc || o <= y.at);
  if (b && y.node && y.stamp === n.stamp && !y.volatile && (!y.subAnc || o <= y.subAt)) {
    for (const M of y.log) s.add(...M);
    return y.node;
  }
  if (!b) {
    const M = lb(n, a, i, s);
    y && Ko(y.part.childText, M.childText) && (M.childText = y.part.childText), y = { version: n.version, parentValues: a?.values, inheritedText: i, pos: v, ancPos: w, at: s.now, part: M }, s.cache.set(n, y);
  }
  const S = s.log.length, T = { volatile: !!y.part.shift || p.ancPos, subAnc: p.anc }, z = fb(n, y, s, Math.max(o, n.attrStamp), T);
  return Object.assign(y, { node: z, stamp: n.stamp, subAt: s.now, log: s.log.slice(S), volatile: T.volatile, subAnc: T.subAnc }), z;
}
function fb(n, a, i, s, o) {
  const { computed: u, tokens: m, extra: f, reports: p, childText: v } = a.part;
  for (const h of p) i.add(...h);
  const w = (h, _, k, N, E) => i.add(h, _, k, N, Dl(n), E), y = { ...a.part.style };
  a.part.shift && eb(n, y, a.part.shift);
  const b = { kind: "div", id: n.id, style: y, tokens: m, meta: a.part.meta, ...f };
  Object.defineProperty(b, Le, { value: u.values.display }), n.measured && n.ownerDocument?.measureKey && (b.measure = n.ownerDocument.measureKey(n));
  const S = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return b.kind = "engine", b.engine = String(n.props["data-perch-engine"]), b.key = String(n.props["data-perch-key"] ?? ""), b;
  if (S === "svg")
    return b.kind = n.props["data-perch-image"] ? "image" : "svg", b.markup = gb(n), b;
  if (S === "input" || S === "textarea" || S === "select") {
    b.kind = "input", b.input_type = S === "input" ? String(n.props.type ?? "text") : S;
    for (const k of ["placeholder", "checked", "disabled"]) n.props[k] !== void 0 && (b[k] = n.props[k]);
    if (/^(checkbox|radio)$/.test(b.input_type) && (b.checked = n.checked), S !== "select" && (b.value = n.value), S === "input" && $0.test(b.input_type) && (b.field_w = I0 * u.values["font-size"]), S === "textarea" && y.h === void 0) {
      const k = u.values, N = (Q) => Q && typeof Q == "object" && "px" in Q ? Q.px : 0, E = (Q) => k[`border-${Q}-style`] === "none" ? 0 : N(k[`border-${Q}-width`]), R = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      y.h = R * Nl(k, i.measure) + N(k["padding-top"]) + N(k["padding-bottom"]) + E("top") + E("bottom");
    }
    const { before: h, after: _ } = ob(n, u, v, i);
    return (h || _) && (b.children = [h, _].filter(Boolean)), b;
  }
  if (S === "img") {
    b.kind = "image", b.src = n.props.src ?? null;
    for (const [h, _] of [["width", "w"], ["height", "h"]]) {
      const k = Number(n.props[h]);
      y[_] === void 0 && n.props[h] != null && Number.isFinite(k) && (y[_] = k);
    }
    return b;
  }
  const T = u.values["text-transform"], z = [];
  let M = !1, j = !1;
  const O = n.childNodes.reduce((h, _) => h + (_ instanceof Zt ? 1 : 0), 0);
  let B = 0;
  for (const h of n.childNodes) {
    if (h instanceof hi) {
      if (h.hidden || h.data === "") continue;
      M = !0;
      const E = z[z.length - 1];
      if (E?.kind === "text")
        E.source = (E.source ?? E.text) + h.data, E.text = zf(E.source, T), E.text === E.source && delete E.source;
      else {
        const R = zf(h.data, T);
        z.push(R === h.data ? { kind: "text", text: R } : { kind: "text", text: R, source: h.data });
      }
      continue;
    }
    if (!(h instanceof Zt)) continue;
    const _ = km(h, u, v, i, s, B === 0, B === O - 1, B);
    B++;
    const k = i.cache.get(h);
    o.volatile ||= k.volatile, o.subAnc ||= k.subAnc;
    const N = _[Le];
    N === "inline" || N === "inline-block" || N === "inline-flex" ? M = !0 : N !== "none" && (j = !0), z.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && y.w === void 0) {
    for (let h = 0; h < z.length; h++)
      if (z[h].style?.flex_grow && z[h].style.min_w === 0 && z[h].style.overflow_x === "hidden") {
        const _ = qr(z, h);
        delete _.style.min_w, delete _.style.flex_grow, delete _.style.flex_basis, delete _.style.overflow_x, delete _.style.overflow_y;
      }
  }
  if (!y.display && M && z.some((h) => h.kind !== "text") && z.every((h) => h.kind === "text" || ub(h))) {
    const h = z.map((_) => _.kind === "text" ? _.text : _.children.map((k) => k.text).join("")).join("");
    w("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), z.splice(0, z.length, { kind: "text", text: h });
  }
  const W = z.some((h) => h.kind !== "text");
  let J = z.length === 1 && z[0].kind !== "text" && /^inline-(block|flex)$/.test(z[0][Le]) ? z[0] : null;
  if (!y.display && J) {
    J = qr(z, 0);
    const h = i.cache.get(n.childNodes.find((k) => k.id === J.id))?.part.computed, _ = h ? Ml(u.values, i.measure) - Ef(h.values, i.measure, J) : 0;
    y.display = "flex", y.flex_direction = "col", y.items = "start", _ > 0 && (J.style.mt = Math.round(((J.style.mt ?? 0) + _) * 100) / 100), w("approximated", "display", `${u.values.display} holding one ${J[Le]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!y.display && z.length === 1 && (z[0].kind === "svg" || z[0].kind === "image") && z[0][Le] === "inline" && typeof z[0].style.h == "number") {
    const h = qr(z, 0), _ = Ml(u.values, i.measure), k = Nl(u.values, i.measure) - _, N = (E) => Math.round(E * 100) / 100;
    y.display = "flex", y.flex_direction = "col", y.items = "start", _ > h.style.h && (h.style.mt = N((h.style.mt ?? 0) + _ - h.style.h)), k > 0 && (h.style.mb = N((h.style.mb ?? 0) + k)), w("approximated", "display", `${u.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!y.display && M && W) {
    if (y.display = "flex", y.flex_direction = j ? "col" : "row", !j) y.items = "baseline";
    else {
      const h = (_) => z[_] && (z[_].kind === "text" || !/^(block|flex|grid|table|list-item)$/.test(z[_][Le] ?? "block"));
      for (let _ = 0; _ < z.length; _++) {
        if (z[_].kind === "text" || !/^inline-(block|flex)$/.test(z[_][Le])) continue;
        const k = qr(z, _);
        if (k.style.self ??= "start", h(_ - 1) || h(_ + 1)) continue;
        const N = i.cache.get(n.childNodes.find((R) => R.id === k.id))?.part.computed, E = N ? Ml(u.values, i.measure) - Ef(N.values, i.measure, k) : 0;
        E > 0 && (k.style.mt = Math.round(((k.style.mt ?? 0) + E) * 100) / 100);
      }
    }
    w("approximated", "display", `${u.values.display} with inline content`, "(inline formatting)", j ? "a column of its children" : "a row on the text baseline");
  }
  const D = u.values["letter-spacing"]?.px, g = u.values["overflow-x"] !== "visible";
  if (D)
    for (let h = 0; h < z.length; h++) {
      const _ = z[h];
      if (_.kind !== "text") continue;
      const k = Math.round(D * [..._.text].length * 1e3) / 1e3;
      if (D > 0 || !g) {
        z[h] = { kind: "div", style: { pr: k }, tokens: {}, children: [_] };
        continue;
      }
      const N = u.values["font-size"], E = Math.max(0.8, 1 + D / (0.55 * N)), R = Math.round(Nl(u.values, i.measure) * 1e3) / 1e3;
      z[h] = { kind: "div", style: { text_size: Math.round(N * E * 1e3) / 1e3, line_height: `${R}px` }, tokens: {}, children: [_] };
    }
  return b.children = z, b;
}
function mb(n, a) {
  if (!a) return null;
  let s = (a.self ? n : a.closest ? am(n, a.closest) : a.find ? Al(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return s && a.strip && s.startsWith(a.strip) && (s = s.slice(a.strip.length)), s;
}
function pb(n, a, i) {
  const s = a.map((m) => [m, pi(m.selector)]), o = /* @__PURE__ */ new Map(), u = (m) => {
    for (const f of m.children) {
      const p = i.get(f.id);
      if (p)
        for (const [v, w] of s) {
          const y = v.textRange ? "range_name" : "name";
          if (v.textRange && p[y] != null || !w.some((z) => bo(f, z))) continue;
          const b = mb(f, v.key), S = b == null ? o.get(v.name) ?? 0 : 0;
          b == null && o.set(v.name, S + 1);
          const T = b != null ? `${v.name}:${b}` : S ? `${v.name}@${S}` : v.name;
          p[y] == null ? p[y] = T : (p.also ??= []).push(T);
        }
      u(f);
    }
  };
  u(n.documentElement);
}
const ci = 0.9521, Sm = 0.2256, Ml = (n, a) => (Nl(n, a) - (ci + Sm) * n["font-size"]) / 2 + ci * n["font-size"];
function Ef(n, a, i) {
  const s = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, o = n["border-top-style"] === "none" ? 0 : s(n["border-top-width"]), u = i?.children ?? [], m = u.length === 1 && (u[0].kind === "svg" || u[0].kind === "image") && typeof u[0].style.h == "number" ? u[0] : null, f = m ? Math.max(Ml(n, a), (m.style.mt ?? 0) + m.style.h) : Ml(n, a);
  return s(n["padding-top"]) + o + f;
}
const zf = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (i) => i.toUpperCase()) : n, Em = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]), hb = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), Nf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function gb(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (i) => {
    const s = [];
    for (const [u, m] of Object.entries(i.props))
      Em.has(u) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || u.startsWith("data-") || u.startsWith("aria-") || u === "focusable" || u === "role" || u === "title" || s.push(`${hb(u)}="${Nf(m === !0 ? "" : m)}"`);
    i.tagName === "svg" && !i.props.xmlns && s.unshift('xmlns="http://www.w3.org/2000/svg"');
    const o = i.childNodes.map((u) => u instanceof hi ? Nf(u.data) : a(u)).join("");
    return `<${i.tagName}${s.length ? ` ${s.join(" ")}` : ""}>${o}</${i.tagName}>`;
  };
  return a(n);
}
function bb(n) {
  const a = n.theme?.() ?? {}, i = {};
  for (const s of fm) a[s] && (i[s] = a[s]);
  return i;
}
const vb = { font_features: "" }, Tf = /* @__PURE__ */ new WeakMap();
function yb(n, a, i, s) {
  const o = Tf.get(n);
  if (o?.look === a) return o.cascade;
  const u = new G0(n, { theme: i, viewport: s });
  return Tf.set(n, { look: a, cascade: u }), u;
}
function xb(n, a, i, s = {}, o = null) {
  const u = bb(a), m = a.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([u, m]);
  (s.look !== f || s.sheet !== i) && Object.assign(s, { look: f, sheet: i, cache: /* @__PURE__ */ new WeakMap(), cascade: yb(i, f, u, m), top: null });
  const { cascade: p, cache: v } = s, w = new F0(), y = [], S = { cascade: p, cache: v, viewport: m, findings: w, log: y, add: (...j) => {
    y.push(j), w.add(...j);
  }, now: yo(), measure: a.lineHeight ? (j) => a.lineHeight(j) : null };
  s.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const T = n.body.children;
  p.pass = {};
  let z;
  try {
    z = T.map((j, O) => km(j, s.top, vb, S, 0, O === 0, O === T.length - 1, O));
  } finally {
    p.pass = null;
  }
  if (o?.length) {
    const j = /* @__PURE__ */ new Map(), O = (B) => {
      B.id && (j.set(B.id, B), delete B.name, delete B.range_name, delete B.also);
      for (const W of B.children ?? []) O(W);
    };
    z.forEach(O), pb(n, o, j);
  }
  const M = /* @__PURE__ */ new Set();
  for (const j of [n, n.defaultView])
    for (const { type: O } of j?.listeners ?? []) vf[O] && M.add(vf[O]);
  return { schema: Q0, root: z[0] ?? null, overlays: z.slice(1), document_events: [...M].sort(), unsupported: S.findings.list() };
}
const qa = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\], .font-mono", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 }, digest: "2e058a4f3cab4539" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const Ya = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let kl = null;
function wb() {
  return kl || (kl = qa.digest && Ya.get(qa.digest) || new A0(qa), qa.digest && !Ya.has(qa.digest) && (Ya.size >= 4 && Ya.delete(Ya.keys().next().value), Ya.set(qa.digest, kl)), kl);
}
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
let qn = Qa.NoEventPriority;
function _b(n, a) {
  const i = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const s of i) {
    if (s === "children") continue;
    const o = n[s], u = a[s];
    if (!(o === u || typeof o == "function" && typeof u == "function") && !(s === "style" && o && u && typeof o == "object" && typeof u == "object" && [.../* @__PURE__ */ new Set([...Object.keys(o), ...Object.keys(u)])].every((f) => o[f] === u[f])))
      return !0;
  }
  return !1;
}
const kb = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Mf(n, a) {
  for (const i of Wg(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(i);
  return n;
}
const zm = {
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
  createInstance: (n, a, i) => Mf(new Zt(n, a, i.ownerDocument), a),
  createTextInstance: (n, a) => new hi(n),
  appendInitialChild: (n, a) => {
    n.appendChild(a);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, a, i) => !!i.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, a) => {
    n.appendChild(a);
  },
  appendChildToContainer: (n, a) => {
    n.appendChild(a);
  },
  insertBefore: (n, a, i) => {
    n.insertBefore(a, i);
  },
  insertInContainerBefore: (n, a, i) => {
    n.insertBefore(a, i);
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
  commitUpdate: (n, a, i, s) => {
    if (n.props = s, n.inline) for (const o of Object.keys(n.inline)) i.style?.[o] !== s.style?.[o] && delete n.inline[o];
    if (i.dangerouslySetInnerHTML?.__html !== s.dangerouslySetInnerHTML?.__html) {
      for (const o of [...n.childNodes]) n.removeChild(o);
      Mf(n, s);
    }
    _b(i, s) && n.touch();
  },
  commitTextUpdate: (n, a, i) => {
    n.data = String(i);
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
    qn = n;
  },
  getCurrentUpdatePriority: () => qn,
  resolveUpdatePriority: () => qn !== Qa.NoEventPriority ? qn : Qa.DefaultEventPriority,
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
let pe = dm(zm), To = 0;
function Cf() {
  pe.isAlreadyRendering() && (g0.unstable_recoverFromCut?.(), pe = dm(zm), To += 1, qn = Qa.NoEventPriority);
}
const Hl = (n, a, i = null) => pe.createPortal(n, a, null, i), Sb = {
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
}, Eb = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), zb = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Nb = (n) => {
  for (let a = n; a instanceof Zt; a = a.parentNode) if (a.props.disabled && zb.has(a.tagName)) return !0;
  return !1;
};
class Tb {
  constructor(a, i, s) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, i), this.type = a, this.target = s, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Yr(n, a, i) {
  a.currentTarget = n;
  for (const { type: s, listener: o, capture: u } of [...n.listeners ?? []])
    s === a.type && u === i && o.call(n, a);
  if (n instanceof Zt) {
    const s = Sb[a.type], o = s && n.props[i ? `${s}Capture` : s];
    typeof o == "function" && o(a);
  }
}
function Kx(n, a, i = {}) {
  const { document: s, window: o, globals: u } = t0(n), m = new Zt("div", { id: "root", style: i.container ?? {} }, s);
  s.body.appendChild(m);
  const f = [];
  let p = null;
  const v = () => [s, o].map((h) => h.listeners.map((_) => `${_.type}:${_.capture}`).sort().join(",")).join("|");
  let w = "";
  const y = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, T = -1;
  s.measureKey = (h) => b + h.id, s.stale = () => T !== S, s.computed = (h) => {
    if (!y.cascade || !y.top) return null;
    const _ = [];
    for (let N = h; N instanceof Zt && N !== s.body; N = N.parentNode) _.unshift(N);
    let k = y.top;
    for (const N of _) k = y.cascade.compute(N, k);
    return k.values;
  };
  const z = () => (S += 1, p = xb(s, n, wb(), y, i.names), w = v(), n.render?.(p), p);
  Cf();
  const M = To, j = () => (Cf(), M === To), O = () => {
    j() && (pe.flushPassiveEffects(), pe.flushSyncWork(), v() !== w && z());
  };
  s.afterCommit = z;
  const B = (h) => {
    f.push(h), n.error?.(h);
  }, W = pe.createContainer(m, Qa.ConcurrentRoot, null, !1, null, "", B, B, B, null);
  pe.updateContainerSync(X.createElement(a, i.props ?? {}), W, null, null), pe.flushSyncWork(), O();
  const J = (h) => {
    const _ = (k) => {
      if (k.id === h) return k;
      for (const N of k.children) {
        const E = _(N);
        if (E) return E;
      }
      return null;
    };
    return _(s.documentElement);
  }, D = (h) => {
    if (!j()) return;
    const _ = qn;
    qn = Qa.DiscreteEventPriority;
    try {
      return h();
    } finally {
      qn = _, pe.flushSyncWork(), O();
    }
  }, g = {
    document: s,
    window: o,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: u,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: z,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(h, _, k = {}) {
      const N = typeof h == "string" ? J(h) : h;
      if (!N || Eb.has(_) && Nb(N)) return !1;
      const E = new Tb(_, k, N), R = [];
      for (let U = N; U; U = _ === "scroll" ? null : U.parentNode) R.push(U);
      const Q = [...R, s, o];
      D(() => {
        for (let U = Q.length - 1; U > 0 && !E.propagationStopped; U--) Yr(Q[U], E, !0);
        E.propagationStopped || (Yr(N, E, !0), E.propagationStopped || Yr(N, E, !1));
        for (let U = 1; U < Q.length && !E.propagationStopped; U++) Yr(Q[U], E, !1);
      });
      const $ = _ === "click" && !E.defaultPrevented ? wo(N) : null;
      if ($ && g.dispatch($, "submit", {}), _ === "click" && !E.defaultPrevented)
        for (let U = N; U; U = U.parentNode) {
          if (U.tagName !== "a") continue;
          const V = U.props?.href;
          typeof V == "string" && /^https:\/\/\S+$/.test(V) && n.openLink?.(V);
          break;
        }
      return !E.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (h) => [s, o].some((_) => _.listeners.some((k) => k.type === h)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(h) {
      const _ = s.activeElement && s.activeElement !== s.body ? s.activeElement : s.body;
      if (!g.dispatch(_, "keydown", h)) return !0;
      const N = h.key === "Enter" && !h.isComposing ? wo(_, !0) : null;
      if (N)
        return g.dispatch(N, "submit", {}), !0;
      if (!om(_) || _.props.disabled || _.props.readOnly) return !1;
      if ((h.ctrlKey || h.metaKey) && !h.altKey && !h.shiftKey && h.key.toLowerCase() === "a")
        return _.selectedAll = !0, !0;
      if (h.ctrlKey || h.metaKey) return !1;
      const E = _.selectedAll;
      _.selectedAll = !1;
      const R = _.value, $ = h.key === "Backspace" || E && h.key === "Delete" ? E ? "" : R.slice(0, -1) : [...h.key].length === 1 ? (E ? "" : R) + h.key : R;
      return $ === R ? !1 : (_.value = $, g.dispatch(_, "input", { data: h.key }), g.dispatch(_, "change", {}), _.props.value !== void 0 && delete _.edit, _.touch(), z(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(h, _) {
      const k = J(h);
      k && (k.bounds = { x: _.x, y: _.y, width: _.width, height: _.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(h) {
      const _ = J(h);
      if (!_ || _.props.disabled || !g.dispatch(h, "click", { button: 0, detail: 1 })) return;
      const k = _.props.type === "radio";
      k && _.checked || (_.checked = k ? !0 : !_.checked, g.dispatch(h, "input", {}), g.dispatch(h, "change", {}), _.props.checked !== void 0 && delete _.ticked, _.touch(), z());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(h, _ = {}) {
      const k = { button: 0, buttons: 1, pointerType: "mouse", ..._ };
      for (const N of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) g.dispatch(h, N, k);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (h) => !!J(h)?.state.hover,
    hover(h, _) {
      const k = J(h);
      !k || k.state.hover === _ || (k.state.hover = _, k.touch(), z());
    },
    focus(h) {
      const _ = J(h);
      _ && (D(() => {
        const k = s.activeElement;
        k && k !== _ && k !== s.body && g.dispatch(k, "blur"), s.focus(_), g.dispatch(_, "focus");
      }), z());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(h) {
      let k = typeof h == "string" ? J(h) : h;
      for (; k && !(k instanceof Zt && typeof k.props.onKeyDown == "function" && kb(k)); ) k = k.parentNode;
      !k || k === s.activeElement || (g.focus(k.id), k.state.pointerFocus = !0, k.touch(), z());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return T = S, s.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const h = s.retries.splice(0);
      for (const _ of h) _();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: O,
    /** React was replaced since this tree was mounted (`fresh`): the tree is to be mounted again. */
    dead: () => !j(),
    update(h) {
      j() && (pe.updateContainerSync(X.createElement(a, h ?? {}), W, null, null), pe.flushSyncWork(), O());
    },
    unmount() {
      j() && (pe.updateContainerSync(null, W, null, null), pe.flushSyncWork(), pe.flushPassiveEffects()), s.afterCommit = null, s.retries.length = 0, n.forgetBounds?.(b);
    }
  };
  return g;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Nm = (n) => pe.flushSyncFromReconciler(n), Mb = { createPortal: Hl, flushSync: Nm }, Xx = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Hl,
  default: Mb,
  flushSync: Nm
}, Symbol.toStringTag, { value: "Module" }));
function Tm(n) {
  var a, i, s = "";
  if (typeof n == "string" || typeof n == "number") s += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var o = n.length;
    for (a = 0; a < o; a++) n[a] && (i = Tm(n[a])) && (s && (s += " "), s += i);
  } else for (i in n) n[i] && (s && (s += " "), s += i);
  return s;
}
function Mm() {
  for (var n, a, i = 0, s = "", o = arguments.length; i < o; i++) (n = arguments[i]) && (a = Tm(n)) && (s && (s += " "), s += a);
  return s;
}
const Cb = (n, a) => {
  const i = new Array(n.length + a.length);
  for (let s = 0; s < n.length; s++)
    i[s] = n[s];
  for (let s = 0; s < a.length; s++)
    i[n.length + s] = a[s];
  return i;
}, Ab = (n, a) => ({
  classGroupId: n,
  validator: a
}), Cm = (n = /* @__PURE__ */ new Map(), a = null, i) => ({
  nextPart: n,
  validators: a,
  classGroupId: i
}), ui = "-", Af = [], jb = "arbitrary..", Ob = (n) => {
  const a = Db(n), {
    conflictingClassGroups: i,
    conflictingClassGroupModifiers: s
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Rb(m);
      const f = m.split(ui), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return Am(f, p, a);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = s[m], v = i[m];
        return p ? v ? Cb(v, p) : p : v || Af;
      }
      return i[m] || Af;
    }
  };
}, Am = (n, a, i) => {
  if (n.length - a === 0)
    return i.classGroupId;
  const o = n[a], u = i.nextPart.get(o);
  if (u) {
    const v = Am(n, a + 1, u);
    if (v) return v;
  }
  const m = i.validators;
  if (m === null)
    return;
  const f = a === 0 ? n.join(ui) : n.slice(a).join(ui), p = m.length;
  for (let v = 0; v < p; v++) {
    const w = m[v];
    if (w.validator(f))
      return w.classGroupId;
  }
}, Rb = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), i = a.indexOf(":"), s = a.slice(0, i);
  return s ? jb + s : void 0;
})(), Db = (n) => {
  const {
    theme: a,
    classGroups: i
  } = n;
  return Hb(i, a);
}, Hb = (n, a) => {
  const i = Cm();
  for (const s in n) {
    const o = n[s];
    Xo(o, i, s, a);
  }
  return i;
}, Xo = (n, a, i, s) => {
  const o = n.length;
  for (let u = 0; u < o; u++) {
    const m = n[u];
    Bb(m, a, i, s);
  }
}, Bb = (n, a, i, s) => {
  if (typeof n == "string") {
    Ub(n, a, i);
    return;
  }
  if (typeof n == "function") {
    Gb(n, a, i, s);
    return;
  }
  qb(n, a, i, s);
}, Ub = (n, a, i) => {
  const s = n === "" ? a : jm(a, n);
  s.classGroupId = i;
}, Gb = (n, a, i, s) => {
  if (Yb(n)) {
    Xo(n(s), a, i, s);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(Ab(i, n));
}, qb = (n, a, i, s) => {
  const o = Object.entries(n), u = o.length;
  for (let m = 0; m < u; m++) {
    const [f, p] = o[m];
    Xo(p, jm(a, f), i, s);
  }
}, jm = (n, a) => {
  let i = n;
  const s = a.split(ui), o = s.length;
  for (let u = 0; u < o; u++) {
    const m = s[u];
    let f = i.nextPart.get(m);
    f || (f = Cm(), i.nextPart.set(m, f)), i = f;
  }
  return i;
}, Yb = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Lb = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let a = 0, i = /* @__PURE__ */ Object.create(null), s = /* @__PURE__ */ Object.create(null);
  const o = (u, m) => {
    i[u] = m, a++, a > n && (a = 0, s = i, i = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(u) {
      let m = i[u];
      if (m !== void 0)
        return m;
      if ((m = s[u]) !== void 0)
        return o(u, m), m;
    },
    set(u, m) {
      u in i ? i[u] = m : o(u, m);
    }
  };
}, Mo = "!", jf = ":", Qb = [], Of = (n, a, i, s, o) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: i,
  maybePostfixModifierPosition: s,
  isExternal: o
}), Vb = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: i
  } = n;
  let s = (o) => {
    const u = [];
    let m = 0, f = 0, p = 0, v;
    const w = o.length;
    for (let z = 0; z < w; z++) {
      const M = o[z];
      if (m === 0 && f === 0) {
        if (M === jf) {
          u.push(o.slice(p, z)), p = z + 1;
          continue;
        }
        if (M === "/") {
          v = z;
          continue;
        }
      }
      M === "[" ? m++ : M === "]" ? m-- : M === "(" ? f++ : M === ")" && f--;
    }
    const y = u.length === 0 ? o : o.slice(p);
    let b = y, S = !1;
    y.endsWith(Mo) ? (b = y.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      y.startsWith(Mo) && (b = y.slice(1), S = !0)
    );
    const T = v && v > p ? v - p : void 0;
    return Of(u, S, b, T);
  };
  if (a) {
    const o = a + jf, u = s;
    s = (m) => m.startsWith(o) ? u(m.slice(o.length)) : Of(Qb, !1, m, void 0, !0);
  }
  if (i) {
    const o = s;
    s = (u) => i({
      className: u,
      parseClassName: o
    });
  }
  return s;
}, Kb = (n) => {
  const a = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((i, s) => {
    a.set(i, 1e6 + s);
  }), (i) => {
    const s = [];
    let o = [];
    for (let u = 0; u < i.length; u++) {
      const m = i[u], f = m[0] === "[", p = a.has(m);
      f || p ? (o.length > 0 && (o.sort(), s.push(...o), o = []), s.push(m)) : o.push(m);
    }
    return o.length > 0 && (o.sort(), s.push(...o)), s;
  };
}, Xb = (n) => ({
  cache: Lb(n.cacheSize),
  parseClassName: Vb(n),
  sortModifiers: Kb(n),
  postfixLookupClassGroupIds: Zb(n),
  ...Ob(n)
}), Zb = (n) => {
  const a = /* @__PURE__ */ Object.create(null), i = n.postfixLookupClassGroups;
  if (i)
    for (let s = 0; s < i.length; s++)
      a[i[s]] = !0;
  return a;
}, Jb = /\s+/, Wb = (n, a) => {
  const {
    parseClassName: i,
    getClassGroupId: s,
    getConflictingClassGroupIds: o,
    sortModifiers: u,
    postfixLookupClassGroupIds: m
  } = a, f = [], p = n.trim().split(Jb);
  let v = "";
  for (let w = p.length - 1; w >= 0; w -= 1) {
    const y = p[w], {
      isExternal: b,
      modifiers: S,
      hasImportantModifier: T,
      baseClassName: z,
      maybePostfixModifierPosition: M
    } = i(y);
    if (b) {
      v = y + (v.length > 0 ? " " + v : v);
      continue;
    }
    let j = !!M, O;
    if (j) {
      const g = z.substring(0, M);
      O = s(g);
      const h = O && m[O] ? s(z) : void 0;
      h && h !== O && (O = h, j = !1);
    } else
      O = s(z);
    if (!O) {
      if (!j) {
        v = y + (v.length > 0 ? " " + v : v);
        continue;
      }
      if (O = s(z), !O) {
        v = y + (v.length > 0 ? " " + v : v);
        continue;
      }
      j = !1;
    }
    const B = S.length === 0 ? "" : S.length === 1 ? S[0] : u(S).join(":"), W = T ? B + Mo : B, J = W + O;
    if (f.indexOf(J) > -1)
      continue;
    f.push(J);
    const D = o(O, j);
    for (let g = 0; g < D.length; ++g) {
      const h = D[g];
      f.push(W + h);
    }
    v = y + (v.length > 0 ? " " + v : v);
  }
  return v;
}, Fb = (...n) => {
  let a = 0, i, s, o = "";
  for (; a < n.length; )
    (i = n[a++]) && (s = Om(i)) && (o && (o += " "), o += s);
  return o;
}, Om = (n) => {
  if (typeof n == "string")
    return n;
  let a, i = "";
  for (let s = 0; s < n.length; s++)
    n[s] && (a = Om(n[s])) && (i && (i += " "), i += a);
  return i;
}, $b = (n, ...a) => {
  let i, s, o, u;
  const m = (p) => {
    const v = a.reduce((w, y) => y(w), n());
    return i = Xb(v), s = i.cache.get, o = i.cache.set, u = f, f(p);
  }, f = (p) => {
    const v = s(p);
    if (v)
      return v;
    const w = Wb(p, i);
    return o(p, w), w;
  };
  return u = m, (...p) => u(Fb(...p));
}, Ib = [], Ft = (n) => {
  const a = (i) => i[n] || Ib;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, Rm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Dm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Pb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, tv = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, ev = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, nv = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, av = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, lv = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Dn = (n) => Pb.test(n), yt = (n) => !!n && !Number.isNaN(Number(n)), Fe = (n) => !!n && Number.isInteger(Number(n)), uo = (n) => n.endsWith("%") && yt(n.slice(0, -1)), pn = (n) => tv.test(n), Hm = () => !0, rv = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  ev.test(n) && !nv.test(n)
), Zo = () => !1, iv = (n) => av.test(n), sv = (n) => lv.test(n), ov = (n) => !rt(n) && !it(n), cv = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), uv = (n) => Ln(n, Gm, Zo), rt = (n) => Rm.test(n), ca = (n) => Ln(n, qm, rv), Rf = (n) => Ln(n, vv, yt), dv = (n) => Ln(n, Lm, Hm), fv = (n) => Ln(n, Ym, Zo), Df = (n) => Ln(n, Bm, Zo), mv = (n) => Ln(n, Um, sv), Lr = (n) => Ln(n, Qm, iv), it = (n) => Dm.test(n), Sl = (n) => fa(n, qm), pv = (n) => fa(n, Ym), Hf = (n) => fa(n, Bm), hv = (n) => fa(n, Gm), gv = (n) => fa(n, Um), Qr = (n) => fa(n, Qm, !0), bv = (n) => fa(n, Lm, !0), Ln = (n, a, i) => {
  const s = Rm.exec(n);
  return s ? s[1] ? a(s[1]) : i(s[2]) : !1;
}, fa = (n, a, i = !1) => {
  const s = Dm.exec(n);
  return s ? s[1] ? a(s[1]) : i : !1;
}, Bm = (n) => n === "position" || n === "percentage", Um = (n) => n === "image" || n === "url", Gm = (n) => n === "length" || n === "size" || n === "bg-size", qm = (n) => n === "length", vv = (n) => n === "number", Ym = (n) => n === "family-name", Lm = (n) => n === "number" || n === "weight", Qm = (n) => n === "shadow", yv = () => {
  const n = Ft("color"), a = Ft("font"), i = Ft("text"), s = Ft("font-weight"), o = Ft("tracking"), u = Ft("leading"), m = Ft("breakpoint"), f = Ft("container"), p = Ft("spacing"), v = Ft("radius"), w = Ft("shadow"), y = Ft("inset-shadow"), b = Ft("text-shadow"), S = Ft("drop-shadow"), T = Ft("blur"), z = Ft("perspective"), M = Ft("aspect"), j = Ft("ease"), O = Ft("animate"), B = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], W = () => [
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
  ], J = () => [...W(), it, rt], D = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [it, rt, p], _ = () => [Dn, "full", "auto", ...h()], k = () => [Fe, "none", "subgrid", it, rt], N = () => ["auto", {
    span: ["full", Fe, it, rt]
  }, Fe, it, rt], E = () => [Fe, "auto", it, rt], R = () => ["auto", "min", "max", "fr", it, rt], Q = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], $ = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], U = () => ["auto", ...h()], V = () => [Dn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], I = () => [f, Dn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], L = () => [Dn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], K = () => [n, it, rt], C = () => [...W(), Hf, Df, {
    position: [it, rt]
  }], Z = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], at = () => ["auto", "cover", "contain", hv, uv, {
    size: [it, rt]
  }], ot = () => [uo, Sl, ca], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    v,
    it,
    rt
  ], ut = () => ["", yt, Sl, ca], Et = () => ["solid", "dashed", "dotted", "double"], $t = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [yt, uo, Hf, Df], Vn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    T,
    it,
    rt
  ], Kn = () => ["none", yt, it, rt], De = () => ["none", yt, it, rt], He = () => [yt, it, rt], gn = () => [Dn, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [pn],
      breakpoint: [pn],
      color: [Hm],
      container: [pn],
      "drop-shadow": [pn],
      ease: ["in", "out", "in-out"],
      font: [ov],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [pn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [pn],
      shadow: [pn],
      spacing: ["px", yt],
      text: [pn],
      "text-shadow": [pn],
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
        aspect: ["auto", "square", Dn, rt, it, M]
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
        "@container": ["", "normal", "size", it, rt]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [cv],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [yt, "auto", rt, it, f]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": B()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": B()
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
        object: J()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: D()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": D()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": D()
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
        inset: _()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": _()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": _()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": _(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: _()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": _(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: _()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": _()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": _()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: _()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: _()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: _()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: _()
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
        z: [Fe, "auto", it, rt]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Dn, "full", "auto", f, ...h()]
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
        flex: [yt, Dn, "auto", "initial", "none", rt]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", yt, it, rt]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", yt, it, rt]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Fe, "first", "last", "none", it, rt]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": k()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: N()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": E()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": E()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": k()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: N()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": E()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": E()
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
        "auto-cols": R()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": R()
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
        justify: [...Q(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...$(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...$()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...Q()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...$(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...$(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": Q()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...$(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...$()]
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
        m: U()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: U()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: U()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: U()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: U()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: U()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: U()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: U()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: U()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: U()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: U()
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
        size: V()
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
        block: ["auto", ...L()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...L()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...L()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [f, "screen", ...V()]
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
          ...V()
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
            screen: [m]
          },
          ...V()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...V()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...V()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...V()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", i, Sl, ca]
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
        font: [s, bv, dv]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", uo, rt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [pv, fv, a]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [rt]
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
        tracking: [o, it, rt]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [yt, "none", it, Rf]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          u,
          ...h()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", it, rt]
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
        list: ["disc", "decimal", "none", it, rt]
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
        decoration: [...Et(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [yt, "from-font", "auto", it, ca]
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
        "underline-offset": [yt, "auto", it, rt]
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
        tab: [Fe, it, rt]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", it, rt]
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
        content: ["none", it, rt]
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
        bg: C()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: Z()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: at()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Fe, it, rt],
          radial: ["", it, rt],
          conic: ["", Fe, it, rt]
        }, gv, mv]
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
        from: ot()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: ot()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: ot()
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
        rounded: ct()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": ct()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": ct()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": ct()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": ct()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": ct()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": ct()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": ct()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": ct()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": ct()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": ct()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": ct()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": ct()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": ct()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": ct()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: ut()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": ut()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": ut()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": ut()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": ut()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": ut()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": ut()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": ut()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": ut()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": ut()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": ut()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": ut()
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
        "divide-y": ut()
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
        border: [...Et(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...Et(), "hidden", "none"]
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
        outline: [...Et(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [yt, it, rt]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", yt, Sl, ca]
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
          w,
          Qr,
          Lr
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
        "inset-shadow": ["none", y, Qr, Lr]
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
        ring: ut()
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
        "ring-offset": [yt, ca]
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
        "inset-ring": ut()
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
        "text-shadow": ["none", b, Qr, Lr]
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
        opacity: [yt, it, rt]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...$t(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": $t()
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
        "mask-linear": [yt]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": ht()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": ht()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": K()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": K()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": ht()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": ht()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": K()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": K()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": ht()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": ht()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": K()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": K()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": ht()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": ht()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": K()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": K()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": ht()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": ht()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": K()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": K()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": ht()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": ht()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": K()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": K()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": ht()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": ht()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": K()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": K()
      }],
      "mask-image-radial": [{
        "mask-radial": [it, rt]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": ht()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": ht()
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
        "mask-radial-at": W()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [yt]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": ht()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": ht()
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
        mask: C()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: Z()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: at()
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
        mask: ["none", it, rt]
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
          it,
          rt
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Vn()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [yt, it, rt]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [yt, it, rt]
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
          S,
          Qr,
          Lr
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
        grayscale: ["", yt, it, rt]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [yt, it, rt]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", yt, it, rt]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [yt, it, rt]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", yt, it, rt]
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
          it,
          rt
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Vn()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [yt, it, rt]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [yt, it, rt]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", yt, it, rt]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [yt, it, rt]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", yt, it, rt]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [yt, it, rt]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [yt, it, rt]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", yt, it, rt]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", it, rt]
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
        duration: [yt, "initial", it, rt]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", j, it, rt]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [yt, it, rt]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", O, it, rt]
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
        perspective: [z, it, rt]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": J()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Kn()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Kn()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Kn()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Kn()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: De()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": De()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": De()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": De()
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
        skew: He()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": He()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": He()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [it, rt, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: J()
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
        translate: gn()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": gn()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": gn()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": gn()
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
        zoom: [Fe, it, rt]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", it, rt]
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
        "will-change": ["auto", "scroll", "contents", "transform", it, rt]
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
        stroke: [yt, Sl, ca, Rf]
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
}, xv = /* @__PURE__ */ $b(yv);
function jt(...n) {
  return xv(Mm(n));
}
function wv(n, a, i) {
  return n.filter((s, o) => o !== a && (s.start + s.end) / 2 < i).length;
}
function _v(n, a, i, s) {
  const o = n.map(() => 0), u = n[a];
  if (!u) return o;
  const m = n[a + 1], f = n[a - 1], p = u.end - u.start + (m ? m.start - u.end : f ? u.start - f.end : 0);
  return n.forEach((v, w) => {
    a < i && w > a && w <= i ? o[w] = -p : i < a && w >= i && w < a && (o[w] = p);
  }), o[a] = Math.min(Math.max(s, n[0].start - u.start), n[n.length - 1].end - u.end), o;
}
const Bf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function kv(n, a) {
  for (let i = n.parentElement; i; i = i.parentElement) {
    const s = getComputedStyle(i)[a === "x" ? "overflowX" : "overflowY"];
    if ((s === "auto" || s === "scroll") && (a === "x" ? i.scrollWidth > i.clientWidth : i.scrollHeight > i.clientHeight)) return i;
  }
  return null;
}
function Sv(n, a, i, s) {
  const o = n[a] ? kv(n[a], i) : null, u = () => o ? i === "x" ? o.scrollLeft : o.scrollTop : 0, m = (M) => (i === "x" ? M.clientX : M.clientY) + u(), f = m(s), p = u(), v = n.map((M) => {
    const j = M.getBoundingClientRect();
    return i === "x" ? { start: j.left + p, end: j.right + p } : { start: j.top + p, end: j.bottom + p };
  }), w = n.map((M) => Bf.map((j) => M.style[j])), y = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = i === "x" ? "translateX" : "translateY";
  let S = !1;
  const T = { to: a };
  n.forEach((M, j) => {
    if (M.style.pointerEvents = "none", j !== a) {
      y || (M.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(M).position === "static" && (M.style.position = "relative"), M.style.zIndex = "30", M.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const z = (M, j) => {
    T.to = M, _v(v, a, M, j).forEach((O, B) => {
      n[B].style.transform = O ? `${b}(${O}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return T.to;
    },
    slot: (M) => wv(v, a, m(M)),
    apply: (M, j) => {
      S || z(M, m(j) - f);
    },
    rest: () => {
      S || z(a, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((M, j) => Bf.forEach((O, B) => {
        M.style[O] = w[j][B];
      })));
    }
  };
}
const Ev = 5;
let fo = !1;
function zv(n, a) {
  if (n.button !== 0 || fo) return;
  const i = { clientX: n.clientX, clientY: n.clientY }, s = n.currentTarget, o = n.pointerId;
  let u = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, v = (T) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", w), window.removeEventListener("pointerup", y), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", b), s.removeEventListener("lostpointercapture", b);
    try {
      s.releasePointerCapture(o);
    } catch {
    }
    if (!u) return;
    fo = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, u.end();
    const z = (M) => M.stopPropagation();
    window.addEventListener("click", z, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", z, !0), 0), m?.(), a.onEnd(T, u);
  }, w = (T) => {
    if (!u) {
      if (Math.hypot(T.clientX - i.clientX, T.clientY - i.clientY) < Ev) return;
      const z = a.items();
      u = Sv(z, a.from(z), a.axis, i), fo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        s.setPointerCapture(o);
      } catch {
      }
      s.addEventListener("lostpointercapture", b);
      const M = a.onStart?.();
      m = typeof M == "function" ? M : void 0;
    }
    a.onMove(T, u);
  }, y = () => v(!0), b = () => v(!1), S = (T) => {
    T.key === "Escape" && (T.stopPropagation(), v(!1));
  };
  window.addEventListener("pointermove", w), window.addEventListener("pointerup", y), window.addEventListener("pointercancel", b), window.addEventListener("keydown", S, !0), window.addEventListener("blur", b);
}
const Vm = typeof navigator < "u" && /Mac/i.test(navigator.platform), di = {
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
for (let n = 1; n <= 12; n++) di[`f${n}`] = `F${n}`;
const Nv = Object.fromEntries(Object.entries(di).map(([n, a]) => [a, n])), Tv = {
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
function Mv(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : Nv[n];
}
const Uf = /* @__PURE__ */ new Map();
function Km(n, a = Vm) {
  const i = `${a}|${n}`, s = Uf.get(i);
  if (s) return s;
  const o = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const u of n.split("+"))
    if (u === "mod")
      a ? o.cmd = !0 : (o.ctrl = !0, o.shift = !0);
    else if (u === "cmd" || u === "ctrl" || u === "shift" || u === "alt") o[u] = !0;
    else if (/^[a-z]$/.test(u))
      o.code = `Key${u.toUpperCase()}`, o.letter = u;
    else if (/^[0-9]$/.test(u)) o.code = `Digit${u}`;
    else if (di[u]) o.code = di[u];
    else throw new Error(`unknown key "${u}" in "${n}"`);
  if (!o.code) throw new Error(`no key in "${n}"`);
  return Uf.set(i, o), o;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = Km(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function Cv(n, a = Vm) {
  const i = Km(n, a), s = Av(Mv(i.code) ?? "");
  return a ? `${i.ctrl ? "⌃" : ""}${i.alt ? "⌥" : ""}${i.shift ? "⇧" : ""}${i.cmd ? "⌘" : ""}${s}` : [i.ctrl && "Ctrl", i.alt && "Alt", i.shift && "Shift", s].filter(Boolean).join("+");
}
const Av = (n) => Tv[n] ?? n.toUpperCase(), Gf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, qf = Mm, bi = (n, a) => (i) => {
  var s;
  if (a?.variants == null) return qf(n, i?.class, i?.className);
  const { variants: o, defaultVariants: u } = a, m = Object.keys(o).map((v) => {
    const w = i?.[v], y = u?.[v];
    if (w === null) return null;
    const b = Gf(w) || Gf(y);
    return o[v][b];
  }), f = i && Object.entries(i).reduce((v, w) => {
    let [y, b] = w;
    return b === void 0 || (v[y] = b), v;
  }, {}), p = a == null || (s = a.compoundVariants) === null || s === void 0 ? void 0 : s.reduce((v, w) => {
    let { class: y, className: b, ...S } = w;
    return Object.entries(S).every((T) => {
      let [z, M] = T;
      return Array.isArray(M) ? M.includes({
        ...u,
        ...f
      }[z]) : {
        ...u,
        ...f
      }[z] === M;
    }) ? [
      ...v,
      y,
      b
    ] : v;
  }, []);
  return qf(n, m, p, i?.class, i?.className);
}, jv = bi(
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
), Ov = bi(
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
function Rv({ className: n, ...a } = {}) {
  return jt(Ov(a), n);
}
const Xm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Bl = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Dv = bi(`${Bl} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Hv({ className: n, ...a } = {}) {
  return jt(Dv(a), n);
}
const vi = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Co = bi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Bv = "my-1 h-px bg-overlay-0";
function Uv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Gv({ size: n = 16, className: a }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function qv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Zm({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Yf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Yv({ state: n, error: a }) {
  return /* @__PURE__ */ et.jsx(
    "span",
    {
      className: jt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Yf[n] ?? Yf.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function Lv({ title: n, onClose: a, children: i, testId: s }) {
  return Hl(
    /* @__PURE__ */ et.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (o) => {
          o.target === o.currentTarget && a();
        },
        onKeyDown: (o) => {
          o.key === "Escape" && a();
        },
        children: /* @__PURE__ */ et.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": s,
            children: [
              /* @__PURE__ */ et.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              i
            ]
          }
        )
      }
    ),
    document.body
  );
}
//! markdown.mjs: how much of a Markdown file the preview renders, cut where the web cuts it (`renderFilePreview` in
//! `packages/web/src/markdown.ts`). The document itself is drawn by the window's Markdown engine (`MarkdownPreview` in
//! `sdk.mjs`, `perch-markdown`).
const $r = 2e5;
function Qv(n) {
  if (n.length <= $r) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, $r);
  return { source: n.slice(0, a > 0 ? a : $r), truncated: !0 };
}
const Vr = 4, Hn = 8, Vv = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Lf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Kv({ value: n, onChange: a, options: i, className: s, ariaLabel: o, testId: u, id: m, title: f, disabled: p, placeholder: v, freeText: w, onKeyDown: y }) {
  const b = X.useId(), [S, T] = X.useState(!1), [z, M] = X.useState(-1), [j, O] = X.useState(!1), B = X.useRef(null), W = X.useRef(null), [J, D] = X.useState({}), g = X.useRef({ text: "", at: 0 }), h = w && j && n ? i.filter((L) => Lf(L).toLowerCase().includes(n.toLowerCase()) || L.value.toLowerCase().includes(n.toLowerCase())) : i, _ = i.find((L) => L.value === n), k = (L) => `${b}-${L}`;
  function N(L) {
    p || (M(L), T(!0));
  }
  function E() {
    T(!1), O(!1), M(-1);
  }
  function R(L) {
    !L || L.disabled || (a(L.value), E());
  }
  function Q(L, K) {
    for (let C = 1; C <= h.length; C++) {
      const Z = (L + K * C + h.length * C) % h.length;
      if (!h[Z].disabled) return Z;
    }
    return L;
  }
  const $ = () => h.findIndex((L) => !L.disabled), U = () => h.length - 1 - [...h].reverse().findIndex((L) => !L.disabled);
  jl(() => {
    if (!S || !B.current) {
      D((at) => at.left === void 0 ? at : {});
      return;
    }
    const L = B.current.getBoundingClientRect(), K = window.innerHeight - L.bottom - Vr - Hn, C = L.top - Vr - Hn, Z = K < 160 && C > K;
    D({
      position: "fixed",
      left: Math.min(Math.max(Hn, L.left), Math.max(Hn, window.innerWidth - L.width - Hn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: L.width,
      maxWidth: window.innerWidth - 2 * Hn,
      maxHeight: Math.min(Z ? C : K, 320),
      ...Z ? { bottom: window.innerHeight - L.top + Vr } : { top: L.bottom + Vr },
      overflowY: "auto"
    });
  }, [S, h.length]), jl(() => {
    const L = W.current;
    if (!S || !L || J.left === void 0) return;
    const K = L.getBoundingClientRect().right, C = window.innerWidth - Hn;
    K > C && D((Z) => ({ ...Z, left: Math.max(Hn, Number(Z.left) - (K - C)) }));
  }, [S, J]), Lt(() => {
    if (!S) return;
    const L = (K) => {
      const C = K.target;
      (C === document || C instanceof Node && B.current && C.contains(B.current)) && E();
    };
    return window.addEventListener("resize", E), window.addEventListener("scroll", L, !0), () => {
      window.removeEventListener("resize", E), window.removeEventListener("scroll", L, !0);
    };
  }, [S]), Lt(() => {
    const L = S && z >= 0 ? document.getElementById(k(z)) : null, K = W.current;
    !L || !K || (L.offsetTop < K.scrollTop ? K.scrollTop = L.offsetTop : L.offsetTop + L.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = L.offsetTop + L.offsetHeight - K.clientHeight));
  }, [S, z]), Fm(S, (L) => {
    L || E();
  }, B, W);
  function V(L) {
    if (L.nativeEvent.isComposing) return;
    const K = () => {
      L.preventDefault(), L.stopPropagation();
    }, { key: C } = L;
    if (S) {
      if (C === "Escape") {
        K(), E();
        return;
      } else if (C === "Tab")
        E();
      else if (C === "ArrowDown" || C === "ArrowUp") {
        K(), h.length && M(z < 0 ? C === "ArrowDown" ? $() : U() : Q(z, C === "ArrowDown" ? 1 : -1));
        return;
      } else if (C === "Home" && !w) {
        K(), M($());
        return;
      } else if (C === "End" && !w) {
        K(), M(U());
        return;
      } else if (C === "Enter" || C === " " && !w) {
        if (z >= 0 && h[z]) {
          K(), R(h[z]);
          return;
        }
        if (!w) {
          K(), E();
          return;
        }
      } else if (!w && C.length === 1 && !L.metaKey && !L.ctrlKey && !L.altKey) {
        const Z = Date.now();
        g.current = { text: (Z - g.current.at > 600 ? "" : g.current.text) + C.toLowerCase(), at: Z };
        const at = Math.max(z, 0), ot = [...h.slice(at + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, at + 1)].find((ct) => !ct.disabled && Lf(ct).toLowerCase().startsWith(g.current.text));
        ot && (K(), M(h.indexOf(ot)));
        return;
      }
    } else if (C === "ArrowDown" || C === "ArrowUp" || !w && (C === "Enter" || C === " ")) {
      K(), N(Math.max(0, h.findIndex((Z) => Z.value === n)));
      return;
    }
    y?.(L);
  }
  const I = {
    ref: (L) => {
      B.current = L;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": o,
    "aria-expanded": S,
    "aria-controls": S ? b : void 0,
    "aria-activedescendant": S && z >= 0 ? k(z) : void 0,
    "data-testid": u,
    onKeyDown: V
  };
  return /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
    w ? /* @__PURE__ */ et.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: v,
        className: s,
        value: n,
        onChange: (L) => {
          a(L.target.value), O(!0), S ? M(-1) : (M(-1), T(!0));
        },
        onBlur: () => E()
      }
    ) : /* @__PURE__ */ et.jsxs(
      "button",
      {
        ...I,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: jt("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", s),
        onClick: () => S ? E() : N(Math.max(0, h.findIndex((L) => L.value === n))),
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "min-w-0 flex-1 truncate", children: _ ? _.label : v ?? "" }),
          /* @__PURE__ */ et.jsx(Fo, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && h.length > 0 && Hl(
      /* @__PURE__ */ et.jsx(
        "div",
        {
          ref: W,
          id: b,
          role: "listbox",
          "aria-label": o,
          className: jt("z-[9999]", vi),
          style: J,
          onMouseDown: (L) => {
            L.preventDefault(), L.stopPropagation();
          },
          onClick: (L) => L.stopPropagation(),
          children: h.map((L, K) => /* @__PURE__ */ et.jsxs(
            "div",
            {
              id: k(K),
              role: "option",
              "aria-selected": L.value === n,
              "aria-disabled": L.disabled || void 0,
              "data-value": L.value,
              className: jt(Vv, K === z && !L.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                L.disabled || M(K);
              },
              onClick: () => R(L),
              children: [
                /* @__PURE__ */ et.jsx("span", { className: "min-w-0 truncate", children: L.label }),
                L.value === n && /* @__PURE__ */ et.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            L.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const Qf = 230, Xv = 370;
function Zv({ x: n, y: a, readOnly: i, canUndo: s, canRedo: o, hasSelection: u, onClose: m, actions: f }) {
  const p = X.useRef(null);
  Lt(() => {
    const b = (T) => {
      p.current?.contains(T.target) || m();
    }, S = (T) => {
      T.key === "Escape" && (T.preventDefault(), m());
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", S), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", S), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const v = (b, S) => Ro(np ? b : S), w = (b, S, T, z, M = !1) => /* @__PURE__ */ et.jsxs("button", { type: "button", className: jt(ap(), "flex items-center justify-between gap-6"), "data-testid": T, disabled: M, onClick: S, children: [
    /* @__PURE__ */ et.jsx("span", { children: b }),
    /* @__PURE__ */ et.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: z })
  ] }), y = f.askAgent;
  return Hl(
    /* @__PURE__ */ et.jsxs(
      "div",
      {
        ref: p,
        className: vi,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - Xv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - Qf - 8)),
          zIndex: 9999,
          minWidth: Qf
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          y && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
            w(u ? "Ask agent about selection…" : "Ask agent about file…", y, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ et.jsx("div", { className: Pr })
          ] }),
          w("Undo", f.undo, "editor-menu-undo", v("cmd+z", "ctrl+z"), i || !s),
          w("Redo", f.redo, "editor-menu-redo", v("cmd+shift+z", "ctrl+y"), i || !o),
          /* @__PURE__ */ et.jsx("div", { className: Pr }),
          w("Cut", f.cut, "editor-menu-cut", v("cmd+x", "ctrl+x"), i || !u),
          w("Copy", f.copy, "editor-menu-copy", v("cmd+c", "ctrl+c"), !u),
          w("Paste", f.paste, "editor-menu-paste", v("cmd+v", "ctrl+v"), i),
          w("Select All", f.selectAll, "editor-menu-select-all", v("cmd+a", "ctrl+a")),
          /* @__PURE__ */ et.jsx("div", { className: Pr }),
          w("Find…", f.find, "editor-menu-find", v("cmd+f", "ctrl+f")),
          !i && w("Replace…", f.replace, "editor-menu-replace", v("cmd+alt+f", "ctrl+h")),
          w("Go to Line…", f.gotoLine, "editor-menu-goto", Ro("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const Jv = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Wv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Fv = "m-0 mb-2 text-[0.82rem] text-subtext-0", Jm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Jo = `${Jm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, $v = `${Jo} min-w-[5.5rem] shrink-0`, Wo = `${Jm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Iv = `${Wo} flex-1 max-[700px]:flex-[1_1_100%]`, Pv = `${Wo} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, t1 = `${Wo} flex-[1_1_100%]`, e1 = "flex flex-wrap items-center gap-[0.4rem]", n1 = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", a1 = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", l1 = `settings-modal__host-row ${a1}`, r1 = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", i1 = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Wm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", s1 = `${Wm} bg-accent`, o1 = `${Wm} ml-auto bg-red`;
function Fo({ open: n, size: a = 12, className: i }) {
  return /* @__PURE__ */ et.jsx("svg", { className: i, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function c1({ label: n, items: a, testId: i, side: s = "right", up: o = !1, maxHeight: u = 320 }) {
  const [m, f] = X.useState(!1), [p, v] = X.useState(!1), w = X.useRef(null), y = X.useRef(null), b = () => [...y.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Lt(() => {
    m && p && (b()[0]?.focus(), v(!1));
  }, [m, p]);
  const S = () => {
    f(!0), v(!0);
  }, T = (M) => {
    (M.key === "ArrowRight" || M.key === "Enter" || M.key === " ") && (M.preventDefault(), S());
  }, z = (M) => {
    const j = b(), O = j.findIndex((B) => B === document.activeElement);
    M.key === "ArrowDown" || M.key === "ArrowUp" ? (M.preventDefault(), j[(O + (M.key === "ArrowDown" ? 1 : j.length - 1)) % j.length]?.focus()) : (M.key === "ArrowLeft" || M.key === "Escape") && (M.preventDefault(), M.stopPropagation(), f(!1), w.current?.focus());
  };
  return /* @__PURE__ */ et.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ et.jsxs(
      "button",
      {
        ref: w,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: jt(Co(), "flex items-center justify-between gap-2"),
        "data-testid": i,
        onClick: () => m ? f(!1) : S(),
        onKeyDown: T,
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ et.jsx(Fo, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ et.jsx(
      "div",
      {
        ref: y,
        role: "menu",
        "aria-label": n,
        className: jt(
          vi,
          "absolute z-10 w-60 overflow-y-auto",
          s === "right" ? "left-full" : "right-full",
          o ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: u },
        onKeyDown: z,
        children: a.map((M) => /* @__PURE__ */ et.jsx("button", { type: "button", role: "menuitem", className: Co(), "data-testid": M.testId, onClick: M.onSelect, children: /* @__PURE__ */ et.jsx("span", { className: "block truncate", children: M.label }) }, M.key))
      }
    )
  ] });
}
function u1(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
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
function jo(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((i) => i.id === n.parentSessionId);
}
function d1(n) {
  const a = /* @__PURE__ */ new Map();
  for (const i of n)
    jo(i, n) && a.set(i.parentSessionId, [...a.get(i.parentSessionId) ?? [], i]);
  return a.size ? n.filter((i) => !jo(i, n)).flatMap((i) => [i, ...a.get(i.id) ?? []]) : n;
}
const Kr = 6, Vf = 8;
function f1(n, a = {}) {
  const { minWidth: i = 220, align: s = "right", minSpaceAbove: o = 100 } = a, u = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = s === "right" ? { right: Math.max(0, m - u.right) } : { left: Math.max(0, u.left) }, v = u.top - Kr - Vf, w = f - u.bottom - Kr - Vf;
  return v >= o ? {
    position: "fixed",
    bottom: f - u.top + Kr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(v, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: u.bottom + Kr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(w, f * 0.75),
    overflowY: "auto"
  };
}
function Fm(n, a, i, s) {
  Lt(() => {
    if (!n) return;
    function o(m) {
      const f = m.target, p = i.current?.contains(f) ?? !1, v = s.current?.contains(f) ?? !1;
      !p && !v && a(!1);
    }
    function u(m) {
      m.key === "Escape" && a(!1);
    }
    return document.addEventListener("mousedown", o), document.addEventListener("keydown", u), () => {
      document.removeEventListener("mousedown", o), document.removeEventListener("keydown", u);
    };
  }, [n]);
}
function m1({ icon: n, fallback: a }) {
  const [i, s] = X.useState(!1);
  return Lt(() => s(!1), [n]), !n || i ? /* @__PURE__ */ et.jsx(et.Fragment, { children: a }) : /* @__PURE__ */ et.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => s(!0) });
}
const p1 = ["application/zip", "application/x-tar", "application/gzip"];
function $m(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (p1.includes(a)) return "archive";
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
const h1 = 50 * 1024 * 1024, Kf = 1.25, g1 = 0.05, b1 = 16384, v1 = "inline-flex items-center justify-center", Xr = jt(Bl, v1, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), mo = jt(Bl, "inline-flex min-h-8 items-center px-2"), y1 = { pdf: "PDF document", audio: "Audio", video: "Video" };
let x1 = 0;
function w1(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function _1(n, a, i) {
  const s = a ? Math.min(8, b1 / Math.max(a.width, a.height)) : 1, o = i === "in" ? n * Kf : i === "out" ? n / Kf : 1;
  return Math.min(s, Math.max(Math.min(g1, s), o));
}
function k1(n, a) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${a.replace(/^\/+/, "")}`;
}
function S1({ media: n, workspaceId: a, metadata: i, onFail: s }) {
  const o = X.useMemo(() => `media-${++x1}`, []), [u, m] = X.useState(null), [f, p] = X.useState("fit");
  Lt(() => {
    let T = !0;
    return n.open(o, { workspaceId: a, path: i.path, mediaType: i.mediaType ?? "", size: i.size }).then((z) => {
      T && m(z ?? { width: 0, height: 0 });
    }, (z) => {
      T && s(String(z?.message ?? z));
    }), () => {
      T = !1, n.release(o);
    };
  }, [o]), Lt(() => {
    n.setZoom(o, f === "fit" ? null : f);
  }, [o, f]);
  const v = u !== null && u.width > 0 && u.height > 0, w = () => f !== "fit" ? f : n.fitScale(o) ?? 1, y = (T) => p(_1(w(), u, T)), b = (T) => {
    if (!(T.metaKey || T.ctrlKey || T.altKey || !v)) {
      if (T.key === "+" || T.key === "=") y("in");
      else if (T.key === "-") y("out");
      else if (T.key === "0") y("actual");
      else return;
      T.preventDefault();
    }
  }, S = f === "fit" ? "Fit" : `${Math.round(f * 100)}%`;
  return X.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    X.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      X.createElement("button", { type: "button", className: Xr, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !v, onClick: () => y("out") }, "−"),
      X.createElement("button", { type: "button", className: Xr, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !v, onClick: () => y("in") }, "+"),
      X.createElement("button", { type: "button", className: jt(Xr, f === "fit" && "text-fg"), "aria-pressed": f === "fit", onClick: () => p("fit") }, "Fit"),
      X.createElement("button", { type: "button", className: jt(Xr, f === 1 && "text-fg"), "aria-pressed": f === 1, title: "Actual size (0)", disabled: !v, onClick: () => y("actual") }, "100%"),
      X.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, v ? `${u.width} × ${u.height} · ${S}` : "")
    ),
    X.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${i.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: b
    }, u === null ? X.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : X.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": o, "data-testid": "workspace-file-image" }))
  );
}
function E1({ workspaceId: n, metadata: a, perch: i }) {
  const [s, o] = X.useState(!1), u = i.mediaFile?.(n, a.path) ?? { root: null, extraction: null }, m = u.extraction, f = $m(a.mediaType), p = k1(u.root, a.path), v = p === null, w = f === "archive", y = f === "image" && a.size > h1, b = f !== void 0 && !w && !v && !y;
  let S = "Open this file in Quick Look or its default app.";
  v ? S = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : w && (S = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let T = "No preview for this file type";
  v ? T = "Remote media is not available yet" : w ? T = "Compressed archive" : y ? (T = "Image too large to preview", S = `This image is ${Math.round(a.size / 1048576)} MB. Open it in Quick Look or its default app.`) : s && (T = "Preview unavailable", f === "image" && (S = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const z = (j) => {
    try {
      i.media[j](p);
    } catch (O) {
      console.error(`perch-media ${j}: ${O?.message ?? O}`);
    }
  }, M = f === "pdf" || f === "audio" || f === "video";
  return X.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${a.path}`, "data-testid": "workspace-file-asset" },
    X.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      X.createElement("strong", { className: "min-w-0 flex-1 truncate", title: a.path }, a.path),
      w && X.createElement(
        "button",
        { type: "button", className: mo, disabled: m?.state === "loading", onClick: () => i.command("files.extract", { workspaceId: n, path: a.path }) },
        m?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !v && X.createElement("button", { type: "button", className: mo, onClick: () => z("quickLook") }, "Quick Look"),
      !v && X.createElement("button", { type: "button", className: mo, onClick: () => z("openDefault") }, "Open with Default App")
    ),
    m?.state === "ready" && X.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${m.destination}. Find it in the file tree.`),
    m?.state === "error" && X.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, m.error),
    !b || s ? X.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      X.createElement("strong", { className: "text-fg" }, T),
      X.createElement("span", null, S)
    ) : f === "image" ? X.createElement(S1, { media: i.media, workspaceId: n, metadata: a, onFail: () => o(!0) }) : M && X.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      X.createElement("strong", { className: "text-fg" }, a.name),
      X.createElement("span", null, `${y1[f]} · ${w1(a.size)}`),
      X.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function z1(n, a = !1) {
  const i = n.toLowerCase();
  if (a) return { kind: /^(node_modules|packages|crates|vendor)$/.test(i) ? "package" : i === "lib" ? "library" : "folder", tone: "text-subtext-0" };
  if (/^(package\.json|cargo\.toml|go\.mod|pyproject\.toml|gemfile|composer\.json)$/.test(i)) return { kind: "package", tone: "text-peach" };
  if (/^(dockerfile|containerfile)(\.|$)/.test(i)) return { kind: "package", tone: "text-blue" };
  if (/^(\.gitignore|\.gitattributes|\.gitmodules)$/.test(i)) return { kind: "branch", tone: "text-subtext-0" };
  if (/\.(tsx|jsx)$/.test(i)) return { kind: "react", tone: "text-blue" };
  if (/\.(css|scss|sass|less)$/.test(i)) return { kind: "style", tone: "text-mauve" };
  if (/\.(md|mdx|txt|rst)$/.test(i) || /^(readme|license|copying)(\.|$)/.test(i)) return { kind: "book", tone: "text-subtext-0" };
  if (/\.(json|jsonc|ya?ml|toml|lock|ini|conf)$/.test(i) || /^\.env(\.|$)/.test(i)) return { kind: "config", tone: "text-yellow" };
  if (/\.(png|jpe?g|gif|webp|svg|ico|avif)$/.test(i)) return { kind: "image", tone: "text-mauve" };
  const s = i.split(".").at(-1) ?? "", o = {
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
  }, u = n.includes(".") && Object.hasOwn(o, s) ? o[s] : void 0;
  return u ? { kind: "language", tone: u[1], text: u[0] } : /\.(html?|vue|svelte)$/.test(i) ? { kind: "code", tone: "text-peach" } : { kind: "file", tone: "text-subtext-0" };
}
const N1 = {
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
function T1({ name: n, directory: a = !1, open: i = !1 }) {
  const { kind: s, tone: o, text: u } = z1(n, a);
  return /* @__PURE__ */ et.jsxs("svg", { className: jt("size-[calc(14px*var(--zoom,1))] shrink-0", o), "data-file-icon": s, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    s === "react" ? /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : u ? /* @__PURE__ */ et.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: u }) : /* @__PURE__ */ et.jsx("path", { d: s === "folder" && i ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : N1[s] }),
    s === "branch" && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    s === "image" && /* @__PURE__ */ et.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const M1 = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, Xf = (n) => typeof n == "string" ? M1[n] ?? "?" : "?", Zf = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function C1(n) {
  const a = Xf(n.index), i = Xf(n.worktree), s = a === "!" || i === "!", o = s ? "!" : n.staged && n.unstaged ? `${a || "?"}/${i || "?"}` : n.staged ? a : i || a, u = `Git · Index: ${Zf(n.index)}; working tree: ${Zf(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = s || o.includes("D") ? "text-red" : o === "U" || o === "A" || o === "C" ? "text-green" : o.includes("?") || o === "I" ? "text-subtext-0" : "text-yellow";
  return { label: o, title: u, tone: m };
}
function A1({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: i, title: s, tone: o } = C1(n.entry);
  return i ? /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", o), "aria-label": s, title: s, "data-testid": "file-git-marker", children: i }) : null;
}
const j1 = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Im = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", O1 = `${Im} group-aria-[checked=false]:text-accent`, R1 = `${Im} group-aria-checked:text-accent`, D1 = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", H1 = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function B1({
  mode: n,
  onChange: a,
  testId: i = "mode-switch",
  disabled: s = !1
}) {
  const o = n === "cli";
  return /* @__PURE__ */ et.jsxs(
    "button",
    {
      type: "button",
      className: j1,
      "data-testid": i,
      role: "switch",
      "aria-checked": o,
      "aria-label": "Toggle UI / CLI mode",
      disabled: s,
      onClick: () => a(o ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--ui", O1), children: "UI" }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__track", D1), children: /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__thumb", H1) }) }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--cli", R1), children: "CLI" })
      ]
    }
  );
}
const Va = function(n, a) {
  let o = n;
  const u = zl[a];
  let m = null, f = 0, p = null;
  const v = [], w = {}, y = function(g, h) {
    f = o * 4 + 17, m = (function(_) {
      const k = new Array(_);
      for (let N = 0; N < _; N += 1) {
        k[N] = new Array(_);
        for (let E = 0; E < _; E += 1)
          k[N][E] = null;
      }
      return k;
    })(f), b(0, 0), b(f - 7, 0), b(0, f - 7), z(), T(), j(g, h), o >= 7 && M(g), p == null && (p = W(o, u, v)), O(p, h);
  }, b = function(g, h) {
    for (let _ = -1; _ <= 7; _ += 1)
      if (!(g + _ <= -1 || f <= g + _))
        for (let k = -1; k <= 7; k += 1)
          h + k <= -1 || f <= h + k || (0 <= _ && _ <= 6 && (k == 0 || k == 6) || 0 <= k && k <= 6 && (_ == 0 || _ == 6) || 2 <= _ && _ <= 4 && 2 <= k && k <= 4 ? m[g + _][h + k] = !0 : m[g + _][h + k] = !1);
  }, S = function() {
    let g = 0, h = 0;
    for (let _ = 0; _ < 8; _ += 1) {
      y(!0, _);
      const k = Un.getLostPoint(w);
      (_ == 0 || g > k) && (g = k, h = _);
    }
    return h;
  }, T = function() {
    for (let g = 8; g < f - 8; g += 1)
      m[g][6] == null && (m[g][6] = g % 2 == 0);
    for (let g = 8; g < f - 8; g += 1)
      m[6][g] == null && (m[6][g] = g % 2 == 0);
  }, z = function() {
    const g = Un.getPatternPosition(o);
    for (let h = 0; h < g.length; h += 1)
      for (let _ = 0; _ < g.length; _ += 1) {
        const k = g[h], N = g[_];
        if (m[k][N] == null)
          for (let E = -2; E <= 2; E += 1)
            for (let R = -2; R <= 2; R += 1)
              E == -2 || E == 2 || R == -2 || R == 2 || E == 0 && R == 0 ? m[k + E][N + R] = !0 : m[k + E][N + R] = !1;
      }
  }, M = function(g) {
    const h = Un.getBCHTypeNumber(o);
    for (let _ = 0; _ < 18; _ += 1) {
      const k = !g && (h >> _ & 1) == 1;
      m[Math.floor(_ / 3)][_ % 3 + f - 8 - 3] = k;
    }
    for (let _ = 0; _ < 18; _ += 1) {
      const k = !g && (h >> _ & 1) == 1;
      m[_ % 3 + f - 8 - 3][Math.floor(_ / 3)] = k;
    }
  }, j = function(g, h) {
    const _ = u << 3 | h, k = Un.getBCHTypeInfo(_);
    for (let N = 0; N < 15; N += 1) {
      const E = !g && (k >> N & 1) == 1;
      N < 6 ? m[N][8] = E : N < 8 ? m[N + 1][8] = E : m[f - 15 + N][8] = E;
    }
    for (let N = 0; N < 15; N += 1) {
      const E = !g && (k >> N & 1) == 1;
      N < 8 ? m[8][f - N - 1] = E : N < 9 ? m[8][15 - N - 1 + 1] = E : m[8][15 - N - 1] = E;
    }
    m[f - 8][8] = !g;
  }, O = function(g, h) {
    let _ = -1, k = f - 1, N = 7, E = 0;
    const R = Un.getMaskFunction(h);
    for (let Q = f - 1; Q > 0; Q -= 2)
      for (Q == 6 && (Q -= 1); ; ) {
        for (let $ = 0; $ < 2; $ += 1)
          if (m[k][Q - $] == null) {
            let U = !1;
            E < g.length && (U = (g[E] >>> N & 1) == 1), R(k, Q - $) && (U = !U), m[k][Q - $] = U, N -= 1, N == -1 && (E += 1, N = 7);
          }
        if (k += _, k < 0 || f <= k) {
          k -= _, _ = -_;
          break;
        }
      }
  }, B = function(g, h) {
    let _ = 0, k = 0, N = 0;
    const E = new Array(h.length), R = new Array(h.length);
    for (let V = 0; V < h.length; V += 1) {
      const I = h[V].dataCount, L = h[V].totalCount - I;
      k = Math.max(k, I), N = Math.max(N, L), E[V] = new Array(I);
      for (let at = 0; at < E[V].length; at += 1)
        E[V][at] = 255 & g.getBuffer()[at + _];
      _ += I;
      const K = Un.getErrorCorrectPolynomial(L), Z = Ol(E[V], K.getLength() - 1).mod(K);
      R[V] = new Array(K.getLength() - 1);
      for (let at = 0; at < R[V].length; at += 1) {
        const ot = at + Z.getLength() - R[V].length;
        R[V][at] = ot >= 0 ? Z.getAt(ot) : 0;
      }
    }
    let Q = 0;
    for (let V = 0; V < h.length; V += 1)
      Q += h[V].totalCount;
    const $ = new Array(Q);
    let U = 0;
    for (let V = 0; V < k; V += 1)
      for (let I = 0; I < h.length; I += 1)
        V < E[I].length && ($[U] = E[I][V], U += 1);
    for (let V = 0; V < N; V += 1)
      for (let I = 0; I < h.length; I += 1)
        V < R[I].length && ($[U] = R[I][V], U += 1);
    return $;
  }, W = function(g, h, _) {
    const k = Jf.getRSBlocks(g, h), N = Wf();
    for (let R = 0; R < _.length; R += 1) {
      const Q = _[R];
      N.put(Q.getMode(), 4), N.put(Q.getLength(), Un.getLengthInBits(Q.getMode(), g)), Q.write(N);
    }
    let E = 0;
    for (let R = 0; R < k.length; R += 1)
      E += k[R].dataCount;
    if (N.getLengthInBits() > E * 8)
      throw "code length overflow. (" + N.getLengthInBits() + ">" + E * 8 + ")";
    for (N.getLengthInBits() + 4 <= E * 8 && N.put(0, 4); N.getLengthInBits() % 8 != 0; )
      N.putBit(!1);
    for (; !(N.getLengthInBits() >= E * 8 || (N.put(236, 8), N.getLengthInBits() >= E * 8)); )
      N.put(17, 8);
    return B(N, k);
  };
  w.addData = function(g, h) {
    h = h || "Byte";
    let _ = null;
    switch (h) {
      case "Numeric":
        _ = U1(g);
        break;
      case "Alphanumeric":
        _ = G1(g);
        break;
      case "Byte":
        _ = q1(g);
        break;
      case "Kanji":
        _ = Y1(g);
        break;
      default:
        throw "mode:" + h;
    }
    v.push(_), p = null;
  }, w.isDark = function(g, h) {
    if (g < 0 || f <= g || h < 0 || f <= h)
      throw g + "," + h;
    return m[g][h];
  }, w.getModuleCount = function() {
    return f;
  }, w.make = function() {
    if (o < 1) {
      let g = 1;
      for (; g < 40; g++) {
        const h = Jf.getRSBlocks(g, u), _ = Wf();
        for (let N = 0; N < v.length; N++) {
          const E = v[N];
          _.put(E.getMode(), 4), _.put(E.getLength(), Un.getLengthInBits(E.getMode(), g)), E.write(_);
        }
        let k = 0;
        for (let N = 0; N < h.length; N++)
          k += h[N].dataCount;
        if (_.getLengthInBits() <= k * 8)
          break;
      }
      o = g;
    }
    y(!1, S());
  }, w.createTableTag = function(g, h) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    let _ = "";
    _ += '<table style="', _ += " border-width: 0px; border-style: none;", _ += " border-collapse: collapse;", _ += " padding: 0px; margin: " + h + "px;", _ += '">', _ += "<tbody>";
    for (let k = 0; k < w.getModuleCount(); k += 1) {
      _ += "<tr>";
      for (let N = 0; N < w.getModuleCount(); N += 1)
        _ += '<td style="', _ += " border-width: 0px; border-style: none;", _ += " border-collapse: collapse;", _ += " padding: 0px; margin: 0px;", _ += " width: " + g + "px;", _ += " height: " + g + "px;", _ += " background-color: ", _ += w.isDark(k, N) ? "#000000" : "#ffffff", _ += ";", _ += '"/>';
      _ += "</tr>";
    }
    return _ += "</tbody>", _ += "</table>", _;
  }, w.createSvgTag = function(g, h, _, k) {
    let N = {};
    typeof arguments[0] == "object" && (N = arguments[0], g = N.cellSize, h = N.margin, _ = N.alt, k = N.title), g = g || 2, h = typeof h > "u" ? g * 4 : h, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-description" : null, k = typeof k == "string" ? { text: k } : k || {}, k.text = k.text || null, k.id = k.text ? k.id || "qrcode-title" : null;
    const E = w.getModuleCount() * g + h * 2;
    let R, Q, $, U, V = "", I;
    for (I = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", V += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', V += N.scalable ? "" : ' width="' + E + 'px" height="' + E + 'px"', V += ' viewBox="0 0 ' + E + " " + E + '" ', V += ' preserveAspectRatio="xMinYMin meet"', V += k.text || _.text ? ' role="img" aria-labelledby="' + J([k.id, _.id].join(" ").trim()) + '"' : "", V += ">", V += k.text ? '<title id="' + J(k.id) + '">' + J(k.text) + "</title>" : "", V += _.text ? '<description id="' + J(_.id) + '">' + J(_.text) + "</description>" : "", V += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', V += '<path d="', $ = 0; $ < w.getModuleCount(); $ += 1)
      for (U = $ * g + h, R = 0; R < w.getModuleCount(); R += 1)
        w.isDark($, R) && (Q = R * g + h, V += "M" + Q + "," + U + I);
    return V += '" stroke="transparent" fill="black"/>', V += "</svg>", V;
  }, w.createDataURL = function(g, h) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    const _ = w.getModuleCount() * g + h * 2, k = h, N = _ - h;
    return K1(_, _, function(E, R) {
      if (k <= E && E < N && k <= R && R < N) {
        const Q = Math.floor((E - k) / g), $ = Math.floor((R - k) / g);
        return w.isDark($, Q) ? 0 : 1;
      } else
        return 1;
    });
  }, w.createImgTag = function(g, h, _) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    const k = w.getModuleCount() * g + h * 2;
    let N = "";
    return N += "<img", N += ' src="', N += w.createDataURL(g, h), N += '"', N += ' width="', N += k, N += '"', N += ' height="', N += k, N += '"', _ && (N += ' alt="', N += J(_), N += '"'), N += "/>", N;
  };
  const J = function(g) {
    let h = "";
    for (let _ = 0; _ < g.length; _ += 1) {
      const k = g.charAt(_);
      switch (k) {
        case "<":
          h += "&lt;";
          break;
        case ">":
          h += "&gt;";
          break;
        case "&":
          h += "&amp;";
          break;
        case '"':
          h += "&quot;";
          break;
        default:
          h += k;
          break;
      }
    }
    return h;
  }, D = function(g) {
    g = typeof g > "u" ? 2 : g;
    const _ = w.getModuleCount() * 1 + g * 2, k = g, N = _ - g;
    let E, R, Q, $, U;
    const V = {
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
    let L = "";
    for (E = 0; E < _; E += 2) {
      for (Q = Math.floor((E - k) / 1), $ = Math.floor((E + 1 - k) / 1), R = 0; R < _; R += 1)
        U = "█", k <= R && R < N && k <= E && E < N && w.isDark(Q, Math.floor((R - k) / 1)) && (U = " "), k <= R && R < N && k <= E + 1 && E + 1 < N && w.isDark($, Math.floor((R - k) / 1)) ? U += " " : U += "█", L += g < 1 && E + 1 >= N ? I[U] : V[U];
      L += `
`;
    }
    return _ % 2 && g > 0 ? L.substring(0, L.length - _ - 1) + Array(_ + 1).join("▀") : L.substring(0, L.length - 1);
  };
  return w.createASCII = function(g, h) {
    if (g = g || 1, g < 2)
      return D(h);
    g -= 1, h = typeof h > "u" ? g * 2 : h;
    const _ = w.getModuleCount() * g + h * 2, k = h, N = _ - h;
    let E, R, Q, $;
    const U = Array(g + 1).join("██"), V = Array(g + 1).join("  ");
    let I = "", L = "";
    for (E = 0; E < _; E += 1) {
      for (Q = Math.floor((E - k) / g), L = "", R = 0; R < _; R += 1)
        $ = 1, k <= R && R < N && k <= E && E < N && w.isDark(Q, Math.floor((R - k) / g)) && ($ = 0), L += $ ? U : V;
      for (Q = 0; Q < g; Q += 1)
        I += L + `
`;
    }
    return I.substring(0, I.length - 1);
  }, w.renderTo2dContext = function(g, h) {
    h = h || 2;
    const _ = w.getModuleCount();
    for (let k = 0; k < _; k++)
      for (let N = 0; N < _; N++)
        g.fillStyle = w.isDark(k, N) ? "black" : "white", g.fillRect(N * h, k * h, h, h);
  }, w;
};
Va.stringToBytes = function(n) {
  const a = [];
  for (let i = 0; i < n.length; i += 1) {
    const s = n.charCodeAt(i);
    a.push(s & 255);
  }
  return a;
};
Va.createStringToBytes = function(n, a) {
  const i = (function() {
    const o = Q1(n), u = function() {
      const p = o.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = o.read();
      if (p == -1) break;
      const v = u(), w = u(), y = u(), b = String.fromCharCode(p << 8 | v), S = w << 8 | y;
      f[b] = S, m += 1;
    }
    if (m != a)
      throw m + " != " + a;
    return f;
  })(), s = 63;
  return function(o) {
    const u = [];
    for (let m = 0; m < o.length; m += 1) {
      const f = o.charCodeAt(m);
      if (f < 128)
        u.push(f);
      else {
        const p = i[o.charAt(m)];
        typeof p == "number" ? (p & 255) == p ? u.push(p) : (u.push(p >>> 8), u.push(p & 255)) : u.push(s);
      }
    }
    return u;
  };
};
const de = {
  MODE_NUMBER: 1,
  MODE_ALPHA_NUM: 2,
  MODE_8BIT_BYTE: 4,
  MODE_KANJI: 8
}, zl = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
}, Bn = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
}, Un = (function() {
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
  ], a = 1335, i = 7973, s = 21522, o = {}, u = function(m) {
    let f = 0;
    for (; m != 0; )
      f += 1, m >>>= 1;
    return f;
  };
  return o.getBCHTypeInfo = function(m) {
    let f = m << 10;
    for (; u(f) - u(a) >= 0; )
      f ^= a << u(f) - u(a);
    return (m << 10 | f) ^ s;
  }, o.getBCHTypeNumber = function(m) {
    let f = m << 12;
    for (; u(f) - u(i) >= 0; )
      f ^= i << u(f) - u(i);
    return m << 12 | f;
  }, o.getPatternPosition = function(m) {
    return n[m - 1];
  }, o.getMaskFunction = function(m) {
    switch (m) {
      case Bn.PATTERN000:
        return function(f, p) {
          return (f + p) % 2 == 0;
        };
      case Bn.PATTERN001:
        return function(f, p) {
          return f % 2 == 0;
        };
      case Bn.PATTERN010:
        return function(f, p) {
          return p % 3 == 0;
        };
      case Bn.PATTERN011:
        return function(f, p) {
          return (f + p) % 3 == 0;
        };
      case Bn.PATTERN100:
        return function(f, p) {
          return (Math.floor(f / 2) + Math.floor(p / 3)) % 2 == 0;
        };
      case Bn.PATTERN101:
        return function(f, p) {
          return f * p % 2 + f * p % 3 == 0;
        };
      case Bn.PATTERN110:
        return function(f, p) {
          return (f * p % 2 + f * p % 3) % 2 == 0;
        };
      case Bn.PATTERN111:
        return function(f, p) {
          return (f * p % 3 + (f + p) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + m;
    }
  }, o.getErrorCorrectPolynomial = function(m) {
    let f = Ol([1], 0);
    for (let p = 0; p < m; p += 1)
      f = f.multiply(Ol([1, Gn.gexp(p)], 0));
    return f;
  }, o.getLengthInBits = function(m, f) {
    if (1 <= f && f < 10)
      switch (m) {
        case de.MODE_NUMBER:
          return 10;
        case de.MODE_ALPHA_NUM:
          return 9;
        case de.MODE_8BIT_BYTE:
          return 8;
        case de.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + m;
      }
    else if (f < 27)
      switch (m) {
        case de.MODE_NUMBER:
          return 12;
        case de.MODE_ALPHA_NUM:
          return 11;
        case de.MODE_8BIT_BYTE:
          return 16;
        case de.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + m;
      }
    else if (f < 41)
      switch (m) {
        case de.MODE_NUMBER:
          return 14;
        case de.MODE_ALPHA_NUM:
          return 13;
        case de.MODE_8BIT_BYTE:
          return 16;
        case de.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + m;
      }
    else
      throw "type:" + f;
  }, o.getLostPoint = function(m) {
    const f = m.getModuleCount();
    let p = 0;
    for (let y = 0; y < f; y += 1)
      for (let b = 0; b < f; b += 1) {
        let S = 0;
        const T = m.isDark(y, b);
        for (let z = -1; z <= 1; z += 1)
          if (!(y + z < 0 || f <= y + z))
            for (let M = -1; M <= 1; M += 1)
              b + M < 0 || f <= b + M || z == 0 && M == 0 || T == m.isDark(y + z, b + M) && (S += 1);
        S > 5 && (p += 3 + S - 5);
      }
    for (let y = 0; y < f - 1; y += 1)
      for (let b = 0; b < f - 1; b += 1) {
        let S = 0;
        m.isDark(y, b) && (S += 1), m.isDark(y + 1, b) && (S += 1), m.isDark(y, b + 1) && (S += 1), m.isDark(y + 1, b + 1) && (S += 1), (S == 0 || S == 4) && (p += 3);
      }
    for (let y = 0; y < f; y += 1)
      for (let b = 0; b < f - 6; b += 1)
        m.isDark(y, b) && !m.isDark(y, b + 1) && m.isDark(y, b + 2) && m.isDark(y, b + 3) && m.isDark(y, b + 4) && !m.isDark(y, b + 5) && m.isDark(y, b + 6) && (p += 40);
    for (let y = 0; y < f; y += 1)
      for (let b = 0; b < f - 6; b += 1)
        m.isDark(b, y) && !m.isDark(b + 1, y) && m.isDark(b + 2, y) && m.isDark(b + 3, y) && m.isDark(b + 4, y) && !m.isDark(b + 5, y) && m.isDark(b + 6, y) && (p += 40);
    let v = 0;
    for (let y = 0; y < f; y += 1)
      for (let b = 0; b < f; b += 1)
        m.isDark(b, y) && (v += 1);
    const w = Math.abs(100 * v / f / f - 50) / 5;
    return p += w * 10, p;
  }, o;
})(), Gn = (function() {
  const n = new Array(256), a = new Array(256);
  for (let s = 0; s < 8; s += 1)
    n[s] = 1 << s;
  for (let s = 8; s < 256; s += 1)
    n[s] = n[s - 4] ^ n[s - 5] ^ n[s - 6] ^ n[s - 8];
  for (let s = 0; s < 255; s += 1)
    a[n[s]] = s;
  const i = {};
  return i.glog = function(s) {
    if (s < 1)
      throw "glog(" + s + ")";
    return a[s];
  }, i.gexp = function(s) {
    for (; s < 0; )
      s += 255;
    for (; s >= 256; )
      s -= 255;
    return n[s];
  }, i;
})(), Ol = function(n, a) {
  if (typeof n.length > "u")
    throw n.length + "/" + a;
  const i = (function() {
    let o = 0;
    for (; o < n.length && n[o] == 0; )
      o += 1;
    const u = new Array(n.length - o + a);
    for (let m = 0; m < n.length - o; m += 1)
      u[m] = n[m + o];
    return u;
  })(), s = {};
  return s.getAt = function(o) {
    return i[o];
  }, s.getLength = function() {
    return i.length;
  }, s.multiply = function(o) {
    const u = new Array(s.getLength() + o.getLength() - 1);
    for (let m = 0; m < s.getLength(); m += 1)
      for (let f = 0; f < o.getLength(); f += 1)
        u[m + f] ^= Gn.gexp(Gn.glog(s.getAt(m)) + Gn.glog(o.getAt(f)));
    return Ol(u, 0);
  }, s.mod = function(o) {
    if (s.getLength() - o.getLength() < 0)
      return s;
    const u = Gn.glog(s.getAt(0)) - Gn.glog(o.getAt(0)), m = new Array(s.getLength());
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] = s.getAt(f);
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] ^= Gn.gexp(Gn.glog(o.getAt(f)) + u);
    return Ol(m, 0).mod(o);
  }, s;
}, Jf = (function() {
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
  ], a = function(o, u) {
    const m = {};
    return m.totalCount = o, m.dataCount = u, m;
  }, i = {}, s = function(o, u) {
    switch (u) {
      case zl.L:
        return n[(o - 1) * 4 + 0];
      case zl.M:
        return n[(o - 1) * 4 + 1];
      case zl.Q:
        return n[(o - 1) * 4 + 2];
      case zl.H:
        return n[(o - 1) * 4 + 3];
      default:
        return;
    }
  };
  return i.getRSBlocks = function(o, u) {
    const m = s(o, u);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + o + "/errorCorrectionLevel:" + u;
    const f = m.length / 3, p = [];
    for (let v = 0; v < f; v += 1) {
      const w = m[v * 3 + 0], y = m[v * 3 + 1], b = m[v * 3 + 2];
      for (let S = 0; S < w; S += 1)
        p.push(a(y, b));
    }
    return p;
  }, i;
})(), Wf = function() {
  const n = [];
  let a = 0;
  const i = {};
  return i.getBuffer = function() {
    return n;
  }, i.getAt = function(s) {
    const o = Math.floor(s / 8);
    return (n[o] >>> 7 - s % 8 & 1) == 1;
  }, i.put = function(s, o) {
    for (let u = 0; u < o; u += 1)
      i.putBit((s >>> o - u - 1 & 1) == 1);
  }, i.getLengthInBits = function() {
    return a;
  }, i.putBit = function(s) {
    const o = Math.floor(a / 8);
    n.length <= o && n.push(0), s && (n[o] |= 128 >>> a % 8), a += 1;
  }, i;
}, U1 = function(n) {
  const a = de.MODE_NUMBER, i = n, s = {};
  s.getMode = function() {
    return a;
  }, s.getLength = function(m) {
    return i.length;
  }, s.write = function(m) {
    const f = i;
    let p = 0;
    for (; p + 2 < f.length; )
      m.put(o(f.substring(p, p + 3)), 10), p += 3;
    p < f.length && (f.length - p == 1 ? m.put(o(f.substring(p, p + 1)), 4) : f.length - p == 2 && m.put(o(f.substring(p, p + 2)), 7));
  };
  const o = function(m) {
    let f = 0;
    for (let p = 0; p < m.length; p += 1)
      f = f * 10 + u(m.charAt(p));
    return f;
  }, u = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return s;
}, G1 = function(n) {
  const a = de.MODE_ALPHA_NUM, i = n, s = {};
  s.getMode = function() {
    return a;
  }, s.getLength = function(u) {
    return i.length;
  }, s.write = function(u) {
    const m = i;
    let f = 0;
    for (; f + 1 < m.length; )
      u.put(
        o(m.charAt(f)) * 45 + o(m.charAt(f + 1)),
        11
      ), f += 2;
    f < m.length && u.put(o(m.charAt(f)), 6);
  };
  const o = function(u) {
    if ("0" <= u && u <= "9")
      return u.charCodeAt(0) - 48;
    if ("A" <= u && u <= "Z")
      return u.charCodeAt(0) - 65 + 10;
    switch (u) {
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
        throw "illegal char :" + u;
    }
  };
  return s;
}, q1 = function(n) {
  const a = de.MODE_8BIT_BYTE, i = Va.stringToBytes(n), s = {};
  return s.getMode = function() {
    return a;
  }, s.getLength = function(o) {
    return i.length;
  }, s.write = function(o) {
    for (let u = 0; u < i.length; u += 1)
      o.put(i[u], 8);
  }, s;
}, Y1 = function(n) {
  const a = de.MODE_KANJI, i = Va.stringToBytes;
  (function(u, m) {
    const f = i(u);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const s = i(n), o = {};
  return o.getMode = function() {
    return a;
  }, o.getLength = function(u) {
    return ~~(s.length / 2);
  }, o.write = function(u) {
    const m = s;
    let f = 0;
    for (; f + 1 < m.length; ) {
      let p = (255 & m[f]) << 8 | 255 & m[f + 1];
      if (33088 <= p && p <= 40956)
        p -= 33088;
      else if (57408 <= p && p <= 60351)
        p -= 49472;
      else
        throw "illegal char at " + (f + 1) + "/" + p;
      p = (p >>> 8 & 255) * 192 + (p & 255), u.put(p, 13), f += 2;
    }
    if (f < m.length)
      throw "illegal char at " + (f + 1);
  }, o;
}, Pm = function() {
  const n = [], a = {};
  return a.writeByte = function(i) {
    n.push(i & 255);
  }, a.writeShort = function(i) {
    a.writeByte(i), a.writeByte(i >>> 8);
  }, a.writeBytes = function(i, s, o) {
    s = s || 0, o = o || i.length;
    for (let u = 0; u < o; u += 1)
      a.writeByte(i[u + s]);
  }, a.writeString = function(i) {
    for (let s = 0; s < i.length; s += 1)
      a.writeByte(i.charCodeAt(s));
  }, a.toByteArray = function() {
    return n;
  }, a.toString = function() {
    let i = "";
    i += "[";
    for (let s = 0; s < n.length; s += 1)
      s > 0 && (i += ","), i += n[s];
    return i += "]", i;
  }, a;
}, L1 = function() {
  let n = 0, a = 0, i = 0, s = "";
  const o = {}, u = function(f) {
    s += String.fromCharCode(m(f & 63));
  }, m = function(f) {
    if (f < 0)
      throw "n:" + f;
    if (f < 26)
      return 65 + f;
    if (f < 52)
      return 97 + (f - 26);
    if (f < 62)
      return 48 + (f - 52);
    if (f == 62)
      return 43;
    if (f == 63)
      return 47;
    throw "n:" + f;
  };
  return o.writeByte = function(f) {
    for (n = n << 8 | f & 255, a += 8, i += 1; a >= 6; )
      u(n >>> a - 6), a -= 6;
  }, o.flush = function() {
    if (a > 0 && (u(n << 6 - a), n = 0, a = 0), i % 3 != 0) {
      const f = 3 - i % 3;
      for (let p = 0; p < f; p += 1)
        s += "=";
    }
  }, o.toString = function() {
    return s;
  }, o;
}, Q1 = function(n) {
  const a = n;
  let i = 0, s = 0, o = 0;
  const u = {};
  u.read = function() {
    for (; o < 8; ) {
      if (i >= a.length) {
        if (o == 0)
          return -1;
        throw "unexpected end of file./" + o;
      }
      const p = a.charAt(i);
      if (i += 1, p == "=")
        return o = 0, -1;
      if (p.match(/^\s$/))
        continue;
      s = s << 6 | m(p.charCodeAt(0)), o += 6;
    }
    const f = s >>> o - 8 & 255;
    return o -= 8, f;
  };
  const m = function(f) {
    if (65 <= f && f <= 90)
      return f - 65;
    if (97 <= f && f <= 122)
      return f - 97 + 26;
    if (48 <= f && f <= 57)
      return f - 48 + 52;
    if (f == 43)
      return 62;
    if (f == 47)
      return 63;
    throw "c:" + f;
  };
  return u;
}, V1 = function(n, a) {
  const i = n, s = a, o = new Array(n * a), u = {};
  u.setPixel = function(v, w, y) {
    o[w * i + v] = y;
  }, u.write = function(v) {
    v.writeString("GIF87a"), v.writeShort(i), v.writeShort(s), v.writeByte(128), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(255), v.writeByte(255), v.writeByte(255), v.writeString(","), v.writeShort(0), v.writeShort(0), v.writeShort(i), v.writeShort(s), v.writeByte(0);
    const w = 2, y = f(w);
    v.writeByte(w);
    let b = 0;
    for (; y.length - b > 255; )
      v.writeByte(255), v.writeBytes(y, b, 255), b += 255;
    v.writeByte(y.length - b), v.writeBytes(y, b, y.length - b), v.writeByte(0), v.writeString(";");
  };
  const m = function(v) {
    const w = v;
    let y = 0, b = 0;
    const S = {};
    return S.write = function(T, z) {
      if (T >>> z)
        throw "length over";
      for (; y + z >= 8; )
        w.writeByte(255 & (T << y | b)), z -= 8 - y, T >>>= 8 - y, b = 0, y = 0;
      b = T << y | b, y = y + z;
    }, S.flush = function() {
      y > 0 && w.writeByte(b);
    }, S;
  }, f = function(v) {
    const w = 1 << v, y = (1 << v) + 1;
    let b = v + 1;
    const S = p();
    for (let O = 0; O < w; O += 1)
      S.add(String.fromCharCode(O));
    S.add(String.fromCharCode(w)), S.add(String.fromCharCode(y));
    const T = Pm(), z = m(T);
    z.write(w, b);
    let M = 0, j = String.fromCharCode(o[M]);
    for (M += 1; M < o.length; ) {
      const O = String.fromCharCode(o[M]);
      M += 1, S.contains(j + O) ? j = j + O : (z.write(S.indexOf(j), b), S.size() < 4095 && (S.size() == 1 << b && (b += 1), S.add(j + O)), j = O);
    }
    return z.write(S.indexOf(j), b), z.write(y, b), z.flush(), T.toByteArray();
  }, p = function() {
    const v = {};
    let w = 0;
    const y = {};
    return y.add = function(b) {
      if (y.contains(b))
        throw "dup key:" + b;
      v[b] = w, w += 1;
    }, y.size = function() {
      return w;
    }, y.indexOf = function(b) {
      return v[b];
    }, y.contains = function(b) {
      return typeof v[b] < "u";
    }, y;
  };
  return u;
}, K1 = function(n, a, i) {
  const s = V1(n, a);
  for (let f = 0; f < a; f += 1)
    for (let p = 0; p < n; p += 1)
      s.setPixel(p, f, i(p, f));
  const o = Pm();
  s.write(o);
  const u = L1(), m = o.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    u.writeByte(m[f]);
  return u.flush(), "data:image/gif;base64," + u;
};
Va.stringToBytes;
function X1({ text: n }) {
  const { size: a, path: i } = X.useMemo(() => {
    const s = Va(0, "M");
    s.addData(n), s.make();
    const o = s.getModuleCount();
    let u = "";
    for (let m = 0; m < o; m++)
      for (let f = 0; f < o; f++) s.isDark(m, f) && (u += `M${f} ${m}h1v1h-1z`);
    return { size: o, path: u };
  }, [n]);
  return /* @__PURE__ */ et.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${a + 8} ${a + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ et.jsx("rect", { x: -4, y: -4, width: a + 8, height: a + 8, fill: "#fff" }),
        /* @__PURE__ */ et.jsx("path", { d: i, fill: "#000" })
      ]
    }
  );
}
const Rl = X.createContext(""), Oo = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function Z1({ title: n, children: a, testId: i, ariaLabel: s }) {
  const o = X.useContext(Rl), u = o !== "" && Oo(n, o);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ et.jsxs("section", { className: o && !u ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": i, "aria-label": s, children: [
      n && /* @__PURE__ */ et.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ et.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ et.jsx(Rl.Provider, { value: u ? "" : o, children: a }) })
    ] })
  );
}
function J1({ title: n, description: a, children: i, testId: s }) {
  const o = X.useContext(Rl);
  return o && !Oo(n, o) && !Oo(a, o) ? null : /* @__PURE__ */ et.jsxs("div", { "data-setting-row": !0, "data-testid": s, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ et.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ et.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ et.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    i && /* @__PURE__ */ et.jsx("div", { className: "flex shrink-0 items-center gap-2", children: i })
  ] });
}
function W1({ checked: n, onChange: a, testId: i, label: s }) {
  return /* @__PURE__ */ et.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": s,
      "data-testid": i,
      checked: n,
      onChange: (o) => a(o.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const F1 = () => X.useContext(Rl), $1 = {
  select: Jo,
  selectHost: $v,
  input: Iv,
  inputPort: Pv,
  inputWide: t1,
  addRow: e1,
  list: n1,
  hostRow: l1,
  name: r1,
  addr: i1,
  muted: Wv,
  empty: Fv,
  primary: s1,
  danger: o1,
  catalogToggle: Jv
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const I1 = 512, Ie = globalThis.__perchResources ??= /* @__PURE__ */ new Map(), Cl = /* @__PURE__ */ new Map();
function tp(n, a) {
  Ie.delete(n), Ie.set(n, a);
  for (const i of Ie.keys()) {
    if (Ie.size <= I1) break;
    Cl.get(i)?.size || Ie.delete(i);
  }
}
function P1(n, a) {
  return Ie.has(n) ? Ie.get(n) : a;
}
function ty(n, a, i) {
  const s = P1(n, i), o = typeof a == "function" ? a(s) : a;
  if (!(Ie.has(n) && Object.is(o, s))) {
    tp(n, o);
    for (const u of [...Cl.get(n) ?? []]) u();
  }
}
function ey(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Ie.has(n) || tp(n, a);
  const i = X.useCallback((u) => {
    const m = Cl.get(n) ?? /* @__PURE__ */ new Set();
    return Cl.set(n, m), m.add(u), () => {
      m.delete(u), m.size || Cl.delete(n);
    };
  }, [n]), s = X.useSyncExternalStore(i, () => Ie.get(n)), o = X.useCallback((u) => ty(n, u, a), [n]);
  return [s, o];
}
const ny = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", ay = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const ly = "1.3.0";
let Ir = null;
const ry = (n) => {
  Ir = n;
};
function bt() {
  const n = (typeof Ir == "function" ? Ir() : Ir) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const ep = (n) => bt().subscribe?.(n) ?? (() => {
}), iy = f1;
function sy() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const np = globalThis.perch?.isMac !== !1, Ro = (n) => Cv(n, bt().isMac !== !1), oy = (n) => jv(n), cy = ({ className: n, ...a } = {}) => jt(Rv(a), n), uy = Hv, ap = (n) => Co(n), Pr = Bv, dy = Bl, fy = Xm, my = (n) => Ao[n].color, py = (n, a) => bt().shortcutFor?.(n, a) ?? null, hy = (n) => bt().shortcutLabel?.(n) ?? null, yi = (n, a) => bt().command(n, a ?? {}) !== !1, gy = (n, a, i) => bt().startSession?.(n, a, i), by = globalThis.perch?.pickFolder ? (n) => bt().pickFolder(n) : null;
function Bt(n) {
  const a = X.useRef(n);
  return a.current = n, X.useSyncExternalStore(ep, () => a.current(bt()));
}
const lp = (n = {}) => Bt((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), vy = () => Bt((n) => n.hosts()), yy = () => Bt((n) => n.sessionFolders());
function xy() {
  const n = Bt((a) => a.addProject?.() ?? wy);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (a, i, s) => {
      a.trim() && n.status !== "pending" && bt().addProjectFolder?.(a, i, s);
    },
    clear: () => bt().clearAddProject?.()
  };
}
const wy = Object.freeze({ status: "idle" }), rp = "perch.lastAgentChoice", _y = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), ky = () => {
  const n = bt().storage?.getItem(rp);
  return n === "claude" || n === "codex" ? n : "claude";
}, Sy = Object.freeze({ items: [] });
function Ey() {
  const n = Bt((a) => a.notifications?.() ?? Sy);
  return X.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => bt().command("notification.open", { id: a }),
    dismiss: (a) => bt().command("notification.dismiss", { id: a })
  }), [n]);
}
function zy(n) {
  const a = Bt((o) => o.agentChoices?.(n) ?? _y), [i, s] = X.useState(ky);
  return X.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: i,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (o) => {
      o !== "claude" && o !== "codex" || (bt().storage?.setItem(rp, o), s(o));
    },
    manage: () => bt().command("agents.manage", {})
  }), [a, i]);
}
function Ny(n) {
  Lt(() => bt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Ty(n) {
  const a = n.map((i) => ({ id: i.id, parentSessionId: i.parentId, session: i }));
  return d1(a).map((i) => ({ session: i.session, nested: jo(i, a) }));
}
function My({ id: n, plain: a, className: i }) {
  const s = Bt((v) => v.session(n));
  if (!s) return null;
  const o = s.state ?? u1(s), u = Ao[o]?.color ?? Ao.unknown.color, m = s.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = a ? jt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", i) : jt("agent-status-dot", `agent-status-dot--${o}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", i);
  return X.createElement(
    "span",
    { className: p, style: a ? void 0 : { borderColor: u }, "data-provider": m ?? "unknown", title: a ? m ?? "Agent" : `${m ?? "Agent"} · ${o}`, "aria-hidden": "true" },
    X.createElement("span", { className: jt("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, X.createElement(ip, { provider: m, size: 14 }))
  );
}
function ip({ provider: n, size: a = 14 }) {
  const i = bt().agentIcon?.(n, a) ?? null, s = i?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return X.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": s, ...i && i.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Cy = ({ children: n }) => X.createElement(X.Fragment, null, n);
function Ay(n, a) {
  const i = X.useRef(a);
  return i.current = a, Lt(() => {
    const s = bt();
    if (!s.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const o = {};
    for (const [m, f] of Object.entries(i.current))
      o[m] = typeof f == "function" ? (...p) => i.current[m]?.(...p) : f;
    const u = s.openOverlay(n, o);
    return () => s.closeOverlay?.(u);
  }, [n]), null;
}
const Qn = (n) => function(i) {
  return Ay(n, i);
}, jy = Qn("session-menu"), Oy = Qn("new-session-menu"), Ry = Qn("confirm");
let sp = null;
const Dy = (n) => {
  sp = n;
};
function Hy(n) {
  return X.createElement(sp ?? Ry, n);
}
function By({ className: n = Jo, ...a }) {
  return X.createElement(Kv, { ...a, className: n });
}
let Do = null;
const Uy = (n) => {
  Do = n;
}, Gy = Qn("folder-browser");
function qy(n) {
  return Do ? X.createElement(Do, { ...n, browse: (a) => bt().browse(n.hostId, a) }) : X.createElement(Gy, n);
}
const Yy = Qn("instructions"), Ly = Qn("memory"), Qy = Lv;
let $o = null;
const Vy = (n) => {
  $o = n;
};
function Ky(n) {
  if ($o) return X.createElement(Zy, n);
  const { hostId: a, path: i, className: s } = n, o = X.useRef(null);
  return X.createElement(
    "button",
    {
      type: "button",
      ref: o,
      className: jt("worktree-menu__btn", Xm, s),
      "data-testid": `worktree-menu-${a}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => bt().openOverlay?.("worktree", { hostId: a, cwd: i, anchor: o.current?.getBoundingClientRect() })
    },
    X.createElement(Zm, null)
  );
}
const op = "Perch did not answer.";
function Zr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: op };
}
function Xy(n, a, i = bt()) {
  const s = (o) => {
    for (const u of o ?? []) {
      if (u.path === a) return u;
      const m = s(u.children);
      if (m) return m;
    }
    return null;
  };
  for (const o of i.navigation({})?.projects ?? []) {
    if (o.hostId !== n) continue;
    const u = s(o.workspaces) ?? s(o.hidden);
    if (u) return u;
  }
  return null;
}
const Ff = 5 * 6e4;
function cp(n, a, i, s = bt()) {
  const o = Date.now() + Ff;
  let u = !1, m = () => {
  };
  const f = () => {
    u = !0, m(), clearTimeout(v);
  }, p = () => {
    if (!u) {
      if (Date.now() >= o) return f();
      Xy(n, a, s) && (f(), s.startSession?.(n, a, i));
    }
  }, v = setTimeout(f, Ff);
  m = s.subscribe?.(p) ?? (() => {
  }), p();
}
function Zy({ hostId: n, path: a, className: i, worktrees: s, request: o, parentChoices: u, emptyAgent: m, ...f }) {
  const [p, v] = X.useState(s), w = (k) => !!bt().coreCan?.(k, n), y = lp(), b = `${n}:${a}`, S = X.useMemo(() => {
    if (Array.isArray(u)) return u;
    if (!w("workspace.nest")) return [];
    const k = y?.projects?.find((R) => R.hostId === n && R.repoPath === a), N = [], E = (R, Q) => {
      for (const $ of R ?? [])
        Q && N.push({ id: $.id, name: $.name, path: $.path }), E($.children, !0);
    };
    return E(k?.workspaces, !1), N;
  }, [u, y, n, a]), T = n === "local" && w("worktree.job"), z = f.deleteSupported ?? w("worktree.delete"), M = f.startFromSupported ?? w("worktree.startFrom"), j = Bt((k) => k.emptyWorkspaceAgent?.() ?? void 0), O = m ?? j ?? void 0, B = Bt((k) => k.worktreeMenuRequest?.() ?? null), W = B?.projectKey === b ? B.nonce : null, J = X.useMemo(() => o ?? (W == null ? null : B), [o, W]), [D, g] = X.useState(J);
  Lt(() => {
    J && g(J);
  }, [J]);
  const h = X.useRef({});
  h.current = { background: T, deleteSupported: z };
  const _ = X.useMemo(() => {
    const k = (N, E) => bt().ask(N, { hostId: n, repoPath: a, ...E });
    return {
      list: async () => {
        const N = await k("worktree.list", {});
        return N?.type === "worktree.list.result" && v({ worktrees: N.worktrees ?? [], defaultRoot: N.defaultRoot ?? "", baseRef: N.baseRef, refs: N.refs ?? [] }), Zr(N);
      },
      create: async ({ branch: N, newBranch: E, path: R, extra: Q, agent: $ }) => {
        const U = { branch: N, newBranch: !!E, path: R ?? null, name: Q?.name ?? null, startFrom: Q?.startFrom ?? null, parentWorkspaceId: Q?.parentWorkspaceId ?? null }, { background: V } = h.current, I = await k(V ? "worktree.job.start" : "worktree.create", U), L = V ? "worktree.job.started" : "worktree.done";
        if (I?.type !== L) return { error: Zr(I).error ?? op };
        const K = V ? I.job?.path : I.path;
        return $ && K && cp(n, K, $), { background: V };
      },
      remove: async (N, E) => {
        const R = await k("worktree.remove", { path: N, force: !!E, deleteBranch: h.current.deleteSupported });
        return { ...Zr(R), preservedBranch: R?.type === "worktree.done" ? R.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (N, E) => Zr(await k("worktree.branch.delete", { branch: N, expectedHead: E })),
      open: (N) => bt().startSession?.(n, N, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => bt().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return X.createElement($o, {
    hostId: n,
    cwd: a,
    projectKey: b,
    className: i,
    worktrees: p,
    background: T,
    startFromSupported: M,
    deleteSupported: z,
    parentChoices: S,
    emptyAgent: O,
    request: D,
    actions: _
  });
}
const Jy = (n, a) => {
  if (!bt().followPointer?.(n)) return;
  const i = a.items();
  for (const s of i) s.getBoundingClientRect();
  i[0]?.parentElement?.getBoundingClientRect(), zv(n, a);
}, Wy = () => Bt((n) => n.workspaceTabs());
let Fy = 0;
function $y({ path: n, content: a }) {
  const { source: i, truncated: s } = Qv(a ?? ""), o = bt().markdown, u = X.useMemo(() => `markdown-${++Fy}`, []);
  return jl(() => {
    o?.show(u, i);
  }, [u, i]), Lt(() => () => o?.release(u), [u]), X.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", style: { display: "flex", flexDirection: "column" }, tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    s && X.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${$r.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    X.createElement(
      "div",
      { className: "message__markdown file-markdown", style: { display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 } },
      X.createElement("div", { "data-perch-engine": "markdown", "data-perch-key": u, className: "min-h-0 min-w-0 flex-1" })
    )
  );
}
const Iy = Qn("file-menu"), Py = /* @__PURE__ */ new Map(), tx = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function ex(n, a = {}) {
  const i = Bt((v) => v.workspaceFiles(n)), s = !!a.git, o = i.git?.decorations, u = X.useMemo(() => s && o?.length ? new Map(o) : Py, [o, s]), m = X.useMemo(() => Object.fromEntries(tx.map((v) => [v, (...w) => (bt().filesDo(v, n, ...w), null)])), [n]), f = Bt((v) => !!v.contextBridgeAvailable?.(n)), p = X.useMemo(() => f ? (v) => {
    if (v.kind !== "editor") return bt().askAgent(n, v);
    const w = bt().workspaceFiles(n)?.documents?.[v.path];
    return bt().askAgent(n, { ...v, dirty: w?.content !== w?.savedContent });
  } : void 0, [f, n]);
  return X.useMemo(() => ({
    workspace: i.workspace,
    connected: i.connected,
    trees: i.trees,
    documents: i.documents,
    previews: i.previews,
    search: i.search ?? void 0,
    wrap: i.wrap,
    git: { ...i.git, decorations: u },
    actions: m,
    askAgent: p
  }), [i, u, m, p]);
}
const nx = () => Bt((n) => n.statusLine()), ax = () => Bt((n) => n.zoom()), lx = () => Bt((n) => n.paneLook()), rx = () => Bt((n) => n.keybindings?.() ?? []), ix = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function sx(n) {
  const a = !!n?.keepFresh, i = Bt((o) => o.statusLine?.().connected ?? !1), s = Bt((o) => o.planUsage?.() ?? ix);
  return Lt(() => {
    if (!a || !i) return;
    let o;
    const u = () => {
      bt().command("usage.get"), o = setTimeout(u, 18e4);
    };
    return u(), () => clearTimeout(o);
  }, [a, i]), s;
}
const ox = () => bt().command("usage.get", { force: !0 }), cx = (n) => bt().command("usage.redeemReset", { accountId: n }), ux = () => yi("app.zoom_reset"), dx = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, fx = (n, a, i) => bt().beginTabDrag?.(n, a, i);
function mx(n) {
  Lt(() => bt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const px = (n) => yi("browser.open", { workspaceId: n }), hx = (n, a) => yi("file.open", { workspaceId: n, path: a }), gx = () => null, bx = () => null, vx = Qn("new-file"), yx = [
  "refreshStatus",
  "selectAgentSession",
  "loadDiff",
  "stage",
  "unstage",
  "discardPreview",
  "discard",
  "commitPreview",
  "commit",
  "listComments",
  "listRefs",
  "createComment",
  "updateComment",
  "resolveComment",
  "deleteComment",
  "previewBatch",
  "sendBatch"
], xx = /* @__PURE__ */ new Set(["discardPreview", "commitPreview", "previewBatch", "sendBatch"]);
function wx(n) {
  const a = {};
  for (const i of yx)
    a[i] = (...s) => {
      const o = bt().gitDo(i, n, ...s);
      return xx.has(i) ? o.then((u) => u ?? null, () => null) : (o.catch?.((u) => console.error(`perch: ${i}: ${u?.message ?? u}`)), null);
    };
  return a;
}
function _x(n) {
  const a = Bt((s) => s.gitReview(n)), i = X.useMemo(() => wx(n), [n]);
  return X.useMemo(() => ({
    ready: a.ready,
    workspaceName: a.workspaceName ?? void 0,
    startSnapshot: a.startSnapshot ?? void 0,
    lastAgentTurn: a.lastAgentTurn ?? void 0,
    agentSessionId: a.agentSessionId,
    status: a.status ?? void 0,
    statusState: a.statusState,
    statusError: a.statusError,
    actionError: a.actionError,
    diff: a.diff ?? void 0,
    diffState: a.diffState,
    diffError: a.diffError,
    comments: a.comments ?? [],
    refs: a.refs ?? [],
    batchDelivery: a.batchDelivery ?? void 0,
    sessions: a.sessions ?? [],
    currentRevision: a.currentRevision ?? void 0,
    actions: i,
    askAgent: void 0
  }), [a, i]);
}
function kx(n) {
  const { workspaceId: a } = n, i = `diff:${a}`, s = bt(), o = X.useRef(null);
  o.current !== i && (s.diff.open(i, { workspaceId: a }), o.current = i), s.diff.setProps(i, {
    path: n.path ?? null,
    wrap: !!n.wrap,
    canAsk: !!n.onAskAgent,
    selection: n.selection ?? null,
    editingCommentId: n.editingCommentId ?? null,
    editingBody: n.editingBody ?? ""
  });
  const u = Bt((p) => p.gitReview(a)).comments ?? [], m = X.useSyncExternalStore(ep, () => s.diff.seq(i)), f = X.useRef(n);
  return f.current = n, Lt(() => {
    const p = f.current, v = (w) => u.find((y) => y.id === w);
    for (const w of s.diff.events(i))
      switch (w.type) {
        case "selectLine":
          p.onSelectLine?.(w.path, w.side, w.line, w.extend);
          break;
        case "addComment":
          p.onAddComment?.(w.path, w.side, w.line);
          break;
        case "askAgent":
          p.onAskAgent?.(w.path);
          break;
        case "editComment": {
          const y = v(w.commentId);
          y && p.onEditComment?.(y);
          break;
        }
        case "editBody":
          p.onEditBody?.(w.text);
          break;
        case "saveEdit": {
          const y = v(w.commentId);
          y && p.onSaveEdit?.(y);
          break;
        }
        case "cancelEdit":
          p.onCancelEdit?.();
          break;
        case "resolve": {
          const y = v(w.commentId);
          y && p.onResolve?.(y);
          break;
        }
        case "delete": {
          const y = v(w.commentId);
          y && p.onDelete?.(y);
          break;
        }
      }
  }, [m, i]), X.createElement("div", { "data-perch-engine": "diff", "data-perch-key": i, "data-testid": "git-diff", className: n.className ?? "min-h-0 flex-1" });
}
function Sx(n) {
  return X.createElement(E1, { ...n, perch: bt() });
}
function Ex(n, a) {
  const i = n.selection(a);
  if (i) return i;
  const s = n.value(a), o = s.split(`
`).length - (s.endsWith(`
`) && s.length ? 1 : 0);
  return { text: s, startLine: 1, endLine: Math.max(1, o) };
}
function zx({ onGo: n, onClose: a }) {
  const [i, s] = X.useState(""), o = (u) => {
    u?.preventDefault?.();
    const [m, f] = i.split(":").map((p) => Number.parseInt(p, 10));
    Number.isFinite(m) ? n(m, Number.isFinite(f) ? f : 1) : a();
  };
  return X.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    X.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    X.createElement("input", {
      id: "perch-editor-goto",
      "data-testid": "editor-goto-line",
      autoFocus: !0,
      value: i,
      className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (u) => s(u.target.value),
      onKeyDown: (u) => {
        u.key === "Escape" ? (u.preventDefault(), a()) : u.key === "Enter" && o(u);
      }
    }),
    X.createElement("button", { type: "button", className: Bl, onClick: o }, "OK")
  );
}
function Nx({ value: n, onChange: a, onSave: i, onCaret: s, readOnly: o, wrap: u, label: m, path: f, docKey: p, onAskAgent: v, ref: w }) {
  const y = bt().editor, b = X.useRef(null);
  b.current = { onChange: a, onSave: i, onCaret: s, onAskAgent: v };
  const [S, , T] = String(p).split("\0"), z = !!y && T !== void 0 && /^\d+$/.test(T), M = Bt((_) => z ? _.workspaceFiles(S)?.carets?.[p] ?? null : null);
  Lt(() => {
    M && b.current.onCaret?.({ line: M.line, col: M.col });
  }, [M?.line, M?.col]);
  const j = X.useRef(n), [O, B] = X.useState(null), [W, J] = X.useState(!1), D = () => {
    if (!y || !b.current.onAskAgent) return;
    const { text: _, startLine: k, endLine: N } = Ex(y, p);
    b.current.onAskAgent(_, k, N);
  };
  if (X.useImperativeHandle(w, () => ({
    openGoto: () => J(!0),
    focus: () => y?.focus(p),
    askAgent: D
  }), [p]), jl(() => {
    if (!y) return;
    y.open(p, { path: f, value: n, readonly: !!o, wrap: !!u, label: m }), j.current = n;
    const _ = y.watch(p, (k) => {
      for (const N of k)
        if (N.type === "change") {
          const E = y.value(p);
          j.current = E, b.current.onChange?.(E);
        } else N.type === "caret" ? b.current.onCaret?.({ line: N.line, col: N.col }) : N.type === "save" ? b.current.onSave?.() : N.type === "goto" ? J(!0) : N.type === "contextmenu" && B({ x: N.x, y: N.y });
    });
    return () => {
      _(), y.park(p);
    };
  }, [p]), Lt(() => {
    !y || z || n === j.current || (j.current = n, y.setValue(p, n, { external: !0 }));
  }, [p, n]), Lt(() => {
    y?.setReadonly(p, !!o);
  }, [p, o]), Lt(() => {
    y?.setWrap(p, !!u);
  }, [p, u]), !y)
    return X.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: o, onChange: (_) => a?.(_.target.value) });
  const g = (_) => () => {
    B(null), _(), y.focus(p);
  }, h = O ? !!y.selection(p) : !1;
  return X.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    W && X.createElement(zx, {
      onGo: (_, k) => {
        J(!1), y.goTo(p, _, k), y.focus(p);
      },
      onClose: () => {
        J(!1), y.focus(p);
      }
    }),
    X.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    O && X.createElement(Zv, {
      x: O.x,
      y: O.y,
      readOnly: !!o,
      canUndo: y.canUndo(p),
      canRedo: y.canRedo(p),
      hasSelection: h,
      onClose: () => B(null),
      actions: {
        undo: g(() => y.undo(p)),
        redo: g(() => y.redo(p)),
        cut: g(() => y.cut(p)),
        copy: g(() => y.copy(p)),
        paste: g(() => y.paste(p)),
        selectAll: g(() => y.selectAll(p)),
        find: g(() => y.openSearch(p, !1)),
        replace: g(() => y.openSearch(p, !0)),
        gotoLine: () => {
          B(null), J(!0);
        },
        ...v ? { askAgent: () => {
          B(null), D();
        } } : {}
      }
    })
  );
}
const Tx = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Mx(n) {
  const a = Bt((i) => i.browserPages?.(n) ?? Tx);
  return X.useMemo(() => {
    const i = (s, o) => bt().command(s, { workspaceId: n, ...o });
    return {
      pages: a.pages ?? [],
      shownId: a.shownId ?? null,
      tabCount: a.tabCount ?? 0,
      open: () => {
        const s = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        return i("browser.drawer.open", { id: s }), s;
      },
      select: (s) => i("browser.drawer.select", { id: s }),
      close: (s) => i("browser.drawer.close", { id: s }),
      closeAll: () => i("browser.drawer.closeAll", {}),
      // The window follows the page itself; nothing to keep here.
      setUrl: () => {
      }
    };
  }, [a, n]);
}
function Cx({ pageId: n, active: a }) {
  const i = `drawer
${n}`;
  return Lt(() => {
    a && bt().command("browser.focus", { key: i });
  }, [a, i]), X.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": i,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const Zx = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: ip,
  BrowserPage: Cx,
  Chevron: Fo,
  CloseIcon: qv,
  CodeEditor: Nx,
  ConfirmDialog: Hy,
  Dialog: Qy,
  DiffView: kx,
  EllipsisIcon: Uv,
  FileAsset: Sx,
  FileEntryMenu: Iy,
  FileIcon: T1,
  FolderBrowser: qy,
  GearIcon: Gv,
  GitMarker: A1,
  HostStateDot: Yv,
  InstructionsDialog: Yy,
  MarkdownPreview: $y,
  MemoryDialog: Ly,
  ModeSwitch: B1,
  NewFilePrompt: vx,
  NewSessionMenu: Oy,
  PageIcon: m1,
  PlusIcon: Zm,
  QrCode: X1,
  Select: By,
  SessionDot: My,
  SessionMenu: jy,
  SettingRow: J1,
  SettingsGroup: Z1,
  SettingsQuery: Rl,
  Slot: Cy,
  Submenu: c1,
  Switch: W1,
  TabDragLayer: bx,
  TabMenu: gx,
  WorktreeMenu: Ky,
  agentStateColor: my,
  anchoredPopoverStyle: iy,
  assetKind: $m,
  beginReorderDrag: Jy,
  beginTabDrag: fx,
  bindHost: ry,
  buttonClass: uy,
  cn: jt,
  drawConfirmationsInPlace: Dy,
  drawFolderBrowserInPlace: Uy,
  drawWorktreeInPlace: Vy,
  ghostButton: dy,
  glassClass: ny,
  iconButton: fy,
  isMac: np,
  keyLabel: Ro,
  menuDividerClass: Pr,
  menuItemClass: ap,
  menuPanel: vi,
  nestSessions: Ty,
  newId: sy,
  openBrowserTab: px,
  openFileTab: hx,
  pickFolder: by,
  redeemUsageReset: cx,
  refreshUsage: ox,
  resetZoom: ux,
  rowActionClass: cy,
  runCommand: yi,
  segmentClass: oy,
  settingsClass: $1,
  shortcutFor: py,
  shortcutLabel: hy,
  startPaneWhenReady: cp,
  startSession: gy,
  tabStateClass: dx,
  tapButtonClass: ay,
  useAddProject: xy,
  useAddProjectRequest: Ny,
  useAgentChoices: zy,
  useBrowserPages: Mx,
  useDismissOnOutsideClick: Fm,
  useGitReview: _x,
  useHostSnapshot: Bt,
  useHosts: vy,
  useKeybindings: rx,
  useNavigation: lp,
  useNewTabRequest: mx,
  useNotifications: Ey,
  usePaneLook: lx,
  usePlanUsage: sx,
  useResourceState: ey,
  useSessionFolders: yy,
  useSettingsQuery: F1,
  useStatusLine: nx,
  useWorkspaceFiles: ex,
  useWorkspaceTabs: Wy,
  useZoom: ax,
  version: ly
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
const Io = {
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
  Io[n] = (a, i) => a[n](i);
const Jx = Object.keys(Io);
function po(n, a) {
  for (const [i, s] of Object.entries(a)) {
    const o = Io[i];
    if (!o) throw new Error(`the description key ${i} has no GPUI builder`);
    s != null && (n = o(n, s));
  }
  return n;
}
const ua = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Ho = /* @__PURE__ */ new WeakSet(), ti = /* @__PURE__ */ new WeakSet();
function $f(n, a, i) {
  const s = n.pressed, o = ua(i);
  return s && s.x === o.clientX && s.y === o.clientY ? s.id : a;
}
function Ax(n, a, i) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && fi.has(n.group) || i)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const up = (n, a = !1) => (n.children ?? []).some((i) => i.kind === "text" ? !a || /\s/.test(String(i.text ?? "").trim()) : i.kind === "div" && i.style?.flex_direction !== "row" && i.style?.whitespace !== "nowrap" && up(i, !0)), Te = (n) => n.style?.display !== "hidden";
let fi = /* @__PURE__ */ new Set(), Bo = null;
const If = /* @__PURE__ */ new WeakMap();
function dp(n, a = /* @__PURE__ */ new Set()) {
  let i = If.get(n);
  if (!i) {
    i = /* @__PURE__ */ new Set();
    for (const { group: s, style: o } of n.group_hover ?? []) "display" in o && i.add(s);
    for (const s of n.children ?? []) if (s.kind !== "text") for (const o of dp(s)) i.add(o);
    If.set(n, i);
  }
  for (const s of i) a.add(s);
  return a;
}
let $e = null;
const jx = (n, a, i, s, o, u, m) => `${+a}|${i}|${s.text_size}|${s.line_height}|${s.whitespace}|${s.text_ellipsis}|${+o}|${u ? `${u.group}|${u.color}` : ""}|${+Ho.has(n)}|${+ti.has(n)}|${m.get(n)?.flex_basis ?? ""}`, Pf = /* @__PURE__ */ new WeakMap();
function fp(n) {
  let a = Pf.get(n);
  return a === void 0 && (a = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((i) => i.kind !== "text" && fp(i)), Pf.set(n, a)), a;
}
function mp(n, a, i, s) {
  let o = Ox(a.get(n), i.get(n));
  if (n.kind === "text") return o;
  for (const u of n.children ?? []) mp(u, a, i, s) || (o = !1);
  return o && s.add(n), o;
}
function Ox(n, a) {
  if (n === a) return !0;
  if (!n || !a) return !1;
  const i = Object.keys(n);
  if (i.length !== Object.keys(a).length) return !1;
  for (const s of i) if (n[s] !== a[s]) return !1;
  return !0;
}
function Uo(n, a, i, s, o = !1, u = !1, m = null, f = {}, p = !1, v = /* @__PURE__ */ new Map(), w = null) {
  if (n.kind === "text") return v.get(n)?.text ?? n.text;
  const y = $e && !o && !fp(n) ? jx(n, u, m, f, p, w, v) : null;
  if (y !== null && $e.clean.has(n)) {
    const S = $e.from.get(n), T = S?.key === y ? a.reuse(S.id, $e.generation) : null;
    if (T)
      return $e.next.set(n, { id: T.__id, key: y }), T;
  }
  const b = Rx(n, a, i, s, o, u, m, f, p, v, w);
  return y !== null && $e.next.set(n, { id: b.__id, key: y }), b;
}
function Rx(n, a, i, s, o, u, m, f, p, v, w) {
  const y = Ho.has(n);
  u ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", u && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (w = null), m = n.style.text_color ?? m;
  const b = !!n.hover?.text_color && bp(n), S = n.group ?? (b ? `~g${n.id}` : null);
  b && (w = { group: S, color: n.hover.text_color }), f = { ...f };
  for (const E of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[E] !== void 0 && (f[E] = n.style[E]);
  const T = new Set(n.events ?? []), z = o ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !u && !n.pointer_none && n.style.position === "absolute" ? Bo : null, M = z ? z.count++ : -1;
  o && (Bo = z);
  let j;
  if (n.kind === "image" && !n.markup ? j = a.image(n.src) : j = a.div(), n.kind === "engine" && (j = j.child(s.engine ? s.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && w && w.color !== m) {
    const { group: E, color: R } = w, Q = () => a.div().absolute().top(0).left(0).size_full();
    j = j.child(Q().group_hover(E, ($) => $.invisible()).child(s.icon(`~icon-${n.id}`, n.markup, m))).child(Q().invisible().group_hover(E, ($) => $.visible()).child(s.icon(`~icon-${n.id}-hover`, n.markup, R)));
  } else n.markup && (j = j.child(s.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const O = Ax(n, T, !!z);
  if (O && (j = j.id(O)), n.measure && (j = j.measure(n.measure)), n.name && j.also_named) for (const E of n.also ?? []) j = j.also_named(E);
  j = po(j, { ...n.style, ...v.get(n) });
  const B = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && B && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && up(n) && (j = j.min_w(0));
  for (const E of ["hover", "focus", "active"]) n[E] && (j = j[E]((R) => po(R, n[E])));
  S && (j = j.group(S));
  for (const { group: E, style: R } of n.group_hover ?? []) {
    const { display: Q, ...$ } = R;
    Object.keys($).length && (j = j.group_hover(E, (U) => po(U, $)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const E = i.document?.scrollTarget, R = E ? (n.children ?? []).filter(Te).findIndex((Q) => gp(Q, E.id)) : -1;
    if (R >= 0 && (i.scroller ?? n.id) === n.id && (i.document.scrollTarget = null, i.scroller = n.id, a.scroll.scroll_to_item(R)), i.scroller ??= n.id, i.scroller === n.id && i.document) {
      j = j.track_scroll(a.scroll);
      const Q = (n.children ?? []).filter(Te).map(($) => $.id);
      i.document.itemBounds = ($) => Q.includes($) ? a.scroll.item_bounds?.(Q.indexOf($)) ?? null : null;
    }
  }
  const W = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", J = o && !n.pointer_none || n.blocks_pointer;
  if ((W && ti.has(n) || J) && (j = j.on_scroll_wheel((E, R) => R.stop_propagation?.())), W && T.has("scroll") && (j = j.on_scroll_wheel((E, R) => {
    i.dispatch(n.id, "scroll", {}), R.notify();
  })), W || ti.has(n)) for (const E of n.children ?? []) E.kind !== "text" && ti.add(E);
  n.kind === "input" && !n.disabled && (j = j.on_mouse_down("left", (E, R) => {
    E.bounds && i.setBounds(n.id, E.bounds), i.focus(n.id), R.notify();
  }));
  const D = n.kind === "input" ? n : n.meta?.tag === "label" ? hp(n) : null;
  D && !D.disabled && /^(checkbox|radio)$/.test(D.input_type) && (j = j.on_click((E, R) => {
    R.stop_propagation?.(), i.toggle(D.id), R.notify();
  }));
  const g = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((E) => T.has(E));
  if (g || y) for (const E of n.children ?? []) E.kind !== "text" && Ho.add(E);
  if (g && (j = j.on_mouse_down("left", (E, R) => {
    R.stop_propagation?.(), E.bounds && i.setBounds(n.id, E.bounds);
    const Q = { ...ua(E), button: 0, buttons: 1, detail: E.click_count }, $ = $f(i, n.id, E);
    i.pressed = null, i.dispatch($, "pointerdown", { ...Q, pointerType: "mouse" }), i.dispatch($, "mousedown", Q) && i.pressFocus?.($), R.notify();
  }), j = j.on_mouse_down("right", (E, R) => {
    R.stop_propagation?.(), E.bounds && i.setBounds(n.id, E.bounds);
    const Q = $f(i, n.id, E);
    i.pressed = null, i.dispatch(Q, "contextmenu", { ...ua(E), button: 2 }), R.notify();
  }), j = j.on_mouse_up("left", (E, R) => {
    R.stop_propagation?.();
    const Q = { ...ua(E), button: 0 };
    i.dispatch(n.id, "pointerup", { ...Q, pointerType: "mouse" }), i.dispatch(n.id, "mouseup", Q), R.notify();
  }), j = j.on_click((E, R) => {
    i.dispatch(n.id, E.click_count === 2 && T.has("double_click") ? "dblclick" : "click", { detail: E.click_count, button: 0 }), R.notify();
  })), n.blocks_pointer && !g)
    for (const E of ["left", "right"]) j = j.on_mouse_down(E, (R, Q) => Q.stop_propagation?.());
  else if (y && !g)
    for (const E of ["left", "right"])
      j = j.on_mouse_down(E, (R) => {
        const Q = ua(R);
        (i.pressed?.x !== Q.clientX || i.pressed?.y !== Q.clientY) && (i.pressed = { id: n.id, x: Q.clientX, y: Q.clientY });
      });
  if (T.has("mouse_move") && (j = j.on_mouse_move((E) => {
    i.dispatch(n.id, "pointermove", { ...ua(E), pointerType: "mouse" });
  })), n.track_hover && fi.has(n.group) && (j = j.on_hover((E, R) => {
    i.hover(n.id, E), R.notify();
  })), z && (j = j.on_mouse_down_out((E, R) => {
    const Q = ua(E), $ = `${Q.clientX},${Q.clientY}`;
    z.at !== $ && (z.at = $, z.hits = /* @__PURE__ */ new Set()), z.hits.add(M), !(z.hits.size < z.count) && (z.at = null, i.dispatch(i.document.body.id, "pointerdown", { ...Q, pointerType: "mouse" }), i.dispatch(i.document.body.id, "mousedown", Q), R.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const E = n.value ? String(n.value) : String(n.placeholder ?? "");
    let R = a.div().whitespace_nowrap().overflow_x_hidden();
    const Q = da(f);
    Q && (R = R.h(Q)), !n.value && m && (R = R.text_color(Hx(m))), E && (j = j.child(R.child(n.input_type === "password" && n.value ? "•".repeat([...E].length) : E))), n.field_w && (j = j.child(a.div().w(n.field_w).h(0)));
  }
  const h = f.whitespace === "nowrap" ? da(f) : null, _ = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let k = !n.range_name;
  const N = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const E of (n.children ?? []).filter(Te)) {
    const R = E.style?.flex_basis;
    N && E.style.flex_grow > 0 && (R === 0 || typeof R == "string" && R.endsWith("%")) && v.set(E, { ...v.get(E), flex_basis: "auto" });
    let Q = Uo(E, a, i, s, !1, u, m, f, _ && E.style?.position !== "absolute", v, w);
    const $ = !k && (E.kind === "text" || !E.meta), U = E.kind === "text" ? v.get(E)?.h ?? h : null, V = E.kind === "text" ? v.get(E)?.w : void 0;
    if ($ || U || V !== void 0) {
      let I = a.div();
      $ && (I = I.id(n.range_name)), $ && !_ && n.style.display === "flex" && (I = I[`self_${Dx[f.text_align] ?? "start"}`]().max_w("100%")), U && (I = I.h(U)), V !== void 0 && (I = I.w(V).flex_none().whitespace_nowrap()), Q = I.child(Q), k ||= $;
    }
    j = j.child(Q);
  }
  return j;
}
const Dx = { center: "center", right: "end", end: "end" };
function Hx(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const i = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(i / 2).toString(16).padStart(2, "0")}`;
}
const pp = /^(?:[!-,.-~]+|\S)$/u, hp = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const i = a.kind === "text" ? null : hp(a);
    if (i) return i;
  }
  return null;
}, gp = (n, a) => n.id === a || (n.children ?? []).some((i) => i.kind !== "text" && gp(i, a)), bp = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && bp(a));
function da(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function Wx(n, a, i, s, o = 0, u = !1) {
  const m = [n.root, ...n.overlays];
  fi = /* @__PURE__ */ new Set(), Bo = null;
  for (const b of m) dp(b, fi);
  const f = o > 0 ? Qx(m, o) : /* @__PURE__ */ new Map();
  o > 0 && s.measure && Bx(m, o, s.measure, f), Yx(m, f), qx(m, f), s.measure && Gx(m, s.measure, f);
  const p = a.reuse && a.renderGeneration ? i.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, v = new Map(f);
  p && n.root && ($e = { from: p.built, generation: p.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, mp(n.root, f, p.overrides, $e.clean));
  let w;
  try {
    w = a.div().relative().size_full().child(Uo(n.root, a, i, s, !1, !1, null, {}, !1, f)), p && Object.assign(p, { built: $e?.next ?? /* @__PURE__ */ new Map(), overrides: v, generation: a.renderGeneration() ?? -1 });
  } finally {
    $e = null;
  }
  let y = u && n.overlays.length ? a.div().relative().size_full().window_layer() : w;
  for (const b of n.overlays) y = y.child(Uo(b, a, i, s, !0, !1, null, {}, !1, f));
  return y === w ? w : w.child(y);
}
function Bx(n, a, i, s) {
  (Jr.scale !== a || Jr.measure !== i) && (Jr = { scale: a, measure: i, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: o, fonts: u, keys: m, visits: f } = Jr, p = [], v = (O, B) => s.set(O, { ...s.get(O), ...B }), w = (O, B) => {
    p.push(O, B), v(O, B);
  }, y = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(O, B, W) {
    if (O.kind === "text") {
      if (!(B.whitespace === "nowrap" || pp.test(O.text)) || B.text_ellipsis || W || typeof B.text_size != "number") return NaN;
      const E = i(O.text, { size: B.text_size, weight: B.font_weight ?? 400, family: B.font_family ?? ".SystemUIFont", italic: !!B.italic });
      return Number.isFinite(E) ? E : NaN;
    }
    if (!Te(O) || O.kind === "input" || O.kind === "engine" || O.markup) return S(O);
    const J = `${B.text_size}|${B.font_weight}|${B.font_family}|${B.italic}|${B.whitespace}|${B.text_ellipsis}|${+W}`;
    if (m.get(O) === J && o.has(O)) return o.get(O);
    m.set(O, J);
    const D = { ...B };
    for (const N of y) O.style[N] !== void 0 && (D[N] = O.style[N]);
    D.text_ellipsis = !!O.style.text_ellipsis, u.set(O, D);
    const g = O.style, h = (O.children ?? []).filter(Qe), _ = h.map((N) => b(N, D, W || !!O.tabular));
    let k = S(O);
    if (!Number.isFinite(k) && g.w === void 0) {
      const N = h.map((R, Q) => _[Q] + (R.kind === "text" ? 0 : st(R.style.ml) + st(R.style.mr)));
      let E;
      h.length ? Re(O) ? E = h.some((R) => R.kind !== "text" && R.style.flex_grow > 0) || g.flex_wrap === "wrap" ? NaN : N.reduce((R, Q) => R + Q, 0) + st(g.gap_x) * (h.length - 1) : E = Math.max(...N) : E = 0, k = E + st(g.pl) + st(g.pr) + st(g.border_l) + st(g.border_r), typeof g.min_w == "number" && (k = Math.max(k, g.min_w)), typeof g.max_w == "number" && (k = Math.min(k, g.max_w));
    }
    return o.set(O, k), k;
  }
  const S = (O) => typeof O.style?.w == "number" ? O.style.w : NaN, T = () => ({ exact: 0, laid: 0 }), z = (O, B) => {
    if (!Number.isFinite(B))
      return Object.assign(O, T()), NaN;
    O.exact += B;
    const W = Math.round(O.exact * a + 1e-9) / a, J = W - O.laid;
    return O.laid = W, J;
  }, M = (O) => Re(O) && O.style.flex_wrap !== "wrap" && (O.style.justify ?? "start") === "start";
  function j(O) {
    if (!O || O.kind === "text" || !Te(O)) return;
    const B = m.get(O), W = f.get(O);
    if (W && B !== void 0 && W.key === B) {
      for (let g = 0; g < W.log.length; g += 2)
        p.push(W.log[g], W.log[g + 1]), v(W.log[g], W.log[g + 1]);
      return;
    }
    const J = p.length, D = (O.children ?? []).filter(Qe);
    if (M(O) && D.length > 1) {
      const g = st(O.style.gap_x), h = T(), _ = !(g && D.some((k) => k.kind === "text" || !Number.isFinite(st(k.style.ml))));
      w(O, { border_l: z(h, st(O.style.border_l)), pl: z(h, st(O.style.pl)) }), _ && g && w(O, { gap_x: 0 }), D.forEach((k, N) => {
        const E = (N && _ ? g : 0) + (k.kind === "text" ? 0 : st(k.style.ml));
        if (k.kind === "text")
          E && Object.assign(h, T());
        else {
          const U = z(h, E);
          Number.isFinite(U) && w(k, { ml: U });
        }
        const R = k.kind === "text" ? u.get(O) ?? {} : null, Q = k.kind === "text" ? b(k, R, !!O.tabular) : o.get(k);
        if ((k.kind === "text" || !(k.style.flex_grow > 0)) && Number.isFinite(Q)) {
          const U = { w: z(h, Q) };
          k.kind !== "text" && typeof k.style.w != "number" && k.style.min_w === void 0 && (U.whitespace = "nowrap", U.flex_shrink = 0), w(k, U);
        } else Object.assign(h, T());
        if (k.kind !== "text") {
          const U = z(h, st(k.style.mr));
          Number.isFinite(U) && w(k, { mr: U });
        }
      });
    }
    for (const g of O.children ?? []) g.kind !== "text" && j(g);
    B !== void 0 && f.set(O, { key: B, log: p.slice(J) });
  }
  for (const O of n)
    O && (b(O, {}, !1), j(O));
}
let Jr = { scale: 0, measure: null };
const Ux = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Gx(n, a, i) {
  const s = ["text_size", "font_weight", "font_family", "italic", "line_height"], o = (w) => typeof w == "number" ? w : 0, u = (w, y) => y && mi(y) && !Re(y) && w.style.position !== "absolute" && !["start", "center", "end"].includes(w.style.self) && !["start", "center", "end"].includes(y.style.items);
  Wr.measure !== a && (Wr = { measure: a, walks: /* @__PURE__ */ new WeakMap() });
  const m = [], f = (w, y) => {
    m.push(w, y), i.set(w, { ...i.get(w), ...y });
  }, p = (w, y, b, S) => {
    if (!w || w.kind === "text" || !Te(w)) return;
    const T = `${b}|${+u(w, y)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, z = Wr.walks.get(w);
    if (z?.key === T) {
      for (let j = 0; j < z.log.length; j += 2) f(z.log[j], z.log[j + 1]);
      return;
    }
    const M = m.length;
    v(w, y, b, S), Wr.walks.set(w, { key: T, log: m.slice(M) });
  }, v = (w, y, b, S) => {
    const T = w.style;
    let z = typeof T.w == "number" ? T.w : T.w === "100%" ? b : u(w, y) ? b - o(T.ml) - o(T.mr) : NaN;
    typeof T.max_w == "number" && (z = Math.min(z, T.max_w));
    const M = z - o(T.pl) - o(T.pr) - o(T.border_l) - o(T.border_r), j = { ...S };
    for (const B of s) T[B] !== void 0 && (j[B] = T[B]);
    const O = w.children ?? [];
    if (w.break_anywhere && Number.isFinite(M) && M > 0 && typeof j.text_size == "number" && O.length && O.every((B) => B.kind === "text")) {
      const B = { size: j.text_size, weight: j.font_weight ?? 400, family: j.font_family ?? ".SystemUIFont", italic: !!j.italic }, W = (g) => a(g.trimEnd(), B) <= M + 0.01;
      let J = 0;
      for (const g of O) {
        const h = [];
        for (const k of g.text.split(`
`)) {
          let N = "";
          for (const E of k.split(Ux)) {
            if (W(N + E)) {
              N += E;
              continue;
            }
            N && h.push(N.trimEnd()), N = "";
            for (const R of E)
              N && !W(N + R) && (h.push(N), N = ""), N += R;
          }
          h.push(N.trimEnd());
        }
        const _ = h.join(`
`);
        h.every((k) => !k || W(k)) ? _ !== g.text && f(g, { text: _ }) : J = NaN, J += h.length;
      }
      const D = da(j);
      Number.isFinite(J) && D && T.h === void 0 && O.length === 1 && f(w, { h: J * D + o(T.pt) + o(T.pb) + o(T.border_t) + o(T.border_b) });
    }
    for (const B of O) p(B, w, Re(w) ? NaN : M, j);
  };
  for (const w of n) p(w, null, NaN, {});
}
let Wr = { measure: null };
function qx(n, a) {
  const i = (s, o) => {
    if (!s || s.kind === "text" || !Te(s)) return;
    const u = s.style, m = u.position === "absolute" ? u.w === void 0 && (u.left === void 0 || u.right === void 0) : o && typeof u.w != "number";
    if (m && Re(s))
      for (const f of s.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && a.set(f, { ...a.get(f), flex_basis: "auto" });
      }
    for (const f of s.children ?? []) i(f, m);
  };
  for (const s of n) i(s, !1);
}
function Yx(n, a) {
  const i = a.heights ?? /* @__PURE__ */ new Map(), s = (p) => i.get(p), o = (p) => {
    const v = s(p);
    if (Number.isFinite(v)) return v;
    if (p.kind === "text" || !Te(p)) return 0;
    const w = p.style, y = typeof w.min_h == "number" ? w.min_h : 0, b = (p.children ?? []).filter(Qe), S = b.map((M) => o(M) + (M.kind === "text" ? 0 : Math.max(0, st(M.style.mt) || 0) + Math.max(0, st(M.style.mb) || 0))), T = b.length ? Re(p) ? Math.max(...S) : S.reduce((M, j) => M + j, 0) + (w.display === "flex" ? (st(w.gap_y) || 0) * (b.length - 1) : 0) : 0, z = [w.pt, w.pb, w.border_t, w.border_b].reduce((M, j) => M + (st(j) || 0), 0);
    return Math.max(y, T + z);
  }, u = (p) => !(p.children ?? []).filter(Qe).length || Re(p) ? NaN : o({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, v) => {
    const w = p.style;
    if (typeof w.h == "number") return w.h;
    if (typeof w.max_h == "number") return w.max_h;
    if (!v || !mi(v) || Re(v)) return NaN;
    const y = v.style, b = typeof y.h == "number" ? y.h : typeof y.max_h == "number" ? y.max_h : NaN, S = (v.children ?? []).filter(Qe);
    let T = 0;
    for (const M of S) {
      if (M === p) continue;
      const j = s(M);
      if (!Number.isFinite(j)) return NaN;
      T += j + (M.kind === "text" ? 0 : st(M.style.mt) + st(M.style.mb));
    }
    const z = y.display === "flex" ? st(y.gap_y) * Math.max(0, S.length - 1) : 0;
    return b - st(y.pt) - st(y.pb) - st(y.border_t) - st(y.border_b) - T - z - st(w.mt) - st(w.mb);
  }, f = (p, v) => {
    if (!(!p || p.kind === "text" || !Te(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const w = u(p), y = m(p, v);
        Number.isFinite(w) && Number.isFinite(y) && w > y + 0.01 && a.set(p, { ...a.get(p), pr: st(p.style.pr) + p.scrollbar });
      }
      for (const w of p.children ?? []) f(w, p);
    }
  };
  for (const p of n) f(p, null);
}
const Lx = ["text_size", "line_height", "whitespace", "text_ellipsis"], st = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, mi = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Qe = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function Qx(n, a) {
  ho.scale !== a && (ho = vp(a));
  const { heights: i, texts: s, textKeys: o, visits: u, places: m } = ho, f = /* @__PURE__ */ new Map(), p = [], v = (D, g) => {
    const h = f.get(D);
    f.set(D, h ? { ...h, ...g } : g);
  }, w = (D, g) => {
    let h = null;
    for (const _ in g)
      Number.isFinite(g[_]) && ((h ??= {})[_] = g[_]);
    h && (p.push(D, h), v(D, h));
  }, y = (D) => {
    for (let g = 0; g < D.length; g += 2)
      p.push(D[g], D[g + 1]), v(D[g], D[g + 1]);
  };
  function b(D, g) {
    if (D.kind === "text") return g.whitespace === "nowrap" || pp.test(D.text) ? da(g) ?? NaN : NaN;
    const h = `${g.text_size}|${g.line_height}|${g.whitespace}|${g.text_ellipsis}`;
    if (o.get(D) === h && i.has(D)) return i.get(D);
    let _ = g;
    for (const Q of Lx) D.style[Q] !== void 0 && D.style[Q] !== _[Q] && (_ === g && (_ = { ...g }), _[Q] = D.style[Q]);
    o.set(D, h), s.set(D, _);
    const k = D.style, N = (D.children ?? []).filter(Qe), E = N.map((Q) => b(Q, _));
    let R;
    if (k.h !== void 0 && k.h !== "auto") R = st(k.h);
    else if (D.kind === "engine") R = NaN;
    else if (D.kind === "input")
      R = (D.input_type === "textarea" || D.input_type === "select" ? NaN : da(_) ?? NaN) + st(k.pt) + st(k.pb) + st(k.border_t) + st(k.border_b), k.min_h !== void 0 && (R = Math.max(R, st(k.min_h)));
    else {
      const Q = N.map((U, V) => (U.kind === "text" ? 0 : st(U.style.mt) + st(U.style.mb)) + E[V]);
      let $;
      if (Re(D)) $ = k.flex_wrap === "wrap" ? NaN : k.items === "baseline" ? T(N, E, _) : Math.max(0, ...Q);
      else if (mi(D)) {
        const U = N.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), V = k.display !== "flex" && N.some((I) => I.kind !== "text" && (st(I.style.mt) || st(I.style.mb)));
        $ = U || V ? NaN : Q.reduce((I, L) => I + L, 0) + (k.display === "flex" ? st(k.gap_y) * Math.max(0, N.length - 1) : 0);
      } else $ = NaN;
      R = $ + st(k.pt) + st(k.pb) + st(k.border_t) + st(k.border_b), k.min_h !== void 0 && (R = Math.max(R, st(k.min_h))), k.max_h !== void 0 && (R = Math.min(R, st(k.max_h)));
    }
    return i.set(D, R), R;
  }
  const S = (D) => (da(D) - (ci + Sm) * D.text_size) / 2 + ci * D.text_size;
  function T(D, g, h) {
    let _ = 0, k = 0;
    for (const [N, E] of D.entries()) {
      const R = E.kind === "text" ? h : s.get(E);
      if (!(E.kind === "text" || (E.children ?? []).filter(Qe).every((V) => V.kind === "text")) || !Number.isFinite(g[N]) || typeof R.text_size != "number") return NaN;
      const $ = E.kind === "text" ? {} : E.style, U = st($.mt) + st($.border_t) + st($.pt) + S(R);
      _ = Math.max(_, U), k = Math.max(k, st($.mt) + g[N] + st($.mb) - U);
    }
    return _ + k;
  }
  const z = () => ({ exact: 0, laid: 0 }), M = (D, g) => {
    if (!Number.isFinite(g))
      return Object.assign(D, z()), NaN;
    D.exact += g;
    const h = Math.round(D.exact * a + 1e-9) / a, _ = h - D.laid;
    return D.laid = h, _;
  };
  function j(D) {
    if (D.kind === "text" || !Te(D)) return;
    const g = o.get(D), h = u.get(D);
    if (h && g !== void 0 && h.key === g) return y(h.log);
    const _ = p.length;
    for (const k of (D.children ?? []).filter((N) => N.kind !== "text" && Te(N) && N.style.position === "absolute")) j(k);
    if (mi(D) && !Re(D)) {
      const k = z();
      w(D, { border_t: M(k, st(D.style.border_t)), pt: M(k, st(D.style.pt)) }), O(D, k);
    } else for (const k of (D.children ?? []).filter(Qe)) k.kind !== "text" && j(k);
    g !== void 0 && u.set(D, { key: g, log: p.slice(_) });
  }
  function O(D, g) {
    const h = (D.children ?? []).filter(Qe), _ = D.style.display === "flex" ? st(D.style.gap_y) : 0;
    if (_ && h.some((k) => k.kind === "text")) {
      for (const k of h) k.kind !== "text" && j(k);
      return !1;
    }
    return _ && w(D, { gap_y: 0 }), h.forEach((k, N) => {
      if (k.kind === "text") {
        const E = b(k, s.get(D) ?? {});
        Number.isFinite(E) ? w(k, { h: M(g, E) }) : Object.assign(g, z());
        return;
      }
      if (w(k, { mt: M(g, (N ? _ : 0) + st(k.style.mt)) }), Number.isFinite(i.get(k))) W(k, g);
      else if (B(k)) {
        const E = k.style;
        w(k, { border_t: M(g, st(E.border_t)), pt: M(g, st(E.pt)) }), w(k, { pb: M(g, st(E.pb)), border_b: M(g, st(E.border_b)) });
      } else
        j(k), Object.assign(g, z());
      w(k, { mb: M(g, st(k.style.mb)) });
    }), !0;
  }
  function B(D) {
    const g = D.style, h = (D.children ?? []).filter(Qe), _ = da(s.get(D) ?? {});
    return D.kind === "div" && !Re(D) && h.length > 0 && h.every((k) => k.kind === "text") && Number.isInteger(_) && [g.h, g.min_h, g.max_h].every((k) => k === void 0 || k === "auto");
  }
  function W(D, g) {
    const h = `${o.get(D)}|${Math.round((g.exact - g.laid) * 1e6)}`, _ = m.get(D);
    if (_ && _.key === h) {
      y(_.log), g.exact += _.exact, g.laid += _.laid;
      return;
    }
    const k = p.length, [N, E] = [g.exact, g.laid];
    J(D, g), m.set(D, { key: h, log: p.slice(k), exact: g.exact - N, laid: g.laid - E });
  }
  function J(D, g) {
    const h = D.style;
    for (const R of (D.children ?? []).filter((Q) => Q.kind !== "text" && Te(Q) && Q.style.position === "absolute")) j(R);
    const _ = g.laid, k = g.exact;
    w(D, { border_t: M(g, st(h.border_t)), pt: M(g, st(h.pt)) });
    const N = h.h !== void 0 && h.h !== "auto", E = i.get(D) - st(h.pt) - st(h.pb) - st(h.border_t) - st(h.border_b);
    if (D.kind === "input")
      N || M(g, E);
    else if (Re(D) || N && (h.justify ?? "start") !== "start") {
      for (const R of (D.children ?? []).filter(Qe)) R.kind !== "text" && j(R);
      N || M(g, E);
    } else !O(D, g) && !N && M(g, E);
    if (N) {
      g.exact = k + i.get(D), g.laid = Math.round(g.exact * a + 1e-9) / a, w(D, { h: g.laid - _ });
      return;
    }
    w(D, { pb: M(g, st(h.pb)), border_b: M(g, st(h.border_b)) }), w(D, { h: g.laid - _ });
  }
  for (const D of n)
    b(D, {}), j(D);
  return Object.defineProperty(f, "heights", { value: i }), f;
}
const vp = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let ho = vp(0);
const Fx = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-markdown-view", selector: '[aria-label="Markdown view"]' }, { name: "files-markdown-preview-button", selector: '[aria-label="Markdown view"] > button:last-child' }, { name: "files-markdown-preview", selector: '[data-testid="workspace-markdown-preview"]' }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "editor-text", selector: '[data-testid="workspace-file-editor-area"] .cm-scroller' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }], review: [{ name: "review-root", selector: '[data-testid="workspace-git-review"]' }, { name: "git-refresh", selector: '[data-testid="git-refresh"]' }, { name: "git-status", selector: '[data-testid="git-status"]' }, { name: "git-diff", selector: '[data-testid="git-diff"]' }, { name: "git-diff-empty", selector: '[data-testid="git-diff-empty"]' }, { name: "git-file-header", selector: '[data-testid="git-diff"] article > header' }, { name: "git-hunk-header", selector: '[data-testid="git-diff"] section > div:first-child' }, { name: "git-diff-line", selector: '[data-testid="git-diff-line"]' }, { name: "git-line-comments", selector: '[data-testid="git-line-comments"]' }, { name: "git-comment-composer", selector: '[data-testid="git-comment-composer"]' }] };
export {
  Fx as NAMED_ELEMENTS,
  s0 as React,
  Q0 as SCHEMA,
  Jx as STYLE_KEYS,
  Wx as describeToGpui,
  Vx as jsxRuntime,
  Kx as mount,
  Xx as reactDom,
  Zx as sdk
};
