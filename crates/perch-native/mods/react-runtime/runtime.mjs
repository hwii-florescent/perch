function Jo(n, a) {
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
const n0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), a0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), l0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...n0]);
function Eo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (a, r, i) => r ? String.fromCodePoint(parseInt(r, 16)) : i);
}
function Ml(n, a) {
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
  return [Eo(n.slice(a, r)), r];
}
function r0(n, a) {
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
function Wo(n) {
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
function i0(n, a) {
  const r = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; a < n.length; ) {
    const s = n[a];
    if (s === "*") {
      r.tag = "*", a++, i = !0;
      continue;
    }
    if (s === ".") {
      const [c, f] = Ml(n, a + 1);
      r.classes.push(c), a = f, i = !0;
      continue;
    }
    if (s === "#") {
      const [c, f] = Ml(n, a + 1);
      r.id = c, a = f, i = !0;
      continue;
    }
    if (s === "[") {
      const c = n.indexOf("]", a);
      if (c < 0) throw new ot(`unclosed [ in ${JSON.stringify(n)}`);
      const f = n.slice(a + 1, c).trim(), d = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(f);
      if (!d) throw new ot(`cannot read the attribute selector [${f}]`);
      const m = d[3] ?? d[4] ?? d[5];
      r.attrs.push({ name: Eo(d[1]).toLowerCase(), op: d[2] ?? null, value: m === void 0 ? null : Eo(m) }), a = c + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[a + 1] === ":") {
        const [m, h] = Ml(n, a + 2), x = m.toLowerCase();
        if (x !== "before" && x !== "after") throw new ot(`::${x} is not supported`);
        if (r.pseudoElement = x, a = h, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow ::${x} in ${JSON.stringify(n)}`);
        break;
      }
      const [c, f] = Ml(n, a + 1);
      a = f;
      const d = c.toLowerCase();
      if ((d === "before" || d === "after") && n[a] !== "(") {
        if (r.pseudoElement = d, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new ot(`nothing may follow :${d} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!a0.has(d)) throw new ot(`:${d}() is not supported`);
        const m = r0(n, a + 1), h = n.slice(a + 1, m).trim();
        if (a = m + 1, d === "nth-child") {
          if (!/^\d+$/.test(h)) throw new ot(`:nth-child(${h}) is not supported (only a number)`);
          r.pseudos.push({ name: d, n: Number(h) });
        } else {
          const x = Wo(h).map(Fo);
          if (d === "has" && x.some((g) => g.length !== 1)) throw new ot(`:has(${h}) is not supported (only a compound selector)`);
          r.pseudos.push({ name: d, list: x });
        }
      } else {
        if (!l0.has(d)) throw new ot(`:${d} is not supported`);
        r.pseudos.push({ name: d });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !i) {
      const [c, f] = Ml(n, a);
      r.tag = c.toLowerCase(), a = f, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new ot(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [r, a];
}
function Fo(n) {
  const a = [];
  let r = 0, i = null;
  for (n = n.trim(); r < n.length; ) {
    const [s, c] = i0(n, r);
    if (a.at(-1)?.compound.pseudoElement) throw new ot(`::${a.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    a.push({ compound: s, combinator: i }), r = c;
    let f = !1;
    for (; n[r] === " " || n[r] === `
` || n[r] === "	"; )
      r++, f = !0;
    if (r >= n.length) break;
    const d = n[r];
    if (d === ">")
      for (i = ">", r++; n[r] === " "; ) r++;
    else {
      if (d === "+" || d === "~") throw new ot(`the ${d} combinator is not supported`);
      if (f) i = " ";
      else throw new ot(`unexpected ${JSON.stringify(d)} in ${JSON.stringify(n)}`);
    }
  }
  if (!a.length) throw new ot("empty selector");
  return a;
}
const gf = /* @__PURE__ */ new Map();
function Si(n) {
  let a = gf.get(n);
  return a || (a = Wo(n).map(Fo), gf.set(n, a)), a;
}
function vp(n) {
  const a = [0, 0, 0], r = (i) => {
    a[0] += i[0], a[1] += i[1], a[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && a[0]++, a[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && a[2]++, i.pseudoElement && a[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const c = s.list.map(vp).sort((f, d) => d[0] - f[0] || d[1] - f[1] || d[2] - f[2])[0];
          r(c);
        } else a[1]++;
  }
  return a;
}
function s0(n, { name: a, op: r, value: i }) {
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
function Zr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function yp(n, a) {
  for (const r of n.children) if (a(r) || yp(r, a)) return !0;
  return !1;
}
function xp(n, a, r, i) {
  if ((a.pseudoElement ?? null) !== (i ? r.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const c of a.classes) if (!s.has(c)) return !1;
  }
  for (const s of a.attrs) if (!s0(n, s)) return !1;
  for (const s of a.pseudos)
    switch (s.name) {
      case "first-child":
        if (Zr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Zr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const c = Zr(n);
        if (c[c.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Zr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((c) => Ia(n, c, r, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: c }]) => yp(n, (f) => xp(f, c, r, !1)))) return !1;
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
  const s = (c, f, d) => {
    const { compound: m, combinator: h } = a[f];
    if (!xp(c, m, r, d)) return !1;
    if (f === 0) return !0;
    if (h === ">") return !!c.parentElement && s(c.parentElement, f - 1, !1);
    for (let x = c.parentElement; x; x = x.parentElement) if (s(x, f - 1, !1)) return !0;
    return !1;
  };
  return s(n, a.length - 1, i);
}
function o0(n, a, r = {}) {
  return (typeof a == "string" ? Si(a) : a).some((s) => Ia(n, s, r));
}
function zo(n, a, r = {}) {
  return Ia(n, a, r);
}
function Gl(n, a, r = {}) {
  const i = Si(a), s = [], c = (f) => {
    for (const d of f.children)
      i.some((m) => Ia(d, m, r)) && s.push(d), c(d);
  };
  return c(n), s;
}
function wp(n, a, r = {}) {
  const i = Si(a);
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
let c0 = 1;
class No {
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
class $o {
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
let u0 = 0;
const To = () => ++u0;
class Ei {
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
class Je extends $o {
  constructor(a, r = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${c0++}`, this.tagName = a.toLowerCase(), this.props = r, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = To(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = To();
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
      const c = a.replace(/-([a-z])/g, (f, d) => d.toUpperCase());
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
    return o0(this, a);
  }
  closest(a) {
    return wp(this, a);
  }
  querySelectorAll(a) {
    return Gl(this, a);
  }
  querySelector(a) {
    return Gl(this, a)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const a = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return a ? new No(a.x, a.y, a.width, a.height) : new No();
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
    const a = this, r = (f) => String(f).startsWith("--") ? String(f) : String(f).replace(/-([a-z])/g, (d, m) => m.toUpperCase()), i = (f) => {
      const d = a.props.style?.[f];
      return d == null || typeof d == "boolean" ? "" : typeof d == "number" && d !== 0 ? `${d}px` : String(d);
    }, s = (f) => a.inline && f in a.inline ? a.inline[f] : i(f), c = (f, d) => {
      const m = d == null ? "" : String(d);
      s(f) !== m && (a.inline ??= {}, m === i(f) ? delete a.inline[f] : a.inline[f] = m, a.touch(), a.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (f, d) => {
        if (typeof d == "string")
          return d === "setProperty" ? (m, h) => c(r(m), h) : d === "removeProperty" ? (m) => {
            const h = s(r(m));
            return c(r(m), ""), h;
          } : d === "getPropertyValue" ? (m) => s(r(m)) : s(d);
      },
      set: (f, d, m) => (typeof d == "string" && c(d, m), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return bf(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return bf(this, a);
  }
}
const kp = Symbol("perch.stale-layout"), _p = 3;
let ai = !1;
function Sp(n) {
  return () => {
    let a, r = !1;
    const i = (s) => {
      const c = ai;
      ai = s < _p;
      try {
        a = n();
      } catch (f) {
        const d = f?.[kp];
        if (!d) throw f;
        d.retries.push(() => {
          r || i(s + 1);
        });
      } finally {
        ai = c;
      }
    };
    return i(0), () => {
      r = !0, typeof a == "function" && a();
    };
  };
}
const Co = "perch-dom:", d0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), f0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function bf(n, a = []) {
  const r = new Set(a.map((s) => f0[s] ?? s)), i = (s) => {
    if (!(s instanceof Je)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const c = {};
    for (const [f, d] of Object.entries(s.props))
      d0.has(f) || r.has(f) || d == null || typeof d == "function" || typeof d == "symbol" || (c[f] = d);
    return { t: s.tagName, p: c, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return Co + JSON.stringify(i(n));
}
function p0(n, a) {
  if (typeof n != "string" || !n.startsWith(Co)) return null;
  let r;
  try {
    r = JSON.parse(n.slice(Co.length));
  } catch {
    return null;
  }
  const i = (c) => !!c && typeof c == "object" && !Array.isArray(c), s = (c) => {
    if (!i(c)) throw new Error("not a node");
    let f;
    if (typeof c.x == "string") f = new Ei(c.x);
    else {
      if (typeof c.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(c.t) || !i(c.p) || !Array.isArray(c.c)) throw new Error("not an element");
      f = new Je(c.t, c.p, a);
      for (const d of c.c) f.appendChild(s(d));
    }
    return f.hidden = c.h === 1, f;
  };
  try {
    return [s(r)];
  } catch {
    return null;
  }
}
class m0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class h0 {
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
function vf(n) {
  for (let a = n; a instanceof Je; a = a.parentElement) a.touch();
}
class g0 extends $o {
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
    if (ai && (!i || this.stale?.())) throw { [kp]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, vf(a), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, vf(a), this.activeElement === a && (this.activeElement = this.body);
  }
  querySelectorAll(a) {
    return Gl(this.documentElement, a);
  }
  querySelector(a) {
    return this.querySelectorAll(a)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(a) {
    return Gl(this.documentElement, "*").find((r) => r.props?.id === a) ?? null;
  }
}
class b0 extends $o {
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
function Ep(n) {
  return {
    setTimeout: (a, r = 0, ...i) => n.setTimeout(() => a(...i), Math.max(0, Number(r) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const yf = Symbol.for("perch.react.globals");
function Pt(n, a, r) {
  Object.defineProperty(n, a, { value: r, configurable: !0, writable: !0, enumerable: !1 });
}
function v0(n, a = globalThis) {
  const r = new g0(n), i = new b0(n, r);
  r.defaultView = i;
  const s = n.storage ?? new h0();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const d = Ep(n);
    Pt(a, "setTimeout", d.setTimeout), Pt(a, "clearTimeout", d.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && Pt(a, "queueMicrotask", (d) => {
    Promise.resolve().then(d);
  }), Pt(a, "requestAnimationFrame", (d) => a.setTimeout(() => d(Date.now()), 0)), Pt(a, "cancelAnimationFrame", (d) => a.clearTimeout(d));
  const c = { document: r, window: i, localStorage: s, HTMLElement: Je, Element: Je };
  for (const d of Object.keys(c))
    Object.defineProperty(a, d, { get: () => a[yf]?.[d], configurable: !0, enumerable: !1 });
  a[yf] = c, Pt(a, "DOMRect", No), Pt(a, "getComputedStyle", y0), typeof a.ResizeObserver != "function" && Pt(a, "ResizeObserver", m0);
  const f = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!f.clipboard && n.clipboard)
    try {
      Pt(f, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || Pt(a, "navigator", f), { document: r, window: i, globals: c };
}
function y0(n) {
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
function Ao(n, a = !1) {
  if (!(a ? n?.tagName === "input" && zp(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const zp = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const xf = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof xf?.setTimeout == "function") {
  const n = Ep(xf);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Io(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function x0(n) {
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
var mo = { exports: {} }, me = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var wf;
function w0() {
  if (wf) return me;
  wf = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), c = Symbol.for("react.consumer"), f = Symbol.for("react.context"), d = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), h = Symbol.for("react.memo"), x = Symbol.for("react.lazy"), g = Symbol.for("react.activity"), v = Symbol.iterator;
  function E(T) {
    return T === null || typeof T != "object" ? null : (T = v && T[v] || T["@@iterator"], typeof T == "function" ? T : null);
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
  }, z = Object.assign, _ = {};
  function N(T, J, ae) {
    this.props = T, this.context = J, this.refs = _, this.updater = ae || S;
  }
  N.prototype.isReactComponent = {}, N.prototype.setState = function(T, J) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, J, "setState");
  }, N.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function B() {
  }
  B.prototype = N.prototype;
  function R(T, J, ae) {
    this.props = T, this.context = J, this.refs = _, this.updater = ae || S;
  }
  var X = R.prototype = new B();
  X.constructor = R, z(X, N.prototype), X.isPureReactComponent = !0;
  var q = Array.isArray;
  function O() {
  }
  var b = { H: null, A: null, T: null, S: null }, w = Object.prototype.hasOwnProperty;
  function k(T, J, ae) {
    var oe = ae.ref;
    return {
      $$typeof: n,
      type: T,
      key: J,
      ref: oe !== void 0 ? oe : null,
      props: ae
    };
  }
  function C(T, J) {
    return k(T.type, J, T.props);
  }
  function j(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function M(T) {
    var J = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(ae) {
      return J[ae];
    });
  }
  var H = /\/+/g;
  function Z(T, J) {
    return typeof T == "object" && T !== null && T.key != null ? M("" + T.key) : J.toString(36);
  }
  function $(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(O, O) : (T.status = "pending", T.then(
          function(J) {
            T.status === "pending" && (T.status = "fulfilled", T.value = J);
          },
          function(J) {
            T.status === "pending" && (T.status = "rejected", T.reason = J);
          }
        )), T.status) {
          case "fulfilled":
            return T.value;
          case "rejected":
            throw T.reason;
        }
    }
    throw T;
  }
  function Q(T, J, ae, oe, ce) {
    var ue = typeof T;
    (ue === "undefined" || ue === "boolean") && (T = null);
    var Ee = !1;
    if (T === null) Ee = !0;
    else
      switch (ue) {
        case "bigint":
        case "string":
        case "number":
          Ee = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case n:
            case a:
              Ee = !0;
              break;
            case x:
              return Ee = T._init, Q(
                Ee(T._payload),
                J,
                ae,
                oe,
                ce
              );
          }
      }
    if (Ee)
      return ce = ce(T), Ee = oe === "" ? "." + Z(T, 0) : oe, q(ce) ? (ae = "", Ee != null && (ae = Ee.replace(H, "$&/") + "/"), Q(ce, J, ae, "", function(Wn) {
        return Wn;
      })) : ce != null && (j(ce) && (ce = C(
        ce,
        ae + (ce.key == null || T && T.key === ce.key ? "" : ("" + ce.key).replace(
          H,
          "$&/"
        ) + "/") + Ee
      )), J.push(ce)), 1;
    Ee = 0;
    var Ie = oe === "" ? "." : oe + ":";
    if (q(T))
      for (var he = 0; he < T.length; he++)
        oe = T[he], ue = Ie + Z(oe, he), Ee += Q(
          oe,
          J,
          ae,
          ue,
          ce
        );
    else if (he = E(T), typeof he == "function")
      for (T = he.call(T), he = 0; !(oe = T.next()).done; )
        oe = oe.value, ue = Ie + Z(oe, he++), Ee += Q(
          oe,
          J,
          ae,
          ue,
          ce
        );
    else if (ue === "object") {
      if (typeof T.then == "function")
        return Q(
          $(T),
          J,
          ae,
          oe,
          ce
        );
      throw J = String(T), Error(
        "Objects are not valid as a React child (found: " + (J === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : J) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Ee;
  }
  function W(T, J, ae) {
    if (T == null) return T;
    var oe = [], ce = 0;
    return Q(T, oe, "", "", function(ue) {
      return J.call(ae, ue, ce++);
    }), oe;
  }
  function I(T) {
    if (T._status === -1) {
      var J = T._result;
      J = J(), J.then(
        function(ae) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = ae);
        },
        function(ae) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = ae);
        }
      ), T._status === -1 && (T._status = 0, T._result = J);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var Y = typeof reportError == "function" ? reportError : function(T) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var J = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof T == "object" && T !== null && typeof T.message == "string" ? String(T.message) : String(T),
        error: T
      });
      if (!window.dispatchEvent(J)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", T);
      return;
    }
    console.error(T);
  }, V = {
    map: W,
    forEach: function(T, J, ae) {
      W(
        T,
        function() {
          J.apply(this, arguments);
        },
        ae
      );
    },
    count: function(T) {
      var J = 0;
      return W(T, function() {
        J++;
      }), J;
    },
    toArray: function(T) {
      return W(T, function(J) {
        return J;
      }) || [];
    },
    only: function(T) {
      if (!j(T))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return T;
    }
  };
  return me.Activity = g, me.Children = V, me.Component = N, me.Fragment = r, me.Profiler = s, me.PureComponent = R, me.StrictMode = i, me.Suspense = m, me.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = b, me.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(T) {
      return b.H.useMemoCache(T);
    }
  }, me.cache = function(T) {
    return function() {
      return T.apply(null, arguments);
    };
  }, me.cacheSignal = function() {
    return null;
  }, me.cloneElement = function(T, J, ae) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var oe = z({}, T.props), ce = T.key;
    if (J != null)
      for (ue in J.key !== void 0 && (ce = "" + J.key), J)
        !w.call(J, ue) || ue === "key" || ue === "__self" || ue === "__source" || ue === "ref" && J.ref === void 0 || (oe[ue] = J[ue]);
    var ue = arguments.length - 2;
    if (ue === 1) oe.children = ae;
    else if (1 < ue) {
      for (var Ee = Array(ue), Ie = 0; Ie < ue; Ie++)
        Ee[Ie] = arguments[Ie + 2];
      oe.children = Ee;
    }
    return k(T.type, ce, oe);
  }, me.createContext = function(T) {
    return T = {
      $$typeof: f,
      _currentValue: T,
      _currentValue2: T,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, T.Provider = T, T.Consumer = {
      $$typeof: c,
      _context: T
    }, T;
  }, me.createElement = function(T, J, ae) {
    var oe, ce = {}, ue = null;
    if (J != null)
      for (oe in J.key !== void 0 && (ue = "" + J.key), J)
        w.call(J, oe) && oe !== "key" && oe !== "__self" && oe !== "__source" && (ce[oe] = J[oe]);
    var Ee = arguments.length - 2;
    if (Ee === 1) ce.children = ae;
    else if (1 < Ee) {
      for (var Ie = Array(Ee), he = 0; he < Ee; he++)
        Ie[he] = arguments[he + 2];
      ce.children = Ie;
    }
    if (T && T.defaultProps)
      for (oe in Ee = T.defaultProps, Ee)
        ce[oe] === void 0 && (ce[oe] = Ee[oe]);
    return k(T, ue, ce);
  }, me.createRef = function() {
    return { current: null };
  }, me.forwardRef = function(T) {
    return { $$typeof: d, render: T };
  }, me.isValidElement = j, me.lazy = function(T) {
    return {
      $$typeof: x,
      _payload: { _status: -1, _result: T },
      _init: I
    };
  }, me.memo = function(T, J) {
    return {
      $$typeof: h,
      type: T,
      compare: J === void 0 ? null : J
    };
  }, me.startTransition = function(T) {
    var J = b.T, ae = {};
    b.T = ae;
    try {
      var oe = T(), ce = b.S;
      ce !== null && ce(ae, oe), typeof oe == "object" && oe !== null && typeof oe.then == "function" && oe.then(O, Y);
    } catch (ue) {
      Y(ue);
    } finally {
      J !== null && ae.types !== null && (J.types = ae.types), b.T = J;
    }
  }, me.unstable_useCacheRefresh = function() {
    return b.H.useCacheRefresh();
  }, me.use = function(T) {
    return b.H.use(T);
  }, me.useActionState = function(T, J, ae) {
    return b.H.useActionState(T, J, ae);
  }, me.useCallback = function(T, J) {
    return b.H.useCallback(T, J);
  }, me.useContext = function(T) {
    return b.H.useContext(T);
  }, me.useDebugValue = function() {
  }, me.useDeferredValue = function(T, J) {
    return b.H.useDeferredValue(T, J);
  }, me.useEffect = function(T, J) {
    return b.H.useEffect(T, J);
  }, me.useEffectEvent = function(T) {
    return b.H.useEffectEvent(T);
  }, me.useId = function() {
    return b.H.useId();
  }, me.useImperativeHandle = function(T, J, ae) {
    return b.H.useImperativeHandle(T, J, ae);
  }, me.useInsertionEffect = function(T, J) {
    return b.H.useInsertionEffect(T, J);
  }, me.useLayoutEffect = function(T, J) {
    return b.H.useLayoutEffect(T, J);
  }, me.useMemo = function(T, J) {
    return b.H.useMemo(T, J);
  }, me.useOptimistic = function(T, J) {
    return b.H.useOptimistic(T, J);
  }, me.useReducer = function(T, J, ae) {
    return b.H.useReducer(T, J, ae);
  }, me.useRef = function(T) {
    return b.H.useRef(T);
  }, me.useState = function(T) {
    return b.H.useState(T);
  }, me.useSyncExternalStore = function(T, J, ae) {
    return b.H.useSyncExternalStore(
      T,
      J,
      ae
    );
  }, me.useTransition = function() {
    return b.H.useTransition();
  }, me.version = "19.2.8", me;
}
var kf;
function k0() {
  return kf || (kf = 1, mo.exports = w0()), mo.exports;
}
var K = k0();
const Np = /* @__PURE__ */ Io(K), _0 = /* @__PURE__ */ Jo({
  __proto__: null,
  default: Np
}, [K]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const S0 = Np ?? _0;
function nt(n, a) {
  return K.useEffect(Sp(n), a);
}
function di(n, a) {
  return K.useLayoutEffect(Sp(n), a);
}
const E0 = /* @__PURE__ */ Jo({
  __proto__: null,
  default: S0,
  useEffect: nt,
  useLayoutEffect: di
}, [K]);
var ho = { exports: {} }, Rl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var _f;
function z0() {
  if (_f) return Rl;
  _f = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.fragment");
  function r(i, s, c) {
    var f = null;
    if (c !== void 0 && (f = "" + c), s.key !== void 0 && (f = "" + s.key), "key" in s) {
      c = {};
      for (var d in s)
        d !== "key" && (c[d] = s[d]);
    } else c = s;
    return s = c.ref, {
      $$typeof: n,
      type: i,
      key: f,
      ref: s !== void 0 ? s : null,
      props: c
    };
  }
  return Rl.Fragment = a, Rl.jsx = r, Rl.jsxs = r, Rl;
}
var Sf;
function N0() {
  return Sf || (Sf = 1, ho.exports = z0()), ho.exports;
}
var te = N0();
const T0 = /* @__PURE__ */ Io(te), Yw = /* @__PURE__ */ Jo({
  __proto__: null,
  default: T0
}, [te]);
var go = { exports: {} }, bo = { exports: {} };
const C0 = /* @__PURE__ */ x0(E0);
var vo = { exports: {} }, yo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ef;
function A0() {
  return Ef || (Ef = 1, (function(n) {
    function a(Q, W) {
      var I = Q.length;
      Q.push(W);
      e: for (; 0 < I; ) {
        var Y = I - 1 >>> 1, V = Q[Y];
        if (0 < s(V, W))
          Q[Y] = W, Q[I] = V, I = Y;
        else break e;
      }
    }
    function r(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function i(Q) {
      if (Q.length === 0) return null;
      var W = Q[0], I = Q.pop();
      if (I !== W) {
        Q[0] = I;
        e: for (var Y = 0, V = Q.length, T = V >>> 1; Y < T; ) {
          var J = 2 * (Y + 1) - 1, ae = Q[J], oe = J + 1, ce = Q[oe];
          if (0 > s(ae, I))
            oe < V && 0 > s(ce, ae) ? (Q[Y] = ce, Q[oe] = I, Y = oe) : (Q[Y] = ae, Q[J] = I, Y = J);
          else if (oe < V && 0 > s(ce, I))
            Q[Y] = ce, Q[oe] = I, Y = oe;
          else break e;
        }
      }
      return W;
    }
    function s(Q, W) {
      var I = Q.sortIndex - W.sortIndex;
      return I !== 0 ? I : Q.id - W.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var c = performance;
      n.unstable_now = function() {
        return c.now();
      };
    } else {
      var f = Date, d = f.now();
      n.unstable_now = function() {
        return f.now() - d;
      };
    }
    var m = [], h = [], x = 1, g = null, v = 3, E = !1, S = !1, z = !1, _ = !1, N = typeof setTimeout == "function" ? setTimeout : null, B = typeof clearTimeout == "function" ? clearTimeout : null, R = typeof setImmediate < "u" ? setImmediate : null;
    function X(Q) {
      for (var W = r(h); W !== null; ) {
        if (W.callback === null) i(h);
        else if (W.startTime <= Q)
          i(h), W.sortIndex = W.expirationTime, a(m, W);
        else break;
        W = r(h);
      }
    }
    function q(Q) {
      if (z = !1, X(Q), !S)
        if (r(m) !== null)
          S = !0, O || (O = !0, M());
        else {
          var W = r(h);
          W !== null && $(q, W.startTime - Q);
        }
    }
    var O = !1, b = -1, w = 5, k = -1;
    function C() {
      return _ ? !0 : !(n.unstable_now() - k < w);
    }
    function j() {
      if (_ = !1, O) {
        var Q = n.unstable_now();
        k = Q;
        var W = !0;
        try {
          e: {
            S = !1, z && (z = !1, B(b), b = -1), E = !0;
            var I = v;
            try {
              t: {
                for (X(Q), g = r(m); g !== null && !(g.expirationTime > Q && C()); ) {
                  var Y = g.callback;
                  if (typeof Y == "function") {
                    g.callback = null, v = g.priorityLevel;
                    var V = Y(
                      g.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof V == "function") {
                      g.callback = V, X(Q), W = !0;
                      break t;
                    }
                    g === r(m) && i(m), X(Q);
                  } else i(m);
                  g = r(m);
                }
                if (g !== null) W = !0;
                else {
                  var T = r(h);
                  T !== null && $(
                    q,
                    T.startTime - Q
                  ), W = !1;
                }
              }
              break e;
            } finally {
              g = null, v = I, E = !1;
            }
            W = void 0;
          }
        } finally {
          W ? M() : O = !1;
        }
      }
    }
    var M;
    if (typeof R == "function")
      M = function() {
        R(j);
      };
    else if (typeof MessageChannel < "u") {
      var H = new MessageChannel(), Z = H.port2;
      H.port1.onmessage = j, M = function() {
        Z.postMessage(null);
      };
    } else
      M = function() {
        N(j, 0);
      };
    function $(Q, W) {
      b = N(function() {
        Q(n.unstable_now());
      }, W);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, n.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : w = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return v;
    }, n.unstable_next = function(Q) {
      switch (v) {
        case 1:
        case 2:
        case 3:
          var W = 3;
          break;
        default:
          W = v;
      }
      var I = v;
      v = W;
      try {
        return Q();
      } finally {
        v = I;
      }
    }, n.unstable_requestPaint = function() {
      _ = !0;
    }, n.unstable_runWithPriority = function(Q, W) {
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
      var I = v;
      v = Q;
      try {
        return W();
      } finally {
        v = I;
      }
    }, n.unstable_scheduleCallback = function(Q, W, I) {
      var Y = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? Y + I : Y) : I = Y, Q) {
        case 1:
          var V = -1;
          break;
        case 2:
          V = 250;
          break;
        case 5:
          V = 1073741823;
          break;
        case 4:
          V = 1e4;
          break;
        default:
          V = 5e3;
      }
      return V = I + V, Q = {
        id: x++,
        callback: W,
        priorityLevel: Q,
        startTime: I,
        expirationTime: V,
        sortIndex: -1
      }, I > Y ? (Q.sortIndex = I, a(h, Q), r(m) === null && Q === r(h) && (z ? (B(b), b = -1) : z = !0, $(q, I - Y))) : (Q.sortIndex = V, a(m, Q), S || E || (S = !0, O || (O = !0, M()))), Q;
    }, n.unstable_shouldYield = C, n.unstable_wrapCallback = function(Q) {
      var W = v;
      return function() {
        var I = v;
        v = W;
        try {
          return Q.apply(this, arguments);
        } finally {
          v = I;
        }
      };
    };
  })(yo)), yo;
}
var zf;
function M0() {
  return zf || (zf = 1, vo.exports = A0()), vo.exports;
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
var Nf;
function R0() {
  return Nf || (Nf = 1, (function(n) {
    n.exports = function(a) {
      function r(e, t, l, o) {
        return new sh(e, t, l, o);
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
      function d(e) {
        var t = e.alternate;
        if (!t) {
          if (t = c(e), t === null) throw Error(s(188));
          return t !== e ? null : e;
        }
        for (var l = e, o = t; ; ) {
          var u = l.return;
          if (u === null) break;
          var p = u.alternate;
          if (p === null) {
            if (o = u.return, o !== null) {
              l = o;
              continue;
            }
            break;
          }
          if (u.child === p.child) {
            for (p = u.child; p; ) {
              if (p === l) return f(u), e;
              if (p === o) return f(u), t;
              p = p.sibling;
            }
            throw Error(s(188));
          }
          if (l.return !== o.return) l = u, o = p;
          else {
            for (var y = !1, A = u.child; A; ) {
              if (A === l) {
                y = !0, l = u, o = p;
                break;
              }
              if (A === o) {
                y = !0, o = u, l = p;
                break;
              }
              A = A.sibling;
            }
            if (!y) {
              for (A = p.child; A; ) {
                if (A === l) {
                  y = !0, l = p, o = u;
                  break;
                }
                if (A === o) {
                  y = !0, o = p, l = u;
                  break;
                }
                A = A.sibling;
              }
              if (!y) throw Error(s(189));
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
      function x(e) {
        return e === null || typeof e != "object" ? null : (e = Od && e[Od] || e["@@iterator"], typeof e == "function" ? e : null);
      }
      function g(e) {
        if (e == null) return null;
        if (typeof e == "function")
          return e.$$typeof === fh ? null : e.displayName || e.name || null;
        if (typeof e == "string") return e;
        switch (e) {
          case Ma:
            return "Fragment";
          case js:
            return "Profiler";
          case Rd:
            return "StrictMode";
          case Ds:
            return "Suspense";
          case Bs:
            return "SuspenseList";
          case Us:
            return "Activity";
        }
        if (typeof e == "object")
          switch (e.$$typeof) {
            case Aa:
              return "Portal";
            case Cn:
              return e.displayName || "Context";
            case jd:
              return (e._context.displayName || "Context") + ".Consumer";
            case Os:
              var t = e.render;
              return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
            case Hs:
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
      function v(e) {
        return { current: e };
      }
      function E(e) {
        0 > Oa || (e.current = Vs[Oa], Vs[Oa] = null, Oa--);
      }
      function S(e, t) {
        Oa++, Vs[Oa] = e.current, e.current = t;
      }
      function z(e) {
        return e >>>= 0, e === 0 ? 32 : 31 - (Gg(e) / Lg | 0) | 0;
      }
      function _(e) {
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
        var u = 0, p = e.suspendedLanes, y = e.pingedLanes;
        e = e.warmLanes;
        var A = o & 134217727;
        return A !== 0 ? (o = A & ~p, o !== 0 ? u = _(o) : (y &= A, y !== 0 ? u = _(y) : l || (l = A & ~e, l !== 0 && (u = _(l))))) : (A = o & ~p, A !== 0 ? u = _(A) : y !== 0 ? u = _(y) : l || (l = o & ~e, l !== 0 && (u = _(l)))), u === 0 ? 0 : t !== 0 && t !== u && (t & p) === 0 && (p = u & -u, l = t & -t, p >= l || p === 32 && (l & 4194048) !== 0) ? t : u;
      }
      function B(e, t) {
        return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
      }
      function R(e, t) {
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
        var e = Nr;
        return Nr <<= 1, (Nr & 62914560) === 0 && (Nr = 4194304), e;
      }
      function q(e) {
        for (var t = [], l = 0; 31 > l; l++) t.push(e);
        return t;
      }
      function O(e, t) {
        e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
      }
      function b(e, t, l, o, u, p) {
        var y = e.pendingLanes;
        e.pendingLanes = l, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= l, e.entangledLanes &= l, e.errorRecoveryDisabledLanes &= l, e.shellSuspendCounter = 0;
        var A = e.entanglements, L = e.expirationTimes, F = e.hiddenUpdates;
        for (l = y & ~l; 0 < l; ) {
          var ne = 31 - St(l), P = 1 << ne;
          A[ne] = 0, L[ne] = -1;
          var le = F[ne];
          if (le !== null)
            for (F[ne] = null, ne = 0; ne < le.length; ne++) {
              var ge = le[ne];
              ge !== null && (ge.lane &= -536870913);
            }
          l &= ~P;
        }
        o !== 0 && w(e, o, 0), p !== 0 && u === 0 && e.tag !== 0 && (e.suspendedLanes |= p & ~(y & ~t));
      }
      function w(e, t, l) {
        e.pendingLanes |= t, e.suspendedLanes &= ~t;
        var o = 31 - St(t);
        e.entangledLanes |= t, e.entanglements[o] = e.entanglements[o] | 1073741824 | l & 261930;
      }
      function k(e, t) {
        var l = e.entangledLanes |= t;
        for (e = e.entanglements; l; ) {
          var o = 31 - St(l), u = 1 << o;
          u & t | e[o] & t && (e[o] |= t), l &= ~u;
        }
      }
      function C(e, t) {
        var l = t & -t;
        return l = (l & 42) !== 0 ? 1 : j(l), (l & (e.suspendedLanes | t)) !== 0 ? 0 : l;
      }
      function j(e) {
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
      function M(e) {
        return e &= -e, 2 < e ? 8 < e ? (e & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function H(e) {
        if (typeof Zg == "function" && Kg(e), Et && typeof Et.setStrictMode == "function")
          try {
            Et.setStrictMode(yl, e);
          } catch {
          }
      }
      function Z(e, t) {
        return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
      }
      function $(e) {
        if (Ks === void 0)
          try {
            throw Error();
          } catch (l) {
            var t = l.stack.trim().match(/\n( *(at )?)/);
            Ks = t && t[1] || "", sf = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Ks + e + sf;
      }
      function Q(e, t) {
        if (!e || Js) return "";
        Js = !0;
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
          var u = Object.getOwnPropertyDescriptor(
            o.DetermineComponentFrameRoot,
            "name"
          );
          u && u.configurable && Object.defineProperty(
            o.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var p = o.DetermineComponentFrameRoot(), y = p[0], A = p[1];
          if (y && A) {
            var L = y.split(`
`), F = A.split(`
`);
            for (u = o = 0; o < L.length && !L[o].includes("DetermineComponentFrameRoot"); )
              o++;
            for (; u < F.length && !F[u].includes(
              "DetermineComponentFrameRoot"
            ); )
              u++;
            if (o === L.length || u === F.length)
              for (o = L.length - 1, u = F.length - 1; 1 <= o && 0 <= u && L[o] !== F[u]; )
                u--;
            for (; 1 <= o && 0 <= u; o--, u--)
              if (L[o] !== F[u]) {
                if (o !== 1 || u !== 1)
                  do
                    if (o--, u--, 0 > u || L[o] !== F[u]) {
                      var ne = `
` + L[o].replace(" at new ", " at ");
                      return e.displayName && ne.includes("<anonymous>") && (ne = ne.replace("<anonymous>", e.displayName)), ne;
                    }
                  while (1 <= o && 0 <= u);
                break;
              }
          }
        } finally {
          Js = !1, Error.prepareStackTrace = l;
        }
        return (l = e ? e.displayName || e.name : "") ? $(l) : "";
      }
      function W(e, t) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            return $(e.type);
          case 16:
            return $("Lazy");
          case 13:
            return e.child !== t && t !== null ? $("Suspense Fallback") : $("Suspense");
          case 19:
            return $("SuspenseList");
          case 0:
          case 15:
            return Q(e.type, !1);
          case 11:
            return Q(e.type.render, !1);
          case 1:
            return Q(e.type, !0);
          case 31:
            return $("Activity");
          default:
            return "";
        }
      }
      function I(e) {
        try {
          var t = "", l = null;
          do
            t += W(e, l), l = e, e = e.return;
          while (e);
          return t;
        } catch (o) {
          return `
Error generating stack: ` + o.message + `
` + o.stack;
        }
      }
      function Y(e, t) {
        if (typeof e == "object" && e !== null) {
          var l = of.get(e);
          return l !== void 0 ? l : (t = {
            value: e,
            source: t,
            stack: I(t)
          }, of.set(e, t), t);
        }
        return {
          value: e,
          source: t,
          stack: I(t)
        };
      }
      function V(e, t) {
        Ba[Ha++] = xl, Ba[Ha++] = Cr, Cr = e, xl = t;
      }
      function T(e, t, l) {
        Rt[jt++] = $t, Rt[jt++] = It, Rt[jt++] = Mn, Mn = e;
        var o = $t;
        e = It;
        var u = 32 - St(o) - 1;
        o &= ~(1 << u), l += 1;
        var p = 32 - St(t) + u;
        if (30 < p) {
          var y = u - u % 5;
          p = (o & (1 << y) - 1).toString(32), o >>= y, u -= y, $t = 1 << 32 - St(t) + u | l << u | o, It = p + e;
        } else
          $t = 1 << p | l << u | o, It = e;
      }
      function J(e) {
        e.return !== null && (V(e, 1), T(e, 1, 0));
      }
      function ae(e) {
        for (; e === Cr; )
          Cr = Ba[--Ha], Ba[Ha] = null, xl = Ba[--Ha], Ba[Ha] = null;
        for (; e === Mn; )
          Mn = Rt[--jt], Rt[jt] = null, It = Rt[--jt], Rt[jt] = null, $t = Rt[--jt], Rt[jt] = null;
      }
      function oe(e, t) {
        Rt[jt++] = $t, Rt[jt++] = It, Rt[jt++] = Mn, $t = t.id, It = t.overflow, Mn = e;
      }
      function ce(e, t) {
        S(Rn, t), S(wl, e), S(rt, null), e = hh(t), E(rt), S(rt, e);
      }
      function ue() {
        E(rt), E(wl), E(Rn);
      }
      function Ee(e) {
        e.memoizedState !== null && S(Ar, e);
        var t = rt.current, l = gh(t, e.type);
        t !== l && (S(wl, e), S(rt, l));
      }
      function Ie(e) {
        wl.current === e && (E(rt), E(wl)), Ar.current === e && (E(Ar), dn ? ra._currentValue = Ra : ra._currentValue2 = Ra);
      }
      function he(e) {
        var t = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw tl(Y(t, e)), Ws;
      }
      function Wn(e, t) {
        if (!ft) throw Error(s(175));
        gg(
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
        if (We ? t !== 3 && t !== 27 && (t !== 5 || Kd(e.type) && !Sr(e.type, e.memoizedProps)) && De && he(e) : t !== 3 && (t !== 5 || Kd(e.type) && !Sr(e.type, e.memoizedProps)) && De && he(e), Fn(e), t === 13) {
          if (!ft) throw Error(s(316));
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          De = wg(e);
        } else if (t === 31) {
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          De = xg(e);
        } else
          De = We && t === 27 ? ig(
            e.type,
            De
          ) : it ? Zd(e.stateNode) : null;
        return !0;
      }
      function Gt() {
        ft && (De = it = null, Se = !1);
      }
      function wn() {
        var e = jn;
        return e !== null && (xt === null ? xt = e : xt.push.apply(
          xt,
          e
        ), jn = null), e;
      }
      function tl(e) {
        jn === null ? jn = [e] : jn.push(e);
      }
      function kn(e, t, l) {
        dn ? (S(Mr, t._currentValue), t._currentValue = l) : (S(Mr, t._currentValue2), t._currentValue2 = l);
      }
      function ln(e) {
        var t = Mr.current;
        dn ? e._currentValue = t : e._currentValue2 = t, E(Mr);
      }
      function Ai(e, t, l) {
        for (; e !== null; ) {
          var o = e.alternate;
          if ((e.childLanes & t) !== t ? (e.childLanes |= t, o !== null && (o.childLanes |= t)) : o !== null && (o.childLanes & t) !== t && (o.childLanes |= t), e === l) break;
          e = e.return;
        }
      }
      function Mi(e, t, l, o) {
        var u = e.child;
        for (u !== null && (u.return = e); u !== null; ) {
          var p = u.dependencies;
          if (p !== null) {
            var y = u.child;
            p = p.firstContext;
            e: for (; p !== null; ) {
              var A = p;
              p = u;
              for (var L = 0; L < t.length; L++)
                if (A.context === t[L]) {
                  p.lanes |= l, A = p.alternate, A !== null && (A.lanes |= l), Ai(
                    p.return,
                    l,
                    e
                  ), o || (y = null);
                  break e;
                }
              p = A.next;
            }
          } else if (u.tag === 18) {
            if (y = u.return, y === null) throw Error(s(341));
            y.lanes |= l, p = y.alternate, p !== null && (p.lanes |= l), Ai(y, l, e), y = null;
          } else y = u.child;
          if (y !== null) y.return = u;
          else
            for (y = u; y !== null; ) {
              if (y === e) {
                y = null;
                break;
              }
              if (u = y.sibling, u !== null) {
                u.return = y.return, y = u;
                break;
              }
              y = y.return;
            }
          u = y;
        }
      }
      function Sa(e, t, l, o) {
        e = null;
        for (var u = t, p = !1; u !== null; ) {
          if (!p) {
            if ((u.flags & 524288) !== 0) p = !0;
            else if ((u.flags & 262144) !== 0) break;
          }
          if (u.tag === 10) {
            var y = u.alternate;
            if (y === null) throw Error(s(387));
            if (y = y.memoizedProps, y !== null) {
              var A = u.type;
              zt(u.pendingProps.value, y.value) || (e !== null ? e.push(A) : e = [A]);
            }
          } else if (u === Ar.current) {
            if (y = u.alternate, y === null) throw Error(s(387));
            y.memoizedState.memoizedState !== u.memoizedState.memoizedState && (e !== null ? e.push(ra) : e = [ra]);
          }
          u = u.return;
        }
        e !== null && Mi(
          t,
          e,
          l,
          o
        ), t.flags |= 262144;
      }
      function Kl(e) {
        for (e = e.firstContext; e !== null; ) {
          var t = e.context;
          if (!zt(
            dn ? t._currentValue : t._currentValue2,
            e.memoizedValue
          ))
            return !0;
          e = e.next;
        }
        return !1;
      }
      function $n(e) {
        ia = e, pn = null, e = e.dependencies, e !== null && (e.firstContext = null);
      }
      function at(e) {
        return xc(ia, e);
      }
      function Jl(e, t) {
        return ia === null && $n(e), xc(e, t);
      }
      function xc(e, t) {
        var l = dn ? t._currentValue : t._currentValue2;
        if (t = { context: t, memoizedValue: l, next: null }, pn === null) {
          if (e === null) throw Error(s(308));
          pn = t, e.dependencies = { lanes: 0, firstContext: t }, e.flags |= 524288;
        } else pn = pn.next = t;
        return l;
      }
      function Ri() {
        return {
          controller: new Wg(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function nl(e) {
        e.refCount--, e.refCount === 0 && Fg($g, function() {
          e.controller.abort();
        });
      }
      function Wl() {
      }
      function Jt(e) {
        e !== Ua && e.next === null && (Ua === null ? Rr = Ua = e : Ua = Ua.next = e), jr = !0, Fs || (Fs = !0, Hm());
      }
      function Ea(e, t) {
        if (!$s && jr) {
          $s = !0;
          do
            for (var l = !1, o = Rr; o !== null; ) {
              if (e !== 0) {
                var u = o.pendingLanes;
                if (u === 0) var p = 0;
                else {
                  var y = o.suspendedLanes, A = o.pingedLanes;
                  p = (1 << 31 - St(42 | e) + 1) - 1, p &= u & ~(y & ~A), p = p & 201326741 ? p & 201326741 | 1 : p ? p | 2 : 0;
                }
                p !== 0 && (l = !0, Ec(o, p));
              } else
                p = _e, p = N(
                  o,
                  o === je ? p : 0,
                  o.cancelPendingCommit !== null || o.timeoutHandle !== la
                ), (p & 3) === 0 || B(o, p) || (l = !0, Ec(o, p));
              o = o.next;
            }
          while (l);
          $s = !1;
        }
      }
      function wc() {
        kc();
      }
      function kc() {
        jr = Fs = !1;
        var e = 0;
        sa !== 0 && Eh() && (e = sa);
        for (var t = vt(), l = null, o = Rr; o !== null; ) {
          var u = o.next, p = _c(o, t);
          p === 0 ? (o.next = null, l === null ? Rr = u : l.next = u, u === null && (Ua = l)) : (l = o, (e !== 0 || (p & 3) !== 0) && (jr = !0)), o = u;
        }
        Fe !== 0 && Fe !== 5 || Ea(e), sa !== 0 && (sa = 0);
      }
      function _c(e, t) {
        for (var l = e.suspendedLanes, o = e.pingedLanes, u = e.expirationTimes, p = e.pendingLanes & -62914561; 0 < p; ) {
          var y = 31 - St(p), A = 1 << y, L = u[y];
          L === -1 ? ((A & l) === 0 || (A & o) !== 0) && (u[y] = R(A, t)) : L <= t && (e.expiredLanes |= A), p &= ~A;
        }
        if (t = je, l = _e, l = N(
          e,
          e === t ? l : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== la
        ), o = e.callbackNode, l === 0 || e === t && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null)
          return o !== null && o !== null && Xs(o), e.callbackNode = null, e.callbackPriority = 0;
        if ((l & 3) === 0 || B(e, l)) {
          if (t = l & -l, t === e.callbackPriority) return t;
          switch (o !== null && Xs(o), M(l)) {
            case 2:
            case 8:
              l = Vg;
              break;
            case 32:
              l = Zs;
              break;
            case 268435456:
              l = Xg;
              break;
            default:
              l = Zs;
          }
          return o = Sc.bind(null, e), l = Tr(l, o), e.callbackPriority = t, e.callbackNode = l, t;
        }
        return o !== null && o !== null && Xs(o), e.callbackPriority = 2, e.callbackNode = null, 2;
      }
      function Sc(e, t) {
        if (Fe !== 0 && Fe !== 5)
          return e.callbackNode = null, e.callbackPriority = 0, null;
        var l = e.callbackNode;
        if (hl() && e.callbackNode !== l)
          return null;
        var o = _e;
        return o = N(
          e,
          e === je ? o : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== la
        ), o === 0 ? null : (sd(e, o, t), _c(e, vt()), e.callbackNode != null && e.callbackNode === l ? Sc.bind(null, e) : null);
      }
      function Ec(e, t) {
        if (hl()) return null;
        sd(e, t, !0);
      }
      function Hm() {
        Rh ? jh(function() {
          (we & 6) !== 0 ? Tr(
            lf,
            wc
          ) : kc();
        }) : Tr(
          lf,
          wc
        );
      }
      function ji() {
        if (sa === 0) {
          var e = qa;
          e === 0 && (e = Er, Er <<= 1, (Er & 261888) === 0 && (Er = 256)), sa = e;
        }
        return sa;
      }
      function Um(e, t) {
        if (kl === null) {
          var l = kl = [];
          Is = 0, qa = ji(), Ga = {
            status: "pending",
            value: void 0,
            then: function(o) {
              l.push(o);
            }
          };
        }
        return Is++, t.then(zc, zc), t;
      }
      function zc() {
        if (--Is === 0 && kl !== null) {
          Ga !== null && (Ga.status = "fulfilled");
          var e = kl;
          kl = null, qa = 0, Ga = null;
          for (var t = 0; t < e.length; t++) (0, e[t])();
        }
      }
      function qm(e, t) {
        var l = [], o = {
          status: "pending",
          value: null,
          reason: null,
          then: function(u) {
            l.push(u);
          }
        };
        return e.then(
          function() {
            o.status = "fulfilled", o.value = t;
            for (var u = 0; u < l.length; u++) (0, l[u])(t);
          },
          function(u) {
            for (o.status = "rejected", o.reason = u, u = 0; u < l.length; u++)
              (0, l[u])(void 0);
          }
        ), o;
      }
      function Oi() {
        var e = oa.current;
        return e !== null ? e : je.pooledCache;
      }
      function Fl(e, t) {
        t === null ? S(oa, oa.current) : S(oa, t.pool);
      }
      function Nc() {
        var e = Oi();
        return e === null ? null : {
          parent: dn ? Be._currentValue : Be._currentValue2,
          pool: e
        };
      }
      function $l(e, t) {
        if (zt(e, t)) return !0;
        if (typeof e != "object" || e === null || typeof t != "object" || t === null)
          return !1;
        var l = Object.keys(e), o = Object.keys(t);
        if (l.length !== o.length) return !1;
        for (o = 0; o < l.length; o++) {
          var u = l[o];
          if (!Jg.call(t, u) || !zt(e[u], t[u]))
            return !1;
        }
        return !0;
      }
      function Tc(e) {
        return e = e.status, e === "fulfilled" || e === "rejected";
      }
      function Cc(e, t, l) {
        switch (l = e[l], l === void 0 ? e.push(t) : l !== t && (t.then(Wl, Wl), t = l), t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, Mc(e), e;
          default:
            if (typeof t.status == "string") t.then(Wl, Wl);
            else {
              if (e = je, e !== null && 100 < e.shellSuspendCounter)
                throw Error(s(482));
              e = t, e.status = "pending", e.then(
                function(o) {
                  if (t.status === "pending") {
                    var u = t;
                    u.status = "fulfilled", u.value = o;
                  }
                },
                function(o) {
                  if (t.status === "pending") {
                    var u = t;
                    u.status = "rejected", u.reason = o;
                  }
                }
              );
            }
            switch (t.status) {
              case "fulfilled":
                return t.value;
              case "rejected":
                throw e = t.reason, Mc(e), e;
            }
            throw ca = t, La;
        }
      }
      function In(e) {
        try {
          var t = e._init;
          return t(e._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (ca = l, La) : l;
        }
      }
      function Ac() {
        if (ca === null) throw Error(s(459));
        var e = ca;
        return ca = null, e;
      }
      function Mc(e) {
        if (e === La || e === Or)
          throw Error(s(483));
      }
      function Il(e) {
        var t = _l;
        return _l += 1, Ya === null && (Ya = []), Cc(Ya, e, t);
      }
      function al(e, t) {
        t = t.props.ref, e.ref = t !== void 0 ? t : null;
      }
      function Pl(e, t) {
        throw t.$$typeof === uh ? Error(s(525)) : (e = Object.prototype.toString.call(t), Error(
          s(
            31,
            e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e
          )
        ));
      }
      function Rc(e) {
        function t(U, D) {
          if (e) {
            var G = U.deletions;
            G === null ? (U.deletions = [D], U.flags |= 16) : G.push(D);
          }
        }
        function l(U, D) {
          if (!e) return null;
          for (; D !== null; )
            t(U, D), D = D.sibling;
          return null;
        }
        function o(U) {
          for (var D = /* @__PURE__ */ new Map(); U !== null; )
            U.key !== null ? D.set(U.key, U) : D.set(U.index, U), U = U.sibling;
          return D;
        }
        function u(U, D) {
          return U = un(U, D), U.index = 0, U.sibling = null, U;
        }
        function p(U, D, G) {
          return U.index = G, e ? (G = U.alternate, G !== null ? (G = G.index, G < D ? (U.flags |= 67108866, D) : G) : (U.flags |= 67108866, D)) : (U.flags |= 1048576, D);
        }
        function y(U) {
          return e && U.alternate === null && (U.flags |= 67108866), U;
        }
        function A(U, D, G, ee) {
          return D === null || D.tag !== 6 ? (D = Cs(G, U.mode, ee), D.return = U, D) : (D = u(D, G), D.return = U, D);
        }
        function L(U, D, G, ee) {
          var fe = G.type;
          return fe === Ma ? ne(
            U,
            D,
            G.props.children,
            ee,
            G.key
          ) : D !== null && (D.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === An && In(fe) === D.type) ? (D = u(D, G.props), al(D, G), D.return = U, D) : (D = wr(
            G.type,
            G.key,
            G.props,
            null,
            U.mode,
            ee
          ), al(D, G), D.return = U, D);
        }
        function F(U, D, G, ee) {
          return D === null || D.tag !== 4 || D.stateNode.containerInfo !== G.containerInfo || D.stateNode.implementation !== G.implementation ? (D = As(G, U.mode, ee), D.return = U, D) : (D = u(D, G.children || []), D.return = U, D);
        }
        function ne(U, D, G, ee, fe) {
          return D === null || D.tag !== 7 ? (D = aa(
            G,
            U.mode,
            ee,
            fe
          ), D.return = U, D) : (D = u(D, G), D.return = U, D);
        }
        function P(U, D, G) {
          if (typeof D == "string" && D !== "" || typeof D == "number" || typeof D == "bigint")
            return D = Cs(
              "" + D,
              U.mode,
              G
            ), D.return = U, D;
          if (typeof D == "object" && D !== null) {
            switch (D.$$typeof) {
              case kr:
                return G = wr(
                  D.type,
                  D.key,
                  D.props,
                  null,
                  U.mode,
                  G
                ), al(G, D), G.return = U, G;
              case Aa:
                return D = As(
                  D,
                  U.mode,
                  G
                ), D.return = U, D;
              case An:
                return D = In(D), P(U, D, G);
            }
            if (_r(D) || x(D))
              return D = aa(
                D,
                U.mode,
                G,
                null
              ), D.return = U, D;
            if (typeof D.then == "function")
              return P(U, Il(D), G);
            if (D.$$typeof === Cn)
              return P(
                U,
                Jl(U, D),
                G
              );
            Pl(U, D);
          }
          return null;
        }
        function le(U, D, G, ee) {
          var fe = D !== null ? D.key : null;
          if (typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint")
            return fe !== null ? null : A(U, D, "" + G, ee);
          if (typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case kr:
                return G.key === fe ? L(U, D, G, ee) : null;
              case Aa:
                return G.key === fe ? F(U, D, G, ee) : null;
              case An:
                return G = In(G), le(U, D, G, ee);
            }
            if (_r(G) || x(G))
              return fe !== null ? null : ne(U, D, G, ee, null);
            if (typeof G.then == "function")
              return le(
                U,
                D,
                Il(G),
                ee
              );
            if (G.$$typeof === Cn)
              return le(
                U,
                D,
                Jl(U, G),
                ee
              );
            Pl(U, G);
          }
          return null;
        }
        function ge(U, D, G, ee, fe) {
          if (typeof ee == "string" && ee !== "" || typeof ee == "number" || typeof ee == "bigint")
            return U = U.get(G) || null, A(D, U, "" + ee, fe);
          if (typeof ee == "object" && ee !== null) {
            switch (ee.$$typeof) {
              case kr:
                return U = U.get(
                  ee.key === null ? G : ee.key
                ) || null, L(D, U, ee, fe);
              case Aa:
                return U = U.get(
                  ee.key === null ? G : ee.key
                ) || null, F(D, U, ee, fe);
              case An:
                return ee = In(ee), ge(
                  U,
                  D,
                  G,
                  ee,
                  fe
                );
            }
            if (_r(ee) || x(ee))
              return U = U.get(G) || null, ne(D, U, ee, fe, null);
            if (typeof ee.then == "function")
              return ge(
                U,
                D,
                G,
                Il(ee),
                fe
              );
            if (ee.$$typeof === Cn)
              return ge(
                U,
                D,
                G,
                Jl(D, ee),
                fe
              );
            Pl(D, ee);
          }
          return null;
        }
        function st(U, D, G, ee) {
          for (var fe = null, He = null, pe = D, Te = D = 0, tt = null; pe !== null && Te < G.length; Te++) {
            pe.index > Te ? (tt = pe, pe = null) : tt = pe.sibling;
            var Ce = le(
              U,
              pe,
              G[Te],
              ee
            );
            if (Ce === null) {
              pe === null && (pe = tt);
              break;
            }
            e && pe && Ce.alternate === null && t(U, pe), D = p(Ce, D, Te), He === null ? fe = Ce : He.sibling = Ce, He = Ce, pe = tt;
          }
          if (Te === G.length)
            return l(U, pe), Se && V(U, Te), fe;
          if (pe === null) {
            for (; Te < G.length; Te++)
              pe = P(U, G[Te], ee), pe !== null && (D = p(
                pe,
                D,
                Te
              ), He === null ? fe = pe : He.sibling = pe, He = pe);
            return Se && V(U, Te), fe;
          }
          for (pe = o(pe); Te < G.length; Te++)
            tt = ge(
              pe,
              U,
              Te,
              G[Te],
              ee
            ), tt !== null && (e && tt.alternate !== null && pe.delete(
              tt.key === null ? Te : tt.key
            ), D = p(
              tt,
              D,
              Te
            ), He === null ? fe = tt : He.sibling = tt, He = tt);
          return e && pe.forEach(function(qn) {
            return t(U, qn);
          }), Se && V(U, Te), fe;
        }
        function Al(U, D, G, ee) {
          if (G == null) throw Error(s(151));
          for (var fe = null, He = null, pe = D, Te = D = 0, tt = null, Ce = G.next(); pe !== null && !Ce.done; Te++, Ce = G.next()) {
            pe.index > Te ? (tt = pe, pe = null) : tt = pe.sibling;
            var qn = le(U, pe, Ce.value, ee);
            if (qn === null) {
              pe === null && (pe = tt);
              break;
            }
            e && pe && qn.alternate === null && t(U, pe), D = p(qn, D, Te), He === null ? fe = qn : He.sibling = qn, He = qn, pe = tt;
          }
          if (Ce.done)
            return l(U, pe), Se && V(U, Te), fe;
          if (pe === null) {
            for (; !Ce.done; Te++, Ce = G.next())
              Ce = P(U, Ce.value, ee), Ce !== null && (D = p(
                Ce,
                D,
                Te
              ), He === null ? fe = Ce : He.sibling = Ce, He = Ce);
            return Se && V(U, Te), fe;
          }
          for (pe = o(pe); !Ce.done; Te++, Ce = G.next())
            Ce = ge(
              pe,
              U,
              Te,
              Ce.value,
              ee
            ), Ce !== null && (e && Ce.alternate !== null && pe.delete(Ce.key === null ? Te : Ce.key), D = p(Ce, D, Te), He === null ? fe = Ce : He.sibling = Ce, He = Ce);
          return e && pe.forEach(function(t0) {
            return t(U, t0);
          }), Se && V(U, Te), fe;
        }
        function pa(U, D, G, ee) {
          if (typeof G == "object" && G !== null && G.type === Ma && G.key === null && (G = G.props.children), typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case kr:
                e: {
                  for (var fe = G.key; D !== null; ) {
                    if (D.key === fe) {
                      if (fe = G.type, fe === Ma) {
                        if (D.tag === 7) {
                          l(
                            U,
                            D.sibling
                          ), ee = u(
                            D,
                            G.props.children
                          ), ee.return = U, U = ee;
                          break e;
                        }
                      } else if (D.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === An && In(fe) === D.type) {
                        l(
                          U,
                          D.sibling
                        ), ee = u(D, G.props), al(ee, G), ee.return = U, U = ee;
                        break e;
                      }
                      l(U, D);
                      break;
                    } else t(U, D);
                    D = D.sibling;
                  }
                  G.type === Ma ? (ee = aa(
                    G.props.children,
                    U.mode,
                    ee,
                    G.key
                  ), ee.return = U, U = ee) : (ee = wr(
                    G.type,
                    G.key,
                    G.props,
                    null,
                    U.mode,
                    ee
                  ), al(ee, G), ee.return = U, U = ee);
                }
                return y(U);
              case Aa:
                e: {
                  for (fe = G.key; D !== null; ) {
                    if (D.key === fe)
                      if (D.tag === 4 && D.stateNode.containerInfo === G.containerInfo && D.stateNode.implementation === G.implementation) {
                        l(
                          U,
                          D.sibling
                        ), ee = u(
                          D,
                          G.children || []
                        ), ee.return = U, U = ee;
                        break e;
                      } else {
                        l(U, D);
                        break;
                      }
                    else t(U, D);
                    D = D.sibling;
                  }
                  ee = As(G, U.mode, ee), ee.return = U, U = ee;
                }
                return y(U);
              case An:
                return G = In(G), pa(
                  U,
                  D,
                  G,
                  ee
                );
            }
            if (_r(G))
              return st(
                U,
                D,
                G,
                ee
              );
            if (x(G)) {
              if (fe = x(G), typeof fe != "function")
                throw Error(s(150));
              return G = fe.call(G), Al(
                U,
                D,
                G,
                ee
              );
            }
            if (typeof G.then == "function")
              return pa(
                U,
                D,
                Il(G),
                ee
              );
            if (G.$$typeof === Cn)
              return pa(
                U,
                D,
                Jl(U, G),
                ee
              );
            Pl(U, G);
          }
          return typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint" ? (G = "" + G, D !== null && D.tag === 6 ? (l(U, D.sibling), ee = u(D, G), ee.return = U, U = ee) : (l(U, D), ee = Cs(G, U.mode, ee), ee.return = U, U = ee), y(U)) : l(U, D);
        }
        return function(U, D, G, ee) {
          try {
            _l = 0;
            var fe = pa(
              U,
              D,
              G,
              ee
            );
            return Ya = null, fe;
          } catch (pe) {
            if (pe === La || pe === Or) throw pe;
            var He = r(29, pe, null, U.mode);
            return He.lanes = ee, He.return = U, He;
          } finally {
          }
        };
      }
      function er() {
        for (var e = Qa, t = eo = Qa = 0; t < e; ) {
          var l = Dt[t];
          Dt[t++] = null;
          var o = Dt[t];
          Dt[t++] = null;
          var u = Dt[t];
          Dt[t++] = null;
          var p = Dt[t];
          if (Dt[t++] = null, o !== null && u !== null) {
            var y = o.pending;
            y === null ? u.next = u : (u.next = y.next, y.next = u), o.pending = u;
          }
          p !== 0 && jc(l, u, p);
        }
      }
      function tr(e, t, l, o) {
        Dt[Qa++] = e, Dt[Qa++] = t, Dt[Qa++] = l, Dt[Qa++] = o, eo |= o, e.lanes |= o, e = e.alternate, e !== null && (e.lanes |= o);
      }
      function Di(e, t, l, o) {
        return tr(e, t, l, o), nr(e);
      }
      function Pn(e, t) {
        return tr(e, null, null, t), nr(e);
      }
      function jc(e, t, l) {
        e.lanes |= l;
        var o = e.alternate;
        o !== null && (o.lanes |= l);
        for (var u = !1, p = e.return; p !== null; )
          p.childLanes |= l, o = p.alternate, o !== null && (o.childLanes |= l), p.tag === 22 && (e = p.stateNode, e === null || e._visibility & 1 || (u = !0)), e = p, p = p.return;
        return e.tag === 3 ? (p = e.stateNode, u && t !== null && (u = 31 - St(l), e = p.hiddenUpdates, o = e[u], o === null ? e[u] = [t] : o.push(t), t.lane = l | 536870912), p) : null;
      }
      function nr(e) {
        if (50 < Cl)
          throw Cl = 0, po = null, Error(s(185));
        for (var t = e.return; t !== null; )
          e = t, t = e.return;
        return e.tag === 3 ? e.stateNode : null;
      }
      function Bi(e) {
        e.updateQueue = {
          baseState: e.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Hi(e, t) {
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
          var u = o.pending;
          return u === null ? t.next = t : (t.next = u.next, u.next = t), o.pending = t, t = nr(e), jc(e, null, l), t;
        }
        return tr(e, o, t, l), nr(e);
      }
      function ll(e, t, l) {
        if (t = t.updateQueue, t !== null && (t = t.shared, (l & 4194048) !== 0)) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, k(e, l);
        }
      }
      function Ui(e, t) {
        var l = e.updateQueue, o = e.alternate;
        if (o !== null && (o = o.updateQueue, l === o)) {
          var u = null, p = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var y = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              p === null ? u = p = y : p = p.next = y, l = l.next;
            } while (l !== null);
            p === null ? u = p = t : p = p.next = t;
          } else u = p = t;
          l = {
            baseState: o.baseState,
            firstBaseUpdate: u,
            lastBaseUpdate: p,
            shared: o.shared,
            callbacks: o.callbacks
          }, e.updateQueue = l;
          return;
        }
        e = l.lastBaseUpdate, e === null ? l.firstBaseUpdate = t : e.next = t, l.lastBaseUpdate = t;
      }
      function rl() {
        if (to) {
          var e = Ga;
          if (e !== null) throw e;
        }
      }
      function il(e, t, l, o) {
        to = !1;
        var u = e.updateQueue;
        On = !1;
        var p = u.firstBaseUpdate, y = u.lastBaseUpdate, A = u.shared.pending;
        if (A !== null) {
          u.shared.pending = null;
          var L = A, F = L.next;
          L.next = null, y === null ? p = F : y.next = F, y = L;
          var ne = e.alternate;
          ne !== null && (ne = ne.updateQueue, A = ne.lastBaseUpdate, A !== y && (A === null ? ne.firstBaseUpdate = F : A.next = F, ne.lastBaseUpdate = L));
        }
        if (p !== null) {
          var P = u.baseState;
          y = 0, ne = F = L = null, A = p;
          do {
            var le = A.lane & -536870913, ge = le !== A.lane;
            if (ge ? (_e & le) === le : (o & le) === le) {
              le !== 0 && le === qa && (to = !0), ne !== null && (ne = ne.next = {
                lane: 0,
                tag: A.tag,
                payload: A.payload,
                callback: null,
                next: null
              });
              e: {
                var st = e, Al = A;
                le = t;
                var pa = l;
                switch (Al.tag) {
                  case 1:
                    if (st = Al.payload, typeof st == "function") {
                      P = st.call(
                        pa,
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
                    if (st = Al.payload, le = typeof st == "function" ? st.call(pa, P, le) : st, le == null) break e;
                    P = Rs({}, P, le);
                    break e;
                  case 2:
                    On = !0;
                }
              }
              le = A.callback, le !== null && (e.flags |= 64, ge && (e.flags |= 8192), ge = u.callbacks, ge === null ? u.callbacks = [le] : ge.push(le));
            } else
              ge = {
                lane: le,
                tag: A.tag,
                payload: A.payload,
                callback: A.callback,
                next: null
              }, ne === null ? (F = ne = ge, L = P) : ne = ne.next = ge, y |= le;
            if (A = A.next, A === null) {
              if (A = u.shared.pending, A === null)
                break;
              ge = A, A = ge.next, ge.next = null, u.lastBaseUpdate = ge, u.shared.pending = null;
            }
          } while (!0);
          ne === null && (L = P), u.baseState = L, u.firstBaseUpdate = F, u.lastBaseUpdate = ne, p === null && (u.shared.lanes = 0), Bn |= y, e.lanes = y, e.memoizedState = P;
        }
      }
      function Oc(e, t) {
        if (typeof e != "function")
          throw Error(s(191, e));
        e.call(t);
      }
      function Dc(e, t) {
        var l = e.callbacks;
        if (l !== null)
          for (e.callbacks = null, e = 0; e < l.length; e++)
            Oc(l[e], t);
      }
      function Bc(e, t) {
        e = gn, S(Br, e), S(Va, t), gn = e | t.baseLanes;
      }
      function qi() {
        S(Br, gn), S(Va, Va.current);
      }
      function Gi() {
        gn = Br.current, E(Va), E(Br);
      }
      function En(e) {
        var t = e.alternate;
        S(Qe, Qe.current & 1), S(Nt, e), Bt === null && (t === null || Va.current !== null || t.memoizedState !== null) && (Bt = e);
      }
      function Li(e) {
        S(Qe, Qe.current), S(Nt, e), Bt === null && (Bt = e);
      }
      function Hc(e) {
        e.tag === 22 ? (S(Qe, Qe.current), S(Nt, e), Bt === null && (Bt = e)) : zn();
      }
      function zn() {
        S(Qe, Qe.current), S(Nt, Nt.current);
      }
      function wt(e) {
        E(Nt), Bt === e && (Bt = null), E(Qe);
      }
      function ar(e) {
        for (var t = e; t !== null; ) {
          if (t.tag === 13) {
            var l = t.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || Ls(l) || Ys(l)))
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
      function Ue() {
        throw Error(s(321));
      }
      function Yi(e, t) {
        if (t === null) return !1;
        for (var l = 0; l < t.length && l < e.length; l++)
          if (!zt(e[l], t[l])) return !1;
        return !0;
      }
      function Qi(e, t, l, o, u, p) {
        return mn = p, be = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, de.H = e === null || e.memoizedState === null ? df : no, da = !1, p = l(o, u), da = !1, Xa && (p = qc(
          t,
          l,
          o,
          u
        )), Uc(e), p;
      }
      function Uc(e) {
        de.H = El;
        var t = Me !== null && Me.next !== null;
        if (mn = 0, Ve = Me = be = null, Hr = !1, Sl = 0, Za = null, t) throw Error(s(300));
        e === null || Xe || (e = e.dependencies, e !== null && Kl(e) && (Xe = !0));
      }
      function qc(e, t, l, o) {
        be = e;
        var u = 0;
        do {
          if (Xa && (Za = null), Sl = 0, Xa = !1, 25 <= u) throw Error(s(301));
          if (u += 1, Ve = Me = null, e.updateQueue != null) {
            var p = e.updateQueue;
            p.lastEffect = null, p.events = null, p.stores = null, p.memoCache != null && (p.memoCache.index = 0);
          }
          de.H = ff, p = t(l, o);
        } while (Xa);
        return p;
      }
      function Gm() {
        var e = de.H, t = e.useState()[0];
        return t = typeof t.then == "function" ? sl(t) : t, e = e.useState()[0], (Me !== null ? Me.memoizedState : null) !== e && (be.flags |= 1024), t;
      }
      function Vi() {
        var e = Ur !== 0;
        return Ur = 0, e;
      }
      function Xi(e, t, l) {
        t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l;
      }
      function Zi(e) {
        if (Hr) {
          for (e = e.memoizedState; e !== null; ) {
            var t = e.queue;
            t !== null && (t.pending = null), e = e.next;
          }
          Hr = !1;
        }
        mn = 0, Ve = Me = be = null, Xa = !1, Sl = Ur = 0, Za = null;
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
      function Ye() {
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
      function lr() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function sl(e) {
        var t = Sl;
        return Sl += 1, Za === null && (Za = []), e = Cc(Za, e, t), t = be, (Ve === null ? t.memoizedState : Ve.next) === null && (t = t.alternate, de.H = t === null || t.memoizedState === null ? df : no), e;
      }
      function rr(e) {
        if (e !== null && typeof e == "object") {
          if (typeof e.then == "function") return sl(e);
          if (e.$$typeof === Cn) return at(e);
        }
        throw Error(s(438, String(e)));
      }
      function Ki(e) {
        var t = null, l = be.updateQueue;
        if (l !== null && (t = l.memoCache), t == null) {
          var o = be.alternate;
          o !== null && (o = o.updateQueue, o !== null && (o = o.memoCache, o != null && (t = {
            data: o.data.map(function(u) {
              return u.slice();
            }),
            index: 0
          })));
        }
        if (t == null && (t = { data: [], index: 0 }), l === null && (l = lr(), be.updateQueue = l), l.memoCache = t, l = t.data[t.index], l === void 0)
          for (l = t.data[t.index] = Array(e), o = 0; o < e; o++)
            l[o] = dh;
        return t.index++, l;
      }
      function rn(e, t) {
        return typeof t == "function" ? t(e) : t;
      }
      function ir(e) {
        var t = Ye();
        return Ji(t, Me, e);
      }
      function Ji(e, t, l) {
        var o = e.queue;
        if (o === null) throw Error(s(311));
        o.lastRenderedReducer = l;
        var u = e.baseQueue, p = o.pending;
        if (p !== null) {
          if (u !== null) {
            var y = u.next;
            u.next = p.next, p.next = y;
          }
          t.baseQueue = u = p, o.pending = null;
        }
        if (p = e.baseState, u === null) e.memoizedState = p;
        else {
          t = u.next;
          var A = y = null, L = null, F = t, ne = !1;
          do {
            var P = F.lane & -536870913;
            if (P !== F.lane ? (_e & P) === P : (mn & P) === P) {
              var le = F.revertLane;
              if (le === 0)
                L !== null && (L = L.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: F.action,
                  hasEagerState: F.hasEagerState,
                  eagerState: F.eagerState,
                  next: null
                }), P === qa && (ne = !0);
              else if ((mn & le) === le) {
                F = F.next, le === qa && (ne = !0);
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
                }, L === null ? (A = L = P, y = p) : L = L.next = P, be.lanes |= le, Bn |= le;
              P = F.action, da && l(p, P), p = F.hasEagerState ? F.eagerState : l(p, P);
            } else
              le = {
                lane: P,
                revertLane: F.revertLane,
                gesture: F.gesture,
                action: F.action,
                hasEagerState: F.hasEagerState,
                eagerState: F.eagerState,
                next: null
              }, L === null ? (A = L = le, y = p) : L = L.next = le, be.lanes |= P, Bn |= P;
            F = F.next;
          } while (F !== null && F !== t);
          if (L === null ? y = p : L.next = A, !zt(p, e.memoizedState) && (Xe = !0, ne && (l = Ga, l !== null)))
            throw l;
          e.memoizedState = p, e.baseState = y, e.baseQueue = L, o.lastRenderedState = p;
        }
        return u === null && (o.lanes = 0), [e.memoizedState, o.dispatch];
      }
      function Wi(e) {
        var t = Ye(), l = t.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = e;
        var o = l.dispatch, u = l.pending, p = t.memoizedState;
        if (u !== null) {
          l.pending = null;
          var y = u = u.next;
          do
            p = e(p, y.action), y = y.next;
          while (y !== u);
          zt(p, t.memoizedState) || (Xe = !0), t.memoizedState = p, t.baseQueue === null && (t.baseState = p), l.lastRenderedState = p;
        }
        return [p, o];
      }
      function Gc(e, t, l) {
        var o = be, u = Ye(), p = Se;
        if (p) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = t();
        var y = !zt(
          (Me || u).memoizedState,
          l
        );
        if (y && (u.memoizedState = l, Xe = !0), u = u.queue, Ii(Qc.bind(null, o, u, e), [
          e
        ]), u.getSnapshot !== t || y || Ve !== null && Ve.memoizedState.tag & 1) {
          if (o.flags |= 2048, za(
            9,
            { destroy: void 0 },
            Yc.bind(
              null,
              o,
              u,
              l,
              t
            ),
            null
          ), je === null) throw Error(s(349));
          p || (mn & 127) !== 0 || Lc(o, t, l);
        }
        return l;
      }
      function Lc(e, t, l) {
        e.flags |= 16384, e = { getSnapshot: t, value: l }, t = be.updateQueue, t === null ? (t = lr(), be.updateQueue = t, t.stores = [e]) : (l = t.stores, l === null ? t.stores = [e] : l.push(e));
      }
      function Yc(e, t, l, o) {
        t.value = l, t.getSnapshot = o, Vc(t) && Xc(e);
      }
      function Qc(e, t, l) {
        return l(function() {
          Vc(t) && Xc(e);
        });
      }
      function Vc(e) {
        var t = e.getSnapshot;
        e = e.value;
        try {
          var l = t();
          return !zt(e, l);
        } catch {
          return !0;
        }
      }
      function Xc(e) {
        var t = Pn(e, 2);
        t !== null && bt(t, e, 2);
      }
      function Fi(e) {
        var t = ht();
        if (typeof e == "function") {
          var l = e;
          if (e = l(), da) {
            H(!0);
            try {
              l();
            } finally {
              H(!1);
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
      function Zc(e, t, l, o) {
        return e.baseState = l, Ji(
          e,
          Me,
          typeof o == "function" ? o : rn
        );
      }
      function Lm(e, t, l, o, u) {
        if (cr(e)) throw Error(s(485));
        if (e = t.action, e !== null) {
          var p = {
            payload: u,
            action: e,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(y) {
              p.listeners.push(y);
            }
          };
          de.T !== null ? l(!0) : p.isTransition = !1, o(p), l = t.pending, l === null ? (p.next = t.pending = p, Kc(t, p)) : (p.next = l.next, t.pending = l.next = p);
        }
      }
      function Kc(e, t) {
        var l = t.action, o = t.payload, u = e.state;
        if (t.isTransition) {
          var p = de.T, y = {};
          de.T = y;
          try {
            var A = l(u, o), L = de.S;
            L !== null && L(y, A), Jc(e, t, A);
          } catch (F) {
            $i(e, t, F);
          } finally {
            p !== null && y.types !== null && (p.types = y.types), de.T = p;
          }
        } else
          try {
            p = l(u, o), Jc(e, t, p);
          } catch (F) {
            $i(e, t, F);
          }
      }
      function Jc(e, t, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(o) {
            Wc(e, t, o);
          },
          function(o) {
            return $i(e, t, o);
          }
        ) : Wc(e, t, l);
      }
      function Wc(e, t, l) {
        t.status = "fulfilled", t.value = l, Fc(t), e.state = l, t = e.pending, t !== null && (l = t.next, l === t ? e.pending = null : (l = l.next, t.next = l, Kc(e, l)));
      }
      function $i(e, t, l) {
        var o = e.pending;
        if (e.pending = null, o !== null) {
          o = o.next;
          do
            t.status = "rejected", t.reason = l, Fc(t), t = t.next;
          while (t !== o);
        }
        e.action = null;
      }
      function Fc(e) {
        e = e.listeners;
        for (var t = 0; t < e.length; t++) (0, e[t])();
      }
      function $c(e, t) {
        return t;
      }
      function Ic(e, t) {
        if (Se) {
          var l = je.formState;
          if (l !== null) {
            e: {
              var o = be;
              if (Se) {
                if (De) {
                  var u = lg(
                    De,
                    Ot
                  );
                  if (u) {
                    De = Zd(u), o = rg(u);
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
          lastRenderedReducer: $c,
          lastRenderedState: t
        }, l.queue = o, l = gu.bind(
          null,
          be,
          o
        ), o.dispatch = l, o = Fi(!1);
        var p = ns.bind(
          null,
          be,
          !1,
          o.queue
        );
        return o = ht(), u = {
          state: t,
          dispatch: null,
          action: e,
          pending: null
        }, o.queue = u, l = Lm.bind(
          null,
          be,
          u,
          p,
          l
        ), u.dispatch = l, o.memoizedState = e, [t, l, !1];
      }
      function Pc(e) {
        var t = Ye();
        return eu(t, Me, e);
      }
      function eu(e, t, l) {
        if (t = Ji(
          e,
          t,
          $c
        )[0], e = ir(rn)[0], typeof t == "object" && t !== null && typeof t.then == "function")
          try {
            var o = sl(t);
          } catch (y) {
            throw y === La ? Or : y;
          }
        else o = t;
        t = Ye();
        var u = t.queue, p = u.dispatch;
        return l !== t.memoizedState && (be.flags |= 2048, za(
          9,
          { destroy: void 0 },
          Ym.bind(null, u, l),
          null
        )), [o, p, e];
      }
      function Ym(e, t) {
        e.action = t;
      }
      function tu(e) {
        var t = Ye(), l = Me;
        if (l !== null)
          return eu(t, l, e);
        Ye(), t = t.memoizedState, l = Ye();
        var o = l.queue.dispatch;
        return l.memoizedState = e, [t, o, !1];
      }
      function za(e, t, l, o) {
        return e = { tag: e, create: l, deps: o, inst: t, next: null }, t = be.updateQueue, t === null && (t = lr(), be.updateQueue = t), l = t.lastEffect, l === null ? t.lastEffect = e.next = e : (o = l.next, l.next = e, e.next = o, t.lastEffect = e), e;
      }
      function nu() {
        return Ye().memoizedState;
      }
      function sr(e, t, l, o) {
        var u = ht();
        be.flags |= e, u.memoizedState = za(
          1 | t,
          { destroy: void 0 },
          l,
          o === void 0 ? null : o
        );
      }
      function or(e, t, l, o) {
        var u = Ye();
        o = o === void 0 ? null : o;
        var p = u.memoizedState.inst;
        Me !== null && o !== null && Yi(o, Me.memoizedState.deps) ? u.memoizedState = za(t, p, l, o) : (be.flags |= e, u.memoizedState = za(
          1 | t,
          p,
          l,
          o
        ));
      }
      function au(e, t) {
        sr(8390656, 8, e, t);
      }
      function Ii(e, t) {
        or(2048, 8, e, t);
      }
      function Qm(e) {
        be.flags |= 4;
        var t = be.updateQueue;
        if (t === null)
          t = lr(), be.updateQueue = t, t.events = [e];
        else {
          var l = t.events;
          l === null ? t.events = [e] : l.push(e);
        }
      }
      function lu(e) {
        var t = Ye().memoizedState;
        return Qm({ ref: t, nextImpl: e }), function() {
          if ((we & 2) !== 0)
            throw Error(s(440));
          return t.impl.apply(void 0, arguments);
        };
      }
      function ru(e, t) {
        return or(4, 2, e, t);
      }
      function iu(e, t) {
        return or(4, 4, e, t);
      }
      function su(e, t) {
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
      function ou(e, t, l) {
        l = l != null ? l.concat([e]) : null, or(
          4,
          4,
          su.bind(null, t, e),
          l
        );
      }
      function Pi() {
      }
      function cu(e, t) {
        var l = Ye();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        return t !== null && Yi(t, o[1]) ? o[0] : (l.memoizedState = [e, t], e);
      }
      function uu(e, t) {
        var l = Ye();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        if (t !== null && Yi(t, o[1]))
          return o[0];
        if (o = e(), da) {
          H(!0);
          try {
            e();
          } finally {
            H(!1);
          }
        }
        return l.memoizedState = [o, t], o;
      }
      function es(e, t, l) {
        return l === void 0 || (mn & 1073741824) !== 0 && (_e & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = l, e = id(), be.lanes |= e, Bn |= e, l);
      }
      function du(e, t, l, o) {
        return zt(l, t) ? l : Va.current !== null ? (e = es(e, l, o), zt(e, t) || (Xe = !0), e) : (mn & 42) === 0 || (mn & 1073741824) !== 0 && (_e & 261930) === 0 ? (Xe = !0, e.memoizedState = l) : (e = id(), be.lanes |= e, Bn |= e, t);
      }
      function fu(e, t, l, o, u) {
        var p = fn();
        Pe(
          p !== 0 && 8 > p ? p : 8
        );
        var y = de.T, A = {};
        de.T = A, ns(e, !1, t, l);
        try {
          var L = u(), F = de.S;
          if (F !== null && F(A, L), L !== null && typeof L == "object" && typeof L.then == "function") {
            var ne = qm(
              L,
              o
            );
            ol(
              e,
              t,
              ne,
              kt(e)
            );
          } else
            ol(
              e,
              t,
              o,
              kt(e)
            );
        } catch (P) {
          ol(
            e,
            t,
            { then: function() {
            }, status: "rejected", reason: P },
            kt()
          );
        } finally {
          Pe(p), y !== null && A.types !== null && (y.types = A.types), de.T = y;
        }
      }
      function pu(e) {
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
      function ts() {
        return at(ra);
      }
      function mu() {
        return Ye().memoizedState;
      }
      function hu() {
        return Ye().memoizedState;
      }
      function Vm(e) {
        for (var t = e.return; t !== null; ) {
          switch (t.tag) {
            case 24:
            case 3:
              var l = kt();
              e = _n(l);
              var o = Sn(t, e, l);
              o !== null && (bt(o, t, l), ll(o, t, l)), t = { cache: Ri() }, e.payload = t;
              return;
          }
          t = t.return;
        }
      }
      function Xm(e, t, l) {
        var o = kt();
        l = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, cr(e) ? bu(t, l) : (l = Di(e, t, l, o), l !== null && (bt(l, e, o), vu(l, t, o)));
      }
      function gu(e, t, l) {
        var o = kt();
        ol(e, t, l, o);
      }
      function ol(e, t, l, o) {
        var u = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (cr(e)) bu(t, u);
        else {
          var p = e.alternate;
          if (e.lanes === 0 && (p === null || p.lanes === 0) && (p = t.lastRenderedReducer, p !== null))
            try {
              var y = t.lastRenderedState, A = p(y, l);
              if (u.hasEagerState = !0, u.eagerState = A, zt(A, y))
                return tr(e, t, u, 0), je === null && er(), !1;
            } catch {
            } finally {
            }
          if (l = Di(e, t, u, o), l !== null)
            return bt(l, e, o), vu(l, t, o), !0;
        }
        return !1;
      }
      function ns(e, t, l, o) {
        if (o = {
          lane: 2,
          revertLane: ji(),
          gesture: null,
          action: o,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, cr(e)) {
          if (t) throw Error(s(479));
        } else
          t = Di(
            e,
            l,
            o,
            2
          ), t !== null && bt(t, e, 2);
      }
      function cr(e) {
        var t = e.alternate;
        return e === be || t !== null && t === be;
      }
      function bu(e, t) {
        Xa = Hr = !0;
        var l = e.pending;
        l === null ? t.next = t : (t.next = l.next, l.next = t), e.pending = t;
      }
      function vu(e, t, l) {
        if ((l & 4194048) !== 0) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, k(e, l);
        }
      }
      function as(e, t, l, o) {
        t = e.memoizedState, l = l(o, t), l = l == null ? t : Rs({}, t, l), e.memoizedState = l, e.lanes === 0 && (e.updateQueue.baseState = l);
      }
      function yu(e, t, l, o, u, p, y) {
        return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(o, p, y) : t.prototype && t.prototype.isPureReactComponent ? !$l(l, o) || !$l(u, p) : !0;
      }
      function xu(e, t, l, o) {
        e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(l, o), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(l, o), t.state !== e && ao.enqueueReplaceState(t, t.state, null);
      }
      function ea(e, t) {
        var l = t;
        if ("ref" in t) {
          l = {};
          for (var o in t)
            o !== "ref" && (l[o] = t[o]);
        }
        if (e = e.defaultProps) {
          l === t && (l = Rs({}, l));
          for (var u in e)
            l[u] === void 0 && (l[u] = e[u]);
        }
        return l;
      }
      function ur(e, t) {
        try {
          var l = e.onUncaughtError;
          l(t.value, { componentStack: t.stack });
        } catch (o) {
          setTimeout(function() {
            throw o;
          });
        }
      }
      function wu(e, t, l) {
        try {
          var o = e.onCaughtError;
          o(l.value, {
            componentStack: l.stack,
            errorBoundary: t.tag === 1 ? t.stateNode : null
          });
        } catch (u) {
          setTimeout(function() {
            throw u;
          });
        }
      }
      function ls(e, t, l) {
        return l = _n(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          ur(e, t);
        }, l;
      }
      function ku(e) {
        return e = _n(e), e.tag = 3, e;
      }
      function _u(e, t, l, o) {
        var u = l.type.getDerivedStateFromError;
        if (typeof u == "function") {
          var p = o.value;
          e.payload = function() {
            return u(p);
          }, e.callback = function() {
            wu(t, l, o);
          };
        }
        var y = l.stateNode;
        y !== null && typeof y.componentDidCatch == "function" && (e.callback = function() {
          wu(t, l, o), typeof u != "function" && (Hn === null ? Hn = /* @__PURE__ */ new Set([this]) : Hn.add(this));
          var A = o.stack;
          this.componentDidCatch(o.value, {
            componentStack: A !== null ? A : ""
          });
        });
      }
      function Zm(e, t, l, o, u) {
        if (l.flags |= 32768, o !== null && typeof o == "object" && typeof o.then == "function") {
          if (t = l.alternate, t !== null && Sa(
            t,
            l,
            u,
            !0
          ), l = Nt.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return Bt === null ? yr() : l.alternate === null && qe === 0 && (qe = 3), l.flags &= -257, l.flags |= 65536, l.lanes = u, o === Dr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? l.updateQueue = /* @__PURE__ */ new Set([o]) : t.add(o), Ns(e, o, u)), !1;
              case 22:
                return l.flags |= 65536, o === Dr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? (t = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([o])
                }, l.updateQueue = t) : (l = t.retryQueue, l === null ? t.retryQueue = /* @__PURE__ */ new Set([o]) : l.add(o)), Ns(e, o, u)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return Ns(e, o, u), yr(), !1;
        }
        if (Se)
          return t = Nt.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = u, o !== Ws && (e = Error(s(422), { cause: o }), tl(
            Y(e, l)
          ))) : (o !== Ws && (t = Error(s(423), {
            cause: o
          }), tl(
            Y(t, l)
          )), e = e.current.alternate, e.flags |= 65536, u &= -u, e.lanes |= u, o = Y(o, l), u = ls(
            e.stateNode,
            o,
            u
          ), Ui(e, u), qe !== 4 && (qe = 2)), !1;
        var p = Error(s(520), { cause: o });
        if (p = Y(p, l), Nl === null ? Nl = [p] : Nl.push(p), qe !== 4 && (qe = 2), t === null) return !0;
        o = Y(o, l), l = t;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, e = u & -u, l.lanes |= e, e = ls(l.stateNode, o, e), Ui(l, e), !1;
            case 1:
              if (t = l.type, p = l.stateNode, (l.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || p !== null && typeof p.componentDidCatch == "function" && (Hn === null || !Hn.has(
                p
              ))))
                return l.flags |= 65536, u &= -u, l.lanes |= u, u = ku(u), _u(
                  u,
                  e,
                  l,
                  o
                ), Ui(l, u), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function lt(e, t, l, o) {
        t.child = e === null ? uf(t, null, l, o) : ua(
          t,
          e.child,
          l,
          o
        );
      }
      function Su(e, t, l, o, u) {
        l = l.render;
        var p = t.ref;
        if ("ref" in o) {
          var y = {};
          for (var A in o)
            A !== "ref" && (y[A] = o[A]);
        } else y = o;
        return $n(t), o = Qi(
          e,
          t,
          l,
          y,
          p,
          u
        ), A = Vi(), e !== null && !Xe ? (Xi(e, t, u), sn(e, t, u)) : (Se && A && J(t), t.flags |= 1, lt(e, t, o, u), t.child);
      }
      function Eu(e, t, l, o, u) {
        if (e === null) {
          var p = l.type;
          return typeof p == "function" && !Ts(p) && p.defaultProps === void 0 && l.compare === null ? (t.tag = 15, t.type = p, zu(
            e,
            t,
            p,
            o,
            u
          )) : (e = wr(
            l.type,
            null,
            o,
            t,
            t.mode,
            u
          ), e.ref = t.ref, e.return = t, t.child = e);
        }
        if (p = e.child, !ds(e, u)) {
          var y = p.memoizedProps;
          if (l = l.compare, l = l !== null ? l : $l, l(y, o) && e.ref === t.ref)
            return sn(
              e,
              t,
              u
            );
        }
        return t.flags |= 1, e = un(p, o), e.ref = t.ref, e.return = t, t.child = e;
      }
      function zu(e, t, l, o, u) {
        if (e !== null) {
          var p = e.memoizedProps;
          if ($l(p, o) && e.ref === t.ref)
            if (Xe = !1, t.pendingProps = o = p, ds(e, u))
              (e.flags & 131072) !== 0 && (Xe = !0);
            else
              return t.lanes = e.lanes, sn(e, t, u);
        }
        return rs(
          e,
          t,
          l,
          o,
          u
        );
      }
      function Nu(e, t, l, o) {
        var u = o.children, p = e !== null ? e.memoizedState : null;
        if (e === null && t.stateNode === null && (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), o.mode === "hidden") {
          if ((t.flags & 128) !== 0) {
            if (p = p !== null ? p.baseLanes | l : l, e !== null) {
              for (o = t.child = e.child, u = 0; o !== null; )
                u = u | o.lanes | o.childLanes, o = o.sibling;
              o = u & ~p;
            } else o = 0, t.child = null;
            return Tu(
              e,
              t,
              p,
              l,
              o
            );
          }
          if ((l & 536870912) !== 0)
            t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && Fl(
              t,
              p !== null ? p.cachePool : null
            ), p !== null ? Bc(t, p) : qi(), Hc(t);
          else
            return o = t.lanes = 536870912, Tu(
              e,
              t,
              p !== null ? p.baseLanes | l : l,
              l,
              o
            );
        } else
          p !== null ? (Fl(t, p.cachePool), Bc(t, p), zn(), t.memoizedState = null) : (e !== null && Fl(t, null), qi(), zn());
        return lt(e, t, u, l), t.child;
      }
      function cl(e, t) {
        return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), t.sibling;
      }
      function Tu(e, t, l, o, u) {
        var p = Oi();
        return p = p === null ? null : {
          parent: dn ? Be._currentValue : Be._currentValue2,
          pool: p
        }, t.memoizedState = {
          baseLanes: l,
          cachePool: p
        }, e !== null && Fl(t, null), qi(), Hc(t), e !== null && Sa(e, t, o, !0), t.childLanes = u, null;
      }
      function dr(e, t) {
        return t = pr(
          { mode: t.mode, children: t.children },
          e.mode
        ), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Cu(e, t, l) {
        return ua(t, e.child, null, l), e = dr(
          t,
          t.pendingProps
        ), e.flags |= 2, wt(t), t.memoizedState = null, e;
      }
      function Km(e, t, l) {
        var o = t.pendingProps, u = (t.flags & 128) !== 0;
        if (t.flags &= -129, e === null) {
          if (Se) {
            if (o.mode === "hidden")
              return e = dr(t, o), t.lanes = 536870912, cl(null, e);
            if (Li(t), (e = De) ? (e = mg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Mn !== null ? { id: $t, overflow: It } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = zd(e), l.return = t, t.child = l, it = t, De = null)) : e = null, e === null) throw he(t);
            return t.lanes = 536870912, null;
          }
          return dr(t, o);
        }
        var p = e.memoizedState;
        if (p !== null) {
          var y = p.dehydrated;
          if (Li(t), u)
            if (t.flags & 256)
              t.flags &= -257, t = Cu(
                e,
                t,
                l
              );
            else if (t.memoizedState !== null)
              t.child = e.child, t.flags |= 128, t = null;
            else throw Error(s(558));
          else if (Xe || Sa(
            e,
            t,
            l,
            !1
          ), u = (l & e.childLanes) !== 0, Xe || u) {
            if (o = je, o !== null && (y = C(o, l), y !== 0 && y !== p.retryLane))
              throw p.retryLane = y, Pn(e, y), bt(o, e, y), lo;
            yr(), t = Cu(
              e,
              t,
              l
            );
          } else
            e = p.treeContext, ft && (De = cg(y), it = t, Se = !0, jn = null, Ot = !1, e !== null && oe(t, e)), t = dr(t, o), t.flags |= 4096;
          return t;
        }
        return e = un(e.child, {
          mode: o.mode,
          children: o.children
        }), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function fr(e, t) {
        var l = t.ref;
        if (l === null)
          e !== null && e.ref !== null && (t.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (e === null || e.ref !== l) && (t.flags |= 4194816);
        }
      }
      function rs(e, t, l, o, u) {
        return $n(t), l = Qi(
          e,
          t,
          l,
          o,
          void 0,
          u
        ), o = Vi(), e !== null && !Xe ? (Xi(e, t, u), sn(e, t, u)) : (Se && o && J(t), t.flags |= 1, lt(e, t, l, u), t.child);
      }
      function Au(e, t, l, o, u, p) {
        return $n(t), t.updateQueue = null, l = qc(
          t,
          o,
          l,
          u
        ), Uc(e), o = Vi(), e !== null && !Xe ? (Xi(e, t, p), sn(e, t, p)) : (Se && o && J(t), t.flags |= 1, lt(e, t, l, p), t.child);
      }
      function Mu(e, t, l, o, u) {
        if ($n(t), t.stateNode === null) {
          var p = Da, y = l.contextType;
          typeof y == "object" && y !== null && (p = at(y)), p = new l(o, p), t.memoizedState = p.state !== null && p.state !== void 0 ? p.state : null, p.updater = ao, t.stateNode = p, p._reactInternals = t, p = t.stateNode, p.props = o, p.state = t.memoizedState, p.refs = {}, Bi(t), y = l.contextType, p.context = typeof y == "object" && y !== null ? at(y) : Da, p.state = t.memoizedState, y = l.getDerivedStateFromProps, typeof y == "function" && (as(
            t,
            l,
            y,
            o
          ), p.state = t.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof p.getSnapshotBeforeUpdate == "function" || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (y = p.state, typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount(), y !== p.state && ao.enqueueReplaceState(
            p,
            p.state,
            null
          ), il(t, o, p, u), rl(), p.state = t.memoizedState), typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !0;
        } else if (e === null) {
          p = t.stateNode;
          var A = t.memoizedProps, L = ea(l, A);
          p.props = L;
          var F = p.context, ne = l.contextType;
          y = Da, typeof ne == "object" && ne !== null && (y = at(ne));
          var P = l.getDerivedStateFromProps;
          ne = typeof P == "function" || typeof p.getSnapshotBeforeUpdate == "function", A = t.pendingProps !== A, ne || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (A || F !== y) && xu(
            t,
            p,
            o,
            y
          ), On = !1;
          var le = t.memoizedState;
          p.state = le, il(t, o, p, u), rl(), F = t.memoizedState, A || le !== F || On ? (typeof P == "function" && (as(
            t,
            l,
            P,
            o
          ), F = t.memoizedState), (L = On || yu(
            t,
            l,
            L,
            o,
            le,
            F,
            y
          )) ? (ne || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount()), typeof p.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = o, t.memoizedState = F), p.props = o, p.state = F, p.context = y, o = L) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !1);
        } else {
          p = t.stateNode, Hi(e, t), y = t.memoizedProps, ne = ea(l, y), p.props = ne, P = t.pendingProps, le = p.context, F = l.contextType, L = Da, typeof F == "object" && F !== null && (L = at(F)), A = l.getDerivedStateFromProps, (F = typeof A == "function" || typeof p.getSnapshotBeforeUpdate == "function") || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (y !== P || le !== L) && xu(
            t,
            p,
            o,
            L
          ), On = !1, le = t.memoizedState, p.state = le, il(t, o, p, u), rl();
          var ge = t.memoizedState;
          y !== P || le !== ge || On || e !== null && e.dependencies !== null && Kl(e.dependencies) ? (typeof A == "function" && (as(
            t,
            l,
            A,
            o
          ), ge = t.memoizedState), (ne = On || yu(
            t,
            l,
            ne,
            o,
            le,
            ge,
            L
          ) || e !== null && e.dependencies !== null && Kl(e.dependencies)) ? (F || typeof p.UNSAFE_componentWillUpdate != "function" && typeof p.componentWillUpdate != "function" || (typeof p.componentWillUpdate == "function" && p.componentWillUpdate(o, ge, L), typeof p.UNSAFE_componentWillUpdate == "function" && p.UNSAFE_componentWillUpdate(
            o,
            ge,
            L
          )), typeof p.componentDidUpdate == "function" && (t.flags |= 4), typeof p.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof p.componentDidUpdate != "function" || y === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || y === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), t.memoizedProps = o, t.memoizedState = ge), p.props = o, p.state = ge, p.context = L, o = ne) : (typeof p.componentDidUpdate != "function" || y === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || y === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), o = !1);
        }
        return p = o, fr(e, t), o = (t.flags & 128) !== 0, p || o ? (p = t.stateNode, l = o && typeof l.getDerivedStateFromError != "function" ? null : p.render(), t.flags |= 1, e !== null && o ? (t.child = ua(
          t,
          e.child,
          null,
          u
        ), t.child = ua(
          t,
          null,
          l,
          u
        )) : lt(e, t, l, u), t.memoizedState = p.state, e = t.child) : e = sn(
          e,
          t,
          u
        ), e;
      }
      function Ru(e, t, l, o) {
        return Gt(), t.flags |= 256, lt(e, t, l, o), t.child;
      }
      function is(e) {
        return { baseLanes: e, cachePool: Nc() };
      }
      function ss(e, t, l) {
        return e = e !== null ? e.childLanes & ~l : 0, t && (e |= Ct), e;
      }
      function ju(e, t, l) {
        var o = t.pendingProps, u = !1, p = (t.flags & 128) !== 0, y;
        if ((y = p) || (y = e !== null && e.memoizedState === null ? !1 : (Qe.current & 2) !== 0), y && (u = !0, t.flags &= -129), y = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
          if (Se) {
            if (u ? En(t) : zn(), (e = De) ? (e = hg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: Mn !== null ? { id: $t, overflow: It } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = zd(e), l.return = t, t.child = l, it = t, De = null)) : e = null, e === null) throw he(t);
            return Ys(e) ? t.lanes = 32 : t.lanes = 536870912, null;
          }
          var A = o.children;
          return o = o.fallback, u ? (zn(), u = t.mode, A = pr(
            { mode: "hidden", children: A },
            u
          ), o = aa(
            o,
            u,
            l,
            null
          ), A.return = t, o.return = t, A.sibling = o, t.child = A, o = t.child, o.memoizedState = is(l), o.childLanes = ss(
            e,
            y,
            l
          ), t.memoizedState = ro, cl(null, o)) : (En(t), os(t, A));
        }
        var L = e.memoizedState;
        if (L !== null && (A = L.dehydrated, A !== null)) {
          if (p)
            t.flags & 256 ? (En(t), t.flags &= -257, t = cs(
              e,
              t,
              l
            )) : t.memoizedState !== null ? (zn(), t.child = e.child, t.flags |= 128, t = null) : (zn(), A = o.fallback, u = t.mode, o = pr(
              { mode: "visible", children: o.children },
              u
            ), A = aa(
              A,
              u,
              l,
              null
            ), A.flags |= 2, o.return = t, A.return = t, o.sibling = A, t.child = o, ua(
              t,
              e.child,
              null,
              l
            ), o = t.child, o.memoizedState = is(l), o.childLanes = ss(
              e,
              y,
              l
            ), t.memoizedState = ro, t = cl(null, o));
          else if (En(t), Ys(A))
            y = ng(A).digest, o = Error(s(419)), o.stack = "", o.digest = y, tl({ value: o, source: null, stack: null }), t = cs(
              e,
              t,
              l
            );
          else if (Xe || Sa(
            e,
            t,
            l,
            !1
          ), y = (l & e.childLanes) !== 0, Xe || y) {
            if (y = je, y !== null && (o = C(
              y,
              l
            ), o !== 0 && o !== L.retryLane))
              throw L.retryLane = o, Pn(e, o), bt(y, e, o), lo;
            Ls(A) || yr(), t = cs(
              e,
              t,
              l
            );
          } else
            Ls(A) ? (t.flags |= 192, t.child = e.child, t = null) : (e = L.treeContext, ft && (De = ug(
              A
            ), it = t, Se = !0, jn = null, Ot = !1, e !== null && oe(t, e)), t = os(
              t,
              o.children
            ), t.flags |= 4096);
          return t;
        }
        return u ? (zn(), A = o.fallback, u = t.mode, L = e.child, p = L.sibling, o = un(L, {
          mode: "hidden",
          children: o.children
        }), o.subtreeFlags = L.subtreeFlags & 65011712, p !== null ? A = un(
          p,
          A
        ) : (A = aa(
          A,
          u,
          l,
          null
        ), A.flags |= 2), A.return = t, o.return = t, o.sibling = A, t.child = o, cl(null, o), o = t.child, A = e.child.memoizedState, A === null ? A = is(l) : (u = A.cachePool, u !== null ? (L = dn ? Be._currentValue : Be._currentValue2, u = u.parent !== L ? { parent: L, pool: L } : u) : u = Nc(), A = {
          baseLanes: A.baseLanes | l,
          cachePool: u
        }), o.memoizedState = A, o.childLanes = ss(
          e,
          y,
          l
        ), t.memoizedState = ro, cl(e.child, o)) : (En(t), l = e.child, e = l.sibling, l = un(l, {
          mode: "visible",
          children: o.children
        }), l.return = t, l.sibling = null, e !== null && (y = t.deletions, y === null ? (t.deletions = [e], t.flags |= 16) : y.push(e)), t.child = l, t.memoizedState = null, l);
      }
      function os(e, t) {
        return t = pr(
          { mode: "visible", children: t },
          e.mode
        ), t.return = e, e.child = t;
      }
      function pr(e, t) {
        return e = r(22, e, null, t), e.lanes = 0, e;
      }
      function cs(e, t, l) {
        return ua(t, e.child, null, l), e = os(
          t,
          t.pendingProps.children
        ), e.flags |= 2, t.memoizedState = null, e;
      }
      function Ou(e, t, l) {
        e.lanes |= t;
        var o = e.alternate;
        o !== null && (o.lanes |= t), Ai(e.return, t, l);
      }
      function us(e, t, l, o, u, p) {
        var y = e.memoizedState;
        y === null ? e.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: o,
          tail: l,
          tailMode: u,
          treeForkCount: p
        } : (y.isBackwards = t, y.rendering = null, y.renderingStartTime = 0, y.last = o, y.tail = l, y.tailMode = u, y.treeForkCount = p);
      }
      function Du(e, t, l) {
        var o = t.pendingProps, u = o.revealOrder, p = o.tail;
        o = o.children;
        var y = Qe.current, A = (y & 2) !== 0;
        if (A ? (y = y & 1 | 2, t.flags |= 128) : y &= 1, S(Qe, y), lt(e, t, o, l), o = Se ? xl : 0, !A && e !== null && (e.flags & 128) !== 0)
          e: for (e = t.child; e !== null; ) {
            if (e.tag === 13)
              e.memoizedState !== null && Ou(e, l, t);
            else if (e.tag === 19)
              Ou(e, l, t);
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
        switch (u) {
          case "forwards":
            for (l = t.child, u = null; l !== null; )
              e = l.alternate, e !== null && ar(e) === null && (u = l), l = l.sibling;
            l = u, l === null ? (u = t.child, t.child = null) : (u = l.sibling, l.sibling = null), us(
              t,
              !1,
              u,
              l,
              p,
              o
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (l = null, u = t.child, t.child = null; u !== null; ) {
              if (e = u.alternate, e !== null && ar(e) === null) {
                t.child = u;
                break;
              }
              e = u.sibling, u.sibling = l, l = u, u = e;
            }
            us(
              t,
              !0,
              l,
              null,
              p,
              o
            );
            break;
          case "together":
            us(
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
      function ds(e, t) {
        return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Kl(e)));
      }
      function Jm(e, t, l) {
        switch (t.tag) {
          case 3:
            ce(
              t,
              t.stateNode.containerInfo
            ), kn(t, Be, e.memoizedState.cache), Gt();
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
              return t.flags |= 128, Li(t), null;
            break;
          case 13:
            var o = t.memoizedState;
            if (o !== null)
              return o.dehydrated !== null ? (En(t), t.flags |= 128, null) : (l & t.child.childLanes) !== 0 ? ju(
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
            var u = (e.flags & 128) !== 0;
            if (o = (l & t.childLanes) !== 0, o || (Sa(
              e,
              t,
              l,
              !1
            ), o = (l & t.childLanes) !== 0), u) {
              if (o)
                return Du(
                  e,
                  t,
                  l
                );
              t.flags |= 128;
            }
            if (u = t.memoizedState, u !== null && (u.rendering = null, u.tail = null, u.lastEffect = null), S(Qe, Qe.current), o) break;
            return null;
          case 22:
            return t.lanes = 0, Nu(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            kn(t, Be, e.memoizedState.cache);
        }
        return sn(e, t, l);
      }
      function Bu(e, t, l) {
        if (e !== null)
          if (e.memoizedProps !== t.pendingProps)
            Xe = !0;
          else {
            if (!ds(e, l) && (t.flags & 128) === 0)
              return Xe = !1, Jm(
                e,
                t,
                l
              );
            Xe = (e.flags & 131072) !== 0;
          }
        else
          Xe = !1, Se && (t.flags & 1048576) !== 0 && T(t, xl, t.index);
        switch (t.lanes = 0, t.tag) {
          case 16:
            e: {
              var o = t.pendingProps;
              if (e = In(t.elementType), t.type = e, typeof e == "function")
                Ts(e) ? (o = ea(e, o), t.tag = 1, t = Mu(
                  null,
                  t,
                  e,
                  o,
                  l
                )) : (t.tag = 0, t = rs(
                  null,
                  t,
                  e,
                  o,
                  l
                ));
              else {
                if (e != null) {
                  var u = e.$$typeof;
                  if (u === Os) {
                    t.tag = 11, t = Su(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  } else if (u === Hs) {
                    t.tag = 14, t = Eu(
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
            return rs(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 1:
            return o = t.type, u = ea(
              o,
              t.pendingProps
            ), Mu(
              e,
              t,
              o,
              u,
              l
            );
          case 3:
            e: {
              if (ce(
                t,
                t.stateNode.containerInfo
              ), e === null) throw Error(s(387));
              var p = t.pendingProps;
              u = t.memoizedState, o = u.element, Hi(e, t), il(t, p, null, l);
              var y = t.memoizedState;
              if (p = y.cache, kn(t, Be, p), p !== u.cache && Mi(
                t,
                [Be],
                l,
                !0
              ), rl(), p = y.element, ft && u.isDehydrated)
                if (u = {
                  element: p,
                  isDehydrated: !1,
                  cache: y.cache
                }, t.updateQueue.baseState = u, t.memoizedState = u, t.flags & 256) {
                  t = Ru(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else if (p !== o) {
                  o = Y(
                    Error(s(424)),
                    t
                  ), tl(o), t = Ru(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else
                  for (ft && (De = og(
                    t.stateNode.containerInfo
                  ), it = t, Se = !0, jn = null, Ot = !0), l = uf(
                    t,
                    null,
                    p,
                    l
                  ), t.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (Gt(), p === o) {
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
              return fr(e, t), e === null ? (l = Wd(
                t.type,
                null,
                t.pendingProps,
                null
              )) ? t.memoizedState = l : Se || (t.stateNode = Dg(
                t.type,
                t.pendingProps,
                Rn.current,
                t
              )) : t.memoizedState = Wd(
                t.type,
                e.memoizedProps,
                t.pendingProps,
                e.memoizedState
              ), null;
          case 27:
            if (We)
              return Ee(t), e === null && We && Se && (o = t.stateNode = tf(
                t.type,
                t.pendingProps,
                Rn.current,
                rt.current,
                !1
              ), it = t, Ot = !0, De = dg(
                t.type,
                o,
                De
              )), lt(
                e,
                t,
                t.pendingProps.children,
                l
              ), fr(e, t), e === null && (t.flags |= 4194304), t.child;
          case 5:
            return e === null && Se && (Rg(
              t.type,
              t.pendingProps,
              rt.current
            ), (u = o = De) && (o = fg(
              o,
              t.type,
              t.pendingProps,
              Ot
            ), o !== null ? (t.stateNode = o, it = t, De = sg(o), Ot = !1, u = !0) : u = !1), u || he(t)), Ee(t), u = t.type, p = t.pendingProps, y = e !== null ? e.memoizedProps : null, o = p.children, Sr(u, p) ? o = null : y !== null && Sr(u, y) && (t.flags |= 32), t.memoizedState !== null && (u = Qi(
              e,
              t,
              Gm,
              null,
              null,
              l
            ), dn ? ra._currentValue = u : ra._currentValue2 = u), fr(e, t), lt(e, t, o, l), t.child;
          case 6:
            return e === null && Se && (jg(
              t.pendingProps,
              rt.current
            ), (e = l = De) && (l = pg(
              l,
              t.pendingProps,
              Ot
            ), l !== null ? (t.stateNode = l, it = t, De = null, e = !0) : e = !1), e || he(t)), null;
          case 13:
            return ju(e, t, l);
          case 4:
            return ce(
              t,
              t.stateNode.containerInfo
            ), o = t.pendingProps, e === null ? t.child = ua(
              t,
              null,
              o,
              l
            ) : lt(e, t, o, l), t.child;
          case 11:
            return Su(
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
            return u = t.type._context, o = t.pendingProps.children, $n(t), u = at(u), o = o(u), t.flags |= 1, lt(e, t, o, l), t.child;
          case 14:
            return Eu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 15:
            return zu(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 19:
            return Du(
              e,
              t,
              l
            );
          case 31:
            return Km(e, t, l);
          case 22:
            return Nu(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            return $n(t), o = at(Be), e === null ? (u = Oi(), u === null && (u = je, p = Ri(), u.pooledCache = p, p.refCount++, p !== null && (u.pooledCacheLanes |= l), u = p), t.memoizedState = {
              parent: o,
              cache: u
            }, Bi(t), kn(t, Be, u)) : ((e.lanes & l) !== 0 && (Hi(e, t), il(t, null, null, l), rl()), u = e.memoizedState, p = t.memoizedState, u.parent !== o ? (u = { parent: o, cache: o }, t.memoizedState = u, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = u), kn(t, Be, o)) : (o = p.cache, kn(t, Be, o), o !== u.cache && Mi(
              t,
              [Be],
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
      function Lt(e) {
        e.flags |= 4;
      }
      function mr(e) {
        Ft && (e.flags |= 8);
      }
      function Hu(e, t) {
        if (e !== null && e.child === t.child) return !1;
        if ((t.flags & 16) !== 0) return !0;
        for (e = t.child; e !== null; ) {
          if ((e.flags & 8218) !== 0 || (e.subtreeFlags & 8218) !== 0)
            return !0;
          e = e.sibling;
        }
        return !1;
      }
      function fs(e, t, l, o) {
        if (dt)
          for (l = t.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              qs(e, l.stateNode);
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
          for (var u = t.child; u !== null; ) {
            if (u.tag === 5) {
              var p = u.stateNode;
              l && o && (p = Vd(
                p,
                u.type,
                u.memoizedProps
              )), qs(e, p);
            } else if (u.tag === 6)
              p = u.stateNode, l && o && (p = Xd(
                p,
                u.memoizedProps
              )), qs(e, p);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                p = u.child, p !== null && (p.return = u), fs(e, u, !0, !0);
              else if (u.child !== null) {
                u.child.return = u, u = u.child;
                continue;
              }
            }
            if (u === t) break;
            for (; u.sibling === null; ) {
              if (u.return === null || u.return === t)
                return;
              u = u.return;
            }
            u.sibling.return = u.return, u = u.sibling;
          }
      }
      function Uu(e, t, l, o) {
        var u = !1;
        if (Ft)
          for (var p = t.child; p !== null; ) {
            if (p.tag === 5) {
              var y = p.stateNode;
              l && o && (y = Vd(
                y,
                p.type,
                p.memoizedProps
              )), Yd(e, y);
            } else if (p.tag === 6)
              y = p.stateNode, l && o && (y = Xd(
                y,
                p.memoizedProps
              )), Yd(e, y);
            else if (p.tag !== 4) {
              if (p.tag === 22 && p.memoizedState !== null)
                u = p.child, u !== null && (u.return = p), Uu(e, p, !0, !0), u = !0;
              else if (p.child !== null) {
                p.child.return = p, p = p.child;
                continue;
              }
            }
            if (p === t) break;
            for (; p.sibling === null; ) {
              if (p.return === null || p.return === t)
                return u;
              p = p.return;
            }
            p.sibling.return = p.return, p = p.sibling;
          }
        return u;
      }
      function qu(e, t) {
        if (Ft && Hu(e, t)) {
          e = t.stateNode;
          var l = e.containerInfo, o = Ld();
          Uu(o, t, !1, !1), e.pendingChildren = o, Lt(t), tg(l, o);
        }
      }
      function ps(e, t, l, o) {
        if (dt)
          e.memoizedProps !== o && Lt(t);
        else if (Ft) {
          var u = e.stateNode, p = e.memoizedProps;
          if ((e = Hu(e, t)) || p !== o) {
            var y = rt.current;
            p = eg(
              u,
              l,
              p,
              o,
              !e,
              null
            ), p === u ? t.stateNode = u : (mr(t), Bd(
              p,
              l,
              o,
              y
            ) && Lt(t), t.stateNode = p, e && fs(p, t, !1, !1));
          } else t.stateNode = u;
        }
      }
      function ms(e, t, l, o, u) {
        if ((e.mode & 32) !== 0 && (l === null ? Nh(t, o) : Th(t, l, o))) {
          if (e.flags |= 16777216, (u & 335544128) === u || Gs(t, o))
            if (Ud(e.stateNode, t, o))
              e.flags |= 8192;
            else if (dd()) e.flags |= 8192;
            else
              throw ca = Dr, Ps;
        } else e.flags &= -16777217;
      }
      function Gu(e, t) {
        if (Hg(t)) {
          if (e.flags |= 16777216, !ef(t))
            if (dd()) e.flags |= 8192;
            else
              throw ca = Dr, Ps;
        } else e.flags &= -16777217;
      }
      function hr(e, t) {
        t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? X() : 536870912, e.lanes |= t, Wa |= t);
      }
      function ul(e, t) {
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
      function Oe(e) {
        var t = e.alternate !== null && e.alternate.child === e.child, l = 0, o = 0;
        if (t)
          for (var u = e.child; u !== null; )
            l |= u.lanes | u.childLanes, o |= u.subtreeFlags & 65011712, o |= u.flags & 65011712, u.return = e, u = u.sibling;
        else
          for (u = e.child; u !== null; )
            l |= u.lanes | u.childLanes, o |= u.subtreeFlags, o |= u.flags, u.return = e, u = u.sibling;
        return e.subtreeFlags |= o, e.childLanes = l, t;
      }
      function Wm(e, t, l) {
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
            return Oe(t), null;
          case 1:
            return Oe(t), null;
          case 3:
            return l = t.stateNode, o = null, e !== null && (o = e.memoizedState.cache), t.memoizedState.cache !== o && (t.flags |= 2048), ln(Be), ue(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (e === null || e.child === null) && (qt(t) ? Lt(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, wn())), qu(e, t), Oe(t), null;
          case 26:
            if (Vt) {
              var u = t.type, p = t.memoizedState;
              return e === null ? (Lt(t), p !== null ? (Oe(t), Gu(
                t,
                p
              )) : (Oe(t), ms(
                t,
                u,
                null,
                o,
                l
              ))) : p ? p !== e.memoizedState ? (Lt(t), Oe(t), Gu(
                t,
                p
              )) : (Oe(t), t.flags &= -16777217) : (p = e.memoizedProps, dt ? p !== o && Lt(t) : ps(
                e,
                t,
                u,
                o
              ), Oe(t), ms(
                t,
                u,
                p,
                o,
                l
              )), null;
            }
          case 27:
            if (We) {
              if (Ie(t), l = Rn.current, u = t.type, e !== null && t.stateNode != null)
                dt ? e.memoizedProps !== o && Lt(t) : ps(e, t, u, o);
              else {
                if (!o) {
                  if (t.stateNode === null)
                    throw Error(s(166));
                  return Oe(t), null;
                }
                e = rt.current, qt(t) ? Wn(t, e) : (e = tf(
                  u,
                  o,
                  l,
                  e,
                  !0
                ), t.stateNode = e, Lt(t));
              }
              return Oe(t), null;
            }
          case 5:
            if (Ie(t), u = t.type, e !== null && t.stateNode != null)
              ps(e, t, u, o);
            else {
              if (!o) {
                if (t.stateNode === null)
                  throw Error(s(166));
                return Oe(t), null;
              }
              if (p = rt.current, qt(t))
                Wn(t, p), zg(
                  t.stateNode,
                  u,
                  o,
                  p
                ) && (t.flags |= 64);
              else {
                var y = yh(
                  u,
                  o,
                  Rn.current,
                  p,
                  t
                );
                mr(t), fs(y, t, !1, !1), t.stateNode = y, Bd(
                  y,
                  u,
                  o,
                  p
                ) && Lt(t);
              }
            }
            return Oe(t), ms(
              t,
              t.type,
              e === null ? null : e.memoizedProps,
              t.pendingProps,
              l
            ), null;
          case 6:
            if (e && t.stateNode != null)
              l = e.memoizedProps, dt ? l !== o && Lt(t) : Ft && (l !== o ? (e = Rn.current, l = rt.current, mr(t), t.stateNode = Hd(
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
                if (e = t.stateNode, l = t.memoizedProps, o = null, u = it, u !== null)
                  switch (u.tag) {
                    case 27:
                    case 5:
                      o = u.memoizedProps;
                  }
                bg(
                  e,
                  l,
                  t,
                  o
                ) || he(t, !0);
              } else
                mr(t), t.stateNode = Hd(
                  o,
                  e,
                  l,
                  t
                );
            }
            return Oe(t), null;
          case 31:
            if (l = t.memoizedState, e === null || e.memoizedState !== null) {
              if (o = qt(t), l !== null) {
                if (e === null) {
                  if (!o) throw Error(s(318));
                  if (!ft) throw Error(s(556));
                  if (e = t.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(557));
                  vg(e, t);
                } else
                  Gt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                Oe(t), e = !1;
              } else
                l = wn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = l), e = !0;
              if (!e)
                return t.flags & 256 ? (wt(t), t) : (wt(t), null);
              if ((t.flags & 128) !== 0)
                throw Error(s(558));
            }
            return Oe(t), null;
          case 13:
            if (o = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
              if (u = qt(t), o !== null && o.dehydrated !== null) {
                if (e === null) {
                  if (!u) throw Error(s(318));
                  if (!ft) throw Error(s(344));
                  if (u = t.memoizedState, u = u !== null ? u.dehydrated : null, !u) throw Error(s(317));
                  yg(u, t);
                } else
                  Gt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                Oe(t), u = !1;
              } else
                u = wn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = u), u = !0;
              if (!u)
                return t.flags & 256 ? (wt(t), t) : (wt(t), null);
            }
            return wt(t), (t.flags & 128) !== 0 ? (t.lanes = l, t) : (l = o !== null, e = e !== null && e.memoizedState !== null, l && (o = t.child, u = null, o.alternate !== null && o.alternate.memoizedState !== null && o.alternate.memoizedState.cachePool !== null && (u = o.alternate.memoizedState.cachePool.pool), p = null, o.memoizedState !== null && o.memoizedState.cachePool !== null && (p = o.memoizedState.cachePool.pool), p !== u && (o.flags |= 2048)), l !== e && l && (t.child.flags |= 8192), hr(t, t.updateQueue), Oe(t), null);
          case 4:
            return ue(), qu(e, t), e === null && _h(t.stateNode.containerInfo), Oe(t), null;
          case 10:
            return ln(t.type), Oe(t), null;
          case 19:
            if (E(Qe), o = t.memoizedState, o === null) return Oe(t), null;
            if (u = (t.flags & 128) !== 0, p = o.rendering, p === null)
              if (u) ul(o, !1);
              else {
                if (qe !== 0 || e !== null && (e.flags & 128) !== 0)
                  for (e = t.child; e !== null; ) {
                    if (p = ar(e), p !== null) {
                      for (t.flags |= 128, ul(o, !1), e = p.updateQueue, t.updateQueue = e, hr(t, e), t.subtreeFlags = 0, e = l, l = t.child; l !== null; )
                        Ed(l, e), l = l.sibling;
                      return S(
                        Qe,
                        Qe.current & 1 | 2
                      ), Se && V(t, o.treeForkCount), t.child;
                    }
                    e = e.sibling;
                  }
                o.tail !== null && vt() > Tl && (t.flags |= 128, u = !0, ul(o, !1), t.lanes = 4194304);
              }
            else {
              if (!u)
                if (e = ar(p), e !== null) {
                  if (t.flags |= 128, u = !0, e = e.updateQueue, t.updateQueue = e, hr(t, e), ul(o, !0), o.tail === null && o.tailMode === "hidden" && !p.alternate && !Se)
                    return Oe(t), null;
                } else
                  2 * vt() - o.renderingStartTime > Tl && l !== 536870912 && (t.flags |= 128, u = !0, ul(o, !1), t.lanes = 4194304);
              o.isBackwards ? (p.sibling = t.child, t.child = p) : (e = o.last, e !== null ? e.sibling = p : t.child = p, o.last = p);
            }
            return o.tail !== null ? (e = o.tail, o.rendering = e, o.tail = e.sibling, o.renderingStartTime = vt(), e.sibling = null, l = Qe.current, S(
              Qe,
              u ? l & 1 | 2 : l & 1
            ), Se && V(t, o.treeForkCount), e) : (Oe(t), null);
          case 22:
          case 23:
            return wt(t), Gi(), o = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== o && (t.flags |= 8192) : o && (t.flags |= 8192), o ? (l & 536870912) !== 0 && (t.flags & 128) === 0 && (Oe(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Oe(t), l = t.updateQueue, l !== null && hr(t, l.retryQueue), l = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), o = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (o = t.memoizedState.cachePool.pool), o !== l && (t.flags |= 2048), e !== null && E(oa), null;
          case 24:
            return l = null, e !== null && (l = e.memoizedState.cache), t.memoizedState.cache !== l && (t.flags |= 2048), ln(Be), Oe(t), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, t.tag));
      }
      function Fm(e, t) {
        switch (ae(t), t.tag) {
          case 1:
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 3:
            return ln(Be), ue(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
          case 26:
          case 27:
          case 5:
            return Ie(t), null;
          case 31:
            if (t.memoizedState !== null) {
              if (wt(t), t.alternate === null)
                throw Error(s(340));
              Gt();
            }
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 13:
            if (wt(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
              if (t.alternate === null)
                throw Error(s(340));
              Gt();
            }
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 19:
            return E(Qe), null;
          case 4:
            return ue(), null;
          case 10:
            return ln(t.type), null;
          case 22:
          case 23:
            return wt(t), Gi(), e !== null && E(oa), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 24:
            return ln(Be), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function Lu(e, t) {
        switch (ae(t), t.tag) {
          case 3:
            ln(Be), ue();
            break;
          case 26:
          case 27:
          case 5:
            Ie(t);
            break;
          case 4:
            ue();
            break;
          case 31:
            t.memoizedState !== null && wt(t);
            break;
          case 13:
            wt(t);
            break;
          case 19:
            E(Qe);
            break;
          case 10:
            ln(t.type);
            break;
          case 22:
          case 23:
            wt(t), Gi(), e !== null && E(oa);
            break;
          case 24:
            ln(Be);
        }
      }
      function dl(e, t) {
        try {
          var l = t.updateQueue, o = l !== null ? l.lastEffect : null;
          if (o !== null) {
            var u = o.next;
            l = u;
            do {
              if ((l.tag & e) === e) {
                o = void 0;
                var p = l.create, y = l.inst;
                o = p(), y.destroy = o;
              }
              l = l.next;
            } while (l !== u);
          }
        } catch (A) {
          Ne(t, t.return, A);
        }
      }
      function Nn(e, t, l) {
        try {
          var o = t.updateQueue, u = o !== null ? o.lastEffect : null;
          if (u !== null) {
            var p = u.next;
            o = p;
            do {
              if ((o.tag & e) === e) {
                var y = o.inst, A = y.destroy;
                if (A !== void 0) {
                  y.destroy = void 0, u = t;
                  var L = l, F = A;
                  try {
                    F();
                  } catch (ne) {
                    Ne(
                      u,
                      L,
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
      function Yu(e) {
        var t = e.updateQueue;
        if (t !== null) {
          var l = e.stateNode;
          try {
            Dc(t, l);
          } catch (o) {
            Ne(e, e.return, o);
          }
        }
      }
      function Qu(e, t, l) {
        l.props = ea(
          e.type,
          e.memoizedProps
        ), l.state = e.memoizedState;
        try {
          l.componentWillUnmount();
        } catch (o) {
          Ne(e, t, o);
        }
      }
      function fl(e, t) {
        try {
          var l = e.ref;
          if (l !== null) {
            switch (e.tag) {
              case 26:
              case 27:
              case 5:
                var o = gl(e.stateNode);
                break;
              case 30:
                o = e.stateNode;
                break;
              default:
                o = e.stateNode;
            }
            typeof l == "function" ? e.refCleanup = l(o) : l.current = o;
          }
        } catch (u) {
          Ne(e, t, u);
        }
      }
      function Wt(e, t) {
        var l = e.ref, o = e.refCleanup;
        if (l !== null)
          if (typeof o == "function")
            try {
              o();
            } catch (u) {
              Ne(e, t, u);
            } finally {
              e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
            }
          else if (typeof l == "function")
            try {
              l(null);
            } catch (u) {
              Ne(e, t, u);
            }
          else l.current = null;
      }
      function Vu(e) {
        var t = e.type, l = e.memoizedProps, o = e.stateNode;
        try {
          Qh(o, t, l, e);
        } catch (u) {
          Ne(e, e.return, u);
        }
      }
      function hs(e, t, l) {
        try {
          Vh(
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
      function Xu(e) {
        return e.tag === 5 || e.tag === 3 || (Vt ? e.tag === 26 : !1) || (We ? e.tag === 27 && ja(e.type) : !1) || e.tag === 4;
      }
      function gs(e) {
        e: for (; ; ) {
          for (; e.sibling === null; ) {
            if (e.return === null || Xu(e.return)) return null;
            e = e.return;
          }
          for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
            if (We && e.tag === 27 && ja(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
            e.child.return = e, e = e.child;
          }
          if (!(e.flags & 2)) return e.stateNode;
        }
      }
      function bs(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? Zh(l, e, t) : Lh(l, e);
        else if (o !== 4 && (We && o === 27 && ja(e.type) && (l = e.stateNode, t = null), e = e.child, e !== null))
          for (bs(e, t, l), e = e.sibling; e !== null; )
            bs(e, t, l), e = e.sibling;
      }
      function gr(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? Xh(l, e, t) : Gh(l, e);
        else if (o !== 4 && (We && o === 27 && ja(e.type) && (l = e.stateNode), e = e.child, e !== null))
          for (gr(e, t, l), e = e.sibling; e !== null; )
            gr(e, t, l), e = e.sibling;
      }
      function Zu(e, t, l) {
        e = e.containerInfo;
        try {
          Qd(e, l);
        } catch (o) {
          Ne(t, t.return, o);
        }
      }
      function Ku(e) {
        var t = e.stateNode, l = e.memoizedProps;
        try {
          qg(
            e.type,
            l,
            t,
            e
          );
        } catch (o) {
          Ne(e, e.return, o);
        }
      }
      function $m(e, t) {
        for (bh(e.containerInfo), et = t; et !== null; )
          if (e = et, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null)
            t.return = e, et = t;
          else
            for (; et !== null; ) {
              e = et;
              var l = e.alternate;
              switch (t = e.flags, e.tag) {
                case 0:
                  if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null))
                    for (var o = 0; o < t.length; o++) {
                      var u = t[o];
                      u.ref.impl = u.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((t & 1024) !== 0 && l !== null) {
                    t = void 0, o = e, u = l.memoizedProps, l = l.memoizedState;
                    var p = o.stateNode;
                    try {
                      var y = ea(
                        o.type,
                        u
                      );
                      t = p.getSnapshotBeforeUpdate(
                        y,
                        l
                      ), p.__reactInternalSnapshotBeforeUpdate = t;
                    } catch (A) {
                      Ne(o, o.return, A);
                    }
                  }
                  break;
                case 3:
                  (t & 1024) !== 0 && dt && Ph(e.stateNode.containerInfo);
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
                t.return = e.return, et = t;
                break;
              }
              et = e.return;
            }
      }
      function Ju(e, t, l) {
        var o = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            on(e, l), o & 4 && dl(5, l);
            break;
          case 1:
            if (on(e, l), o & 4)
              if (e = l.stateNode, t === null)
                try {
                  e.componentDidMount();
                } catch (y) {
                  Ne(l, l.return, y);
                }
              else {
                var u = ea(
                  l.type,
                  t.memoizedProps
                );
                t = t.memoizedState;
                try {
                  e.componentDidUpdate(
                    u,
                    t,
                    e.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (y) {
                  Ne(
                    l,
                    l.return,
                    y
                  );
                }
              }
            o & 64 && Yu(l), o & 512 && fl(l, l.return);
            break;
          case 3:
            if (on(e, l), o & 64 && (o = l.updateQueue, o !== null)) {
              if (e = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    e = gl(l.child.stateNode);
                    break;
                  case 1:
                    e = l.child.stateNode;
                }
              try {
                Dc(o, e);
              } catch (y) {
                Ne(l, l.return, y);
              }
            }
            break;
          case 27:
            We && t === null && o & 4 && Ku(l);
          case 26:
          case 5:
            if (on(e, l), t === null) {
              if (o & 4) Vu(l);
              else if (o & 64) {
                e = l.type, t = l.memoizedProps, u = l.stateNode;
                try {
                  kg(
                    u,
                    e,
                    t,
                    l
                  );
                } catch (y) {
                  Ne(l, l.return, y);
                }
              }
            }
            o & 512 && fl(l, l.return);
            break;
          case 12:
            on(e, l);
            break;
          case 31:
            on(e, l), o & 4 && Fu(e, l);
            break;
          case 13:
            on(e, l), o & 4 && $u(e, l), o & 64 && (o = l.memoizedState, o !== null && (o = o.dehydrated, o !== null && (l = lh.bind(
              null,
              l
            ), ag(o, l))));
            break;
          case 22:
            if (o = l.memoizedState !== null || hn, !o) {
              t = t !== null && t.memoizedState !== null || Ze, u = hn;
              var p = Ze;
              hn = o, (Ze = t) && !p ? cn(
                e,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : on(e, l), hn = u, Ze = p;
            }
            break;
          case 30:
            break;
          default:
            on(e, l);
        }
      }
      function Wu(e) {
        var t = e.alternate;
        t !== null && (e.alternate = null, Wu(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && zh(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
      }
      function Yt(e, t, l) {
        for (l = l.child; l !== null; )
          vs(
            e,
            t,
            l
          ), l = l.sibling;
      }
      function vs(e, t, l) {
        if (Et && typeof Et.onCommitFiberUnmount == "function")
          try {
            Et.onCommitFiberUnmount(yl, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Vt) {
              Ze || Wt(l, t), Yt(
                e,
                t,
                l
              ), l.memoizedState ? $d(l.memoizedState) : l.stateNode && Pd(l.stateNode);
              break;
            }
          case 27:
            if (We) {
              Ze || Wt(l, t);
              var o = Ke, u = yt;
              ja(l.type) && (Ke = l.stateNode, yt = !1), Yt(
                e,
                t,
                l
              ), nf(l.stateNode), Ke = o, yt = u;
              break;
            }
          case 5:
            Ze || Wt(l, t);
          case 6:
            if (dt) {
              if (o = Ke, u = yt, Ke = null, Yt(
                e,
                t,
                l
              ), Ke = o, yt = u, Ke !== null)
                if (yt)
                  try {
                    Jh(Ke, l.stateNode);
                  } catch (p) {
                    Ne(
                      l,
                      t,
                      p
                    );
                  }
                else
                  try {
                    Kh(Ke, l.stateNode);
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
            dt && Ke !== null && (yt ? Cg(
              Ke,
              l.stateNode
            ) : Tg(Ke, l.stateNode));
            break;
          case 4:
            dt ? (o = Ke, u = yt, Ke = l.stateNode.containerInfo, yt = !0, Yt(
              e,
              t,
              l
            ), Ke = o, yt = u) : (Ft && Zu(
              l.stateNode,
              l,
              Ld()
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
            Nn(2, l, t), Ze || Nn(4, l, t), Yt(
              e,
              t,
              l
            );
            break;
          case 1:
            Ze || (Wt(l, t), o = l.stateNode, typeof o.componentWillUnmount == "function" && Qu(
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
            Ze = (o = Ze) || l.memoizedState !== null, Yt(
              e,
              t,
              l
            ), Ze = o;
            break;
          default:
            Yt(
              e,
              t,
              l
            );
        }
      }
      function Fu(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
          e = e.dehydrated;
          try {
            Sg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
        }
      }
      function $u(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
          try {
            Eg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
      }
      function Im(e) {
        switch (e.tag) {
          case 31:
          case 13:
          case 19:
            var t = e.stateNode;
            return t === null && (t = e.stateNode = new pf()), t;
          case 22:
            return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new pf()), t;
          default:
            throw Error(s(435, e.tag));
        }
      }
      function br(e, t) {
        var l = Im(e);
        t.forEach(function(o) {
          if (!l.has(o)) {
            l.add(o);
            var u = rh.bind(null, e, o);
            o.then(u, u);
          }
        });
      }
      function ut(e, t) {
        var l = t.deletions;
        if (l !== null)
          for (var o = 0; o < l.length; o++) {
            var u = l[o], p = e, y = t;
            if (dt) {
              var A = y;
              e: for (; A !== null; ) {
                switch (A.tag) {
                  case 27:
                    if (We) {
                      if (ja(A.type)) {
                        Ke = A.stateNode, yt = !1;
                        break e;
                      }
                      break;
                    }
                  case 5:
                    Ke = A.stateNode, yt = !1;
                    break e;
                  case 3:
                  case 4:
                    Ke = A.stateNode.containerInfo, yt = !0;
                    break e;
                }
                A = A.return;
              }
              if (Ke === null) throw Error(s(160));
              vs(p, y, u), Ke = null, yt = !1;
            } else vs(p, y, u);
            p = u.alternate, p !== null && (p.return = null), u.return = null;
          }
        if (t.subtreeFlags & 13886)
          for (t = t.child; t !== null; )
            Iu(t, e), t = t.sibling;
      }
      function Iu(e, t) {
        var l = e.alternate, o = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ut(t, e), gt(e), o & 4 && (Nn(3, e, e.return), dl(3, e), Nn(5, e, e.return));
            break;
          case 1:
            ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), o & 64 && hn && (e = e.updateQueue, e !== null && (o = e.callbacks, o !== null && (l = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = l === null ? o : l.concat(o))));
            break;
          case 26:
            if (Vt) {
              var u = Xt;
              if (ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), o & 4) {
                o = l !== null ? l.memoizedState : null;
                var p = e.memoizedState;
                l === null ? p === null ? e.stateNode === null ? e.stateNode = Og(
                  u,
                  e.type,
                  e.memoizedProps,
                  e
                ) : Id(
                  u,
                  e.type,
                  e.stateNode
                ) : e.stateNode = Fd(
                  u,
                  p,
                  e.memoizedProps
                ) : o !== p ? (o === null ? l.stateNode !== null && Pd(l.stateNode) : $d(o), p === null ? Id(
                  u,
                  e.type,
                  e.stateNode
                ) : Fd(
                  u,
                  p,
                  e.memoizedProps
                )) : p === null && e.stateNode !== null && hs(
                  e,
                  e.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (We) {
              ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), l !== null && o & 4 && hs(
                e,
                e.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (ut(t, e), gt(e), o & 512 && (Ze || l === null || Wt(l, l.return)), dt) {
              if (e.flags & 32) {
                u = e.stateNode;
                try {
                  Gd(u);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
              o & 4 && e.stateNode != null && (u = e.memoizedProps, hs(
                e,
                u,
                l !== null ? l.memoizedProps : u
              )), o & 1024 && (io = !0);
            } else
              Ft && e.alternate !== null && (e.alternate.stateNode = e.stateNode);
            break;
          case 6:
            if (ut(t, e), gt(e), o & 4 && dt) {
              if (e.stateNode === null)
                throw Error(s(162));
              o = e.memoizedProps, l = l !== null ? l.memoizedProps : o, u = e.stateNode;
              try {
                Yh(u, l, o);
              } catch (P) {
                Ne(e, e.return, P);
              }
            }
            break;
          case 3:
            if (Vt ? (Bg(), u = Xt, Xt = Qs(t.containerInfo), ut(t, e), Xt = u) : ut(t, e), gt(e), o & 4) {
              if (dt && ft && l !== null && l.memoizedState.isDehydrated)
                try {
                  _g(t.containerInfo);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              if (Ft) {
                o = t.containerInfo, l = t.pendingChildren;
                try {
                  Qd(o, l);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
            }
            io && (io = !1, Pu(e));
            break;
          case 4:
            Vt ? (l = Xt, Xt = Qs(
              e.stateNode.containerInfo
            ), ut(t, e), gt(e), Xt = l) : (ut(t, e), gt(e)), o & 4 && Ft && Zu(
              e.stateNode,
              e,
              e.stateNode.pendingChildren
            );
            break;
          case 12:
            ut(t, e), gt(e);
            break;
          case 31:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, br(e, o)));
            break;
          case 13:
            ut(t, e), gt(e), e.child.flags & 8192 && e.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Vr = vt()), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, br(e, o)));
            break;
          case 22:
            u = e.memoizedState !== null;
            var y = l !== null && l.memoizedState !== null, A = hn, L = Ze;
            if (hn = A || u, Ze = L || y, ut(t, e), Ze = L, hn = A, gt(e), o & 8192 && (t = e.stateNode, t._visibility = u ? t._visibility & -2 : t._visibility | 1, u && (l === null || y || hn || Ze || ta(e)), dt)) {
              e: if (l = null, dt)
                for (t = e; ; ) {
                  if (t.tag === 5 || Vt && t.tag === 26) {
                    if (l === null) {
                      y = l = t;
                      try {
                        p = y.stateNode, u ? Wh(p) : $h(
                          y.stateNode,
                          y.memoizedProps
                        );
                      } catch (P) {
                        Ne(y, y.return, P);
                      }
                    }
                  } else if (t.tag === 6) {
                    if (l === null) {
                      y = t;
                      try {
                        var F = y.stateNode;
                        u ? Fh(F) : Ih(F, y.memoizedProps);
                      } catch (P) {
                        Ne(y, y.return, P);
                      }
                    }
                  } else if (t.tag === 18) {
                    if (l === null) {
                      y = t;
                      try {
                        var ne = y.stateNode;
                        u ? Ag(ne) : Mg(y.stateNode);
                      } catch (P) {
                        Ne(y, y.return, P);
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
            o & 4 && (o = e.updateQueue, o !== null && (l = o.retryQueue, l !== null && (o.retryQueue = null, br(e, l))));
            break;
          case 19:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, br(e, o)));
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
              if (Xu(o)) {
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
                    var u = l.stateNode, p = gs(e);
                    gr(e, p, u);
                    break;
                  }
                case 5:
                  var y = l.stateNode;
                  l.flags & 32 && (Gd(y), l.flags &= -33);
                  var A = gs(e);
                  gr(e, A, y);
                  break;
                case 3:
                case 4:
                  var L = l.stateNode.containerInfo, F = gs(e);
                  bs(
                    e,
                    F,
                    L
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
      function Pu(e) {
        if (e.subtreeFlags & 1024)
          for (e = e.child; e !== null; ) {
            var t = e;
            Pu(t), t.tag === 5 && t.flags & 1024 && Mh(t.stateNode), e = e.sibling;
          }
      }
      function on(e, t) {
        if (t.subtreeFlags & 8772)
          for (t = t.child; t !== null; )
            Ju(e, t.alternate, t), t = t.sibling;
      }
      function ta(e) {
        for (e = e.child; e !== null; ) {
          var t = e;
          switch (t.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              Nn(4, t, t.return), ta(t);
              break;
            case 1:
              Wt(t, t.return);
              var l = t.stateNode;
              typeof l.componentWillUnmount == "function" && Qu(
                t,
                t.return,
                l
              ), ta(t);
              break;
            case 27:
              We && nf(t.stateNode);
            case 26:
            case 5:
              Wt(t, t.return), ta(t);
              break;
            case 22:
              t.memoizedState === null && ta(t);
              break;
            case 30:
              ta(t);
              break;
            default:
              ta(t);
          }
          e = e.sibling;
        }
      }
      function cn(e, t, l) {
        for (l = l && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; ) {
          var o = t.alternate, u = e, p = t, y = p.flags;
          switch (p.tag) {
            case 0:
            case 11:
            case 15:
              cn(
                u,
                p,
                l
              ), dl(4, p);
              break;
            case 1:
              if (cn(
                u,
                p,
                l
              ), o = p, u = o.stateNode, typeof u.componentDidMount == "function")
                try {
                  u.componentDidMount();
                } catch (F) {
                  Ne(o, o.return, F);
                }
              if (o = p, u = o.updateQueue, u !== null) {
                var A = o.stateNode;
                try {
                  var L = u.shared.hiddenCallbacks;
                  if (L !== null)
                    for (u.shared.hiddenCallbacks = null, u = 0; u < L.length; u++)
                      Oc(L[u], A);
                } catch (F) {
                  Ne(o, o.return, F);
                }
              }
              l && y & 64 && Yu(p), fl(p, p.return);
              break;
            case 27:
              We && Ku(p);
            case 26:
            case 5:
              cn(
                u,
                p,
                l
              ), l && o === null && y & 4 && Vu(p), fl(p, p.return);
              break;
            case 12:
              cn(
                u,
                p,
                l
              );
              break;
            case 31:
              cn(
                u,
                p,
                l
              ), l && y & 4 && Fu(u, p);
              break;
            case 13:
              cn(
                u,
                p,
                l
              ), l && y & 4 && $u(u, p);
              break;
            case 22:
              p.memoizedState === null && cn(
                u,
                p,
                l
              ), fl(p, p.return);
              break;
            case 30:
              break;
            default:
              cn(
                u,
                p,
                l
              );
          }
          t = t.sibling;
        }
      }
      function ys(e, t) {
        var l = null;
        e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== l && (e != null && e.refCount++, l != null && nl(l));
      }
      function xs(e, t) {
        e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && nl(e));
      }
      function Qt(e, t, l, o) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            ed(
              e,
              t,
              l,
              o
            ), t = t.sibling;
      }
      function ed(e, t, l, o) {
        var u = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Qt(
              e,
              t,
              l,
              o
            ), u & 2048 && dl(9, t);
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
            ), u & 2048 && (e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && nl(e)));
            break;
          case 12:
            if (u & 2048) {
              Qt(
                e,
                t,
                l,
                o
              ), e = t.stateNode;
              try {
                var p = t.memoizedProps, y = p.id, A = p.onPostCommit;
                typeof A == "function" && A(
                  y,
                  t.alternate === null ? "mount" : "update",
                  e.passiveEffectDuration,
                  -0
                );
              } catch (L) {
                Ne(t, t.return, L);
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
            p = t.stateNode, y = t.alternate, t.memoizedState !== null ? p._visibility & 2 ? Qt(
              e,
              t,
              l,
              o
            ) : pl(
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
            )), u & 2048 && ys(y, t);
            break;
          case 24:
            Qt(
              e,
              t,
              l,
              o
            ), u & 2048 && xs(t.alternate, t);
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
      function Na(e, t, l, o, u) {
        for (u = u && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child; t !== null; ) {
          var p = e, y = t, A = l, L = o, F = y.flags;
          switch (y.tag) {
            case 0:
            case 11:
            case 15:
              Na(
                p,
                y,
                A,
                L,
                u
              ), dl(8, y);
              break;
            case 23:
              break;
            case 22:
              var ne = y.stateNode;
              y.memoizedState !== null ? ne._visibility & 2 ? Na(
                p,
                y,
                A,
                L,
                u
              ) : pl(
                p,
                y
              ) : (ne._visibility |= 2, Na(
                p,
                y,
                A,
                L,
                u
              )), u && F & 2048 && ys(
                y.alternate,
                y
              );
              break;
            case 24:
              Na(
                p,
                y,
                A,
                L,
                u
              ), u && F & 2048 && xs(y.alternate, y);
              break;
            default:
              Na(
                p,
                y,
                A,
                L,
                u
              );
          }
          t = t.sibling;
        }
      }
      function pl(e, t) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; ) {
            var l = e, o = t, u = o.flags;
            switch (o.tag) {
              case 22:
                pl(l, o), u & 2048 && ys(
                  o.alternate,
                  o
                );
                break;
              case 24:
                pl(l, o), u & 2048 && xs(
                  o.alternate,
                  o
                );
                break;
              default:
                pl(l, o);
            }
            t = t.sibling;
          }
      }
      function na(e, t, l) {
        if (e.subtreeFlags & Ka)
          for (e = e.child; e !== null; )
            td(
              e,
              t,
              l
            ), e = e.sibling;
      }
      function td(e, t, l) {
        switch (e.tag) {
          case 26:
            if (na(
              e,
              t,
              l
            ), e.flags & Ka)
              if (e.memoizedState !== null)
                Ug(
                  l,
                  Xt,
                  e.memoizedState,
                  e.memoizedProps
                );
              else {
                var o = e.stateNode, u = e.type;
                e = e.memoizedProps, ((t & 335544128) === t || Gs(u, e)) && qd(l, o, u, e);
              }
            break;
          case 5:
            na(
              e,
              t,
              l
            ), e.flags & Ka && (o = e.stateNode, u = e.type, e = e.memoizedProps, ((t & 335544128) === t || Gs(u, e)) && qd(l, o, u, e));
            break;
          case 3:
          case 4:
            Vt ? (o = Xt, Xt = Qs(
              e.stateNode.containerInfo
            ), na(
              e,
              t,
              l
            ), Xt = o) : na(
              e,
              t,
              l
            );
            break;
          case 22:
            e.memoizedState === null && (o = e.alternate, o !== null && o.memoizedState !== null ? (o = Ka, Ka = 16777216, na(
              e,
              t,
              l
            ), Ka = o) : na(
              e,
              t,
              l
            ));
            break;
          default:
            na(
              e,
              t,
              l
            );
        }
      }
      function nd(e) {
        var t = e.alternate;
        if (t !== null && (e = t.child, e !== null)) {
          t.child = null;
          do
            t = e.sibling, e.sibling = null, e = t;
          while (e !== null);
        }
      }
      function ml(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              et = o, ld(
                o,
                e
              );
            }
          nd(e);
        }
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            ad(e), e = e.sibling;
      }
      function ad(e) {
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            ml(e), e.flags & 2048 && Nn(9, e, e.return);
            break;
          case 3:
            ml(e);
            break;
          case 12:
            ml(e);
            break;
          case 22:
            var t = e.stateNode;
            e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, vr(e)) : ml(e);
            break;
          default:
            ml(e);
        }
      }
      function vr(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              et = o, ld(
                o,
                e
              );
            }
          nd(e);
        }
        for (e = e.child; e !== null; ) {
          switch (t = e, t.tag) {
            case 0:
            case 11:
            case 15:
              Nn(8, t, t.return), vr(t);
              break;
            case 22:
              l = t.stateNode, l._visibility & 2 && (l._visibility &= -3, vr(t));
              break;
            default:
              vr(t);
          }
          e = e.sibling;
        }
      }
      function ld(e, t) {
        for (; et !== null; ) {
          var l = et;
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
              nl(l.memoizedState.cache);
          }
          if (o = l.child, o !== null) o.return = l, et = o;
          else
            e: for (l = e; et !== null; ) {
              o = et;
              var u = o.sibling, p = o.return;
              if (Wu(o), o === l) {
                et = null;
                break e;
              }
              if (u !== null) {
                u.return = p, et = u;
                break e;
              }
              et = p;
            }
        }
      }
      function ws(e) {
        var t = kh(e);
        if (t != null) {
          if (typeof t.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return t;
        }
        if (e = Oh(e), e === null) throw Error(s(362));
        return e.stateNode.current;
      }
      function ks(e, t) {
        var l = e.tag;
        switch (t.$$typeof) {
          case qr:
            if (e.type === t.value) return !0;
            break;
          case Gr:
            e: {
              for (t = t.value, e = [e, 0], l = 0; l < e.length; ) {
                var o = e[l++], u = o.tag, p = e[l++], y = t[p];
                if (u !== 5 && u !== 26 && u !== 27 || !vl(o)) {
                  for (; y != null && ks(o, y); )
                    p++, y = t[p];
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
          case Lr:
            if ((l === 5 || l === 26 || l === 27) && Hh(e.stateNode, t.value))
              return !0;
            break;
          case Qr:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (e = Bh(e), e !== null && 0 <= e.indexOf(t.value)))
              return !0;
            break;
          case Yr:
            if ((l === 5 || l === 26 || l === 27) && (e = e.memoizedProps["data-testname"], typeof e == "string" && e.toLowerCase() === t.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function _s(e) {
        switch (e.$$typeof) {
          case qr:
            return "<" + (g(e.value) || "Unknown") + ">";
          case Gr:
            return ":has(" + (_s(e) || "") + ")";
          case Lr:
            return '[role="' + e.value + '"]';
          case Qr:
            return '"' + e.value + '"';
          case Yr:
            return '[data-testname="' + e.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function rd(e, t) {
        var l = [];
        e = [e, 0];
        for (var o = 0; o < e.length; ) {
          var u = e[o++], p = u.tag, y = e[o++], A = t[y];
          if (p !== 5 && p !== 26 && p !== 27 || !vl(u)) {
            for (; A != null && ks(u, A); )
              y++, A = t[y];
            if (y === t.length) l.push(u);
            else
              for (u = u.child; u !== null; )
                e.push(u, y), u = u.sibling;
          }
        }
        return l;
      }
      function Ss(e, t) {
        if (!bl) throw Error(s(363));
        e = ws(e), e = rd(e, t), t = [], e = Array.from(e);
        for (var l = 0; l < e.length; ) {
          var o = e[l++], u = o.tag;
          if (u === 5 || u === 26 || u === 27)
            vl(o) || t.push(o.stateNode);
          else
            for (o = o.child; o !== null; )
              e.push(o), o = o.sibling;
        }
        return t;
      }
      function kt() {
        return (we & 2) !== 0 && _e !== 0 ? _e & -_e : de.T !== null ? ji() : Sh();
      }
      function id() {
        if (Ct === 0)
          if ((_e & 536870912) === 0 || Se) {
            var e = zr;
            zr <<= 1, (zr & 3932160) === 0 && (zr = 262144), Ct = e;
          } else Ct = 536870912;
        return e = Nt.current, e !== null && (e.flags |= 32), Ct;
      }
      function bt(e, t, l) {
        (e === je && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null) && (Ta(e, 0), Tn(
          e,
          _e,
          Ct,
          !1
        )), O(e, l), ((we & 2) === 0 || e !== je) && (e === je && ((we & 2) === 0 && (fa |= l), qe === 4 && Tn(
          e,
          _e,
          Ct,
          !1
        )), Jt(e));
      }
      function sd(e, t, l) {
        if ((we & 6) !== 0) throw Error(s(327));
        var o = !l && (t & 127) === 0 && (t & e.expiredLanes) === 0 || B(e, t), u = o ? th(e, t) : zs(e, t, !0), p = o;
        do {
          if (u === 0) {
            Ja && !o && Tn(e, t, 0, !1);
            break;
          } else {
            if (l = e.current.alternate, p && !Pm(l)) {
              u = zs(e, t, !1), p = !1;
              continue;
            }
            if (u === 2) {
              if (p = t, e.errorRecoveryDisabledLanes & p)
                var y = 0;
              else
                y = e.pendingLanes & -536870913, y = y !== 0 ? y : y & 536870912 ? 536870912 : 0;
              if (y !== 0) {
                t = y;
                e: {
                  var A = e;
                  u = Nl;
                  var L = ft && A.current.memoizedState.isDehydrated;
                  if (L && (Ta(A, y).flags |= 256), y = zs(
                    A,
                    y,
                    !1
                  ), y !== 2) {
                    if (so && !L) {
                      A.errorRecoveryDisabledLanes |= p, fa |= p, u = 4;
                      break e;
                    }
                    p = xt, xt = u, p !== null && (xt === null ? xt = p : xt.push.apply(
                      xt,
                      p
                    ));
                  }
                  u = y;
                }
                if (p = !1, u !== 2) continue;
              }
            }
            if (u === 1) {
              Ta(e, 0), Tn(e, t, 0, !0);
              break;
            }
            e: {
              switch (o = e, p = u, p) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((t & 4194048) !== t) break;
                case 6:
                  Tn(
                    o,
                    t,
                    Ct,
                    !Dn
                  );
                  break e;
                case 2:
                  xt = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(s(329));
              }
              if ((t & 62914560) === t && (u = Vr + 300 - vt(), 10 < u)) {
                if (Tn(
                  o,
                  t,
                  Ct,
                  !Dn
                ), N(o, 0, !0) !== 0) break e;
                bn = t, o.timeoutHandle = xh(
                  od.bind(
                    null,
                    o,
                    l,
                    xt,
                    Xr,
                    co,
                    t,
                    Ct,
                    fa,
                    Wa,
                    Dn,
                    p,
                    "Throttled",
                    -0,
                    0
                  ),
                  u
                );
                break e;
              }
              od(
                o,
                l,
                xt,
                Xr,
                co,
                t,
                Ct,
                fa,
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
        Jt(e);
      }
      function od(e, t, l, o, u, p, y, A, L, F, ne, P, le, ge) {
        if (e.timeoutHandle = la, P = t.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = Ch(), td(
            t,
            p,
            P
          );
          var st = (p & 62914560) === p ? Vr - vt() : (p & 4194048) === p ? mf - vt() : 0;
          if (st = Ah(
            P,
            st
          ), st !== null) {
            bn = p, e.cancelPendingCommit = st(
              bd.bind(
                null,
                e,
                t,
                p,
                l,
                o,
                u,
                y,
                A,
                L,
                ne,
                P,
                null,
                le,
                ge
              )
            ), Tn(e, p, y, !F);
            return;
          }
        }
        bd(
          e,
          t,
          p,
          l,
          o,
          u,
          y,
          A,
          L
        );
      }
      function Pm(e) {
        for (var t = e; ; ) {
          var l = t.tag;
          if ((l === 0 || l === 11 || l === 15) && t.flags & 16384 && (l = t.updateQueue, l !== null && (l = l.stores, l !== null)))
            for (var o = 0; o < l.length; o++) {
              var u = l[o], p = u.getSnapshot;
              u = u.value;
              try {
                if (!zt(p(), u)) return !1;
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
        t &= ~oo, t &= ~fa, e.suspendedLanes |= t, e.pingedLanes &= ~t, o && (e.warmLanes |= t), o = e.expirationTimes;
        for (var u = t; 0 < u; ) {
          var p = 31 - St(u), y = 1 << p;
          o[p] = -1, u &= ~y;
        }
        l !== 0 && w(e, l, t);
      }
      function cd() {
        return (we & 6) === 0 ? (Ea(0), !1) : !0;
      }
      function Es() {
        if (ke !== null) {
          if (Ae === 0)
            var e = ke.return;
          else
            e = ke, pn = ia = null, Zi(e), Ya = null, _l = 0, e = ke;
          for (; e !== null; )
            Lu(e.alternate, e), e = e.return;
          ke = null;
        }
      }
      function Ta(e, t) {
        var l = e.timeoutHandle;
        l !== la && (e.timeoutHandle = la, wh(l)), l = e.cancelPendingCommit, l !== null && (e.cancelPendingCommit = null, l()), bn = 0, Es(), je = e, ke = l = un(e.current, null), _e = t, Ae = 0, Tt = null, Dn = !1, Ja = B(e, t), so = !1, Wa = Ct = oo = fa = Bn = qe = 0, xt = Nl = null, co = !1, (t & 8) !== 0 && (t |= t & 32);
        var o = e.entangledLanes;
        if (o !== 0)
          for (e = e.entanglements, o &= t; 0 < o; ) {
            var u = 31 - St(o), p = 1 << u;
            t |= e[u], o &= ~p;
          }
        return gn = t, er(), l;
      }
      function ud(e, t) {
        be = null, de.H = El, t === La || t === Or ? (t = Ac(), Ae = 3) : t === Ps ? (t = Ac(), Ae = 4) : Ae = t === lo ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, Tt = t, ke === null && (qe = 1, ur(
          e,
          Y(t, e.current)
        ));
      }
      function dd() {
        var e = Nt.current;
        return e === null ? !0 : (_e & 4194048) === _e ? Bt === null : (_e & 62914560) === _e || (_e & 536870912) !== 0 ? e === Bt : !1;
      }
      function fd() {
        var e = de.H;
        return de.H = El, e === null ? El : e;
      }
      function pd() {
        var e = de.A;
        return de.A = Pg, e;
      }
      function yr() {
        qe = 4, Dn || (_e & 4194048) !== _e && Nt.current !== null || (Ja = !0), (Bn & 134217727) === 0 && (fa & 134217727) === 0 || je === null || Tn(
          je,
          _e,
          Ct,
          !1
        );
      }
      function zs(e, t, l) {
        var o = we;
        we |= 2;
        var u = fd(), p = pd();
        (je !== e || _e !== t) && (Xr = null, Ta(e, t)), t = !1;
        var y = qe;
        e: do
          try {
            if (Ae !== 0 && ke !== null) {
              var A = ke, L = Tt;
              switch (Ae) {
                case 8:
                  Es(), y = 6;
                  break e;
                case 3:
                case 2:
                case 9:
                case 6:
                  Nt.current === null && (t = !0);
                  var F = Ae;
                  if (Ae = 0, Tt = null, Ca(e, A, L, F), l && Ja) {
                    y = 0;
                    break e;
                  }
                  break;
                default:
                  F = Ae, Ae = 0, Tt = null, Ca(e, A, L, F);
              }
            }
            eh(), y = qe;
            break;
          } catch (ne) {
            ud(e, ne);
          }
        while (!0);
        return t && e.shellSuspendCounter++, pn = ia = null, we = o, de.H = u, de.A = p, ke === null && (je = null, _e = 0, er()), y;
      }
      function eh() {
        for (; ke !== null; ) md(ke);
      }
      function th(e, t) {
        var l = we;
        we |= 2;
        var o = fd(), u = pd();
        je !== e || _e !== t ? (Xr = null, Tl = vt() + 500, Ta(e, t)) : Ja = B(
          e,
          t
        );
        e: do
          try {
            if (Ae !== 0 && ke !== null) {
              t = ke;
              var p = Tt;
              t: switch (Ae) {
                case 1:
                  Ae = 0, Tt = null, Ca(e, t, p, 1);
                  break;
                case 2:
                case 9:
                  if (Tc(p)) {
                    Ae = 0, Tt = null, hd(t);
                    break;
                  }
                  t = function() {
                    Ae !== 2 && Ae !== 9 || je !== e || (Ae = 7), Jt(e);
                  }, p.then(t, t);
                  break e;
                case 3:
                  Ae = 7;
                  break e;
                case 4:
                  Ae = 5;
                  break e;
                case 7:
                  Tc(p) ? (Ae = 0, Tt = null, hd(t)) : (Ae = 0, Tt = null, Ca(e, t, p, 7));
                  break;
                case 5:
                  var y = null;
                  switch (ke.tag) {
                    case 26:
                      y = ke.memoizedState;
                    case 5:
                    case 27:
                      var A = ke, L = A.type, F = A.pendingProps;
                      if (y ? ef(y) : Ud(A.stateNode, L, F)) {
                        Ae = 0, Tt = null;
                        var ne = A.sibling;
                        if (ne !== null) ke = ne;
                        else {
                          var P = A.return;
                          P !== null ? (ke = P, xr(P)) : ke = null;
                        }
                        break t;
                      }
                  }
                  Ae = 0, Tt = null, Ca(e, t, p, 5);
                  break;
                case 6:
                  Ae = 0, Tt = null, Ca(e, t, p, 6);
                  break;
                case 8:
                  Es(), qe = 6;
                  break e;
                default:
                  throw Error(s(462));
              }
            }
            nh();
            break;
          } catch (le) {
            ud(e, le);
          }
        while (!0);
        return pn = ia = null, de.H = o, de.A = u, we = l, ke !== null ? 0 : (je = null, _e = 0, er(), qe);
      }
      function nh() {
        for (; ke !== null && !Yg(); )
          md(ke);
      }
      function md(e) {
        var t = Bu(
          e.alternate,
          e,
          gn
        );
        e.memoizedProps = e.pendingProps, t === null ? xr(e) : ke = t;
      }
      function hd(e) {
        var t = e, l = t.alternate;
        switch (t.tag) {
          case 15:
          case 0:
            t = Au(
              l,
              t,
              t.pendingProps,
              t.type,
              void 0,
              _e
            );
            break;
          case 11:
            t = Au(
              l,
              t,
              t.pendingProps,
              t.type.render,
              t.ref,
              _e
            );
            break;
          case 5:
            Zi(t);
          default:
            Lu(l, t), t = ke = Ed(t, gn), t = Bu(l, t, gn);
        }
        e.memoizedProps = e.pendingProps, t === null ? xr(e) : ke = t;
      }
      function Ca(e, t, l, o) {
        pn = ia = null, Zi(t), Ya = null, _l = 0;
        var u = t.return;
        try {
          if (Zm(
            e,
            u,
            t,
            l,
            _e
          )) {
            qe = 1, ur(
              e,
              Y(l, e.current)
            ), ke = null;
            return;
          }
        } catch (p) {
          if (u !== null) throw ke = u, p;
          qe = 1, ur(
            e,
            Y(l, e.current)
          ), ke = null;
          return;
        }
        t.flags & 32768 ? (Se || o === 1 ? e = !0 : Ja || (_e & 536870912) !== 0 ? e = !1 : (Dn = e = !0, (o === 2 || o === 9 || o === 3 || o === 6) && (o = Nt.current, o !== null && o.tag === 13 && (o.flags |= 16384))), gd(t, e)) : xr(t);
      }
      function xr(e) {
        var t = e;
        do {
          if ((t.flags & 32768) !== 0) {
            gd(
              t,
              Dn
            );
            return;
          }
          e = t.return;
          var l = Wm(
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
        qe === 0 && (qe = 5);
      }
      function gd(e, t) {
        do {
          var l = Fm(e.alternate, e);
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
        qe = 6, ke = null;
      }
      function bd(e, t, l, o, u, p, y, A, L) {
        e.cancelPendingCommit = null;
        do
          hl();
        while (Fe !== 0);
        if ((we & 6) !== 0) throw Error(s(327));
        if (t !== null) {
          if (t === e.current)
            throw Error(s(177));
          if (p = t.lanes | t.childLanes, p |= eo, b(
            e,
            l,
            p,
            y,
            A,
            L
          ), e === je && (ke = je = null, _e = 0), Fa = t, Un = e, bn = l, uo = p, fo = u, hf = o, (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, ih(Zs, function() {
            return kd(), null;
          })) : (e.callbackNode = null, e.callbackPriority = 0), o = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || o) {
            o = de.T, de.T = null, u = fn(), Pe(2), y = we, we |= 4;
            try {
              $m(e, t, l);
            } finally {
              we = y, Pe(u), de.T = o;
            }
          }
          Fe = 1, vd(), yd(), xd();
        }
      }
      function vd() {
        if (Fe === 1) {
          Fe = 0;
          var e = Un, t = Fa, l = (t.flags & 13878) !== 0;
          if ((t.subtreeFlags & 13878) !== 0 || l) {
            l = de.T, de.T = null;
            var o = fn();
            Pe(2);
            var u = we;
            we |= 4;
            try {
              Iu(t, e), vh(e.containerInfo);
            } finally {
              we = u, Pe(o), de.T = l;
            }
          }
          e.current = t, Fe = 2;
        }
      }
      function yd() {
        if (Fe === 2) {
          Fe = 0;
          var e = Un, t = Fa, l = (t.flags & 8772) !== 0;
          if ((t.subtreeFlags & 8772) !== 0 || l) {
            l = de.T, de.T = null;
            var o = fn();
            Pe(2);
            var u = we;
            we |= 4;
            try {
              Ju(e, t.alternate, t);
            } finally {
              we = u, Pe(o), de.T = l;
            }
          }
          Fe = 3;
        }
      }
      function xd() {
        if (Fe === 4 || Fe === 3) {
          Fe = 0, Qg();
          var e = Un, t = Fa, l = bn, o = hf;
          (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? Fe = 5 : (Fe = 0, Fa = Un = null, wd(e, e.pendingLanes));
          var u = e.pendingLanes;
          if (u === 0 && (Hn = null), M(l), t = t.stateNode, Et && typeof Et.onCommitFiberRoot == "function")
            try {
              Et.onCommitFiberRoot(
                yl,
                t,
                void 0,
                (t.current.flags & 128) === 128
              );
            } catch {
            }
          if (o !== null) {
            t = de.T, u = fn(), Pe(2), de.T = null;
            try {
              for (var p = e.onRecoverableError, y = 0; y < o.length; y++) {
                var A = o[y];
                p(A.value, {
                  componentStack: A.stack
                });
              }
            } finally {
              de.T = t, Pe(u);
            }
          }
          (bn & 3) !== 0 && hl(), Jt(e), u = e.pendingLanes, (l & 261930) !== 0 && (u & 42) !== 0 ? e === po ? Cl++ : (Cl = 0, po = e) : Cl = 0, ft && Ng(), Ea(0);
        }
      }
      function wd(e, t) {
        (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, nl(t)));
      }
      function hl() {
        return vd(), yd(), xd(), kd();
      }
      function kd() {
        if (Fe !== 5) return !1;
        var e = Un, t = uo;
        uo = 0;
        var l = M(bn), o = 32 > l ? 32 : l;
        l = de.T;
        var u = fn();
        try {
          Pe(o), de.T = null, o = fo, fo = null;
          var p = Un, y = bn;
          if (Fe = 0, Fa = Un = null, bn = 0, (we & 6) !== 0)
            throw Error(s(331));
          var A = we;
          if (we |= 4, ad(p.current), ed(
            p,
            p.current,
            y,
            o
          ), we = A, Ea(0, !1), Et && typeof Et.onPostCommitFiberRoot == "function")
            try {
              Et.onPostCommitFiberRoot(yl, p);
            } catch {
            }
          return !0;
        } finally {
          Pe(u), de.T = l, wd(e, t);
        }
      }
      function _d(e, t, l) {
        t = Y(l, t), t = ls(e.stateNode, t, 2), e = Sn(e, t, 2), e !== null && (O(e, 2), Jt(e));
      }
      function Ne(e, t, l) {
        if (e.tag === 3)
          _d(e, e, l);
        else
          for (; t !== null; ) {
            if (t.tag === 3) {
              _d(
                t,
                e,
                l
              );
              break;
            } else if (t.tag === 1) {
              var o = t.stateNode;
              if (typeof t.type.getDerivedStateFromError == "function" || typeof o.componentDidCatch == "function" && (Hn === null || !Hn.has(o))) {
                e = Y(l, e), l = ku(2), o = Sn(t, l, 2), o !== null && (_u(
                  l,
                  o,
                  t,
                  e
                ), O(o, 2), Jt(o));
                break;
              }
            }
            t = t.return;
          }
      }
      function Ns(e, t, l) {
        var o = e.pingCache;
        if (o === null) {
          o = e.pingCache = new e0();
          var u = /* @__PURE__ */ new Set();
          o.set(t, u);
        } else
          u = o.get(t), u === void 0 && (u = /* @__PURE__ */ new Set(), o.set(t, u));
        u.has(l) || (so = !0, u.add(l), e = ah.bind(null, e, t, l), t.then(e, e));
      }
      function ah(e, t, l) {
        var o = e.pingCache;
        o !== null && o.delete(t), e.pingedLanes |= e.suspendedLanes & l, e.warmLanes &= ~l, je === e && (_e & l) === l && (qe === 4 || qe === 3 && (_e & 62914560) === _e && 300 > vt() - Vr ? (we & 2) === 0 && Ta(e, 0) : oo |= l, Wa === _e && (Wa = 0)), Jt(e);
      }
      function Sd(e, t) {
        t === 0 && (t = X()), e = Pn(e, t), e !== null && (O(e, t), Jt(e));
      }
      function lh(e) {
        var t = e.memoizedState, l = 0;
        t !== null && (l = t.retryLane), Sd(e, l);
      }
      function rh(e, t) {
        var l = 0;
        switch (e.tag) {
          case 31:
          case 13:
            var o = e.stateNode, u = e.memoizedState;
            u !== null && (l = u.retryLane);
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
        o !== null && o.delete(t), Sd(e, l);
      }
      function ih(e, t) {
        return Tr(e, t);
      }
      function sh(e, t, l, o) {
        this.tag = e, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = o, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Ts(e) {
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
      function Ed(e, t) {
        e.flags &= 65011714;
        var l = e.alternate;
        return l === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = l.childLanes, e.lanes = l.lanes, e.child = l.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = l.memoizedProps, e.memoizedState = l.memoizedState, e.updateQueue = l.updateQueue, e.type = l.type, t = l.dependencies, e.dependencies = t === null ? null : {
          lanes: t.lanes,
          firstContext: t.firstContext
        }), e;
      }
      function wr(e, t, l, o, u, p) {
        var y = 0;
        if (o = e, typeof e == "function") Ts(e) && (y = 1);
        else if (typeof e == "string")
          y = Vt && We ? Jd(e, l, rt.current) ? 26 : af(e) ? 27 : 5 : Vt ? Jd(
            e,
            l,
            rt.current
          ) ? 26 : 5 : We && af(e) ? 27 : 5;
        else
          e: switch (e) {
            case Us:
              return e = r(31, l, t, u), e.elementType = Us, e.lanes = p, e;
            case Ma:
              return aa(
                l.children,
                u,
                p,
                t
              );
            case Rd:
              y = 8, u |= 24;
              break;
            case js:
              return e = r(12, l, t, u | 2), e.elementType = js, e.lanes = p, e;
            case Ds:
              return e = r(13, l, t, u), e.elementType = Ds, e.lanes = p, e;
            case Bs:
              return e = r(19, l, t, u), e.elementType = Bs, e.lanes = p, e;
            default:
              if (typeof e == "object" && e !== null)
                switch (e.$$typeof) {
                  case Cn:
                    y = 10;
                    break e;
                  case jd:
                    y = 9;
                    break e;
                  case Os:
                    y = 11;
                    break e;
                  case Hs:
                    y = 14;
                    break e;
                  case An:
                    y = 16, o = null;
                    break e;
                }
              y = 29, l = Error(
                s(
                  130,
                  e === null ? "null" : typeof e,
                  ""
                )
              ), o = null;
          }
        return t = r(y, l, t, u), t.elementType = e, t.type = o, t.lanes = p, t;
      }
      function aa(e, t, l, o) {
        return e = r(7, e, o, t), e.lanes = l, e;
      }
      function Cs(e, t, l) {
        return e = r(6, e, null, t), e.lanes = l, e;
      }
      function zd(e) {
        var t = r(18, null, null, 0);
        return t.stateNode = e, t;
      }
      function As(e, t, l) {
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
      function oh(e, t, l, o, u, p, y, A, L) {
        this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = la, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = o, this.onUncaughtError = u, this.onCaughtError = p, this.onRecoverableError = y, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = L, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Nd(e, t, l, o, u, p, y, A, L, F, ne, P) {
        return e = new oh(
          e,
          t,
          l,
          y,
          L,
          F,
          ne,
          P,
          A
        ), t = 1, p === !0 && (t |= 24), p = r(3, null, null, t), e.current = p, p.stateNode = e, t = Ri(), t.refCount++, e.pooledCache = t, t.refCount++, p.memoizedState = {
          element: o,
          isDehydrated: l,
          cache: t
        }, Bi(p), e;
      }
      function Td(e) {
        return e ? (e = Da, e) : Da;
      }
      function Cd(e) {
        var t = e._reactInternals;
        if (t === void 0)
          throw typeof e.render == "function" ? Error(s(188)) : (e = Object.keys(e).join(","), Error(s(268, e)));
        return e = d(t), e = e !== null ? m(e) : null, e === null ? null : gl(e.stateNode);
      }
      function Ad(e, t, l, o, u, p) {
        u = Td(u), o.context === null ? o.context = u : o.pendingContext = u, o = _n(t), o.payload = { element: l }, p = p === void 0 ? null : p, p !== null && (o.callback = p), l = Sn(e, o, t), l !== null && (bt(l, e, t), ll(l, e, t));
      }
      function Md(e, t) {
        if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
          var l = e.retryLane;
          e.retryLane = l !== 0 && l < t ? l : t;
        }
      }
      function Ms(e, t) {
        Md(e, t), (e = e.alternate) && Md(e, t);
      }
      var xe = {}, ch = C0, _t = M0(), Rs = Object.assign, uh = Symbol.for("react.element"), kr = Symbol.for("react.transitional.element"), Aa = Symbol.for("react.portal"), Ma = Symbol.for("react.fragment"), Rd = Symbol.for("react.strict_mode"), js = Symbol.for("react.profiler"), jd = Symbol.for("react.consumer"), Cn = Symbol.for("react.context"), Os = Symbol.for("react.forward_ref"), Ds = Symbol.for("react.suspense"), Bs = Symbol.for("react.suspense_list"), Hs = Symbol.for("react.memo"), An = Symbol.for("react.lazy"), Us = Symbol.for("react.activity"), dh = Symbol.for("react.memo_cache_sentinel"), Od = Symbol.iterator, fh = Symbol.for("react.client.reference"), _r = Array.isArray, de = ch.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ph = a.rendererVersion, mh = a.rendererPackageName, Dd = a.extraDevToolsConfig, gl = a.getPublicInstance, hh = a.getRootHostContext, gh = a.getChildHostContext, bh = a.prepareForCommit, vh = a.resetAfterCommit, yh = a.createInstance;
      a.cloneMutableInstance;
      var qs = a.appendInitialChild, Bd = a.finalizeInitialChildren, Sr = a.shouldSetTextContent, Hd = a.createTextInstance;
      a.cloneMutableTextInstance;
      var xh = a.scheduleTimeout, wh = a.cancelTimeout, la = a.noTimeout, dn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var dt = a.supportsMutation, Ft = a.supportsPersistence, ft = a.supportsHydration, kh = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var _h = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var Pe = a.setCurrentUpdatePriority, fn = a.getCurrentUpdatePriority, Sh = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var Eh = a.shouldAttemptEagerTransition, zh = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var Nh = a.maySuspendCommit, Th = a.maySuspendCommitOnUpdate, Gs = a.maySuspendCommitInSyncRender, Ud = a.preloadInstance, Ch = a.startSuspendingCommit, qd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var Ah = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var Ra = a.NotPendingTransition, ra = a.HostTransitionContext, Mh = a.resetFormInstance;
      a.bindToConsole;
      var Rh = a.supportsMicrotasks, jh = a.scheduleMicrotask, bl = a.supportsTestSelectors, Oh = a.findFiberRoot, Dh = a.getBoundingRect, Bh = a.getTextContent, vl = a.isHiddenSubtree, Hh = a.matchAccessibilityRole, Uh = a.setFocusIfFocusable, qh = a.setupIntersectionObserver, Gh = a.appendChild, Lh = a.appendChildToContainer, Yh = a.commitTextUpdate, Qh = a.commitMount, Vh = a.commitUpdate, Xh = a.insertBefore, Zh = a.insertInContainerBefore, Kh = a.removeChild, Jh = a.removeChildFromContainer, Gd = a.resetTextContent, Wh = a.hideInstance, Fh = a.hideTextInstance, $h = a.unhideInstance, Ih = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var Ph = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var eg = a.cloneInstance, Ld = a.createContainerChildSet, Yd = a.appendChildToContainerChildSet, tg = a.finalizeContainerChildren, Qd = a.replaceContainerChildren, Vd = a.cloneHiddenInstance, Xd = a.cloneHiddenTextInstance, Ls = a.isSuspenseInstancePending, Ys = a.isSuspenseInstanceFallback, ng = a.getSuspenseInstanceFallbackErrorDetails, ag = a.registerSuspenseInstanceRetry, lg = a.canHydrateFormStateMarker, rg = a.isFormStateMarkerMatching, Zd = a.getNextHydratableSibling, ig = a.getNextHydratableSiblingAfterSingleton, sg = a.getFirstHydratableChild, og = a.getFirstHydratableChildWithinContainer, cg = a.getFirstHydratableChildWithinActivityInstance, ug = a.getFirstHydratableChildWithinSuspenseInstance, dg = a.getFirstHydratableChildWithinSingleton, fg = a.canHydrateInstance, pg = a.canHydrateTextInstance, mg = a.canHydrateActivityInstance, hg = a.canHydrateSuspenseInstance, gg = a.hydrateInstance, bg = a.hydrateTextInstance, vg = a.hydrateActivityInstance, yg = a.hydrateSuspenseInstance, xg = a.getNextHydratableInstanceAfterActivityInstance, wg = a.getNextHydratableInstanceAfterSuspenseInstance, kg = a.commitHydratedInstance, _g = a.commitHydratedContainer, Sg = a.commitHydratedActivityInstance, Eg = a.commitHydratedSuspenseInstance, zg = a.finalizeHydratedChildren, Ng = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var Tg = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var Cg = a.clearSuspenseBoundaryFromContainer, Ag = a.hideDehydratedBoundary, Mg = a.unhideDehydratedBoundary, Kd = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var Rg = a.validateHydratableInstance, jg = a.validateHydratableTextInstance, Vt = a.supportsResources, Jd = a.isHostHoistableType, Qs = a.getHoistableRoot, Wd = a.getResource, Fd = a.acquireResource, $d = a.releaseResource, Og = a.hydrateHoistable, Id = a.mountHoistable, Pd = a.unmountHoistable, Dg = a.createHoistableInstance, Bg = a.prepareToCommitHoistables, Hg = a.mayResourceSuspendCommit, ef = a.preloadResource, Ug = a.suspendResource, We = a.supportsSingletons, tf = a.resolveSingletonInstance, qg = a.acquireSingletonInstance, nf = a.releaseSingletonInstance, af = a.isHostSingletonType, ja = a.isSingletonScope, Vs = [], Oa = -1, Da = {}, St = Math.clz32 ? Math.clz32 : z, Gg = Math.log, Lg = Math.LN2, Er = 256, zr = 262144, Nr = 4194304, Tr = _t.unstable_scheduleCallback, Xs = _t.unstable_cancelCallback, Yg = _t.unstable_shouldYield, Qg = _t.unstable_requestPaint, vt = _t.unstable_now, lf = _t.unstable_ImmediatePriority, Vg = _t.unstable_UserBlockingPriority, Zs = _t.unstable_NormalPriority, Xg = _t.unstable_IdlePriority, Zg = _t.log, Kg = _t.unstable_setDisableYieldValue, yl = null, Et = null, zt = typeof Object.is == "function" ? Object.is : Z, rf = typeof reportError == "function" ? reportError : function(e) {
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
      }, Jg = Object.prototype.hasOwnProperty, Ks, sf, Js = !1, of = /* @__PURE__ */ new WeakMap(), Ba = [], Ha = 0, Cr = null, xl = 0, Rt = [], jt = 0, Mn = null, $t = 1, It = "", rt = v(null), wl = v(null), Rn = v(null), Ar = v(null), it = null, De = null, Se = !1, jn = null, Ot = !1, Ws = Error(s(519)), Mr = v(null), ia = null, pn = null, Wg = typeof AbortController < "u" ? AbortController : function() {
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
      }, Fg = _t.unstable_scheduleCallback, $g = _t.unstable_NormalPriority, Be = {
        $$typeof: Cn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Rr = null, Ua = null, Fs = !1, jr = !1, $s = !1, sa = 0, kl = null, Is = 0, qa = 0, Ga = null, cf = de.S;
      de.S = function(e, t) {
        mf = vt(), typeof t == "object" && t !== null && typeof t.then == "function" && Um(e, t), cf !== null && cf(e, t);
      };
      var oa = v(null), La = Error(s(460)), Ps = Error(s(474)), Or = Error(s(542)), Dr = { then: function() {
      } }, ca = null, Ya = null, _l = 0, ua = Rc(!0), uf = Rc(!1), Dt = [], Qa = 0, eo = 0, On = !1, to = !1, Va = v(null), Br = v(0), Nt = v(null), Bt = null, Qe = v(0), mn = 0, be = null, Me = null, Ve = null, Hr = !1, Xa = !1, da = !1, Ur = 0, Sl = 0, Za = null, Ig = 0, El = {
        readContext: at,
        use: rr,
        useCallback: Ue,
        useContext: Ue,
        useEffect: Ue,
        useImperativeHandle: Ue,
        useLayoutEffect: Ue,
        useInsertionEffect: Ue,
        useMemo: Ue,
        useReducer: Ue,
        useRef: Ue,
        useState: Ue,
        useDebugValue: Ue,
        useDeferredValue: Ue,
        useTransition: Ue,
        useSyncExternalStore: Ue,
        useId: Ue,
        useHostTransitionStatus: Ue,
        useFormState: Ue,
        useActionState: Ue,
        useOptimistic: Ue,
        useMemoCache: Ue,
        useCacheRefresh: Ue
      };
      El.useEffectEvent = Ue;
      var df = {
        readContext: at,
        use: rr,
        useCallback: function(e, t) {
          return ht().memoizedState = [
            e,
            t === void 0 ? null : t
          ], e;
        },
        useContext: at,
        useEffect: au,
        useImperativeHandle: function(e, t, l) {
          l = l != null ? l.concat([e]) : null, sr(
            4194308,
            4,
            su.bind(null, t, e),
            l
          );
        },
        useLayoutEffect: function(e, t) {
          return sr(4194308, 4, e, t);
        },
        useInsertionEffect: function(e, t) {
          sr(4, 2, e, t);
        },
        useMemo: function(e, t) {
          var l = ht();
          t = t === void 0 ? null : t;
          var o = e();
          if (da) {
            H(!0);
            try {
              e();
            } finally {
              H(!1);
            }
          }
          return l.memoizedState = [o, t], o;
        },
        useReducer: function(e, t, l) {
          var o = ht();
          if (l !== void 0) {
            var u = l(t);
            if (da) {
              H(!0);
              try {
                l(t);
              } finally {
                H(!1);
              }
            }
          } else u = t;
          return o.memoizedState = o.baseState = u, e = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: e,
            lastRenderedState: u
          }, o.queue = e, e = e.dispatch = Xm.bind(
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
          e = Fi(e);
          var t = e.queue, l = gu.bind(
            null,
            be,
            t
          );
          return t.dispatch = l, [e.memoizedState, l];
        },
        useDebugValue: Pi,
        useDeferredValue: function(e, t) {
          var l = ht();
          return es(l, e, t);
        },
        useTransition: function() {
          var e = Fi(!1);
          return e = fu.bind(
            null,
            be,
            e.queue,
            !0,
            !1
          ), ht().memoizedState = e, [!1, e];
        },
        useSyncExternalStore: function(e, t, l) {
          var o = be, u = ht();
          if (Se) {
            if (l === void 0)
              throw Error(s(407));
            l = l();
          } else {
            if (l = t(), je === null)
              throw Error(s(349));
            (_e & 127) !== 0 || Lc(o, t, l);
          }
          u.memoizedState = l;
          var p = { value: l, getSnapshot: t };
          return u.queue = p, au(Qc.bind(null, o, p, e), [
            e
          ]), o.flags |= 2048, za(
            9,
            { destroy: void 0 },
            Yc.bind(
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
            var l = It, o = $t;
            l = (o & ~(1 << 32 - St(o) - 1)).toString(32) + l, t = "_" + t + "R_" + l, l = Ur++, 0 < l && (t += "H" + l.toString(32)), t += "_";
          } else
            l = Ig++, t = "_" + t + "r_" + l.toString(32) + "_";
          return e.memoizedState = t;
        },
        useHostTransitionStatus: ts,
        useFormState: Ic,
        useActionState: Ic,
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
          return t.queue = l, t = ns.bind(
            null,
            be,
            !0,
            l
          ), l.dispatch = t, [e, t];
        },
        useMemoCache: Ki,
        useCacheRefresh: function() {
          return ht().memoizedState = Vm.bind(
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
      }, no = {
        readContext: at,
        use: rr,
        useCallback: cu,
        useContext: at,
        useEffect: Ii,
        useImperativeHandle: ou,
        useInsertionEffect: ru,
        useLayoutEffect: iu,
        useMemo: uu,
        useReducer: ir,
        useRef: nu,
        useState: function() {
          return ir(rn);
        },
        useDebugValue: Pi,
        useDeferredValue: function(e, t) {
          var l = Ye();
          return du(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = ir(rn)[0], t = Ye().memoizedState;
          return [
            typeof e == "boolean" ? e : sl(e),
            t
          ];
        },
        useSyncExternalStore: Gc,
        useId: mu,
        useHostTransitionStatus: ts,
        useFormState: Pc,
        useActionState: Pc,
        useOptimistic: function(e, t) {
          var l = Ye();
          return Zc(l, Me, e, t);
        },
        useMemoCache: Ki,
        useCacheRefresh: hu
      };
      no.useEffectEvent = lu;
      var ff = {
        readContext: at,
        use: rr,
        useCallback: cu,
        useContext: at,
        useEffect: Ii,
        useImperativeHandle: ou,
        useInsertionEffect: ru,
        useLayoutEffect: iu,
        useMemo: uu,
        useReducer: Wi,
        useRef: nu,
        useState: function() {
          return Wi(rn);
        },
        useDebugValue: Pi,
        useDeferredValue: function(e, t) {
          var l = Ye();
          return Me === null ? es(l, e, t) : du(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = Wi(rn)[0], t = Ye().memoizedState;
          return [
            typeof e == "boolean" ? e : sl(e),
            t
          ];
        },
        useSyncExternalStore: Gc,
        useId: mu,
        useHostTransitionStatus: ts,
        useFormState: tu,
        useActionState: tu,
        useOptimistic: function(e, t) {
          var l = Ye();
          return Me !== null ? Zc(l, Me, e, t) : (l.baseState = e, [e, l.queue.dispatch]);
        },
        useMemoCache: Ki,
        useCacheRefresh: hu
      };
      ff.useEffectEvent = lu;
      var ao = {
        enqueueSetState: function(e, t, l) {
          e = e._reactInternals;
          var o = kt(), u = _n(o);
          u.payload = t, l != null && (u.callback = l), t = Sn(e, u, o), t !== null && (bt(t, e, o), ll(t, e, o));
        },
        enqueueReplaceState: function(e, t, l) {
          e = e._reactInternals;
          var o = kt(), u = _n(o);
          u.tag = 1, u.payload = t, l != null && (u.callback = l), t = Sn(e, u, o), t !== null && (bt(t, e, o), ll(t, e, o));
        },
        enqueueForceUpdate: function(e, t) {
          e = e._reactInternals;
          var l = kt(), o = _n(l);
          o.tag = 2, t != null && (o.callback = t), t = Sn(e, o, l), t !== null && (bt(t, e, l), ll(t, e, l));
        }
      }, lo = Error(s(461)), Xe = !1, ro = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, hn = !1, Ze = !1, io = !1, pf = typeof WeakSet == "function" ? WeakSet : Set, et = null, Ke = null, yt = !1, Xt = null, Ka = 8192, Pg = {
        getCacheForType: function(e) {
          var t = at(Be), l = t.data.get(e);
          return l === void 0 && (l = e(), t.data.set(e, l)), l;
        },
        cacheSignal: function() {
          return at(Be).controller.signal;
        }
      }, qr = 0, Gr = 1, Lr = 2, Yr = 3, Qr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var zl = Symbol.for;
        qr = zl("selector.component"), Gr = zl("selector.has_pseudo_class"), Lr = zl("selector.role"), Yr = zl("selector.test_id"), Qr = zl("selector.text");
      }
      var e0 = typeof WeakMap == "function" ? WeakMap : Map, we = 0, je = null, ke = null, _e = 0, Ae = 0, Tt = null, Dn = !1, Ja = !1, so = !1, gn = 0, qe = 0, Bn = 0, fa = 0, oo = 0, Ct = 0, Wa = 0, Nl = null, xt = null, co = !1, Vr = 0, mf = 0, Tl = 1 / 0, Xr = null, Hn = null, Fe = 0, Un = null, Fa = null, bn = 0, uo = 0, fo = null, hf = null, Cl = 0, po = null;
      return xe.attemptContinuousHydration = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = Pn(e, 67108864);
          t !== null && bt(t, e, 67108864), Ms(e, 67108864);
        }
      }, xe.attemptHydrationAtCurrentPriority = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = kt();
          t = j(t);
          var l = Pn(e, t);
          l !== null && bt(l, e, t), Ms(e, t);
        }
      }, xe.attemptSynchronousHydration = function(e) {
        switch (e.tag) {
          case 3:
            if (e = e.stateNode, e.current.memoizedState.isDehydrated) {
              var t = _(e.pendingLanes);
              if (t !== 0) {
                for (e.pendingLanes |= 2, e.entangledLanes |= 2; t; ) {
                  var l = 1 << 31 - St(t);
                  e.entanglements[1] |= l, t &= ~l;
                }
                Jt(e), (we & 6) === 0 && (Tl = vt() + 500, Ea(0));
              }
            }
            break;
          case 31:
          case 13:
            t = Pn(e, 2), t !== null && bt(t, e, 2), cd(), Ms(e, 2);
        }
      }, xe.batchedUpdates = function(e, t) {
        return e(t);
      }, xe.createComponentSelector = function(e) {
        return { $$typeof: qr, value: e };
      }, xe.createContainer = function(e, t, l, o, u, p, y, A, L, F) {
        return Nd(
          e,
          t,
          !1,
          null,
          l,
          o,
          p,
          null,
          y,
          A,
          L,
          F
        );
      }, xe.createHasPseudoClassSelector = function(e) {
        return { $$typeof: Gr, value: e };
      }, xe.createHydrationContainer = function(e, t, l, o, u, p, y, A, L, F, ne, P, le, ge) {
        return e = Nd(
          l,
          o,
          !0,
          e,
          u,
          p,
          A,
          ge,
          L,
          F,
          ne,
          P
        ), e.context = Td(null), l = e.current, o = kt(), o = j(o), u = _n(o), u.callback = t ?? null, Sn(l, u, o), t = o, e.current.lanes = t, O(e, t), Jt(e), e;
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
        return { $$typeof: Lr, value: e };
      }, xe.createTestNameSelector = function(e) {
        return { $$typeof: Yr, value: e };
      }, xe.createTextSelector = function(e) {
        return { $$typeof: Qr, value: e };
      }, xe.defaultOnCaughtError = function(e) {
        console.error(e);
      }, xe.defaultOnRecoverableError = function(e) {
        rf(e);
      }, xe.defaultOnUncaughtError = function(e) {
        rf(e);
      }, xe.deferredUpdates = function(e) {
        var t = de.T, l = fn();
        try {
          return Pe(32), de.T = null, e();
        } finally {
          Pe(l), de.T = t;
        }
      }, xe.discreteUpdates = function(e, t, l, o, u) {
        var p = de.T, y = fn();
        try {
          return Pe(2), de.T = null, e(t, l, o, u);
        } finally {
          Pe(y), de.T = p, we === 0 && (Tl = vt() + 500);
        }
      }, xe.findAllNodes = Ss, xe.findBoundingRects = function(e, t) {
        if (!bl) throw Error(s(363));
        t = Ss(e, t), e = [];
        for (var l = 0; l < t.length; l++)
          e.push(Dh(t[l]));
        for (t = e.length - 1; 0 < t; t--) {
          l = e[t];
          for (var o = l.x, u = o + l.width, p = l.y, y = p + l.height, A = t - 1; 0 <= A; A--)
            if (t !== A) {
              var L = e[A], F = L.x, ne = F + L.width, P = L.y, le = P + L.height;
              if (o >= F && p >= P && u <= ne && y <= le) {
                e.splice(t, 1);
                break;
              } else if (o !== F || l.width !== L.width || le < p || P > y) {
                if (!(p !== P || l.height !== L.height || ne < o || F > u)) {
                  F > o && (L.width += F - o, L.x = o), ne < u && (L.width = u - F), e.splice(t, 1);
                  break;
                }
              } else {
                P > p && (L.height += P - p, L.y = p), le < y && (L.height = y - P), e.splice(t, 1);
                break;
              }
            }
        }
        return e;
      }, xe.findHostInstance = Cd, xe.findHostInstanceWithNoPortals = function(e) {
        return e = d(e), e = e !== null ? h(e) : null, e === null ? null : gl(e.stateNode);
      }, xe.findHostInstanceWithWarning = function(e) {
        return Cd(e);
      }, xe.flushPassiveEffects = hl, xe.flushSyncFromReconciler = function(e) {
        var t = we;
        we |= 1;
        var l = de.T, o = fn();
        try {
          if (Pe(2), de.T = null, e)
            return e();
        } finally {
          Pe(o), de.T = l, we = t, (we & 6) === 0 && Ea(0);
        }
      }, xe.flushSyncWork = cd, xe.focusWithin = function(e, t) {
        if (!bl) throw Error(s(363));
        for (e = ws(e), t = rd(e, t), t = Array.from(t), e = 0; e < t.length; ) {
          var l = t[e++], o = l.tag;
          if (!vl(l)) {
            if ((o === 5 || o === 26 || o === 27) && Uh(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
          }
        }
        return !1;
      }, xe.getFindAllNodesFailureDescription = function(e, t) {
        if (!bl) throw Error(s(363));
        var l = 0, o = [];
        e = [ws(e), 0];
        for (var u = 0; u < e.length; ) {
          var p = e[u++], y = p.tag, A = e[u++], L = t[A];
          if ((y !== 5 && y !== 26 && y !== 27 || !vl(p)) && (ks(p, L) && (o.push(_s(L)), A++, A > l && (l = A)), A < t.length))
            for (p = p.child; p !== null; )
              e.push(p, A), p = p.sibling;
        }
        if (l < t.length) {
          for (e = []; l < t.length; l++)
            e.push(_s(t[l]));
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
            return gl(e.child.stateNode);
          default:
            return e.child.stateNode;
        }
      }, xe.injectIntoDevTools = function() {
        var e = {
          bundleType: 0,
          version: ph,
          rendererPackageName: mh,
          currentDispatcherRef: de,
          reconcilerVersion: "19.2.0"
        };
        if (Dd !== null && (e.rendererConfig = Dd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") e = !1;
        else {
          var t = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (t.isDisabled || !t.supportsFiber) e = !0;
          else {
            try {
              yl = t.inject(e), Et = t;
            } catch {
            }
            e = !!t.checkDCE;
          }
        }
        return e;
      }, xe.isAlreadyRendering = function() {
        return (we & 6) !== 0;
      }, xe.observeVisibleRects = function(e, t, l, o) {
        if (!bl) throw Error(s(363));
        e = Ss(e, t);
        var u = qh(
          e,
          l,
          o
        ).disconnect;
        return {
          disconnect: function() {
            u();
          }
        };
      }, xe.shouldError = function() {
        return null;
      }, xe.shouldSuspend = function() {
        return !1;
      }, xe.startHostTransition = function(e, t, l, o) {
        if (e.tag !== 5) throw Error(s(476));
        var u = pu(e).queue;
        fu(
          e,
          u,
          t,
          Ra,
          l === null ? i : function() {
            var p = pu(e);
            return p.next === null && (p = e.alternate.memoizedState), ol(
              e,
              p.next.queue,
              {},
              kt()
            ), l(o);
          }
        );
      }, xe.updateContainer = function(e, t, l, o) {
        var u = t.current, p = kt();
        return Ad(
          u,
          p,
          e,
          t,
          l,
          o
        ), p;
      }, xe.updateContainerSync = function(e, t, l, o) {
        return Ad(
          t.current,
          2,
          e,
          t,
          l,
          o
        ), 2;
      }, xe;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(bo)), bo.exports;
}
var Tf;
function j0() {
  return Tf || (Tf = 1, go.exports = R0()), go.exports;
}
var O0 = j0();
const D0 = /* @__PURE__ */ Io(O0);
var xo = { exports: {} }, vn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Cf;
function B0() {
  return Cf || (Cf = 1, vn.ConcurrentRoot = 1, vn.ContinuousEventPriority = 8, vn.DefaultEventPriority = 32, vn.DiscreteEventPriority = 2, vn.IdleEventPriority = 268435456, vn.LegacyRoot = 0, vn.NoEventPriority = 0), vn;
}
var Af;
function H0() {
  return Af || (Af = 1, xo.exports = B0()), xo.exports;
}
var Ll = H0();
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
const Tp = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Mo = 16, Po = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), U0 = [
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
], Mf = {
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
}, q0 = /* @__PURE__ */ new Set([
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
]), Cp = {
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
}, Ap = {
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
}, Ro = ["font-size", "color", ...new Set([...Object.keys(Cp), ...Object.keys(Ap)].filter((n) => n !== "font-size" && n !== "color"))], G0 = new Set(Ro);
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
function jo(n, a, r = 0) {
  if (r > 32) return null;
  let i = "", s = 0;
  for (; ; ) {
    const c = n.indexOf("var(", s);
    if (c < 0)
      return i += n.slice(s), i;
    i += n.slice(s, c);
    let f = 1, d = c + 4;
    for (; d < n.length && f; d++)
      n[d] === "(" ? f++ : n[d] === ")" && f--;
    const m = n.slice(c + 4, d - 1), h = ct(m, ","), x = h[0].trim(), g = h.length > 1 ? m.slice(m.indexOf(",") + 1).trim() : null;
    let v = a(x);
    if ((v == null || v === "initial") && (v = g), v == null) return null;
    const E = jo(v, a, r + 1);
    if (E === null) return null;
    i += E, s = d;
  }
}
function L0(n) {
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
function Zn(n, a) {
  const r = L0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!r) return null;
  let i = 0;
  const s = ({ num: v, unit: E }) => {
    switch (E) {
      case "":
        return { px: 0, pct: 0, num: v, unitless: !0 };
      case "px":
        return { px: v, pct: 0, num: 0 };
      case "rem":
        return { px: v * Mo, pct: 0, num: 0 };
      case "em":
        return { px: v * (a.fontSize ?? Mo), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: v, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: v / 100 * (a.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: v / 100 * (a.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: v * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, c = (v, E, S) => v && E ? { px: v.px + S * E.px, pct: v.pct + S * E.pct, num: v.num + S * E.num, unitless: v.unitless && E.unitless } : null, f = (v, E) => v ? { px: v.px * E, pct: v.pct * E, num: v.num * E, unitless: v.unitless } : null, d = (v) => v && v.unitless;
  function m() {
    const v = r[i++];
    if (!v) return null;
    if (v.num !== void 0) return s(v);
    if (v.op === "(") {
      const E = x();
      return r[i]?.op !== ")" ? null : (i++, E);
    }
    if (v.op === "-" || v.op === "+") {
      const E = m();
      return v.op === "-" ? f(E, -1) : E;
    }
    if (v.fn) {
      const E = [];
      for (; ; ) {
        E.push(x());
        const _ = r[i++];
        if (!_) return null;
        if (_.op === ")") break;
        if (_.op !== ",") return null;
      }
      if (E.some((_) => !_)) return null;
      if (v.fn === "calc") return E[0];
      if (!(E.every((_) => !_.pct) || E.every((_) => !_.px && !_.num))) return null;
      const z = (_) => _.px + _.pct + _.num;
      return v.fn === "min" ? E.reduce((_, N) => z(N) < z(_) ? N : _) : v.fn === "max" ? E.reduce((_, N) => z(N) > z(_) ? N : _) : v.fn === "clamp" && E.length === 3 ? z(E[1]) < z(E[0]) ? E[0] : z(E[1]) > z(E[2]) ? E[2] : E[1] : null;
    }
    return null;
  }
  function h() {
    let v = m();
    for (; r[i] && (r[i].op === "*" || r[i].op === "/"); ) {
      const E = r[i++].op, S = m();
      if (!v || !S) return null;
      E === "*" ? v = d(S) ? f(v, S.num) : d(v) ? f(S, v.num) : null : v = d(S) && S.num !== 0 ? f(v, 1 / S.num) : null;
    }
    return v;
  }
  function x() {
    let v = h();
    for (; r[i] && (r[i].op === "+" || r[i].op === "-"); ) {
      const E = r[i++].op;
      v = c(v, h(), E === "-" ? -1 : 1);
    }
    return v;
  }
  const g = x();
  return i !== r.length || !g ? null : g;
}
function Oo(n, a) {
  const r = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(r))
    return r === "thin" ? { px: 1 } : r === "medium" ? { px: 3 } : r === "thick" ? { px: 5 } : r;
  const i = Zn(r, a);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: Y0(i.px) } : { expr: n.trim() };
}
const Y0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Kr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Q0 = ([n, a, r, i]) => `#${Kr(n)}${Kr(a)}${Kr(r)}${Kr(i * 255)}`;
function Rf(n) {
  const a = n.slice(1), r = a.length <= 4 ? a.split("").map((s) => s + s).join("") : a;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(r)) return null;
  const i = (s) => parseInt(r.slice(s, s + 2), 16);
  return [i(0), i(2), i(4), r.length === 8 ? i(6) / 255 : 1];
}
function fi(n, a) {
  const r = n.trim().toLowerCase();
  if (r === "currentcolor") return "currentcolor";
  const i = /^perchtoken\(([a-z0-9-]+)\)$/.exec(r);
  if (i) {
    const h = a(i[1]), x = h && Rf(h);
    return x ? { rgba: x, token: i[1] } : null;
  }
  if (r.startsWith("#")) {
    const h = Rf(r);
    return h ? { rgba: h, token: null } : null;
  }
  if (Mf[r]) return { rgba: [...Mf[r]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(r);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const h = ct(s[2], ",");
    if (h.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(h[0])) return null;
    const x = (H) => {
      const Z = ct(H), $ = Z.findIndex((I) => /%$/.test(I)), Q = $ >= 0 ? parseFloat(Z[$]) / 100 : null;
      return { color: fi(Z.filter((I, Y) => Y !== $).join(" "), a), pct: Q };
    }, g = x(h[1]), v = x(h[2]);
    if (!g.color || !v.color || g.color === "currentcolor" || v.color === "currentcolor") return null;
    let E = g.pct, S = v.pct;
    E === null && S === null ? (E = 0.5, S = 0.5) : E === null ? E = 1 - S : S === null && (S = 1 - E);
    const z = E + S, _ = z < 1 ? z : 1;
    E /= z, S /= z;
    const [N, B, R, X] = g.color.rgba, [q, O, b, w] = v.color.rgba, k = X * E + w * S, C = (H, Z) => k === 0 ? 0 : (H * X * E + Z * w * S) / k, j = [C(N, q), C(B, O), C(R, b), k * _], M = w === 0 ? g.color.token : X === 0 ? v.color.token : null;
    return { rgba: j, token: M };
  }
  const c = s[2].includes(",") ? ct(s[2], ",") : ct(s[2].replace("/", " / ")).filter((h) => h !== "/");
  if (c.length < 3) return null;
  const f = (h) => h.endsWith("%") ? parseFloat(h) / 100 * 255 : parseFloat(h), d = c[3] === void 0 ? 1 : c[3].endsWith("%") ? parseFloat(c[3]) / 100 : parseFloat(c[3]), m = [f(c[0]), f(c[1]), f(c[2]), d];
  return m.some((h) => Number.isNaN(h)) ? null : { rgba: m, token: null };
}
const Dl = ["top", "right", "bottom", "left"], V0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Jr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], jf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Do(n, a) {
  const r = a.trim(), i = () => ct(r);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Jr(i());
      return Dl.map((c, f) => [`${n}-${c}`, s[f]]);
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
      const s = Jr(i());
      return Dl.map((c, f) => [c, s[f]]);
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
      const s = n.split("-")[1], c = Jr(i());
      return Dl.map((f, d) => [`border-${f}-${s}`, c[d]]);
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
      const s = n === "border" ? Dl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let c = "medium", f = "none", d = "currentcolor";
      if (r !== "none" && r !== "0")
        for (const m of i())
          jf.has(m) ? f = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? c = m : d = m;
      else r === "0" && (c = "0");
      return s.flatMap((m) => [[`border-${m}-width`, c], [`border-${m}-style`, f], [`border-${m}-color`, d]]);
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
      const s = Jr(ct(r.split("/")[0]));
      return V0.map((c, f) => [`border-${c}-radius`, s[f]]);
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
      return r === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : fi(r, () => "#000000") ? [["background-color", r], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", r]];
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
      return Do("gap", r);
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
      const s = i(), c = s.filter((d) => /^[\d.]+$/.test(d)), f = s.find((d) => !/^[\d.]+$/.test(d));
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
      for (const d of i())
        jf.has(d) || d === "auto" ? c = d : /^(thin|medium|thick|-?[\d.]|calc\()/.test(d) ? s = d : f = d;
      return [["outline-width", s], ["outline-style", c], ["outline-color", f]];
    }
    case "transition": {
      if (r === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ct(r, ","), c = s.map((d) => ct(d).find((m) => !/^[\d.]+m?s$/.test(m) && !/^(ease|linear|step|cubic)/.test(m)) ?? "all"), f = s.map((d) => ct(d).find((m) => /^[\d.]+m?s$/.test(m)) ?? "0s");
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
function X0(n, a) {
  return n ? ct(n, ",").some((r) => {
    let i = r.trim().toLowerCase(), s = !1;
    i.startsWith("not ") && (s = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const c = i.split(/\s+and\s+/).every((f) => {
      if (f = f.trim(), f === "all" || f === "screen") return !0;
      if (f === "print") return !1;
      const d = /^\((.+)\)$/.exec(f);
      if (!d) return !1;
      const m = d[1].trim(), h = /^([a-z-]+)\s*:\s*(.+)$/.exec(m);
      if (h) {
        const [, g, v] = h, E = (S) => {
          const z = Oo(S, { viewport: a });
          return typeof z == "object" && "px" in z ? z.px : NaN;
        };
        switch (g) {
          case "min-width":
            return a.width >= E(v);
          case "max-width":
            return a.width <= E(v);
          case "min-height":
            return a.height >= E(v);
          case "max-height":
            return a.height <= E(v);
          case "hover":
          case "any-hover":
            return v.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return v.trim() === "fine";
          case "prefers-reduced-motion":
            return v.trim() === "no-preference";
          case "prefers-color-scheme":
            return v.trim() === (a.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const x = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(m);
      if (x) {
        const g = x[1] === "width" ? a.width : a.height, v = Oo(x[3], { viewport: a }), E = typeof v == "object" && "px" in v ? v.px : NaN;
        switch (x[2]) {
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
function Z0(n, a) {
  const r = a[a.length - 1].compound;
  return ec(r)[0] ?? n;
}
function K0(n) {
  const a = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = (s, c) => {
    s.forEach(({ compound: f }, d) => {
      const m = c && d === s.length - 1;
      for (const h of f.pseudos)
        if (Po.has(h.name) && (m ? a : r).add(h.name), h.list && h.name !== "not") for (const x of h.list) i(x, m);
    });
  };
  return i(n, !0), { subject: a, ancestor: r };
}
function ec(n) {
  const a = [...n.classes];
  for (const r of n.pseudos)
    if (!(r.name !== "is" && r.name !== "where"))
      for (const i of r.list) i.length === 1 && a.push(...ec(i[0].compound));
  return a;
}
function J0(n, a) {
  const r = (i, s) => {
    i.forEach(({ compound: c }, f) => {
      const d = s && f === i.length - 1, m = c.pseudos.filter((h) => Po.has(h.name)).map((h) => h.name);
      if (!d) for (const h of m) for (const x of ec(c)) a.add(`${h}:${x}`);
      for (const h of c.pseudos) if (h.list && h.name !== "not") for (const x of h.list) r(x, d);
    });
  };
  r(n, !0);
}
class W0 {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const r = (c, f) => {
      const d = f[f.length - 1].compound, m = d.classes.length ? `.${d.classes[0]}` : d.tag && d.tag !== "*" ? d.tag : "*";
      this.index.has(m) || this.index.set(m, []), this.index.get(m).push(c);
    };
    let i = 0;
    const s = (c, f) => {
      for (const [d, m, h, x] of c)
        for (const g of Wo(d)) {
          let v;
          try {
            v = Fo(g);
          } catch (_) {
            if (_ instanceof ot) {
              this.skipped++;
              continue;
            }
            throw _;
          }
          const E = K0(v);
          J0(v, this.trackedStates);
          const S = v[v.length - 1].compound.pseudoElement, z = { steps: v, media: m, layer: h, origin: f, order: i++, specificity: vp(v), decls: x, states: E, pseudo: S, own: P0(v), above: $0(v), source: f === 0 ? `ua:${v[v.length - 1].compound.tag ?? "*"}` : Z0(g, v) };
          this.rules.push(z), r(z, v);
        }
    };
    s(U0.map(([c, f]) => [c, null, 0, Object.entries(f)]), 0), s(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, r = null) {
    const i = `${a.tagName} ${a.className}|${r ?? ""}`, s = this.candidateCache.get(i);
    if (s) return s;
    const c = [], f = /* @__PURE__ */ new Set(), d = (m) => {
      if (m) for (const h of m) !f.has(h) && h.pseudo === r && (f.add(h), c.push(h));
    };
    for (const m of a.classList) d(this.index.get(`.${m}`));
    return d(this.index.get(a.tagName)), d(this.index.get("*")), this.candidateCache.set(i, c), c;
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
      for (const d of f ?? []) {
        if (s.has(d)) continue;
        s.add(d);
        const m = d.reads ??= Rp(d.steps);
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
const F0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function $0(n) {
  const a = [];
  for (let r = n.length - 1; r > 0 && !(n[r].combinator !== " " && n[r].combinator !== ">"); r--)
    a.push(...n[r - 1].compound.classes);
  return a;
}
function Mp(n) {
  const a = n.parentElement;
  if (!a) return I0;
  const r = Mp(a), i = n.aboveCache;
  if (i && i.parent === a && i.name === a.className && i.base === r) return i.set;
  const s = a.classSet, c = s.size === 0 ? r : /* @__PURE__ */ new Set([...r, ...s]);
  return n.aboveCache = { parent: a, name: a.className, base: r, set: c }, c;
}
const I0 = /* @__PURE__ */ new Set();
function P0(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((r) => Po.has(r.name) && r.name !== "focus-within");
}
function Rp(n, a = !0, r = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((i, s) => {
    const c = a && s === n.length - 1;
    c || (r.anc = !0);
    for (const f of i.compound.pseudos)
      if (F0.has(f.name) && (c ? r.pos = !0 : r.ancPos = !0, f.name === "nth-child" && c && (r.nth = !0)), f.list && f.name !== "has") for (const d of f.list) Rp(d, c, r);
  }), r;
}
const eb = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function tb(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [r, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = r.startsWith("--") ? r : r.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), c = typeof i == "number" && i !== 0 && !eb.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    a.push([s, c]);
  }
  return a;
}
function nb(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const r of ["width", "height"]) {
    const i = n.getAttribute(r);
    i !== null && a.push([r, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return a;
}
const ab = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class lb {
  constructor(a, { theme: r, viewport: i }) {
    this.sheet = a, this.theme = r, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const r of a.media) {
      let i = this.media.get(r);
      if (i === void 0 && this.media.set(r, i = X0(r, this.viewport)), !i) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, r, i = null) {
    const c = { state: (g, v, E) => {
      if (v === "disabled") return !!g.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(g.tagName);
      if (v === "enabled") return !g.props?.disabled && ["button", "input", "select", "textarea"].includes(g.tagName);
      if (v === "checked") return !!g.props?.checked;
      if (r === "*") return !0;
      if (v === "focus-within") {
        const S = g.ownerDocument?.activeElement;
        return !!S && S !== g.ownerDocument.body && typeof g.contains == "function" && g.contains(S);
      }
      return E ? r.has(v) : v === "focus-visible" ? !!g.state?.focus && !g.state?.pointerFocus : !!g.state?.[v];
    }, pseudo: i }, f = this.sheet.candidates(a, i), d = `${a.tagName} ${a.className}|${i ?? ""}|${r === "*" ? "*" : [...r].sort().join(",")}`;
    let m = this.ownMatches.get(d);
    m || (m = new Set(f.filter((g) => g.own && this.mediaHolds(g) && zo(a, g.steps, c))), this.ownMatches.set(d, m));
    let h = null;
    const x = (g) => g.above.length ? (h ??= Mp(a), g.above.every((v) => h.has(v))) : !0;
    return f.filter((g) => g.own ? m.has(g) : this.mediaHolds(g) && x(g) && zo(a, g.steps, c));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, r, i = /* @__PURE__ */ new Set(), s = null) {
    const c = this.matching(a, i, s), f = s ? [] : nb(a), d = s ? [] : tb(a.inlineStyle ?? a.props?.style);
    let m = this.rootComputed;
    r && (m = this.computed.get(r.values), m || this.computed.set(r.values, m = /* @__PURE__ */ new Map()));
    const h = `${c.map((g) => g.order).join(",")}|${f.length ? JSON.stringify(f) : ""}|${d.length ? JSON.stringify(d) : ""}`;
    let x = m.get(h);
    return x || m.set(h, x = this.cascade(c, f, d, r)), { ...x, rules: c, element: a };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, r, i, s) {
    const c = [];
    for (const b of a)
      for (const [w, k, C] of b.decls) c.push({ prop: w, value: k, important: C ? 1 : 0, origin: b.origin === 0 ? 0 : 2, layer: b.layer, specificity: b.specificity, order: b.order, source: b.source });
    for (const [b, w] of r) c.push({ prop: b, value: w, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${b}` });
    for (const [b, w] of i) c.push({ prop: b, value: w, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    c.sort(ab);
    const f = this.sheet.properties, d = Object.create(s?.customs ?? null), m = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map();
    for (const b of c) b.prop.startsWith("--") && h.set(b.prop, b.value);
    if (!s && this.theme) for (const b of Tp) this.theme[b] && h.set(`--${b}`, `perchtoken(${b})`);
    const x = (b) => {
      if (m.has(b)) return m.get(b);
      const w = f[b];
      return w && !w.inherits ? w.initial ?? null : b in d ? d[b] : w?.initial ?? null;
    }, g = /* @__PURE__ */ new Set(), v = (b) => {
      if (!h.has(b)) return x(b);
      if (g.has(b)) return null;
      g.add(b);
      const w = jo(h.get(b), v);
      return g.delete(b), h.delete(b), m.set(b, w), (!f[b] || f[b].inherits) && (d[b] = w), w;
    };
    for (const b of [...h.keys()]) v(b);
    const E = /* @__PURE__ */ new Map();
    for (const b of c) {
      if (b.prop.startsWith("--")) continue;
      const w = jo(b.value, x);
      if (w === null) {
        for (const [k] of Do(b.prop, "unset")) E.set(k, { value: "unset", source: b.source, origin: b.origin });
        continue;
      }
      for (const [k, C] of Do(b.prop, w)) E.set(k, { value: C, source: b.source, origin: b.origin });
    }
    const S = {}, z = {}, _ = /* @__PURE__ */ new Set(), N = /* @__PURE__ */ new Set(), B = s?.values, R = { fontSize: B?.["font-size"] ?? Mo, viewport: this.viewport }, X = (b, w) => {
      if (/currentcolor/i.test(w)) return this.parseValue(b, w, R, S, B);
      const k = `${b}\0${w}\0${R.fontSize}`;
      let C = this.parsed.get(k);
      return C === void 0 && this.parsed.set(k, C = this.parseValue(b, w, R, S, B)), C;
    }, q = E.size ? [...Ro, ...[...E.keys()].filter((b) => !G0.has(b))] : Ro;
    for (const b of q) {
      const w = E.get(b);
      let k = w?.value;
      const C = q0.has(b);
      if ((k === void 0 || k === "unset" || k === "revert" || k === "revert-layer") && (k = C ? "inherit" : "initial"), w && (z[b] = w.source, w.origin !== 0 && _.add(b)), k === "inherit" && B && b in B) {
        S[b] = B[b], N.add(b);
        continue;
      }
      (k === "inherit" || k === "initial") && (k = C ? Ap[b] : Cp[b]), S[b] = X(b, k), b === "font-size" && (R.fontSize = S["font-size"]);
    }
    for (const b of Dl) {
      const w = S[`border-${b}-style`];
      (w === "none" || w === "hidden") && (S[`border-${b}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const O = B?.display;
    return (O === "flex" || O === "inline-flex" || O === "grid" || O === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = Of(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = Of(S.display)), { values: S, sources: z, own: _, inherited: N, customs: d };
  }
  parseValue(a, r, i, s, c) {
    const f = String(r).trim();
    switch (a) {
      case "font-size": {
        const d = f.toLowerCase(), m = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (m[d]) return m[d];
        if (d === "smaller") return i.fontSize / 1.2;
        if (d === "larger") return i.fontSize * 1.2;
        const h = Zn(d, { fontSize: i.fontSize, viewport: i.viewport });
        return !h || h.num ? i.fontSize : h.px + h.pct / 100 * i.fontSize;
      }
      case "font-weight": {
        const d = f.toLowerCase();
        if (d === "normal") return 400;
        if (d === "bold") return 700;
        if (d === "bolder") return (c?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (d === "lighter") return (c?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const m = parseFloat(d);
        return Number.isFinite(m) ? m : 400;
      }
      case "line-height": {
        const d = f.toLowerCase();
        if (d === "normal") return { normal: !0 };
        const m = Zn(d, { fontSize: i.fontSize, viewport: i.viewport });
        return m ? m.unitless ? { factor: m.num } : { px: m.px + m.pct / 100 * i.fontSize } : { normal: !0 };
      }
      case "font-family":
        return f;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const d = f.endsWith("%") ? parseFloat(f) / 100 : parseFloat(f);
        return Number.isFinite(d) ? d : parseFloat(a === "flex-shrink" || a === "opacity" ? 1 : 0);
      }
      case "color": {
        const d = fi(f, (m) => this.themeHex(m));
        return d === "currentcolor" || !d ? c?.color ?? { rgba: [0, 0, 0, 1], token: null } : d;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const d = fi(f, (m) => this.themeHex(m));
        return d === "currentcolor" ? s.color : d ?? { rgba: [0, 0, 0, 0], token: null, unreadable: f };
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
        return Oo(f, i);
      default:
        return f.toLowerCase().startsWith("var(") ? f : /^[a-z-]+$/i.test(f) ? f.toLowerCase() : f;
    }
  }
}
function Of(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const pi = (n) => n && n.rgba ? { value: Q0(n.rgba), token: n.token ?? null } : null, rb = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function ib(n, a) {
  const r = a?.(n);
  if (Number.isFinite(r)) return r;
  const i = Math.round(n * 100) / 100;
  return rb[i] ?? Math.round(n * 1.2);
}
function Ul(n, a) {
  const r = n["line-height"], i = n["font-size"];
  return r.normal ? ib(i, a) : r.factor !== void 0 ? r.factor * i : r.px;
}
const sb = (n) => ct(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const ob = "perch-native-description/1", nn = Symbol("display"), mi = {
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
}, cb = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of cb) mi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
mi.rounded = 0;
const ub = /* @__PURE__ */ new Set([
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
]), db = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, fb = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, pb = (n) => fb.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : db.test(n) ? ".SystemUIFont" : sb(n).split(",")[0].trim(), mb = {
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
}, Df = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, tc = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const r = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (r) return `${n.tagName}.${r}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${tc(i)} > ${n.tagName}` : n.tagName;
};
class hb {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(a, r, i, s, c, f = "") {
    const d = `${a}|${r}|${i}|${s}`, m = this.map.get(d);
    if (m) {
      !m.elements.includes(c) && m.elements.length < 4 && m.elements.push(c), m.count++;
      return;
    }
    this.map.set(d, { kind: a, property: r, value: String(i), class: s ?? null, elements: [c], count: 1, ...f ? { note: f } : {} });
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
}, gb = /^(text|search|url|email|tel|password|number)$/, bb = 162.13 / 12.8;
function vb(n, a) {
  const r = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!r) return;
  const i = ct(r[1], ",").map((s) => Zn(s.trim(), { fontSize: a })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function yb(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const r = Zn(n.expr, { fontSize: a["font-size"] }), i = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!r && !r.num && r.pct === 100 && Math.abs(r.px + i) < 0.01;
}
function jp(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), s = i && ct(i[2], ",").map((c) => c.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const r = n.translate;
  if (r && r !== "none") {
    const i = ct(String(r).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Zn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Bf(n, a, r, i = !1) {
  const s = n.values, c = jp(s);
  if (c?.length === 0) return;
  const f = s.transform && s.transform !== "none" ? "transform" : "translate", d = { fontSize: s["font-size"] }, m = (g, v) => {
    const E = Zn(g, d);
    if (!(!E || E.unitless && E.num))
      return E.pct ? typeof v == "number" ? E.px + E.pct / 100 * v : void 0 : E.px;
  }, h = c ? m(c[0], a.w) : void 0, x = c ? m(c[1], a.h) : void 0;
  if (h === void 0 || x === void 0) {
    const g = !i && c ? c.map((v) => Zn(v, d)) : null;
    if (g?.every((v) => v && !(v.unitless && v.num))) {
      a[Op] = g.map((v) => [v.px, v.pct ?? 0]);
      return;
    }
    r("unsupported", f, s[f], n.sources[f]);
    return;
  }
  if (i) {
    h && (a.left = h), x && (a.top = x);
    return;
  }
  h && (a.ml = (a.ml ?? 0) + h), x && (a.mt = (a.mt ?? 0) + x);
}
const Op = Symbol("perch.shift");
function xb(n, a, r) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[f, d], [m, h]] = r, x = f + d / 100 * s.width, g = m + h / 100 * s.height;
    x && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + x), g && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + g);
  }
  const c = s ? `${s.width}x${s.height}` : "";
  c === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < _p && i?.retries && (n.shiftSeen = c, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function li(n, a, r = null) {
  const i = n.values, s = {}, c = (R) => n.sources[R], f = (R) => n.sources[R] !== void 0, d = i.display;
  d === "none" ? s.display = "hidden" : d === "flex" || d === "inline-flex" ? s.display = "flex" : (d === "grid" || d === "inline-grid") && (s.display = "flex", s.flex_direction = "col", a("approximated", "display", d, c("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && a("unsupported", "grid-template-columns", i["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const m = s.display === "flex";
  if (m && s.flex_direction !== "col") {
    const R = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = R;
  }
  if (m) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const R = d === "grid" || d === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    X && (s.items = X);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (R) {
      const w = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      w && (s.items = w), i["align-items"] === "center" && (q = "center");
    }
    q && (s.justify = q);
    const O = xn(i["row-gap"]), b = xn(i["column-gap"]);
    typeof O == "number" && O && (s.gap_y = O), typeof b == "number" && b && !R && (s.gap_x = b);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const h = xn(i["flex-basis"]);
  h !== void 0 && h !== "auto" && (s.flex_basis = h);
  const x = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  x && (s.self = x);
  for (const [R, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = i[X], O = xn(q);
    if (O === void 0 && X === "width" && yb(q, i)) {
      s.self = "stretch", a("approximated", X, q.expr, c(X), "stretched across its parent, inside its margins");
      continue;
    }
    const b = O === void 0 && /^max-/.test(X) ? vb(q, i["font-size"]) : void 0;
    if (b !== void 0) {
      s[R] = b, a("approximated", X, q.expr, c(X), "the fixed bound of min()");
      continue;
    }
    if (O === void 0) {
      typeof q == "object" && q.expr ? a("unsupported", X, q.expr, c(X), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && a("unsupported", X, q, c(X));
      continue;
    }
    O !== "auto" && (s[R] = O);
  }
  const g = ["top", "right", "bottom", "left"];
  for (const R of g) {
    const X = R[0];
    for (const [q, O] of [["p", "padding"], ["m", "margin"]]) {
      const b = i[`${O}-${R}`], w = xn(b);
      if (w === void 0) {
        b?.expr && a("unsupported", `${O}-${R}`, b.expr, c(`${O}-${R}`), "no calc() in the engine");
        continue;
      }
      w !== 0 && (s[`${q}${X}`] = w);
    }
  }
  const v = i.position;
  if (v === "absolute" || v === "fixed") {
    s.position = "absolute", v === "fixed" && a("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const R of g) {
      const X = xn(i[R]);
      X !== void 0 && X !== "auto" && (s[R] = X);
    }
    if (v === "fixed" && r && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const R = r.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, R) : R;
    }
    Bf(n, s, a);
  } else v === "sticky" ? a("unsupported", "position", "sticky", c("position")) : jp(i)?.length !== 0 && (s.position = "relative", Bf(n, s, a, !0));
  i["z-index"] !== "auto" && f("z-index") && a("unsupported", "z-index", i["z-index"], c("z-index"), "paint order is tree order");
  for (const [R, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = i[X];
    q === "hidden" || q === "clip" ? s[R] = "hidden" : (q === "auto" || q === "scroll") && (s[R] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const E = i["background-color"];
  E?.unreadable ? a("unsupported", "background-color", E.unreadable, c("background-color")) : E?.rgba && E.rgba[3] > 0 && (s.bg = pi(E)), i["background-image"] && i["background-image"] !== "none" && a("unsupported", "background-image", i["background-image"], c("background-image"));
  const S = g.map((R) => xn(i[`border-${R}-width`]) || 0), z = [];
  g.forEach((R, X) => {
    if (!S[X]) return;
    s[`border_${R[0]}`] = S[X];
    const q = i[`border-${R}-style`];
    q !== "solid" && a("approximated", `border-${R}-style`, q, c(`border-${R}-style`), "drawn solid");
    const O = pi(i[`border-${R}-color`]);
    O && z.push(O);
  }), z.length && (s.border_color = z[0], z.some((R) => R.value !== z[0].value) && a("approximated", "border-color", z.map((R) => R.value).join(" "), c("border-top-color"), "one border colour"));
  const _ = (R) => {
    const X = xn(i[`border-${R}-radius`]) || 0;
    if (typeof X != "string") return X;
    const q = parseFloat(X) / 100, O = [s.w, s.h].filter((b) => typeof b == "number");
    return X === "auto" || !(q > 0) ? 0 : O.length ? Math.round(Math.min(q, 0.5) * Math.min(...O) * 100) / 100 : 9999;
  }, N = ["top-left", "top-right", "bottom-right", "bottom-left"].map(_);
  N.every((R) => R === N[0]) ? N[0] && (s.rounded = N[0]) : ["tl", "tr", "br", "bl"].forEach((R, X) => {
    N[X] && (s[`rounded_${R}`] = N[X]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const B = i["box-shadow"];
  if (B && B !== "none" && ct(B, ",").some((R) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(R.trim())) && (s.shadow = "lg", a("approximated", "box-shadow", B, c("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const R = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    R ? s.cursor = R : a("unsupported", "cursor", i.cursor, c("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && a("unsupported", "text-decoration-line", i["text-decoration-line"], c("text-decoration-line")), s;
}
const wb = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Dp(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((r) => wb[r]);
  return a.every(Boolean) ? a.join(",") : null;
}
function ri(n, a) {
  const r = n.values, i = r["line-height"];
  return {
    text_color: pi(r.color),
    text_size: Math.round(r["font-size"] * 1e3) / 1e3,
    font_features: Dp(r["font-variant-numeric"]) ?? "",
    font_weight: r["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(Ul(r, a) * 1e3) / 1e3 },
    font_family: pb(r["font-family"]),
    italic: r["font-style"] === "italic" || r["font-style"] === "oblique",
    whitespace: r["white-space"] === "nowrap" || r["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[r["text-align"]] ?? "left"
  };
}
const Hf = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, nc = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function ii(n, a, r) {
  const i = {}, s = (d, m) => m.some((h) => !n.inherited.has(h));
  for (const [d, m] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(d, m) || !nc(a[d], r[d])) && (i[d] = a[d]);
  const c = Hf(a.line_height, a.text_size), f = r.line_height ? Hf(r.line_height, a.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(c - f) <= 1e-3)) && (i.line_height = a.line_height), i;
}
const kb = (n, a) => ({ ...n, ...a });
function si(n, a) {
  const r = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (r[i] = s.value, s.token && (a[i] = s.token)) : i === "line_height" ? r[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (r.italic = !0) : r[i] = s;
  return r.italic === !1 && delete r.italic, r;
}
function Uf(n, a) {
  const r = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const s = n[i], c = a[i];
    nc(s, c) || (r[i] = c === void 0 ? i in mi ? mi[i] : null : c);
  }
  return r;
}
function qf(n, a) {
  const r = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || ub.has(i) || s.startsWith("ua:")) continue;
    const c = r[i];
    switch (i) {
      case "letter-spacing":
        c !== "normal" && c?.px !== 0 && a("approximated", i, c?.px !== void 0 ? `${Math.round(c.px * 1e3) / 1e3}px` : c, s, c?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        c !== "normal" && Dp(c) === null && a("unsupported", i, c, s);
        break;
      case "text-transform":
        c !== "none" && a("approximated", i, c, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const f = r["transition-duration"];
        i === "transition-property" && f && ct(f, ",").some((d) => parseFloat(d) > 0) && r["transition-property"] !== "none" && a("unsupported", "transition", `${r["transition-property"]} ${f}`, s, "changes are instant (the engine animates only opacity and size)");
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
        r["outline-style"] !== "none" && i === "outline-style" && a("unsupported", "outline", `${xn(r["outline-width"])}px ${r["outline-style"]} ${pi(r["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function _b(n, a, r, i) {
  const s = tc(n), c = [], f = (N, B, R, X, q) => c.push([N, B, R, X ?? "(user agent)", s, q]), d = i.cascade.compute(n, a), m = {}, h = li(d, f, i.viewport), x = h[Op];
  qf(d, f);
  const g = ri(d, i.measure), v = ii(d, g, r), E = si({ ...h, ...v }, m), S = {}, z = i.cascade.matching(n, "*").filter((N) => N.states.subject.size);
  for (const [N, B] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!z.some((b) => B.some((w) => b.states.subject.has(w)))) continue;
    const R = i.cascade.compute(n, a, new Set(B)), X = {}, q = si({ ...li(R, () => {
    }), ...ii(R, ri(R, i.measure), r) }, X);
    N === "focus" && qf(R, f);
    const O = Uf(E, q);
    if (Object.keys(O).length) {
      S[N] = O;
      const b = Object.fromEntries(Object.entries(X).filter(([w]) => w in O));
      Object.keys(b).length && (S[`${N}_tokens`] = b);
    }
  }
  if (i.cascade.sheet.tracks(n, "hover") && (S.group = Gf(n), S.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let N = n.parentNode; N?.state; N = N.parentNode) {
      if (!i.cascade.sheet.tracks(N, "hover")) continue;
      const B = N.state.hover;
      N.state.hover = !0;
      let R;
      try {
        R = i.cascade.compute(n, a);
      } finally {
        N.state.hover = B;
      }
      const X = {}, q = si({ ...li(R, () => {
      }), ...ii(R, ri(R, i.measure), r) }, X), O = Uf(E, q);
      if (!Object.keys(O).length) continue;
      const b = Object.fromEntries(Object.entries(X).filter(([w]) => w in O));
      (S.group_hover ??= []).push({ group: Gf(N), style: O, ...Object.keys(b).length ? { tokens: b } : {} });
    }
  if (/tabular/.test(String(d.values["font-variant-numeric"] ?? "")) && (S.tabular = !0), /^(anywhere|break-word)$/.test(String(d.values["overflow-wrap"] ?? "")) && (S.break_anywhere = !0), h.overflow_y === "scroll") {
    const N = Number.parseFloat(d.customs?.["--scrollbar-size"] ?? "");
    N > 0 && (S.scrollbar = N);
  }
  d.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (S.blocks_pointer = !0), d.values["pointer-events"] === "none" && (S.pointer_none = !0);
  const _ = Object.entries(mb).filter(([, N]) => N.some((B) => typeof n.props[B] == "function")).map(([N]) => N);
  return !_.includes("click") && Ao(n) && _.push("click"), _.length && (S.events = _), { computed: d, style: E, tokens: m, extra: S, meta: Rb(n), reports: c, childText: kb(r, v), where: s, shift: x };
}
function Sb(n, a, r, i) {
  const s = { before: null, after: null };
  for (const c of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), c).length) continue;
    const f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), c), d = String(f.values.content ?? "none").trim();
    if (d === "none" || d === "normal") continue;
    const m = /^(["'])(.*)\1$/.exec(d)?.[2] ?? "", h = (S, z, _, N, B) => i.add(S, z, _, N ?? "(user agent)", `${tc(n)}::${c}`, B), x = {}, g = li(f, h, i.viewport), E = { kind: "div", style: si({ ...g, ...ii(f, ri(f, i.measure), r) }, x), tokens: x, children: m ? [{ kind: "text", text: m }] : [] };
    Object.defineProperty(E, nn, { value: f.values.display }), s[c] = E;
  }
  return s;
}
const Gf = (n) => `~g${n.id}`, Eb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function zb(n) {
  return n.kind === "div" && n[nn] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !Eb.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function Wr(n, a) {
  const r = n[a], i = { ...r, style: { ...r.style } };
  return Object.defineProperty(i, nn, { value: r[nn] }), n[a] = i, i;
}
function Nb(n) {
  const a = [];
  for (let r = n.parentElement; r?.parentElement; r = r.parentElement) {
    const i = r.parentElement.children;
    a.push(`${+(i[0] === r)}${+(i[i.length - 1] === r)}`);
  }
  return a.join("");
}
function Bp(n, a, r, i, s = 0, c = !0, f = !0, d = 0) {
  const m = i.cascade.sheet.depends(n), h = m.pos ? `${+c}${+f}${m.nth ? `:${d}` : ""}` : "", x = m.ancPos ? Nb(n) : "";
  let g = i.cache.get(n);
  const v = g && g.version === n.version && g.parentValues === a?.values && g.inheritedText === r && g.pos === h && g.ancPos === x && (!m.anc || s <= g.at);
  if (v && g.node && g.stamp === n.stamp && !g.volatile && (!g.subAnc || s <= g.subAt)) {
    for (const _ of g.log) i.add(..._);
    return g.node;
  }
  if (!v) {
    const _ = _b(n, a, r, i);
    g && nc(g.part.childText, _.childText) && (_.childText = g.part.childText), g = { version: n.version, parentValues: a?.values, inheritedText: r, pos: h, ancPos: x, at: i.now, part: _ }, i.cache.set(n, g);
  }
  const E = i.log.length, S = { volatile: !!g.part.shift || m.ancPos, subAnc: m.anc }, z = Tb(n, g, i, Math.max(s, n.attrStamp), S);
  return Object.assign(g, { node: z, stamp: n.stamp, subAt: i.now, log: i.log.slice(E), volatile: S.volatile, subAnc: S.subAnc }), z;
}
function Tb(n, a, r, i, s) {
  const { computed: c, tokens: f, extra: d, reports: m, childText: h, where: x } = a.part;
  for (const k of m) r.add(...k);
  const g = (k, C, j, M, H) => r.add(k, C, j, M, x, H), v = { ...a.part.style };
  a.part.shift && xb(n, v, a.part.shift);
  const E = { kind: "div", id: n.id, style: v, tokens: f, meta: a.part.meta, ...d };
  Object.defineProperty(E, nn, { value: c.values.display }), n.measured && n.ownerDocument?.measureKey && (E.measure = n.ownerDocument.measureKey(n));
  const S = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return E.kind = "engine", E.engine = String(n.props["data-perch-engine"]), E.key = String(n.props["data-perch-key"] ?? ""), E;
  if (S === "svg")
    return E.kind = n.props["data-perch-image"] ? "image" : "svg", E.markup = Ob(n), E;
  if (S === "input" || S === "textarea" || S === "select") {
    E.kind = "input", E.input_type = S === "input" ? String(n.props.type ?? "text") : S;
    for (const j of ["placeholder", "checked", "disabled"]) n.props[j] !== void 0 && (E[j] = n.props[j]);
    if (/^(checkbox|radio)$/.test(E.input_type) && (E.checked = n.checked), S !== "select" && (E.value = n.value), S === "input" && gb.test(E.input_type) && (E.field_w = bb * c.values["font-size"]), S === "textarea" && v.h === void 0) {
      const j = c.values, M = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, H = ($) => j[`border-${$}-style`] === "none" ? 0 : M(j[`border-${$}-width`]), Z = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      v.h = Z * Ul(j, r.measure) + M(j["padding-top"]) + M(j["padding-bottom"]) + H("top") + H("bottom");
    }
    const { before: k, after: C } = Sb(n, c, h, r);
    return (k || C) && (E.children = [k, C].filter(Boolean)), E;
  }
  if (S === "img") {
    E.kind = "image", E.src = n.props.src ?? null;
    for (const [k, C] of [["width", "w"], ["height", "h"]]) {
      const j = Number(n.props[k]);
      v[C] === void 0 && n.props[k] != null && Number.isFinite(j) && (v[C] = j);
    }
    return E;
  }
  const z = c.values["text-transform"], _ = [];
  let N = !1, B = !1;
  const R = n.childNodes.reduce((k, C) => k + (C instanceof Je ? 1 : 0), 0);
  let X = 0;
  for (const k of n.childNodes) {
    if (k instanceof Ei) {
      if (k.hidden || k.data === "") continue;
      N = !0;
      const H = _[_.length - 1];
      if (H?.kind === "text")
        H.source = (H.source ?? H.text) + k.data, H.text = Lf(H.source, z), H.text === H.source && delete H.source;
      else {
        const Z = Lf(k.data, z);
        _.push(Z === k.data ? { kind: "text", text: Z } : { kind: "text", text: Z, source: k.data });
      }
      continue;
    }
    if (!(k instanceof Je)) continue;
    const C = Bp(k, c, h, r, i, X === 0, X === R - 1, X);
    X++;
    const j = r.cache.get(k);
    s.volatile ||= j.volatile, s.subAnc ||= j.subAnc;
    const M = C[nn];
    M === "inline" || M === "inline-block" || M === "inline-flex" ? N = !0 : M !== "none" && (B = !0), _.push(C);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && v.w === void 0) {
    for (let k = 0; k < _.length; k++)
      if (_[k].style?.flex_grow && _[k].style.min_w === 0 && _[k].style.overflow_x === "hidden") {
        const C = Wr(_, k);
        delete C.style.min_w, delete C.style.flex_grow, delete C.style.flex_basis, delete C.style.overflow_x, delete C.style.overflow_y;
      }
  }
  if (!v.display && N && _.some((k) => k.kind !== "text") && _.every((k) => k.kind === "text" || zb(k))) {
    const k = _.map((C) => C.kind === "text" ? C.text : C.children.map((j) => j.text).join("")).join("");
    g("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), _.splice(0, _.length, { kind: "text", text: k });
  }
  const q = _.some((k) => k.kind !== "text");
  let O = _.length === 1 && _[0].kind !== "text" && /^inline-(block|flex)$/.test(_[0][nn]) ? _[0] : null;
  if (!v.display && O) {
    O = Wr(_, 0);
    const k = r.cache.get(n.childNodes.find((j) => j.id === O.id))?.part.computed, C = k ? gi(c.values, r.measure) - Mb(k.values, r.measure, O) : 0;
    v.display = "flex", v.flex_direction = "col", v.items = "start", C > 0 && (O.style.mt = Math.round(((O.style.mt ?? 0) + C) * 100) / 100), g("approximated", "display", `${c.values.display} holding one ${O[nn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!v.display && _.length === 1 && (_[0].kind === "svg" || _[0].kind === "image") && _[0][nn] === "inline" && typeof _[0].style.h == "number") {
    const k = Wr(_, 0), C = gi(c.values, r.measure), j = Ul(c.values, r.measure) - C, M = (H) => Math.round(H * 100) / 100;
    v.display = "flex", v.flex_direction = "col", v.items = "start", C > k.style.h && (k.style.mt = M((k.style.mt ?? 0) + C - k.style.h)), j > 0 && (k.style.mb = M((k.style.mb ?? 0) + j)), g("approximated", "display", `${c.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!v.display && N && q) {
    if (v.display = "flex", v.flex_direction = B ? "col" : "row", !B) v.items = "baseline";
    else for (let k = 0; k < _.length; k++) _[k].kind !== "text" && /^inline-(block|flex)$/.test(_[k][nn]) && !_[k].style.self && (Wr(_, k).style.self = "start");
    g("approximated", "display", `${c.values.display} with inline content`, "(inline formatting)", B ? "a column of its children" : "a row on the text baseline");
  }
  const b = c.values["letter-spacing"]?.px, w = c.values["overflow-x"] !== "visible";
  if (b)
    for (let k = 0; k < _.length; k++) {
      const C = _[k];
      if (C.kind !== "text") continue;
      const j = Math.round(b * [...C.text].length * 1e3) / 1e3;
      if (b > 0 || !w) {
        _[k] = { kind: "div", style: { pr: j }, tokens: {}, children: [C] };
        continue;
      }
      const M = c.values["font-size"], H = Math.max(0.8, 1 + b / (0.55 * M)), Z = Math.round(Ul(c.values, r.measure) * 1e3) / 1e3;
      _[k] = { kind: "div", style: { text_size: Math.round(M * H * 1e3) / 1e3, line_height: `${Z}px` }, tokens: {}, children: [C] };
    }
  return E.children = _, E;
}
function Cb(n, a) {
  if (!a) return null;
  let i = (a.self ? n : a.closest ? wp(n, a.closest) : a.find ? Gl(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return i && a.strip && i.startsWith(a.strip) && (i = i.slice(a.strip.length)), i;
}
function Ab(n, a, r) {
  const i = a.map((f) => [f, Si(f.selector)]), s = /* @__PURE__ */ new Map(), c = (f) => {
    for (const d of f.children) {
      const m = r.get(d.id);
      if (m)
        for (const [h, x] of i) {
          const g = h.textRange ? "range_name" : "name";
          if (h.textRange && m[g] != null || !x.some((z) => zo(d, z))) continue;
          const v = Cb(d, h.key), E = v == null ? s.get(h.name) ?? 0 : 0;
          v == null && s.set(h.name, E + 1);
          const S = v != null ? `${h.name}:${v}` : E ? `${h.name}@${E}` : h.name;
          m[g] == null ? m[g] = S : (m.also ??= []).push(S);
        }
      c(d);
    }
  };
  c(n.documentElement);
}
const hi = 0.9521, Hp = 0.2256, gi = (n, a) => (Ul(n, a) - (hi + Hp) * n["font-size"]) / 2 + hi * n["font-size"];
function Mb(n, a, r) {
  const i = (m) => m && typeof m == "object" && "px" in m ? m.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), c = r?.children ?? [], f = c.length === 1 && (c[0].kind === "svg" || c[0].kind === "image") && typeof c[0].style.h == "number" ? c[0] : null, d = f ? Math.max(gi(n, a), (f.style.mt ?? 0) + f.style.h) : gi(n, a);
  return i(n["padding-top"]) + s + d;
}
const Lf = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (r) => r.toUpperCase()) : n, Up = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Rb(n) {
  const a = {};
  for (const [r, i] of Object.entries(n.props)) {
    if (Up.has(r) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = r.startsWith("aria-") || r.startsWith("data-");
    if (i === !1 && !s) continue;
    const c = r === "htmlFor" ? "for" : r === "tabIndex" ? "tabindex" : r;
    a[c] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: a };
}
const jb = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), Yf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Ob(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (r) => {
    const i = [];
    for (const [c, f] of Object.entries(r.props))
      Up.has(c) || typeof f == "function" || f === void 0 || f === null || f === !1 || typeof f == "object" || c.startsWith("data-") || c.startsWith("aria-") || c === "focusable" || c === "role" || c === "title" || i.push(`${jb(c)}="${Yf(f === !0 ? "" : f)}"`);
    r.tagName === "svg" && !r.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = r.childNodes.map((c) => c instanceof Ei ? Yf(c.data) : a(c)).join("");
    return `<${r.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${r.tagName}>`;
  };
  return a(n);
}
function Db(n) {
  const a = n.theme?.() ?? {}, r = {};
  for (const i of Tp) a[i] && (r[i] = a[i]);
  return r;
}
const Bb = { font_features: "" };
function Hb(n, a, r, i = {}, s = null) {
  const c = Db(a), f = a.viewport?.() ?? { width: 1e3, height: 800 }, d = JSON.stringify([c, f]);
  (i.look !== d || i.sheet !== r) && Object.assign(i, { look: d, sheet: r, cache: /* @__PURE__ */ new WeakMap(), cascade: new lb(r, { theme: c, viewport: f }), top: null });
  const { cascade: m, cache: h } = i, x = new hb(), g = [], E = { cascade: m, cache: h, viewport: f, findings: x, log: g, add: (...N) => {
    g.push(N), x.add(...N);
  }, now: To(), measure: a.lineHeight ? (N) => a.lineHeight(N) : null };
  i.top ??= m.compute(n.body, m.compute(n.documentElement, null));
  const S = n.body.children, z = S.map((N, B) => Bp(N, i.top, Bb, E, 0, B === 0, B === S.length - 1, B));
  if (s?.length) {
    const N = /* @__PURE__ */ new Map(), B = (R) => {
      R.id && (N.set(R.id, R), delete R.name, delete R.range_name, delete R.also);
      for (const X of R.children ?? []) B(X);
    };
    z.forEach(B), Ab(n, s, N);
  }
  const _ = /* @__PURE__ */ new Set();
  for (const N of [n, n.defaultView])
    for (const { type: B } of N?.listeners ?? []) Df[B] && _.add(Df[B]);
  return { schema: ob, root: z[0] ?? null, overlays: z.slice(1), document_events: [..._].sort(), unsupported: E.findings.list() };
}
const Ub = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let qb = null;
const Gb = () => qb ??= new W0(Ub);
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
let ya = Ll.NoEventPriority;
function Lb(n, a) {
  const r = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const i of r) {
    if (i === "children") continue;
    const s = n[i], c = a[i];
    if (!(s === c || typeof s == "function" && typeof c == "function") && !(i === "style" && s && c && typeof s == "object" && typeof c == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(c)])].every((d) => s[d] === c[d])))
      return !0;
  }
  return !1;
}
const Yb = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Qf(n, a) {
  for (const r of p0(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(r);
  return n;
}
const Qb = {
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
  createInstance: (n, a, r) => Qf(new Je(n, a, r.ownerDocument), a),
  createTextInstance: (n, a) => new Ei(n),
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
      Qf(n, i);
    }
    Lb(r, i) && n.touch();
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
    ya = n;
  },
  getCurrentUpdatePriority: () => ya,
  resolveUpdatePriority: () => ya !== Ll.NoEventPriority ? ya : Ll.DefaultEventPriority,
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
}, At = D0(Qb), Vl = (n, a, r = null) => At.createPortal(n, a, null, r), Vb = {
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
}, Xb = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Zb = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Kb = (n) => {
  for (let a = n; a instanceof Je; a = a.parentNode) if (a.props.disabled && Zb.has(a.tagName)) return !0;
  return !1;
};
class Jb {
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
function Fr(n, a, r) {
  a.currentTarget = n;
  for (const { type: i, listener: s, capture: c } of [...n.listeners ?? []])
    i === a.type && c === r && s.call(n, a);
  if (n instanceof Je) {
    const i = Vb[a.type], s = i && n.props[r ? `${i}Capture` : i];
    typeof s == "function" && s(a);
  }
}
function Qw(n, a, r = {}) {
  const { document: i, window: s, globals: c } = v0(n), f = new Je("div", { id: "root", style: r.container ?? {} }, i);
  i.body.appendChild(f);
  const d = [];
  let m = null;
  const h = () => [i, s].map((O) => O.listeners.map((b) => `${b.type}:${b.capture}`).sort().join(",")).join("|");
  let x = "";
  const g = {}, v = `m${Math.random().toString(36).slice(2, 10)}:`;
  let E = 0, S = -1;
  i.measureKey = (O) => v + O.id, i.stale = () => S !== E, i.computed = (O) => {
    if (!g.cascade || !g.top) return null;
    const b = [];
    for (let k = O; k instanceof Je && k !== i.body; k = k.parentNode) b.unshift(k);
    let w = g.top;
    for (const k of b) w = g.cascade.compute(k, w);
    return w.values;
  };
  const z = () => (E += 1, m = Hb(i, n, Gb(), g, r.names), x = h(), n.render?.(m), m), _ = () => {
    At.flushPassiveEffects(), At.flushSyncWork(), h() !== x && z();
  };
  i.afterCommit = z;
  const N = (O) => {
    d.push(O), n.error?.(O);
  }, B = At.createContainer(f, Ll.ConcurrentRoot, null, !1, null, "", N, N, N, null);
  At.updateContainerSync(K.createElement(a, r.props ?? {}), B, null, null), At.flushSyncWork(), _();
  const R = (O) => {
    const b = (w) => {
      if (w.id === O) return w;
      for (const k of w.children) {
        const C = b(k);
        if (C) return C;
      }
      return null;
    };
    return b(i.documentElement);
  }, X = (O) => {
    const b = ya;
    ya = Ll.DiscreteEventPriority;
    try {
      return O();
    } finally {
      ya = b, At.flushSyncWork(), _();
    }
  }, q = {
    document: i,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: c,
    container: f,
    errors: d,
    /** The latest description (after the last commit or state change). */
    get description() {
      return m;
    },
    describe: z,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(O, b, w = {}) {
      const k = typeof O == "string" ? R(O) : O;
      if (!k || Xb.has(b) && Kb(k)) return !1;
      const C = new Jb(b, w, k), j = [];
      for (let Z = k; Z; Z = b === "scroll" ? null : Z.parentNode) j.push(Z);
      const M = [...j, i, s];
      X(() => {
        for (let Z = M.length - 1; Z > 0 && !C.propagationStopped; Z--) Fr(M[Z], C, !0);
        C.propagationStopped || (Fr(k, C, !0), C.propagationStopped || Fr(k, C, !1));
        for (let Z = 1; Z < M.length && !C.propagationStopped; Z++) Fr(M[Z], C, !1);
      });
      const H = b === "click" && !C.defaultPrevented ? Ao(k) : null;
      if (H && q.dispatch(H, "submit", {}), b === "click" && !C.defaultPrevented)
        for (let Z = k; Z; Z = Z.parentNode) {
          if (Z.tagName !== "a") continue;
          const $ = Z.props?.href;
          typeof $ == "string" && /^https:\/\/\S+$/.test($) && n.openLink?.($);
          break;
        }
      return !C.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (O) => [i, s].some((b) => b.listeners.some((w) => w.type === O)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(O) {
      const b = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!q.dispatch(b, "keydown", O)) return !0;
      const k = O.key === "Enter" && !O.isComposing ? Ao(b, !0) : null;
      if (k)
        return q.dispatch(k, "submit", {}), !0;
      if (!zp(b) || b.props.disabled || b.props.readOnly) return !1;
      if ((O.ctrlKey || O.metaKey) && !O.altKey && !O.shiftKey && O.key.toLowerCase() === "a")
        return b.selectedAll = !0, !0;
      if (O.ctrlKey || O.metaKey) return !1;
      const C = b.selectedAll;
      b.selectedAll = !1;
      const j = b.value, H = O.key === "Backspace" || C && O.key === "Delete" ? C ? "" : j.slice(0, -1) : [...O.key].length === 1 ? (C ? "" : j) + O.key : j;
      return H === j ? !1 : (b.value = H, q.dispatch(b, "input", { data: O.key }), q.dispatch(b, "change", {}), b.props.value !== void 0 && delete b.edit, b.touch(), z(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(O, b) {
      const w = R(O);
      w && (w.bounds = { x: b.x, y: b.y, width: b.width, height: b.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(O) {
      const b = R(O);
      if (!b || b.props.disabled || !q.dispatch(O, "click", { button: 0, detail: 1 })) return;
      const w = b.props.type === "radio";
      w && b.checked || (b.checked = w ? !0 : !b.checked, q.dispatch(O, "input", {}), q.dispatch(O, "change", {}), b.props.checked !== void 0 && delete b.ticked, b.touch(), z());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(O, b = {}) {
      const w = { button: 0, buttons: 1, pointerType: "mouse", ...b };
      for (const k of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(O, k, w);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (O) => !!R(O)?.state.hover,
    hover(O, b) {
      const w = R(O);
      !w || w.state.hover === b || (w.state.hover = b, w.touch(), z());
    },
    focus(O) {
      const b = R(O);
      b && (X(() => {
        const w = i.activeElement;
        w && w !== b && w !== i.body && q.dispatch(w, "blur"), i.focus(b), q.dispatch(b, "focus");
      }), z());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(O) {
      let w = typeof O == "string" ? R(O) : O;
      for (; w && !(w instanceof Je && typeof w.props.onKeyDown == "function" && Yb(w)); ) w = w.parentNode;
      !w || w === i.activeElement || (q.focus(w.id), w.state.pointerFocus = !0, w.touch(), z());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return S = E, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const O = i.retries.splice(0);
      for (const b of O) b();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: _,
    update(O) {
      At.updateContainerSync(K.createElement(a, O ?? {}), B, null, null), At.flushSyncWork(), _();
    },
    unmount() {
      At.updateContainerSync(null, B, null, null), At.flushSyncWork(), At.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(v);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const qp = (n) => At.flushSyncFromReconciler(n), Wb = { createPortal: Vl, flushSync: qp }, Vw = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Vl,
  default: Wb,
  flushSync: qp
}, Symbol.toStringTag, { value: "Module" }));
function Gp(n) {
  var a, r, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (a = 0; a < s; a++) n[a] && (r = Gp(n[a])) && (i && (i += " "), i += r);
  } else for (r in n) n[r] && (i && (i += " "), i += r);
  return i;
}
function Lp() {
  for (var n, a, r = 0, i = "", s = arguments.length; r < s; r++) (n = arguments[r]) && (a = Gp(n)) && (i && (i += " "), i += a);
  return i;
}
const Fb = (n, a) => {
  const r = new Array(n.length + a.length);
  for (let i = 0; i < n.length; i++)
    r[i] = n[i];
  for (let i = 0; i < a.length; i++)
    r[n.length + i] = a[i];
  return r;
}, $b = (n, a) => ({
  classGroupId: n,
  validator: a
}), Yp = (n = /* @__PURE__ */ new Map(), a = null, r) => ({
  nextPart: n,
  validators: a,
  classGroupId: r
}), bi = "-", Vf = [], Ib = "arbitrary..", Pb = (n) => {
  const a = tv(n), {
    conflictingClassGroups: r,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return ev(f);
      const d = f.split(bi), m = d[0] === "" && d.length > 1 ? 1 : 0;
      return Qp(d, m, a);
    },
    getConflictingClassGroupIds: (f, d) => {
      if (d) {
        const m = i[f], h = r[f];
        return m ? h ? Fb(h, m) : m : h || Vf;
      }
      return r[f] || Vf;
    }
  };
}, Qp = (n, a, r) => {
  if (n.length - a === 0)
    return r.classGroupId;
  const s = n[a], c = r.nextPart.get(s);
  if (c) {
    const h = Qp(n, a + 1, c);
    if (h) return h;
  }
  const f = r.validators;
  if (f === null)
    return;
  const d = a === 0 ? n.join(bi) : n.slice(a).join(bi), m = f.length;
  for (let h = 0; h < m; h++) {
    const x = f[h];
    if (x.validator(d))
      return x.classGroupId;
  }
}, ev = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), r = a.indexOf(":"), i = a.slice(0, r);
  return i ? Ib + i : void 0;
})(), tv = (n) => {
  const {
    theme: a,
    classGroups: r
  } = n;
  return nv(r, a);
}, nv = (n, a) => {
  const r = Yp();
  for (const i in n) {
    const s = n[i];
    ac(s, r, i, a);
  }
  return r;
}, ac = (n, a, r, i) => {
  const s = n.length;
  for (let c = 0; c < s; c++) {
    const f = n[c];
    av(f, a, r, i);
  }
}, av = (n, a, r, i) => {
  if (typeof n == "string") {
    lv(n, a, r);
    return;
  }
  if (typeof n == "function") {
    rv(n, a, r, i);
    return;
  }
  iv(n, a, r, i);
}, lv = (n, a, r) => {
  const i = n === "" ? a : Vp(a, n);
  i.classGroupId = r;
}, rv = (n, a, r, i) => {
  if (sv(n)) {
    ac(n(i), a, r, i);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push($b(r, n));
}, iv = (n, a, r, i) => {
  const s = Object.entries(n), c = s.length;
  for (let f = 0; f < c; f++) {
    const [d, m] = s[f];
    ac(m, Vp(a, d), r, i);
  }
}, Vp = (n, a) => {
  let r = n;
  const i = a.split(bi), s = i.length;
  for (let c = 0; c < s; c++) {
    const f = i[c];
    let d = r.nextPart.get(f);
    d || (d = Yp(), r.nextPart.set(f, d)), r = d;
  }
  return r;
}, sv = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, ov = (n) => {
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
}, Bo = "!", Xf = ":", cv = [], Zf = (n, a, r, i, s) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: r,
  maybePostfixModifierPosition: i,
  isExternal: s
}), uv = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: r
  } = n;
  let i = (s) => {
    const c = [];
    let f = 0, d = 0, m = 0, h;
    const x = s.length;
    for (let z = 0; z < x; z++) {
      const _ = s[z];
      if (f === 0 && d === 0) {
        if (_ === Xf) {
          c.push(s.slice(m, z)), m = z + 1;
          continue;
        }
        if (_ === "/") {
          h = z;
          continue;
        }
      }
      _ === "[" ? f++ : _ === "]" ? f-- : _ === "(" ? d++ : _ === ")" && d--;
    }
    const g = c.length === 0 ? s : s.slice(m);
    let v = g, E = !1;
    g.endsWith(Bo) ? (v = g.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      g.startsWith(Bo) && (v = g.slice(1), E = !0)
    );
    const S = h && h > m ? h - m : void 0;
    return Zf(c, E, v, S);
  };
  if (a) {
    const s = a + Xf, c = i;
    i = (f) => f.startsWith(s) ? c(f.slice(s.length)) : Zf(cv, !1, f, void 0, !0);
  }
  if (r) {
    const s = i;
    i = (c) => r({
      className: c,
      parseClassName: s
    });
  }
  return i;
}, dv = (n) => {
  const a = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((r, i) => {
    a.set(r, 1e6 + i);
  }), (r) => {
    const i = [];
    let s = [];
    for (let c = 0; c < r.length; c++) {
      const f = r[c], d = f[0] === "[", m = a.has(f);
      d || m ? (s.length > 0 && (s.sort(), i.push(...s), s = []), i.push(f)) : s.push(f);
    }
    return s.length > 0 && (s.sort(), i.push(...s)), i;
  };
}, fv = (n) => ({
  cache: ov(n.cacheSize),
  parseClassName: uv(n),
  sortModifiers: dv(n),
  postfixLookupClassGroupIds: pv(n),
  ...Pb(n)
}), pv = (n) => {
  const a = /* @__PURE__ */ Object.create(null), r = n.postfixLookupClassGroups;
  if (r)
    for (let i = 0; i < r.length; i++)
      a[r[i]] = !0;
  return a;
}, mv = /\s+/, hv = (n, a) => {
  const {
    parseClassName: r,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: c,
    postfixLookupClassGroupIds: f
  } = a, d = [], m = n.trim().split(mv);
  let h = "";
  for (let x = m.length - 1; x >= 0; x -= 1) {
    const g = m[x], {
      isExternal: v,
      modifiers: E,
      hasImportantModifier: S,
      baseClassName: z,
      maybePostfixModifierPosition: _
    } = r(g);
    if (v) {
      h = g + (h.length > 0 ? " " + h : h);
      continue;
    }
    let N = !!_, B;
    if (N) {
      const b = z.substring(0, _);
      B = i(b);
      const w = B && f[B] ? i(z) : void 0;
      w && w !== B && (B = w, N = !1);
    } else
      B = i(z);
    if (!B) {
      if (!N) {
        h = g + (h.length > 0 ? " " + h : h);
        continue;
      }
      if (B = i(z), !B) {
        h = g + (h.length > 0 ? " " + h : h);
        continue;
      }
      N = !1;
    }
    const R = E.length === 0 ? "" : E.length === 1 ? E[0] : c(E).join(":"), X = S ? R + Bo : R, q = X + B;
    if (d.indexOf(q) > -1)
      continue;
    d.push(q);
    const O = s(B, N);
    for (let b = 0; b < O.length; ++b) {
      const w = O[b];
      d.push(X + w);
    }
    h = g + (h.length > 0 ? " " + h : h);
  }
  return h;
}, gv = (...n) => {
  let a = 0, r, i, s = "";
  for (; a < n.length; )
    (r = n[a++]) && (i = Xp(r)) && (s && (s += " "), s += i);
  return s;
}, Xp = (n) => {
  if (typeof n == "string")
    return n;
  let a, r = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (a = Xp(n[i])) && (r && (r += " "), r += a);
  return r;
}, bv = (n, ...a) => {
  let r, i, s, c;
  const f = (m) => {
    const h = a.reduce((x, g) => g(x), n());
    return r = fv(h), i = r.cache.get, s = r.cache.set, c = d, d(m);
  }, d = (m) => {
    const h = i(m);
    if (h)
      return h;
    const x = hv(m, r);
    return s(m, x), x;
  };
  return c = f, (...m) => c(gv(...m));
}, vv = [], $e = (n) => {
  const a = (r) => r[n] || vv;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, Zp = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Kp = /^\((?:(\w[\w-]*):)?(.+)\)$/i, yv = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, xv = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, wv = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, kv = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, _v = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, Sv = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Gn = (n) => yv.test(n), ve = (n) => !!n && !Number.isNaN(Number(n)), en = (n) => !!n && Number.isInteger(Number(n)), wo = (n) => n.endsWith("%") && ve(n.slice(0, -1)), yn = (n) => xv.test(n), Jp = () => !0, Ev = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  wv.test(n) && !kv.test(n)
), lc = () => !1, zv = (n) => _v.test(n), Nv = (n) => Sv.test(n), Tv = (n) => !re(n) && !ie(n), Cv = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), Av = (n) => Kn(n, $p, lc), re = (n) => Zp.test(n), ma = (n) => Kn(n, Ip, Ev), Kf = (n) => Kn(n, Uv, ve), Mv = (n) => Kn(n, em, Jp), Rv = (n) => Kn(n, Pp, lc), Jf = (n) => Kn(n, Wp, lc), jv = (n) => Kn(n, Fp, Nv), $r = (n) => Kn(n, tm, zv), ie = (n) => Kp.test(n), jl = (n) => ka(n, Ip), Ov = (n) => ka(n, Pp), Wf = (n) => ka(n, Wp), Dv = (n) => ka(n, $p), Bv = (n) => ka(n, Fp), Ir = (n) => ka(n, tm, !0), Hv = (n) => ka(n, em, !0), Kn = (n, a, r) => {
  const i = Zp.exec(n);
  return i ? i[1] ? a(i[1]) : r(i[2]) : !1;
}, ka = (n, a, r = !1) => {
  const i = Kp.exec(n);
  return i ? i[1] ? a(i[1]) : r : !1;
}, Wp = (n) => n === "position" || n === "percentage", Fp = (n) => n === "image" || n === "url", $p = (n) => n === "length" || n === "size" || n === "bg-size", Ip = (n) => n === "length", Uv = (n) => n === "number", Pp = (n) => n === "family-name", em = (n) => n === "number" || n === "weight", tm = (n) => n === "shadow", qv = () => {
  const n = $e("color"), a = $e("font"), r = $e("text"), i = $e("font-weight"), s = $e("tracking"), c = $e("leading"), f = $e("breakpoint"), d = $e("container"), m = $e("spacing"), h = $e("radius"), x = $e("shadow"), g = $e("inset-shadow"), v = $e("text-shadow"), E = $e("drop-shadow"), S = $e("blur"), z = $e("perspective"), _ = $e("aspect"), N = $e("ease"), B = $e("animate"), R = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], q = () => [...X(), ie, re], O = () => ["auto", "hidden", "clip", "visible", "scroll"], b = () => ["auto", "contain", "none"], w = () => [ie, re, m], k = () => [Gn, "full", "auto", ...w()], C = () => [en, "none", "subgrid", ie, re], j = () => ["auto", {
    span: ["full", en, ie, re]
  }, en, ie, re], M = () => [en, "auto", ie, re], H = () => ["auto", "min", "max", "fr", ie, re], Z = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], $ = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...w()], W = () => [Gn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...w()], I = () => [d, Gn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...w()], Y = () => [Gn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...w()], V = () => [n, ie, re], T = () => [...X(), Wf, Jf, {
    position: [ie, re]
  }], J = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], ae = () => ["auto", "cover", "contain", Dv, Av, {
    size: [ie, re]
  }], oe = () => [wo, jl, ma], ce = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    h,
    ie,
    re
  ], ue = () => ["", ve, jl, ma], Ee = () => ["solid", "dashed", "dotted", "double"], Ie = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], he = () => [ve, wo, Wf, Jf], Wn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    S,
    ie,
    re
  ], Fn = () => ["none", ve, ie, re], qt = () => ["none", ve, ie, re], Gt = () => [ve, ie, re], wn = () => [Gn, "full", ...w()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [yn],
      breakpoint: [yn],
      color: [Jp],
      container: [yn],
      "drop-shadow": [yn],
      ease: ["in", "out", "in-out"],
      font: [Tv],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [yn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [yn],
      shadow: [yn],
      spacing: ["px", ve],
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
        aspect: ["auto", "square", Gn, re, ie, _]
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
      "container-named": [Cv],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [ve, "auto", re, ie, d]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": R()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": R()
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
        object: q()
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
        inset: k()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": k()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": k()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": k(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: k()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": k(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: k()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": k()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": k()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: k()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: k()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: k()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: k()
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
        z: [en, "auto", ie, re]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Gn, "full", "auto", d, ...w()]
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
        flex: [ve, Gn, "auto", "initial", "none", re]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", ve, ie, re]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", ve, ie, re]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [en, "first", "last", "none", ie, re]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": C()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: j()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": M()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": M()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": C()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: j()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": M()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": M()
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
        "auto-cols": H()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": H()
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
        justify: [...Z(), "normal"]
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
        content: ["normal", ...Z()]
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
        "place-content": Z()
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
        size: W()
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
        block: ["auto", ...Y()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...Y()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...Y()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [d, "screen", ...W()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          d,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...W()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          d,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [f]
          },
          ...W()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...W()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...W()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...W()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", r, jl, ma]
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
        font: [i, Hv, Mv]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", wo, re]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [Ov, Rv, a]
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
        "line-clamp": [ve, "none", ie, Kf]
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
          ...w()
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
        placeholder: V()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: V()
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
        decoration: [ve, "from-font", "auto", ie, ma]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: V()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [ve, "auto", ie, re]
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
        tab: [en, ie, re]
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
        bg: T()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: J()
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
          }, en, ie, re],
          radial: ["", ie, re],
          conic: ["", en, ie, re]
        }, Bv, jv]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: V()
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
        from: V()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: V()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: V()
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
        border: V()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": V()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": V()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": V()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": V()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": V()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": V()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": V()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": V()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": V()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": V()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: V()
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
        "outline-offset": [ve, ie, re]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", ve, jl, ma]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: V()
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
          x,
          Ir,
          $r
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: V()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", g, Ir, $r]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": V()
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
        ring: V()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [ve, ma]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": V()
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
        "inset-ring": V()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", v, Ir, $r]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": V()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [ve, ie, re]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Ie(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Ie()
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
        "mask-linear": [ve]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": he()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": he()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": V()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": V()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": he()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": he()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": V()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": V()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": he()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": he()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": V()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": V()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": he()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": he()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": V()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": V()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": he()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": he()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": V()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": V()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": he()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": he()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": V()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": V()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": he()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": he()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": V()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": V()
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
        "mask-radial-from": V()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": V()
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
        "mask-conic": [ve]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": he()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": he()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": V()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": V()
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
        mask: T()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: J()
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
        blur: Wn()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [ve, ie, re]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [ve, ie, re]
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
          Ir,
          $r
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": V()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", ve, ie, re]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [ve, ie, re]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", ve, ie, re]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [ve, ie, re]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", ve, ie, re]
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
        "backdrop-blur": Wn()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [ve, ie, re]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [ve, ie, re]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", ve, ie, re]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [ve, ie, re]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", ve, ie, re]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [ve, ie, re]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [ve, ie, re]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", ve, ie, re]
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
        duration: [ve, "initial", ie, re]
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
        delay: [ve, ie, re]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", B, ie, re]
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
        "perspective-origin": q()
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
        skew: Gt()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Gt()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Gt()
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
        origin: q()
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
        zoom: [en, ie, re]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: V()
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
        caret: V()
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
        "scrollbar-thumb": V()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": V()
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
        fill: ["none", ...V()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [ve, jl, ma, Kf]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...V()]
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
}, Gv = /* @__PURE__ */ bv(qv);
function Ge(...n) {
  return Gv(Lp(n));
}
function Lv(n, a, r) {
  return n.filter((i, s) => s !== a && (i.start + i.end) / 2 < r).length;
}
function Yv(n, a, r, i) {
  const s = n.map(() => 0), c = n[a];
  if (!c) return s;
  const f = n[a + 1], d = n[a - 1], m = c.end - c.start + (f ? f.start - c.end : d ? c.start - d.end : 0);
  return n.forEach((h, x) => {
    a < r && x > a && x <= r ? s[x] = -m : r < a && x >= r && x < a && (s[x] = m);
  }), s[a] = Math.min(Math.max(i, n[0].start - c.start), n[n.length - 1].end - c.end), s;
}
const Ff = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Qv(n, a) {
  for (let r = n.parentElement; r; r = r.parentElement) {
    const i = getComputedStyle(r)[a === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (a === "x" ? r.scrollWidth > r.clientWidth : r.scrollHeight > r.clientHeight)) return r;
  }
  return null;
}
function Vv(n, a, r, i) {
  const s = n[a] ? Qv(n[a], r) : null, c = () => s ? r === "x" ? s.scrollLeft : s.scrollTop : 0, f = (_) => (r === "x" ? _.clientX : _.clientY) + c(), d = f(i), m = c(), h = n.map((_) => {
    const N = _.getBoundingClientRect();
    return r === "x" ? { start: N.left + m, end: N.right + m } : { start: N.top + m, end: N.bottom + m };
  }), x = n.map((_) => Ff.map((N) => _.style[N])), g = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, v = r === "x" ? "translateX" : "translateY";
  let E = !1;
  const S = { to: a };
  n.forEach((_, N) => {
    if (_.style.pointerEvents = "none", N !== a) {
      g || (_.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(_).position === "static" && (_.style.position = "relative"), _.style.zIndex = "30", _.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const z = (_, N) => {
    S.to = _, Yv(h, a, _, N).forEach((B, R) => {
      n[R].style.transform = B ? `${v}(${B}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return S.to;
    },
    slot: (_) => Lv(h, a, f(_)),
    apply: (_, N) => {
      E || z(_, f(N) - d);
    },
    rest: () => {
      E || z(a, 0);
    },
    end: () => {
      E || (E = !0, n.forEach((_, N) => Ff.forEach((B, R) => {
        _.style[B] = x[N][R];
      })));
    }
  };
}
const Xv = 5;
let ko = !1;
function Zv(n, a) {
  if (n.button !== 0 || ko) return;
  const r = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let c = null, f, d = !1;
  const m = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, h = (S) => {
    if (d) return;
    d = !0, window.removeEventListener("pointermove", x), window.removeEventListener("pointerup", g), window.removeEventListener("pointercancel", v), window.removeEventListener("keydown", E, !0), window.removeEventListener("blur", v), i.removeEventListener("lostpointercapture", v);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!c) return;
    ko = !1, document.body.style.cursor = m.cursor, document.body.style.userSelect = m.userSelect, c.end();
    const z = (_) => _.stopPropagation();
    window.addEventListener("click", z, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", z, !0), 0), f?.(), a.onEnd(S, c);
  }, x = (S) => {
    if (!c) {
      if (Math.hypot(S.clientX - r.clientX, S.clientY - r.clientY) < Xv) return;
      const z = a.items();
      c = Vv(z, a.from(z), a.axis, r), ko = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", v);
      const _ = a.onStart?.();
      f = typeof _ == "function" ? _ : void 0;
    }
    a.onMove(S, c);
  }, g = () => h(!0), v = () => h(!1), E = (S) => {
    S.key === "Escape" && (S.stopPropagation(), h(!1));
  };
  window.addEventListener("pointermove", x), window.addEventListener("pointerup", g), window.addEventListener("pointercancel", v), window.addEventListener("keydown", E, !0), window.addEventListener("blur", v);
}
const nm = typeof navigator < "u" && /Mac/i.test(navigator.platform), vi = {
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
for (let n = 1; n <= 12; n++) vi[`f${n}`] = `F${n}`;
const Kv = Object.fromEntries(Object.entries(vi).map(([n, a]) => [a, n])), Jv = {
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
function Wv(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : Kv[n];
}
const $f = /* @__PURE__ */ new Map();
function am(n, a = nm) {
  const r = `${a}|${n}`, i = $f.get(r);
  if (i) return i;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const c of n.split("+"))
    if (c === "mod")
      a ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (c === "cmd" || c === "ctrl" || c === "shift" || c === "alt") s[c] = !0;
    else if (/^[a-z]$/.test(c))
      s.code = `Key${c.toUpperCase()}`, s.letter = c;
    else if (/^[0-9]$/.test(c)) s.code = `Digit${c}`;
    else if (vi[c]) s.code = vi[c];
    else throw new Error(`unknown key "${c}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return $f.set(r, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = am(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function Fv(n, a = nm) {
  const r = am(n, a), i = $v(Wv(r.code) ?? "");
  return a ? `${r.ctrl ? "⌃" : ""}${r.alt ? "⌥" : ""}${r.shift ? "⇧" : ""}${r.cmd ? "⌘" : ""}${i}` : [r.ctrl && "Ctrl", r.alt && "Alt", r.shift && "Shift", i].filter(Boolean).join("+");
}
const $v = (n) => Jv[n] ?? n.toUpperCase(), If = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Pf = Lp, zi = (n, a) => (r) => {
  var i;
  if (a?.variants == null) return Pf(n, r?.class, r?.className);
  const { variants: s, defaultVariants: c } = a, f = Object.keys(s).map((h) => {
    const x = r?.[h], g = c?.[h];
    if (x === null) return null;
    const v = If(x) || If(g);
    return s[h][v];
  }), d = r && Object.entries(r).reduce((h, x) => {
    let [g, v] = x;
    return v === void 0 || (h[g] = v), h;
  }, {}), m = a == null || (i = a.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((h, x) => {
    let { class: g, className: v, ...E } = x;
    return Object.entries(E).every((S) => {
      let [z, _] = S;
      return Array.isArray(_) ? _.includes({
        ...c,
        ...d
      }[z]) : {
        ...c,
        ...d
      }[z] === _;
    }) ? [
      ...h,
      g,
      v
    ] : h;
  }, []);
  return Pf(n, f, m, r?.class, r?.className);
}, Iv = zi(
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
), Pv = zi(
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
function e1({ className: n, ...a } = {}) {
  return Ge(Pv(a), n);
}
const lm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", rc = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", t1 = zi(`${rc} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function n1({ className: n, ...a } = {}) {
  return Ge(t1(a), n);
}
const Ni = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Ho = zi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), a1 = "my-1 h-px bg-overlay-0";
function l1({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function r1({ size: n = 16, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function i1({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function rm({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const ep = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function s1({ state: n, error: a }) {
  return /* @__PURE__ */ te.jsx(
    "span",
    {
      className: Ge("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", ep[n] ?? ep.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function o1({ title: n, onClose: a, children: r, testId: i }) {
  return Vl(
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
function ic() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var _a = ic();
function im(n) {
  _a = n;
}
var ba = { exec: () => null };
function $a(n) {
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
var c1 = ((n = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + n);
  } catch {
    return !1;
  }
})(), mt = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (n) => new RegExp(`^( {0,3}${n})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: $a((n) => new RegExp(`^ {0,${n}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: $a((n) => new RegExp(`^ {0,${n}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: $a((n) => new RegExp(`^ {0,${n}}(?:\`\`\`|~~~)`)), headingBeginRegex: $a((n) => new RegExp(`^ {0,${n}}#`)), htmlBeginRegex: $a((n) => new RegExp(`^ {0,${n}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: $a((n) => new RegExp(`^ {0,${n}}>`)) }, u1 = /^(?:[ \t]*(?:\n|$))+/, d1 = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, f1 = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, Xl = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, p1 = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, sc = / {0,3}(?:[*+-]|\d{1,9}[.)])/, sm = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, om = ze(sm).replace(/bull/g, sc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), m1 = ze(sm).replace(/bull/g, sc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), oc = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, h1 = /^[^\n]+/, cc = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, g1 = ze(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", cc).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), b1 = ze(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, sc).getRegex(), Ti = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", uc = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, v1 = ze("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", uc).replace("tag", Ti).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), cm = (n) => ze(oc).replace("hr", Xl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", n).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ti).getRegex(), y1 = cm(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), x1 = cm(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), w1 = ze(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", x1).getRegex(), dc = { blockquote: w1, code: d1, def: g1, fences: f1, heading: p1, hr: Xl, html: v1, lheading: om, list: b1, newline: u1, paragraph: y1, table: ba, text: h1 }, tp = ze("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", Xl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ti).getRegex(), k1 = { ...dc, lheading: m1, table: tp, paragraph: ze(oc).replace("hr", Xl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", tp).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Ti).getRegex() }, _1 = { ...dc, html: ze(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", uc).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: ba, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: ze(oc).replace("hr", Xl).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", om).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, S1 = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, E1 = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, um = /^( {2,}|\\)\n(?!\s*$)/, z1 = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, Pa = /[\p{P}\p{S}]/u, Ci = /[\s\p{P}\p{S}]/u, fc = /[^\s\p{P}\p{S}]/u, N1 = ze(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Ci).getRegex(), dm = /(?!~)[\p{P}\p{S}]/u, T1 = /(?!~)[\s\p{P}\p{S}]/u, C1 = /(?:[^\s\p{P}\p{S}]|~)/u, A1 = ze(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", c1 ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), fm = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, M1 = ze(fm, "u").replace(/punct/g, Pa).getRegex(), R1 = ze(fm, "u").replace(/punct/g, dm).getRegex(), pm = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", j1 = ze(pm, "gu").replace(/notPunctSpace/g, fc).replace(/punctSpace/g, Ci).replace(/punct/g, Pa).getRegex(), O1 = ze(pm, "gu").replace(/notPunctSpace/g, C1).replace(/punctSpace/g, T1).replace(/punct/g, dm).getRegex(), D1 = ze("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, fc).replace(/punctSpace/g, Ci).replace(/punct/g, Pa).getRegex(), B1 = ze(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, Pa).getRegex(), H1 = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", U1 = ze(H1, "gu").replace(/notPunctSpace/g, fc).replace(/punctSpace/g, Ci).replace(/punct/g, Pa).getRegex(), q1 = ze(/\\(punct)/, "gu").replace(/punct/g, Pa).getRegex(), G1 = ze(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), L1 = ze(uc).replace("(?:-->|$)", "-->").getRegex(), Y1 = ze("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", L1).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), yi = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, Q1 = ze(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", yi).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), mm = ze(/^!?\[(label)\]\[(ref)\]/).replace("label", yi).replace("ref", cc).getRegex(), hm = ze(/^!?\[(ref)\](?:\[\])?/).replace("ref", cc).getRegex(), V1 = ze("reflink|nolink(?!\\()", "g").replace("reflink", mm).replace("nolink", hm).getRegex(), np = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, pc = { _backpedal: ba, anyPunctuation: q1, autolink: G1, blockSkip: A1, br: um, code: E1, del: ba, delLDelim: ba, delRDelim: ba, emStrongLDelim: M1, emStrongRDelimAst: j1, emStrongRDelimUnd: D1, escape: S1, link: Q1, nolink: hm, punctuation: N1, reflink: mm, reflinkSearch: V1, tag: Y1, text: z1, url: ba }, X1 = { ...pc, link: ze(/^!?\[(label)\]\((.*?)\)/).replace("label", yi).getRegex(), reflink: ze(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", yi).getRegex() }, Uo = { ...pc, emStrongRDelimAst: O1, emStrongLDelim: R1, delLDelim: B1, delRDelim: U1, url: ze(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", np).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: ze(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", np).getRegex() }, Z1 = { ...Uo, br: ze(um).replace("{2,}", "*").getRegex(), text: ze(Uo.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, Pr = { normal: dc, gfm: k1, pedantic: _1 }, Ol = { normal: pc, gfm: Uo, breaks: Z1, pedantic: X1 }, K1 = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, ap = (n) => K1[n];
function tn(n, a) {
  if (a) {
    if (mt.escapeTest.test(n)) return n.replace(mt.escapeReplace, ap);
  } else if (mt.escapeTestNoEncode.test(n)) return n.replace(mt.escapeReplaceNoEncode, ap);
  return n;
}
function lp(n) {
  try {
    n = encodeURI(n).replace(mt.percentDecode, "%");
  } catch {
    return null;
  }
  return n;
}
function rp(n, a) {
  let r = n.replace(mt.findPipe, (c, f, d) => {
    let m = !1, h = f;
    for (; --h >= 0 && d[h] === "\\"; ) m = !m;
    return m ? "|" : " |";
  }), i = r.split(mt.splitPipe), s = 0;
  if (i[0].trim() || i.shift(), i.length > 0 && !i.at(-1)?.trim() && i.pop(), a) if (i.length > a) i.splice(a);
  else for (; i.length < a; ) i.push("");
  for (; s < i.length; s++) i[s] = i[s].trim().replace(mt.slashPipe, "|");
  return i;
}
function Ln(n, a, r) {
  let i = n.length;
  if (i === 0) return "";
  let s = 0;
  for (; s < i && n.charAt(i - s - 1) === a; )
    s++;
  return n.slice(0, i - s);
}
function ip(n) {
  let a = n.split(`
`), r = a.length - 1;
  for (; r >= 0 && mt.blankLine.test(a[r]); ) r--;
  return a.length - r <= 2 ? n : a.slice(0, r + 1).join(`
`);
}
function J1(n, a) {
  if (n.indexOf(a[1]) === -1) return -1;
  let r = 0;
  for (let i = 0; i < n.length; i++) if (n[i] === "\\") i++;
  else if (n[i] === a[0]) r++;
  else if (n[i] === a[1] && (r--, r < 0)) return i;
  return r > 0 ? -2 : -1;
}
function W1(n, a = 0) {
  let r = a, i = "";
  for (let s of n) if (s === "	") {
    let c = 4 - r % 4;
    i += " ".repeat(c), r += c;
  } else i += s, r++;
  return i;
}
function sp(n, a, r, i, s) {
  let c = a.href, f = a.title || null, d = n[1].replace(s.other.outputLinkReplace, "$1");
  i.state.inLink = !0;
  let m = { type: n[0].charAt(0) === "!" ? "image" : "link", raw: r, href: c, title: f, text: d, tokens: i.inlineTokens(d) };
  return i.state.inLink = !1, m;
}
function F1(n, a, r) {
  let i = n.match(r.other.indentCodeCompensation);
  if (i === null) return a;
  let s = i[1];
  return a.split(`
`).map((c) => {
    let f = c.match(r.other.beginningSpace);
    if (f === null) return c;
    let [d] = f;
    return d.length >= s.length ? c.slice(s.length) : c;
  }).join(`
`);
}
var xi = class {
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
      let r = this.options.pedantic ? a[0] : ip(a[0]), i = r.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: r, codeBlockStyle: "indented", text: i };
    }
  }
  fences(n) {
    let a = this.rules.block.fences.exec(n);
    if (a) {
      let r = a[0], i = F1(r, a[3] || "", this.rules);
      return { type: "code", raw: r, lang: a[2] ? a[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : a[2], text: i };
    }
  }
  heading(n) {
    let a = this.rules.block.heading.exec(n);
    if (a) {
      let r = a[2].trim();
      if (this.rules.other.endingHash.test(r)) {
        let i = Ln(r, "#");
        (this.options.pedantic || !i || this.rules.other.endingSpaceChar.test(i)) && (r = i.trim());
      }
      return { type: "heading", raw: Ln(a[0], `
`), depth: a[1].length, text: r, tokens: this.lexer.inline(r) };
    }
  }
  hr(n) {
    let a = this.rules.block.hr.exec(n);
    if (a) return { type: "hr", raw: Ln(a[0], `
`) };
  }
  blockquote(n) {
    let a = this.rules.block.blockquote.exec(n);
    if (a) {
      let r = Ln(a[0], `
`).split(`
`), i = "", s = "", c = [];
      for (; r.length > 0; ) {
        let f = !1, d = [], m;
        for (m = 0; m < r.length; m++) if (this.rules.other.blockquoteStart.test(r[m])) d.push(r[m]), f = !0;
        else if (!f) d.push(r[m]);
        else break;
        r = r.slice(m);
        let h = d.join(`
`), x = h.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        i = i ? `${i}
${h}` : h, s = s ? `${s}
${x}` : x;
        let g = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(x, c, !0), this.lexer.state.top = g, r.length === 0) break;
        let v = c.at(-1);
        if (v?.type === "code") break;
        if (v?.type === "blockquote") {
          let E = v, S = E.raw + `
` + r.join(`
`), z = this.blockquote(S);
          c[c.length - 1] = z, i = i.substring(0, i.length - E.raw.length) + z.raw, s = s.substring(0, s.length - E.text.length) + z.text;
          break;
        } else if (v?.type === "list") {
          let E = v, S = E.raw + `
` + r.join(`
`), z = this.list(S);
          c[c.length - 1] = z, i = i.substring(0, i.length - v.raw.length) + z.raw, s = s.substring(0, s.length - E.raw.length) + z.raw, r = S.substring(c.at(-1).raw.length).split(`
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
        let m = !1, h = "", x = "";
        if (!(a = c.exec(n)) || this.rules.block.hr.test(n)) break;
        h = a[0], n = n.substring(h.length);
        let g = W1(a[2].split(`
`, 1)[0], a[1].length), v = n.split(`
`, 1)[0], E = !g.trim(), S = 0;
        if (this.options.pedantic ? (S = 2, x = g.trimStart()) : E ? S = a[1].length + 1 : (S = g.search(this.rules.other.nonSpaceChar), S = S > 4 ? 1 : S, x = g.slice(S), S += a[1].length), E && this.rules.other.blankLine.test(v) && (h += v + `
`, n = n.substring(v.length + 1), m = !0), !m) {
          let z = this.rules.other.nextBulletRegex(S), _ = this.rules.other.hrRegex(S), N = this.rules.other.fencesBeginRegex(S), B = this.rules.other.headingBeginRegex(S), R = this.rules.other.htmlBeginRegex(S), X = this.rules.other.blockquoteBeginRegex(S);
          for (; n; ) {
            let q = n.split(`
`, 1)[0], O;
            if (v = q, this.options.pedantic ? (v = v.replace(this.rules.other.listReplaceNesting, "  "), O = v) : O = v.replace(this.rules.other.tabCharGlobal, "    "), N.test(v) || B.test(v) || R.test(v) || X.test(v) || z.test(v) || _.test(v)) break;
            if (O.search(this.rules.other.nonSpaceChar) >= S || !v.trim()) x += `
` + O.slice(S);
            else {
              if (E || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || N.test(g) || B.test(g) || _.test(g)) break;
              x += `
` + v;
            }
            E = !v.trim(), h += q + `
`, n = n.substring(q.length + 1), g = O.slice(S);
          }
        }
        s.loose || (f ? s.loose = !0 : this.rules.other.doubleBlankLine.test(h) && (f = !0)), s.items.push({ type: "list_item", raw: h, task: !!this.options.gfm && this.rules.other.listIsTask.test(x), loose: !1, text: x, tokens: [] }), s.raw += h;
      }
      let d = s.items.at(-1);
      if (d) d.raw = d.raw.trimEnd(), d.text = d.text.trimEnd();
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
          let x = this.rules.other.listTaskCheckbox.exec(m.raw);
          if (x) {
            let g = { type: "checkbox", raw: x[0] + " ", checked: x[0] !== "[ ]" };
            m.checked = g.checked, s.loose ? m.tokens[0] && ["paragraph", "text"].includes(m.tokens[0].type) && "tokens" in m.tokens[0] && m.tokens[0].tokens ? (m.tokens[0].raw = g.raw + m.tokens[0].raw, m.tokens[0].text = g.raw + m.tokens[0].text, m.tokens[0].tokens.unshift(g)) : m.tokens.unshift({ type: "paragraph", raw: g.raw, text: g.raw, tokens: [g] }) : m.tokens.unshift(g);
          }
        } else m.task && (m.task = !1);
        if (!s.loose) {
          let x = m.tokens.filter((v) => v.type === "space"), g = x.length > 0 && x.some((v) => this.rules.other.anyLine.test(v.raw));
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
      let r = ip(a[0]);
      return { type: "html", block: !0, raw: r, pre: a[1] === "pre" || a[1] === "script" || a[1] === "style", text: r };
    }
  }
  def(n) {
    let a = this.rules.block.def.exec(n);
    if (a) {
      let r = a[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), i = a[2] ? a[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", s = a[3] ? a[3].substring(1, a[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : a[3];
      return { type: "def", tag: r, raw: Ln(a[0], `
`), href: i, title: s };
    }
  }
  table(n) {
    let a = this.rules.block.table.exec(n);
    if (!a || !this.rules.other.tableDelimiter.test(a[2])) return;
    let r = rp(a[1]), i = a[2].replace(this.rules.other.tableAlignChars, "").split("|"), s = a[3]?.trim() ? a[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], c = { type: "table", raw: Ln(a[0], `
`), header: [], align: [], rows: [] };
    if (r.length === i.length) {
      for (let f of i) this.rules.other.tableAlignRight.test(f) ? c.align.push("right") : this.rules.other.tableAlignCenter.test(f) ? c.align.push("center") : this.rules.other.tableAlignLeft.test(f) ? c.align.push("left") : c.align.push(null);
      for (let f = 0; f < r.length; f++) c.header.push({ text: r[f], tokens: this.lexer.inline(r[f]), header: !0, align: c.align[f] });
      for (let f of s) c.rows.push(rp(f, c.header.length).map((d, m) => ({ text: d, tokens: this.lexer.inline(d), header: !1, align: c.align[m] })));
      return c;
    }
  }
  lheading(n) {
    let a = this.rules.block.lheading.exec(n);
    if (a) {
      let r = a[1].trim();
      return { type: "heading", raw: Ln(a[0], `
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
        let c = Ln(r.slice(0, -1), "\\");
        if ((r.length - c.length) % 2 === 0) return;
      } else {
        let c = J1(a[2], "()");
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
      return i = i.trim(), this.rules.other.startAngleBracket.test(i) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(r) ? i = i.slice(1) : i = i.slice(1, -1)), sp(a, { href: i && i.replace(this.rules.inline.anyPunctuation, "$1"), title: s && s.replace(this.rules.inline.anyPunctuation, "$1") }, a[0], this.lexer, this.rules);
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
      return sp(r, s, r[0], this.lexer, this.rules);
    }
  }
  emStrong(n, a, r = "") {
    let i = this.rules.inline.emStrongLDelim.exec(n);
    if (!(!i || !i[1] && !i[2] && !i[3] && !i[4] || i[4] && r.match(this.rules.other.unicodeAlphaNumeric)) && (!(i[1] || i[3]) || !r || this.rules.inline.punctuation.exec(r))) {
      let s = [...i[0]].length - 1, c, f, d = s, m = 0, h = i[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (h.lastIndex = 0, a = a.slice(-1 * n.length + s); (i = h.exec(a)) !== null; ) {
        if (c = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !c) continue;
        if (f = [...c].length, i[3] || i[4]) {
          d += f;
          continue;
        } else if ((i[5] || i[6]) && s % 3 && !((s + f) % 3)) {
          m += f;
          continue;
        }
        if (d -= f, d > 0) continue;
        f = Math.min(f, f + d + m);
        let x = [...i[0]][0].length, g = n.slice(0, s + i.index + x + f);
        if (Math.min(s, f) % 2) {
          let E = g.slice(1, -1);
          return { type: "em", raw: g, text: E, tokens: this.lexer.inlineTokens(E) };
        }
        let v = g.slice(2, -2);
        return { type: "strong", raw: g, text: v, tokens: this.lexer.inlineTokens(v) };
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
      let s = [...i[0]].length - 1, c, f, d = s, m = this.rules.inline.delRDelim;
      for (m.lastIndex = 0, a = a.slice(-1 * n.length + s); (i = m.exec(a)) !== null; ) {
        if (c = i[1] || i[2] || i[3] || i[4] || i[5] || i[6], !c || (f = [...c].length, f !== s)) continue;
        if (i[3] || i[4]) {
          d += f;
          continue;
        }
        if (d -= f, d > 0) continue;
        f = Math.min(f, f + d);
        let h = [...i[0]][0].length, x = n.slice(0, s + i.index + h + f), g = x.slice(s, -s);
        return { type: "del", raw: x, text: g, tokens: this.lexer.inlineTokens(g) };
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
}, Ht = class qo {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(a) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = a || _a, this.options.tokenizer = this.options.tokenizer || new xi(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, top: !0 };
    let r = { other: mt, block: Pr.normal, inline: Ol.normal };
    this.options.pedantic ? (r.block = Pr.pedantic, r.inline = Ol.pedantic) : this.options.gfm && (r.block = Pr.gfm, this.options.breaks ? r.inline = Ol.breaks : r.inline = Ol.gfm), this.tokenizer.rules = r;
  }
  static get rules() {
    return { block: Pr, inline: Ol };
  }
  static lex(a, r) {
    return new qo(r).lex(a);
  }
  static lexInline(a, r) {
    return new qo(r).inlineTokens(a);
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
      if (this.options.extensions?.block?.some((d) => (c = d.call({ lexer: this }, a, r)) ? (a = a.substring(c.raw.length), r.push(c), !0) : !1)) continue;
      if (c = this.tokenizer.space(a)) {
        a = a.substring(c.raw.length);
        let d = r.at(-1);
        c.raw.length === 1 && d !== void 0 ? d.raw += `
` : r.push(c);
        continue;
      }
      if (c = this.tokenizer.code(a)) {
        a = a.substring(c.raw.length);
        let d = r.at(-1);
        d?.type === "paragraph" || d?.type === "text" ? (d.raw += (d.raw.endsWith(`
`) ? "" : `
`) + c.raw, d.text += `
` + c.text, this.inlineQueue.at(-1).src = d.text) : r.push(c);
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
        let d = r.at(-1);
        d?.type === "paragraph" || d?.type === "text" ? (d.raw += (d.raw.endsWith(`
`) ? "" : `
`) + c.raw, d.text += `
` + c.raw, this.inlineQueue.at(-1).src = d.text) : this.tokens.links[c.tag] || (this.tokens.links[c.tag] = { href: c.href, title: c.title }, r.push(c));
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
        let d = 1 / 0, m = a.slice(1), h;
        this.options.extensions.startBlock.forEach((x) => {
          h = x.call({ lexer: this }, m), typeof h == "number" && h >= 0 && (d = Math.min(d, h));
        }), d < 1 / 0 && d >= 0 && (f = a.substring(0, d + 1));
      }
      if (this.state.top && (c = this.tokenizer.paragraph(f))) {
        let d = r.at(-1);
        i && d?.type === "paragraph" ? (d.raw += (d.raw.endsWith(`
`) ? "" : `
`) + c.raw, d.text += `
` + c.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = d.text) : r.push(c), i = f.length !== a.length, a = a.substring(c.raw.length);
        continue;
      }
      if (c = this.tokenizer.text(a)) {
        a = a.substring(c.raw.length);
        let d = r.at(-1);
        d?.type === "text" ? (d.raw += (d.raw.endsWith(`
`) ? "" : `
`) + c.raw, d.text += `
` + c.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = d.text) : r.push(c);
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
      let d = Object.keys(this.tokens.links);
      d.length > 0 && (i = i.replace(this.tokenizer.rules.inline.reflinkSearch, (m) => d.includes(m.slice(m.lastIndexOf("[") + 1, -1)) ? "[" + "a".repeat(m.length - 2) + "]" : m));
    }
    i = i.replace(this.tokenizer.rules.inline.anyPunctuation, "++"), i = i.replace(this.tokenizer.rules.inline.blockSkip, (d, m, h) => {
      let x = h ? h.length : 0;
      return d.slice(0, x) + "[" + "a".repeat(d.length - x - 2) + "]";
    }), i = this.options.hooks?.emStrongMask?.call({ lexer: this }, i) ?? i;
    let s = !1, c = "", f = 1 / 0;
    for (; a; ) {
      if (a.length < f) f = a.length;
      else {
        this.infiniteLoopError(a.charCodeAt(0));
        break;
      }
      s || (c = ""), s = !1;
      let d;
      if (this.options.extensions?.inline?.some((h) => (d = h.call({ lexer: this }, a, r)) ? (a = a.substring(d.raw.length), r.push(d), !0) : !1)) continue;
      if (d = this.tokenizer.escape(a)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (d = this.tokenizer.tag(a)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (d = this.tokenizer.link(a)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (d = this.tokenizer.reflink(a, this.tokens.links)) {
        a = a.substring(d.raw.length);
        let h = r.at(-1);
        d.type === "text" && h?.type === "text" ? (h.raw += d.raw, h.text += d.text) : r.push(d);
        continue;
      }
      if (d = this.tokenizer.emStrong(a, i, c)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (d = this.tokenizer.codespan(a)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (d = this.tokenizer.br(a)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (d = this.tokenizer.del(a, i, c)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (d = this.tokenizer.autolink(a)) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      if (!this.state.inLink && (d = this.tokenizer.url(a))) {
        a = a.substring(d.raw.length), r.push(d);
        continue;
      }
      let m = a;
      if (this.options.extensions?.startInline) {
        let h = 1 / 0, x = a.slice(1), g;
        this.options.extensions.startInline.forEach((v) => {
          g = v.call({ lexer: this }, x), typeof g == "number" && g >= 0 && (h = Math.min(h, g));
        }), h < 1 / 0 && h >= 0 && (m = a.substring(0, h + 1));
      }
      if (d = this.tokenizer.inlineText(m)) {
        a = a.substring(d.raw.length), d.raw.slice(-1) !== "_" && (c = d.raw.slice(-1)), s = !0;
        let h = r.at(-1);
        h?.type === "text" ? (h.raw += d.raw, h.text += d.text) : r.push(d);
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
}, wi = class {
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
    return i ? '<pre><code class="language-' + tn(i) + '">' + (r ? s : tn(s, !0)) + `</code></pre>
` : "<pre><code>" + (r ? s : tn(s, !0)) + `</code></pre>
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
      let d = n.items[f];
      i += this.listitem(d);
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
    return `<code>${tn(n, !0)}</code>`;
  }
  br(n) {
    return "<br>";
  }
  del({ tokens: n }) {
    return `<del>${this.parser.parseInline(n)}</del>`;
  }
  link({ href: n, title: a, tokens: r }) {
    let i = this.parser.parseInline(r), s = lp(n);
    if (s === null) return i;
    n = s;
    let c = '<a href="' + n + '"';
    return a && (c += ' title="' + tn(a) + '"'), c += ">" + i + "</a>", c;
  }
  image({ href: n, title: a, text: r, tokens: i }) {
    i && (r = this.parser.parseInline(i, this.parser.textRenderer));
    let s = lp(n);
    if (s === null) return tn(r);
    n = s;
    let c = `<img src="${n}" alt="${tn(r)}"`;
    return a && (c += ` title="${tn(a)}"`), c += ">", c;
  }
  text(n) {
    return "tokens" in n && n.tokens ? this.parser.parseInline(n.tokens) : "escaped" in n && n.escaped ? n.text : tn(n.text);
  }
}, mc = class {
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
}, Zt = class Go {
  options;
  renderer;
  textRenderer;
  constructor(a) {
    this.options = a || _a, this.options.renderer = this.options.renderer || new wi(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new mc();
  }
  static parse(a, r) {
    return new Go(r).parse(a);
  }
  static parseInline(a, r) {
    return new Go(r).parseInline(a);
  }
  parse(a) {
    this.renderer.parser = this;
    let r = "";
    for (let i = 0; i < a.length; i++) {
      let s = a[i];
      if (this.options.extensions?.renderers?.[s.type]) {
        let f = s, d = this.options.extensions.renderers[f.type].call({ parser: this }, f);
        if (d !== !1 || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(f.type)) {
          r += d || "";
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
        let d = this.options.extensions.renderers[c.type].call({ parser: this }, c);
        if (d !== !1 || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(c.type)) {
          i += d || "";
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
          let d = 'Token with "' + f.type + '" type was not found.';
          if (this.options.silent) return console.error(d), "";
          throw new Error(d);
        }
      }
    }
    return i;
  }
}, Bl = class {
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
    return n ? Zt.parse : Zt.parseInline;
  }
}, $1 = class {
  defaults = ic();
  options = this.setOptions;
  parse = this.parseMarkdown(!0);
  parseInline = this.parseMarkdown(!1);
  Parser = Zt;
  Renderer = wi;
  TextRenderer = mc;
  Lexer = Ht;
  Tokenizer = xi;
  Hooks = Bl;
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
            let d = s.renderer.apply(this, f);
            return d === !1 && (d = c.apply(this, f)), d;
          } : a.renderers[s.name] = s.renderer;
        }
        if ("tokenizer" in s) {
          if (!s.level || s.level !== "block" && s.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let c = a[s.level];
          c ? c.unshift(s.tokenizer) : a[s.level] = [s.tokenizer], s.start && (s.level === "block" ? a.startBlock ? a.startBlock.push(s.start) : a.startBlock = [s.start] : s.level === "inline" && (a.startInline ? a.startInline.push(s.start) : a.startInline = [s.start]));
        }
        "childTokens" in s && s.childTokens && (a.childTokens[s.name] = s.childTokens);
      }), i.extensions = a), r.renderer) {
        let s = this.defaults.renderer || new wi(this.defaults);
        for (let c in r.renderer) {
          if (!(c in s)) throw new Error(`renderer '${c}' does not exist`);
          if (["options", "parser"].includes(c)) continue;
          let f = c, d = r.renderer[f], m = s[f];
          s[f] = (...h) => {
            let x = d.apply(s, h);
            return x === !1 && (x = m.apply(s, h)), x || "";
          };
        }
        i.renderer = s;
      }
      if (r.tokenizer) {
        let s = this.defaults.tokenizer || new xi(this.defaults);
        for (let c in r.tokenizer) {
          if (!(c in s)) throw new Error(`tokenizer '${c}' does not exist`);
          if (["options", "rules", "lexer"].includes(c)) continue;
          let f = c, d = r.tokenizer[f], m = s[f];
          s[f] = (...h) => {
            let x = d.apply(s, h);
            return x === !1 && (x = m.apply(s, h)), x;
          };
        }
        i.tokenizer = s;
      }
      if (r.hooks) {
        let s = this.defaults.hooks || new Bl();
        for (let c in r.hooks) {
          if (!(c in s)) throw new Error(`hook '${c}' does not exist`);
          if (["options", "block"].includes(c)) continue;
          let f = c, d = r.hooks[f], m = s[f];
          Bl.passThroughHooks.has(c) ? s[f] = (h) => {
            if (this.defaults.async && Bl.passThroughHooksRespectAsync.has(c)) return (async () => {
              let g = await d.call(s, h);
              return m.call(s, g);
            })();
            let x = d.call(s, h);
            return m.call(s, x);
          } : s[f] = (...h) => {
            if (this.defaults.async) return (async () => {
              let g = await d.apply(s, h);
              return g === !1 && (g = await m.apply(s, h)), g;
            })();
            let x = d.apply(s, h);
            return x === !1 && (x = m.apply(s, h)), x;
          };
        }
        i.hooks = s;
      }
      if (r.walkTokens) {
        let s = this.defaults.walkTokens, c = r.walkTokens;
        i.walkTokens = function(f) {
          let d = [];
          return d.push(c.call(this, f)), s && (d = d.concat(s.call(this, f))), d;
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
    return Zt.parse(n, a ?? this.defaults);
  }
  parseMarkdown(n) {
    return (a, r) => {
      let i = { ...r }, s = { ...this.defaults, ...i }, c = this.onError(!!s.silent, !!s.async);
      if (this.defaults.async === !0 && i.async === !1) return c(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof a > "u" || a === null) return c(new Error("marked(): input parameter is undefined or null"));
      if (typeof a != "string") return c(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(a) + ", string expected"));
      if (s.hooks && (s.hooks.options = s, s.hooks.block = n), s.async) return (async () => {
        let f = s.hooks ? await s.hooks.preprocess(a) : a, d = await (s.hooks ? await s.hooks.provideLexer(n) : n ? Ht.lex : Ht.lexInline)(f, s), m = s.hooks ? await s.hooks.processAllTokens(d) : d;
        s.walkTokens && await Promise.all(this.walkTokens(m, s.walkTokens));
        let h = await (s.hooks ? await s.hooks.provideParser(n) : n ? Zt.parse : Zt.parseInline)(m, s);
        return s.hooks ? await s.hooks.postprocess(h) : h;
      })().catch(c);
      try {
        s.hooks && (a = s.hooks.preprocess(a));
        let f = (s.hooks ? s.hooks.provideLexer(n) : n ? Ht.lex : Ht.lexInline)(a, s);
        s.hooks && (f = s.hooks.processAllTokens(f)), s.walkTokens && this.walkTokens(f, s.walkTokens);
        let d = (s.hooks ? s.hooks.provideParser(n) : n ? Zt.parse : Zt.parseInline)(f, s);
        return s.hooks && (d = s.hooks.postprocess(d)), d;
      } catch (f) {
        return c(f);
      }
    };
  }
  onError(n, a) {
    return (r) => {
      if (r.message += `
Please report this to https://github.com/markedjs/marked.`, n) {
        let i = "<p>An error occurred:</p><pre>" + tn(r.message + "", !0) + "</pre>";
        return a ? Promise.resolve(i) : i;
      }
      if (a) return Promise.reject(r);
      throw r;
    };
  }
}, wa = new $1();
function Re(n, a) {
  return wa.parse(n, a);
}
Re.options = Re.setOptions = function(n) {
  return wa.setOptions(n), Re.defaults = wa.defaults, im(Re.defaults), Re;
};
Re.getDefaults = ic;
Re.defaults = _a;
Re.use = function(...n) {
  return wa.use(...n), Re.defaults = wa.defaults, im(Re.defaults), Re;
};
Re.walkTokens = function(n, a) {
  return wa.walkTokens(n, a);
};
Re.parseInline = wa.parseInline;
Re.Parser = Zt;
Re.parser = Zt.parse;
Re.Renderer = wi;
Re.TextRenderer = mc;
Re.Lexer = Ht;
Re.lexer = Ht.lex;
Re.Tokenizer = xi;
Re.Hooks = Bl;
Re.parse = Re;
Re.options;
Re.setOptions;
Re.use;
Re.walkTokens;
Re.parseInline;
Zt.parse;
Ht.lex;
//! markdown.mjs: a Markdown file's rendered preview, drawn from `marked`'s tokens into a fixed set of elements, the
//! ones the web's sanitised preview keeps (`renderFilePreview` in `packages/web/src/markdown.ts`), so the web's
//! `.file-markdown` rules style both. Nothing is parsed as HTML: an HTML token is drawn as its text. Nothing loads on
//! its own: an image is the web's text placeholder (`[image: alt] url`). A link is drawn only for an absolute
//! http(s) address and opens on an explicit click through the window (`link.open`); any other keeps its address as
//! its title, as the web's does.
const oi = 2e5;
function I1(n) {
  if (n.length <= oi) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, oi);
  return { source: n.slice(0, a > 0 ? a : oi), truncated: !0 };
}
const P1 = (n, a, r) => {
  const i = r.startsWith("data:") ? "data URL" : r.length > 200 ? `${r.slice(0, 200)}…` : r;
  return `[${n}${a ? `: ${a}` : ""}]${i ? ` ${i}` : ""}`;
};
function va(n, a) {
  return (n ?? []).map((r, i) => ey(r, i, a));
}
function ha(n, a) {
  return n.tokens ? va(n.tokens, a) : n.text;
}
function ey(n, a, r) {
  switch (n.type) {
    case "space":
      return null;
    case "heading":
      return K.createElement(`h${n.depth}`, { key: a }, ha(n, r));
    case "paragraph":
      return K.createElement("p", { key: a }, ha(n, r));
    case "text":
      return n.tokens ? K.createElement(K.Fragment, { key: a }, va(n.tokens, r)) : n.text;
    case "escape":
      return n.text;
    case "strong":
      return K.createElement("strong", { key: a }, ha(n, r));
    case "em":
      return K.createElement("em", { key: a }, ha(n, r));
    case "del":
      return K.createElement("del", { key: a }, ha(n, r));
    case "codespan":
      return K.createElement("code", { key: a }, n.text);
    case "br":
      return K.createElement("br", { key: a });
    case "hr":
      return K.createElement("hr", { key: a });
    case "code": {
      const i = /^[\w#+.-]+$/.test(n.lang ?? "") ? `language-${n.lang}` : void 0;
      return K.createElement("pre", { key: a }, K.createElement("code", i ? { className: i } : null, n.text));
    }
    case "blockquote":
      return K.createElement("blockquote", { key: a }, va(n.tokens, r));
    case "list": {
      const i = n.items.map((s, c) => K.createElement(
        "li",
        { key: c },
        s.task ? K.createElement("input", { type: "checkbox", checked: !!s.checked, disabled: !0, readOnly: !0 }) : null,
        s.task ? " " : null,
        va(s.tokens, r)
      ));
      return n.ordered ? K.createElement("ol", { key: a, start: n.start === "" || n.start === 1 ? void 0 : n.start }, i) : K.createElement("ul", { key: a }, i);
    }
    case "table": {
      const i = (s) => n.align[s] ? { textAlign: n.align[s] } : void 0;
      return K.createElement(
        "table",
        { key: a },
        K.createElement("thead", null, K.createElement("tr", null, n.header.map((s, c) => K.createElement("th", { key: c, style: i(c) }, va(s.tokens, r))))),
        K.createElement("tbody", null, n.rows.map((s, c) => K.createElement("tr", { key: c }, s.map((f, d) => K.createElement("td", { key: d, style: i(d) }, va(f.tokens, r))))))
      );
    }
    case "link": {
      const i = n.href ?? "";
      if (!/^https?:\/\//i.test(i)) return K.createElement("a", { key: a, title: i || void 0 }, ha(n, r));
      const s = (c) => {
        c.preventDefault?.(), r(i);
      };
      return K.createElement("a", { key: a, href: i, rel: "noopener noreferrer", onClick: s }, ha(n, r));
    }
    case "image":
      return K.createElement("span", { key: a, className: "md-placeholder" }, P1("image", n.text, n.href ?? ""));
    // Raw HTML is never parsed: it is drawn as written.
    case "html":
      return n.block ? K.createElement("p", { key: a }, n.text) : n.text;
    default:
      return n.raw ?? null;
  }
}
function ty(n, a) {
  return va(Ht.lex(n, { gfm: !0 }), a);
}
const ei = 4, Yn = 8, ny = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", op = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function ay({ value: n, onChange: a, options: r, className: i, ariaLabel: s, testId: c, id: f, title: d, disabled: m, placeholder: h, freeText: x, onKeyDown: g }) {
  const v = K.useId(), [E, S] = K.useState(!1), [z, _] = K.useState(-1), [N, B] = K.useState(!1), R = K.useRef(null), X = K.useRef(null), [q, O] = K.useState({}), b = K.useRef({ text: "", at: 0 }), w = x && N && n ? r.filter((Y) => op(Y).toLowerCase().includes(n.toLowerCase()) || Y.value.toLowerCase().includes(n.toLowerCase())) : r, k = r.find((Y) => Y.value === n), C = (Y) => `${v}-${Y}`;
  function j(Y) {
    m || (_(Y), S(!0));
  }
  function M() {
    S(!1), B(!1), _(-1);
  }
  function H(Y) {
    !Y || Y.disabled || (a(Y.value), M());
  }
  function Z(Y, V) {
    for (let T = 1; T <= w.length; T++) {
      const J = (Y + V * T + w.length * T) % w.length;
      if (!w[J].disabled) return J;
    }
    return Y;
  }
  const $ = () => w.findIndex((Y) => !Y.disabled), Q = () => w.length - 1 - [...w].reverse().findIndex((Y) => !Y.disabled);
  di(() => {
    if (!E || !R.current) {
      O((ae) => ae.left === void 0 ? ae : {});
      return;
    }
    const Y = R.current.getBoundingClientRect(), V = window.innerHeight - Y.bottom - ei - Yn, T = Y.top - ei - Yn, J = V < 160 && T > V;
    O({
      position: "fixed",
      left: Math.min(Math.max(Yn, Y.left), Math.max(Yn, window.innerWidth - Y.width - Yn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: Y.width,
      maxWidth: window.innerWidth - 2 * Yn,
      maxHeight: Math.min(J ? T : V, 320),
      ...J ? { bottom: window.innerHeight - Y.top + ei } : { top: Y.bottom + ei },
      overflowY: "auto"
    });
  }, [E, w.length]), di(() => {
    const Y = X.current;
    if (!E || !Y || q.left === void 0) return;
    const V = Y.getBoundingClientRect().right, T = window.innerWidth - Yn;
    V > T && O((J) => ({ ...J, left: Math.max(Yn, Number(J.left) - (V - T)) }));
  }, [E, q]), nt(() => {
    if (!E) return;
    const Y = (V) => {
      const T = V.target;
      (T === document || T instanceof Node && R.current && T.contains(R.current)) && M();
    };
    return window.addEventListener("resize", M), window.addEventListener("scroll", Y, !0), () => {
      window.removeEventListener("resize", M), window.removeEventListener("scroll", Y, !0);
    };
  }, [E]), nt(() => {
    const Y = E && z >= 0 ? document.getElementById(C(z)) : null, V = X.current;
    !Y || !V || (Y.offsetTop < V.scrollTop ? V.scrollTop = Y.offsetTop : Y.offsetTop + Y.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = Y.offsetTop + Y.offsetHeight - V.clientHeight));
  }, [E, z]), vm(E, (Y) => {
    Y || M();
  }, R, X);
  function W(Y) {
    if (Y.nativeEvent.isComposing) return;
    const V = () => {
      Y.preventDefault(), Y.stopPropagation();
    }, { key: T } = Y;
    if (E) {
      if (T === "Escape") {
        V(), M();
        return;
      } else if (T === "Tab")
        M();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        V(), w.length && _(z < 0 ? T === "ArrowDown" ? $() : Q() : Z(z, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !x) {
        V(), _($());
        return;
      } else if (T === "End" && !x) {
        V(), _(Q());
        return;
      } else if (T === "Enter" || T === " " && !x) {
        if (z >= 0 && w[z]) {
          V(), H(w[z]);
          return;
        }
        if (!x) {
          V(), M();
          return;
        }
      } else if (!x && T.length === 1 && !Y.metaKey && !Y.ctrlKey && !Y.altKey) {
        const J = Date.now();
        b.current = { text: (J - b.current.at > 600 ? "" : b.current.text) + T.toLowerCase(), at: J };
        const ae = Math.max(z, 0), oe = [...w.slice(ae + (b.current.text.length === 1 ? 1 : 0)), ...w.slice(0, ae + 1)].find((ce) => !ce.disabled && op(ce).toLowerCase().startsWith(b.current.text));
        oe && (V(), _(w.indexOf(oe)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !x && (T === "Enter" || T === " ")) {
      V(), j(Math.max(0, w.findIndex((J) => J.value === n)));
      return;
    }
    g?.(Y);
  }
  const I = {
    ref: (Y) => {
      R.current = Y;
    },
    id: f,
    title: d,
    disabled: m,
    "aria-label": s,
    "aria-expanded": E,
    "aria-controls": E ? v : void 0,
    "aria-activedescendant": E && z >= 0 ? C(z) : void 0,
    "data-testid": c,
    onKeyDown: W
  };
  return /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
    x ? /* @__PURE__ */ te.jsx(
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
        onChange: (Y) => {
          a(Y.target.value), B(!0), E ? _(-1) : (_(-1), S(!0));
        },
        onBlur: () => M()
      }
    ) : /* @__PURE__ */ te.jsxs(
      "button",
      {
        ...I,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Ge("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => E ? M() : j(Math.max(0, w.findIndex((Y) => Y.value === n))),
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "min-w-0 flex-1 truncate", children: k ? k.label : h ?? "" }),
          /* @__PURE__ */ te.jsx(bc, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    E && w.length > 0 && Vl(
      /* @__PURE__ */ te.jsx(
        "div",
        {
          ref: X,
          id: v,
          role: "listbox",
          "aria-label": s,
          className: Ge("z-[9999]", Ni),
          style: q,
          onMouseDown: (Y) => {
            Y.preventDefault(), Y.stopPropagation();
          },
          onClick: (Y) => Y.stopPropagation(),
          children: w.map((Y, V) => /* @__PURE__ */ te.jsxs(
            "div",
            {
              id: C(V),
              role: "option",
              "aria-selected": Y.value === n,
              "aria-disabled": Y.disabled || void 0,
              "data-value": Y.value,
              className: Ge(ny, V === z && !Y.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                Y.disabled || _(V);
              },
              onClick: () => H(Y),
              children: [
                /* @__PURE__ */ te.jsx("span", { className: "min-w-0 truncate", children: Y.label }),
                Y.value === n && /* @__PURE__ */ te.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            Y.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const cp = 230, ly = 370;
function ry({ x: n, y: a, readOnly: r, canUndo: i, canRedo: s, hasSelection: c, onClose: f, actions: d }) {
  const m = K.useRef(null);
  nt(() => {
    const v = (S) => {
      m.current?.contains(S.target) || f();
    }, E = (S) => {
      S.key === "Escape" && (S.preventDefault(), f());
    };
    return document.addEventListener("mousedown", v), document.addEventListener("keydown", E), window.addEventListener("blur", f), window.addEventListener("resize", f), () => {
      document.removeEventListener("mousedown", v), document.removeEventListener("keydown", E), window.removeEventListener("blur", f), window.removeEventListener("resize", f);
    };
  }, [f]);
  const h = (v, E) => Vo(_m ? v : E), x = (v, E, S, z, _ = !1) => /* @__PURE__ */ te.jsxs("button", { type: "button", className: Ge(Sm(), "flex items-center justify-between gap-6"), "data-testid": S, disabled: _, onClick: E, children: [
    /* @__PURE__ */ te.jsx("span", { children: v }),
    /* @__PURE__ */ te.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: z })
  ] }), g = d.askAgent;
  return Vl(
    /* @__PURE__ */ te.jsxs(
      "div",
      {
        ref: m,
        className: Ni,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - ly - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - cp - 8)),
          zIndex: 9999,
          minWidth: cp
        },
        onContextMenu: (v) => v.preventDefault(),
        children: [
          g && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
            x(c ? "Ask agent about selection…" : "Ask agent about file…", g, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ te.jsx("div", { className: ui })
          ] }),
          x("Undo", d.undo, "editor-menu-undo", h("cmd+z", "ctrl+z"), r || !i),
          x("Redo", d.redo, "editor-menu-redo", h("cmd+shift+z", "ctrl+y"), r || !s),
          /* @__PURE__ */ te.jsx("div", { className: ui }),
          x("Cut", d.cut, "editor-menu-cut", h("cmd+x", "ctrl+x"), r || !c),
          x("Copy", d.copy, "editor-menu-copy", h("cmd+c", "ctrl+c"), !c),
          x("Paste", d.paste, "editor-menu-paste", h("cmd+v", "ctrl+v"), r),
          x("Select All", d.selectAll, "editor-menu-select-all", h("cmd+a", "ctrl+a")),
          /* @__PURE__ */ te.jsx("div", { className: ui }),
          x("Find…", d.find, "editor-menu-find", h("cmd+f", "ctrl+f")),
          !r && x("Replace…", d.replace, "editor-menu-replace", h("cmd+alt+f", "ctrl+h")),
          x("Go to Line…", d.gotoLine, "editor-menu-goto", Vo("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const iy = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", sy = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", oy = "m-0 mb-2 text-[0.82rem] text-subtext-0", gm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", hc = `${gm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, cy = `${hc} min-w-[5.5rem] shrink-0`, gc = `${gm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, uy = `${gc} flex-1 max-[700px]:flex-[1_1_100%]`, dy = `${gc} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, fy = `${gc} flex-[1_1_100%]`, py = "flex flex-wrap items-center gap-[0.4rem]", my = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", hy = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", gy = `settings-modal__host-row ${hy}`, by = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", vy = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", bm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", yy = `${bm} bg-accent`, xy = `${bm} ml-auto bg-red`;
function bc({ open: n, size: a = 12, className: r }) {
  return /* @__PURE__ */ te.jsx("svg", { className: r, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function wy({ label: n, items: a, testId: r, side: i = "right", up: s = !1, maxHeight: c = 320 }) {
  const [f, d] = K.useState(!1), [m, h] = K.useState(!1), x = K.useRef(null), g = K.useRef(null), v = () => [...g.current?.querySelectorAll('[role="menuitem"]') ?? []];
  nt(() => {
    f && m && (v()[0]?.focus(), h(!1));
  }, [f, m]);
  const E = () => {
    d(!0), h(!0);
  }, S = (_) => {
    (_.key === "ArrowRight" || _.key === "Enter" || _.key === " ") && (_.preventDefault(), E());
  }, z = (_) => {
    const N = v(), B = N.findIndex((R) => R === document.activeElement);
    _.key === "ArrowDown" || _.key === "ArrowUp" ? (_.preventDefault(), N[(B + (_.key === "ArrowDown" ? 1 : N.length - 1)) % N.length]?.focus()) : (_.key === "ArrowLeft" || _.key === "Escape") && (_.preventDefault(), _.stopPropagation(), d(!1), x.current?.focus());
  };
  return /* @__PURE__ */ te.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ te.jsxs(
      "button",
      {
        ref: x,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": f,
        className: Ge(Ho(), "flex items-center justify-between gap-2"),
        "data-testid": r,
        onClick: () => f ? d(!1) : E(),
        onKeyDown: S,
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ te.jsx(bc, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ te.jsx(
      "div",
      {
        ref: g,
        role: "menu",
        "aria-label": n,
        className: Ge(
          Ni,
          "absolute z-10 w-60 overflow-y-auto",
          i === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          f ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: c },
        onKeyDown: z,
        children: a.map((_) => /* @__PURE__ */ te.jsx("button", { type: "button", role: "menuitem", className: Ho(), "data-testid": _.testId, onClick: _.onSelect, children: /* @__PURE__ */ te.jsx("span", { className: "block truncate", children: _.label }) }, _.key))
      }
    )
  ] });
}
function ky(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const Lo = {
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
function Yo(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((r) => r.id === n.parentSessionId);
}
function _y(n) {
  const a = /* @__PURE__ */ new Map();
  for (const r of n)
    Yo(r, n) && a.set(r.parentSessionId, [...a.get(r.parentSessionId) ?? [], r]);
  return a.size ? n.filter((r) => !Yo(r, n)).flatMap((r) => [r, ...a.get(r.id) ?? []]) : n;
}
const ti = 6, up = 8;
function Sy(n, a = {}) {
  const { minWidth: r = 220, align: i = "right", minSpaceAbove: s = 100 } = a, c = n.getBoundingClientRect(), f = window.innerWidth, d = window.innerHeight, m = i === "right" ? { right: Math.max(0, f - c.right) } : { left: Math.max(0, c.left) }, h = c.top - ti - up, x = d - c.bottom - ti - up;
  return h >= s ? {
    position: "fixed",
    bottom: d - c.top + ti,
    ...m,
    minWidth: r,
    maxHeight: Math.min(h, d * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: c.bottom + ti,
    ...m,
    minWidth: r,
    maxHeight: Math.min(x, d * 0.75),
    overflowY: "auto"
  };
}
function vm(n, a, r, i) {
  nt(() => {
    if (!n) return;
    function s(f) {
      const d = f.target, m = r.current?.contains(d) ?? !1, h = i.current?.contains(d) ?? !1;
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
function Ey({ icon: n, fallback: a }) {
  const [r, i] = K.useState(!1);
  return nt(() => i(!1), [n]), !n || r ? /* @__PURE__ */ te.jsx(te.Fragment, { children: a }) : /* @__PURE__ */ te.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
function zy(n, a = !1) {
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
const Ny = {
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
function Ty({ name: n, directory: a = !1, open: r = !1 }) {
  const { kind: i, tone: s, text: c } = zy(n, a);
  return /* @__PURE__ */ te.jsxs("svg", { className: Ge("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": i, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    i === "react" ? /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : c ? /* @__PURE__ */ te.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: c }) : /* @__PURE__ */ te.jsx("path", { d: i === "folder" && r ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : Ny[i] }),
    i === "branch" && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    i === "image" && /* @__PURE__ */ te.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const Cy = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, dp = (n) => typeof n == "string" ? Cy[n] ?? "?" : "?", fp = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function Ay(n) {
  const a = dp(n.index), r = dp(n.worktree), i = a === "!" || r === "!", s = i ? "!" : n.staged && n.unstaged ? `${a || "?"}/${r || "?"}` : n.staged ? a : r || a, c = `Git · Index: ${fp(n.index)}; working tree: ${fp(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, f = i || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: c, tone: f };
}
function My({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ te.jsx("span", { className: Ge("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: r, title: i, tone: s } = Ay(n.entry);
  return r ? /* @__PURE__ */ te.jsx("span", { className: Ge("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": i, title: i, "data-testid": "file-git-marker", children: r }) : null;
}
const Ry = ["application/zip", "application/x-tar", "application/gzip"];
function jy(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (Ry.includes(a)) return "archive";
}
const Oy = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", ym = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Dy = `${ym} group-aria-[checked=false]:text-accent`, By = `${ym} group-aria-checked:text-accent`, Hy = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", Uy = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function qy({
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
      className: Oy,
      "data-testid": r,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => a(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__label mode-switch__label--ui", Dy), children: "UI" }),
        /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__track", Hy), children: /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__thumb", Uy) }) }),
        /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__label mode-switch__label--cli", By), children: "CLI" })
      ]
    }
  );
}
const el = function(n, a) {
  let s = n;
  const c = Hl[a];
  let f = null, d = 0, m = null;
  const h = [], x = {}, g = function(b, w) {
    d = s * 4 + 17, f = (function(k) {
      const C = new Array(k);
      for (let j = 0; j < k; j += 1) {
        C[j] = new Array(k);
        for (let M = 0; M < k; M += 1)
          C[j][M] = null;
      }
      return C;
    })(d), v(0, 0), v(d - 7, 0), v(0, d - 7), z(), S(), N(b, w), s >= 7 && _(b), m == null && (m = X(s, c, h)), B(m, w);
  }, v = function(b, w) {
    for (let k = -1; k <= 7; k += 1)
      if (!(b + k <= -1 || d <= b + k))
        for (let C = -1; C <= 7; C += 1)
          w + C <= -1 || d <= w + C || (0 <= k && k <= 6 && (C == 0 || C == 6) || 0 <= C && C <= 6 && (k == 0 || k == 6) || 2 <= k && k <= 4 && 2 <= C && C <= 4 ? f[b + k][w + C] = !0 : f[b + k][w + C] = !1);
  }, E = function() {
    let b = 0, w = 0;
    for (let k = 0; k < 8; k += 1) {
      g(!0, k);
      const C = Vn.getLostPoint(x);
      (k == 0 || b > C) && (b = C, w = k);
    }
    return w;
  }, S = function() {
    for (let b = 8; b < d - 8; b += 1)
      f[b][6] == null && (f[b][6] = b % 2 == 0);
    for (let b = 8; b < d - 8; b += 1)
      f[6][b] == null && (f[6][b] = b % 2 == 0);
  }, z = function() {
    const b = Vn.getPatternPosition(s);
    for (let w = 0; w < b.length; w += 1)
      for (let k = 0; k < b.length; k += 1) {
        const C = b[w], j = b[k];
        if (f[C][j] == null)
          for (let M = -2; M <= 2; M += 1)
            for (let H = -2; H <= 2; H += 1)
              M == -2 || M == 2 || H == -2 || H == 2 || M == 0 && H == 0 ? f[C + M][j + H] = !0 : f[C + M][j + H] = !1;
      }
  }, _ = function(b) {
    const w = Vn.getBCHTypeNumber(s);
    for (let k = 0; k < 18; k += 1) {
      const C = !b && (w >> k & 1) == 1;
      f[Math.floor(k / 3)][k % 3 + d - 8 - 3] = C;
    }
    for (let k = 0; k < 18; k += 1) {
      const C = !b && (w >> k & 1) == 1;
      f[k % 3 + d - 8 - 3][Math.floor(k / 3)] = C;
    }
  }, N = function(b, w) {
    const k = c << 3 | w, C = Vn.getBCHTypeInfo(k);
    for (let j = 0; j < 15; j += 1) {
      const M = !b && (C >> j & 1) == 1;
      j < 6 ? f[j][8] = M : j < 8 ? f[j + 1][8] = M : f[d - 15 + j][8] = M;
    }
    for (let j = 0; j < 15; j += 1) {
      const M = !b && (C >> j & 1) == 1;
      j < 8 ? f[8][d - j - 1] = M : j < 9 ? f[8][15 - j - 1 + 1] = M : f[8][15 - j - 1] = M;
    }
    f[d - 8][8] = !b;
  }, B = function(b, w) {
    let k = -1, C = d - 1, j = 7, M = 0;
    const H = Vn.getMaskFunction(w);
    for (let Z = d - 1; Z > 0; Z -= 2)
      for (Z == 6 && (Z -= 1); ; ) {
        for (let $ = 0; $ < 2; $ += 1)
          if (f[C][Z - $] == null) {
            let Q = !1;
            M < b.length && (Q = (b[M] >>> j & 1) == 1), H(C, Z - $) && (Q = !Q), f[C][Z - $] = Q, j -= 1, j == -1 && (M += 1, j = 7);
          }
        if (C += k, C < 0 || d <= C) {
          C -= k, k = -k;
          break;
        }
      }
  }, R = function(b, w) {
    let k = 0, C = 0, j = 0;
    const M = new Array(w.length), H = new Array(w.length);
    for (let W = 0; W < w.length; W += 1) {
      const I = w[W].dataCount, Y = w[W].totalCount - I;
      C = Math.max(C, I), j = Math.max(j, Y), M[W] = new Array(I);
      for (let ae = 0; ae < M[W].length; ae += 1)
        M[W][ae] = 255 & b.getBuffer()[ae + k];
      k += I;
      const V = Vn.getErrorCorrectPolynomial(Y), J = Yl(M[W], V.getLength() - 1).mod(V);
      H[W] = new Array(V.getLength() - 1);
      for (let ae = 0; ae < H[W].length; ae += 1) {
        const oe = ae + J.getLength() - H[W].length;
        H[W][ae] = oe >= 0 ? J.getAt(oe) : 0;
      }
    }
    let Z = 0;
    for (let W = 0; W < w.length; W += 1)
      Z += w[W].totalCount;
    const $ = new Array(Z);
    let Q = 0;
    for (let W = 0; W < C; W += 1)
      for (let I = 0; I < w.length; I += 1)
        W < M[I].length && ($[Q] = M[I][W], Q += 1);
    for (let W = 0; W < j; W += 1)
      for (let I = 0; I < w.length; I += 1)
        W < H[I].length && ($[Q] = H[I][W], Q += 1);
    return $;
  }, X = function(b, w, k) {
    const C = pp.getRSBlocks(b, w), j = mp();
    for (let H = 0; H < k.length; H += 1) {
      const Z = k[H];
      j.put(Z.getMode(), 4), j.put(Z.getLength(), Vn.getLengthInBits(Z.getMode(), b)), Z.write(j);
    }
    let M = 0;
    for (let H = 0; H < C.length; H += 1)
      M += C[H].dataCount;
    if (j.getLengthInBits() > M * 8)
      throw "code length overflow. (" + j.getLengthInBits() + ">" + M * 8 + ")";
    for (j.getLengthInBits() + 4 <= M * 8 && j.put(0, 4); j.getLengthInBits() % 8 != 0; )
      j.putBit(!1);
    for (; !(j.getLengthInBits() >= M * 8 || (j.put(236, 8), j.getLengthInBits() >= M * 8)); )
      j.put(17, 8);
    return R(j, C);
  };
  x.addData = function(b, w) {
    w = w || "Byte";
    let k = null;
    switch (w) {
      case "Numeric":
        k = Gy(b);
        break;
      case "Alphanumeric":
        k = Ly(b);
        break;
      case "Byte":
        k = Yy(b);
        break;
      case "Kanji":
        k = Qy(b);
        break;
      default:
        throw "mode:" + w;
    }
    h.push(k), m = null;
  }, x.isDark = function(b, w) {
    if (b < 0 || d <= b || w < 0 || d <= w)
      throw b + "," + w;
    return f[b][w];
  }, x.getModuleCount = function() {
    return d;
  }, x.make = function() {
    if (s < 1) {
      let b = 1;
      for (; b < 40; b++) {
        const w = pp.getRSBlocks(b, c), k = mp();
        for (let j = 0; j < h.length; j++) {
          const M = h[j];
          k.put(M.getMode(), 4), k.put(M.getLength(), Vn.getLengthInBits(M.getMode(), b)), M.write(k);
        }
        let C = 0;
        for (let j = 0; j < w.length; j++)
          C += w[j].dataCount;
        if (k.getLengthInBits() <= C * 8)
          break;
      }
      s = b;
    }
    g(!1, E());
  }, x.createTableTag = function(b, w) {
    b = b || 2, w = typeof w > "u" ? b * 4 : w;
    let k = "";
    k += '<table style="', k += " border-width: 0px; border-style: none;", k += " border-collapse: collapse;", k += " padding: 0px; margin: " + w + "px;", k += '">', k += "<tbody>";
    for (let C = 0; C < x.getModuleCount(); C += 1) {
      k += "<tr>";
      for (let j = 0; j < x.getModuleCount(); j += 1)
        k += '<td style="', k += " border-width: 0px; border-style: none;", k += " border-collapse: collapse;", k += " padding: 0px; margin: 0px;", k += " width: " + b + "px;", k += " height: " + b + "px;", k += " background-color: ", k += x.isDark(C, j) ? "#000000" : "#ffffff", k += ";", k += '"/>';
      k += "</tr>";
    }
    return k += "</tbody>", k += "</table>", k;
  }, x.createSvgTag = function(b, w, k, C) {
    let j = {};
    typeof arguments[0] == "object" && (j = arguments[0], b = j.cellSize, w = j.margin, k = j.alt, C = j.title), b = b || 2, w = typeof w > "u" ? b * 4 : w, k = typeof k == "string" ? { text: k } : k || {}, k.text = k.text || null, k.id = k.text ? k.id || "qrcode-description" : null, C = typeof C == "string" ? { text: C } : C || {}, C.text = C.text || null, C.id = C.text ? C.id || "qrcode-title" : null;
    const M = x.getModuleCount() * b + w * 2;
    let H, Z, $, Q, W = "", I;
    for (I = "l" + b + ",0 0," + b + " -" + b + ",0 0,-" + b + "z ", W += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', W += j.scalable ? "" : ' width="' + M + 'px" height="' + M + 'px"', W += ' viewBox="0 0 ' + M + " " + M + '" ', W += ' preserveAspectRatio="xMinYMin meet"', W += C.text || k.text ? ' role="img" aria-labelledby="' + q([C.id, k.id].join(" ").trim()) + '"' : "", W += ">", W += C.text ? '<title id="' + q(C.id) + '">' + q(C.text) + "</title>" : "", W += k.text ? '<description id="' + q(k.id) + '">' + q(k.text) + "</description>" : "", W += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', W += '<path d="', $ = 0; $ < x.getModuleCount(); $ += 1)
      for (Q = $ * b + w, H = 0; H < x.getModuleCount(); H += 1)
        x.isDark($, H) && (Z = H * b + w, W += "M" + Z + "," + Q + I);
    return W += '" stroke="transparent" fill="black"/>', W += "</svg>", W;
  }, x.createDataURL = function(b, w) {
    b = b || 2, w = typeof w > "u" ? b * 4 : w;
    const k = x.getModuleCount() * b + w * 2, C = w, j = k - w;
    return Ky(k, k, function(M, H) {
      if (C <= M && M < j && C <= H && H < j) {
        const Z = Math.floor((M - C) / b), $ = Math.floor((H - C) / b);
        return x.isDark($, Z) ? 0 : 1;
      } else
        return 1;
    });
  }, x.createImgTag = function(b, w, k) {
    b = b || 2, w = typeof w > "u" ? b * 4 : w;
    const C = x.getModuleCount() * b + w * 2;
    let j = "";
    return j += "<img", j += ' src="', j += x.createDataURL(b, w), j += '"', j += ' width="', j += C, j += '"', j += ' height="', j += C, j += '"', k && (j += ' alt="', j += q(k), j += '"'), j += "/>", j;
  };
  const q = function(b) {
    let w = "";
    for (let k = 0; k < b.length; k += 1) {
      const C = b.charAt(k);
      switch (C) {
        case "<":
          w += "&lt;";
          break;
        case ">":
          w += "&gt;";
          break;
        case "&":
          w += "&amp;";
          break;
        case '"':
          w += "&quot;";
          break;
        default:
          w += C;
          break;
      }
    }
    return w;
  }, O = function(b) {
    b = typeof b > "u" ? 2 : b;
    const k = x.getModuleCount() * 1 + b * 2, C = b, j = k - b;
    let M, H, Z, $, Q;
    const W = {
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
    let Y = "";
    for (M = 0; M < k; M += 2) {
      for (Z = Math.floor((M - C) / 1), $ = Math.floor((M + 1 - C) / 1), H = 0; H < k; H += 1)
        Q = "█", C <= H && H < j && C <= M && M < j && x.isDark(Z, Math.floor((H - C) / 1)) && (Q = " "), C <= H && H < j && C <= M + 1 && M + 1 < j && x.isDark($, Math.floor((H - C) / 1)) ? Q += " " : Q += "█", Y += b < 1 && M + 1 >= j ? I[Q] : W[Q];
      Y += `
`;
    }
    return k % 2 && b > 0 ? Y.substring(0, Y.length - k - 1) + Array(k + 1).join("▀") : Y.substring(0, Y.length - 1);
  };
  return x.createASCII = function(b, w) {
    if (b = b || 1, b < 2)
      return O(w);
    b -= 1, w = typeof w > "u" ? b * 2 : w;
    const k = x.getModuleCount() * b + w * 2, C = w, j = k - w;
    let M, H, Z, $;
    const Q = Array(b + 1).join("██"), W = Array(b + 1).join("  ");
    let I = "", Y = "";
    for (M = 0; M < k; M += 1) {
      for (Z = Math.floor((M - C) / b), Y = "", H = 0; H < k; H += 1)
        $ = 1, C <= H && H < j && C <= M && M < j && x.isDark(Z, Math.floor((H - C) / b)) && ($ = 0), Y += $ ? Q : W;
      for (Z = 0; Z < b; Z += 1)
        I += Y + `
`;
    }
    return I.substring(0, I.length - 1);
  }, x.renderTo2dContext = function(b, w) {
    w = w || 2;
    const k = x.getModuleCount();
    for (let C = 0; C < k; C++)
      for (let j = 0; j < k; j++)
        b.fillStyle = x.isDark(C, j) ? "black" : "white", b.fillRect(j * w, C * w, w, w);
  }, x;
};
el.stringToBytes = function(n) {
  const a = [];
  for (let r = 0; r < n.length; r += 1) {
    const i = n.charCodeAt(r);
    a.push(i & 255);
  }
  return a;
};
el.createStringToBytes = function(n, a) {
  const r = (function() {
    const s = Xy(n), c = function() {
      const m = s.read();
      if (m == -1) throw "eof";
      return m;
    };
    let f = 0;
    const d = {};
    for (; ; ) {
      const m = s.read();
      if (m == -1) break;
      const h = c(), x = c(), g = c(), v = String.fromCharCode(m << 8 | h), E = x << 8 | g;
      d[v] = E, f += 1;
    }
    if (f != a)
      throw f + " != " + a;
    return d;
  })(), i = 63;
  return function(s) {
    const c = [];
    for (let f = 0; f < s.length; f += 1) {
      const d = s.charCodeAt(f);
      if (d < 128)
        c.push(d);
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
}, Hl = {
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
    let d = 0;
    for (; f != 0; )
      d += 1, f >>>= 1;
    return d;
  };
  return s.getBCHTypeInfo = function(f) {
    let d = f << 10;
    for (; c(d) - c(a) >= 0; )
      d ^= a << c(d) - c(a);
    return (f << 10 | d) ^ i;
  }, s.getBCHTypeNumber = function(f) {
    let d = f << 12;
    for (; c(d) - c(r) >= 0; )
      d ^= r << c(d) - c(r);
    return f << 12 | d;
  }, s.getPatternPosition = function(f) {
    return n[f - 1];
  }, s.getMaskFunction = function(f) {
    switch (f) {
      case Qn.PATTERN000:
        return function(d, m) {
          return (d + m) % 2 == 0;
        };
      case Qn.PATTERN001:
        return function(d, m) {
          return d % 2 == 0;
        };
      case Qn.PATTERN010:
        return function(d, m) {
          return m % 3 == 0;
        };
      case Qn.PATTERN011:
        return function(d, m) {
          return (d + m) % 3 == 0;
        };
      case Qn.PATTERN100:
        return function(d, m) {
          return (Math.floor(d / 2) + Math.floor(m / 3)) % 2 == 0;
        };
      case Qn.PATTERN101:
        return function(d, m) {
          return d * m % 2 + d * m % 3 == 0;
        };
      case Qn.PATTERN110:
        return function(d, m) {
          return (d * m % 2 + d * m % 3) % 2 == 0;
        };
      case Qn.PATTERN111:
        return function(d, m) {
          return (d * m % 3 + (d + m) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + f;
    }
  }, s.getErrorCorrectPolynomial = function(f) {
    let d = Yl([1], 0);
    for (let m = 0; m < f; m += 1)
      d = d.multiply(Yl([1, Xn.gexp(m)], 0));
    return d;
  }, s.getLengthInBits = function(f, d) {
    if (1 <= d && d < 10)
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
    else if (d < 27)
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
    else if (d < 41)
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
      throw "type:" + d;
  }, s.getLostPoint = function(f) {
    const d = f.getModuleCount();
    let m = 0;
    for (let g = 0; g < d; g += 1)
      for (let v = 0; v < d; v += 1) {
        let E = 0;
        const S = f.isDark(g, v);
        for (let z = -1; z <= 1; z += 1)
          if (!(g + z < 0 || d <= g + z))
            for (let _ = -1; _ <= 1; _ += 1)
              v + _ < 0 || d <= v + _ || z == 0 && _ == 0 || S == f.isDark(g + z, v + _) && (E += 1);
        E > 5 && (m += 3 + E - 5);
      }
    for (let g = 0; g < d - 1; g += 1)
      for (let v = 0; v < d - 1; v += 1) {
        let E = 0;
        f.isDark(g, v) && (E += 1), f.isDark(g + 1, v) && (E += 1), f.isDark(g, v + 1) && (E += 1), f.isDark(g + 1, v + 1) && (E += 1), (E == 0 || E == 4) && (m += 3);
      }
    for (let g = 0; g < d; g += 1)
      for (let v = 0; v < d - 6; v += 1)
        f.isDark(g, v) && !f.isDark(g, v + 1) && f.isDark(g, v + 2) && f.isDark(g, v + 3) && f.isDark(g, v + 4) && !f.isDark(g, v + 5) && f.isDark(g, v + 6) && (m += 40);
    for (let g = 0; g < d; g += 1)
      for (let v = 0; v < d - 6; v += 1)
        f.isDark(v, g) && !f.isDark(v + 1, g) && f.isDark(v + 2, g) && f.isDark(v + 3, g) && f.isDark(v + 4, g) && !f.isDark(v + 5, g) && f.isDark(v + 6, g) && (m += 40);
    let h = 0;
    for (let g = 0; g < d; g += 1)
      for (let v = 0; v < d; v += 1)
        f.isDark(v, g) && (h += 1);
    const x = Math.abs(100 * h / d / d - 50) / 5;
    return m += x * 10, m;
  }, s;
})(), Xn = (function() {
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
})(), Yl = function(n, a) {
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
      for (let d = 0; d < s.getLength(); d += 1)
        c[f + d] ^= Xn.gexp(Xn.glog(i.getAt(f)) + Xn.glog(s.getAt(d)));
    return Yl(c, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const c = Xn.glog(i.getAt(0)) - Xn.glog(s.getAt(0)), f = new Array(i.getLength());
    for (let d = 0; d < i.getLength(); d += 1)
      f[d] = i.getAt(d);
    for (let d = 0; d < s.getLength(); d += 1)
      f[d] ^= Xn.gexp(Xn.glog(s.getAt(d)) + c);
    return Yl(f, 0).mod(s);
  }, i;
}, pp = (function() {
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
      case Hl.L:
        return n[(s - 1) * 4 + 0];
      case Hl.M:
        return n[(s - 1) * 4 + 1];
      case Hl.Q:
        return n[(s - 1) * 4 + 2];
      case Hl.H:
        return n[(s - 1) * 4 + 3];
      default:
        return;
    }
  };
  return r.getRSBlocks = function(s, c) {
    const f = i(s, c);
    if (typeof f > "u")
      throw "bad rs block @ typeNumber:" + s + "/errorCorrectionLevel:" + c;
    const d = f.length / 3, m = [];
    for (let h = 0; h < d; h += 1) {
      const x = f[h * 3 + 0], g = f[h * 3 + 1], v = f[h * 3 + 2];
      for (let E = 0; E < x; E += 1)
        m.push(a(g, v));
    }
    return m;
  }, r;
})(), mp = function() {
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
}, Gy = function(n) {
  const a = pt.MODE_NUMBER, r = n, i = {};
  i.getMode = function() {
    return a;
  }, i.getLength = function(f) {
    return r.length;
  }, i.write = function(f) {
    const d = r;
    let m = 0;
    for (; m + 2 < d.length; )
      f.put(s(d.substring(m, m + 3)), 10), m += 3;
    m < d.length && (d.length - m == 1 ? f.put(s(d.substring(m, m + 1)), 4) : d.length - m == 2 && f.put(s(d.substring(m, m + 2)), 7));
  };
  const s = function(f) {
    let d = 0;
    for (let m = 0; m < f.length; m += 1)
      d = d * 10 + c(f.charAt(m));
    return d;
  }, c = function(f) {
    if ("0" <= f && f <= "9")
      return f.charCodeAt(0) - 48;
    throw "illegal char :" + f;
  };
  return i;
}, Ly = function(n) {
  const a = pt.MODE_ALPHA_NUM, r = n, i = {};
  i.getMode = function() {
    return a;
  }, i.getLength = function(c) {
    return r.length;
  }, i.write = function(c) {
    const f = r;
    let d = 0;
    for (; d + 1 < f.length; )
      c.put(
        s(f.charAt(d)) * 45 + s(f.charAt(d + 1)),
        11
      ), d += 2;
    d < f.length && c.put(s(f.charAt(d)), 6);
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
}, Yy = function(n) {
  const a = pt.MODE_8BIT_BYTE, r = el.stringToBytes(n), i = {};
  return i.getMode = function() {
    return a;
  }, i.getLength = function(s) {
    return r.length;
  }, i.write = function(s) {
    for (let c = 0; c < r.length; c += 1)
      s.put(r[c], 8);
  }, i;
}, Qy = function(n) {
  const a = pt.MODE_KANJI, r = el.stringToBytes;
  (function(c, f) {
    const d = r(c);
    if (d.length != 2 || (d[0] << 8 | d[1]) != f)
      throw "sjis not supported.";
  })("友", 38726);
  const i = r(n), s = {};
  return s.getMode = function() {
    return a;
  }, s.getLength = function(c) {
    return ~~(i.length / 2);
  }, s.write = function(c) {
    const f = i;
    let d = 0;
    for (; d + 1 < f.length; ) {
      let m = (255 & f[d]) << 8 | 255 & f[d + 1];
      if (33088 <= m && m <= 40956)
        m -= 33088;
      else if (57408 <= m && m <= 60351)
        m -= 49472;
      else
        throw "illegal char at " + (d + 1) + "/" + m;
      m = (m >>> 8 & 255) * 192 + (m & 255), c.put(m, 13), d += 2;
    }
    if (d < f.length)
      throw "illegal char at " + (d + 1);
  }, s;
}, xm = function() {
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
}, Vy = function() {
  let n = 0, a = 0, r = 0, i = "";
  const s = {}, c = function(d) {
    i += String.fromCharCode(f(d & 63));
  }, f = function(d) {
    if (d < 0)
      throw "n:" + d;
    if (d < 26)
      return 65 + d;
    if (d < 52)
      return 97 + (d - 26);
    if (d < 62)
      return 48 + (d - 52);
    if (d == 62)
      return 43;
    if (d == 63)
      return 47;
    throw "n:" + d;
  };
  return s.writeByte = function(d) {
    for (n = n << 8 | d & 255, a += 8, r += 1; a >= 6; )
      c(n >>> a - 6), a -= 6;
  }, s.flush = function() {
    if (a > 0 && (c(n << 6 - a), n = 0, a = 0), r % 3 != 0) {
      const d = 3 - r % 3;
      for (let m = 0; m < d; m += 1)
        i += "=";
    }
  }, s.toString = function() {
    return i;
  }, s;
}, Xy = function(n) {
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
    const d = i >>> s - 8 & 255;
    return s -= 8, d;
  };
  const f = function(d) {
    if (65 <= d && d <= 90)
      return d - 65;
    if (97 <= d && d <= 122)
      return d - 97 + 26;
    if (48 <= d && d <= 57)
      return d - 48 + 52;
    if (d == 43)
      return 62;
    if (d == 47)
      return 63;
    throw "c:" + d;
  };
  return c;
}, Zy = function(n, a) {
  const r = n, i = a, s = new Array(n * a), c = {};
  c.setPixel = function(h, x, g) {
    s[x * r + h] = g;
  }, c.write = function(h) {
    h.writeString("GIF87a"), h.writeShort(r), h.writeShort(i), h.writeByte(128), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(0), h.writeByte(255), h.writeByte(255), h.writeByte(255), h.writeString(","), h.writeShort(0), h.writeShort(0), h.writeShort(r), h.writeShort(i), h.writeByte(0);
    const x = 2, g = d(x);
    h.writeByte(x);
    let v = 0;
    for (; g.length - v > 255; )
      h.writeByte(255), h.writeBytes(g, v, 255), v += 255;
    h.writeByte(g.length - v), h.writeBytes(g, v, g.length - v), h.writeByte(0), h.writeString(";");
  };
  const f = function(h) {
    const x = h;
    let g = 0, v = 0;
    const E = {};
    return E.write = function(S, z) {
      if (S >>> z)
        throw "length over";
      for (; g + z >= 8; )
        x.writeByte(255 & (S << g | v)), z -= 8 - g, S >>>= 8 - g, v = 0, g = 0;
      v = S << g | v, g = g + z;
    }, E.flush = function() {
      g > 0 && x.writeByte(v);
    }, E;
  }, d = function(h) {
    const x = 1 << h, g = (1 << h) + 1;
    let v = h + 1;
    const E = m();
    for (let B = 0; B < x; B += 1)
      E.add(String.fromCharCode(B));
    E.add(String.fromCharCode(x)), E.add(String.fromCharCode(g));
    const S = xm(), z = f(S);
    z.write(x, v);
    let _ = 0, N = String.fromCharCode(s[_]);
    for (_ += 1; _ < s.length; ) {
      const B = String.fromCharCode(s[_]);
      _ += 1, E.contains(N + B) ? N = N + B : (z.write(E.indexOf(N), v), E.size() < 4095 && (E.size() == 1 << v && (v += 1), E.add(N + B)), N = B);
    }
    return z.write(E.indexOf(N), v), z.write(g, v), z.flush(), S.toByteArray();
  }, m = function() {
    const h = {};
    let x = 0;
    const g = {};
    return g.add = function(v) {
      if (g.contains(v))
        throw "dup key:" + v;
      h[v] = x, x += 1;
    }, g.size = function() {
      return x;
    }, g.indexOf = function(v) {
      return h[v];
    }, g.contains = function(v) {
      return typeof h[v] < "u";
    }, g;
  };
  return c;
}, Ky = function(n, a, r) {
  const i = Zy(n, a);
  for (let d = 0; d < a; d += 1)
    for (let m = 0; m < n; m += 1)
      i.setPixel(m, d, r(m, d));
  const s = xm();
  i.write(s);
  const c = Vy(), f = s.toByteArray();
  for (let d = 0; d < f.length; d += 1)
    c.writeByte(f[d]);
  return c.flush(), "data:image/gif;base64," + c;
};
el.stringToBytes;
function Jy({ text: n }) {
  const { size: a, path: r } = K.useMemo(() => {
    const i = el(0, "M");
    i.addData(n), i.make();
    const s = i.getModuleCount();
    let c = "";
    for (let f = 0; f < s; f++)
      for (let d = 0; d < s; d++) i.isDark(f, d) && (c += `M${d} ${f}h1v1h-1z`);
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
const Ql = K.createContext(""), Qo = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function Wy({ title: n, children: a, testId: r, ariaLabel: i }) {
  const s = K.useContext(Ql), c = s !== "" && Qo(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ te.jsxs("section", { className: s && !c ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": r, "aria-label": i, children: [
      n && /* @__PURE__ */ te.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ te.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ te.jsx(Ql.Provider, { value: c ? "" : s, children: a }) })
    ] })
  );
}
function Fy({ title: n, description: a, children: r, testId: i }) {
  const s = K.useContext(Ql);
  return s && !Qo(n, s) && !Qo(a, s) ? null : /* @__PURE__ */ te.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ te.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ te.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ te.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    r && /* @__PURE__ */ te.jsx("div", { className: "flex shrink-0 items-center gap-2", children: r })
  ] });
}
function $y({ checked: n, onChange: a, testId: r, label: i }) {
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
const Iy = () => K.useContext(Ql), Py = {
  select: hc,
  selectHost: cy,
  input: uy,
  inputPort: dy,
  inputWide: fy,
  addRow: py,
  list: my,
  hostRow: gy,
  name: by,
  addr: vy,
  muted: sy,
  empty: oy,
  primary: yy,
  danger: xy,
  catalogToggle: iy
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const ex = 512, an = globalThis.__perchResources ??= /* @__PURE__ */ new Map(), ql = /* @__PURE__ */ new Map();
function wm(n, a) {
  an.delete(n), an.set(n, a);
  for (const r of an.keys()) {
    if (an.size <= ex) break;
    ql.get(r)?.size || an.delete(r);
  }
}
function tx(n, a) {
  return an.has(n) ? an.get(n) : a;
}
function nx(n, a, r) {
  const i = tx(n, r), s = typeof a == "function" ? a(i) : a;
  if (!(an.has(n) && Object.is(s, i))) {
    wm(n, s);
    for (const c of [...ql.get(n) ?? []]) c();
  }
}
function ax(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  an.has(n) || wm(n, a);
  const r = K.useCallback((c) => {
    const f = ql.get(n) ?? /* @__PURE__ */ new Set();
    return ql.set(n, f), f.add(c), () => {
      f.delete(c), f.size || ql.delete(n);
    };
  }, [n]), i = K.useSyncExternalStore(r, () => an.get(n)), s = K.useCallback((c) => nx(n, c, a), [n]);
  return [i, s];
}
const lx = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", rx = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const ix = "1.3.0";
let ci = null;
const sx = (n) => {
  ci = n;
};
function ye() {
  const n = (typeof ci == "function" ? ci() : ci) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const km = (n) => ye().subscribe?.(n) ?? (() => {
}), ox = Sy;
function cx() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const _m = globalThis.perch?.isMac !== !1, Vo = (n) => Fv(n, ye().isMac !== !1), ux = (n) => Iv(n), dx = ({ className: n, ...a } = {}) => Ge(e1(a), n), fx = n1, Sm = (n) => Ho(n), ui = a1, px = rc, mx = lm, hx = (n) => Lo[n].color, gx = (n, a) => ye().shortcutFor?.(n, a) ?? null, bx = (n) => ye().shortcutLabel?.(n) ?? null, Zl = (n, a) => ye().command(n, a ?? {}) !== !1, vx = (n, a, r) => ye().startSession?.(n, a, r), yx = globalThis.perch?.pickFolder ? (n) => ye().pickFolder(n) : null;
function Le(n) {
  const a = K.useRef(n);
  return a.current = n, K.useSyncExternalStore(km, () => a.current(ye()));
}
const Em = (n = {}) => Le((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), xx = () => Le((n) => n.hosts()), wx = () => Le((n) => n.sessionFolders());
function kx() {
  const n = Le((a) => a.addProject?.() ?? _x);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (a, r, i) => {
      a.trim() && n.status !== "pending" && ye().addProjectFolder?.(a, r, i);
    },
    clear: () => ye().clearAddProject?.()
  };
}
const _x = Object.freeze({ status: "idle" }), zm = "perch.lastAgentChoice", Sx = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Ex = () => {
  const n = ye().storage?.getItem(zm);
  return n === "claude" || n === "codex" ? n : "claude";
}, zx = Object.freeze({ items: [] });
function Nx() {
  const n = Le((a) => a.notifications?.() ?? zx);
  return K.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => ye().command("notification.open", { id: a }),
    dismiss: (a) => ye().command("notification.dismiss", { id: a })
  }), [n]);
}
function Tx(n) {
  const a = Le((s) => s.agentChoices?.(n) ?? Sx), [r, i] = K.useState(Ex);
  return K.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: r,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (ye().storage?.setItem(zm, s), i(s));
    },
    manage: () => ye().command("agents.manage", {})
  }), [a, r]);
}
function Cx(n) {
  nt(() => ye().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Ax(n) {
  const a = n.map((r) => ({ id: r.id, parentSessionId: r.parentId, session: r }));
  return _y(a).map((r) => ({ session: r.session, nested: Yo(r, a) }));
}
function Mx({ id: n, plain: a, className: r }) {
  const i = Le((h) => h.session(n));
  if (!i) return null;
  const s = i.state ?? ky(i), c = Lo[s]?.color ?? Lo.unknown.color, f = i.provider, d = f === "claude" || f === "claude-agent-teams" || f === "omp", m = a ? Ge("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", r) : Ge("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", r);
  return K.createElement(
    "span",
    { className: m, style: a ? void 0 : { borderColor: c }, "data-provider": f ?? "unknown", title: a ? f ?? "Agent" : `${f ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    K.createElement("span", { className: Ge("inline-flex text-fg", d && "rounded-full bg-[#161616]") }, K.createElement(Nm, { provider: f, size: 14 }))
  );
}
function Nm({ provider: n, size: a = 14 }) {
  const r = ye().agentIcon?.(n, a) ?? null, i = r?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return K.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...r && r.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Rx = ({ children: n }) => K.createElement(K.Fragment, null, n);
function jx(n, a) {
  const r = K.useRef(a);
  return r.current = a, nt(() => {
    const i = ye();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [f, d] of Object.entries(r.current))
      s[f] = typeof d == "function" ? (...m) => r.current[f]?.(...m) : d;
    const c = i.openOverlay(n, s);
    return () => i.closeOverlay?.(c);
  }, [n]), null;
}
const Jn = (n) => function(r) {
  return jx(n, r);
}, Ox = Jn("session-menu"), Dx = Jn("new-session-menu"), Bx = Jn("confirm");
let Tm = null;
const Hx = (n) => {
  Tm = n;
};
function Ux(n) {
  return K.createElement(Tm ?? Bx, n);
}
function qx({ className: n = hc, ...a }) {
  return K.createElement(ay, { ...a, className: n });
}
let Xo = null;
const Gx = (n) => {
  Xo = n;
}, Lx = Jn("folder-browser");
function Yx(n) {
  return Xo ? K.createElement(Xo, { ...n, browse: (a) => ye().browse(n.hostId, a) }) : K.createElement(Lx, n);
}
const Qx = Jn("instructions"), Vx = Jn("memory"), Xx = o1;
let vc = null;
const Zx = (n) => {
  vc = n;
};
function Kx(n) {
  if (vc) return K.createElement(Wx, n);
  const { hostId: a, path: r, className: i } = n, s = K.useRef(null);
  return K.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Ge("worktree-menu__btn", lm, i),
      "data-testid": `worktree-menu-${a}-${r}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => ye().openOverlay?.("worktree", { hostId: a, cwd: r, anchor: s.current?.getBoundingClientRect() })
    },
    K.createElement(rm, null)
  );
}
const Cm = "Perch did not answer.";
function ni(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Cm };
}
function Jx(n, a, r = ye()) {
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
const hp = 5 * 6e4;
function Am(n, a, r, i = ye()) {
  const s = Date.now() + hp;
  let c = !1, f = () => {
  };
  const d = () => {
    c = !0, f(), clearTimeout(h);
  }, m = () => {
    if (!c) {
      if (Date.now() >= s) return d();
      Jx(n, a, i) && (d(), i.startSession?.(n, a, r));
    }
  }, h = setTimeout(d, hp);
  f = i.subscribe?.(m) ?? (() => {
  }), m();
}
function Wx({ hostId: n, path: a, className: r, worktrees: i, request: s, parentChoices: c, emptyAgent: f, ...d }) {
  const [m, h] = K.useState(i), x = (C) => !!ye().coreCan?.(C, n), g = Em(), v = `${n}:${a}`, E = K.useMemo(() => {
    if (Array.isArray(c)) return c;
    if (!x("workspace.nest")) return [];
    const C = g?.projects?.find((H) => H.hostId === n && H.repoPath === a), j = [], M = (H, Z) => {
      for (const $ of H ?? [])
        Z && j.push({ id: $.id, name: $.name, path: $.path }), M($.children, !0);
    };
    return M(C?.workspaces, !1), j;
  }, [c, g, n, a]), S = n === "local" && x("worktree.job"), z = d.deleteSupported ?? x("worktree.delete"), _ = d.startFromSupported ?? x("worktree.startFrom"), N = Le((C) => C.emptyWorkspaceAgent?.() ?? void 0), B = f ?? N ?? void 0, R = Le((C) => C.worktreeMenuRequest?.() ?? null), X = R?.projectKey === v ? R.nonce : null, q = K.useMemo(() => s ?? (X == null ? null : R), [s, X]), [O, b] = K.useState(q);
  nt(() => {
    q && b(q);
  }, [q]);
  const w = K.useRef({});
  w.current = { background: S, deleteSupported: z };
  const k = K.useMemo(() => {
    const C = (j, M) => ye().ask(j, { hostId: n, repoPath: a, ...M });
    return {
      list: async () => {
        const j = await C("worktree.list", {});
        return j?.type === "worktree.list.result" && h({ worktrees: j.worktrees ?? [], defaultRoot: j.defaultRoot ?? "", baseRef: j.baseRef, refs: j.refs ?? [] }), ni(j);
      },
      create: async ({ branch: j, newBranch: M, path: H, extra: Z, agent: $ }) => {
        const Q = { branch: j, newBranch: !!M, path: H ?? null, name: Z?.name ?? null, startFrom: Z?.startFrom ?? null, parentWorkspaceId: Z?.parentWorkspaceId ?? null }, { background: W } = w.current, I = await C(W ? "worktree.job.start" : "worktree.create", Q), Y = W ? "worktree.job.started" : "worktree.done";
        if (I?.type !== Y) return { error: ni(I).error ?? Cm };
        const V = W ? I.job?.path : I.path;
        return $ && V && Am(n, V, $), { background: W };
      },
      remove: async (j, M) => {
        const H = await C("worktree.remove", { path: j, force: !!M, deleteBranch: w.current.deleteSupported });
        return { ...ni(H), preservedBranch: H?.type === "worktree.done" ? H.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (j, M) => ni(await C("worktree.branch.delete", { branch: j, expectedHead: M })),
      open: (j) => ye().startSession?.(n, j, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => ye().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return K.createElement(vc, {
    hostId: n,
    cwd: a,
    projectKey: v,
    className: r,
    worktrees: m,
    background: S,
    startFromSupported: _,
    deleteSupported: z,
    parentChoices: E,
    emptyAgent: B,
    request: O,
    actions: k
  });
}
const Fx = (n, a) => {
  if (!ye().followPointer?.(n)) return;
  const r = a.items();
  for (const i of r) i.getBoundingClientRect();
  r[0]?.parentElement?.getBoundingClientRect(), Zv(n, a);
}, $x = () => Le((n) => n.workspaceTabs());
function Ix({ metadata: n }) {
  return K.createElement(
    "div",
    { className: "grid content-center justify-items-center gap-1 p-5 text-[0.72rem] text-subtext-0" },
    K.createElement("strong", { className: "text-[0.9rem] text-fg" }, n?.name ?? ""),
    K.createElement("span", null, `${n?.mediaType ?? "file"} · ${n?.size ?? 0} bytes`)
  );
}
function Px({ path: n, content: a }) {
  const { source: r, truncated: i } = I1(a ?? ""), s = K.useMemo(() => ty(r, (c) => Zl("link.open", { url: c })), [r]);
  return K.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    i && K.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${oi.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    K.createElement("div", { className: "message__markdown file-markdown" }, s)
  );
}
const ew = Jn("file-menu"), tw = /* @__PURE__ */ new Map(), nw = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function aw(n, a = {}) {
  const r = Le((d) => d.workspaceFiles(n)), i = !!a.git, s = r.git?.decorations, c = K.useMemo(() => i && s?.length ? new Map(s) : tw, [s, i]), f = K.useMemo(() => Object.fromEntries(nw.map((d) => [d, (...m) => (ye().filesDo(d, n, ...m), null)])), [n]);
  return K.useMemo(() => ({
    workspace: r.workspace,
    connected: r.connected,
    trees: r.trees,
    documents: r.documents,
    previews: r.previews,
    search: r.search ?? void 0,
    wrap: r.wrap,
    git: { ...r.git, decorations: c },
    actions: f
  }), [r, c, f]);
}
const lw = () => Le((n) => n.statusLine()), rw = () => Le((n) => n.zoom()), iw = () => Le((n) => n.paneLook()), sw = () => Le((n) => n.keybindings?.() ?? []), ow = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function cw(n) {
  const a = !!n?.keepFresh, r = Le((s) => s.statusLine?.().connected ?? !1), i = Le((s) => s.planUsage?.() ?? ow);
  return nt(() => {
    if (!a || !r) return;
    let s;
    const c = () => {
      ye().command("usage.get"), s = setTimeout(c, 18e4);
    };
    return c(), () => clearTimeout(s);
  }, [a, r]), i;
}
const uw = () => ye().command("usage.get", { force: !0 }), dw = (n) => ye().command("usage.redeemReset", { accountId: n }), fw = () => Zl("app.zoom_reset"), pw = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, mw = (n, a, r) => ye().beginTabDrag?.(n, a, r);
function hw(n) {
  nt(() => ye().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const gw = (n) => Zl("browser.open", { workspaceId: n }), bw = (n, a) => Zl("file.open", { workspaceId: n, path: a }), vw = () => null, yw = () => null, xw = Jn("new-file"), ww = [
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
], kw = /* @__PURE__ */ new Set(["discardPreview", "commitPreview", "previewBatch", "sendBatch"]);
function _w(n) {
  const a = {};
  for (const r of ww)
    a[r] = (...i) => {
      const s = ye().gitDo(r, n, ...i);
      return kw.has(r) ? s.then((c) => c ?? null, () => null) : (s.catch?.((c) => console.error(`perch: ${r}: ${c?.message ?? c}`)), null);
    };
  return a;
}
function Sw(n) {
  const a = Le((i) => i.gitReview(n)), r = K.useMemo(() => _w(n), [n]);
  return K.useMemo(() => ({
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
    actions: r,
    askAgent: void 0
  }), [a, r]);
}
function Ew(n) {
  const { workspaceId: a } = n, r = `diff:${a}`, i = ye(), s = K.useRef(null);
  s.current !== r && (i.diff.open(r, { workspaceId: a }), s.current = r), i.diff.setProps(r, {
    path: n.path ?? null,
    wrap: !!n.wrap,
    canAsk: !!n.onAskAgent,
    selection: n.selection ?? null,
    editingCommentId: n.editingCommentId ?? null,
    editingBody: n.editingBody ?? ""
  });
  const c = Le((m) => m.gitReview(a)).comments ?? [], f = K.useSyncExternalStore(km, () => i.diff.seq(r)), d = K.useRef(n);
  return d.current = n, nt(() => {
    const m = d.current, h = (x) => c.find((g) => g.id === x);
    for (const x of i.diff.events(r))
      switch (x.type) {
        case "selectLine":
          m.onSelectLine?.(x.path, x.side, x.line, x.extend);
          break;
        case "addComment":
          m.onAddComment?.(x.path, x.side, x.line);
          break;
        case "askAgent":
          m.onAskAgent?.(x.path);
          break;
        case "editComment": {
          const g = h(x.commentId);
          g && m.onEditComment?.(g);
          break;
        }
        case "editBody":
          m.onEditBody?.(x.text);
          break;
        case "saveEdit": {
          const g = h(x.commentId);
          g && m.onSaveEdit?.(g);
          break;
        }
        case "cancelEdit":
          m.onCancelEdit?.();
          break;
        case "resolve": {
          const g = h(x.commentId);
          g && m.onResolve?.(g);
          break;
        }
        case "delete": {
          const g = h(x.commentId);
          g && m.onDelete?.(g);
          break;
        }
      }
  }, [f, r]), K.createElement("div", { "data-perch-engine": "diff", "data-perch-key": r, "data-testid": "git-diff", className: n.className ?? "min-h-0 flex-1" });
}
function zw(n, a) {
  const r = n.selection(a);
  if (r) return r;
  const i = n.value(a), s = i.split(`
`).length - (i.endsWith(`
`) && i.length ? 1 : 0);
  return { text: i, startLine: 1, endLine: Math.max(1, s) };
}
function Nw({ onGo: n, onClose: a }) {
  const [r, i] = K.useState(""), s = (c) => {
    c?.preventDefault?.();
    const [f, d] = r.split(":").map((m) => Number.parseInt(m, 10));
    Number.isFinite(f) ? n(f, Number.isFinite(d) ? d : 1) : a();
  };
  return K.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    K.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    K.createElement("input", {
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
    K.createElement("button", { type: "button", className: rc, onClick: s }, "OK")
  );
}
function Tw({ value: n, onChange: a, onSave: r, onCaret: i, readOnly: s, wrap: c, label: f, path: d, docKey: m, onAskAgent: h, ref: x }) {
  const g = ye().editor, v = K.useRef(null);
  v.current = { onChange: a, onSave: r, onCaret: i, onAskAgent: h };
  const [E, , S] = String(m).split("\0"), z = !!g && S !== void 0 && /^\d+$/.test(S), _ = Le((k) => z ? k.workspaceFiles(E)?.carets?.[m] ?? null : null);
  nt(() => {
    _ && v.current.onCaret?.({ line: _.line, col: _.col });
  }, [_?.line, _?.col]);
  const N = K.useRef(n), [B, R] = K.useState(null), [X, q] = K.useState(!1), O = () => {
    if (!g || !v.current.onAskAgent) return;
    const { text: k, startLine: C, endLine: j } = zw(g, m);
    v.current.onAskAgent(k, C, j);
  };
  if (K.useImperativeHandle(x, () => ({
    openGoto: () => q(!0),
    focus: () => g?.focus(m),
    askAgent: O
  }), [m]), di(() => {
    if (!g) return;
    g.open(m, { path: d, value: n, readonly: !!s, wrap: !!c, label: f }), N.current = n;
    const k = g.watch(m, (C) => {
      for (const j of C)
        if (j.type === "change") {
          const M = g.value(m);
          N.current = M, v.current.onChange?.(M);
        } else j.type === "caret" ? v.current.onCaret?.({ line: j.line, col: j.col }) : j.type === "save" ? v.current.onSave?.() : j.type === "goto" ? q(!0) : j.type === "contextmenu" && R({ x: j.x, y: j.y });
    });
    return () => {
      k(), g.park(m);
    };
  }, [m]), nt(() => {
    !g || z || n === N.current || (N.current = n, g.setValue(m, n, { external: !0 }));
  }, [m, n]), nt(() => {
    g?.setReadonly(m, !!s);
  }, [m, s]), nt(() => {
    g?.setWrap(m, !!c);
  }, [m, c]), !g)
    return K.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": f, value: n, readOnly: s, onChange: (k) => a?.(k.target.value) });
  const b = (k) => () => {
    R(null), k(), g.focus(m);
  }, w = B ? !!g.selection(m) : !1;
  return K.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": f },
    X && K.createElement(Nw, {
      onGo: (k, C) => {
        q(!1), g.goTo(m, k, C), g.focus(m);
      },
      onClose: () => {
        q(!1), g.focus(m);
      }
    }),
    K.createElement("div", { "data-perch-engine": "editor", "data-perch-key": m, className: "min-h-0 min-w-0 flex-1" }),
    B && K.createElement(ry, {
      x: B.x,
      y: B.y,
      readOnly: !!s,
      canUndo: g.canUndo(m),
      canRedo: g.canRedo(m),
      hasSelection: w,
      onClose: () => R(null),
      actions: {
        undo: b(() => g.undo(m)),
        redo: b(() => g.redo(m)),
        cut: b(() => g.cut(m)),
        copy: b(() => g.copy(m)),
        paste: b(() => g.paste(m)),
        selectAll: b(() => g.selectAll(m)),
        find: b(() => g.openSearch(m, !1)),
        replace: b(() => g.openSearch(m, !0)),
        gotoLine: () => {
          R(null), q(!0);
        },
        ...h ? { askAgent: () => {
          R(null), O();
        } } : {}
      }
    })
  );
}
const Cw = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Aw(n) {
  const a = Le((r) => r.browserPages?.(n) ?? Cw);
  return K.useMemo(() => {
    const r = (i, s) => ye().command(i, { workspaceId: n, ...s });
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
function Mw({ pageId: n, active: a }) {
  const r = `drawer
${n}`;
  return nt(() => {
    a && ye().command("browser.focus", { key: r });
  }, [a, r]), K.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": r,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const Xw = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Nm,
  BrowserPage: Mw,
  Chevron: bc,
  CloseIcon: i1,
  CodeEditor: Tw,
  ConfirmDialog: Ux,
  Dialog: Xx,
  DiffView: Ew,
  EllipsisIcon: l1,
  FileAsset: Ix,
  FileEntryMenu: ew,
  FileIcon: Ty,
  FolderBrowser: Yx,
  GearIcon: r1,
  GitMarker: My,
  HostStateDot: s1,
  InstructionsDialog: Qx,
  MarkdownPreview: Px,
  MemoryDialog: Vx,
  ModeSwitch: qy,
  NewFilePrompt: xw,
  NewSessionMenu: Dx,
  PageIcon: Ey,
  PlusIcon: rm,
  QrCode: Jy,
  Select: qx,
  SessionDot: Mx,
  SessionMenu: Ox,
  SettingRow: Fy,
  SettingsGroup: Wy,
  SettingsQuery: Ql,
  Slot: Rx,
  Submenu: wy,
  Switch: $y,
  TabDragLayer: yw,
  TabMenu: vw,
  WorktreeMenu: Kx,
  agentStateColor: hx,
  anchoredPopoverStyle: ox,
  assetKind: jy,
  beginReorderDrag: Fx,
  beginTabDrag: mw,
  bindHost: sx,
  buttonClass: fx,
  cn: Ge,
  drawConfirmationsInPlace: Hx,
  drawFolderBrowserInPlace: Gx,
  drawWorktreeInPlace: Zx,
  ghostButton: px,
  glassClass: lx,
  iconButton: mx,
  isMac: _m,
  keyLabel: Vo,
  menuDividerClass: ui,
  menuItemClass: Sm,
  menuPanel: Ni,
  nestSessions: Ax,
  newId: cx,
  openBrowserTab: gw,
  openFileTab: bw,
  pickFolder: yx,
  redeemUsageReset: dw,
  refreshUsage: uw,
  resetZoom: fw,
  rowActionClass: dx,
  runCommand: Zl,
  segmentClass: ux,
  settingsClass: Py,
  shortcutFor: gx,
  shortcutLabel: bx,
  startPaneWhenReady: Am,
  startSession: vx,
  tabStateClass: pw,
  tapButtonClass: rx,
  useAddProject: kx,
  useAddProjectRequest: Cx,
  useAgentChoices: Tx,
  useBrowserPages: Aw,
  useDismissOnOutsideClick: vm,
  useGitReview: Sw,
  useHostSnapshot: Le,
  useHosts: xx,
  useKeybindings: sw,
  useNavigation: Em,
  useNewTabRequest: hw,
  useNotifications: Nx,
  usePaneLook: iw,
  usePlanUsage: cw,
  useResourceState: ax,
  useSessionFolders: wx,
  useSettingsQuery: Iy,
  useStatusLine: lw,
  useWorkspaceFiles: aw,
  useWorkspaceTabs: $x,
  useZoom: rw,
  version: ix
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
const yc = {
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
  yc[n] = (a, r) => a[n](r);
const Zw = Object.keys(yc);
function _o(n, a) {
  for (const [r, i] of Object.entries(a)) {
    const s = yc[r];
    if (!s) throw new Error(`the description key ${r} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const ga = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), gp = /* @__PURE__ */ new WeakSet(), So = /* @__PURE__ */ new WeakSet();
function bp(n, a, r) {
  const i = n.pressed, s = ga(r);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : a;
}
function Rw(n, a, r) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && ki.has(n.group) || r)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const Mm = (n, a = !1) => (n.children ?? []).some((r) => r.kind === "text" ? !a || /\s/.test(String(r.text ?? "").trim()) : r.kind === "div" && r.style?.flex_direction !== "row" && r.style?.whitespace !== "nowrap" && Mm(r, !0)), Mt = (n) => n.style?.display !== "hidden";
let ki = /* @__PURE__ */ new Set(), Zo = null;
function Rm(n, a = /* @__PURE__ */ new Set()) {
  for (const { group: r, style: i } of n.group_hover ?? []) "display" in i && a.add(r);
  for (const r of n.children ?? []) r.kind !== "text" && Rm(r, a);
  return a;
}
function Ko(n, a, r, i, s = !1, c = !1, f = null, d = {}, m = !1, h = /* @__PURE__ */ new Map(), x = null) {
  if (n.kind === "text") return h.get(n)?.text ?? n.text;
  const g = gp.has(n);
  c ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", c && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (x = null), f = n.style.text_color ?? f;
  const v = !!n.hover?.text_color && Bm(n), E = n.group ?? (v ? `~g${n.id}` : null);
  v && (x = { group: E, color: n.hover.text_color }), d = { ...d };
  for (const M of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[M] !== void 0 && (d[M] = n.style[M]);
  const S = new Set(n.events ?? []), z = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !c && !n.pointer_none && n.style.position === "absolute" ? Zo : null, _ = z ? z.count++ : -1;
  s && (Zo = z);
  let N;
  if (n.kind === "image" && !n.markup ? N = a.image(n.src) : N = a.div(), n.kind === "engine" && (N = N.child(i.engine ? i.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && x && x.color !== f) {
    const { group: M, color: H } = x, Z = () => a.div().absolute().top(0).left(0).size_full();
    N = N.child(Z().group_hover(M, ($) => $.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, f))).child(Z().invisible().group_hover(M, ($) => $.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, H)));
  } else n.markup && (N = N.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? f : "")));
  const B = Rw(n, S, !!z);
  if (B && (N = N.id(B)), n.measure && (N = N.measure(n.measure)), n.name && N.also_named) for (const M of n.also ?? []) N = N.also_named(M);
  N = _o(N, { ...n.style, ...h.get(n) });
  const R = d.whitespace !== "nowrap" && !d.text_ellipsis;
  m && R && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Mm(n) && (N = N.min_w(0));
  for (const M of ["hover", "focus", "active"]) n[M] && (N = N[M]((H) => _o(H, n[M])));
  E && (N = N.group(E));
  for (const { group: M, style: H } of n.group_hover ?? []) {
    const { display: Z, ...$ } = H;
    Object.keys($).length && (N = N.group_hover(M, (Q) => _o(Q, $)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const M = r.document?.scrollTarget, H = M ? (n.children ?? []).filter(Mt).findIndex((Z) => Dm(Z, M.id)) : -1;
    if (H >= 0 && (r.scroller ?? n.id) === n.id && (r.document.scrollTarget = null, r.scroller = n.id, a.scroll.scroll_to_item(H)), r.scroller ??= n.id, r.scroller === n.id && r.document) {
      N = N.track_scroll(a.scroll);
      const Z = (n.children ?? []).filter(Mt).map(($) => $.id);
      r.document.itemBounds = ($) => Z.includes($) ? a.scroll.item_bounds?.(Z.indexOf($)) ?? null : null;
    }
  }
  const X = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", q = s && !n.pointer_none || n.blocks_pointer;
  if ((X && So.has(n) || q) && (N = N.on_scroll_wheel((M, H) => H.stop_propagation?.())), X && S.has("scroll") && (N = N.on_scroll_wheel((M, H) => {
    r.dispatch(n.id, "scroll", {}), H.notify();
  })), X || So.has(n)) for (const M of n.children ?? []) M.kind !== "text" && So.add(M);
  n.kind === "input" && !n.disabled && (N = N.on_mouse_down("left", (M, H) => {
    M.bounds && r.setBounds(n.id, M.bounds), r.focus(n.id), H.notify();
  }));
  const O = n.kind === "input" ? n : n.meta?.tag === "label" ? Om(n) : null;
  O && !O.disabled && /^(checkbox|radio)$/.test(O.input_type) && (N = N.on_click((M, H) => {
    H.stop_propagation?.(), r.toggle(O.id), H.notify();
  }));
  const b = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((M) => S.has(M));
  if (b || g) for (const M of n.children ?? []) M.kind !== "text" && gp.add(M);
  if (b && (N = N.on_mouse_down("left", (M, H) => {
    H.stop_propagation?.(), M.bounds && r.setBounds(n.id, M.bounds);
    const Z = { ...ga(M), button: 0, buttons: 1, detail: M.click_count }, $ = bp(r, n.id, M);
    r.pressed = null, r.dispatch($, "pointerdown", { ...Z, pointerType: "mouse" }), r.dispatch($, "mousedown", Z) && r.pressFocus?.($), H.notify();
  }), N = N.on_mouse_down("right", (M, H) => {
    H.stop_propagation?.(), M.bounds && r.setBounds(n.id, M.bounds);
    const Z = bp(r, n.id, M);
    r.pressed = null, r.dispatch(Z, "contextmenu", { ...ga(M), button: 2 }), H.notify();
  }), N = N.on_mouse_up("left", (M, H) => {
    H.stop_propagation?.();
    const Z = { ...ga(M), button: 0 };
    r.dispatch(n.id, "pointerup", { ...Z, pointerType: "mouse" }), r.dispatch(n.id, "mouseup", Z), H.notify();
  }), N = N.on_click((M, H) => {
    r.dispatch(n.id, M.click_count === 2 && S.has("double_click") ? "dblclick" : "click", { detail: M.click_count, button: 0 }), H.notify();
  })), n.blocks_pointer && !b)
    for (const M of ["left", "right"]) N = N.on_mouse_down(M, (H, Z) => Z.stop_propagation?.());
  else if (g && !b)
    for (const M of ["left", "right"])
      N = N.on_mouse_down(M, (H) => {
        const Z = ga(H);
        (r.pressed?.x !== Z.clientX || r.pressed?.y !== Z.clientY) && (r.pressed = { id: n.id, x: Z.clientX, y: Z.clientY });
      });
  if (S.has("mouse_move") && (N = N.on_mouse_move((M) => {
    r.dispatch(n.id, "pointermove", { ...ga(M), pointerType: "mouse" });
  })), n.track_hover && ki.has(n.group) && (N = N.on_hover((M, H) => {
    r.hover(n.id, M), H.notify();
  })), z && (N = N.on_mouse_down_out((M, H) => {
    const Z = ga(M), $ = `${Z.clientX},${Z.clientY}`;
    z.at !== $ && (z.at = $, z.hits = /* @__PURE__ */ new Set()), z.hits.add(_), !(z.hits.size < z.count) && (z.at = null, r.dispatch(r.document.body.id, "pointerdown", { ...Z, pointerType: "mouse" }), r.dispatch(r.document.body.id, "mousedown", Z), H.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const M = n.value ? String(n.value) : String(n.placeholder ?? "");
    let H = a.div().whitespace_nowrap().overflow_x_hidden();
    const Z = xa(d);
    Z && (H = H.h(Z)), !n.value && f && (H = H.text_color(Ow(f))), M && (N = N.child(H.child(n.input_type === "password" && n.value ? "•".repeat([...M].length) : M))), n.field_w && (N = N.child(a.div().w(n.field_w).h(0)));
  }
  const w = d.whitespace === "nowrap" ? xa(d) : null, k = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let C = !n.range_name;
  const j = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const M of (n.children ?? []).filter(Mt)) {
    const H = M.style?.flex_basis;
    j && M.style.flex_grow > 0 && (H === 0 || typeof H == "string" && H.endsWith("%")) && h.set(M, { ...h.get(M), flex_basis: "auto" });
    let Z = Ko(M, a, r, i, !1, c, f, d, k && M.style?.position !== "absolute", h, x);
    const $ = !C && (M.kind === "text" || !M.meta), Q = M.kind === "text" ? h.get(M)?.h ?? w : null, W = M.kind === "text" ? h.get(M)?.w : void 0;
    if ($ || Q || W !== void 0) {
      let I = a.div();
      $ && (I = I.id(n.range_name)), $ && !k && n.style.display === "flex" && (I = I[`self_${jw[d.text_align] ?? "start"}`]().max_w("100%")), Q && (I = I.h(Q)), W !== void 0 && (I = I.w(W).flex_none().whitespace_nowrap()), Z = I.child(Z), C ||= $;
    }
    N = N.child(Z);
  }
  return N;
}
const jw = { center: "center", right: "end", end: "end" };
function Ow(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const r = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(r / 2).toString(16).padStart(2, "0")}`;
}
const jm = /^(?:[!-,.-~]+|\S)$/u, Om = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const r = a.kind === "text" ? null : Om(a);
    if (r) return r;
  }
  return null;
}, Dm = (n, a) => n.id === a || (n.children ?? []).some((r) => r.kind !== "text" && Dm(r, a)), Bm = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && Bm(a));
function xa(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function Kw(n, a, r, i, s = 0, c = !1) {
  const f = [n.root, ...n.overlays];
  ki = /* @__PURE__ */ new Set(), Zo = null;
  for (const x of f) Rm(x, ki);
  const d = s > 0 ? Lw(f, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && Dw(f, s, i.measure, d), qw(f, d), Uw(f, d), i.measure && Hw(f, i.measure, d);
  let m = a.div().relative().size_full().child(Ko(n.root, a, r, i, !1, !1, null, {}, !1, d)), h = c && n.overlays.length ? a.div().relative().size_full().window_layer() : m;
  for (const x of n.overlays) h = h.child(Ko(x, a, r, i, !0, !1, null, {}, !1, d));
  return h === m ? m : m.child(h);
}
function Dw(n, a, r, i) {
  const s = (S, z) => i.set(S, { ...i.get(S), ...z }), c = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map(), d = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function m(S, z, _) {
    if (S.kind === "text") {
      if (!(z.whitespace === "nowrap" || jm.test(S.text)) || z.text_ellipsis || _ || typeof z.text_size != "number") return NaN;
      const b = r(S.text, { size: z.text_size, weight: z.font_weight ?? 400, family: z.font_family ?? ".SystemUIFont", italic: !!z.italic });
      return Number.isFinite(b) ? b : NaN;
    }
    if (!Mt(S) || S.kind === "input" || S.kind === "engine" || S.markup) return h(S);
    const N = { ...z };
    for (const O of d) S.style[O] !== void 0 && (N[O] = S.style[O]);
    N.text_ellipsis = !!S.style.text_ellipsis, f.set(S, N);
    const B = S.style, R = (S.children ?? []).filter(Kt), X = R.map((O) => m(O, N, _ || !!S.tabular));
    let q = h(S);
    if (!Number.isFinite(q) && B.w === void 0) {
      const O = R.map((w, k) => X[k] + (w.kind === "text" ? 0 : se(w.style.ml) + se(w.style.mr)));
      let b;
      R.length ? Ut(S) ? b = R.some((w) => w.kind !== "text" && w.style.flex_grow > 0) || B.flex_wrap === "wrap" ? NaN : O.reduce((w, k) => w + k, 0) + se(B.gap_x) * (R.length - 1) : b = Math.max(...O) : b = 0, q = b + se(B.pl) + se(B.pr) + se(B.border_l) + se(B.border_r), typeof B.min_w == "number" && (q = Math.max(q, B.min_w)), typeof B.max_w == "number" && (q = Math.min(q, B.max_w));
    }
    return c.set(S, q), q;
  }
  const h = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, x = () => ({ exact: 0, laid: 0 }), g = (S, z) => {
    if (!Number.isFinite(z))
      return Object.assign(S, x()), NaN;
    S.exact += z;
    const _ = Math.round(S.exact * a + 1e-9) / a, N = _ - S.laid;
    return S.laid = _, N;
  }, v = (S) => Ut(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function E(S) {
    if (!S || S.kind === "text" || !Mt(S)) return;
    const z = (S.children ?? []).filter(Kt);
    if (v(S) && z.length > 1) {
      const _ = se(S.style.gap_x), N = x(), B = !(_ && z.some((R) => R.kind === "text" || !Number.isFinite(se(R.style.ml))));
      s(S, { border_l: g(N, se(S.style.border_l)), pl: g(N, se(S.style.pl)) }), B && _ && s(S, { gap_x: 0 }), z.forEach((R, X) => {
        const q = (X && B ? _ : 0) + (R.kind === "text" ? 0 : se(R.style.ml));
        if (R.kind === "text")
          q && Object.assign(N, x());
        else {
          const k = g(N, q);
          Number.isFinite(k) && s(R, { ml: k });
        }
        const O = R.kind === "text" ? f.get(S) ?? {} : null, b = R.kind === "text" ? m(R, O, !!S.tabular) : c.get(R);
        if ((R.kind === "text" || !(R.style.flex_grow > 0)) && Number.isFinite(b)) {
          const k = { w: g(N, b) };
          R.kind !== "text" && typeof R.style.w != "number" && R.style.min_w === void 0 && (k.whitespace = "nowrap", k.flex_shrink = 0), s(R, k);
        } else Object.assign(N, x());
        if (R.kind !== "text") {
          const k = g(N, se(R.style.mr));
          Number.isFinite(k) && s(R, { mr: k });
        }
      });
    }
    for (const _ of S.children ?? []) _.kind !== "text" && E(_);
  }
  for (const S of n)
    S && (m(S, {}, !1), E(S));
}
const Bw = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Hw(n, a, r) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (d) => typeof d == "number" ? d : 0, c = (d, m) => m && _i(m) && !Ut(m) && d.style.position !== "absolute" && !["start", "center", "end"].includes(d.style.self) && !["start", "center", "end"].includes(m.style.items), f = (d, m, h, x) => {
    if (!d || d.kind === "text" || !Mt(d)) return;
    const g = d.style;
    let v = typeof g.w == "number" ? g.w : g.w === "100%" ? h : c(d, m) ? h - s(g.ml) - s(g.mr) : NaN;
    typeof g.max_w == "number" && (v = Math.min(v, g.max_w));
    const E = v - s(g.pl) - s(g.pr) - s(g.border_l) - s(g.border_r), S = { ...x };
    for (const _ of i) g[_] !== void 0 && (S[_] = g[_]);
    const z = d.children ?? [];
    if (d.break_anywhere && Number.isFinite(E) && E > 0 && typeof S.text_size == "number" && z.length && z.every((_) => _.kind === "text")) {
      const _ = { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic }, N = (X) => a(X.trimEnd(), _) <= E + 0.01;
      let B = 0;
      for (const X of z) {
        const q = [];
        for (const b of X.text.split(`
`)) {
          let w = "";
          for (const k of b.split(Bw)) {
            if (N(w + k)) {
              w += k;
              continue;
            }
            w && q.push(w.trimEnd()), w = "";
            for (const C of k)
              w && !N(w + C) && (q.push(w), w = ""), w += C;
          }
          q.push(w.trimEnd());
        }
        const O = q.join(`
`);
        q.every((b) => !b || N(b)) ? O !== X.text && r.set(X, { ...r.get(X), text: O }) : B = NaN, B += q.length;
      }
      const R = xa(S);
      Number.isFinite(B) && R && g.h === void 0 && z.length === 1 && r.set(d, { ...r.get(d), h: B * R + s(g.pt) + s(g.pb) + s(g.border_t) + s(g.border_b) });
    }
    for (const _ of z) f(_, d, Ut(d) ? NaN : E, S);
  };
  for (const d of n) f(d, null, NaN, {});
}
function Uw(n, a) {
  const r = (i, s) => {
    if (!i || i.kind === "text" || !Mt(i)) return;
    const c = i.style, f = c.position === "absolute" ? c.w === void 0 && (c.left === void 0 || c.right === void 0) : s && typeof c.w != "number";
    if (f && Ut(i))
      for (const d of i.children ?? []) {
        const m = d.kind === "text" ? void 0 : d.style.flex_basis;
        d.kind !== "text" && d.style.flex_grow > 0 && (m === 0 || typeof m == "string" && m.endsWith("%")) && a.set(d, { ...a.get(d), flex_basis: "auto" });
      }
    for (const d of i.children ?? []) r(d, f);
  };
  for (const i of n) r(i, !1);
}
function qw(n, a) {
  const r = a.heights ?? /* @__PURE__ */ new Map(), i = (m) => r.get(m), s = (m) => {
    const h = i(m);
    if (Number.isFinite(h)) return h;
    if (m.kind === "text" || !Mt(m)) return 0;
    const x = m.style, g = typeof x.min_h == "number" ? x.min_h : 0, v = (m.children ?? []).filter(Kt), E = v.map((_) => s(_) + (_.kind === "text" ? 0 : Math.max(0, se(_.style.mt) || 0) + Math.max(0, se(_.style.mb) || 0))), S = v.length ? Ut(m) ? Math.max(...E) : E.reduce((_, N) => _ + N, 0) + (x.display === "flex" ? (se(x.gap_y) || 0) * (v.length - 1) : 0) : 0, z = [x.pt, x.pb, x.border_t, x.border_b].reduce((_, N) => _ + (se(N) || 0), 0);
    return Math.max(g, S + z);
  }, c = (m) => !(m.children ?? []).filter(Kt).length || Ut(m) ? NaN : s({ ...m, style: { ...m.style, h: void 0, max_h: void 0, min_h: void 0 } }), f = (m, h) => {
    const x = m.style;
    if (typeof x.h == "number") return x.h;
    if (typeof x.max_h == "number") return x.max_h;
    if (!h || !_i(h) || Ut(h)) return NaN;
    const g = h.style, v = typeof g.h == "number" ? g.h : typeof g.max_h == "number" ? g.max_h : NaN, E = (h.children ?? []).filter(Kt);
    let S = 0;
    for (const _ of E) {
      if (_ === m) continue;
      const N = i(_);
      if (!Number.isFinite(N)) return NaN;
      S += N + (_.kind === "text" ? 0 : se(_.style.mt) + se(_.style.mb));
    }
    const z = g.display === "flex" ? se(g.gap_y) * Math.max(0, E.length - 1) : 0;
    return v - se(g.pt) - se(g.pb) - se(g.border_t) - se(g.border_b) - S - z - se(x.mt) - se(x.mb);
  }, d = (m, h) => {
    if (!(!m || m.kind === "text" || !Mt(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const x = c(m), g = f(m, h);
        Number.isFinite(x) && Number.isFinite(g) && x > g + 0.01 && a.set(m, { ...a.get(m), pr: se(m.style.pr) + m.scrollbar });
      }
      for (const x of m.children ?? []) d(x, m);
    }
  };
  for (const m of n) d(m, null);
}
const Gw = ["text_size", "line_height", "whitespace", "text_ellipsis"], se = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, _i = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ut = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Kt = (n) => n.kind === "text" || Mt(n) && n.style.position !== "absolute";
function Lw(n, a) {
  const r = /* @__PURE__ */ new Map(), i = (z, _) => r.set(z, { ...r.get(z), ...Object.fromEntries(Object.entries(_).filter(([, N]) => Number.isFinite(N))) }), s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map();
  function f(z, _) {
    if (z.kind === "text") return _.whitespace === "nowrap" || jm.test(z.text) ? xa(_) ?? NaN : NaN;
    const N = { ..._ };
    for (const O of Gw) z.style[O] !== void 0 && (N[O] = z.style[O]);
    c.set(z, N);
    const B = z.style, R = (z.children ?? []).filter(Kt), X = R.map((O) => f(O, N));
    let q;
    if (B.h !== void 0 && B.h !== "auto") q = se(B.h);
    else if (z.kind === "engine") q = NaN;
    else if (z.kind === "input")
      q = (z.input_type === "textarea" || z.input_type === "select" ? NaN : xa(N) ?? NaN) + se(B.pt) + se(B.pb) + se(B.border_t) + se(B.border_b), B.min_h !== void 0 && (q = Math.max(q, se(B.min_h)));
    else {
      const O = R.map((w, k) => (w.kind === "text" ? 0 : se(w.style.mt) + se(w.style.mb)) + X[k]);
      let b;
      if (Ut(z)) b = B.flex_wrap === "wrap" ? NaN : B.items === "baseline" ? m(R, X, N) : Math.max(0, ...O);
      else if (_i(z)) {
        const w = R.some((C) => C.kind !== "text" && (C.style.flex_grow > 0 || C.style.flex_basis !== void 0)), k = B.display !== "flex" && R.some((C) => C.kind !== "text" && (se(C.style.mt) || se(C.style.mb)));
        b = w || k ? NaN : O.reduce((C, j) => C + j, 0) + (B.display === "flex" ? se(B.gap_y) * Math.max(0, R.length - 1) : 0);
      } else b = NaN;
      q = b + se(B.pt) + se(B.pb) + se(B.border_t) + se(B.border_b), B.min_h !== void 0 && (q = Math.max(q, se(B.min_h))), B.max_h !== void 0 && (q = Math.min(q, se(B.max_h)));
    }
    return s.set(z, q), q;
  }
  const d = (z) => (xa(z) - (hi + Hp) * z.text_size) / 2 + hi * z.text_size;
  function m(z, _, N) {
    let B = 0, R = 0;
    for (const [X, q] of z.entries()) {
      const O = q.kind === "text" ? N : c.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Kt).every((C) => C.kind === "text")) || !Number.isFinite(_[X]) || typeof O.text_size != "number") return NaN;
      const w = q.kind === "text" ? {} : q.style, k = se(w.mt) + se(w.border_t) + se(w.pt) + d(O);
      B = Math.max(B, k), R = Math.max(R, se(w.mt) + _[X] + se(w.mb) - k);
    }
    return B + R;
  }
  const h = () => ({ exact: 0, laid: 0 }), x = (z, _) => {
    if (!Number.isFinite(_))
      return Object.assign(z, h()), NaN;
    z.exact += _;
    const N = Math.round(z.exact * a + 1e-9) / a, B = N - z.laid;
    return z.laid = N, B;
  };
  function g(z) {
    if (!(z.kind === "text" || !Mt(z))) {
      for (const _ of (z.children ?? []).filter((N) => N.kind !== "text" && Mt(N) && N.style.position === "absolute")) g(_);
      if (_i(z) && !Ut(z)) {
        const _ = h();
        i(z, { border_t: x(_, se(z.style.border_t)), pt: x(_, se(z.style.pt)) }), v(z, _);
      } else for (const _ of (z.children ?? []).filter(Kt)) _.kind !== "text" && g(_);
    }
  }
  function v(z, _) {
    const N = (z.children ?? []).filter(Kt), B = z.style.display === "flex" ? se(z.style.gap_y) : 0;
    if (B && N.some((R) => R.kind === "text")) {
      for (const R of N) R.kind !== "text" && g(R);
      return !1;
    }
    return B && i(z, { gap_y: 0 }), N.forEach((R, X) => {
      if (R.kind === "text") {
        const q = s.get(R) ?? f(R, c.get(z) ?? {});
        Number.isFinite(q) ? i(R, { h: x(_, q) }) : Object.assign(_, h());
        return;
      }
      if (i(R, { mt: x(_, (X ? B : 0) + se(R.style.mt)) }), Number.isFinite(s.get(R))) S(R, _);
      else if (E(R)) {
        const q = R.style;
        i(R, { border_t: x(_, se(q.border_t)), pt: x(_, se(q.pt)) }), i(R, { pb: x(_, se(q.pb)), border_b: x(_, se(q.border_b)) });
      } else
        g(R), Object.assign(_, h());
      i(R, { mb: x(_, se(R.style.mb)) });
    }), !0;
  }
  function E(z) {
    const _ = z.style, N = (z.children ?? []).filter(Kt), B = xa(c.get(z) ?? {});
    return z.kind === "div" && !Ut(z) && N.length > 0 && N.every((R) => R.kind === "text") && Number.isInteger(B) && [_.h, _.min_h, _.max_h].every((R) => R === void 0 || R === "auto");
  }
  function S(z, _) {
    const N = z.style;
    for (const O of (z.children ?? []).filter((b) => b.kind !== "text" && Mt(b) && b.style.position === "absolute")) g(O);
    const B = _.laid, R = _.exact;
    i(z, { border_t: x(_, se(N.border_t)), pt: x(_, se(N.pt)) });
    const X = N.h !== void 0 && N.h !== "auto", q = s.get(z) - se(N.pt) - se(N.pb) - se(N.border_t) - se(N.border_b);
    if (z.kind === "input")
      X || x(_, q);
    else if (Ut(z) || X && (N.justify ?? "start") !== "start") {
      for (const O of (z.children ?? []).filter(Kt)) O.kind !== "text" && g(O);
      X || x(_, q);
    } else !v(z, _) && !X && x(_, q);
    if (X) {
      _.exact = R + s.get(z), _.laid = Math.round(_.exact * a + 1e-9) / a, i(z, { h: _.laid - B });
      return;
    }
    i(z, { pb: x(_, se(N.pb)), border_b: x(_, se(N.border_b)) }), i(z, { h: _.laid - B });
  }
  for (const z of n)
    f(z, {}), g(z);
  return Object.defineProperty(r, "heights", { value: s }), r;
}
const Jw = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }], review: [{ name: "review-root", selector: '[data-testid="workspace-git-review"]' }, { name: "git-refresh", selector: '[data-testid="git-refresh"]' }, { name: "git-status", selector: '[data-testid="git-status"]' }, { name: "git-diff", selector: '[data-testid="git-diff"]' }, { name: "git-diff-empty", selector: '[data-testid="git-diff-empty"]' }, { name: "git-file-header", selector: '[data-testid="git-diff"] article > header' }, { name: "git-hunk-header", selector: '[data-testid="git-diff"] section > div:first-child' }, { name: "git-diff-line", selector: '[data-testid="git-diff-line"]' }, { name: "git-line-comments", selector: '[data-testid="git-line-comments"]' }, { name: "git-comment-composer", selector: '[data-testid="git-comment-composer"]' }] };
export {
  Jw as NAMED_ELEMENTS,
  E0 as React,
  ob as SCHEMA,
  Zw as STYLE_KEYS,
  Kw as describeToGpui,
  Yw as jsxRuntime,
  Qw as mount,
  Vw as reactDom,
  Xw as sdk
};
