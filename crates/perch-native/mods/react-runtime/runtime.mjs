function lc(n, a) {
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
class st extends Error {
}
const g0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), b0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), v0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...g0]);
function Oo(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (a, r, i) => r ? String.fromCodePoint(parseInt(r, 16)) : i);
}
function Ol(n, a) {
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
  if (r === a) throw new st(`expected a name at ${a} in ${JSON.stringify(n)}`);
  return [Oo(n.slice(a, r)), r];
}
function y0(n, a) {
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
  throw new st(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function rc(n) {
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
function x0(n, a) {
  const r = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let i = !1;
  for (; a < n.length; ) {
    const s = n[a];
    if (s === "*") {
      r.tag = "*", a++, i = !0;
      continue;
    }
    if (s === ".") {
      const [c, f] = Ol(n, a + 1);
      r.classes.push(c), a = f, i = !0;
      continue;
    }
    if (s === "#") {
      const [c, f] = Ol(n, a + 1);
      r.id = c, a = f, i = !0;
      continue;
    }
    if (s === "[") {
      const c = n.indexOf("]", a);
      if (c < 0) throw new st(`unclosed [ in ${JSON.stringify(n)}`);
      const f = n.slice(a + 1, c).trim(), d = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(f);
      if (!d) throw new st(`cannot read the attribute selector [${f}]`);
      const m = d[3] ?? d[4] ?? d[5];
      r.attrs.push({ name: Oo(d[1]).toLowerCase(), op: d[2] ?? null, value: m === void 0 ? null : Oo(m) }), a = c + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[a + 1] === ":") {
        const [m, g] = Ol(n, a + 2), x = m.toLowerCase();
        if (x !== "before" && x !== "after") throw new st(`::${x} is not supported`);
        if (r.pseudoElement = x, a = g, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new st(`nothing may follow ::${x} in ${JSON.stringify(n)}`);
        break;
      }
      const [c, f] = Ol(n, a + 1);
      a = f;
      const d = c.toLowerCase();
      if ((d === "before" || d === "after") && n[a] !== "(") {
        if (r.pseudoElement = d, i = !0, a < n.length && !/[\s>]/.test(n[a])) throw new st(`nothing may follow :${d} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!b0.has(d)) throw new st(`:${d}() is not supported`);
        const m = y0(n, a + 1), g = n.slice(a + 1, m).trim();
        if (a = m + 1, d === "nth-child") {
          if (!/^\d+$/.test(g)) throw new st(`:nth-child(${g}) is not supported (only a number)`);
          r.pseudos.push({ name: d, n: Number(g) });
        } else {
          const x = rc(g).map(ic);
          if (d === "has" && x.some((y) => y.length !== 1)) throw new st(`:has(${g}) is not supported (only a compound selector)`);
          r.pseudos.push({ name: d, list: x });
        }
      } else {
        if (!v0.has(d)) throw new st(`:${d} is not supported`);
        r.pseudos.push({ name: d });
      }
      i = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !i) {
      const [c, f] = Ol(n, a);
      r.tag = c.toLowerCase(), a = f, i = !0;
      continue;
    }
    break;
  }
  if (!i) throw new st(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [r, a];
}
function ic(n) {
  const a = [];
  let r = 0, i = null;
  for (n = n.trim(); r < n.length; ) {
    const [s, c] = x0(n, r);
    if (a.at(-1)?.compound.pseudoElement) throw new st(`::${a.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
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
      if (d === "+" || d === "~") throw new st(`the ${d} combinator is not supported`);
      if (f) i = " ";
      else throw new st(`unexpected ${JSON.stringify(d)} in ${JSON.stringify(n)}`);
    }
  }
  if (!a.length) throw new st("empty selector");
  return a;
}
const Ef = /* @__PURE__ */ new Map();
function Mi(n) {
  let a = Ef.get(n);
  return a || (a = rc(n).map(ic), Ef.set(n, a)), a;
}
function Tp(n) {
  const a = [0, 0, 0], r = (i) => {
    a[0] += i[0], a[1] += i[1], a[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && a[0]++, a[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && a[2]++, i.pseudoElement && a[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const c = s.list.map(Tp).sort((f, d) => d[0] - f[0] || d[1] - f[1] || d[2] - f[2])[0];
          r(c);
        } else a[1]++;
  }
  return a;
}
function w0(n, { name: a, op: r, value: i }) {
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
function $r(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Cp(n, a) {
  for (const r of n.children) if (a(r) || Cp(r, a)) return !0;
  return !1;
}
function Ap(n, a, r, i) {
  if ((a.pseudoElement ?? null) !== (i ? r.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const c of a.classes) if (!s.has(c)) return !1;
  }
  for (const s of a.attrs) if (!w0(n, s)) return !1;
  for (const s of a.pseudos)
    switch (s.name) {
      case "first-child":
        if ($r(n)[0] !== n) return !1;
        break;
      case "only-child":
        if ($r(n).length !== 1) return !1;
        break;
      case "last-child": {
        const c = $r(n);
        if (c[c.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if ($r(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((c) => tl(n, c, r, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: c }]) => Cp(n, (f) => Ap(f, c, r, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((c) => tl(n, c, r, i))) return !1;
        break;
      default:
        if (!r.state || !r.state(n, s.name, i)) return !1;
    }
  return !0;
}
function tl(n, a, r, i = !0) {
  const s = (c, f, d) => {
    const { compound: m, combinator: g } = a[f];
    if (!Ap(c, m, r, d)) return !1;
    if (f === 0) return !0;
    if (g === ">") return !!c.parentElement && s(c.parentElement, f - 1, !1);
    for (let x = c.parentElement; x; x = x.parentElement) if (s(x, f - 1, !1)) return !0;
    return !1;
  };
  return s(n, a.length - 1, i);
}
function k0(n, a, r = {}) {
  return (typeof a == "string" ? Mi(a) : a).some((s) => tl(n, s, r));
}
function Do(n, a, r = {}) {
  return tl(n, a, r);
}
function Vl(n, a, r = {}) {
  const i = Mi(a), s = [], c = (f) => {
    for (const d of f.children)
      i.some((m) => tl(d, m, r)) && s.push(d), c(d);
  };
  return c(n), s;
}
function Mp(n, a, r = {}) {
  const i = Mi(a);
  for (let s = n; s; s = s.parentElement) if (i.some((c) => tl(s, c, r))) return s;
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
let _0 = 1;
class Bo {
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
class sc {
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
let S0 = 0;
const Ho = () => ++S0;
class ji {
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
class Ze extends sc {
  constructor(a, r = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${_0++}`, this.tagName = a.toLowerCase(), this.props = r, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = Ho(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = Ho();
    for (let r = this; r instanceof Ze; r = r.parentNode) r.stamp = a;
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
    return this.parentNode instanceof Ze ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((a) => a instanceof Ze);
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
    return k0(this, a);
  }
  closest(a) {
    return Mp(this, a);
  }
  querySelectorAll(a) {
    return Vl(this, a);
  }
  querySelector(a) {
    return Vl(this, a)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const a = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return a ? new Bo(a.x, a.y, a.width, a.height) : new Bo();
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
          return d === "setProperty" ? (m, g) => c(r(m), g) : d === "removeProperty" ? (m) => {
            const g = s(r(m));
            return c(r(m), ""), g;
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
    return zf(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return zf(this, a);
  }
}
const jp = Symbol("perch.stale-layout"), Rp = 3;
let ci = !1;
function Op(n) {
  return () => {
    let a, r = !1;
    const i = (s) => {
      const c = ci;
      ci = s < Rp;
      try {
        a = n();
      } catch (f) {
        const d = f?.[jp];
        if (!d) throw f;
        d.retries.push(() => {
          r || i(s + 1);
        });
      } finally {
        ci = c;
      }
    };
    return i(0), () => {
      r = !0, typeof a == "function" && a();
    };
  };
}
const Uo = "perch-dom:", E0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), z0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function zf(n, a = []) {
  const r = new Set(a.map((s) => z0[s] ?? s)), i = (s) => {
    if (!(s instanceof Ze)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const c = {};
    for (const [f, d] of Object.entries(s.props))
      E0.has(f) || r.has(f) || d == null || typeof d == "function" || typeof d == "symbol" || (c[f] = d);
    return { t: s.tagName, p: c, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return Uo + JSON.stringify(i(n));
}
function N0(n, a) {
  if (typeof n != "string" || !n.startsWith(Uo)) return null;
  let r;
  try {
    r = JSON.parse(n.slice(Uo.length));
  } catch {
    return null;
  }
  const i = (c) => !!c && typeof c == "object" && !Array.isArray(c), s = (c) => {
    if (!i(c)) throw new Error("not a node");
    let f;
    if (typeof c.x == "string") f = new ji(c.x);
    else {
      if (typeof c.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(c.t) || !i(c.p) || !Array.isArray(c.c)) throw new Error("not an element");
      f = new Ze(c.t, c.p, a);
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
class T0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class C0 {
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
function Nf(n) {
  for (let a = n; a instanceof Ze; a = a.parentElement) a.touch();
}
class A0 extends sc {
  constructor(a) {
    super(), this.perch = a, this.documentElement = new Ze("html", {}, this), this.body = new Ze("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(a) {
    return new Ze(a, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(a) {
    const r = this.perch?.bounds;
    if (typeof r != "function" || !this.measureKey) return null;
    a.measured || (a.measured = !0, a.touch(), this.restyled());
    const i = r(this.measureKey(a));
    if (ci && (!i || this.stale?.())) throw { [jp]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, Nf(a), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, Nf(a), this.activeElement === a && (this.activeElement = this.body);
  }
  querySelectorAll(a) {
    return Vl(this.documentElement, a);
  }
  querySelector(a) {
    return this.querySelectorAll(a)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(a) {
    return Vl(this.documentElement, "*").find((r) => r.props?.id === a) ?? null;
  }
}
class M0 extends sc {
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
function Dp(n) {
  return {
    setTimeout: (a, r = 0, ...i) => n.setTimeout(() => a(...i), Math.max(0, Number(r) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const Tf = Symbol.for("perch.react.globals");
function Pt(n, a, r) {
  Object.defineProperty(n, a, { value: r, configurable: !0, writable: !0, enumerable: !1 });
}
function j0(n, a = globalThis) {
  const r = new A0(n), i = new M0(n, r);
  r.defaultView = i;
  const s = n.storage ?? new C0();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const d = Dp(n);
    Pt(a, "setTimeout", d.setTimeout), Pt(a, "clearTimeout", d.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && Pt(a, "queueMicrotask", (d) => {
    Promise.resolve().then(d);
  }), Pt(a, "requestAnimationFrame", (d) => a.setTimeout(() => d(Date.now()), 0)), Pt(a, "cancelAnimationFrame", (d) => a.clearTimeout(d));
  const c = { document: r, window: i, localStorage: s, HTMLElement: Ze, Element: Ze };
  for (const d of Object.keys(c))
    Object.defineProperty(a, d, { get: () => a[Tf]?.[d], configurable: !0, enumerable: !1 });
  a[Tf] = c, Pt(a, "DOMRect", Bo), Pt(a, "getComputedStyle", R0), typeof a.ResizeObserver != "function" && Pt(a, "ResizeObserver", T0);
  const f = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!f.clipboard && n.clipboard)
    try {
      Pt(f, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || Pt(a, "navigator", f), { document: r, window: i, globals: c };
}
function R0(n) {
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
function qo(n, a = !1) {
  if (!(a ? n?.tagName === "input" && Bp(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Bp = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Cf = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Cf?.setTimeout == "function") {
  const n = Dp(Cf);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function oc(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function O0(n) {
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
var ko = { exports: {} }, me = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Af;
function D0() {
  if (Af) return me;
  Af = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), c = Symbol.for("react.consumer"), f = Symbol.for("react.context"), d = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), g = Symbol.for("react.memo"), x = Symbol.for("react.lazy"), y = Symbol.for("react.activity"), b = Symbol.iterator;
  function S(A) {
    return A === null || typeof A != "object" ? null : (A = b && A[b] || A["@@iterator"], typeof A == "function" ? A : null);
  }
  var E = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, R = Object.assign, z = {};
  function j(A, Z, ae) {
    this.props = A, this.context = Z, this.refs = z, this.updater = ae || E;
  }
  j.prototype.isReactComponent = {}, j.prototype.setState = function(A, Z) {
    if (typeof A != "object" && typeof A != "function" && A != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, A, Z, "setState");
  }, j.prototype.forceUpdate = function(A) {
    this.updater.enqueueForceUpdate(this, A, "forceUpdate");
  };
  function O() {
  }
  O.prototype = j.prototype;
  function H(A, Z, ae) {
    this.props = A, this.context = Z, this.refs = z, this.updater = ae || E;
  }
  var K = H.prototype = new O();
  K.constructor = H, R(K, j.prototype), K.isPureReactComponent = !0;
  var J = Array.isArray;
  function T() {
  }
  var h = { H: null, A: null, T: null, S: null }, w = Object.prototype.hasOwnProperty;
  function k(A, Z, ae) {
    var oe = ae.ref;
    return {
      $$typeof: n,
      type: A,
      key: Z,
      ref: oe !== void 0 ? oe : null,
      props: ae
    };
  }
  function _(A, Z) {
    return k(A.type, Z, A.props);
  }
  function C(A) {
    return typeof A == "object" && A !== null && A.$$typeof === n;
  }
  function N(A) {
    var Z = { "=": "=0", ":": "=2" };
    return "$" + A.replace(/[=:]/g, function(ae) {
      return Z[ae];
    });
  }
  var D = /\/+/g;
  function G(A, Z) {
    return typeof A == "object" && A !== null && A.key != null ? N("" + A.key) : Z.toString(36);
  }
  function $(A) {
    switch (A.status) {
      case "fulfilled":
        return A.value;
      case "rejected":
        throw A.reason;
      default:
        switch (typeof A.status == "string" ? A.then(T, T) : (A.status = "pending", A.then(
          function(Z) {
            A.status === "pending" && (A.status = "fulfilled", A.value = Z);
          },
          function(Z) {
            A.status === "pending" && (A.status = "rejected", A.reason = Z);
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
  function q(A, Z, ae, oe, ce) {
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
            case x:
              return Ee = A._init, q(
                Ee(A._payload),
                Z,
                ae,
                oe,
                ce
              );
          }
      }
    if (Ee)
      return ce = ce(A), Ee = oe === "" ? "." + G(A, 0) : oe, J(ce) ? (ae = "", Ee != null && (ae = Ee.replace(D, "$&/") + "/"), q(ce, Z, ae, "", function($n) {
        return $n;
      })) : ce != null && (C(ce) && (ce = _(
        ce,
        ae + (ce.key == null || A && A.key === ce.key ? "" : ("" + ce.key).replace(
          D,
          "$&/"
        ) + "/") + Ee
      )), Z.push(ce)), 1;
    Ee = 0;
    var Ie = oe === "" ? "." : oe + ":";
    if (J(A))
      for (var he = 0; he < A.length; he++)
        oe = A[he], ue = Ie + G(oe, he), Ee += q(
          oe,
          Z,
          ae,
          ue,
          ce
        );
    else if (he = S(A), typeof he == "function")
      for (A = he.call(A), he = 0; !(oe = A.next()).done; )
        oe = oe.value, ue = Ie + G(oe, he++), Ee += q(
          oe,
          Z,
          ae,
          ue,
          ce
        );
    else if (ue === "object") {
      if (typeof A.then == "function")
        return q(
          $(A),
          Z,
          ae,
          oe,
          ce
        );
      throw Z = String(A), Error(
        "Objects are not valid as a React child (found: " + (Z === "[object Object]" ? "object with keys {" + Object.keys(A).join(", ") + "}" : Z) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Ee;
  }
  function X(A, Z, ae) {
    if (A == null) return A;
    var oe = [], ce = 0;
    return q(A, oe, "", "", function(ue) {
      return Z.call(ae, ue, ce++);
    }), oe;
  }
  function I(A) {
    if (A._status === -1) {
      var Z = A._result;
      Z = Z(), Z.then(
        function(ae) {
          (A._status === 0 || A._status === -1) && (A._status = 1, A._result = ae);
        },
        function(ae) {
          (A._status === 0 || A._status === -1) && (A._status = 2, A._result = ae);
        }
      ), A._status === -1 && (A._status = 0, A._result = Z);
    }
    if (A._status === 1) return A._result.default;
    throw A._result;
  }
  var Q = typeof reportError == "function" ? reportError : function(A) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var Z = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof A == "object" && A !== null && typeof A.message == "string" ? String(A.message) : String(A),
        error: A
      });
      if (!window.dispatchEvent(Z)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", A);
      return;
    }
    console.error(A);
  }, V = {
    map: X,
    forEach: function(A, Z, ae) {
      X(
        A,
        function() {
          Z.apply(this, arguments);
        },
        ae
      );
    },
    count: function(A) {
      var Z = 0;
      return X(A, function() {
        Z++;
      }), Z;
    },
    toArray: function(A) {
      return X(A, function(Z) {
        return Z;
      }) || [];
    },
    only: function(A) {
      if (!C(A))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return A;
    }
  };
  return me.Activity = y, me.Children = V, me.Component = j, me.Fragment = r, me.Profiler = s, me.PureComponent = H, me.StrictMode = i, me.Suspense = m, me.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, me.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(A) {
      return h.H.useMemoCache(A);
    }
  }, me.cache = function(A) {
    return function() {
      return A.apply(null, arguments);
    };
  }, me.cacheSignal = function() {
    return null;
  }, me.cloneElement = function(A, Z, ae) {
    if (A == null)
      throw Error(
        "The argument must be a React element, but you passed " + A + "."
      );
    var oe = R({}, A.props), ce = A.key;
    if (Z != null)
      for (ue in Z.key !== void 0 && (ce = "" + Z.key), Z)
        !w.call(Z, ue) || ue === "key" || ue === "__self" || ue === "__source" || ue === "ref" && Z.ref === void 0 || (oe[ue] = Z[ue]);
    var ue = arguments.length - 2;
    if (ue === 1) oe.children = ae;
    else if (1 < ue) {
      for (var Ee = Array(ue), Ie = 0; Ie < ue; Ie++)
        Ee[Ie] = arguments[Ie + 2];
      oe.children = Ee;
    }
    return k(A.type, ce, oe);
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
  }, me.createElement = function(A, Z, ae) {
    var oe, ce = {}, ue = null;
    if (Z != null)
      for (oe in Z.key !== void 0 && (ue = "" + Z.key), Z)
        w.call(Z, oe) && oe !== "key" && oe !== "__self" && oe !== "__source" && (ce[oe] = Z[oe]);
    var Ee = arguments.length - 2;
    if (Ee === 1) ce.children = ae;
    else if (1 < Ee) {
      for (var Ie = Array(Ee), he = 0; he < Ee; he++)
        Ie[he] = arguments[he + 2];
      ce.children = Ie;
    }
    if (A && A.defaultProps)
      for (oe in Ee = A.defaultProps, Ee)
        ce[oe] === void 0 && (ce[oe] = Ee[oe]);
    return k(A, ue, ce);
  }, me.createRef = function() {
    return { current: null };
  }, me.forwardRef = function(A) {
    return { $$typeof: d, render: A };
  }, me.isValidElement = C, me.lazy = function(A) {
    return {
      $$typeof: x,
      _payload: { _status: -1, _result: A },
      _init: I
    };
  }, me.memo = function(A, Z) {
    return {
      $$typeof: g,
      type: A,
      compare: Z === void 0 ? null : Z
    };
  }, me.startTransition = function(A) {
    var Z = h.T, ae = {};
    h.T = ae;
    try {
      var oe = A(), ce = h.S;
      ce !== null && ce(ae, oe), typeof oe == "object" && oe !== null && typeof oe.then == "function" && oe.then(T, Q);
    } catch (ue) {
      Q(ue);
    } finally {
      Z !== null && ae.types !== null && (Z.types = ae.types), h.T = Z;
    }
  }, me.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, me.use = function(A) {
    return h.H.use(A);
  }, me.useActionState = function(A, Z, ae) {
    return h.H.useActionState(A, Z, ae);
  }, me.useCallback = function(A, Z) {
    return h.H.useCallback(A, Z);
  }, me.useContext = function(A) {
    return h.H.useContext(A);
  }, me.useDebugValue = function() {
  }, me.useDeferredValue = function(A, Z) {
    return h.H.useDeferredValue(A, Z);
  }, me.useEffect = function(A, Z) {
    return h.H.useEffect(A, Z);
  }, me.useEffectEvent = function(A) {
    return h.H.useEffectEvent(A);
  }, me.useId = function() {
    return h.H.useId();
  }, me.useImperativeHandle = function(A, Z, ae) {
    return h.H.useImperativeHandle(A, Z, ae);
  }, me.useInsertionEffect = function(A, Z) {
    return h.H.useInsertionEffect(A, Z);
  }, me.useLayoutEffect = function(A, Z) {
    return h.H.useLayoutEffect(A, Z);
  }, me.useMemo = function(A, Z) {
    return h.H.useMemo(A, Z);
  }, me.useOptimistic = function(A, Z) {
    return h.H.useOptimistic(A, Z);
  }, me.useReducer = function(A, Z, ae) {
    return h.H.useReducer(A, Z, ae);
  }, me.useRef = function(A) {
    return h.H.useRef(A);
  }, me.useState = function(A) {
    return h.H.useState(A);
  }, me.useSyncExternalStore = function(A, Z, ae) {
    return h.H.useSyncExternalStore(
      A,
      Z,
      ae
    );
  }, me.useTransition = function() {
    return h.H.useTransition();
  }, me.version = "19.2.8", me;
}
var Mf;
function B0() {
  return Mf || (Mf = 1, ko.exports = D0()), ko.exports;
}
var W = B0();
const Hp = /* @__PURE__ */ oc(W), H0 = /* @__PURE__ */ lc({
  __proto__: null,
  default: Hp
}, [W]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const U0 = Hp ?? H0;
function ct(n, a) {
  return W.useEffect(Op(n), a);
}
function mi(n, a) {
  return W.useLayoutEffect(Op(n), a);
}
const q0 = /* @__PURE__ */ lc({
  __proto__: null,
  default: U0,
  useEffect: ct,
  useLayoutEffect: mi
}, [W]);
var _o = { exports: {} }, Dl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var jf;
function G0() {
  if (jf) return Dl;
  jf = 1;
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
  return Dl.Fragment = a, Dl.jsx = r, Dl.jsxs = r, Dl;
}
var Rf;
function L0() {
  return Rf || (Rf = 1, _o.exports = G0()), _o.exports;
}
var te = L0();
const Y0 = /* @__PURE__ */ oc(te), a4 = /* @__PURE__ */ lc({
  __proto__: null,
  default: Y0
}, [te]);
var So = { exports: {} }, Eo = { exports: {} };
const Q0 = /* @__PURE__ */ O0(q0);
var zo = { exports: {} }, No = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Of;
function V0() {
  return Of || (Of = 1, (function(n) {
    function a(q, X) {
      var I = q.length;
      q.push(X);
      e: for (; 0 < I; ) {
        var Q = I - 1 >>> 1, V = q[Q];
        if (0 < s(V, X))
          q[Q] = X, q[I] = V, I = Q;
        else break e;
      }
    }
    function r(q) {
      return q.length === 0 ? null : q[0];
    }
    function i(q) {
      if (q.length === 0) return null;
      var X = q[0], I = q.pop();
      if (I !== X) {
        q[0] = I;
        e: for (var Q = 0, V = q.length, A = V >>> 1; Q < A; ) {
          var Z = 2 * (Q + 1) - 1, ae = q[Z], oe = Z + 1, ce = q[oe];
          if (0 > s(ae, I))
            oe < V && 0 > s(ce, ae) ? (q[Q] = ce, q[oe] = I, Q = oe) : (q[Q] = ae, q[Z] = I, Q = Z);
          else if (oe < V && 0 > s(ce, I))
            q[Q] = ce, q[oe] = I, Q = oe;
          else break e;
        }
      }
      return X;
    }
    function s(q, X) {
      var I = q.sortIndex - X.sortIndex;
      return I !== 0 ? I : q.id - X.id;
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
    var m = [], g = [], x = 1, y = null, b = 3, S = !1, E = !1, R = !1, z = !1, j = typeof setTimeout == "function" ? setTimeout : null, O = typeof clearTimeout == "function" ? clearTimeout : null, H = typeof setImmediate < "u" ? setImmediate : null;
    function K(q) {
      for (var X = r(g); X !== null; ) {
        if (X.callback === null) i(g);
        else if (X.startTime <= q)
          i(g), X.sortIndex = X.expirationTime, a(m, X);
        else break;
        X = r(g);
      }
    }
    function J(q) {
      if (R = !1, K(q), !E)
        if (r(m) !== null)
          E = !0, T || (T = !0, N());
        else {
          var X = r(g);
          X !== null && $(J, X.startTime - q);
        }
    }
    var T = !1, h = -1, w = 5, k = -1;
    function _() {
      return z ? !0 : !(n.unstable_now() - k < w);
    }
    function C() {
      if (z = !1, T) {
        var q = n.unstable_now();
        k = q;
        var X = !0;
        try {
          e: {
            E = !1, R && (R = !1, O(h), h = -1), S = !0;
            var I = b;
            try {
              t: {
                for (K(q), y = r(m); y !== null && !(y.expirationTime > q && _()); ) {
                  var Q = y.callback;
                  if (typeof Q == "function") {
                    y.callback = null, b = y.priorityLevel;
                    var V = Q(
                      y.expirationTime <= q
                    );
                    if (q = n.unstable_now(), typeof V == "function") {
                      y.callback = V, K(q), X = !0;
                      break t;
                    }
                    y === r(m) && i(m), K(q);
                  } else i(m);
                  y = r(m);
                }
                if (y !== null) X = !0;
                else {
                  var A = r(g);
                  A !== null && $(
                    J,
                    A.startTime - q
                  ), X = !1;
                }
              }
              break e;
            } finally {
              y = null, b = I, S = !1;
            }
            X = void 0;
          }
        } finally {
          X ? N() : T = !1;
        }
      }
    }
    var N;
    if (typeof H == "function")
      N = function() {
        H(C);
      };
    else if (typeof MessageChannel < "u") {
      var D = new MessageChannel(), G = D.port2;
      D.port1.onmessage = C, N = function() {
        G.postMessage(null);
      };
    } else
      N = function() {
        j(C, 0);
      };
    function $(q, X) {
      h = j(function() {
        q(n.unstable_now());
      }, X);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(q) {
      q.callback = null;
    }, n.unstable_forceFrameRate = function(q) {
      0 > q || 125 < q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : w = 0 < q ? Math.floor(1e3 / q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return b;
    }, n.unstable_next = function(q) {
      switch (b) {
        case 1:
        case 2:
        case 3:
          var X = 3;
          break;
        default:
          X = b;
      }
      var I = b;
      b = X;
      try {
        return q();
      } finally {
        b = I;
      }
    }, n.unstable_requestPaint = function() {
      z = !0;
    }, n.unstable_runWithPriority = function(q, X) {
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
        return X();
      } finally {
        b = I;
      }
    }, n.unstable_scheduleCallback = function(q, X, I) {
      var Q = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? Q + I : Q) : I = Q, q) {
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
      return V = I + V, q = {
        id: x++,
        callback: X,
        priorityLevel: q,
        startTime: I,
        expirationTime: V,
        sortIndex: -1
      }, I > Q ? (q.sortIndex = I, a(g, q), r(m) === null && q === r(g) && (R ? (O(h), h = -1) : R = !0, $(J, I - Q))) : (q.sortIndex = V, a(m, q), E || S || (E = !0, T || (T = !0, N()))), q;
    }, n.unstable_shouldYield = _, n.unstable_wrapCallback = function(q) {
      var X = b;
      return function() {
        var I = b;
        b = X;
        try {
          return q.apply(this, arguments);
        } finally {
          b = I;
        }
      };
    };
  })(No)), No;
}
var Df;
function X0() {
  return Df || (Df = 1, zo.exports = V0()), zo.exports;
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
var Bf;
function K0() {
  return Bf || (Bf = 1, (function(n) {
    n.exports = function(a) {
      function r(e, t, l, o) {
        return new wh(e, t, l, o);
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
            for (var v = !1, M = u.child; M; ) {
              if (M === l) {
                v = !0, l = u, o = p;
                break;
              }
              if (M === o) {
                v = !0, o = u, l = p;
                break;
              }
              M = M.sibling;
            }
            if (!v) {
              for (M = p.child; M; ) {
                if (M === l) {
                  v = !0, l = p, o = u;
                  break;
                }
                if (M === o) {
                  v = !0, o = p, l = u;
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
      function g(e) {
        var t = e.tag;
        if (t === 5 || t === 26 || t === 27 || t === 6) return e;
        for (e = e.child; e !== null; ) {
          if (e.tag !== 4 && (t = g(e), t !== null))
            return t;
          e = e.sibling;
        }
        return null;
      }
      function x(e) {
        return e === null || typeof e != "object" ? null : (e = Qd && e[Qd] || e["@@iterator"], typeof e == "function" ? e : null);
      }
      function y(e) {
        if (e == null) return null;
        if (typeof e == "function")
          return e.$$typeof === zh ? null : e.displayName || e.name || null;
        if (typeof e == "string") return e;
        switch (e) {
          case ja:
            return "Fragment";
          case Ls:
            return "Profiler";
          case Ld:
            return "StrictMode";
          case Qs:
            return "Suspense";
          case Vs:
            return "SuspenseList";
          case Ks:
            return "Activity";
        }
        if (typeof e == "object")
          switch (e.$$typeof) {
            case Ma:
              return "Portal";
            case An:
              return e.displayName || "Context";
            case Yd:
              return (e._context.displayName || "Context") + ".Consumer";
            case Ys:
              var t = e.render;
              return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
            case Xs:
              return t = e.displayName || null, t !== null ? t : y(e.type) || "Memo";
            case Mn:
              t = e._payload, e = e._init;
              try {
                return y(e(t));
              } catch {
              }
          }
        return null;
      }
      function b(e) {
        return { current: e };
      }
      function S(e) {
        0 > Da || (e.current = Is[Da], Is[Da] = null, Da--);
      }
      function E(e, t) {
        Da++, Is[Da] = e.current, e.current = t;
      }
      function R(e) {
        return e >>>= 0, e === 0 ? 32 : 31 - (e0(e) / t0 | 0) | 0;
      }
      function z(e) {
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
      function j(e, t, l) {
        var o = e.pendingLanes;
        if (o === 0) return 0;
        var u = 0, p = e.suspendedLanes, v = e.pingedLanes;
        e = e.warmLanes;
        var M = o & 134217727;
        return M !== 0 ? (o = M & ~p, o !== 0 ? u = z(o) : (v &= M, v !== 0 ? u = z(v) : l || (l = M & ~e, l !== 0 && (u = z(l))))) : (M = o & ~p, M !== 0 ? u = z(M) : v !== 0 ? u = z(v) : l || (l = o & ~e, l !== 0 && (u = z(l)))), u === 0 ? 0 : t !== 0 && t !== u && (t & p) === 0 && (p = u & -u, l = t & -t, p >= l || p === 32 && (l & 4194048) !== 0) ? t : u;
      }
      function O(e, t) {
        return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
      }
      function H(e, t) {
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
      function K() {
        var e = Mr;
        return Mr <<= 1, (Mr & 62914560) === 0 && (Mr = 4194304), e;
      }
      function J(e) {
        for (var t = [], l = 0; 31 > l; l++) t.push(e);
        return t;
      }
      function T(e, t) {
        e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
      }
      function h(e, t, l, o, u, p) {
        var v = e.pendingLanes;
        e.pendingLanes = l, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= l, e.entangledLanes &= l, e.errorRecoveryDisabledLanes &= l, e.shellSuspendCounter = 0;
        var M = e.entanglements, Y = e.expirationTimes, F = e.hiddenUpdates;
        for (l = v & ~l; 0 < l; ) {
          var ne = 31 - St(l), P = 1 << ne;
          M[ne] = 0, Y[ne] = -1;
          var le = F[ne];
          if (le !== null)
            for (F[ne] = null, ne = 0; ne < le.length; ne++) {
              var ge = le[ne];
              ge !== null && (ge.lane &= -536870913);
            }
          l &= ~P;
        }
        o !== 0 && w(e, o, 0), p !== 0 && u === 0 && e.tag !== 0 && (e.suspendedLanes |= p & ~(v & ~t));
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
      function _(e, t) {
        var l = t & -t;
        return l = (l & 42) !== 0 ? 1 : C(l), (l & (e.suspendedLanes | t)) !== 0 ? 0 : l;
      }
      function C(e) {
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
      function N(e) {
        return e &= -e, 2 < e ? 8 < e ? (e & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function D(e) {
        if (typeof i0 == "function" && s0(e), Et && typeof Et.setStrictMode == "function")
          try {
            Et.setStrictMode(kl, e);
          } catch {
          }
      }
      function G(e, t) {
        return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
      }
      function $(e) {
        if (to === void 0)
          try {
            throw Error();
          } catch (l) {
            var t = l.stack.trim().match(/\n( *(at )?)/);
            to = t && t[1] || "", gf = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + to + e + gf;
      }
      function q(e, t) {
        if (!e || no) return "";
        no = !0;
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
          var p = o.DetermineComponentFrameRoot(), v = p[0], M = p[1];
          if (v && M) {
            var Y = v.split(`
`), F = M.split(`
`);
            for (u = o = 0; o < Y.length && !Y[o].includes("DetermineComponentFrameRoot"); )
              o++;
            for (; u < F.length && !F[u].includes(
              "DetermineComponentFrameRoot"
            ); )
              u++;
            if (o === Y.length || u === F.length)
              for (o = Y.length - 1, u = F.length - 1; 1 <= o && 0 <= u && Y[o] !== F[u]; )
                u--;
            for (; 1 <= o && 0 <= u; o--, u--)
              if (Y[o] !== F[u]) {
                if (o !== 1 || u !== 1)
                  do
                    if (o--, u--, 0 > u || Y[o] !== F[u]) {
                      var ne = `
` + Y[o].replace(" at new ", " at ");
                      return e.displayName && ne.includes("<anonymous>") && (ne = ne.replace("<anonymous>", e.displayName)), ne;
                    }
                  while (1 <= o && 0 <= u);
                break;
              }
          }
        } finally {
          no = !1, Error.prepareStackTrace = l;
        }
        return (l = e ? e.displayName || e.name : "") ? $(l) : "";
      }
      function X(e, t) {
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
            return q(e.type, !1);
          case 11:
            return q(e.type.render, !1);
          case 1:
            return q(e.type, !0);
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
            t += X(e, l), l = e, e = e.return;
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
          var l = bf.get(e);
          return l !== void 0 ? l : (t = {
            value: e,
            source: t,
            stack: I(t)
          }, bf.set(e, t), t);
        }
        return {
          value: e,
          source: t,
          stack: I(t)
        };
      }
      function V(e, t) {
        Ha[Ua++] = _l, Ha[Ua++] = Rr, Rr = e, _l = t;
      }
      function A(e, t, l) {
        jt[Rt++] = Ft, jt[Rt++] = It, jt[Rt++] = jn, jn = e;
        var o = Ft;
        e = It;
        var u = 32 - St(o) - 1;
        o &= ~(1 << u), l += 1;
        var p = 32 - St(t) + u;
        if (30 < p) {
          var v = u - u % 5;
          p = (o & (1 << v) - 1).toString(32), o >>= v, u -= v, Ft = 1 << 32 - St(t) + u | l << u | o, It = p + e;
        } else
          Ft = 1 << p | l << u | o, It = e;
      }
      function Z(e) {
        e.return !== null && (V(e, 1), A(e, 1, 0));
      }
      function ae(e) {
        for (; e === Rr; )
          Rr = Ha[--Ua], Ha[Ua] = null, _l = Ha[--Ua], Ha[Ua] = null;
        for (; e === jn; )
          jn = jt[--Rt], jt[Rt] = null, It = jt[--Rt], jt[Rt] = null, Ft = jt[--Rt], jt[Rt] = null;
      }
      function oe(e, t) {
        jt[Rt++] = Ft, jt[Rt++] = It, jt[Rt++] = jn, Ft = t.id, It = t.overflow, jn = e;
      }
      function ce(e, t) {
        E(Rn, t), E(Sl, e), E(lt, null), e = Ch(t), S(lt), E(lt, e);
      }
      function ue() {
        S(lt), S(Sl), S(Rn);
      }
      function Ee(e) {
        e.memoizedState !== null && E(Or, e);
        var t = lt.current, l = Ah(t, e.type);
        t !== l && (E(Sl, e), E(lt, l));
      }
      function Ie(e) {
        Sl.current === e && (S(lt), S(Sl)), Or.current === e && (S(Or), fn ? ia._currentValue = Ra : ia._currentValue2 = Ra);
      }
      function he(e) {
        var t = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw ll(Q(t, e)), ao;
      }
      function $n(e, t) {
        if (!ft) throw Error(s(175));
        Ag(
          e.stateNode,
          e.type,
          e.memoizedProps,
          t,
          e
        ) || he(e, !0);
      }
      function Fn(e) {
        for (rt = e.return; rt; )
          switch (rt.tag) {
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
              rt = rt.return;
          }
      }
      function qt(e) {
        if (!ft || e !== rt) return !1;
        if (!Se) return Fn(e), Se = !0, !1;
        var t = e.tag;
        if (We ? t !== 3 && t !== 27 && (t !== 5 || nf(e.type) && !Tr(e.type, e.memoizedProps)) && De && he(e) : t !== 3 && (t !== 5 || nf(e.type) && !Tr(e.type, e.memoizedProps)) && De && he(e), Fn(e), t === 13) {
          if (!ft) throw Error(s(316));
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          De = Dg(e);
        } else if (t === 31) {
          if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(s(317));
          De = Og(e);
        } else
          De = We && t === 27 ? xg(
            e.type,
            De
          ) : rt ? tf(e.stateNode) : null;
        return !0;
      }
      function Gt() {
        ft && (De = rt = null, Se = !1);
      }
      function kn() {
        var e = On;
        return e !== null && (xt === null ? xt = e : xt.push.apply(
          xt,
          e
        ), On = null), e;
      }
      function ll(e) {
        On === null ? On = [e] : On.push(e);
      }
      function _n(e, t, l) {
        fn ? (E(Dr, t._currentValue), t._currentValue = l) : (E(Dr, t._currentValue2), t._currentValue2 = l);
      }
      function rn(e) {
        var t = Dr.current;
        fn ? e._currentValue = t : e._currentValue2 = t, S(Dr);
      }
      function Ui(e, t, l) {
        for (; e !== null; ) {
          var o = e.alternate;
          if ((e.childLanes & t) !== t ? (e.childLanes |= t, o !== null && (o.childLanes |= t)) : o !== null && (o.childLanes & t) !== t && (o.childLanes |= t), e === l) break;
          e = e.return;
        }
      }
      function qi(e, t, l, o) {
        var u = e.child;
        for (u !== null && (u.return = e); u !== null; ) {
          var p = u.dependencies;
          if (p !== null) {
            var v = u.child;
            p = p.firstContext;
            e: for (; p !== null; ) {
              var M = p;
              p = u;
              for (var Y = 0; Y < t.length; Y++)
                if (M.context === t[Y]) {
                  p.lanes |= l, M = p.alternate, M !== null && (M.lanes |= l), Ui(
                    p.return,
                    l,
                    e
                  ), o || (v = null);
                  break e;
                }
              p = M.next;
            }
          } else if (u.tag === 18) {
            if (v = u.return, v === null) throw Error(s(341));
            v.lanes |= l, p = v.alternate, p !== null && (p.lanes |= l), Ui(v, l, e), v = null;
          } else v = u.child;
          if (v !== null) v.return = u;
          else
            for (v = u; v !== null; ) {
              if (v === e) {
                v = null;
                break;
              }
              if (u = v.sibling, u !== null) {
                u.return = v.return, v = u;
                break;
              }
              v = v.return;
            }
          u = v;
        }
      }
      function Ea(e, t, l, o) {
        e = null;
        for (var u = t, p = !1; u !== null; ) {
          if (!p) {
            if ((u.flags & 524288) !== 0) p = !0;
            else if ((u.flags & 262144) !== 0) break;
          }
          if (u.tag === 10) {
            var v = u.alternate;
            if (v === null) throw Error(s(387));
            if (v = v.memoizedProps, v !== null) {
              var M = u.type;
              zt(u.pendingProps.value, v.value) || (e !== null ? e.push(M) : e = [M]);
            }
          } else if (u === Or.current) {
            if (v = u.alternate, v === null) throw Error(s(387));
            v.memoizedState.memoizedState !== u.memoizedState.memoizedState && (e !== null ? e.push(ia) : e = [ia]);
          }
          u = u.return;
        }
        e !== null && qi(
          t,
          e,
          l,
          o
        ), t.flags |= 262144;
      }
      function Fl(e) {
        for (e = e.firstContext; e !== null; ) {
          var t = e.context;
          if (!zt(
            fn ? t._currentValue : t._currentValue2,
            e.memoizedValue
          ))
            return !0;
          e = e.next;
        }
        return !1;
      }
      function In(e) {
        sa = e, mn = null, e = e.dependencies, e !== null && (e.firstContext = null);
      }
      function nt(e) {
        return Cc(sa, e);
      }
      function Il(e, t) {
        return sa === null && In(e), Cc(e, t);
      }
      function Cc(e, t) {
        var l = fn ? t._currentValue : t._currentValue2;
        if (t = { context: t, memoizedValue: l, next: null }, mn === null) {
          if (e === null) throw Error(s(308));
          mn = t, e.dependencies = { lanes: 0, firstContext: t }, e.flags |= 524288;
        } else mn = mn.next = t;
        return l;
      }
      function Gi() {
        return {
          controller: new c0(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function rl(e) {
        e.refCount--, e.refCount === 0 && u0(d0, function() {
          e.controller.abort();
        });
      }
      function Pl() {
      }
      function Jt(e) {
        e !== qa && e.next === null && (qa === null ? Br = qa = e : qa = qa.next = e), Hr = !0, lo || (lo = !0, Fm());
      }
      function za(e, t) {
        if (!ro && Hr) {
          ro = !0;
          do
            for (var l = !1, o = Br; o !== null; ) {
              if (e !== 0) {
                var u = o.pendingLanes;
                if (u === 0) var p = 0;
                else {
                  var v = o.suspendedLanes, M = o.pingedLanes;
                  p = (1 << 31 - St(42 | e) + 1) - 1, p &= u & ~(v & ~M), p = p & 201326741 ? p & 201326741 | 1 : p ? p | 2 : 0;
                }
                p !== 0 && (l = !0, Oc(o, p));
              } else
                p = ke, p = j(
                  o,
                  o === Re ? p : 0,
                  o.cancelPendingCommit !== null || o.timeoutHandle !== ra
                ), (p & 3) === 0 || O(o, p) || (l = !0, Oc(o, p));
              o = o.next;
            }
          while (l);
          ro = !1;
        }
      }
      function Ac() {
        Mc();
      }
      function Mc() {
        Hr = lo = !1;
        var e = 0;
        oa !== 0 && qh() && (e = oa);
        for (var t = vt(), l = null, o = Br; o !== null; ) {
          var u = o.next, p = jc(o, t);
          p === 0 ? (o.next = null, l === null ? Br = u : l.next = u, u === null && (qa = l)) : (l = o, (e !== 0 || (p & 3) !== 0) && (Hr = !0)), o = u;
        }
        $e !== 0 && $e !== 5 || za(e), oa !== 0 && (oa = 0);
      }
      function jc(e, t) {
        for (var l = e.suspendedLanes, o = e.pingedLanes, u = e.expirationTimes, p = e.pendingLanes & -62914561; 0 < p; ) {
          var v = 31 - St(p), M = 1 << v, Y = u[v];
          Y === -1 ? ((M & l) === 0 || (M & o) !== 0) && (u[v] = H(M, t)) : Y <= t && (e.expiredLanes |= M), p &= ~M;
        }
        if (t = Re, l = ke, l = j(
          e,
          e === t ? l : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ra
        ), o = e.callbackNode, l === 0 || e === t && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null)
          return o !== null && o !== null && Ps(o), e.callbackNode = null, e.callbackPriority = 0;
        if ((l & 3) === 0 || O(e, l)) {
          if (t = l & -l, t === e.callbackPriority) return t;
          switch (o !== null && Ps(o), N(l)) {
            case 2:
            case 8:
              l = l0;
              break;
            case 32:
              l = eo;
              break;
            case 268435456:
              l = r0;
              break;
            default:
              l = eo;
          }
          return o = Rc.bind(null, e), l = jr(l, o), e.callbackPriority = t, e.callbackNode = l, t;
        }
        return o !== null && o !== null && Ps(o), e.callbackPriority = 2, e.callbackNode = null, 2;
      }
      function Rc(e, t) {
        if ($e !== 0 && $e !== 5)
          return e.callbackNode = null, e.callbackPriority = 0, null;
        var l = e.callbackNode;
        if (vl() && e.callbackNode !== l)
          return null;
        var o = ke;
        return o = j(
          e,
          e === Re ? o : 0,
          e.cancelPendingCommit !== null || e.timeoutHandle !== ra
        ), o === 0 ? null : (gd(e, o, t), jc(e, vt()), e.callbackNode != null && e.callbackNode === l ? Rc.bind(null, e) : null);
      }
      function Oc(e, t) {
        if (vl()) return null;
        gd(e, t, !0);
      }
      function Fm() {
        Kh ? Zh(function() {
          (xe & 6) !== 0 ? jr(
            mf,
            Ac
          ) : Mc();
        }) : jr(
          mf,
          Ac
        );
      }
      function Li() {
        if (oa === 0) {
          var e = Ga;
          e === 0 && (e = Cr, Cr <<= 1, (Cr & 261888) === 0 && (Cr = 256)), oa = e;
        }
        return oa;
      }
      function Im(e, t) {
        if (El === null) {
          var l = El = [];
          io = 0, Ga = Li(), La = {
            status: "pending",
            value: void 0,
            then: function(o) {
              l.push(o);
            }
          };
        }
        return io++, t.then(Dc, Dc), t;
      }
      function Dc() {
        if (--io === 0 && El !== null) {
          La !== null && (La.status = "fulfilled");
          var e = El;
          El = null, Ga = 0, La = null;
          for (var t = 0; t < e.length; t++) (0, e[t])();
        }
      }
      function Pm(e, t) {
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
      function Yi() {
        var e = ca.current;
        return e !== null ? e : Re.pooledCache;
      }
      function er(e, t) {
        t === null ? E(ca, ca.current) : E(ca, t.pool);
      }
      function Bc() {
        var e = Yi();
        return e === null ? null : {
          parent: fn ? Be._currentValue : Be._currentValue2,
          pool: e
        };
      }
      function tr(e, t) {
        if (zt(e, t)) return !0;
        if (typeof e != "object" || e === null || typeof t != "object" || t === null)
          return !1;
        var l = Object.keys(e), o = Object.keys(t);
        if (l.length !== o.length) return !1;
        for (o = 0; o < l.length; o++) {
          var u = l[o];
          if (!o0.call(t, u) || !zt(e[u], t[u]))
            return !1;
        }
        return !0;
      }
      function Hc(e) {
        return e = e.status, e === "fulfilled" || e === "rejected";
      }
      function Uc(e, t, l) {
        switch (l = e[l], l === void 0 ? e.push(t) : l !== t && (t.then(Pl, Pl), t = l), t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, Gc(e), e;
          default:
            if (typeof t.status == "string") t.then(Pl, Pl);
            else {
              if (e = Re, e !== null && 100 < e.shellSuspendCounter)
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
                throw e = t.reason, Gc(e), e;
            }
            throw ua = t, Ya;
        }
      }
      function Pn(e) {
        try {
          var t = e._init;
          return t(e._payload);
        } catch (l) {
          throw l !== null && typeof l == "object" && typeof l.then == "function" ? (ua = l, Ya) : l;
        }
      }
      function qc() {
        if (ua === null) throw Error(s(459));
        var e = ua;
        return ua = null, e;
      }
      function Gc(e) {
        if (e === Ya || e === Ur)
          throw Error(s(483));
      }
      function nr(e) {
        var t = zl;
        return zl += 1, Qa === null && (Qa = []), Uc(Qa, e, t);
      }
      function il(e, t) {
        t = t.props.ref, e.ref = t !== void 0 ? t : null;
      }
      function ar(e, t) {
        throw t.$$typeof === Sh ? Error(s(525)) : (e = Object.prototype.toString.call(t), Error(
          s(
            31,
            e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e
          )
        ));
      }
      function Lc(e) {
        function t(U, B) {
          if (e) {
            var L = U.deletions;
            L === null ? (U.deletions = [B], U.flags |= 16) : L.push(B);
          }
        }
        function l(U, B) {
          if (!e) return null;
          for (; B !== null; )
            t(U, B), B = B.sibling;
          return null;
        }
        function o(U) {
          for (var B = /* @__PURE__ */ new Map(); U !== null; )
            U.key !== null ? B.set(U.key, U) : B.set(U.index, U), U = U.sibling;
          return B;
        }
        function u(U, B) {
          return U = dn(U, B), U.index = 0, U.sibling = null, U;
        }
        function p(U, B, L) {
          return U.index = L, e ? (L = U.alternate, L !== null ? (L = L.index, L < B ? (U.flags |= 67108866, B) : L) : (U.flags |= 67108866, B)) : (U.flags |= 1048576, B);
        }
        function v(U) {
          return e && U.alternate === null && (U.flags |= 67108866), U;
        }
        function M(U, B, L, ee) {
          return B === null || B.tag !== 6 ? (B = Hs(L, U.mode, ee), B.return = U, B) : (B = u(B, L), B.return = U, B);
        }
        function Y(U, B, L, ee) {
          var fe = L.type;
          return fe === ja ? ne(
            U,
            B,
            L.props.children,
            ee,
            L.key
          ) : B !== null && (B.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === Mn && Pn(fe) === B.type) ? (B = u(B, L.props), il(B, L), B.return = U, B) : (B = Er(
            L.type,
            L.key,
            L.props,
            null,
            U.mode,
            ee
          ), il(B, L), B.return = U, B);
        }
        function F(U, B, L, ee) {
          return B === null || B.tag !== 4 || B.stateNode.containerInfo !== L.containerInfo || B.stateNode.implementation !== L.implementation ? (B = Us(L, U.mode, ee), B.return = U, B) : (B = u(B, L.children || []), B.return = U, B);
        }
        function ne(U, B, L, ee, fe) {
          return B === null || B.tag !== 7 ? (B = la(
            L,
            U.mode,
            ee,
            fe
          ), B.return = U, B) : (B = u(B, L), B.return = U, B);
        }
        function P(U, B, L) {
          if (typeof B == "string" && B !== "" || typeof B == "number" || typeof B == "bigint")
            return B = Hs(
              "" + B,
              U.mode,
              L
            ), B.return = U, B;
          if (typeof B == "object" && B !== null) {
            switch (B.$$typeof) {
              case zr:
                return L = Er(
                  B.type,
                  B.key,
                  B.props,
                  null,
                  U.mode,
                  L
                ), il(L, B), L.return = U, L;
              case Ma:
                return B = Us(
                  B,
                  U.mode,
                  L
                ), B.return = U, B;
              case Mn:
                return B = Pn(B), P(U, B, L);
            }
            if (Nr(B) || x(B))
              return B = la(
                B,
                U.mode,
                L,
                null
              ), B.return = U, B;
            if (typeof B.then == "function")
              return P(U, nr(B), L);
            if (B.$$typeof === An)
              return P(
                U,
                Il(U, B),
                L
              );
            ar(U, B);
          }
          return null;
        }
        function le(U, B, L, ee) {
          var fe = B !== null ? B.key : null;
          if (typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint")
            return fe !== null ? null : M(U, B, "" + L, ee);
          if (typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case zr:
                return L.key === fe ? Y(U, B, L, ee) : null;
              case Ma:
                return L.key === fe ? F(U, B, L, ee) : null;
              case Mn:
                return L = Pn(L), le(U, B, L, ee);
            }
            if (Nr(L) || x(L))
              return fe !== null ? null : ne(U, B, L, ee, null);
            if (typeof L.then == "function")
              return le(
                U,
                B,
                nr(L),
                ee
              );
            if (L.$$typeof === An)
              return le(
                U,
                B,
                Il(U, L),
                ee
              );
            ar(U, L);
          }
          return null;
        }
        function ge(U, B, L, ee, fe) {
          if (typeof ee == "string" && ee !== "" || typeof ee == "number" || typeof ee == "bigint")
            return U = U.get(L) || null, M(B, U, "" + ee, fe);
          if (typeof ee == "object" && ee !== null) {
            switch (ee.$$typeof) {
              case zr:
                return U = U.get(
                  ee.key === null ? L : ee.key
                ) || null, Y(B, U, ee, fe);
              case Ma:
                return U = U.get(
                  ee.key === null ? L : ee.key
                ) || null, F(B, U, ee, fe);
              case Mn:
                return ee = Pn(ee), ge(
                  U,
                  B,
                  L,
                  ee,
                  fe
                );
            }
            if (Nr(ee) || x(ee))
              return U = U.get(L) || null, ne(B, U, ee, fe, null);
            if (typeof ee.then == "function")
              return ge(
                U,
                B,
                L,
                nr(ee),
                fe
              );
            if (ee.$$typeof === An)
              return ge(
                U,
                B,
                L,
                Il(B, ee),
                fe
              );
            ar(B, ee);
          }
          return null;
        }
        function it(U, B, L, ee) {
          for (var fe = null, He = null, pe = B, Te = B = 0, tt = null; pe !== null && Te < L.length; Te++) {
            pe.index > Te ? (tt = pe, pe = null) : tt = pe.sibling;
            var Ce = le(
              U,
              pe,
              L[Te],
              ee
            );
            if (Ce === null) {
              pe === null && (pe = tt);
              break;
            }
            e && pe && Ce.alternate === null && t(U, pe), B = p(Ce, B, Te), He === null ? fe = Ce : He.sibling = Ce, He = Ce, pe = tt;
          }
          if (Te === L.length)
            return l(U, pe), Se && V(U, Te), fe;
          if (pe === null) {
            for (; Te < L.length; Te++)
              pe = P(U, L[Te], ee), pe !== null && (B = p(
                pe,
                B,
                Te
              ), He === null ? fe = pe : He.sibling = pe, He = pe);
            return Se && V(U, Te), fe;
          }
          for (pe = o(pe); Te < L.length; Te++)
            tt = ge(
              pe,
              U,
              Te,
              L[Te],
              ee
            ), tt !== null && (e && tt.alternate !== null && pe.delete(
              tt.key === null ? Te : tt.key
            ), B = p(
              tt,
              B,
              Te
            ), He === null ? fe = tt : He.sibling = tt, He = tt);
          return e && pe.forEach(function(Gn) {
            return t(U, Gn);
          }), Se && V(U, Te), fe;
        }
        function Rl(U, B, L, ee) {
          if (L == null) throw Error(s(151));
          for (var fe = null, He = null, pe = B, Te = B = 0, tt = null, Ce = L.next(); pe !== null && !Ce.done; Te++, Ce = L.next()) {
            pe.index > Te ? (tt = pe, pe = null) : tt = pe.sibling;
            var Gn = le(U, pe, Ce.value, ee);
            if (Gn === null) {
              pe === null && (pe = tt);
              break;
            }
            e && pe && Gn.alternate === null && t(U, pe), B = p(Gn, B, Te), He === null ? fe = Gn : He.sibling = Gn, He = Gn, pe = tt;
          }
          if (Ce.done)
            return l(U, pe), Se && V(U, Te), fe;
          if (pe === null) {
            for (; !Ce.done; Te++, Ce = L.next())
              Ce = P(U, Ce.value, ee), Ce !== null && (B = p(
                Ce,
                B,
                Te
              ), He === null ? fe = Ce : He.sibling = Ce, He = Ce);
            return Se && V(U, Te), fe;
          }
          for (pe = o(pe); !Ce.done; Te++, Ce = L.next())
            Ce = ge(
              pe,
              U,
              Te,
              Ce.value,
              ee
            ), Ce !== null && (e && Ce.alternate !== null && pe.delete(Ce.key === null ? Te : Ce.key), B = p(Ce, B, Te), He === null ? fe = Ce : He.sibling = Ce, He = Ce);
          return e && pe.forEach(function(h0) {
            return t(U, h0);
          }), Se && V(U, Te), fe;
        }
        function ma(U, B, L, ee) {
          if (typeof L == "object" && L !== null && L.type === ja && L.key === null && (L = L.props.children), typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case zr:
                e: {
                  for (var fe = L.key; B !== null; ) {
                    if (B.key === fe) {
                      if (fe = L.type, fe === ja) {
                        if (B.tag === 7) {
                          l(
                            U,
                            B.sibling
                          ), ee = u(
                            B,
                            L.props.children
                          ), ee.return = U, U = ee;
                          break e;
                        }
                      } else if (B.elementType === fe || typeof fe == "object" && fe !== null && fe.$$typeof === Mn && Pn(fe) === B.type) {
                        l(
                          U,
                          B.sibling
                        ), ee = u(B, L.props), il(ee, L), ee.return = U, U = ee;
                        break e;
                      }
                      l(U, B);
                      break;
                    } else t(U, B);
                    B = B.sibling;
                  }
                  L.type === ja ? (ee = la(
                    L.props.children,
                    U.mode,
                    ee,
                    L.key
                  ), ee.return = U, U = ee) : (ee = Er(
                    L.type,
                    L.key,
                    L.props,
                    null,
                    U.mode,
                    ee
                  ), il(ee, L), ee.return = U, U = ee);
                }
                return v(U);
              case Ma:
                e: {
                  for (fe = L.key; B !== null; ) {
                    if (B.key === fe)
                      if (B.tag === 4 && B.stateNode.containerInfo === L.containerInfo && B.stateNode.implementation === L.implementation) {
                        l(
                          U,
                          B.sibling
                        ), ee = u(
                          B,
                          L.children || []
                        ), ee.return = U, U = ee;
                        break e;
                      } else {
                        l(U, B);
                        break;
                      }
                    else t(U, B);
                    B = B.sibling;
                  }
                  ee = Us(L, U.mode, ee), ee.return = U, U = ee;
                }
                return v(U);
              case Mn:
                return L = Pn(L), ma(
                  U,
                  B,
                  L,
                  ee
                );
            }
            if (Nr(L))
              return it(
                U,
                B,
                L,
                ee
              );
            if (x(L)) {
              if (fe = x(L), typeof fe != "function")
                throw Error(s(150));
              return L = fe.call(L), Rl(
                U,
                B,
                L,
                ee
              );
            }
            if (typeof L.then == "function")
              return ma(
                U,
                B,
                nr(L),
                ee
              );
            if (L.$$typeof === An)
              return ma(
                U,
                B,
                Il(U, L),
                ee
              );
            ar(U, L);
          }
          return typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint" ? (L = "" + L, B !== null && B.tag === 6 ? (l(U, B.sibling), ee = u(B, L), ee.return = U, U = ee) : (l(U, B), ee = Hs(L, U.mode, ee), ee.return = U, U = ee), v(U)) : l(U, B);
        }
        return function(U, B, L, ee) {
          try {
            zl = 0;
            var fe = ma(
              U,
              B,
              L,
              ee
            );
            return Qa = null, fe;
          } catch (pe) {
            if (pe === Ya || pe === Ur) throw pe;
            var He = r(29, pe, null, U.mode);
            return He.lanes = ee, He.return = U, He;
          } finally {
          }
        };
      }
      function lr() {
        for (var e = Va, t = oo = Va = 0; t < e; ) {
          var l = Dt[t];
          Dt[t++] = null;
          var o = Dt[t];
          Dt[t++] = null;
          var u = Dt[t];
          Dt[t++] = null;
          var p = Dt[t];
          if (Dt[t++] = null, o !== null && u !== null) {
            var v = o.pending;
            v === null ? u.next = u : (u.next = v.next, v.next = u), o.pending = u;
          }
          p !== 0 && Yc(l, u, p);
        }
      }
      function rr(e, t, l, o) {
        Dt[Va++] = e, Dt[Va++] = t, Dt[Va++] = l, Dt[Va++] = o, oo |= o, e.lanes |= o, e = e.alternate, e !== null && (e.lanes |= o);
      }
      function Qi(e, t, l, o) {
        return rr(e, t, l, o), ir(e);
      }
      function ea(e, t) {
        return rr(e, null, null, t), ir(e);
      }
      function Yc(e, t, l) {
        e.lanes |= l;
        var o = e.alternate;
        o !== null && (o.lanes |= l);
        for (var u = !1, p = e.return; p !== null; )
          p.childLanes |= l, o = p.alternate, o !== null && (o.childLanes |= l), p.tag === 22 && (e = p.stateNode, e === null || e._visibility & 1 || (u = !0)), e = p, p = p.return;
        return e.tag === 3 ? (p = e.stateNode, u && t !== null && (u = 31 - St(l), e = p.hiddenUpdates, o = e[u], o === null ? e[u] = [t] : o.push(t), t.lane = l | 536870912), p) : null;
      }
      function ir(e) {
        if (50 < jl)
          throw jl = 0, wo = null, Error(s(185));
        for (var t = e.return; t !== null; )
          e = t, t = e.return;
        return e.tag === 3 ? e.stateNode : null;
      }
      function Vi(e) {
        e.updateQueue = {
          baseState: e.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Xi(e, t) {
        e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
          baseState: e.baseState,
          firstBaseUpdate: e.firstBaseUpdate,
          lastBaseUpdate: e.lastBaseUpdate,
          shared: e.shared,
          callbacks: null
        });
      }
      function Sn(e) {
        return { lane: e, tag: 0, payload: null, callback: null, next: null };
      }
      function En(e, t, l) {
        var o = e.updateQueue;
        if (o === null) return null;
        if (o = o.shared, (xe & 2) !== 0) {
          var u = o.pending;
          return u === null ? t.next = t : (t.next = u.next, u.next = t), o.pending = t, t = ir(e), Yc(e, null, l), t;
        }
        return rr(e, o, t, l), ir(e);
      }
      function sl(e, t, l) {
        if (t = t.updateQueue, t !== null && (t = t.shared, (l & 4194048) !== 0)) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, k(e, l);
        }
      }
      function Ki(e, t) {
        var l = e.updateQueue, o = e.alternate;
        if (o !== null && (o = o.updateQueue, l === o)) {
          var u = null, p = null;
          if (l = l.firstBaseUpdate, l !== null) {
            do {
              var v = {
                lane: l.lane,
                tag: l.tag,
                payload: l.payload,
                callback: null,
                next: null
              };
              p === null ? u = p = v : p = p.next = v, l = l.next;
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
      function ol() {
        if (co) {
          var e = La;
          if (e !== null) throw e;
        }
      }
      function cl(e, t, l, o) {
        co = !1;
        var u = e.updateQueue;
        Dn = !1;
        var p = u.firstBaseUpdate, v = u.lastBaseUpdate, M = u.shared.pending;
        if (M !== null) {
          u.shared.pending = null;
          var Y = M, F = Y.next;
          Y.next = null, v === null ? p = F : v.next = F, v = Y;
          var ne = e.alternate;
          ne !== null && (ne = ne.updateQueue, M = ne.lastBaseUpdate, M !== v && (M === null ? ne.firstBaseUpdate = F : M.next = F, ne.lastBaseUpdate = Y));
        }
        if (p !== null) {
          var P = u.baseState;
          v = 0, ne = F = Y = null, M = p;
          do {
            var le = M.lane & -536870913, ge = le !== M.lane;
            if (ge ? (ke & le) === le : (o & le) === le) {
              le !== 0 && le === Ga && (co = !0), ne !== null && (ne = ne.next = {
                lane: 0,
                tag: M.tag,
                payload: M.payload,
                callback: null,
                next: null
              });
              e: {
                var it = e, Rl = M;
                le = t;
                var ma = l;
                switch (Rl.tag) {
                  case 1:
                    if (it = Rl.payload, typeof it == "function") {
                      P = it.call(
                        ma,
                        P,
                        le
                      );
                      break e;
                    }
                    P = it;
                    break e;
                  case 3:
                    it.flags = it.flags & -65537 | 128;
                  case 0:
                    if (it = Rl.payload, le = typeof it == "function" ? it.call(ma, P, le) : it, le == null) break e;
                    P = Gs({}, P, le);
                    break e;
                  case 2:
                    Dn = !0;
                }
              }
              le = M.callback, le !== null && (e.flags |= 64, ge && (e.flags |= 8192), ge = u.callbacks, ge === null ? u.callbacks = [le] : ge.push(le));
            } else
              ge = {
                lane: le,
                tag: M.tag,
                payload: M.payload,
                callback: M.callback,
                next: null
              }, ne === null ? (F = ne = ge, Y = P) : ne = ne.next = ge, v |= le;
            if (M = M.next, M === null) {
              if (M = u.shared.pending, M === null)
                break;
              ge = M, M = ge.next, ge.next = null, u.lastBaseUpdate = ge, u.shared.pending = null;
            }
          } while (!0);
          ne === null && (Y = P), u.baseState = Y, u.firstBaseUpdate = F, u.lastBaseUpdate = ne, p === null && (u.shared.lanes = 0), Hn |= v, e.lanes = v, e.memoizedState = P;
        }
      }
      function Qc(e, t) {
        if (typeof e != "function")
          throw Error(s(191, e));
        e.call(t);
      }
      function Vc(e, t) {
        var l = e.callbacks;
        if (l !== null)
          for (e.callbacks = null, e = 0; e < l.length; e++)
            Qc(l[e], t);
      }
      function Xc(e, t) {
        e = bn, E(Gr, e), E(Xa, t), bn = e | t.baseLanes;
      }
      function Zi() {
        E(Gr, bn), E(Xa, Xa.current);
      }
      function Ji() {
        bn = Gr.current, S(Xa), S(Gr);
      }
      function zn(e) {
        var t = e.alternate;
        E(Ye, Ye.current & 1), E(Nt, e), Bt === null && (t === null || Xa.current !== null || t.memoizedState !== null) && (Bt = e);
      }
      function Wi(e) {
        E(Ye, Ye.current), E(Nt, e), Bt === null && (Bt = e);
      }
      function Kc(e) {
        e.tag === 22 ? (E(Ye, Ye.current), E(Nt, e), Bt === null && (Bt = e)) : Nn();
      }
      function Nn() {
        E(Ye, Ye.current), E(Nt, Nt.current);
      }
      function wt(e) {
        S(Nt), Bt === e && (Bt = null), S(Ye);
      }
      function sr(e) {
        for (var t = e; t !== null; ) {
          if (t.tag === 13) {
            var l = t.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || Ws(l) || $s(l)))
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
      function $i(e, t) {
        if (t === null) return !1;
        for (var l = 0; l < t.length && l < e.length; l++)
          if (!zt(e[l], t[l])) return !1;
        return !0;
      }
      function Fi(e, t, l, o, u, p) {
        return hn = p, be = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, de.H = e === null || e.memoizedState === null ? xf : uo, fa = !1, p = l(o, u), fa = !1, Ka && (p = Jc(
          t,
          l,
          o,
          u
        )), Zc(e), p;
      }
      function Zc(e) {
        de.H = Tl;
        var t = Me !== null && Me.next !== null;
        if (hn = 0, Qe = Me = be = null, Lr = !1, Nl = 0, Za = null, t) throw Error(s(300));
        e === null || Ve || (e = e.dependencies, e !== null && Fl(e) && (Ve = !0));
      }
      function Jc(e, t, l, o) {
        be = e;
        var u = 0;
        do {
          if (Ka && (Za = null), Nl = 0, Ka = !1, 25 <= u) throw Error(s(301));
          if (u += 1, Qe = Me = null, e.updateQueue != null) {
            var p = e.updateQueue;
            p.lastEffect = null, p.events = null, p.stores = null, p.memoCache != null && (p.memoCache.index = 0);
          }
          de.H = wf, p = t(l, o);
        } while (Ka);
        return p;
      }
      function eh() {
        var e = de.H, t = e.useState()[0];
        return t = typeof t.then == "function" ? ul(t) : t, e = e.useState()[0], (Me !== null ? Me.memoizedState : null) !== e && (be.flags |= 1024), t;
      }
      function Ii() {
        var e = Yr !== 0;
        return Yr = 0, e;
      }
      function Pi(e, t, l) {
        t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l;
      }
      function es(e) {
        if (Lr) {
          for (e = e.memoizedState; e !== null; ) {
            var t = e.queue;
            t !== null && (t.pending = null), e = e.next;
          }
          Lr = !1;
        }
        hn = 0, Qe = Me = be = null, Ka = !1, Nl = Yr = 0, Za = null;
      }
      function ht() {
        var e = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Qe === null ? be.memoizedState = Qe = e : Qe = Qe.next = e, Qe;
      }
      function Le() {
        if (Me === null) {
          var e = be.alternate;
          e = e !== null ? e.memoizedState : null;
        } else e = Me.next;
        var t = Qe === null ? be.memoizedState : Qe.next;
        if (t !== null)
          Qe = t, Me = e;
        else {
          if (e === null)
            throw be.alternate === null ? Error(s(467)) : Error(s(310));
          Me = e, e = {
            memoizedState: Me.memoizedState,
            baseState: Me.baseState,
            baseQueue: Me.baseQueue,
            queue: Me.queue,
            next: null
          }, Qe === null ? be.memoizedState = Qe = e : Qe = Qe.next = e;
        }
        return Qe;
      }
      function or() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function ul(e) {
        var t = Nl;
        return Nl += 1, Za === null && (Za = []), e = Uc(Za, e, t), t = be, (Qe === null ? t.memoizedState : Qe.next) === null && (t = t.alternate, de.H = t === null || t.memoizedState === null ? xf : uo), e;
      }
      function cr(e) {
        if (e !== null && typeof e == "object") {
          if (typeof e.then == "function") return ul(e);
          if (e.$$typeof === An) return nt(e);
        }
        throw Error(s(438, String(e)));
      }
      function ts(e) {
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
        if (t == null && (t = { data: [], index: 0 }), l === null && (l = or(), be.updateQueue = l), l.memoCache = t, l = t.data[t.index], l === void 0)
          for (l = t.data[t.index] = Array(e), o = 0; o < e; o++)
            l[o] = Eh;
        return t.index++, l;
      }
      function sn(e, t) {
        return typeof t == "function" ? t(e) : t;
      }
      function ur(e) {
        var t = Le();
        return ns(t, Me, e);
      }
      function ns(e, t, l) {
        var o = e.queue;
        if (o === null) throw Error(s(311));
        o.lastRenderedReducer = l;
        var u = e.baseQueue, p = o.pending;
        if (p !== null) {
          if (u !== null) {
            var v = u.next;
            u.next = p.next, p.next = v;
          }
          t.baseQueue = u = p, o.pending = null;
        }
        if (p = e.baseState, u === null) e.memoizedState = p;
        else {
          t = u.next;
          var M = v = null, Y = null, F = t, ne = !1;
          do {
            var P = F.lane & -536870913;
            if (P !== F.lane ? (ke & P) === P : (hn & P) === P) {
              var le = F.revertLane;
              if (le === 0)
                Y !== null && (Y = Y.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: F.action,
                  hasEagerState: F.hasEagerState,
                  eagerState: F.eagerState,
                  next: null
                }), P === Ga && (ne = !0);
              else if ((hn & le) === le) {
                F = F.next, le === Ga && (ne = !0);
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
                }, Y === null ? (M = Y = P, v = p) : Y = Y.next = P, be.lanes |= le, Hn |= le;
              P = F.action, fa && l(p, P), p = F.hasEagerState ? F.eagerState : l(p, P);
            } else
              le = {
                lane: P,
                revertLane: F.revertLane,
                gesture: F.gesture,
                action: F.action,
                hasEagerState: F.hasEagerState,
                eagerState: F.eagerState,
                next: null
              }, Y === null ? (M = Y = le, v = p) : Y = Y.next = le, be.lanes |= P, Hn |= P;
            F = F.next;
          } while (F !== null && F !== t);
          if (Y === null ? v = p : Y.next = M, !zt(p, e.memoizedState) && (Ve = !0, ne && (l = La, l !== null)))
            throw l;
          e.memoizedState = p, e.baseState = v, e.baseQueue = Y, o.lastRenderedState = p;
        }
        return u === null && (o.lanes = 0), [e.memoizedState, o.dispatch];
      }
      function as(e) {
        var t = Le(), l = t.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = e;
        var o = l.dispatch, u = l.pending, p = t.memoizedState;
        if (u !== null) {
          l.pending = null;
          var v = u = u.next;
          do
            p = e(p, v.action), v = v.next;
          while (v !== u);
          zt(p, t.memoizedState) || (Ve = !0), t.memoizedState = p, t.baseQueue === null && (t.baseState = p), l.lastRenderedState = p;
        }
        return [p, o];
      }
      function Wc(e, t, l) {
        var o = be, u = Le(), p = Se;
        if (p) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = t();
        var v = !zt(
          (Me || u).memoizedState,
          l
        );
        if (v && (u.memoizedState = l, Ve = !0), u = u.queue, is(Ic.bind(null, o, u, e), [
          e
        ]), u.getSnapshot !== t || v || Qe !== null && Qe.memoizedState.tag & 1) {
          if (o.flags |= 2048, Na(
            9,
            { destroy: void 0 },
            Fc.bind(
              null,
              o,
              u,
              l,
              t
            ),
            null
          ), Re === null) throw Error(s(349));
          p || (hn & 127) !== 0 || $c(o, t, l);
        }
        return l;
      }
      function $c(e, t, l) {
        e.flags |= 16384, e = { getSnapshot: t, value: l }, t = be.updateQueue, t === null ? (t = or(), be.updateQueue = t, t.stores = [e]) : (l = t.stores, l === null ? t.stores = [e] : l.push(e));
      }
      function Fc(e, t, l, o) {
        t.value = l, t.getSnapshot = o, Pc(t) && eu(e);
      }
      function Ic(e, t, l) {
        return l(function() {
          Pc(t) && eu(e);
        });
      }
      function Pc(e) {
        var t = e.getSnapshot;
        e = e.value;
        try {
          var l = t();
          return !zt(e, l);
        } catch {
          return !0;
        }
      }
      function eu(e) {
        var t = ea(e, 2);
        t !== null && bt(t, e, 2);
      }
      function ls(e) {
        var t = ht();
        if (typeof e == "function") {
          var l = e;
          if (e = l(), fa) {
            D(!0);
            try {
              l();
            } finally {
              D(!1);
            }
          }
        }
        return t.memoizedState = t.baseState = e, t.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: sn,
          lastRenderedState: e
        }, t;
      }
      function tu(e, t, l, o) {
        return e.baseState = l, ns(
          e,
          Me,
          typeof o == "function" ? o : sn
        );
      }
      function th(e, t, l, o, u) {
        if (pr(e)) throw Error(s(485));
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
            then: function(v) {
              p.listeners.push(v);
            }
          };
          de.T !== null ? l(!0) : p.isTransition = !1, o(p), l = t.pending, l === null ? (p.next = t.pending = p, nu(t, p)) : (p.next = l.next, t.pending = l.next = p);
        }
      }
      function nu(e, t) {
        var l = t.action, o = t.payload, u = e.state;
        if (t.isTransition) {
          var p = de.T, v = {};
          de.T = v;
          try {
            var M = l(u, o), Y = de.S;
            Y !== null && Y(v, M), au(e, t, M);
          } catch (F) {
            rs(e, t, F);
          } finally {
            p !== null && v.types !== null && (p.types = v.types), de.T = p;
          }
        } else
          try {
            p = l(u, o), au(e, t, p);
          } catch (F) {
            rs(e, t, F);
          }
      }
      function au(e, t, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(o) {
            lu(e, t, o);
          },
          function(o) {
            return rs(e, t, o);
          }
        ) : lu(e, t, l);
      }
      function lu(e, t, l) {
        t.status = "fulfilled", t.value = l, ru(t), e.state = l, t = e.pending, t !== null && (l = t.next, l === t ? e.pending = null : (l = l.next, t.next = l, nu(e, l)));
      }
      function rs(e, t, l) {
        var o = e.pending;
        if (e.pending = null, o !== null) {
          o = o.next;
          do
            t.status = "rejected", t.reason = l, ru(t), t = t.next;
          while (t !== o);
        }
        e.action = null;
      }
      function ru(e) {
        e = e.listeners;
        for (var t = 0; t < e.length; t++) (0, e[t])();
      }
      function iu(e, t) {
        return t;
      }
      function su(e, t) {
        if (Se) {
          var l = Re.formState;
          if (l !== null) {
            e: {
              var o = be;
              if (Se) {
                if (De) {
                  var u = vg(
                    De,
                    Ot
                  );
                  if (u) {
                    De = tf(u), o = yg(u);
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
          lastRenderedReducer: iu,
          lastRenderedState: t
        }, l.queue = o, l = Eu.bind(
          null,
          be,
          o
        ), o.dispatch = l, o = ls(!1);
        var p = us.bind(
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
        }, o.queue = u, l = th.bind(
          null,
          be,
          u,
          p,
          l
        ), u.dispatch = l, o.memoizedState = e, [t, l, !1];
      }
      function ou(e) {
        var t = Le();
        return cu(t, Me, e);
      }
      function cu(e, t, l) {
        if (t = ns(
          e,
          t,
          iu
        )[0], e = ur(sn)[0], typeof t == "object" && t !== null && typeof t.then == "function")
          try {
            var o = ul(t);
          } catch (v) {
            throw v === Ya ? Ur : v;
          }
        else o = t;
        t = Le();
        var u = t.queue, p = u.dispatch;
        return l !== t.memoizedState && (be.flags |= 2048, Na(
          9,
          { destroy: void 0 },
          nh.bind(null, u, l),
          null
        )), [o, p, e];
      }
      function nh(e, t) {
        e.action = t;
      }
      function uu(e) {
        var t = Le(), l = Me;
        if (l !== null)
          return cu(t, l, e);
        Le(), t = t.memoizedState, l = Le();
        var o = l.queue.dispatch;
        return l.memoizedState = e, [t, o, !1];
      }
      function Na(e, t, l, o) {
        return e = { tag: e, create: l, deps: o, inst: t, next: null }, t = be.updateQueue, t === null && (t = or(), be.updateQueue = t), l = t.lastEffect, l === null ? t.lastEffect = e.next = e : (o = l.next, l.next = e, e.next = o, t.lastEffect = e), e;
      }
      function du() {
        return Le().memoizedState;
      }
      function dr(e, t, l, o) {
        var u = ht();
        be.flags |= e, u.memoizedState = Na(
          1 | t,
          { destroy: void 0 },
          l,
          o === void 0 ? null : o
        );
      }
      function fr(e, t, l, o) {
        var u = Le();
        o = o === void 0 ? null : o;
        var p = u.memoizedState.inst;
        Me !== null && o !== null && $i(o, Me.memoizedState.deps) ? u.memoizedState = Na(t, p, l, o) : (be.flags |= e, u.memoizedState = Na(
          1 | t,
          p,
          l,
          o
        ));
      }
      function fu(e, t) {
        dr(8390656, 8, e, t);
      }
      function is(e, t) {
        fr(2048, 8, e, t);
      }
      function ah(e) {
        be.flags |= 4;
        var t = be.updateQueue;
        if (t === null)
          t = or(), be.updateQueue = t, t.events = [e];
        else {
          var l = t.events;
          l === null ? t.events = [e] : l.push(e);
        }
      }
      function pu(e) {
        var t = Le().memoizedState;
        return ah({ ref: t, nextImpl: e }), function() {
          if ((xe & 2) !== 0)
            throw Error(s(440));
          return t.impl.apply(void 0, arguments);
        };
      }
      function mu(e, t) {
        return fr(4, 2, e, t);
      }
      function hu(e, t) {
        return fr(4, 4, e, t);
      }
      function gu(e, t) {
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
      function bu(e, t, l) {
        l = l != null ? l.concat([e]) : null, fr(
          4,
          4,
          gu.bind(null, t, e),
          l
        );
      }
      function ss() {
      }
      function vu(e, t) {
        var l = Le();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        return t !== null && $i(t, o[1]) ? o[0] : (l.memoizedState = [e, t], e);
      }
      function yu(e, t) {
        var l = Le();
        t = t === void 0 ? null : t;
        var o = l.memoizedState;
        if (t !== null && $i(t, o[1]))
          return o[0];
        if (o = e(), fa) {
          D(!0);
          try {
            e();
          } finally {
            D(!1);
          }
        }
        return l.memoizedState = [o, t], o;
      }
      function os(e, t, l) {
        return l === void 0 || (hn & 1073741824) !== 0 && (ke & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = l, e = hd(), be.lanes |= e, Hn |= e, l);
      }
      function xu(e, t, l, o) {
        return zt(l, t) ? l : Xa.current !== null ? (e = os(e, l, o), zt(e, t) || (Ve = !0), e) : (hn & 42) === 0 || (hn & 1073741824) !== 0 && (ke & 261930) === 0 ? (Ve = !0, e.memoizedState = l) : (e = hd(), be.lanes |= e, Hn |= e, t);
      }
      function wu(e, t, l, o, u) {
        var p = pn();
        Pe(
          p !== 0 && 8 > p ? p : 8
        );
        var v = de.T, M = {};
        de.T = M, us(e, !1, t, l);
        try {
          var Y = u(), F = de.S;
          if (F !== null && F(M, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var ne = Pm(
              Y,
              o
            );
            dl(
              e,
              t,
              ne,
              kt(e)
            );
          } else
            dl(
              e,
              t,
              o,
              kt(e)
            );
        } catch (P) {
          dl(
            e,
            t,
            { then: function() {
            }, status: "rejected", reason: P },
            kt()
          );
        } finally {
          Pe(p), v !== null && M.types !== null && (v.types = M.types), de.T = v;
        }
      }
      function ku(e) {
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
            lastRenderedReducer: sn,
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
            lastRenderedReducer: sn,
            lastRenderedState: l
          },
          next: null
        }, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
      }
      function cs() {
        return nt(ia);
      }
      function _u() {
        return Le().memoizedState;
      }
      function Su() {
        return Le().memoizedState;
      }
      function lh(e) {
        for (var t = e.return; t !== null; ) {
          switch (t.tag) {
            case 24:
            case 3:
              var l = kt();
              e = Sn(l);
              var o = En(t, e, l);
              o !== null && (bt(o, t, l), sl(o, t, l)), t = { cache: Gi() }, e.payload = t;
              return;
          }
          t = t.return;
        }
      }
      function rh(e, t, l) {
        var o = kt();
        l = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, pr(e) ? zu(t, l) : (l = Qi(e, t, l, o), l !== null && (bt(l, e, o), Nu(l, t, o)));
      }
      function Eu(e, t, l) {
        var o = kt();
        dl(e, t, l, o);
      }
      function dl(e, t, l, o) {
        var u = {
          lane: o,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (pr(e)) zu(t, u);
        else {
          var p = e.alternate;
          if (e.lanes === 0 && (p === null || p.lanes === 0) && (p = t.lastRenderedReducer, p !== null))
            try {
              var v = t.lastRenderedState, M = p(v, l);
              if (u.hasEagerState = !0, u.eagerState = M, zt(M, v))
                return rr(e, t, u, 0), Re === null && lr(), !1;
            } catch {
            } finally {
            }
          if (l = Qi(e, t, u, o), l !== null)
            return bt(l, e, o), Nu(l, t, o), !0;
        }
        return !1;
      }
      function us(e, t, l, o) {
        if (o = {
          lane: 2,
          revertLane: Li(),
          gesture: null,
          action: o,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, pr(e)) {
          if (t) throw Error(s(479));
        } else
          t = Qi(
            e,
            l,
            o,
            2
          ), t !== null && bt(t, e, 2);
      }
      function pr(e) {
        var t = e.alternate;
        return e === be || t !== null && t === be;
      }
      function zu(e, t) {
        Ka = Lr = !0;
        var l = e.pending;
        l === null ? t.next = t : (t.next = l.next, l.next = t), e.pending = t;
      }
      function Nu(e, t, l) {
        if ((l & 4194048) !== 0) {
          var o = t.lanes;
          o &= e.pendingLanes, l |= o, t.lanes = l, k(e, l);
        }
      }
      function ds(e, t, l, o) {
        t = e.memoizedState, l = l(o, t), l = l == null ? t : Gs({}, t, l), e.memoizedState = l, e.lanes === 0 && (e.updateQueue.baseState = l);
      }
      function Tu(e, t, l, o, u, p, v) {
        return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(o, p, v) : t.prototype && t.prototype.isPureReactComponent ? !tr(l, o) || !tr(u, p) : !0;
      }
      function Cu(e, t, l, o) {
        e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(l, o), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(l, o), t.state !== e && fo.enqueueReplaceState(t, t.state, null);
      }
      function ta(e, t) {
        var l = t;
        if ("ref" in t) {
          l = {};
          for (var o in t)
            o !== "ref" && (l[o] = t[o]);
        }
        if (e = e.defaultProps) {
          l === t && (l = Gs({}, l));
          for (var u in e)
            l[u] === void 0 && (l[u] = e[u]);
        }
        return l;
      }
      function mr(e, t) {
        try {
          var l = e.onUncaughtError;
          l(t.value, { componentStack: t.stack });
        } catch (o) {
          setTimeout(function() {
            throw o;
          });
        }
      }
      function Au(e, t, l) {
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
      function fs(e, t, l) {
        return l = Sn(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          mr(e, t);
        }, l;
      }
      function Mu(e) {
        return e = Sn(e), e.tag = 3, e;
      }
      function ju(e, t, l, o) {
        var u = l.type.getDerivedStateFromError;
        if (typeof u == "function") {
          var p = o.value;
          e.payload = function() {
            return u(p);
          }, e.callback = function() {
            Au(t, l, o);
          };
        }
        var v = l.stateNode;
        v !== null && typeof v.componentDidCatch == "function" && (e.callback = function() {
          Au(t, l, o), typeof u != "function" && (Un === null ? Un = /* @__PURE__ */ new Set([this]) : Un.add(this));
          var M = o.stack;
          this.componentDidCatch(o.value, {
            componentStack: M !== null ? M : ""
          });
        });
      }
      function ih(e, t, l, o, u) {
        if (l.flags |= 32768, o !== null && typeof o == "object" && typeof o.then == "function") {
          if (t = l.alternate, t !== null && Ea(
            t,
            l,
            u,
            !0
          ), l = Nt.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return Bt === null ? _r() : l.alternate === null && qe === 0 && (qe = 3), l.flags &= -257, l.flags |= 65536, l.lanes = u, o === qr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? l.updateQueue = /* @__PURE__ */ new Set([o]) : t.add(o), Ds(e, o, u)), !1;
              case 22:
                return l.flags |= 65536, o === qr ? l.flags |= 16384 : (t = l.updateQueue, t === null ? (t = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([o])
                }, l.updateQueue = t) : (l = t.retryQueue, l === null ? t.retryQueue = /* @__PURE__ */ new Set([o]) : l.add(o)), Ds(e, o, u)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return Ds(e, o, u), _r(), !1;
        }
        if (Se)
          return t = Nt.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = u, o !== ao && (e = Error(s(422), { cause: o }), ll(
            Q(e, l)
          ))) : (o !== ao && (t = Error(s(423), {
            cause: o
          }), ll(
            Q(t, l)
          )), e = e.current.alternate, e.flags |= 65536, u &= -u, e.lanes |= u, o = Q(o, l), u = fs(
            e.stateNode,
            o,
            u
          ), Ki(e, u), qe !== 4 && (qe = 2)), !1;
        var p = Error(s(520), { cause: o });
        if (p = Q(p, l), Al === null ? Al = [p] : Al.push(p), qe !== 4 && (qe = 2), t === null) return !0;
        o = Q(o, l), l = t;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, e = u & -u, l.lanes |= e, e = fs(l.stateNode, o, e), Ki(l, e), !1;
            case 1:
              if (t = l.type, p = l.stateNode, (l.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || p !== null && typeof p.componentDidCatch == "function" && (Un === null || !Un.has(
                p
              ))))
                return l.flags |= 65536, u &= -u, l.lanes |= u, u = Mu(u), ju(
                  u,
                  e,
                  l,
                  o
                ), Ki(l, u), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function at(e, t, l, o) {
        t.child = e === null ? yf(t, null, l, o) : da(
          t,
          e.child,
          l,
          o
        );
      }
      function Ru(e, t, l, o, u) {
        l = l.render;
        var p = t.ref;
        if ("ref" in o) {
          var v = {};
          for (var M in o)
            M !== "ref" && (v[M] = o[M]);
        } else v = o;
        return In(t), o = Fi(
          e,
          t,
          l,
          v,
          p,
          u
        ), M = Ii(), e !== null && !Ve ? (Pi(e, t, u), on(e, t, u)) : (Se && M && Z(t), t.flags |= 1, at(e, t, o, u), t.child);
      }
      function Ou(e, t, l, o, u) {
        if (e === null) {
          var p = l.type;
          return typeof p == "function" && !Bs(p) && p.defaultProps === void 0 && l.compare === null ? (t.tag = 15, t.type = p, Du(
            e,
            t,
            p,
            o,
            u
          )) : (e = Er(
            l.type,
            null,
            o,
            t,
            t.mode,
            u
          ), e.ref = t.ref, e.return = t, t.child = e);
        }
        if (p = e.child, !ys(e, u)) {
          var v = p.memoizedProps;
          if (l = l.compare, l = l !== null ? l : tr, l(v, o) && e.ref === t.ref)
            return on(
              e,
              t,
              u
            );
        }
        return t.flags |= 1, e = dn(p, o), e.ref = t.ref, e.return = t, t.child = e;
      }
      function Du(e, t, l, o, u) {
        if (e !== null) {
          var p = e.memoizedProps;
          if (tr(p, o) && e.ref === t.ref)
            if (Ve = !1, t.pendingProps = o = p, ys(e, u))
              (e.flags & 131072) !== 0 && (Ve = !0);
            else
              return t.lanes = e.lanes, on(e, t, u);
        }
        return ps(
          e,
          t,
          l,
          o,
          u
        );
      }
      function Bu(e, t, l, o) {
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
            return Hu(
              e,
              t,
              p,
              l,
              o
            );
          }
          if ((l & 536870912) !== 0)
            t.memoizedState = { baseLanes: 0, cachePool: null }, e !== null && er(
              t,
              p !== null ? p.cachePool : null
            ), p !== null ? Xc(t, p) : Zi(), Kc(t);
          else
            return o = t.lanes = 536870912, Hu(
              e,
              t,
              p !== null ? p.baseLanes | l : l,
              l,
              o
            );
        } else
          p !== null ? (er(t, p.cachePool), Xc(t, p), Nn(), t.memoizedState = null) : (e !== null && er(t, null), Zi(), Nn());
        return at(e, t, u, l), t.child;
      }
      function fl(e, t) {
        return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), t.sibling;
      }
      function Hu(e, t, l, o, u) {
        var p = Yi();
        return p = p === null ? null : {
          parent: fn ? Be._currentValue : Be._currentValue2,
          pool: p
        }, t.memoizedState = {
          baseLanes: l,
          cachePool: p
        }, e !== null && er(t, null), Zi(), Kc(t), e !== null && Ea(e, t, o, !0), t.childLanes = u, null;
      }
      function hr(e, t) {
        return t = br(
          { mode: t.mode, children: t.children },
          e.mode
        ), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Uu(e, t, l) {
        return da(t, e.child, null, l), e = hr(
          t,
          t.pendingProps
        ), e.flags |= 2, wt(t), t.memoizedState = null, e;
      }
      function sh(e, t, l) {
        var o = t.pendingProps, u = (t.flags & 128) !== 0;
        if (t.flags &= -129, e === null) {
          if (Se) {
            if (o.mode === "hidden")
              return e = hr(t, o), t.lanes = 536870912, fl(null, e);
            if (Wi(t), (e = De) ? (e = Tg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: jn !== null ? { id: Ft, overflow: It } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Dd(e), l.return = t, t.child = l, rt = t, De = null)) : e = null, e === null) throw he(t);
            return t.lanes = 536870912, null;
          }
          return hr(t, o);
        }
        var p = e.memoizedState;
        if (p !== null) {
          var v = p.dehydrated;
          if (Wi(t), u)
            if (t.flags & 256)
              t.flags &= -257, t = Uu(
                e,
                t,
                l
              );
            else if (t.memoizedState !== null)
              t.child = e.child, t.flags |= 128, t = null;
            else throw Error(s(558));
          else if (Ve || Ea(
            e,
            t,
            l,
            !1
          ), u = (l & e.childLanes) !== 0, Ve || u) {
            if (o = Re, o !== null && (v = _(o, l), v !== 0 && v !== p.retryLane))
              throw p.retryLane = v, ea(e, v), bt(o, e, v), po;
            _r(), t = Uu(
              e,
              t,
              l
            );
          } else
            e = p.treeContext, ft && (De = _g(v), rt = t, Se = !0, On = null, Ot = !1, e !== null && oe(t, e)), t = hr(t, o), t.flags |= 4096;
          return t;
        }
        return e = dn(e.child, {
          mode: o.mode,
          children: o.children
        }), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function gr(e, t) {
        var l = t.ref;
        if (l === null)
          e !== null && e.ref !== null && (t.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (e === null || e.ref !== l) && (t.flags |= 4194816);
        }
      }
      function ps(e, t, l, o, u) {
        return In(t), l = Fi(
          e,
          t,
          l,
          o,
          void 0,
          u
        ), o = Ii(), e !== null && !Ve ? (Pi(e, t, u), on(e, t, u)) : (Se && o && Z(t), t.flags |= 1, at(e, t, l, u), t.child);
      }
      function qu(e, t, l, o, u, p) {
        return In(t), t.updateQueue = null, l = Jc(
          t,
          o,
          l,
          u
        ), Zc(e), o = Ii(), e !== null && !Ve ? (Pi(e, t, p), on(e, t, p)) : (Se && o && Z(t), t.flags |= 1, at(e, t, l, p), t.child);
      }
      function Gu(e, t, l, o, u) {
        if (In(t), t.stateNode === null) {
          var p = Ba, v = l.contextType;
          typeof v == "object" && v !== null && (p = nt(v)), p = new l(o, p), t.memoizedState = p.state !== null && p.state !== void 0 ? p.state : null, p.updater = fo, t.stateNode = p, p._reactInternals = t, p = t.stateNode, p.props = o, p.state = t.memoizedState, p.refs = {}, Vi(t), v = l.contextType, p.context = typeof v == "object" && v !== null ? nt(v) : Ba, p.state = t.memoizedState, v = l.getDerivedStateFromProps, typeof v == "function" && (ds(
            t,
            l,
            v,
            o
          ), p.state = t.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof p.getSnapshotBeforeUpdate == "function" || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (v = p.state, typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount(), v !== p.state && fo.enqueueReplaceState(
            p,
            p.state,
            null
          ), cl(t, o, p, u), ol(), p.state = t.memoizedState), typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !0;
        } else if (e === null) {
          p = t.stateNode;
          var M = t.memoizedProps, Y = ta(l, M);
          p.props = Y;
          var F = p.context, ne = l.contextType;
          v = Ba, typeof ne == "object" && ne !== null && (v = nt(ne));
          var P = l.getDerivedStateFromProps;
          ne = typeof P == "function" || typeof p.getSnapshotBeforeUpdate == "function", M = t.pendingProps !== M, ne || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (M || F !== v) && Cu(
            t,
            p,
            o,
            v
          ), Dn = !1;
          var le = t.memoizedState;
          p.state = le, cl(t, o, p, u), ol(), F = t.memoizedState, M || le !== F || Dn ? (typeof P == "function" && (ds(
            t,
            l,
            P,
            o
          ), F = t.memoizedState), (Y = Dn || Tu(
            t,
            l,
            Y,
            o,
            le,
            F,
            v
          )) ? (ne || typeof p.UNSAFE_componentWillMount != "function" && typeof p.componentWillMount != "function" || (typeof p.componentWillMount == "function" && p.componentWillMount(), typeof p.UNSAFE_componentWillMount == "function" && p.UNSAFE_componentWillMount()), typeof p.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = o, t.memoizedState = F), p.props = o, p.state = F, p.context = v, o = Y) : (typeof p.componentDidMount == "function" && (t.flags |= 4194308), o = !1);
        } else {
          p = t.stateNode, Xi(e, t), v = t.memoizedProps, ne = ta(l, v), p.props = ne, P = t.pendingProps, le = p.context, F = l.contextType, Y = Ba, typeof F == "object" && F !== null && (Y = nt(F)), M = l.getDerivedStateFromProps, (F = typeof M == "function" || typeof p.getSnapshotBeforeUpdate == "function") || typeof p.UNSAFE_componentWillReceiveProps != "function" && typeof p.componentWillReceiveProps != "function" || (v !== P || le !== Y) && Cu(
            t,
            p,
            o,
            Y
          ), Dn = !1, le = t.memoizedState, p.state = le, cl(t, o, p, u), ol();
          var ge = t.memoizedState;
          v !== P || le !== ge || Dn || e !== null && e.dependencies !== null && Fl(e.dependencies) ? (typeof M == "function" && (ds(
            t,
            l,
            M,
            o
          ), ge = t.memoizedState), (ne = Dn || Tu(
            t,
            l,
            ne,
            o,
            le,
            ge,
            Y
          ) || e !== null && e.dependencies !== null && Fl(e.dependencies)) ? (F || typeof p.UNSAFE_componentWillUpdate != "function" && typeof p.componentWillUpdate != "function" || (typeof p.componentWillUpdate == "function" && p.componentWillUpdate(o, ge, Y), typeof p.UNSAFE_componentWillUpdate == "function" && p.UNSAFE_componentWillUpdate(
            o,
            ge,
            Y
          )), typeof p.componentDidUpdate == "function" && (t.flags |= 4), typeof p.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof p.componentDidUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), t.memoizedProps = o, t.memoizedState = ge), p.props = o, p.state = ge, p.context = Y, o = ne) : (typeof p.componentDidUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 4), typeof p.getSnapshotBeforeUpdate != "function" || v === e.memoizedProps && le === e.memoizedState || (t.flags |= 1024), o = !1);
        }
        return p = o, gr(e, t), o = (t.flags & 128) !== 0, p || o ? (p = t.stateNode, l = o && typeof l.getDerivedStateFromError != "function" ? null : p.render(), t.flags |= 1, e !== null && o ? (t.child = da(
          t,
          e.child,
          null,
          u
        ), t.child = da(
          t,
          null,
          l,
          u
        )) : at(e, t, l, u), t.memoizedState = p.state, e = t.child) : e = on(
          e,
          t,
          u
        ), e;
      }
      function Lu(e, t, l, o) {
        return Gt(), t.flags |= 256, at(e, t, l, o), t.child;
      }
      function ms(e) {
        return { baseLanes: e, cachePool: Bc() };
      }
      function hs(e, t, l) {
        return e = e !== null ? e.childLanes & ~l : 0, t && (e |= Ct), e;
      }
      function Yu(e, t, l) {
        var o = t.pendingProps, u = !1, p = (t.flags & 128) !== 0, v;
        if ((v = p) || (v = e !== null && e.memoizedState === null ? !1 : (Ye.current & 2) !== 0), v && (u = !0, t.flags &= -129), v = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
          if (Se) {
            if (u ? zn(t) : Nn(), (e = De) ? (e = Cg(
              e,
              Ot
            ), e !== null && (t.memoizedState = {
              dehydrated: e,
              treeContext: jn !== null ? { id: Ft, overflow: It } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = Dd(e), l.return = t, t.child = l, rt = t, De = null)) : e = null, e === null) throw he(t);
            return $s(e) ? t.lanes = 32 : t.lanes = 536870912, null;
          }
          var M = o.children;
          return o = o.fallback, u ? (Nn(), u = t.mode, M = br(
            { mode: "hidden", children: M },
            u
          ), o = la(
            o,
            u,
            l,
            null
          ), M.return = t, o.return = t, M.sibling = o, t.child = M, o = t.child, o.memoizedState = ms(l), o.childLanes = hs(
            e,
            v,
            l
          ), t.memoizedState = mo, fl(null, o)) : (zn(t), gs(t, M));
        }
        var Y = e.memoizedState;
        if (Y !== null && (M = Y.dehydrated, M !== null)) {
          if (p)
            t.flags & 256 ? (zn(t), t.flags &= -257, t = bs(
              e,
              t,
              l
            )) : t.memoizedState !== null ? (Nn(), t.child = e.child, t.flags |= 128, t = null) : (Nn(), M = o.fallback, u = t.mode, o = br(
              { mode: "visible", children: o.children },
              u
            ), M = la(
              M,
              u,
              l,
              null
            ), M.flags |= 2, o.return = t, M.return = t, o.sibling = M, t.child = o, da(
              t,
              e.child,
              null,
              l
            ), o = t.child, o.memoizedState = ms(l), o.childLanes = hs(
              e,
              v,
              l
            ), t.memoizedState = mo, t = fl(null, o));
          else if (zn(t), $s(M))
            v = gg(M).digest, o = Error(s(419)), o.stack = "", o.digest = v, ll({ value: o, source: null, stack: null }), t = bs(
              e,
              t,
              l
            );
          else if (Ve || Ea(
            e,
            t,
            l,
            !1
          ), v = (l & e.childLanes) !== 0, Ve || v) {
            if (v = Re, v !== null && (o = _(
              v,
              l
            ), o !== 0 && o !== Y.retryLane))
              throw Y.retryLane = o, ea(e, o), bt(v, e, o), po;
            Ws(M) || _r(), t = bs(
              e,
              t,
              l
            );
          } else
            Ws(M) ? (t.flags |= 192, t.child = e.child, t = null) : (e = Y.treeContext, ft && (De = Sg(
              M
            ), rt = t, Se = !0, On = null, Ot = !1, e !== null && oe(t, e)), t = gs(
              t,
              o.children
            ), t.flags |= 4096);
          return t;
        }
        return u ? (Nn(), M = o.fallback, u = t.mode, Y = e.child, p = Y.sibling, o = dn(Y, {
          mode: "hidden",
          children: o.children
        }), o.subtreeFlags = Y.subtreeFlags & 65011712, p !== null ? M = dn(
          p,
          M
        ) : (M = la(
          M,
          u,
          l,
          null
        ), M.flags |= 2), M.return = t, o.return = t, o.sibling = M, t.child = o, fl(null, o), o = t.child, M = e.child.memoizedState, M === null ? M = ms(l) : (u = M.cachePool, u !== null ? (Y = fn ? Be._currentValue : Be._currentValue2, u = u.parent !== Y ? { parent: Y, pool: Y } : u) : u = Bc(), M = {
          baseLanes: M.baseLanes | l,
          cachePool: u
        }), o.memoizedState = M, o.childLanes = hs(
          e,
          v,
          l
        ), t.memoizedState = mo, fl(e.child, o)) : (zn(t), l = e.child, e = l.sibling, l = dn(l, {
          mode: "visible",
          children: o.children
        }), l.return = t, l.sibling = null, e !== null && (v = t.deletions, v === null ? (t.deletions = [e], t.flags |= 16) : v.push(e)), t.child = l, t.memoizedState = null, l);
      }
      function gs(e, t) {
        return t = br(
          { mode: "visible", children: t },
          e.mode
        ), t.return = e, e.child = t;
      }
      function br(e, t) {
        return e = r(22, e, null, t), e.lanes = 0, e;
      }
      function bs(e, t, l) {
        return da(t, e.child, null, l), e = gs(
          t,
          t.pendingProps.children
        ), e.flags |= 2, t.memoizedState = null, e;
      }
      function Qu(e, t, l) {
        e.lanes |= t;
        var o = e.alternate;
        o !== null && (o.lanes |= t), Ui(e.return, t, l);
      }
      function vs(e, t, l, o, u, p) {
        var v = e.memoizedState;
        v === null ? e.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: o,
          tail: l,
          tailMode: u,
          treeForkCount: p
        } : (v.isBackwards = t, v.rendering = null, v.renderingStartTime = 0, v.last = o, v.tail = l, v.tailMode = u, v.treeForkCount = p);
      }
      function Vu(e, t, l) {
        var o = t.pendingProps, u = o.revealOrder, p = o.tail;
        o = o.children;
        var v = Ye.current, M = (v & 2) !== 0;
        if (M ? (v = v & 1 | 2, t.flags |= 128) : v &= 1, E(Ye, v), at(e, t, o, l), o = Se ? _l : 0, !M && e !== null && (e.flags & 128) !== 0)
          e: for (e = t.child; e !== null; ) {
            if (e.tag === 13)
              e.memoizedState !== null && Qu(e, l, t);
            else if (e.tag === 19)
              Qu(e, l, t);
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
              e = l.alternate, e !== null && sr(e) === null && (u = l), l = l.sibling;
            l = u, l === null ? (u = t.child, t.child = null) : (u = l.sibling, l.sibling = null), vs(
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
              if (e = u.alternate, e !== null && sr(e) === null) {
                t.child = u;
                break;
              }
              e = u.sibling, u.sibling = l, l = u, u = e;
            }
            vs(
              t,
              !0,
              l,
              null,
              p,
              o
            );
            break;
          case "together":
            vs(
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
      function on(e, t, l) {
        if (e !== null && (t.dependencies = e.dependencies), Hn |= t.lanes, (l & t.childLanes) === 0)
          if (e !== null) {
            if (Ea(
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
          for (e = t.child, l = dn(e, e.pendingProps), t.child = l, l.return = t; e.sibling !== null; )
            e = e.sibling, l = l.sibling = dn(e, e.pendingProps), l.return = t;
          l.sibling = null;
        }
        return t.child;
      }
      function ys(e, t) {
        return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Fl(e)));
      }
      function oh(e, t, l) {
        switch (t.tag) {
          case 3:
            ce(
              t,
              t.stateNode.containerInfo
            ), _n(t, Be, e.memoizedState.cache), Gt();
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
            _n(
              t,
              t.type,
              t.memoizedProps.value
            );
            break;
          case 31:
            if (t.memoizedState !== null)
              return t.flags |= 128, Wi(t), null;
            break;
          case 13:
            var o = t.memoizedState;
            if (o !== null)
              return o.dehydrated !== null ? (zn(t), t.flags |= 128, null) : (l & t.child.childLanes) !== 0 ? Yu(
                e,
                t,
                l
              ) : (zn(t), e = on(
                e,
                t,
                l
              ), e !== null ? e.sibling : null);
            zn(t);
            break;
          case 19:
            var u = (e.flags & 128) !== 0;
            if (o = (l & t.childLanes) !== 0, o || (Ea(
              e,
              t,
              l,
              !1
            ), o = (l & t.childLanes) !== 0), u) {
              if (o)
                return Vu(
                  e,
                  t,
                  l
                );
              t.flags |= 128;
            }
            if (u = t.memoizedState, u !== null && (u.rendering = null, u.tail = null, u.lastEffect = null), E(Ye, Ye.current), o) break;
            return null;
          case 22:
            return t.lanes = 0, Bu(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            _n(t, Be, e.memoizedState.cache);
        }
        return on(e, t, l);
      }
      function Xu(e, t, l) {
        if (e !== null)
          if (e.memoizedProps !== t.pendingProps)
            Ve = !0;
          else {
            if (!ys(e, l) && (t.flags & 128) === 0)
              return Ve = !1, oh(
                e,
                t,
                l
              );
            Ve = (e.flags & 131072) !== 0;
          }
        else
          Ve = !1, Se && (t.flags & 1048576) !== 0 && A(t, _l, t.index);
        switch (t.lanes = 0, t.tag) {
          case 16:
            e: {
              var o = t.pendingProps;
              if (e = Pn(t.elementType), t.type = e, typeof e == "function")
                Bs(e) ? (o = ta(e, o), t.tag = 1, t = Gu(
                  null,
                  t,
                  e,
                  o,
                  l
                )) : (t.tag = 0, t = ps(
                  null,
                  t,
                  e,
                  o,
                  l
                ));
              else {
                if (e != null) {
                  var u = e.$$typeof;
                  if (u === Ys) {
                    t.tag = 11, t = Ru(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  } else if (u === Xs) {
                    t.tag = 14, t = Ou(
                      null,
                      t,
                      e,
                      o,
                      l
                    );
                    break e;
                  }
                }
                throw t = y(e) || e, Error(s(306, t, ""));
              }
            }
            return t;
          case 0:
            return ps(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 1:
            return o = t.type, u = ta(
              o,
              t.pendingProps
            ), Gu(
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
              u = t.memoizedState, o = u.element, Xi(e, t), cl(t, p, null, l);
              var v = t.memoizedState;
              if (p = v.cache, _n(t, Be, p), p !== u.cache && qi(
                t,
                [Be],
                l,
                !0
              ), ol(), p = v.element, ft && u.isDehydrated)
                if (u = {
                  element: p,
                  isDehydrated: !1,
                  cache: v.cache
                }, t.updateQueue.baseState = u, t.memoizedState = u, t.flags & 256) {
                  t = Lu(
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
                  ), ll(o), t = Lu(
                    e,
                    t,
                    p,
                    l
                  );
                  break e;
                } else
                  for (ft && (De = kg(
                    t.stateNode.containerInfo
                  ), rt = t, Se = !0, On = null, Ot = !0), l = yf(
                    t,
                    null,
                    p,
                    l
                  ), t.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (Gt(), p === o) {
                  t = on(
                    e,
                    t,
                    l
                  );
                  break e;
                }
                at(e, t, p, l);
              }
              t = t.child;
            }
            return t;
          case 26:
            if (Vt)
              return gr(e, t), e === null ? (l = lf(
                t.type,
                null,
                t.pendingProps,
                null
              )) ? t.memoizedState = l : Se || (t.stateNode = Wg(
                t.type,
                t.pendingProps,
                Rn.current,
                t
              )) : t.memoizedState = lf(
                t.type,
                e.memoizedProps,
                t.pendingProps,
                e.memoizedState
              ), null;
          case 27:
            if (We)
              return Ee(t), e === null && We && Se && (o = t.stateNode = df(
                t.type,
                t.pendingProps,
                Rn.current,
                lt.current,
                !1
              ), rt = t, Ot = !0, De = Eg(
                t.type,
                o,
                De
              )), at(
                e,
                t,
                t.pendingProps.children,
                l
              ), gr(e, t), e === null && (t.flags |= 4194304), t.child;
          case 5:
            return e === null && Se && (Kg(
              t.type,
              t.pendingProps,
              lt.current
            ), (u = o = De) && (o = zg(
              o,
              t.type,
              t.pendingProps,
              Ot
            ), o !== null ? (t.stateNode = o, rt = t, De = wg(o), Ot = !1, u = !0) : u = !1), u || he(t)), Ee(t), u = t.type, p = t.pendingProps, v = e !== null ? e.memoizedProps : null, o = p.children, Tr(u, p) ? o = null : v !== null && Tr(u, v) && (t.flags |= 32), t.memoizedState !== null && (u = Fi(
              e,
              t,
              eh,
              null,
              null,
              l
            ), fn ? ia._currentValue = u : ia._currentValue2 = u), gr(e, t), at(e, t, o, l), t.child;
          case 6:
            return e === null && Se && (Zg(
              t.pendingProps,
              lt.current
            ), (e = l = De) && (l = Ng(
              l,
              t.pendingProps,
              Ot
            ), l !== null ? (t.stateNode = l, rt = t, De = null, e = !0) : e = !1), e || he(t)), null;
          case 13:
            return Yu(e, t, l);
          case 4:
            return ce(
              t,
              t.stateNode.containerInfo
            ), o = t.pendingProps, e === null ? t.child = da(
              t,
              null,
              o,
              l
            ) : at(e, t, o, l), t.child;
          case 11:
            return Ru(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 7:
            return at(
              e,
              t,
              t.pendingProps,
              l
            ), t.child;
          case 8:
            return at(
              e,
              t,
              t.pendingProps.children,
              l
            ), t.child;
          case 12:
            return at(
              e,
              t,
              t.pendingProps.children,
              l
            ), t.child;
          case 10:
            return o = t.pendingProps, _n(t, t.type, o.value), at(
              e,
              t,
              o.children,
              l
            ), t.child;
          case 9:
            return u = t.type._context, o = t.pendingProps.children, In(t), u = nt(u), o = o(u), t.flags |= 1, at(e, t, o, l), t.child;
          case 14:
            return Ou(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 15:
            return Du(
              e,
              t,
              t.type,
              t.pendingProps,
              l
            );
          case 19:
            return Vu(
              e,
              t,
              l
            );
          case 31:
            return sh(e, t, l);
          case 22:
            return Bu(
              e,
              t,
              l,
              t.pendingProps
            );
          case 24:
            return In(t), o = nt(Be), e === null ? (u = Yi(), u === null && (u = Re, p = Gi(), u.pooledCache = p, p.refCount++, p !== null && (u.pooledCacheLanes |= l), u = p), t.memoizedState = {
              parent: o,
              cache: u
            }, Vi(t), _n(t, Be, u)) : ((e.lanes & l) !== 0 && (Xi(e, t), cl(t, null, null, l), ol()), u = e.memoizedState, p = t.memoizedState, u.parent !== o ? (u = { parent: o, cache: o }, t.memoizedState = u, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = u), _n(t, Be, o)) : (o = p.cache, _n(t, Be, o), o !== u.cache && qi(
              t,
              [Be],
              l,
              !0
            ))), at(
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
      function vr(e) {
        $t && (e.flags |= 8);
      }
      function Ku(e, t) {
        if (e !== null && e.child === t.child) return !1;
        if ((t.flags & 16) !== 0) return !0;
        for (e = t.child; e !== null; ) {
          if ((e.flags & 8218) !== 0 || (e.subtreeFlags & 8218) !== 0)
            return !0;
          e = e.sibling;
        }
        return !1;
      }
      function xs(e, t, l, o) {
        if (dt)
          for (l = t.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              Zs(e, l.stateNode);
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
        else if ($t)
          for (var u = t.child; u !== null; ) {
            if (u.tag === 5) {
              var p = u.stateNode;
              l && o && (p = Pd(
                p,
                u.type,
                u.memoizedProps
              )), Zs(e, p);
            } else if (u.tag === 6)
              p = u.stateNode, l && o && (p = ef(
                p,
                u.memoizedProps
              )), Zs(e, p);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                p = u.child, p !== null && (p.return = u), xs(e, u, !0, !0);
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
      function Zu(e, t, l, o) {
        var u = !1;
        if ($t)
          for (var p = t.child; p !== null; ) {
            if (p.tag === 5) {
              var v = p.stateNode;
              l && o && (v = Pd(
                v,
                p.type,
                p.memoizedProps
              )), Fd(e, v);
            } else if (p.tag === 6)
              v = p.stateNode, l && o && (v = ef(
                v,
                p.memoizedProps
              )), Fd(e, v);
            else if (p.tag !== 4) {
              if (p.tag === 22 && p.memoizedState !== null)
                u = p.child, u !== null && (u.return = p), Zu(e, p, !0, !0), u = !0;
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
      function Ju(e, t) {
        if ($t && Ku(e, t)) {
          e = t.stateNode;
          var l = e.containerInfo, o = $d();
          Zu(o, t, !1, !1), e.pendingChildren = o, Lt(t), hg(l, o);
        }
      }
      function ws(e, t, l, o) {
        if (dt)
          e.memoizedProps !== o && Lt(t);
        else if ($t) {
          var u = e.stateNode, p = e.memoizedProps;
          if ((e = Ku(e, t)) || p !== o) {
            var v = lt.current;
            p = mg(
              u,
              l,
              p,
              o,
              !e,
              null
            ), p === u ? t.stateNode = u : (vr(t), Xd(
              p,
              l,
              o,
              v
            ) && Lt(t), t.stateNode = p, e && xs(p, t, !1, !1));
          } else t.stateNode = u;
        }
      }
      function ks(e, t, l, o, u) {
        if ((e.mode & 32) !== 0 && (l === null ? Lh(t, o) : Yh(t, l, o))) {
          if (e.flags |= 16777216, (u & 335544128) === u || Js(t, o))
            if (Zd(e.stateNode, t, o))
              e.flags |= 8192;
            else if (xd()) e.flags |= 8192;
            else
              throw ua = qr, so;
        } else e.flags &= -16777217;
      }
      function Wu(e, t) {
        if (Fg(t)) {
          if (e.flags |= 16777216, !uf(t))
            if (xd()) e.flags |= 8192;
            else
              throw ua = qr, so;
        } else e.flags &= -16777217;
      }
      function yr(e, t) {
        t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? K() : 536870912, e.lanes |= t, $a |= t);
      }
      function pl(e, t) {
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
      function ch(e, t, l) {
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
            return l = t.stateNode, o = null, e !== null && (o = e.memoizedState.cache), t.memoizedState.cache !== o && (t.flags |= 2048), rn(Be), ue(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (e === null || e.child === null) && (qt(t) ? Lt(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, kn())), Ju(e, t), Oe(t), null;
          case 26:
            if (Vt) {
              var u = t.type, p = t.memoizedState;
              return e === null ? (Lt(t), p !== null ? (Oe(t), Wu(
                t,
                p
              )) : (Oe(t), ks(
                t,
                u,
                null,
                o,
                l
              ))) : p ? p !== e.memoizedState ? (Lt(t), Oe(t), Wu(
                t,
                p
              )) : (Oe(t), t.flags &= -16777217) : (p = e.memoizedProps, dt ? p !== o && Lt(t) : ws(
                e,
                t,
                u,
                o
              ), Oe(t), ks(
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
                dt ? e.memoizedProps !== o && Lt(t) : ws(e, t, u, o);
              else {
                if (!o) {
                  if (t.stateNode === null)
                    throw Error(s(166));
                  return Oe(t), null;
                }
                e = lt.current, qt(t) ? $n(t, e) : (e = df(
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
              ws(e, t, u, o);
            else {
              if (!o) {
                if (t.stateNode === null)
                  throw Error(s(166));
                return Oe(t), null;
              }
              if (p = lt.current, qt(t))
                $n(t, p), Gg(
                  t.stateNode,
                  u,
                  o,
                  p
                ) && (t.flags |= 64);
              else {
                var v = Rh(
                  u,
                  o,
                  Rn.current,
                  p,
                  t
                );
                vr(t), xs(v, t, !1, !1), t.stateNode = v, Xd(
                  v,
                  u,
                  o,
                  p
                ) && Lt(t);
              }
            }
            return Oe(t), ks(
              t,
              t.type,
              e === null ? null : e.memoizedProps,
              t.pendingProps,
              l
            ), null;
          case 6:
            if (e && t.stateNode != null)
              l = e.memoizedProps, dt ? l !== o && Lt(t) : $t && (l !== o ? (e = Rn.current, l = lt.current, vr(t), t.stateNode = Kd(
                o,
                e,
                l,
                t
              )) : t.stateNode = e.stateNode);
            else {
              if (typeof o != "string" && t.stateNode === null)
                throw Error(s(166));
              if (e = Rn.current, l = lt.current, qt(t)) {
                if (!ft) throw Error(s(176));
                if (e = t.stateNode, l = t.memoizedProps, o = null, u = rt, u !== null)
                  switch (u.tag) {
                    case 27:
                    case 5:
                      o = u.memoizedProps;
                  }
                Mg(
                  e,
                  l,
                  t,
                  o
                ) || he(t, !0);
              } else
                vr(t), t.stateNode = Kd(
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
                  jg(e, t);
                } else
                  Gt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                Oe(t), e = !1;
              } else
                l = kn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = l), e = !0;
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
                  Rg(u, t);
                } else
                  Gt(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                Oe(t), u = !1;
              } else
                u = kn(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = u), u = !0;
              if (!u)
                return t.flags & 256 ? (wt(t), t) : (wt(t), null);
            }
            return wt(t), (t.flags & 128) !== 0 ? (t.lanes = l, t) : (l = o !== null, e = e !== null && e.memoizedState !== null, l && (o = t.child, u = null, o.alternate !== null && o.alternate.memoizedState !== null && o.alternate.memoizedState.cachePool !== null && (u = o.alternate.memoizedState.cachePool.pool), p = null, o.memoizedState !== null && o.memoizedState.cachePool !== null && (p = o.memoizedState.cachePool.pool), p !== u && (o.flags |= 2048)), l !== e && l && (t.child.flags |= 8192), yr(t, t.updateQueue), Oe(t), null);
          case 4:
            return ue(), Ju(e, t), e === null && Hh(t.stateNode.containerInfo), Oe(t), null;
          case 10:
            return rn(t.type), Oe(t), null;
          case 19:
            if (S(Ye), o = t.memoizedState, o === null) return Oe(t), null;
            if (u = (t.flags & 128) !== 0, p = o.rendering, p === null)
              if (u) pl(o, !1);
              else {
                if (qe !== 0 || e !== null && (e.flags & 128) !== 0)
                  for (e = t.child; e !== null; ) {
                    if (p = sr(e), p !== null) {
                      for (t.flags |= 128, pl(o, !1), e = p.updateQueue, t.updateQueue = e, yr(t, e), t.subtreeFlags = 0, e = l, l = t.child; l !== null; )
                        Od(l, e), l = l.sibling;
                      return E(
                        Ye,
                        Ye.current & 1 | 2
                      ), Se && V(t, o.treeForkCount), t.child;
                    }
                    e = e.sibling;
                  }
                o.tail !== null && vt() > Ml && (t.flags |= 128, u = !0, pl(o, !1), t.lanes = 4194304);
              }
            else {
              if (!u)
                if (e = sr(p), e !== null) {
                  if (t.flags |= 128, u = !0, e = e.updateQueue, t.updateQueue = e, yr(t, e), pl(o, !0), o.tail === null && o.tailMode === "hidden" && !p.alternate && !Se)
                    return Oe(t), null;
                } else
                  2 * vt() - o.renderingStartTime > Ml && l !== 536870912 && (t.flags |= 128, u = !0, pl(o, !1), t.lanes = 4194304);
              o.isBackwards ? (p.sibling = t.child, t.child = p) : (e = o.last, e !== null ? e.sibling = p : t.child = p, o.last = p);
            }
            return o.tail !== null ? (e = o.tail, o.rendering = e, o.tail = e.sibling, o.renderingStartTime = vt(), e.sibling = null, l = Ye.current, E(
              Ye,
              u ? l & 1 | 2 : l & 1
            ), Se && V(t, o.treeForkCount), e) : (Oe(t), null);
          case 22:
          case 23:
            return wt(t), Ji(), o = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== o && (t.flags |= 8192) : o && (t.flags |= 8192), o ? (l & 536870912) !== 0 && (t.flags & 128) === 0 && (Oe(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Oe(t), l = t.updateQueue, l !== null && yr(t, l.retryQueue), l = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), o = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (o = t.memoizedState.cachePool.pool), o !== l && (t.flags |= 2048), e !== null && S(ca), null;
          case 24:
            return l = null, e !== null && (l = e.memoizedState.cache), t.memoizedState.cache !== l && (t.flags |= 2048), rn(Be), Oe(t), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, t.tag));
      }
      function uh(e, t) {
        switch (ae(t), t.tag) {
          case 1:
            return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 3:
            return rn(Be), ue(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
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
            return S(Ye), null;
          case 4:
            return ue(), null;
          case 10:
            return rn(t.type), null;
          case 22:
          case 23:
            return wt(t), Ji(), e !== null && S(ca), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
          case 24:
            return rn(Be), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function $u(e, t) {
        switch (ae(t), t.tag) {
          case 3:
            rn(Be), ue();
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
            S(Ye);
            break;
          case 10:
            rn(t.type);
            break;
          case 22:
          case 23:
            wt(t), Ji(), e !== null && S(ca);
            break;
          case 24:
            rn(Be);
        }
      }
      function ml(e, t) {
        try {
          var l = t.updateQueue, o = l !== null ? l.lastEffect : null;
          if (o !== null) {
            var u = o.next;
            l = u;
            do {
              if ((l.tag & e) === e) {
                o = void 0;
                var p = l.create, v = l.inst;
                o = p(), v.destroy = o;
              }
              l = l.next;
            } while (l !== u);
          }
        } catch (M) {
          Ne(t, t.return, M);
        }
      }
      function Tn(e, t, l) {
        try {
          var o = t.updateQueue, u = o !== null ? o.lastEffect : null;
          if (u !== null) {
            var p = u.next;
            o = p;
            do {
              if ((o.tag & e) === e) {
                var v = o.inst, M = v.destroy;
                if (M !== void 0) {
                  v.destroy = void 0, u = t;
                  var Y = l, F = M;
                  try {
                    F();
                  } catch (ne) {
                    Ne(
                      u,
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
      function Fu(e) {
        var t = e.updateQueue;
        if (t !== null) {
          var l = e.stateNode;
          try {
            Vc(t, l);
          } catch (o) {
            Ne(e, e.return, o);
          }
        }
      }
      function Iu(e, t, l) {
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
      function hl(e, t) {
        try {
          var l = e.ref;
          if (l !== null) {
            switch (e.tag) {
              case 26:
              case 27:
              case 5:
                var o = yl(e.stateNode);
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
      function Pu(e) {
        var t = e.type, l = e.memoizedProps, o = e.stateNode;
        try {
          ag(o, t, l, e);
        } catch (u) {
          Ne(e, e.return, u);
        }
      }
      function _s(e, t, l) {
        try {
          lg(
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
      function ed(e) {
        return e.tag === 5 || e.tag === 3 || (Vt ? e.tag === 26 : !1) || (We ? e.tag === 27 && Oa(e.type) : !1) || e.tag === 4;
      }
      function Ss(e) {
        e: for (; ; ) {
          for (; e.sibling === null; ) {
            if (e.return === null || ed(e.return)) return null;
            e = e.return;
          }
          for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
            if (We && e.tag === 27 && Oa(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
            e.child.return = e, e = e.child;
          }
          if (!(e.flags & 2)) return e.stateNode;
        }
      }
      function Es(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? ig(l, e, t) : tg(l, e);
        else if (o !== 4 && (We && o === 27 && Oa(e.type) && (l = e.stateNode, t = null), e = e.child, e !== null))
          for (Es(e, t, l), e = e.sibling; e !== null; )
            Es(e, t, l), e = e.sibling;
      }
      function xr(e, t, l) {
        var o = e.tag;
        if (o === 5 || o === 6)
          e = e.stateNode, t ? rg(l, e, t) : eg(l, e);
        else if (o !== 4 && (We && o === 27 && Oa(e.type) && (l = e.stateNode), e = e.child, e !== null))
          for (xr(e, t, l), e = e.sibling; e !== null; )
            xr(e, t, l), e = e.sibling;
      }
      function td(e, t, l) {
        e = e.containerInfo;
        try {
          Id(e, l);
        } catch (o) {
          Ne(t, t.return, o);
        }
      }
      function nd(e) {
        var t = e.stateNode, l = e.memoizedProps;
        try {
          Pg(
            e.type,
            l,
            t,
            e
          );
        } catch (o) {
          Ne(e, e.return, o);
        }
      }
      function dh(e, t) {
        for (Mh(e.containerInfo), et = t; et !== null; )
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
                      var v = ta(
                        o.type,
                        u
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
                  (t & 1024) !== 0 && dt && pg(e.stateNode.containerInfo);
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
      function ad(e, t, l) {
        var o = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            cn(e, l), o & 4 && ml(5, l);
            break;
          case 1:
            if (cn(e, l), o & 4)
              if (e = l.stateNode, t === null)
                try {
                  e.componentDidMount();
                } catch (v) {
                  Ne(l, l.return, v);
                }
              else {
                var u = ta(
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
                } catch (v) {
                  Ne(
                    l,
                    l.return,
                    v
                  );
                }
              }
            o & 64 && Fu(l), o & 512 && hl(l, l.return);
            break;
          case 3:
            if (cn(e, l), o & 64 && (o = l.updateQueue, o !== null)) {
              if (e = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    e = yl(l.child.stateNode);
                    break;
                  case 1:
                    e = l.child.stateNode;
                }
              try {
                Vc(o, e);
              } catch (v) {
                Ne(l, l.return, v);
              }
            }
            break;
          case 27:
            We && t === null && o & 4 && nd(l);
          case 26:
          case 5:
            if (cn(e, l), t === null) {
              if (o & 4) Pu(l);
              else if (o & 64) {
                e = l.type, t = l.memoizedProps, u = l.stateNode;
                try {
                  Bg(
                    u,
                    e,
                    t,
                    l
                  );
                } catch (v) {
                  Ne(l, l.return, v);
                }
              }
            }
            o & 512 && hl(l, l.return);
            break;
          case 12:
            cn(e, l);
            break;
          case 31:
            cn(e, l), o & 4 && rd(e, l);
            break;
          case 13:
            cn(e, l), o & 4 && id(e, l), o & 64 && (o = l.memoizedState, o !== null && (o = o.dehydrated, o !== null && (l = vh.bind(
              null,
              l
            ), bg(o, l))));
            break;
          case 22:
            if (o = l.memoizedState !== null || gn, !o) {
              t = t !== null && t.memoizedState !== null || Xe, u = gn;
              var p = Xe;
              gn = o, (Xe = t) && !p ? un(
                e,
                l,
                (l.subtreeFlags & 8772) !== 0
              ) : cn(e, l), gn = u, Xe = p;
            }
            break;
          case 30:
            break;
          default:
            cn(e, l);
        }
      }
      function ld(e) {
        var t = e.alternate;
        t !== null && (e.alternate = null, ld(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Gh(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
      }
      function Yt(e, t, l) {
        for (l = l.child; l !== null; )
          zs(
            e,
            t,
            l
          ), l = l.sibling;
      }
      function zs(e, t, l) {
        if (Et && typeof Et.onCommitFiberUnmount == "function")
          try {
            Et.onCommitFiberUnmount(kl, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Vt) {
              Xe || Wt(l, t), Yt(
                e,
                t,
                l
              ), l.memoizedState ? sf(l.memoizedState) : l.stateNode && cf(l.stateNode);
              break;
            }
          case 27:
            if (We) {
              Xe || Wt(l, t);
              var o = Ke, u = yt;
              Oa(l.type) && (Ke = l.stateNode, yt = !1), Yt(
                e,
                t,
                l
              ), ff(l.stateNode), Ke = o, yt = u;
              break;
            }
          case 5:
            Xe || Wt(l, t);
          case 6:
            if (dt) {
              if (o = Ke, u = yt, Ke = null, Yt(
                e,
                t,
                l
              ), Ke = o, yt = u, Ke !== null)
                if (yt)
                  try {
                    og(Ke, l.stateNode);
                  } catch (p) {
                    Ne(
                      l,
                      t,
                      p
                    );
                  }
                else
                  try {
                    sg(Ke, l.stateNode);
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
            dt && Ke !== null && (yt ? Qg(
              Ke,
              l.stateNode
            ) : Yg(Ke, l.stateNode));
            break;
          case 4:
            dt ? (o = Ke, u = yt, Ke = l.stateNode.containerInfo, yt = !0, Yt(
              e,
              t,
              l
            ), Ke = o, yt = u) : ($t && td(
              l.stateNode,
              l,
              $d()
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
            Tn(2, l, t), Xe || Tn(4, l, t), Yt(
              e,
              t,
              l
            );
            break;
          case 1:
            Xe || (Wt(l, t), o = l.stateNode, typeof o.componentWillUnmount == "function" && Iu(
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
      function rd(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
          e = e.dehydrated;
          try {
            Ug(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
        }
      }
      function id(e, t) {
        if (ft && t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null))))
          try {
            qg(e);
          } catch (l) {
            Ne(t, t.return, l);
          }
      }
      function fh(e) {
        switch (e.tag) {
          case 31:
          case 13:
          case 19:
            var t = e.stateNode;
            return t === null && (t = e.stateNode = new kf()), t;
          case 22:
            return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new kf()), t;
          default:
            throw Error(s(435, e.tag));
        }
      }
      function wr(e, t) {
        var l = fh(e);
        t.forEach(function(o) {
          if (!l.has(o)) {
            l.add(o);
            var u = yh.bind(null, e, o);
            o.then(u, u);
          }
        });
      }
      function ut(e, t) {
        var l = t.deletions;
        if (l !== null)
          for (var o = 0; o < l.length; o++) {
            var u = l[o], p = e, v = t;
            if (dt) {
              var M = v;
              e: for (; M !== null; ) {
                switch (M.tag) {
                  case 27:
                    if (We) {
                      if (Oa(M.type)) {
                        Ke = M.stateNode, yt = !1;
                        break e;
                      }
                      break;
                    }
                  case 5:
                    Ke = M.stateNode, yt = !1;
                    break e;
                  case 3:
                  case 4:
                    Ke = M.stateNode.containerInfo, yt = !0;
                    break e;
                }
                M = M.return;
              }
              if (Ke === null) throw Error(s(160));
              zs(p, v, u), Ke = null, yt = !1;
            } else zs(p, v, u);
            p = u.alternate, p !== null && (p.return = null), u.return = null;
          }
        if (t.subtreeFlags & 13886)
          for (t = t.child; t !== null; )
            sd(t, e), t = t.sibling;
      }
      function sd(e, t) {
        var l = e.alternate, o = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ut(t, e), gt(e), o & 4 && (Tn(3, e, e.return), ml(3, e), Tn(5, e, e.return));
            break;
          case 1:
            ut(t, e), gt(e), o & 512 && (Xe || l === null || Wt(l, l.return)), o & 64 && gn && (e = e.updateQueue, e !== null && (o = e.callbacks, o !== null && (l = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = l === null ? o : l.concat(o))));
            break;
          case 26:
            if (Vt) {
              var u = Xt;
              if (ut(t, e), gt(e), o & 512 && (Xe || l === null || Wt(l, l.return)), o & 4) {
                o = l !== null ? l.memoizedState : null;
                var p = e.memoizedState;
                l === null ? p === null ? e.stateNode === null ? e.stateNode = Jg(
                  u,
                  e.type,
                  e.memoizedProps,
                  e
                ) : of(
                  u,
                  e.type,
                  e.stateNode
                ) : e.stateNode = rf(
                  u,
                  p,
                  e.memoizedProps
                ) : o !== p ? (o === null ? l.stateNode !== null && cf(l.stateNode) : sf(o), p === null ? of(
                  u,
                  e.type,
                  e.stateNode
                ) : rf(
                  u,
                  p,
                  e.memoizedProps
                )) : p === null && e.stateNode !== null && _s(
                  e,
                  e.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (We) {
              ut(t, e), gt(e), o & 512 && (Xe || l === null || Wt(l, l.return)), l !== null && o & 4 && _s(
                e,
                e.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (ut(t, e), gt(e), o & 512 && (Xe || l === null || Wt(l, l.return)), dt) {
              if (e.flags & 32) {
                u = e.stateNode;
                try {
                  Wd(u);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
              o & 4 && e.stateNode != null && (u = e.memoizedProps, _s(
                e,
                u,
                l !== null ? l.memoizedProps : u
              )), o & 1024 && (ho = !0);
            } else
              $t && e.alternate !== null && (e.alternate.stateNode = e.stateNode);
            break;
          case 6:
            if (ut(t, e), gt(e), o & 4 && dt) {
              if (e.stateNode === null)
                throw Error(s(162));
              o = e.memoizedProps, l = l !== null ? l.memoizedProps : o, u = e.stateNode;
              try {
                ng(u, l, o);
              } catch (P) {
                Ne(e, e.return, P);
              }
            }
            break;
          case 3:
            if (Vt ? ($g(), u = Xt, Xt = Fs(t.containerInfo), ut(t, e), Xt = u) : ut(t, e), gt(e), o & 4) {
              if (dt && ft && l !== null && l.memoizedState.isDehydrated)
                try {
                  Hg(t.containerInfo);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              if ($t) {
                o = t.containerInfo, l = t.pendingChildren;
                try {
                  Id(o, l);
                } catch (P) {
                  Ne(e, e.return, P);
                }
              }
            }
            ho && (ho = !1, od(e));
            break;
          case 4:
            Vt ? (l = Xt, Xt = Fs(
              e.stateNode.containerInfo
            ), ut(t, e), gt(e), Xt = l) : (ut(t, e), gt(e)), o & 4 && $t && td(
              e.stateNode,
              e,
              e.stateNode.pendingChildren
            );
            break;
          case 12:
            ut(t, e), gt(e);
            break;
          case 31:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, wr(e, o)));
            break;
          case 13:
            ut(t, e), gt(e), e.child.flags & 8192 && e.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Jr = vt()), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, wr(e, o)));
            break;
          case 22:
            u = e.memoizedState !== null;
            var v = l !== null && l.memoizedState !== null, M = gn, Y = Xe;
            if (gn = M || u, Xe = Y || v, ut(t, e), Xe = Y, gn = M, gt(e), o & 8192 && (t = e.stateNode, t._visibility = u ? t._visibility & -2 : t._visibility | 1, u && (l === null || v || gn || Xe || na(e)), dt)) {
              e: if (l = null, dt)
                for (t = e; ; ) {
                  if (t.tag === 5 || Vt && t.tag === 26) {
                    if (l === null) {
                      v = l = t;
                      try {
                        p = v.stateNode, u ? cg(p) : dg(
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
                        var F = v.stateNode;
                        u ? ug(F) : fg(F, v.memoizedProps);
                      } catch (P) {
                        Ne(v, v.return, P);
                      }
                    }
                  } else if (t.tag === 18) {
                    if (l === null) {
                      v = t;
                      try {
                        var ne = v.stateNode;
                        u ? Vg(ne) : Xg(v.stateNode);
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
            o & 4 && (o = e.updateQueue, o !== null && (l = o.retryQueue, l !== null && (o.retryQueue = null, wr(e, l))));
            break;
          case 19:
            ut(t, e), gt(e), o & 4 && (o = e.updateQueue, o !== null && (e.updateQueue = null, wr(e, o)));
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
              if (ed(o)) {
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
                    var u = l.stateNode, p = Ss(e);
                    xr(e, p, u);
                    break;
                  }
                case 5:
                  var v = l.stateNode;
                  l.flags & 32 && (Wd(v), l.flags &= -33);
                  var M = Ss(e);
                  xr(e, M, v);
                  break;
                case 3:
                case 4:
                  var Y = l.stateNode.containerInfo, F = Ss(e);
                  Es(
                    e,
                    F,
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
      function od(e) {
        if (e.subtreeFlags & 1024)
          for (e = e.child; e !== null; ) {
            var t = e;
            od(t), t.tag === 5 && t.flags & 1024 && Xh(t.stateNode), e = e.sibling;
          }
      }
      function cn(e, t) {
        if (t.subtreeFlags & 8772)
          for (t = t.child; t !== null; )
            ad(e, t.alternate, t), t = t.sibling;
      }
      function na(e) {
        for (e = e.child; e !== null; ) {
          var t = e;
          switch (t.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              Tn(4, t, t.return), na(t);
              break;
            case 1:
              Wt(t, t.return);
              var l = t.stateNode;
              typeof l.componentWillUnmount == "function" && Iu(
                t,
                t.return,
                l
              ), na(t);
              break;
            case 27:
              We && ff(t.stateNode);
            case 26:
            case 5:
              Wt(t, t.return), na(t);
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
      function un(e, t, l) {
        for (l = l && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; ) {
          var o = t.alternate, u = e, p = t, v = p.flags;
          switch (p.tag) {
            case 0:
            case 11:
            case 15:
              un(
                u,
                p,
                l
              ), ml(4, p);
              break;
            case 1:
              if (un(
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
                var M = o.stateNode;
                try {
                  var Y = u.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (u.shared.hiddenCallbacks = null, u = 0; u < Y.length; u++)
                      Qc(Y[u], M);
                } catch (F) {
                  Ne(o, o.return, F);
                }
              }
              l && v & 64 && Fu(p), hl(p, p.return);
              break;
            case 27:
              We && nd(p);
            case 26:
            case 5:
              un(
                u,
                p,
                l
              ), l && o === null && v & 4 && Pu(p), hl(p, p.return);
              break;
            case 12:
              un(
                u,
                p,
                l
              );
              break;
            case 31:
              un(
                u,
                p,
                l
              ), l && v & 4 && rd(u, p);
              break;
            case 13:
              un(
                u,
                p,
                l
              ), l && v & 4 && id(u, p);
              break;
            case 22:
              p.memoizedState === null && un(
                u,
                p,
                l
              ), hl(p, p.return);
              break;
            case 30:
              break;
            default:
              un(
                u,
                p,
                l
              );
          }
          t = t.sibling;
        }
      }
      function Ns(e, t) {
        var l = null;
        e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== l && (e != null && e.refCount++, l != null && rl(l));
      }
      function Ts(e, t) {
        e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && rl(e));
      }
      function Qt(e, t, l, o) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            cd(
              e,
              t,
              l,
              o
            ), t = t.sibling;
      }
      function cd(e, t, l, o) {
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
            ), u & 2048 && ml(9, t);
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
            ), u & 2048 && (e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && rl(e)));
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
            ) : gl(
              e,
              t
            ) : p._visibility & 2 ? Qt(
              e,
              t,
              l,
              o
            ) : (p._visibility |= 2, Ta(
              e,
              t,
              l,
              o,
              (t.subtreeFlags & 10256) !== 0 || !1
            )), u & 2048 && Ns(v, t);
            break;
          case 24:
            Qt(
              e,
              t,
              l,
              o
            ), u & 2048 && Ts(t.alternate, t);
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
      function Ta(e, t, l, o, u) {
        for (u = u && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child; t !== null; ) {
          var p = e, v = t, M = l, Y = o, F = v.flags;
          switch (v.tag) {
            case 0:
            case 11:
            case 15:
              Ta(
                p,
                v,
                M,
                Y,
                u
              ), ml(8, v);
              break;
            case 23:
              break;
            case 22:
              var ne = v.stateNode;
              v.memoizedState !== null ? ne._visibility & 2 ? Ta(
                p,
                v,
                M,
                Y,
                u
              ) : gl(
                p,
                v
              ) : (ne._visibility |= 2, Ta(
                p,
                v,
                M,
                Y,
                u
              )), u && F & 2048 && Ns(
                v.alternate,
                v
              );
              break;
            case 24:
              Ta(
                p,
                v,
                M,
                Y,
                u
              ), u && F & 2048 && Ts(v.alternate, v);
              break;
            default:
              Ta(
                p,
                v,
                M,
                Y,
                u
              );
          }
          t = t.sibling;
        }
      }
      function gl(e, t) {
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; ) {
            var l = e, o = t, u = o.flags;
            switch (o.tag) {
              case 22:
                gl(l, o), u & 2048 && Ns(
                  o.alternate,
                  o
                );
                break;
              case 24:
                gl(l, o), u & 2048 && Ts(
                  o.alternate,
                  o
                );
                break;
              default:
                gl(l, o);
            }
            t = t.sibling;
          }
      }
      function aa(e, t, l) {
        if (e.subtreeFlags & Ja)
          for (e = e.child; e !== null; )
            ud(
              e,
              t,
              l
            ), e = e.sibling;
      }
      function ud(e, t, l) {
        switch (e.tag) {
          case 26:
            if (aa(
              e,
              t,
              l
            ), e.flags & Ja)
              if (e.memoizedState !== null)
                Ig(
                  l,
                  Xt,
                  e.memoizedState,
                  e.memoizedProps
                );
              else {
                var o = e.stateNode, u = e.type;
                e = e.memoizedProps, ((t & 335544128) === t || Js(u, e)) && Jd(l, o, u, e);
              }
            break;
          case 5:
            aa(
              e,
              t,
              l
            ), e.flags & Ja && (o = e.stateNode, u = e.type, e = e.memoizedProps, ((t & 335544128) === t || Js(u, e)) && Jd(l, o, u, e));
            break;
          case 3:
          case 4:
            Vt ? (o = Xt, Xt = Fs(
              e.stateNode.containerInfo
            ), aa(
              e,
              t,
              l
            ), Xt = o) : aa(
              e,
              t,
              l
            );
            break;
          case 22:
            e.memoizedState === null && (o = e.alternate, o !== null && o.memoizedState !== null ? (o = Ja, Ja = 16777216, aa(
              e,
              t,
              l
            ), Ja = o) : aa(
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
      function dd(e) {
        var t = e.alternate;
        if (t !== null && (e = t.child, e !== null)) {
          t.child = null;
          do
            t = e.sibling, e.sibling = null, e = t;
          while (e !== null);
        }
      }
      function bl(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              et = o, pd(
                o,
                e
              );
            }
          dd(e);
        }
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            fd(e), e = e.sibling;
      }
      function fd(e) {
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            bl(e), e.flags & 2048 && Tn(9, e, e.return);
            break;
          case 3:
            bl(e);
            break;
          case 12:
            bl(e);
            break;
          case 22:
            var t = e.stateNode;
            e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, kr(e)) : bl(e);
            break;
          default:
            bl(e);
        }
      }
      function kr(e) {
        var t = e.deletions;
        if ((e.flags & 16) !== 0) {
          if (t !== null)
            for (var l = 0; l < t.length; l++) {
              var o = t[l];
              et = o, pd(
                o,
                e
              );
            }
          dd(e);
        }
        for (e = e.child; e !== null; ) {
          switch (t = e, t.tag) {
            case 0:
            case 11:
            case 15:
              Tn(8, t, t.return), kr(t);
              break;
            case 22:
              l = t.stateNode, l._visibility & 2 && (l._visibility &= -3, kr(t));
              break;
            default:
              kr(t);
          }
          e = e.sibling;
        }
      }
      function pd(e, t) {
        for (; et !== null; ) {
          var l = et;
          switch (l.tag) {
            case 0:
            case 11:
            case 15:
              Tn(8, l, t);
              break;
            case 23:
            case 22:
              if (l.memoizedState !== null && l.memoizedState.cachePool !== null) {
                var o = l.memoizedState.cachePool.pool;
                o != null && o.refCount++;
              }
              break;
            case 24:
              rl(l.memoizedState.cache);
          }
          if (o = l.child, o !== null) o.return = l, et = o;
          else
            e: for (l = e; et !== null; ) {
              o = et;
              var u = o.sibling, p = o.return;
              if (ld(o), o === l) {
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
      function Cs(e) {
        var t = Bh(e);
        if (t != null) {
          if (typeof t.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return t;
        }
        if (e = Jh(e), e === null) throw Error(s(362));
        return e.stateNode.current;
      }
      function As(e, t) {
        var l = e.tag;
        switch (t.$$typeof) {
          case Qr:
            if (e.type === t.value) return !0;
            break;
          case Vr:
            e: {
              for (t = t.value, e = [e, 0], l = 0; l < e.length; ) {
                var o = e[l++], u = o.tag, p = e[l++], v = t[p];
                if (u !== 5 && u !== 26 && u !== 27 || !wl(o)) {
                  for (; v != null && As(o, v); )
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
          case Xr:
            if ((l === 5 || l === 26 || l === 27) && Fh(e.stateNode, t.value))
              return !0;
            break;
          case Zr:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (e = $h(e), e !== null && 0 <= e.indexOf(t.value)))
              return !0;
            break;
          case Kr:
            if ((l === 5 || l === 26 || l === 27) && (e = e.memoizedProps["data-testname"], typeof e == "string" && e.toLowerCase() === t.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function Ms(e) {
        switch (e.$$typeof) {
          case Qr:
            return "<" + (y(e.value) || "Unknown") + ">";
          case Vr:
            return ":has(" + (Ms(e) || "") + ")";
          case Xr:
            return '[role="' + e.value + '"]';
          case Zr:
            return '"' + e.value + '"';
          case Kr:
            return '[data-testname="' + e.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function md(e, t) {
        var l = [];
        e = [e, 0];
        for (var o = 0; o < e.length; ) {
          var u = e[o++], p = u.tag, v = e[o++], M = t[v];
          if (p !== 5 && p !== 26 && p !== 27 || !wl(u)) {
            for (; M != null && As(u, M); )
              v++, M = t[v];
            if (v === t.length) l.push(u);
            else
              for (u = u.child; u !== null; )
                e.push(u, v), u = u.sibling;
          }
        }
        return l;
      }
      function js(e, t) {
        if (!xl) throw Error(s(363));
        e = Cs(e), e = md(e, t), t = [], e = Array.from(e);
        for (var l = 0; l < e.length; ) {
          var o = e[l++], u = o.tag;
          if (u === 5 || u === 26 || u === 27)
            wl(o) || t.push(o.stateNode);
          else
            for (o = o.child; o !== null; )
              e.push(o), o = o.sibling;
        }
        return t;
      }
      function kt() {
        return (xe & 2) !== 0 && ke !== 0 ? ke & -ke : de.T !== null ? Li() : Uh();
      }
      function hd() {
        if (Ct === 0)
          if ((ke & 536870912) === 0 || Se) {
            var e = Ar;
            Ar <<= 1, (Ar & 3932160) === 0 && (Ar = 262144), Ct = e;
          } else Ct = 536870912;
        return e = Nt.current, e !== null && (e.flags |= 32), Ct;
      }
      function bt(e, t, l) {
        (e === Re && (Ae === 2 || Ae === 9) || e.cancelPendingCommit !== null) && (Ca(e, 0), Cn(
          e,
          ke,
          Ct,
          !1
        )), T(e, l), ((xe & 2) === 0 || e !== Re) && (e === Re && ((xe & 2) === 0 && (pa |= l), qe === 4 && Cn(
          e,
          ke,
          Ct,
          !1
        )), Jt(e));
      }
      function gd(e, t, l) {
        if ((xe & 6) !== 0) throw Error(s(327));
        var o = !l && (t & 127) === 0 && (t & e.expiredLanes) === 0 || O(e, t), u = o ? hh(e, t) : Os(e, t, !0), p = o;
        do {
          if (u === 0) {
            Wa && !o && Cn(e, t, 0, !1);
            break;
          } else {
            if (l = e.current.alternate, p && !ph(l)) {
              u = Os(e, t, !1), p = !1;
              continue;
            }
            if (u === 2) {
              if (p = t, e.errorRecoveryDisabledLanes & p)
                var v = 0;
              else
                v = e.pendingLanes & -536870913, v = v !== 0 ? v : v & 536870912 ? 536870912 : 0;
              if (v !== 0) {
                t = v;
                e: {
                  var M = e;
                  u = Al;
                  var Y = ft && M.current.memoizedState.isDehydrated;
                  if (Y && (Ca(M, v).flags |= 256), v = Os(
                    M,
                    v,
                    !1
                  ), v !== 2) {
                    if (go && !Y) {
                      M.errorRecoveryDisabledLanes |= p, pa |= p, u = 4;
                      break e;
                    }
                    p = xt, xt = u, p !== null && (xt === null ? xt = p : xt.push.apply(
                      xt,
                      p
                    ));
                  }
                  u = v;
                }
                if (p = !1, u !== 2) continue;
              }
            }
            if (u === 1) {
              Ca(e, 0), Cn(e, t, 0, !0);
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
                  Cn(
                    o,
                    t,
                    Ct,
                    !Bn
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
              if ((t & 62914560) === t && (u = Jr + 300 - vt(), 10 < u)) {
                if (Cn(
                  o,
                  t,
                  Ct,
                  !Bn
                ), j(o, 0, !0) !== 0) break e;
                vn = t, o.timeoutHandle = Oh(
                  bd.bind(
                    null,
                    o,
                    l,
                    xt,
                    Wr,
                    vo,
                    t,
                    Ct,
                    pa,
                    $a,
                    Bn,
                    p,
                    "Throttled",
                    -0,
                    0
                  ),
                  u
                );
                break e;
              }
              bd(
                o,
                l,
                xt,
                Wr,
                vo,
                t,
                Ct,
                pa,
                $a,
                Bn,
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
      function bd(e, t, l, o, u, p, v, M, Y, F, ne, P, le, ge) {
        if (e.timeoutHandle = ra, P = t.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = Qh(), ud(
            t,
            p,
            P
          );
          var it = (p & 62914560) === p ? Jr - vt() : (p & 4194048) === p ? _f - vt() : 0;
          if (it = Vh(
            P,
            it
          ), it !== null) {
            vn = p, e.cancelPendingCommit = it(
              zd.bind(
                null,
                e,
                t,
                p,
                l,
                o,
                u,
                v,
                M,
                Y,
                ne,
                P,
                null,
                le,
                ge
              )
            ), Cn(e, p, v, !F);
            return;
          }
        }
        zd(
          e,
          t,
          p,
          l,
          o,
          u,
          v,
          M,
          Y
        );
      }
      function ph(e) {
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
      function Cn(e, t, l, o) {
        t &= ~bo, t &= ~pa, e.suspendedLanes |= t, e.pingedLanes &= ~t, o && (e.warmLanes |= t), o = e.expirationTimes;
        for (var u = t; 0 < u; ) {
          var p = 31 - St(u), v = 1 << p;
          o[p] = -1, u &= ~v;
        }
        l !== 0 && w(e, l, t);
      }
      function vd() {
        return (xe & 6) === 0 ? (za(0), !1) : !0;
      }
      function Rs() {
        if (we !== null) {
          if (Ae === 0)
            var e = we.return;
          else
            e = we, mn = sa = null, es(e), Qa = null, zl = 0, e = we;
          for (; e !== null; )
            $u(e.alternate, e), e = e.return;
          we = null;
        }
      }
      function Ca(e, t) {
        var l = e.timeoutHandle;
        l !== ra && (e.timeoutHandle = ra, Dh(l)), l = e.cancelPendingCommit, l !== null && (e.cancelPendingCommit = null, l()), vn = 0, Rs(), Re = e, we = l = dn(e.current, null), ke = t, Ae = 0, Tt = null, Bn = !1, Wa = O(e, t), go = !1, $a = Ct = bo = pa = Hn = qe = 0, xt = Al = null, vo = !1, (t & 8) !== 0 && (t |= t & 32);
        var o = e.entangledLanes;
        if (o !== 0)
          for (e = e.entanglements, o &= t; 0 < o; ) {
            var u = 31 - St(o), p = 1 << u;
            t |= e[u], o &= ~p;
          }
        return bn = t, lr(), l;
      }
      function yd(e, t) {
        be = null, de.H = Tl, t === Ya || t === Ur ? (t = qc(), Ae = 3) : t === so ? (t = qc(), Ae = 4) : Ae = t === po ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, Tt = t, we === null && (qe = 1, mr(
          e,
          Q(t, e.current)
        ));
      }
      function xd() {
        var e = Nt.current;
        return e === null ? !0 : (ke & 4194048) === ke ? Bt === null : (ke & 62914560) === ke || (ke & 536870912) !== 0 ? e === Bt : !1;
      }
      function wd() {
        var e = de.H;
        return de.H = Tl, e === null ? Tl : e;
      }
      function kd() {
        var e = de.A;
        return de.A = p0, e;
      }
      function _r() {
        qe = 4, Bn || (ke & 4194048) !== ke && Nt.current !== null || (Wa = !0), (Hn & 134217727) === 0 && (pa & 134217727) === 0 || Re === null || Cn(
          Re,
          ke,
          Ct,
          !1
        );
      }
      function Os(e, t, l) {
        var o = xe;
        xe |= 2;
        var u = wd(), p = kd();
        (Re !== e || ke !== t) && (Wr = null, Ca(e, t)), t = !1;
        var v = qe;
        e: do
          try {
            if (Ae !== 0 && we !== null) {
              var M = we, Y = Tt;
              switch (Ae) {
                case 8:
                  Rs(), v = 6;
                  break e;
                case 3:
                case 2:
                case 9:
                case 6:
                  Nt.current === null && (t = !0);
                  var F = Ae;
                  if (Ae = 0, Tt = null, Aa(e, M, Y, F), l && Wa) {
                    v = 0;
                    break e;
                  }
                  break;
                default:
                  F = Ae, Ae = 0, Tt = null, Aa(e, M, Y, F);
              }
            }
            mh(), v = qe;
            break;
          } catch (ne) {
            yd(e, ne);
          }
        while (!0);
        return t && e.shellSuspendCounter++, mn = sa = null, xe = o, de.H = u, de.A = p, we === null && (Re = null, ke = 0, lr()), v;
      }
      function mh() {
        for (; we !== null; ) _d(we);
      }
      function hh(e, t) {
        var l = xe;
        xe |= 2;
        var o = wd(), u = kd();
        Re !== e || ke !== t ? (Wr = null, Ml = vt() + 500, Ca(e, t)) : Wa = O(
          e,
          t
        );
        e: do
          try {
            if (Ae !== 0 && we !== null) {
              t = we;
              var p = Tt;
              t: switch (Ae) {
                case 1:
                  Ae = 0, Tt = null, Aa(e, t, p, 1);
                  break;
                case 2:
                case 9:
                  if (Hc(p)) {
                    Ae = 0, Tt = null, Sd(t);
                    break;
                  }
                  t = function() {
                    Ae !== 2 && Ae !== 9 || Re !== e || (Ae = 7), Jt(e);
                  }, p.then(t, t);
                  break e;
                case 3:
                  Ae = 7;
                  break e;
                case 4:
                  Ae = 5;
                  break e;
                case 7:
                  Hc(p) ? (Ae = 0, Tt = null, Sd(t)) : (Ae = 0, Tt = null, Aa(e, t, p, 7));
                  break;
                case 5:
                  var v = null;
                  switch (we.tag) {
                    case 26:
                      v = we.memoizedState;
                    case 5:
                    case 27:
                      var M = we, Y = M.type, F = M.pendingProps;
                      if (v ? uf(v) : Zd(M.stateNode, Y, F)) {
                        Ae = 0, Tt = null;
                        var ne = M.sibling;
                        if (ne !== null) we = ne;
                        else {
                          var P = M.return;
                          P !== null ? (we = P, Sr(P)) : we = null;
                        }
                        break t;
                      }
                  }
                  Ae = 0, Tt = null, Aa(e, t, p, 5);
                  break;
                case 6:
                  Ae = 0, Tt = null, Aa(e, t, p, 6);
                  break;
                case 8:
                  Rs(), qe = 6;
                  break e;
                default:
                  throw Error(s(462));
              }
            }
            gh();
            break;
          } catch (le) {
            yd(e, le);
          }
        while (!0);
        return mn = sa = null, de.H = o, de.A = u, xe = l, we !== null ? 0 : (Re = null, ke = 0, lr(), qe);
      }
      function gh() {
        for (; we !== null && !n0(); )
          _d(we);
      }
      function _d(e) {
        var t = Xu(
          e.alternate,
          e,
          bn
        );
        e.memoizedProps = e.pendingProps, t === null ? Sr(e) : we = t;
      }
      function Sd(e) {
        var t = e, l = t.alternate;
        switch (t.tag) {
          case 15:
          case 0:
            t = qu(
              l,
              t,
              t.pendingProps,
              t.type,
              void 0,
              ke
            );
            break;
          case 11:
            t = qu(
              l,
              t,
              t.pendingProps,
              t.type.render,
              t.ref,
              ke
            );
            break;
          case 5:
            es(t);
          default:
            $u(l, t), t = we = Od(t, bn), t = Xu(l, t, bn);
        }
        e.memoizedProps = e.pendingProps, t === null ? Sr(e) : we = t;
      }
      function Aa(e, t, l, o) {
        mn = sa = null, es(t), Qa = null, zl = 0;
        var u = t.return;
        try {
          if (ih(
            e,
            u,
            t,
            l,
            ke
          )) {
            qe = 1, mr(
              e,
              Q(l, e.current)
            ), we = null;
            return;
          }
        } catch (p) {
          if (u !== null) throw we = u, p;
          qe = 1, mr(
            e,
            Q(l, e.current)
          ), we = null;
          return;
        }
        t.flags & 32768 ? (Se || o === 1 ? e = !0 : Wa || (ke & 536870912) !== 0 ? e = !1 : (Bn = e = !0, (o === 2 || o === 9 || o === 3 || o === 6) && (o = Nt.current, o !== null && o.tag === 13 && (o.flags |= 16384))), Ed(t, e)) : Sr(t);
      }
      function Sr(e) {
        var t = e;
        do {
          if ((t.flags & 32768) !== 0) {
            Ed(
              t,
              Bn
            );
            return;
          }
          e = t.return;
          var l = ch(
            t.alternate,
            t,
            bn
          );
          if (l !== null) {
            we = l;
            return;
          }
          if (t = t.sibling, t !== null) {
            we = t;
            return;
          }
          we = t = e;
        } while (t !== null);
        qe === 0 && (qe = 5);
      }
      function Ed(e, t) {
        do {
          var l = uh(e.alternate, e);
          if (l !== null) {
            l.flags &= 32767, we = l;
            return;
          }
          if (l = e.return, l !== null && (l.flags |= 32768, l.subtreeFlags = 0, l.deletions = null), !t && (e = e.sibling, e !== null)) {
            we = e;
            return;
          }
          we = e = l;
        } while (e !== null);
        qe = 6, we = null;
      }
      function zd(e, t, l, o, u, p, v, M, Y) {
        e.cancelPendingCommit = null;
        do
          vl();
        while ($e !== 0);
        if ((xe & 6) !== 0) throw Error(s(327));
        if (t !== null) {
          if (t === e.current)
            throw Error(s(177));
          if (p = t.lanes | t.childLanes, p |= oo, h(
            e,
            l,
            p,
            v,
            M,
            Y
          ), e === Re && (we = Re = null, ke = 0), Fa = t, qn = e, vn = l, yo = p, xo = u, Sf = o, (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, xh(eo, function() {
            return Md(), null;
          })) : (e.callbackNode = null, e.callbackPriority = 0), o = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || o) {
            o = de.T, de.T = null, u = pn(), Pe(2), v = xe, xe |= 4;
            try {
              dh(e, t, l);
            } finally {
              xe = v, Pe(u), de.T = o;
            }
          }
          $e = 1, Nd(), Td(), Cd();
        }
      }
      function Nd() {
        if ($e === 1) {
          $e = 0;
          var e = qn, t = Fa, l = (t.flags & 13878) !== 0;
          if ((t.subtreeFlags & 13878) !== 0 || l) {
            l = de.T, de.T = null;
            var o = pn();
            Pe(2);
            var u = xe;
            xe |= 4;
            try {
              sd(t, e), jh(e.containerInfo);
            } finally {
              xe = u, Pe(o), de.T = l;
            }
          }
          e.current = t, $e = 2;
        }
      }
      function Td() {
        if ($e === 2) {
          $e = 0;
          var e = qn, t = Fa, l = (t.flags & 8772) !== 0;
          if ((t.subtreeFlags & 8772) !== 0 || l) {
            l = de.T, de.T = null;
            var o = pn();
            Pe(2);
            var u = xe;
            xe |= 4;
            try {
              ad(e, t.alternate, t);
            } finally {
              xe = u, Pe(o), de.T = l;
            }
          }
          $e = 3;
        }
      }
      function Cd() {
        if ($e === 4 || $e === 3) {
          $e = 0, a0();
          var e = qn, t = Fa, l = vn, o = Sf;
          (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0 ? $e = 5 : ($e = 0, Fa = qn = null, Ad(e, e.pendingLanes));
          var u = e.pendingLanes;
          if (u === 0 && (Un = null), N(l), t = t.stateNode, Et && typeof Et.onCommitFiberRoot == "function")
            try {
              Et.onCommitFiberRoot(
                kl,
                t,
                void 0,
                (t.current.flags & 128) === 128
              );
            } catch {
            }
          if (o !== null) {
            t = de.T, u = pn(), Pe(2), de.T = null;
            try {
              for (var p = e.onRecoverableError, v = 0; v < o.length; v++) {
                var M = o[v];
                p(M.value, {
                  componentStack: M.stack
                });
              }
            } finally {
              de.T = t, Pe(u);
            }
          }
          (vn & 3) !== 0 && vl(), Jt(e), u = e.pendingLanes, (l & 261930) !== 0 && (u & 42) !== 0 ? e === wo ? jl++ : (jl = 0, wo = e) : jl = 0, ft && Lg(), za(0);
        }
      }
      function Ad(e, t) {
        (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, rl(t)));
      }
      function vl() {
        return Nd(), Td(), Cd(), Md();
      }
      function Md() {
        if ($e !== 5) return !1;
        var e = qn, t = yo;
        yo = 0;
        var l = N(vn), o = 32 > l ? 32 : l;
        l = de.T;
        var u = pn();
        try {
          Pe(o), de.T = null, o = xo, xo = null;
          var p = qn, v = vn;
          if ($e = 0, Fa = qn = null, vn = 0, (xe & 6) !== 0)
            throw Error(s(331));
          var M = xe;
          if (xe |= 4, fd(p.current), cd(
            p,
            p.current,
            v,
            o
          ), xe = M, za(0, !1), Et && typeof Et.onPostCommitFiberRoot == "function")
            try {
              Et.onPostCommitFiberRoot(kl, p);
            } catch {
            }
          return !0;
        } finally {
          Pe(u), de.T = l, Ad(e, t);
        }
      }
      function jd(e, t, l) {
        t = Q(l, t), t = fs(e.stateNode, t, 2), e = En(e, t, 2), e !== null && (T(e, 2), Jt(e));
      }
      function Ne(e, t, l) {
        if (e.tag === 3)
          jd(e, e, l);
        else
          for (; t !== null; ) {
            if (t.tag === 3) {
              jd(
                t,
                e,
                l
              );
              break;
            } else if (t.tag === 1) {
              var o = t.stateNode;
              if (typeof t.type.getDerivedStateFromError == "function" || typeof o.componentDidCatch == "function" && (Un === null || !Un.has(o))) {
                e = Q(l, e), l = Mu(2), o = En(t, l, 2), o !== null && (ju(
                  l,
                  o,
                  t,
                  e
                ), T(o, 2), Jt(o));
                break;
              }
            }
            t = t.return;
          }
      }
      function Ds(e, t, l) {
        var o = e.pingCache;
        if (o === null) {
          o = e.pingCache = new m0();
          var u = /* @__PURE__ */ new Set();
          o.set(t, u);
        } else
          u = o.get(t), u === void 0 && (u = /* @__PURE__ */ new Set(), o.set(t, u));
        u.has(l) || (go = !0, u.add(l), e = bh.bind(null, e, t, l), t.then(e, e));
      }
      function bh(e, t, l) {
        var o = e.pingCache;
        o !== null && o.delete(t), e.pingedLanes |= e.suspendedLanes & l, e.warmLanes &= ~l, Re === e && (ke & l) === l && (qe === 4 || qe === 3 && (ke & 62914560) === ke && 300 > vt() - Jr ? (xe & 2) === 0 && Ca(e, 0) : bo |= l, $a === ke && ($a = 0)), Jt(e);
      }
      function Rd(e, t) {
        t === 0 && (t = K()), e = ea(e, t), e !== null && (T(e, t), Jt(e));
      }
      function vh(e) {
        var t = e.memoizedState, l = 0;
        t !== null && (l = t.retryLane), Rd(e, l);
      }
      function yh(e, t) {
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
        o !== null && o.delete(t), Rd(e, l);
      }
      function xh(e, t) {
        return jr(e, t);
      }
      function wh(e, t, l, o) {
        this.tag = e, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = o, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Bs(e) {
        return e = e.prototype, !(!e || !e.isReactComponent);
      }
      function dn(e, t) {
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
      function Od(e, t) {
        e.flags &= 65011714;
        var l = e.alternate;
        return l === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = l.childLanes, e.lanes = l.lanes, e.child = l.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = l.memoizedProps, e.memoizedState = l.memoizedState, e.updateQueue = l.updateQueue, e.type = l.type, t = l.dependencies, e.dependencies = t === null ? null : {
          lanes: t.lanes,
          firstContext: t.firstContext
        }), e;
      }
      function Er(e, t, l, o, u, p) {
        var v = 0;
        if (o = e, typeof e == "function") Bs(e) && (v = 1);
        else if (typeof e == "string")
          v = Vt && We ? af(e, l, lt.current) ? 26 : pf(e) ? 27 : 5 : Vt ? af(
            e,
            l,
            lt.current
          ) ? 26 : 5 : We && pf(e) ? 27 : 5;
        else
          e: switch (e) {
            case Ks:
              return e = r(31, l, t, u), e.elementType = Ks, e.lanes = p, e;
            case ja:
              return la(
                l.children,
                u,
                p,
                t
              );
            case Ld:
              v = 8, u |= 24;
              break;
            case Ls:
              return e = r(12, l, t, u | 2), e.elementType = Ls, e.lanes = p, e;
            case Qs:
              return e = r(13, l, t, u), e.elementType = Qs, e.lanes = p, e;
            case Vs:
              return e = r(19, l, t, u), e.elementType = Vs, e.lanes = p, e;
            default:
              if (typeof e == "object" && e !== null)
                switch (e.$$typeof) {
                  case An:
                    v = 10;
                    break e;
                  case Yd:
                    v = 9;
                    break e;
                  case Ys:
                    v = 11;
                    break e;
                  case Xs:
                    v = 14;
                    break e;
                  case Mn:
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
        return t = r(v, l, t, u), t.elementType = e, t.type = o, t.lanes = p, t;
      }
      function la(e, t, l, o) {
        return e = r(7, e, o, t), e.lanes = l, e;
      }
      function Hs(e, t, l) {
        return e = r(6, e, null, t), e.lanes = l, e;
      }
      function Dd(e) {
        var t = r(18, null, null, 0);
        return t.stateNode = e, t;
      }
      function Us(e, t, l) {
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
      function kh(e, t, l, o, u, p, v, M, Y) {
        this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = ra, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = J(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = J(0), this.hiddenUpdates = J(null), this.identifierPrefix = o, this.onUncaughtError = u, this.onCaughtError = p, this.onRecoverableError = v, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Bd(e, t, l, o, u, p, v, M, Y, F, ne, P) {
        return e = new kh(
          e,
          t,
          l,
          v,
          Y,
          F,
          ne,
          P,
          M
        ), t = 1, p === !0 && (t |= 24), p = r(3, null, null, t), e.current = p, p.stateNode = e, t = Gi(), t.refCount++, e.pooledCache = t, t.refCount++, p.memoizedState = {
          element: o,
          isDehydrated: l,
          cache: t
        }, Vi(p), e;
      }
      function Hd(e) {
        return e ? (e = Ba, e) : Ba;
      }
      function Ud(e) {
        var t = e._reactInternals;
        if (t === void 0)
          throw typeof e.render == "function" ? Error(s(188)) : (e = Object.keys(e).join(","), Error(s(268, e)));
        return e = d(t), e = e !== null ? m(e) : null, e === null ? null : yl(e.stateNode);
      }
      function qd(e, t, l, o, u, p) {
        u = Hd(u), o.context === null ? o.context = u : o.pendingContext = u, o = Sn(t), o.payload = { element: l }, p = p === void 0 ? null : p, p !== null && (o.callback = p), l = En(e, o, t), l !== null && (bt(l, e, t), sl(l, e, t));
      }
      function Gd(e, t) {
        if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
          var l = e.retryLane;
          e.retryLane = l !== 0 && l < t ? l : t;
        }
      }
      function qs(e, t) {
        Gd(e, t), (e = e.alternate) && Gd(e, t);
      }
      var ye = {}, _h = Q0, _t = X0(), Gs = Object.assign, Sh = Symbol.for("react.element"), zr = Symbol.for("react.transitional.element"), Ma = Symbol.for("react.portal"), ja = Symbol.for("react.fragment"), Ld = Symbol.for("react.strict_mode"), Ls = Symbol.for("react.profiler"), Yd = Symbol.for("react.consumer"), An = Symbol.for("react.context"), Ys = Symbol.for("react.forward_ref"), Qs = Symbol.for("react.suspense"), Vs = Symbol.for("react.suspense_list"), Xs = Symbol.for("react.memo"), Mn = Symbol.for("react.lazy"), Ks = Symbol.for("react.activity"), Eh = Symbol.for("react.memo_cache_sentinel"), Qd = Symbol.iterator, zh = Symbol.for("react.client.reference"), Nr = Array.isArray, de = _h.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Nh = a.rendererVersion, Th = a.rendererPackageName, Vd = a.extraDevToolsConfig, yl = a.getPublicInstance, Ch = a.getRootHostContext, Ah = a.getChildHostContext, Mh = a.prepareForCommit, jh = a.resetAfterCommit, Rh = a.createInstance;
      a.cloneMutableInstance;
      var Zs = a.appendInitialChild, Xd = a.finalizeInitialChildren, Tr = a.shouldSetTextContent, Kd = a.createTextInstance;
      a.cloneMutableTextInstance;
      var Oh = a.scheduleTimeout, Dh = a.cancelTimeout, ra = a.noTimeout, fn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var dt = a.supportsMutation, $t = a.supportsPersistence, ft = a.supportsHydration, Bh = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var Hh = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var Pe = a.setCurrentUpdatePriority, pn = a.getCurrentUpdatePriority, Uh = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var qh = a.shouldAttemptEagerTransition, Gh = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var Lh = a.maySuspendCommit, Yh = a.maySuspendCommitOnUpdate, Js = a.maySuspendCommitInSyncRender, Zd = a.preloadInstance, Qh = a.startSuspendingCommit, Jd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var Vh = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var Ra = a.NotPendingTransition, ia = a.HostTransitionContext, Xh = a.resetFormInstance;
      a.bindToConsole;
      var Kh = a.supportsMicrotasks, Zh = a.scheduleMicrotask, xl = a.supportsTestSelectors, Jh = a.findFiberRoot, Wh = a.getBoundingRect, $h = a.getTextContent, wl = a.isHiddenSubtree, Fh = a.matchAccessibilityRole, Ih = a.setFocusIfFocusable, Ph = a.setupIntersectionObserver, eg = a.appendChild, tg = a.appendChildToContainer, ng = a.commitTextUpdate, ag = a.commitMount, lg = a.commitUpdate, rg = a.insertBefore, ig = a.insertInContainerBefore, sg = a.removeChild, og = a.removeChildFromContainer, Wd = a.resetTextContent, cg = a.hideInstance, ug = a.hideTextInstance, dg = a.unhideInstance, fg = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var pg = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var mg = a.cloneInstance, $d = a.createContainerChildSet, Fd = a.appendChildToContainerChildSet, hg = a.finalizeContainerChildren, Id = a.replaceContainerChildren, Pd = a.cloneHiddenInstance, ef = a.cloneHiddenTextInstance, Ws = a.isSuspenseInstancePending, $s = a.isSuspenseInstanceFallback, gg = a.getSuspenseInstanceFallbackErrorDetails, bg = a.registerSuspenseInstanceRetry, vg = a.canHydrateFormStateMarker, yg = a.isFormStateMarkerMatching, tf = a.getNextHydratableSibling, xg = a.getNextHydratableSiblingAfterSingleton, wg = a.getFirstHydratableChild, kg = a.getFirstHydratableChildWithinContainer, _g = a.getFirstHydratableChildWithinActivityInstance, Sg = a.getFirstHydratableChildWithinSuspenseInstance, Eg = a.getFirstHydratableChildWithinSingleton, zg = a.canHydrateInstance, Ng = a.canHydrateTextInstance, Tg = a.canHydrateActivityInstance, Cg = a.canHydrateSuspenseInstance, Ag = a.hydrateInstance, Mg = a.hydrateTextInstance, jg = a.hydrateActivityInstance, Rg = a.hydrateSuspenseInstance, Og = a.getNextHydratableInstanceAfterActivityInstance, Dg = a.getNextHydratableInstanceAfterSuspenseInstance, Bg = a.commitHydratedInstance, Hg = a.commitHydratedContainer, Ug = a.commitHydratedActivityInstance, qg = a.commitHydratedSuspenseInstance, Gg = a.finalizeHydratedChildren, Lg = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var Yg = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var Qg = a.clearSuspenseBoundaryFromContainer, Vg = a.hideDehydratedBoundary, Xg = a.unhideDehydratedBoundary, nf = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var Kg = a.validateHydratableInstance, Zg = a.validateHydratableTextInstance, Vt = a.supportsResources, af = a.isHostHoistableType, Fs = a.getHoistableRoot, lf = a.getResource, rf = a.acquireResource, sf = a.releaseResource, Jg = a.hydrateHoistable, of = a.mountHoistable, cf = a.unmountHoistable, Wg = a.createHoistableInstance, $g = a.prepareToCommitHoistables, Fg = a.mayResourceSuspendCommit, uf = a.preloadResource, Ig = a.suspendResource, We = a.supportsSingletons, df = a.resolveSingletonInstance, Pg = a.acquireSingletonInstance, ff = a.releaseSingletonInstance, pf = a.isHostSingletonType, Oa = a.isSingletonScope, Is = [], Da = -1, Ba = {}, St = Math.clz32 ? Math.clz32 : R, e0 = Math.log, t0 = Math.LN2, Cr = 256, Ar = 262144, Mr = 4194304, jr = _t.unstable_scheduleCallback, Ps = _t.unstable_cancelCallback, n0 = _t.unstable_shouldYield, a0 = _t.unstable_requestPaint, vt = _t.unstable_now, mf = _t.unstable_ImmediatePriority, l0 = _t.unstable_UserBlockingPriority, eo = _t.unstable_NormalPriority, r0 = _t.unstable_IdlePriority, i0 = _t.log, s0 = _t.unstable_setDisableYieldValue, kl = null, Et = null, zt = typeof Object.is == "function" ? Object.is : G, hf = typeof reportError == "function" ? reportError : function(e) {
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
      }, o0 = Object.prototype.hasOwnProperty, to, gf, no = !1, bf = /* @__PURE__ */ new WeakMap(), Ha = [], Ua = 0, Rr = null, _l = 0, jt = [], Rt = 0, jn = null, Ft = 1, It = "", lt = b(null), Sl = b(null), Rn = b(null), Or = b(null), rt = null, De = null, Se = !1, On = null, Ot = !1, ao = Error(s(519)), Dr = b(null), sa = null, mn = null, c0 = typeof AbortController < "u" ? AbortController : function() {
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
      }, u0 = _t.unstable_scheduleCallback, d0 = _t.unstable_NormalPriority, Be = {
        $$typeof: An,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, Br = null, qa = null, lo = !1, Hr = !1, ro = !1, oa = 0, El = null, io = 0, Ga = 0, La = null, vf = de.S;
      de.S = function(e, t) {
        _f = vt(), typeof t == "object" && t !== null && typeof t.then == "function" && Im(e, t), vf !== null && vf(e, t);
      };
      var ca = b(null), Ya = Error(s(460)), so = Error(s(474)), Ur = Error(s(542)), qr = { then: function() {
      } }, ua = null, Qa = null, zl = 0, da = Lc(!0), yf = Lc(!1), Dt = [], Va = 0, oo = 0, Dn = !1, co = !1, Xa = b(null), Gr = b(0), Nt = b(null), Bt = null, Ye = b(0), hn = 0, be = null, Me = null, Qe = null, Lr = !1, Ka = !1, fa = !1, Yr = 0, Nl = 0, Za = null, f0 = 0, Tl = {
        readContext: nt,
        use: cr,
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
      Tl.useEffectEvent = Ue;
      var xf = {
        readContext: nt,
        use: cr,
        useCallback: function(e, t) {
          return ht().memoizedState = [
            e,
            t === void 0 ? null : t
          ], e;
        },
        useContext: nt,
        useEffect: fu,
        useImperativeHandle: function(e, t, l) {
          l = l != null ? l.concat([e]) : null, dr(
            4194308,
            4,
            gu.bind(null, t, e),
            l
          );
        },
        useLayoutEffect: function(e, t) {
          return dr(4194308, 4, e, t);
        },
        useInsertionEffect: function(e, t) {
          dr(4, 2, e, t);
        },
        useMemo: function(e, t) {
          var l = ht();
          t = t === void 0 ? null : t;
          var o = e();
          if (fa) {
            D(!0);
            try {
              e();
            } finally {
              D(!1);
            }
          }
          return l.memoizedState = [o, t], o;
        },
        useReducer: function(e, t, l) {
          var o = ht();
          if (l !== void 0) {
            var u = l(t);
            if (fa) {
              D(!0);
              try {
                l(t);
              } finally {
                D(!1);
              }
            }
          } else u = t;
          return o.memoizedState = o.baseState = u, e = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: e,
            lastRenderedState: u
          }, o.queue = e, e = e.dispatch = rh.bind(
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
          e = ls(e);
          var t = e.queue, l = Eu.bind(
            null,
            be,
            t
          );
          return t.dispatch = l, [e.memoizedState, l];
        },
        useDebugValue: ss,
        useDeferredValue: function(e, t) {
          var l = ht();
          return os(l, e, t);
        },
        useTransition: function() {
          var e = ls(!1);
          return e = wu.bind(
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
            if (l = t(), Re === null)
              throw Error(s(349));
            (ke & 127) !== 0 || $c(o, t, l);
          }
          u.memoizedState = l;
          var p = { value: l, getSnapshot: t };
          return u.queue = p, fu(Ic.bind(null, o, p, e), [
            e
          ]), o.flags |= 2048, Na(
            9,
            { destroy: void 0 },
            Fc.bind(
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
          var e = ht(), t = Re.identifierPrefix;
          if (Se) {
            var l = It, o = Ft;
            l = (o & ~(1 << 32 - St(o) - 1)).toString(32) + l, t = "_" + t + "R_" + l, l = Yr++, 0 < l && (t += "H" + l.toString(32)), t += "_";
          } else
            l = f0++, t = "_" + t + "r_" + l.toString(32) + "_";
          return e.memoizedState = t;
        },
        useHostTransitionStatus: cs,
        useFormState: su,
        useActionState: su,
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
          return t.queue = l, t = us.bind(
            null,
            be,
            !0,
            l
          ), l.dispatch = t, [e, t];
        },
        useMemoCache: ts,
        useCacheRefresh: function() {
          return ht().memoizedState = lh.bind(
            null,
            be
          );
        },
        useEffectEvent: function(e) {
          var t = ht(), l = { impl: e };
          return t.memoizedState = l, function() {
            if ((xe & 2) !== 0)
              throw Error(s(440));
            return l.impl.apply(void 0, arguments);
          };
        }
      }, uo = {
        readContext: nt,
        use: cr,
        useCallback: vu,
        useContext: nt,
        useEffect: is,
        useImperativeHandle: bu,
        useInsertionEffect: mu,
        useLayoutEffect: hu,
        useMemo: yu,
        useReducer: ur,
        useRef: du,
        useState: function() {
          return ur(sn);
        },
        useDebugValue: ss,
        useDeferredValue: function(e, t) {
          var l = Le();
          return xu(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = ur(sn)[0], t = Le().memoizedState;
          return [
            typeof e == "boolean" ? e : ul(e),
            t
          ];
        },
        useSyncExternalStore: Wc,
        useId: _u,
        useHostTransitionStatus: cs,
        useFormState: ou,
        useActionState: ou,
        useOptimistic: function(e, t) {
          var l = Le();
          return tu(l, Me, e, t);
        },
        useMemoCache: ts,
        useCacheRefresh: Su
      };
      uo.useEffectEvent = pu;
      var wf = {
        readContext: nt,
        use: cr,
        useCallback: vu,
        useContext: nt,
        useEffect: is,
        useImperativeHandle: bu,
        useInsertionEffect: mu,
        useLayoutEffect: hu,
        useMemo: yu,
        useReducer: as,
        useRef: du,
        useState: function() {
          return as(sn);
        },
        useDebugValue: ss,
        useDeferredValue: function(e, t) {
          var l = Le();
          return Me === null ? os(l, e, t) : xu(
            l,
            Me.memoizedState,
            e,
            t
          );
        },
        useTransition: function() {
          var e = as(sn)[0], t = Le().memoizedState;
          return [
            typeof e == "boolean" ? e : ul(e),
            t
          ];
        },
        useSyncExternalStore: Wc,
        useId: _u,
        useHostTransitionStatus: cs,
        useFormState: uu,
        useActionState: uu,
        useOptimistic: function(e, t) {
          var l = Le();
          return Me !== null ? tu(l, Me, e, t) : (l.baseState = e, [e, l.queue.dispatch]);
        },
        useMemoCache: ts,
        useCacheRefresh: Su
      };
      wf.useEffectEvent = pu;
      var fo = {
        enqueueSetState: function(e, t, l) {
          e = e._reactInternals;
          var o = kt(), u = Sn(o);
          u.payload = t, l != null && (u.callback = l), t = En(e, u, o), t !== null && (bt(t, e, o), sl(t, e, o));
        },
        enqueueReplaceState: function(e, t, l) {
          e = e._reactInternals;
          var o = kt(), u = Sn(o);
          u.tag = 1, u.payload = t, l != null && (u.callback = l), t = En(e, u, o), t !== null && (bt(t, e, o), sl(t, e, o));
        },
        enqueueForceUpdate: function(e, t) {
          e = e._reactInternals;
          var l = kt(), o = Sn(l);
          o.tag = 2, t != null && (o.callback = t), t = En(e, o, l), t !== null && (bt(t, e, l), sl(t, e, l));
        }
      }, po = Error(s(461)), Ve = !1, mo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, gn = !1, Xe = !1, ho = !1, kf = typeof WeakSet == "function" ? WeakSet : Set, et = null, Ke = null, yt = !1, Xt = null, Ja = 8192, p0 = {
        getCacheForType: function(e) {
          var t = nt(Be), l = t.data.get(e);
          return l === void 0 && (l = e(), t.data.set(e, l)), l;
        },
        cacheSignal: function() {
          return nt(Be).controller.signal;
        }
      }, Qr = 0, Vr = 1, Xr = 2, Kr = 3, Zr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Cl = Symbol.for;
        Qr = Cl("selector.component"), Vr = Cl("selector.has_pseudo_class"), Xr = Cl("selector.role"), Kr = Cl("selector.test_id"), Zr = Cl("selector.text");
      }
      var m0 = typeof WeakMap == "function" ? WeakMap : Map, xe = 0, Re = null, we = null, ke = 0, Ae = 0, Tt = null, Bn = !1, Wa = !1, go = !1, bn = 0, qe = 0, Hn = 0, pa = 0, bo = 0, Ct = 0, $a = 0, Al = null, xt = null, vo = !1, Jr = 0, _f = 0, Ml = 1 / 0, Wr = null, Un = null, $e = 0, qn = null, Fa = null, vn = 0, yo = 0, xo = null, Sf = null, jl = 0, wo = null;
      return ye.attemptContinuousHydration = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = ea(e, 67108864);
          t !== null && bt(t, e, 67108864), qs(e, 67108864);
        }
      }, ye.attemptHydrationAtCurrentPriority = function(e) {
        if (e.tag === 13 || e.tag === 31) {
          var t = kt();
          t = C(t);
          var l = ea(e, t);
          l !== null && bt(l, e, t), qs(e, t);
        }
      }, ye.attemptSynchronousHydration = function(e) {
        switch (e.tag) {
          case 3:
            if (e = e.stateNode, e.current.memoizedState.isDehydrated) {
              var t = z(e.pendingLanes);
              if (t !== 0) {
                for (e.pendingLanes |= 2, e.entangledLanes |= 2; t; ) {
                  var l = 1 << 31 - St(t);
                  e.entanglements[1] |= l, t &= ~l;
                }
                Jt(e), (xe & 6) === 0 && (Ml = vt() + 500, za(0));
              }
            }
            break;
          case 31:
          case 13:
            t = ea(e, 2), t !== null && bt(t, e, 2), vd(), qs(e, 2);
        }
      }, ye.batchedUpdates = function(e, t) {
        return e(t);
      }, ye.createComponentSelector = function(e) {
        return { $$typeof: Qr, value: e };
      }, ye.createContainer = function(e, t, l, o, u, p, v, M, Y, F) {
        return Bd(
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
          F
        );
      }, ye.createHasPseudoClassSelector = function(e) {
        return { $$typeof: Vr, value: e };
      }, ye.createHydrationContainer = function(e, t, l, o, u, p, v, M, Y, F, ne, P, le, ge) {
        return e = Bd(
          l,
          o,
          !0,
          e,
          u,
          p,
          M,
          ge,
          Y,
          F,
          ne,
          P
        ), e.context = Hd(null), l = e.current, o = kt(), o = C(o), u = Sn(o), u.callback = t ?? null, En(l, u, o), t = o, e.current.lanes = t, T(e, t), Jt(e), e;
      }, ye.createPortal = function(e, t, l) {
        var o = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: Ma,
          key: o == null ? null : "" + o,
          children: e,
          containerInfo: t,
          implementation: l
        };
      }, ye.createRoleSelector = function(e) {
        return { $$typeof: Xr, value: e };
      }, ye.createTestNameSelector = function(e) {
        return { $$typeof: Kr, value: e };
      }, ye.createTextSelector = function(e) {
        return { $$typeof: Zr, value: e };
      }, ye.defaultOnCaughtError = function(e) {
        console.error(e);
      }, ye.defaultOnRecoverableError = function(e) {
        hf(e);
      }, ye.defaultOnUncaughtError = function(e) {
        hf(e);
      }, ye.deferredUpdates = function(e) {
        var t = de.T, l = pn();
        try {
          return Pe(32), de.T = null, e();
        } finally {
          Pe(l), de.T = t;
        }
      }, ye.discreteUpdates = function(e, t, l, o, u) {
        var p = de.T, v = pn();
        try {
          return Pe(2), de.T = null, e(t, l, o, u);
        } finally {
          Pe(v), de.T = p, xe === 0 && (Ml = vt() + 500);
        }
      }, ye.findAllNodes = js, ye.findBoundingRects = function(e, t) {
        if (!xl) throw Error(s(363));
        t = js(e, t), e = [];
        for (var l = 0; l < t.length; l++)
          e.push(Wh(t[l]));
        for (t = e.length - 1; 0 < t; t--) {
          l = e[t];
          for (var o = l.x, u = o + l.width, p = l.y, v = p + l.height, M = t - 1; 0 <= M; M--)
            if (t !== M) {
              var Y = e[M], F = Y.x, ne = F + Y.width, P = Y.y, le = P + Y.height;
              if (o >= F && p >= P && u <= ne && v <= le) {
                e.splice(t, 1);
                break;
              } else if (o !== F || l.width !== Y.width || le < p || P > v) {
                if (!(p !== P || l.height !== Y.height || ne < o || F > u)) {
                  F > o && (Y.width += F - o, Y.x = o), ne < u && (Y.width = u - F), e.splice(t, 1);
                  break;
                }
              } else {
                P > p && (Y.height += P - p, Y.y = p), le < v && (Y.height = v - P), e.splice(t, 1);
                break;
              }
            }
        }
        return e;
      }, ye.findHostInstance = Ud, ye.findHostInstanceWithNoPortals = function(e) {
        return e = d(e), e = e !== null ? g(e) : null, e === null ? null : yl(e.stateNode);
      }, ye.findHostInstanceWithWarning = function(e) {
        return Ud(e);
      }, ye.flushPassiveEffects = vl, ye.flushSyncFromReconciler = function(e) {
        var t = xe;
        xe |= 1;
        var l = de.T, o = pn();
        try {
          if (Pe(2), de.T = null, e)
            return e();
        } finally {
          Pe(o), de.T = l, xe = t, (xe & 6) === 0 && za(0);
        }
      }, ye.flushSyncWork = vd, ye.focusWithin = function(e, t) {
        if (!xl) throw Error(s(363));
        for (e = Cs(e), t = md(e, t), t = Array.from(t), e = 0; e < t.length; ) {
          var l = t[e++], o = l.tag;
          if (!wl(l)) {
            if ((o === 5 || o === 26 || o === 27) && Ih(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
          }
        }
        return !1;
      }, ye.getFindAllNodesFailureDescription = function(e, t) {
        if (!xl) throw Error(s(363));
        var l = 0, o = [];
        e = [Cs(e), 0];
        for (var u = 0; u < e.length; ) {
          var p = e[u++], v = p.tag, M = e[u++], Y = t[M];
          if ((v !== 5 && v !== 26 && v !== 27 || !wl(p)) && (As(p, Y) && (o.push(Ms(Y)), M++, M > l && (l = M)), M < t.length))
            for (p = p.child; p !== null; )
              e.push(p, M), p = p.sibling;
        }
        if (l < t.length) {
          for (e = []; l < t.length; l++)
            e.push(Ms(t[l]));
          return `findAllNodes was able to match part of the selector:
  ` + (o.join(" > ") + `

No matching component was found for:
  `) + e.join(" > ");
        }
        return null;
      }, ye.getPublicRootInstance = function(e) {
        if (e = e.current, !e.child) return null;
        switch (e.child.tag) {
          case 27:
          case 5:
            return yl(e.child.stateNode);
          default:
            return e.child.stateNode;
        }
      }, ye.injectIntoDevTools = function() {
        var e = {
          bundleType: 0,
          version: Nh,
          rendererPackageName: Th,
          currentDispatcherRef: de,
          reconcilerVersion: "19.2.0"
        };
        if (Vd !== null && (e.rendererConfig = Vd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") e = !1;
        else {
          var t = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (t.isDisabled || !t.supportsFiber) e = !0;
          else {
            try {
              kl = t.inject(e), Et = t;
            } catch {
            }
            e = !!t.checkDCE;
          }
        }
        return e;
      }, ye.isAlreadyRendering = function() {
        return (xe & 6) !== 0;
      }, ye.observeVisibleRects = function(e, t, l, o) {
        if (!xl) throw Error(s(363));
        e = js(e, t);
        var u = Ph(
          e,
          l,
          o
        ).disconnect;
        return {
          disconnect: function() {
            u();
          }
        };
      }, ye.shouldError = function() {
        return null;
      }, ye.shouldSuspend = function() {
        return !1;
      }, ye.startHostTransition = function(e, t, l, o) {
        if (e.tag !== 5) throw Error(s(476));
        var u = ku(e).queue;
        wu(
          e,
          u,
          t,
          Ra,
          l === null ? i : function() {
            var p = ku(e);
            return p.next === null && (p = e.alternate.memoizedState), dl(
              e,
              p.next.queue,
              {},
              kt()
            ), l(o);
          }
        );
      }, ye.updateContainer = function(e, t, l, o) {
        var u = t.current, p = kt();
        return qd(
          u,
          p,
          e,
          t,
          l,
          o
        ), p;
      }, ye.updateContainerSync = function(e, t, l, o) {
        return qd(
          t.current,
          2,
          e,
          t,
          l,
          o
        ), 2;
      }, ye;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Eo)), Eo.exports;
}
var Hf;
function Z0() {
  return Hf || (Hf = 1, So.exports = K0()), So.exports;
}
var J0 = Z0();
const W0 = /* @__PURE__ */ oc(J0);
var To = { exports: {} }, yn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Uf;
function $0() {
  return Uf || (Uf = 1, yn.ConcurrentRoot = 1, yn.ContinuousEventPriority = 8, yn.DefaultEventPriority = 32, yn.DiscreteEventPriority = 2, yn.IdleEventPriority = 268435456, yn.LegacyRoot = 0, yn.NoEventPriority = 0), yn;
}
var qf;
function F0() {
  return qf || (qf = 1, To.exports = $0()), To.exports;
}
var Xl = F0();
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
const Up = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Go = 16, Ri = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), I0 = [
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
], Gf = {
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
}, P0 = /* @__PURE__ */ new Set([
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
]), qp = {
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
}, Gp = {
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
}, Lo = ["font-size", "color", ...new Set([...Object.keys(qp), ...Object.keys(Gp)].filter((n) => n !== "font-size" && n !== "color"))], eb = new Set(Lo);
function ot(n, a = " ") {
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
function Yo(n, a, r = 0) {
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
    const m = n.slice(c + 4, d - 1), g = ot(m, ","), x = g[0].trim(), y = g.length > 1 ? m.slice(m.indexOf(",") + 1).trim() : null;
    let b = a(x);
    if ((b == null || b === "initial") && (b = y), b == null) return null;
    const S = Yo(b, a, r + 1);
    if (S === null) return null;
    i += S, s = d;
  }
}
function tb(n) {
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
  const r = tb(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!r) return null;
  let i = 0;
  const s = ({ num: b, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: b, unitless: !0 };
      case "px":
        return { px: b, pct: 0, num: 0 };
      case "rem":
        return { px: b * Go, pct: 0, num: 0 };
      case "em":
        return { px: b * (a.fontSize ?? Go), pct: 0, num: 0 };
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
  }, c = (b, S, E) => b && S ? { px: b.px + E * S.px, pct: b.pct + E * S.pct, num: b.num + E * S.num, unitless: b.unitless && S.unitless } : null, f = (b, S) => b ? { px: b.px * S, pct: b.pct * S, num: b.num * S, unitless: b.unitless } : null, d = (b) => b && b.unitless;
  function m() {
    const b = r[i++];
    if (!b) return null;
    if (b.num !== void 0) return s(b);
    if (b.op === "(") {
      const S = x();
      return r[i]?.op !== ")" ? null : (i++, S);
    }
    if (b.op === "-" || b.op === "+") {
      const S = m();
      return b.op === "-" ? f(S, -1) : S;
    }
    if (b.fn) {
      const S = [];
      for (; ; ) {
        S.push(x());
        const z = r[i++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (S.some((z) => !z)) return null;
      if (b.fn === "calc") return S[0];
      if (!(S.every((z) => !z.pct) || S.every((z) => !z.px && !z.num))) return null;
      const R = (z) => z.px + z.pct + z.num;
      return b.fn === "min" ? S.reduce((z, j) => R(j) < R(z) ? j : z) : b.fn === "max" ? S.reduce((z, j) => R(j) > R(z) ? j : z) : b.fn === "clamp" && S.length === 3 ? R(S[1]) < R(S[0]) ? S[0] : R(S[1]) > R(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function g() {
    let b = m();
    for (; r[i] && (r[i].op === "*" || r[i].op === "/"); ) {
      const S = r[i++].op, E = m();
      if (!b || !E) return null;
      S === "*" ? b = d(E) ? f(b, E.num) : d(b) ? f(E, b.num) : null : b = d(E) && E.num !== 0 ? f(b, 1 / E.num) : null;
    }
    return b;
  }
  function x() {
    let b = g();
    for (; r[i] && (r[i].op === "+" || r[i].op === "-"); ) {
      const S = r[i++].op;
      b = c(b, g(), S === "-" ? -1 : 1);
    }
    return b;
  }
  const y = x();
  return i !== r.length || !y ? null : y;
}
function Qo(n, a) {
  const r = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(r))
    return r === "thin" ? { px: 1 } : r === "medium" ? { px: 3 } : r === "thick" ? { px: 5 } : r;
  const i = Zn(r, a);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: nb(i.px) } : { expr: n.trim() };
}
const nb = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Fr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), ab = ([n, a, r, i]) => `#${Fr(n)}${Fr(a)}${Fr(r)}${Fr(i * 255)}`;
function Lf(n) {
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
    const g = a(i[1]), x = g && Lf(g);
    return x ? { rgba: x, token: i[1] } : null;
  }
  if (r.startsWith("#")) {
    const g = Lf(r);
    return g ? { rgba: g, token: null } : null;
  }
  if (Gf[r]) return { rgba: [...Gf[r]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(r);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const g = ot(s[2], ",");
    if (g.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(g[0])) return null;
    const x = (D) => {
      const G = ot(D), $ = G.findIndex((I) => /%$/.test(I)), q = $ >= 0 ? parseFloat(G[$]) / 100 : null;
      return { color: hi(G.filter((I, Q) => Q !== $).join(" "), a), pct: q };
    }, y = x(g[1]), b = x(g[2]);
    if (!y.color || !b.color || y.color === "currentcolor" || b.color === "currentcolor") return null;
    let S = y.pct, E = b.pct;
    S === null && E === null ? (S = 0.5, E = 0.5) : S === null ? S = 1 - E : E === null && (E = 1 - S);
    const R = S + E, z = R < 1 ? R : 1;
    S /= R, E /= R;
    const [j, O, H, K] = y.color.rgba, [J, T, h, w] = b.color.rgba, k = K * S + w * E, _ = (D, G) => k === 0 ? 0 : (D * K * S + G * w * E) / k, C = [_(j, J), _(O, T), _(H, h), k * z], N = w === 0 ? y.color.token : K === 0 ? b.color.token : null;
    return { rgba: C, token: N };
  }
  const c = s[2].includes(",") ? ot(s[2], ",") : ot(s[2].replace("/", " / ")).filter((g) => g !== "/");
  if (c.length < 3) return null;
  const f = (g) => g.endsWith("%") ? parseFloat(g) / 100 * 255 : parseFloat(g), d = c[3] === void 0 ? 1 : c[3].endsWith("%") ? parseFloat(c[3]) / 100 : parseFloat(c[3]), m = [f(c[0]), f(c[1]), f(c[2]), d];
  return m.some((g) => Number.isNaN(g)) ? null : { rgba: m, token: null };
}
const ql = ["top", "right", "bottom", "left"], lb = ["top-left", "top-right", "bottom-right", "bottom-left"], Ir = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Yf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Vo(n, a) {
  const r = a.trim(), i = () => ot(r);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Ir(i());
      return ql.map((c, f) => [`${n}-${c}`, s[f]]);
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
      const s = Ir(i());
      return ql.map((c, f) => [c, s[f]]);
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
      const s = n.split("-")[1], c = Ir(i());
      return ql.map((f, d) => [`border-${f}-${s}`, c[d]]);
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
      const s = n === "border" ? ql : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let c = "medium", f = "none", d = "currentcolor";
      if (r !== "none" && r !== "0")
        for (const m of i())
          Yf.has(m) ? f = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? c = m : d = m;
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
      const s = Ir(ot(r.split("/")[0]));
      return lb.map((c, f) => [`border-${c}-radius`, s[f]]);
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
      return Vo("gap", r);
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
        Yf.has(d) || d === "auto" ? c = d : /^(thin|medium|thick|-?[\d.]|calc\()/.test(d) ? s = d : f = d;
      return [["outline-width", s], ["outline-style", c], ["outline-color", f]];
    }
    case "transition": {
      if (r === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ot(r, ","), c = s.map((d) => ot(d).find((m) => !/^[\d.]+m?s$/.test(m) && !/^(ease|linear|step|cubic)/.test(m)) ?? "all"), f = s.map((d) => ot(d).find((m) => /^[\d.]+m?s$/.test(m)) ?? "0s");
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
function rb(n, a) {
  return n ? ot(n, ",").some((r) => {
    let i = r.trim().toLowerCase(), s = !1;
    i.startsWith("not ") && (s = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const c = i.split(/\s+and\s+/).every((f) => {
      if (f = f.trim(), f === "all" || f === "screen") return !0;
      if (f === "print") return !1;
      const d = /^\((.+)\)$/.exec(f);
      if (!d) return !1;
      const m = d[1].trim(), g = /^([a-z-]+)\s*:\s*(.+)$/.exec(m);
      if (g) {
        const [, y, b] = g, S = (E) => {
          const R = Qo(E, { viewport: a });
          return typeof R == "object" && "px" in R ? R.px : NaN;
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
      const x = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(m);
      if (x) {
        const y = x[1] === "width" ? a.width : a.height, b = Qo(x[3], { viewport: a }), S = typeof b == "object" && "px" in b ? b.px : NaN;
        switch (x[2]) {
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
    return s ? !c : c;
  }) : !0;
}
function ib(n, a) {
  const r = a[a.length - 1].compound;
  return cc(r)[0] ?? n;
}
function sb(n) {
  const a = (r) => r.some((i) => Ri.has(i.name) || (i.list ?? []).some((s) => s.some(({ compound: c }) => a(c.pseudos))));
  return a(n[n.length - 1].compound.pseudos);
}
function ob(n) {
  const a = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = (s, c) => {
    s.forEach(({ compound: f }, d) => {
      const m = c && d === s.length - 1;
      for (const g of f.pseudos)
        if (Ri.has(g.name) && (m ? a : r).add(g.name), g.list && g.name !== "not") for (const x of g.list) i(x, m);
    });
  };
  return i(n, !0), { subject: a, ancestor: r };
}
function cc(n) {
  const a = [...n.classes];
  for (const r of n.pseudos)
    if (!(r.name !== "is" && r.name !== "where"))
      for (const i of r.list) i.length === 1 && a.push(...cc(i[0].compound));
  return a;
}
function cb(n, a) {
  const r = (i, s) => {
    i.forEach(({ compound: c }, f) => {
      const d = s && f === i.length - 1, m = c.pseudos.filter((g) => Ri.has(g.name)).map((g) => g.name);
      if (!d) for (const g of m) for (const x of cc(c)) a.add(`${g}:${x}`);
      for (const g of c.pseudos) if (g.list && g.name !== "not") for (const x of g.list) r(x, d);
    });
  };
  r(n, !0);
}
class ub {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const r = (c, f) => {
      const d = f[f.length - 1].compound, m = d.classes.length ? `.${d.classes[0]}` : d.tag && d.tag !== "*" ? d.tag : "*";
      this.index.has(m) || this.index.set(m, []), this.index.get(m).push(c);
    };
    let i = 0;
    const s = (c, f) => {
      for (const [d, m, g, x] of c)
        for (const y of rc(d)) {
          let b;
          try {
            b = ic(y);
          } catch (z) {
            if (z instanceof st) {
              this.skipped++;
              continue;
            }
            throw z;
          }
          const S = ob(b);
          cb(b, this.trackedStates);
          const E = b[b.length - 1].compound.pseudoElement, R = { steps: b, media: m, layer: g, origin: f, order: i++, specificity: Tp(b), decls: x, states: S, pseudo: E, own: mb(b), assumed: sb(b), above: fb(b), source: f === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : ib(y, b) };
          this.rules.push(R), r(R, b);
        }
    };
    s(I0.map(([c, f]) => [c, null, 0, Object.entries(f)]), 0), s(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, r = null) {
    const i = `${a.tagName} ${a.className}|${r ?? ""}`, s = this.candidateCache.get(i);
    if (s) return s;
    const c = [], f = /* @__PURE__ */ new Set(), d = new Set(a.classList), m = (g) => {
      if (g) for (const x of g) !f.has(x) && x.pseudo === r && (f.add(x), Lp(x.steps[x.steps.length - 1].compound, a.tagName, d) && c.push(x));
    };
    for (const g of a.classList) m(this.index.get(`.${g}`));
    return m(this.index.get(a.tagName)), m(this.index.get("*")), this.candidateCache.set(i, c), c;
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
        const m = d.reads ??= Qp(d.steps);
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
function Lp(n, a, r) {
  if (n.tag && n.tag !== "*" && n.tag !== a) return !1;
  for (const i of n.classes) if (!r.has(i)) return !1;
  for (const i of n.pseudos) {
    if (i.name === "has") return !0;
    if (i.name === "root" && a !== "html" || (i.name === "where" || i.name === "is") && i.list.every((s) => s.length === 1 && !Lp(s[0].compound, a, r))) return !1;
  }
  return !0;
}
const db = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function fb(n) {
  const a = [];
  for (let r = n.length - 1; r > 0 && !(n[r].combinator !== " " && n[r].combinator !== ">"); r--)
    a.push(...n[r - 1].compound.classes);
  return a;
}
function Yp(n) {
  const a = n.parentElement;
  if (!a) return pb;
  const r = Yp(a), i = n.aboveCache;
  if (i && i.parent === a && i.name === a.className && i.base === r) return i.set;
  const s = a.classSet, c = s.size === 0 ? r : /* @__PURE__ */ new Set([...r, ...s]);
  return n.aboveCache = { parent: a, name: a.className, base: r, set: c }, c;
}
const pb = /* @__PURE__ */ new Set();
function mb(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((r) => Ri.has(r.name) && r.name !== "focus-within");
}
function Qp(n, a = !0, r = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((i, s) => {
    const c = a && s === n.length - 1;
    c || (r.anc = !0);
    for (const f of i.compound.pseudos)
      if (db.has(f.name) && (c ? r.pos = !0 : r.ancPos = !0, f.name === "nth-child" && c && (r.nth = !0)), f.list && f.name !== "has") for (const d of f.list) Qp(d, c, r);
  }), r;
}
const hb = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function gb(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [r, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = r.startsWith("--") ? r : r.replace(/[A-Z]/g, (f) => `-${f.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), c = typeof i == "number" && i !== 0 && !hb.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    a.push([s, c]);
  }
  return a;
}
function bb(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const r of ["width", "height"]) {
    const i = n.getAttribute(r);
    i !== null && a.push([r, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return a;
}
const vb = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class yb {
  constructor(a, { theme: r, viewport: i }) {
    this.sheet = a, this.theme = r, this.viewport = i, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const r of a.media) {
      let i = this.media.get(r);
      if (i === void 0 && this.media.set(r, i = rb(r, this.viewport)), !i) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, r, i = null, s = null) {
    const f = { state: (E, R, z) => {
      if (R === "disabled") return !!E.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(E.tagName);
      if (R === "enabled") return !E.props?.disabled && ["button", "input", "select", "textarea"].includes(E.tagName);
      if (R === "checked") return !!E.props?.checked;
      if (r === "*") return !0;
      if (R === "focus-within") {
        const j = E.ownerDocument?.activeElement;
        return !!j && j !== E.ownerDocument.body && typeof E.contains == "function" && E.contains(j);
      }
      return z ? r.has(R) : R === "focus-visible" ? !!E.state?.focus && !E.state?.pointerFocus : !!E.state?.[R];
    }, pseudo: i }, d = this.sheet.candidates(a, i), m = `${a.tagName} ${a.className}|${i ?? ""}|${r === "*" ? "*" : [...r].sort().join(",")}`;
    let g = this.ownMatches.get(m);
    g || (g = new Set(d.filter((E) => E.own && this.mediaHolds(E) && Do(a, E.steps, f))), this.ownMatches.set(m, g));
    let x = null;
    const y = (E) => E.above.length ? (x ??= Yp(a), E.above.every((R) => x.has(R))) : !0, b = s && r !== "*" ? s[i ?? ""] ??= /* @__PURE__ */ new Map() : null, S = (E) => this.mediaHolds(E) && y(E) && Do(a, E.steps, f);
    return d.filter((E) => {
      if (E.own) return g.has(E);
      if (!b || E.assumed) return S(E);
      let R = b.get(E);
      return R === void 0 && b.set(E, R = S(E)), R;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, r, i = /* @__PURE__ */ new Set(), s = null, c = null) {
    const f = this.matching(a, i, s, c), d = s ? [] : bb(a), m = s ? [] : gb(a.inlineStyle ?? a.props?.style);
    let g = this.rootComputed;
    r && (g = this.computed.get(r.values), g || this.computed.set(r.values, g = /* @__PURE__ */ new Map()));
    const x = `${f.map((b) => b.order).join(",")}|${d.length ? JSON.stringify(d) : ""}|${m.length ? JSON.stringify(m) : ""}`;
    let y = g.get(x);
    return y || g.set(x, y = this.cascade(f, d, m, r)), { ...y, rules: f, element: a, shared: y };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, r, i, s) {
    const c = [];
    for (const h of a)
      for (const [w, k, _] of h.decls) c.push({ prop: w, value: k, important: _ ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, w] of r) c.push({ prop: h, value: w, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, w] of i) c.push({ prop: h, value: w, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    c.sort(vb);
    const f = this.sheet.properties, d = Object.create(s?.customs ?? null), m = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map();
    for (const h of c) h.prop.startsWith("--") && g.set(h.prop, h.value);
    if (!s && this.theme) for (const h of Up) this.theme[h] && g.set(`--${h}`, `perchtoken(${h})`);
    const x = (h) => {
      if (m.has(h)) return m.get(h);
      const w = f[h];
      return w && !w.inherits ? w.initial ?? null : h in d ? d[h] : w?.initial ?? null;
    }, y = /* @__PURE__ */ new Set(), b = (h) => {
      if (!g.has(h)) return x(h);
      if (y.has(h)) return null;
      y.add(h);
      const w = Yo(g.get(h), b);
      return y.delete(h), g.delete(h), m.set(h, w), (!f[h] || f[h].inherits) && (d[h] = w), w;
    };
    for (const h of [...g.keys()]) b(h);
    const S = /* @__PURE__ */ new Map();
    for (const h of c) {
      if (h.prop.startsWith("--")) continue;
      const w = Yo(h.value, x);
      if (w === null) {
        for (const [k] of Vo(h.prop, "unset")) S.set(k, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [k, _] of Vo(h.prop, w)) S.set(k, { value: _, source: h.source, origin: h.origin });
    }
    const E = {}, R = {}, z = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), O = s?.values, H = { fontSize: O?.["font-size"] ?? Go, viewport: this.viewport }, K = (h, w) => {
      if (/currentcolor/i.test(w)) return this.parseValue(h, w, H, E, O);
      const k = `${h}\0${w}\0${H.fontSize}`;
      let _ = this.parsed.get(k);
      return _ === void 0 && this.parsed.set(k, _ = this.parseValue(h, w, H, E, O)), _;
    }, J = S.size ? [...Lo, ...[...S.keys()].filter((h) => !eb.has(h))] : Lo;
    for (const h of J) {
      const w = S.get(h);
      let k = w?.value;
      const _ = P0.has(h);
      if ((k === void 0 || k === "unset" || k === "revert" || k === "revert-layer") && (k = _ ? "inherit" : "initial"), w && (R[h] = w.source, w.origin !== 0 && z.add(h)), k === "inherit" && O && h in O) {
        E[h] = O[h], j.add(h);
        continue;
      }
      (k === "inherit" || k === "initial") && (k = _ ? Gp[h] : qp[h]), E[h] = K(h, k), h === "font-size" && (H.fontSize = E["font-size"]);
    }
    for (const h of ql) {
      const w = E[`border-${h}-style`];
      (w === "none" || w === "hidden") && (E[`border-${h}-width`] = { px: 0 });
    }
    E["outline-style"] === "none" && (E["outline-width"] = { px: 0 });
    const T = O?.display;
    return (T === "flex" || T === "inline-flex" || T === "grid" || T === "inline-grid") && E.position !== "absolute" && E.position !== "fixed" && (E.display = Qf(E.display)), (E.position === "absolute" || E.position === "fixed") && (E.display = Qf(E.display)), { values: E, sources: R, own: z, inherited: j, customs: d };
  }
  parseValue(a, r, i, s, c) {
    const f = String(r).trim();
    switch (a) {
      case "font-size": {
        const d = f.toLowerCase(), m = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (m[d]) return m[d];
        if (d === "smaller") return i.fontSize / 1.2;
        if (d === "larger") return i.fontSize * 1.2;
        const g = Zn(d, { fontSize: i.fontSize, viewport: i.viewport });
        return !g || g.num ? i.fontSize : g.px + g.pct / 100 * i.fontSize;
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
        const d = hi(f, (m) => this.themeHex(m));
        return d === "currentcolor" || !d ? c?.color ?? { rgba: [0, 0, 0, 1], token: null } : d;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const d = hi(f, (m) => this.themeHex(m));
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
        return Qo(f, i);
      default:
        return f.toLowerCase().startsWith("var(") ? f : /^[a-z-]+$/i.test(f) ? f.toLowerCase() : f;
    }
  }
}
function Qf(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const gi = (n) => n && n.rgba ? { value: ab(n.rgba), token: n.token ?? null } : null, xb = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function wb(n, a) {
  const r = a?.(n);
  if (Number.isFinite(r)) return r;
  const i = Math.round(n * 100) / 100;
  return xb[i] ?? Math.round(n * 1.2);
}
function Yl(n, a) {
  const r = n["line-height"], i = n["font-size"];
  return r.normal ? wb(i, a) : r.factor !== void 0 ? r.factor * i : r.px;
}
const kb = (n) => ot(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const _b = "perch-native-description/1", nn = Symbol("display"), bi = {
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
}, Sb = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Sb) bi[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
bi.rounded = 0;
const Eb = /* @__PURE__ */ new Set([
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
]), zb = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, Nb = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Tb = (n) => Nb.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : zb.test(n) ? ".SystemUIFont" : kb(n).split(",")[0].trim(), Cb = {
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
}, Vf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, uc = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const r = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (r) return `${n.tagName}.${r}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${uc(i)} > ${n.tagName}` : n.tagName;
};
class Ab {
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
const wn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, Mb = /^(text|search|url|email|tel|password|number)$/, jb = 162.13 / 12.8;
function Rb(n, a) {
  const r = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!r) return;
  const i = ot(r[1], ",").map((s) => Zn(s.trim(), { fontSize: a })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function Ob(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const r = Zn(n.expr, { fontSize: a["font-size"] }), i = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!r && !r.num && r.pct === 100 && Math.abs(r.px + i) < 0.01;
}
function Vp(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), s = i && ot(i[2], ",").map((c) => c.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const r = n.translate;
  if (r && r !== "none") {
    const i = ot(String(r).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Zn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Xf(n, a, r, i = !1) {
  const s = n.values, c = Vp(s);
  if (c?.length === 0) return;
  const f = s.transform && s.transform !== "none" ? "transform" : "translate", d = { fontSize: s["font-size"] }, m = (y, b) => {
    const S = Zn(y, d);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof b == "number" ? S.px + S.pct / 100 * b : void 0 : S.px;
  }, g = c ? m(c[0], a.w) : void 0, x = c ? m(c[1], a.h) : void 0;
  if (g === void 0 || x === void 0) {
    const y = !i && c ? c.map((b) => Zn(b, d)) : null;
    if (y?.every((b) => b && !(b.unitless && b.num))) {
      a[Xp] = y.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    r("unsupported", f, s[f], n.sources[f]);
    return;
  }
  if (i) {
    g && (a.left = g), x && (a.top = x);
    return;
  }
  g && (a.ml = (a.ml ?? 0) + g), x && (a.mt = (a.mt ?? 0) + x);
}
const Xp = Symbol("perch.shift");
function Db(n, a, r) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[f, d], [m, g]] = r, x = f + d / 100 * s.width, y = m + g / 100 * s.height;
    x && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + x), y && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + y);
  }
  const c = s ? `${s.width}x${s.height}` : "";
  c === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Rp && i?.retries && (n.shiftSeen = c, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function vi(n, a, r = null) {
  const i = n.values, s = {}, c = (H) => n.sources[H], f = (H) => n.sources[H] !== void 0, d = i.display;
  d === "none" ? s.display = "hidden" : d === "flex" || d === "inline-flex" ? s.display = "flex" : (d === "grid" || d === "inline-grid") && (s.display = "flex", s.flex_direction = "col", a("approximated", "display", d, c("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && a("unsupported", "grid-template-columns", i["grid-template-columns"], c("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const m = s.display === "flex";
  if (m && s.flex_direction !== "col") {
    const H = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = H;
  }
  if (m) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const H = d === "grid" || d === "inline-grid", K = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    K && (s.items = K);
    let J = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (H) {
      const w = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      w && (s.items = w), i["align-items"] === "center" && (J = "center");
    }
    J && (s.justify = J);
    const T = wn(i["row-gap"]), h = wn(i["column-gap"]);
    typeof T == "number" && T && (s.gap_y = T), typeof h == "number" && h && !H && (s.gap_x = h);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const g = wn(i["flex-basis"]);
  g !== void 0 && g !== "auto" && (s.flex_basis = g);
  const x = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  x && (s.self = x);
  for (const [H, K] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const J = i[K], T = wn(J);
    if (T === void 0 && K === "width" && Ob(J, i)) {
      s.self = "stretch", a("approximated", K, J.expr, c(K), "stretched across its parent, inside its margins");
      continue;
    }
    const h = T === void 0 && /^max-/.test(K) ? Rb(J, i["font-size"]) : void 0;
    if (h !== void 0) {
      s[H] = h, a("approximated", K, J.expr, c(K), "the fixed bound of min()");
      continue;
    }
    if (T === void 0) {
      typeof J == "object" && J.expr ? a("unsupported", K, J.expr, c(K), "no calc() in the engine") : typeof J == "string" && !["auto", "none"].includes(J) && a("unsupported", K, J, c(K));
      continue;
    }
    T !== "auto" && (s[H] = T);
  }
  const y = ["top", "right", "bottom", "left"];
  for (const H of y) {
    const K = H[0];
    for (const [J, T] of [["p", "padding"], ["m", "margin"]]) {
      const h = i[`${T}-${H}`], w = wn(h);
      if (w === void 0) {
        h?.expr && a("unsupported", `${T}-${H}`, h.expr, c(`${T}-${H}`), "no calc() in the engine");
        continue;
      }
      w !== 0 && (s[`${J}${K}`] = w);
    }
  }
  const b = i.position;
  if (b === "absolute" || b === "fixed") {
    s.position = "absolute", b === "fixed" && a("approximated", "position", "fixed", c("position"), "absolute in the overlay layer");
    for (const H of y) {
      const K = wn(i[H]);
      K !== void 0 && K !== "auto" && (s[H] = K);
    }
    if (b === "fixed" && r && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const H = r.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, H) : H;
    }
    Xf(n, s, a);
  } else b === "sticky" ? a("unsupported", "position", "sticky", c("position")) : Vp(i)?.length !== 0 && (s.position = "relative", Xf(n, s, a, !0));
  i["z-index"] !== "auto" && f("z-index") && a("unsupported", "z-index", i["z-index"], c("z-index"), "paint order is tree order");
  for (const [H, K] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const J = i[K];
    J === "hidden" || J === "clip" ? s[H] = "hidden" : (J === "auto" || J === "scroll") && (s[H] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const S = i["background-color"];
  S?.unreadable ? a("unsupported", "background-color", S.unreadable, c("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = gi(S)), i["background-image"] && i["background-image"] !== "none" && a("unsupported", "background-image", i["background-image"], c("background-image"));
  const E = y.map((H) => wn(i[`border-${H}-width`]) || 0), R = [];
  y.forEach((H, K) => {
    if (!E[K]) return;
    s[`border_${H[0]}`] = E[K];
    const J = i[`border-${H}-style`];
    J !== "solid" && a("approximated", `border-${H}-style`, J, c(`border-${H}-style`), "drawn solid");
    const T = gi(i[`border-${H}-color`]);
    T && R.push(T);
  }), R.length && (s.border_color = R[0], R.some((H) => H.value !== R[0].value) && a("approximated", "border-color", R.map((H) => H.value).join(" "), c("border-top-color"), "one border colour"));
  const z = (H) => {
    const K = wn(i[`border-${H}-radius`]) || 0;
    if (typeof K != "string") return K;
    const J = parseFloat(K) / 100, T = [s.w, s.h].filter((h) => typeof h == "number");
    return K === "auto" || !(J > 0) ? 0 : T.length ? Math.round(Math.min(J, 0.5) * Math.min(...T) * 100) / 100 : 9999;
  }, j = ["top-left", "top-right", "bottom-right", "bottom-left"].map(z);
  j.every((H) => H === j[0]) ? j[0] && (s.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((H, K) => {
    j[K] && (s[`rounded_${H}`] = j[K]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const O = i["box-shadow"];
  if (O && O !== "none" && ot(O, ",").some((H) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(H.trim())) && (s.shadow = "lg", a("approximated", "box-shadow", O, c("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const H = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    H ? s.cursor = H : a("unsupported", "cursor", i.cursor, c("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && a("unsupported", "text-decoration-line", i["text-decoration-line"], c("text-decoration-line")), s;
}
const Bb = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Kp(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((r) => Bb[r]);
  return a.every(Boolean) ? a.join(",") : null;
}
function yi(n, a) {
  const r = n.values, i = r["line-height"];
  return {
    text_color: gi(r.color),
    text_size: Math.round(r["font-size"] * 1e3) / 1e3,
    font_features: Kp(r["font-variant-numeric"]) ?? "",
    font_weight: r["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(Yl(r, a) * 1e3) / 1e3 },
    font_family: Tb(r["font-family"]),
    italic: r["font-style"] === "italic" || r["font-style"] === "oblique",
    whitespace: r["white-space"] === "nowrap" || r["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[r["text-align"]] ?? "left"
  };
}
const Kf = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, dc = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function xi(n, a, r) {
  const i = {}, s = (d, m) => m.some((g) => !n.inherited.has(g));
  for (const [d, m] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(d, m) || !dc(a[d], r[d])) && (i[d] = a[d]);
  const c = Kf(a.line_height, a.text_size), f = r.line_height ? Kf(r.line_height, a.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(c - f) <= 1e-3)) && (i.line_height = a.line_height), i;
}
const Hb = (n, a) => ({ ...n, ...a });
function wi(n, a) {
  const r = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (r[i] = s.value, s.token && (a[i] = s.token)) : i === "line_height" ? r[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (r.italic = !0) : r[i] = s;
  return r.italic === !1 && delete r.italic, r;
}
function Zp(n, a) {
  const r = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const s = n[i], c = a[i];
    dc(s, c) || (r[i] = c === void 0 ? i in bi ? bi[i] : null : c);
  }
  return r;
}
function Zf(n, a) {
  const r = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || Eb.has(i) || s.startsWith("ua:")) continue;
    const c = r[i];
    switch (i) {
      case "letter-spacing":
        c !== "normal" && c?.px !== 0 && a("approximated", i, c?.px !== void 0 ? `${Math.round(c.px * 1e3) / 1e3}px` : c, s, c?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        c !== "normal" && Kp(c) === null && a("unsupported", i, c, s);
        break;
      case "text-transform":
        c !== "none" && a("approximated", i, c, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const f = r["transition-duration"];
        i === "transition-property" && f && ot(f, ",").some((d) => parseFloat(d) > 0) && r["transition-property"] !== "none" && a("unsupported", "transition", `${r["transition-property"]} ${f}`, s, "changes are instant (the engine animates only opacity and size)");
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
        r["outline-style"] !== "none" && i === "outline-style" && a("unsupported", "outline", `${wn(r["outline-width"])}px ${r["outline-style"]} ${gi(r["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function Ub(n, a, r, i) {
  const s = uc(n), c = {}, f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), null, c), d = i.cascade.matching(n, "*").filter((O) => O.states.subject.size), m = [];
  for (const [O, H] of qb)
    d.some((K) => H.some((J) => K.states.subject.has(J))) && m.push([O, i.cascade.compute(n, a, new Set(H), null, c)]);
  const g = `${Co(f.shared)}|${Co(r)}|${+!!f.element.hidden}|${m.map(([O, H]) => `${O}${Co(H.shared)}`).join(",")}`;
  let x = (i.cascade.styled ??= /* @__PURE__ */ new Map()).get(g);
  x || i.cascade.styled.set(g, x = Lb(f, m, r, i));
  const { style: y, tokens: b, shift: S, childText: E } = x, R = x.reports.map(([O, H, K, J, T]) => [O, H, K, J, s, T]), z = { ...x.extra };
  if (i.cascade.sheet.tracks(n, "hover") && (z.group = Wf(n), z.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let O = n.parentNode; O?.state; O = O.parentNode) {
      if (!i.cascade.sheet.tracks(O, "hover")) continue;
      const H = O.state.hover;
      O.state.hover = !0;
      let K;
      try {
        K = i.cascade.compute(n, a);
      } finally {
        O.state.hover = H;
      }
      const J = {}, T = wi({ ...vi(K, () => {
      }), ...xi(K, yi(K, i.measure), r) }, J), h = Zp(y, T);
      if (!Object.keys(h).length) continue;
      const w = Object.fromEntries(Object.entries(J).filter(([k]) => k in h));
      (z.group_hover ??= []).push({ group: Wf(O), style: h, ...Object.keys(w).length ? { tokens: w } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (z.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (z.break_anywhere = !0), x.scrolls) {
    const O = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (z.scrollbar = O);
  }
  f.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (z.blocks_pointer = !0), f.values["pointer-events"] === "none" && (z.pointer_none = !0);
  const j = Object.entries(Cb).filter(([, O]) => O.some((H) => typeof n.props[H] == "function")).map(([O]) => O);
  return !j.includes("click") && qo(n) && j.push("click"), j.length && (z.events = j), { computed: f, style: y, tokens: b, extra: z, meta: $b(n), reports: R, childText: E, where: s, shift: S };
}
const qb = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], Jf = /* @__PURE__ */ new WeakMap();
let Gb = 0;
function Co(n) {
  let a = Jf.get(n);
  return a === void 0 && Jf.set(n, a = ++Gb), a;
}
function Lb(n, a, r, i) {
  const s = [], c = (b, S, E, R, z) => s.push([b, S, E, R ?? "(user agent)", z]), f = {}, d = vi(n, c, i.viewport);
  Zf(n, c);
  const m = yi(n, i.measure), g = xi(n, m, r), x = wi({ ...d, ...g }, f), y = {};
  for (const [b, S] of a) {
    const E = {}, R = wi({ ...vi(S, () => {
    }), ...xi(S, yi(S, i.measure), r) }, E);
    b === "focus" && Zf(S, c);
    const z = Zp(x, R);
    if (Object.keys(z).length) {
      y[b] = z;
      const j = Object.fromEntries(Object.entries(E).filter(([O]) => O in z));
      Object.keys(j).length && (y[`${b}_tokens`] = j);
    }
  }
  return { style: x, tokens: f, shift: d[Xp], childText: Hb(r, g), extra: y, scrolls: d.overflow_y === "scroll", reports: s };
}
function Yb(n, a, r, i) {
  const s = { before: null, after: null };
  for (const c of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), c).length) continue;
    const f = i.cascade.compute(n, a, /* @__PURE__ */ new Set(), c), d = String(f.values.content ?? "none").trim();
    if (d === "none" || d === "normal") continue;
    const m = /^(["'])(.*)\1$/.exec(d)?.[2] ?? "", g = (E, R, z, j, O) => i.add(E, R, z, j ?? "(user agent)", `${uc(n)}::${c}`, O), x = {}, y = vi(f, g, i.viewport), S = { kind: "div", style: wi({ ...y, ...xi(f, yi(f, i.measure), r) }, x), tokens: x, children: m ? [{ kind: "text", text: m }] : [] };
    Object.defineProperty(S, nn, { value: f.values.display }), s[c] = S;
  }
  return s;
}
const Wf = (n) => `~g${n.id}`, Qb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function Vb(n) {
  return n.kind === "div" && n[nn] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !Qb.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function Pr(n, a) {
  const r = n[a], i = { ...r, style: { ...r.style } };
  return Object.defineProperty(i, nn, { value: r[nn] }), n[a] = i, i;
}
function Xb(n) {
  const a = [];
  for (let r = n.parentElement; r?.parentElement; r = r.parentElement) {
    const i = r.parentElement.children;
    a.push(`${+(i[0] === r)}${+(i[i.length - 1] === r)}`);
  }
  return a.join("");
}
function Jp(n, a, r, i, s = 0, c = !0, f = !0, d = 0) {
  const m = i.cascade.sheet.depends(n), g = m.pos ? `${+c}${+f}${m.nth ? `:${d}` : ""}` : "", x = m.ancPos ? Xb(n) : "";
  let y = i.cache.get(n);
  const b = y && y.version === n.version && y.parentValues === a?.values && y.inheritedText === r && y.pos === g && y.ancPos === x && (!m.anc || s <= y.at);
  if (b && y.node && y.stamp === n.stamp && !y.volatile && (!y.subAnc || s <= y.subAt)) {
    for (const z of y.log) i.add(...z);
    return y.node;
  }
  if (!b) {
    const z = Ub(n, a, r, i);
    y && dc(y.part.childText, z.childText) && (z.childText = y.part.childText), y = { version: n.version, parentValues: a?.values, inheritedText: r, pos: g, ancPos: x, at: i.now, part: z }, i.cache.set(n, y);
  }
  const S = i.log.length, E = { volatile: !!y.part.shift || m.ancPos, subAnc: m.anc }, R = Kb(n, y, i, Math.max(s, n.attrStamp), E);
  return Object.assign(y, { node: R, stamp: n.stamp, subAt: i.now, log: i.log.slice(S), volatile: E.volatile, subAnc: E.subAnc }), R;
}
function Kb(n, a, r, i, s) {
  const { computed: c, tokens: f, extra: d, reports: m, childText: g, where: x } = a.part;
  for (const k of m) r.add(...k);
  const y = (k, _, C, N, D) => r.add(k, _, C, N, x, D), b = { ...a.part.style };
  a.part.shift && Db(n, b, a.part.shift);
  const S = { kind: "div", id: n.id, style: b, tokens: f, meta: a.part.meta, ...d };
  Object.defineProperty(S, nn, { value: c.values.display }), n.measured && n.ownerDocument?.measureKey && (S.measure = n.ownerDocument.measureKey(n));
  const E = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return S.kind = "engine", S.engine = String(n.props["data-perch-engine"]), S.key = String(n.props["data-perch-key"] ?? ""), S;
  if (E === "svg")
    return S.kind = n.props["data-perch-image"] ? "image" : "svg", S.markup = Ib(n), S;
  if (E === "input" || E === "textarea" || E === "select") {
    S.kind = "input", S.input_type = E === "input" ? String(n.props.type ?? "text") : E;
    for (const C of ["placeholder", "checked", "disabled"]) n.props[C] !== void 0 && (S[C] = n.props[C]);
    if (/^(checkbox|radio)$/.test(S.input_type) && (S.checked = n.checked), E !== "select" && (S.value = n.value), E === "input" && Mb.test(S.input_type) && (S.field_w = jb * c.values["font-size"]), E === "textarea" && b.h === void 0) {
      const C = c.values, N = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, D = ($) => C[`border-${$}-style`] === "none" ? 0 : N(C[`border-${$}-width`]), G = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      b.h = G * Yl(C, r.measure) + N(C["padding-top"]) + N(C["padding-bottom"]) + D("top") + D("bottom");
    }
    const { before: k, after: _ } = Yb(n, c, g, r);
    return (k || _) && (S.children = [k, _].filter(Boolean)), S;
  }
  if (E === "img") {
    S.kind = "image", S.src = n.props.src ?? null;
    for (const [k, _] of [["width", "w"], ["height", "h"]]) {
      const C = Number(n.props[k]);
      b[_] === void 0 && n.props[k] != null && Number.isFinite(C) && (b[_] = C);
    }
    return S;
  }
  const R = c.values["text-transform"], z = [];
  let j = !1, O = !1;
  const H = n.childNodes.reduce((k, _) => k + (_ instanceof Ze ? 1 : 0), 0);
  let K = 0;
  for (const k of n.childNodes) {
    if (k instanceof ji) {
      if (k.hidden || k.data === "") continue;
      j = !0;
      const D = z[z.length - 1];
      if (D?.kind === "text")
        D.source = (D.source ?? D.text) + k.data, D.text = $f(D.source, R), D.text === D.source && delete D.source;
      else {
        const G = $f(k.data, R);
        z.push(G === k.data ? { kind: "text", text: G } : { kind: "text", text: G, source: k.data });
      }
      continue;
    }
    if (!(k instanceof Ze)) continue;
    const _ = Jp(k, c, g, r, i, K === 0, K === H - 1, K);
    K++;
    const C = r.cache.get(k);
    s.volatile ||= C.volatile, s.subAnc ||= C.subAnc;
    const N = _[nn];
    N === "inline" || N === "inline-block" || N === "inline-flex" ? j = !0 : N !== "none" && (O = !0), z.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && b.w === void 0) {
    for (let k = 0; k < z.length; k++)
      if (z[k].style?.flex_grow && z[k].style.min_w === 0 && z[k].style.overflow_x === "hidden") {
        const _ = Pr(z, k);
        delete _.style.min_w, delete _.style.flex_grow, delete _.style.flex_basis, delete _.style.overflow_x, delete _.style.overflow_y;
      }
  }
  if (!b.display && j && z.some((k) => k.kind !== "text") && z.every((k) => k.kind === "text" || Vb(k))) {
    const k = z.map((_) => _.kind === "text" ? _.text : _.children.map((C) => C.text).join("")).join("");
    y("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), z.splice(0, z.length, { kind: "text", text: k });
  }
  const J = z.some((k) => k.kind !== "text");
  let T = z.length === 1 && z[0].kind !== "text" && /^inline-(block|flex)$/.test(z[0][nn]) ? z[0] : null;
  if (!b.display && T) {
    T = Pr(z, 0);
    const k = r.cache.get(n.childNodes.find((C) => C.id === T.id))?.part.computed, _ = k ? _i(c.values, r.measure) - Wb(k.values, r.measure, T) : 0;
    b.display = "flex", b.flex_direction = "col", b.items = "start", _ > 0 && (T.style.mt = Math.round(((T.style.mt ?? 0) + _) * 100) / 100), y("approximated", "display", `${c.values.display} holding one ${T[nn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!b.display && z.length === 1 && (z[0].kind === "svg" || z[0].kind === "image") && z[0][nn] === "inline" && typeof z[0].style.h == "number") {
    const k = Pr(z, 0), _ = _i(c.values, r.measure), C = Yl(c.values, r.measure) - _, N = (D) => Math.round(D * 100) / 100;
    b.display = "flex", b.flex_direction = "col", b.items = "start", _ > k.style.h && (k.style.mt = N((k.style.mt ?? 0) + _ - k.style.h)), C > 0 && (k.style.mb = N((k.style.mb ?? 0) + C)), y("approximated", "display", `${c.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!b.display && j && J) {
    if (b.display = "flex", b.flex_direction = O ? "col" : "row", !O) b.items = "baseline";
    else for (let k = 0; k < z.length; k++) z[k].kind !== "text" && /^inline-(block|flex)$/.test(z[k][nn]) && !z[k].style.self && (Pr(z, k).style.self = "start");
    y("approximated", "display", `${c.values.display} with inline content`, "(inline formatting)", O ? "a column of its children" : "a row on the text baseline");
  }
  const h = c.values["letter-spacing"]?.px, w = c.values["overflow-x"] !== "visible";
  if (h)
    for (let k = 0; k < z.length; k++) {
      const _ = z[k];
      if (_.kind !== "text") continue;
      const C = Math.round(h * [..._.text].length * 1e3) / 1e3;
      if (h > 0 || !w) {
        z[k] = { kind: "div", style: { pr: C }, tokens: {}, children: [_] };
        continue;
      }
      const N = c.values["font-size"], D = Math.max(0.8, 1 + h / (0.55 * N)), G = Math.round(Yl(c.values, r.measure) * 1e3) / 1e3;
      z[k] = { kind: "div", style: { text_size: Math.round(N * D * 1e3) / 1e3, line_height: `${G}px` }, tokens: {}, children: [_] };
    }
  return S.children = z, S;
}
function Zb(n, a) {
  if (!a) return null;
  let i = (a.self ? n : a.closest ? Mp(n, a.closest) : a.find ? Vl(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return i && a.strip && i.startsWith(a.strip) && (i = i.slice(a.strip.length)), i;
}
function Jb(n, a, r) {
  const i = a.map((f) => [f, Mi(f.selector)]), s = /* @__PURE__ */ new Map(), c = (f) => {
    for (const d of f.children) {
      const m = r.get(d.id);
      if (m)
        for (const [g, x] of i) {
          const y = g.textRange ? "range_name" : "name";
          if (g.textRange && m[y] != null || !x.some((R) => Do(d, R))) continue;
          const b = Zb(d, g.key), S = b == null ? s.get(g.name) ?? 0 : 0;
          b == null && s.set(g.name, S + 1);
          const E = b != null ? `${g.name}:${b}` : S ? `${g.name}@${S}` : g.name;
          m[y] == null ? m[y] = E : (m.also ??= []).push(E);
        }
      c(d);
    }
  };
  c(n.documentElement);
}
const ki = 0.9521, Wp = 0.2256, _i = (n, a) => (Yl(n, a) - (ki + Wp) * n["font-size"]) / 2 + ki * n["font-size"];
function Wb(n, a, r) {
  const i = (m) => m && typeof m == "object" && "px" in m ? m.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), c = r?.children ?? [], f = c.length === 1 && (c[0].kind === "svg" || c[0].kind === "image") && typeof c[0].style.h == "number" ? c[0] : null, d = f ? Math.max(_i(n, a), (f.style.mt ?? 0) + f.style.h) : _i(n, a);
  return i(n["padding-top"]) + s + d;
}
const $f = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (r) => r.toUpperCase()) : n, $p = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function $b(n) {
  const a = {};
  for (const [r, i] of Object.entries(n.props)) {
    if ($p.has(r) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = r.startsWith("aria-") || r.startsWith("data-");
    if (i === !1 && !s) continue;
    const c = r === "htmlFor" ? "for" : r === "tabIndex" ? "tabindex" : r;
    a[c] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: a };
}
const Fb = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), Ff = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Ib(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (r) => {
    const i = [];
    for (const [c, f] of Object.entries(r.props))
      $p.has(c) || typeof f == "function" || f === void 0 || f === null || f === !1 || typeof f == "object" || c.startsWith("data-") || c.startsWith("aria-") || c === "focusable" || c === "role" || c === "title" || i.push(`${Fb(c)}="${Ff(f === !0 ? "" : f)}"`);
    r.tagName === "svg" && !r.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = r.childNodes.map((c) => c instanceof ji ? Ff(c.data) : a(c)).join("");
    return `<${r.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${r.tagName}>`;
  };
  return a(n);
}
function Pb(n) {
  const a = n.theme?.() ?? {}, r = {};
  for (const i of Up) a[i] && (r[i] = a[i]);
  return r;
}
const e1 = { font_features: "" };
function t1(n, a, r, i = {}, s = null) {
  const c = Pb(a), f = a.viewport?.() ?? { width: 1e3, height: 800 }, d = JSON.stringify([c, f]);
  (i.look !== d || i.sheet !== r) && Object.assign(i, { look: d, sheet: r, cache: /* @__PURE__ */ new WeakMap(), cascade: new yb(r, { theme: c, viewport: f }), top: null });
  const { cascade: m, cache: g } = i, x = new Ab(), y = [], S = { cascade: m, cache: g, viewport: f, findings: x, log: y, add: (...j) => {
    y.push(j), x.add(...j);
  }, now: Ho(), measure: a.lineHeight ? (j) => a.lineHeight(j) : null };
  i.top ??= m.compute(n.body, m.compute(n.documentElement, null));
  const E = n.body.children, R = E.map((j, O) => Jp(j, i.top, e1, S, 0, O === 0, O === E.length - 1, O));
  if (s?.length) {
    const j = /* @__PURE__ */ new Map(), O = (H) => {
      H.id && (j.set(H.id, H), delete H.name, delete H.range_name, delete H.also);
      for (const K of H.children ?? []) O(K);
    };
    R.forEach(O), Jb(n, s, j);
  }
  const z = /* @__PURE__ */ new Set();
  for (const j of [n, n.defaultView])
    for (const { type: O } of j?.listeners ?? []) Vf[O] && z.add(Vf[O]);
  return { schema: _b, root: R[0] ?? null, overlays: R.slice(1), document_events: [...z].sort(), unsupported: S.findings.list() };
}
const Ia = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 }, digest: "1b693a483c1992d8" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const Pa = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let Bl = null;
function n1() {
  return Bl || (Bl = Ia.digest && Pa.get(Ia.digest) || new ub(Ia), Ia.digest && !Pa.has(Ia.digest) && (Pa.size >= 4 && Pa.delete(Pa.keys().next().value), Pa.set(Ia.digest, Bl)), Bl);
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
let xa = Xl.NoEventPriority;
function a1(n, a) {
  const r = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const i of r) {
    if (i === "children") continue;
    const s = n[i], c = a[i];
    if (!(s === c || typeof s == "function" && typeof c == "function") && !(i === "style" && s && c && typeof s == "object" && typeof c == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(c)])].every((d) => s[d] === c[d])))
      return !0;
  }
  return !1;
}
const l1 = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function If(n, a) {
  for (const r of N0(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(r);
  return n;
}
const r1 = {
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
  createInstance: (n, a, r) => If(new Ze(n, a, r.ownerDocument), a),
  createTextInstance: (n, a) => new ji(n),
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
      If(n, i);
    }
    a1(r, i) && n.touch();
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
    xa = n;
  },
  getCurrentUpdatePriority: () => xa,
  resolveUpdatePriority: () => xa !== Xl.NoEventPriority ? xa : Xl.DefaultEventPriority,
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
}, At = W0(r1), Jl = (n, a, r = null) => At.createPortal(n, a, null, r), i1 = {
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
}, s1 = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), o1 = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), c1 = (n) => {
  for (let a = n; a instanceof Ze; a = a.parentNode) if (a.props.disabled && o1.has(a.tagName)) return !0;
  return !1;
};
class u1 {
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
function ei(n, a, r) {
  a.currentTarget = n;
  for (const { type: i, listener: s, capture: c } of [...n.listeners ?? []])
    i === a.type && c === r && s.call(n, a);
  if (n instanceof Ze) {
    const i = i1[a.type], s = i && n.props[r ? `${i}Capture` : i];
    typeof s == "function" && s(a);
  }
}
function l4(n, a, r = {}) {
  const { document: i, window: s, globals: c } = j0(n), f = new Ze("div", { id: "root", style: r.container ?? {} }, i);
  i.body.appendChild(f);
  const d = [];
  let m = null;
  const g = () => [i, s].map((T) => T.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let x = "";
  const y = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, E = -1;
  i.measureKey = (T) => b + T.id, i.stale = () => E !== S, i.computed = (T) => {
    if (!y.cascade || !y.top) return null;
    const h = [];
    for (let k = T; k instanceof Ze && k !== i.body; k = k.parentNode) h.unshift(k);
    let w = y.top;
    for (const k of h) w = y.cascade.compute(k, w);
    return w.values;
  };
  const R = () => (S += 1, m = t1(i, n, n1(), y, r.names), x = g(), n.render?.(m), m), z = () => {
    At.flushPassiveEffects(), At.flushSyncWork(), g() !== x && R();
  };
  i.afterCommit = R;
  const j = (T) => {
    d.push(T), n.error?.(T);
  }, O = At.createContainer(f, Xl.ConcurrentRoot, null, !1, null, "", j, j, j, null);
  At.updateContainerSync(W.createElement(a, r.props ?? {}), O, null, null), At.flushSyncWork(), z();
  const H = (T) => {
    const h = (w) => {
      if (w.id === T) return w;
      for (const k of w.children) {
        const _ = h(k);
        if (_) return _;
      }
      return null;
    };
    return h(i.documentElement);
  }, K = (T) => {
    const h = xa;
    xa = Xl.DiscreteEventPriority;
    try {
      return T();
    } finally {
      xa = h, At.flushSyncWork(), z();
    }
  }, J = {
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
    describe: R,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(T, h, w = {}) {
      const k = typeof T == "string" ? H(T) : T;
      if (!k || s1.has(h) && c1(k)) return !1;
      const _ = new u1(h, w, k), C = [];
      for (let G = k; G; G = h === "scroll" ? null : G.parentNode) C.push(G);
      const N = [...C, i, s];
      K(() => {
        for (let G = N.length - 1; G > 0 && !_.propagationStopped; G--) ei(N[G], _, !0);
        _.propagationStopped || (ei(k, _, !0), _.propagationStopped || ei(k, _, !1));
        for (let G = 1; G < N.length && !_.propagationStopped; G++) ei(N[G], _, !1);
      });
      const D = h === "click" && !_.defaultPrevented ? qo(k) : null;
      if (D && J.dispatch(D, "submit", {}), h === "click" && !_.defaultPrevented)
        for (let G = k; G; G = G.parentNode) {
          if (G.tagName !== "a") continue;
          const $ = G.props?.href;
          typeof $ == "string" && /^https:\/\/\S+$/.test($) && n.openLink?.($);
          break;
        }
      return !_.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (T) => [i, s].some((h) => h.listeners.some((w) => w.type === T)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(T) {
      const h = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!J.dispatch(h, "keydown", T)) return !0;
      const k = T.key === "Enter" && !T.isComposing ? qo(h, !0) : null;
      if (k)
        return J.dispatch(k, "submit", {}), !0;
      if (!Bp(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((T.ctrlKey || T.metaKey) && !T.altKey && !T.shiftKey && T.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (T.ctrlKey || T.metaKey) return !1;
      const _ = h.selectedAll;
      h.selectedAll = !1;
      const C = h.value, D = T.key === "Backspace" || _ && T.key === "Delete" ? _ ? "" : C.slice(0, -1) : [...T.key].length === 1 ? (_ ? "" : C) + T.key : C;
      return D === C ? !1 : (h.value = D, J.dispatch(h, "input", { data: T.key }), J.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), R(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(T, h) {
      const w = H(T);
      w && (w.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(T) {
      const h = H(T);
      if (!h || h.props.disabled || !J.dispatch(T, "click", { button: 0, detail: 1 })) return;
      const w = h.props.type === "radio";
      w && h.checked || (h.checked = w ? !0 : !h.checked, J.dispatch(T, "input", {}), J.dispatch(T, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), R());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(T, h = {}) {
      const w = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const k of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) J.dispatch(T, k, w);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (T) => !!H(T)?.state.hover,
    hover(T, h) {
      const w = H(T);
      !w || w.state.hover === h || (w.state.hover = h, w.touch(), R());
    },
    focus(T) {
      const h = H(T);
      h && (K(() => {
        const w = i.activeElement;
        w && w !== h && w !== i.body && J.dispatch(w, "blur"), i.focus(h), J.dispatch(h, "focus");
      }), R());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(T) {
      let w = typeof T == "string" ? H(T) : T;
      for (; w && !(w instanceof Ze && typeof w.props.onKeyDown == "function" && l1(w)); ) w = w.parentNode;
      !w || w === i.activeElement || (J.focus(w.id), w.state.pointerFocus = !0, w.touch(), R());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return E = S, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const T = i.retries.splice(0);
      for (const h of T) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: z,
    update(T) {
      At.updateContainerSync(W.createElement(a, T ?? {}), O, null, null), At.flushSyncWork(), z();
    },
    unmount() {
      At.updateContainerSync(null, O, null, null), At.flushSyncWork(), At.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(b);
    }
  };
  return J;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Fp = (n) => At.flushSyncFromReconciler(n), d1 = { createPortal: Jl, flushSync: Fp }, r4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Jl,
  default: d1,
  flushSync: Fp
}, Symbol.toStringTag, { value: "Module" }));
function Ip(n) {
  var a, r, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (a = 0; a < s; a++) n[a] && (r = Ip(n[a])) && (i && (i += " "), i += r);
  } else for (r in n) n[r] && (i && (i += " "), i += r);
  return i;
}
function Pp() {
  for (var n, a, r = 0, i = "", s = arguments.length; r < s; r++) (n = arguments[r]) && (a = Ip(n)) && (i && (i += " "), i += a);
  return i;
}
const f1 = (n, a) => {
  const r = new Array(n.length + a.length);
  for (let i = 0; i < n.length; i++)
    r[i] = n[i];
  for (let i = 0; i < a.length; i++)
    r[n.length + i] = a[i];
  return r;
}, p1 = (n, a) => ({
  classGroupId: n,
  validator: a
}), em = (n = /* @__PURE__ */ new Map(), a = null, r) => ({
  nextPart: n,
  validators: a,
  classGroupId: r
}), Si = "-", Pf = [], m1 = "arbitrary..", h1 = (n) => {
  const a = b1(n), {
    conflictingClassGroups: r,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (f) => {
      if (f.startsWith("[") && f.endsWith("]"))
        return g1(f);
      const d = f.split(Si), m = d[0] === "" && d.length > 1 ? 1 : 0;
      return tm(d, m, a);
    },
    getConflictingClassGroupIds: (f, d) => {
      if (d) {
        const m = i[f], g = r[f];
        return m ? g ? f1(g, m) : m : g || Pf;
      }
      return r[f] || Pf;
    }
  };
}, tm = (n, a, r) => {
  if (n.length - a === 0)
    return r.classGroupId;
  const s = n[a], c = r.nextPart.get(s);
  if (c) {
    const g = tm(n, a + 1, c);
    if (g) return g;
  }
  const f = r.validators;
  if (f === null)
    return;
  const d = a === 0 ? n.join(Si) : n.slice(a).join(Si), m = f.length;
  for (let g = 0; g < m; g++) {
    const x = f[g];
    if (x.validator(d))
      return x.classGroupId;
  }
}, g1 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), r = a.indexOf(":"), i = a.slice(0, r);
  return i ? m1 + i : void 0;
})(), b1 = (n) => {
  const {
    theme: a,
    classGroups: r
  } = n;
  return v1(r, a);
}, v1 = (n, a) => {
  const r = em();
  for (const i in n) {
    const s = n[i];
    fc(s, r, i, a);
  }
  return r;
}, fc = (n, a, r, i) => {
  const s = n.length;
  for (let c = 0; c < s; c++) {
    const f = n[c];
    y1(f, a, r, i);
  }
}, y1 = (n, a, r, i) => {
  if (typeof n == "string") {
    x1(n, a, r);
    return;
  }
  if (typeof n == "function") {
    w1(n, a, r, i);
    return;
  }
  k1(n, a, r, i);
}, x1 = (n, a, r) => {
  const i = n === "" ? a : nm(a, n);
  i.classGroupId = r;
}, w1 = (n, a, r, i) => {
  if (_1(n)) {
    fc(n(i), a, r, i);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(p1(r, n));
}, k1 = (n, a, r, i) => {
  const s = Object.entries(n), c = s.length;
  for (let f = 0; f < c; f++) {
    const [d, m] = s[f];
    fc(m, nm(a, d), r, i);
  }
}, nm = (n, a) => {
  let r = n;
  const i = a.split(Si), s = i.length;
  for (let c = 0; c < s; c++) {
    const f = i[c];
    let d = r.nextPart.get(f);
    d || (d = em(), r.nextPart.set(f, d)), r = d;
  }
  return r;
}, _1 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, S1 = (n) => {
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
}, Xo = "!", ep = ":", E1 = [], tp = (n, a, r, i, s) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: r,
  maybePostfixModifierPosition: i,
  isExternal: s
}), z1 = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: r
  } = n;
  let i = (s) => {
    const c = [];
    let f = 0, d = 0, m = 0, g;
    const x = s.length;
    for (let R = 0; R < x; R++) {
      const z = s[R];
      if (f === 0 && d === 0) {
        if (z === ep) {
          c.push(s.slice(m, R)), m = R + 1;
          continue;
        }
        if (z === "/") {
          g = R;
          continue;
        }
      }
      z === "[" ? f++ : z === "]" ? f-- : z === "(" ? d++ : z === ")" && d--;
    }
    const y = c.length === 0 ? s : s.slice(m);
    let b = y, S = !1;
    y.endsWith(Xo) ? (b = y.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      y.startsWith(Xo) && (b = y.slice(1), S = !0)
    );
    const E = g && g > m ? g - m : void 0;
    return tp(c, S, b, E);
  };
  if (a) {
    const s = a + ep, c = i;
    i = (f) => f.startsWith(s) ? c(f.slice(s.length)) : tp(E1, !1, f, void 0, !0);
  }
  if (r) {
    const s = i;
    i = (c) => r({
      className: c,
      parseClassName: s
    });
  }
  return i;
}, N1 = (n) => {
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
}, T1 = (n) => ({
  cache: S1(n.cacheSize),
  parseClassName: z1(n),
  sortModifiers: N1(n),
  postfixLookupClassGroupIds: C1(n),
  ...h1(n)
}), C1 = (n) => {
  const a = /* @__PURE__ */ Object.create(null), r = n.postfixLookupClassGroups;
  if (r)
    for (let i = 0; i < r.length; i++)
      a[r[i]] = !0;
  return a;
}, A1 = /\s+/, M1 = (n, a) => {
  const {
    parseClassName: r,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: c,
    postfixLookupClassGroupIds: f
  } = a, d = [], m = n.trim().split(A1);
  let g = "";
  for (let x = m.length - 1; x >= 0; x -= 1) {
    const y = m[x], {
      isExternal: b,
      modifiers: S,
      hasImportantModifier: E,
      baseClassName: R,
      maybePostfixModifierPosition: z
    } = r(y);
    if (b) {
      g = y + (g.length > 0 ? " " + g : g);
      continue;
    }
    let j = !!z, O;
    if (j) {
      const h = R.substring(0, z);
      O = i(h);
      const w = O && f[O] ? i(R) : void 0;
      w && w !== O && (O = w, j = !1);
    } else
      O = i(R);
    if (!O) {
      if (!j) {
        g = y + (g.length > 0 ? " " + g : g);
        continue;
      }
      if (O = i(R), !O) {
        g = y + (g.length > 0 ? " " + g : g);
        continue;
      }
      j = !1;
    }
    const H = S.length === 0 ? "" : S.length === 1 ? S[0] : c(S).join(":"), K = E ? H + Xo : H, J = K + O;
    if (d.indexOf(J) > -1)
      continue;
    d.push(J);
    const T = s(O, j);
    for (let h = 0; h < T.length; ++h) {
      const w = T[h];
      d.push(K + w);
    }
    g = y + (g.length > 0 ? " " + g : g);
  }
  return g;
}, j1 = (...n) => {
  let a = 0, r, i, s = "";
  for (; a < n.length; )
    (r = n[a++]) && (i = am(r)) && (s && (s += " "), s += i);
  return s;
}, am = (n) => {
  if (typeof n == "string")
    return n;
  let a, r = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (a = am(n[i])) && (r && (r += " "), r += a);
  return r;
}, R1 = (n, ...a) => {
  let r, i, s, c;
  const f = (m) => {
    const g = a.reduce((x, y) => y(x), n());
    return r = T1(g), i = r.cache.get, s = r.cache.set, c = d, d(m);
  }, d = (m) => {
    const g = i(m);
    if (g)
      return g;
    const x = M1(m, r);
    return s(m, x), x;
  };
  return c = f, (...m) => c(j1(...m));
}, O1 = [], Fe = (n) => {
  const a = (r) => r[n] || O1;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, lm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, rm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, D1 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, B1 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, H1 = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, U1 = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, q1 = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, G1 = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ln = (n) => D1.test(n), ve = (n) => !!n && !Number.isNaN(Number(n)), en = (n) => !!n && Number.isInteger(Number(n)), Ao = (n) => n.endsWith("%") && ve(n.slice(0, -1)), xn = (n) => B1.test(n), im = () => !0, L1 = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  H1.test(n) && !U1.test(n)
), pc = () => !1, Y1 = (n) => q1.test(n), Q1 = (n) => G1.test(n), V1 = (n) => !re(n) && !ie(n), X1 = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), K1 = (n) => Jn(n, cm, pc), re = (n) => lm.test(n), ha = (n) => Jn(n, um, L1), np = (n) => Jn(n, ev, ve), Z1 = (n) => Jn(n, fm, im), J1 = (n) => Jn(n, dm, pc), ap = (n) => Jn(n, sm, pc), W1 = (n) => Jn(n, om, Q1), ti = (n) => Jn(n, pm, Y1), ie = (n) => rm.test(n), Hl = (n) => _a(n, um), $1 = (n) => _a(n, dm), lp = (n) => _a(n, sm), F1 = (n) => _a(n, cm), I1 = (n) => _a(n, om), ni = (n) => _a(n, pm, !0), P1 = (n) => _a(n, fm, !0), Jn = (n, a, r) => {
  const i = lm.exec(n);
  return i ? i[1] ? a(i[1]) : r(i[2]) : !1;
}, _a = (n, a, r = !1) => {
  const i = rm.exec(n);
  return i ? i[1] ? a(i[1]) : r : !1;
}, sm = (n) => n === "position" || n === "percentage", om = (n) => n === "image" || n === "url", cm = (n) => n === "length" || n === "size" || n === "bg-size", um = (n) => n === "length", ev = (n) => n === "number", dm = (n) => n === "family-name", fm = (n) => n === "number" || n === "weight", pm = (n) => n === "shadow", tv = () => {
  const n = Fe("color"), a = Fe("font"), r = Fe("text"), i = Fe("font-weight"), s = Fe("tracking"), c = Fe("leading"), f = Fe("breakpoint"), d = Fe("container"), m = Fe("spacing"), g = Fe("radius"), x = Fe("shadow"), y = Fe("inset-shadow"), b = Fe("text-shadow"), S = Fe("drop-shadow"), E = Fe("blur"), R = Fe("perspective"), z = Fe("aspect"), j = Fe("ease"), O = Fe("animate"), H = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], K = () => [
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
  ], J = () => [...K(), ie, re], T = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], w = () => [ie, re, m], k = () => [Ln, "full", "auto", ...w()], _ = () => [en, "none", "subgrid", ie, re], C = () => ["auto", {
    span: ["full", en, ie, re]
  }, en, ie, re], N = () => [en, "auto", ie, re], D = () => ["auto", "min", "max", "fr", ie, re], G = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], $ = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], q = () => ["auto", ...w()], X = () => [Ln, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...w()], I = () => [d, Ln, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...w()], Q = () => [Ln, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...w()], V = () => [n, ie, re], A = () => [...K(), lp, ap, {
    position: [ie, re]
  }], Z = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], ae = () => ["auto", "cover", "contain", F1, K1, {
    size: [ie, re]
  }], oe = () => [Ao, Hl, ha], ce = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    g,
    ie,
    re
  ], ue = () => ["", ve, Hl, ha], Ee = () => ["solid", "dashed", "dotted", "double"], Ie = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], he = () => [ve, Ao, lp, ap], $n = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    E,
    ie,
    re
  ], Fn = () => ["none", ve, ie, re], qt = () => ["none", ve, ie, re], Gt = () => [ve, ie, re], kn = () => [Ln, "full", ...w()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [xn],
      breakpoint: [xn],
      color: [im],
      container: [xn],
      "drop-shadow": [xn],
      ease: ["in", "out", "in-out"],
      font: [V1],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [xn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [xn],
      shadow: [xn],
      spacing: ["px", ve],
      text: [xn],
      "text-shadow": [xn],
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
        aspect: ["auto", "square", Ln, re, ie, z]
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
      "container-named": [X1],
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
        "break-after": H()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": H()
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
        basis: [Ln, "full", "auto", d, ...w()]
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
        flex: [ve, Ln, "auto", "initial", "none", re]
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
        "grid-cols": _()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: C()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": N()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": N()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": _()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: C()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": N()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": N()
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
        "auto-cols": D()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": D()
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
        justify: [...G(), "normal"]
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
        content: ["normal", ...G()]
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
        "place-content": G()
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
        size: X()
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
        w: [d, "screen", ...X()]
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
          ...X()
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
          ...X()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...X()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...X()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...X()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", r, Hl, ha]
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
        font: [i, P1, Z1]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Ao, re]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [$1, J1, a]
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
        "line-clamp": [ve, "none", ie, np]
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
        decoration: [ve, "from-font", "auto", ie, ha]
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
        bg: A()
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
        }, I1, W1]
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
        outline: ["", ve, Hl, ha]
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
          ni,
          ti
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
        "inset-shadow": ["none", y, ni, ti]
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
        "ring-offset": [ve, ha]
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
        "text-shadow": ["none", b, ni, ti]
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
        "mask-radial-at": K()
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
        mask: A()
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
          S,
          ni,
          ti
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
        "backdrop-blur": $n()
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
        ease: ["linear", "initial", j, ie, re]
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
        animate: ["none", O, ie, re]
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
        perspective: [R, ie, re]
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
        translate: kn()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": kn()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": kn()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": kn()
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
        stroke: [ve, Hl, ha, np]
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
}, nv = /* @__PURE__ */ R1(tv);
function Ge(...n) {
  return nv(Pp(n));
}
function av(n, a, r) {
  return n.filter((i, s) => s !== a && (i.start + i.end) / 2 < r).length;
}
function lv(n, a, r, i) {
  const s = n.map(() => 0), c = n[a];
  if (!c) return s;
  const f = n[a + 1], d = n[a - 1], m = c.end - c.start + (f ? f.start - c.end : d ? c.start - d.end : 0);
  return n.forEach((g, x) => {
    a < r && x > a && x <= r ? s[x] = -m : r < a && x >= r && x < a && (s[x] = m);
  }), s[a] = Math.min(Math.max(i, n[0].start - c.start), n[n.length - 1].end - c.end), s;
}
const rp = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function rv(n, a) {
  for (let r = n.parentElement; r; r = r.parentElement) {
    const i = getComputedStyle(r)[a === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (a === "x" ? r.scrollWidth > r.clientWidth : r.scrollHeight > r.clientHeight)) return r;
  }
  return null;
}
function iv(n, a, r, i) {
  const s = n[a] ? rv(n[a], r) : null, c = () => s ? r === "x" ? s.scrollLeft : s.scrollTop : 0, f = (z) => (r === "x" ? z.clientX : z.clientY) + c(), d = f(i), m = c(), g = n.map((z) => {
    const j = z.getBoundingClientRect();
    return r === "x" ? { start: j.left + m, end: j.right + m } : { start: j.top + m, end: j.bottom + m };
  }), x = n.map((z) => rp.map((j) => z.style[j])), y = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = r === "x" ? "translateX" : "translateY";
  let S = !1;
  const E = { to: a };
  n.forEach((z, j) => {
    if (z.style.pointerEvents = "none", j !== a) {
      y || (z.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(z).position === "static" && (z.style.position = "relative"), z.style.zIndex = "30", z.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const R = (z, j) => {
    E.to = z, lv(g, a, z, j).forEach((O, H) => {
      n[H].style.transform = O ? `${b}(${O}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return E.to;
    },
    slot: (z) => av(g, a, f(z)),
    apply: (z, j) => {
      S || R(z, f(j) - d);
    },
    rest: () => {
      S || R(a, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((z, j) => rp.forEach((O, H) => {
        z.style[O] = x[j][H];
      })));
    }
  };
}
const sv = 5;
let Mo = !1;
function ov(n, a) {
  if (n.button !== 0 || Mo) return;
  const r = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let c = null, f, d = !1;
  const m = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, g = (E) => {
    if (d) return;
    d = !0, window.removeEventListener("pointermove", x), window.removeEventListener("pointerup", y), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", b), i.removeEventListener("lostpointercapture", b);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!c) return;
    Mo = !1, document.body.style.cursor = m.cursor, document.body.style.userSelect = m.userSelect, c.end();
    const R = (z) => z.stopPropagation();
    window.addEventListener("click", R, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", R, !0), 0), f?.(), a.onEnd(E, c);
  }, x = (E) => {
    if (!c) {
      if (Math.hypot(E.clientX - r.clientX, E.clientY - r.clientY) < sv) return;
      const R = a.items();
      c = iv(R, a.from(R), a.axis, r), Mo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", b);
      const z = a.onStart?.();
      f = typeof z == "function" ? z : void 0;
    }
    a.onMove(E, c);
  }, y = () => g(!0), b = () => g(!1), S = (E) => {
    E.key === "Escape" && (E.stopPropagation(), g(!1));
  };
  window.addEventListener("pointermove", x), window.addEventListener("pointerup", y), window.addEventListener("pointercancel", b), window.addEventListener("keydown", S, !0), window.addEventListener("blur", b);
}
const mm = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ei = {
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
for (let n = 1; n <= 12; n++) Ei[`f${n}`] = `F${n}`;
const cv = Object.fromEntries(Object.entries(Ei).map(([n, a]) => [a, n])), uv = {
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
function dv(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : cv[n];
}
const ip = /* @__PURE__ */ new Map();
function hm(n, a = mm) {
  const r = `${a}|${n}`, i = ip.get(r);
  if (i) return i;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const c of n.split("+"))
    if (c === "mod")
      a ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (c === "cmd" || c === "ctrl" || c === "shift" || c === "alt") s[c] = !0;
    else if (/^[a-z]$/.test(c))
      s.code = `Key${c.toUpperCase()}`, s.letter = c;
    else if (/^[0-9]$/.test(c)) s.code = `Digit${c}`;
    else if (Ei[c]) s.code = Ei[c];
    else throw new Error(`unknown key "${c}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return ip.set(r, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = hm(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function fv(n, a = mm) {
  const r = hm(n, a), i = pv(dv(r.code) ?? "");
  return a ? `${r.ctrl ? "⌃" : ""}${r.alt ? "⌥" : ""}${r.shift ? "⇧" : ""}${r.cmd ? "⌘" : ""}${i}` : [r.ctrl && "Ctrl", r.alt && "Alt", r.shift && "Shift", i].filter(Boolean).join("+");
}
const pv = (n) => uv[n] ?? n.toUpperCase(), sp = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, op = Pp, Oi = (n, a) => (r) => {
  var i;
  if (a?.variants == null) return op(n, r?.class, r?.className);
  const { variants: s, defaultVariants: c } = a, f = Object.keys(s).map((g) => {
    const x = r?.[g], y = c?.[g];
    if (x === null) return null;
    const b = sp(x) || sp(y);
    return s[g][b];
  }), d = r && Object.entries(r).reduce((g, x) => {
    let [y, b] = x;
    return b === void 0 || (g[y] = b), g;
  }, {}), m = a == null || (i = a.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((g, x) => {
    let { class: y, className: b, ...S } = x;
    return Object.entries(S).every((E) => {
      let [R, z] = E;
      return Array.isArray(z) ? z.includes({
        ...c,
        ...d
      }[R]) : {
        ...c,
        ...d
      }[R] === z;
    }) ? [
      ...g,
      y,
      b
    ] : g;
  }, []);
  return op(n, f, m, r?.class, r?.className);
}, mv = Oi(
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
), hv = Oi(
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
function gv({ className: n, ...a } = {}) {
  return Ge(hv(a), n);
}
const gm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", mc = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", bv = Oi(`${mc} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function vv({ className: n, ...a } = {}) {
  return Ge(bv(a), n);
}
const Di = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Ko = Oi(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), yv = "my-1 h-px bg-overlay-0";
function xv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function wv({ size: n = 16, className: a }) {
  return /* @__PURE__ */ te.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ te.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function kv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function bm({ size: n = 14, className: a }) {
  return /* @__PURE__ */ te.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const cp = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function _v({ state: n, error: a }) {
  return /* @__PURE__ */ te.jsx(
    "span",
    {
      className: Ge("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", cp[n] ?? cp.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function Sv({ title: n, onClose: a, children: r, testId: i }) {
  return Jl(
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
function hc() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var Sa = hc();
function vm(n) {
  Sa = n;
}
var va = { exec: () => null };
function el(n) {
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
var Ev = ((n = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + n);
  } catch {
    return !1;
  }
})(), mt = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (n) => new RegExp(`^( {0,3}${n})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: el((n) => new RegExp(`^ {0,${n}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: el((n) => new RegExp(`^ {0,${n}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: el((n) => new RegExp(`^ {0,${n}}(?:\`\`\`|~~~)`)), headingBeginRegex: el((n) => new RegExp(`^ {0,${n}}#`)), htmlBeginRegex: el((n) => new RegExp(`^ {0,${n}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: el((n) => new RegExp(`^ {0,${n}}>`)) }, zv = /^(?:[ \t]*(?:\n|$))+/, Nv = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, Tv = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, Wl = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, Cv = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, gc = / {0,3}(?:[*+-]|\d{1,9}[.)])/, ym = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, xm = ze(ym).replace(/bull/g, gc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), Av = ze(ym).replace(/bull/g, gc).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), bc = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, Mv = /^[^\n]+/, vc = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, jv = ze(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", vc).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), Rv = ze(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, gc).getRegex(), Bi = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", yc = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, Ov = ze("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", yc).replace("tag", Bi).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), wm = (n) => ze(bc).replace("hr", Wl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", n).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Bi).getRegex(), Dv = wm(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), Bv = wm(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), Hv = ze(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Bv).getRegex(), xc = { blockquote: Hv, code: Nv, def: jv, fences: Tv, heading: Cv, hr: Wl, html: Ov, lheading: xm, list: Rv, newline: zv, paragraph: Dv, table: va, text: Mv }, up = ze("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", Wl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Bi).getRegex(), Uv = { ...xc, lheading: Av, table: up, paragraph: ze(bc).replace("hr", Wl).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", up).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Bi).getRegex() }, qv = { ...xc, html: ze(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", yc).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: va, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: ze(bc).replace("hr", Wl).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", xm).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, Gv = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, Lv = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, km = /^( {2,}|\\)\n(?!\s*$)/, Yv = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, nl = /[\p{P}\p{S}]/u, Hi = /[\s\p{P}\p{S}]/u, wc = /[^\s\p{P}\p{S}]/u, Qv = ze(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Hi).getRegex(), _m = /(?!~)[\p{P}\p{S}]/u, Vv = /(?!~)[\s\p{P}\p{S}]/u, Xv = /(?:[^\s\p{P}\p{S}]|~)/u, Kv = ze(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Ev ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), Sm = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, Zv = ze(Sm, "u").replace(/punct/g, nl).getRegex(), Jv = ze(Sm, "u").replace(/punct/g, _m).getRegex(), Em = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", Wv = ze(Em, "gu").replace(/notPunctSpace/g, wc).replace(/punctSpace/g, Hi).replace(/punct/g, nl).getRegex(), $v = ze(Em, "gu").replace(/notPunctSpace/g, Xv).replace(/punctSpace/g, Vv).replace(/punct/g, _m).getRegex(), Fv = ze("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, wc).replace(/punctSpace/g, Hi).replace(/punct/g, nl).getRegex(), Iv = ze(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, nl).getRegex(), Pv = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", ey = ze(Pv, "gu").replace(/notPunctSpace/g, wc).replace(/punctSpace/g, Hi).replace(/punct/g, nl).getRegex(), ty = ze(/\\(punct)/, "gu").replace(/punct/g, nl).getRegex(), ny = ze(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), ay = ze(yc).replace("(?:-->|$)", "-->").getRegex(), ly = ze("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", ay).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), zi = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, ry = ze(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", zi).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), zm = ze(/^!?\[(label)\]\[(ref)\]/).replace("label", zi).replace("ref", vc).getRegex(), Nm = ze(/^!?\[(ref)\](?:\[\])?/).replace("ref", vc).getRegex(), iy = ze("reflink|nolink(?!\\()", "g").replace("reflink", zm).replace("nolink", Nm).getRegex(), dp = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, kc = { _backpedal: va, anyPunctuation: ty, autolink: ny, blockSkip: Kv, br: km, code: Lv, del: va, delLDelim: va, delRDelim: va, emStrongLDelim: Zv, emStrongRDelimAst: Wv, emStrongRDelimUnd: Fv, escape: Gv, link: ry, nolink: Nm, punctuation: Qv, reflink: zm, reflinkSearch: iy, tag: ly, text: Yv, url: va }, sy = { ...kc, link: ze(/^!?\[(label)\]\((.*?)\)/).replace("label", zi).getRegex(), reflink: ze(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", zi).getRegex() }, Zo = { ...kc, emStrongRDelimAst: $v, emStrongLDelim: Jv, delLDelim: Iv, delRDelim: ey, url: ze(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", dp).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: ze(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", dp).getRegex() }, oy = { ...Zo, br: ze(km).replace("{2,}", "*").getRegex(), text: ze(Zo.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, ai = { normal: xc, gfm: Uv, pedantic: qv }, Ul = { normal: kc, gfm: Zo, breaks: oy, pedantic: sy }, cy = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, fp = (n) => cy[n];
function tn(n, a) {
  if (a) {
    if (mt.escapeTest.test(n)) return n.replace(mt.escapeReplace, fp);
  } else if (mt.escapeTestNoEncode.test(n)) return n.replace(mt.escapeReplaceNoEncode, fp);
  return n;
}
function pp(n) {
  try {
    n = encodeURI(n).replace(mt.percentDecode, "%");
  } catch {
    return null;
  }
  return n;
}
function mp(n, a) {
  let r = n.replace(mt.findPipe, (c, f, d) => {
    let m = !1, g = f;
    for (; --g >= 0 && d[g] === "\\"; ) m = !m;
    return m ? "|" : " |";
  }), i = r.split(mt.splitPipe), s = 0;
  if (i[0].trim() || i.shift(), i.length > 0 && !i.at(-1)?.trim() && i.pop(), a) if (i.length > a) i.splice(a);
  else for (; i.length < a; ) i.push("");
  for (; s < i.length; s++) i[s] = i[s].trim().replace(mt.slashPipe, "|");
  return i;
}
function Yn(n, a, r) {
  let i = n.length;
  if (i === 0) return "";
  let s = 0;
  for (; s < i && n.charAt(i - s - 1) === a; )
    s++;
  return n.slice(0, i - s);
}
function hp(n) {
  let a = n.split(`
`), r = a.length - 1;
  for (; r >= 0 && mt.blankLine.test(a[r]); ) r--;
  return a.length - r <= 2 ? n : a.slice(0, r + 1).join(`
`);
}
function uy(n, a) {
  if (n.indexOf(a[1]) === -1) return -1;
  let r = 0;
  for (let i = 0; i < n.length; i++) if (n[i] === "\\") i++;
  else if (n[i] === a[0]) r++;
  else if (n[i] === a[1] && (r--, r < 0)) return i;
  return r > 0 ? -2 : -1;
}
function dy(n, a = 0) {
  let r = a, i = "";
  for (let s of n) if (s === "	") {
    let c = 4 - r % 4;
    i += " ".repeat(c), r += c;
  } else i += s, r++;
  return i;
}
function gp(n, a, r, i, s) {
  let c = a.href, f = a.title || null, d = n[1].replace(s.other.outputLinkReplace, "$1");
  i.state.inLink = !0;
  let m = { type: n[0].charAt(0) === "!" ? "image" : "link", raw: r, href: c, title: f, text: d, tokens: i.inlineTokens(d) };
  return i.state.inLink = !1, m;
}
function fy(n, a, r) {
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
var Ni = class {
  options;
  rules;
  lexer;
  constructor(n) {
    this.options = n || Sa;
  }
  space(n) {
    let a = this.rules.block.newline.exec(n);
    if (a && a[0].length > 0) return { type: "space", raw: a[0] };
  }
  code(n) {
    let a = this.rules.block.code.exec(n);
    if (a) {
      let r = this.options.pedantic ? a[0] : hp(a[0]), i = r.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: r, codeBlockStyle: "indented", text: i };
    }
  }
  fences(n) {
    let a = this.rules.block.fences.exec(n);
    if (a) {
      let r = a[0], i = fy(r, a[3] || "", this.rules);
      return { type: "code", raw: r, lang: a[2] ? a[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : a[2], text: i };
    }
  }
  heading(n) {
    let a = this.rules.block.heading.exec(n);
    if (a) {
      let r = a[2].trim();
      if (this.rules.other.endingHash.test(r)) {
        let i = Yn(r, "#");
        (this.options.pedantic || !i || this.rules.other.endingSpaceChar.test(i)) && (r = i.trim());
      }
      return { type: "heading", raw: Yn(a[0], `
`), depth: a[1].length, text: r, tokens: this.lexer.inline(r) };
    }
  }
  hr(n) {
    let a = this.rules.block.hr.exec(n);
    if (a) return { type: "hr", raw: Yn(a[0], `
`) };
  }
  blockquote(n) {
    let a = this.rules.block.blockquote.exec(n);
    if (a) {
      let r = Yn(a[0], `
`).split(`
`), i = "", s = "", c = [];
      for (; r.length > 0; ) {
        let f = !1, d = [], m;
        for (m = 0; m < r.length; m++) if (this.rules.other.blockquoteStart.test(r[m])) d.push(r[m]), f = !0;
        else if (!f) d.push(r[m]);
        else break;
        r = r.slice(m);
        let g = d.join(`
`), x = g.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        i = i ? `${i}
${g}` : g, s = s ? `${s}
${x}` : x;
        let y = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(x, c, !0), this.lexer.state.top = y, r.length === 0) break;
        let b = c.at(-1);
        if (b?.type === "code") break;
        if (b?.type === "blockquote") {
          let S = b, E = S.raw + `
` + r.join(`
`), R = this.blockquote(E);
          c[c.length - 1] = R, i = i.substring(0, i.length - S.raw.length) + R.raw, s = s.substring(0, s.length - S.text.length) + R.text;
          break;
        } else if (b?.type === "list") {
          let S = b, E = S.raw + `
` + r.join(`
`), R = this.list(E);
          c[c.length - 1] = R, i = i.substring(0, i.length - b.raw.length) + R.raw, s = s.substring(0, s.length - S.raw.length) + R.raw, r = E.substring(c.at(-1).raw.length).split(`
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
        let m = !1, g = "", x = "";
        if (!(a = c.exec(n)) || this.rules.block.hr.test(n)) break;
        g = a[0], n = n.substring(g.length);
        let y = dy(a[2].split(`
`, 1)[0], a[1].length), b = n.split(`
`, 1)[0], S = !y.trim(), E = 0;
        if (this.options.pedantic ? (E = 2, x = y.trimStart()) : S ? E = a[1].length + 1 : (E = y.search(this.rules.other.nonSpaceChar), E = E > 4 ? 1 : E, x = y.slice(E), E += a[1].length), S && this.rules.other.blankLine.test(b) && (g += b + `
`, n = n.substring(b.length + 1), m = !0), !m) {
          let R = this.rules.other.nextBulletRegex(E), z = this.rules.other.hrRegex(E), j = this.rules.other.fencesBeginRegex(E), O = this.rules.other.headingBeginRegex(E), H = this.rules.other.htmlBeginRegex(E), K = this.rules.other.blockquoteBeginRegex(E);
          for (; n; ) {
            let J = n.split(`
`, 1)[0], T;
            if (b = J, this.options.pedantic ? (b = b.replace(this.rules.other.listReplaceNesting, "  "), T = b) : T = b.replace(this.rules.other.tabCharGlobal, "    "), j.test(b) || O.test(b) || H.test(b) || K.test(b) || R.test(b) || z.test(b)) break;
            if (T.search(this.rules.other.nonSpaceChar) >= E || !b.trim()) x += `
` + T.slice(E);
            else {
              if (S || y.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || j.test(y) || O.test(y) || z.test(y)) break;
              x += `
` + b;
            }
            S = !b.trim(), g += J + `
`, n = n.substring(J.length + 1), y = T.slice(E);
          }
        }
        s.loose || (f ? s.loose = !0 : this.rules.other.doubleBlankLine.test(g) && (f = !0)), s.items.push({ type: "list_item", raw: g, task: !!this.options.gfm && this.rules.other.listIsTask.test(x), loose: !1, text: x, tokens: [] }), s.raw += g;
      }
      let d = s.items.at(-1);
      if (d) d.raw = d.raw.trimEnd(), d.text = d.text.trimEnd();
      else return;
      s.raw = s.raw.trimEnd();
      for (let m of s.items) {
        this.lexer.state.top = !1, m.tokens = this.lexer.blockTokens(m.text, []);
        let g = m.tokens[0];
        if (m.task && (g?.type === "text" || g?.type === "paragraph")) {
          m.text = m.text.replace(this.rules.other.listReplaceTask, ""), g.raw = g.raw.replace(this.rules.other.listReplaceTask, ""), g.text = g.text.replace(this.rules.other.listReplaceTask, "");
          for (let y = this.lexer.inlineQueue.length - 1; y >= 0; y--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[y].src)) {
            this.lexer.inlineQueue[y].src = this.lexer.inlineQueue[y].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let x = this.rules.other.listTaskCheckbox.exec(m.raw);
          if (x) {
            let y = { type: "checkbox", raw: x[0] + " ", checked: x[0] !== "[ ]" };
            m.checked = y.checked, s.loose ? m.tokens[0] && ["paragraph", "text"].includes(m.tokens[0].type) && "tokens" in m.tokens[0] && m.tokens[0].tokens ? (m.tokens[0].raw = y.raw + m.tokens[0].raw, m.tokens[0].text = y.raw + m.tokens[0].text, m.tokens[0].tokens.unshift(y)) : m.tokens.unshift({ type: "paragraph", raw: y.raw, text: y.raw, tokens: [y] }) : m.tokens.unshift(y);
          }
        } else m.task && (m.task = !1);
        if (!s.loose) {
          let x = m.tokens.filter((b) => b.type === "space"), y = x.length > 0 && x.some((b) => this.rules.other.anyLine.test(b.raw));
          s.loose = y;
        }
      }
      if (s.loose) for (let m of s.items) {
        m.loose = !0;
        for (let g of m.tokens) g.type === "text" && (g.type = "paragraph");
      }
      return s;
    }
  }
  html(n) {
    let a = this.rules.block.html.exec(n);
    if (a) {
      let r = hp(a[0]);
      return { type: "html", block: !0, raw: r, pre: a[1] === "pre" || a[1] === "script" || a[1] === "style", text: r };
    }
  }
  def(n) {
    let a = this.rules.block.def.exec(n);
    if (a) {
      let r = a[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), i = a[2] ? a[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", s = a[3] ? a[3].substring(1, a[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : a[3];
      return { type: "def", tag: r, raw: Yn(a[0], `
`), href: i, title: s };
    }
  }
  table(n) {
    let a = this.rules.block.table.exec(n);
    if (!a || !this.rules.other.tableDelimiter.test(a[2])) return;
    let r = mp(a[1]), i = a[2].replace(this.rules.other.tableAlignChars, "").split("|"), s = a[3]?.trim() ? a[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], c = { type: "table", raw: Yn(a[0], `
`), header: [], align: [], rows: [] };
    if (r.length === i.length) {
      for (let f of i) this.rules.other.tableAlignRight.test(f) ? c.align.push("right") : this.rules.other.tableAlignCenter.test(f) ? c.align.push("center") : this.rules.other.tableAlignLeft.test(f) ? c.align.push("left") : c.align.push(null);
      for (let f = 0; f < r.length; f++) c.header.push({ text: r[f], tokens: this.lexer.inline(r[f]), header: !0, align: c.align[f] });
      for (let f of s) c.rows.push(mp(f, c.header.length).map((d, m) => ({ text: d, tokens: this.lexer.inline(d), header: !1, align: c.align[m] })));
      return c;
    }
  }
  lheading(n) {
    let a = this.rules.block.lheading.exec(n);
    if (a) {
      let r = a[1].trim();
      return { type: "heading", raw: Yn(a[0], `
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
        let c = Yn(r.slice(0, -1), "\\");
        if ((r.length - c.length) % 2 === 0) return;
      } else {
        let c = uy(a[2], "()");
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
      return i = i.trim(), this.rules.other.startAngleBracket.test(i) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(r) ? i = i.slice(1) : i = i.slice(1, -1)), gp(a, { href: i && i.replace(this.rules.inline.anyPunctuation, "$1"), title: s && s.replace(this.rules.inline.anyPunctuation, "$1") }, a[0], this.lexer, this.rules);
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
      return gp(r, s, r[0], this.lexer, this.rules);
    }
  }
  emStrong(n, a, r = "") {
    let i = this.rules.inline.emStrongLDelim.exec(n);
    if (!(!i || !i[1] && !i[2] && !i[3] && !i[4] || i[4] && r.match(this.rules.other.unicodeAlphaNumeric)) && (!(i[1] || i[3]) || !r || this.rules.inline.punctuation.exec(r))) {
      let s = [...i[0]].length - 1, c, f, d = s, m = 0, g = i[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (g.lastIndex = 0, a = a.slice(-1 * n.length + s); (i = g.exec(a)) !== null; ) {
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
        let x = [...i[0]][0].length, y = n.slice(0, s + i.index + x + f);
        if (Math.min(s, f) % 2) {
          let S = y.slice(1, -1);
          return { type: "em", raw: y, text: S, tokens: this.lexer.inlineTokens(S) };
        }
        let b = y.slice(2, -2);
        return { type: "strong", raw: y, text: b, tokens: this.lexer.inlineTokens(b) };
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
        let g = [...i[0]][0].length, x = n.slice(0, s + i.index + g + f), y = x.slice(s, -s);
        return { type: "del", raw: x, text: y, tokens: this.lexer.inlineTokens(y) };
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
}, Ht = class Jo {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(a) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = a || Sa, this.options.tokenizer = this.options.tokenizer || new Ni(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, top: !0 };
    let r = { other: mt, block: ai.normal, inline: Ul.normal };
    this.options.pedantic ? (r.block = ai.pedantic, r.inline = Ul.pedantic) : this.options.gfm && (r.block = ai.gfm, this.options.breaks ? r.inline = Ul.breaks : r.inline = Ul.gfm), this.tokenizer.rules = r;
  }
  static get rules() {
    return { block: ai, inline: Ul };
  }
  static lex(a, r) {
    return new Jo(r).lex(a);
  }
  static lexInline(a, r) {
    return new Jo(r).inlineTokens(a);
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
        let d = 1 / 0, m = a.slice(1), g;
        this.options.extensions.startBlock.forEach((x) => {
          g = x.call({ lexer: this }, m), typeof g == "number" && g >= 0 && (d = Math.min(d, g));
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
    i = i.replace(this.tokenizer.rules.inline.anyPunctuation, "++"), i = i.replace(this.tokenizer.rules.inline.blockSkip, (d, m, g) => {
      let x = g ? g.length : 0;
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
      if (this.options.extensions?.inline?.some((g) => (d = g.call({ lexer: this }, a, r)) ? (a = a.substring(d.raw.length), r.push(d), !0) : !1)) continue;
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
        let g = r.at(-1);
        d.type === "text" && g?.type === "text" ? (g.raw += d.raw, g.text += d.text) : r.push(d);
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
        let g = 1 / 0, x = a.slice(1), y;
        this.options.extensions.startInline.forEach((b) => {
          y = b.call({ lexer: this }, x), typeof y == "number" && y >= 0 && (g = Math.min(g, y));
        }), g < 1 / 0 && g >= 0 && (m = a.substring(0, g + 1));
      }
      if (d = this.tokenizer.inlineText(m)) {
        a = a.substring(d.raw.length), d.raw.slice(-1) !== "_" && (c = d.raw.slice(-1)), s = !0;
        let g = r.at(-1);
        g?.type === "text" ? (g.raw += d.raw, g.text += d.text) : r.push(d);
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
}, Ti = class {
  options;
  parser;
  constructor(n) {
    this.options = n || Sa;
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
    let i = this.parser.parseInline(r), s = pp(n);
    if (s === null) return i;
    n = s;
    let c = '<a href="' + n + '"';
    return a && (c += ' title="' + tn(a) + '"'), c += ">" + i + "</a>", c;
  }
  image({ href: n, title: a, text: r, tokens: i }) {
    i && (r = this.parser.parseInline(i, this.parser.textRenderer));
    let s = pp(n);
    if (s === null) return tn(r);
    n = s;
    let c = `<img src="${n}" alt="${tn(r)}"`;
    return a && (c += ` title="${tn(a)}"`), c += ">", c;
  }
  text(n) {
    return "tokens" in n && n.tokens ? this.parser.parseInline(n.tokens) : "escaped" in n && n.escaped ? n.text : tn(n.text);
  }
}, _c = class {
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
}, Kt = class Wo {
  options;
  renderer;
  textRenderer;
  constructor(a) {
    this.options = a || Sa, this.options.renderer = this.options.renderer || new Ti(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new _c();
  }
  static parse(a, r) {
    return new Wo(r).parse(a);
  }
  static parseInline(a, r) {
    return new Wo(r).parseInline(a);
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
}, Gl = class {
  options;
  block;
  constructor(n) {
    this.options = n || Sa;
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
}, py = class {
  defaults = hc();
  options = this.setOptions;
  parse = this.parseMarkdown(!0);
  parseInline = this.parseMarkdown(!1);
  Parser = Kt;
  Renderer = Ti;
  TextRenderer = _c;
  Lexer = Ht;
  Tokenizer = Ni;
  Hooks = Gl;
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
        let s = this.defaults.renderer || new Ti(this.defaults);
        for (let c in r.renderer) {
          if (!(c in s)) throw new Error(`renderer '${c}' does not exist`);
          if (["options", "parser"].includes(c)) continue;
          let f = c, d = r.renderer[f], m = s[f];
          s[f] = (...g) => {
            let x = d.apply(s, g);
            return x === !1 && (x = m.apply(s, g)), x || "";
          };
        }
        i.renderer = s;
      }
      if (r.tokenizer) {
        let s = this.defaults.tokenizer || new Ni(this.defaults);
        for (let c in r.tokenizer) {
          if (!(c in s)) throw new Error(`tokenizer '${c}' does not exist`);
          if (["options", "rules", "lexer"].includes(c)) continue;
          let f = c, d = r.tokenizer[f], m = s[f];
          s[f] = (...g) => {
            let x = d.apply(s, g);
            return x === !1 && (x = m.apply(s, g)), x;
          };
        }
        i.tokenizer = s;
      }
      if (r.hooks) {
        let s = this.defaults.hooks || new Gl();
        for (let c in r.hooks) {
          if (!(c in s)) throw new Error(`hook '${c}' does not exist`);
          if (["options", "block"].includes(c)) continue;
          let f = c, d = r.hooks[f], m = s[f];
          Gl.passThroughHooks.has(c) ? s[f] = (g) => {
            if (this.defaults.async && Gl.passThroughHooksRespectAsync.has(c)) return (async () => {
              let y = await d.call(s, g);
              return m.call(s, y);
            })();
            let x = d.call(s, g);
            return m.call(s, x);
          } : s[f] = (...g) => {
            if (this.defaults.async) return (async () => {
              let y = await d.apply(s, g);
              return y === !1 && (y = await m.apply(s, g)), y;
            })();
            let x = d.apply(s, g);
            return x === !1 && (x = m.apply(s, g)), x;
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
    return Kt.parse(n, a ?? this.defaults);
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
        let g = await (s.hooks ? await s.hooks.provideParser(n) : n ? Kt.parse : Kt.parseInline)(m, s);
        return s.hooks ? await s.hooks.postprocess(g) : g;
      })().catch(c);
      try {
        s.hooks && (a = s.hooks.preprocess(a));
        let f = (s.hooks ? s.hooks.provideLexer(n) : n ? Ht.lex : Ht.lexInline)(a, s);
        s.hooks && (f = s.hooks.processAllTokens(f)), s.walkTokens && this.walkTokens(f, s.walkTokens);
        let d = (s.hooks ? s.hooks.provideParser(n) : n ? Kt.parse : Kt.parseInline)(f, s);
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
}, ka = new py();
function je(n, a) {
  return ka.parse(n, a);
}
je.options = je.setOptions = function(n) {
  return ka.setOptions(n), je.defaults = ka.defaults, vm(je.defaults), je;
};
je.getDefaults = hc;
je.defaults = Sa;
je.use = function(...n) {
  return ka.use(...n), je.defaults = ka.defaults, vm(je.defaults), je;
};
je.walkTokens = function(n, a) {
  return ka.walkTokens(n, a);
};
je.parseInline = ka.parseInline;
je.Parser = Kt;
je.parser = Kt.parse;
je.Renderer = Ti;
je.TextRenderer = _c;
je.Lexer = Ht;
je.lexer = Ht.lex;
je.Tokenizer = Ni;
je.Hooks = Gl;
je.parse = je;
je.options;
je.setOptions;
je.use;
je.walkTokens;
je.parseInline;
Kt.parse;
Ht.lex;
//! markdown.mjs: a Markdown file's rendered preview, drawn from `marked`'s tokens into a fixed set of elements, the
//! ones the web's sanitised preview keeps (`renderFilePreview` in `packages/web/src/markdown.ts`), so the web's
//! `.file-markdown` rules style both. Nothing is parsed as HTML: an HTML token is drawn as its text. Nothing loads on
//! its own: an image is the web's text placeholder (`[image: alt] url`). A link is drawn only for an absolute
//! http(s) address and opens on an explicit click through the window (`link.open`); any other keeps its address as
//! its title, as the web's does.
const ui = 2e5;
function my(n) {
  if (n.length <= ui) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, ui);
  return { source: n.slice(0, a > 0 ? a : ui), truncated: !0 };
}
const hy = (n, a, r) => {
  const i = r.startsWith("data:") ? "data URL" : r.length > 200 ? `${r.slice(0, 200)}…` : r;
  return `[${n}${a ? `: ${a}` : ""}]${i ? ` ${i}` : ""}`;
};
function ya(n, a) {
  return (n ?? []).map((r, i) => gy(r, i, a));
}
function ga(n, a) {
  return n.tokens ? ya(n.tokens, a) : n.text;
}
function gy(n, a, r) {
  switch (n.type) {
    case "space":
      return null;
    case "heading":
      return W.createElement(`h${n.depth}`, { key: a }, ga(n, r));
    case "paragraph":
      return W.createElement("p", { key: a }, ga(n, r));
    case "text":
      return n.tokens ? W.createElement(W.Fragment, { key: a }, ya(n.tokens, r)) : n.text;
    case "escape":
      return n.text;
    case "strong":
      return W.createElement("strong", { key: a }, ga(n, r));
    case "em":
      return W.createElement("em", { key: a }, ga(n, r));
    case "del":
      return W.createElement("del", { key: a }, ga(n, r));
    case "codespan":
      return W.createElement("code", { key: a }, n.text);
    case "br":
      return W.createElement("br", { key: a });
    case "hr":
      return W.createElement("hr", { key: a });
    case "code": {
      const i = /^[\w#+.-]+$/.test(n.lang ?? "") ? `language-${n.lang}` : void 0;
      return W.createElement("pre", { key: a }, W.createElement("code", i ? { className: i } : null, n.text));
    }
    case "blockquote":
      return W.createElement("blockquote", { key: a }, ya(n.tokens, r));
    case "list": {
      const i = n.items.map((s, c) => W.createElement(
        "li",
        { key: c },
        s.task ? W.createElement("input", { type: "checkbox", checked: !!s.checked, disabled: !0, readOnly: !0 }) : null,
        s.task ? " " : null,
        ya(s.tokens, r)
      ));
      return n.ordered ? W.createElement("ol", { key: a, start: n.start === "" || n.start === 1 ? void 0 : n.start }, i) : W.createElement("ul", { key: a }, i);
    }
    case "table": {
      const i = (s) => n.align[s] ? { textAlign: n.align[s] } : void 0;
      return W.createElement(
        "table",
        { key: a },
        W.createElement("thead", null, W.createElement("tr", null, n.header.map((s, c) => W.createElement("th", { key: c, style: i(c) }, ya(s.tokens, r))))),
        W.createElement("tbody", null, n.rows.map((s, c) => W.createElement("tr", { key: c }, s.map((f, d) => W.createElement("td", { key: d, style: i(d) }, ya(f.tokens, r))))))
      );
    }
    case "link": {
      const i = n.href ?? "";
      if (!/^https?:\/\//i.test(i)) return W.createElement("a", { key: a, title: i || void 0 }, ga(n, r));
      const s = (c) => {
        c.preventDefault?.(), r(i);
      };
      return W.createElement("a", { key: a, href: i, rel: "noopener noreferrer", onClick: s }, ga(n, r));
    }
    case "image":
      return W.createElement("span", { key: a, className: "md-placeholder" }, hy("image", n.text, n.href ?? ""));
    // Raw HTML is never parsed: it is drawn as written.
    case "html":
      return n.block ? W.createElement("p", { key: a }, n.text) : n.text;
    default:
      return n.raw ?? null;
  }
}
function by(n, a) {
  return ya(Ht.lex(n, { gfm: !0 }), a);
}
const li = 4, Qn = 8, vy = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", bp = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function yy({ value: n, onChange: a, options: r, className: i, ariaLabel: s, testId: c, id: f, title: d, disabled: m, placeholder: g, freeText: x, onKeyDown: y }) {
  const b = W.useId(), [S, E] = W.useState(!1), [R, z] = W.useState(-1), [j, O] = W.useState(!1), H = W.useRef(null), K = W.useRef(null), [J, T] = W.useState({}), h = W.useRef({ text: "", at: 0 }), w = x && j && n ? r.filter((Q) => bp(Q).toLowerCase().includes(n.toLowerCase()) || Q.value.toLowerCase().includes(n.toLowerCase())) : r, k = r.find((Q) => Q.value === n), _ = (Q) => `${b}-${Q}`;
  function C(Q) {
    m || (z(Q), E(!0));
  }
  function N() {
    E(!1), O(!1), z(-1);
  }
  function D(Q) {
    !Q || Q.disabled || (a(Q.value), N());
  }
  function G(Q, V) {
    for (let A = 1; A <= w.length; A++) {
      const Z = (Q + V * A + w.length * A) % w.length;
      if (!w[Z].disabled) return Z;
    }
    return Q;
  }
  const $ = () => w.findIndex((Q) => !Q.disabled), q = () => w.length - 1 - [...w].reverse().findIndex((Q) => !Q.disabled);
  mi(() => {
    if (!S || !H.current) {
      T((ae) => ae.left === void 0 ? ae : {});
      return;
    }
    const Q = H.current.getBoundingClientRect(), V = window.innerHeight - Q.bottom - li - Qn, A = Q.top - li - Qn, Z = V < 160 && A > V;
    T({
      position: "fixed",
      left: Math.min(Math.max(Qn, Q.left), Math.max(Qn, window.innerWidth - Q.width - Qn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: Q.width,
      maxWidth: window.innerWidth - 2 * Qn,
      maxHeight: Math.min(Z ? A : V, 320),
      ...Z ? { bottom: window.innerHeight - Q.top + li } : { top: Q.bottom + li },
      overflowY: "auto"
    });
  }, [S, w.length]), mi(() => {
    const Q = K.current;
    if (!S || !Q || J.left === void 0) return;
    const V = Q.getBoundingClientRect().right, A = window.innerWidth - Qn;
    V > A && T((Z) => ({ ...Z, left: Math.max(Qn, Number(Z.left) - (V - A)) }));
  }, [S, J]), ct(() => {
    if (!S) return;
    const Q = (V) => {
      const A = V.target;
      (A === document || A instanceof Node && H.current && A.contains(H.current)) && N();
    };
    return window.addEventListener("resize", N), window.addEventListener("scroll", Q, !0), () => {
      window.removeEventListener("resize", N), window.removeEventListener("scroll", Q, !0);
    };
  }, [S]), ct(() => {
    const Q = S && R >= 0 ? document.getElementById(_(R)) : null, V = K.current;
    !Q || !V || (Q.offsetTop < V.scrollTop ? V.scrollTop = Q.offsetTop : Q.offsetTop + Q.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = Q.offsetTop + Q.offsetHeight - V.clientHeight));
  }, [S, R]), Am(S, (Q) => {
    Q || N();
  }, H, K);
  function X(Q) {
    if (Q.nativeEvent.isComposing) return;
    const V = () => {
      Q.preventDefault(), Q.stopPropagation();
    }, { key: A } = Q;
    if (S) {
      if (A === "Escape") {
        V(), N();
        return;
      } else if (A === "Tab")
        N();
      else if (A === "ArrowDown" || A === "ArrowUp") {
        V(), w.length && z(R < 0 ? A === "ArrowDown" ? $() : q() : G(R, A === "ArrowDown" ? 1 : -1));
        return;
      } else if (A === "Home" && !x) {
        V(), z($());
        return;
      } else if (A === "End" && !x) {
        V(), z(q());
        return;
      } else if (A === "Enter" || A === " " && !x) {
        if (R >= 0 && w[R]) {
          V(), D(w[R]);
          return;
        }
        if (!x) {
          V(), N();
          return;
        }
      } else if (!x && A.length === 1 && !Q.metaKey && !Q.ctrlKey && !Q.altKey) {
        const Z = Date.now();
        h.current = { text: (Z - h.current.at > 600 ? "" : h.current.text) + A.toLowerCase(), at: Z };
        const ae = Math.max(R, 0), oe = [...w.slice(ae + (h.current.text.length === 1 ? 1 : 0)), ...w.slice(0, ae + 1)].find((ce) => !ce.disabled && bp(ce).toLowerCase().startsWith(h.current.text));
        oe && (V(), z(w.indexOf(oe)));
        return;
      }
    } else if (A === "ArrowDown" || A === "ArrowUp" || !x && (A === "Enter" || A === " ")) {
      V(), C(Math.max(0, w.findIndex((Z) => Z.value === n)));
      return;
    }
    y?.(Q);
  }
  const I = {
    ref: (Q) => {
      H.current = Q;
    },
    id: f,
    title: d,
    disabled: m,
    "aria-label": s,
    "aria-expanded": S,
    "aria-controls": S ? b : void 0,
    "aria-activedescendant": S && R >= 0 ? _(R) : void 0,
    "data-testid": c,
    onKeyDown: X
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
        placeholder: g,
        className: i,
        value: n,
        onChange: (Q) => {
          a(Q.target.value), O(!0), S ? z(-1) : (z(-1), E(!0));
        },
        onBlur: () => N()
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
        onClick: () => S ? N() : C(Math.max(0, w.findIndex((Q) => Q.value === n))),
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "min-w-0 flex-1 truncate", children: k ? k.label : g ?? "" }),
          /* @__PURE__ */ te.jsx(zc, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && w.length > 0 && Jl(
      /* @__PURE__ */ te.jsx(
        "div",
        {
          ref: K,
          id: b,
          role: "listbox",
          "aria-label": s,
          className: Ge("z-[9999]", Di),
          style: J,
          onMouseDown: (Q) => {
            Q.preventDefault(), Q.stopPropagation();
          },
          onClick: (Q) => Q.stopPropagation(),
          children: w.map((Q, V) => /* @__PURE__ */ te.jsxs(
            "div",
            {
              id: _(V),
              role: "option",
              "aria-selected": Q.value === n,
              "aria-disabled": Q.disabled || void 0,
              "data-value": Q.value,
              className: Ge(vy, V === R && !Q.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                Q.disabled || z(V);
              },
              onClick: () => D(Q),
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
const vp = 230, xy = 370;
function wy({ x: n, y: a, readOnly: r, canUndo: i, canRedo: s, hasSelection: c, onClose: f, actions: d }) {
  const m = W.useRef(null);
  ct(() => {
    const b = (E) => {
      m.current?.contains(E.target) || f();
    }, S = (E) => {
      E.key === "Escape" && (E.preventDefault(), f());
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", S), window.addEventListener("blur", f), window.addEventListener("resize", f), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", S), window.removeEventListener("blur", f), window.removeEventListener("resize", f);
    };
  }, [f]);
  const g = (b, S) => Po(Om ? b : S), x = (b, S, E, R, z = !1) => /* @__PURE__ */ te.jsxs("button", { type: "button", className: Ge(Dm(), "flex items-center justify-between gap-6"), "data-testid": E, disabled: z, onClick: S, children: [
    /* @__PURE__ */ te.jsx("span", { children: b }),
    /* @__PURE__ */ te.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: R })
  ] }), y = d.askAgent;
  return Jl(
    /* @__PURE__ */ te.jsxs(
      "div",
      {
        ref: m,
        className: Di,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - xy - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - vp - 8)),
          zIndex: 9999,
          minWidth: vp
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          y && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
            x(c ? "Ask agent about selection…" : "Ask agent about file…", y, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ te.jsx("div", { className: fi })
          ] }),
          x("Undo", d.undo, "editor-menu-undo", g("cmd+z", "ctrl+z"), r || !i),
          x("Redo", d.redo, "editor-menu-redo", g("cmd+shift+z", "ctrl+y"), r || !s),
          /* @__PURE__ */ te.jsx("div", { className: fi }),
          x("Cut", d.cut, "editor-menu-cut", g("cmd+x", "ctrl+x"), r || !c),
          x("Copy", d.copy, "editor-menu-copy", g("cmd+c", "ctrl+c"), !c),
          x("Paste", d.paste, "editor-menu-paste", g("cmd+v", "ctrl+v"), r),
          x("Select All", d.selectAll, "editor-menu-select-all", g("cmd+a", "ctrl+a")),
          /* @__PURE__ */ te.jsx("div", { className: fi }),
          x("Find…", d.find, "editor-menu-find", g("cmd+f", "ctrl+f")),
          !r && x("Replace…", d.replace, "editor-menu-replace", g("cmd+alt+f", "ctrl+h")),
          x("Go to Line…", d.gotoLine, "editor-menu-goto", Po("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const ky = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", _y = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Sy = "m-0 mb-2 text-[0.82rem] text-subtext-0", Tm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Sc = `${Tm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Ey = `${Sc} min-w-[5.5rem] shrink-0`, Ec = `${Tm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, zy = `${Ec} flex-1 max-[700px]:flex-[1_1_100%]`, Ny = `${Ec} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, Ty = `${Ec} flex-[1_1_100%]`, Cy = "flex flex-wrap items-center gap-[0.4rem]", Ay = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", My = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", jy = `settings-modal__host-row ${My}`, Ry = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", Oy = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Cm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", Dy = `${Cm} bg-accent`, By = `${Cm} ml-auto bg-red`;
function zc({ open: n, size: a = 12, className: r }) {
  return /* @__PURE__ */ te.jsx("svg", { className: r, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ te.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Hy({ label: n, items: a, testId: r, side: i = "right", up: s = !1, maxHeight: c = 320 }) {
  const [f, d] = W.useState(!1), [m, g] = W.useState(!1), x = W.useRef(null), y = W.useRef(null), b = () => [...y.current?.querySelectorAll('[role="menuitem"]') ?? []];
  ct(() => {
    f && m && (b()[0]?.focus(), g(!1));
  }, [f, m]);
  const S = () => {
    d(!0), g(!0);
  }, E = (z) => {
    (z.key === "ArrowRight" || z.key === "Enter" || z.key === " ") && (z.preventDefault(), S());
  }, R = (z) => {
    const j = b(), O = j.findIndex((H) => H === document.activeElement);
    z.key === "ArrowDown" || z.key === "ArrowUp" ? (z.preventDefault(), j[(O + (z.key === "ArrowDown" ? 1 : j.length - 1)) % j.length]?.focus()) : (z.key === "ArrowLeft" || z.key === "Escape") && (z.preventDefault(), z.stopPropagation(), d(!1), x.current?.focus());
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
        className: Ge(Ko(), "flex items-center justify-between gap-2"),
        "data-testid": r,
        onClick: () => f ? d(!1) : S(),
        onKeyDown: E,
        children: [
          /* @__PURE__ */ te.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ te.jsx(zc, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ te.jsx(
      "div",
      {
        ref: y,
        role: "menu",
        "aria-label": n,
        className: Ge(
          Di,
          "absolute z-10 w-60 overflow-y-auto",
          i === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          f ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: c },
        onKeyDown: R,
        children: a.map((z) => /* @__PURE__ */ te.jsx("button", { type: "button", role: "menuitem", className: Ko(), "data-testid": z.testId, onClick: z.onSelect, children: /* @__PURE__ */ te.jsx("span", { className: "block truncate", children: z.label }) }, z.key))
      }
    )
  ] });
}
function Uy(n) {
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
function Fo(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((r) => r.id === n.parentSessionId);
}
function qy(n) {
  const a = /* @__PURE__ */ new Map();
  for (const r of n)
    Fo(r, n) && a.set(r.parentSessionId, [...a.get(r.parentSessionId) ?? [], r]);
  return a.size ? n.filter((r) => !Fo(r, n)).flatMap((r) => [r, ...a.get(r.id) ?? []]) : n;
}
const ri = 6, yp = 8;
function Gy(n, a = {}) {
  const { minWidth: r = 220, align: i = "right", minSpaceAbove: s = 100 } = a, c = n.getBoundingClientRect(), f = window.innerWidth, d = window.innerHeight, m = i === "right" ? { right: Math.max(0, f - c.right) } : { left: Math.max(0, c.left) }, g = c.top - ri - yp, x = d - c.bottom - ri - yp;
  return g >= s ? {
    position: "fixed",
    bottom: d - c.top + ri,
    ...m,
    minWidth: r,
    maxHeight: Math.min(g, d * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: c.bottom + ri,
    ...m,
    minWidth: r,
    maxHeight: Math.min(x, d * 0.75),
    overflowY: "auto"
  };
}
function Am(n, a, r, i) {
  ct(() => {
    if (!n) return;
    function s(f) {
      const d = f.target, m = r.current?.contains(d) ?? !1, g = i.current?.contains(d) ?? !1;
      !m && !g && a(!1);
    }
    function c(f) {
      f.key === "Escape" && a(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", c), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", c);
    };
  }, [n]);
}
function Ly({ icon: n, fallback: a }) {
  const [r, i] = W.useState(!1);
  return ct(() => i(!1), [n]), !n || r ? /* @__PURE__ */ te.jsx(te.Fragment, { children: a }) : /* @__PURE__ */ te.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
function Yy(n, a = !1) {
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
const Qy = {
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
function Vy({ name: n, directory: a = !1, open: r = !1 }) {
  const { kind: i, tone: s, text: c } = Yy(n, a);
  return /* @__PURE__ */ te.jsxs("svg", { className: Ge("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": i, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    i === "react" ? /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ te.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : c ? /* @__PURE__ */ te.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: c }) : /* @__PURE__ */ te.jsx("path", { d: i === "folder" && r ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : Qy[i] }),
    i === "branch" && /* @__PURE__ */ te.jsxs(te.Fragment, { children: [
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ te.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    i === "image" && /* @__PURE__ */ te.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const Xy = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, xp = (n) => typeof n == "string" ? Xy[n] ?? "?" : "?", wp = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function Ky(n) {
  const a = xp(n.index), r = xp(n.worktree), i = a === "!" || r === "!", s = i ? "!" : n.staged && n.unstaged ? `${a || "?"}/${r || "?"}` : n.staged ? a : r || a, c = `Git · Index: ${wp(n.index)}; working tree: ${wp(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, f = i || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: c, tone: f };
}
function Zy({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ te.jsx("span", { className: Ge("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: r, title: i, tone: s } = Ky(n.entry);
  return r ? /* @__PURE__ */ te.jsx("span", { className: Ge("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": i, title: i, "data-testid": "file-git-marker", children: r }) : null;
}
const Jy = ["application/zip", "application/x-tar", "application/gzip"];
function Wy(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (Jy.includes(a)) return "archive";
}
const $y = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Mm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Fy = `${Mm} group-aria-[checked=false]:text-accent`, Iy = `${Mm} group-aria-checked:text-accent`, Py = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", ex = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function tx({
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
      className: $y,
      "data-testid": r,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => a(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__label mode-switch__label--ui", Fy), children: "UI" }),
        /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__track", Py), children: /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__thumb", ex) }) }),
        /* @__PURE__ */ te.jsx("span", { className: Ge("mode-switch__label mode-switch__label--cli", Iy), children: "CLI" })
      ]
    }
  );
}
const al = function(n, a) {
  let s = n;
  const c = Ll[a];
  let f = null, d = 0, m = null;
  const g = [], x = {}, y = function(h, w) {
    d = s * 4 + 17, f = (function(k) {
      const _ = new Array(k);
      for (let C = 0; C < k; C += 1) {
        _[C] = new Array(k);
        for (let N = 0; N < k; N += 1)
          _[C][N] = null;
      }
      return _;
    })(d), b(0, 0), b(d - 7, 0), b(0, d - 7), R(), E(), j(h, w), s >= 7 && z(h), m == null && (m = K(s, c, g)), O(m, w);
  }, b = function(h, w) {
    for (let k = -1; k <= 7; k += 1)
      if (!(h + k <= -1 || d <= h + k))
        for (let _ = -1; _ <= 7; _ += 1)
          w + _ <= -1 || d <= w + _ || (0 <= k && k <= 6 && (_ == 0 || _ == 6) || 0 <= _ && _ <= 6 && (k == 0 || k == 6) || 2 <= k && k <= 4 && 2 <= _ && _ <= 4 ? f[h + k][w + _] = !0 : f[h + k][w + _] = !1);
  }, S = function() {
    let h = 0, w = 0;
    for (let k = 0; k < 8; k += 1) {
      y(!0, k);
      const _ = Xn.getLostPoint(x);
      (k == 0 || h > _) && (h = _, w = k);
    }
    return w;
  }, E = function() {
    for (let h = 8; h < d - 8; h += 1)
      f[h][6] == null && (f[h][6] = h % 2 == 0);
    for (let h = 8; h < d - 8; h += 1)
      f[6][h] == null && (f[6][h] = h % 2 == 0);
  }, R = function() {
    const h = Xn.getPatternPosition(s);
    for (let w = 0; w < h.length; w += 1)
      for (let k = 0; k < h.length; k += 1) {
        const _ = h[w], C = h[k];
        if (f[_][C] == null)
          for (let N = -2; N <= 2; N += 1)
            for (let D = -2; D <= 2; D += 1)
              N == -2 || N == 2 || D == -2 || D == 2 || N == 0 && D == 0 ? f[_ + N][C + D] = !0 : f[_ + N][C + D] = !1;
      }
  }, z = function(h) {
    const w = Xn.getBCHTypeNumber(s);
    for (let k = 0; k < 18; k += 1) {
      const _ = !h && (w >> k & 1) == 1;
      f[Math.floor(k / 3)][k % 3 + d - 8 - 3] = _;
    }
    for (let k = 0; k < 18; k += 1) {
      const _ = !h && (w >> k & 1) == 1;
      f[k % 3 + d - 8 - 3][Math.floor(k / 3)] = _;
    }
  }, j = function(h, w) {
    const k = c << 3 | w, _ = Xn.getBCHTypeInfo(k);
    for (let C = 0; C < 15; C += 1) {
      const N = !h && (_ >> C & 1) == 1;
      C < 6 ? f[C][8] = N : C < 8 ? f[C + 1][8] = N : f[d - 15 + C][8] = N;
    }
    for (let C = 0; C < 15; C += 1) {
      const N = !h && (_ >> C & 1) == 1;
      C < 8 ? f[8][d - C - 1] = N : C < 9 ? f[8][15 - C - 1 + 1] = N : f[8][15 - C - 1] = N;
    }
    f[d - 8][8] = !h;
  }, O = function(h, w) {
    let k = -1, _ = d - 1, C = 7, N = 0;
    const D = Xn.getMaskFunction(w);
    for (let G = d - 1; G > 0; G -= 2)
      for (G == 6 && (G -= 1); ; ) {
        for (let $ = 0; $ < 2; $ += 1)
          if (f[_][G - $] == null) {
            let q = !1;
            N < h.length && (q = (h[N] >>> C & 1) == 1), D(_, G - $) && (q = !q), f[_][G - $] = q, C -= 1, C == -1 && (N += 1, C = 7);
          }
        if (_ += k, _ < 0 || d <= _) {
          _ -= k, k = -k;
          break;
        }
      }
  }, H = function(h, w) {
    let k = 0, _ = 0, C = 0;
    const N = new Array(w.length), D = new Array(w.length);
    for (let X = 0; X < w.length; X += 1) {
      const I = w[X].dataCount, Q = w[X].totalCount - I;
      _ = Math.max(_, I), C = Math.max(C, Q), N[X] = new Array(I);
      for (let ae = 0; ae < N[X].length; ae += 1)
        N[X][ae] = 255 & h.getBuffer()[ae + k];
      k += I;
      const V = Xn.getErrorCorrectPolynomial(Q), Z = Kl(N[X], V.getLength() - 1).mod(V);
      D[X] = new Array(V.getLength() - 1);
      for (let ae = 0; ae < D[X].length; ae += 1) {
        const oe = ae + Z.getLength() - D[X].length;
        D[X][ae] = oe >= 0 ? Z.getAt(oe) : 0;
      }
    }
    let G = 0;
    for (let X = 0; X < w.length; X += 1)
      G += w[X].totalCount;
    const $ = new Array(G);
    let q = 0;
    for (let X = 0; X < _; X += 1)
      for (let I = 0; I < w.length; I += 1)
        X < N[I].length && ($[q] = N[I][X], q += 1);
    for (let X = 0; X < C; X += 1)
      for (let I = 0; I < w.length; I += 1)
        X < D[I].length && ($[q] = D[I][X], q += 1);
    return $;
  }, K = function(h, w, k) {
    const _ = kp.getRSBlocks(h, w), C = _p();
    for (let D = 0; D < k.length; D += 1) {
      const G = k[D];
      C.put(G.getMode(), 4), C.put(G.getLength(), Xn.getLengthInBits(G.getMode(), h)), G.write(C);
    }
    let N = 0;
    for (let D = 0; D < _.length; D += 1)
      N += _[D].dataCount;
    if (C.getLengthInBits() > N * 8)
      throw "code length overflow. (" + C.getLengthInBits() + ">" + N * 8 + ")";
    for (C.getLengthInBits() + 4 <= N * 8 && C.put(0, 4); C.getLengthInBits() % 8 != 0; )
      C.putBit(!1);
    for (; !(C.getLengthInBits() >= N * 8 || (C.put(236, 8), C.getLengthInBits() >= N * 8)); )
      C.put(17, 8);
    return H(C, _);
  };
  x.addData = function(h, w) {
    w = w || "Byte";
    let k = null;
    switch (w) {
      case "Numeric":
        k = nx(h);
        break;
      case "Alphanumeric":
        k = ax(h);
        break;
      case "Byte":
        k = lx(h);
        break;
      case "Kanji":
        k = rx(h);
        break;
      default:
        throw "mode:" + w;
    }
    g.push(k), m = null;
  }, x.isDark = function(h, w) {
    if (h < 0 || d <= h || w < 0 || d <= w)
      throw h + "," + w;
    return f[h][w];
  }, x.getModuleCount = function() {
    return d;
  }, x.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const w = kp.getRSBlocks(h, c), k = _p();
        for (let C = 0; C < g.length; C++) {
          const N = g[C];
          k.put(N.getMode(), 4), k.put(N.getLength(), Xn.getLengthInBits(N.getMode(), h)), N.write(k);
        }
        let _ = 0;
        for (let C = 0; C < w.length; C++)
          _ += w[C].dataCount;
        if (k.getLengthInBits() <= _ * 8)
          break;
      }
      s = h;
    }
    y(!1, S());
  }, x.createTableTag = function(h, w) {
    h = h || 2, w = typeof w > "u" ? h * 4 : w;
    let k = "";
    k += '<table style="', k += " border-width: 0px; border-style: none;", k += " border-collapse: collapse;", k += " padding: 0px; margin: " + w + "px;", k += '">', k += "<tbody>";
    for (let _ = 0; _ < x.getModuleCount(); _ += 1) {
      k += "<tr>";
      for (let C = 0; C < x.getModuleCount(); C += 1)
        k += '<td style="', k += " border-width: 0px; border-style: none;", k += " border-collapse: collapse;", k += " padding: 0px; margin: 0px;", k += " width: " + h + "px;", k += " height: " + h + "px;", k += " background-color: ", k += x.isDark(_, C) ? "#000000" : "#ffffff", k += ";", k += '"/>';
      k += "</tr>";
    }
    return k += "</tbody>", k += "</table>", k;
  }, x.createSvgTag = function(h, w, k, _) {
    let C = {};
    typeof arguments[0] == "object" && (C = arguments[0], h = C.cellSize, w = C.margin, k = C.alt, _ = C.title), h = h || 2, w = typeof w > "u" ? h * 4 : w, k = typeof k == "string" ? { text: k } : k || {}, k.text = k.text || null, k.id = k.text ? k.id || "qrcode-description" : null, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-title" : null;
    const N = x.getModuleCount() * h + w * 2;
    let D, G, $, q, X = "", I;
    for (I = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", X += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', X += C.scalable ? "" : ' width="' + N + 'px" height="' + N + 'px"', X += ' viewBox="0 0 ' + N + " " + N + '" ', X += ' preserveAspectRatio="xMinYMin meet"', X += _.text || k.text ? ' role="img" aria-labelledby="' + J([_.id, k.id].join(" ").trim()) + '"' : "", X += ">", X += _.text ? '<title id="' + J(_.id) + '">' + J(_.text) + "</title>" : "", X += k.text ? '<description id="' + J(k.id) + '">' + J(k.text) + "</description>" : "", X += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', X += '<path d="', $ = 0; $ < x.getModuleCount(); $ += 1)
      for (q = $ * h + w, D = 0; D < x.getModuleCount(); D += 1)
        x.isDark($, D) && (G = D * h + w, X += "M" + G + "," + q + I);
    return X += '" stroke="transparent" fill="black"/>', X += "</svg>", X;
  }, x.createDataURL = function(h, w) {
    h = h || 2, w = typeof w > "u" ? h * 4 : w;
    const k = x.getModuleCount() * h + w * 2, _ = w, C = k - w;
    return cx(k, k, function(N, D) {
      if (_ <= N && N < C && _ <= D && D < C) {
        const G = Math.floor((N - _) / h), $ = Math.floor((D - _) / h);
        return x.isDark($, G) ? 0 : 1;
      } else
        return 1;
    });
  }, x.createImgTag = function(h, w, k) {
    h = h || 2, w = typeof w > "u" ? h * 4 : w;
    const _ = x.getModuleCount() * h + w * 2;
    let C = "";
    return C += "<img", C += ' src="', C += x.createDataURL(h, w), C += '"', C += ' width="', C += _, C += '"', C += ' height="', C += _, C += '"', k && (C += ' alt="', C += J(k), C += '"'), C += "/>", C;
  };
  const J = function(h) {
    let w = "";
    for (let k = 0; k < h.length; k += 1) {
      const _ = h.charAt(k);
      switch (_) {
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
          w += _;
          break;
      }
    }
    return w;
  }, T = function(h) {
    h = typeof h > "u" ? 2 : h;
    const k = x.getModuleCount() * 1 + h * 2, _ = h, C = k - h;
    let N, D, G, $, q;
    const X = {
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
    for (N = 0; N < k; N += 2) {
      for (G = Math.floor((N - _) / 1), $ = Math.floor((N + 1 - _) / 1), D = 0; D < k; D += 1)
        q = "█", _ <= D && D < C && _ <= N && N < C && x.isDark(G, Math.floor((D - _) / 1)) && (q = " "), _ <= D && D < C && _ <= N + 1 && N + 1 < C && x.isDark($, Math.floor((D - _) / 1)) ? q += " " : q += "█", Q += h < 1 && N + 1 >= C ? I[q] : X[q];
      Q += `
`;
    }
    return k % 2 && h > 0 ? Q.substring(0, Q.length - k - 1) + Array(k + 1).join("▀") : Q.substring(0, Q.length - 1);
  };
  return x.createASCII = function(h, w) {
    if (h = h || 1, h < 2)
      return T(w);
    h -= 1, w = typeof w > "u" ? h * 2 : w;
    const k = x.getModuleCount() * h + w * 2, _ = w, C = k - w;
    let N, D, G, $;
    const q = Array(h + 1).join("██"), X = Array(h + 1).join("  ");
    let I = "", Q = "";
    for (N = 0; N < k; N += 1) {
      for (G = Math.floor((N - _) / h), Q = "", D = 0; D < k; D += 1)
        $ = 1, _ <= D && D < C && _ <= N && N < C && x.isDark(G, Math.floor((D - _) / h)) && ($ = 0), Q += $ ? q : X;
      for (G = 0; G < h; G += 1)
        I += Q + `
`;
    }
    return I.substring(0, I.length - 1);
  }, x.renderTo2dContext = function(h, w) {
    w = w || 2;
    const k = x.getModuleCount();
    for (let _ = 0; _ < k; _++)
      for (let C = 0; C < k; C++)
        h.fillStyle = x.isDark(_, C) ? "black" : "white", h.fillRect(C * w, _ * w, w, w);
  }, x;
};
al.stringToBytes = function(n) {
  const a = [];
  for (let r = 0; r < n.length; r += 1) {
    const i = n.charCodeAt(r);
    a.push(i & 255);
  }
  return a;
};
al.createStringToBytes = function(n, a) {
  const r = (function() {
    const s = sx(n), c = function() {
      const m = s.read();
      if (m == -1) throw "eof";
      return m;
    };
    let f = 0;
    const d = {};
    for (; ; ) {
      const m = s.read();
      if (m == -1) break;
      const g = c(), x = c(), y = c(), b = String.fromCharCode(m << 8 | g), S = x << 8 | y;
      d[b] = S, f += 1;
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
}, Ll = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
}, Vn = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
}, Xn = (function() {
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
      case Vn.PATTERN000:
        return function(d, m) {
          return (d + m) % 2 == 0;
        };
      case Vn.PATTERN001:
        return function(d, m) {
          return d % 2 == 0;
        };
      case Vn.PATTERN010:
        return function(d, m) {
          return m % 3 == 0;
        };
      case Vn.PATTERN011:
        return function(d, m) {
          return (d + m) % 3 == 0;
        };
      case Vn.PATTERN100:
        return function(d, m) {
          return (Math.floor(d / 2) + Math.floor(m / 3)) % 2 == 0;
        };
      case Vn.PATTERN101:
        return function(d, m) {
          return d * m % 2 + d * m % 3 == 0;
        };
      case Vn.PATTERN110:
        return function(d, m) {
          return (d * m % 2 + d * m % 3) % 2 == 0;
        };
      case Vn.PATTERN111:
        return function(d, m) {
          return (d * m % 3 + (d + m) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + f;
    }
  }, s.getErrorCorrectPolynomial = function(f) {
    let d = Kl([1], 0);
    for (let m = 0; m < f; m += 1)
      d = d.multiply(Kl([1, Kn.gexp(m)], 0));
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
    for (let y = 0; y < d; y += 1)
      for (let b = 0; b < d; b += 1) {
        let S = 0;
        const E = f.isDark(y, b);
        for (let R = -1; R <= 1; R += 1)
          if (!(y + R < 0 || d <= y + R))
            for (let z = -1; z <= 1; z += 1)
              b + z < 0 || d <= b + z || R == 0 && z == 0 || E == f.isDark(y + R, b + z) && (S += 1);
        S > 5 && (m += 3 + S - 5);
      }
    for (let y = 0; y < d - 1; y += 1)
      for (let b = 0; b < d - 1; b += 1) {
        let S = 0;
        f.isDark(y, b) && (S += 1), f.isDark(y + 1, b) && (S += 1), f.isDark(y, b + 1) && (S += 1), f.isDark(y + 1, b + 1) && (S += 1), (S == 0 || S == 4) && (m += 3);
      }
    for (let y = 0; y < d; y += 1)
      for (let b = 0; b < d - 6; b += 1)
        f.isDark(y, b) && !f.isDark(y, b + 1) && f.isDark(y, b + 2) && f.isDark(y, b + 3) && f.isDark(y, b + 4) && !f.isDark(y, b + 5) && f.isDark(y, b + 6) && (m += 40);
    for (let y = 0; y < d; y += 1)
      for (let b = 0; b < d - 6; b += 1)
        f.isDark(b, y) && !f.isDark(b + 1, y) && f.isDark(b + 2, y) && f.isDark(b + 3, y) && f.isDark(b + 4, y) && !f.isDark(b + 5, y) && f.isDark(b + 6, y) && (m += 40);
    let g = 0;
    for (let y = 0; y < d; y += 1)
      for (let b = 0; b < d; b += 1)
        f.isDark(b, y) && (g += 1);
    const x = Math.abs(100 * g / d / d - 50) / 5;
    return m += x * 10, m;
  }, s;
})(), Kn = (function() {
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
})(), Kl = function(n, a) {
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
        c[f + d] ^= Kn.gexp(Kn.glog(i.getAt(f)) + Kn.glog(s.getAt(d)));
    return Kl(c, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const c = Kn.glog(i.getAt(0)) - Kn.glog(s.getAt(0)), f = new Array(i.getLength());
    for (let d = 0; d < i.getLength(); d += 1)
      f[d] = i.getAt(d);
    for (let d = 0; d < s.getLength(); d += 1)
      f[d] ^= Kn.gexp(Kn.glog(s.getAt(d)) + c);
    return Kl(f, 0).mod(s);
  }, i;
}, kp = (function() {
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
      case Ll.L:
        return n[(s - 1) * 4 + 0];
      case Ll.M:
        return n[(s - 1) * 4 + 1];
      case Ll.Q:
        return n[(s - 1) * 4 + 2];
      case Ll.H:
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
    for (let g = 0; g < d; g += 1) {
      const x = f[g * 3 + 0], y = f[g * 3 + 1], b = f[g * 3 + 2];
      for (let S = 0; S < x; S += 1)
        m.push(a(y, b));
    }
    return m;
  }, r;
})(), _p = function() {
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
}, nx = function(n) {
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
}, ax = function(n) {
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
}, lx = function(n) {
  const a = pt.MODE_8BIT_BYTE, r = al.stringToBytes(n), i = {};
  return i.getMode = function() {
    return a;
  }, i.getLength = function(s) {
    return r.length;
  }, i.write = function(s) {
    for (let c = 0; c < r.length; c += 1)
      s.put(r[c], 8);
  }, i;
}, rx = function(n) {
  const a = pt.MODE_KANJI, r = al.stringToBytes;
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
}, jm = function() {
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
}, ix = function() {
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
}, sx = function(n) {
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
}, ox = function(n, a) {
  const r = n, i = a, s = new Array(n * a), c = {};
  c.setPixel = function(g, x, y) {
    s[x * r + g] = y;
  }, c.write = function(g) {
    g.writeString("GIF87a"), g.writeShort(r), g.writeShort(i), g.writeByte(128), g.writeByte(0), g.writeByte(0), g.writeByte(0), g.writeByte(0), g.writeByte(0), g.writeByte(255), g.writeByte(255), g.writeByte(255), g.writeString(","), g.writeShort(0), g.writeShort(0), g.writeShort(r), g.writeShort(i), g.writeByte(0);
    const x = 2, y = d(x);
    g.writeByte(x);
    let b = 0;
    for (; y.length - b > 255; )
      g.writeByte(255), g.writeBytes(y, b, 255), b += 255;
    g.writeByte(y.length - b), g.writeBytes(y, b, y.length - b), g.writeByte(0), g.writeString(";");
  };
  const f = function(g) {
    const x = g;
    let y = 0, b = 0;
    const S = {};
    return S.write = function(E, R) {
      if (E >>> R)
        throw "length over";
      for (; y + R >= 8; )
        x.writeByte(255 & (E << y | b)), R -= 8 - y, E >>>= 8 - y, b = 0, y = 0;
      b = E << y | b, y = y + R;
    }, S.flush = function() {
      y > 0 && x.writeByte(b);
    }, S;
  }, d = function(g) {
    const x = 1 << g, y = (1 << g) + 1;
    let b = g + 1;
    const S = m();
    for (let O = 0; O < x; O += 1)
      S.add(String.fromCharCode(O));
    S.add(String.fromCharCode(x)), S.add(String.fromCharCode(y));
    const E = jm(), R = f(E);
    R.write(x, b);
    let z = 0, j = String.fromCharCode(s[z]);
    for (z += 1; z < s.length; ) {
      const O = String.fromCharCode(s[z]);
      z += 1, S.contains(j + O) ? j = j + O : (R.write(S.indexOf(j), b), S.size() < 4095 && (S.size() == 1 << b && (b += 1), S.add(j + O)), j = O);
    }
    return R.write(S.indexOf(j), b), R.write(y, b), R.flush(), E.toByteArray();
  }, m = function() {
    const g = {};
    let x = 0;
    const y = {};
    return y.add = function(b) {
      if (y.contains(b))
        throw "dup key:" + b;
      g[b] = x, x += 1;
    }, y.size = function() {
      return x;
    }, y.indexOf = function(b) {
      return g[b];
    }, y.contains = function(b) {
      return typeof g[b] < "u";
    }, y;
  };
  return c;
}, cx = function(n, a, r) {
  const i = ox(n, a);
  for (let d = 0; d < a; d += 1)
    for (let m = 0; m < n; m += 1)
      i.setPixel(m, d, r(m, d));
  const s = jm();
  i.write(s);
  const c = ix(), f = s.toByteArray();
  for (let d = 0; d < f.length; d += 1)
    c.writeByte(f[d]);
  return c.flush(), "data:image/gif;base64," + c;
};
al.stringToBytes;
function ux({ text: n }) {
  const { size: a, path: r } = W.useMemo(() => {
    const i = al(0, "M");
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
const Zl = W.createContext(""), Io = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function dx({ title: n, children: a, testId: r, ariaLabel: i }) {
  const s = W.useContext(Zl), c = s !== "" && Io(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ te.jsxs("section", { className: s && !c ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": r, "aria-label": i, children: [
      n && /* @__PURE__ */ te.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ te.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ te.jsx(Zl.Provider, { value: c ? "" : s, children: a }) })
    ] })
  );
}
function fx({ title: n, description: a, children: r, testId: i }) {
  const s = W.useContext(Zl);
  return s && !Io(n, s) && !Io(a, s) ? null : /* @__PURE__ */ te.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ te.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ te.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ te.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    r && /* @__PURE__ */ te.jsx("div", { className: "flex shrink-0 items-center gap-2", children: r })
  ] });
}
function px({ checked: n, onChange: a, testId: r, label: i }) {
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
const mx = () => W.useContext(Zl), hx = {
  select: Sc,
  selectHost: Ey,
  input: zy,
  inputPort: Ny,
  inputWide: Ty,
  addRow: Cy,
  list: Ay,
  hostRow: jy,
  name: Ry,
  addr: Oy,
  muted: _y,
  empty: Sy,
  primary: Dy,
  danger: By,
  catalogToggle: ky
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const gx = 512, ln = /* @__PURE__ */ new Map(), Ql = /* @__PURE__ */ new Map();
function Rm(n, a) {
  ln.delete(n), ln.set(n, a);
  for (const r of ln.keys()) {
    if (ln.size <= gx) break;
    Ql.get(r)?.size || ln.delete(r);
  }
}
function bx(n, a) {
  return ln.has(n) ? ln.get(n) : a;
}
function vx(n, a, r) {
  const i = bx(n, r), s = typeof a == "function" ? a(i) : a;
  if (!(ln.has(n) && Object.is(s, i))) {
    Rm(n, s);
    for (const c of [...Ql.get(n) ?? []]) c();
  }
}
function yx(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  ln.has(n) || Rm(n, a);
  const r = W.useCallback((c) => {
    const f = Ql.get(n) ?? /* @__PURE__ */ new Set();
    return Ql.set(n, f), f.add(c), () => {
      f.delete(c), f.size || Ql.delete(n);
    };
  }, [n]), i = W.useSyncExternalStore(r, () => ln.get(n)), s = W.useCallback((c) => vx(n, c, a), [n]);
  return [i, s];
}
const xx = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", wx = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const kx = "1.3.0";
let di = null;
const _x = (n) => {
  di = n;
};
function _e() {
  const n = (typeof di == "function" ? di() : di) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Sx = (n) => _e().subscribe?.(n) ?? (() => {
}), Ex = Gy;
function zx() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const Om = globalThis.perch?.isMac !== !1, Po = (n) => fv(n, _e().isMac !== !1), Nx = (n) => mv(n), Tx = ({ className: n, ...a } = {}) => Ge(gv(a), n), Cx = vv, Dm = (n) => Ko(n), fi = yv, Ax = mc, Mx = gm, jx = (n) => $o[n].color, Rx = (n, a) => _e().shortcutFor?.(n, a) ?? null, Ox = (n) => _e().shortcutLabel?.(n) ?? null, $l = (n, a) => _e().command(n, a ?? {}) !== !1, Dx = (n, a, r) => _e().startSession?.(n, a, r), Bx = globalThis.perch?.pickFolder ? (n) => _e().pickFolder(n) : null;
function Je(n) {
  const a = W.useRef(n);
  return a.current = n, W.useSyncExternalStore(Sx, () => a.current(_e()));
}
const Bm = (n = {}) => Je((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), Hx = () => Je((n) => n.hosts()), Ux = () => Je((n) => n.sessionFolders());
function qx() {
  const n = Je((a) => a.addProject?.() ?? Gx);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (a, r, i) => {
      a.trim() && n.status !== "pending" && _e().addProjectFolder?.(a, r, i);
    },
    clear: () => _e().clearAddProject?.()
  };
}
const Gx = Object.freeze({ status: "idle" }), Hm = "perch.lastAgentChoice", Lx = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Yx = () => {
  const n = _e().storage?.getItem(Hm);
  return n === "claude" || n === "codex" ? n : "claude";
}, Qx = Object.freeze({ items: [] });
function Vx() {
  const n = Je((a) => a.notifications?.() ?? Qx);
  return W.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => _e().command("notification.open", { id: a }),
    dismiss: (a) => _e().command("notification.dismiss", { id: a })
  }), [n]);
}
function Xx(n) {
  const a = Je((s) => s.agentChoices?.(n) ?? Lx), [r, i] = W.useState(Yx);
  return W.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: r,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (_e().storage?.setItem(Hm, s), i(s));
    },
    manage: () => _e().command("agents.manage", {})
  }), [a, r]);
}
function Kx(n) {
  ct(() => _e().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Zx(n) {
  const a = n.map((r) => ({ id: r.id, parentSessionId: r.parentId, session: r }));
  return qy(a).map((r) => ({ session: r.session, nested: Fo(r, a) }));
}
function Jx({ id: n, plain: a, className: r }) {
  const i = Je((g) => g.session(n));
  if (!i) return null;
  const s = i.state ?? Uy(i), c = $o[s]?.color ?? $o.unknown.color, f = i.provider, d = f === "claude" || f === "claude-agent-teams" || f === "omp", m = a ? Ge("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", r) : Ge("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", r);
  return W.createElement(
    "span",
    { className: m, style: a ? void 0 : { borderColor: c }, "data-provider": f ?? "unknown", title: a ? f ?? "Agent" : `${f ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    W.createElement("span", { className: Ge("inline-flex text-fg", d && "rounded-full bg-[#161616]") }, W.createElement(Um, { provider: f, size: 14 }))
  );
}
function Um({ provider: n, size: a = 14 }) {
  const r = _e().agentIcon?.(n, a) ?? null, i = r?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return W.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...r && r.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Wx = ({ children: n }) => W.createElement(W.Fragment, null, n);
function $x(n, a) {
  const r = W.useRef(a);
  return r.current = a, ct(() => {
    const i = _e();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [f, d] of Object.entries(r.current))
      s[f] = typeof d == "function" ? (...m) => r.current[f]?.(...m) : d;
    const c = i.openOverlay(n, s);
    return () => i.closeOverlay?.(c);
  }, [n]), null;
}
const Wn = (n) => function(r) {
  return $x(n, r);
}, Fx = Wn("session-menu"), Ix = Wn("new-session-menu"), Px = Wn("confirm");
let qm = null;
const ew = (n) => {
  qm = n;
};
function tw(n) {
  return W.createElement(qm ?? Px, n);
}
function nw({ className: n = Sc, ...a }) {
  return W.createElement(yy, { ...a, className: n });
}
let ec = null;
const aw = (n) => {
  ec = n;
}, lw = Wn("folder-browser");
function rw(n) {
  return ec ? W.createElement(ec, { ...n, browse: (a) => _e().browse(n.hostId, a) }) : W.createElement(lw, n);
}
const iw = Wn("instructions"), sw = Wn("memory"), ow = Sv;
let Nc = null;
const cw = (n) => {
  Nc = n;
};
function uw(n) {
  if (Nc) return W.createElement(fw, n);
  const { hostId: a, path: r, className: i } = n, s = W.useRef(null);
  return W.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Ge("worktree-menu__btn", gm, i),
      "data-testid": `worktree-menu-${a}-${r}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => _e().openOverlay?.("worktree", { hostId: a, cwd: r, anchor: s.current?.getBoundingClientRect() })
    },
    W.createElement(bm, null)
  );
}
const Gm = "Perch did not answer.";
function ii(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Gm };
}
function dw(n, a, r = _e()) {
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
const Sp = 5 * 6e4;
function Lm(n, a, r, i = _e()) {
  const s = Date.now() + Sp;
  let c = !1, f = () => {
  };
  const d = () => {
    c = !0, f(), clearTimeout(g);
  }, m = () => {
    if (!c) {
      if (Date.now() >= s) return d();
      dw(n, a, i) && (d(), i.startSession?.(n, a, r));
    }
  }, g = setTimeout(d, Sp);
  f = i.subscribe?.(m) ?? (() => {
  }), m();
}
function fw({ hostId: n, path: a, className: r, worktrees: i, request: s, parentChoices: c, emptyAgent: f, ...d }) {
  const [m, g] = W.useState(i), x = (_) => !!_e().coreCan?.(_, n), y = Bm(), b = `${n}:${a}`, S = W.useMemo(() => {
    if (Array.isArray(c)) return c;
    if (!x("workspace.nest")) return [];
    const _ = y?.projects?.find((D) => D.hostId === n && D.repoPath === a), C = [], N = (D, G) => {
      for (const $ of D ?? [])
        G && C.push({ id: $.id, name: $.name, path: $.path }), N($.children, !0);
    };
    return N(_?.workspaces, !1), C;
  }, [c, y, n, a]), E = n === "local" && x("worktree.job"), R = d.deleteSupported ?? x("worktree.delete"), z = d.startFromSupported ?? x("worktree.startFrom"), j = Je((_) => _.emptyWorkspaceAgent?.() ?? void 0), O = f ?? j ?? void 0, H = Je((_) => _.worktreeMenuRequest?.() ?? null), K = H?.projectKey === b ? H.nonce : null, J = W.useMemo(() => s ?? (K == null ? null : H), [s, K]), [T, h] = W.useState(J);
  ct(() => {
    J && h(J);
  }, [J]);
  const w = W.useRef({});
  w.current = { background: E, deleteSupported: R };
  const k = W.useMemo(() => {
    const _ = (C, N) => _e().ask(C, { hostId: n, repoPath: a, ...N });
    return {
      list: async () => {
        const C = await _("worktree.list", {});
        return C?.type === "worktree.list.result" && g({ worktrees: C.worktrees ?? [], defaultRoot: C.defaultRoot ?? "", baseRef: C.baseRef, refs: C.refs ?? [] }), ii(C);
      },
      create: async ({ branch: C, newBranch: N, path: D, extra: G, agent: $ }) => {
        const q = { branch: C, newBranch: !!N, path: D ?? null, name: G?.name ?? null, startFrom: G?.startFrom ?? null, parentWorkspaceId: G?.parentWorkspaceId ?? null }, { background: X } = w.current, I = await _(X ? "worktree.job.start" : "worktree.create", q), Q = X ? "worktree.job.started" : "worktree.done";
        if (I?.type !== Q) return { error: ii(I).error ?? Gm };
        const V = X ? I.job?.path : I.path;
        return $ && V && Lm(n, V, $), { background: X };
      },
      remove: async (C, N) => {
        const D = await _("worktree.remove", { path: C, force: !!N, deleteBranch: w.current.deleteSupported });
        return { ...ii(D), preservedBranch: D?.type === "worktree.done" ? D.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (C, N) => ii(await _("worktree.branch.delete", { branch: C, expectedHead: N })),
      open: (C) => _e().startSession?.(n, C, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => _e().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return W.createElement(Nc, {
    hostId: n,
    cwd: a,
    projectKey: b,
    className: r,
    worktrees: m,
    background: E,
    startFromSupported: z,
    deleteSupported: R,
    parentChoices: S,
    emptyAgent: O,
    request: T,
    actions: k
  });
}
const pw = (n, a) => {
  if (!_e().followPointer?.(n)) return;
  const r = a.items();
  for (const i of r) i.getBoundingClientRect();
  r[0]?.parentElement?.getBoundingClientRect(), ov(n, a);
}, mw = () => Je((n) => n.workspaceTabs());
function hw({ metadata: n }) {
  return W.createElement(
    "div",
    { className: "grid content-center justify-items-center gap-1 p-5 text-[0.72rem] text-subtext-0" },
    W.createElement("strong", { className: "text-[0.9rem] text-fg" }, n?.name ?? ""),
    W.createElement("span", null, `${n?.mediaType ?? "file"} · ${n?.size ?? 0} bytes`)
  );
}
function gw({ path: n, content: a }) {
  const { source: r, truncated: i } = my(a ?? ""), s = W.useMemo(() => by(r, (c) => $l("link.open", { url: c })), [r]);
  return W.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    i && W.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${ui.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    W.createElement("div", { className: "message__markdown file-markdown" }, s)
  );
}
const bw = Wn("file-menu"), vw = /* @__PURE__ */ new Map(), yw = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function xw(n, a = {}) {
  const r = Je((d) => d.workspaceFiles(n)), i = !!a.git, s = r.git?.decorations, c = W.useMemo(() => i && s?.length ? new Map(s) : vw, [s, i]), f = W.useMemo(() => Object.fromEntries(yw.map((d) => [d, (...m) => (_e().filesDo(d, n, ...m), null)])), [n]);
  return W.useMemo(() => ({
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
const ww = () => Je((n) => n.statusLine()), kw = () => Je((n) => n.zoom()), _w = () => Je((n) => n.paneLook()), Sw = () => Je((n) => n.keybindings?.() ?? []), Ew = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function zw(n) {
  const a = !!n?.keepFresh, r = Je((s) => s.statusLine?.().connected ?? !1), i = Je((s) => s.planUsage?.() ?? Ew);
  return ct(() => {
    if (!a || !r) return;
    let s;
    const c = () => {
      _e().command("usage.get"), s = setTimeout(c, 18e4);
    };
    return c(), () => clearTimeout(s);
  }, [a, r]), i;
}
const Nw = () => _e().command("usage.get", { force: !0 }), Tw = (n) => _e().command("usage.redeemReset", { accountId: n }), Cw = () => $l("app.zoom_reset"), Aw = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Mw = (n, a, r) => _e().beginTabDrag?.(n, a, r);
function jw(n) {
  ct(() => _e().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Rw = (n) => $l("browser.open", { workspaceId: n }), Ow = (n, a) => $l("file.open", { workspaceId: n, path: a }), Dw = () => null, Bw = () => null, Hw = Wn("new-file");
function Uw(n, a) {
  const r = n.selection(a);
  if (r) return r;
  const i = n.value(a), s = i.split(`
`).length - (i.endsWith(`
`) && i.length ? 1 : 0);
  return { text: i, startLine: 1, endLine: Math.max(1, s) };
}
function qw({ onGo: n, onClose: a }) {
  const [r, i] = W.useState(""), s = (c) => {
    c?.preventDefault?.();
    const [f, d] = r.split(":").map((m) => Number.parseInt(m, 10));
    Number.isFinite(f) ? n(f, Number.isFinite(d) ? d : 1) : a();
  };
  return W.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    W.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    W.createElement("input", {
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
    W.createElement("button", { type: "button", className: mc, onClick: s }, "OK")
  );
}
function Gw({ value: n, onChange: a, onSave: r, onCaret: i, readOnly: s, wrap: c, label: f, path: d, docKey: m, onAskAgent: g, ref: x }) {
  const y = _e().editor, b = W.useRef(null);
  b.current = { onChange: a, onSave: r, onCaret: i, onAskAgent: g };
  const [S, , E] = String(m).split("\0"), R = !!y && E !== void 0 && /^\d+$/.test(E), z = Je((k) => R ? k.workspaceFiles(S)?.carets?.[m] ?? null : null);
  ct(() => {
    z && b.current.onCaret?.({ line: z.line, col: z.col });
  }, [z?.line, z?.col]);
  const j = W.useRef(n), [O, H] = W.useState(null), [K, J] = W.useState(!1), T = () => {
    if (!y || !b.current.onAskAgent) return;
    const { text: k, startLine: _, endLine: C } = Uw(y, m);
    b.current.onAskAgent(k, _, C);
  };
  if (W.useImperativeHandle(x, () => ({
    openGoto: () => J(!0),
    focus: () => y?.focus(m),
    askAgent: T
  }), [m]), mi(() => {
    if (!y) return;
    y.open(m, { path: d, value: n, readonly: !!s, wrap: !!c, label: f }), j.current = n;
    const k = y.watch(m, (_) => {
      for (const C of _)
        if (C.type === "change") {
          const N = y.value(m);
          j.current = N, b.current.onChange?.(N);
        } else C.type === "caret" ? b.current.onCaret?.({ line: C.line, col: C.col }) : C.type === "save" ? b.current.onSave?.() : C.type === "goto" ? J(!0) : C.type === "contextmenu" && H({ x: C.x, y: C.y });
    });
    return () => {
      k(), y.park(m);
    };
  }, [m]), ct(() => {
    !y || R || n === j.current || (j.current = n, y.setValue(m, n, { external: !0 }));
  }, [m, n]), ct(() => {
    y?.setReadonly(m, !!s);
  }, [m, s]), ct(() => {
    y?.setWrap(m, !!c);
  }, [m, c]), !y)
    return W.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": f, value: n, readOnly: s, onChange: (k) => a?.(k.target.value) });
  const h = (k) => () => {
    H(null), k(), y.focus(m);
  }, w = O ? !!y.selection(m) : !1;
  return W.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": f },
    K && W.createElement(qw, {
      onGo: (k, _) => {
        J(!1), y.goTo(m, k, _), y.focus(m);
      },
      onClose: () => {
        J(!1), y.focus(m);
      }
    }),
    W.createElement("div", { "data-perch-engine": "editor", "data-perch-key": m, className: "min-h-0 min-w-0 flex-1" }),
    O && W.createElement(wy, {
      x: O.x,
      y: O.y,
      readOnly: !!s,
      canUndo: y.canUndo(m),
      canRedo: y.canRedo(m),
      hasSelection: w,
      onClose: () => H(null),
      actions: {
        undo: h(() => y.undo(m)),
        redo: h(() => y.redo(m)),
        cut: h(() => y.cut(m)),
        copy: h(() => y.copy(m)),
        paste: h(() => y.paste(m)),
        selectAll: h(() => y.selectAll(m)),
        find: h(() => y.openSearch(m, !1)),
        replace: h(() => y.openSearch(m, !0)),
        gotoLine: () => {
          H(null), J(!0);
        },
        ...g ? { askAgent: () => {
          H(null), T();
        } } : {}
      }
    })
  );
}
const Lw = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Yw(n) {
  const a = Je((r) => r.browserPages?.(n) ?? Lw);
  return W.useMemo(() => {
    const r = (i, s) => _e().command(i, { workspaceId: n, ...s });
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
function Qw({ pageId: n, active: a }) {
  const r = `drawer
${n}`;
  return ct(() => {
    a && _e().command("browser.focus", { key: r });
  }, [a, r]), W.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": r,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const i4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Um,
  BrowserPage: Qw,
  Chevron: zc,
  CloseIcon: kv,
  CodeEditor: Gw,
  ConfirmDialog: tw,
  Dialog: ow,
  EllipsisIcon: xv,
  FileAsset: hw,
  FileEntryMenu: bw,
  FileIcon: Vy,
  FolderBrowser: rw,
  GearIcon: wv,
  GitMarker: Zy,
  HostStateDot: _v,
  InstructionsDialog: iw,
  MarkdownPreview: gw,
  MemoryDialog: sw,
  ModeSwitch: tx,
  NewFilePrompt: Hw,
  NewSessionMenu: Ix,
  PageIcon: Ly,
  PlusIcon: bm,
  QrCode: ux,
  Select: nw,
  SessionDot: Jx,
  SessionMenu: Fx,
  SettingRow: fx,
  SettingsGroup: dx,
  SettingsQuery: Zl,
  Slot: Wx,
  Submenu: Hy,
  Switch: px,
  TabDragLayer: Bw,
  TabMenu: Dw,
  WorktreeMenu: uw,
  agentStateColor: jx,
  anchoredPopoverStyle: Ex,
  assetKind: Wy,
  beginReorderDrag: pw,
  beginTabDrag: Mw,
  bindHost: _x,
  buttonClass: Cx,
  cn: Ge,
  drawConfirmationsInPlace: ew,
  drawFolderBrowserInPlace: aw,
  drawWorktreeInPlace: cw,
  ghostButton: Ax,
  glassClass: xx,
  iconButton: Mx,
  isMac: Om,
  keyLabel: Po,
  menuDividerClass: fi,
  menuItemClass: Dm,
  menuPanel: Di,
  nestSessions: Zx,
  newId: zx,
  openBrowserTab: Rw,
  openFileTab: Ow,
  pickFolder: Bx,
  redeemUsageReset: Tw,
  refreshUsage: Nw,
  resetZoom: Cw,
  rowActionClass: Tx,
  runCommand: $l,
  segmentClass: Nx,
  settingsClass: hx,
  shortcutFor: Rx,
  shortcutLabel: Ox,
  startPaneWhenReady: Lm,
  startSession: Dx,
  tabStateClass: Aw,
  tapButtonClass: wx,
  useAddProject: qx,
  useAddProjectRequest: Kx,
  useAgentChoices: Xx,
  useBrowserPages: Yw,
  useDismissOnOutsideClick: Am,
  useHostSnapshot: Je,
  useHosts: Hx,
  useKeybindings: Sw,
  useNavigation: Bm,
  useNewTabRequest: jw,
  useNotifications: Vx,
  usePaneLook: _w,
  usePlanUsage: zw,
  useResourceState: yx,
  useSessionFolders: Ux,
  useSettingsQuery: mx,
  useStatusLine: ww,
  useWorkspaceFiles: xw,
  useWorkspaceTabs: mw,
  useZoom: kw,
  version: kx
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
const Tc = {
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
  Tc[n] = (a, r) => a[n](r);
const s4 = Object.keys(Tc);
function jo(n, a) {
  for (const [r, i] of Object.entries(a)) {
    const s = Tc[r];
    if (!s) throw new Error(`the description key ${r} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const ba = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), tc = /* @__PURE__ */ new WeakSet(), pi = /* @__PURE__ */ new WeakSet();
function Ep(n, a, r) {
  const i = n.pressed, s = ba(r);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : a;
}
function Vw(n, a, r) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && Ci.has(n.group) || r)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const Ym = (n, a = !1) => (n.children ?? []).some((r) => r.kind === "text" ? !a || /\s/.test(String(r.text ?? "").trim()) : r.kind === "div" && r.style?.flex_direction !== "row" && r.style?.whitespace !== "nowrap" && Ym(r, !0)), Mt = (n) => n.style?.display !== "hidden";
let Ci = /* @__PURE__ */ new Set(), nc = null;
const zp = /* @__PURE__ */ new WeakMap();
function Qm(n, a = /* @__PURE__ */ new Set()) {
  let r = zp.get(n);
  if (!r) {
    r = /* @__PURE__ */ new Set();
    for (const { group: i, style: s } of n.group_hover ?? []) "display" in s && r.add(i);
    for (const i of n.children ?? []) if (i.kind !== "text") for (const s of Qm(i)) r.add(s);
    zp.set(n, r);
  }
  for (const i of r) a.add(i);
  return a;
}
let an = null;
const Xw = (n, a, r, i, s, c, f) => `${+a}|${r}|${i.text_size}|${i.line_height}|${i.whitespace}|${i.text_ellipsis}|${+s}|${c ? `${c.group}|${c.color}` : ""}|${+tc.has(n)}|${+pi.has(n)}|${f.get(n)?.flex_basis ?? ""}`, Np = /* @__PURE__ */ new WeakMap();
function Vm(n) {
  let a = Np.get(n);
  return a === void 0 && (a = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((r) => r.kind !== "text" && Vm(r)), Np.set(n, a)), a;
}
function Xm(n, a, r, i) {
  let s = Kw(a.get(n), r.get(n));
  if (n.kind === "text") return s;
  for (const c of n.children ?? []) Xm(c, a, r, i) || (s = !1);
  return s && i.add(n), s;
}
function Kw(n, a) {
  if (n === a) return !0;
  if (!n || !a) return !1;
  const r = Object.keys(n);
  if (r.length !== Object.keys(a).length) return !1;
  for (const i of r) if (n[i] !== a[i]) return !1;
  return !0;
}
function ac(n, a, r, i, s = !1, c = !1, f = null, d = {}, m = !1, g = /* @__PURE__ */ new Map(), x = null) {
  if (n.kind === "text") return g.get(n)?.text ?? n.text;
  const y = an && !s && !Vm(n) ? Xw(n, c, f, d, m, x, g) : null;
  if (y !== null && an.clean.has(n)) {
    const S = an.from.get(n), E = S?.key === y ? a.reuse(S.id, an.generation) : null;
    if (E)
      return an.next.set(n, { id: E.__id, key: y }), E;
  }
  const b = Zw(n, a, r, i, s, c, f, d, m, g, x);
  return y !== null && an.next.set(n, { id: b.__id, key: y }), b;
}
function Zw(n, a, r, i, s, c, f, d, m, g, x) {
  const y = tc.has(n);
  c ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", c && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (x = null), f = n.style.text_color ?? f;
  const b = !!n.hover?.text_color && Wm(n), S = n.group ?? (b ? `~g${n.id}` : null);
  b && (x = { group: S, color: n.hover.text_color }), d = { ...d };
  for (const N of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[N] !== void 0 && (d[N] = n.style[N]);
  const E = new Set(n.events ?? []), R = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !c && !n.pointer_none && n.style.position === "absolute" ? nc : null, z = R ? R.count++ : -1;
  s && (nc = R);
  let j;
  if (n.kind === "image" && !n.markup ? j = a.image(n.src) : j = a.div(), n.kind === "engine" && (j = j.child(i.engine ? i.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && x && x.color !== f) {
    const { group: N, color: D } = x, G = () => a.div().absolute().top(0).left(0).size_full();
    j = j.child(G().group_hover(N, ($) => $.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, f))).child(G().invisible().group_hover(N, ($) => $.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, D)));
  } else n.markup && (j = j.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? f : "")));
  const O = Vw(n, E, !!R);
  if (O && (j = j.id(O)), n.measure && (j = j.measure(n.measure)), n.name && j.also_named) for (const N of n.also ?? []) j = j.also_named(N);
  j = jo(j, { ...n.style, ...g.get(n) });
  const H = d.whitespace !== "nowrap" && !d.text_ellipsis;
  m && H && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Ym(n) && (j = j.min_w(0));
  for (const N of ["hover", "focus", "active"]) n[N] && (j = j[N]((D) => jo(D, n[N])));
  S && (j = j.group(S));
  for (const { group: N, style: D } of n.group_hover ?? []) {
    const { display: G, ...$ } = D;
    Object.keys($).length && (j = j.group_hover(N, (q) => jo(q, $)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const N = r.document?.scrollTarget, D = N ? (n.children ?? []).filter(Mt).findIndex((G) => Jm(G, N.id)) : -1;
    if (D >= 0 && (r.scroller ?? n.id) === n.id && (r.document.scrollTarget = null, r.scroller = n.id, a.scroll.scroll_to_item(D)), r.scroller ??= n.id, r.scroller === n.id && r.document) {
      j = j.track_scroll(a.scroll);
      const G = (n.children ?? []).filter(Mt).map(($) => $.id);
      r.document.itemBounds = ($) => G.includes($) ? a.scroll.item_bounds?.(G.indexOf($)) ?? null : null;
    }
  }
  const K = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", J = s && !n.pointer_none || n.blocks_pointer;
  if ((K && pi.has(n) || J) && (j = j.on_scroll_wheel((N, D) => D.stop_propagation?.())), K && E.has("scroll") && (j = j.on_scroll_wheel((N, D) => {
    r.dispatch(n.id, "scroll", {}), D.notify();
  })), K || pi.has(n)) for (const N of n.children ?? []) N.kind !== "text" && pi.add(N);
  n.kind === "input" && !n.disabled && (j = j.on_mouse_down("left", (N, D) => {
    N.bounds && r.setBounds(n.id, N.bounds), r.focus(n.id), D.notify();
  }));
  const T = n.kind === "input" ? n : n.meta?.tag === "label" ? Zm(n) : null;
  T && !T.disabled && /^(checkbox|radio)$/.test(T.input_type) && (j = j.on_click((N, D) => {
    D.stop_propagation?.(), r.toggle(T.id), D.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((N) => E.has(N));
  if (h || y) for (const N of n.children ?? []) N.kind !== "text" && tc.add(N);
  if (h && (j = j.on_mouse_down("left", (N, D) => {
    D.stop_propagation?.(), N.bounds && r.setBounds(n.id, N.bounds);
    const G = { ...ba(N), button: 0, buttons: 1, detail: N.click_count }, $ = Ep(r, n.id, N);
    r.pressed = null, r.dispatch($, "pointerdown", { ...G, pointerType: "mouse" }), r.dispatch($, "mousedown", G) && r.pressFocus?.($), D.notify();
  }), j = j.on_mouse_down("right", (N, D) => {
    D.stop_propagation?.(), N.bounds && r.setBounds(n.id, N.bounds);
    const G = Ep(r, n.id, N);
    r.pressed = null, r.dispatch(G, "contextmenu", { ...ba(N), button: 2 }), D.notify();
  }), j = j.on_mouse_up("left", (N, D) => {
    D.stop_propagation?.();
    const G = { ...ba(N), button: 0 };
    r.dispatch(n.id, "pointerup", { ...G, pointerType: "mouse" }), r.dispatch(n.id, "mouseup", G), D.notify();
  }), j = j.on_click((N, D) => {
    r.dispatch(n.id, N.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: N.click_count, button: 0 }), D.notify();
  })), n.blocks_pointer && !h)
    for (const N of ["left", "right"]) j = j.on_mouse_down(N, (D, G) => G.stop_propagation?.());
  else if (y && !h)
    for (const N of ["left", "right"])
      j = j.on_mouse_down(N, (D) => {
        const G = ba(D);
        (r.pressed?.x !== G.clientX || r.pressed?.y !== G.clientY) && (r.pressed = { id: n.id, x: G.clientX, y: G.clientY });
      });
  if (E.has("mouse_move") && (j = j.on_mouse_move((N) => {
    r.dispatch(n.id, "pointermove", { ...ba(N), pointerType: "mouse" });
  })), n.track_hover && Ci.has(n.group) && (j = j.on_hover((N, D) => {
    r.hover(n.id, N), D.notify();
  })), R && (j = j.on_mouse_down_out((N, D) => {
    const G = ba(N), $ = `${G.clientX},${G.clientY}`;
    R.at !== $ && (R.at = $, R.hits = /* @__PURE__ */ new Set()), R.hits.add(z), !(R.hits.size < R.count) && (R.at = null, r.dispatch(r.document.body.id, "pointerdown", { ...G, pointerType: "mouse" }), r.dispatch(r.document.body.id, "mousedown", G), D.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const N = n.value ? String(n.value) : String(n.placeholder ?? "");
    let D = a.div().whitespace_nowrap().overflow_x_hidden();
    const G = wa(d);
    G && (D = D.h(G)), !n.value && f && (D = D.text_color(Ww(f))), N && (j = j.child(D.child(n.input_type === "password" && n.value ? "•".repeat([...N].length) : N))), n.field_w && (j = j.child(a.div().w(n.field_w).h(0)));
  }
  const w = d.whitespace === "nowrap" ? wa(d) : null, k = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let _ = !n.range_name;
  const C = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const N of (n.children ?? []).filter(Mt)) {
    const D = N.style?.flex_basis;
    C && N.style.flex_grow > 0 && (D === 0 || typeof D == "string" && D.endsWith("%")) && g.set(N, { ...g.get(N), flex_basis: "auto" });
    let G = ac(N, a, r, i, !1, c, f, d, k && N.style?.position !== "absolute", g, x);
    const $ = !_ && (N.kind === "text" || !N.meta), q = N.kind === "text" ? g.get(N)?.h ?? w : null, X = N.kind === "text" ? g.get(N)?.w : void 0;
    if ($ || q || X !== void 0) {
      let I = a.div();
      $ && (I = I.id(n.range_name)), $ && !k && n.style.display === "flex" && (I = I[`self_${Jw[d.text_align] ?? "start"}`]().max_w("100%")), q && (I = I.h(q)), X !== void 0 && (I = I.w(X).flex_none().whitespace_nowrap()), G = I.child(G), _ ||= $;
    }
    j = j.child(G);
  }
  return j;
}
const Jw = { center: "center", right: "end", end: "end" };
function Ww(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const r = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(r / 2).toString(16).padStart(2, "0")}`;
}
const Km = /^(?:[!-,.-~]+|\S)$/u, Zm = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const r = a.kind === "text" ? null : Zm(a);
    if (r) return r;
  }
  return null;
}, Jm = (n, a) => n.id === a || (n.children ?? []).some((r) => r.kind !== "text" && Jm(r, a)), Wm = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && Wm(a));
function wa(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function o4(n, a, r, i, s = 0, c = !1) {
  const f = [n.root, ...n.overlays];
  Ci = /* @__PURE__ */ new Set(), nc = null;
  for (const b of f) Qm(b, Ci);
  const d = s > 0 ? n4(f, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && $w(f, s, i.measure, d), e4(f, d), Pw(f, d), i.measure && Iw(f, i.measure, d);
  const m = a.reuse && a.renderGeneration ? r.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, g = new Map(d);
  m && n.root && (an = { from: m.built, generation: m.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, Xm(n.root, d, m.overrides, an.clean));
  let x;
  try {
    x = a.div().relative().size_full().child(ac(n.root, a, r, i, !1, !1, null, {}, !1, d)), m && Object.assign(m, { built: an?.next ?? /* @__PURE__ */ new Map(), overrides: g, generation: a.renderGeneration() ?? -1 });
  } finally {
    an = null;
  }
  let y = c && n.overlays.length ? a.div().relative().size_full().window_layer() : x;
  for (const b of n.overlays) y = y.child(ac(b, a, r, i, !0, !1, null, {}, !1, d));
  return y === x ? x : x.child(y);
}
function $w(n, a, r, i) {
  (si.scale !== a || si.measure !== r) && (si = { scale: a, measure: r, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: s, fonts: c, keys: f, visits: d } = si, m = [], g = (O, H) => i.set(O, { ...i.get(O), ...H }), x = (O, H) => {
    m.push(O, H), g(O, H);
  }, y = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(O, H, K) {
    if (O.kind === "text") {
      if (!(H.whitespace === "nowrap" || Km.test(O.text)) || H.text_ellipsis || K || typeof H.text_size != "number") return NaN;
      const N = r(O.text, { size: H.text_size, weight: H.font_weight ?? 400, family: H.font_family ?? ".SystemUIFont", italic: !!H.italic });
      return Number.isFinite(N) ? N : NaN;
    }
    if (!Mt(O) || O.kind === "input" || O.kind === "engine" || O.markup) return S(O);
    const J = `${H.text_size}|${H.font_weight}|${H.font_family}|${H.italic}|${H.whitespace}|${H.text_ellipsis}|${+K}`;
    if (f.get(O) === J && s.has(O)) return s.get(O);
    f.set(O, J);
    const T = { ...H };
    for (const C of y) O.style[C] !== void 0 && (T[C] = O.style[C]);
    T.text_ellipsis = !!O.style.text_ellipsis, c.set(O, T);
    const h = O.style, w = (O.children ?? []).filter(Zt), k = w.map((C) => b(C, T, K || !!O.tabular));
    let _ = S(O);
    if (!Number.isFinite(_) && h.w === void 0) {
      const C = w.map((D, G) => k[G] + (D.kind === "text" ? 0 : se(D.style.ml) + se(D.style.mr)));
      let N;
      w.length ? Ut(O) ? N = w.some((D) => D.kind !== "text" && D.style.flex_grow > 0) || h.flex_wrap === "wrap" ? NaN : C.reduce((D, G) => D + G, 0) + se(h.gap_x) * (w.length - 1) : N = Math.max(...C) : N = 0, _ = N + se(h.pl) + se(h.pr) + se(h.border_l) + se(h.border_r), typeof h.min_w == "number" && (_ = Math.max(_, h.min_w)), typeof h.max_w == "number" && (_ = Math.min(_, h.max_w));
    }
    return s.set(O, _), _;
  }
  const S = (O) => typeof O.style?.w == "number" ? O.style.w : NaN, E = () => ({ exact: 0, laid: 0 }), R = (O, H) => {
    if (!Number.isFinite(H))
      return Object.assign(O, E()), NaN;
    O.exact += H;
    const K = Math.round(O.exact * a + 1e-9) / a, J = K - O.laid;
    return O.laid = K, J;
  }, z = (O) => Ut(O) && O.style.flex_wrap !== "wrap" && (O.style.justify ?? "start") === "start";
  function j(O) {
    if (!O || O.kind === "text" || !Mt(O)) return;
    const H = f.get(O), K = d.get(O);
    if (K && H !== void 0 && K.key === H) {
      for (let h = 0; h < K.log.length; h += 2)
        m.push(K.log[h], K.log[h + 1]), g(K.log[h], K.log[h + 1]);
      return;
    }
    const J = m.length, T = (O.children ?? []).filter(Zt);
    if (z(O) && T.length > 1) {
      const h = se(O.style.gap_x), w = E(), k = !(h && T.some((_) => _.kind === "text" || !Number.isFinite(se(_.style.ml))));
      x(O, { border_l: R(w, se(O.style.border_l)), pl: R(w, se(O.style.pl)) }), k && h && x(O, { gap_x: 0 }), T.forEach((_, C) => {
        const N = (C && k ? h : 0) + (_.kind === "text" ? 0 : se(_.style.ml));
        if (_.kind === "text")
          N && Object.assign(w, E());
        else {
          const q = R(w, N);
          Number.isFinite(q) && x(_, { ml: q });
        }
        const D = _.kind === "text" ? c.get(O) ?? {} : null, G = _.kind === "text" ? b(_, D, !!O.tabular) : s.get(_);
        if ((_.kind === "text" || !(_.style.flex_grow > 0)) && Number.isFinite(G)) {
          const q = { w: R(w, G) };
          _.kind !== "text" && typeof _.style.w != "number" && _.style.min_w === void 0 && (q.whitespace = "nowrap", q.flex_shrink = 0), x(_, q);
        } else Object.assign(w, E());
        if (_.kind !== "text") {
          const q = R(w, se(_.style.mr));
          Number.isFinite(q) && x(_, { mr: q });
        }
      });
    }
    for (const h of O.children ?? []) h.kind !== "text" && j(h);
    H !== void 0 && d.set(O, { key: H, log: m.slice(J) });
  }
  for (const O of n)
    O && (b(O, {}, !1), j(O));
}
let si = { scale: 0, measure: null };
const Fw = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Iw(n, a, r) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (x) => typeof x == "number" ? x : 0, c = (x, y) => y && Ai(y) && !Ut(y) && x.style.position !== "absolute" && !["start", "center", "end"].includes(x.style.self) && !["start", "center", "end"].includes(y.style.items);
  oi.measure !== a && (oi = { measure: a, walks: /* @__PURE__ */ new WeakMap() });
  const f = [], d = (x, y) => {
    f.push(x, y), r.set(x, { ...r.get(x), ...y });
  }, m = (x, y, b, S) => {
    if (!x || x.kind === "text" || !Mt(x)) return;
    const E = `${b}|${+c(x, y)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, R = oi.walks.get(x);
    if (R?.key === E) {
      for (let j = 0; j < R.log.length; j += 2) d(R.log[j], R.log[j + 1]);
      return;
    }
    const z = f.length;
    g(x, y, b, S), oi.walks.set(x, { key: E, log: f.slice(z) });
  }, g = (x, y, b, S) => {
    const E = x.style;
    let R = typeof E.w == "number" ? E.w : E.w === "100%" ? b : c(x, y) ? b - s(E.ml) - s(E.mr) : NaN;
    typeof E.max_w == "number" && (R = Math.min(R, E.max_w));
    const z = R - s(E.pl) - s(E.pr) - s(E.border_l) - s(E.border_r), j = { ...S };
    for (const H of i) E[H] !== void 0 && (j[H] = E[H]);
    const O = x.children ?? [];
    if (x.break_anywhere && Number.isFinite(z) && z > 0 && typeof j.text_size == "number" && O.length && O.every((H) => H.kind === "text")) {
      const H = { size: j.text_size, weight: j.font_weight ?? 400, family: j.font_family ?? ".SystemUIFont", italic: !!j.italic }, K = (h) => a(h.trimEnd(), H) <= z + 0.01;
      let J = 0;
      for (const h of O) {
        const w = [];
        for (const _ of h.text.split(`
`)) {
          let C = "";
          for (const N of _.split(Fw)) {
            if (K(C + N)) {
              C += N;
              continue;
            }
            C && w.push(C.trimEnd()), C = "";
            for (const D of N)
              C && !K(C + D) && (w.push(C), C = ""), C += D;
          }
          w.push(C.trimEnd());
        }
        const k = w.join(`
`);
        w.every((_) => !_ || K(_)) ? k !== h.text && d(h, { text: k }) : J = NaN, J += w.length;
      }
      const T = wa(j);
      Number.isFinite(J) && T && E.h === void 0 && O.length === 1 && d(x, { h: J * T + s(E.pt) + s(E.pb) + s(E.border_t) + s(E.border_b) });
    }
    for (const H of O) m(H, x, Ut(x) ? NaN : z, j);
  };
  for (const x of n) m(x, null, NaN, {});
}
let oi = { measure: null };
function Pw(n, a) {
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
function e4(n, a) {
  const r = a.heights ?? /* @__PURE__ */ new Map(), i = (m) => r.get(m), s = (m) => {
    const g = i(m);
    if (Number.isFinite(g)) return g;
    if (m.kind === "text" || !Mt(m)) return 0;
    const x = m.style, y = typeof x.min_h == "number" ? x.min_h : 0, b = (m.children ?? []).filter(Zt), S = b.map((z) => s(z) + (z.kind === "text" ? 0 : Math.max(0, se(z.style.mt) || 0) + Math.max(0, se(z.style.mb) || 0))), E = b.length ? Ut(m) ? Math.max(...S) : S.reduce((z, j) => z + j, 0) + (x.display === "flex" ? (se(x.gap_y) || 0) * (b.length - 1) : 0) : 0, R = [x.pt, x.pb, x.border_t, x.border_b].reduce((z, j) => z + (se(j) || 0), 0);
    return Math.max(y, E + R);
  }, c = (m) => !(m.children ?? []).filter(Zt).length || Ut(m) ? NaN : s({ ...m, style: { ...m.style, h: void 0, max_h: void 0, min_h: void 0 } }), f = (m, g) => {
    const x = m.style;
    if (typeof x.h == "number") return x.h;
    if (typeof x.max_h == "number") return x.max_h;
    if (!g || !Ai(g) || Ut(g)) return NaN;
    const y = g.style, b = typeof y.h == "number" ? y.h : typeof y.max_h == "number" ? y.max_h : NaN, S = (g.children ?? []).filter(Zt);
    let E = 0;
    for (const z of S) {
      if (z === m) continue;
      const j = i(z);
      if (!Number.isFinite(j)) return NaN;
      E += j + (z.kind === "text" ? 0 : se(z.style.mt) + se(z.style.mb));
    }
    const R = y.display === "flex" ? se(y.gap_y) * Math.max(0, S.length - 1) : 0;
    return b - se(y.pt) - se(y.pb) - se(y.border_t) - se(y.border_b) - E - R - se(x.mt) - se(x.mb);
  }, d = (m, g) => {
    if (!(!m || m.kind === "text" || !Mt(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const x = c(m), y = f(m, g);
        Number.isFinite(x) && Number.isFinite(y) && x > y + 0.01 && a.set(m, { ...a.get(m), pr: se(m.style.pr) + m.scrollbar });
      }
      for (const x of m.children ?? []) d(x, m);
    }
  };
  for (const m of n) d(m, null);
}
const t4 = ["text_size", "line_height", "whitespace", "text_ellipsis"], se = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Ai = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ut = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Zt = (n) => n.kind === "text" || Mt(n) && n.style.position !== "absolute";
function n4(n, a) {
  Ro.scale !== a && (Ro = $m(a));
  const { heights: r, texts: i, textKeys: s, visits: c, places: f } = Ro, d = /* @__PURE__ */ new Map(), m = [], g = (T, h) => {
    const w = d.get(T);
    d.set(T, w ? { ...w, ...h } : h);
  }, x = (T, h) => {
    let w = null;
    for (const k in h)
      Number.isFinite(h[k]) && ((w ??= {})[k] = h[k]);
    w && (m.push(T, w), g(T, w));
  }, y = (T) => {
    for (let h = 0; h < T.length; h += 2)
      m.push(T[h], T[h + 1]), g(T[h], T[h + 1]);
  };
  function b(T, h) {
    if (T.kind === "text") return h.whitespace === "nowrap" || Km.test(T.text) ? wa(h) ?? NaN : NaN;
    const w = `${h.text_size}|${h.line_height}|${h.whitespace}|${h.text_ellipsis}`;
    if (s.get(T) === w && r.has(T)) return r.get(T);
    let k = h;
    for (const G of t4) T.style[G] !== void 0 && T.style[G] !== k[G] && (k === h && (k = { ...h }), k[G] = T.style[G]);
    s.set(T, w), i.set(T, k);
    const _ = T.style, C = (T.children ?? []).filter(Zt), N = C.map((G) => b(G, k));
    let D;
    if (_.h !== void 0 && _.h !== "auto") D = se(_.h);
    else if (T.kind === "engine") D = NaN;
    else if (T.kind === "input")
      D = (T.input_type === "textarea" || T.input_type === "select" ? NaN : wa(k) ?? NaN) + se(_.pt) + se(_.pb) + se(_.border_t) + se(_.border_b), _.min_h !== void 0 && (D = Math.max(D, se(_.min_h)));
    else {
      const G = C.map((q, X) => (q.kind === "text" ? 0 : se(q.style.mt) + se(q.style.mb)) + N[X]);
      let $;
      if (Ut(T)) $ = _.flex_wrap === "wrap" ? NaN : _.items === "baseline" ? E(C, N, k) : Math.max(0, ...G);
      else if (Ai(T)) {
        const q = C.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), X = _.display !== "flex" && C.some((I) => I.kind !== "text" && (se(I.style.mt) || se(I.style.mb)));
        $ = q || X ? NaN : G.reduce((I, Q) => I + Q, 0) + (_.display === "flex" ? se(_.gap_y) * Math.max(0, C.length - 1) : 0);
      } else $ = NaN;
      D = $ + se(_.pt) + se(_.pb) + se(_.border_t) + se(_.border_b), _.min_h !== void 0 && (D = Math.max(D, se(_.min_h))), _.max_h !== void 0 && (D = Math.min(D, se(_.max_h)));
    }
    return r.set(T, D), D;
  }
  const S = (T) => (wa(T) - (ki + Wp) * T.text_size) / 2 + ki * T.text_size;
  function E(T, h, w) {
    let k = 0, _ = 0;
    for (const [C, N] of T.entries()) {
      const D = N.kind === "text" ? w : i.get(N);
      if (!(N.kind === "text" || (N.children ?? []).filter(Zt).every((X) => X.kind === "text")) || !Number.isFinite(h[C]) || typeof D.text_size != "number") return NaN;
      const $ = N.kind === "text" ? {} : N.style, q = se($.mt) + se($.border_t) + se($.pt) + S(D);
      k = Math.max(k, q), _ = Math.max(_, se($.mt) + h[C] + se($.mb) - q);
    }
    return k + _;
  }
  const R = () => ({ exact: 0, laid: 0 }), z = (T, h) => {
    if (!Number.isFinite(h))
      return Object.assign(T, R()), NaN;
    T.exact += h;
    const w = Math.round(T.exact * a + 1e-9) / a, k = w - T.laid;
    return T.laid = w, k;
  };
  function j(T) {
    if (T.kind === "text" || !Mt(T)) return;
    const h = s.get(T), w = c.get(T);
    if (w && h !== void 0 && w.key === h) return y(w.log);
    const k = m.length;
    for (const _ of (T.children ?? []).filter((C) => C.kind !== "text" && Mt(C) && C.style.position === "absolute")) j(_);
    if (Ai(T) && !Ut(T)) {
      const _ = R();
      x(T, { border_t: z(_, se(T.style.border_t)), pt: z(_, se(T.style.pt)) }), O(T, _);
    } else for (const _ of (T.children ?? []).filter(Zt)) _.kind !== "text" && j(_);
    h !== void 0 && c.set(T, { key: h, log: m.slice(k) });
  }
  function O(T, h) {
    const w = (T.children ?? []).filter(Zt), k = T.style.display === "flex" ? se(T.style.gap_y) : 0;
    if (k && w.some((_) => _.kind === "text")) {
      for (const _ of w) _.kind !== "text" && j(_);
      return !1;
    }
    return k && x(T, { gap_y: 0 }), w.forEach((_, C) => {
      if (_.kind === "text") {
        const N = b(_, i.get(T) ?? {});
        Number.isFinite(N) ? x(_, { h: z(h, N) }) : Object.assign(h, R());
        return;
      }
      if (x(_, { mt: z(h, (C ? k : 0) + se(_.style.mt)) }), Number.isFinite(r.get(_))) K(_, h);
      else if (H(_)) {
        const N = _.style;
        x(_, { border_t: z(h, se(N.border_t)), pt: z(h, se(N.pt)) }), x(_, { pb: z(h, se(N.pb)), border_b: z(h, se(N.border_b)) });
      } else
        j(_), Object.assign(h, R());
      x(_, { mb: z(h, se(_.style.mb)) });
    }), !0;
  }
  function H(T) {
    const h = T.style, w = (T.children ?? []).filter(Zt), k = wa(i.get(T) ?? {});
    return T.kind === "div" && !Ut(T) && w.length > 0 && w.every((_) => _.kind === "text") && Number.isInteger(k) && [h.h, h.min_h, h.max_h].every((_) => _ === void 0 || _ === "auto");
  }
  function K(T, h) {
    const w = `${s.get(T)}|${Math.round((h.exact - h.laid) * 1e6)}`, k = f.get(T);
    if (k && k.key === w) {
      y(k.log), h.exact += k.exact, h.laid += k.laid;
      return;
    }
    const _ = m.length, [C, N] = [h.exact, h.laid];
    J(T, h), f.set(T, { key: w, log: m.slice(_), exact: h.exact - C, laid: h.laid - N });
  }
  function J(T, h) {
    const w = T.style;
    for (const D of (T.children ?? []).filter((G) => G.kind !== "text" && Mt(G) && G.style.position === "absolute")) j(D);
    const k = h.laid, _ = h.exact;
    x(T, { border_t: z(h, se(w.border_t)), pt: z(h, se(w.pt)) });
    const C = w.h !== void 0 && w.h !== "auto", N = r.get(T) - se(w.pt) - se(w.pb) - se(w.border_t) - se(w.border_b);
    if (T.kind === "input")
      C || z(h, N);
    else if (Ut(T) || C && (w.justify ?? "start") !== "start") {
      for (const D of (T.children ?? []).filter(Zt)) D.kind !== "text" && j(D);
      C || z(h, N);
    } else !O(T, h) && !C && z(h, N);
    if (C) {
      h.exact = _ + r.get(T), h.laid = Math.round(h.exact * a + 1e-9) / a, x(T, { h: h.laid - k });
      return;
    }
    x(T, { pb: z(h, se(w.pb)), border_b: z(h, se(w.border_b)) }), x(T, { h: h.laid - k });
  }
  for (const T of n)
    b(T, {}), j(T);
  return Object.defineProperty(d, "heights", { value: r }), d;
}
const $m = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let Ro = $m(0);
const c4 = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }] };
export {
  c4 as NAMED_ELEMENTS,
  q0 as React,
  _b as SCHEMA,
  s4 as STYLE_KEYS,
  o4 as describeToGpui,
  a4 as jsxRuntime,
  l4 as mount,
  r4 as reactDom,
  i4 as sdk
};
