function As(n, l) {
  for (var i = 0; i < l.length; i++) {
    const o = l[i];
    if (typeof o != "string" && !Array.isArray(o)) {
      for (const s in o)
        if (s !== "default" && !(s in n)) {
          const d = Object.getOwnPropertyDescriptor(o, s);
          d && Object.defineProperty(n, s, d.get ? d : {
            enumerable: !0,
            get: () => o[s]
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
class re extends Error {
}
const h0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), g0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), b0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...h0]);
function us(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, i, o) => i ? String.fromCodePoint(parseInt(i, 16)) : o);
}
function xl(n, l) {
  let i = l;
  for (; i < n.length; ) {
    const o = n[i];
    if (o === "\\") {
      i += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(o)) {
      i++;
      continue;
    }
    break;
  }
  if (i === l) throw new re(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [us(n.slice(l, i)), i];
}
function v0(n, l) {
  let i = 1;
  for (let o = l; o < n.length; o++) {
    const s = n[o];
    if (s === "\\") {
      o++;
      continue;
    }
    if (s === '"' || s === "'") {
      if (o = n.indexOf(s, o + 1), o < 0) break;
      continue;
    }
    if (s === "(") i++;
    else if (s === ")" && --i === 0) return o;
  }
  throw new re(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function js(n) {
  const l = [];
  let i = 0, o = 0;
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
    d === "(" || d === "[" ? i++ : d === ")" || d === "]" ? i-- : d === "," && i === 0 && (l.push(n.slice(o, s).trim()), o = s + 1);
  }
  return l.push(n.slice(o).trim()), l.filter(Boolean);
}
function y0(n, l) {
  const i = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let o = !1;
  for (; l < n.length; ) {
    const s = n[l];
    if (s === "*") {
      i.tag = "*", l++, o = !0;
      continue;
    }
    if (s === ".") {
      const [d, m] = xl(n, l + 1);
      i.classes.push(d), l = m, o = !0;
      continue;
    }
    if (s === "#") {
      const [d, m] = xl(n, l + 1);
      i.id = d, l = m, o = !0;
      continue;
    }
    if (s === "[") {
      const d = n.indexOf("]", l);
      if (d < 0) throw new re(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new re(`cannot read the attribute selector [${m}]`);
      const h = f[3] ?? f[4] ?? f[5];
      i.attrs.push({ name: us(f[1]).toLowerCase(), op: f[2] ?? null, value: h === void 0 ? null : us(h) }), l = d + 1, o = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [h, y] = xl(n, l + 2), _ = h.toLowerCase();
        if (_ !== "before" && _ !== "after") throw new re(`::${_} is not supported`);
        if (i.pseudoElement = _, l = y, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow ::${_} in ${JSON.stringify(n)}`);
        break;
      }
      const [d, m] = xl(n, l + 1);
      l = m;
      const f = d.toLowerCase();
      if ((f === "before" || f === "after") && n[l] !== "(") {
        if (i.pseudoElement = f, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!g0.has(f)) throw new re(`:${f}() is not supported`);
        const h = v0(n, l + 1), y = n.slice(l + 1, h).trim();
        if (l = h + 1, f === "nth-child") {
          if (!/^\d+$/.test(y)) throw new re(`:nth-child(${y}) is not supported (only a number)`);
          i.pseudos.push({ name: f, n: Number(y) });
        } else {
          const _ = js(y).map(Os);
          if (f === "has" && _.some((w) => w.length !== 1)) throw new re(`:has(${y}) is not supported (only a compound selector)`);
          i.pseudos.push({ name: f, list: _ });
        }
      } else {
        if (!b0.has(f)) throw new re(`:${f} is not supported`);
        i.pseudos.push({ name: f });
      }
      o = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !o) {
      const [d, m] = xl(n, l);
      i.tag = d.toLowerCase(), l = m, o = !0;
      continue;
    }
    break;
  }
  if (!o) throw new re(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [i, l];
}
function Os(n) {
  const l = [];
  let i = 0, o = null;
  for (n = n.trim(); i < n.length; ) {
    const [s, d] = y0(n, i);
    if (l.at(-1)?.compound.pseudoElement) throw new re(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    l.push({ compound: s, combinator: o }), i = d;
    let m = !1;
    for (; n[i] === " " || n[i] === `
` || n[i] === "	"; )
      i++, m = !0;
    if (i >= n.length) break;
    const f = n[i];
    if (f === ">")
      for (o = ">", i++; n[i] === " "; ) i++;
    else {
      if (f === "+" || f === "~") throw new re(`the ${f} combinator is not supported`);
      if (m) o = " ";
      else throw new re(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new re("empty selector");
  return l;
}
const Ld = /* @__PURE__ */ new Map();
function si(n) {
  let l = Ld.get(n);
  return l || (l = js(n).map(Os), Ld.set(n, l)), l;
}
function Bf(n) {
  const l = [0, 0, 0], i = (o) => {
    l[0] += o[0], l[1] += o[1], l[2] += o[2];
  };
  for (const { compound: o } of n) {
    o.id && l[0]++, l[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && l[2]++, o.pseudoElement && l[2]++;
    for (const s of o.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(Bf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          i(d);
        } else l[1]++;
  }
  return l;
}
function x0(n, { name: l, op: i, value: o }) {
  const s = n.getAttribute(l);
  if (s == null) return !1;
  if (i === null) return !0;
  switch (i) {
    case "=":
      return s === o;
    case "^=":
      return o !== "" && s.startsWith(o);
    case "$=":
      return o !== "" && s.endsWith(o);
    case "*=":
      return o !== "" && s.includes(o);
    case "~=":
      return s.split(/\s+/).includes(o);
    case "|=":
      return s === o || s.startsWith(`${o}-`);
    default:
      return !1;
  }
}
function jr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Uf(n, l) {
  for (const i of n.children) if (l(i) || Uf(i, l)) return !0;
  return !1;
}
function qf(n, l, i, o) {
  if ((l.pseudoElement ?? null) !== (o ? i.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const d of l.classes) if (!s.has(d)) return !1;
  }
  for (const s of l.attrs) if (!x0(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
      case "first-child":
        if (jr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (jr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = jr(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (jr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => La(n, d, i, o))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: d }]) => Uf(n, (m) => qf(m, d, i, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((d) => La(n, d, i, o))) return !1;
        break;
      default:
        if (!i.state || !i.state(n, s.name, o)) return !1;
    }
  return !0;
}
function La(n, l, i, o = !0) {
  const s = (d, m, f) => {
    const { compound: h, combinator: y } = l[m];
    if (!qf(d, h, i, f)) return !1;
    if (m === 0) return !0;
    if (y === ">") return !!d.parentElement && s(d.parentElement, m - 1, !1);
    for (let _ = d.parentElement; _; _ = _.parentElement) if (s(_, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, o);
}
function w0(n, l, i = {}) {
  return (typeof l == "string" ? si(l) : l).some((s) => La(n, s, i));
}
function ds(n, l, i = {}) {
  return La(n, l, i);
}
function Tl(n, l, i = {}) {
  const o = si(l), s = [], d = (m) => {
    for (const f of m.children)
      o.some((h) => La(f, h, i)) && s.push(f), d(f);
  };
  return d(n), s;
}
function Yf(n, l, i = {}) {
  const o = si(l);
  for (let s = n; s; s = s.parentElement) if (o.some((d) => La(s, d, i))) return s;
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
class fs {
  constructor(l = 0, i = 0, o = 0, s = 0) {
    this.x = l, this.y = i, this.width = o, this.height = s;
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
class Rs {
  constructor() {
    this.listeners = [];
  }
  addEventListener(l, i, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners.some((d) => d.type === l && d.listener === i && d.capture === s) || this.listeners.push({ type: l, listener: i, capture: s });
  }
  removeEventListener(l, i, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === l && d.listener === i && d.capture === s));
  }
}
let k0 = 0;
const ms = () => ++k0;
class ci {
  constructor(l) {
    this.nodeType = 3, this.parentNode = null, this.chars = String(l), this.hide = !1;
  }
  /** A text's change re-describes its element (`HostElement.mark`), not its style. */
  get data() {
    return this.chars;
  }
  set data(l) {
    this.chars = String(l), this.parentNode?.mark?.();
  }
  get hidden() {
    return this.hide;
  }
  set hidden(l) {
    this.hide = l, this.parentNode?.mark?.();
  }
  get parentElement() {
    return this.parentNode;
  }
  get textContent() {
    return this.data;
  }
}
class Vt extends Rs {
  constructor(l, i = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${_0++}`, this.tagName = l.toLowerCase(), this.props = i, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = ms(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const l = ms();
    for (let i = this; i instanceof Vt; i = i.parentNode) i.stamp = l;
  }
  /** Its children changed: its own style (`:empty`-like reads, `:has()` below) and every ancestor whose style asked what
   * lies below it (`:has()`, `selector.mjs`). Its descendants keep theirs: a sibling moving changes only the first and
   * last children's positions, which their own cache keys read. */
  touchWatchers() {
    this.version++, this.mark();
    for (let l = this.parentElement; l; l = l.parentElement) l.watchesDescendants && l.touch();
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof Vt ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof Vt);
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
    if (this.classCache?.name !== l) {
      const i = l.split(/\s+/).filter(Boolean);
      this.classCache = { name: l, list: i, set: new Set(i) };
    }
    return this.classCache.list;
  }
  /** The classes as a set, for selector matching. */
  get classSet() {
    return this.classList, this.classCache.set;
  }
  get textContent() {
    return this.childNodes.map((l) => l.textContent).join("");
  }
  get dataset() {
    const l = {};
    for (const [i, o] of Object.entries(this.props))
      i.startsWith("data-") && o != null && o !== !1 && (l[i.slice(5).replace(/-([a-z])/g, (s, d) => d.toUpperCase())] = String(o));
    return l;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(l) {
    const i = this.props;
    if (l === "class") return this.className || null;
    if (l === "id") return i.id != null ? String(i.id) : null;
    if (l === "style") return null;
    let s = i[l === "for" ? "htmlFor" : l === "tabindex" ? "tabIndex" : l];
    if (s === void 0 && !l.includes("-")) {
      const d = l.replace(/-([a-z])/g, (m, f) => f.toUpperCase());
      s = i[d];
    }
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? l.startsWith("aria-") || l.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(l) {
    return this.getAttribute(l) !== null;
  }
  appendChild(l) {
    return l.parentNode && l.parentNode.removeChild(l), l.parentNode = this, this.childNodes.push(l), this.touchWatchers(), l;
  }
  insertBefore(l, i) {
    l.parentNode && l.parentNode.removeChild(l);
    const o = this.childNodes.indexOf(i);
    return l.parentNode = this, o < 0 ? this.childNodes.push(l) : this.childNodes.splice(o, 0, l), this.touchWatchers(), l;
  }
  removeChild(l) {
    const i = this.childNodes.indexOf(l);
    return i >= 0 && this.childNodes.splice(i, 1), l.parentNode = null, this.touchWatchers(), l;
  }
  contains(l) {
    for (let i = l; i; i = i.parentNode) if (i === this) return !0;
    return !1;
  }
  matches(l) {
    return w0(this, l);
  }
  closest(l) {
    return Yf(this, l);
  }
  querySelectorAll(l) {
    return Tl(this, l);
  }
  querySelector(l) {
    return Tl(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new fs(l.x, l.y, l.width, l.height) : new fs();
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
  setSelectionRange(l, i) {
    this.selectedAll = l === 0 && i >= this.value.length && i > 0;
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
    const l = this, i = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, h) => h.toUpperCase()), o = (m) => {
      const f = l.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, s = (m) => l.inline && m in l.inline ? l.inline[m] : o(m), d = (m, f) => {
      const h = f == null ? "" : String(f);
      s(m) !== h && (l.inline ??= {}, h === o(m) ? delete l.inline[m] : l.inline[m] = h, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (h, y) => d(i(h), y) : f === "removeProperty" ? (h) => {
            const y = s(i(h));
            return d(i(h), ""), y;
          } : f === "getPropertyValue" ? (h) => s(i(h)) : s(f);
      },
      set: (m, f, h) => (typeof f == "string" && d(f, h), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return Qd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return Qd(this, l);
  }
}
const Gf = Symbol("perch.stale-layout"), Lf = 3;
let Vr = !1;
function Qf(n) {
  return () => {
    let l, i = !1;
    const o = (s) => {
      const d = Vr;
      Vr = s < Lf;
      try {
        l = n();
      } catch (m) {
        const f = m?.[Gf];
        if (!f) throw m;
        f.retries.push(() => {
          i || o(s + 1);
        });
      } finally {
        Vr = d;
      }
    };
    return o(0), () => {
      i = !0, typeof l == "function" && l();
    };
  };
}
const ps = "perch-dom:", S0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), E0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Qd(n, l = []) {
  const i = new Set(l.map((s) => E0[s] ?? s)), o = (s) => {
    if (!(s instanceof Vt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(s.props))
      S0.has(m) || i.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(o), ...s.hidden ? { h: 1 } : {} };
  };
  return ps + JSON.stringify(o(n));
}
function z0(n, l) {
  if (typeof n != "string" || !n.startsWith(ps)) return null;
  let i;
  try {
    i = JSON.parse(n.slice(ps.length));
  } catch {
    return null;
  }
  const o = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!o(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new ci(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !o(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      m = new Vt(d.t, d.p, l);
      for (const f of d.c) m.appendChild(s(f));
    }
    return m.hidden = d.h === 1, m;
  };
  try {
    return [s(i)];
  } catch {
    return null;
  }
}
class N0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class T0 {
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
  setItem(l, i) {
    this.map.set(l, String(i));
  }
  removeItem(l) {
    this.map.delete(l);
  }
  clear() {
    this.map.clear();
  }
}
function Vd(n) {
  for (let l = n; l instanceof Vt; l = l.parentElement) l.touch();
}
class C0 extends Rs {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new Vt("html", {}, this), this.body = new Vt("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new Vt(l, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(l) {
    const i = this.perch?.bounds;
    if (typeof i != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const o = i(this.measureKey(l));
    if (Vr && (!o || this.stale?.())) throw { [Gf]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Vd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Vd(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return Tl(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return Tl(this.documentElement, "*").find((i) => i.props?.id === l) ?? null;
  }
}
class M0 extends Rs {
  constructor(l, i) {
    super(), this.perch = l, this.document = i, this.location = { get hostname() {
      return l.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(l, i, ...o) {
    return globalThis.setTimeout(l, i, ...o);
  }
  clearTimeout(l) {
    return globalThis.clearTimeout(l);
  }
}
function Vf(n) {
  return {
    setTimeout: (l, i = 0, ...o) => n.setTimeout(() => l(...o), Math.max(0, Number(i) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Kd = Symbol.for("perch.react.globals");
function Je(n, l, i) {
  Object.defineProperty(n, l, { value: i, configurable: !0, writable: !0, enumerable: !1 });
}
function A0(n, l = globalThis) {
  const i = new C0(n), o = new M0(n, i);
  i.defaultView = o;
  const s = n.storage ?? new T0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = Vf(n);
    Je(l, "setTimeout", f.setTimeout), Je(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Je(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Je(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Je(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: i, window: o, localStorage: s, HTMLElement: Vt, Element: Vt };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Kd]?.[f], configurable: !0, enumerable: !1 });
  l[Kd] = d, Je(l, "DOMRect", fs), Je(l, "getComputedStyle", j0), typeof l.ResizeObserver != "function" && Je(l, "ResizeObserver", N0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Je(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Je(l, "navigator", m), { document: i, window: o, globals: d };
}
function j0(n) {
  const l = n?.ownerDocument?.computed?.(n) ?? {}, i = (o) => {
    const s = l[o];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (o, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (d) => i(String(d)) : i(s.replace(/[A-Z]/g, (d) => `-${d.toLowerCase()}`));
    }
  });
}
function hs(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Kf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let o = n.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const Kf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Xd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Xd?.setTimeout == "function") {
  const n = Vf(Xd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Ds(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function O0(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var l = n.default;
  if (typeof l == "function") {
    var i = function o() {
      return this instanceof o ? Reflect.construct(l, arguments, this.constructor) : l.apply(this, arguments);
    };
    i.prototype = l.prototype;
  } else i = {};
  return Object.defineProperty(i, "__esModule", { value: !0 }), Object.keys(n).forEach(function(o) {
    var s = Object.getOwnPropertyDescriptor(n, o);
    Object.defineProperty(i, o, s.get ? s : {
      enumerable: !0,
      get: function() {
        return n[o];
      }
    });
  }), i;
}
var Io = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Zd;
function R0() {
  if (Zd) return pt;
  Zd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), h = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), _ = Symbol.for("react.lazy"), w = Symbol.for("react.activity"), b = Symbol.iterator;
  function S(M) {
    return M === null || typeof M != "object" ? null : (M = b && M[b] || M["@@iterator"], typeof M == "function" ? M : null);
  }
  var N = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, O = Object.assign, E = {};
  function j(M, X, nt) {
    this.props = M, this.context = X, this.refs = E, this.updater = nt || N;
  }
  j.prototype.isReactComponent = {}, j.prototype.setState = function(M, X) {
    if (typeof M != "object" && typeof M != "function" && M != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, M, X, "setState");
  }, j.prototype.forceUpdate = function(M) {
    this.updater.enqueueForceUpdate(this, M, "forceUpdate");
  };
  function D() {
  }
  D.prototype = j.prototype;
  function B(M, X, nt) {
    this.props = M, this.context = X, this.refs = E, this.updater = nt || N;
  }
  var J = B.prototype = new D();
  J.constructor = B, O(J, j.prototype), J.isPureReactComponent = !0;
  var Z = Array.isArray;
  function T() {
  }
  var p = { H: null, A: null, T: null, S: null }, v = Object.prototype.hasOwnProperty;
  function x(M, X, nt) {
    var st = nt.ref;
    return {
      $$typeof: n,
      type: M,
      key: X,
      ref: st !== void 0 ? st : null,
      props: nt
    };
  }
  function k(M, X) {
    return x(M.type, X, M.props);
  }
  function C(M) {
    return typeof M == "object" && M !== null && M.$$typeof === n;
  }
  function z(M) {
    var X = { "=": "=0", ":": "=2" };
    return "$" + M.replace(/[=:]/g, function(nt) {
      return X[nt];
    });
  }
  var R = /\/+/g;
  function Y(M, X) {
    return typeof M == "object" && M !== null && M.key != null ? z("" + M.key) : X.toString(36);
  }
  function W(M) {
    switch (M.status) {
      case "fulfilled":
        return M.value;
      case "rejected":
        throw M.reason;
      default:
        switch (typeof M.status == "string" ? M.then(T, T) : (M.status = "pending", M.then(
          function(X) {
            M.status === "pending" && (M.status = "fulfilled", M.value = X);
          },
          function(X) {
            M.status === "pending" && (M.status = "rejected", M.reason = X);
          }
        )), M.status) {
          case "fulfilled":
            return M.value;
          case "rejected":
            throw M.reason;
        }
    }
    throw M;
  }
  function q(M, X, nt, st, ct) {
    var ut = typeof M;
    (ut === "undefined" || ut === "boolean") && (M = null);
    var Et = !1;
    if (M === null) Et = !0;
    else
      switch (ut) {
        case "bigint":
        case "string":
        case "number":
          Et = !0;
          break;
        case "object":
          switch (M.$$typeof) {
            case n:
            case l:
              Et = !0;
              break;
            case _:
              return Et = M._init, q(
                Et(M._payload),
                X,
                nt,
                st,
                ct
              );
          }
      }
    if (Et)
      return ct = ct(M), Et = st === "" ? "." + Y(M, 0) : st, Z(ct) ? (nt = "", Et != null && (nt = Et.replace(R, "$&/") + "/"), q(ct, X, nt, "", function(Ln) {
        return Ln;
      })) : ct != null && (C(ct) && (ct = k(
        ct,
        nt + (ct.key == null || M && M.key === ct.key ? "" : ("" + ct.key).replace(
          R,
          "$&/"
        ) + "/") + Et
      )), X.push(ct)), 1;
    Et = 0;
    var Wt = st === "" ? "." : st + ":";
    if (Z(M))
      for (var ht = 0; ht < M.length; ht++)
        st = M[ht], ut = Wt + Y(st, ht), Et += q(
          st,
          X,
          nt,
          ut,
          ct
        );
    else if (ht = S(M), typeof ht == "function")
      for (M = ht.call(M), ht = 0; !(st = M.next()).done; )
        st = st.value, ut = Wt + Y(st, ht++), Et += q(
          st,
          X,
          nt,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof M.then == "function")
        return q(
          W(M),
          X,
          nt,
          st,
          ct
        );
      throw X = String(M), Error(
        "Objects are not valid as a React child (found: " + (X === "[object Object]" ? "object with keys {" + Object.keys(M).join(", ") + "}" : X) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function K(M, X, nt) {
    if (M == null) return M;
    var st = [], ct = 0;
    return q(M, st, "", "", function(ut) {
      return X.call(nt, ut, ct++);
    }), st;
  }
  function $(M) {
    if (M._status === -1) {
      var X = M._result;
      X = X(), X.then(
        function(nt) {
          (M._status === 0 || M._status === -1) && (M._status = 1, M._result = nt);
        },
        function(nt) {
          (M._status === 0 || M._status === -1) && (M._status = 2, M._result = nt);
        }
      ), M._status === -1 && (M._status = 0, M._result = X);
    }
    if (M._status === 1) return M._result.default;
    throw M._result;
  }
  var Q = typeof reportError == "function" ? reportError : function(M) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var X = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof M == "object" && M !== null && typeof M.message == "string" ? String(M.message) : String(M),
        error: M
      });
      if (!window.dispatchEvent(X)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", M);
      return;
    }
    console.error(M);
  }, V = {
    map: K,
    forEach: function(M, X, nt) {
      K(
        M,
        function() {
          X.apply(this, arguments);
        },
        nt
      );
    },
    count: function(M) {
      var X = 0;
      return K(M, function() {
        X++;
      }), X;
    },
    toArray: function(M) {
      return K(M, function(X) {
        return X;
      }) || [];
    },
    only: function(M) {
      if (!C(M))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return M;
    }
  };
  return pt.Activity = w, pt.Children = V, pt.Component = j, pt.Fragment = i, pt.Profiler = s, pt.PureComponent = B, pt.StrictMode = o, pt.Suspense = h, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = p, pt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(M) {
      return p.H.useMemoCache(M);
    }
  }, pt.cache = function(M) {
    return function() {
      return M.apply(null, arguments);
    };
  }, pt.cacheSignal = function() {
    return null;
  }, pt.cloneElement = function(M, X, nt) {
    if (M == null)
      throw Error(
        "The argument must be a React element, but you passed " + M + "."
      );
    var st = O({}, M.props), ct = M.key;
    if (X != null)
      for (ut in X.key !== void 0 && (ct = "" + X.key), X)
        !v.call(X, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && X.ref === void 0 || (st[ut] = X[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) st.children = nt;
    else if (1 < ut) {
      for (var Et = Array(ut), Wt = 0; Wt < ut; Wt++)
        Et[Wt] = arguments[Wt + 2];
      st.children = Et;
    }
    return x(M.type, ct, st);
  }, pt.createContext = function(M) {
    return M = {
      $$typeof: m,
      _currentValue: M,
      _currentValue2: M,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, M.Provider = M, M.Consumer = {
      $$typeof: d,
      _context: M
    }, M;
  }, pt.createElement = function(M, X, nt) {
    var st, ct = {}, ut = null;
    if (X != null)
      for (st in X.key !== void 0 && (ut = "" + X.key), X)
        v.call(X, st) && st !== "key" && st !== "__self" && st !== "__source" && (ct[st] = X[st]);
    var Et = arguments.length - 2;
    if (Et === 1) ct.children = nt;
    else if (1 < Et) {
      for (var Wt = Array(Et), ht = 0; ht < Et; ht++)
        Wt[ht] = arguments[ht + 2];
      ct.children = Wt;
    }
    if (M && M.defaultProps)
      for (st in Et = M.defaultProps, Et)
        ct[st] === void 0 && (ct[st] = Et[st]);
    return x(M, ut, ct);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(M) {
    return { $$typeof: f, render: M };
  }, pt.isValidElement = C, pt.lazy = function(M) {
    return {
      $$typeof: _,
      _payload: { _status: -1, _result: M },
      _init: $
    };
  }, pt.memo = function(M, X) {
    return {
      $$typeof: y,
      type: M,
      compare: X === void 0 ? null : X
    };
  }, pt.startTransition = function(M) {
    var X = p.T, nt = {};
    p.T = nt;
    try {
      var st = M(), ct = p.S;
      ct !== null && ct(nt, st), typeof st == "object" && st !== null && typeof st.then == "function" && st.then(T, Q);
    } catch (ut) {
      Q(ut);
    } finally {
      X !== null && nt.types !== null && (X.types = nt.types), p.T = X;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return p.H.useCacheRefresh();
  }, pt.use = function(M) {
    return p.H.use(M);
  }, pt.useActionState = function(M, X, nt) {
    return p.H.useActionState(M, X, nt);
  }, pt.useCallback = function(M, X) {
    return p.H.useCallback(M, X);
  }, pt.useContext = function(M) {
    return p.H.useContext(M);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(M, X) {
    return p.H.useDeferredValue(M, X);
  }, pt.useEffect = function(M, X) {
    return p.H.useEffect(M, X);
  }, pt.useEffectEvent = function(M) {
    return p.H.useEffectEvent(M);
  }, pt.useId = function() {
    return p.H.useId();
  }, pt.useImperativeHandle = function(M, X, nt) {
    return p.H.useImperativeHandle(M, X, nt);
  }, pt.useInsertionEffect = function(M, X) {
    return p.H.useInsertionEffect(M, X);
  }, pt.useLayoutEffect = function(M, X) {
    return p.H.useLayoutEffect(M, X);
  }, pt.useMemo = function(M, X) {
    return p.H.useMemo(M, X);
  }, pt.useOptimistic = function(M, X) {
    return p.H.useOptimistic(M, X);
  }, pt.useReducer = function(M, X, nt) {
    return p.H.useReducer(M, X, nt);
  }, pt.useRef = function(M) {
    return p.H.useRef(M);
  }, pt.useState = function(M) {
    return p.H.useState(M);
  }, pt.useSyncExternalStore = function(M, X, nt) {
    return p.H.useSyncExternalStore(
      M,
      X,
      nt
    );
  }, pt.useTransition = function() {
    return p.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var Jd;
function D0() {
  return Jd || (Jd = 1, Io.exports = R0()), Io.exports;
}
var et = D0();
const Xf = /* @__PURE__ */ Ds(et), H0 = /* @__PURE__ */ As({
  __proto__: null,
  default: Xf
}, [et]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const B0 = Xf ?? H0;
function de(n, l) {
  return et.useEffect(Qf(n), l);
}
function Jr(n, l) {
  return et.useLayoutEffect(Qf(n), l);
}
const U0 = /* @__PURE__ */ As({
  __proto__: null,
  default: B0,
  useEffect: de,
  useLayoutEffect: Jr
}, [et]);
var Po = { exports: {} }, wl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Wd;
function q0() {
  if (Wd) return wl;
  Wd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function i(o, s, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), s.key !== void 0 && (m = "" + s.key), "key" in s) {
      d = {};
      for (var f in s)
        f !== "key" && (d[f] = s[f]);
    } else d = s;
    return s = d.ref, {
      $$typeof: n,
      type: o,
      key: m,
      ref: s !== void 0 ? s : null,
      props: d
    };
  }
  return wl.Fragment = l, wl.jsx = i, wl.jsxs = i, wl;
}
var Fd;
function Y0() {
  return Fd || (Fd = 1, Po.exports = q0()), Po.exports;
}
var ot = Y0();
const G0 = /* @__PURE__ */ Ds(ot), Wy = /* @__PURE__ */ As({
  __proto__: null,
  default: G0
}, [ot]);
var ts = { exports: {} }, es = { exports: {} };
const L0 = /* @__PURE__ */ O0(U0);
var ns = { exports: {} }, as = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var $d;
function Q0() {
  return $d || ($d = 1, (function(n) {
    function l(q, K) {
      var $ = q.length;
      q.push(K);
      t: for (; 0 < $; ) {
        var Q = $ - 1 >>> 1, V = q[Q];
        if (0 < s(V, K))
          q[Q] = K, q[$] = V, $ = Q;
        else break t;
      }
    }
    function i(q) {
      return q.length === 0 ? null : q[0];
    }
    function o(q) {
      if (q.length === 0) return null;
      var K = q[0], $ = q.pop();
      if ($ !== K) {
        q[0] = $;
        t: for (var Q = 0, V = q.length, M = V >>> 1; Q < M; ) {
          var X = 2 * (Q + 1) - 1, nt = q[X], st = X + 1, ct = q[st];
          if (0 > s(nt, $))
            st < V && 0 > s(ct, nt) ? (q[Q] = ct, q[st] = $, Q = st) : (q[Q] = nt, q[X] = $, Q = X);
          else if (st < V && 0 > s(ct, $))
            q[Q] = ct, q[st] = $, Q = st;
          else break t;
        }
      }
      return K;
    }
    function s(q, K) {
      var $ = q.sortIndex - K.sortIndex;
      return $ !== 0 ? $ : q.id - K.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      n.unstable_now = function() {
        return d.now();
      };
    } else {
      var m = Date, f = m.now();
      n.unstable_now = function() {
        return m.now() - f;
      };
    }
    var h = [], y = [], _ = 1, w = null, b = 3, S = !1, N = !1, O = !1, E = !1, j = typeof setTimeout == "function" ? setTimeout : null, D = typeof clearTimeout == "function" ? clearTimeout : null, B = typeof setImmediate < "u" ? setImmediate : null;
    function J(q) {
      for (var K = i(y); K !== null; ) {
        if (K.callback === null) o(y);
        else if (K.startTime <= q)
          o(y), K.sortIndex = K.expirationTime, l(h, K);
        else break;
        K = i(y);
      }
    }
    function Z(q) {
      if (O = !1, J(q), !N)
        if (i(h) !== null)
          N = !0, T || (T = !0, z());
        else {
          var K = i(y);
          K !== null && W(Z, K.startTime - q);
        }
    }
    var T = !1, p = -1, v = 5, x = -1;
    function k() {
      return E ? !0 : !(n.unstable_now() - x < v);
    }
    function C() {
      if (E = !1, T) {
        var q = n.unstable_now();
        x = q;
        var K = !0;
        try {
          t: {
            N = !1, O && (O = !1, D(p), p = -1), S = !0;
            var $ = b;
            try {
              e: {
                for (J(q), w = i(h); w !== null && !(w.expirationTime > q && k()); ) {
                  var Q = w.callback;
                  if (typeof Q == "function") {
                    w.callback = null, b = w.priorityLevel;
                    var V = Q(
                      w.expirationTime <= q
                    );
                    if (q = n.unstable_now(), typeof V == "function") {
                      w.callback = V, J(q), K = !0;
                      break e;
                    }
                    w === i(h) && o(h), J(q);
                  } else o(h);
                  w = i(h);
                }
                if (w !== null) K = !0;
                else {
                  var M = i(y);
                  M !== null && W(
                    Z,
                    M.startTime - q
                  ), K = !1;
                }
              }
              break t;
            } finally {
              w = null, b = $, S = !1;
            }
            K = void 0;
          }
        } finally {
          K ? z() : T = !1;
        }
      }
    }
    var z;
    if (typeof B == "function")
      z = function() {
        B(C);
      };
    else if (typeof MessageChannel < "u") {
      var R = new MessageChannel(), Y = R.port2;
      R.port1.onmessage = C, z = function() {
        Y.postMessage(null);
      };
    } else
      z = function() {
        j(C, 0);
      };
    function W(q, K) {
      p = j(function() {
        q(n.unstable_now());
      }, K);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(q) {
      q.callback = null;
    }, n.unstable_forceFrameRate = function(q) {
      0 > q || 125 < q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : v = 0 < q ? Math.floor(1e3 / q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return b;
    }, n.unstable_next = function(q) {
      switch (b) {
        case 1:
        case 2:
        case 3:
          var K = 3;
          break;
        default:
          K = b;
      }
      var $ = b;
      b = K;
      try {
        return q();
      } finally {
        b = $;
      }
    }, n.unstable_requestPaint = function() {
      E = !0;
    }, n.unstable_runWithPriority = function(q, K) {
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
      var $ = b;
      b = q;
      try {
        return K();
      } finally {
        b = $;
      }
    }, n.unstable_scheduleCallback = function(q, K, $) {
      var Q = n.unstable_now();
      switch (typeof $ == "object" && $ !== null ? ($ = $.delay, $ = typeof $ == "number" && 0 < $ ? Q + $ : Q) : $ = Q, q) {
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
      return V = $ + V, q = {
        id: _++,
        callback: K,
        priorityLevel: q,
        startTime: $,
        expirationTime: V,
        sortIndex: -1
      }, $ > Q ? (q.sortIndex = $, l(y, q), i(h) === null && q === i(y) && (O ? (D(p), p = -1) : O = !0, W(Z, $ - Q))) : (q.sortIndex = V, l(h, q), N || S || (N = !0, T || (T = !0, z()))), q;
    }, n.unstable_shouldYield = k, n.unstable_wrapCallback = function(q) {
      var K = b;
      return function() {
        var $ = b;
        b = K;
        try {
          return q.apply(this, arguments);
        } finally {
          b = $;
        }
      };
    };
  })(as)), as;
}
var Id;
function V0() {
  return Id || (Id = 1, ns.exports = Q0()), ns.exports;
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
var Pd;
function K0() {
  return Pd || (Pd = 1, (function(n) {
    n.exports = function(l) {
      function i(t, e, a, r) {
        return new xp(t, e, a, r);
      }
      function o() {
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
      function m(t) {
        if (d(t) !== t)
          throw Error(s(188));
      }
      function f(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(s(188));
          return e !== t ? null : t;
        }
        for (var a = t, r = e; ; ) {
          var c = a.return;
          if (c === null) break;
          var u = c.alternate;
          if (u === null) {
            if (r = c.return, r !== null) {
              a = r;
              continue;
            }
            break;
          }
          if (c.child === u.child) {
            for (u = c.child; u; ) {
              if (u === a) return m(c), t;
              if (u === r) return m(c), e;
              u = u.sibling;
            }
            throw Error(s(188));
          }
          if (a.return !== r.return) a = c, r = u;
          else {
            for (var g = !1, A = c.child; A; ) {
              if (A === a) {
                g = !0, a = c, r = u;
                break;
              }
              if (A === r) {
                g = !0, r = c, a = u;
                break;
              }
              A = A.sibling;
            }
            if (!g) {
              for (A = u.child; A; ) {
                if (A === a) {
                  g = !0, a = u, r = c;
                  break;
                }
                if (A === r) {
                  g = !0, r = u, a = c;
                  break;
                }
                A = A.sibling;
              }
              if (!g) throw Error(s(189));
            }
          }
          if (a.alternate !== r) throw Error(s(190));
        }
        if (a.tag !== 3) throw Error(s(188));
        return a.stateNode.current === a ? t : e;
      }
      function h(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = h(t), e !== null) return e;
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
      function _(t) {
        return t === null || typeof t != "object" ? null : (t = od && t[od] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function w(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Ep ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case xa:
            return "Fragment";
          case vo:
            return "Profiler";
          case rd:
            return "StrictMode";
          case xo:
            return "Suspense";
          case wo:
            return "SuspenseList";
          case ko:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ya:
              return "Portal";
            case Sn:
              return t.displayName || "Context";
            case id:
              return (t._context.displayName || "Context") + ".Consumer";
            case yo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case _o:
              return e = t.displayName || null, e !== null ? e : w(t.type) || "Memo";
            case En:
              e = t._payload, t = t._init;
              try {
                return w(t(e));
              } catch {
              }
          }
        return null;
      }
      function b(t) {
        return { current: t };
      }
      function S(t) {
        0 > ka || (t.current = Co[ka], Co[ka] = null, ka--);
      }
      function N(t, e) {
        ka++, Co[ka] = t.current, t.current = e;
      }
      function O(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Ph(t) / t0 | 0) | 0;
      }
      function E(t) {
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
      function j(t, e, a) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, g = t.pingedLanes;
        t = t.warmLanes;
        var A = r & 134217727;
        return A !== 0 ? (r = A & ~u, r !== 0 ? c = E(r) : (g &= A, g !== 0 ? c = E(g) : a || (a = A & ~t, a !== 0 && (c = E(a))))) : (A = r & ~u, A !== 0 ? c = E(A) : g !== 0 ? c = E(g) : a || (a = r & ~t, a !== 0 && (c = E(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
      }
      function D(t, e) {
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
      function J() {
        var t = mr;
        return mr <<= 1, (mr & 62914560) === 0 && (mr = 4194304), t;
      }
      function Z(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function T(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function p(t, e, a, r, c, u) {
        var g = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var A = t.entanglements, L = t.expirationTimes, F = t.hiddenUpdates;
        for (a = g & ~a; 0 < a; ) {
          var tt = 31 - we(a), I = 1 << tt;
          A[tt] = 0, L[tt] = -1;
          var at = F[tt];
          if (at !== null)
            for (F[tt] = null, tt = 0; tt < at.length; tt++) {
              var gt = at[tt];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~I;
        }
        r !== 0 && v(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
      }
      function v(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - we(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | a & 261930;
      }
      function x(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var r = 31 - we(a), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), a &= ~c;
        }
      }
      function k(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : C(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function C(t) {
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
      function z(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function R(t) {
        if (typeof r0 == "function" && i0(t), _e && typeof _e.setStrictMode == "function")
          try {
            _e.setStrictMode(sl, t);
          } catch {
          }
      }
      function Y(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function W(t) {
        if (jo === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            jo = e && e[1] || "", Od = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + jo + t + Od;
      }
      function q(t, e) {
        if (!t || Oo) return "";
        Oo = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var r = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var I = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(I.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(I, []);
                    } catch (gt) {
                      var at = gt;
                    }
                    Reflect.construct(t, [], I);
                  } else {
                    try {
                      I.call();
                    } catch (gt) {
                      at = gt;
                    }
                    t.call(I.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    at = gt;
                  }
                  (I = t()) && typeof I.catch == "function" && I.catch(function() {
                  });
                }
              } catch (gt) {
                if (gt && at && typeof gt.stack == "string")
                  return [gt.stack, at.stack];
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
          var u = r.DetermineComponentFrameRoot(), g = u[0], A = u[1];
          if (g && A) {
            var L = g.split(`
`), F = A.split(`
`);
            for (c = r = 0; r < L.length && !L[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < F.length && !F[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === L.length || c === F.length)
              for (r = L.length - 1, c = F.length - 1; 1 <= r && 0 <= c && L[r] !== F[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (L[r] !== F[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || L[r] !== F[c]) {
                      var tt = `
` + L[r].replace(" at new ", " at ");
                      return t.displayName && tt.includes("<anonymous>") && (tt = tt.replace("<anonymous>", t.displayName)), tt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          Oo = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? W(a) : "";
      }
      function K(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return W(t.type);
          case 16:
            return W("Lazy");
          case 13:
            return t.child !== e && e !== null ? W("Suspense Fallback") : W("Suspense");
          case 19:
            return W("SuspenseList");
          case 0:
          case 15:
            return q(t.type, !1);
          case 11:
            return q(t.type.render, !1);
          case 1:
            return q(t.type, !0);
          case 31:
            return W("Activity");
          default:
            return "";
        }
      }
      function $(t) {
        try {
          var e = "", a = null;
          do
            e += K(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (r) {
          return `
Error generating stack: ` + r.message + `
` + r.stack;
        }
      }
      function Q(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = Rd.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: $(e)
          }, Rd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: $(e)
        };
      }
      function V(t, e) {
        Ea[za++] = cl, Ea[za++] = hr, hr = t, cl = e;
      }
      function M(t, e, a) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = zn, zn = t;
        var r = Xe;
        t = Ze;
        var c = 32 - we(r) - 1;
        r &= ~(1 << c), a += 1;
        var u = 32 - we(e) + c;
        if (30 < u) {
          var g = c - c % 5;
          u = (r & (1 << g) - 1).toString(32), r >>= g, c -= g, Xe = 1 << 32 - we(e) + c | a << c | r, Ze = u + t;
        } else
          Xe = 1 << u | a << c | r, Ze = t;
      }
      function X(t) {
        t.return !== null && (V(t, 1), M(t, 1, 0));
      }
      function nt(t) {
        for (; t === hr; )
          hr = Ea[--za], Ea[za] = null, cl = Ea[--za], Ea[za] = null;
        for (; t === zn; )
          zn = Ce[--Me], Ce[Me] = null, Ze = Ce[--Me], Ce[Me] = null, Xe = Ce[--Me], Ce[Me] = null;
      }
      function st(t, e) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = zn, Xe = e.id, Ze = e.overflow, zn = t;
      }
      function ct(t, e) {
        N(Nn, e), N(ul, t), N(ne, null), t = Tp(e), S(ne), N(ne, t);
      }
      function ut() {
        S(ne), S(ul), S(Nn);
      }
      function Et(t) {
        t.memoizedState !== null && N(gr, t);
        var e = ne.current, a = Cp(e, t.type);
        e !== a && (N(ul, t), N(ne, a));
      }
      function Wt(t) {
        ul.current === t && (S(ne), S(ul)), gr.current === t && (S(gr), rn ? In._currentValue = wa : In._currentValue2 = wa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Va(Q(e, t)), Ro;
      }
      function Ln(t, e) {
        if (!ce) throw Error(s(175));
        Ch(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Qn(t) {
        for (ae = t.return; ae; )
          switch (ae.tag) {
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
              ae = ae.return;
          }
      }
      function De(t) {
        if (!ce || t !== ae) return !1;
        if (!kt) return Qn(t), kt = !0, !1;
        var e = t.tag;
        if (Kt ? e !== 3 && e !== 27 && (e !== 5 || xd(t.type) && !ur(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || xd(t.type) && !ur(t.type, t.memoizedProps)) && Ot && ht(t), Qn(t), e === 13) {
          if (!ce) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Rh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = Oh(t);
        } else
          Ot = Kt && e === 27 ? yh(
            t.type,
            Ot
          ) : ae ? yd(t.stateNode) : null;
        return !0;
      }
      function He() {
        ce && (Ot = ae = null, kt = !1);
      }
      function gn() {
        var t = Tn;
        return t !== null && (be === null ? be = t : be.push.apply(
          be,
          t
        ), Tn = null), t;
      }
      function Va(t) {
        Tn === null ? Tn = [t] : Tn.push(t);
      }
      function bn(t, e, a) {
        rn ? (N(br, e._currentValue), e._currentValue = a) : (N(br, e._currentValue2), e._currentValue2 = a);
      }
      function Pe(t) {
        var e = br.current;
        rn ? t._currentValue = e : t._currentValue2 = e, S(br);
      }
      function pi(t, e, a) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function hi(t, e, a, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var u = c.dependencies;
          if (u !== null) {
            var g = c.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var A = u;
              u = c;
              for (var L = 0; L < e.length; L++)
                if (A.context === e[L]) {
                  u.lanes |= a, A = u.alternate, A !== null && (A.lanes |= a), pi(
                    u.return,
                    a,
                    t
                  ), r || (g = null);
                  break t;
                }
              u = A.next;
            }
          } else if (c.tag === 18) {
            if (g = c.return, g === null) throw Error(s(341));
            g.lanes |= a, u = g.alternate, u !== null && (u.lanes |= a), pi(g, a, t), g = null;
          } else g = c.child;
          if (g !== null) g.return = c;
          else
            for (g = c; g !== null; ) {
              if (g === t) {
                g = null;
                break;
              }
              if (c = g.sibling, c !== null) {
                c.return = g.return, g = c;
                break;
              }
              g = g.return;
            }
          c = g;
        }
      }
      function ma(t, e, a, r) {
        t = null;
        for (var c = e, u = !1; c !== null; ) {
          if (!u) {
            if ((c.flags & 524288) !== 0) u = !0;
            else if ((c.flags & 262144) !== 0) break;
          }
          if (c.tag === 10) {
            var g = c.alternate;
            if (g === null) throw Error(s(387));
            if (g = g.memoizedProps, g !== null) {
              var A = c.type;
              ke(c.pendingProps.value, g.value) || (t !== null ? t.push(A) : t = [A]);
            }
          } else if (c === gr.current) {
            if (g = c.alternate, g === null) throw Error(s(387));
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(In) : t = [In]);
          }
          c = c.return;
        }
        t !== null && hi(
          e,
          t,
          a,
          r
        ), e.flags |= 262144;
      }
      function Ol(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ke(
            rn ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Vn(t) {
        Pn = t, sn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function te(t) {
        return Zs(Pn, t);
      }
      function Rl(t, e) {
        return Pn === null && Vn(t), Zs(t, e);
      }
      function Zs(t, e) {
        var a = rn ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, sn === null) {
          if (t === null) throw Error(s(308));
          sn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else sn = sn.next = e;
        return a;
      }
      function gi() {
        return {
          controller: new s0(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ka(t) {
        t.refCount--, t.refCount === 0 && c0(u0, function() {
          t.controller.abort();
        });
      }
      function Dl() {
      }
      function Qe(t) {
        t !== Na && t.next === null && (Na === null ? vr = Na = t : Na = Na.next = t), yr = !0, Do || (Do = !0, Fm());
      }
      function pa(t, e) {
        if (!Ho && yr) {
          Ho = !0;
          do
            for (var a = !1, r = vr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, A = r.pingedLanes;
                  u = (1 << 31 - we(42 | t) + 1) - 1, u &= c & ~(g & ~A), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Is(r, u));
              } else
                u = _t, u = j(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== $n
                ), (u & 3) === 0 || D(r, u) || (a = !0, Is(r, u));
              r = r.next;
            }
          while (a);
          Ho = !1;
        }
      }
      function Js() {
        Ws();
      }
      function Ws() {
        yr = Do = !1;
        var t = 0;
        ta !== 0 && Up() && (t = ta);
        for (var e = he(), a = null, r = vr; r !== null; ) {
          var c = r.next, u = Fs(r, e);
          u === 0 ? (r.next = null, a === null ? vr = c : a.next = c, c === null && (Na = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (yr = !0)), r = c;
        }
        Xt !== 0 && Xt !== 5 || pa(t), ta !== 0 && (ta = 0);
      }
      function Fs(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - we(u), A = 1 << g, L = c[g];
          L === -1 ? ((A & a) === 0 || (A & r) !== 0) && (c[g] = B(A, e)) : L <= e && (t.expiredLanes |= A), u &= ~A;
        }
        if (e = At, a = _t, a = j(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== $n
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && Mo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || D(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && Mo(r), z(a)) {
            case 2:
            case 8:
              a = a0;
              break;
            case 32:
              a = Ao;
              break;
            case 268435456:
              a = l0;
              break;
            default:
              a = Ao;
          }
          return r = $s.bind(null, t), a = pr(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && Mo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function $s(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (ll() && t.callbackNode !== a)
          return null;
        var r = _t;
        return r = j(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== $n
        ), r === 0 ? null : (Ru(t, r, e), Fs(t, he()), t.callbackNode != null && t.callbackNode === a ? $s.bind(null, t) : null);
      }
      function Is(t, e) {
        if (ll()) return null;
        Ru(t, e, !0);
      }
      function Fm() {
        Kp ? Xp(function() {
          (xt & 6) !== 0 ? pr(
            Ad,
            Js
          ) : Ws();
        }) : pr(
          Ad,
          Js
        );
      }
      function bi() {
        if (ta === 0) {
          var t = Ta;
          t === 0 && (t = dr, dr <<= 1, (dr & 261888) === 0 && (dr = 256)), ta = t;
        }
        return ta;
      }
      function $m(t, e) {
        if (dl === null) {
          var a = dl = [];
          Bo = 0, Ta = bi(), Ca = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return Bo++, e.then(Ps, Ps), e;
      }
      function Ps() {
        if (--Bo === 0 && dl !== null) {
          Ca !== null && (Ca.status = "fulfilled");
          var t = dl;
          dl = null, Ta = 0, Ca = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Im(t, e) {
        var a = [], r = {
          status: "pending",
          value: null,
          reason: null,
          then: function(c) {
            a.push(c);
          }
        };
        return t.then(
          function() {
            r.status = "fulfilled", r.value = e;
            for (var c = 0; c < a.length; c++) (0, a[c])(e);
          },
          function(c) {
            for (r.status = "rejected", r.reason = c, c = 0; c < a.length; c++)
              (0, a[c])(void 0);
          }
        ), r;
      }
      function vi() {
        var t = ea.current;
        return t !== null ? t : At.pooledCache;
      }
      function Hl(t, e) {
        e === null ? N(ea, ea.current) : N(ea, e.pool);
      }
      function tc() {
        var t = vi();
        return t === null ? null : {
          parent: rn ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function Bl(t, e) {
        if (ke(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!o0.call(e, c) || !ke(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function ec(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function nc(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Dl, Dl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, lc(t), t;
          default:
            if (typeof e.status == "string") e.then(Dl, Dl);
            else {
              if (t = At, t !== null && 100 < t.shellSuspendCounter)
                throw Error(s(482));
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
                throw t = e.reason, lc(t), t;
            }
            throw na = e, Ma;
        }
      }
      function Kn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (na = a, Ma) : a;
        }
      }
      function ac() {
        if (na === null) throw Error(s(459));
        var t = na;
        return na = null, t;
      }
      function lc(t) {
        if (t === Ma || t === xr)
          throw Error(s(483));
      }
      function Ul(t) {
        var e = fl;
        return fl += 1, Aa === null && (Aa = []), nc(Aa, t, e);
      }
      function Xa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function ql(t, e) {
        throw e.$$typeof === kp ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function rc(t) {
        function e(U, H) {
          if (t) {
            var G = U.deletions;
            G === null ? (U.deletions = [H], U.flags |= 16) : G.push(H);
          }
        }
        function a(U, H) {
          if (!t) return null;
          for (; H !== null; )
            e(U, H), H = H.sibling;
          return null;
        }
        function r(U) {
          for (var H = /* @__PURE__ */ new Map(); U !== null; )
            U.key !== null ? H.set(U.key, U) : H.set(U.index, U), U = U.sibling;
          return H;
        }
        function c(U, H) {
          return U = ln(U, H), U.index = 0, U.sibling = null, U;
        }
        function u(U, H, G) {
          return U.index = G, t ? (G = U.alternate, G !== null ? (G = G.index, G < H ? (U.flags |= 67108866, H) : G) : (U.flags |= 67108866, H)) : (U.flags |= 1048576, H);
        }
        function g(U) {
          return t && U.alternate === null && (U.flags |= 67108866), U;
        }
        function A(U, H, G, P) {
          return H === null || H.tag !== 6 ? (H = po(G, U.mode, P), H.return = U, H) : (H = c(H, G), H.return = U, H);
        }
        function L(U, H, G, P) {
          var ft = G.type;
          return ft === xa ? tt(
            U,
            H,
            G.props.children,
            P,
            G.key
          ) : H !== null && (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Kn(ft) === H.type) ? (H = c(H, G.props), Xa(H, G), H.return = U, H) : (H = or(
            G.type,
            G.key,
            G.props,
            null,
            U.mode,
            P
          ), Xa(H, G), H.return = U, H);
        }
        function F(U, H, G, P) {
          return H === null || H.tag !== 4 || H.stateNode.containerInfo !== G.containerInfo || H.stateNode.implementation !== G.implementation ? (H = ho(G, U.mode, P), H.return = U, H) : (H = c(H, G.children || []), H.return = U, H);
        }
        function tt(U, H, G, P, ft) {
          return H === null || H.tag !== 7 ? (H = Fn(
            G,
            U.mode,
            P,
            ft
          ), H.return = U, H) : (H = c(H, G), H.return = U, H);
        }
        function I(U, H, G) {
          if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint")
            return H = po(
              "" + H,
              U.mode,
              G
            ), H.return = U, H;
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case sr:
                return G = or(
                  H.type,
                  H.key,
                  H.props,
                  null,
                  U.mode,
                  G
                ), Xa(G, H), G.return = U, G;
              case ya:
                return H = ho(
                  H,
                  U.mode,
                  G
                ), H.return = U, H;
              case En:
                return H = Kn(H), I(U, H, G);
            }
            if (cr(H) || _(H))
              return H = Fn(
                H,
                U.mode,
                G,
                null
              ), H.return = U, H;
            if (typeof H.then == "function")
              return I(U, Ul(H), G);
            if (H.$$typeof === Sn)
              return I(
                U,
                Rl(U, H),
                G
              );
            ql(U, H);
          }
          return null;
        }
        function at(U, H, G, P) {
          var ft = H !== null ? H.key : null;
          if (typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint")
            return ft !== null ? null : A(U, H, "" + G, P);
          if (typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case sr:
                return G.key === ft ? L(U, H, G, P) : null;
              case ya:
                return G.key === ft ? F(U, H, G, P) : null;
              case En:
                return G = Kn(G), at(U, H, G, P);
            }
            if (cr(G) || _(G))
              return ft !== null ? null : tt(U, H, G, P, null);
            if (typeof G.then == "function")
              return at(
                U,
                H,
                Ul(G),
                P
              );
            if (G.$$typeof === Sn)
              return at(
                U,
                H,
                Rl(U, G),
                P
              );
            ql(U, G);
          }
          return null;
        }
        function gt(U, H, G, P, ft) {
          if (typeof P == "string" && P !== "" || typeof P == "number" || typeof P == "bigint")
            return U = U.get(G) || null, A(H, U, "" + P, ft);
          if (typeof P == "object" && P !== null) {
            switch (P.$$typeof) {
              case sr:
                return U = U.get(
                  P.key === null ? G : P.key
                ) || null, L(H, U, P, ft);
              case ya:
                return U = U.get(
                  P.key === null ? G : P.key
                ) || null, F(H, U, P, ft);
              case En:
                return P = Kn(P), gt(
                  U,
                  H,
                  G,
                  P,
                  ft
                );
            }
            if (cr(P) || _(P))
              return U = U.get(G) || null, tt(H, U, P, ft, null);
            if (typeof P.then == "function")
              return gt(
                U,
                H,
                G,
                Ul(P),
                ft
              );
            if (P.$$typeof === Sn)
              return gt(
                U,
                H,
                G,
                Rl(H, P),
                ft
              );
            ql(H, P);
          }
          return null;
        }
        function le(U, H, G, P) {
          for (var ft = null, Dt = null, mt = H, Nt = H = 0, It = null; mt !== null && Nt < G.length; Nt++) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var Tt = at(
              U,
              mt,
              G[Nt],
              P
            );
            if (Tt === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && Tt.alternate === null && e(U, mt), H = u(Tt, H, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt, mt = It;
          }
          if (Nt === G.length)
            return a(U, mt), kt && V(U, Nt), ft;
          if (mt === null) {
            for (; Nt < G.length; Nt++)
              mt = I(U, G[Nt], P), mt !== null && (H = u(
                mt,
                H,
                Nt
              ), Dt === null ? ft = mt : Dt.sibling = mt, Dt = mt);
            return kt && V(U, Nt), ft;
          }
          for (mt = r(mt); Nt < G.length; Nt++)
            It = gt(
              mt,
              U,
              Nt,
              G[Nt],
              P
            ), It !== null && (t && It.alternate !== null && mt.delete(
              It.key === null ? Nt : It.key
            ), H = u(
              It,
              H,
              Nt
            ), Dt === null ? ft = It : Dt.sibling = It, Dt = It);
          return t && mt.forEach(function(Rn) {
            return e(U, Rn);
          }), kt && V(U, Nt), ft;
        }
        function yl(U, H, G, P) {
          if (G == null) throw Error(s(151));
          for (var ft = null, Dt = null, mt = H, Nt = H = 0, It = null, Tt = G.next(); mt !== null && !Tt.done; Nt++, Tt = G.next()) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var Rn = at(U, mt, Tt.value, P);
            if (Rn === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && Rn.alternate === null && e(U, mt), H = u(Rn, H, Nt), Dt === null ? ft = Rn : Dt.sibling = Rn, Dt = Rn, mt = It;
          }
          if (Tt.done)
            return a(U, mt), kt && V(U, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = G.next())
              Tt = I(U, Tt.value, P), Tt !== null && (H = u(
                Tt,
                H,
                Nt
              ), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
            return kt && V(U, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = G.next())
            Tt = gt(
              mt,
              U,
              Nt,
              Tt.value,
              P
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), H = u(Tt, H, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
          return t && mt.forEach(function(p0) {
            return e(U, p0);
          }), kt && V(U, Nt), ft;
        }
        function ia(U, H, G, P) {
          if (typeof G == "object" && G !== null && G.type === xa && G.key === null && (G = G.props.children), typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case sr:
                t: {
                  for (var ft = G.key; H !== null; ) {
                    if (H.key === ft) {
                      if (ft = G.type, ft === xa) {
                        if (H.tag === 7) {
                          a(
                            U,
                            H.sibling
                          ), P = c(
                            H,
                            G.props.children
                          ), P.return = U, U = P;
                          break t;
                        }
                      } else if (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Kn(ft) === H.type) {
                        a(
                          U,
                          H.sibling
                        ), P = c(H, G.props), Xa(P, G), P.return = U, U = P;
                        break t;
                      }
                      a(U, H);
                      break;
                    } else e(U, H);
                    H = H.sibling;
                  }
                  G.type === xa ? (P = Fn(
                    G.props.children,
                    U.mode,
                    P,
                    G.key
                  ), P.return = U, U = P) : (P = or(
                    G.type,
                    G.key,
                    G.props,
                    null,
                    U.mode,
                    P
                  ), Xa(P, G), P.return = U, U = P);
                }
                return g(U);
              case ya:
                t: {
                  for (ft = G.key; H !== null; ) {
                    if (H.key === ft)
                      if (H.tag === 4 && H.stateNode.containerInfo === G.containerInfo && H.stateNode.implementation === G.implementation) {
                        a(
                          U,
                          H.sibling
                        ), P = c(
                          H,
                          G.children || []
                        ), P.return = U, U = P;
                        break t;
                      } else {
                        a(U, H);
                        break;
                      }
                    else e(U, H);
                    H = H.sibling;
                  }
                  P = ho(G, U.mode, P), P.return = U, U = P;
                }
                return g(U);
              case En:
                return G = Kn(G), ia(
                  U,
                  H,
                  G,
                  P
                );
            }
            if (cr(G))
              return le(
                U,
                H,
                G,
                P
              );
            if (_(G)) {
              if (ft = _(G), typeof ft != "function")
                throw Error(s(150));
              return G = ft.call(G), yl(
                U,
                H,
                G,
                P
              );
            }
            if (typeof G.then == "function")
              return ia(
                U,
                H,
                Ul(G),
                P
              );
            if (G.$$typeof === Sn)
              return ia(
                U,
                H,
                Rl(U, G),
                P
              );
            ql(U, G);
          }
          return typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint" ? (G = "" + G, H !== null && H.tag === 6 ? (a(U, H.sibling), P = c(H, G), P.return = U, U = P) : (a(U, H), P = po(G, U.mode, P), P.return = U, U = P), g(U)) : a(U, H);
        }
        return function(U, H, G, P) {
          try {
            fl = 0;
            var ft = ia(
              U,
              H,
              G,
              P
            );
            return Aa = null, ft;
          } catch (mt) {
            if (mt === Ma || mt === xr) throw mt;
            var Dt = i(29, mt, null, U.mode);
            return Dt.lanes = P, Dt.return = U, Dt;
          } finally {
          }
        };
      }
      function Yl() {
        for (var t = ja, e = qo = ja = 0; e < t; ) {
          var a = je[e];
          je[e++] = null;
          var r = je[e];
          je[e++] = null;
          var c = je[e];
          je[e++] = null;
          var u = je[e];
          if (je[e++] = null, r !== null && c !== null) {
            var g = r.pending;
            g === null ? c.next = c : (c.next = g.next, g.next = c), r.pending = c;
          }
          u !== 0 && ic(a, c, u);
        }
      }
      function Gl(t, e, a, r) {
        je[ja++] = t, je[ja++] = e, je[ja++] = a, je[ja++] = r, qo |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function yi(t, e, a, r) {
        return Gl(t, e, a, r), Ll(t);
      }
      function Xn(t, e) {
        return Gl(t, null, null, e), Ll(t);
      }
      function ic(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - we(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
      }
      function Ll(t) {
        if (50 < vl)
          throw vl = 0, $o = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function xi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function wi(t, e) {
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
      function yn(t, e, a) {
        var r = t.updateQueue;
        if (r === null) return null;
        if (r = r.shared, (xt & 2) !== 0) {
          var c = r.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Ll(t), ic(t, null, a), e;
        }
        return Gl(t, r, e, a), Ll(t);
      }
      function Za(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, x(t, a);
        }
      }
      function _i(t, e) {
        var a = t.updateQueue, r = t.alternate;
        if (r !== null && (r = r.updateQueue, a === r)) {
          var c = null, u = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var g = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              u === null ? c = u = g : u = u.next = g, a = a.next;
            } while (a !== null);
            u === null ? c = u = e : u = u.next = e;
          } else c = u = e;
          a = {
            baseState: r.baseState,
            firstBaseUpdate: c,
            lastBaseUpdate: u,
            shared: r.shared,
            callbacks: r.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Ja() {
        if (Yo) {
          var t = Ca;
          if (t !== null) throw t;
        }
      }
      function Wa(t, e, a, r) {
        Yo = !1;
        var c = t.updateQueue;
        Cn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, A = c.shared.pending;
        if (A !== null) {
          c.shared.pending = null;
          var L = A, F = L.next;
          L.next = null, g === null ? u = F : g.next = F, g = L;
          var tt = t.alternate;
          tt !== null && (tt = tt.updateQueue, A = tt.lastBaseUpdate, A !== g && (A === null ? tt.firstBaseUpdate = F : A.next = F, tt.lastBaseUpdate = L));
        }
        if (u !== null) {
          var I = c.baseState;
          g = 0, tt = F = L = null, A = u;
          do {
            var at = A.lane & -536870913, gt = at !== A.lane;
            if (gt ? (_t & at) === at : (r & at) === at) {
              at !== 0 && at === Ta && (Yo = !0), tt !== null && (tt = tt.next = {
                lane: 0,
                tag: A.tag,
                payload: A.payload,
                callback: null,
                next: null
              });
              t: {
                var le = t, yl = A;
                at = e;
                var ia = a;
                switch (yl.tag) {
                  case 1:
                    if (le = yl.payload, typeof le == "function") {
                      I = le.call(
                        ia,
                        I,
                        at
                      );
                      break t;
                    }
                    I = le;
                    break t;
                  case 3:
                    le.flags = le.flags & -65537 | 128;
                  case 0:
                    if (le = yl.payload, at = typeof le == "function" ? le.call(ia, I, at) : le, at == null) break t;
                    I = bo({}, I, at);
                    break t;
                  case 2:
                    Cn = !0;
                }
              }
              at = A.callback, at !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [at] : gt.push(at));
            } else
              gt = {
                lane: at,
                tag: A.tag,
                payload: A.payload,
                callback: A.callback,
                next: null
              }, tt === null ? (F = tt = gt, L = I) : tt = tt.next = gt, g |= at;
            if (A = A.next, A === null) {
              if (A = c.shared.pending, A === null)
                break;
              gt = A, A = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          tt === null && (L = I), c.baseState = L, c.firstBaseUpdate = F, c.lastBaseUpdate = tt, u === null && (c.shared.lanes = 0), An |= g, t.lanes = g, t.memoizedState = I;
        }
      }
      function oc(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function sc(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            oc(a[t], e);
      }
      function cc(t, e) {
        t = dn, N(_r, t), N(Oa, e), dn = t | e.baseLanes;
      }
      function ki() {
        N(_r, dn), N(Oa, Oa.current);
      }
      function Si() {
        dn = _r.current, S(Oa), S(_r);
      }
      function xn(t) {
        var e = t.alternate;
        N(qt, qt.current & 1), N(Se, t), Oe === null && (e === null || Oa.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function Ei(t) {
        N(qt, qt.current), N(Se, t), Oe === null && (Oe = t);
      }
      function uc(t) {
        t.tag === 22 ? (N(qt, qt.current), N(Se, t), Oe === null && (Oe = t)) : wn();
      }
      function wn() {
        N(qt, qt.current), N(Se, Se.current);
      }
      function ve(t) {
        S(Se), Oe === t && (Oe = null), S(qt);
      }
      function Ql(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || zo(a) || No(a)))
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
      function zi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ke(t[a], e[a])) return !1;
        return !0;
      }
      function Ni(t, e, a, r, c, u) {
        return cn = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? Bd : Go, la = !1, u = a(r, c), la = !1, Ra && (u = fc(
          e,
          a,
          r,
          c
        )), dc(t), u;
      }
      function dc(t) {
        dt.H = pl;
        var e = Mt !== null && Mt.next !== null;
        if (cn = 0, Yt = Mt = bt = null, kr = !1, ml = 0, Da = null, e) throw Error(s(300));
        t === null || Gt || (t = t.dependencies, t !== null && Ol(t) && (Gt = !0));
      }
      function fc(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Ra && (Da = null), ml = 0, Ra = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          dt.H = Ud, u = e(a, r);
        } while (Ra);
        return u;
      }
      function Pm() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Fa(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function Ti() {
        var t = Sr !== 0;
        return Sr = 0, t;
      }
      function Ci(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Mi(t) {
        if (kr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          kr = !1;
        }
        cn = 0, Yt = Mt = bt = null, Ra = !1, ml = Sr = 0, Da = null;
      }
      function fe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Yt === null ? bt.memoizedState = Yt = t : Yt = Yt.next = t, Yt;
      }
      function Ut() {
        if (Mt === null) {
          var t = bt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Mt.next;
        var e = Yt === null ? bt.memoizedState : Yt.next;
        if (e !== null)
          Yt = e, Mt = t;
        else {
          if (t === null)
            throw bt.alternate === null ? Error(s(467)) : Error(s(310));
          Mt = t, t = {
            memoizedState: Mt.memoizedState,
            baseState: Mt.baseState,
            baseQueue: Mt.baseQueue,
            queue: Mt.queue,
            next: null
          }, Yt === null ? bt.memoizedState = Yt = t : Yt = Yt.next = t;
        }
        return Yt;
      }
      function Vl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Fa(t) {
        var e = ml;
        return ml += 1, Da === null && (Da = []), t = nc(Da, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? Bd : Go), t;
      }
      function Kl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Fa(t);
          if (t.$$typeof === Sn) return te(t);
        }
        throw Error(s(438, String(t)));
      }
      function Ai(t) {
        var e = null, a = bt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var r = bt.alternate;
          r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (e = {
            data: r.data.map(function(c) {
              return c.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Vl(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), r = 0; r < t; r++)
            a[r] = Sp;
        return e.index++, a;
      }
      function tn(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Xl(t) {
        var e = Ut();
        return ji(e, Mt, t);
      }
      function ji(t, e, a) {
        var r = t.queue;
        if (r === null) throw Error(s(311));
        r.lastRenderedReducer = a;
        var c = t.baseQueue, u = r.pending;
        if (u !== null) {
          if (c !== null) {
            var g = c.next;
            c.next = u.next, u.next = g;
          }
          e.baseQueue = c = u, r.pending = null;
        }
        if (u = t.baseState, c === null) t.memoizedState = u;
        else {
          e = c.next;
          var A = g = null, L = null, F = e, tt = !1;
          do {
            var I = F.lane & -536870913;
            if (I !== F.lane ? (_t & I) === I : (cn & I) === I) {
              var at = F.revertLane;
              if (at === 0)
                L !== null && (L = L.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: F.action,
                  hasEagerState: F.hasEagerState,
                  eagerState: F.eagerState,
                  next: null
                }), I === Ta && (tt = !0);
              else if ((cn & at) === at) {
                F = F.next, at === Ta && (tt = !0);
                continue;
              } else
                I = {
                  lane: 0,
                  revertLane: F.revertLane,
                  gesture: null,
                  action: F.action,
                  hasEagerState: F.hasEagerState,
                  eagerState: F.eagerState,
                  next: null
                }, L === null ? (A = L = I, g = u) : L = L.next = I, bt.lanes |= at, An |= at;
              I = F.action, la && a(u, I), u = F.hasEagerState ? F.eagerState : a(u, I);
            } else
              at = {
                lane: I,
                revertLane: F.revertLane,
                gesture: F.gesture,
                action: F.action,
                hasEagerState: F.hasEagerState,
                eagerState: F.eagerState,
                next: null
              }, L === null ? (A = L = at, g = u) : L = L.next = at, bt.lanes |= I, An |= I;
            F = F.next;
          } while (F !== null && F !== e);
          if (L === null ? g = u : L.next = A, !ke(u, t.memoizedState) && (Gt = !0, tt && (a = Ca, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = g, t.baseQueue = L, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function Oi(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var r = a.dispatch, c = a.pending, u = e.memoizedState;
        if (c !== null) {
          a.pending = null;
          var g = c = c.next;
          do
            u = t(u, g.action), g = g.next;
          while (g !== c);
          ke(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, r];
      }
      function mc(t, e, a) {
        var r = bt, c = Ut(), u = kt;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var g = !ke(
          (Mt || c).memoizedState,
          a
        );
        if (g && (c.memoizedState = a, Gt = !0), c = c.queue, Hi(gc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            hc.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          u || (cn & 127) !== 0 || pc(r, e, a);
        }
        return a;
      }
      function pc(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = Vl(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function hc(t, e, a, r) {
        e.value = a, e.getSnapshot = r, bc(e) && vc(t);
      }
      function gc(t, e, a) {
        return a(function() {
          bc(e) && vc(t);
        });
      }
      function bc(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ke(t, a);
        } catch {
          return !0;
        }
      }
      function vc(t) {
        var e = Xn(t, 2);
        e !== null && pe(e, t, 2);
      }
      function Ri(t) {
        var e = fe();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), la) {
            R(!0);
            try {
              a();
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
      function yc(t, e, a, r) {
        return t.baseState = a, ji(
          t,
          Mt,
          typeof r == "function" ? r : tn
        );
      }
      function tp(t, e, a, r, c) {
        if (Wl(t)) throw Error(s(485));
        if (t = e.action, t !== null) {
          var u = {
            payload: c,
            action: t,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(g) {
              u.listeners.push(g);
            }
          };
          dt.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, xc(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function xc(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = dt.T, g = {};
          dt.T = g;
          try {
            var A = a(c, r), L = dt.S;
            L !== null && L(g, A), wc(t, e, A);
          } catch (F) {
            Di(t, e, F);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), dt.T = u;
          }
        } else
          try {
            u = a(c, r), wc(t, e, u);
          } catch (F) {
            Di(t, e, F);
          }
      }
      function wc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            _c(t, e, r);
          },
          function(r) {
            return Di(t, e, r);
          }
        ) : _c(t, e, a);
      }
      function _c(t, e, a) {
        e.status = "fulfilled", e.value = a, kc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, xc(t, a)));
      }
      function Di(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, kc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function kc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Sc(t, e) {
        return e;
      }
      function Ec(t, e) {
        if (kt) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (kt) {
                if (Ot) {
                  var c = bh(
                    Ot,
                    Ae
                  );
                  if (c) {
                    Ot = yd(c), r = vh(c);
                    break t;
                  }
                }
                ht(r);
              }
              r = !1;
            }
            r && (e = a[0]);
          }
        }
        a = fe(), a.memoizedState = a.baseState = e, r = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Sc,
          lastRenderedState: e
        }, a.queue = r, a = Qc.bind(
          null,
          bt,
          r
        ), r.dispatch = a, r = Ri(!1);
        var u = Yi.bind(
          null,
          bt,
          !1,
          r.queue
        );
        return r = fe(), c = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, r.queue = c, a = tp.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function zc(t) {
        var e = Ut();
        return Nc(e, Mt, t);
      }
      function Nc(t, e, a) {
        if (e = ji(
          t,
          e,
          Sc
        )[0], t = Xl(tn)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Fa(e);
          } catch (g) {
            throw g === Ma ? xr : g;
          }
        else r = e;
        e = Ut();
        var c = e.queue, u = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, ha(
          9,
          { destroy: void 0 },
          ep.bind(null, c, a),
          null
        )), [r, u, t];
      }
      function ep(t, e) {
        t.action = e;
      }
      function Tc(t) {
        var e = Ut(), a = Mt;
        if (a !== null)
          return Nc(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function ha(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Vl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function Cc() {
        return Ut().memoizedState;
      }
      function Zl(t, e, a, r) {
        var c = fe();
        bt.flags |= t, c.memoizedState = ha(
          1 | e,
          { destroy: void 0 },
          a,
          r === void 0 ? null : r
        );
      }
      function Jl(t, e, a, r) {
        var c = Ut();
        r = r === void 0 ? null : r;
        var u = c.memoizedState.inst;
        Mt !== null && r !== null && zi(r, Mt.memoizedState.deps) ? c.memoizedState = ha(e, u, a, r) : (bt.flags |= t, c.memoizedState = ha(
          1 | e,
          u,
          a,
          r
        ));
      }
      function Mc(t, e) {
        Zl(8390656, 8, t, e);
      }
      function Hi(t, e) {
        Jl(2048, 8, t, e);
      }
      function np(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Vl(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Ac(t) {
        var e = Ut().memoizedState;
        return np({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function jc(t, e) {
        return Jl(4, 2, t, e);
      }
      function Oc(t, e) {
        return Jl(4, 4, t, e);
      }
      function Rc(t, e) {
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
      function Dc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Jl(
          4,
          4,
          Rc.bind(null, e, t),
          a
        );
      }
      function Bi() {
      }
      function Hc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && zi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function Bc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && zi(e, r[1]))
          return r[0];
        if (r = t(), la) {
          R(!0);
          try {
            t();
          } finally {
            R(!1);
          }
        }
        return a.memoizedState = [r, e], r;
      }
      function Ui(t, e, a) {
        return a === void 0 || (cn & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Ou(), bt.lanes |= t, An |= t, a);
      }
      function Uc(t, e, a, r) {
        return ke(a, e) ? a : Oa.current !== null ? (t = Ui(t, a, r), ke(t, e) || (Gt = !0), t) : (cn & 42) === 0 || (cn & 1073741824) !== 0 && (_t & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = Ou(), bt.lanes |= t, An |= t, e);
      }
      function qc(t, e, a, r, c) {
        var u = on();
        Ft(
          u !== 0 && 8 > u ? u : 8
        );
        var g = dt.T, A = {};
        dt.T = A, Yi(t, !1, e, a);
        try {
          var L = c(), F = dt.S;
          if (F !== null && F(A, L), L !== null && typeof L == "object" && typeof L.then == "function") {
            var tt = Im(
              L,
              r
            );
            $a(
              t,
              e,
              tt,
              ye(t)
            );
          } else
            $a(
              t,
              e,
              r,
              ye(t)
            );
        } catch (I) {
          $a(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: I },
            ye()
          );
        } finally {
          Ft(u), g !== null && A.types !== null && (g.types = A.types), dt.T = g;
        }
      }
      function Yc(t) {
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
        var a = {};
        return e.next = {
          memoizedState: a,
          baseState: a,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: tn,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function qi() {
        return te(In);
      }
      function Gc() {
        return Ut().memoizedState;
      }
      function Lc() {
        return Ut().memoizedState;
      }
      function ap(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ye();
              t = vn(a);
              var r = yn(e, t, a);
              r !== null && (pe(r, e, a), Za(r, e, a)), e = { cache: gi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function lp(t, e, a) {
        var r = ye();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Wl(t) ? Vc(e, a) : (a = yi(t, e, a, r), a !== null && (pe(a, t, r), Kc(a, e, r)));
      }
      function Qc(t, e, a) {
        var r = ye();
        $a(t, e, a, r);
      }
      function $a(t, e, a, r) {
        var c = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Wl(t)) Vc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, A = u(g, a);
              if (c.hasEagerState = !0, c.eagerState = A, ke(A, g))
                return Gl(t, e, c, 0), At === null && Yl(), !1;
            } catch {
            } finally {
            }
          if (a = yi(t, e, c, r), a !== null)
            return pe(a, t, r), Kc(a, e, r), !0;
        }
        return !1;
      }
      function Yi(t, e, a, r) {
        if (r = {
          lane: 2,
          revertLane: bi(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Wl(t)) {
          if (e) throw Error(s(479));
        } else
          e = yi(
            t,
            a,
            r,
            2
          ), e !== null && pe(e, t, 2);
      }
      function Wl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Vc(t, e) {
        Ra = kr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Kc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, x(t, a);
        }
      }
      function Gi(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : bo({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Xc(t, e, a, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !Bl(a, r) || !Bl(c, u) : !0;
      }
      function Zc(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Lo.enqueueReplaceState(e, e.state, null);
      }
      function Zn(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var r in e)
            r !== "ref" && (a[r] = e[r]);
        }
        if (t = t.defaultProps) {
          a === e && (a = bo({}, a));
          for (var c in t)
            a[c] === void 0 && (a[c] = t[c]);
        }
        return a;
      }
      function Fl(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Jc(t, e, a) {
        try {
          var r = t.onCaughtError;
          r(a.value, {
            componentStack: a.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      function Li(t, e, a) {
        return a = vn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Fl(t, e);
        }, a;
      }
      function Wc(t) {
        return t = vn(t), t.tag = 3, t;
      }
      function Fc(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Jc(e, a, r);
          };
        }
        var g = a.stateNode;
        g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
          Jc(e, a, r), typeof c != "function" && (jn === null ? jn = /* @__PURE__ */ new Set([this]) : jn.add(this));
          var A = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: A !== null ? A : ""
          });
        });
      }
      function rp(t, e, a, r, c) {
        if (a.flags |= 32768, r !== null && typeof r == "object" && typeof r.then == "function") {
          if (e = a.alternate, e !== null && ma(
            e,
            a,
            c,
            !0
          ), a = Se.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Oe === null ? rr() : a.alternate === null && Bt === 0 && (Bt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === wr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), fo(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === wr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), fo(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return fo(t, r, c), rr(), !1;
        }
        if (kt)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== Ro && (t = Error(s(422), { cause: r }), Va(
            Q(t, a)
          ))) : (r !== Ro && (e = Error(s(423), {
            cause: r
          }), Va(
            Q(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = Q(r, a), c = Li(
            t.stateNode,
            r,
            c
          ), _i(t, c), Bt !== 4 && (Bt = 2)), !1;
        var u = Error(s(520), { cause: r });
        if (u = Q(u, a), gl === null ? gl = [u] : gl.push(u), Bt !== 4 && (Bt = 2), e === null) return !0;
        r = Q(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Li(a.stateNode, r, t), _i(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (jn === null || !jn.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Wc(c), Fc(
                  c,
                  t,
                  a,
                  r
                ), _i(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function ee(t, e, a, r) {
        e.child = t === null ? Hd(e, null, a, r) : aa(
          e,
          t.child,
          a,
          r
        );
      }
      function $c(t, e, a, r, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in r) {
          var g = {};
          for (var A in r)
            A !== "ref" && (g[A] = r[A]);
        } else g = r;
        return Vn(e), r = Ni(
          t,
          e,
          a,
          g,
          u,
          c
        ), A = Ti(), t !== null && !Gt ? (Ci(t, e, c), en(t, e, c)) : (kt && A && X(e), e.flags |= 1, ee(t, e, r, c), e.child);
      }
      function Ic(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !mo(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Pc(
            t,
            e,
            u,
            r,
            c
          )) : (t = or(
            a.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !Wi(t, c)) {
          var g = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : Bl, a(g, r) && t.ref === e.ref)
            return en(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = ln(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Pc(t, e, a, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (Bl(u, r) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = r = u, Wi(t, c))
              (t.flags & 131072) !== 0 && (Gt = !0);
            else
              return e.lanes = t.lanes, en(t, e, c);
        }
        return Qi(
          t,
          e,
          a,
          r,
          c
        );
      }
      function tu(t, e, a, r) {
        var c = r.children, u = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), r.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (u = u !== null ? u.baseLanes | a : a, t !== null) {
              for (r = e.child = t.child, c = 0; r !== null; )
                c = c | r.lanes | r.childLanes, r = r.sibling;
              r = c & ~u;
            } else r = 0, e.child = null;
            return eu(
              t,
              e,
              u,
              a,
              r
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Hl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? cc(e, u) : ki(), uc(e);
          else
            return r = e.lanes = 536870912, eu(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (Hl(e, u.cachePool), cc(e, u), wn(), e.memoizedState = null) : (t !== null && Hl(e, null), ki(), wn());
        return ee(t, e, c, a), e.child;
      }
      function Ia(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function eu(t, e, a, r, c) {
        var u = vi();
        return u = u === null ? null : {
          parent: rn ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && Hl(e, null), ki(), uc(e), t !== null && ma(t, e, r, !0), e.childLanes = c, null;
      }
      function $l(t, e) {
        return e = Pl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function nu(t, e, a) {
        return aa(e, t.child, null, a), t = $l(
          e,
          e.pendingProps
        ), t.flags |= 2, ve(e), e.memoizedState = null, t;
      }
      function ip(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (kt) {
            if (r.mode === "hidden")
              return t = $l(e, r), e.lanes = 536870912, Ia(null, t);
            if (Ei(e), (t = Ot) ? (t = Nh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Pu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return $l(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (Ei(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = nu(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Gt || ma(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Gt || c) {
            if (r = At, r !== null && (g = k(r, a), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Xn(t, g), pe(r, t, g), Qo;
            rr(), e = nu(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ce && (Ot = _h(g), ae = e, kt = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = $l(e, r), e.flags |= 4096;
          return e;
        }
        return t = ln(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Il(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Qi(t, e, a, r, c) {
        return Vn(e), a = Ni(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = Ti(), t !== null && !Gt ? (Ci(t, e, c), en(t, e, c)) : (kt && r && X(e), e.flags |= 1, ee(t, e, a, c), e.child);
      }
      function au(t, e, a, r, c, u) {
        return Vn(e), e.updateQueue = null, a = fc(
          e,
          r,
          a,
          c
        ), dc(t), r = Ti(), t !== null && !Gt ? (Ci(t, e, u), en(t, e, u)) : (kt && r && X(e), e.flags |= 1, ee(t, e, a, u), e.child);
      }
      function lu(t, e, a, r, c) {
        if (Vn(e), e.stateNode === null) {
          var u = Sa, g = a.contextType;
          typeof g == "object" && g !== null && (u = te(g)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Lo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, xi(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? te(g) : Sa, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (Gi(
            e,
            a,
            g,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Lo.enqueueReplaceState(
            u,
            u.state,
            null
          ), Wa(e, r, u, c), Ja(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var A = e.memoizedProps, L = Zn(a, A);
          u.props = L;
          var F = u.context, tt = a.contextType;
          g = Sa, typeof tt == "object" && tt !== null && (g = te(tt));
          var I = a.getDerivedStateFromProps;
          tt = typeof I == "function" || typeof u.getSnapshotBeforeUpdate == "function", A = e.pendingProps !== A, tt || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (A || F !== g) && Zc(
            e,
            u,
            r,
            g
          ), Cn = !1;
          var at = e.memoizedState;
          u.state = at, Wa(e, r, u, c), Ja(), F = e.memoizedState, A || at !== F || Cn ? (typeof I == "function" && (Gi(
            e,
            a,
            I,
            r
          ), F = e.memoizedState), (L = Cn || Xc(
            e,
            a,
            L,
            r,
            at,
            F,
            g
          )) ? (tt || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = F), u.props = r, u.state = F, u.context = g, r = L) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, wi(t, e), g = e.memoizedProps, tt = Zn(a, g), u.props = tt, I = e.pendingProps, at = u.context, F = a.contextType, L = Sa, typeof F == "object" && F !== null && (L = te(F)), A = a.getDerivedStateFromProps, (F = typeof A == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== I || at !== L) && Zc(
            e,
            u,
            r,
            L
          ), Cn = !1, at = e.memoizedState, u.state = at, Wa(e, r, u, c), Ja();
          var gt = e.memoizedState;
          g !== I || at !== gt || Cn || t !== null && t.dependencies !== null && Ol(t.dependencies) ? (typeof A == "function" && (Gi(
            e,
            a,
            A,
            r
          ), gt = e.memoizedState), (tt = Cn || Xc(
            e,
            a,
            tt,
            r,
            at,
            gt,
            L
          ) || t !== null && t.dependencies !== null && Ol(t.dependencies)) ? (F || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, L), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            L
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = L, r = tt) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && at === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Il(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = aa(
          e,
          t.child,
          null,
          c
        ), e.child = aa(
          e,
          null,
          a,
          c
        )) : ee(t, e, a, c), e.memoizedState = u.state, t = e.child) : t = en(
          t,
          e,
          c
        ), t;
      }
      function ru(t, e, a, r) {
        return He(), e.flags |= 256, ee(t, e, a, r), e.child;
      }
      function Vi(t) {
        return { baseLanes: t, cachePool: tc() };
      }
      function Ki(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= ze), t;
      }
      function iu(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (kt) {
            if (c ? xn(e) : wn(), (t = Ot) ? (t = Th(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Pu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return No(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var A = r.children;
          return r = r.fallback, c ? (wn(), c = e.mode, A = Pl(
            { mode: "hidden", children: A },
            c
          ), r = Fn(
            r,
            c,
            a,
            null
          ), A.return = e, r.return = e, A.sibling = r, e.child = A, r = e.child, r.memoizedState = Vi(a), r.childLanes = Ki(
            t,
            g,
            a
          ), e.memoizedState = Vo, Ia(null, r)) : (xn(e), Xi(e, A));
        }
        var L = t.memoizedState;
        if (L !== null && (A = L.dehydrated, A !== null)) {
          if (u)
            e.flags & 256 ? (xn(e), e.flags &= -257, e = Zi(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (wn(), e.child = t.child, e.flags |= 128, e = null) : (wn(), A = r.fallback, c = e.mode, r = Pl(
              { mode: "visible", children: r.children },
              c
            ), A = Fn(
              A,
              c,
              a,
              null
            ), A.flags |= 2, r.return = e, A.return = e, r.sibling = A, e.child = r, aa(
              e,
              t.child,
              null,
              a
            ), r = e.child, r.memoizedState = Vi(a), r.childLanes = Ki(
              t,
              g,
              a
            ), e.memoizedState = Vo, e = Ia(null, r));
          else if (xn(e), No(A))
            g = hh(A).digest, r = Error(s(419)), r.stack = "", r.digest = g, Va({ value: r, source: null, stack: null }), e = Zi(
              t,
              e,
              a
            );
          else if (Gt || ma(
            t,
            e,
            a,
            !1
          ), g = (a & t.childLanes) !== 0, Gt || g) {
            if (g = At, g !== null && (r = k(
              g,
              a
            ), r !== 0 && r !== L.retryLane))
              throw L.retryLane = r, Xn(t, r), pe(g, t, r), Qo;
            zo(A) || rr(), e = Zi(
              t,
              e,
              a
            );
          } else
            zo(A) ? (e.flags |= 192, e.child = t.child, e = null) : (t = L.treeContext, ce && (Ot = kh(
              A
            ), ae = e, kt = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = Xi(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (wn(), A = r.fallback, c = e.mode, L = t.child, u = L.sibling, r = ln(L, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = L.subtreeFlags & 65011712, u !== null ? A = ln(
          u,
          A
        ) : (A = Fn(
          A,
          c,
          a,
          null
        ), A.flags |= 2), A.return = e, r.return = e, r.sibling = A, e.child = r, Ia(null, r), r = e.child, A = t.child.memoizedState, A === null ? A = Vi(a) : (c = A.cachePool, c !== null ? (L = rn ? Rt._currentValue : Rt._currentValue2, c = c.parent !== L ? { parent: L, pool: L } : c) : c = tc(), A = {
          baseLanes: A.baseLanes | a,
          cachePool: c
        }), r.memoizedState = A, r.childLanes = Ki(
          t,
          g,
          a
        ), e.memoizedState = Vo, Ia(t.child, r)) : (xn(e), a = t.child, t = a.sibling, a = ln(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Xi(t, e) {
        return e = Pl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Pl(t, e) {
        return t = i(22, t, null, e), t.lanes = 0, t;
      }
      function Zi(t, e, a) {
        return aa(e, t.child, null, a), t = Xi(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function ou(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), pi(t.return, e, a);
      }
      function Ji(t, e, a, r, c, u) {
        var g = t.memoizedState;
        g === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: r,
          tail: a,
          tailMode: c,
          treeForkCount: u
        } : (g.isBackwards = e, g.rendering = null, g.renderingStartTime = 0, g.last = r, g.tail = a, g.tailMode = c, g.treeForkCount = u);
      }
      function su(t, e, a) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var g = qt.current, A = (g & 2) !== 0;
        if (A ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, N(qt, g), ee(t, e, r, a), r = kt ? cl : 0, !A && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && ou(t, a, e);
            else if (t.tag === 19)
              ou(t, a, e);
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
            for (a = e.child, c = null; a !== null; )
              t = a.alternate, t !== null && Ql(t) === null && (c = a), a = a.sibling;
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), Ji(
              e,
              !1,
              c,
              a,
              u,
              r
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, c = e.child, e.child = null; c !== null; ) {
              if (t = c.alternate, t !== null && Ql(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = a, a = c, c = t;
            }
            Ji(
              e,
              !0,
              a,
              null,
              u,
              r
            );
            break;
          case "together":
            Ji(
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
      function en(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), An |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (ma(
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
          for (t = e.child, a = ln(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = ln(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function Wi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Ol(t)));
      }
      function op(t, e, a) {
        switch (e.tag) {
          case 3:
            ct(
              e,
              e.stateNode.containerInfo
            ), bn(e, Rt, t.memoizedState.cache), He();
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
              return e.flags |= 128, Ei(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (xn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? iu(
                t,
                e,
                a
              ) : (xn(e), t = en(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            xn(e);
            break;
          case 19:
            var c = (t.flags & 128) !== 0;
            if (r = (a & e.childLanes) !== 0, r || (ma(
              t,
              e,
              a,
              !1
            ), r = (a & e.childLanes) !== 0), c) {
              if (r)
                return su(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), N(qt, qt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, tu(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            bn(e, Rt, t.memoizedState.cache);
        }
        return en(t, e, a);
      }
      function cu(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!Wi(t, a) && (e.flags & 128) === 0)
              return Gt = !1, op(
                t,
                e,
                a
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, kt && (e.flags & 1048576) !== 0 && M(e, cl, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Kn(e.elementType), e.type = t, typeof t == "function")
                mo(t) ? (r = Zn(t, r), e.tag = 1, e = lu(
                  null,
                  e,
                  t,
                  r,
                  a
                )) : (e.tag = 0, e = Qi(
                  null,
                  e,
                  t,
                  r,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === yo) {
                    e.tag = 11, e = $c(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === _o) {
                    e.tag = 14, e = Ic(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  }
                }
                throw e = w(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return Qi(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return r = e.type, c = Zn(
              r,
              e.pendingProps
            ), lu(
              t,
              e,
              r,
              c,
              a
            );
          case 3:
            t: {
              if (ct(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              c = e.memoizedState, r = c.element, wi(t, e), Wa(e, u, null, a);
              var g = e.memoizedState;
              if (u = g.cache, bn(e, Rt, u), u !== c.cache && hi(
                e,
                [Rt],
                a,
                !0
              ), Ja(), u = g.element, ce && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: g.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = ru(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== r) {
                  r = Q(
                    Error(s(424)),
                    e
                  ), Va(r), e = ru(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ce && (Ot = wh(
                    e.stateNode.containerInfo
                  ), ae = e, kt = !0, Tn = null, Ae = !0), a = Hd(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (He(), u === r) {
                  e = en(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                ee(t, e, u, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Ye)
              return Il(t, e), t === null ? (a = _d(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : kt || (e.stateNode = Jh(
                e.type,
                e.pendingProps,
                Nn.current,
                e
              )) : e.memoizedState = _d(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Kt)
              return Et(e), t === null && Kt && kt && (r = e.stateNode = Td(
                e.type,
                e.pendingProps,
                Nn.current,
                ne.current,
                !1
              ), ae = e, Ae = !0, Ot = Sh(
                e.type,
                r,
                Ot
              )), ee(
                t,
                e,
                e.pendingProps.children,
                a
              ), Il(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && kt && (Kh(
              e.type,
              e.pendingProps,
              ne.current
            ), (c = r = Ot) && (r = Eh(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, ae = e, Ot = xh(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, ur(c, u) ? r = null : g !== null && ur(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = Ni(
              t,
              e,
              Pm,
              null,
              null,
              a
            ), rn ? In._currentValue = c : In._currentValue2 = c), Il(t, e), ee(t, e, r, a), e.child;
          case 6:
            return t === null && kt && (Xh(
              e.pendingProps,
              ne.current
            ), (t = a = Ot) && (a = zh(
              a,
              e.pendingProps,
              Ae
            ), a !== null ? (e.stateNode = a, ae = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return iu(t, e, a);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = aa(
              e,
              null,
              r,
              a
            ) : ee(t, e, r, a), e.child;
          case 11:
            return $c(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return ee(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return ee(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return ee(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return r = e.pendingProps, bn(e, e.type, r.value), ee(
              t,
              e,
              r.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Vn(e), c = te(c), r = r(c), e.flags |= 1, ee(t, e, r, a), e.child;
          case 14:
            return Ic(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Pc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return su(
              t,
              e,
              a
            );
          case 31:
            return ip(t, e, a);
          case 22:
            return tu(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Vn(e), r = te(Rt), t === null ? (c = vi(), c === null && (c = At, u = gi(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, xi(e), bn(e, Rt, c)) : ((t.lanes & a) !== 0 && (wi(t, e), Wa(e, null, null, a), Ja()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), bn(e, Rt, r)) : (r = u.cache, bn(e, Rt, r), r !== c.cache && hi(
              e,
              [Rt],
              a,
              !0
            ))), ee(
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
      function Be(t) {
        t.flags |= 4;
      }
      function tr(t) {
        Ke && (t.flags |= 8);
      }
      function uu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Fi(t, e, a, r) {
        if (se)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              So(t, a.stateNode);
            else if (!(a.tag === 4 || Kt && a.tag === 27) && a.child !== null) {
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
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var u = c.stateNode;
              a && r && (u = bd(
                u,
                c.type,
                c.memoizedProps
              )), So(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = vd(
                u,
                c.memoizedProps
              )), So(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Fi(t, c, !0, !0);
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
      function du(t, e, a, r) {
        var c = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var g = u.stateNode;
              a && r && (g = bd(
                g,
                u.type,
                u.memoizedProps
              )), hd(t, g);
            } else if (u.tag === 6)
              g = u.stateNode, a && r && (g = vd(
                g,
                u.memoizedProps
              )), hd(t, g);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), du(t, u, !0, !0), c = !0;
              else if (u.child !== null) {
                u.child.return = u, u = u.child;
                continue;
              }
            }
            if (u === e) break;
            for (; u.sibling === null; ) {
              if (u.return === null || u.return === e)
                return c;
              u = u.return;
            }
            u.sibling.return = u.return, u = u.sibling;
          }
        return c;
      }
      function fu(t, e) {
        if (Ke && uu(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = pd();
          du(r, e, !1, !1), t.pendingChildren = r, Be(e), ph(a, r);
        }
      }
      function $i(t, e, a, r) {
        if (se)
          t.memoizedProps !== r && Be(e);
        else if (Ke) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = uu(t, e)) || u !== r) {
            var g = ne.current;
            u = mh(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (tr(e), cd(
              u,
              a,
              r,
              g
            ) && Be(e), e.stateNode = u, t && Fi(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Ii(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? Yp(e, r) : Gp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || Eo(e, r))
            if (dd(t.stateNode, e, r))
              t.flags |= 8192;
            else if (Uu()) t.flags |= 8192;
            else
              throw na = wr, Uo;
        } else t.flags &= -16777217;
      }
      function mu(t, e) {
        if (Fh(e)) {
          if (t.flags |= 16777216, !Nd(e))
            if (Uu()) t.flags |= 8192;
            else
              throw na = wr, Uo;
        } else t.flags &= -16777217;
      }
      function er(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? J() : 536870912, t.lanes |= e, Ua |= e);
      }
      function Pa(t, e) {
        if (!kt)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var a = null; e !== null; )
                e.alternate !== null && (a = e), e = e.sibling;
              a === null ? t.tail = null : a.sibling = null;
              break;
            case "collapsed":
              a = t.tail;
              for (var r = null; a !== null; )
                a.alternate !== null && (r = a), a = a.sibling;
              r === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : r.sibling = null;
          }
      }
      function jt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, r = 0;
        if (e)
          for (var c = t.child; c !== null; )
            a |= c.lanes | c.childLanes, r |= c.subtreeFlags & 65011712, r |= c.flags & 65011712, c.return = t, c = c.sibling;
        else
          for (c = t.child; c !== null; )
            a |= c.lanes | c.childLanes, r |= c.subtreeFlags, r |= c.flags, c.return = t, c = c.sibling;
        return t.subtreeFlags |= r, t.childLanes = a, e;
      }
      function sp(t, e, a) {
        var r = e.pendingProps;
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
            return jt(e), null;
          case 1:
            return jt(e), null;
          case 3:
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Pe(Rt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (De(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, gn())), fu(t, e), jt(e), null;
          case 26:
            if (Ye) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (Be(e), u !== null ? (jt(e), mu(
                e,
                u
              )) : (jt(e), Ii(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (Be(e), jt(e), mu(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, se ? u !== r && Be(e) : $i(
                t,
                e,
                c,
                r
              ), jt(e), Ii(
                e,
                c,
                u,
                r,
                a
              )), null;
            }
          case 27:
            if (Kt) {
              if (Wt(e), a = Nn.current, c = e.type, t !== null && e.stateNode != null)
                se ? t.memoizedProps !== r && Be(e) : $i(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = ne.current, De(e) ? Ln(e, t) : (t = Td(
                  c,
                  r,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Be(e));
              }
              return jt(e), null;
            }
          case 5:
            if (Wt(e), c = e.type, t !== null && e.stateNode != null)
              $i(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = ne.current, De(e))
                Ln(e, u), qh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = jp(
                  c,
                  r,
                  Nn.current,
                  u,
                  e
                );
                tr(e), Fi(g, e, !1, !1), e.stateNode = g, cd(
                  g,
                  c,
                  r,
                  u
                ) && Be(e);
              }
            }
            return jt(e), Ii(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, se ? a !== r && Be(e) : Ke && (a !== r ? (t = Nn.current, a = ne.current, tr(e), e.stateNode = ud(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = Nn.current, a = ne.current, De(e)) {
                if (!ce) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = ae, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                Mh(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                tr(e), e.stateNode = ud(
                  r,
                  t,
                  a,
                  e
                );
            }
            return jt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (r = De(e), a !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!ce) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  Ah(t, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (ve(e), e) : (ve(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return jt(e), null;
          case 13:
            if (r = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = De(e), r !== null && r.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(s(318));
                  if (!ce) throw Error(s(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(s(317));
                  jh(c, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ve(e), e) : (ve(e), null);
            }
            return ve(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), er(e, e.updateQueue), jt(e), null);
          case 4:
            return ut(), fu(t, e), t === null && Hp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Pe(e.type), jt(e), null;
          case 19:
            if (S(qt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Pa(r, !1);
              else {
                if (Bt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Ql(t), u !== null) {
                      for (e.flags |= 128, Pa(r, !1), t = u.updateQueue, e.updateQueue = t, er(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Iu(a, t), a = a.sibling;
                      return N(
                        qt,
                        qt.current & 1 | 2
                      ), kt && V(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && he() > bl && (e.flags |= 128, c = !0, Pa(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Ql(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, er(e, t), Pa(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !kt)
                    return jt(e), null;
                } else
                  2 * he() - r.renderingStartTime > bl && a !== 536870912 && (e.flags |= 128, c = !0, Pa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = he(), t.sibling = null, a = qt.current, N(
              qt,
              c ? a & 1 | 2 : a & 1
            ), kt && V(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return ve(e), Si(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && er(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && S(ea), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Pe(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function cp(t, e) {
        switch (nt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Pe(Rt), ut(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Wt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (ve(e), e.alternate === null)
                throw Error(s(340));
              He();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (ve(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              He();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return S(qt), null;
          case 4:
            return ut(), null;
          case 10:
            return Pe(e.type), null;
          case 22:
          case 23:
            return ve(e), Si(), t !== null && S(ea), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Pe(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function pu(t, e) {
        switch (nt(e), e.tag) {
          case 3:
            Pe(Rt), ut();
            break;
          case 26:
          case 27:
          case 5:
            Wt(e);
            break;
          case 4:
            ut();
            break;
          case 31:
            e.memoizedState !== null && ve(e);
            break;
          case 13:
            ve(e);
            break;
          case 19:
            S(qt);
            break;
          case 10:
            Pe(e.type);
            break;
          case 22:
          case 23:
            ve(e), Si(), t !== null && S(ea);
            break;
          case 24:
            Pe(Rt);
        }
      }
      function tl(t, e) {
        try {
          var a = e.updateQueue, r = a !== null ? a.lastEffect : null;
          if (r !== null) {
            var c = r.next;
            a = c;
            do {
              if ((a.tag & t) === t) {
                r = void 0;
                var u = a.create, g = a.inst;
                r = u(), g.destroy = r;
              }
              a = a.next;
            } while (a !== c);
          }
        } catch (A) {
          zt(e, e.return, A);
        }
      }
      function _n(t, e, a) {
        try {
          var r = e.updateQueue, c = r !== null ? r.lastEffect : null;
          if (c !== null) {
            var u = c.next;
            r = u;
            do {
              if ((r.tag & t) === t) {
                var g = r.inst, A = g.destroy;
                if (A !== void 0) {
                  g.destroy = void 0, c = e;
                  var L = a, F = A;
                  try {
                    F();
                  } catch (tt) {
                    zt(
                      c,
                      L,
                      tt
                    );
                  }
                }
              }
              r = r.next;
            } while (r !== u);
          }
        } catch (tt) {
          zt(e, e.return, tt);
        }
      }
      function hu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            sc(e, a);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function gu(t, e, a) {
        a.props = Zn(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (r) {
          zt(t, e, r);
        }
      }
      function el(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var r = rl(t.stateNode);
                break;
              case 30:
                r = t.stateNode;
                break;
              default:
                r = t.stateNode;
            }
            typeof a == "function" ? t.refCleanup = a(r) : a.current = r;
          }
        } catch (c) {
          zt(t, e, c);
        }
      }
      function Ve(t, e) {
        var a = t.ref, r = t.refCleanup;
        if (a !== null)
          if (typeof r == "function")
            try {
              r();
            } catch (c) {
              zt(t, e, c);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (c) {
              zt(t, e, c);
            }
          else a.current = null;
      }
      function bu(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          nh(r, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function Pi(t, e, a) {
        try {
          ah(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function vu(t) {
        return t.tag === 5 || t.tag === 3 || (Ye ? t.tag === 26 : !1) || (Kt ? t.tag === 27 && _a(t.type) : !1) || t.tag === 4;
      }
      function to(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || vu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Kt && t.tag === 27 && _a(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function eo(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? rh(a, t, e) : th(a, t);
        else if (r !== 4 && (Kt && r === 27 && _a(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (eo(t, e, a), t = t.sibling; t !== null; )
            eo(t, e, a), t = t.sibling;
      }
      function nr(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? lh(a, t, e) : Pp(a, t);
        else if (r !== 4 && (Kt && r === 27 && _a(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (nr(t, e, a), t = t.sibling; t !== null; )
            nr(t, e, a), t = t.sibling;
      }
      function yu(t, e, a) {
        t = t.containerInfo;
        try {
          gd(t, a);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function xu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Ih(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function up(t, e) {
        for (Mp(t.containerInfo), $t = e; $t !== null; )
          if (t = $t, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, $t = e;
          else
            for (; $t !== null; ) {
              t = $t;
              var a = t.alternate;
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
                  if ((e & 1024) !== 0 && a !== null) {
                    e = void 0, r = t, c = a.memoizedProps, a = a.memoizedState;
                    var u = r.stateNode;
                    try {
                      var g = Zn(
                        r.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        g,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (A) {
                      zt(r, r.return, A);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && se && fh(t.stateNode.containerInfo);
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
                e.return = t.return, $t = e;
                break;
              }
              $t = t.return;
            }
      }
      function wu(t, e, a) {
        var r = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            nn(t, a), r & 4 && tl(5, a);
            break;
          case 1:
            if (nn(t, a), r & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (g) {
                  zt(a, a.return, g);
                }
              else {
                var c = Zn(
                  a.type,
                  e.memoizedProps
                );
                e = e.memoizedState;
                try {
                  t.componentDidUpdate(
                    c,
                    e,
                    t.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (g) {
                  zt(
                    a,
                    a.return,
                    g
                  );
                }
              }
            r & 64 && hu(a), r & 512 && el(a, a.return);
            break;
          case 3:
            if (nn(t, a), r & 64 && (r = a.updateQueue, r !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = rl(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                sc(r, t);
              } catch (g) {
                zt(a, a.return, g);
              }
            }
            break;
          case 27:
            Kt && e === null && r & 4 && xu(a);
          case 26:
          case 5:
            if (nn(t, a), e === null) {
              if (r & 4) bu(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  Dh(
                    c,
                    t,
                    e,
                    a
                  );
                } catch (g) {
                  zt(a, a.return, g);
                }
              }
            }
            r & 512 && el(a, a.return);
            break;
          case 12:
            nn(t, a);
            break;
          case 31:
            nn(t, a), r & 4 && ku(t, a);
            break;
          case 13:
            nn(t, a), r & 4 && Su(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = bp.bind(
              null,
              a
            ), gh(r, a))));
            break;
          case 22:
            if (r = a.memoizedState !== null || un, !r) {
              e = e !== null && e.memoizedState !== null || Lt, c = un;
              var u = Lt;
              un = r, (Lt = e) && !u ? an(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : nn(t, a), un = c, Lt = u;
            }
            break;
          case 30:
            break;
          default:
            nn(t, a);
        }
      }
      function _u(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, _u(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && qp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, a) {
        for (a = a.child; a !== null; )
          no(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function no(t, e, a) {
        if (_e && typeof _e.onCommitFiberUnmount == "function")
          try {
            _e.onCommitFiberUnmount(sl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ye) {
              Lt || Ve(a, e), Ue(
                t,
                e,
                a
              ), a.memoizedState ? Sd(a.memoizedState) : a.stateNode && zd(a.stateNode);
              break;
            }
          case 27:
            if (Kt) {
              Lt || Ve(a, e);
              var r = Qt, c = ge;
              _a(a.type) && (Qt = a.stateNode, ge = !1), Ue(
                t,
                e,
                a
              ), Cd(a.stateNode), Qt = r, ge = c;
              break;
            }
          case 5:
            Lt || Ve(a, e);
          case 6:
            if (se) {
              if (r = Qt, c = ge, Qt = null, Ue(
                t,
                e,
                a
              ), Qt = r, ge = c, Qt !== null)
                if (ge)
                  try {
                    oh(Qt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    ih(Qt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
            } else
              Ue(
                t,
                e,
                a
              );
            break;
          case 18:
            se && Qt !== null && (ge ? Lh(
              Qt,
              a.stateNode
            ) : Gh(Qt, a.stateNode));
            break;
          case 4:
            se ? (r = Qt, c = ge, Qt = a.stateNode.containerInfo, ge = !0, Ue(
              t,
              e,
              a
            ), Qt = r, ge = c) : (Ke && yu(
              a.stateNode,
              a,
              pd()
            ), Ue(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            _n(2, a, e), Lt || _n(4, a, e), Ue(
              t,
              e,
              a
            );
            break;
          case 1:
            Lt || (Ve(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && gu(
              a,
              e,
              r
            )), Ue(
              t,
              e,
              a
            );
            break;
          case 21:
            Ue(
              t,
              e,
              a
            );
            break;
          case 22:
            Lt = (r = Lt) || a.memoizedState !== null, Ue(
              t,
              e,
              a
            ), Lt = r;
            break;
          default:
            Ue(
              t,
              e,
              a
            );
        }
      }
      function ku(t, e) {
        if (ce && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Bh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function Su(t, e) {
        if (ce && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Uh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
      }
      function dp(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new qd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new qd()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function ar(t, e) {
        var a = dp(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = vp.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function oe(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var r = 0; r < a.length; r++) {
            var c = a[r], u = t, g = e;
            if (se) {
              var A = g;
              t: for (; A !== null; ) {
                switch (A.tag) {
                  case 27:
                    if (Kt) {
                      if (_a(A.type)) {
                        Qt = A.stateNode, ge = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = A.stateNode, ge = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = A.stateNode.containerInfo, ge = !0;
                    break t;
                }
                A = A.return;
              }
              if (Qt === null) throw Error(s(160));
              no(u, g, c), Qt = null, ge = !1;
            } else no(u, g, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            Eu(e, t), e = e.sibling;
      }
      function Eu(t, e) {
        var a = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            oe(e, t), me(t), r & 4 && (_n(3, t, t.return), tl(3, t), _n(5, t, t.return));
            break;
          case 1:
            oe(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), r & 64 && un && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (Ye) {
              var c = Ge;
              if (oe(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Zh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : Ed(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = kd(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? a.stateNode !== null && zd(a.stateNode) : Sd(r), u === null ? Ed(
                  c,
                  t.type,
                  t.stateNode
                ) : kd(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Pi(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Kt) {
              oe(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), a !== null && r & 4 && Pi(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (oe(e, t), me(t), r & 512 && (Lt || a === null || Ve(a, a.return)), se) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  md(c);
                } catch (I) {
                  zt(t, t.return, I);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Pi(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (Ko = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (oe(e, t), me(t), r & 4 && se) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                eh(c, a, r);
              } catch (I) {
                zt(t, t.return, I);
              }
            }
            break;
          case 3:
            if (Ye ? (Wh(), c = Ge, Ge = To(e.containerInfo), oe(e, t), Ge = c) : oe(e, t), me(t), r & 4) {
              if (se && ce && a !== null && a.memoizedState.isDehydrated)
                try {
                  Hh(e.containerInfo);
                } catch (I) {
                  zt(t, t.return, I);
                }
              if (Ke) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  gd(r, a);
                } catch (I) {
                  zt(t, t.return, I);
                }
              }
            }
            Ko && (Ko = !1, zu(t));
            break;
          case 4:
            Ye ? (a = Ge, Ge = To(
              t.stateNode.containerInfo
            ), oe(e, t), me(t), Ge = a) : (oe(e, t), me(t)), r & 4 && Ke && yu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            oe(e, t), me(t);
            break;
          case 31:
            oe(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ar(t, r)));
            break;
          case 13:
            oe(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (Mr = he()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ar(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var g = a !== null && a.memoizedState !== null, A = un, L = Lt;
            if (un = A || c, Lt = L || g, oe(e, t), Lt = L, un = A, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || g || un || Lt || Jn(t)), se)) {
              t: if (a = null, se)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ye && e.tag === 26) {
                    if (a === null) {
                      g = a = e;
                      try {
                        u = g.stateNode, c ? sh(u) : uh(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch (I) {
                        zt(g, g.return, I);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      g = e;
                      try {
                        var F = g.stateNode;
                        c ? ch(F) : dh(F, g.memoizedProps);
                      } catch (I) {
                        zt(g, g.return, I);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      g = e;
                      try {
                        var tt = g.stateNode;
                        c ? Qh(tt) : Vh(g.stateNode);
                      } catch (I) {
                        zt(g, g.return, I);
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
            r & 4 && (r = t.updateQueue, r !== null && (a = r.retryQueue, a !== null && (r.retryQueue = null, ar(t, a))));
            break;
          case 19:
            oe(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, ar(t, r)));
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
            for (var a, r = t.return; r !== null; ) {
              if (vu(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (se) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Kt) {
                    var c = a.stateNode, u = to(t);
                    nr(t, u, c);
                    break;
                  }
                case 5:
                  var g = a.stateNode;
                  a.flags & 32 && (md(g), a.flags &= -33);
                  var A = to(t);
                  nr(t, A, g);
                  break;
                case 3:
                case 4:
                  var L = a.stateNode.containerInfo, F = to(t);
                  eo(
                    t,
                    F,
                    L
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (tt) {
            zt(t, t.return, tt);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function zu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            zu(e), e.tag === 5 && e.flags & 1024 && Vp(e.stateNode), t = t.sibling;
          }
      }
      function nn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            wu(t, e.alternate, e), e = e.sibling;
      }
      function Jn(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              _n(4, e, e.return), Jn(e);
              break;
            case 1:
              Ve(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && gu(
                e,
                e.return,
                a
              ), Jn(e);
              break;
            case 27:
              Kt && Cd(e.stateNode);
            case 26:
            case 5:
              Ve(e, e.return), Jn(e);
              break;
            case 22:
              e.memoizedState === null && Jn(e);
              break;
            case 30:
              Jn(e);
              break;
            default:
              Jn(e);
          }
          t = t.sibling;
        }
      }
      function an(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, u = e, g = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              an(
                c,
                u,
                a
              ), tl(4, u);
              break;
            case 1:
              if (an(
                c,
                u,
                a
              ), r = u, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch (F) {
                  zt(r, r.return, F);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var A = r.stateNode;
                try {
                  var L = c.shared.hiddenCallbacks;
                  if (L !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < L.length; c++)
                      oc(L[c], A);
                } catch (F) {
                  zt(r, r.return, F);
                }
              }
              a && g & 64 && hu(u), el(u, u.return);
              break;
            case 27:
              Kt && xu(u);
            case 26:
            case 5:
              an(
                c,
                u,
                a
              ), a && r === null && g & 4 && bu(u), el(u, u.return);
              break;
            case 12:
              an(
                c,
                u,
                a
              );
              break;
            case 31:
              an(
                c,
                u,
                a
              ), a && g & 4 && ku(c, u);
              break;
            case 13:
              an(
                c,
                u,
                a
              ), a && g & 4 && Su(c, u);
              break;
            case 22:
              u.memoizedState === null && an(
                c,
                u,
                a
              ), el(u, u.return);
              break;
            case 30:
              break;
            default:
              an(
                c,
                u,
                a
              );
          }
          e = e.sibling;
        }
      }
      function ao(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Ka(a));
      }
      function lo(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t));
      }
      function qe(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Nu(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function Nu(t, e, a, r) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            qe(
              t,
              e,
              a,
              r
            ), c & 2048 && tl(9, e);
            break;
          case 1:
            qe(
              t,
              e,
              a,
              r
            );
            break;
          case 3:
            qe(
              t,
              e,
              a,
              r
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t)));
            break;
          case 12:
            if (c & 2048) {
              qe(
                t,
                e,
                a,
                r
              ), t = e.stateNode;
              try {
                var u = e.memoizedProps, g = u.id, A = u.onPostCommit;
                typeof A == "function" && A(
                  g,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (L) {
                zt(e, e.return, L);
              }
            } else
              qe(
                t,
                e,
                a,
                r
              );
            break;
          case 31:
            qe(
              t,
              e,
              a,
              r
            );
            break;
          case 13:
            qe(
              t,
              e,
              a,
              r
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, g = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? qe(
              t,
              e,
              a,
              r
            ) : nl(
              t,
              e
            ) : u._visibility & 2 ? qe(
              t,
              e,
              a,
              r
            ) : (u._visibility |= 2, ga(
              t,
              e,
              a,
              r,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), c & 2048 && ao(g, e);
            break;
          case 24:
            qe(
              t,
              e,
              a,
              r
            ), c & 2048 && lo(e.alternate, e);
            break;
          default:
            qe(
              t,
              e,
              a,
              r
            );
        }
      }
      function ga(t, e, a, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, g = e, A = a, L = r, F = g.flags;
          switch (g.tag) {
            case 0:
            case 11:
            case 15:
              ga(
                u,
                g,
                A,
                L,
                c
              ), tl(8, g);
              break;
            case 23:
              break;
            case 22:
              var tt = g.stateNode;
              g.memoizedState !== null ? tt._visibility & 2 ? ga(
                u,
                g,
                A,
                L,
                c
              ) : nl(
                u,
                g
              ) : (tt._visibility |= 2, ga(
                u,
                g,
                A,
                L,
                c
              )), c && F & 2048 && ao(
                g.alternate,
                g
              );
              break;
            case 24:
              ga(
                u,
                g,
                A,
                L,
                c
              ), c && F & 2048 && lo(g.alternate, g);
              break;
            default:
              ga(
                u,
                g,
                A,
                L,
                c
              );
          }
          e = e.sibling;
        }
      }
      function nl(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                nl(a, r), c & 2048 && ao(
                  r.alternate,
                  r
                );
                break;
              case 24:
                nl(a, r), c & 2048 && lo(
                  r.alternate,
                  r
                );
                break;
              default:
                nl(a, r);
            }
            e = e.sibling;
          }
      }
      function Wn(t, e, a) {
        if (t.subtreeFlags & Ha)
          for (t = t.child; t !== null; )
            Tu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Tu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Wn(
              t,
              e,
              a
            ), t.flags & Ha)
              if (t.memoizedState !== null)
                $h(
                  a,
                  Ge,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Eo(c, t)) && fd(a, r, c, t);
              }
            break;
          case 5:
            Wn(
              t,
              e,
              a
            ), t.flags & Ha && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || Eo(c, t)) && fd(a, r, c, t));
            break;
          case 3:
          case 4:
            Ye ? (r = Ge, Ge = To(
              t.stateNode.containerInfo
            ), Wn(
              t,
              e,
              a
            ), Ge = r) : Wn(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Ha, Ha = 16777216, Wn(
              t,
              e,
              a
            ), Ha = r) : Wn(
              t,
              e,
              a
            ));
            break;
          default:
            Wn(
              t,
              e,
              a
            );
        }
      }
      function Cu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function al(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              $t = r, Au(
                r,
                t
              );
            }
          Cu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Mu(t), t = t.sibling;
      }
      function Mu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            al(t), t.flags & 2048 && _n(9, t, t.return);
            break;
          case 3:
            al(t);
            break;
          case 12:
            al(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, lr(t)) : al(t);
            break;
          default:
            al(t);
        }
      }
      function lr(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              $t = r, Au(
                r,
                t
              );
            }
          Cu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              _n(8, e, e.return), lr(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, lr(e));
              break;
            default:
              lr(e);
          }
          t = t.sibling;
        }
      }
      function Au(t, e) {
        for (; $t !== null; ) {
          var a = $t;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              _n(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var r = a.memoizedState.cachePool.pool;
                r != null && r.refCount++;
              }
              break;
            case 24:
              Ka(a.memoizedState.cache);
          }
          if (r = a.child, r !== null) r.return = a, $t = r;
          else
            t: for (a = t; $t !== null; ) {
              r = $t;
              var c = r.sibling, u = r.return;
              if (_u(r), r === a) {
                $t = null;
                break t;
              }
              if (c !== null) {
                c.return = u, $t = c;
                break t;
              }
              $t = u;
            }
        }
      }
      function ro(t) {
        var e = Dp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Zp(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function io(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case Er:
            if (t.type === e.value) return !0;
            break;
          case zr:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var r = t[a++], c = r.tag, u = t[a++], g = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !ol(r)) {
                  for (; g != null && io(r, g); )
                    u++, g = e[u];
                  if (u === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (r = r.child; r !== null; )
                      t.push(r, u), r = r.sibling;
                }
              }
              e = !1;
            }
            return e;
          case Nr:
            if ((a === 5 || a === 26 || a === 27) && Fp(t.stateNode, e.value))
              return !0;
            break;
          case Cr:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Wp(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Tr:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function oo(t) {
        switch (t.$$typeof) {
          case Er:
            return "<" + (w(t.value) || "Unknown") + ">";
          case zr:
            return ":has(" + (oo(t) || "") + ")";
          case Nr:
            return '[role="' + t.value + '"]';
          case Cr:
            return '"' + t.value + '"';
          case Tr:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function ju(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], A = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !ol(c)) {
            for (; A != null && io(c, A); )
              g++, A = e[g];
            if (g === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return a;
      }
      function so(t, e) {
        if (!il) throw Error(s(363));
        t = ro(t), t = ju(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var r = t[a++], c = r.tag;
          if (c === 5 || c === 26 || c === 27)
            ol(r) || e.push(r.stateNode);
          else
            for (r = r.child; r !== null; )
              t.push(r), r = r.sibling;
        }
        return e;
      }
      function ye() {
        return (xt & 2) !== 0 && _t !== 0 ? _t & -_t : dt.T !== null ? bi() : Bp();
      }
      function Ou() {
        if (ze === 0)
          if ((_t & 536870912) === 0 || kt) {
            var t = fr;
            fr <<= 1, (fr & 3932160) === 0 && (fr = 262144), ze = t;
          } else ze = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), ze;
      }
      function pe(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ba(t, 0), kn(
          t,
          _t,
          ze,
          !1
        )), T(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (ra |= a), Bt === 4 && kn(
          t,
          _t,
          ze,
          !1
        )), Qe(t));
      }
      function Ru(t, e, a) {
        if ((xt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || D(t, e), c = r ? pp(t, e) : uo(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ba && !r && kn(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !fp(a)) {
              c = uo(t, e, !1), u = !1;
              continue;
            }
            if (c === 2) {
              if (u = e, t.errorRecoveryDisabledLanes & u)
                var g = 0;
              else
                g = t.pendingLanes & -536870913, g = g !== 0 ? g : g & 536870912 ? 536870912 : 0;
              if (g !== 0) {
                e = g;
                t: {
                  var A = t;
                  c = gl;
                  var L = ce && A.current.memoizedState.isDehydrated;
                  if (L && (ba(A, g).flags |= 256), g = uo(
                    A,
                    g,
                    !1
                  ), g !== 2) {
                    if (Xo && !L) {
                      A.errorRecoveryDisabledLanes |= u, ra |= u, c = 4;
                      break t;
                    }
                    u = be, be = c, u !== null && (be === null ? be = u : be.push.apply(
                      be,
                      u
                    ));
                  }
                  c = g;
                }
                if (u = !1, c !== 2) continue;
              }
            }
            if (c === 1) {
              ba(t, 0), kn(t, e, 0, !0);
              break;
            }
            t: {
              switch (r = t, u = c, u) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  kn(
                    r,
                    e,
                    ze,
                    !Mn
                  );
                  break t;
                case 2:
                  be = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (c = Mr + 300 - he(), 10 < c)) {
                if (kn(
                  r,
                  e,
                  ze,
                  !Mn
                ), j(r, 0, !0) !== 0) break t;
                fn = e, r.timeoutHandle = Op(
                  Du.bind(
                    null,
                    r,
                    a,
                    be,
                    Ar,
                    Jo,
                    e,
                    ze,
                    ra,
                    Ua,
                    Mn,
                    u,
                    "Throttled",
                    -0,
                    0
                  ),
                  c
                );
                break t;
              }
              Du(
                r,
                a,
                be,
                Ar,
                Jo,
                e,
                ze,
                ra,
                Ua,
                Mn,
                u,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Qe(t);
      }
      function Du(t, e, a, r, c, u, g, A, L, F, tt, I, at, gt) {
        if (t.timeoutHandle = $n, I = e.subtreeFlags, I & 8192 || (I & 16785408) === 16785408) {
          I = Lp(), Tu(
            e,
            u,
            I
          );
          var le = (u & 62914560) === u ? Mr - he() : (u & 4194048) === u ? Yd - he() : 0;
          if (le = Qp(
            I,
            le
          ), le !== null) {
            fn = u, t.cancelPendingCommit = le(
              Vu.bind(
                null,
                t,
                e,
                u,
                a,
                r,
                c,
                g,
                A,
                L,
                tt,
                I,
                null,
                at,
                gt
              )
            ), kn(t, u, g, !F);
            return;
          }
        }
        Vu(
          t,
          e,
          u,
          a,
          r,
          c,
          g,
          A,
          L
        );
      }
      function fp(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var r = 0; r < a.length; r++) {
              var c = a[r], u = c.getSnapshot;
              c = c.value;
              try {
                if (!ke(u(), c)) return !1;
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
      function kn(t, e, a, r) {
        e &= ~Zo, e &= ~ra, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - we(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        a !== 0 && v(t, a, e);
      }
      function Hu() {
        return (xt & 6) === 0 ? (pa(0), !1) : !0;
      }
      function co() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, sn = Pn = null, Mi(t), Aa = null, fl = 0, t = wt;
          for (; t !== null; )
            pu(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ba(t, e) {
        var a = t.timeoutHandle;
        a !== $n && (t.timeoutHandle = $n, Rp(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), fn = 0, co(), At = t, wt = a = ln(t.current, null), _t = e, Ct = 0, Ee = null, Mn = !1, Ba = D(t, e), Xo = !1, Ua = ze = Zo = ra = An = Bt = 0, be = gl = null, Jo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - we(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return dn = e, Yl(), a;
      }
      function Bu(t, e) {
        bt = null, dt.H = pl, e === Ma || e === xr ? (e = ac(), Ct = 3) : e === Uo ? (e = ac(), Ct = 4) : Ct = e === Qo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Ee = e, wt === null && (Bt = 1, Fl(
          t,
          Q(e, t.current)
        ));
      }
      function Uu() {
        var t = Se.current;
        return t === null ? !0 : (_t & 4194048) === _t ? Oe === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === Oe : !1;
      }
      function qu() {
        var t = dt.H;
        return dt.H = pl, t === null ? pl : t;
      }
      function Yu() {
        var t = dt.A;
        return dt.A = f0, t;
      }
      function rr() {
        Bt = 4, Mn || (_t & 4194048) !== _t && Se.current !== null || (Ba = !0), (An & 134217727) === 0 && (ra & 134217727) === 0 || At === null || kn(
          At,
          _t,
          ze,
          !1
        );
      }
      function uo(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = qu(), u = Yu();
        (At !== t || _t !== e) && (Ar = null, ba(t, e)), e = !1;
        var g = Bt;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var A = wt, L = Ee;
              switch (Ct) {
                case 8:
                  co(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var F = Ct;
                  if (Ct = 0, Ee = null, va(t, A, L, F), a && Ba) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  F = Ct, Ct = 0, Ee = null, va(t, A, L, F);
              }
            }
            mp(), g = Bt;
            break;
          } catch (tt) {
            Bu(t, tt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, sn = Pn = null, xt = r, dt.H = c, dt.A = u, wt === null && (At = null, _t = 0, Yl()), g;
      }
      function mp() {
        for (; wt !== null; ) Gu(wt);
      }
      function pp(t, e) {
        var a = xt;
        xt |= 2;
        var r = qu(), c = Yu();
        At !== t || _t !== e ? (Ar = null, bl = he() + 500, ba(t, e)) : Ba = D(
          t,
          e
        );
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              e = wt;
              var u = Ee;
              e: switch (Ct) {
                case 1:
                  Ct = 0, Ee = null, va(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (ec(u)) {
                    Ct = 0, Ee = null, Lu(e);
                    break;
                  }
                  e = function() {
                    Ct !== 2 && Ct !== 9 || At !== t || (Ct = 7), Qe(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  Ct = 7;
                  break t;
                case 4:
                  Ct = 5;
                  break t;
                case 7:
                  ec(u) ? (Ct = 0, Ee = null, Lu(e)) : (Ct = 0, Ee = null, va(t, e, u, 7));
                  break;
                case 5:
                  var g = null;
                  switch (wt.tag) {
                    case 26:
                      g = wt.memoizedState;
                    case 5:
                    case 27:
                      var A = wt, L = A.type, F = A.pendingProps;
                      if (g ? Nd(g) : dd(A.stateNode, L, F)) {
                        Ct = 0, Ee = null;
                        var tt = A.sibling;
                        if (tt !== null) wt = tt;
                        else {
                          var I = A.return;
                          I !== null ? (wt = I, ir(I)) : wt = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, Ee = null, va(t, e, u, 5);
                  break;
                case 6:
                  Ct = 0, Ee = null, va(t, e, u, 6);
                  break;
                case 8:
                  co(), Bt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            hp();
            break;
          } catch (at) {
            Bu(t, at);
          }
        while (!0);
        return sn = Pn = null, dt.H = r, dt.A = c, xt = a, wt !== null ? 0 : (At = null, _t = 0, Yl(), Bt);
      }
      function hp() {
        for (; wt !== null && !e0(); )
          Gu(wt);
      }
      function Gu(t) {
        var e = cu(
          t.alternate,
          t,
          dn
        );
        t.memoizedProps = t.pendingProps, e === null ? ir(t) : wt = e;
      }
      function Lu(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = au(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = au(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              _t
            );
            break;
          case 5:
            Mi(e);
          default:
            pu(a, e), e = wt = Iu(e, dn), e = cu(a, e, dn);
        }
        t.memoizedProps = t.pendingProps, e === null ? ir(t) : wt = e;
      }
      function va(t, e, a, r) {
        sn = Pn = null, Mi(e), Aa = null, fl = 0;
        var c = e.return;
        try {
          if (rp(
            t,
            c,
            e,
            a,
            _t
          )) {
            Bt = 1, Fl(
              t,
              Q(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Bt = 1, Fl(
            t,
            Q(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (kt || r === 1 ? t = !0 : Ba || (_t & 536870912) !== 0 ? t = !1 : (Mn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Qu(e, t)) : ir(e);
      }
      function ir(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Qu(
              e,
              Mn
            );
            return;
          }
          t = e.return;
          var a = sp(
            e.alternate,
            e,
            dn
          );
          if (a !== null) {
            wt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            wt = e;
            return;
          }
          wt = e = t;
        } while (e !== null);
        Bt === 0 && (Bt = 5);
      }
      function Qu(t, e) {
        do {
          var a = cp(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, wt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            wt = t;
            return;
          }
          wt = t = a;
        } while (t !== null);
        Bt = 6, wt = null;
      }
      function Vu(t, e, a, r, c, u, g, A, L) {
        t.cancelPendingCommit = null;
        do
          ll();
        while (Xt !== 0);
        if ((xt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= qo, p(
            t,
            a,
            u,
            g,
            A,
            L
          ), t === At && (wt = At = null, _t = 0), qa = e, On = t, fn = a, Wo = u, Fo = c, Gd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, yp(Ao, function() {
            return Wu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = on(), Ft(2), g = xt, xt |= 4;
            try {
              up(t, e, a);
            } finally {
              xt = g, Ft(c), dt.T = r;
            }
          }
          Xt = 1, Ku(), Xu(), Zu();
        }
      }
      function Ku() {
        if (Xt === 1) {
          Xt = 0;
          var t = On, e = qa, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = on();
            Ft(2);
            var c = xt;
            xt |= 4;
            try {
              Eu(e, t), Ap(t.containerInfo);
            } finally {
              xt = c, Ft(r), dt.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Xu() {
        if (Xt === 2) {
          Xt = 0;
          var t = On, e = qa, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = on();
            Ft(2);
            var c = xt;
            xt |= 4;
            try {
              wu(t, e.alternate, e);
            } finally {
              xt = c, Ft(r), dt.T = a;
            }
          }
          Xt = 3;
        }
      }
      function Zu() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, n0();
          var t = On, e = qa, a = fn, r = Gd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, qa = On = null, Ju(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (jn = null), z(a), e = e.stateNode, _e && typeof _e.onCommitFiberRoot == "function")
            try {
              _e.onCommitFiberRoot(
                sl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (r !== null) {
            e = dt.T, c = on(), Ft(2), dt.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var A = r[g];
                u(A.value, {
                  componentStack: A.stack
                });
              }
            } finally {
              dt.T = e, Ft(c);
            }
          }
          (fn & 3) !== 0 && ll(), Qe(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === $o ? vl++ : (vl = 0, $o = t) : vl = 0, ce && Yh(), pa(0);
        }
      }
      function Ju(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ka(e)));
      }
      function ll() {
        return Ku(), Xu(), Zu(), Wu();
      }
      function Wu() {
        if (Xt !== 5) return !1;
        var t = On, e = Wo;
        Wo = 0;
        var a = z(fn), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = on();
        try {
          Ft(r), dt.T = null, r = Fo, Fo = null;
          var u = On, g = fn;
          if (Xt = 0, qa = On = null, fn = 0, (xt & 6) !== 0)
            throw Error(s(331));
          var A = xt;
          if (xt |= 4, Mu(u.current), Nu(
            u,
            u.current,
            g,
            r
          ), xt = A, pa(0, !1), _e && typeof _e.onPostCommitFiberRoot == "function")
            try {
              _e.onPostCommitFiberRoot(sl, u);
            } catch {
            }
          return !0;
        } finally {
          Ft(c), dt.T = a, Ju(t, e);
        }
      }
      function Fu(t, e, a) {
        e = Q(a, e), e = Li(t.stateNode, e, 2), t = yn(t, e, 2), t !== null && (T(t, 2), Qe(t));
      }
      function zt(t, e, a) {
        if (t.tag === 3)
          Fu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Fu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (jn === null || !jn.has(r))) {
                t = Q(a, t), a = Wc(2), r = yn(e, a, 2), r !== null && (Fc(
                  a,
                  r,
                  e,
                  t
                ), T(r, 2), Qe(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function fo(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new m0();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Xo = !0, c.add(a), t = gp.bind(null, t, e, a), e.then(t, t));
      }
      function gp(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (_t & a) === a && (Bt === 4 || Bt === 3 && (_t & 62914560) === _t && 300 > he() - Mr ? (xt & 2) === 0 && ba(t, 0) : Zo |= a, Ua === _t && (Ua = 0)), Qe(t);
      }
      function $u(t, e) {
        e === 0 && (e = J()), t = Xn(t, e), t !== null && (T(t, e), Qe(t));
      }
      function bp(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), $u(t, a);
      }
      function vp(t, e) {
        var a = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var r = t.stateNode, c = t.memoizedState;
            c !== null && (a = c.retryLane);
            break;
          case 19:
            r = t.stateNode;
            break;
          case 22:
            r = t.stateNode._retryCache;
            break;
          default:
            throw Error(s(314));
        }
        r !== null && r.delete(e), $u(t, a);
      }
      function yp(t, e) {
        return pr(t, e);
      }
      function xp(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function mo(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function ln(t, e) {
        var a = t.alternate;
        return a === null ? (a = i(
          t.tag,
          e,
          t.key,
          t.mode
        ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
      }
      function Iu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function or(t, e, a, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") mo(t) && (g = 1);
        else if (typeof t == "string")
          g = Ye && Kt ? wd(t, a, ne.current) ? 26 : Md(t) ? 27 : 5 : Ye ? wd(
            t,
            a,
            ne.current
          ) ? 26 : 5 : Kt && Md(t) ? 27 : 5;
        else
          t: switch (t) {
            case ko:
              return t = i(31, a, e, c), t.elementType = ko, t.lanes = u, t;
            case xa:
              return Fn(
                a.children,
                c,
                u,
                e
              );
            case rd:
              g = 8, c |= 24;
              break;
            case vo:
              return t = i(12, a, e, c | 2), t.elementType = vo, t.lanes = u, t;
            case xo:
              return t = i(13, a, e, c), t.elementType = xo, t.lanes = u, t;
            case wo:
              return t = i(19, a, e, c), t.elementType = wo, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case Sn:
                    g = 10;
                    break t;
                  case id:
                    g = 9;
                    break t;
                  case yo:
                    g = 11;
                    break t;
                  case _o:
                    g = 14;
                    break t;
                  case En:
                    g = 16, r = null;
                    break t;
                }
              g = 29, a = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = i(g, a, e, c), e.elementType = t, e.type = r, e.lanes = u, e;
      }
      function Fn(t, e, a, r) {
        return t = i(7, t, r, e), t.lanes = a, t;
      }
      function po(t, e, a) {
        return t = i(6, t, null, e), t.lanes = a, t;
      }
      function Pu(t) {
        var e = i(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function ho(t, e, a) {
        return e = i(
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
      function wp(t, e, a, r, c, u, g, A, L) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = $n, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Z(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Z(0), this.hiddenUpdates = Z(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = L, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function td(t, e, a, r, c, u, g, A, L, F, tt, I) {
        return t = new wp(
          t,
          e,
          a,
          g,
          L,
          F,
          tt,
          I,
          A
        ), e = 1, u === !0 && (e |= 24), u = i(3, null, null, e), t.current = u, u.stateNode = t, e = gi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, xi(u), t;
      }
      function ed(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function nd(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? h(t) : null, t === null ? null : rl(t.stateNode);
      }
      function ad(t, e, a, r, c, u) {
        c = ed(c), r.context === null ? r.context = c : r.pendingContext = c, r = vn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = yn(t, r, e), a !== null && (pe(a, t, e), Za(a, t, e));
      }
      function ld(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function go(t, e) {
        ld(t, e), (t = t.alternate) && ld(t, e);
      }
      var yt = {}, _p = L0, xe = V0(), bo = Object.assign, kp = Symbol.for("react.element"), sr = Symbol.for("react.transitional.element"), ya = Symbol.for("react.portal"), xa = Symbol.for("react.fragment"), rd = Symbol.for("react.strict_mode"), vo = Symbol.for("react.profiler"), id = Symbol.for("react.consumer"), Sn = Symbol.for("react.context"), yo = Symbol.for("react.forward_ref"), xo = Symbol.for("react.suspense"), wo = Symbol.for("react.suspense_list"), _o = Symbol.for("react.memo"), En = Symbol.for("react.lazy"), ko = Symbol.for("react.activity"), Sp = Symbol.for("react.memo_cache_sentinel"), od = Symbol.iterator, Ep = Symbol.for("react.client.reference"), cr = Array.isArray, dt = _p.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, zp = l.rendererVersion, Np = l.rendererPackageName, sd = l.extraDevToolsConfig, rl = l.getPublicInstance, Tp = l.getRootHostContext, Cp = l.getChildHostContext, Mp = l.prepareForCommit, Ap = l.resetAfterCommit, jp = l.createInstance;
      l.cloneMutableInstance;
      var So = l.appendInitialChild, cd = l.finalizeInitialChildren, ur = l.shouldSetTextContent, ud = l.createTextInstance;
      l.cloneMutableTextInstance;
      var Op = l.scheduleTimeout, Rp = l.cancelTimeout, $n = l.noTimeout, rn = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var se = l.supportsMutation, Ke = l.supportsPersistence, ce = l.supportsHydration, Dp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Hp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Ft = l.setCurrentUpdatePriority, on = l.getCurrentUpdatePriority, Bp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var Up = l.shouldAttemptEagerTransition, qp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Yp = l.maySuspendCommit, Gp = l.maySuspendCommitOnUpdate, Eo = l.maySuspendCommitInSyncRender, dd = l.preloadInstance, Lp = l.startSuspendingCommit, fd = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Qp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var wa = l.NotPendingTransition, In = l.HostTransitionContext, Vp = l.resetFormInstance;
      l.bindToConsole;
      var Kp = l.supportsMicrotasks, Xp = l.scheduleMicrotask, il = l.supportsTestSelectors, Zp = l.findFiberRoot, Jp = l.getBoundingRect, Wp = l.getTextContent, ol = l.isHiddenSubtree, Fp = l.matchAccessibilityRole, $p = l.setFocusIfFocusable, Ip = l.setupIntersectionObserver, Pp = l.appendChild, th = l.appendChildToContainer, eh = l.commitTextUpdate, nh = l.commitMount, ah = l.commitUpdate, lh = l.insertBefore, rh = l.insertInContainerBefore, ih = l.removeChild, oh = l.removeChildFromContainer, md = l.resetTextContent, sh = l.hideInstance, ch = l.hideTextInstance, uh = l.unhideInstance, dh = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var fh = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var mh = l.cloneInstance, pd = l.createContainerChildSet, hd = l.appendChildToContainerChildSet, ph = l.finalizeContainerChildren, gd = l.replaceContainerChildren, bd = l.cloneHiddenInstance, vd = l.cloneHiddenTextInstance, zo = l.isSuspenseInstancePending, No = l.isSuspenseInstanceFallback, hh = l.getSuspenseInstanceFallbackErrorDetails, gh = l.registerSuspenseInstanceRetry, bh = l.canHydrateFormStateMarker, vh = l.isFormStateMarkerMatching, yd = l.getNextHydratableSibling, yh = l.getNextHydratableSiblingAfterSingleton, xh = l.getFirstHydratableChild, wh = l.getFirstHydratableChildWithinContainer, _h = l.getFirstHydratableChildWithinActivityInstance, kh = l.getFirstHydratableChildWithinSuspenseInstance, Sh = l.getFirstHydratableChildWithinSingleton, Eh = l.canHydrateInstance, zh = l.canHydrateTextInstance, Nh = l.canHydrateActivityInstance, Th = l.canHydrateSuspenseInstance, Ch = l.hydrateInstance, Mh = l.hydrateTextInstance, Ah = l.hydrateActivityInstance, jh = l.hydrateSuspenseInstance, Oh = l.getNextHydratableInstanceAfterActivityInstance, Rh = l.getNextHydratableInstanceAfterSuspenseInstance, Dh = l.commitHydratedInstance, Hh = l.commitHydratedContainer, Bh = l.commitHydratedActivityInstance, Uh = l.commitHydratedSuspenseInstance, qh = l.finalizeHydratedChildren, Yh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Gh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var Lh = l.clearSuspenseBoundaryFromContainer, Qh = l.hideDehydratedBoundary, Vh = l.unhideDehydratedBoundary, xd = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Kh = l.validateHydratableInstance, Xh = l.validateHydratableTextInstance, Ye = l.supportsResources, wd = l.isHostHoistableType, To = l.getHoistableRoot, _d = l.getResource, kd = l.acquireResource, Sd = l.releaseResource, Zh = l.hydrateHoistable, Ed = l.mountHoistable, zd = l.unmountHoistable, Jh = l.createHoistableInstance, Wh = l.prepareToCommitHoistables, Fh = l.mayResourceSuspendCommit, Nd = l.preloadResource, $h = l.suspendResource, Kt = l.supportsSingletons, Td = l.resolveSingletonInstance, Ih = l.acquireSingletonInstance, Cd = l.releaseSingletonInstance, Md = l.isHostSingletonType, _a = l.isSingletonScope, Co = [], ka = -1, Sa = {}, we = Math.clz32 ? Math.clz32 : O, Ph = Math.log, t0 = Math.LN2, dr = 256, fr = 262144, mr = 4194304, pr = xe.unstable_scheduleCallback, Mo = xe.unstable_cancelCallback, e0 = xe.unstable_shouldYield, n0 = xe.unstable_requestPaint, he = xe.unstable_now, Ad = xe.unstable_ImmediatePriority, a0 = xe.unstable_UserBlockingPriority, Ao = xe.unstable_NormalPriority, l0 = xe.unstable_IdlePriority, r0 = xe.log, i0 = xe.unstable_setDisableYieldValue, sl = null, _e = null, ke = typeof Object.is == "function" ? Object.is : Y, jd = typeof reportError == "function" ? reportError : function(t) {
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
      }, o0 = Object.prototype.hasOwnProperty, jo, Od, Oo = !1, Rd = /* @__PURE__ */ new WeakMap(), Ea = [], za = 0, hr = null, cl = 0, Ce = [], Me = 0, zn = null, Xe = 1, Ze = "", ne = b(null), ul = b(null), Nn = b(null), gr = b(null), ae = null, Ot = null, kt = !1, Tn = null, Ae = !1, Ro = Error(s(519)), br = b(null), Pn = null, sn = null, s0 = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(a, r) {
            t.push(r);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(a) {
            return a();
          });
        };
      }, c0 = xe.unstable_scheduleCallback, u0 = xe.unstable_NormalPriority, Rt = {
        $$typeof: Sn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, vr = null, Na = null, Do = !1, yr = !1, Ho = !1, ta = 0, dl = null, Bo = 0, Ta = 0, Ca = null, Dd = dt.S;
      dt.S = function(t, e) {
        Yd = he(), typeof e == "object" && e !== null && typeof e.then == "function" && $m(t, e), Dd !== null && Dd(t, e);
      };
      var ea = b(null), Ma = Error(s(460)), Uo = Error(s(474)), xr = Error(s(542)), wr = { then: function() {
      } }, na = null, Aa = null, fl = 0, aa = rc(!0), Hd = rc(!1), je = [], ja = 0, qo = 0, Cn = !1, Yo = !1, Oa = b(null), _r = b(0), Se = b(null), Oe = null, qt = b(0), cn = 0, bt = null, Mt = null, Yt = null, kr = !1, Ra = !1, la = !1, Sr = 0, ml = 0, Da = null, d0 = 0, pl = {
        readContext: te,
        use: Kl,
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
      pl.useEffectEvent = Ht;
      var Bd = {
        readContext: te,
        use: Kl,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: te,
        useEffect: Mc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Zl(
            4194308,
            4,
            Rc.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Zl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Zl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = fe();
          e = e === void 0 ? null : e;
          var r = t();
          if (la) {
            R(!0);
            try {
              t();
            } finally {
              R(!1);
            }
          }
          return a.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, a) {
          var r = fe();
          if (a !== void 0) {
            var c = a(e);
            if (la) {
              R(!0);
              try {
                a(e);
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
          }, r.queue = t, t = t.dispatch = lp.bind(
            null,
            bt,
            t
          ), [r.memoizedState, t];
        },
        useRef: function(t) {
          var e = fe();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Ri(t);
          var e = t.queue, a = Qc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Bi,
        useDeferredValue: function(t, e) {
          var a = fe();
          return Ui(a, t, e);
        },
        useTransition: function() {
          var t = Ri(!1);
          return t = qc.bind(
            null,
            bt,
            t.queue,
            !0,
            !1
          ), fe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var r = bt, c = fe();
          if (kt) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), At === null)
              throw Error(s(349));
            (_t & 127) !== 0 || pc(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, Mc(gc.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            hc.bind(
              null,
              r,
              u,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = fe(), e = At.identifierPrefix;
          if (kt) {
            var a = Ze, r = Xe;
            a = (r & ~(1 << 32 - we(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = Sr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = d0++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: qi,
        useFormState: Ec,
        useActionState: Ec,
        useOptimistic: function(t) {
          var e = fe();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = Yi.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Ai,
        useCacheRefresh: function() {
          return fe().memoizedState = ap.bind(
            null,
            bt
          );
        },
        useEffectEvent: function(t) {
          var e = fe(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((xt & 2) !== 0)
              throw Error(s(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, Go = {
        readContext: te,
        use: Kl,
        useCallback: Hc,
        useContext: te,
        useEffect: Hi,
        useImperativeHandle: Dc,
        useInsertionEffect: jc,
        useLayoutEffect: Oc,
        useMemo: Bc,
        useReducer: Xl,
        useRef: Cc,
        useState: function() {
          return Xl(tn);
        },
        useDebugValue: Bi,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Uc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Xl(tn)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Fa(t),
            e
          ];
        },
        useSyncExternalStore: mc,
        useId: Gc,
        useHostTransitionStatus: qi,
        useFormState: zc,
        useActionState: zc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return yc(a, Mt, t, e);
        },
        useMemoCache: Ai,
        useCacheRefresh: Lc
      };
      Go.useEffectEvent = Ac;
      var Ud = {
        readContext: te,
        use: Kl,
        useCallback: Hc,
        useContext: te,
        useEffect: Hi,
        useImperativeHandle: Dc,
        useInsertionEffect: jc,
        useLayoutEffect: Oc,
        useMemo: Bc,
        useReducer: Oi,
        useRef: Cc,
        useState: function() {
          return Oi(tn);
        },
        useDebugValue: Bi,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Mt === null ? Ui(a, t, e) : Uc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Oi(tn)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Fa(t),
            e
          ];
        },
        useSyncExternalStore: mc,
        useId: Gc,
        useHostTransitionStatus: qi,
        useFormState: Tc,
        useActionState: Tc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Mt !== null ? yc(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Ai,
        useCacheRefresh: Lc
      };
      Ud.useEffectEvent = Ac;
      var Lo = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = vn(r);
          c.payload = e, a != null && (c.callback = a), e = yn(t, c, r), e !== null && (pe(e, t, r), Za(e, t, r));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = vn(r);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = yn(t, c, r), e !== null && (pe(e, t, r), Za(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = ye(), r = vn(a);
          r.tag = 2, e != null && (r.callback = e), e = yn(t, r, a), e !== null && (pe(e, t, a), Za(e, t, a));
        }
      }, Qo = Error(s(461)), Gt = !1, Vo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, un = !1, Lt = !1, Ko = !1, qd = typeof WeakSet == "function" ? WeakSet : Set, $t = null, Qt = null, ge = !1, Ge = null, Ha = 8192, f0 = {
        getCacheForType: function(t) {
          var e = te(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return te(Rt).controller.signal;
        }
      }, Er = 0, zr = 1, Nr = 2, Tr = 3, Cr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var hl = Symbol.for;
        Er = hl("selector.component"), zr = hl("selector.has_pseudo_class"), Nr = hl("selector.role"), Tr = hl("selector.test_id"), Cr = hl("selector.text");
      }
      var m0 = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, Ee = null, Mn = !1, Ba = !1, Xo = !1, dn = 0, Bt = 0, An = 0, ra = 0, Zo = 0, ze = 0, Ua = 0, gl = null, be = null, Jo = !1, Mr = 0, Yd = 0, bl = 1 / 0, Ar = null, jn = null, Xt = 0, On = null, qa = null, fn = 0, Wo = 0, Fo = null, Gd = null, vl = 0, $o = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Xn(t, 67108864);
          e !== null && pe(e, t, 67108864), go(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ye();
          e = C(e);
          var a = Xn(t, e);
          a !== null && pe(a, t, e), go(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = E(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - we(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Qe(t), (xt & 6) === 0 && (bl = he() + 500, pa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Xn(t, 2), e !== null && pe(e, t, 2), Hu(), go(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: Er, value: t };
      }, yt.createContainer = function(t, e, a, r, c, u, g, A, L, F) {
        return td(
          t,
          e,
          !1,
          null,
          a,
          r,
          u,
          null,
          g,
          A,
          L,
          F
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: zr, value: t };
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, g, A, L, F, tt, I, at, gt) {
        return t = td(
          a,
          r,
          !0,
          t,
          c,
          u,
          A,
          gt,
          L,
          F,
          tt,
          I
        ), t.context = ed(null), a = t.current, r = ye(), r = C(r), c = vn(r), c.callback = e ?? null, yn(a, c, r), e = r, t.current.lanes = e, T(t, e), Qe(t), t;
      }, yt.createPortal = function(t, e, a) {
        var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ya,
          key: r == null ? null : "" + r,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, yt.createRoleSelector = function(t) {
        return { $$typeof: Nr, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: Tr, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: Cr, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        jd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        jd(t);
      }, yt.deferredUpdates = function(t) {
        var e = dt.T, a = on();
        try {
          return Ft(32), dt.T = null, t();
        } finally {
          Ft(a), dt.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = dt.T, g = on();
        try {
          return Ft(2), dt.T = null, t(e, a, r, c);
        } finally {
          Ft(g), dt.T = u, xt === 0 && (bl = he() + 500);
        }
      }, yt.findAllNodes = so, yt.findBoundingRects = function(t, e) {
        if (!il) throw Error(s(363));
        e = so(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Jp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, g = u + a.height, A = e - 1; 0 <= A; A--)
            if (e !== A) {
              var L = t[A], F = L.x, tt = F + L.width, I = L.y, at = I + L.height;
              if (r >= F && u >= I && c <= tt && g <= at) {
                t.splice(e, 1);
                break;
              } else if (r !== F || a.width !== L.width || at < u || I > g) {
                if (!(u !== I || a.height !== L.height || tt < r || F > c)) {
                  F > r && (L.width += F - r, L.x = r), tt < c && (L.width = c - F), t.splice(e, 1);
                  break;
                }
              } else {
                I > u && (L.height += I - u, L.y = u), at < g && (L.height = g - I), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = nd, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? y(t) : null, t === null ? null : rl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return nd(t);
      }, yt.flushPassiveEffects = ll, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = dt.T, r = on();
        try {
          if (Ft(2), dt.T = null, t)
            return t();
        } finally {
          Ft(r), dt.T = a, xt = e, (xt & 6) === 0 && pa(0);
        }
      }, yt.flushSyncWork = Hu, yt.focusWithin = function(t, e) {
        if (!il) throw Error(s(363));
        for (t = ro(t), e = ju(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!ol(a)) {
            if ((r === 5 || r === 26 || r === 27) && $p(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!il) throw Error(s(363));
        var a = 0, r = [];
        t = [ro(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, A = t[c++], L = e[A];
          if ((g !== 5 && g !== 26 && g !== 27 || !ol(u)) && (io(u, L) && (r.push(oo(L)), A++, A > a && (a = A)), A < e.length))
            for (u = u.child; u !== null; )
              t.push(u, A), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(oo(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (r.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, yt.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return rl(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, yt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: zp,
          rendererPackageName: Np,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (sd !== null && (t.rendererConfig = sd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              sl = e.inject(t), _e = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, yt.isAlreadyRendering = function() {
        return (xt & 6) !== 0;
      }, yt.observeVisibleRects = function(t, e, a, r) {
        if (!il) throw Error(s(363));
        t = so(t, e);
        var c = Ip(
          t,
          a,
          r
        ).disconnect;
        return {
          disconnect: function() {
            c();
          }
        };
      }, yt.shouldError = function() {
        return null;
      }, yt.shouldSuspend = function() {
        return !1;
      }, yt.startHostTransition = function(t, e, a, r) {
        if (t.tag !== 5) throw Error(s(476));
        var c = Yc(t).queue;
        qc(
          t,
          c,
          e,
          wa,
          a === null ? o : function() {
            var u = Yc(t);
            return u.next === null && (u = t.alternate.memoizedState), $a(
              t,
              u.next.queue,
              {},
              ye()
            ), a(r);
          }
        );
      }, yt.updateContainer = function(t, e, a, r) {
        var c = e.current, u = ye();
        return ad(
          c,
          u,
          t,
          e,
          a,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, a, r) {
        return ad(
          e.current,
          2,
          t,
          e,
          a,
          r
        ), 2;
      }, yt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(es)), es.exports;
}
var tf;
function X0() {
  return tf || (tf = 1, ts.exports = K0()), ts.exports;
}
var Z0 = X0();
const J0 = /* @__PURE__ */ Ds(Z0);
var ls = { exports: {} }, mn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ef;
function W0() {
  return ef || (ef = 1, mn.ConcurrentRoot = 1, mn.ContinuousEventPriority = 8, mn.DefaultEventPriority = 32, mn.DiscreteEventPriority = 2, mn.IdleEventPriority = 268435456, mn.LegacyRoot = 0, mn.NoEventPriority = 0), mn;
}
var nf;
function F0() {
  return nf || (nf = 1, ls.exports = W0()), ls.exports;
}
var Cl = F0();
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
const Zf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], gs = 16, ui = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), $0 = [
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
], af = {
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
}, I0 = /* @__PURE__ */ new Set([
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
]), Jf = {
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
}, Wf = {
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
}, bs = ["font-size", "color", ...new Set([...Object.keys(Jf), ...Object.keys(Wf)].filter((n) => n !== "font-size" && n !== "color"))], P0 = new Set(bs);
function ie(n, l = " ") {
  const i = [];
  let o = 0, s = "";
  for (let d = 0; d < n.length; d++) {
    const m = n[d];
    if (m === "(" ? o++ : m === ")" && o--, o === 0 && (l === " " ? /\s/.test(m) : m === l)) {
      (s.trim() || l !== " ") && i.push(s.trim()), s = "";
      continue;
    }
    s += m;
  }
  return (s.trim() || l !== " " && i.length) && i.push(s.trim()), i;
}
function vs(n, l, i = 0) {
  if (i > 32) return null;
  let o = "", s = 0;
  for (; ; ) {
    const d = n.indexOf("var(", s);
    if (d < 0)
      return o += n.slice(s), o;
    o += n.slice(s, d);
    let m = 1, f = d + 4;
    for (; f < n.length && m; f++)
      n[f] === "(" ? m++ : n[f] === ")" && m--;
    const h = n.slice(d + 4, f - 1), y = ie(h, ","), _ = y[0].trim(), w = y.length > 1 ? h.slice(h.indexOf(",") + 1).trim() : null;
    let b = l(_);
    if ((b == null || b === "initial") && (b = w), b == null) return null;
    const S = vs(b, l, i + 1);
    if (S === null) return null;
    o += S, s = f;
  }
}
function tg(n) {
  const l = [], i = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let o, s = 0;
  for (; s < n.length; ) {
    if (i.lastIndex = s, o = i.exec(n), !o || o.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = i.lastIndex, o[1] !== void 0 ? l.push({ num: parseFloat(o[1]), unit: (o[2] ?? "").toLowerCase() }) : o[3] ? l.push({ fn: o[3].toLowerCase() }) : o[4] ? l.push({ num: 1 / 0, unit: "" }) : l.push({ op: o[5] ?? o[6] });
  }
  return l;
}
function Yn(n, l) {
  const i = tg(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!i) return null;
  let o = 0;
  const s = ({ num: b, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: b, unitless: !0 };
      case "px":
        return { px: b, pct: 0, num: 0 };
      case "rem":
        return { px: b * gs, pct: 0, num: 0 };
      case "em":
        return { px: b * (l.fontSize ?? gs), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: b, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: b / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: b / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: b * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (b, S, N) => b && S ? { px: b.px + N * S.px, pct: b.pct + N * S.pct, num: b.num + N * S.num, unitless: b.unitless && S.unitless } : null, m = (b, S) => b ? { px: b.px * S, pct: b.pct * S, num: b.num * S, unitless: b.unitless } : null, f = (b) => b && b.unitless;
  function h() {
    const b = i[o++];
    if (!b) return null;
    if (b.num !== void 0) return s(b);
    if (b.op === "(") {
      const S = _();
      return i[o]?.op !== ")" ? null : (o++, S);
    }
    if (b.op === "-" || b.op === "+") {
      const S = h();
      return b.op === "-" ? m(S, -1) : S;
    }
    if (b.fn) {
      const S = [];
      for (; ; ) {
        S.push(_());
        const E = i[o++];
        if (!E) return null;
        if (E.op === ")") break;
        if (E.op !== ",") return null;
      }
      if (S.some((E) => !E)) return null;
      if (b.fn === "calc") return S[0];
      if (!(S.every((E) => !E.pct) || S.every((E) => !E.px && !E.num))) return null;
      const O = (E) => E.px + E.pct + E.num;
      return b.fn === "min" ? S.reduce((E, j) => O(j) < O(E) ? j : E) : b.fn === "max" ? S.reduce((E, j) => O(j) > O(E) ? j : E) : b.fn === "clamp" && S.length === 3 ? O(S[1]) < O(S[0]) ? S[0] : O(S[1]) > O(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function y() {
    let b = h();
    for (; i[o] && (i[o].op === "*" || i[o].op === "/"); ) {
      const S = i[o++].op, N = h();
      if (!b || !N) return null;
      S === "*" ? b = f(N) ? m(b, N.num) : f(b) ? m(N, b.num) : null : b = f(N) && N.num !== 0 ? m(b, 1 / N.num) : null;
    }
    return b;
  }
  function _() {
    let b = y();
    for (; i[o] && (i[o].op === "+" || i[o].op === "-"); ) {
      const S = i[o++].op;
      b = d(b, y(), S === "-" ? -1 : 1);
    }
    return b;
  }
  const w = _();
  return o !== i.length || !w ? null : w;
}
function ys(n, l) {
  const i = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(i))
    return i === "thin" ? { px: 1 } : i === "medium" ? { px: 3 } : i === "thick" ? { px: 5 } : i;
  const o = Yn(i, l);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: n.trim() } : o.pct && (o.px || o.num) ? { expr: n.trim() } : o.pct ? { pct: o.pct } : { px: eg(o.px) } : { expr: n.trim() };
}
const eg = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Or = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), ng = ([n, l, i, o]) => `#${Or(n)}${Or(l)}${Or(i)}${Or(o * 255)}`;
function lf(n) {
  const l = n.slice(1), i = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return null;
  const o = (s) => parseInt(i.slice(s, s + 2), 16);
  return [o(0), o(2), o(4), i.length === 8 ? o(6) / 255 : 1];
}
function Wr(n, l) {
  const i = n.trim().toLowerCase();
  if (i === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(i);
  if (o) {
    const y = l(o[1]), _ = y && lf(y);
    return _ ? { rgba: _, token: o[1] } : null;
  }
  if (i.startsWith("#")) {
    const y = lf(i);
    return y ? { rgba: y, token: null } : null;
  }
  if (af[i]) return { rgba: [...af[i]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(i);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = ie(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const _ = (R) => {
      const Y = ie(R), W = Y.findIndex(($) => /%$/.test($)), q = W >= 0 ? parseFloat(Y[W]) / 100 : null;
      return { color: Wr(Y.filter(($, Q) => Q !== W).join(" "), l), pct: q };
    }, w = _(y[1]), b = _(y[2]);
    if (!w.color || !b.color || w.color === "currentcolor" || b.color === "currentcolor") return null;
    let S = w.pct, N = b.pct;
    S === null && N === null ? (S = 0.5, N = 0.5) : S === null ? S = 1 - N : N === null && (N = 1 - S);
    const O = S + N, E = O < 1 ? O : 1;
    S /= O, N /= O;
    const [j, D, B, J] = w.color.rgba, [Z, T, p, v] = b.color.rgba, x = J * S + v * N, k = (R, Y) => x === 0 ? 0 : (R * J * S + Y * v * N) / x, C = [k(j, Z), k(D, T), k(B, p), x * E], z = v === 0 ? w.color.token : J === 0 ? b.color.token : null;
    return { rgba: C, token: z };
  }
  const d = s[2].includes(",") ? ie(s[2], ",") : ie(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const m = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), h = [m(d[0]), m(d[1]), m(d[2]), f];
  return h.some((y) => Number.isNaN(y)) ? null : { rgba: h, token: null };
}
const Sl = ["top", "right", "bottom", "left"], ag = ["top-left", "top-right", "bottom-right", "bottom-left"], Rr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], rf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function xs(n, l) {
  const i = l.trim(), o = () => ie(i);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Rr(o());
      return Sl.map((d, m) => [`${n}-${d}`, s[m]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = o(), d = n.split("-")[0];
      return [[`${d}-left`, s[0]], [`${d}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = o(), d = n.split("-")[0];
      return [[`${d}-top`, s[0]], [`${d}-bottom`, s[1] ?? s[0]]];
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
      const s = Rr(o());
      return Sl.map((d, m) => [d, s[m]]);
    }
    case "inset-inline": {
      const s = o();
      return [["left", s[0]], ["right", s[1] ?? s[0]]];
    }
    case "inset-block": {
      const s = o();
      return [["top", s[0]], ["bottom", s[1] ?? s[0]]];
    }
    case "inset-inline-start":
      return [["left", i]];
    case "inset-inline-end":
      return [["right", i]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const s = n.split("-")[1], d = Rr(o());
      return Sl.map((m, f) => [`border-${m}-${s}`, d[f]]);
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
      const s = n === "border" ? Sl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", m = "none", f = "currentcolor";
      if (i !== "none" && i !== "0")
        for (const h of o())
          rf.has(h) ? m = h : /^(thin|medium|thick|-?[\d.]|calc\()/.test(h) ? d = h : f = h;
      else i === "0" && (d = "0");
      return s.flatMap((h) => [[`border-${h}-width`, d], [`border-${h}-style`, m], [`border-${h}-color`, f]]);
    }
    case "border-inline-width": {
      const s = o();
      return [["border-left-width", s[0]], ["border-right-width", s[1] ?? s[0]]];
    }
    case "border-block-width": {
      const s = o();
      return [["border-top-width", s[0]], ["border-bottom-width", s[1] ?? s[0]]];
    }
    case "border-inline-style": {
      const s = o();
      return [["border-left-style", s[0]], ["border-right-style", s[1] ?? s[0]]];
    }
    case "border-inline-color": {
      const s = o();
      return [["border-left-color", s[0]], ["border-right-color", s[1] ?? s[0]]];
    }
    case "border-radius": {
      const s = Rr(ie(i.split("/")[0]));
      return ag.map((d, m) => [`border-${d}-radius`, s[m]]);
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
      return i === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Wr(i, () => "#000000") ? [["background-color", i], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", i]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(i) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((s) => [s, i]) : [[n, i]];
    case "overflow": {
      const s = o();
      return [["overflow-x", s[0]], ["overflow-y", s[1] ?? s[0]]];
    }
    case "gap": {
      const s = o();
      return [["row-gap", s[0]], ["column-gap", s[1] ?? s[0]]];
    }
    case "grid-gap":
      return xs("gap", i);
    case "place-items": {
      const s = o();
      return [["align-items", s[0]], ["justify-items", s[1] ?? s[0]]];
    }
    case "place-self": {
      const s = o();
      return [["align-self", s[0]], ["justify-self", s[1] ?? s[0]]];
    }
    case "place-content": {
      const s = o();
      return [["align-content", s[0]], ["justify-content", s[1] ?? s[0]]];
    }
    case "flex": {
      if (i === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (i === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (i === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const s = o(), d = s.filter((f) => /^[\d.]+$/.test(f)), m = s.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", m ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const d of o()) s.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return s;
    }
    case "outline": {
      if (i === "none" || i === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", d = "none", m = "currentcolor";
      for (const f of o())
        rf.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
      return [["outline-width", s], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (i === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ie(i, ","), d = s.map((f) => ie(f).find((h) => !/^[\d.]+m?s$/.test(h) && !/^(ease|linear|step|cubic)/.test(h)) ?? "all"), m = s.map((f) => ie(f).find((h) => /^[\d.]+m?s$/.test(h)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", o()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", i]];
    case "word-wrap":
      return [["overflow-wrap", i]];
    default:
      return [[n, i]];
  }
}
function lg(n, l) {
  return n ? ie(n, ",").some((i) => {
    let o = i.trim().toLowerCase(), s = !1;
    o.startsWith("not ") && (s = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const d = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const h = f[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(h);
      if (y) {
        const [, w, b] = y, S = (N) => {
          const O = ys(N, { viewport: l });
          return typeof O == "object" && "px" in O ? O.px : NaN;
        };
        switch (w) {
          case "min-width":
            return l.width >= S(b);
          case "max-width":
            return l.width <= S(b);
          case "min-height":
            return l.height >= S(b);
          case "max-height":
            return l.height <= S(b);
          case "hover":
          case "any-hover":
            return b.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return b.trim() === "fine";
          case "prefers-reduced-motion":
            return b.trim() === "no-preference";
          case "prefers-color-scheme":
            return b.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const _ = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(h);
      if (_) {
        const w = _[1] === "width" ? l.width : l.height, b = ys(_[3], { viewport: l }), S = typeof b == "object" && "px" in b ? b.px : NaN;
        switch (_[2]) {
          case ">=":
            return w >= S;
          case "<=":
            return w <= S;
          case ">":
            return w > S;
          case "<":
            return w < S;
          default:
            return w === S;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function rg(n, l) {
  const i = l[l.length - 1].compound;
  return Hs(i)[0] ?? n;
}
function ig(n) {
  const l = (i) => i.some((o) => ui.has(o.name) || (o.list ?? []).some((s) => s.some(({ compound: d }) => l(d.pseudos))));
  return l(n[n.length - 1].compound.pseudos);
}
function og(n) {
  const l = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = (s, d) => {
    s.forEach(({ compound: m }, f) => {
      const h = d && f === s.length - 1;
      for (const y of m.pseudos)
        if (ui.has(y.name) && (h ? l : i).add(y.name), y.list && y.name !== "not") for (const _ of y.list) o(_, h);
    });
  };
  return o(n, !0), { subject: l, ancestor: i };
}
function Hs(n) {
  const l = [...n.classes];
  for (const i of n.pseudos)
    if (!(i.name !== "is" && i.name !== "where"))
      for (const o of i.list) o.length === 1 && l.push(...Hs(o[0].compound));
  return l;
}
function sg(n, l) {
  const i = (o, s) => {
    o.forEach(({ compound: d }, m) => {
      const f = s && m === o.length - 1, h = d.pseudos.filter((y) => ui.has(y.name)).map((y) => y.name);
      if (!f) for (const y of h) for (const _ of Hs(d)) l.add(`${y}:${_}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const _ of y.list) i(_, f);
    });
  };
  i(n, !0);
}
class cg {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const i = (d, m) => {
      const f = m[m.length - 1].compound, h = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(h) || this.index.set(h, []), this.index.get(h).push(d);
    };
    let o = 0;
    const s = (d, m) => {
      for (const [f, h, y, _] of d)
        for (const w of js(f)) {
          let b;
          try {
            b = Os(w);
          } catch (E) {
            if (E instanceof re) {
              this.skipped++;
              continue;
            }
            throw E;
          }
          const S = og(b);
          sg(b, this.trackedStates);
          const N = b[b.length - 1].compound.pseudoElement, O = { steps: b, media: h, layer: y, origin: m, order: o++, specificity: Bf(b), decls: _, states: S, pseudo: N, own: mg(b), assumed: ig(b), above: dg(b), source: m === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : rg(w, b) };
          this.rules.push(O), i(O, b);
        }
    };
    s($0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(l, i = null) {
    const o = l.getAttribute?.("id") ?? null, s = `${l.tagName} ${l.className}|${i ?? ""}|${o ?? ""}`, d = this.candidateCache.get(s);
    if (d) return d;
    const m = [], f = /* @__PURE__ */ new Set(), h = new Set(l.classList), y = (_) => {
      if (_) for (const w of _) !f.has(w) && w.pseudo === i && (f.add(w), Ff(w.steps[w.steps.length - 1].compound, l.tagName, h, o) && m.push(w));
    };
    for (const _ of l.classList) y(this.index.get(`.${_}`));
    return y(this.index.get(l.tagName)), y(this.index.get("*")), this.candidateCache.set(s, m), m;
  }
  /** What the rules that may match `element` (any pseudo-element) read besides the element and its parent's computed
   * style: `anc`, an ancestor's attributes or state; `pos`, whether it is its parent's first or last child; `nth`, its
   * index; `ancPos`, an ancestor's position. The description's cache keys on exactly these (`describe.mjs`). */
  depends(l) {
    const i = `${l.tagName} ${l.className}`;
    let o = this.dependsCache.get(i);
    if (o) return o;
    o = { anc: !1, pos: !1, nth: !1, ancPos: !1 };
    const s = /* @__PURE__ */ new Set(), d = (m) => {
      for (const f of m ?? []) {
        if (s.has(f)) continue;
        s.add(f);
        const h = f.reads ??= If(f.steps);
        o.anc ||= h.anc, o.pos ||= h.pos, o.nth ||= h.nth, o.ancPos ||= h.ancPos;
      }
    };
    for (const m of l.classList) d(this.index.get(`.${m}`));
    return d(this.index.get(l.tagName)), d(this.index.get("*")), this.dependsCache.set(i, o), o;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(l, i) {
    return this.candidates(l).some((o) => o.states.ancestor.has(i));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(l, i) {
    for (const o of l.classList) if (this.trackedStates.has(`${i}:${o}`)) return !0;
    return !1;
  }
}
function Ff(n, l, i, o) {
  if (n.tag && n.tag !== "*" && n.tag !== l || n.id && n.id !== o) return !1;
  for (const s of n.classes) if (!i.has(s)) return !1;
  for (const s of n.pseudos) {
    if (s.name === "has") return !0;
    if (s.name === "root" && l !== "html" || (s.name === "where" || s.name === "is") && s.list.every((d) => d.length === 1 && !Ff(d[0].compound, l, i, o))) return !1;
  }
  return !0;
}
const ug = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function dg(n) {
  const l = [];
  for (let i = n.length - 1; i > 0 && !(n[i].combinator !== " " && n[i].combinator !== ">"); i--)
    l.push(...n[i - 1].compound.classes);
  return l;
}
function $f(n) {
  const l = n.parentElement;
  if (!l) return fg;
  const i = $f(l), o = n.aboveCache;
  if (o && o.parent === l && o.name === l.className && o.base === i) return o.set;
  const s = l.classSet, d = s.size === 0 ? i : /* @__PURE__ */ new Set([...i, ...s]);
  return n.aboveCache = { parent: l, name: l.className, base: i, set: d }, d;
}
const fg = /* @__PURE__ */ new Set();
function mg(n) {
  if (n.length !== 1) return !1;
  const { compound: l } = n[0];
  return !l.id && !l.attrs.length && l.pseudos.every((i) => ui.has(i.name) && i.name !== "focus-within");
}
function If(n, l = !0, i = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((o, s) => {
    const d = l && s === n.length - 1;
    d || (i.anc = !0);
    for (const m of o.compound.pseudos)
      if (ug.has(m.name) && (d ? i.pos = !0 : i.ancPos = !0, m.name === "nth-child" && d && (i.nth = !0)), m.list && m.name !== "has") for (const f of m.list) If(f, d, i);
  }), i;
}
const pg = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function hg(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [i, o] of Object.entries(n)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const s = i.startsWith("--") ? i : i.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof o == "number" && o !== 0 && !pg.has(s) && !s.startsWith("--") ? `${o}px` : String(o);
    l.push([s, d]);
  }
  return l;
}
function gg(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const i of ["width", "height"]) {
    const o = n.getAttribute(i);
    o !== null && l.push([i, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return l;
}
const bg = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class vg {
  constructor(l, { theme: i, viewport: o }) {
    this.sheet = l, this.theme = i, this.viewport = o, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(l) {
    if (!l.media) return !0;
    for (const i of l.media) {
      let o = this.media.get(i);
      if (o === void 0 && this.media.set(i, o = lg(i, this.viewport)), !o) return !1;
    }
    return !0;
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, i, o = null, s = null) {
    const m = { state: (N, O, E) => {
      if (O === "disabled") return !!N.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(N.tagName);
      if (O === "enabled") return !N.props?.disabled && ["button", "input", "select", "textarea"].includes(N.tagName);
      if (O === "checked") return !!N.props?.checked;
      if (i === "*") return !0;
      if (O === "focus-within") {
        const j = N.ownerDocument?.activeElement;
        return !!j && j !== N.ownerDocument.body && typeof N.contains == "function" && N.contains(j);
      }
      return E ? i.has(O) : O === "focus-visible" ? !!N.state?.focus && !N.state?.pointerFocus : !!N.state?.[O];
    }, pseudo: o }, f = this.sheet.candidates(l, o), h = `${l.tagName} ${l.className}|${o ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let y = this.ownMatches.get(h);
    y || (y = new Set(f.filter((N) => N.own && this.mediaHolds(N) && ds(l, N.steps, m))), this.ownMatches.set(h, y));
    let _ = null;
    const w = (N) => N.above.length ? (_ ??= $f(l), N.above.every((O) => _.has(O))) : !0, b = s && i !== "*" ? s[o ?? ""] ??= /* @__PURE__ */ new Map() : null, S = (N) => this.mediaHolds(N) && w(N) && ds(l, N.steps, m);
    return f.filter((N) => {
      if (N.own) return y.has(N);
      if (!b || N.assumed) return S(N);
      let O = b.get(N);
      return O === void 0 && b.set(N, O = S(N)), O;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, i, o = /* @__PURE__ */ new Set(), s = null, d = null) {
    const m = this.matching(l, o, s, d), f = s ? [] : gg(l), h = s ? [] : hg(l.inlineStyle ?? l.props?.style);
    let y = this.rootComputed;
    i && (y = this.computed.get(i.values), y || this.computed.set(i.values, y = /* @__PURE__ */ new Map()));
    const _ = `${m.map((b) => b.order).join(",")}|${f.length ? JSON.stringify(f) : ""}|${h.length ? JSON.stringify(h) : ""}`;
    let w = y.get(_);
    return w || y.set(_, w = this.cascade(m, f, h, i)), { ...w, rules: m, element: l, shared: w };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, i, o, s) {
    const d = [];
    for (const p of l)
      for (const [v, x, k] of p.decls) d.push({ prop: v, value: x, important: k ? 1 : 0, origin: p.origin === 0 ? 0 : 2, layer: p.layer, specificity: p.specificity, order: p.order, source: p.source });
    for (const [p, v] of i) d.push({ prop: p, value: v, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${p}` });
    for (const [p, v] of o) d.push({ prop: p, value: v, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(bg);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), h = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const p of d) p.prop.startsWith("--") && y.set(p.prop, p.value);
    if (!s && this.theme) for (const p of Zf) this.theme[p] && y.set(`--${p}`, `perchtoken(${p})`);
    const _ = (p) => {
      if (h.has(p)) return h.get(p);
      const v = m[p];
      return v && !v.inherits ? v.initial ?? null : p in f ? f[p] : v?.initial ?? null;
    }, w = /* @__PURE__ */ new Set(), b = (p) => {
      if (!y.has(p)) return _(p);
      if (w.has(p)) return null;
      w.add(p);
      const v = vs(y.get(p), b);
      return w.delete(p), y.delete(p), h.set(p, v), (!m[p] || m[p].inherits) && (f[p] = v), v;
    };
    for (const p of [...y.keys()]) b(p);
    const S = /* @__PURE__ */ new Map();
    for (const p of d) {
      if (p.prop.startsWith("--")) continue;
      const v = vs(p.value, _);
      if (v === null) {
        for (const [x] of xs(p.prop, "unset")) S.set(x, { value: "unset", source: p.source, origin: p.origin });
        continue;
      }
      for (const [x, k] of xs(p.prop, v)) S.set(x, { value: k, source: p.source, origin: p.origin });
    }
    const N = {}, O = {}, E = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), D = s?.values, B = { fontSize: D?.["font-size"] ?? gs, viewport: this.viewport }, J = (p, v) => {
      if (/currentcolor/i.test(v)) return this.parseValue(p, v, B, N, D);
      const x = `${p}\0${v}\0${B.fontSize}`;
      let k = this.parsed.get(x);
      return k === void 0 && this.parsed.set(x, k = this.parseValue(p, v, B, N, D)), k;
    }, Z = S.size ? [...bs, ...[...S.keys()].filter((p) => !P0.has(p))] : bs;
    for (const p of Z) {
      const v = S.get(p);
      let x = v?.value;
      const k = I0.has(p);
      if ((x === void 0 || x === "unset" || x === "revert" || x === "revert-layer") && (x = k ? "inherit" : "initial"), v && (O[p] = v.source, v.origin !== 0 && E.add(p)), x === "inherit" && D && p in D) {
        N[p] = D[p], j.add(p);
        continue;
      }
      (x === "inherit" || x === "initial") && (x = k ? Wf[p] : Jf[p]), N[p] = J(p, x), p === "font-size" && (B.fontSize = N["font-size"]);
    }
    for (const p of Sl) {
      const v = N[`border-${p}-style`];
      (v === "none" || v === "hidden") && (N[`border-${p}-width`] = { px: 0 });
    }
    N["outline-style"] === "none" && (N["outline-width"] = { px: 0 });
    const T = D?.display;
    return (T === "flex" || T === "inline-flex" || T === "grid" || T === "inline-grid") && N.position !== "absolute" && N.position !== "fixed" && (N.display = of(N.display)), (N.position === "absolute" || N.position === "fixed") && (N.display = of(N.display)), { values: N, sources: O, own: E, inherited: j, customs: f };
  }
  parseValue(l, i, o, s, d) {
    const m = String(i).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), h = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (h[f]) return h[f];
        if (f === "smaller") return o.fontSize / 1.2;
        if (f === "larger") return o.fontSize * 1.2;
        const y = Yn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return !y || y.num ? o.fontSize : y.px + y.pct / 100 * o.fontSize;
      }
      case "font-weight": {
        const f = m.toLowerCase();
        if (f === "normal") return 400;
        if (f === "bold") return 700;
        if (f === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (f === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const h = parseFloat(f);
        return Number.isFinite(h) ? h : 400;
      }
      case "line-height": {
        const f = m.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const h = Yn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return h ? h.unitless ? { factor: h.num } : { px: h.px + h.pct / 100 * o.fontSize } : { normal: !0 };
      }
      case "font-family":
        return m;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const f = m.endsWith("%") ? parseFloat(m) / 100 : parseFloat(m);
        return Number.isFinite(f) ? f : parseFloat(l === "flex-shrink" || l === "opacity" ? 1 : 0);
      }
      case "color": {
        const f = Wr(m, (h) => this.themeHex(h));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Wr(m, (h) => this.themeHex(h));
        return f === "currentcolor" ? s.color : f ?? { rgba: [0, 0, 0, 0], token: null, unreadable: m };
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
        return ys(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function of(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Fr = (n) => n && n.rgba ? { value: ng(n.rgba), token: n.token ?? null } : null, yg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function xg(n, l) {
  const i = l?.(n);
  if (Number.isFinite(i)) return i;
  const o = Math.round(n * 100) / 100;
  return yg[o] ?? Math.round(n * 1.2);
}
function zl(n, l) {
  const i = n["line-height"], o = n["font-size"];
  return i.normal ? xg(o, l) : i.factor !== void 0 ? i.factor * o : i.px;
}
const wg = (n) => ie(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const _g = "perch-native-description/1", Fe = Symbol("display"), $r = {
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
for (const n of kg) $r[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
$r.rounded = 0;
const Sg = /* @__PURE__ */ new Set([
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
]), Eg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, zg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, Ng = (n) => zg.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : Eg.test(n) ? ".SystemUIFont" : wg(n).split(",")[0].trim(), Tg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, sf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Bs = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const i = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (i) return `${n.tagName}.${i}`;
  const o = n.parentElement;
  return o && o.tagName !== "body" ? `${Bs(o)} > ${n.tagName}` : n.tagName;
};
class Cg {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, i, o, s, d, m = "") {
    const f = `${l}|${i}|${o}|${s}`, h = this.map.get(f);
    if (h) {
      !h.elements.includes(d) && h.elements.length < 4 && h.elements.push(d), h.count++;
      return;
    }
    this.map.set(f, { kind: l, property: i, value: String(o), class: s ?? null, elements: [d], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((l, i) => l.kind < i.kind ? -1 : l.kind > i.kind ? 1 : l.property < i.property ? -1 : l.property > i.property ? 1 : 0);
  }
}
const hn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, Mg = /^(text|search|url|email|tel|password|number)$/, Ag = 162.13 / 12.8;
function jg(n, l) {
  const i = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!i) return;
  const o = ie(i[1], ",").map((s) => Yn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return o.length ? Math.min(...o) : void 0;
}
function Og(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const i = Yn(n.expr, { fontSize: l["font-size"] }), o = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!i && !i.num && i.pct === 100 && Math.abs(i.px + o) < 0.01;
}
function Pf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = o && ie(o[2], ",").map((d) => d.trim());
    return !s || s.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [s[0], "0"] : o[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const i = n.translate;
  if (i && i !== "none") {
    const o = ie(String(i).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && Yn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function cf(n, l, i, o = !1) {
  const s = n.values, d = Pf(s);
  if (d?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, h = (w, b) => {
    const S = Yn(w, f);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof b == "number" ? S.px + S.pct / 100 * b : void 0 : S.px;
  }, y = d ? h(d[0], l.w) : void 0, _ = d ? h(d[1], l.h) : void 0;
  if (y === void 0 || _ === void 0) {
    const w = !o && d ? d.map((b) => Yn(b, f)) : null;
    if (w?.every((b) => b && !(b.unitless && b.num))) {
      l[tm] = w.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    i("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (o) {
    y && (l.left = y), _ && (l.top = _);
    return;
  }
  y && (l.ml = (l.ml ?? 0) + y), _ && (l.mt = (l.mt ?? 0) + _);
}
const tm = Symbol("perch.shift");
function Rg(n, l, i) {
  const o = n.ownerDocument, s = o?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [h, y]] = i, _ = m + f / 100 * s.width, w = h + y / 100 * s.height;
    _ && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + _), w && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + w);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Lf && o?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function Ir(n, l, i = null) {
  const o = n.values, s = {}, d = (B) => n.sources[B], m = (B) => n.sources[B] !== void 0, f = o.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), o["grid-template-columns"] && o["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", o["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const h = s.display === "flex";
  if (h && s.flex_direction !== "col") {
    const B = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[o["flex-direction"]] ?? "row";
    s.flex_direction = B;
  }
  if (h) {
    (o["flex-wrap"] === "wrap" || o["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const B = f === "grid" || f === "inline-grid", J = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[o["align-items"]];
    J && (s.items = J);
    let Z = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (B) {
      const v = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      v && (s.items = v), o["align-items"] === "center" && (Z = "center");
    }
    Z && (s.justify = Z);
    const T = hn(o["row-gap"]), p = hn(o["column-gap"]);
    typeof T == "number" && T && (s.gap_y = T), typeof p == "number" && p && !B && (s.gap_x = p);
  }
  o["flex-grow"] && (s.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (s.flex_shrink = o["flex-shrink"]);
  const y = hn(o["flex-basis"]);
  y !== void 0 && y !== "auto" && (s.flex_basis = y);
  const _ = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  _ && (s.self = _);
  for (const [B, J] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const Z = o[J], T = hn(Z);
    if (T === void 0 && J === "width" && Og(Z, o)) {
      s.self = "stretch", l("approximated", J, Z.expr, d(J), "stretched across its parent, inside its margins");
      continue;
    }
    const p = T === void 0 && /^max-/.test(J) ? jg(Z, o["font-size"]) : void 0;
    if (p !== void 0) {
      s[B] = p, l("approximated", J, Z.expr, d(J), "the fixed bound of min()");
      continue;
    }
    if (T === void 0) {
      typeof Z == "object" && Z.expr ? l("unsupported", J, Z.expr, d(J), "no calc() in the engine") : typeof Z == "string" && !["auto", "none"].includes(Z) && l("unsupported", J, Z, d(J));
      continue;
    }
    T !== "auto" && (s[B] = T);
  }
  const w = ["top", "right", "bottom", "left"];
  for (const B of w) {
    const J = B[0];
    for (const [Z, T] of [["p", "padding"], ["m", "margin"]]) {
      const p = o[`${T}-${B}`], v = hn(p);
      if (v === void 0) {
        p?.expr && l("unsupported", `${T}-${B}`, p.expr, d(`${T}-${B}`), "no calc() in the engine");
        continue;
      }
      v !== 0 && (s[`${Z}${J}`] = v);
    }
  }
  const b = o.position;
  if (b === "absolute" || b === "fixed") {
    s.position = "absolute", b === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const B of w) {
      const J = hn(o[B]);
      J !== void 0 && J !== "auto" && (s[B] = J);
    }
    if (b === "fixed" && i && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const B = i.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, B) : B;
    }
    cf(n, s, l);
  } else b === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Pf(o)?.length !== 0 && (s.position = "relative", cf(n, s, l, !0));
  o["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", o["z-index"], d("z-index"), "paint order is tree order");
  for (const [B, J] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const Z = o[J];
    Z === "hidden" || Z === "clip" ? s[B] = "hidden" : (Z === "auto" || Z === "scroll") && (s[B] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (s.visibility = "invisible");
  const S = o["background-color"];
  S?.unreadable ? l("unsupported", "background-color", S.unreadable, d("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = Fr(S)), o["background-image"] && o["background-image"] !== "none" && l("unsupported", "background-image", o["background-image"], d("background-image"));
  const N = w.map((B) => hn(o[`border-${B}-width`]) || 0), O = [];
  w.forEach((B, J) => {
    if (!N[J]) return;
    s[`border_${B[0]}`] = N[J];
    const Z = o[`border-${B}-style`];
    Z !== "solid" && l("approximated", `border-${B}-style`, Z, d(`border-${B}-style`), "drawn solid");
    const T = Fr(o[`border-${B}-color`]);
    T && O.push(T);
  }), O.length && (s.border_color = O[0], O.some((B) => B.value !== O[0].value) && l("approximated", "border-color", O.map((B) => B.value).join(" "), d("border-top-color"), "one border colour"));
  const E = (B) => {
    const J = hn(o[`border-${B}-radius`]) || 0;
    if (typeof J != "string") return J;
    const Z = parseFloat(J) / 100, T = [s.w, s.h].filter((p) => typeof p == "number");
    return J === "auto" || !(Z > 0) ? 0 : T.length ? Math.round(Math.min(Z, 0.5) * Math.min(...T) * 100) / 100 : 9999;
  }, j = ["top-left", "top-right", "bottom-right", "bottom-left"].map(E);
  j.every((B) => B === j[0]) ? j[0] && (s.rounded = j[0]) : ["tl", "tr", "br", "bl"].forEach((B, J) => {
    j[J] && (s[`rounded_${B}`] = j[J]);
  }), o.opacity !== 1 && (s.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const D = o["box-shadow"];
  if (D && D !== "none" && ie(D, ",").some((B) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(B.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", D, d("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !n.inherited.has("cursor")) {
    const B = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    B ? s.cursor = B : l("unsupported", "cursor", o.cursor, d("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? s.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", o["text-decoration-line"], d("text-decoration-line")), s;
}
const Dg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function em(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((i) => Dg[i]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Pr(n, l) {
  const i = n.values, o = i["line-height"];
  return {
    text_color: Fr(i.color),
    text_size: Math.round(i["font-size"] * 1e3) / 1e3,
    font_features: em(i["font-variant-numeric"]) ?? "",
    font_weight: i["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(zl(i, l) * 1e3) / 1e3 },
    font_family: Ng(i["font-family"]),
    italic: i["font-style"] === "italic" || i["font-style"] === "oblique",
    whitespace: i["white-space"] === "nowrap" || i["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[i["text-align"]] ?? "left"
  };
}
const uf = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, Us = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function ti(n, l, i) {
  const o = {}, s = (f, h) => h.some((y) => !n.inherited.has(y));
  for (const [f, h] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, h) || !Us(l[f], i[f])) && (o[f] = l[f]);
  const d = uf(l.line_height, l.text_size), m = i.line_height ? uf(i.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (o.line_height = l.line_height), o;
}
const Hg = (n, l) => ({ ...n, ...l });
function ei(n, l) {
  const i = {};
  for (const [o, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (i[o] = s.value, s.token && (l[o] = s.token)) : o === "line_height" ? i[o] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : o === "italic" ? s && (i.italic = !0) : i[o] = s;
  return i.italic === !1 && delete i.italic, i;
}
function nm(n, l) {
  const i = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[o], d = l[o];
    Us(s, d) || (i[o] = d === void 0 ? o in $r ? $r[o] : null : d);
  }
  return i;
}
function df(n, l) {
  const i = n.values;
  for (const [o, s] of Object.entries(n.sources)) {
    if (o.startsWith("--") || Sg.has(o) || s.startsWith("ua:")) continue;
    const d = i[o];
    switch (o) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", o, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && em(d) === null && l("unsupported", o, d, s);
        break;
      case "text-transform":
        d !== "none" && l("approximated", o, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = i["transition-duration"];
        o === "transition-property" && m && ie(m, ",").some((f) => parseFloat(f) > 0) && i["transition-property"] !== "none" && l("unsupported", "transition", `${i["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && l("unsupported", o, d, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        o === "overflow-wrap" && d !== "normal" && l("approximated", o, d, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        i["outline-style"] !== "none" && o === "outline-style" && l("unsupported", "outline", `${hn(i["outline-width"])}px ${i["outline-style"]} ${Fr(i["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && l("unsupported", o, d, s);
        break;
    }
  }
}
function Bg(n, l, i, o) {
  const s = Bs(n), d = {}, m = o.cascade.compute(n, l, /* @__PURE__ */ new Set(), null, d), f = o.cascade.matching(n, "*").filter((D) => D.states.subject.size), h = [];
  for (const [D, B] of Ug)
    f.some((J) => B.some((Z) => J.states.subject.has(Z))) && h.push([D, o.cascade.compute(n, l, new Set(B), null, d)]);
  const y = `${rs(m.shared)}|${rs(i)}|${+!!m.element.hidden}|${h.map(([D, B]) => `${D}${rs(B.shared)}`).join(",")}`;
  let _ = (o.cascade.styled ??= /* @__PURE__ */ new Map()).get(y);
  _ || o.cascade.styled.set(y, _ = Yg(m, h, i, o));
  const { style: w, tokens: b, shift: S, childText: N } = _, O = _.reports.map(([D, B, J, Z, T]) => [D, B, J, Z, s, T]), E = { ..._.extra };
  if (o.cascade.sheet.tracks(n, "hover") && (E.group = mf(n), E.track_hover = !0), o.cascade.sheet.readsAncestor(n, "hover"))
    for (let D = n.parentNode; D?.state; D = D.parentNode) {
      if (!o.cascade.sheet.tracks(D, "hover")) continue;
      const B = D.state.hover;
      D.state.hover = !0;
      let J;
      try {
        J = o.cascade.compute(n, l);
      } finally {
        D.state.hover = B;
      }
      const Z = {}, T = ei({ ...Ir(J, () => {
      }), ...ti(J, Pr(J, o.measure), i) }, Z), p = nm(w, T);
      if (!Object.keys(p).length) continue;
      const v = Object.fromEntries(Object.entries(Z).filter(([x]) => x in p));
      (E.group_hover ??= []).push({ group: mf(D), style: p, ...Object.keys(v).length ? { tokens: v } : {} });
    }
  if (/tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (E.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (E.break_anywhere = !0), _.scrolls) {
    const D = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    D > 0 && (E.scrollbar = D);
  }
  m.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (E.blocks_pointer = !0), m.values["pointer-events"] === "none" && (E.pointer_none = !0);
  const j = Object.entries(Tg).filter(([, D]) => D.some((B) => typeof n.props[B] == "function")).map(([D]) => D);
  return !j.includes("click") && hs(n) && j.push("click"), j.length && (E.events = j), { computed: m, style: w, tokens: b, extra: E, meta: Wg(n), reports: O, childText: N, where: s, shift: S };
}
const Ug = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], ff = /* @__PURE__ */ new WeakMap();
let qg = 0;
function rs(n) {
  let l = ff.get(n);
  return l === void 0 && ff.set(n, l = ++qg), l;
}
function Yg(n, l, i, o) {
  const s = [], d = (b, S, N, O, E) => s.push([b, S, N, O ?? "(user agent)", E]), m = {}, f = Ir(n, d, o.viewport);
  df(n, d);
  const h = Pr(n, o.measure), y = ti(n, h, i), _ = ei({ ...f, ...y }, m), w = {};
  for (const [b, S] of l) {
    const N = {}, O = ei({ ...Ir(S, () => {
    }), ...ti(S, Pr(S, o.measure), i) }, N);
    b === "focus" && df(S, d);
    const E = nm(_, O);
    if (Object.keys(E).length) {
      w[b] = E;
      const j = Object.fromEntries(Object.entries(N).filter(([D]) => D in E));
      Object.keys(j).length && (w[`${b}_tokens`] = j);
    }
  }
  return { style: _, tokens: m, shift: f[tm], childText: Hg(i, y), extra: w, scrolls: f.overflow_y === "scroll", reports: s };
}
function Gg(n, l, i, o) {
  const s = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!o.cascade.matching(n, /* @__PURE__ */ new Set(), d).length) continue;
    const m = o.cascade.compute(n, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const h = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", y = (N, O, E, j, D) => o.add(N, O, E, j ?? "(user agent)", `${Bs(n)}::${d}`, D), _ = {}, w = Ir(m, y, o.viewport), S = { kind: "div", style: ei({ ...w, ...ti(m, Pr(m, o.measure), i) }, _), tokens: _, children: h ? [{ kind: "text", text: h }] : [] };
    Object.defineProperty(S, Fe, { value: m.values.display }), s[d] = S;
  }
  return s;
}
const mf = (n) => `~g${n.id}`, Lg = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function Qg(n) {
  return n.kind === "div" && n[Fe] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !Lg.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function Dr(n, l) {
  const i = n[l], o = { ...i, style: { ...i.style } };
  return Object.defineProperty(o, Fe, { value: i[Fe] }), n[l] = o, o;
}
function Vg(n) {
  const l = [];
  for (let i = n.parentElement; i?.parentElement; i = i.parentElement) {
    const o = i.parentElement.children;
    l.push(`${+(o[0] === i)}${+(o[o.length - 1] === i)}`);
  }
  return l.join("");
}
function am(n, l, i, o, s = 0, d = !0, m = !0, f = 0) {
  const h = o.cascade.sheet.depends(n), y = h.pos ? `${+d}${+m}${h.nth ? `:${f}` : ""}` : "", _ = h.ancPos ? Vg(n) : "";
  let w = o.cache.get(n);
  const b = w && w.version === n.version && w.parentValues === l?.values && w.inheritedText === i && w.pos === y && w.ancPos === _ && (!h.anc || s <= w.at);
  if (b && w.node && w.stamp === n.stamp && !w.volatile && (!w.subAnc || s <= w.subAt)) {
    for (const E of w.log) o.add(...E);
    return w.node;
  }
  if (!b) {
    const E = Bg(n, l, i, o);
    w && Us(w.part.childText, E.childText) && (E.childText = w.part.childText), w = { version: n.version, parentValues: l?.values, inheritedText: i, pos: y, ancPos: _, at: o.now, part: E }, o.cache.set(n, w);
  }
  const S = o.log.length, N = { volatile: !!w.part.shift || h.ancPos, subAnc: h.anc }, O = Kg(n, w, o, Math.max(s, n.attrStamp), N);
  return Object.assign(w, { node: O, stamp: n.stamp, subAt: o.now, log: o.log.slice(S), volatile: N.volatile, subAnc: N.subAnc }), O;
}
function Kg(n, l, i, o, s) {
  const { computed: d, tokens: m, extra: f, reports: h, childText: y, where: _ } = l.part;
  for (const x of h) i.add(...x);
  const w = (x, k, C, z, R) => i.add(x, k, C, z, _, R), b = { ...l.part.style };
  l.part.shift && Rg(n, b, l.part.shift);
  const S = { kind: "div", id: n.id, style: b, tokens: m, meta: l.part.meta, ...f };
  Object.defineProperty(S, Fe, { value: d.values.display }), n.measured && n.ownerDocument?.measureKey && (S.measure = n.ownerDocument.measureKey(n));
  const N = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return S.kind = "engine", S.engine = String(n.props["data-perch-engine"]), S.key = String(n.props["data-perch-key"] ?? ""), S;
  if (N === "svg")
    return S.kind = n.props["data-perch-image"] ? "image" : "svg", S.markup = $g(n), S;
  if (N === "input" || N === "textarea" || N === "select") {
    S.kind = "input", S.input_type = N === "input" ? String(n.props.type ?? "text") : N;
    for (const C of ["placeholder", "checked", "disabled"]) n.props[C] !== void 0 && (S[C] = n.props[C]);
    if (/^(checkbox|radio)$/.test(S.input_type) && (S.checked = n.checked), N !== "select" && (S.value = n.value), N === "input" && Mg.test(S.input_type) && (S.field_w = Ag * d.values["font-size"]), N === "textarea" && b.h === void 0) {
      const C = d.values, z = (W) => W && typeof W == "object" && "px" in W ? W.px : 0, R = (W) => C[`border-${W}-style`] === "none" ? 0 : z(C[`border-${W}-width`]), Y = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      b.h = Y * zl(C, i.measure) + z(C["padding-top"]) + z(C["padding-bottom"]) + R("top") + R("bottom");
    }
    const { before: x, after: k } = Gg(n, d, y, i);
    return (x || k) && (S.children = [x, k].filter(Boolean)), S;
  }
  if (N === "img") {
    S.kind = "image", S.src = n.props.src ?? null;
    for (const [x, k] of [["width", "w"], ["height", "h"]]) {
      const C = Number(n.props[x]);
      b[k] === void 0 && n.props[x] != null && Number.isFinite(C) && (b[k] = C);
    }
    return S;
  }
  const O = d.values["text-transform"], E = [];
  let j = !1, D = !1;
  const B = n.childNodes.reduce((x, k) => x + (k instanceof Vt ? 1 : 0), 0);
  let J = 0;
  for (const x of n.childNodes) {
    if (x instanceof ci) {
      if (x.hidden || x.data === "") continue;
      j = !0;
      const R = E[E.length - 1];
      if (R?.kind === "text")
        R.source = (R.source ?? R.text) + x.data, R.text = pf(R.source, O), R.text === R.source && delete R.source;
      else {
        const Y = pf(x.data, O);
        E.push(Y === x.data ? { kind: "text", text: Y } : { kind: "text", text: Y, source: x.data });
      }
      continue;
    }
    if (!(x instanceof Vt)) continue;
    const k = am(x, d, y, i, o, J === 0, J === B - 1, J);
    J++;
    const C = i.cache.get(x);
    s.volatile ||= C.volatile, s.subAnc ||= C.subAnc;
    const z = k[Fe];
    z === "inline" || z === "inline-block" || z === "inline-flex" ? j = !0 : z !== "none" && (D = !0), E.push(k);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && b.w === void 0) {
    for (let x = 0; x < E.length; x++)
      if (E[x].style?.flex_grow && E[x].style.min_w === 0 && E[x].style.overflow_x === "hidden") {
        const k = Dr(E, x);
        delete k.style.min_w, delete k.style.flex_grow, delete k.style.flex_basis, delete k.style.overflow_x, delete k.style.overflow_y;
      }
  }
  if (!b.display && j && E.some((x) => x.kind !== "text") && E.every((x) => x.kind === "text" || Qg(x))) {
    const x = E.map((k) => k.kind === "text" ? k.text : k.children.map((C) => C.text).join("")).join("");
    w("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), E.splice(0, E.length, { kind: "text", text: x });
  }
  const Z = E.some((x) => x.kind !== "text");
  let T = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][Fe]) ? E[0] : null;
  if (!b.display && T) {
    T = Dr(E, 0);
    const x = i.cache.get(n.childNodes.find((C) => C.id === T.id))?.part.computed, k = x ? ai(d.values, i.measure) - Jg(x.values, i.measure, T) : 0;
    b.display = "flex", b.flex_direction = "col", b.items = "start", k > 0 && (T.style.mt = Math.round(((T.style.mt ?? 0) + k) * 100) / 100), w("approximated", "display", `${d.values.display} holding one ${T[Fe]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!b.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][Fe] === "inline" && typeof E[0].style.h == "number") {
    const x = Dr(E, 0), k = ai(d.values, i.measure), C = zl(d.values, i.measure) - k, z = (R) => Math.round(R * 100) / 100;
    b.display = "flex", b.flex_direction = "col", b.items = "start", k > x.style.h && (x.style.mt = z((x.style.mt ?? 0) + k - x.style.h)), C > 0 && (x.style.mb = z((x.style.mb ?? 0) + C)), w("approximated", "display", `${d.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!b.display && j && Z) {
    if (b.display = "flex", b.flex_direction = D ? "col" : "row", !D) b.items = "baseline";
    else for (let x = 0; x < E.length; x++) E[x].kind !== "text" && /^inline-(block|flex)$/.test(E[x][Fe]) && !E[x].style.self && (Dr(E, x).style.self = "start");
    w("approximated", "display", `${d.values.display} with inline content`, "(inline formatting)", D ? "a column of its children" : "a row on the text baseline");
  }
  const p = d.values["letter-spacing"]?.px, v = d.values["overflow-x"] !== "visible";
  if (p)
    for (let x = 0; x < E.length; x++) {
      const k = E[x];
      if (k.kind !== "text") continue;
      const C = Math.round(p * [...k.text].length * 1e3) / 1e3;
      if (p > 0 || !v) {
        E[x] = { kind: "div", style: { pr: C }, tokens: {}, children: [k] };
        continue;
      }
      const z = d.values["font-size"], R = Math.max(0.8, 1 + p / (0.55 * z)), Y = Math.round(zl(d.values, i.measure) * 1e3) / 1e3;
      E[x] = { kind: "div", style: { text_size: Math.round(z * R * 1e3) / 1e3, line_height: `${Y}px` }, tokens: {}, children: [k] };
    }
  return S.children = E, S;
}
function Xg(n, l) {
  if (!l) return null;
  let o = (l.self ? n : l.closest ? Yf(n, l.closest) : l.find ? Tl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return o && l.strip && o.startsWith(l.strip) && (o = o.slice(l.strip.length)), o;
}
function Zg(n, l, i) {
  const o = l.map((m) => [m, si(m.selector)]), s = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const h = i.get(f.id);
      if (h)
        for (const [y, _] of o) {
          const w = y.textRange ? "range_name" : "name";
          if (y.textRange && h[w] != null || !_.some((O) => ds(f, O))) continue;
          const b = Xg(f, y.key), S = b == null ? s.get(y.name) ?? 0 : 0;
          b == null && s.set(y.name, S + 1);
          const N = b != null ? `${y.name}:${b}` : S ? `${y.name}@${S}` : y.name;
          h[w] == null ? h[w] = N : (h.also ??= []).push(N);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const ni = 0.9521, lm = 0.2256, ai = (n, l) => (zl(n, l) - (ni + lm) * n["font-size"]) / 2 + ni * n["font-size"];
function Jg(n, l, i) {
  const o = (h) => h && typeof h == "object" && "px" in h ? h.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]), d = i?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(ai(n, l), (m.style.mt ?? 0) + m.style.h) : ai(n, l);
  return o(n["padding-top"]) + s + f;
}
const pf = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (i) => i.toUpperCase()) : n, rm = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Wg(n) {
  const l = {};
  for (const [i, o] of Object.entries(n.props)) {
    if (rm.has(i) || typeof o == "function" || o === void 0 || o === null || typeof o == "object") continue;
    const s = i.startsWith("aria-") || i.startsWith("data-");
    if (o === !1 && !s) continue;
    const d = i === "htmlFor" ? "for" : i === "tabIndex" ? "tabindex" : i;
    l[d] = typeof o == "boolean" ? s ? String(o) : "" : String(o);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const Fg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), hf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function $g(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (i) => {
    const o = [];
    for (const [d, m] of Object.entries(i.props))
      rm.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || o.push(`${Fg(d)}="${hf(m === !0 ? "" : m)}"`);
    i.tagName === "svg" && !i.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = i.childNodes.map((d) => d instanceof ci ? hf(d.data) : l(d)).join("");
    return `<${i.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${s}</${i.tagName}>`;
  };
  return l(n);
}
function Ig(n) {
  const l = n.theme?.() ?? {}, i = {};
  for (const o of Zf) l[o] && (i[o] = l[o]);
  return i;
}
const Pg = { font_features: "" };
function tb(n, l, i, o = {}, s = null) {
  const d = Ig(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (o.look !== f || o.sheet !== i) && Object.assign(o, { look: f, sheet: i, cache: /* @__PURE__ */ new WeakMap(), cascade: new vg(i, { theme: d, viewport: m }), top: null });
  const { cascade: h, cache: y } = o, _ = new Cg(), w = [], S = { cascade: h, cache: y, viewport: m, findings: _, log: w, add: (...j) => {
    w.push(j), _.add(...j);
  }, now: ms(), measure: l.lineHeight ? (j) => l.lineHeight(j) : null };
  o.top ??= h.compute(n.body, h.compute(n.documentElement, null));
  const N = n.body.children, O = N.map((j, D) => am(j, o.top, Pg, S, 0, D === 0, D === N.length - 1, D));
  if (s?.length) {
    const j = /* @__PURE__ */ new Map(), D = (B) => {
      B.id && (j.set(B.id, B), delete B.name, delete B.range_name, delete B.also);
      for (const J of B.children ?? []) D(J);
    };
    O.forEach(D), Zg(n, s, j);
  }
  const E = /* @__PURE__ */ new Set();
  for (const j of [n, n.defaultView])
    for (const { type: D } of j?.listeners ?? []) sf[D] && E.add(sf[D]);
  return { schema: _g, root: O[0] ?? null, overlays: O.slice(1), document_events: [...E].sort(), unsupported: S.findings.list() };
}
const Ya = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 }, digest: "1b693a483c1992d8" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const Ga = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let _l = null;
function eb() {
  return _l || (_l = Ya.digest && Ga.get(Ya.digest) || new cg(Ya), Ya.digest && !Ga.has(Ya.digest) && (Ga.size >= 4 && Ga.delete(Ga.keys().next().value), Ga.set(Ya.digest, _l)), _l);
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
let ca = Cl.NoEventPriority;
function nb(n, l) {
  const i = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const o of i) {
    if (o === "children") continue;
    const s = n[o], d = l[o];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(o === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const ab = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function gf(n, l) {
  for (const i of z0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(i);
  return n;
}
const lb = {
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
  createInstance: (n, l, i) => gf(new Vt(n, l, i.ownerDocument), l),
  createTextInstance: (n, l) => new ci(n),
  appendInitialChild: (n, l) => {
    n.appendChild(l);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, l, i) => !!i.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, l) => {
    n.appendChild(l);
  },
  appendChildToContainer: (n, l) => {
    n.appendChild(l);
  },
  insertBefore: (n, l, i) => {
    n.insertBefore(l, i);
  },
  insertInContainerBefore: (n, l, i) => {
    n.insertBefore(l, i);
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
  commitUpdate: (n, l, i, o) => {
    if (n.props = o, n.inline) for (const s of Object.keys(n.inline)) i.style?.[s] !== o.style?.[s] && delete n.inline[s];
    if (i.dangerouslySetInnerHTML?.__html !== o.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      gf(n, o);
    }
    nb(i, o) && n.touch();
  },
  commitTextUpdate: (n, l, i) => {
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
    ca = n;
  },
  getCurrentUpdatePriority: () => ca,
  resolveUpdatePriority: () => ca !== Cl.NoEventPriority ? ca : Cl.DefaultEventPriority,
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
}, Ne = J0(lb), jl = (n, l, i = null) => Ne.createPortal(n, l, null, i), rb = {
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
}, ib = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), ob = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), sb = (n) => {
  for (let l = n; l instanceof Vt; l = l.parentNode) if (l.props.disabled && ob.has(l.tagName)) return !0;
  return !1;
};
class cb {
  constructor(l, i, o) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, i), this.type = l, this.target = o, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Hr(n, l, i) {
  l.currentTarget = n;
  for (const { type: o, listener: s, capture: d } of [...n.listeners ?? []])
    o === l.type && d === i && s.call(n, l);
  if (n instanceof Vt) {
    const o = rb[l.type], s = o && n.props[i ? `${o}Capture` : o];
    typeof s == "function" && s(l);
  }
}
function Fy(n, l, i = {}) {
  const { document: o, window: s, globals: d } = A0(n), m = new Vt("div", { id: "root", style: i.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let h = null;
  const y = () => [o, s].map((T) => T.listeners.map((p) => `${p.type}:${p.capture}`).sort().join(",")).join("|");
  let _ = "";
  const w = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, N = -1;
  o.measureKey = (T) => b + T.id, o.stale = () => N !== S, o.computed = (T) => {
    if (!w.cascade || !w.top) return null;
    const p = [];
    for (let x = T; x instanceof Vt && x !== o.body; x = x.parentNode) p.unshift(x);
    let v = w.top;
    for (const x of p) v = w.cascade.compute(x, v);
    return v.values;
  };
  const O = () => (S += 1, h = tb(o, n, eb(), w, i.names), _ = y(), n.render?.(h), h), E = () => {
    Ne.flushPassiveEffects(), Ne.flushSyncWork(), y() !== _ && O();
  };
  o.afterCommit = O;
  const j = (T) => {
    f.push(T), n.error?.(T);
  }, D = Ne.createContainer(m, Cl.ConcurrentRoot, null, !1, null, "", j, j, j, null);
  Ne.updateContainerSync(et.createElement(l, i.props ?? {}), D, null, null), Ne.flushSyncWork(), E();
  const B = (T) => {
    const p = (v) => {
      if (v.id === T) return v;
      for (const x of v.children) {
        const k = p(x);
        if (k) return k;
      }
      return null;
    };
    return p(o.documentElement);
  }, J = (T) => {
    const p = ca;
    ca = Cl.DiscreteEventPriority;
    try {
      return T();
    } finally {
      ca = p, Ne.flushSyncWork(), E();
    }
  }, Z = {
    document: o,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return h;
    },
    describe: O,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(T, p, v = {}) {
      const x = typeof T == "string" ? B(T) : T;
      if (!x || ib.has(p) && sb(x)) return !1;
      const k = new cb(p, v, x), C = [];
      for (let Y = x; Y; Y = Y.parentNode) C.push(Y);
      const z = [...C, o, s];
      J(() => {
        for (let Y = z.length - 1; Y > 0 && !k.propagationStopped; Y--) Hr(z[Y], k, !0);
        k.propagationStopped || (Hr(x, k, !0), k.propagationStopped || Hr(x, k, !1));
        for (let Y = 1; Y < z.length && !k.propagationStopped; Y++) Hr(z[Y], k, !1);
      });
      const R = p === "click" && !k.defaultPrevented ? hs(x) : null;
      if (R && Z.dispatch(R, "submit", {}), p === "click" && !k.defaultPrevented)
        for (let Y = x; Y; Y = Y.parentNode) {
          if (Y.tagName !== "a") continue;
          const W = Y.props?.href;
          typeof W == "string" && /^https:\/\/\S+$/.test(W) && n.openLink?.(W);
          break;
        }
      return !k.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (T) => [o, s].some((p) => p.listeners.some((v) => v.type === T)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(T) {
      const p = o.activeElement && o.activeElement !== o.body ? o.activeElement : o.body;
      if (!Z.dispatch(p, "keydown", T)) return !0;
      const x = T.key === "Enter" && !T.isComposing ? hs(p, !0) : null;
      if (x)
        return Z.dispatch(x, "submit", {}), !0;
      if (!Kf(p) || p.props.disabled || p.props.readOnly) return !1;
      if ((T.ctrlKey || T.metaKey) && !T.altKey && !T.shiftKey && T.key.toLowerCase() === "a")
        return p.selectedAll = !0, !0;
      if (T.ctrlKey || T.metaKey) return !1;
      const k = p.selectedAll;
      p.selectedAll = !1;
      const C = p.value, R = T.key === "Backspace" || k && T.key === "Delete" ? k ? "" : C.slice(0, -1) : [...T.key].length === 1 ? (k ? "" : C) + T.key : C;
      return R === C ? !1 : (p.value = R, Z.dispatch(p, "input", { data: T.key }), Z.dispatch(p, "change", {}), p.props.value !== void 0 && delete p.edit, p.touch(), O(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(T, p) {
      const v = B(T);
      v && (v.bounds = { x: p.x, y: p.y, width: p.width, height: p.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(T) {
      const p = B(T);
      if (!p || p.props.disabled || !Z.dispatch(T, "click", { button: 0, detail: 1 })) return;
      const v = p.props.type === "radio";
      v && p.checked || (p.checked = v ? !0 : !p.checked, Z.dispatch(T, "input", {}), Z.dispatch(T, "change", {}), p.props.checked !== void 0 && delete p.ticked, p.touch(), O());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(T, p = {}) {
      const v = { button: 0, buttons: 1, pointerType: "mouse", ...p };
      for (const x of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) Z.dispatch(T, x, v);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (T) => !!B(T)?.state.hover,
    hover(T, p) {
      const v = B(T);
      !v || v.state.hover === p || (v.state.hover = p, v.touch(), O());
    },
    focus(T) {
      const p = B(T);
      p && (J(() => {
        const v = o.activeElement;
        v && v !== p && v !== o.body && Z.dispatch(v, "blur"), o.focus(p), Z.dispatch(p, "focus");
      }), O());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(T) {
      let v = typeof T == "string" ? B(T) : T;
      for (; v && !(v instanceof Vt && typeof v.props.onKeyDown == "function" && ab(v)); ) v = v.parentNode;
      !v || v === o.activeElement || (Z.focus(v.id), v.state.pointerFocus = !0, v.touch(), O());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return N = S, o.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const T = o.retries.splice(0);
      for (const p of T) p();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: E,
    update(T) {
      Ne.updateContainerSync(et.createElement(l, T ?? {}), D, null, null), Ne.flushSyncWork(), E();
    },
    unmount() {
      Ne.updateContainerSync(null, D, null, null), Ne.flushSyncWork(), Ne.flushPassiveEffects(), o.afterCommit = null, o.retries.length = 0, n.forgetBounds?.(b);
    }
  };
  return Z;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const im = (n) => Ne.flushSyncFromReconciler(n), ub = { createPortal: jl, flushSync: im }, $y = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: jl,
  default: ub,
  flushSync: im
}, Symbol.toStringTag, { value: "Module" }));
function om(n) {
  var l, i, o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (i = om(n[l])) && (o && (o += " "), o += i);
  } else for (i in n) n[i] && (o && (o += " "), o += i);
  return o;
}
function sm() {
  for (var n, l, i = 0, o = "", s = arguments.length; i < s; i++) (n = arguments[i]) && (l = om(n)) && (o && (o += " "), o += l);
  return o;
}
const db = (n, l) => {
  const i = new Array(n.length + l.length);
  for (let o = 0; o < n.length; o++)
    i[o] = n[o];
  for (let o = 0; o < l.length; o++)
    i[n.length + o] = l[o];
  return i;
}, fb = (n, l) => ({
  classGroupId: n,
  validator: l
}), cm = (n = /* @__PURE__ */ new Map(), l = null, i) => ({
  nextPart: n,
  validators: l,
  classGroupId: i
}), li = "-", bf = [], mb = "arbitrary..", pb = (n) => {
  const l = gb(n), {
    conflictingClassGroups: i,
    conflictingClassGroupModifiers: o
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return hb(m);
      const f = m.split(li), h = f[0] === "" && f.length > 1 ? 1 : 0;
      return um(f, h, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const h = o[m], y = i[m];
        return h ? y ? db(y, h) : h : y || bf;
      }
      return i[m] || bf;
    }
  };
}, um = (n, l, i) => {
  if (n.length - l === 0)
    return i.classGroupId;
  const s = n[l], d = i.nextPart.get(s);
  if (d) {
    const y = um(n, l + 1, d);
    if (y) return y;
  }
  const m = i.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(li) : n.slice(l).join(li), h = m.length;
  for (let y = 0; y < h; y++) {
    const _ = m[y];
    if (_.validator(f))
      return _.classGroupId;
  }
}, hb = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), i = l.indexOf(":"), o = l.slice(0, i);
  return o ? mb + o : void 0;
})(), gb = (n) => {
  const {
    theme: l,
    classGroups: i
  } = n;
  return bb(i, l);
}, bb = (n, l) => {
  const i = cm();
  for (const o in n) {
    const s = n[o];
    qs(s, i, o, l);
  }
  return i;
}, qs = (n, l, i, o) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const m = n[d];
    vb(m, l, i, o);
  }
}, vb = (n, l, i, o) => {
  if (typeof n == "string") {
    yb(n, l, i);
    return;
  }
  if (typeof n == "function") {
    xb(n, l, i, o);
    return;
  }
  wb(n, l, i, o);
}, yb = (n, l, i) => {
  const o = n === "" ? l : dm(l, n);
  o.classGroupId = i;
}, xb = (n, l, i, o) => {
  if (_b(n)) {
    qs(n(o), l, i, o);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(fb(i, n));
}, wb = (n, l, i, o) => {
  const s = Object.entries(n), d = s.length;
  for (let m = 0; m < d; m++) {
    const [f, h] = s[m];
    qs(h, dm(l, f), i, o);
  }
}, dm = (n, l) => {
  let i = n;
  const o = l.split(li), s = o.length;
  for (let d = 0; d < s; d++) {
    const m = o[d];
    let f = i.nextPart.get(m);
    f || (f = cm(), i.nextPart.set(m, f)), i = f;
  }
  return i;
}, _b = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, kb = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let l = 0, i = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const s = (d, m) => {
    i[d] = m, l++, l > n && (l = 0, o = i, i = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let m = i[d];
      if (m !== void 0)
        return m;
      if ((m = o[d]) !== void 0)
        return s(d, m), m;
    },
    set(d, m) {
      d in i ? i[d] = m : s(d, m);
    }
  };
}, ws = "!", vf = ":", Sb = [], yf = (n, l, i, o, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: i,
  maybePostfixModifierPosition: o,
  isExternal: s
}), Eb = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: i
  } = n;
  let o = (s) => {
    const d = [];
    let m = 0, f = 0, h = 0, y;
    const _ = s.length;
    for (let O = 0; O < _; O++) {
      const E = s[O];
      if (m === 0 && f === 0) {
        if (E === vf) {
          d.push(s.slice(h, O)), h = O + 1;
          continue;
        }
        if (E === "/") {
          y = O;
          continue;
        }
      }
      E === "[" ? m++ : E === "]" ? m-- : E === "(" ? f++ : E === ")" && f--;
    }
    const w = d.length === 0 ? s : s.slice(h);
    let b = w, S = !1;
    w.endsWith(ws) ? (b = w.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      w.startsWith(ws) && (b = w.slice(1), S = !0)
    );
    const N = y && y > h ? y - h : void 0;
    return yf(d, S, b, N);
  };
  if (l) {
    const s = l + vf, d = o;
    o = (m) => m.startsWith(s) ? d(m.slice(s.length)) : yf(Sb, !1, m, void 0, !0);
  }
  if (i) {
    const s = o;
    o = (d) => i({
      className: d,
      parseClassName: s
    });
  }
  return o;
}, zb = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((i, o) => {
    l.set(i, 1e6 + o);
  }), (i) => {
    const o = [];
    let s = [];
    for (let d = 0; d < i.length; d++) {
      const m = i[d], f = m[0] === "[", h = l.has(m);
      f || h ? (s.length > 0 && (s.sort(), o.push(...s), s = []), o.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), o.push(...s)), o;
  };
}, Nb = (n) => ({
  cache: kb(n.cacheSize),
  parseClassName: Eb(n),
  sortModifiers: zb(n),
  postfixLookupClassGroupIds: Tb(n),
  ...pb(n)
}), Tb = (n) => {
  const l = /* @__PURE__ */ Object.create(null), i = n.postfixLookupClassGroups;
  if (i)
    for (let o = 0; o < i.length; o++)
      l[i[o]] = !0;
  return l;
}, Cb = /\s+/, Mb = (n, l) => {
  const {
    parseClassName: i,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], h = n.trim().split(Cb);
  let y = "";
  for (let _ = h.length - 1; _ >= 0; _ -= 1) {
    const w = h[_], {
      isExternal: b,
      modifiers: S,
      hasImportantModifier: N,
      baseClassName: O,
      maybePostfixModifierPosition: E
    } = i(w);
    if (b) {
      y = w + (y.length > 0 ? " " + y : y);
      continue;
    }
    let j = !!E, D;
    if (j) {
      const p = O.substring(0, E);
      D = o(p);
      const v = D && m[D] ? o(O) : void 0;
      v && v !== D && (D = v, j = !1);
    } else
      D = o(O);
    if (!D) {
      if (!j) {
        y = w + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (D = o(O), !D) {
        y = w + (y.length > 0 ? " " + y : y);
        continue;
      }
      j = !1;
    }
    const B = S.length === 0 ? "" : S.length === 1 ? S[0] : d(S).join(":"), J = N ? B + ws : B, Z = J + D;
    if (f.indexOf(Z) > -1)
      continue;
    f.push(Z);
    const T = s(D, j);
    for (let p = 0; p < T.length; ++p) {
      const v = T[p];
      f.push(J + v);
    }
    y = w + (y.length > 0 ? " " + y : y);
  }
  return y;
}, Ab = (...n) => {
  let l = 0, i, o, s = "";
  for (; l < n.length; )
    (i = n[l++]) && (o = fm(i)) && (s && (s += " "), s += o);
  return s;
}, fm = (n) => {
  if (typeof n == "string")
    return n;
  let l, i = "";
  for (let o = 0; o < n.length; o++)
    n[o] && (l = fm(n[o])) && (i && (i += " "), i += l);
  return i;
}, jb = (n, ...l) => {
  let i, o, s, d;
  const m = (h) => {
    const y = l.reduce((_, w) => w(_), n());
    return i = Nb(y), o = i.cache.get, s = i.cache.set, d = f, f(h);
  }, f = (h) => {
    const y = o(h);
    if (y)
      return y;
    const _ = Mb(h, i);
    return s(h, _), _;
  };
  return d = m, (...h) => d(Ab(...h));
}, Ob = [], Zt = (n) => {
  const l = (i) => i[n] || Ob;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, mm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, pm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Rb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Db = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, Hb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, Bb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Ub = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, qb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Dn = (n) => Rb.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), We = (n) => !!n && Number.isInteger(Number(n)), is = (n) => n.endsWith("%") && vt(n.slice(0, -1)), pn = (n) => Db.test(n), hm = () => !0, Yb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  Hb.test(n) && !Bb.test(n)
), Ys = () => !1, Gb = (n) => Ub.test(n), Lb = (n) => qb.test(n), Qb = (n) => !lt(n) && !rt(n), Vb = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), Kb = (n) => Gn(n, vm, Ys), lt = (n) => mm.test(n), oa = (n) => Gn(n, ym, Yb), xf = (n) => Gn(n, Pb, vt), Xb = (n) => Gn(n, wm, hm), Zb = (n) => Gn(n, xm, Ys), wf = (n) => Gn(n, gm, Ys), Jb = (n) => Gn(n, bm, Lb), Br = (n) => Gn(n, _m, Gb), rt = (n) => pm.test(n), kl = (n) => da(n, ym), Wb = (n) => da(n, xm), _f = (n) => da(n, gm), Fb = (n) => da(n, vm), $b = (n) => da(n, bm), Ur = (n) => da(n, _m, !0), Ib = (n) => da(n, wm, !0), Gn = (n, l, i) => {
  const o = mm.exec(n);
  return o ? o[1] ? l(o[1]) : i(o[2]) : !1;
}, da = (n, l, i = !1) => {
  const o = pm.exec(n);
  return o ? o[1] ? l(o[1]) : i : !1;
}, gm = (n) => n === "position" || n === "percentage", bm = (n) => n === "image" || n === "url", vm = (n) => n === "length" || n === "size" || n === "bg-size", ym = (n) => n === "length", Pb = (n) => n === "number", xm = (n) => n === "family-name", wm = (n) => n === "number" || n === "weight", _m = (n) => n === "shadow", tv = () => {
  const n = Zt("color"), l = Zt("font"), i = Zt("text"), o = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), m = Zt("breakpoint"), f = Zt("container"), h = Zt("spacing"), y = Zt("radius"), _ = Zt("shadow"), w = Zt("inset-shadow"), b = Zt("text-shadow"), S = Zt("drop-shadow"), N = Zt("blur"), O = Zt("perspective"), E = Zt("aspect"), j = Zt("ease"), D = Zt("animate"), B = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], J = () => [
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
  ], Z = () => [...J(), rt, lt], T = () => ["auto", "hidden", "clip", "visible", "scroll"], p = () => ["auto", "contain", "none"], v = () => [rt, lt, h], x = () => [Dn, "full", "auto", ...v()], k = () => [We, "none", "subgrid", rt, lt], C = () => ["auto", {
    span: ["full", We, rt, lt]
  }, We, rt, lt], z = () => [We, "auto", rt, lt], R = () => ["auto", "min", "max", "fr", rt, lt], Y = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], W = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], q = () => ["auto", ...v()], K = () => [Dn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...v()], $ = () => [f, Dn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...v()], Q = () => [Dn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...v()], V = () => [n, rt, lt], M = () => [...J(), _f, wf, {
    position: [rt, lt]
  }], X = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], nt = () => ["auto", "cover", "contain", Fb, Kb, {
    size: [rt, lt]
  }], st = () => [is, kl, oa], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    rt,
    lt
  ], ut = () => ["", vt, kl, oa], Et = () => ["solid", "dashed", "dotted", "double"], Wt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, is, _f, wf], Ln = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    N,
    rt,
    lt
  ], Qn = () => ["none", vt, rt, lt], De = () => ["none", vt, rt, lt], He = () => [vt, rt, lt], gn = () => [Dn, "full", ...v()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [pn],
      breakpoint: [pn],
      color: [hm],
      container: [pn],
      "drop-shadow": [pn],
      ease: ["in", "out", "in-out"],
      font: [Qb],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [pn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [pn],
      shadow: [pn],
      spacing: ["px", vt],
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
        aspect: ["auto", "square", Dn, lt, rt, E]
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
        "@container": ["", "normal", "size", rt, lt]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [Vb],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [vt, "auto", lt, rt, f]
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
        object: Z()
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
        overscroll: p()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": p()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": p()
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
        inset: x()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": x()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": x()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": x(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: x()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": x(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: x()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": x()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": x()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: x()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: x()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: x()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: x()
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
        z: [We, "auto", rt, lt]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Dn, "full", "auto", f, ...v()]
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
        flex: [vt, Dn, "auto", "initial", "none", lt]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", vt, rt, lt]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", vt, rt, lt]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [We, "first", "last", "none", rt, lt]
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
        col: C()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": z()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": z()
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
        row: C()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": z()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": z()
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
        gap: v()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": v()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": v()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...Y(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...W(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...W()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...Y()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...W(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...W(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": Y()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...W(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...W()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: v()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: v()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: v()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: v()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: v()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: v()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: v()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: v()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: v()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: v()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: v()
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
        "space-x": v()
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
        "space-y": v()
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
        size: K()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...$()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...$()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...$()]
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
        w: [f, "screen", ...K()]
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
          ...K()
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
          ...K()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...K()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...K()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...K()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", i, kl, oa]
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
        font: [o, Ib, Xb]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", is, lt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [Wb, Zb, l]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [lt]
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
        tracking: [s, rt, lt]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", rt, xf]
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
          ...v()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", rt, lt]
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
        list: ["disc", "decimal", "none", rt, lt]
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
        decoration: [...Et(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [vt, "from-font", "auto", rt, oa]
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
        "underline-offset": [vt, "auto", rt, lt]
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
        indent: v()
      }],
      /**
       * Tab Size
       * @see https://tailwindcss.com/docs/tab-size
       */
      "tab-size": [{
        tab: [We, rt, lt]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", rt, lt]
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
        content: ["none", rt, lt]
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
        bg: M()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: X()
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
          }, We, rt, lt],
          radial: ["", rt, lt],
          conic: ["", We, rt, lt]
        }, $b, Jb]
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
        from: st()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: st()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: st()
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
        outline: [...Et(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [vt, rt, lt]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", vt, kl, oa]
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
          _,
          Ur,
          Br
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
        "inset-shadow": ["none", w, Ur, Br]
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
        ring: V()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [vt, oa]
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
        "inset-ring": ut()
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
        "text-shadow": ["none", b, Ur, Br]
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
        opacity: [vt, rt, lt]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Wt(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Wt()
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
        "mask-linear": [vt]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": ht()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": ht()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": V()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": V()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": ht()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": ht()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": V()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": V()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": ht()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": ht()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": V()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": V()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": ht()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": ht()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": V()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": V()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": ht()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": ht()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": V()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": V()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": ht()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": ht()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": V()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": V()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": ht()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": ht()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": V()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": V()
      }],
      "mask-image-radial": [{
        "mask-radial": [rt, lt]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": ht()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": ht()
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
        "mask-radial-at": J()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [vt]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": ht()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": ht()
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
        mask: M()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: X()
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
        mask: ["none", rt, lt]
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
          rt,
          lt
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Ln()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [vt, rt, lt]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [vt, rt, lt]
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
          Ur,
          Br
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
        grayscale: ["", vt, rt, lt]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [vt, rt, lt]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", vt, rt, lt]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [vt, rt, lt]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", vt, rt, lt]
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
          rt,
          lt
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Ln()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [vt, rt, lt]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [vt, rt, lt]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", vt, rt, lt]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [vt, rt, lt]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", vt, rt, lt]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [vt, rt, lt]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [vt, rt, lt]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", vt, rt, lt]
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
        "border-spacing": v()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": v()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": v()
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", rt, lt]
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
        duration: [vt, "initial", rt, lt]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", j, rt, lt]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [vt, rt, lt]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", D, rt, lt]
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
        perspective: [O, rt, lt]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": Z()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Qn()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Qn()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Qn()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Qn()
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
        transform: [rt, lt, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: Z()
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
        zoom: [We, rt, lt]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", rt, lt]
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
        "scroll-m": v()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": v()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": v()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": v()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": v()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": v()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": v()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": v()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": v()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": v()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": v()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": v()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": v()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": v()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": v()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": v()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": v()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": v()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": v()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": v()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": v()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": v()
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
        "will-change": ["auto", "scroll", "contents", "transform", rt, lt]
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
        stroke: [vt, kl, oa, xf]
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
}, ev = /* @__PURE__ */ jb(tv);
function Jt(...n) {
  return ev(sm(n));
}
function nv(n, l, i) {
  return n.filter((o, s) => s !== l && (o.start + o.end) / 2 < i).length;
}
function av(n, l, i, o) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const m = n[l + 1], f = n[l - 1], h = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((y, _) => {
    l < i && _ > l && _ <= i ? s[_] = -h : i < l && _ >= i && _ < l && (s[_] = h);
  }), s[l] = Math.min(Math.max(o, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const kf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function lv(n, l) {
  for (let i = n.parentElement; i; i = i.parentElement) {
    const o = getComputedStyle(i)[l === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (l === "x" ? i.scrollWidth > i.clientWidth : i.scrollHeight > i.clientHeight)) return i;
  }
  return null;
}
function rv(n, l, i, o) {
  const s = n[l] ? lv(n[l], i) : null, d = () => s ? i === "x" ? s.scrollLeft : s.scrollTop : 0, m = (E) => (i === "x" ? E.clientX : E.clientY) + d(), f = m(o), h = d(), y = n.map((E) => {
    const j = E.getBoundingClientRect();
    return i === "x" ? { start: j.left + h, end: j.right + h } : { start: j.top + h, end: j.bottom + h };
  }), _ = n.map((E) => kf.map((j) => E.style[j])), w = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = i === "x" ? "translateX" : "translateY";
  let S = !1;
  const N = { to: l };
  n.forEach((E, j) => {
    if (E.style.pointerEvents = "none", j !== l) {
      w || (E.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(E).position === "static" && (E.style.position = "relative"), E.style.zIndex = "30", E.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const O = (E, j) => {
    N.to = E, av(y, l, E, j).forEach((D, B) => {
      n[B].style.transform = D ? `${b}(${D}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return N.to;
    },
    slot: (E) => nv(y, l, m(E)),
    apply: (E, j) => {
      S || O(E, m(j) - f);
    },
    rest: () => {
      S || O(l, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((E, j) => kf.forEach((D, B) => {
        E.style[D] = _[j][B];
      })));
    }
  };
}
const iv = 5;
let os = !1;
function ov(n, l) {
  if (n.button !== 0 || os) return;
  const i = { clientX: n.clientX, clientY: n.clientY }, o = n.currentTarget, s = n.pointerId;
  let d = null, m, f = !1;
  const h = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, y = (N) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", _), window.removeEventListener("pointerup", w), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", b), o.removeEventListener("lostpointercapture", b);
    try {
      o.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    os = !1, document.body.style.cursor = h.cursor, document.body.style.userSelect = h.userSelect, d.end();
    const O = (E) => E.stopPropagation();
    window.addEventListener("click", O, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", O, !0), 0), m?.(), l.onEnd(N, d);
  }, _ = (N) => {
    if (!d) {
      if (Math.hypot(N.clientX - i.clientX, N.clientY - i.clientY) < iv) return;
      const O = l.items();
      d = rv(O, l.from(O), l.axis, i), os = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(s);
      } catch {
      }
      o.addEventListener("lostpointercapture", b);
      const E = l.onStart?.();
      m = typeof E == "function" ? E : void 0;
    }
    l.onMove(N, d);
  }, w = () => y(!0), b = () => y(!1), S = (N) => {
    N.key === "Escape" && (N.stopPropagation(), y(!1));
  };
  window.addEventListener("pointermove", _), window.addEventListener("pointerup", w), window.addEventListener("pointercancel", b), window.addEventListener("keydown", S, !0), window.addEventListener("blur", b);
}
const km = typeof navigator < "u" && /Mac/i.test(navigator.platform), ri = {
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
for (let n = 1; n <= 12; n++) ri[`f${n}`] = `F${n}`;
const sv = Object.fromEntries(Object.entries(ri).map(([n, l]) => [l, n])), cv = {
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
function uv(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : sv[n];
}
const Sf = /* @__PURE__ */ new Map();
function Sm(n, l = km) {
  const i = `${l}|${n}`, o = Sf.get(i);
  if (o) return o;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (ri[d]) s.code = ri[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Sf.set(i, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = Sm(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function dv(n, l = km) {
  const i = Sm(n, l), o = fv(uv(i.code) ?? "");
  return l ? `${i.ctrl ? "⌃" : ""}${i.alt ? "⌥" : ""}${i.shift ? "⇧" : ""}${i.cmd ? "⌘" : ""}${o}` : [i.ctrl && "Ctrl", i.alt && "Alt", i.shift && "Shift", o].filter(Boolean).join("+");
}
const fv = (n) => cv[n] ?? n.toUpperCase(), Ef = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, zf = sm, di = (n, l) => (i) => {
  var o;
  if (l?.variants == null) return zf(n, i?.class, i?.className);
  const { variants: s, defaultVariants: d } = l, m = Object.keys(s).map((y) => {
    const _ = i?.[y], w = d?.[y];
    if (_ === null) return null;
    const b = Ef(_) || Ef(w);
    return s[y][b];
  }), f = i && Object.entries(i).reduce((y, _) => {
    let [w, b] = _;
    return b === void 0 || (y[w] = b), y;
  }, {}), h = l == null || (o = l.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((y, _) => {
    let { class: w, className: b, ...S } = _;
    return Object.entries(S).every((N) => {
      let [O, E] = N;
      return Array.isArray(E) ? E.includes({
        ...d,
        ...f
      }[O]) : {
        ...d,
        ...f
      }[O] === E;
    }) ? [
      ...y,
      w,
      b
    ] : y;
  }, []);
  return zf(n, m, h, i?.class, i?.className);
}, mv = di(
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
), pv = di(
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
function hv({ className: n, ...l } = {}) {
  return Jt(pv(l), n);
}
const Em = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Gs = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", gv = di(`${Gs} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function bv({ className: n, ...l } = {}) {
  return Jt(gv(l), n);
}
const fi = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", _s = di(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), vv = "my-1 h-px bg-overlay-0";
function yv({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ot.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ ot.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ot.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ ot.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function xv({ size: n = 16, className: l }) {
  return /* @__PURE__ */ ot.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ ot.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ ot.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function wv({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ot.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ot.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function zm({ size: n = 14, className: l }) {
  return /* @__PURE__ */ ot.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ ot.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Nf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function _v({ state: n, error: l }) {
  return /* @__PURE__ */ ot.jsx(
    "span",
    {
      className: Jt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Nf[n] ?? Nf.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function kv({ title: n, onClose: l, children: i, testId: o }) {
  return jl(
    /* @__PURE__ */ ot.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ ot.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": o,
            children: [
              /* @__PURE__ */ ot.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              i
            ]
          }
        )
      }
    ),
    document.body
  );
}
const qr = 4, Hn = 8, Sv = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Tf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Ev({ value: n, onChange: l, options: i, className: o, ariaLabel: s, testId: d, id: m, title: f, disabled: h, placeholder: y, freeText: _, onKeyDown: w }) {
  const b = et.useId(), [S, N] = et.useState(!1), [O, E] = et.useState(-1), [j, D] = et.useState(!1), B = et.useRef(null), J = et.useRef(null), [Z, T] = et.useState({}), p = et.useRef({ text: "", at: 0 }), v = _ && j && n ? i.filter((Q) => Tf(Q).toLowerCase().includes(n.toLowerCase()) || Q.value.toLowerCase().includes(n.toLowerCase())) : i, x = i.find((Q) => Q.value === n), k = (Q) => `${b}-${Q}`;
  function C(Q) {
    h || (E(Q), N(!0));
  }
  function z() {
    N(!1), D(!1), E(-1);
  }
  function R(Q) {
    !Q || Q.disabled || (l(Q.value), z());
  }
  function Y(Q, V) {
    for (let M = 1; M <= v.length; M++) {
      const X = (Q + V * M + v.length * M) % v.length;
      if (!v[X].disabled) return X;
    }
    return Q;
  }
  const W = () => v.findIndex((Q) => !Q.disabled), q = () => v.length - 1 - [...v].reverse().findIndex((Q) => !Q.disabled);
  Jr(() => {
    if (!S || !B.current) {
      T((nt) => nt.left === void 0 ? nt : {});
      return;
    }
    const Q = B.current.getBoundingClientRect(), V = window.innerHeight - Q.bottom - qr - Hn, M = Q.top - qr - Hn, X = V < 160 && M > V;
    T({
      position: "fixed",
      left: Math.min(Math.max(Hn, Q.left), Math.max(Hn, window.innerWidth - Q.width - Hn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: Q.width,
      maxWidth: window.innerWidth - 2 * Hn,
      maxHeight: Math.min(X ? M : V, 320),
      ...X ? { bottom: window.innerHeight - Q.top + qr } : { top: Q.bottom + qr },
      overflowY: "auto"
    });
  }, [S, v.length]), Jr(() => {
    const Q = J.current;
    if (!S || !Q || Z.left === void 0) return;
    const V = Q.getBoundingClientRect().right, M = window.innerWidth - Hn;
    V > M && T((X) => ({ ...X, left: Math.max(Hn, Number(X.left) - (V - M)) }));
  }, [S, Z]), de(() => {
    if (!S) return;
    const Q = (V) => {
      const M = V.target;
      (M === document || M instanceof Node && B.current && M.contains(B.current)) && z();
    };
    return window.addEventListener("resize", z), window.addEventListener("scroll", Q, !0), () => {
      window.removeEventListener("resize", z), window.removeEventListener("scroll", Q, !0);
    };
  }, [S]), de(() => {
    const Q = S && O >= 0 ? document.getElementById(k(O)) : null, V = J.current;
    !Q || !V || (Q.offsetTop < V.scrollTop ? V.scrollTop = Q.offsetTop : Q.offsetTop + Q.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = Q.offsetTop + Q.offsetHeight - V.clientHeight));
  }, [S, O]), Cm(S, (Q) => {
    Q || z();
  }, B, J);
  function K(Q) {
    if (Q.nativeEvent.isComposing) return;
    const V = () => {
      Q.preventDefault(), Q.stopPropagation();
    }, { key: M } = Q;
    if (S) {
      if (M === "Escape") {
        V(), z();
        return;
      } else if (M === "Tab")
        z();
      else if (M === "ArrowDown" || M === "ArrowUp") {
        V(), v.length && E(O < 0 ? M === "ArrowDown" ? W() : q() : Y(O, M === "ArrowDown" ? 1 : -1));
        return;
      } else if (M === "Home" && !_) {
        V(), E(W());
        return;
      } else if (M === "End" && !_) {
        V(), E(q());
        return;
      } else if (M === "Enter" || M === " " && !_) {
        if (O >= 0 && v[O]) {
          V(), R(v[O]);
          return;
        }
        if (!_) {
          V(), z();
          return;
        }
      } else if (!_ && M.length === 1 && !Q.metaKey && !Q.ctrlKey && !Q.altKey) {
        const X = Date.now();
        p.current = { text: (X - p.current.at > 600 ? "" : p.current.text) + M.toLowerCase(), at: X };
        const nt = Math.max(O, 0), st = [...v.slice(nt + (p.current.text.length === 1 ? 1 : 0)), ...v.slice(0, nt + 1)].find((ct) => !ct.disabled && Tf(ct).toLowerCase().startsWith(p.current.text));
        st && (V(), E(v.indexOf(st)));
        return;
      }
    } else if (M === "ArrowDown" || M === "ArrowUp" || !_ && (M === "Enter" || M === " ")) {
      V(), C(Math.max(0, v.findIndex((X) => X.value === n)));
      return;
    }
    w?.(Q);
  }
  const $ = {
    ref: (Q) => {
      B.current = Q;
    },
    id: m,
    title: f,
    disabled: h,
    "aria-label": s,
    "aria-expanded": S,
    "aria-controls": S ? b : void 0,
    "aria-activedescendant": S && O >= 0 ? k(O) : void 0,
    "data-testid": d,
    onKeyDown: K
  };
  return /* @__PURE__ */ ot.jsxs(ot.Fragment, { children: [
    _ ? /* @__PURE__ */ ot.jsx(
      "input",
      {
        ...$,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: y,
        className: o,
        value: n,
        onChange: (Q) => {
          l(Q.target.value), D(!0), S ? E(-1) : (E(-1), N(!0));
        },
        onBlur: () => z()
      }
    ) : /* @__PURE__ */ ot.jsxs(
      "button",
      {
        ...$,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Jt("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", o),
        onClick: () => S ? z() : C(Math.max(0, v.findIndex((Q) => Q.value === n))),
        children: [
          /* @__PURE__ */ ot.jsx("span", { className: "min-w-0 flex-1 truncate", children: x ? x.label : y ?? "" }),
          /* @__PURE__ */ ot.jsx(Vs, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && v.length > 0 && jl(
      /* @__PURE__ */ ot.jsx(
        "div",
        {
          ref: J,
          id: b,
          role: "listbox",
          "aria-label": s,
          className: Jt("z-[9999]", fi),
          style: Z,
          onMouseDown: (Q) => {
            Q.preventDefault(), Q.stopPropagation();
          },
          onClick: (Q) => Q.stopPropagation(),
          children: v.map((Q, V) => /* @__PURE__ */ ot.jsxs(
            "div",
            {
              id: k(V),
              role: "option",
              "aria-selected": Q.value === n,
              "aria-disabled": Q.disabled || void 0,
              "data-value": Q.value,
              className: Jt(Sv, V === O && !Q.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                Q.disabled || E(V);
              },
              onClick: () => R(Q),
              children: [
                /* @__PURE__ */ ot.jsx("span", { className: "min-w-0 truncate", children: Q.label }),
                Q.value === n && /* @__PURE__ */ ot.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const Cf = 230, zv = 370;
function Nv({ x: n, y: l, readOnly: i, canUndo: o, canRedo: s, hasSelection: d, onClose: m, actions: f }) {
  const h = et.useRef(null);
  de(() => {
    const b = (N) => {
      h.current?.contains(N.target) || m();
    }, S = (N) => {
      N.key === "Escape" && (N.preventDefault(), m());
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", S), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", S), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const y = (b, S) => zs(Om ? b : S), _ = (b, S, N, O, E = !1) => /* @__PURE__ */ ot.jsxs("button", { type: "button", className: Jt(Rm(), "flex items-center justify-between gap-6"), "data-testid": N, disabled: E, onClick: S, children: [
    /* @__PURE__ */ ot.jsx("span", { children: b }),
    /* @__PURE__ */ ot.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: O })
  ] }), w = f.askAgent;
  return jl(
    /* @__PURE__ */ ot.jsxs(
      "div",
      {
        ref: h,
        className: fi,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(l, window.innerHeight - zv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - Cf - 8)),
          zIndex: 9999,
          minWidth: Cf
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          w && /* @__PURE__ */ ot.jsxs(ot.Fragment, { children: [
            _(d ? "Ask agent about selection…" : "Ask agent about file…", w, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ ot.jsx("div", { className: Xr })
          ] }),
          _("Undo", f.undo, "editor-menu-undo", y("cmd+z", "ctrl+z"), i || !o),
          _("Redo", f.redo, "editor-menu-redo", y("cmd+shift+z", "ctrl+y"), i || !s),
          /* @__PURE__ */ ot.jsx("div", { className: Xr }),
          _("Cut", f.cut, "editor-menu-cut", y("cmd+x", "ctrl+x"), i || !d),
          _("Copy", f.copy, "editor-menu-copy", y("cmd+c", "ctrl+c"), !d),
          _("Paste", f.paste, "editor-menu-paste", y("cmd+v", "ctrl+v"), i),
          _("Select All", f.selectAll, "editor-menu-select-all", y("cmd+a", "ctrl+a")),
          /* @__PURE__ */ ot.jsx("div", { className: Xr }),
          _("Find…", f.find, "editor-menu-find", y("cmd+f", "ctrl+f")),
          !i && _("Replace…", f.replace, "editor-menu-replace", y("cmd+alt+f", "ctrl+h")),
          _("Go to Line…", f.gotoLine, "editor-menu-goto", zs("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const Tv = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Cv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Mv = "m-0 mb-2 text-[0.82rem] text-subtext-0", Nm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ls = `${Nm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Av = `${Ls} min-w-[5.5rem] shrink-0`, Qs = `${Nm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, jv = `${Qs} flex-1 max-[700px]:flex-[1_1_100%]`, Ov = `${Qs} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, Rv = `${Qs} flex-[1_1_100%]`, Dv = "flex flex-wrap items-center gap-[0.4rem]", Hv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", Bv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", Uv = `settings-modal__host-row ${Bv}`, qv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", Yv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Tm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", Gv = `${Tm} bg-accent`, Lv = `${Tm} ml-auto bg-red`;
function Vs({ open: n, size: l = 12, className: i }) {
  return /* @__PURE__ */ ot.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ ot.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Qv({ label: n, items: l, testId: i, side: o = "right", up: s = !1, maxHeight: d = 320 }) {
  const [m, f] = et.useState(!1), [h, y] = et.useState(!1), _ = et.useRef(null), w = et.useRef(null), b = () => [...w.current?.querySelectorAll('[role="menuitem"]') ?? []];
  de(() => {
    m && h && (b()[0]?.focus(), y(!1));
  }, [m, h]);
  const S = () => {
    f(!0), y(!0);
  }, N = (E) => {
    (E.key === "ArrowRight" || E.key === "Enter" || E.key === " ") && (E.preventDefault(), S());
  }, O = (E) => {
    const j = b(), D = j.findIndex((B) => B === document.activeElement);
    E.key === "ArrowDown" || E.key === "ArrowUp" ? (E.preventDefault(), j[(D + (E.key === "ArrowDown" ? 1 : j.length - 1)) % j.length]?.focus()) : (E.key === "ArrowLeft" || E.key === "Escape") && (E.preventDefault(), E.stopPropagation(), f(!1), _.current?.focus());
  };
  return /* @__PURE__ */ ot.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ ot.jsxs(
      "button",
      {
        ref: _,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: Jt(_s(), "flex items-center justify-between gap-2"),
        "data-testid": i,
        onClick: () => m ? f(!1) : S(),
        onKeyDown: N,
        children: [
          /* @__PURE__ */ ot.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ ot.jsx(Vs, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ ot.jsx(
      "div",
      {
        ref: w,
        role: "menu",
        "aria-label": n,
        className: Jt(
          fi,
          "absolute z-10 w-60 overflow-y-auto",
          o === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: d },
        onKeyDown: O,
        children: l.map((E) => /* @__PURE__ */ ot.jsx("button", { type: "button", role: "menuitem", className: _s(), "data-testid": E.testId, onClick: E.onSelect, children: /* @__PURE__ */ ot.jsx("span", { className: "block truncate", children: E.label }) }, E.key))
      }
    )
  ] });
}
function Vv(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const ks = {
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
function Ss(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((i) => i.id === n.parentSessionId);
}
function Kv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const i of n)
    Ss(i, n) && l.set(i.parentSessionId, [...l.get(i.parentSessionId) ?? [], i]);
  return l.size ? n.filter((i) => !Ss(i, n)).flatMap((i) => [i, ...l.get(i.id) ?? []]) : n;
}
const Yr = 6, Mf = 8;
function Xv(n, l = {}) {
  const { minWidth: i = 220, align: o = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, h = o === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, y = d.top - Yr - Mf, _ = f - d.bottom - Yr - Mf;
  return y >= s ? {
    position: "fixed",
    bottom: f - d.top + Yr,
    ...h,
    minWidth: i,
    maxHeight: Math.min(y, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Yr,
    ...h,
    minWidth: i,
    maxHeight: Math.min(_, f * 0.75),
    overflowY: "auto"
  };
}
function Cm(n, l, i, o) {
  de(() => {
    if (!n) return;
    function s(m) {
      const f = m.target, h = i.current?.contains(f) ?? !1, y = o.current?.contains(f) ?? !1;
      !h && !y && l(!1);
    }
    function d(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function Zv({ icon: n, fallback: l }) {
  const [i, o] = et.useState(!1);
  return de(() => o(!1), [n]), !n || i ? /* @__PURE__ */ ot.jsx(ot.Fragment, { children: l }) : /* @__PURE__ */ ot.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const Jv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Mm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Wv = `${Mm} group-aria-[checked=false]:text-accent`, Fv = `${Mm} group-aria-checked:text-accent`, $v = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", Iv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function Pv({
  mode: n,
  onChange: l,
  testId: i = "mode-switch",
  disabled: o = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ ot.jsxs(
    "button",
    {
      type: "button",
      className: Jv,
      "data-testid": i,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ ot.jsx("span", { className: Jt("mode-switch__label mode-switch__label--ui", Wv), children: "UI" }),
        /* @__PURE__ */ ot.jsx("span", { className: Jt("mode-switch__track", $v), children: /* @__PURE__ */ ot.jsx("span", { className: Jt("mode-switch__thumb", Iv) }) }),
        /* @__PURE__ */ ot.jsx("span", { className: Jt("mode-switch__label mode-switch__label--cli", Fv), children: "CLI" })
      ]
    }
  );
}
const Qa = function(n, l) {
  let s = n;
  const d = El[l];
  let m = null, f = 0, h = null;
  const y = [], _ = {}, w = function(p, v) {
    f = s * 4 + 17, m = (function(x) {
      const k = new Array(x);
      for (let C = 0; C < x; C += 1) {
        k[C] = new Array(x);
        for (let z = 0; z < x; z += 1)
          k[C][z] = null;
      }
      return k;
    })(f), b(0, 0), b(f - 7, 0), b(0, f - 7), O(), N(), j(p, v), s >= 7 && E(p), h == null && (h = J(s, d, y)), D(h, v);
  }, b = function(p, v) {
    for (let x = -1; x <= 7; x += 1)
      if (!(p + x <= -1 || f <= p + x))
        for (let k = -1; k <= 7; k += 1)
          v + k <= -1 || f <= v + k || (0 <= x && x <= 6 && (k == 0 || k == 6) || 0 <= k && k <= 6 && (x == 0 || x == 6) || 2 <= x && x <= 4 && 2 <= k && k <= 4 ? m[p + x][v + k] = !0 : m[p + x][v + k] = !1);
  }, S = function() {
    let p = 0, v = 0;
    for (let x = 0; x < 8; x += 1) {
      w(!0, x);
      const k = Un.getLostPoint(_);
      (x == 0 || p > k) && (p = k, v = x);
    }
    return v;
  }, N = function() {
    for (let p = 8; p < f - 8; p += 1)
      m[p][6] == null && (m[p][6] = p % 2 == 0);
    for (let p = 8; p < f - 8; p += 1)
      m[6][p] == null && (m[6][p] = p % 2 == 0);
  }, O = function() {
    const p = Un.getPatternPosition(s);
    for (let v = 0; v < p.length; v += 1)
      for (let x = 0; x < p.length; x += 1) {
        const k = p[v], C = p[x];
        if (m[k][C] == null)
          for (let z = -2; z <= 2; z += 1)
            for (let R = -2; R <= 2; R += 1)
              z == -2 || z == 2 || R == -2 || R == 2 || z == 0 && R == 0 ? m[k + z][C + R] = !0 : m[k + z][C + R] = !1;
      }
  }, E = function(p) {
    const v = Un.getBCHTypeNumber(s);
    for (let x = 0; x < 18; x += 1) {
      const k = !p && (v >> x & 1) == 1;
      m[Math.floor(x / 3)][x % 3 + f - 8 - 3] = k;
    }
    for (let x = 0; x < 18; x += 1) {
      const k = !p && (v >> x & 1) == 1;
      m[x % 3 + f - 8 - 3][Math.floor(x / 3)] = k;
    }
  }, j = function(p, v) {
    const x = d << 3 | v, k = Un.getBCHTypeInfo(x);
    for (let C = 0; C < 15; C += 1) {
      const z = !p && (k >> C & 1) == 1;
      C < 6 ? m[C][8] = z : C < 8 ? m[C + 1][8] = z : m[f - 15 + C][8] = z;
    }
    for (let C = 0; C < 15; C += 1) {
      const z = !p && (k >> C & 1) == 1;
      C < 8 ? m[8][f - C - 1] = z : C < 9 ? m[8][15 - C - 1 + 1] = z : m[8][15 - C - 1] = z;
    }
    m[f - 8][8] = !p;
  }, D = function(p, v) {
    let x = -1, k = f - 1, C = 7, z = 0;
    const R = Un.getMaskFunction(v);
    for (let Y = f - 1; Y > 0; Y -= 2)
      for (Y == 6 && (Y -= 1); ; ) {
        for (let W = 0; W < 2; W += 1)
          if (m[k][Y - W] == null) {
            let q = !1;
            z < p.length && (q = (p[z] >>> C & 1) == 1), R(k, Y - W) && (q = !q), m[k][Y - W] = q, C -= 1, C == -1 && (z += 1, C = 7);
          }
        if (k += x, k < 0 || f <= k) {
          k -= x, x = -x;
          break;
        }
      }
  }, B = function(p, v) {
    let x = 0, k = 0, C = 0;
    const z = new Array(v.length), R = new Array(v.length);
    for (let K = 0; K < v.length; K += 1) {
      const $ = v[K].dataCount, Q = v[K].totalCount - $;
      k = Math.max(k, $), C = Math.max(C, Q), z[K] = new Array($);
      for (let nt = 0; nt < z[K].length; nt += 1)
        z[K][nt] = 255 & p.getBuffer()[nt + x];
      x += $;
      const V = Un.getErrorCorrectPolynomial(Q), X = Ml(z[K], V.getLength() - 1).mod(V);
      R[K] = new Array(V.getLength() - 1);
      for (let nt = 0; nt < R[K].length; nt += 1) {
        const st = nt + X.getLength() - R[K].length;
        R[K][nt] = st >= 0 ? X.getAt(st) : 0;
      }
    }
    let Y = 0;
    for (let K = 0; K < v.length; K += 1)
      Y += v[K].totalCount;
    const W = new Array(Y);
    let q = 0;
    for (let K = 0; K < k; K += 1)
      for (let $ = 0; $ < v.length; $ += 1)
        K < z[$].length && (W[q] = z[$][K], q += 1);
    for (let K = 0; K < C; K += 1)
      for (let $ = 0; $ < v.length; $ += 1)
        K < R[$].length && (W[q] = R[$][K], q += 1);
    return W;
  }, J = function(p, v, x) {
    const k = Af.getRSBlocks(p, v), C = jf();
    for (let R = 0; R < x.length; R += 1) {
      const Y = x[R];
      C.put(Y.getMode(), 4), C.put(Y.getLength(), Un.getLengthInBits(Y.getMode(), p)), Y.write(C);
    }
    let z = 0;
    for (let R = 0; R < k.length; R += 1)
      z += k[R].dataCount;
    if (C.getLengthInBits() > z * 8)
      throw "code length overflow. (" + C.getLengthInBits() + ">" + z * 8 + ")";
    for (C.getLengthInBits() + 4 <= z * 8 && C.put(0, 4); C.getLengthInBits() % 8 != 0; )
      C.putBit(!1);
    for (; !(C.getLengthInBits() >= z * 8 || (C.put(236, 8), C.getLengthInBits() >= z * 8)); )
      C.put(17, 8);
    return B(C, k);
  };
  _.addData = function(p, v) {
    v = v || "Byte";
    let x = null;
    switch (v) {
      case "Numeric":
        x = t1(p);
        break;
      case "Alphanumeric":
        x = e1(p);
        break;
      case "Byte":
        x = n1(p);
        break;
      case "Kanji":
        x = a1(p);
        break;
      default:
        throw "mode:" + v;
    }
    y.push(x), h = null;
  }, _.isDark = function(p, v) {
    if (p < 0 || f <= p || v < 0 || f <= v)
      throw p + "," + v;
    return m[p][v];
  }, _.getModuleCount = function() {
    return f;
  }, _.make = function() {
    if (s < 1) {
      let p = 1;
      for (; p < 40; p++) {
        const v = Af.getRSBlocks(p, d), x = jf();
        for (let C = 0; C < y.length; C++) {
          const z = y[C];
          x.put(z.getMode(), 4), x.put(z.getLength(), Un.getLengthInBits(z.getMode(), p)), z.write(x);
        }
        let k = 0;
        for (let C = 0; C < v.length; C++)
          k += v[C].dataCount;
        if (x.getLengthInBits() <= k * 8)
          break;
      }
      s = p;
    }
    w(!1, S());
  }, _.createTableTag = function(p, v) {
    p = p || 2, v = typeof v > "u" ? p * 4 : v;
    let x = "";
    x += '<table style="', x += " border-width: 0px; border-style: none;", x += " border-collapse: collapse;", x += " padding: 0px; margin: " + v + "px;", x += '">', x += "<tbody>";
    for (let k = 0; k < _.getModuleCount(); k += 1) {
      x += "<tr>";
      for (let C = 0; C < _.getModuleCount(); C += 1)
        x += '<td style="', x += " border-width: 0px; border-style: none;", x += " border-collapse: collapse;", x += " padding: 0px; margin: 0px;", x += " width: " + p + "px;", x += " height: " + p + "px;", x += " background-color: ", x += _.isDark(k, C) ? "#000000" : "#ffffff", x += ";", x += '"/>';
      x += "</tr>";
    }
    return x += "</tbody>", x += "</table>", x;
  }, _.createSvgTag = function(p, v, x, k) {
    let C = {};
    typeof arguments[0] == "object" && (C = arguments[0], p = C.cellSize, v = C.margin, x = C.alt, k = C.title), p = p || 2, v = typeof v > "u" ? p * 4 : v, x = typeof x == "string" ? { text: x } : x || {}, x.text = x.text || null, x.id = x.text ? x.id || "qrcode-description" : null, k = typeof k == "string" ? { text: k } : k || {}, k.text = k.text || null, k.id = k.text ? k.id || "qrcode-title" : null;
    const z = _.getModuleCount() * p + v * 2;
    let R, Y, W, q, K = "", $;
    for ($ = "l" + p + ",0 0," + p + " -" + p + ",0 0,-" + p + "z ", K += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', K += C.scalable ? "" : ' width="' + z + 'px" height="' + z + 'px"', K += ' viewBox="0 0 ' + z + " " + z + '" ', K += ' preserveAspectRatio="xMinYMin meet"', K += k.text || x.text ? ' role="img" aria-labelledby="' + Z([k.id, x.id].join(" ").trim()) + '"' : "", K += ">", K += k.text ? '<title id="' + Z(k.id) + '">' + Z(k.text) + "</title>" : "", K += x.text ? '<description id="' + Z(x.id) + '">' + Z(x.text) + "</description>" : "", K += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', K += '<path d="', W = 0; W < _.getModuleCount(); W += 1)
      for (q = W * p + v, R = 0; R < _.getModuleCount(); R += 1)
        _.isDark(W, R) && (Y = R * p + v, K += "M" + Y + "," + q + $);
    return K += '" stroke="transparent" fill="black"/>', K += "</svg>", K;
  }, _.createDataURL = function(p, v) {
    p = p || 2, v = typeof v > "u" ? p * 4 : v;
    const x = _.getModuleCount() * p + v * 2, k = v, C = x - v;
    return o1(x, x, function(z, R) {
      if (k <= z && z < C && k <= R && R < C) {
        const Y = Math.floor((z - k) / p), W = Math.floor((R - k) / p);
        return _.isDark(W, Y) ? 0 : 1;
      } else
        return 1;
    });
  }, _.createImgTag = function(p, v, x) {
    p = p || 2, v = typeof v > "u" ? p * 4 : v;
    const k = _.getModuleCount() * p + v * 2;
    let C = "";
    return C += "<img", C += ' src="', C += _.createDataURL(p, v), C += '"', C += ' width="', C += k, C += '"', C += ' height="', C += k, C += '"', x && (C += ' alt="', C += Z(x), C += '"'), C += "/>", C;
  };
  const Z = function(p) {
    let v = "";
    for (let x = 0; x < p.length; x += 1) {
      const k = p.charAt(x);
      switch (k) {
        case "<":
          v += "&lt;";
          break;
        case ">":
          v += "&gt;";
          break;
        case "&":
          v += "&amp;";
          break;
        case '"':
          v += "&quot;";
          break;
        default:
          v += k;
          break;
      }
    }
    return v;
  }, T = function(p) {
    p = typeof p > "u" ? 2 : p;
    const x = _.getModuleCount() * 1 + p * 2, k = p, C = x - p;
    let z, R, Y, W, q;
    const K = {
      "██": "█",
      "█ ": "▀",
      " █": "▄",
      "  ": " "
    }, $ = {
      "██": "▀",
      "█ ": "▀",
      " █": " ",
      "  ": " "
    };
    let Q = "";
    for (z = 0; z < x; z += 2) {
      for (Y = Math.floor((z - k) / 1), W = Math.floor((z + 1 - k) / 1), R = 0; R < x; R += 1)
        q = "█", k <= R && R < C && k <= z && z < C && _.isDark(Y, Math.floor((R - k) / 1)) && (q = " "), k <= R && R < C && k <= z + 1 && z + 1 < C && _.isDark(W, Math.floor((R - k) / 1)) ? q += " " : q += "█", Q += p < 1 && z + 1 >= C ? $[q] : K[q];
      Q += `
`;
    }
    return x % 2 && p > 0 ? Q.substring(0, Q.length - x - 1) + Array(x + 1).join("▀") : Q.substring(0, Q.length - 1);
  };
  return _.createASCII = function(p, v) {
    if (p = p || 1, p < 2)
      return T(v);
    p -= 1, v = typeof v > "u" ? p * 2 : v;
    const x = _.getModuleCount() * p + v * 2, k = v, C = x - v;
    let z, R, Y, W;
    const q = Array(p + 1).join("██"), K = Array(p + 1).join("  ");
    let $ = "", Q = "";
    for (z = 0; z < x; z += 1) {
      for (Y = Math.floor((z - k) / p), Q = "", R = 0; R < x; R += 1)
        W = 1, k <= R && R < C && k <= z && z < C && _.isDark(Y, Math.floor((R - k) / p)) && (W = 0), Q += W ? q : K;
      for (Y = 0; Y < p; Y += 1)
        $ += Q + `
`;
    }
    return $.substring(0, $.length - 1);
  }, _.renderTo2dContext = function(p, v) {
    v = v || 2;
    const x = _.getModuleCount();
    for (let k = 0; k < x; k++)
      for (let C = 0; C < x; C++)
        p.fillStyle = _.isDark(k, C) ? "black" : "white", p.fillRect(C * v, k * v, v, v);
  }, _;
};
Qa.stringToBytes = function(n) {
  const l = [];
  for (let i = 0; i < n.length; i += 1) {
    const o = n.charCodeAt(i);
    l.push(o & 255);
  }
  return l;
};
Qa.createStringToBytes = function(n, l) {
  const i = (function() {
    const s = r1(n), d = function() {
      const h = s.read();
      if (h == -1) throw "eof";
      return h;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const h = s.read();
      if (h == -1) break;
      const y = d(), _ = d(), w = d(), b = String.fromCharCode(h << 8 | y), S = _ << 8 | w;
      f[b] = S, m += 1;
    }
    if (m != l)
      throw m + " != " + l;
    return f;
  })(), o = 63;
  return function(s) {
    const d = [];
    for (let m = 0; m < s.length; m += 1) {
      const f = s.charCodeAt(m);
      if (f < 128)
        d.push(f);
      else {
        const h = i[s.charAt(m)];
        typeof h == "number" ? (h & 255) == h ? d.push(h) : (d.push(h >>> 8), d.push(h & 255)) : d.push(o);
      }
    }
    return d;
  };
};
const ue = {
  MODE_NUMBER: 1,
  MODE_ALPHA_NUM: 2,
  MODE_8BIT_BYTE: 4,
  MODE_KANJI: 8
}, El = {
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
  ], l = 1335, i = 7973, o = 21522, s = {}, d = function(m) {
    let f = 0;
    for (; m != 0; )
      f += 1, m >>>= 1;
    return f;
  };
  return s.getBCHTypeInfo = function(m) {
    let f = m << 10;
    for (; d(f) - d(l) >= 0; )
      f ^= l << d(f) - d(l);
    return (m << 10 | f) ^ o;
  }, s.getBCHTypeNumber = function(m) {
    let f = m << 12;
    for (; d(f) - d(i) >= 0; )
      f ^= i << d(f) - d(i);
    return m << 12 | f;
  }, s.getPatternPosition = function(m) {
    return n[m - 1];
  }, s.getMaskFunction = function(m) {
    switch (m) {
      case Bn.PATTERN000:
        return function(f, h) {
          return (f + h) % 2 == 0;
        };
      case Bn.PATTERN001:
        return function(f, h) {
          return f % 2 == 0;
        };
      case Bn.PATTERN010:
        return function(f, h) {
          return h % 3 == 0;
        };
      case Bn.PATTERN011:
        return function(f, h) {
          return (f + h) % 3 == 0;
        };
      case Bn.PATTERN100:
        return function(f, h) {
          return (Math.floor(f / 2) + Math.floor(h / 3)) % 2 == 0;
        };
      case Bn.PATTERN101:
        return function(f, h) {
          return f * h % 2 + f * h % 3 == 0;
        };
      case Bn.PATTERN110:
        return function(f, h) {
          return (f * h % 2 + f * h % 3) % 2 == 0;
        };
      case Bn.PATTERN111:
        return function(f, h) {
          return (f * h % 3 + (f + h) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + m;
    }
  }, s.getErrorCorrectPolynomial = function(m) {
    let f = Ml([1], 0);
    for (let h = 0; h < m; h += 1)
      f = f.multiply(Ml([1, qn.gexp(h)], 0));
    return f;
  }, s.getLengthInBits = function(m, f) {
    if (1 <= f && f < 10)
      switch (m) {
        case ue.MODE_NUMBER:
          return 10;
        case ue.MODE_ALPHA_NUM:
          return 9;
        case ue.MODE_8BIT_BYTE:
          return 8;
        case ue.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + m;
      }
    else if (f < 27)
      switch (m) {
        case ue.MODE_NUMBER:
          return 12;
        case ue.MODE_ALPHA_NUM:
          return 11;
        case ue.MODE_8BIT_BYTE:
          return 16;
        case ue.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + m;
      }
    else if (f < 41)
      switch (m) {
        case ue.MODE_NUMBER:
          return 14;
        case ue.MODE_ALPHA_NUM:
          return 13;
        case ue.MODE_8BIT_BYTE:
          return 16;
        case ue.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + m;
      }
    else
      throw "type:" + f;
  }, s.getLostPoint = function(m) {
    const f = m.getModuleCount();
    let h = 0;
    for (let w = 0; w < f; w += 1)
      for (let b = 0; b < f; b += 1) {
        let S = 0;
        const N = m.isDark(w, b);
        for (let O = -1; O <= 1; O += 1)
          if (!(w + O < 0 || f <= w + O))
            for (let E = -1; E <= 1; E += 1)
              b + E < 0 || f <= b + E || O == 0 && E == 0 || N == m.isDark(w + O, b + E) && (S += 1);
        S > 5 && (h += 3 + S - 5);
      }
    for (let w = 0; w < f - 1; w += 1)
      for (let b = 0; b < f - 1; b += 1) {
        let S = 0;
        m.isDark(w, b) && (S += 1), m.isDark(w + 1, b) && (S += 1), m.isDark(w, b + 1) && (S += 1), m.isDark(w + 1, b + 1) && (S += 1), (S == 0 || S == 4) && (h += 3);
      }
    for (let w = 0; w < f; w += 1)
      for (let b = 0; b < f - 6; b += 1)
        m.isDark(w, b) && !m.isDark(w, b + 1) && m.isDark(w, b + 2) && m.isDark(w, b + 3) && m.isDark(w, b + 4) && !m.isDark(w, b + 5) && m.isDark(w, b + 6) && (h += 40);
    for (let w = 0; w < f; w += 1)
      for (let b = 0; b < f - 6; b += 1)
        m.isDark(b, w) && !m.isDark(b + 1, w) && m.isDark(b + 2, w) && m.isDark(b + 3, w) && m.isDark(b + 4, w) && !m.isDark(b + 5, w) && m.isDark(b + 6, w) && (h += 40);
    let y = 0;
    for (let w = 0; w < f; w += 1)
      for (let b = 0; b < f; b += 1)
        m.isDark(b, w) && (y += 1);
    const _ = Math.abs(100 * y / f / f - 50) / 5;
    return h += _ * 10, h;
  }, s;
})(), qn = (function() {
  const n = new Array(256), l = new Array(256);
  for (let o = 0; o < 8; o += 1)
    n[o] = 1 << o;
  for (let o = 8; o < 256; o += 1)
    n[o] = n[o - 4] ^ n[o - 5] ^ n[o - 6] ^ n[o - 8];
  for (let o = 0; o < 255; o += 1)
    l[n[o]] = o;
  const i = {};
  return i.glog = function(o) {
    if (o < 1)
      throw "glog(" + o + ")";
    return l[o];
  }, i.gexp = function(o) {
    for (; o < 0; )
      o += 255;
    for (; o >= 256; )
      o -= 255;
    return n[o];
  }, i;
})(), Ml = function(n, l) {
  if (typeof n.length > "u")
    throw n.length + "/" + l;
  const i = (function() {
    let s = 0;
    for (; s < n.length && n[s] == 0; )
      s += 1;
    const d = new Array(n.length - s + l);
    for (let m = 0; m < n.length - s; m += 1)
      d[m] = n[m + s];
    return d;
  })(), o = {};
  return o.getAt = function(s) {
    return i[s];
  }, o.getLength = function() {
    return i.length;
  }, o.multiply = function(s) {
    const d = new Array(o.getLength() + s.getLength() - 1);
    for (let m = 0; m < o.getLength(); m += 1)
      for (let f = 0; f < s.getLength(); f += 1)
        d[m + f] ^= qn.gexp(qn.glog(o.getAt(m)) + qn.glog(s.getAt(f)));
    return Ml(d, 0);
  }, o.mod = function(s) {
    if (o.getLength() - s.getLength() < 0)
      return o;
    const d = qn.glog(o.getAt(0)) - qn.glog(s.getAt(0)), m = new Array(o.getLength());
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] = o.getAt(f);
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] ^= qn.gexp(qn.glog(s.getAt(f)) + d);
    return Ml(m, 0).mod(s);
  }, o;
}, Af = (function() {
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
  ], l = function(s, d) {
    const m = {};
    return m.totalCount = s, m.dataCount = d, m;
  }, i = {}, o = function(s, d) {
    switch (d) {
      case El.L:
        return n[(s - 1) * 4 + 0];
      case El.M:
        return n[(s - 1) * 4 + 1];
      case El.Q:
        return n[(s - 1) * 4 + 2];
      case El.H:
        return n[(s - 1) * 4 + 3];
      default:
        return;
    }
  };
  return i.getRSBlocks = function(s, d) {
    const m = o(s, d);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + s + "/errorCorrectionLevel:" + d;
    const f = m.length / 3, h = [];
    for (let y = 0; y < f; y += 1) {
      const _ = m[y * 3 + 0], w = m[y * 3 + 1], b = m[y * 3 + 2];
      for (let S = 0; S < _; S += 1)
        h.push(l(w, b));
    }
    return h;
  }, i;
})(), jf = function() {
  const n = [];
  let l = 0;
  const i = {};
  return i.getBuffer = function() {
    return n;
  }, i.getAt = function(o) {
    const s = Math.floor(o / 8);
    return (n[s] >>> 7 - o % 8 & 1) == 1;
  }, i.put = function(o, s) {
    for (let d = 0; d < s; d += 1)
      i.putBit((o >>> s - d - 1 & 1) == 1);
  }, i.getLengthInBits = function() {
    return l;
  }, i.putBit = function(o) {
    const s = Math.floor(l / 8);
    n.length <= s && n.push(0), o && (n[s] |= 128 >>> l % 8), l += 1;
  }, i;
}, t1 = function(n) {
  const l = ue.MODE_NUMBER, i = n, o = {};
  o.getMode = function() {
    return l;
  }, o.getLength = function(m) {
    return i.length;
  }, o.write = function(m) {
    const f = i;
    let h = 0;
    for (; h + 2 < f.length; )
      m.put(s(f.substring(h, h + 3)), 10), h += 3;
    h < f.length && (f.length - h == 1 ? m.put(s(f.substring(h, h + 1)), 4) : f.length - h == 2 && m.put(s(f.substring(h, h + 2)), 7));
  };
  const s = function(m) {
    let f = 0;
    for (let h = 0; h < m.length; h += 1)
      f = f * 10 + d(m.charAt(h));
    return f;
  }, d = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return o;
}, e1 = function(n) {
  const l = ue.MODE_ALPHA_NUM, i = n, o = {};
  o.getMode = function() {
    return l;
  }, o.getLength = function(d) {
    return i.length;
  }, o.write = function(d) {
    const m = i;
    let f = 0;
    for (; f + 1 < m.length; )
      d.put(
        s(m.charAt(f)) * 45 + s(m.charAt(f + 1)),
        11
      ), f += 2;
    f < m.length && d.put(s(m.charAt(f)), 6);
  };
  const s = function(d) {
    if ("0" <= d && d <= "9")
      return d.charCodeAt(0) - 48;
    if ("A" <= d && d <= "Z")
      return d.charCodeAt(0) - 65 + 10;
    switch (d) {
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
        throw "illegal char :" + d;
    }
  };
  return o;
}, n1 = function(n) {
  const l = ue.MODE_8BIT_BYTE, i = Qa.stringToBytes(n), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(s) {
    return i.length;
  }, o.write = function(s) {
    for (let d = 0; d < i.length; d += 1)
      s.put(i[d], 8);
  }, o;
}, a1 = function(n) {
  const l = ue.MODE_KANJI, i = Qa.stringToBytes;
  (function(d, m) {
    const f = i(d);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const o = i(n), s = {};
  return s.getMode = function() {
    return l;
  }, s.getLength = function(d) {
    return ~~(o.length / 2);
  }, s.write = function(d) {
    const m = o;
    let f = 0;
    for (; f + 1 < m.length; ) {
      let h = (255 & m[f]) << 8 | 255 & m[f + 1];
      if (33088 <= h && h <= 40956)
        h -= 33088;
      else if (57408 <= h && h <= 60351)
        h -= 49472;
      else
        throw "illegal char at " + (f + 1) + "/" + h;
      h = (h >>> 8 & 255) * 192 + (h & 255), d.put(h, 13), f += 2;
    }
    if (f < m.length)
      throw "illegal char at " + (f + 1);
  }, s;
}, Am = function() {
  const n = [], l = {};
  return l.writeByte = function(i) {
    n.push(i & 255);
  }, l.writeShort = function(i) {
    l.writeByte(i), l.writeByte(i >>> 8);
  }, l.writeBytes = function(i, o, s) {
    o = o || 0, s = s || i.length;
    for (let d = 0; d < s; d += 1)
      l.writeByte(i[d + o]);
  }, l.writeString = function(i) {
    for (let o = 0; o < i.length; o += 1)
      l.writeByte(i.charCodeAt(o));
  }, l.toByteArray = function() {
    return n;
  }, l.toString = function() {
    let i = "";
    i += "[";
    for (let o = 0; o < n.length; o += 1)
      o > 0 && (i += ","), i += n[o];
    return i += "]", i;
  }, l;
}, l1 = function() {
  let n = 0, l = 0, i = 0, o = "";
  const s = {}, d = function(f) {
    o += String.fromCharCode(m(f & 63));
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
  return s.writeByte = function(f) {
    for (n = n << 8 | f & 255, l += 8, i += 1; l >= 6; )
      d(n >>> l - 6), l -= 6;
  }, s.flush = function() {
    if (l > 0 && (d(n << 6 - l), n = 0, l = 0), i % 3 != 0) {
      const f = 3 - i % 3;
      for (let h = 0; h < f; h += 1)
        o += "=";
    }
  }, s.toString = function() {
    return o;
  }, s;
}, r1 = function(n) {
  const l = n;
  let i = 0, o = 0, s = 0;
  const d = {};
  d.read = function() {
    for (; s < 8; ) {
      if (i >= l.length) {
        if (s == 0)
          return -1;
        throw "unexpected end of file./" + s;
      }
      const h = l.charAt(i);
      if (i += 1, h == "=")
        return s = 0, -1;
      if (h.match(/^\s$/))
        continue;
      o = o << 6 | m(h.charCodeAt(0)), s += 6;
    }
    const f = o >>> s - 8 & 255;
    return s -= 8, f;
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
  return d;
}, i1 = function(n, l) {
  const i = n, o = l, s = new Array(n * l), d = {};
  d.setPixel = function(y, _, w) {
    s[_ * i + y] = w;
  }, d.write = function(y) {
    y.writeString("GIF87a"), y.writeShort(i), y.writeShort(o), y.writeByte(128), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(255), y.writeByte(255), y.writeByte(255), y.writeString(","), y.writeShort(0), y.writeShort(0), y.writeShort(i), y.writeShort(o), y.writeByte(0);
    const _ = 2, w = f(_);
    y.writeByte(_);
    let b = 0;
    for (; w.length - b > 255; )
      y.writeByte(255), y.writeBytes(w, b, 255), b += 255;
    y.writeByte(w.length - b), y.writeBytes(w, b, w.length - b), y.writeByte(0), y.writeString(";");
  };
  const m = function(y) {
    const _ = y;
    let w = 0, b = 0;
    const S = {};
    return S.write = function(N, O) {
      if (N >>> O)
        throw "length over";
      for (; w + O >= 8; )
        _.writeByte(255 & (N << w | b)), O -= 8 - w, N >>>= 8 - w, b = 0, w = 0;
      b = N << w | b, w = w + O;
    }, S.flush = function() {
      w > 0 && _.writeByte(b);
    }, S;
  }, f = function(y) {
    const _ = 1 << y, w = (1 << y) + 1;
    let b = y + 1;
    const S = h();
    for (let D = 0; D < _; D += 1)
      S.add(String.fromCharCode(D));
    S.add(String.fromCharCode(_)), S.add(String.fromCharCode(w));
    const N = Am(), O = m(N);
    O.write(_, b);
    let E = 0, j = String.fromCharCode(s[E]);
    for (E += 1; E < s.length; ) {
      const D = String.fromCharCode(s[E]);
      E += 1, S.contains(j + D) ? j = j + D : (O.write(S.indexOf(j), b), S.size() < 4095 && (S.size() == 1 << b && (b += 1), S.add(j + D)), j = D);
    }
    return O.write(S.indexOf(j), b), O.write(w, b), O.flush(), N.toByteArray();
  }, h = function() {
    const y = {};
    let _ = 0;
    const w = {};
    return w.add = function(b) {
      if (w.contains(b))
        throw "dup key:" + b;
      y[b] = _, _ += 1;
    }, w.size = function() {
      return _;
    }, w.indexOf = function(b) {
      return y[b];
    }, w.contains = function(b) {
      return typeof y[b] < "u";
    }, w;
  };
  return d;
}, o1 = function(n, l, i) {
  const o = i1(n, l);
  for (let f = 0; f < l; f += 1)
    for (let h = 0; h < n; h += 1)
      o.setPixel(h, f, i(h, f));
  const s = Am();
  o.write(s);
  const d = l1(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Qa.stringToBytes;
function s1({ text: n }) {
  const { size: l, path: i } = et.useMemo(() => {
    const o = Qa(0, "M");
    o.addData(n), o.make();
    const s = o.getModuleCount();
    let d = "";
    for (let m = 0; m < s; m++)
      for (let f = 0; f < s; f++) o.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: s, path: d };
  }, [n]);
  return /* @__PURE__ */ ot.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ ot.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ ot.jsx("path", { d: i, fill: "#000" })
      ]
    }
  );
}
const Al = et.createContext(""), Es = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function c1({ title: n, children: l, testId: i, ariaLabel: o }) {
  const s = et.useContext(Al), d = s !== "" && Es(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ ot.jsxs("section", { className: s && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": i, "aria-label": o, children: [
      n && /* @__PURE__ */ ot.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ ot.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ ot.jsx(Al.Provider, { value: d ? "" : s, children: l }) })
    ] })
  );
}
function u1({ title: n, description: l, children: i, testId: o }) {
  const s = et.useContext(Al);
  return s && !Es(n, s) && !Es(l, s) ? null : /* @__PURE__ */ ot.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ ot.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ ot.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ ot.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    i && /* @__PURE__ */ ot.jsx("div", { className: "flex shrink-0 items-center gap-2", children: i })
  ] });
}
function d1({ checked: n, onChange: l, testId: i, label: o }) {
  return /* @__PURE__ */ ot.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": o,
      "data-testid": i,
      checked: n,
      onChange: (s) => l(s.target.checked),
      className: "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    }
  );
}
//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
const f1 = () => et.useContext(Al), m1 = {
  select: Ls,
  selectHost: Av,
  input: jv,
  inputPort: Ov,
  inputWide: Rv,
  addRow: Dv,
  list: Hv,
  hostRow: Uv,
  name: qv,
  addr: Yv,
  muted: Cv,
  empty: Mv,
  primary: Gv,
  danger: Lv,
  catalogToggle: Tv
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const p1 = 512, Ie = /* @__PURE__ */ new Map(), Nl = /* @__PURE__ */ new Map();
function jm(n, l) {
  Ie.delete(n), Ie.set(n, l);
  for (const i of Ie.keys()) {
    if (Ie.size <= p1) break;
    Nl.get(i)?.size || Ie.delete(i);
  }
}
function h1(n, l) {
  return Ie.has(n) ? Ie.get(n) : l;
}
function g1(n, l, i) {
  const o = h1(n, i), s = typeof l == "function" ? l(o) : l;
  if (!(Ie.has(n) && Object.is(s, o))) {
    jm(n, s);
    for (const d of [...Nl.get(n) ?? []]) d();
  }
}
function b1(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Ie.has(n) || jm(n, l);
  const i = et.useCallback((d) => {
    const m = Nl.get(n) ?? /* @__PURE__ */ new Set();
    return Nl.set(n, m), m.add(d), () => {
      m.delete(d), m.size || Nl.delete(n);
    };
  }, [n]), o = et.useSyncExternalStore(i, () => Ie.get(n)), s = et.useCallback((d) => g1(n, d, l), [n]);
  return [o, s];
}
const v1 = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", y1 = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const x1 = "1.3.0";
let Kr = null;
const w1 = (n) => {
  Kr = n;
};
function St() {
  const n = (typeof Kr == "function" ? Kr() : Kr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const _1 = (n) => St().subscribe?.(n) ?? (() => {
}), k1 = Xv;
function S1() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Om = globalThis.perch?.isMac !== !1, zs = (n) => dv(n, St().isMac !== !1), E1 = (n) => mv(n), z1 = ({ className: n, ...l } = {}) => Jt(hv(l), n), N1 = bv, Rm = (n) => _s(n), Xr = vv, T1 = Gs, C1 = Em, M1 = (n) => ks[n].color, A1 = (n, l) => St().shortcutFor?.(n, l) ?? null, j1 = (n) => St().shortcutLabel?.(n) ?? null, mi = (n, l) => St().command(n, l ?? {}) !== !1, O1 = (n, l, i) => St().startSession?.(n, l, i), R1 = globalThis.perch?.pickFolder ? (n) => St().pickFolder(n) : null;
function Pt(n) {
  const l = et.useRef(n);
  return l.current = n, et.useSyncExternalStore(_1, () => l.current(St()));
}
const Dm = (n = {}) => Pt((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), D1 = () => Pt((n) => n.hosts()), H1 = () => Pt((n) => n.sessionFolders());
function B1() {
  const n = Pt((l) => l.addProject?.() ?? U1);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, i, o) => {
      l.trim() && n.status !== "pending" && St().addProjectFolder?.(l, i, o);
    },
    clear: () => St().clearAddProject?.()
  };
}
const U1 = Object.freeze({ status: "idle" }), Hm = "perch.lastAgentChoice", q1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Y1 = () => {
  const n = St().storage?.getItem(Hm);
  return n === "claude" || n === "codex" ? n : "claude";
}, G1 = Object.freeze({ items: [] });
function L1() {
  const n = Pt((l) => l.notifications?.() ?? G1);
  return et.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => St().command("notification.open", { id: l }),
    dismiss: (l) => St().command("notification.dismiss", { id: l })
  }), [n]);
}
function Q1(n) {
  const l = Pt((s) => s.agentChoices?.(n) ?? q1), [i, o] = et.useState(Y1);
  return et.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: i,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (St().storage?.setItem(Hm, s), o(s));
    },
    manage: () => St().command("agents.manage", {})
  }), [l, i]);
}
function V1(n) {
  de(() => St().onRequest?.("add-project", n) ?? void 0, [n]);
}
function K1(n) {
  const l = n.map((i) => ({ id: i.id, parentSessionId: i.parentId, session: i }));
  return Kv(l).map((i) => ({ session: i.session, nested: Ss(i, l) }));
}
function X1({ id: n, plain: l, className: i }) {
  const o = Pt((y) => y.session(n));
  if (!o) return null;
  const s = o.state ?? Vv(o), d = ks[s]?.color ?? ks.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", h = l ? Jt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", i) : Jt("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", i);
  return et.createElement(
    "span",
    { className: h, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    et.createElement("span", { className: Jt("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, et.createElement(Bm, { provider: m, size: 14 }))
  );
}
function Bm({ provider: n, size: l = 14 }) {
  const i = St().agentIcon?.(n, l) ?? null, o = i?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return et.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": o, ...i && i.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Z1 = ({ children: n }) => et.createElement(et.Fragment, null, n);
function J1(n, l) {
  const i = et.useRef(l);
  return i.current = l, de(() => {
    const o = St();
    if (!o.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(i.current))
      s[m] = typeof f == "function" ? (...h) => i.current[m]?.(...h) : f;
    const d = o.openOverlay(n, s);
    return () => o.closeOverlay?.(d);
  }, [n]), null;
}
const fa = (n) => function(i) {
  return J1(n, i);
}, W1 = fa("session-menu"), F1 = fa("new-session-menu"), $1 = fa("confirm");
let Um = null;
const I1 = (n) => {
  Um = n;
};
function P1(n) {
  return et.createElement(Um ?? $1, n);
}
function ty({ className: n = Ls, ...l }) {
  return et.createElement(Ev, { ...l, className: n });
}
let Ns = null;
const ey = (n) => {
  Ns = n;
}, ny = fa("folder-browser");
function ay(n) {
  return Ns ? et.createElement(Ns, { ...n, browse: (l) => St().browse(n.hostId, l) }) : et.createElement(ny, n);
}
const ly = fa("instructions"), ry = fa("memory"), iy = kv;
let Ks = null;
const oy = (n) => {
  Ks = n;
};
function sy(n) {
  if (Ks) return et.createElement(uy, n);
  const { hostId: l, path: i, className: o } = n, s = et.useRef(null);
  return et.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Jt("worktree-menu__btn", Em, o),
      "data-testid": `worktree-menu-${l}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => St().openOverlay?.("worktree", { hostId: l, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    et.createElement(zm, null)
  );
}
const qm = "Perch did not answer.";
function Gr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: qm };
}
function cy(n, l, i = St()) {
  const o = (s) => {
    for (const d of s ?? []) {
      if (d.path === l) return d;
      const m = o(d.children);
      if (m) return m;
    }
    return null;
  };
  for (const s of i.navigation({})?.projects ?? []) {
    if (s.hostId !== n) continue;
    const d = o(s.workspaces) ?? o(s.hidden);
    if (d) return d;
  }
  return null;
}
const Of = 5 * 6e4;
function Ym(n, l, i, o = St()) {
  const s = Date.now() + Of;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(y);
  }, h = () => {
    if (!d) {
      if (Date.now() >= s) return f();
      cy(n, l, o) && (f(), o.startSession?.(n, l, i));
    }
  }, y = setTimeout(f, Of);
  m = o.subscribe?.(h) ?? (() => {
  }), h();
}
function uy({ hostId: n, path: l, className: i, worktrees: o, request: s, parentChoices: d, emptyAgent: m, ...f }) {
  const [h, y] = et.useState(o), _ = (k) => !!St().coreCan?.(k, n), w = Dm(), b = `${n}:${l}`, S = et.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!_("workspace.nest")) return [];
    const k = w?.projects?.find((R) => R.hostId === n && R.repoPath === l), C = [], z = (R, Y) => {
      for (const W of R ?? [])
        Y && C.push({ id: W.id, name: W.name, path: W.path }), z(W.children, !0);
    };
    return z(k?.workspaces, !1), C;
  }, [d, w, n, l]), N = n === "local" && _("worktree.job"), O = f.deleteSupported ?? _("worktree.delete"), E = f.startFromSupported ?? _("worktree.startFrom"), j = Pt((k) => k.emptyWorkspaceAgent?.() ?? void 0), D = m ?? j ?? void 0, B = Pt((k) => k.worktreeMenuRequest?.() ?? null), J = B?.projectKey === b ? B.nonce : null, Z = et.useMemo(() => s ?? (J == null ? null : B), [s, J]), [T, p] = et.useState(Z);
  de(() => {
    Z && p(Z);
  }, [Z]);
  const v = et.useRef({});
  v.current = { background: N, deleteSupported: O };
  const x = et.useMemo(() => {
    const k = (C, z) => St().ask(C, { hostId: n, repoPath: l, ...z });
    return {
      list: async () => {
        const C = await k("worktree.list", {});
        return C?.type === "worktree.list.result" && y({ worktrees: C.worktrees ?? [], defaultRoot: C.defaultRoot ?? "", baseRef: C.baseRef, refs: C.refs ?? [] }), Gr(C);
      },
      create: async ({ branch: C, newBranch: z, path: R, extra: Y, agent: W }) => {
        const q = { branch: C, newBranch: !!z, path: R ?? null, name: Y?.name ?? null, startFrom: Y?.startFrom ?? null, parentWorkspaceId: Y?.parentWorkspaceId ?? null }, { background: K } = v.current, $ = await k(K ? "worktree.job.start" : "worktree.create", q), Q = K ? "worktree.job.started" : "worktree.done";
        if ($?.type !== Q) return { error: Gr($).error ?? qm };
        const V = K ? $.job?.path : $.path;
        return W && V && Ym(n, V, W), { background: K };
      },
      remove: async (C, z) => {
        const R = await k("worktree.remove", { path: C, force: !!z, deleteBranch: v.current.deleteSupported });
        return { ...Gr(R), preservedBranch: R?.type === "worktree.done" ? R.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (C, z) => Gr(await k("worktree.branch.delete", { branch: C, expectedHead: z })),
      open: (C) => St().startSession?.(n, C, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => St().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return et.createElement(Ks, {
    hostId: n,
    cwd: l,
    projectKey: b,
    className: i,
    worktrees: h,
    background: N,
    startFromSupported: E,
    deleteSupported: O,
    parentChoices: S,
    emptyAgent: D,
    request: T,
    actions: x
  });
}
const dy = (n, l) => {
  if (!St().followPointer?.(n)) return;
  const i = l.items();
  for (const o of i) o.getBoundingClientRect();
  i[0]?.parentElement?.getBoundingClientRect(), ov(n, l);
}, fy = () => Pt((n) => n.workspaceTabs()), my = () => Pt((n) => n.statusLine()), py = () => Pt((n) => n.zoom()), hy = () => Pt((n) => n.paneLook()), gy = () => Pt((n) => n.keybindings?.() ?? []), by = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function vy(n) {
  const l = !!n?.keepFresh, i = Pt((s) => s.statusLine?.().connected ?? !1), o = Pt((s) => s.planUsage?.() ?? by);
  return de(() => {
    if (!l || !i) return;
    let s;
    const d = () => {
      St().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, i]), o;
}
const yy = () => St().command("usage.get", { force: !0 }), xy = (n) => St().command("usage.redeemReset", { accountId: n }), wy = () => mi("app.zoom_reset"), _y = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, ky = (n, l, i) => St().beginTabDrag?.(n, l, i);
function Sy(n) {
  de(() => St().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Ey = (n) => mi("browser.open", { workspaceId: n }), zy = (n, l) => mi("file.open", { workspaceId: n, path: l }), Ny = () => null, Ty = () => null, Cy = fa("new-file");
function My(n, l) {
  const i = n.selection(l);
  if (i) return i;
  const o = n.value(l), s = o.split(`
`).length - (o.endsWith(`
`) && o.length ? 1 : 0);
  return { text: o, startLine: 1, endLine: Math.max(1, s) };
}
function Ay({ onGo: n, onClose: l }) {
  const [i, o] = et.useState(""), s = (d) => {
    d?.preventDefault?.();
    const [m, f] = i.split(":").map((h) => Number.parseInt(h, 10));
    Number.isFinite(m) ? n(m, Number.isFinite(f) ? f : 1) : l();
  };
  return et.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    et.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    et.createElement("input", {
      id: "perch-editor-goto",
      "data-testid": "editor-goto-line",
      autoFocus: !0,
      value: i,
      className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (d) => o(d.target.value),
      onKeyDown: (d) => {
        d.key === "Escape" ? (d.preventDefault(), l()) : d.key === "Enter" && s(d);
      }
    }),
    et.createElement("button", { type: "button", className: Gs, onClick: s }, "OK")
  );
}
function jy({ value: n, onChange: l, onSave: i, onCaret: o, readOnly: s, wrap: d, label: m, path: f, docKey: h, onAskAgent: y, ref: _ }) {
  const w = St().editor, b = et.useRef(null);
  b.current = { onChange: l, onSave: i, onCaret: o, onAskAgent: y };
  const S = et.useRef(n), [N, O] = et.useState(null), [E, j] = et.useState(!1), D = () => {
    if (!w || !b.current.onAskAgent) return;
    const { text: Z, startLine: T, endLine: p } = My(w, h);
    b.current.onAskAgent(Z, T, p);
  };
  if (et.useImperativeHandle(_, () => ({
    openGoto: () => j(!0),
    focus: () => w?.focus(h),
    askAgent: D
  }), [h]), Jr(() => {
    if (!w) return;
    w.open(h, { path: f, value: n, readonly: !!s, wrap: !!d, label: m }), S.current = n;
    const Z = w.watch(h, (T) => {
      for (const p of T)
        if (p.type === "change") {
          const v = w.value(h);
          S.current = v, b.current.onChange?.(v);
        } else p.type === "caret" ? b.current.onCaret?.({ line: p.line, col: p.col }) : p.type === "save" ? b.current.onSave?.() : p.type === "goto" ? j(!0) : p.type === "contextmenu" && O({ x: p.x, y: p.y });
    });
    return () => {
      Z(), w.park(h);
    };
  }, [h]), de(() => {
    !w || n === S.current || (S.current = n, w.setValue(h, n, { external: !0 }));
  }, [h, n]), de(() => {
    w?.setReadonly(h, !!s);
  }, [h, s]), de(() => {
    w?.setWrap(h, !!d);
  }, [h, d]), !w)
    return et.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: s, onChange: (Z) => l?.(Z.target.value) });
  const B = (Z) => () => {
    O(null), Z(), w.focus(h);
  }, J = N ? !!w.selection(h) : !1;
  return et.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    E && et.createElement(Ay, {
      onGo: (Z, T) => {
        j(!1), w.goTo(h, Z, T), w.focus(h);
      },
      onClose: () => {
        j(!1), w.focus(h);
      }
    }),
    et.createElement("div", { "data-perch-engine": "editor", "data-perch-key": h, className: "min-h-0 min-w-0 flex-1" }),
    N && et.createElement(Nv, {
      x: N.x,
      y: N.y,
      readOnly: !!s,
      canUndo: w.canUndo(h),
      canRedo: w.canRedo(h),
      hasSelection: J,
      onClose: () => O(null),
      actions: {
        undo: B(() => w.undo(h)),
        redo: B(() => w.redo(h)),
        cut: B(() => w.cut(h)),
        copy: B(() => w.copy(h)),
        paste: B(() => w.paste(h)),
        selectAll: B(() => w.selectAll(h)),
        find: B(() => w.openSearch(h, !1)),
        replace: B(() => w.openSearch(h, !0)),
        gotoLine: () => {
          O(null), j(!0);
        },
        ...y ? { askAgent: () => {
          O(null), D();
        } } : {}
      }
    })
  );
}
const Oy = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Ry(n) {
  const l = Pt((i) => i.browserPages?.(n) ?? Oy);
  return et.useMemo(() => {
    const i = (o, s) => St().command(o, { workspaceId: n, ...s });
    return {
      pages: l.pages ?? [],
      shownId: l.shownId ?? null,
      tabCount: l.tabCount ?? 0,
      open: () => {
        const o = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        return i("browser.drawer.open", { id: o }), o;
      },
      select: (o) => i("browser.drawer.select", { id: o }),
      close: (o) => i("browser.drawer.close", { id: o }),
      closeAll: () => i("browser.drawer.closeAll", {}),
      // The window follows the page itself; nothing to keep here.
      setUrl: () => {
      }
    };
  }, [l, n]);
}
function Dy({ pageId: n, active: l }) {
  const i = `drawer
${n}`;
  return de(() => {
    l && St().command("browser.focus", { key: i });
  }, [l, i]), et.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": i,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const Iy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Bm,
  BrowserPage: Dy,
  Chevron: Vs,
  CloseIcon: wv,
  CodeEditor: jy,
  ConfirmDialog: P1,
  Dialog: iy,
  EllipsisIcon: yv,
  FolderBrowser: ay,
  GearIcon: xv,
  HostStateDot: _v,
  InstructionsDialog: ly,
  MemoryDialog: ry,
  ModeSwitch: Pv,
  NewFilePrompt: Cy,
  NewSessionMenu: F1,
  PageIcon: Zv,
  PlusIcon: zm,
  QrCode: s1,
  Select: ty,
  SessionDot: X1,
  SessionMenu: W1,
  SettingRow: u1,
  SettingsGroup: c1,
  SettingsQuery: Al,
  Slot: Z1,
  Submenu: Qv,
  Switch: d1,
  TabDragLayer: Ty,
  TabMenu: Ny,
  WorktreeMenu: sy,
  agentStateColor: M1,
  anchoredPopoverStyle: k1,
  beginReorderDrag: dy,
  beginTabDrag: ky,
  bindHost: w1,
  buttonClass: N1,
  cn: Jt,
  drawConfirmationsInPlace: I1,
  drawFolderBrowserInPlace: ey,
  drawWorktreeInPlace: oy,
  ghostButton: T1,
  glassClass: v1,
  iconButton: C1,
  isMac: Om,
  keyLabel: zs,
  menuDividerClass: Xr,
  menuItemClass: Rm,
  menuPanel: fi,
  nestSessions: K1,
  newId: S1,
  openBrowserTab: Ey,
  openFileTab: zy,
  pickFolder: R1,
  redeemUsageReset: xy,
  refreshUsage: yy,
  resetZoom: wy,
  rowActionClass: z1,
  runCommand: mi,
  segmentClass: E1,
  settingsClass: m1,
  shortcutFor: A1,
  shortcutLabel: j1,
  startPaneWhenReady: Ym,
  startSession: O1,
  tabStateClass: _y,
  tapButtonClass: y1,
  useAddProject: B1,
  useAddProjectRequest: V1,
  useAgentChoices: Q1,
  useBrowserPages: Ry,
  useDismissOnOutsideClick: Cm,
  useHostSnapshot: Pt,
  useHosts: D1,
  useKeybindings: gy,
  useNavigation: Dm,
  useNewTabRequest: Sy,
  useNotifications: L1,
  usePaneLook: hy,
  usePlanUsage: vy,
  useResourceState: b1,
  useSessionFolders: H1,
  useSettingsQuery: f1,
  useStatusLine: my,
  useWorkspaceTabs: fy,
  useZoom: py,
  version: x1
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
const Xs = {
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
  Xs[n] = (l, i) => l[n](i);
const Py = Object.keys(Xs);
function ss(n, l) {
  for (const [i, o] of Object.entries(l)) {
    const s = Xs[i];
    if (!s) throw new Error(`the description key ${i} has no GPUI builder`);
    o != null && (n = s(n, o));
  }
  return n;
}
const sa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Ts = /* @__PURE__ */ new WeakSet(), Zr = /* @__PURE__ */ new WeakSet();
function Rf(n, l, i) {
  const o = n.pressed, s = sa(i);
  return o && o.x === s.clientX && o.y === s.clientY ? o.id : l;
}
function Hy(n, l, i) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && ii.has(n.group) || i)) return null;
  const o = n.meta?.attrs["data-testid"];
  return o ? `~${n.id}:${o}` : `~${n.id}`;
}
const Gm = (n, l = !1) => (n.children ?? []).some((i) => i.kind === "text" ? !l || /\s/.test(String(i.text ?? "").trim()) : i.kind === "div" && i.style?.flex_direction !== "row" && i.style?.whitespace !== "nowrap" && Gm(i, !0)), Te = (n) => n.style?.display !== "hidden";
let ii = /* @__PURE__ */ new Set(), Cs = null;
const Df = /* @__PURE__ */ new WeakMap();
function Lm(n, l = /* @__PURE__ */ new Set()) {
  let i = Df.get(n);
  if (!i) {
    i = /* @__PURE__ */ new Set();
    for (const { group: o, style: s } of n.group_hover ?? []) "display" in s && i.add(o);
    for (const o of n.children ?? []) if (o.kind !== "text") for (const s of Lm(o)) i.add(s);
    Df.set(n, i);
  }
  for (const o of i) l.add(o);
  return l;
}
let $e = null;
const By = (n, l, i, o, s, d, m) => `${+l}|${i}|${o.text_size}|${o.line_height}|${o.whitespace}|${o.text_ellipsis}|${+s}|${d ? `${d.group}|${d.color}` : ""}|${+Ts.has(n)}|${+Zr.has(n)}|${m.get(n)?.flex_basis ?? ""}`, Hf = /* @__PURE__ */ new WeakMap();
function Qm(n) {
  let l = Hf.get(n);
  return l === void 0 && (l = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((i) => i.kind !== "text" && Qm(i)), Hf.set(n, l)), l;
}
function Vm(n, l, i, o) {
  let s = Uy(l.get(n), i.get(n));
  if (n.kind === "text") return s;
  for (const d of n.children ?? []) Vm(d, l, i, o) || (s = !1);
  return s && o.add(n), s;
}
function Uy(n, l) {
  if (n === l) return !0;
  if (!n || !l) return !1;
  const i = Object.keys(n);
  if (i.length !== Object.keys(l).length) return !1;
  for (const o of i) if (n[o] !== l[o]) return !1;
  return !0;
}
function Ms(n, l, i, o, s = !1, d = !1, m = null, f = {}, h = !1, y = /* @__PURE__ */ new Map(), _ = null) {
  if (n.kind === "text") return y.get(n)?.text ?? n.text;
  const w = $e && !s && !Qm(n) ? By(n, d, m, f, h, _, y) : null;
  if (w !== null && $e.clean.has(n)) {
    const S = $e.from.get(n), N = S?.key === w ? l.reuse(S.id, $e.generation) : null;
    if (N)
      return $e.next.set(n, { id: N.__id, key: w }), N;
  }
  const b = qy(n, l, i, o, s, d, m, f, h, y, _);
  return w !== null && $e.next.set(n, { id: b.__id, key: w }), b;
}
function qy(n, l, i, o, s, d, m, f, h, y, _) {
  const w = Ts.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (_ = null), m = n.style.text_color ?? m;
  const b = !!n.hover?.text_color && Jm(n), S = n.group ?? (b ? `~g${n.id}` : null);
  b && (_ = { group: S, color: n.hover.text_color }), f = { ...f };
  for (const z of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[z] !== void 0 && (f[z] = n.style[z]);
  const N = new Set(n.events ?? []), O = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !d && !n.pointer_none && n.style.position === "absolute" ? Cs : null, E = O ? O.count++ : -1;
  s && (Cs = O);
  let j;
  if (n.kind === "image" && !n.markup ? j = l.image(n.src) : j = l.div(), n.kind === "engine" && (j = j.child(o.engine ? o.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && _ && _.color !== m) {
    const { group: z, color: R } = _, Y = () => l.div().absolute().top(0).left(0).size_full();
    j = j.child(Y().group_hover(z, (W) => W.invisible()).child(o.icon(`~icon-${n.id}`, n.markup, m))).child(Y().invisible().group_hover(z, (W) => W.visible()).child(o.icon(`~icon-${n.id}-hover`, n.markup, R)));
  } else n.markup && (j = j.child(o.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const D = Hy(n, N, !!O);
  if (D && (j = j.id(D)), n.measure && (j = j.measure(n.measure)), n.name && j.also_named) for (const z of n.also ?? []) j = j.also_named(z);
  j = ss(j, { ...n.style, ...y.get(n) });
  const B = f.whitespace !== "nowrap" && !f.text_ellipsis;
  h && B && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Gm(n) && (j = j.min_w(0));
  for (const z of ["hover", "focus", "active"]) n[z] && (j = j[z]((R) => ss(R, n[z])));
  S && (j = j.group(S));
  for (const { group: z, style: R } of n.group_hover ?? []) {
    const { display: Y, ...W } = R;
    Object.keys(W).length && (j = j.group_hover(z, (q) => ss(q, W)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const z = i.document?.scrollTarget, R = z ? (n.children ?? []).filter(Te).findIndex((Y) => Zm(Y, z.id)) : -1;
    if (R >= 0 && (i.scroller ?? n.id) === n.id && (i.document.scrollTarget = null, i.scroller = n.id, l.scroll.scroll_to_item(R)), i.scroller ??= n.id, i.scroller === n.id && i.document) {
      j = j.track_scroll(l.scroll);
      const Y = (n.children ?? []).filter(Te).map((W) => W.id);
      i.document.itemBounds = (W) => Y.includes(W) ? l.scroll.item_bounds?.(Y.indexOf(W)) ?? null : null;
    }
  }
  const J = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", Z = s && !n.pointer_none || n.blocks_pointer;
  if ((J && Zr.has(n) || Z) && (j = j.on_scroll_wheel((z, R) => R.stop_propagation?.())), J || Zr.has(n)) for (const z of n.children ?? []) z.kind !== "text" && Zr.add(z);
  n.kind === "input" && !n.disabled && (j = j.on_mouse_down("left", (z, R) => {
    z.bounds && i.setBounds(n.id, z.bounds), i.focus(n.id), R.notify();
  }));
  const T = n.kind === "input" ? n : n.meta?.tag === "label" ? Xm(n) : null;
  T && !T.disabled && /^(checkbox|radio)$/.test(T.input_type) && (j = j.on_click((z, R) => {
    R.stop_propagation?.(), i.toggle(T.id), R.notify();
  }));
  const p = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((z) => N.has(z));
  if (p || w) for (const z of n.children ?? []) z.kind !== "text" && Ts.add(z);
  if (p && (j = j.on_mouse_down("left", (z, R) => {
    R.stop_propagation?.(), z.bounds && i.setBounds(n.id, z.bounds);
    const Y = { ...sa(z), button: 0, buttons: 1, detail: z.click_count }, W = Rf(i, n.id, z);
    i.pressed = null, i.dispatch(W, "pointerdown", { ...Y, pointerType: "mouse" }), i.dispatch(W, "mousedown", Y) && i.pressFocus?.(W), R.notify();
  }), j = j.on_mouse_down("right", (z, R) => {
    R.stop_propagation?.(), z.bounds && i.setBounds(n.id, z.bounds);
    const Y = Rf(i, n.id, z);
    i.pressed = null, i.dispatch(Y, "contextmenu", { ...sa(z), button: 2 }), R.notify();
  }), j = j.on_mouse_up("left", (z, R) => {
    R.stop_propagation?.();
    const Y = { ...sa(z), button: 0 };
    i.dispatch(n.id, "pointerup", { ...Y, pointerType: "mouse" }), i.dispatch(n.id, "mouseup", Y), R.notify();
  }), j = j.on_click((z, R) => {
    i.dispatch(n.id, z.click_count === 2 && N.has("double_click") ? "dblclick" : "click", { detail: z.click_count, button: 0 }), R.notify();
  })), n.blocks_pointer && !p)
    for (const z of ["left", "right"]) j = j.on_mouse_down(z, (R, Y) => Y.stop_propagation?.());
  else if (w && !p)
    for (const z of ["left", "right"])
      j = j.on_mouse_down(z, (R) => {
        const Y = sa(R);
        (i.pressed?.x !== Y.clientX || i.pressed?.y !== Y.clientY) && (i.pressed = { id: n.id, x: Y.clientX, y: Y.clientY });
      });
  if (N.has("mouse_move") && (j = j.on_mouse_move((z) => {
    i.dispatch(n.id, "pointermove", { ...sa(z), pointerType: "mouse" });
  })), n.track_hover && ii.has(n.group) && (j = j.on_hover((z, R) => {
    i.hover(n.id, z), R.notify();
  })), O && (j = j.on_mouse_down_out((z, R) => {
    const Y = sa(z), W = `${Y.clientX},${Y.clientY}`;
    O.at !== W && (O.at = W, O.hits = /* @__PURE__ */ new Set()), O.hits.add(E), !(O.hits.size < O.count) && (O.at = null, i.dispatch(i.document.body.id, "pointerdown", { ...Y, pointerType: "mouse" }), i.dispatch(i.document.body.id, "mousedown", Y), R.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const z = n.value ? String(n.value) : String(n.placeholder ?? "");
    let R = l.div().whitespace_nowrap().overflow_x_hidden();
    const Y = ua(f);
    Y && (R = R.h(Y)), !n.value && m && (R = R.text_color(Gy(m))), z && (j = j.child(R.child(n.input_type === "password" && n.value ? "•".repeat([...z].length) : z))), n.field_w && (j = j.child(l.div().w(n.field_w).h(0)));
  }
  const v = f.whitespace === "nowrap" ? ua(f) : null, x = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let k = !n.range_name;
  const C = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const z of (n.children ?? []).filter(Te)) {
    const R = z.style?.flex_basis;
    C && z.style.flex_grow > 0 && (R === 0 || typeof R == "string" && R.endsWith("%")) && y.set(z, { ...y.get(z), flex_basis: "auto" });
    let Y = Ms(z, l, i, o, !1, d, m, f, x && z.style?.position !== "absolute", y, _);
    const W = !k && (z.kind === "text" || !z.meta), q = z.kind === "text" ? y.get(z)?.h ?? v : null, K = z.kind === "text" ? y.get(z)?.w : void 0;
    if (W || q || K !== void 0) {
      let $ = l.div();
      W && ($ = $.id(n.range_name)), W && !x && n.style.display === "flex" && ($ = $[`self_${Yy[f.text_align] ?? "start"}`]().max_w("100%")), q && ($ = $.h(q)), K !== void 0 && ($ = $.w(K).flex_none().whitespace_nowrap()), Y = $.child(Y), k ||= W;
    }
    j = j.child(Y);
  }
  return j;
}
const Yy = { center: "center", right: "end", end: "end" };
function Gy(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const i = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(i / 2).toString(16).padStart(2, "0")}`;
}
const Km = /^(?:[!-,.-~]+|\S)$/u, Xm = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const i = l.kind === "text" ? null : Xm(l);
    if (i) return i;
  }
  return null;
}, Zm = (n, l) => n.id === l || (n.children ?? []).some((i) => i.kind !== "text" && Zm(i, l)), Jm = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Jm(l));
function ua(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function tx(n, l, i, o, s = 0, d = !1) {
  const m = [n.root, ...n.overlays];
  ii = /* @__PURE__ */ new Set(), Cs = null;
  for (const b of m) Lm(b, ii);
  const f = s > 0 ? Jy(m, s) : /* @__PURE__ */ new Map();
  s > 0 && o.measure && Ly(m, s, o.measure, f), Xy(m, f), Ky(m, f), o.measure && Vy(m, o.measure, f);
  const h = l.reuse && l.renderGeneration ? i.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, y = new Map(f);
  h && n.root && ($e = { from: h.built, generation: h.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, Vm(n.root, f, h.overrides, $e.clean));
  let _;
  try {
    _ = l.div().relative().size_full().child(Ms(n.root, l, i, o, !1, !1, null, {}, !1, f)), h && Object.assign(h, { built: $e?.next ?? /* @__PURE__ */ new Map(), overrides: y, generation: l.renderGeneration() ?? -1 });
  } finally {
    $e = null;
  }
  let w = d && n.overlays.length ? l.div().relative().size_full().window_layer() : _;
  for (const b of n.overlays) w = w.child(Ms(b, l, i, o, !0, !1, null, {}, !1, f));
  return w === _ ? _ : _.child(w);
}
function Ly(n, l, i, o) {
  (Lr.scale !== l || Lr.measure !== i) && (Lr = { scale: l, measure: i, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: s, fonts: d, keys: m, visits: f } = Lr, h = [], y = (D, B) => o.set(D, { ...o.get(D), ...B }), _ = (D, B) => {
    h.push(D, B), y(D, B);
  }, w = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(D, B, J) {
    if (D.kind === "text") {
      if (!(B.whitespace === "nowrap" || Km.test(D.text)) || B.text_ellipsis || J || typeof B.text_size != "number") return NaN;
      const z = i(D.text, { size: B.text_size, weight: B.font_weight ?? 400, family: B.font_family ?? ".SystemUIFont", italic: !!B.italic });
      return Number.isFinite(z) ? z : NaN;
    }
    if (!Te(D) || D.kind === "input" || D.kind === "engine" || D.markup) return S(D);
    const Z = `${B.text_size}|${B.font_weight}|${B.font_family}|${B.italic}|${B.whitespace}|${B.text_ellipsis}|${+J}`;
    if (m.get(D) === Z && s.has(D)) return s.get(D);
    m.set(D, Z);
    const T = { ...B };
    for (const C of w) D.style[C] !== void 0 && (T[C] = D.style[C]);
    T.text_ellipsis = !!D.style.text_ellipsis, d.set(D, T);
    const p = D.style, v = (D.children ?? []).filter(Le), x = v.map((C) => b(C, T, J || !!D.tabular));
    let k = S(D);
    if (!Number.isFinite(k) && p.w === void 0) {
      const C = v.map((R, Y) => x[Y] + (R.kind === "text" ? 0 : it(R.style.ml) + it(R.style.mr)));
      let z;
      v.length ? Re(D) ? z = v.some((R) => R.kind !== "text" && R.style.flex_grow > 0) || p.flex_wrap === "wrap" ? NaN : C.reduce((R, Y) => R + Y, 0) + it(p.gap_x) * (v.length - 1) : z = Math.max(...C) : z = 0, k = z + it(p.pl) + it(p.pr) + it(p.border_l) + it(p.border_r), typeof p.min_w == "number" && (k = Math.max(k, p.min_w)), typeof p.max_w == "number" && (k = Math.min(k, p.max_w));
    }
    return s.set(D, k), k;
  }
  const S = (D) => typeof D.style?.w == "number" ? D.style.w : NaN, N = () => ({ exact: 0, laid: 0 }), O = (D, B) => {
    if (!Number.isFinite(B))
      return Object.assign(D, N()), NaN;
    D.exact += B;
    const J = Math.round(D.exact * l + 1e-9) / l, Z = J - D.laid;
    return D.laid = J, Z;
  }, E = (D) => Re(D) && D.style.flex_wrap !== "wrap" && (D.style.justify ?? "start") === "start";
  function j(D) {
    if (!D || D.kind === "text" || !Te(D)) return;
    const B = m.get(D), J = f.get(D);
    if (J && B !== void 0 && J.key === B) {
      for (let p = 0; p < J.log.length; p += 2)
        h.push(J.log[p], J.log[p + 1]), y(J.log[p], J.log[p + 1]);
      return;
    }
    const Z = h.length, T = (D.children ?? []).filter(Le);
    if (E(D) && T.length > 1) {
      const p = it(D.style.gap_x), v = N(), x = !(p && T.some((k) => k.kind === "text" || !Number.isFinite(it(k.style.ml))));
      _(D, { border_l: O(v, it(D.style.border_l)), pl: O(v, it(D.style.pl)) }), x && p && _(D, { gap_x: 0 }), T.forEach((k, C) => {
        const z = (C && x ? p : 0) + (k.kind === "text" ? 0 : it(k.style.ml));
        if (k.kind === "text")
          z && Object.assign(v, N());
        else {
          const q = O(v, z);
          Number.isFinite(q) && _(k, { ml: q });
        }
        const R = k.kind === "text" ? d.get(D) ?? {} : null, Y = k.kind === "text" ? b(k, R, !!D.tabular) : s.get(k);
        if ((k.kind === "text" || !(k.style.flex_grow > 0)) && Number.isFinite(Y)) {
          const q = { w: O(v, Y) };
          k.kind !== "text" && typeof k.style.w != "number" && k.style.min_w === void 0 && (q.whitespace = "nowrap", q.flex_shrink = 0), _(k, q);
        } else Object.assign(v, N());
        if (k.kind !== "text") {
          const q = O(v, it(k.style.mr));
          Number.isFinite(q) && _(k, { mr: q });
        }
      });
    }
    for (const p of D.children ?? []) p.kind !== "text" && j(p);
    B !== void 0 && f.set(D, { key: B, log: h.slice(Z) });
  }
  for (const D of n)
    D && (b(D, {}, !1), j(D));
}
let Lr = { scale: 0, measure: null };
const Qy = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Vy(n, l, i) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (_) => typeof _ == "number" ? _ : 0, d = (_, w) => w && oi(w) && !Re(w) && _.style.position !== "absolute" && !["start", "center", "end"].includes(_.style.self) && !["start", "center", "end"].includes(w.style.items);
  Qr.measure !== l && (Qr = { measure: l, walks: /* @__PURE__ */ new WeakMap() });
  const m = [], f = (_, w) => {
    m.push(_, w), i.set(_, { ...i.get(_), ...w });
  }, h = (_, w, b, S) => {
    if (!_ || _.kind === "text" || !Te(_)) return;
    const N = `${b}|${+d(_, w)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, O = Qr.walks.get(_);
    if (O?.key === N) {
      for (let j = 0; j < O.log.length; j += 2) f(O.log[j], O.log[j + 1]);
      return;
    }
    const E = m.length;
    y(_, w, b, S), Qr.walks.set(_, { key: N, log: m.slice(E) });
  }, y = (_, w, b, S) => {
    const N = _.style;
    let O = typeof N.w == "number" ? N.w : N.w === "100%" ? b : d(_, w) ? b - s(N.ml) - s(N.mr) : NaN;
    typeof N.max_w == "number" && (O = Math.min(O, N.max_w));
    const E = O - s(N.pl) - s(N.pr) - s(N.border_l) - s(N.border_r), j = { ...S };
    for (const B of o) N[B] !== void 0 && (j[B] = N[B]);
    const D = _.children ?? [];
    if (_.break_anywhere && Number.isFinite(E) && E > 0 && typeof j.text_size == "number" && D.length && D.every((B) => B.kind === "text")) {
      const B = { size: j.text_size, weight: j.font_weight ?? 400, family: j.font_family ?? ".SystemUIFont", italic: !!j.italic }, J = (p) => l(p.trimEnd(), B) <= E + 0.01;
      let Z = 0;
      for (const p of D) {
        const v = [];
        for (const k of p.text.split(`
`)) {
          let C = "";
          for (const z of k.split(Qy)) {
            if (J(C + z)) {
              C += z;
              continue;
            }
            C && v.push(C.trimEnd()), C = "";
            for (const R of z)
              C && !J(C + R) && (v.push(C), C = ""), C += R;
          }
          v.push(C.trimEnd());
        }
        const x = v.join(`
`);
        v.every((k) => !k || J(k)) ? x !== p.text && f(p, { text: x }) : Z = NaN, Z += v.length;
      }
      const T = ua(j);
      Number.isFinite(Z) && T && N.h === void 0 && D.length === 1 && f(_, { h: Z * T + s(N.pt) + s(N.pb) + s(N.border_t) + s(N.border_b) });
    }
    for (const B of D) h(B, _, Re(_) ? NaN : E, j);
  };
  for (const _ of n) h(_, null, NaN, {});
}
let Qr = { measure: null };
function Ky(n, l) {
  const i = (o, s) => {
    if (!o || o.kind === "text" || !Te(o)) return;
    const d = o.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (m && Re(o))
      for (const f of o.children ?? []) {
        const h = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (h === 0 || typeof h == "string" && h.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of o.children ?? []) i(f, m);
  };
  for (const o of n) i(o, !1);
}
function Xy(n, l) {
  const i = l.heights ?? /* @__PURE__ */ new Map(), o = (h) => i.get(h), s = (h) => {
    const y = o(h);
    if (Number.isFinite(y)) return y;
    if (h.kind === "text" || !Te(h)) return 0;
    const _ = h.style, w = typeof _.min_h == "number" ? _.min_h : 0, b = (h.children ?? []).filter(Le), S = b.map((E) => s(E) + (E.kind === "text" ? 0 : Math.max(0, it(E.style.mt) || 0) + Math.max(0, it(E.style.mb) || 0))), N = b.length ? Re(h) ? Math.max(...S) : S.reduce((E, j) => E + j, 0) + (_.display === "flex" ? (it(_.gap_y) || 0) * (b.length - 1) : 0) : 0, O = [_.pt, _.pb, _.border_t, _.border_b].reduce((E, j) => E + (it(j) || 0), 0);
    return Math.max(w, N + O);
  }, d = (h) => !(h.children ?? []).filter(Le).length || Re(h) ? NaN : s({ ...h, style: { ...h.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (h, y) => {
    const _ = h.style;
    if (typeof _.h == "number") return _.h;
    if (typeof _.max_h == "number") return _.max_h;
    if (!y || !oi(y) || Re(y)) return NaN;
    const w = y.style, b = typeof w.h == "number" ? w.h : typeof w.max_h == "number" ? w.max_h : NaN, S = (y.children ?? []).filter(Le);
    let N = 0;
    for (const E of S) {
      if (E === h) continue;
      const j = o(E);
      if (!Number.isFinite(j)) return NaN;
      N += j + (E.kind === "text" ? 0 : it(E.style.mt) + it(E.style.mb));
    }
    const O = w.display === "flex" ? it(w.gap_y) * Math.max(0, S.length - 1) : 0;
    return b - it(w.pt) - it(w.pb) - it(w.border_t) - it(w.border_b) - N - O - it(_.mt) - it(_.mb);
  }, f = (h, y) => {
    if (!(!h || h.kind === "text" || !Te(h))) {
      if (h.scrollbar > 0 && h.style.overflow_y === "scroll") {
        const _ = d(h), w = m(h, y);
        Number.isFinite(_) && Number.isFinite(w) && _ > w + 0.01 && l.set(h, { ...l.get(h), pr: it(h.style.pr) + h.scrollbar });
      }
      for (const _ of h.children ?? []) f(_, h);
    }
  };
  for (const h of n) f(h, null);
}
const Zy = ["text_size", "line_height", "whitespace", "text_ellipsis"], it = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, oi = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Le = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function Jy(n, l) {
  cs.scale !== l && (cs = Wm(l));
  const { heights: i, texts: o, textKeys: s, visits: d, places: m } = cs, f = /* @__PURE__ */ new Map(), h = [], y = (T, p) => {
    const v = f.get(T);
    f.set(T, v ? { ...v, ...p } : p);
  }, _ = (T, p) => {
    let v = null;
    for (const x in p)
      Number.isFinite(p[x]) && ((v ??= {})[x] = p[x]);
    v && (h.push(T, v), y(T, v));
  }, w = (T) => {
    for (let p = 0; p < T.length; p += 2)
      h.push(T[p], T[p + 1]), y(T[p], T[p + 1]);
  };
  function b(T, p) {
    if (T.kind === "text") return p.whitespace === "nowrap" || Km.test(T.text) ? ua(p) ?? NaN : NaN;
    const v = `${p.text_size}|${p.line_height}|${p.whitespace}|${p.text_ellipsis}`;
    if (s.get(T) === v && i.has(T)) return i.get(T);
    let x = p;
    for (const Y of Zy) T.style[Y] !== void 0 && T.style[Y] !== x[Y] && (x === p && (x = { ...p }), x[Y] = T.style[Y]);
    s.set(T, v), o.set(T, x);
    const k = T.style, C = (T.children ?? []).filter(Le), z = C.map((Y) => b(Y, x));
    let R;
    if (k.h !== void 0 && k.h !== "auto") R = it(k.h);
    else if (T.kind === "engine") R = NaN;
    else if (T.kind === "input")
      R = (T.input_type === "textarea" || T.input_type === "select" ? NaN : ua(x) ?? NaN) + it(k.pt) + it(k.pb) + it(k.border_t) + it(k.border_b), k.min_h !== void 0 && (R = Math.max(R, it(k.min_h)));
    else {
      const Y = C.map((q, K) => (q.kind === "text" ? 0 : it(q.style.mt) + it(q.style.mb)) + z[K]);
      let W;
      if (Re(T)) W = k.flex_wrap === "wrap" ? NaN : k.items === "baseline" ? N(C, z, x) : Math.max(0, ...Y);
      else if (oi(T)) {
        const q = C.some(($) => $.kind !== "text" && ($.style.flex_grow > 0 || $.style.flex_basis !== void 0)), K = k.display !== "flex" && C.some(($) => $.kind !== "text" && (it($.style.mt) || it($.style.mb)));
        W = q || K ? NaN : Y.reduce(($, Q) => $ + Q, 0) + (k.display === "flex" ? it(k.gap_y) * Math.max(0, C.length - 1) : 0);
      } else W = NaN;
      R = W + it(k.pt) + it(k.pb) + it(k.border_t) + it(k.border_b), k.min_h !== void 0 && (R = Math.max(R, it(k.min_h))), k.max_h !== void 0 && (R = Math.min(R, it(k.max_h)));
    }
    return i.set(T, R), R;
  }
  const S = (T) => (ua(T) - (ni + lm) * T.text_size) / 2 + ni * T.text_size;
  function N(T, p, v) {
    let x = 0, k = 0;
    for (const [C, z] of T.entries()) {
      const R = z.kind === "text" ? v : o.get(z);
      if (!(z.kind === "text" || (z.children ?? []).filter(Le).every((K) => K.kind === "text")) || !Number.isFinite(p[C]) || typeof R.text_size != "number") return NaN;
      const W = z.kind === "text" ? {} : z.style, q = it(W.mt) + it(W.border_t) + it(W.pt) + S(R);
      x = Math.max(x, q), k = Math.max(k, it(W.mt) + p[C] + it(W.mb) - q);
    }
    return x + k;
  }
  const O = () => ({ exact: 0, laid: 0 }), E = (T, p) => {
    if (!Number.isFinite(p))
      return Object.assign(T, O()), NaN;
    T.exact += p;
    const v = Math.round(T.exact * l + 1e-9) / l, x = v - T.laid;
    return T.laid = v, x;
  };
  function j(T) {
    if (T.kind === "text" || !Te(T)) return;
    const p = s.get(T), v = d.get(T);
    if (v && p !== void 0 && v.key === p) return w(v.log);
    const x = h.length;
    for (const k of (T.children ?? []).filter((C) => C.kind !== "text" && Te(C) && C.style.position === "absolute")) j(k);
    if (oi(T) && !Re(T)) {
      const k = O();
      _(T, { border_t: E(k, it(T.style.border_t)), pt: E(k, it(T.style.pt)) }), D(T, k);
    } else for (const k of (T.children ?? []).filter(Le)) k.kind !== "text" && j(k);
    p !== void 0 && d.set(T, { key: p, log: h.slice(x) });
  }
  function D(T, p) {
    const v = (T.children ?? []).filter(Le), x = T.style.display === "flex" ? it(T.style.gap_y) : 0;
    if (x && v.some((k) => k.kind === "text")) {
      for (const k of v) k.kind !== "text" && j(k);
      return !1;
    }
    return x && _(T, { gap_y: 0 }), v.forEach((k, C) => {
      if (k.kind === "text") {
        const z = b(k, o.get(T) ?? {});
        Number.isFinite(z) ? _(k, { h: E(p, z) }) : Object.assign(p, O());
        return;
      }
      if (_(k, { mt: E(p, (C ? x : 0) + it(k.style.mt)) }), Number.isFinite(i.get(k))) J(k, p);
      else if (B(k)) {
        const z = k.style;
        _(k, { border_t: E(p, it(z.border_t)), pt: E(p, it(z.pt)) }), _(k, { pb: E(p, it(z.pb)), border_b: E(p, it(z.border_b)) });
      } else
        j(k), Object.assign(p, O());
      _(k, { mb: E(p, it(k.style.mb)) });
    }), !0;
  }
  function B(T) {
    const p = T.style, v = (T.children ?? []).filter(Le), x = ua(o.get(T) ?? {});
    return T.kind === "div" && !Re(T) && v.length > 0 && v.every((k) => k.kind === "text") && Number.isInteger(x) && [p.h, p.min_h, p.max_h].every((k) => k === void 0 || k === "auto");
  }
  function J(T, p) {
    const v = `${s.get(T)}|${Math.round((p.exact - p.laid) * 1e6)}`, x = m.get(T);
    if (x && x.key === v) {
      w(x.log), p.exact += x.exact, p.laid += x.laid;
      return;
    }
    const k = h.length, [C, z] = [p.exact, p.laid];
    Z(T, p), m.set(T, { key: v, log: h.slice(k), exact: p.exact - C, laid: p.laid - z });
  }
  function Z(T, p) {
    const v = T.style;
    for (const R of (T.children ?? []).filter((Y) => Y.kind !== "text" && Te(Y) && Y.style.position === "absolute")) j(R);
    const x = p.laid, k = p.exact;
    _(T, { border_t: E(p, it(v.border_t)), pt: E(p, it(v.pt)) });
    const C = v.h !== void 0 && v.h !== "auto", z = i.get(T) - it(v.pt) - it(v.pb) - it(v.border_t) - it(v.border_b);
    if (T.kind === "input")
      C || E(p, z);
    else if (Re(T) || C && (v.justify ?? "start") !== "start") {
      for (const R of (T.children ?? []).filter(Le)) R.kind !== "text" && j(R);
      C || E(p, z);
    } else !D(T, p) && !C && E(p, z);
    if (C) {
      p.exact = k + i.get(T), p.laid = Math.round(p.exact * l + 1e-9) / l, _(T, { h: p.laid - x });
      return;
    }
    _(T, { pb: E(p, it(v.pb)), border_b: E(p, it(v.border_b)) }), _(T, { h: p.laid - x });
  }
  for (const T of n)
    b(T, {}), j(T);
  return Object.defineProperty(f, "heights", { value: i }), f;
}
const Wm = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let cs = Wm(0);
const ex = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  ex as NAMED_ELEMENTS,
  U0 as React,
  _g as SCHEMA,
  Py as STYLE_KEYS,
  tx as describeToGpui,
  Wy as jsxRuntime,
  Fy as mount,
  $y as reactDom,
  Iy as sdk
};
