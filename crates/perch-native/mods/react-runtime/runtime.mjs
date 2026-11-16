function ws(n, l) {
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
const a0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), l0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), r0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...a0]);
function es(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (l, i, o) => i ? String.fromCodePoint(parseInt(i, 16)) : o);
}
function bl(n, l) {
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
  return [es(n.slice(l, i)), i];
}
function i0(n, l) {
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
function _s(n) {
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
function o0(n, l) {
  const i = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let o = !1;
  for (; l < n.length; ) {
    const s = n[l];
    if (s === "*") {
      i.tag = "*", l++, o = !0;
      continue;
    }
    if (s === ".") {
      const [d, m] = bl(n, l + 1);
      i.classes.push(d), l = m, o = !0;
      continue;
    }
    if (s === "#") {
      const [d, m] = bl(n, l + 1);
      i.id = d, l = m, o = !0;
      continue;
    }
    if (s === "[") {
      const d = n.indexOf("]", l);
      if (d < 0) throw new re(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new re(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      i.attrs.push({ name: es(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : es(p) }), l = d + 1, o = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [p, y] = bl(n, l + 2), k = p.toLowerCase();
        if (k !== "before" && k !== "after") throw new re(`::${k} is not supported`);
        if (i.pseudoElement = k, l = y, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow ::${k} in ${JSON.stringify(n)}`);
        break;
      }
      const [d, m] = bl(n, l + 1);
      l = m;
      const f = d.toLowerCase();
      if ((f === "before" || f === "after") && n[l] !== "(") {
        if (i.pseudoElement = f, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!l0.has(f)) throw new re(`:${f}() is not supported`);
        const p = i0(n, l + 1), y = n.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(y)) throw new re(`:nth-child(${y}) is not supported (only a number)`);
          i.pseudos.push({ name: f, n: Number(y) });
        } else {
          const k = _s(y).map(ks);
          if (f === "has" && k.some((b) => b.length !== 1)) throw new re(`:has(${y}) is not supported (only a compound selector)`);
          i.pseudos.push({ name: f, list: k });
        }
      } else {
        if (!r0.has(f)) throw new re(`:${f} is not supported`);
        i.pseudos.push({ name: f });
      }
      o = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !o) {
      const [d, m] = bl(n, l);
      i.tag = d.toLowerCase(), l = m, o = !0;
      continue;
    }
    break;
  }
  if (!o) throw new re(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [i, l];
}
function ks(n) {
  const l = [];
  let i = 0, o = null;
  for (n = n.trim(); i < n.length; ) {
    const [s, d] = o0(n, i);
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
const Od = /* @__PURE__ */ new Map();
function ei(n) {
  let l = Od.get(n);
  return l || (l = _s(n).map(ks), Od.set(n, l)), l;
}
function Cf(n) {
  const l = [0, 0, 0], i = (o) => {
    l[0] += o[0], l[1] += o[1], l[2] += o[2];
  };
  for (const { compound: o } of n) {
    o.id && l[0]++, l[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && l[2]++, o.pseudoElement && l[2]++;
    for (const s of o.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(Cf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          i(d);
        } else l[1]++;
  }
  return l;
}
function s0(n, { name: l, op: i, value: o }) {
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
function Tr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Mf(n, l) {
  for (const i of n.children) if (l(i) || Mf(i, l)) return !0;
  return !1;
}
function Af(n, l, i, o) {
  if ((l.pseudoElement ?? null) !== (o ? i.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const d of l.classes) if (!s.has(d)) return !1;
  }
  for (const s of l.attrs) if (!s0(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
      case "first-child":
        if (Tr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Tr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = Tr(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Tr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => qa(n, d, i, o))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: d }]) => Mf(n, (m) => Af(m, d, i, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((d) => qa(n, d, i, o))) return !1;
        break;
      default:
        if (!i.state || !i.state(n, s.name, o)) return !1;
    }
  return !0;
}
function qa(n, l, i, o = !0) {
  const s = (d, m, f) => {
    const { compound: p, combinator: y } = l[m];
    if (!Af(d, p, i, f)) return !1;
    if (m === 0) return !0;
    if (y === ">") return !!d.parentElement && s(d.parentElement, m - 1, !1);
    for (let k = d.parentElement; k; k = k.parentElement) if (s(k, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, o);
}
function c0(n, l, i = {}) {
  return (typeof l == "string" ? ei(l) : l).some((s) => qa(n, s, i));
}
function ns(n, l, i = {}) {
  return qa(n, l, i);
}
function Sl(n, l, i = {}) {
  const o = ei(l), s = [], d = (m) => {
    for (const f of m.children)
      o.some((p) => qa(f, p, i)) && s.push(f), d(f);
  };
  return d(n), s;
}
function jf(n, l, i = {}) {
  const o = ei(l);
  for (let s = n; s; s = s.parentElement) if (o.some((d) => qa(s, d, i))) return s;
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
let u0 = 1;
class as {
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
class Ss {
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
let d0 = 0;
const ls = () => ++d0;
class ni {
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
class Kt extends Ss {
  constructor(l, i = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${u0++}`, this.tagName = l.toLowerCase(), this.props = i, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = ls(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const l = ls();
    for (let i = this; i instanceof Kt; i = i.parentNode) i.stamp = l;
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
    return this.parentNode instanceof Kt ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((l) => l instanceof Kt);
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
    return c0(this, l);
  }
  closest(l) {
    return jf(this, l);
  }
  querySelectorAll(l) {
    return Sl(this, l);
  }
  querySelector(l) {
    return Sl(this, l)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const l = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return l ? new as(l.x, l.y, l.width, l.height) : new as();
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
    const l = this, i = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, p) => p.toUpperCase()), o = (m) => {
      const f = l.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, s = (m) => l.inline && m in l.inline ? l.inline[m] : o(m), d = (m, f) => {
      const p = f == null ? "" : String(f);
      s(m) !== p && (l.inline ??= {}, p === o(m) ? delete l.inline[m] : l.inline[m] = p, l.touch(), l.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (p, y) => d(i(p), y) : f === "removeProperty" ? (p) => {
            const y = s(i(p));
            return d(i(p), ""), y;
          } : f === "getPropertyValue" ? (p) => s(i(p)) : s(f);
      },
      set: (m, f, p) => (typeof f == "string" && d(f, p), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return Rd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return Rd(this, l);
  }
}
const Of = Symbol("perch.stale-layout"), Rf = 3;
let Ur = !1;
function Df(n) {
  return () => {
    let l, i = !1;
    const o = (s) => {
      const d = Ur;
      Ur = s < Rf;
      try {
        l = n();
      } catch (m) {
        const f = m?.[Of];
        if (!f) throw m;
        f.retries.push(() => {
          i || o(s + 1);
        });
      } finally {
        Ur = d;
      }
    };
    return o(0), () => {
      i = !0, typeof l == "function" && l();
    };
  };
}
const rs = "perch-dom:", f0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), m0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Rd(n, l = []) {
  const i = new Set(l.map((s) => m0[s] ?? s)), o = (s) => {
    if (!(s instanceof Kt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(s.props))
      f0.has(m) || i.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(o), ...s.hidden ? { h: 1 } : {} };
  };
  return rs + JSON.stringify(o(n));
}
function p0(n, l) {
  if (typeof n != "string" || !n.startsWith(rs)) return null;
  let i;
  try {
    i = JSON.parse(n.slice(rs.length));
  } catch {
    return null;
  }
  const o = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!o(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new ni(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !o(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      m = new Kt(d.t, d.p, l);
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
class h0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class g0 {
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
function Dd(n) {
  for (let l = n; l instanceof Kt; l = l.parentElement) l.touch();
}
class b0 extends Ss {
  constructor(l) {
    super(), this.perch = l, this.documentElement = new Kt("html", {}, this), this.body = new Kt("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body, this.retries = [];
  }
  createElement(l) {
    return new Kt(l, {}, this);
  }
  /** `element`'s box as the engine last laid it out, or null before its first layout or without an engine that
   * reports boxes (`perch.bounds`). The first ask marks the element to be measured from the next frame on. Inside an
   * effect (`measured`) a box older than the tree, or none yet, puts the effect off until the next frame. */
  measure(l) {
    const i = this.perch?.bounds;
    if (typeof i != "function" || !this.measureKey) return null;
    l.measured || (l.measured = !0, l.touch(), this.restyled());
    const o = i(this.measureKey(l));
    if (Ur && (!o || this.stale?.())) throw { [Of]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Dd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Dd(l), this.activeElement === l && (this.activeElement = this.body);
  }
  querySelectorAll(l) {
    return Sl(this.documentElement, l);
  }
  querySelector(l) {
    return this.querySelectorAll(l)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(l) {
    return Sl(this.documentElement, "*").find((i) => i.props?.id === l) ?? null;
  }
}
class v0 extends Ss {
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
function Hf(n) {
  return {
    setTimeout: (l, i = 0, ...o) => n.setTimeout(() => l(...o), Math.max(0, Number(i) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Hd = Symbol.for("perch.react.globals");
function Je(n, l, i) {
  Object.defineProperty(n, l, { value: i, configurable: !0, writable: !0, enumerable: !1 });
}
function y0(n, l = globalThis) {
  const i = new b0(n), o = new v0(n, i);
  i.defaultView = o;
  const s = n.storage ?? new g0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = Hf(n);
    Je(l, "setTimeout", f.setTimeout), Je(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Je(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Je(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Je(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: i, window: o, localStorage: s, HTMLElement: Kt, Element: Kt };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Hd]?.[f], configurable: !0, enumerable: !1 });
  l[Hd] = d, Je(l, "DOMRect", as), Je(l, "getComputedStyle", x0), typeof l.ResizeObserver != "function" && Je(l, "ResizeObserver", h0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Je(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Je(l, "navigator", m), { document: i, window: o, globals: d };
}
function x0(n) {
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
function is(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Bf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let o = n.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const Bf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Bd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Bd?.setTimeout == "function") {
  const n = Hf(Bd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Es(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function w0(n) {
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
var Vo = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ud;
function _0() {
  if (Ud) return pt;
  Ud = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), k = Symbol.for("react.lazy"), b = Symbol.for("react.activity"), v = Symbol.iterator;
  function S(T) {
    return T === null || typeof T != "object" ? null : (T = v && T[v] || T["@@iterator"], typeof T == "function" ? T : null);
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
  }, z = Object.assign, _ = {};
  function N(T, Z, at) {
    this.props = T, this.context = Z, this.refs = _, this.updater = at || E;
  }
  N.prototype.isReactComponent = {}, N.prototype.setState = function(T, Z) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, Z, "setState");
  }, N.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function H() {
  }
  H.prototype = N.prototype;
  function j(T, Z, at) {
    this.props = T, this.context = Z, this.refs = _, this.updater = at || E;
  }
  var X = j.prototype = new H();
  X.constructor = j, z(X, N.prototype), X.isPureReactComponent = !0;
  var q = Array.isArray;
  function R() {
  }
  var h = { H: null, A: null, T: null, S: null }, x = Object.prototype.hasOwnProperty;
  function w(T, Z, at) {
    var st = at.ref;
    return {
      $$typeof: n,
      type: T,
      key: Z,
      ref: st !== void 0 ? st : null,
      props: at
    };
  }
  function M(T, Z) {
    return w(T.type, Z, T.props);
  }
  function O(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function A(T) {
    var Z = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(at) {
      return Z[at];
    });
  }
  var B = /\/+/g;
  function K(T, Z) {
    return typeof T == "object" && T !== null && T.key != null ? A("" + T.key) : Z.toString(36);
  }
  function F(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(R, R) : (T.status = "pending", T.then(
          function(Z) {
            T.status === "pending" && (T.status = "fulfilled", T.value = Z);
          },
          function(Z) {
            T.status === "pending" && (T.status = "rejected", T.reason = Z);
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
  function Q(T, Z, at, st, ct) {
    var ut = typeof T;
    (ut === "undefined" || ut === "boolean") && (T = null);
    var Et = !1;
    if (T === null) Et = !0;
    else
      switch (ut) {
        case "bigint":
        case "string":
        case "number":
          Et = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case n:
            case l:
              Et = !0;
              break;
            case k:
              return Et = T._init, Q(
                Et(T._payload),
                Z,
                at,
                st,
                ct
              );
          }
      }
    if (Et)
      return ct = ct(T), Et = st === "" ? "." + K(T, 0) : st, q(ct) ? (at = "", Et != null && (at = Et.replace(B, "$&/") + "/"), Q(ct, Z, at, "", function(Yn) {
        return Yn;
      })) : ct != null && (O(ct) && (ct = M(
        ct,
        at + (ct.key == null || T && T.key === ct.key ? "" : ("" + ct.key).replace(
          B,
          "$&/"
        ) + "/") + Et
      )), Z.push(ct)), 1;
    Et = 0;
    var Ft = st === "" ? "." : st + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        st = T[ht], ut = Ft + K(st, ht), Et += Q(
          st,
          Z,
          at,
          ut,
          ct
        );
    else if (ht = S(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(st = T.next()).done; )
        st = st.value, ut = Ft + K(st, ht++), Et += Q(
          st,
          Z,
          at,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof T.then == "function")
        return Q(
          F(T),
          Z,
          at,
          st,
          ct
        );
      throw Z = String(T), Error(
        "Objects are not valid as a React child (found: " + (Z === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : Z) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function J(T, Z, at) {
    if (T == null) return T;
    var st = [], ct = 0;
    return Q(T, st, "", "", function(ut) {
      return Z.call(at, ut, ct++);
    }), st;
  }
  function I(T) {
    if (T._status === -1) {
      var Z = T._result;
      Z = Z(), Z.then(
        function(at) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = at);
        },
        function(at) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = at);
        }
      ), T._status === -1 && (T._status = 0, T._result = Z);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var L = typeof reportError == "function" ? reportError : function(T) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var Z = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof T == "object" && T !== null && typeof T.message == "string" ? String(T.message) : String(T),
        error: T
      });
      if (!window.dispatchEvent(Z)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", T);
      return;
    }
    console.error(T);
  }, V = {
    map: J,
    forEach: function(T, Z, at) {
      J(
        T,
        function() {
          Z.apply(this, arguments);
        },
        at
      );
    },
    count: function(T) {
      var Z = 0;
      return J(T, function() {
        Z++;
      }), Z;
    },
    toArray: function(T) {
      return J(T, function(Z) {
        return Z;
      }) || [];
    },
    only: function(T) {
      if (!O(T))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return T;
    }
  };
  return pt.Activity = b, pt.Children = V, pt.Component = N, pt.Fragment = i, pt.Profiler = s, pt.PureComponent = j, pt.StrictMode = o, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h, pt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(T) {
      return h.H.useMemoCache(T);
    }
  }, pt.cache = function(T) {
    return function() {
      return T.apply(null, arguments);
    };
  }, pt.cacheSignal = function() {
    return null;
  }, pt.cloneElement = function(T, Z, at) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var st = z({}, T.props), ct = T.key;
    if (Z != null)
      for (ut in Z.key !== void 0 && (ct = "" + Z.key), Z)
        !x.call(Z, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && Z.ref === void 0 || (st[ut] = Z[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) st.children = at;
    else if (1 < ut) {
      for (var Et = Array(ut), Ft = 0; Ft < ut; Ft++)
        Et[Ft] = arguments[Ft + 2];
      st.children = Et;
    }
    return w(T.type, ct, st);
  }, pt.createContext = function(T) {
    return T = {
      $$typeof: m,
      _currentValue: T,
      _currentValue2: T,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, T.Provider = T, T.Consumer = {
      $$typeof: d,
      _context: T
    }, T;
  }, pt.createElement = function(T, Z, at) {
    var st, ct = {}, ut = null;
    if (Z != null)
      for (st in Z.key !== void 0 && (ut = "" + Z.key), Z)
        x.call(Z, st) && st !== "key" && st !== "__self" && st !== "__source" && (ct[st] = Z[st]);
    var Et = arguments.length - 2;
    if (Et === 1) ct.children = at;
    else if (1 < Et) {
      for (var Ft = Array(Et), ht = 0; ht < Et; ht++)
        Ft[ht] = arguments[ht + 2];
      ct.children = Ft;
    }
    if (T && T.defaultProps)
      for (st in Et = T.defaultProps, Et)
        ct[st] === void 0 && (ct[st] = Et[st]);
    return w(T, ut, ct);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(T) {
    return { $$typeof: f, render: T };
  }, pt.isValidElement = O, pt.lazy = function(T) {
    return {
      $$typeof: k,
      _payload: { _status: -1, _result: T },
      _init: I
    };
  }, pt.memo = function(T, Z) {
    return {
      $$typeof: y,
      type: T,
      compare: Z === void 0 ? null : Z
    };
  }, pt.startTransition = function(T) {
    var Z = h.T, at = {};
    h.T = at;
    try {
      var st = T(), ct = h.S;
      ct !== null && ct(at, st), typeof st == "object" && st !== null && typeof st.then == "function" && st.then(R, L);
    } catch (ut) {
      L(ut);
    } finally {
      Z !== null && at.types !== null && (Z.types = at.types), h.T = Z;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return h.H.useCacheRefresh();
  }, pt.use = function(T) {
    return h.H.use(T);
  }, pt.useActionState = function(T, Z, at) {
    return h.H.useActionState(T, Z, at);
  }, pt.useCallback = function(T, Z) {
    return h.H.useCallback(T, Z);
  }, pt.useContext = function(T) {
    return h.H.useContext(T);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(T, Z) {
    return h.H.useDeferredValue(T, Z);
  }, pt.useEffect = function(T, Z) {
    return h.H.useEffect(T, Z);
  }, pt.useEffectEvent = function(T) {
    return h.H.useEffectEvent(T);
  }, pt.useId = function() {
    return h.H.useId();
  }, pt.useImperativeHandle = function(T, Z, at) {
    return h.H.useImperativeHandle(T, Z, at);
  }, pt.useInsertionEffect = function(T, Z) {
    return h.H.useInsertionEffect(T, Z);
  }, pt.useLayoutEffect = function(T, Z) {
    return h.H.useLayoutEffect(T, Z);
  }, pt.useMemo = function(T, Z) {
    return h.H.useMemo(T, Z);
  }, pt.useOptimistic = function(T, Z) {
    return h.H.useOptimistic(T, Z);
  }, pt.useReducer = function(T, Z, at) {
    return h.H.useReducer(T, Z, at);
  }, pt.useRef = function(T) {
    return h.H.useRef(T);
  }, pt.useState = function(T) {
    return h.H.useState(T);
  }, pt.useSyncExternalStore = function(T, Z, at) {
    return h.H.useSyncExternalStore(
      T,
      Z,
      at
    );
  }, pt.useTransition = function() {
    return h.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var qd;
function k0() {
  return qd || (qd = 1, Vo.exports = _0()), Vo.exports;
}
var nt = k0();
const Uf = /* @__PURE__ */ Es(nt), S0 = /* @__PURE__ */ ws({
  __proto__: null,
  default: Uf
}, [nt]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const E0 = Uf ?? S0;
function oe(n, l) {
  return nt.useEffect(Df(n), l);
}
function Kr(n, l) {
  return nt.useLayoutEffect(Df(n), l);
}
const z0 = /* @__PURE__ */ ws({
  __proto__: null,
  default: E0,
  useEffect: oe,
  useLayoutEffect: Kr
}, [nt]);
var Ko = { exports: {} }, vl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Gd;
function N0() {
  if (Gd) return vl;
  Gd = 1;
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
  return vl.Fragment = l, vl.jsx = i, vl.jsxs = i, vl;
}
var Yd;
function T0() {
  return Yd || (Yd = 1, Ko.exports = N0()), Ko.exports;
}
var tt = T0();
const C0 = /* @__PURE__ */ Es(tt), Ly = /* @__PURE__ */ ws({
  __proto__: null,
  default: C0
}, [tt]);
var Xo = { exports: {} }, Zo = { exports: {} };
const M0 = /* @__PURE__ */ w0(z0);
var Jo = { exports: {} }, Wo = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ld;
function A0() {
  return Ld || (Ld = 1, (function(n) {
    function l(Q, J) {
      var I = Q.length;
      Q.push(J);
      t: for (; 0 < I; ) {
        var L = I - 1 >>> 1, V = Q[L];
        if (0 < s(V, J))
          Q[L] = J, Q[I] = V, I = L;
        else break t;
      }
    }
    function i(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function o(Q) {
      if (Q.length === 0) return null;
      var J = Q[0], I = Q.pop();
      if (I !== J) {
        Q[0] = I;
        t: for (var L = 0, V = Q.length, T = V >>> 1; L < T; ) {
          var Z = 2 * (L + 1) - 1, at = Q[Z], st = Z + 1, ct = Q[st];
          if (0 > s(at, I))
            st < V && 0 > s(ct, at) ? (Q[L] = ct, Q[st] = I, L = st) : (Q[L] = at, Q[Z] = I, L = Z);
          else if (st < V && 0 > s(ct, I))
            Q[L] = ct, Q[st] = I, L = st;
          else break t;
        }
      }
      return J;
    }
    function s(Q, J) {
      var I = Q.sortIndex - J.sortIndex;
      return I !== 0 ? I : Q.id - J.id;
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
    var p = [], y = [], k = 1, b = null, v = 3, S = !1, E = !1, z = !1, _ = !1, N = typeof setTimeout == "function" ? setTimeout : null, H = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
    function X(Q) {
      for (var J = i(y); J !== null; ) {
        if (J.callback === null) o(y);
        else if (J.startTime <= Q)
          o(y), J.sortIndex = J.expirationTime, l(p, J);
        else break;
        J = i(y);
      }
    }
    function q(Q) {
      if (z = !1, X(Q), !E)
        if (i(p) !== null)
          E = !0, R || (R = !0, A());
        else {
          var J = i(y);
          J !== null && F(q, J.startTime - Q);
        }
    }
    var R = !1, h = -1, x = 5, w = -1;
    function M() {
      return _ ? !0 : !(n.unstable_now() - w < x);
    }
    function O() {
      if (_ = !1, R) {
        var Q = n.unstable_now();
        w = Q;
        var J = !0;
        try {
          t: {
            E = !1, z && (z = !1, H(h), h = -1), S = !0;
            var I = v;
            try {
              e: {
                for (X(Q), b = i(p); b !== null && !(b.expirationTime > Q && M()); ) {
                  var L = b.callback;
                  if (typeof L == "function") {
                    b.callback = null, v = b.priorityLevel;
                    var V = L(
                      b.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof V == "function") {
                      b.callback = V, X(Q), J = !0;
                      break e;
                    }
                    b === i(p) && o(p), X(Q);
                  } else o(p);
                  b = i(p);
                }
                if (b !== null) J = !0;
                else {
                  var T = i(y);
                  T !== null && F(
                    q,
                    T.startTime - Q
                  ), J = !1;
                }
              }
              break t;
            } finally {
              b = null, v = I, S = !1;
            }
            J = void 0;
          }
        } finally {
          J ? A() : R = !1;
        }
      }
    }
    var A;
    if (typeof j == "function")
      A = function() {
        j(O);
      };
    else if (typeof MessageChannel < "u") {
      var B = new MessageChannel(), K = B.port2;
      B.port1.onmessage = O, A = function() {
        K.postMessage(null);
      };
    } else
      A = function() {
        N(O, 0);
      };
    function F(Q, J) {
      h = N(function() {
        Q(n.unstable_now());
      }, J);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(Q) {
      Q.callback = null;
    }, n.unstable_forceFrameRate = function(Q) {
      0 > Q || 125 < Q ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : x = 0 < Q ? Math.floor(1e3 / Q) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return v;
    }, n.unstable_next = function(Q) {
      switch (v) {
        case 1:
        case 2:
        case 3:
          var J = 3;
          break;
        default:
          J = v;
      }
      var I = v;
      v = J;
      try {
        return Q();
      } finally {
        v = I;
      }
    }, n.unstable_requestPaint = function() {
      _ = !0;
    }, n.unstable_runWithPriority = function(Q, J) {
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
        return J();
      } finally {
        v = I;
      }
    }, n.unstable_scheduleCallback = function(Q, J, I) {
      var L = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? L + I : L) : I = L, Q) {
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
        id: k++,
        callback: J,
        priorityLevel: Q,
        startTime: I,
        expirationTime: V,
        sortIndex: -1
      }, I > L ? (Q.sortIndex = I, l(y, Q), i(p) === null && Q === i(y) && (z ? (H(h), h = -1) : z = !0, F(q, I - L))) : (Q.sortIndex = V, l(p, Q), E || S || (E = !0, R || (R = !0, A()))), Q;
    }, n.unstable_shouldYield = M, n.unstable_wrapCallback = function(Q) {
      var J = v;
      return function() {
        var I = v;
        v = J;
        try {
          return Q.apply(this, arguments);
        } finally {
          v = I;
        }
      };
    };
  })(Wo)), Wo;
}
var Qd;
function j0() {
  return Qd || (Qd = 1, Jo.exports = A0()), Jo.exports;
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
var Vd;
function O0() {
  return Vd || (Vd = 1, (function(n) {
    n.exports = function(l) {
      function i(t, e, a, r) {
        return new sp(t, e, a, r);
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
            for (var g = !1, C = c.child; C; ) {
              if (C === a) {
                g = !0, a = c, r = u;
                break;
              }
              if (C === r) {
                g = !0, r = c, a = u;
                break;
              }
              C = C.sibling;
            }
            if (!g) {
              for (C = u.child; C; ) {
                if (C === a) {
                  g = !0, a = u, r = c;
                  break;
                }
                if (C === r) {
                  g = !0, r = u, a = c;
                  break;
                }
                C = C.sibling;
              }
              if (!g) throw Error(s(189));
            }
          }
          if (a.alternate !== r) throw Error(s(190));
        }
        if (a.tag !== 3) throw Error(s(188));
        return a.stateNode.current === a ? t : e;
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
      function k(t) {
        return t === null || typeof t != "object" ? null : (t = $u && t[$u] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function b(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === mp ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case co:
            return "Profiler";
          case Fu:
            return "StrictMode";
          case fo:
            return "Suspense";
          case mo:
            return "SuspenseList";
          case ho:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case kn:
              return t.displayName || "Context";
            case Iu:
              return (t._context.displayName || "Context") + ".Consumer";
            case uo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case po:
              return e = t.displayName || null, e !== null ? e : b(t.type) || "Memo";
            case Sn:
              e = t._payload, t = t._init;
              try {
                return b(t(e));
              } catch {
              }
          }
        return null;
      }
      function v(t) {
        return { current: t };
      }
      function S(t) {
        0 > _a || (t.current = wo[_a], wo[_a] = null, _a--);
      }
      function E(t, e) {
        _a++, wo[_a] = t.current, t.current = e;
      }
      function z(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Yh(t) / Lh | 0) | 0;
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
      function N(t, e, a) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, g = t.pingedLanes;
        t = t.warmLanes;
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~u, r !== 0 ? c = _(r) : (g &= C, g !== 0 ? c = _(g) : a || (a = C & ~t, a !== 0 && (c = _(a))))) : (C = r & ~u, C !== 0 ? c = _(C) : g !== 0 ? c = _(g) : a || (a = r & ~t, a !== 0 && (c = _(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
      }
      function H(t, e) {
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
      function X() {
        var t = cr;
        return cr <<= 1, (cr & 62914560) === 0 && (cr = 4194304), t;
      }
      function q(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function R(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, a, r, c, u) {
        var g = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var C = t.entanglements, Y = t.expirationTimes, W = t.hiddenUpdates;
        for (a = g & ~a; 0 < a; ) {
          var et = 31 - we(a), $ = 1 << et;
          C[et] = 0, Y[et] = -1;
          var lt = W[et];
          if (lt !== null)
            for (W[et] = null, et = 0; et < lt.length; et++) {
              var gt = lt[et];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~$;
        }
        r !== 0 && x(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(g & ~e));
      }
      function x(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - we(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | a & 261930;
      }
      function w(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var r = 31 - we(a), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), a &= ~c;
        }
      }
      function M(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : O(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function O(t) {
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
      function A(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function B(t) {
        if (typeof Zh == "function" && Jh(t), _e && typeof _e.setStrictMode == "function")
          try {
            _e.setStrictMode(rl, t);
          } catch {
          }
      }
      function K(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function F(t) {
        if (So === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            So = e && e[1] || "", Sd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + So + t + Sd;
      }
      function Q(t, e) {
        if (!t || Eo) return "";
        Eo = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var r = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var $ = function() {
                    throw Error();
                  };
                  if (Object.defineProperty($.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct($, []);
                    } catch (gt) {
                      var lt = gt;
                    }
                    Reflect.construct(t, [], $);
                  } else {
                    try {
                      $.call();
                    } catch (gt) {
                      lt = gt;
                    }
                    t.call($.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (gt) {
                    lt = gt;
                  }
                  ($ = t()) && typeof $.catch == "function" && $.catch(function() {
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
          var u = r.DetermineComponentFrameRoot(), g = u[0], C = u[1];
          if (g && C) {
            var Y = g.split(`
`), W = C.split(`
`);
            for (c = r = 0; r < Y.length && !Y[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < W.length && !W[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === Y.length || c === W.length)
              for (r = Y.length - 1, c = W.length - 1; 1 <= r && 0 <= c && Y[r] !== W[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (Y[r] !== W[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || Y[r] !== W[c]) {
                      var et = `
` + Y[r].replace(" at new ", " at ");
                      return t.displayName && et.includes("<anonymous>") && (et = et.replace("<anonymous>", t.displayName)), et;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          Eo = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? F(a) : "";
      }
      function J(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return F(t.type);
          case 16:
            return F("Lazy");
          case 13:
            return t.child !== e && e !== null ? F("Suspense Fallback") : F("Suspense");
          case 19:
            return F("SuspenseList");
          case 0:
          case 15:
            return Q(t.type, !1);
          case 11:
            return Q(t.type.render, !1);
          case 1:
            return Q(t.type, !0);
          case 31:
            return F("Activity");
          default:
            return "";
        }
      }
      function I(t) {
        try {
          var e = "", a = null;
          do
            e += J(t, a), a = t, t = t.return;
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
          var a = Ed.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, Ed.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function V(t, e) {
        Sa[Ea++] = il, Sa[Ea++] = dr, dr = t, il = e;
      }
      function T(t, e, a) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = En, En = t;
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
      function Z(t) {
        t.return !== null && (V(t, 1), T(t, 1, 0));
      }
      function at(t) {
        for (; t === dr; )
          dr = Sa[--Ea], Sa[Ea] = null, il = Sa[--Ea], Sa[Ea] = null;
        for (; t === En; )
          En = Ce[--Me], Ce[Me] = null, Ze = Ce[--Me], Ce[Me] = null, Xe = Ce[--Me], Ce[Me] = null;
      }
      function st(t, e) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = En, Xe = e.id, Ze = e.overflow, En = t;
      }
      function ct(t, e) {
        E(zn, e), E(ol, t), E(ne, null), t = gp(e), S(ne), E(ne, t);
      }
      function ut() {
        S(ne), S(ol), S(zn);
      }
      function Et(t) {
        t.memoizedState !== null && E(fr, t);
        var e = ne.current, a = bp(e, t.type);
        e !== a && (E(ol, t), E(ne, a));
      }
      function Ft(t) {
        ol.current === t && (S(ne), S(ol)), fr.current === t && (S(fr), ln ? In._currentValue = xa : In._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ya(L(e, t)), zo;
      }
      function Yn(t, e) {
        if (!ue) throw Error(s(175));
        bh(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Ln(t) {
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
        if (!ue || t !== ae) return !1;
        if (!St) return Ln(t), St = !0, !1;
        var e = t.tag;
        if (Zt ? e !== 3 && e !== 27 && (e !== 5 || dd(t.type) && !ir(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || dd(t.type) && !ir(t.type, t.memoizedProps)) && Ot && ht(t), Ln(t), e === 13) {
          if (!ue) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = _h(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = wh(t);
        } else
          Ot = Zt && e === 27 ? oh(
            t.type,
            Ot
          ) : ae ? ud(t.stateNode) : null;
        return !0;
      }
      function He() {
        ue && (Ot = ae = null, St = !1);
      }
      function hn() {
        var t = Nn;
        return t !== null && (be === null ? be = t : be.push.apply(
          be,
          t
        ), Nn = null), t;
      }
      function Ya(t) {
        Nn === null ? Nn = [t] : Nn.push(t);
      }
      function gn(t, e, a) {
        ln ? (E(mr, e._currentValue), e._currentValue = a) : (E(mr, e._currentValue2), e._currentValue2 = a);
      }
      function $e(t) {
        var e = mr.current;
        ln ? t._currentValue = e : t._currentValue2 = e, S(mr);
      }
      function ii(t, e, a) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function oi(t, e, a, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var u = c.dependencies;
          if (u !== null) {
            var g = c.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var C = u;
              u = c;
              for (var Y = 0; Y < e.length; Y++)
                if (C.context === e[Y]) {
                  u.lanes |= a, C = u.alternate, C !== null && (C.lanes |= a), ii(
                    u.return,
                    a,
                    t
                  ), r || (g = null);
                  break t;
                }
              u = C.next;
            }
          } else if (c.tag === 18) {
            if (g = c.return, g === null) throw Error(s(341));
            g.lanes |= a, u = g.alternate, u !== null && (u.lanes |= a), ii(g, a, t), g = null;
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
      function fa(t, e, a, r) {
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
              var C = c.type;
              ke(c.pendingProps.value, g.value) || (t !== null ? t.push(C) : t = [C]);
            }
          } else if (c === fr.current) {
            if (g = c.alternate, g === null) throw Error(s(387));
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(In) : t = [In]);
          }
          c = c.return;
        }
        t !== null && oi(
          e,
          t,
          a,
          r
        ), e.flags |= 262144;
      }
      function Cl(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ke(
            ln ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Qn(t) {
        $n = t, on = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function te(t) {
        return Us($n, t);
      }
      function Ml(t, e) {
        return $n === null && Qn(t), Us(t, e);
      }
      function Us(t, e) {
        var a = ln ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, on === null) {
          if (t === null) throw Error(s(308));
          on = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else on = on.next = e;
        return a;
      }
      function si() {
        return {
          controller: new Fh(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function La(t) {
        t.refCount--, t.refCount === 0 && Ih($h, function() {
          t.controller.abort();
        });
      }
      function Al() {
      }
      function Qe(t) {
        t !== za && t.next === null && (za === null ? pr = za = t : za = za.next = t), hr = !0, No || (No = !0, Um());
      }
      function ma(t, e) {
        if (!To && hr) {
          To = !0;
          do
            for (var a = !1, r = pr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, C = r.pingedLanes;
                  u = (1 << 31 - we(42 | t) + 1) - 1, u &= c & ~(g & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Qs(r, u));
              } else
                u = kt, u = N(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Fn
                ), (u & 3) === 0 || H(r, u) || (a = !0, Qs(r, u));
              r = r.next;
            }
          while (a);
          To = !1;
        }
      }
      function qs() {
        Gs();
      }
      function Gs() {
        hr = No = !1;
        var t = 0;
        Pn !== 0 && zp() && (t = Pn);
        for (var e = he(), a = null, r = pr; r !== null; ) {
          var c = r.next, u = Ys(r, e);
          u === 0 ? (r.next = null, a === null ? pr = c : a.next = c, c === null && (za = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (hr = !0)), r = c;
        }
        Jt !== 0 && Jt !== 5 || ma(t), Pn !== 0 && (Pn = 0);
      }
      function Ys(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - we(u), C = 1 << g, Y = c[g];
          Y === -1 ? ((C & a) === 0 || (C & r) !== 0) && (c[g] = j(C, e)) : Y <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, a = kt, a = N(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && _o(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || H(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && _o(r), A(a)) {
            case 2:
            case 8:
              a = Kh;
              break;
            case 32:
              a = ko;
              break;
            case 268435456:
              a = Xh;
              break;
            default:
              a = ko;
          }
          return r = Ls.bind(null, t), a = ur(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && _o(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Ls(t, e) {
        if (Jt !== 0 && Jt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (el() && t.callbackNode !== a)
          return null;
        var r = kt;
        return r = N(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r === 0 ? null : (Eu(t, r, e), Ys(t, he()), t.callbackNode != null && t.callbackNode === a ? Ls.bind(null, t) : null);
      }
      function Qs(t, e) {
        if (el()) return null;
        Eu(t, e, !0);
      }
      function Um() {
        Op ? Rp(function() {
          (xt & 6) !== 0 ? ur(
            _d,
            qs
          ) : Gs();
        }) : ur(
          _d,
          qs
        );
      }
      function ci() {
        if (Pn === 0) {
          var t = Na;
          t === 0 && (t = or, or <<= 1, (or & 261888) === 0 && (or = 256)), Pn = t;
        }
        return Pn;
      }
      function qm(t, e) {
        if (sl === null) {
          var a = sl = [];
          Co = 0, Na = ci(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return Co++, e.then(Vs, Vs), e;
      }
      function Vs() {
        if (--Co === 0 && sl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = sl;
          sl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Gm(t, e) {
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
      function ui() {
        var t = ta.current;
        return t !== null ? t : At.pooledCache;
      }
      function jl(t, e) {
        e === null ? E(ta, ta.current) : E(ta, e.pool);
      }
      function Ks() {
        var t = ui();
        return t === null ? null : {
          parent: ln ? Rt._currentValue : Rt._currentValue2,
          pool: t
        };
      }
      function Ol(t, e) {
        if (ke(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!Wh.call(e, c) || !ke(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Xs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Zs(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Al, Al), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Ws(t), t;
          default:
            if (typeof e.status == "string") e.then(Al, Al);
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
                throw t = e.reason, Ws(t), t;
            }
            throw ea = e, Ca;
        }
      }
      function Vn(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (ea = a, Ca) : a;
        }
      }
      function Js() {
        if (ea === null) throw Error(s(459));
        var t = ea;
        return ea = null, t;
      }
      function Ws(t) {
        if (t === Ca || t === gr)
          throw Error(s(483));
      }
      function Rl(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Zs(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Dl(t, e) {
        throw e.$$typeof === dp ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Fs(t) {
        function e(U, D) {
          if (t) {
            var G = U.deletions;
            G === null ? (U.deletions = [D], U.flags |= 16) : G.push(D);
          }
        }
        function a(U, D) {
          if (!t) return null;
          for (; D !== null; )
            e(U, D), D = D.sibling;
          return null;
        }
        function r(U) {
          for (var D = /* @__PURE__ */ new Map(); U !== null; )
            U.key !== null ? D.set(U.key, U) : D.set(U.index, U), U = U.sibling;
          return D;
        }
        function c(U, D) {
          return U = an(U, D), U.index = 0, U.sibling = null, U;
        }
        function u(U, D, G) {
          return U.index = G, t ? (G = U.alternate, G !== null ? (G = G.index, G < D ? (U.flags |= 67108866, D) : G) : (U.flags |= 67108866, D)) : (U.flags |= 1048576, D);
        }
        function g(U) {
          return t && U.alternate === null && (U.flags |= 67108866), U;
        }
        function C(U, D, G, P) {
          return D === null || D.tag !== 6 ? (D = ro(G, U.mode, P), D.return = U, D) : (D = c(D, G), D.return = U, D);
        }
        function Y(U, D, G, P) {
          var ft = G.type;
          return ft === ya ? et(
            U,
            D,
            G.props.children,
            P,
            G.key
          ) : D !== null && (D.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Sn && Vn(ft) === D.type) ? (D = c(D, G.props), Qa(D, G), D.return = U, D) : (D = ar(
            G.type,
            G.key,
            G.props,
            null,
            U.mode,
            P
          ), Qa(D, G), D.return = U, D);
        }
        function W(U, D, G, P) {
          return D === null || D.tag !== 4 || D.stateNode.containerInfo !== G.containerInfo || D.stateNode.implementation !== G.implementation ? (D = io(G, U.mode, P), D.return = U, D) : (D = c(D, G.children || []), D.return = U, D);
        }
        function et(U, D, G, P, ft) {
          return D === null || D.tag !== 7 ? (D = Wn(
            G,
            U.mode,
            P,
            ft
          ), D.return = U, D) : (D = c(D, G), D.return = U, D);
        }
        function $(U, D, G) {
          if (typeof D == "string" && D !== "" || typeof D == "number" || typeof D == "bigint")
            return D = ro(
              "" + D,
              U.mode,
              G
            ), D.return = U, D;
          if (typeof D == "object" && D !== null) {
            switch (D.$$typeof) {
              case lr:
                return G = ar(
                  D.type,
                  D.key,
                  D.props,
                  null,
                  U.mode,
                  G
                ), Qa(G, D), G.return = U, G;
              case va:
                return D = io(
                  D,
                  U.mode,
                  G
                ), D.return = U, D;
              case Sn:
                return D = Vn(D), $(U, D, G);
            }
            if (rr(D) || k(D))
              return D = Wn(
                D,
                U.mode,
                G,
                null
              ), D.return = U, D;
            if (typeof D.then == "function")
              return $(U, Rl(D), G);
            if (D.$$typeof === kn)
              return $(
                U,
                Ml(U, D),
                G
              );
            Dl(U, D);
          }
          return null;
        }
        function lt(U, D, G, P) {
          var ft = D !== null ? D.key : null;
          if (typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint")
            return ft !== null ? null : C(U, D, "" + G, P);
          if (typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case lr:
                return G.key === ft ? Y(U, D, G, P) : null;
              case va:
                return G.key === ft ? W(U, D, G, P) : null;
              case Sn:
                return G = Vn(G), lt(U, D, G, P);
            }
            if (rr(G) || k(G))
              return ft !== null ? null : et(U, D, G, P, null);
            if (typeof G.then == "function")
              return lt(
                U,
                D,
                Rl(G),
                P
              );
            if (G.$$typeof === kn)
              return lt(
                U,
                D,
                Ml(U, G),
                P
              );
            Dl(U, G);
          }
          return null;
        }
        function gt(U, D, G, P, ft) {
          if (typeof P == "string" && P !== "" || typeof P == "number" || typeof P == "bigint")
            return U = U.get(G) || null, C(D, U, "" + P, ft);
          if (typeof P == "object" && P !== null) {
            switch (P.$$typeof) {
              case lr:
                return U = U.get(
                  P.key === null ? G : P.key
                ) || null, Y(D, U, P, ft);
              case va:
                return U = U.get(
                  P.key === null ? G : P.key
                ) || null, W(D, U, P, ft);
              case Sn:
                return P = Vn(P), gt(
                  U,
                  D,
                  G,
                  P,
                  ft
                );
            }
            if (rr(P) || k(P))
              return U = U.get(G) || null, et(D, U, P, ft, null);
            if (typeof P.then == "function")
              return gt(
                U,
                D,
                G,
                Rl(P),
                ft
              );
            if (P.$$typeof === kn)
              return gt(
                U,
                D,
                G,
                Ml(D, P),
                ft
              );
            Dl(D, P);
          }
          return null;
        }
        function le(U, D, G, P) {
          for (var ft = null, Dt = null, mt = D, Nt = D = 0, Pt = null; mt !== null && Nt < G.length; Nt++) {
            mt.index > Nt ? (Pt = mt, mt = null) : Pt = mt.sibling;
            var Tt = lt(
              U,
              mt,
              G[Nt],
              P
            );
            if (Tt === null) {
              mt === null && (mt = Pt);
              break;
            }
            t && mt && Tt.alternate === null && e(U, mt), D = u(Tt, D, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt, mt = Pt;
          }
          if (Nt === G.length)
            return a(U, mt), St && V(U, Nt), ft;
          if (mt === null) {
            for (; Nt < G.length; Nt++)
              mt = $(U, G[Nt], P), mt !== null && (D = u(
                mt,
                D,
                Nt
              ), Dt === null ? ft = mt : Dt.sibling = mt, Dt = mt);
            return St && V(U, Nt), ft;
          }
          for (mt = r(mt); Nt < G.length; Nt++)
            Pt = gt(
              mt,
              U,
              Nt,
              G[Nt],
              P
            ), Pt !== null && (t && Pt.alternate !== null && mt.delete(
              Pt.key === null ? Nt : Pt.key
            ), D = u(
              Pt,
              D,
              Nt
            ), Dt === null ? ft = Pt : Dt.sibling = Pt, Dt = Pt);
          return t && mt.forEach(function(On) {
            return e(U, On);
          }), St && V(U, Nt), ft;
        }
        function gl(U, D, G, P) {
          if (G == null) throw Error(s(151));
          for (var ft = null, Dt = null, mt = D, Nt = D = 0, Pt = null, Tt = G.next(); mt !== null && !Tt.done; Nt++, Tt = G.next()) {
            mt.index > Nt ? (Pt = mt, mt = null) : Pt = mt.sibling;
            var On = lt(U, mt, Tt.value, P);
            if (On === null) {
              mt === null && (mt = Pt);
              break;
            }
            t && mt && On.alternate === null && e(U, mt), D = u(On, D, Nt), Dt === null ? ft = On : Dt.sibling = On, Dt = On, mt = Pt;
          }
          if (Tt.done)
            return a(U, mt), St && V(U, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = G.next())
              Tt = $(U, Tt.value, P), Tt !== null && (D = u(
                Tt,
                D,
                Nt
              ), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
            return St && V(U, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = G.next())
            Tt = gt(
              mt,
              U,
              Nt,
              Tt.value,
              P
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), D = u(Tt, D, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
          return t && mt.forEach(function(n0) {
            return e(U, n0);
          }), St && V(U, Nt), ft;
        }
        function ra(U, D, G, P) {
          if (typeof G == "object" && G !== null && G.type === ya && G.key === null && (G = G.props.children), typeof G == "object" && G !== null) {
            switch (G.$$typeof) {
              case lr:
                t: {
                  for (var ft = G.key; D !== null; ) {
                    if (D.key === ft) {
                      if (ft = G.type, ft === ya) {
                        if (D.tag === 7) {
                          a(
                            U,
                            D.sibling
                          ), P = c(
                            D,
                            G.props.children
                          ), P.return = U, U = P;
                          break t;
                        }
                      } else if (D.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Sn && Vn(ft) === D.type) {
                        a(
                          U,
                          D.sibling
                        ), P = c(D, G.props), Qa(P, G), P.return = U, U = P;
                        break t;
                      }
                      a(U, D);
                      break;
                    } else e(U, D);
                    D = D.sibling;
                  }
                  G.type === ya ? (P = Wn(
                    G.props.children,
                    U.mode,
                    P,
                    G.key
                  ), P.return = U, U = P) : (P = ar(
                    G.type,
                    G.key,
                    G.props,
                    null,
                    U.mode,
                    P
                  ), Qa(P, G), P.return = U, U = P);
                }
                return g(U);
              case va:
                t: {
                  for (ft = G.key; D !== null; ) {
                    if (D.key === ft)
                      if (D.tag === 4 && D.stateNode.containerInfo === G.containerInfo && D.stateNode.implementation === G.implementation) {
                        a(
                          U,
                          D.sibling
                        ), P = c(
                          D,
                          G.children || []
                        ), P.return = U, U = P;
                        break t;
                      } else {
                        a(U, D);
                        break;
                      }
                    else e(U, D);
                    D = D.sibling;
                  }
                  P = io(G, U.mode, P), P.return = U, U = P;
                }
                return g(U);
              case Sn:
                return G = Vn(G), ra(
                  U,
                  D,
                  G,
                  P
                );
            }
            if (rr(G))
              return le(
                U,
                D,
                G,
                P
              );
            if (k(G)) {
              if (ft = k(G), typeof ft != "function")
                throw Error(s(150));
              return G = ft.call(G), gl(
                U,
                D,
                G,
                P
              );
            }
            if (typeof G.then == "function")
              return ra(
                U,
                D,
                Rl(G),
                P
              );
            if (G.$$typeof === kn)
              return ra(
                U,
                D,
                Ml(U, G),
                P
              );
            Dl(U, G);
          }
          return typeof G == "string" && G !== "" || typeof G == "number" || typeof G == "bigint" ? (G = "" + G, D !== null && D.tag === 6 ? (a(U, D.sibling), P = c(D, G), P.return = U, U = P) : (a(U, D), P = ro(G, U.mode, P), P.return = U, U = P), g(U)) : a(U, D);
        }
        return function(U, D, G, P) {
          try {
            cl = 0;
            var ft = ra(
              U,
              D,
              G,
              P
            );
            return Ma = null, ft;
          } catch (mt) {
            if (mt === Ca || mt === gr) throw mt;
            var Dt = i(29, mt, null, U.mode);
            return Dt.lanes = P, Dt.return = U, Dt;
          } finally {
          }
        };
      }
      function Hl() {
        for (var t = Aa, e = Ao = Aa = 0; e < t; ) {
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
          u !== 0 && Is(a, c, u);
        }
      }
      function Bl(t, e, a, r) {
        je[Aa++] = t, je[Aa++] = e, je[Aa++] = a, je[Aa++] = r, Ao |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function di(t, e, a, r) {
        return Bl(t, e, a, r), Ul(t);
      }
      function Kn(t, e) {
        return Bl(t, null, null, e), Ul(t);
      }
      function Is(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - we(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
      }
      function Ul(t) {
        if (50 < hl)
          throw hl = 0, Qo = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function fi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function mi(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function bn(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function vn(t, e, a) {
        var r = t.updateQueue;
        if (r === null) return null;
        if (r = r.shared, (xt & 2) !== 0) {
          var c = r.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Ul(t), Is(t, null, a), e;
        }
        return Bl(t, r, e, a), Ul(t);
      }
      function Va(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, w(t, a);
        }
      }
      function pi(t, e) {
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
      function Ka() {
        if (jo) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function Xa(t, e, a, r) {
        jo = !1;
        var c = t.updateQueue;
        Tn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, C = c.shared.pending;
        if (C !== null) {
          c.shared.pending = null;
          var Y = C, W = Y.next;
          Y.next = null, g === null ? u = W : g.next = W, g = Y;
          var et = t.alternate;
          et !== null && (et = et.updateQueue, C = et.lastBaseUpdate, C !== g && (C === null ? et.firstBaseUpdate = W : C.next = W, et.lastBaseUpdate = Y));
        }
        if (u !== null) {
          var $ = c.baseState;
          g = 0, et = W = Y = null, C = u;
          do {
            var lt = C.lane & -536870913, gt = lt !== C.lane;
            if (gt ? (kt & lt) === lt : (r & lt) === lt) {
              lt !== 0 && lt === Na && (jo = !0), et !== null && (et = et.next = {
                lane: 0,
                tag: C.tag,
                payload: C.payload,
                callback: null,
                next: null
              });
              t: {
                var le = t, gl = C;
                lt = e;
                var ra = a;
                switch (gl.tag) {
                  case 1:
                    if (le = gl.payload, typeof le == "function") {
                      $ = le.call(
                        ra,
                        $,
                        lt
                      );
                      break t;
                    }
                    $ = le;
                    break t;
                  case 3:
                    le.flags = le.flags & -65537 | 128;
                  case 0:
                    if (le = gl.payload, lt = typeof le == "function" ? le.call(ra, $, lt) : le, lt == null) break t;
                    $ = so({}, $, lt);
                    break t;
                  case 2:
                    Tn = !0;
                }
              }
              lt = C.callback, lt !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [lt] : gt.push(lt));
            } else
              gt = {
                lane: lt,
                tag: C.tag,
                payload: C.payload,
                callback: C.callback,
                next: null
              }, et === null ? (W = et = gt, Y = $) : et = et.next = gt, g |= lt;
            if (C = C.next, C === null) {
              if (C = c.shared.pending, C === null)
                break;
              gt = C, C = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          et === null && (Y = $), c.baseState = Y, c.firstBaseUpdate = W, c.lastBaseUpdate = et, u === null && (c.shared.lanes = 0), Mn |= g, t.lanes = g, t.memoizedState = $;
        }
      }
      function $s(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function Ps(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            $s(a[t], e);
      }
      function tc(t, e) {
        t = un, E(vr, t), E(ja, e), un = t | e.baseLanes;
      }
      function hi() {
        E(vr, un), E(ja, ja.current);
      }
      function gi() {
        un = vr.current, S(ja), S(vr);
      }
      function yn(t) {
        var e = t.alternate;
        E(Gt, Gt.current & 1), E(Se, t), Oe === null && (e === null || ja.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function bi(t) {
        E(Gt, Gt.current), E(Se, t), Oe === null && (Oe = t);
      }
      function ec(t) {
        t.tag === 22 ? (E(Gt, Gt.current), E(Se, t), Oe === null && (Oe = t)) : xn();
      }
      function xn() {
        E(Gt, Gt.current), E(Se, Se.current);
      }
      function ve(t) {
        S(Se), Oe === t && (Oe = null), S(Gt);
      }
      function ql(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || vo(a) || yo(a)))
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
      function vi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ke(t[a], e[a])) return !1;
        return !0;
      }
      function yi(t, e, a, r, c, u) {
        return sn = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? Td : Oo, aa = !1, u = a(r, c), aa = !1, Oa && (u = ac(
          e,
          a,
          r,
          c
        )), nc(t), u;
      }
      function nc(t) {
        dt.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (sn = 0, Yt = Mt = bt = null, yr = !1, ul = 0, Ra = null, e) throw Error(s(300));
        t === null || Lt || (t = t.dependencies, t !== null && Cl(t) && (Lt = !0));
      }
      function ac(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          dt.H = Cd, u = e(a, r);
        } while (Oa);
        return u;
      }
      function Ym() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function xi() {
        var t = xr !== 0;
        return xr = 0, t;
      }
      function wi(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function _i(t) {
        if (yr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          yr = !1;
        }
        sn = 0, Yt = Mt = bt = null, Oa = !1, ul = xr = 0, Ra = null;
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
      function qt() {
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
      function Gl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Za(t) {
        var e = ul;
        return ul += 1, Ra === null && (Ra = []), t = Zs(Ra, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? Td : Oo), t;
      }
      function Yl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === kn) return te(t);
        }
        throw Error(s(438, String(t)));
      }
      function ki(t) {
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
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = Gl(), bt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), r = 0; r < t; r++)
            a[r] = fp;
        return e.index++, a;
      }
      function Pe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Ll(t) {
        var e = qt();
        return Si(e, Mt, t);
      }
      function Si(t, e, a) {
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
          var C = g = null, Y = null, W = e, et = !1;
          do {
            var $ = W.lane & -536870913;
            if ($ !== W.lane ? (kt & $) === $ : (sn & $) === $) {
              var lt = W.revertLane;
              if (lt === 0)
                Y !== null && (Y = Y.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: W.action,
                  hasEagerState: W.hasEagerState,
                  eagerState: W.eagerState,
                  next: null
                }), $ === Na && (et = !0);
              else if ((sn & lt) === lt) {
                W = W.next, lt === Na && (et = !0);
                continue;
              } else
                $ = {
                  lane: 0,
                  revertLane: W.revertLane,
                  gesture: null,
                  action: W.action,
                  hasEagerState: W.hasEagerState,
                  eagerState: W.eagerState,
                  next: null
                }, Y === null ? (C = Y = $, g = u) : Y = Y.next = $, bt.lanes |= lt, Mn |= lt;
              $ = W.action, aa && a(u, $), u = W.hasEagerState ? W.eagerState : a(u, $);
            } else
              lt = {
                lane: $,
                revertLane: W.revertLane,
                gesture: W.gesture,
                action: W.action,
                hasEagerState: W.hasEagerState,
                eagerState: W.eagerState,
                next: null
              }, Y === null ? (C = Y = lt, g = u) : Y = Y.next = lt, bt.lanes |= $, Mn |= $;
            W = W.next;
          } while (W !== null && W !== e);
          if (Y === null ? g = u : Y.next = C, !ke(u, t.memoizedState) && (Lt = !0, et && (a = Ta, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = g, t.baseQueue = Y, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function Ei(t) {
        var e = qt(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var r = a.dispatch, c = a.pending, u = e.memoizedState;
        if (c !== null) {
          a.pending = null;
          var g = c = c.next;
          do
            u = t(u, g.action), g = g.next;
          while (g !== c);
          ke(u, e.memoizedState) || (Lt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, r];
      }
      function lc(t, e, a) {
        var r = bt, c = qt(), u = St;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var g = !ke(
          (Mt || c).memoizedState,
          a
        );
        if (g && (c.memoizedState = a, Lt = !0), c = c.queue, Ti(oc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            ic.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          u || (sn & 127) !== 0 || rc(r, e, a);
        }
        return a;
      }
      function rc(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = Gl(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function ic(t, e, a, r) {
        e.value = a, e.getSnapshot = r, sc(e) && cc(t);
      }
      function oc(t, e, a) {
        return a(function() {
          sc(e) && cc(t);
        });
      }
      function sc(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ke(t, a);
        } catch {
          return !0;
        }
      }
      function cc(t) {
        var e = Kn(t, 2);
        e !== null && pe(e, t, 2);
      }
      function zi(t) {
        var e = fe();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), aa) {
            B(!0);
            try {
              a();
            } finally {
              B(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Pe,
          lastRenderedState: t
        }, e;
      }
      function uc(t, e, a, r) {
        return t.baseState = a, Si(
          t,
          Mt,
          typeof r == "function" ? r : Pe
        );
      }
      function Lm(t, e, a, r, c) {
        if (Kl(t)) throw Error(s(485));
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
          dt.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, dc(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function dc(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = dt.T, g = {};
          dt.T = g;
          try {
            var C = a(c, r), Y = dt.S;
            Y !== null && Y(g, C), fc(t, e, C);
          } catch (W) {
            Ni(t, e, W);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), dt.T = u;
          }
        } else
          try {
            u = a(c, r), fc(t, e, u);
          } catch (W) {
            Ni(t, e, W);
          }
      }
      function fc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            mc(t, e, r);
          },
          function(r) {
            return Ni(t, e, r);
          }
        ) : mc(t, e, a);
      }
      function mc(t, e, a) {
        e.status = "fulfilled", e.value = a, pc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, dc(t, a)));
      }
      function Ni(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, pc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function pc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function hc(t, e) {
        return e;
      }
      function gc(t, e) {
        if (St) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Ot) {
                  var c = rh(
                    Ot,
                    Ae
                  );
                  if (c) {
                    Ot = ud(c), r = ih(c);
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
          lastRenderedReducer: hc,
          lastRenderedState: e
        }, a.queue = r, a = Rc.bind(
          null,
          bt,
          r
        ), r.dispatch = a, r = zi(!1);
        var u = ji.bind(
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
        }, r.queue = c, a = Lm.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function bc(t) {
        var e = qt();
        return vc(e, Mt, t);
      }
      function vc(t, e, a) {
        if (e = Si(
          t,
          e,
          hc
        )[0], t = Ll(Pe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Za(e);
          } catch (g) {
            throw g === Ca ? gr : g;
          }
        else r = e;
        e = qt();
        var c = e.queue, u = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, pa(
          9,
          { destroy: void 0 },
          Qm.bind(null, c, a),
          null
        )), [r, u, t];
      }
      function Qm(t, e) {
        t.action = e;
      }
      function yc(t) {
        var e = qt(), a = Mt;
        if (a !== null)
          return vc(e, a, t);
        qt(), e = e.memoizedState, a = qt();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Gl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function xc() {
        return qt().memoizedState;
      }
      function Ql(t, e, a, r) {
        var c = fe();
        bt.flags |= t, c.memoizedState = pa(
          1 | e,
          { destroy: void 0 },
          a,
          r === void 0 ? null : r
        );
      }
      function Vl(t, e, a, r) {
        var c = qt();
        r = r === void 0 ? null : r;
        var u = c.memoizedState.inst;
        Mt !== null && r !== null && vi(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, a, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          a,
          r
        ));
      }
      function wc(t, e) {
        Ql(8390656, 8, t, e);
      }
      function Ti(t, e) {
        Vl(2048, 8, t, e);
      }
      function Vm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Gl(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function _c(t) {
        var e = qt().memoizedState;
        return Vm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function kc(t, e) {
        return Vl(4, 2, t, e);
      }
      function Sc(t, e) {
        return Vl(4, 4, t, e);
      }
      function Ec(t, e) {
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
      function zc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Vl(
          4,
          4,
          Ec.bind(null, e, t),
          a
        );
      }
      function Ci() {
      }
      function Nc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && vi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function Tc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && vi(e, r[1]))
          return r[0];
        if (r = t(), aa) {
          B(!0);
          try {
            t();
          } finally {
            B(!1);
          }
        }
        return a.memoizedState = [r, e], r;
      }
      function Mi(t, e, a) {
        return a === void 0 || (sn & 1073741824) !== 0 && (kt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Su(), bt.lanes |= t, Mn |= t, a);
      }
      function Cc(t, e, a, r) {
        return ke(a, e) ? a : ja.current !== null ? (t = Mi(t, a, r), ke(t, e) || (Lt = !0), t) : (sn & 42) === 0 || (sn & 1073741824) !== 0 && (kt & 261930) === 0 ? (Lt = !0, t.memoizedState = a) : (t = Su(), bt.lanes |= t, Mn |= t, e);
      }
      function Mc(t, e, a, r, c) {
        var u = rn();
        It(
          u !== 0 && 8 > u ? u : 8
        );
        var g = dt.T, C = {};
        dt.T = C, ji(t, !1, e, a);
        try {
          var Y = c(), W = dt.S;
          if (W !== null && W(C, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var et = Gm(
              Y,
              r
            );
            Ja(
              t,
              e,
              et,
              ye(t)
            );
          } else
            Ja(
              t,
              e,
              r,
              ye(t)
            );
        } catch ($) {
          Ja(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: $ },
            ye()
          );
        } finally {
          It(u), g !== null && C.types !== null && (g.types = C.types), dt.T = g;
        }
      }
      function Ac(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: xa,
          baseState: xa,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Pe,
            lastRenderedState: xa
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
            lastRenderedReducer: Pe,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function Ai() {
        return te(In);
      }
      function jc() {
        return qt().memoizedState;
      }
      function Oc() {
        return qt().memoizedState;
      }
      function Km(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ye();
              t = bn(a);
              var r = vn(e, t, a);
              r !== null && (pe(r, e, a), Va(r, e, a)), e = { cache: si() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Xm(t, e, a) {
        var r = ye();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Kl(t) ? Dc(e, a) : (a = di(t, e, a, r), a !== null && (pe(a, t, r), Hc(a, e, r)));
      }
      function Rc(t, e, a) {
        var r = ye();
        Ja(t, e, a, r);
      }
      function Ja(t, e, a, r) {
        var c = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Kl(t)) Dc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, C = u(g, a);
              if (c.hasEagerState = !0, c.eagerState = C, ke(C, g))
                return Bl(t, e, c, 0), At === null && Hl(), !1;
            } catch {
            } finally {
            }
          if (a = di(t, e, c, r), a !== null)
            return pe(a, t, r), Hc(a, e, r), !0;
        }
        return !1;
      }
      function ji(t, e, a, r) {
        if (r = {
          lane: 2,
          revertLane: ci(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Kl(t)) {
          if (e) throw Error(s(479));
        } else
          e = di(
            t,
            a,
            r,
            2
          ), e !== null && pe(e, t, 2);
      }
      function Kl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Dc(t, e) {
        Oa = yr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Hc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, w(t, a);
        }
      }
      function Oi(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : so({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Bc(t, e, a, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !Ol(a, r) || !Ol(c, u) : !0;
      }
      function Uc(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Ro.enqueueReplaceState(e, e.state, null);
      }
      function Xn(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var r in e)
            r !== "ref" && (a[r] = e[r]);
        }
        if (t = t.defaultProps) {
          a === e && (a = so({}, a));
          for (var c in t)
            a[c] === void 0 && (a[c] = t[c]);
        }
        return a;
      }
      function Xl(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function qc(t, e, a) {
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
      function Ri(t, e, a) {
        return a = bn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Xl(t, e);
        }, a;
      }
      function Gc(t) {
        return t = bn(t), t.tag = 3, t;
      }
      function Yc(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            qc(e, a, r);
          };
        }
        var g = a.stateNode;
        g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
          qc(e, a, r), typeof c != "function" && (An === null ? An = /* @__PURE__ */ new Set([this]) : An.add(this));
          var C = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: C !== null ? C : ""
          });
        });
      }
      function Zm(t, e, a, r, c) {
        if (a.flags |= 32768, r !== null && typeof r == "object" && typeof r.then == "function") {
          if (e = a.alternate, e !== null && fa(
            e,
            a,
            c,
            !0
          ), a = Se.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Oe === null ? er() : a.alternate === null && Bt === 0 && (Bt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === br ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), ao(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === br ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), ao(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return ao(t, r, c), er(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== zo && (t = Error(s(422), { cause: r }), Ya(
            L(t, a)
          ))) : (r !== zo && (e = Error(s(423), {
            cause: r
          }), Ya(
            L(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = L(r, a), c = Ri(
            t.stateNode,
            r,
            c
          ), pi(t, c), Bt !== 4 && (Bt = 2)), !1;
        var u = Error(s(520), { cause: r });
        if (u = L(u, a), ml === null ? ml = [u] : ml.push(u), Bt !== 4 && (Bt = 2), e === null) return !0;
        r = L(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Ri(a.stateNode, r, t), pi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (An === null || !An.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Gc(c), Yc(
                  c,
                  t,
                  a,
                  r
                ), pi(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function ee(t, e, a, r) {
        e.child = t === null ? Nd(e, null, a, r) : na(
          e,
          t.child,
          a,
          r
        );
      }
      function Lc(t, e, a, r, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in r) {
          var g = {};
          for (var C in r)
            C !== "ref" && (g[C] = r[C]);
        } else g = r;
        return Qn(e), r = yi(
          t,
          e,
          a,
          g,
          u,
          c
        ), C = xi(), t !== null && !Lt ? (wi(t, e, c), tn(t, e, c)) : (St && C && Z(e), e.flags |= 1, ee(t, e, r, c), e.child);
      }
      function Qc(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !lo(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Vc(
            t,
            e,
            u,
            r,
            c
          )) : (t = ar(
            a.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !Yi(t, c)) {
          var g = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : Ol, a(g, r) && t.ref === e.ref)
            return tn(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = an(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Vc(t, e, a, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (Ol(u, r) && t.ref === e.ref)
            if (Lt = !1, e.pendingProps = r = u, Yi(t, c))
              (t.flags & 131072) !== 0 && (Lt = !0);
            else
              return e.lanes = t.lanes, tn(t, e, c);
        }
        return Di(
          t,
          e,
          a,
          r,
          c
        );
      }
      function Kc(t, e, a, r) {
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
            return Xc(
              t,
              e,
              u,
              a,
              r
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && jl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? tc(e, u) : hi(), ec(e);
          else
            return r = e.lanes = 536870912, Xc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (jl(e, u.cachePool), tc(e, u), xn(), e.memoizedState = null) : (t !== null && jl(e, null), hi(), xn());
        return ee(t, e, c, a), e.child;
      }
      function Wa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Xc(t, e, a, r, c) {
        var u = ui();
        return u = u === null ? null : {
          parent: ln ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && jl(e, null), hi(), ec(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Zl(t, e) {
        return e = Wl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Zc(t, e, a) {
        return na(e, t.child, null, a), t = Zl(
          e,
          e.pendingProps
        ), t.flags |= 2, ve(e), e.memoizedState = null, t;
      }
      function Jm(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Zl(e, r), e.lanes = 536870912, Wa(null, t);
            if (bi(e), (t = Ot) ? (t = hh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: En !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Vu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Zl(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (bi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Zc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Lt || fa(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Lt || c) {
            if (r = At, r !== null && (g = M(r, a), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Kn(t, g), pe(r, t, g), Do;
            er(), e = Zc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ue && (Ot = uh(g), ae = e, St = !0, Nn = null, Ae = !1, t !== null && st(e, t)), e = Zl(e, r), e.flags |= 4096;
          return e;
        }
        return t = an(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Jl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Di(t, e, a, r, c) {
        return Qn(e), a = yi(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = xi(), t !== null && !Lt ? (wi(t, e, c), tn(t, e, c)) : (St && r && Z(e), e.flags |= 1, ee(t, e, a, c), e.child);
      }
      function Jc(t, e, a, r, c, u) {
        return Qn(e), e.updateQueue = null, a = ac(
          e,
          r,
          a,
          c
        ), nc(t), r = xi(), t !== null && !Lt ? (wi(t, e, u), tn(t, e, u)) : (St && r && Z(e), e.flags |= 1, ee(t, e, a, u), e.child);
      }
      function Wc(t, e, a, r, c) {
        if (Qn(e), e.stateNode === null) {
          var u = ka, g = a.contextType;
          typeof g == "object" && g !== null && (u = te(g)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Ro, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, fi(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? te(g) : ka, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (Oi(
            e,
            a,
            g,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Ro.enqueueReplaceState(
            u,
            u.state,
            null
          ), Xa(e, r, u, c), Ka(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, Y = Xn(a, C);
          u.props = Y;
          var W = u.context, et = a.contextType;
          g = ka, typeof et == "object" && et !== null && (g = te(et));
          var $ = a.getDerivedStateFromProps;
          et = typeof $ == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, et || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || W !== g) && Uc(
            e,
            u,
            r,
            g
          ), Tn = !1;
          var lt = e.memoizedState;
          u.state = lt, Xa(e, r, u, c), Ka(), W = e.memoizedState, C || lt !== W || Tn ? (typeof $ == "function" && (Oi(
            e,
            a,
            $,
            r
          ), W = e.memoizedState), (Y = Tn || Bc(
            e,
            a,
            Y,
            r,
            lt,
            W,
            g
          )) ? (et || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = W), u.props = r, u.state = W, u.context = g, r = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, mi(t, e), g = e.memoizedProps, et = Xn(a, g), u.props = et, $ = e.pendingProps, lt = u.context, W = a.contextType, Y = ka, typeof W == "object" && W !== null && (Y = te(W)), C = a.getDerivedStateFromProps, (W = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== $ || lt !== Y) && Uc(
            e,
            u,
            r,
            Y
          ), Tn = !1, lt = e.memoizedState, u.state = lt, Xa(e, r, u, c), Ka();
          var gt = e.memoizedState;
          g !== $ || lt !== gt || Tn || t !== null && t.dependencies !== null && Cl(t.dependencies) ? (typeof C == "function" && (Oi(
            e,
            a,
            C,
            r
          ), gt = e.memoizedState), (et = Tn || Bc(
            e,
            a,
            et,
            r,
            lt,
            gt,
            Y
          ) || t !== null && t.dependencies !== null && Cl(t.dependencies)) ? (W || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, Y), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            Y
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = Y, r = et) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Jl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = na(
          e,
          t.child,
          null,
          c
        ), e.child = na(
          e,
          null,
          a,
          c
        )) : ee(t, e, a, c), e.memoizedState = u.state, t = e.child) : t = tn(
          t,
          e,
          c
        ), t;
      }
      function Fc(t, e, a, r) {
        return He(), e.flags |= 256, ee(t, e, a, r), e.child;
      }
      function Hi(t) {
        return { baseLanes: t, cachePool: Ks() };
      }
      function Bi(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= ze), t;
      }
      function Ic(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (Gt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? yn(e) : xn(), (t = Ot) ? (t = gh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: En !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Vu(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return yo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = r.children;
          return r = r.fallback, c ? (xn(), c = e.mode, C = Wl(
            { mode: "hidden", children: C },
            c
          ), r = Wn(
            r,
            c,
            a,
            null
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = Hi(a), r.childLanes = Bi(
            t,
            g,
            a
          ), e.memoizedState = Ho, Wa(null, r)) : (yn(e), Ui(e, C));
        }
        var Y = t.memoizedState;
        if (Y !== null && (C = Y.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (yn(e), e.flags &= -257, e = qi(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (xn(), e.child = t.child, e.flags |= 128, e = null) : (xn(), C = r.fallback, c = e.mode, r = Wl(
              { mode: "visible", children: r.children },
              c
            ), C = Wn(
              C,
              c,
              a,
              null
            ), C.flags |= 2, r.return = e, C.return = e, r.sibling = C, e.child = r, na(
              e,
              t.child,
              null,
              a
            ), r = e.child, r.memoizedState = Hi(a), r.childLanes = Bi(
              t,
              g,
              a
            ), e.memoizedState = Ho, e = Wa(null, r));
          else if (yn(e), yo(C))
            g = ah(C).digest, r = Error(s(419)), r.stack = "", r.digest = g, Ya({ value: r, source: null, stack: null }), e = qi(
              t,
              e,
              a
            );
          else if (Lt || fa(
            t,
            e,
            a,
            !1
          ), g = (a & t.childLanes) !== 0, Lt || g) {
            if (g = At, g !== null && (r = M(
              g,
              a
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Kn(t, r), pe(g, t, r), Do;
            vo(C) || er(), e = qi(
              t,
              e,
              a
            );
          } else
            vo(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, ue && (Ot = dh(
              C
            ), ae = e, St = !0, Nn = null, Ae = !1, t !== null && st(e, t)), e = Ui(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (xn(), C = r.fallback, c = e.mode, Y = t.child, u = Y.sibling, r = an(Y, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = Y.subtreeFlags & 65011712, u !== null ? C = an(
          u,
          C
        ) : (C = Wn(
          C,
          c,
          a,
          null
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Wa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = Hi(a) : (c = C.cachePool, c !== null ? (Y = ln ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = Ks(), C = {
          baseLanes: C.baseLanes | a,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Bi(
          t,
          g,
          a
        ), e.memoizedState = Ho, Wa(t.child, r)) : (yn(e), a = t.child, t = a.sibling, a = an(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Ui(t, e) {
        return e = Wl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Wl(t, e) {
        return t = i(22, t, null, e), t.lanes = 0, t;
      }
      function qi(t, e, a) {
        return na(e, t.child, null, a), t = Ui(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function $c(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), ii(t.return, e, a);
      }
      function Gi(t, e, a, r, c, u) {
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
      function Pc(t, e, a) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var g = Gt.current, C = (g & 2) !== 0;
        if (C ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, E(Gt, g), ee(t, e, r, a), r = St ? il : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && $c(t, a, e);
            else if (t.tag === 19)
              $c(t, a, e);
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
              t = a.alternate, t !== null && ql(t) === null && (c = a), a = a.sibling;
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), Gi(
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
              if (t = c.alternate, t !== null && ql(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = a, a = c, c = t;
            }
            Gi(
              e,
              !0,
              a,
              null,
              u,
              r
            );
            break;
          case "together":
            Gi(
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
      function tn(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), Mn |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (fa(
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
          for (t = e.child, a = an(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = an(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function Yi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Cl(t)));
      }
      function Wm(t, e, a) {
        switch (e.tag) {
          case 3:
            ct(
              e,
              e.stateNode.containerInfo
            ), gn(e, Rt, t.memoizedState.cache), He();
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
            gn(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, bi(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (yn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Ic(
                t,
                e,
                a
              ) : (yn(e), t = tn(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            yn(e);
            break;
          case 19:
            var c = (t.flags & 128) !== 0;
            if (r = (a & e.childLanes) !== 0, r || (fa(
              t,
              e,
              a,
              !1
            ), r = (a & e.childLanes) !== 0), c) {
              if (r)
                return Pc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), E(Gt, Gt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Kc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            gn(e, Rt, t.memoizedState.cache);
        }
        return tn(t, e, a);
      }
      function tu(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Lt = !0;
          else {
            if (!Yi(t, a) && (e.flags & 128) === 0)
              return Lt = !1, Wm(
                t,
                e,
                a
              );
            Lt = (t.flags & 131072) !== 0;
          }
        else
          Lt = !1, St && (e.flags & 1048576) !== 0 && T(e, il, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Vn(e.elementType), e.type = t, typeof t == "function")
                lo(t) ? (r = Xn(t, r), e.tag = 1, e = Wc(
                  null,
                  e,
                  t,
                  r,
                  a
                )) : (e.tag = 0, e = Di(
                  null,
                  e,
                  t,
                  r,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === uo) {
                    e.tag = 11, e = Lc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === po) {
                    e.tag = 14, e = Qc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  }
                }
                throw e = b(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return Di(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return r = e.type, c = Xn(
              r,
              e.pendingProps
            ), Wc(
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
              c = e.memoizedState, r = c.element, mi(t, e), Xa(e, u, null, a);
              var g = e.memoizedState;
              if (u = g.cache, gn(e, Rt, u), u !== c.cache && oi(
                e,
                [Rt],
                a,
                !0
              ), Ka(), u = g.element, ue && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: g.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = Fc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== r) {
                  r = L(
                    Error(s(424)),
                    e
                  ), Ya(r), e = Fc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ue && (Ot = ch(
                    e.stateNode.containerInfo
                  ), ae = e, St = !0, Nn = null, Ae = !0), a = Nd(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (He(), u === r) {
                  e = tn(
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
            if (Ge)
              return Jl(t, e), t === null ? (a = md(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : St || (e.stateNode = Hh(
                e.type,
                e.pendingProps,
                zn.current,
                e
              )) : e.memoizedState = md(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Zt)
              return Et(e), t === null && Zt && St && (r = e.stateNode = yd(
                e.type,
                e.pendingProps,
                zn.current,
                ne.current,
                !1
              ), ae = e, Ae = !0, Ot = fh(
                e.type,
                r,
                Ot
              )), ee(
                t,
                e,
                e.pendingProps.children,
                a
              ), Jl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (Oh(
              e.type,
              e.pendingProps,
              ne.current
            ), (c = r = Ot) && (r = mh(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, ae = e, Ot = sh(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, ir(c, u) ? r = null : g !== null && ir(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = yi(
              t,
              e,
              Ym,
              null,
              null,
              a
            ), ln ? In._currentValue = c : In._currentValue2 = c), Jl(t, e), ee(t, e, r, a), e.child;
          case 6:
            return t === null && St && (Rh(
              e.pendingProps,
              ne.current
            ), (t = a = Ot) && (a = ph(
              a,
              e.pendingProps,
              Ae
            ), a !== null ? (e.stateNode = a, ae = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Ic(t, e, a);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = na(
              e,
              null,
              r,
              a
            ) : ee(t, e, r, a), e.child;
          case 11:
            return Lc(
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
            return r = e.pendingProps, gn(e, e.type, r.value), ee(
              t,
              e,
              r.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Qn(e), c = te(c), r = r(c), e.flags |= 1, ee(t, e, r, a), e.child;
          case 14:
            return Qc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Vc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return Pc(
              t,
              e,
              a
            );
          case 31:
            return Jm(t, e, a);
          case 22:
            return Kc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Qn(e), r = te(Rt), t === null ? (c = ui(), c === null && (c = At, u = si(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, fi(e), gn(e, Rt, c)) : ((t.lanes & a) !== 0 && (mi(t, e), Xa(e, null, null, a), Ka()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), gn(e, Rt, r)) : (r = u.cache, gn(e, Rt, r), r !== c.cache && oi(
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
      function Fl(t) {
        Ke && (t.flags |= 8);
      }
      function eu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Li(t, e, a, r) {
        if (ce)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              go(t, a.stateNode);
            else if (!(a.tag === 4 || Zt && a.tag === 27) && a.child !== null) {
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
              a && r && (u = sd(
                u,
                c.type,
                c.memoizedProps
              )), go(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = cd(
                u,
                c.memoizedProps
              )), go(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Li(t, c, !0, !0);
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
      function nu(t, e, a, r) {
        var c = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var g = u.stateNode;
              a && r && (g = sd(
                g,
                u.type,
                u.memoizedProps
              )), id(t, g);
            } else if (u.tag === 6)
              g = u.stateNode, a && r && (g = cd(
                g,
                u.memoizedProps
              )), id(t, g);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), nu(t, u, !0, !0), c = !0;
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
      function au(t, e) {
        if (Ke && eu(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = rd();
          nu(r, e, !1, !1), t.pendingChildren = r, Be(e), nh(a, r);
        }
      }
      function Qi(t, e, a, r) {
        if (ce)
          t.memoizedProps !== r && Be(e);
        else if (Ke) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = eu(t, e)) || u !== r) {
            var g = ne.current;
            u = eh(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Fl(e), td(
              u,
              a,
              r,
              g
            ) && Be(e), e.stateNode = u, t && Li(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Vi(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? Tp(e, r) : Cp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || bo(e, r))
            if (nd(t.stateNode, e, r))
              t.flags |= 8192;
            else if (Cu()) t.flags |= 8192;
            else
              throw ea = br, Mo;
        } else t.flags &= -16777217;
      }
      function lu(t, e) {
        if (Uh(e)) {
          if (t.flags |= 16777216, !vd(e))
            if (Cu()) t.flags |= 8192;
            else
              throw ea = br, Mo;
        } else t.flags &= -16777217;
      }
      function Il(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? X() : 536870912, t.lanes |= e, Ba |= e);
      }
      function Fa(t, e) {
        if (!St)
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
      function Fm(t, e, a) {
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
            return jt(e), null;
          case 1:
            return jt(e), null;
          case 3:
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), $e(Rt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (De(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, hn())), au(t, e), jt(e), null;
          case 26:
            if (Ge) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (Be(e), u !== null ? (jt(e), lu(
                e,
                u
              )) : (jt(e), Vi(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (Be(e), jt(e), lu(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, ce ? u !== r && Be(e) : Qi(
                t,
                e,
                c,
                r
              ), jt(e), Vi(
                e,
                c,
                u,
                r,
                a
              )), null;
            }
          case 27:
            if (Zt) {
              if (Ft(e), a = zn.current, c = e.type, t !== null && e.stateNode != null)
                ce ? t.memoizedProps !== r && Be(e) : Qi(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = ne.current, De(e) ? Yn(e, t) : (t = yd(
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
            if (Ft(e), c = e.type, t !== null && e.stateNode != null)
              Qi(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = ne.current, De(e))
                Yn(e, u), Nh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = xp(
                  c,
                  r,
                  zn.current,
                  u,
                  e
                );
                Fl(e), Li(g, e, !1, !1), e.stateNode = g, td(
                  g,
                  c,
                  r,
                  u
                ) && Be(e);
              }
            }
            return jt(e), Vi(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ce ? a !== r && Be(e) : Ke && (a !== r ? (t = zn.current, a = ne.current, Fl(e), e.stateNode = ed(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = zn.current, a = ne.current, De(e)) {
                if (!ue) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = ae, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                vh(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Fl(e), e.stateNode = ed(
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
                  if (!ue) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  yh(t, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = hn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
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
                  if (!ue) throw Error(s(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(s(317));
                  xh(c, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), c = !1;
              } else
                c = hn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ve(e), e) : (ve(e), null);
            }
            return ve(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Il(e, e.updateQueue), jt(e), null);
          case 4:
            return ut(), au(t, e), t === null && Sp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return $e(e.type), jt(e), null;
          case 19:
            if (S(Gt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Bt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = ql(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Il(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Qu(a, t), a = a.sibling;
                      return E(
                        Gt,
                        Gt.current & 1 | 2
                      ), St && V(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && he() > pl && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = ql(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, Il(e, t), Fa(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !St)
                    return jt(e), null;
                } else
                  2 * he() - r.renderingStartTime > pl && a !== 536870912 && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = he(), t.sibling = null, a = Gt.current, E(
              Gt,
              c ? a & 1 | 2 : a & 1
            ), St && V(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return ve(e), gi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Il(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && S(ta), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), $e(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function Im(t, e) {
        switch (at(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return $e(Rt), ut(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Ft(e), null;
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
            return S(Gt), null;
          case 4:
            return ut(), null;
          case 10:
            return $e(e.type), null;
          case 22:
          case 23:
            return ve(e), gi(), t !== null && S(ta), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return $e(Rt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function ru(t, e) {
        switch (at(e), e.tag) {
          case 3:
            $e(Rt), ut();
            break;
          case 26:
          case 27:
          case 5:
            Ft(e);
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
            S(Gt);
            break;
          case 10:
            $e(e.type);
            break;
          case 22:
          case 23:
            ve(e), gi(), t !== null && S(ta);
            break;
          case 24:
            $e(Rt);
        }
      }
      function Ia(t, e) {
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
        } catch (C) {
          zt(e, e.return, C);
        }
      }
      function wn(t, e, a) {
        try {
          var r = e.updateQueue, c = r !== null ? r.lastEffect : null;
          if (c !== null) {
            var u = c.next;
            r = u;
            do {
              if ((r.tag & t) === t) {
                var g = r.inst, C = g.destroy;
                if (C !== void 0) {
                  g.destroy = void 0, c = e;
                  var Y = a, W = C;
                  try {
                    W();
                  } catch (et) {
                    zt(
                      c,
                      Y,
                      et
                    );
                  }
                }
              }
              r = r.next;
            } while (r !== u);
          }
        } catch (et) {
          zt(e, e.return, et);
        }
      }
      function iu(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Ps(e, a);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function ou(t, e, a) {
        a.props = Xn(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (r) {
          zt(t, e, r);
        }
      }
      function $a(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var r = nl(t.stateNode);
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
      function su(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          Vp(r, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function Ki(t, e, a) {
        try {
          Kp(
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
      function cu(t) {
        return t.tag === 5 || t.tag === 3 || (Ge ? t.tag === 26 : !1) || (Zt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Xi(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || cu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Zt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Zi(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Zp(a, t, e) : Lp(a, t);
        else if (r !== 4 && (Zt && r === 27 && wa(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Zi(t, e, a), t = t.sibling; t !== null; )
            Zi(t, e, a), t = t.sibling;
      }
      function $l(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Xp(a, t, e) : Yp(a, t);
        else if (r !== 4 && (Zt && r === 27 && wa(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for ($l(t, e, a), t = t.sibling; t !== null; )
            $l(t, e, a), t = t.sibling;
      }
      function uu(t, e, a) {
        t = t.containerInfo;
        try {
          od(t, a);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function du(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Gh(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function $m(t, e) {
        for (vp(t.containerInfo), $t = e; $t !== null; )
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
                      var g = Xn(
                        r.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        g,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      zt(r, r.return, C);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && th(t.stateNode.containerInfo);
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
      function fu(t, e, a) {
        var r = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            en(t, a), r & 4 && Ia(5, a);
            break;
          case 1:
            if (en(t, a), r & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (g) {
                  zt(a, a.return, g);
                }
              else {
                var c = Xn(
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
            r & 64 && iu(a), r & 512 && $a(a, a.return);
            break;
          case 3:
            if (en(t, a), r & 64 && (r = a.updateQueue, r !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = nl(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                Ps(r, t);
              } catch (g) {
                zt(a, a.return, g);
              }
            }
            break;
          case 27:
            Zt && e === null && r & 4 && du(a);
          case 26:
          case 5:
            if (en(t, a), e === null) {
              if (r & 4) su(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  kh(
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
            r & 512 && $a(a, a.return);
            break;
          case 12:
            en(t, a);
            break;
          case 31:
            en(t, a), r & 4 && pu(t, a);
            break;
          case 13:
            en(t, a), r & 4 && hu(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = rp.bind(
              null,
              a
            ), lh(r, a))));
            break;
          case 22:
            if (r = a.memoizedState !== null || cn, !r) {
              e = e !== null && e.memoizedState !== null || Qt, c = cn;
              var u = Qt;
              cn = r, (Qt = e) && !u ? nn(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : en(t, a), cn = c, Qt = u;
            }
            break;
          case 30:
            break;
          default:
            en(t, a);
        }
      }
      function mu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, mu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Np(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, a) {
        for (a = a.child; a !== null; )
          Ji(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Ji(t, e, a) {
        if (_e && typeof _e.onCommitFiberUnmount == "function")
          try {
            _e.onCommitFiberUnmount(rl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ge) {
              Qt || Ve(a, e), Ue(
                t,
                e,
                a
              ), a.memoizedState ? hd(a.memoizedState) : a.stateNode && bd(a.stateNode);
              break;
            }
          case 27:
            if (Zt) {
              Qt || Ve(a, e);
              var r = Vt, c = ge;
              wa(a.type) && (Vt = a.stateNode, ge = !1), Ue(
                t,
                e,
                a
              ), xd(a.stateNode), Vt = r, ge = c;
              break;
            }
          case 5:
            Qt || Ve(a, e);
          case 6:
            if (ce) {
              if (r = Vt, c = ge, Vt = null, Ue(
                t,
                e,
                a
              ), Vt = r, ge = c, Vt !== null)
                if (ge)
                  try {
                    Wp(Vt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Jp(Vt, a.stateNode);
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
            ce && Vt !== null && (ge ? Mh(
              Vt,
              a.stateNode
            ) : Ch(Vt, a.stateNode));
            break;
          case 4:
            ce ? (r = Vt, c = ge, Vt = a.stateNode.containerInfo, ge = !0, Ue(
              t,
              e,
              a
            ), Vt = r, ge = c) : (Ke && uu(
              a.stateNode,
              a,
              rd()
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
            wn(2, a, e), Qt || wn(4, a, e), Ue(
              t,
              e,
              a
            );
            break;
          case 1:
            Qt || (Ve(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && ou(
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
            Qt = (r = Qt) || a.memoizedState !== null, Ue(
              t,
              e,
              a
            ), Qt = r;
            break;
          default:
            Ue(
              t,
              e,
              a
            );
        }
      }
      function pu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Eh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function hu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            zh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
      }
      function Pm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Md()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Md()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function Pl(t, e) {
        var a = Pm(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = ip.bind(null, t, r);
            r.then(c, c);
          }
        });
      }
      function se(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var r = 0; r < a.length; r++) {
            var c = a[r], u = t, g = e;
            if (ce) {
              var C = g;
              t: for (; C !== null; ) {
                switch (C.tag) {
                  case 27:
                    if (Zt) {
                      if (wa(C.type)) {
                        Vt = C.stateNode, ge = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Vt = C.stateNode, ge = !1;
                    break t;
                  case 3:
                  case 4:
                    Vt = C.stateNode.containerInfo, ge = !0;
                    break t;
                }
                C = C.return;
              }
              if (Vt === null) throw Error(s(160));
              Ji(u, g, c), Vt = null, ge = !1;
            } else Ji(u, g, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            gu(e, t), e = e.sibling;
      }
      function gu(t, e) {
        var a = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            se(e, t), me(t), r & 4 && (wn(3, t, t.return), Ia(3, t), wn(5, t, t.return));
            break;
          case 1:
            se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), r & 64 && cn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (Ge) {
              var c = Ye;
              if (se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Dh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : gd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = pd(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? a.stateNode !== null && bd(a.stateNode) : hd(r), u === null ? gd(
                  c,
                  t.type,
                  t.stateNode
                ) : pd(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Ki(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Zt) {
              se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), a !== null && r & 4 && Ki(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), ce) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  ld(c);
                } catch ($) {
                  zt(t, t.return, $);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Ki(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (Bo = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (se(e, t), me(t), r & 4 && ce) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                Qp(c, a, r);
              } catch ($) {
                zt(t, t.return, $);
              }
            }
            break;
          case 3:
            if (Ge ? (Bh(), c = Ye, Ye = xo(e.containerInfo), se(e, t), Ye = c) : se(e, t), me(t), r & 4) {
              if (ce && ue && a !== null && a.memoizedState.isDehydrated)
                try {
                  Sh(e.containerInfo);
                } catch ($) {
                  zt(t, t.return, $);
                }
              if (Ke) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  od(r, a);
                } catch ($) {
                  zt(t, t.return, $);
                }
              }
            }
            Bo && (Bo = !1, bu(t));
            break;
          case 4:
            Ge ? (a = Ye, Ye = xo(
              t.stateNode.containerInfo
            ), se(e, t), me(t), Ye = a) : (se(e, t), me(t)), r & 4 && Ke && uu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            se(e, t), me(t);
            break;
          case 31:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
            break;
          case 13:
            se(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (zr = he()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var g = a !== null && a.memoizedState !== null, C = cn, Y = Qt;
            if (cn = C || c, Qt = Y || g, se(e, t), Qt = Y, cn = C, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || g || cn || Qt || Zn(t)), ce)) {
              t: if (a = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ge && e.tag === 26) {
                    if (a === null) {
                      g = a = e;
                      try {
                        u = g.stateNode, c ? Fp(u) : $p(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch ($) {
                        zt(g, g.return, $);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      g = e;
                      try {
                        var W = g.stateNode;
                        c ? Ip(W) : Pp(W, g.memoizedProps);
                      } catch ($) {
                        zt(g, g.return, $);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      g = e;
                      try {
                        var et = g.stateNode;
                        c ? Ah(et) : jh(g.stateNode);
                      } catch ($) {
                        zt(g, g.return, $);
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
            r & 4 && (r = t.updateQueue, r !== null && (a = r.retryQueue, a !== null && (r.retryQueue = null, Pl(t, a))));
            break;
          case 19:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, Pl(t, r)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            se(e, t), me(t);
        }
      }
      function me(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, r = t.return; r !== null; ) {
              if (cu(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (ce) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Zt) {
                    var c = a.stateNode, u = Xi(t);
                    $l(t, u, c);
                    break;
                  }
                case 5:
                  var g = a.stateNode;
                  a.flags & 32 && (ld(g), a.flags &= -33);
                  var C = Xi(t);
                  $l(t, C, g);
                  break;
                case 3:
                case 4:
                  var Y = a.stateNode.containerInfo, W = Xi(t);
                  Zi(
                    t,
                    W,
                    Y
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (et) {
            zt(t, t.return, et);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function bu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            bu(e), e.tag === 5 && e.flags & 1024 && jp(e.stateNode), t = t.sibling;
          }
      }
      function en(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            fu(t, e.alternate, e), e = e.sibling;
      }
      function Zn(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              wn(4, e, e.return), Zn(e);
              break;
            case 1:
              Ve(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && ou(
                e,
                e.return,
                a
              ), Zn(e);
              break;
            case 27:
              Zt && xd(e.stateNode);
            case 26:
            case 5:
              Ve(e, e.return), Zn(e);
              break;
            case 22:
              e.memoizedState === null && Zn(e);
              break;
            case 30:
              Zn(e);
              break;
            default:
              Zn(e);
          }
          t = t.sibling;
        }
      }
      function nn(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, u = e, g = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              nn(
                c,
                u,
                a
              ), Ia(4, u);
              break;
            case 1:
              if (nn(
                c,
                u,
                a
              ), r = u, c = r.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch (W) {
                  zt(r, r.return, W);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var C = r.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      $s(Y[c], C);
                } catch (W) {
                  zt(r, r.return, W);
                }
              }
              a && g & 64 && iu(u), $a(u, u.return);
              break;
            case 27:
              Zt && du(u);
            case 26:
            case 5:
              nn(
                c,
                u,
                a
              ), a && r === null && g & 4 && su(u), $a(u, u.return);
              break;
            case 12:
              nn(
                c,
                u,
                a
              );
              break;
            case 31:
              nn(
                c,
                u,
                a
              ), a && g & 4 && pu(c, u);
              break;
            case 13:
              nn(
                c,
                u,
                a
              ), a && g & 4 && hu(c, u);
              break;
            case 22:
              u.memoizedState === null && nn(
                c,
                u,
                a
              ), $a(u, u.return);
              break;
            case 30:
              break;
            default:
              nn(
                c,
                u,
                a
              );
          }
          e = e.sibling;
        }
      }
      function Wi(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && La(a));
      }
      function Fi(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && La(t));
      }
      function qe(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            vu(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function vu(t, e, a, r) {
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
            ), c & 2048 && Ia(9, e);
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
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && La(t)));
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
                var u = e.memoizedProps, g = u.id, C = u.onPostCommit;
                typeof C == "function" && C(
                  g,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (Y) {
                zt(e, e.return, Y);
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
            ) : Pa(
              t,
              e
            ) : u._visibility & 2 ? qe(
              t,
              e,
              a,
              r
            ) : (u._visibility |= 2, ha(
              t,
              e,
              a,
              r,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), c & 2048 && Wi(g, e);
            break;
          case 24:
            qe(
              t,
              e,
              a,
              r
            ), c & 2048 && Fi(e.alternate, e);
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
      function ha(t, e, a, r, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, g = e, C = a, Y = r, W = g.flags;
          switch (g.tag) {
            case 0:
            case 11:
            case 15:
              ha(
                u,
                g,
                C,
                Y,
                c
              ), Ia(8, g);
              break;
            case 23:
              break;
            case 22:
              var et = g.stateNode;
              g.memoizedState !== null ? et._visibility & 2 ? ha(
                u,
                g,
                C,
                Y,
                c
              ) : Pa(
                u,
                g
              ) : (et._visibility |= 2, ha(
                u,
                g,
                C,
                Y,
                c
              )), c && W & 2048 && Wi(
                g.alternate,
                g
              );
              break;
            case 24:
              ha(
                u,
                g,
                C,
                Y,
                c
              ), c && W & 2048 && Fi(g.alternate, g);
              break;
            default:
              ha(
                u,
                g,
                C,
                Y,
                c
              );
          }
          e = e.sibling;
        }
      }
      function Pa(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                Pa(a, r), c & 2048 && Wi(
                  r.alternate,
                  r
                );
                break;
              case 24:
                Pa(a, r), c & 2048 && Fi(
                  r.alternate,
                  r
                );
                break;
              default:
                Pa(a, r);
            }
            e = e.sibling;
          }
      }
      function Jn(t, e, a) {
        if (t.subtreeFlags & Da)
          for (t = t.child; t !== null; )
            yu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function yu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Jn(
              t,
              e,
              a
            ), t.flags & Da)
              if (t.memoizedState !== null)
                qh(
                  a,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || bo(c, t)) && ad(a, r, c, t);
              }
            break;
          case 5:
            Jn(
              t,
              e,
              a
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || bo(c, t)) && ad(a, r, c, t));
            break;
          case 3:
          case 4:
            Ge ? (r = Ye, Ye = xo(
              t.stateNode.containerInfo
            ), Jn(
              t,
              e,
              a
            ), Ye = r) : Jn(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Da, Da = 16777216, Jn(
              t,
              e,
              a
            ), Da = r) : Jn(
              t,
              e,
              a
            ));
            break;
          default:
            Jn(
              t,
              e,
              a
            );
        }
      }
      function xu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function tl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              $t = r, _u(
                r,
                t
              );
            }
          xu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            wu(t), t = t.sibling;
      }
      function wu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            tl(t), t.flags & 2048 && wn(9, t, t.return);
            break;
          case 3:
            tl(t);
            break;
          case 12:
            tl(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, tr(t)) : tl(t);
            break;
          default:
            tl(t);
        }
      }
      function tr(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              $t = r, _u(
                r,
                t
              );
            }
          xu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              wn(8, e, e.return), tr(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, tr(e));
              break;
            default:
              tr(e);
          }
          t = t.sibling;
        }
      }
      function _u(t, e) {
        for (; $t !== null; ) {
          var a = $t;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              wn(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var r = a.memoizedState.cachePool.pool;
                r != null && r.refCount++;
              }
              break;
            case 24:
              La(a.memoizedState.cache);
          }
          if (r = a.child, r !== null) r.return = a, $t = r;
          else
            t: for (a = t; $t !== null; ) {
              r = $t;
              var c = r.sibling, u = r.return;
              if (mu(r), r === a) {
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
      function Ii(t) {
        var e = kp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Dp(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function $i(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case wr:
            if (t.type === e.value) return !0;
            break;
          case _r:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var r = t[a++], c = r.tag, u = t[a++], g = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !ll(r)) {
                  for (; g != null && $i(r, g); )
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
          case kr:
            if ((a === 5 || a === 26 || a === 27) && Up(t.stateNode, e.value))
              return !0;
            break;
          case Er:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Bp(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Sr:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function Pi(t) {
        switch (t.$$typeof) {
          case wr:
            return "<" + (b(t.value) || "Unknown") + ">";
          case _r:
            return ":has(" + (Pi(t) || "") + ")";
          case kr:
            return '[role="' + t.value + '"]';
          case Er:
            return '"' + t.value + '"';
          case Sr:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function ku(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], C = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; C != null && $i(c, C); )
              g++, C = e[g];
            if (g === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return a;
      }
      function to(t, e) {
        if (!al) throw Error(s(363));
        t = Ii(t), t = ku(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var r = t[a++], c = r.tag;
          if (c === 5 || c === 26 || c === 27)
            ll(r) || e.push(r.stateNode);
          else
            for (r = r.child; r !== null; )
              t.push(r), r = r.sibling;
        }
        return e;
      }
      function ye() {
        return (xt & 2) !== 0 && kt !== 0 ? kt & -kt : dt.T !== null ? ci() : Ep();
      }
      function Su() {
        if (ze === 0)
          if ((kt & 536870912) === 0 || St) {
            var t = sr;
            sr <<= 1, (sr & 3932160) === 0 && (sr = 262144), ze = t;
          } else ze = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), ze;
      }
      function pe(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), _n(
          t,
          kt,
          ze,
          !1
        )), R(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (la |= a), Bt === 4 && _n(
          t,
          kt,
          ze,
          !1
        )), Qe(t));
      }
      function Eu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || H(t, e), c = r ? np(t, e) : no(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ha && !r && _n(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !tp(a)) {
              c = no(t, e, !1), u = !1;
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
                  var C = t;
                  c = ml;
                  var Y = ue && C.current.memoizedState.isDehydrated;
                  if (Y && (ga(C, g).flags |= 256), g = no(
                    C,
                    g,
                    !1
                  ), g !== 2) {
                    if (Uo && !Y) {
                      C.errorRecoveryDisabledLanes |= u, la |= u, c = 4;
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
              ga(t, 0), _n(t, e, 0, !0);
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
                  _n(
                    r,
                    e,
                    ze,
                    !Cn
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
              if ((e & 62914560) === e && (c = zr + 300 - he(), 10 < c)) {
                if (_n(
                  r,
                  e,
                  ze,
                  !Cn
                ), N(r, 0, !0) !== 0) break t;
                dn = e, r.timeoutHandle = wp(
                  zu.bind(
                    null,
                    r,
                    a,
                    be,
                    Nr,
                    Go,
                    e,
                    ze,
                    la,
                    Ba,
                    Cn,
                    u,
                    "Throttled",
                    -0,
                    0
                  ),
                  c
                );
                break t;
              }
              zu(
                r,
                a,
                be,
                Nr,
                Go,
                e,
                ze,
                la,
                Ba,
                Cn,
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
      function zu(t, e, a, r, c, u, g, C, Y, W, et, $, lt, gt) {
        if (t.timeoutHandle = Fn, $ = e.subtreeFlags, $ & 8192 || ($ & 16785408) === 16785408) {
          $ = Mp(), yu(
            e,
            u,
            $
          );
          var le = (u & 62914560) === u ? zr - he() : (u & 4194048) === u ? Ad - he() : 0;
          if (le = Ap(
            $,
            le
          ), le !== null) {
            dn = u, t.cancelPendingCommit = le(
              Du.bind(
                null,
                t,
                e,
                u,
                a,
                r,
                c,
                g,
                C,
                Y,
                et,
                $,
                null,
                lt,
                gt
              )
            ), _n(t, u, g, !W);
            return;
          }
        }
        Du(
          t,
          e,
          u,
          a,
          r,
          c,
          g,
          C,
          Y
        );
      }
      function tp(t) {
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
      function _n(t, e, a, r) {
        e &= ~qo, e &= ~la, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - we(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        a !== 0 && x(t, a, e);
      }
      function Nu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function eo() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, on = $n = null, _i(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            ru(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var a = t.timeoutHandle;
        a !== Fn && (t.timeoutHandle = Fn, _p(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), dn = 0, eo(), At = t, wt = a = an(t.current, null), kt = e, Ct = 0, Ee = null, Cn = !1, Ha = H(t, e), Uo = !1, Ba = ze = qo = la = Mn = Bt = 0, be = ml = null, Go = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - we(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return un = e, Hl(), a;
      }
      function Tu(t, e) {
        bt = null, dt.H = dl, e === Ca || e === gr ? (e = Js(), Ct = 3) : e === Mo ? (e = Js(), Ct = 4) : Ct = e === Do ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Ee = e, wt === null && (Bt = 1, Xl(
          t,
          L(e, t.current)
        ));
      }
      function Cu() {
        var t = Se.current;
        return t === null ? !0 : (kt & 4194048) === kt ? Oe === null : (kt & 62914560) === kt || (kt & 536870912) !== 0 ? t === Oe : !1;
      }
      function Mu() {
        var t = dt.H;
        return dt.H = dl, t === null ? dl : t;
      }
      function Au() {
        var t = dt.A;
        return dt.A = t0, t;
      }
      function er() {
        Bt = 4, Cn || (kt & 4194048) !== kt && Se.current !== null || (Ha = !0), (Mn & 134217727) === 0 && (la & 134217727) === 0 || At === null || _n(
          At,
          kt,
          ze,
          !1
        );
      }
      function no(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = Mu(), u = Au();
        (At !== t || kt !== e) && (Nr = null, ga(t, e)), e = !1;
        var g = Bt;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, Y = Ee;
              switch (Ct) {
                case 8:
                  eo(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var W = Ct;
                  if (Ct = 0, Ee = null, ba(t, C, Y, W), a && Ha) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  W = Ct, Ct = 0, Ee = null, ba(t, C, Y, W);
              }
            }
            ep(), g = Bt;
            break;
          } catch (et) {
            Tu(t, et);
          }
        while (!0);
        return e && t.shellSuspendCounter++, on = $n = null, xt = r, dt.H = c, dt.A = u, wt === null && (At = null, kt = 0, Hl()), g;
      }
      function ep() {
        for (; wt !== null; ) ju(wt);
      }
      function np(t, e) {
        var a = xt;
        xt |= 2;
        var r = Mu(), c = Au();
        At !== t || kt !== e ? (Nr = null, pl = he() + 500, ga(t, e)) : Ha = H(
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
                  Ct = 0, Ee = null, ba(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (Xs(u)) {
                    Ct = 0, Ee = null, Ou(e);
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
                  Xs(u) ? (Ct = 0, Ee = null, Ou(e)) : (Ct = 0, Ee = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var g = null;
                  switch (wt.tag) {
                    case 26:
                      g = wt.memoizedState;
                    case 5:
                    case 27:
                      var C = wt, Y = C.type, W = C.pendingProps;
                      if (g ? vd(g) : nd(C.stateNode, Y, W)) {
                        Ct = 0, Ee = null;
                        var et = C.sibling;
                        if (et !== null) wt = et;
                        else {
                          var $ = C.return;
                          $ !== null ? (wt = $, nr($)) : wt = null;
                        }
                        break e;
                      }
                  }
                  Ct = 0, Ee = null, ba(t, e, u, 5);
                  break;
                case 6:
                  Ct = 0, Ee = null, ba(t, e, u, 6);
                  break;
                case 8:
                  eo(), Bt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            ap();
            break;
          } catch (lt) {
            Tu(t, lt);
          }
        while (!0);
        return on = $n = null, dt.H = r, dt.A = c, xt = a, wt !== null ? 0 : (At = null, kt = 0, Hl(), Bt);
      }
      function ap() {
        for (; wt !== null && !Qh(); )
          ju(wt);
      }
      function ju(t) {
        var e = tu(
          t.alternate,
          t,
          un
        );
        t.memoizedProps = t.pendingProps, e === null ? nr(t) : wt = e;
      }
      function Ou(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Jc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              kt
            );
            break;
          case 11:
            e = Jc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              kt
            );
            break;
          case 5:
            _i(e);
          default:
            ru(a, e), e = wt = Qu(e, un), e = tu(a, e, un);
        }
        t.memoizedProps = t.pendingProps, e === null ? nr(t) : wt = e;
      }
      function ba(t, e, a, r) {
        on = $n = null, _i(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Zm(
            t,
            c,
            e,
            a,
            kt
          )) {
            Bt = 1, Xl(
              t,
              L(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Bt = 1, Xl(
            t,
            L(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ha || (kt & 536870912) !== 0 ? t = !1 : (Cn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Ru(e, t)) : nr(e);
      }
      function nr(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Ru(
              e,
              Cn
            );
            return;
          }
          t = e.return;
          var a = Fm(
            e.alternate,
            e,
            un
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
      function Ru(t, e) {
        do {
          var a = Im(t.alternate, t);
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
      function Du(t, e, a, r, c, u, g, C, Y) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Jt !== 0);
        if ((xt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= Ao, h(
            t,
            a,
            u,
            g,
            C,
            Y
          ), t === At && (wt = At = null, kt = 0), Ua = e, jn = t, dn = a, Yo = u, Lo = c, jd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, op(ko, function() {
            return Gu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = rn(), It(2), g = xt, xt |= 4;
            try {
              $m(t, e, a);
            } finally {
              xt = g, It(c), dt.T = r;
            }
          }
          Jt = 1, Hu(), Bu(), Uu();
        }
      }
      function Hu() {
        if (Jt === 1) {
          Jt = 0;
          var t = jn, e = Ua, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = rn();
            It(2);
            var c = xt;
            xt |= 4;
            try {
              gu(e, t), yp(t.containerInfo);
            } finally {
              xt = c, It(r), dt.T = a;
            }
          }
          t.current = e, Jt = 2;
        }
      }
      function Bu() {
        if (Jt === 2) {
          Jt = 0;
          var t = jn, e = Ua, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = rn();
            It(2);
            var c = xt;
            xt |= 4;
            try {
              fu(t, e.alternate, e);
            } finally {
              xt = c, It(r), dt.T = a;
            }
          }
          Jt = 3;
        }
      }
      function Uu() {
        if (Jt === 4 || Jt === 3) {
          Jt = 0, Vh();
          var t = jn, e = Ua, a = dn, r = jd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Jt = 5 : (Jt = 0, Ua = jn = null, qu(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (An = null), A(a), e = e.stateNode, _e && typeof _e.onCommitFiberRoot == "function")
            try {
              _e.onCommitFiberRoot(
                rl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (r !== null) {
            e = dt.T, c = rn(), It(2), dt.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var C = r[g];
                u(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              dt.T = e, It(c);
            }
          }
          (dn & 3) !== 0 && el(), Qe(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === Qo ? hl++ : (hl = 0, Qo = t) : hl = 0, ue && Th(), ma(0);
        }
      }
      function qu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, La(e)));
      }
      function el() {
        return Hu(), Bu(), Uu(), Gu();
      }
      function Gu() {
        if (Jt !== 5) return !1;
        var t = jn, e = Yo;
        Yo = 0;
        var a = A(dn), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = rn();
        try {
          It(r), dt.T = null, r = Lo, Lo = null;
          var u = jn, g = dn;
          if (Jt = 0, Ua = jn = null, dn = 0, (xt & 6) !== 0)
            throw Error(s(331));
          var C = xt;
          if (xt |= 4, wu(u.current), vu(
            u,
            u.current,
            g,
            r
          ), xt = C, ma(0, !1), _e && typeof _e.onPostCommitFiberRoot == "function")
            try {
              _e.onPostCommitFiberRoot(rl, u);
            } catch {
            }
          return !0;
        } finally {
          It(c), dt.T = a, qu(t, e);
        }
      }
      function Yu(t, e, a) {
        e = L(a, e), e = Ri(t.stateNode, e, 2), t = vn(t, e, 2), t !== null && (R(t, 2), Qe(t));
      }
      function zt(t, e, a) {
        if (t.tag === 3)
          Yu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Yu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (An === null || !An.has(r))) {
                t = L(a, t), a = Gc(2), r = vn(e, a, 2), r !== null && (Yc(
                  a,
                  r,
                  e,
                  t
                ), R(r, 2), Qe(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function ao(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new e0();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Uo = !0, c.add(a), t = lp.bind(null, t, e, a), e.then(t, t));
      }
      function lp(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (kt & a) === a && (Bt === 4 || Bt === 3 && (kt & 62914560) === kt && 300 > he() - zr ? (xt & 2) === 0 && ga(t, 0) : qo |= a, Ba === kt && (Ba = 0)), Qe(t);
      }
      function Lu(t, e) {
        e === 0 && (e = X()), t = Kn(t, e), t !== null && (R(t, e), Qe(t));
      }
      function rp(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Lu(t, a);
      }
      function ip(t, e) {
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
        r !== null && r.delete(e), Lu(t, a);
      }
      function op(t, e) {
        return ur(t, e);
      }
      function sp(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function lo(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function an(t, e) {
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
      function Qu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function ar(t, e, a, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") lo(t) && (g = 1);
        else if (typeof t == "string")
          g = Ge && Zt ? fd(t, a, ne.current) ? 26 : wd(t) ? 27 : 5 : Ge ? fd(
            t,
            a,
            ne.current
          ) ? 26 : 5 : Zt && wd(t) ? 27 : 5;
        else
          t: switch (t) {
            case ho:
              return t = i(31, a, e, c), t.elementType = ho, t.lanes = u, t;
            case ya:
              return Wn(
                a.children,
                c,
                u,
                e
              );
            case Fu:
              g = 8, c |= 24;
              break;
            case co:
              return t = i(12, a, e, c | 2), t.elementType = co, t.lanes = u, t;
            case fo:
              return t = i(13, a, e, c), t.elementType = fo, t.lanes = u, t;
            case mo:
              return t = i(19, a, e, c), t.elementType = mo, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case kn:
                    g = 10;
                    break t;
                  case Iu:
                    g = 9;
                    break t;
                  case uo:
                    g = 11;
                    break t;
                  case po:
                    g = 14;
                    break t;
                  case Sn:
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
      function Wn(t, e, a, r) {
        return t = i(7, t, r, e), t.lanes = a, t;
      }
      function ro(t, e, a) {
        return t = i(6, t, null, e), t.lanes = a, t;
      }
      function Vu(t) {
        var e = i(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function io(t, e, a) {
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
      function cp(t, e, a, r, c, u, g, C, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Fn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Ku(t, e, a, r, c, u, g, C, Y, W, et, $) {
        return t = new cp(
          t,
          e,
          a,
          g,
          Y,
          W,
          et,
          $,
          C
        ), e = 1, u === !0 && (e |= 24), u = i(3, null, null, e), t.current = u, u.stateNode = t, e = si(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, fi(u), t;
      }
      function Xu(t) {
        return t ? (t = ka, t) : ka;
      }
      function Zu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Ju(t, e, a, r, c, u) {
        c = Xu(c), r.context === null ? r.context = c : r.pendingContext = c, r = bn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = vn(t, r, e), a !== null && (pe(a, t, e), Va(a, t, e));
      }
      function Wu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function oo(t, e) {
        Wu(t, e), (t = t.alternate) && Wu(t, e);
      }
      var yt = {}, up = M0, xe = j0(), so = Object.assign, dp = Symbol.for("react.element"), lr = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Fu = Symbol.for("react.strict_mode"), co = Symbol.for("react.profiler"), Iu = Symbol.for("react.consumer"), kn = Symbol.for("react.context"), uo = Symbol.for("react.forward_ref"), fo = Symbol.for("react.suspense"), mo = Symbol.for("react.suspense_list"), po = Symbol.for("react.memo"), Sn = Symbol.for("react.lazy"), ho = Symbol.for("react.activity"), fp = Symbol.for("react.memo_cache_sentinel"), $u = Symbol.iterator, mp = Symbol.for("react.client.reference"), rr = Array.isArray, dt = up.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, pp = l.rendererVersion, hp = l.rendererPackageName, Pu = l.extraDevToolsConfig, nl = l.getPublicInstance, gp = l.getRootHostContext, bp = l.getChildHostContext, vp = l.prepareForCommit, yp = l.resetAfterCommit, xp = l.createInstance;
      l.cloneMutableInstance;
      var go = l.appendInitialChild, td = l.finalizeInitialChildren, ir = l.shouldSetTextContent, ed = l.createTextInstance;
      l.cloneMutableTextInstance;
      var wp = l.scheduleTimeout, _p = l.cancelTimeout, Fn = l.noTimeout, ln = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ce = l.supportsMutation, Ke = l.supportsPersistence, ue = l.supportsHydration, kp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Sp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var It = l.setCurrentUpdatePriority, rn = l.getCurrentUpdatePriority, Ep = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var zp = l.shouldAttemptEagerTransition, Np = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Tp = l.maySuspendCommit, Cp = l.maySuspendCommitOnUpdate, bo = l.maySuspendCommitInSyncRender, nd = l.preloadInstance, Mp = l.startSuspendingCommit, ad = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Ap = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, In = l.HostTransitionContext, jp = l.resetFormInstance;
      l.bindToConsole;
      var Op = l.supportsMicrotasks, Rp = l.scheduleMicrotask, al = l.supportsTestSelectors, Dp = l.findFiberRoot, Hp = l.getBoundingRect, Bp = l.getTextContent, ll = l.isHiddenSubtree, Up = l.matchAccessibilityRole, qp = l.setFocusIfFocusable, Gp = l.setupIntersectionObserver, Yp = l.appendChild, Lp = l.appendChildToContainer, Qp = l.commitTextUpdate, Vp = l.commitMount, Kp = l.commitUpdate, Xp = l.insertBefore, Zp = l.insertInContainerBefore, Jp = l.removeChild, Wp = l.removeChildFromContainer, ld = l.resetTextContent, Fp = l.hideInstance, Ip = l.hideTextInstance, $p = l.unhideInstance, Pp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var th = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var eh = l.cloneInstance, rd = l.createContainerChildSet, id = l.appendChildToContainerChildSet, nh = l.finalizeContainerChildren, od = l.replaceContainerChildren, sd = l.cloneHiddenInstance, cd = l.cloneHiddenTextInstance, vo = l.isSuspenseInstancePending, yo = l.isSuspenseInstanceFallback, ah = l.getSuspenseInstanceFallbackErrorDetails, lh = l.registerSuspenseInstanceRetry, rh = l.canHydrateFormStateMarker, ih = l.isFormStateMarkerMatching, ud = l.getNextHydratableSibling, oh = l.getNextHydratableSiblingAfterSingleton, sh = l.getFirstHydratableChild, ch = l.getFirstHydratableChildWithinContainer, uh = l.getFirstHydratableChildWithinActivityInstance, dh = l.getFirstHydratableChildWithinSuspenseInstance, fh = l.getFirstHydratableChildWithinSingleton, mh = l.canHydrateInstance, ph = l.canHydrateTextInstance, hh = l.canHydrateActivityInstance, gh = l.canHydrateSuspenseInstance, bh = l.hydrateInstance, vh = l.hydrateTextInstance, yh = l.hydrateActivityInstance, xh = l.hydrateSuspenseInstance, wh = l.getNextHydratableInstanceAfterActivityInstance, _h = l.getNextHydratableInstanceAfterSuspenseInstance, kh = l.commitHydratedInstance, Sh = l.commitHydratedContainer, Eh = l.commitHydratedActivityInstance, zh = l.commitHydratedSuspenseInstance, Nh = l.finalizeHydratedChildren, Th = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var Ch = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var Mh = l.clearSuspenseBoundaryFromContainer, Ah = l.hideDehydratedBoundary, jh = l.unhideDehydratedBoundary, dd = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Oh = l.validateHydratableInstance, Rh = l.validateHydratableTextInstance, Ge = l.supportsResources, fd = l.isHostHoistableType, xo = l.getHoistableRoot, md = l.getResource, pd = l.acquireResource, hd = l.releaseResource, Dh = l.hydrateHoistable, gd = l.mountHoistable, bd = l.unmountHoistable, Hh = l.createHoistableInstance, Bh = l.prepareToCommitHoistables, Uh = l.mayResourceSuspendCommit, vd = l.preloadResource, qh = l.suspendResource, Zt = l.supportsSingletons, yd = l.resolveSingletonInstance, Gh = l.acquireSingletonInstance, xd = l.releaseSingletonInstance, wd = l.isHostSingletonType, wa = l.isSingletonScope, wo = [], _a = -1, ka = {}, we = Math.clz32 ? Math.clz32 : z, Yh = Math.log, Lh = Math.LN2, or = 256, sr = 262144, cr = 4194304, ur = xe.unstable_scheduleCallback, _o = xe.unstable_cancelCallback, Qh = xe.unstable_shouldYield, Vh = xe.unstable_requestPaint, he = xe.unstable_now, _d = xe.unstable_ImmediatePriority, Kh = xe.unstable_UserBlockingPriority, ko = xe.unstable_NormalPriority, Xh = xe.unstable_IdlePriority, Zh = xe.log, Jh = xe.unstable_setDisableYieldValue, rl = null, _e = null, ke = typeof Object.is == "function" ? Object.is : K, kd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Wh = Object.prototype.hasOwnProperty, So, Sd, Eo = !1, Ed = /* @__PURE__ */ new WeakMap(), Sa = [], Ea = 0, dr = null, il = 0, Ce = [], Me = 0, En = null, Xe = 1, Ze = "", ne = v(null), ol = v(null), zn = v(null), fr = v(null), ae = null, Ot = null, St = !1, Nn = null, Ae = !1, zo = Error(s(519)), mr = v(null), $n = null, on = null, Fh = typeof AbortController < "u" ? AbortController : function() {
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
      }, Ih = xe.unstable_scheduleCallback, $h = xe.unstable_NormalPriority, Rt = {
        $$typeof: kn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, pr = null, za = null, No = !1, hr = !1, To = !1, Pn = 0, sl = null, Co = 0, Na = 0, Ta = null, zd = dt.S;
      dt.S = function(t, e) {
        Ad = he(), typeof e == "object" && e !== null && typeof e.then == "function" && qm(t, e), zd !== null && zd(t, e);
      };
      var ta = v(null), Ca = Error(s(460)), Mo = Error(s(474)), gr = Error(s(542)), br = { then: function() {
      } }, ea = null, Ma = null, cl = 0, na = Fs(!0), Nd = Fs(!1), je = [], Aa = 0, Ao = 0, Tn = !1, jo = !1, ja = v(null), vr = v(0), Se = v(null), Oe = null, Gt = v(0), sn = 0, bt = null, Mt = null, Yt = null, yr = !1, Oa = !1, aa = !1, xr = 0, ul = 0, Ra = null, Ph = 0, dl = {
        readContext: te,
        use: Yl,
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
      dl.useEffectEvent = Ht;
      var Td = {
        readContext: te,
        use: Yl,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: te,
        useEffect: wc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Ql(
            4194308,
            4,
            Ec.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Ql(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Ql(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = fe();
          e = e === void 0 ? null : e;
          var r = t();
          if (aa) {
            B(!0);
            try {
              t();
            } finally {
              B(!1);
            }
          }
          return a.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, a) {
          var r = fe();
          if (a !== void 0) {
            var c = a(e);
            if (aa) {
              B(!0);
              try {
                a(e);
              } finally {
                B(!1);
              }
            }
          } else c = e;
          return r.memoizedState = r.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, r.queue = t, t = t.dispatch = Xm.bind(
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
          t = zi(t);
          var e = t.queue, a = Rc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Ci,
        useDeferredValue: function(t, e) {
          var a = fe();
          return Mi(a, t, e);
        },
        useTransition: function() {
          var t = zi(!1);
          return t = Mc.bind(
            null,
            bt,
            t.queue,
            !0,
            !1
          ), fe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var r = bt, c = fe();
          if (St) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), At === null)
              throw Error(s(349));
            (kt & 127) !== 0 || rc(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, wc(oc.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            ic.bind(
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
          if (St) {
            var a = Ze, r = Xe;
            a = (r & ~(1 << 32 - we(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = xr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Ph++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ai,
        useFormState: gc,
        useActionState: gc,
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
          return e.queue = a, e = ji.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: ki,
        useCacheRefresh: function() {
          return fe().memoizedState = Km.bind(
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
      }, Oo = {
        readContext: te,
        use: Yl,
        useCallback: Nc,
        useContext: te,
        useEffect: Ti,
        useImperativeHandle: zc,
        useInsertionEffect: kc,
        useLayoutEffect: Sc,
        useMemo: Tc,
        useReducer: Ll,
        useRef: xc,
        useState: function() {
          return Ll(Pe);
        },
        useDebugValue: Ci,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Cc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ll(Pe)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: lc,
        useId: jc,
        useHostTransitionStatus: Ai,
        useFormState: bc,
        useActionState: bc,
        useOptimistic: function(t, e) {
          var a = qt();
          return uc(a, Mt, t, e);
        },
        useMemoCache: ki,
        useCacheRefresh: Oc
      };
      Oo.useEffectEvent = _c;
      var Cd = {
        readContext: te,
        use: Yl,
        useCallback: Nc,
        useContext: te,
        useEffect: Ti,
        useImperativeHandle: zc,
        useInsertionEffect: kc,
        useLayoutEffect: Sc,
        useMemo: Tc,
        useReducer: Ei,
        useRef: xc,
        useState: function() {
          return Ei(Pe);
        },
        useDebugValue: Ci,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Mt === null ? Mi(a, t, e) : Cc(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ei(Pe)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: lc,
        useId: jc,
        useHostTransitionStatus: Ai,
        useFormState: yc,
        useActionState: yc,
        useOptimistic: function(t, e) {
          var a = qt();
          return Mt !== null ? uc(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: ki,
        useCacheRefresh: Oc
      };
      Cd.useEffectEvent = _c;
      var Ro = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = bn(r);
          c.payload = e, a != null && (c.callback = a), e = vn(t, c, r), e !== null && (pe(e, t, r), Va(e, t, r));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var r = ye(), c = bn(r);
          c.tag = 1, c.payload = e, a != null && (c.callback = a), e = vn(t, c, r), e !== null && (pe(e, t, r), Va(e, t, r));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = ye(), r = bn(a);
          r.tag = 2, e != null && (r.callback = e), e = vn(t, r, a), e !== null && (pe(e, t, a), Va(e, t, a));
        }
      }, Do = Error(s(461)), Lt = !1, Ho = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, cn = !1, Qt = !1, Bo = !1, Md = typeof WeakSet == "function" ? WeakSet : Set, $t = null, Vt = null, ge = !1, Ye = null, Da = 8192, t0 = {
        getCacheForType: function(t) {
          var e = te(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return te(Rt).controller.signal;
        }
      }, wr = 0, _r = 1, kr = 2, Sr = 3, Er = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        wr = fl("selector.component"), _r = fl("selector.has_pseudo_class"), kr = fl("selector.role"), Sr = fl("selector.test_id"), Er = fl("selector.text");
      }
      var e0 = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, kt = 0, Ct = 0, Ee = null, Cn = !1, Ha = !1, Uo = !1, un = 0, Bt = 0, Mn = 0, la = 0, qo = 0, ze = 0, Ba = 0, ml = null, be = null, Go = !1, zr = 0, Ad = 0, pl = 1 / 0, Nr = null, An = null, Jt = 0, jn = null, Ua = null, dn = 0, Yo = 0, Lo = null, jd = null, hl = 0, Qo = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Kn(t, 67108864);
          e !== null && pe(e, t, 67108864), oo(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ye();
          e = O(e);
          var a = Kn(t, e);
          a !== null && pe(a, t, e), oo(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = _(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - we(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Qe(t), (xt & 6) === 0 && (pl = he() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Kn(t, 2), e !== null && pe(e, t, 2), Nu(), oo(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: wr, value: t };
      }, yt.createContainer = function(t, e, a, r, c, u, g, C, Y, W) {
        return Ku(
          t,
          e,
          !1,
          null,
          a,
          r,
          u,
          null,
          g,
          C,
          Y,
          W
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: _r, value: t };
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, g, C, Y, W, et, $, lt, gt) {
        return t = Ku(
          a,
          r,
          !0,
          t,
          c,
          u,
          C,
          gt,
          Y,
          W,
          et,
          $
        ), t.context = Xu(null), a = t.current, r = ye(), r = O(r), c = bn(r), c.callback = e ?? null, vn(a, c, r), e = r, t.current.lanes = e, R(t, e), Qe(t), t;
      }, yt.createPortal = function(t, e, a) {
        var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: va,
          key: r == null ? null : "" + r,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, yt.createRoleSelector = function(t) {
        return { $$typeof: kr, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: Sr, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: Er, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        kd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        kd(t);
      }, yt.deferredUpdates = function(t) {
        var e = dt.T, a = rn();
        try {
          return It(32), dt.T = null, t();
        } finally {
          It(a), dt.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = dt.T, g = rn();
        try {
          return It(2), dt.T = null, t(e, a, r, c);
        } finally {
          It(g), dt.T = u, xt === 0 && (pl = he() + 500);
        }
      }, yt.findAllNodes = to, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(s(363));
        e = to(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Hp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, g = u + a.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var Y = t[C], W = Y.x, et = W + Y.width, $ = Y.y, lt = $ + Y.height;
              if (r >= W && u >= $ && c <= et && g <= lt) {
                t.splice(e, 1);
                break;
              } else if (r !== W || a.width !== Y.width || lt < u || $ > g) {
                if (!(u !== $ || a.height !== Y.height || et < r || W > c)) {
                  W > r && (Y.width += W - r, Y.x = r), et < c && (Y.width = c - W), t.splice(e, 1);
                  break;
                }
              } else {
                $ > u && (Y.height += $ - u, Y.y = u), lt < g && (Y.height = g - $), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Zu, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? y(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Zu(t);
      }, yt.flushPassiveEffects = el, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = dt.T, r = rn();
        try {
          if (It(2), dt.T = null, t)
            return t();
        } finally {
          It(r), dt.T = a, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = Nu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(s(363));
        for (t = Ii(t), e = ku(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!ll(a)) {
            if ((r === 5 || r === 26 || r === 27) && qp(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!al) throw Error(s(363));
        var a = 0, r = [];
        t = [Ii(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, C = t[c++], Y = e[C];
          if ((g !== 5 && g !== 26 && g !== 27 || !ll(u)) && ($i(u, Y) && (r.push(Pi(Y)), C++, C > a && (a = C)), C < e.length))
            for (u = u.child; u !== null; )
              t.push(u, C), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Pi(e[a]));
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
            return nl(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, yt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: pp,
          rendererPackageName: hp,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (Pu !== null && (t.rendererConfig = Pu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              rl = e.inject(t), _e = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, yt.isAlreadyRendering = function() {
        return (xt & 6) !== 0;
      }, yt.observeVisibleRects = function(t, e, a, r) {
        if (!al) throw Error(s(363));
        t = to(t, e);
        var c = Gp(
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
        var c = Ac(t).queue;
        Mc(
          t,
          c,
          e,
          xa,
          a === null ? o : function() {
            var u = Ac(t);
            return u.next === null && (u = t.alternate.memoizedState), Ja(
              t,
              u.next.queue,
              {},
              ye()
            ), a(r);
          }
        );
      }, yt.updateContainer = function(t, e, a, r) {
        var c = e.current, u = ye();
        return Ju(
          c,
          u,
          t,
          e,
          a,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, a, r) {
        return Ju(
          e.current,
          2,
          t,
          e,
          a,
          r
        ), 2;
      }, yt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Zo)), Zo.exports;
}
var Kd;
function R0() {
  return Kd || (Kd = 1, Xo.exports = O0()), Xo.exports;
}
var D0 = R0();
const H0 = /* @__PURE__ */ Es(D0);
var Fo = { exports: {} }, fn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Xd;
function B0() {
  return Xd || (Xd = 1, fn.ConcurrentRoot = 1, fn.ContinuousEventPriority = 8, fn.DefaultEventPriority = 32, fn.DiscreteEventPriority = 2, fn.IdleEventPriority = 268435456, fn.LegacyRoot = 0, fn.NoEventPriority = 0), fn;
}
var Zd;
function U0() {
  return Zd || (Zd = 1, Fo.exports = B0()), Fo.exports;
}
var El = U0();
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
const qf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], os = 16, zs = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), q0 = [
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
], Jd = {
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
}, G0 = /* @__PURE__ */ new Set([
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
]), Gf = {
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
}, Yf = {
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
}, ss = ["font-size", "color", ...new Set([...Object.keys(Gf), ...Object.keys(Yf)].filter((n) => n !== "font-size" && n !== "color"))], Y0 = new Set(ss);
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
function cs(n, l, i = 0) {
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
    const p = n.slice(d + 4, f - 1), y = ie(p, ","), k = y[0].trim(), b = y.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let v = l(k);
    if ((v == null || v === "initial") && (v = b), v == null) return null;
    const S = cs(v, l, i + 1);
    if (S === null) return null;
    o += S, s = f;
  }
}
function L0(n) {
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
function qn(n, l) {
  const i = L0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!i) return null;
  let o = 0;
  const s = ({ num: v, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: v, unitless: !0 };
      case "px":
        return { px: v, pct: 0, num: 0 };
      case "rem":
        return { px: v * os, pct: 0, num: 0 };
      case "em":
        return { px: v * (l.fontSize ?? os), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: v, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: v / 100 * (l.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: v / 100 * (l.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: v * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (v, S, E) => v && S ? { px: v.px + E * S.px, pct: v.pct + E * S.pct, num: v.num + E * S.num, unitless: v.unitless && S.unitless } : null, m = (v, S) => v ? { px: v.px * S, pct: v.pct * S, num: v.num * S, unitless: v.unitless } : null, f = (v) => v && v.unitless;
  function p() {
    const v = i[o++];
    if (!v) return null;
    if (v.num !== void 0) return s(v);
    if (v.op === "(") {
      const S = k();
      return i[o]?.op !== ")" ? null : (o++, S);
    }
    if (v.op === "-" || v.op === "+") {
      const S = p();
      return v.op === "-" ? m(S, -1) : S;
    }
    if (v.fn) {
      const S = [];
      for (; ; ) {
        S.push(k());
        const _ = i[o++];
        if (!_) return null;
        if (_.op === ")") break;
        if (_.op !== ",") return null;
      }
      if (S.some((_) => !_)) return null;
      if (v.fn === "calc") return S[0];
      if (!(S.every((_) => !_.pct) || S.every((_) => !_.px && !_.num))) return null;
      const z = (_) => _.px + _.pct + _.num;
      return v.fn === "min" ? S.reduce((_, N) => z(N) < z(_) ? N : _) : v.fn === "max" ? S.reduce((_, N) => z(N) > z(_) ? N : _) : v.fn === "clamp" && S.length === 3 ? z(S[1]) < z(S[0]) ? S[0] : z(S[1]) > z(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function y() {
    let v = p();
    for (; i[o] && (i[o].op === "*" || i[o].op === "/"); ) {
      const S = i[o++].op, E = p();
      if (!v || !E) return null;
      S === "*" ? v = f(E) ? m(v, E.num) : f(v) ? m(E, v.num) : null : v = f(E) && E.num !== 0 ? m(v, 1 / E.num) : null;
    }
    return v;
  }
  function k() {
    let v = y();
    for (; i[o] && (i[o].op === "+" || i[o].op === "-"); ) {
      const S = i[o++].op;
      v = d(v, y(), S === "-" ? -1 : 1);
    }
    return v;
  }
  const b = k();
  return o !== i.length || !b ? null : b;
}
function us(n, l) {
  const i = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(i))
    return i === "thin" ? { px: 1 } : i === "medium" ? { px: 3 } : i === "thick" ? { px: 5 } : i;
  const o = qn(i, l);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: n.trim() } : o.pct && (o.px || o.num) ? { expr: n.trim() } : o.pct ? { pct: o.pct } : { px: Q0(o.px) } : { expr: n.trim() };
}
const Q0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Cr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), V0 = ([n, l, i, o]) => `#${Cr(n)}${Cr(l)}${Cr(i)}${Cr(o * 255)}`;
function Wd(n) {
  const l = n.slice(1), i = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return null;
  const o = (s) => parseInt(i.slice(s, s + 2), 16);
  return [o(0), o(2), o(4), i.length === 8 ? o(6) / 255 : 1];
}
function Xr(n, l) {
  const i = n.trim().toLowerCase();
  if (i === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(i);
  if (o) {
    const y = l(o[1]), k = y && Wd(y);
    return k ? { rgba: k, token: o[1] } : null;
  }
  if (i.startsWith("#")) {
    const y = Wd(i);
    return y ? { rgba: y, token: null } : null;
  }
  if (Jd[i]) return { rgba: [...Jd[i]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(i);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = ie(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const k = (B) => {
      const K = ie(B), F = K.findIndex((I) => /%$/.test(I)), Q = F >= 0 ? parseFloat(K[F]) / 100 : null;
      return { color: Xr(K.filter((I, L) => L !== F).join(" "), l), pct: Q };
    }, b = k(y[1]), v = k(y[2]);
    if (!b.color || !v.color || b.color === "currentcolor" || v.color === "currentcolor") return null;
    let S = b.pct, E = v.pct;
    S === null && E === null ? (S = 0.5, E = 0.5) : S === null ? S = 1 - E : E === null && (E = 1 - S);
    const z = S + E, _ = z < 1 ? z : 1;
    S /= z, E /= z;
    const [N, H, j, X] = b.color.rgba, [q, R, h, x] = v.color.rgba, w = X * S + x * E, M = (B, K) => w === 0 ? 0 : (B * X * S + K * x * E) / w, O = [M(N, q), M(H, R), M(j, h), w * _], A = x === 0 ? b.color.token : X === 0 ? v.color.token : null;
    return { rgba: O, token: A };
  }
  const d = s[2].includes(",") ? ie(s[2], ",") : ie(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const m = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), p = [m(d[0]), m(d[1]), m(d[2]), f];
  return p.some((y) => Number.isNaN(y)) ? null : { rgba: p, token: null };
}
const xl = ["top", "right", "bottom", "left"], K0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Mr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Fd = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function ds(n, l) {
  const i = l.trim(), o = () => ie(i);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Mr(o());
      return xl.map((d, m) => [`${n}-${d}`, s[m]]);
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
      const s = Mr(o());
      return xl.map((d, m) => [d, s[m]]);
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
      const s = n.split("-")[1], d = Mr(o());
      return xl.map((m, f) => [`border-${m}-${s}`, d[f]]);
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
      const s = n === "border" ? xl : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", m = "none", f = "currentcolor";
      if (i !== "none" && i !== "0")
        for (const p of o())
          Fd.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? d = p : f = p;
      else i === "0" && (d = "0");
      return s.flatMap((p) => [[`border-${p}-width`, d], [`border-${p}-style`, m], [`border-${p}-color`, f]]);
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
      const s = Mr(ie(i.split("/")[0]));
      return K0.map((d, m) => [`border-${d}-radius`, s[m]]);
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
      return i === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Xr(i, () => "#000000") ? [["background-color", i], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", i]];
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
      return ds("gap", i);
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
        Fd.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
      return [["outline-width", s], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (i === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ie(i, ","), d = s.map((f) => ie(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = s.map((f) => ie(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
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
function X0(n, l) {
  return n ? ie(n, ",").some((i) => {
    let o = i.trim().toLowerCase(), s = !1;
    o.startsWith("not ") && (s = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const d = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (y) {
        const [, b, v] = y, S = (E) => {
          const z = us(E, { viewport: l });
          return typeof z == "object" && "px" in z ? z.px : NaN;
        };
        switch (b) {
          case "min-width":
            return l.width >= S(v);
          case "max-width":
            return l.width <= S(v);
          case "min-height":
            return l.height >= S(v);
          case "max-height":
            return l.height <= S(v);
          case "hover":
          case "any-hover":
            return v.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return v.trim() === "fine";
          case "prefers-reduced-motion":
            return v.trim() === "no-preference";
          case "prefers-color-scheme":
            return v.trim() === (l.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const k = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (k) {
        const b = k[1] === "width" ? l.width : l.height, v = us(k[3], { viewport: l }), S = typeof v == "object" && "px" in v ? v.px : NaN;
        switch (k[2]) {
          case ">=":
            return b >= S;
          case "<=":
            return b <= S;
          case ">":
            return b > S;
          case "<":
            return b < S;
          default:
            return b === S;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function Z0(n, l) {
  const i = l[l.length - 1].compound;
  return Ns(i)[0] ?? n;
}
function J0(n) {
  const l = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = (s, d) => {
    s.forEach(({ compound: m }, f) => {
      const p = d && f === s.length - 1;
      for (const y of m.pseudos)
        if (zs.has(y.name) && (p ? l : i).add(y.name), y.list && y.name !== "not") for (const k of y.list) o(k, p);
    });
  };
  return o(n, !0), { subject: l, ancestor: i };
}
function Ns(n) {
  const l = [...n.classes];
  for (const i of n.pseudos)
    if (!(i.name !== "is" && i.name !== "where"))
      for (const o of i.list) o.length === 1 && l.push(...Ns(o[0].compound));
  return l;
}
function W0(n, l) {
  const i = (o, s) => {
    o.forEach(({ compound: d }, m) => {
      const f = s && m === o.length - 1, p = d.pseudos.filter((y) => zs.has(y.name)).map((y) => y.name);
      if (!f) for (const y of p) for (const k of Ns(d)) l.add(`${y}:${k}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const k of y.list) i(k, f);
    });
  };
  i(n, !0);
}
class F0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const i = (d, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(d);
    };
    let o = 0;
    const s = (d, m) => {
      for (const [f, p, y, k] of d)
        for (const b of _s(f)) {
          let v;
          try {
            v = ks(b);
          } catch (_) {
            if (_ instanceof re) {
              this.skipped++;
              continue;
            }
            throw _;
          }
          const S = J0(v);
          W0(v, this.trackedStates);
          const E = v[v.length - 1].compound.pseudoElement, z = { steps: v, media: p, layer: y, origin: m, order: o++, specificity: Cf(v), decls: k, states: S, pseudo: E, own: tg(v), above: $0(v), source: m === 0 ? `ua:${v[v.length - 1].compound.tag ?? "*"}` : Z0(b, v) };
          this.rules.push(z), i(z, v);
        }
    };
    s(q0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(l, i = null) {
    const o = `${l.tagName} ${l.className}|${i ?? ""}`, s = this.candidateCache.get(o);
    if (s) return s;
    const d = [], m = /* @__PURE__ */ new Set(), f = (p) => {
      if (p) for (const y of p) !m.has(y) && y.pseudo === i && (m.add(y), d.push(y));
    };
    for (const p of l.classList) f(this.index.get(`.${p}`));
    return f(this.index.get(l.tagName)), f(this.index.get("*")), this.candidateCache.set(o, d), d;
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
        const p = f.reads ??= Qf(f.steps);
        o.anc ||= p.anc, o.pos ||= p.pos, o.nth ||= p.nth, o.ancPos ||= p.ancPos;
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
const I0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function $0(n) {
  const l = [];
  for (let i = n.length - 1; i > 0 && !(n[i].combinator !== " " && n[i].combinator !== ">"); i--)
    l.push(...n[i - 1].compound.classes);
  return l;
}
function Lf(n) {
  const l = n.parentElement;
  if (!l) return P0;
  const i = Lf(l), o = n.aboveCache;
  if (o && o.parent === l && o.name === l.className && o.base === i) return o.set;
  const s = l.classSet, d = s.size === 0 ? i : /* @__PURE__ */ new Set([...i, ...s]);
  return n.aboveCache = { parent: l, name: l.className, base: i, set: d }, d;
}
const P0 = /* @__PURE__ */ new Set();
function tg(n) {
  if (n.length !== 1) return !1;
  const { compound: l } = n[0];
  return !l.id && !l.attrs.length && l.pseudos.every((i) => zs.has(i.name) && i.name !== "focus-within");
}
function Qf(n, l = !0, i = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((o, s) => {
    const d = l && s === n.length - 1;
    d || (i.anc = !0);
    for (const m of o.compound.pseudos)
      if (I0.has(m.name) && (d ? i.pos = !0 : i.ancPos = !0, m.name === "nth-child" && d && (i.nth = !0)), m.list && m.name !== "has") for (const f of m.list) Qf(f, d, i);
  }), i;
}
const eg = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function ng(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [i, o] of Object.entries(n)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const s = i.startsWith("--") ? i : i.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof o == "number" && o !== 0 && !eg.has(s) && !s.startsWith("--") ? `${o}px` : String(o);
    l.push([s, d]);
  }
  return l;
}
function ag(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const i of ["width", "height"]) {
    const o = n.getAttribute(i);
    o !== null && l.push([i, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return l;
}
const lg = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class rg {
  constructor(l, { theme: i, viewport: o }) {
    this.sheet = l, this.theme = i, this.viewport = o, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(l) {
    if (!l.media) return !0;
    for (const i of l.media) {
      let o = this.media.get(i);
      if (o === void 0 && this.media.set(i, o = X0(i, this.viewport)), !o) return !1;
    }
    return !0;
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, i, o = null) {
    const d = { state: (b, v, S) => {
      if (v === "disabled") return !!b.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(b.tagName);
      if (v === "enabled") return !b.props?.disabled && ["button", "input", "select", "textarea"].includes(b.tagName);
      if (v === "checked") return !!b.props?.checked;
      if (i === "*") return !0;
      if (v === "focus-within") {
        const E = b.ownerDocument?.activeElement;
        return !!E && E !== b.ownerDocument.body && typeof b.contains == "function" && b.contains(E);
      }
      return S ? i.has(v) : v === "focus-visible" ? !!b.state?.focus && !b.state?.pointerFocus : !!b.state?.[v];
    }, pseudo: o }, m = this.sheet.candidates(l, o), f = `${l.tagName} ${l.className}|${o ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let p = this.ownMatches.get(f);
    p || (p = new Set(m.filter((b) => b.own && this.mediaHolds(b) && ns(l, b.steps, d))), this.ownMatches.set(f, p));
    let y = null;
    const k = (b) => b.above.length ? (y ??= Lf(l), b.above.every((v) => y.has(v))) : !0;
    return m.filter((b) => b.own ? p.has(b) : this.mediaHolds(b) && k(b) && ns(l, b.steps, d));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, i, o = /* @__PURE__ */ new Set(), s = null) {
    const d = this.matching(l, o, s), m = s ? [] : ag(l), f = s ? [] : ng(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    i && (p = this.computed.get(i.values), p || this.computed.set(i.values, p = /* @__PURE__ */ new Map()));
    const y = `${d.map((b) => b.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${f.length ? JSON.stringify(f) : ""}`;
    let k = p.get(y);
    return k || p.set(y, k = this.cascade(d, m, f, i)), { ...k, rules: d, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, i, o, s) {
    const d = [];
    for (const h of l)
      for (const [x, w, M] of h.decls) d.push({ prop: x, value: w, important: M ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, x] of i) d.push({ prop: h, value: x, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, x] of o) d.push({ prop: h, value: x, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(lg);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const h of d) h.prop.startsWith("--") && y.set(h.prop, h.value);
    if (!s && this.theme) for (const h of qf) this.theme[h] && y.set(`--${h}`, `perchtoken(${h})`);
    const k = (h) => {
      if (p.has(h)) return p.get(h);
      const x = m[h];
      return x && !x.inherits ? x.initial ?? null : h in f ? f[h] : x?.initial ?? null;
    }, b = /* @__PURE__ */ new Set(), v = (h) => {
      if (!y.has(h)) return k(h);
      if (b.has(h)) return null;
      b.add(h);
      const x = cs(y.get(h), v);
      return b.delete(h), y.delete(h), p.set(h, x), (!m[h] || m[h].inherits) && (f[h] = x), x;
    };
    for (const h of [...y.keys()]) v(h);
    const S = /* @__PURE__ */ new Map();
    for (const h of d) {
      if (h.prop.startsWith("--")) continue;
      const x = cs(h.value, k);
      if (x === null) {
        for (const [w] of ds(h.prop, "unset")) S.set(w, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [w, M] of ds(h.prop, x)) S.set(w, { value: M, source: h.source, origin: h.origin });
    }
    const E = {}, z = {}, _ = /* @__PURE__ */ new Set(), N = /* @__PURE__ */ new Set(), H = s?.values, j = { fontSize: H?.["font-size"] ?? os, viewport: this.viewport }, X = (h, x) => {
      if (/currentcolor/i.test(x)) return this.parseValue(h, x, j, E, H);
      const w = `${h}\0${x}\0${j.fontSize}`;
      let M = this.parsed.get(w);
      return M === void 0 && this.parsed.set(w, M = this.parseValue(h, x, j, E, H)), M;
    }, q = S.size ? [...ss, ...[...S.keys()].filter((h) => !Y0.has(h))] : ss;
    for (const h of q) {
      const x = S.get(h);
      let w = x?.value;
      const M = G0.has(h);
      if ((w === void 0 || w === "unset" || w === "revert" || w === "revert-layer") && (w = M ? "inherit" : "initial"), x && (z[h] = x.source, x.origin !== 0 && _.add(h)), w === "inherit" && H && h in H) {
        E[h] = H[h], N.add(h);
        continue;
      }
      (w === "inherit" || w === "initial") && (w = M ? Yf[h] : Gf[h]), E[h] = X(h, w), h === "font-size" && (j.fontSize = E["font-size"]);
    }
    for (const h of xl) {
      const x = E[`border-${h}-style`];
      (x === "none" || x === "hidden") && (E[`border-${h}-width`] = { px: 0 });
    }
    E["outline-style"] === "none" && (E["outline-width"] = { px: 0 });
    const R = H?.display;
    return (R === "flex" || R === "inline-flex" || R === "grid" || R === "inline-grid") && E.position !== "absolute" && E.position !== "fixed" && (E.display = Id(E.display)), (E.position === "absolute" || E.position === "fixed") && (E.display = Id(E.display)), { values: E, sources: z, own: _, inherited: N, customs: f };
  }
  parseValue(l, i, o, s, d) {
    const m = String(i).trim();
    switch (l) {
      case "font-size": {
        const f = m.toLowerCase(), p = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (p[f]) return p[f];
        if (f === "smaller") return o.fontSize / 1.2;
        if (f === "larger") return o.fontSize * 1.2;
        const y = qn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return !y || y.num ? o.fontSize : y.px + y.pct / 100 * o.fontSize;
      }
      case "font-weight": {
        const f = m.toLowerCase();
        if (f === "normal") return 400;
        if (f === "bold") return 700;
        if (f === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (f === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const p = parseFloat(f);
        return Number.isFinite(p) ? p : 400;
      }
      case "line-height": {
        const f = m.toLowerCase();
        if (f === "normal") return { normal: !0 };
        const p = qn(f, { fontSize: o.fontSize, viewport: o.viewport });
        return p ? p.unitless ? { factor: p.num } : { px: p.px + p.pct / 100 * o.fontSize } : { normal: !0 };
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
        const f = Xr(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Xr(m, (p) => this.themeHex(p));
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
        return us(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Id(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Zr = (n) => n && n.rgba ? { value: V0(n.rgba), token: n.token ?? null } : null, ig = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function og(n, l) {
  const i = l?.(n);
  if (Number.isFinite(i)) return i;
  const o = Math.round(n * 100) / 100;
  return ig[o] ?? Math.round(n * 1.2);
}
function _l(n, l) {
  const i = n["line-height"], o = n["font-size"];
  return i.normal ? og(o, l) : i.factor !== void 0 ? i.factor * o : i.px;
}
const sg = (n) => ie(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const cg = "perch-native-description/1", Fe = Symbol("display"), Jr = {
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
}, ug = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of ug) Jr[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Jr.rounded = 0;
const dg = /* @__PURE__ */ new Set([
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
]), fg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, mg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, pg = (n) => mg.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : fg.test(n) ? ".SystemUIFont" : sg(n).split(",")[0].trim(), hg = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, $d = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Ts = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const i = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (i) return `${n.tagName}.${i}`;
  const o = n.parentElement;
  return o && o.tagName !== "body" ? `${Ts(o)} > ${n.tagName}` : n.tagName;
};
class gg {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(l, i, o, s, d, m = "") {
    const f = `${l}|${i}|${o}|${s}`, p = this.map.get(f);
    if (p) {
      !p.elements.includes(d) && p.elements.length < 4 && p.elements.push(d), p.count++;
      return;
    }
    this.map.set(f, { kind: l, property: i, value: String(o), class: s ?? null, elements: [d], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((l, i) => l.kind < i.kind ? -1 : l.kind > i.kind ? 1 : l.property < i.property ? -1 : l.property > i.property ? 1 : 0);
  }
}
const pn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, bg = /^(text|search|url|email|tel|password|number)$/, vg = 162.13 / 12.8;
function yg(n, l) {
  const i = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!i) return;
  const o = ie(i[1], ",").map((s) => qn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return o.length ? Math.min(...o) : void 0;
}
function xg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const i = qn(n.expr, { fontSize: l["font-size"] }), o = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!i && !i.num && i.pct === 100 && Math.abs(i.px + o) < 0.01;
}
function Vf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = o && ie(o[2], ",").map((d) => d.trim());
    return !s || s.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [s[0], "0"] : o[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const i = n.translate;
  if (i && i !== "none") {
    const o = ie(String(i).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && qn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function Pd(n, l, i, o = !1) {
  const s = n.values, d = Vf(s);
  if (d?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (b, v) => {
    const S = qn(b, f);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof v == "number" ? S.px + S.pct / 100 * v : void 0 : S.px;
  }, y = d ? p(d[0], l.w) : void 0, k = d ? p(d[1], l.h) : void 0;
  if (y === void 0 || k === void 0) {
    const b = !o && d ? d.map((v) => qn(v, f)) : null;
    if (b?.every((v) => v && !(v.unitless && v.num))) {
      l[Kf] = b.map((v) => [v.px, v.pct ?? 0]);
      return;
    }
    i("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (o) {
    y && (l.left = y), k && (l.top = k);
    return;
  }
  y && (l.ml = (l.ml ?? 0) + y), k && (l.mt = (l.mt ?? 0) + k);
}
const Kf = Symbol("perch.shift");
function wg(n, l, i) {
  const o = n.ownerDocument, s = o?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, y]] = i, k = m + f / 100 * s.width, b = p + y / 100 * s.height;
    k && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + k), b && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + b);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Rf && o?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function qr(n, l, i = null) {
  const o = n.values, s = {}, d = (j) => n.sources[j], m = (j) => n.sources[j] !== void 0, f = o.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), o["grid-template-columns"] && o["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", o["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const j = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[o["flex-direction"]] ?? "row";
    s.flex_direction = j;
  }
  if (p) {
    (o["flex-wrap"] === "wrap" || o["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const j = f === "grid" || f === "inline-grid", X = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[o["align-items"]];
    X && (s.items = X);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (j) {
      const x = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      x && (s.items = x), o["align-items"] === "center" && (q = "center");
    }
    q && (s.justify = q);
    const R = pn(o["row-gap"]), h = pn(o["column-gap"]);
    typeof R == "number" && R && (s.gap_y = R), typeof h == "number" && h && !j && (s.gap_x = h);
  }
  o["flex-grow"] && (s.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (s.flex_shrink = o["flex-shrink"]);
  const y = pn(o["flex-basis"]);
  y !== void 0 && y !== "auto" && (s.flex_basis = y);
  const k = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  k && (s.self = k);
  for (const [j, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = o[X], R = pn(q);
    if (R === void 0 && X === "width" && xg(q, o)) {
      s.self = "stretch", l("approximated", X, q.expr, d(X), "stretched across its parent, inside its margins");
      continue;
    }
    const h = R === void 0 && /^max-/.test(X) ? yg(q, o["font-size"]) : void 0;
    if (h !== void 0) {
      s[j] = h, l("approximated", X, q.expr, d(X), "the fixed bound of min()");
      continue;
    }
    if (R === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", X, q.expr, d(X), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", X, q, d(X));
      continue;
    }
    R !== "auto" && (s[j] = R);
  }
  const b = ["top", "right", "bottom", "left"];
  for (const j of b) {
    const X = j[0];
    for (const [q, R] of [["p", "padding"], ["m", "margin"]]) {
      const h = o[`${R}-${j}`], x = pn(h);
      if (x === void 0) {
        h?.expr && l("unsupported", `${R}-${j}`, h.expr, d(`${R}-${j}`), "no calc() in the engine");
        continue;
      }
      x !== 0 && (s[`${q}${X}`] = x);
    }
  }
  const v = o.position;
  if (v === "absolute" || v === "fixed") {
    s.position = "absolute", v === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const j of b) {
      const X = pn(o[j]);
      X !== void 0 && X !== "auto" && (s[j] = X);
    }
    if (v === "fixed" && i && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const j = i.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, j) : j;
    }
    Pd(n, s, l);
  } else v === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Vf(o)?.length !== 0 && (s.position = "relative", Pd(n, s, l, !0));
  o["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", o["z-index"], d("z-index"), "paint order is tree order");
  for (const [j, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = o[X];
    q === "hidden" || q === "clip" ? s[j] = "hidden" : (q === "auto" || q === "scroll") && (s[j] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (s.visibility = "invisible");
  const S = o["background-color"];
  S?.unreadable ? l("unsupported", "background-color", S.unreadable, d("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = Zr(S)), o["background-image"] && o["background-image"] !== "none" && l("unsupported", "background-image", o["background-image"], d("background-image"));
  const E = b.map((j) => pn(o[`border-${j}-width`]) || 0), z = [];
  b.forEach((j, X) => {
    if (!E[X]) return;
    s[`border_${j[0]}`] = E[X];
    const q = o[`border-${j}-style`];
    q !== "solid" && l("approximated", `border-${j}-style`, q, d(`border-${j}-style`), "drawn solid");
    const R = Zr(o[`border-${j}-color`]);
    R && z.push(R);
  }), z.length && (s.border_color = z[0], z.some((j) => j.value !== z[0].value) && l("approximated", "border-color", z.map((j) => j.value).join(" "), d("border-top-color"), "one border colour"));
  const _ = (j) => {
    const X = pn(o[`border-${j}-radius`]) || 0;
    if (typeof X != "string") return X;
    const q = parseFloat(X) / 100, R = [s.w, s.h].filter((h) => typeof h == "number");
    return X === "auto" || !(q > 0) ? 0 : R.length ? Math.round(Math.min(q, 0.5) * Math.min(...R) * 100) / 100 : 9999;
  }, N = ["top-left", "top-right", "bottom-right", "bottom-left"].map(_);
  N.every((j) => j === N[0]) ? N[0] && (s.rounded = N[0]) : ["tl", "tr", "br", "bl"].forEach((j, X) => {
    N[X] && (s[`rounded_${j}`] = N[X]);
  }), o.opacity !== 1 && (s.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const H = o["box-shadow"];
  if (H && H !== "none" && ie(H, ",").some((j) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(j.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", H, d("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !n.inherited.has("cursor")) {
    const j = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    j ? s.cursor = j : l("unsupported", "cursor", o.cursor, d("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? s.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", o["text-decoration-line"], d("text-decoration-line")), s;
}
const _g = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Xf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((i) => _g[i]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Gr(n, l) {
  const i = n.values, o = i["line-height"];
  return {
    text_color: Zr(i.color),
    text_size: Math.round(i["font-size"] * 1e3) / 1e3,
    font_features: Xf(i["font-variant-numeric"]) ?? "",
    font_weight: i["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(_l(i, l) * 1e3) / 1e3 },
    font_family: pg(i["font-family"]),
    italic: i["font-style"] === "italic" || i["font-style"] === "oblique",
    whitespace: i["white-space"] === "nowrap" || i["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[i["text-align"]] ?? "left"
  };
}
const tf = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, Cs = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function Yr(n, l, i) {
  const o = {}, s = (f, p) => p.some((y) => !n.inherited.has(y));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !Cs(l[f], i[f])) && (o[f] = l[f]);
  const d = tf(l.line_height, l.text_size), m = i.line_height ? tf(i.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (o.line_height = l.line_height), o;
}
const kg = (n, l) => ({ ...n, ...l });
function Lr(n, l) {
  const i = {};
  for (const [o, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (i[o] = s.value, s.token && (l[o] = s.token)) : o === "line_height" ? i[o] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : o === "italic" ? s && (i.italic = !0) : i[o] = s;
  return i.italic === !1 && delete i.italic, i;
}
function ef(n, l) {
  const i = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[o], d = l[o];
    Cs(s, d) || (i[o] = d === void 0 ? o in Jr ? Jr[o] : null : d);
  }
  return i;
}
function nf(n, l) {
  const i = n.values;
  for (const [o, s] of Object.entries(n.sources)) {
    if (o.startsWith("--") || dg.has(o) || s.startsWith("ua:")) continue;
    const d = i[o];
    switch (o) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", o, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Xf(d) === null && l("unsupported", o, d, s);
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
        i["outline-style"] !== "none" && o === "outline-style" && l("unsupported", "outline", `${pn(i["outline-width"])}px ${i["outline-style"]} ${Zr(i["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function Sg(n, l, i, o) {
  const s = Ts(n), d = [], m = (N, H, j, X, q) => d.push([N, H, j, X ?? "(user agent)", s, q]), f = o.cascade.compute(n, l), p = {}, y = qr(f, m, o.viewport), k = y[Kf];
  nf(f, m);
  const b = Gr(f, o.measure), v = Yr(f, b, i), S = Lr({ ...y, ...v }, p), E = {}, z = o.cascade.matching(n, "*").filter((N) => N.states.subject.size);
  for (const [N, H] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!z.some((h) => H.some((x) => h.states.subject.has(x)))) continue;
    const j = o.cascade.compute(n, l, new Set(H)), X = {}, q = Lr({ ...qr(j, () => {
    }), ...Yr(j, Gr(j, o.measure), i) }, X);
    N === "focus" && nf(j, m);
    const R = ef(S, q);
    if (Object.keys(R).length) {
      E[N] = R;
      const h = Object.fromEntries(Object.entries(X).filter(([x]) => x in R));
      Object.keys(h).length && (E[`${N}_tokens`] = h);
    }
  }
  if (o.cascade.sheet.tracks(n, "hover") && (E.group = af(n), E.track_hover = !0), o.cascade.sheet.readsAncestor(n, "hover"))
    for (let N = n.parentNode; N?.state; N = N.parentNode) {
      if (!o.cascade.sheet.tracks(N, "hover")) continue;
      const H = N.state.hover;
      N.state.hover = !0;
      let j;
      try {
        j = o.cascade.compute(n, l);
      } finally {
        N.state.hover = H;
      }
      const X = {}, q = Lr({ ...qr(j, () => {
      }), ...Yr(j, Gr(j, o.measure), i) }, X), R = ef(S, q);
      if (!Object.keys(R).length) continue;
      const h = Object.fromEntries(Object.entries(X).filter(([x]) => x in R));
      (E.group_hover ??= []).push({ group: af(N), style: R, ...Object.keys(h).length ? { tokens: h } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (E.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (E.break_anywhere = !0), y.overflow_y === "scroll") {
    const N = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    N > 0 && (E.scrollbar = N);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (E.blocks_pointer = !0), f.values["pointer-events"] === "none" && (E.pointer_none = !0);
  const _ = Object.entries(hg).filter(([, N]) => N.some((H) => typeof n.props[H] == "function")).map(([N]) => N);
  return !_.includes("click") && is(n) && _.push("click"), _.length && (E.events = _), { computed: f, style: S, tokens: p, extra: E, meta: Og(n), reports: d, childText: kg(i, v), where: s, shift: k };
}
function Eg(n, l, i, o) {
  const s = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!o.cascade.matching(n, /* @__PURE__ */ new Set(), d).length) continue;
    const m = o.cascade.compute(n, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", y = (E, z, _, N, H) => o.add(E, z, _, N ?? "(user agent)", `${Ts(n)}::${d}`, H), k = {}, b = qr(m, y, o.viewport), S = { kind: "div", style: Lr({ ...b, ...Yr(m, Gr(m, o.measure), i) }, k), tokens: k, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(S, Fe, { value: m.values.display }), s[d] = S;
  }
  return s;
}
const af = (n) => `~g${n.id}`, zg = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function Ng(n) {
  return n.kind === "div" && n[Fe] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !zg.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function Ar(n, l) {
  const i = n[l], o = { ...i, style: { ...i.style } };
  return Object.defineProperty(o, Fe, { value: i[Fe] }), n[l] = o, o;
}
function Tg(n) {
  const l = [];
  for (let i = n.parentElement; i?.parentElement; i = i.parentElement) {
    const o = i.parentElement.children;
    l.push(`${+(o[0] === i)}${+(o[o.length - 1] === i)}`);
  }
  return l.join("");
}
function Zf(n, l, i, o, s = 0, d = !0, m = !0, f = 0) {
  const p = o.cascade.sheet.depends(n), y = p.pos ? `${+d}${+m}${p.nth ? `:${f}` : ""}` : "", k = p.ancPos ? Tg(n) : "";
  let b = o.cache.get(n);
  const v = b && b.version === n.version && b.parentValues === l?.values && b.inheritedText === i && b.pos === y && b.ancPos === k && (!p.anc || s <= b.at);
  if (v && b.node && b.stamp === n.stamp && !b.volatile && (!b.subAnc || s <= b.subAt)) {
    for (const _ of b.log) o.add(..._);
    return b.node;
  }
  if (!v) {
    const _ = Sg(n, l, i, o);
    b && Cs(b.part.childText, _.childText) && (_.childText = b.part.childText), b = { version: n.version, parentValues: l?.values, inheritedText: i, pos: y, ancPos: k, at: o.now, part: _ }, o.cache.set(n, b);
  }
  const S = o.log.length, E = { volatile: !!b.part.shift || p.ancPos, subAnc: p.anc }, z = Cg(n, b, o, Math.max(s, n.attrStamp), E);
  return Object.assign(b, { node: z, stamp: n.stamp, subAt: o.now, log: o.log.slice(S), volatile: E.volatile, subAnc: E.subAnc }), z;
}
function Cg(n, l, i, o, s) {
  const { computed: d, tokens: m, extra: f, reports: p, childText: y, where: k } = l.part;
  for (const w of p) i.add(...w);
  const b = (w, M, O, A, B) => i.add(w, M, O, A, k, B), v = { ...l.part.style };
  l.part.shift && wg(n, v, l.part.shift);
  const S = { kind: "div", id: n.id, style: v, tokens: m, meta: l.part.meta, ...f };
  Object.defineProperty(S, Fe, { value: d.values.display }), n.measured && n.ownerDocument?.measureKey && (S.measure = n.ownerDocument.measureKey(n));
  const E = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return S.kind = "engine", S.engine = String(n.props["data-perch-engine"]), S.key = String(n.props["data-perch-key"] ?? ""), S;
  if (E === "svg")
    return S.kind = n.props["data-perch-image"] ? "image" : "svg", S.markup = Dg(n), S;
  if (E === "input" || E === "textarea" || E === "select") {
    S.kind = "input", S.input_type = E === "input" ? String(n.props.type ?? "text") : E;
    for (const O of ["placeholder", "checked", "disabled"]) n.props[O] !== void 0 && (S[O] = n.props[O]);
    if (/^(checkbox|radio)$/.test(S.input_type) && (S.checked = n.checked), E !== "select" && (S.value = n.value), E === "input" && bg.test(S.input_type) && (S.field_w = vg * d.values["font-size"]), E === "textarea" && v.h === void 0) {
      const O = d.values, A = (F) => F && typeof F == "object" && "px" in F ? F.px : 0, B = (F) => O[`border-${F}-style`] === "none" ? 0 : A(O[`border-${F}-width`]), K = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      v.h = K * _l(O, i.measure) + A(O["padding-top"]) + A(O["padding-bottom"]) + B("top") + B("bottom");
    }
    const { before: w, after: M } = Eg(n, d, y, i);
    return (w || M) && (S.children = [w, M].filter(Boolean)), S;
  }
  if (E === "img") {
    S.kind = "image", S.src = n.props.src ?? null;
    for (const [w, M] of [["width", "w"], ["height", "h"]]) {
      const O = Number(n.props[w]);
      v[M] === void 0 && n.props[w] != null && Number.isFinite(O) && (v[M] = O);
    }
    return S;
  }
  const z = d.values["text-transform"], _ = [];
  let N = !1, H = !1;
  const j = n.childNodes.reduce((w, M) => w + (M instanceof Kt ? 1 : 0), 0);
  let X = 0;
  for (const w of n.childNodes) {
    if (w instanceof ni) {
      if (w.hidden || w.data === "") continue;
      N = !0;
      const B = _[_.length - 1];
      if (B?.kind === "text")
        B.source = (B.source ?? B.text) + w.data, B.text = lf(B.source, z), B.text === B.source && delete B.source;
      else {
        const K = lf(w.data, z);
        _.push(K === w.data ? { kind: "text", text: K } : { kind: "text", text: K, source: w.data });
      }
      continue;
    }
    if (!(w instanceof Kt)) continue;
    const M = Zf(w, d, y, i, o, X === 0, X === j - 1, X);
    X++;
    const O = i.cache.get(w);
    s.volatile ||= O.volatile, s.subAnc ||= O.subAnc;
    const A = M[Fe];
    A === "inline" || A === "inline-block" || A === "inline-flex" ? N = !0 : A !== "none" && (H = !0), _.push(M);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && v.w === void 0) {
    for (let w = 0; w < _.length; w++)
      if (_[w].style?.flex_grow && _[w].style.min_w === 0 && _[w].style.overflow_x === "hidden") {
        const M = Ar(_, w);
        delete M.style.min_w, delete M.style.flex_grow, delete M.style.flex_basis, delete M.style.overflow_x, delete M.style.overflow_y;
      }
  }
  if (!v.display && N && _.some((w) => w.kind !== "text") && _.every((w) => w.kind === "text" || Ng(w))) {
    const w = _.map((M) => M.kind === "text" ? M.text : M.children.map((O) => O.text).join("")).join("");
    b("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), _.splice(0, _.length, { kind: "text", text: w });
  }
  const q = _.some((w) => w.kind !== "text");
  let R = _.length === 1 && _[0].kind !== "text" && /^inline-(block|flex)$/.test(_[0][Fe]) ? _[0] : null;
  if (!v.display && R) {
    R = Ar(_, 0);
    const w = i.cache.get(n.childNodes.find((O) => O.id === R.id))?.part.computed, M = w ? Fr(d.values, i.measure) - jg(w.values, i.measure, R) : 0;
    v.display = "flex", v.flex_direction = "col", v.items = "start", M > 0 && (R.style.mt = Math.round(((R.style.mt ?? 0) + M) * 100) / 100), b("approximated", "display", `${d.values.display} holding one ${R[Fe]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!v.display && _.length === 1 && (_[0].kind === "svg" || _[0].kind === "image") && _[0][Fe] === "inline" && typeof _[0].style.h == "number") {
    const w = Ar(_, 0), M = Fr(d.values, i.measure), O = _l(d.values, i.measure) - M, A = (B) => Math.round(B * 100) / 100;
    v.display = "flex", v.flex_direction = "col", v.items = "start", M > w.style.h && (w.style.mt = A((w.style.mt ?? 0) + M - w.style.h)), O > 0 && (w.style.mb = A((w.style.mb ?? 0) + O)), b("approximated", "display", `${d.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!v.display && N && q) {
    if (v.display = "flex", v.flex_direction = H ? "col" : "row", !H) v.items = "baseline";
    else for (let w = 0; w < _.length; w++) _[w].kind !== "text" && /^inline-(block|flex)$/.test(_[w][Fe]) && !_[w].style.self && (Ar(_, w).style.self = "start");
    b("approximated", "display", `${d.values.display} with inline content`, "(inline formatting)", H ? "a column of its children" : "a row on the text baseline");
  }
  const h = d.values["letter-spacing"]?.px, x = d.values["overflow-x"] !== "visible";
  if (h)
    for (let w = 0; w < _.length; w++) {
      const M = _[w];
      if (M.kind !== "text") continue;
      const O = Math.round(h * [...M.text].length * 1e3) / 1e3;
      if (h > 0 || !x) {
        _[w] = { kind: "div", style: { pr: O }, tokens: {}, children: [M] };
        continue;
      }
      const A = d.values["font-size"], B = Math.max(0.8, 1 + h / (0.55 * A)), K = Math.round(_l(d.values, i.measure) * 1e3) / 1e3;
      _[w] = { kind: "div", style: { text_size: Math.round(A * B * 1e3) / 1e3, line_height: `${K}px` }, tokens: {}, children: [M] };
    }
  return S.children = _, S;
}
function Mg(n, l) {
  if (!l) return null;
  let o = (l.self ? n : l.closest ? jf(n, l.closest) : l.find ? Sl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return o && l.strip && o.startsWith(l.strip) && (o = o.slice(l.strip.length)), o;
}
function Ag(n, l, i) {
  const o = l.map((m) => [m, ei(m.selector)]), s = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const p = i.get(f.id);
      if (p)
        for (const [y, k] of o) {
          const b = y.textRange ? "range_name" : "name";
          if (y.textRange && p[b] != null || !k.some((z) => ns(f, z))) continue;
          const v = Mg(f, y.key), S = v == null ? s.get(y.name) ?? 0 : 0;
          v == null && s.set(y.name, S + 1);
          const E = v != null ? `${y.name}:${v}` : S ? `${y.name}@${S}` : y.name;
          p[b] == null ? p[b] = E : (p.also ??= []).push(E);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Wr = 0.9521, Jf = 0.2256, Fr = (n, l) => (_l(n, l) - (Wr + Jf) * n["font-size"]) / 2 + Wr * n["font-size"];
function jg(n, l, i) {
  const o = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]), d = i?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Fr(n, l), (m.style.mt ?? 0) + m.style.h) : Fr(n, l);
  return o(n["padding-top"]) + s + f;
}
const lf = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (i) => i.toUpperCase()) : n, Wf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Og(n) {
  const l = {};
  for (const [i, o] of Object.entries(n.props)) {
    if (Wf.has(i) || typeof o == "function" || o === void 0 || o === null || typeof o == "object") continue;
    const s = i.startsWith("aria-") || i.startsWith("data-");
    if (o === !1 && !s) continue;
    const d = i === "htmlFor" ? "for" : i === "tabIndex" ? "tabindex" : i;
    l[d] = typeof o == "boolean" ? s ? String(o) : "" : String(o);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const Rg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), rf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Dg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (i) => {
    const o = [];
    for (const [d, m] of Object.entries(i.props))
      Wf.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || o.push(`${Rg(d)}="${rf(m === !0 ? "" : m)}"`);
    i.tagName === "svg" && !i.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = i.childNodes.map((d) => d instanceof ni ? rf(d.data) : l(d)).join("");
    return `<${i.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${s}</${i.tagName}>`;
  };
  return l(n);
}
function Hg(n) {
  const l = n.theme?.() ?? {}, i = {};
  for (const o of qf) l[o] && (i[o] = l[o]);
  return i;
}
const Bg = { font_features: "" };
function Ug(n, l, i, o = {}, s = null) {
  const d = Hg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (o.look !== f || o.sheet !== i) && Object.assign(o, { look: f, sheet: i, cache: /* @__PURE__ */ new WeakMap(), cascade: new rg(i, { theme: d, viewport: m }), top: null });
  const { cascade: p, cache: y } = o, k = new gg(), b = [], S = { cascade: p, cache: y, viewport: m, findings: k, log: b, add: (...N) => {
    b.push(N), k.add(...N);
  }, now: ls(), measure: l.lineHeight ? (N) => l.lineHeight(N) : null };
  o.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const E = n.body.children, z = E.map((N, H) => Zf(N, o.top, Bg, S, 0, H === 0, H === E.length - 1, H));
  if (s?.length) {
    const N = /* @__PURE__ */ new Map(), H = (j) => {
      j.id && (N.set(j.id, j), delete j.name, delete j.range_name, delete j.also);
      for (const X of j.children ?? []) H(X);
    };
    z.forEach(H), Ag(n, s, N);
  }
  const _ = /* @__PURE__ */ new Set();
  for (const N of [n, n.defaultView])
    for (const { type: H } of N?.listeners ?? []) $d[H] && _.add($d[H]);
  return { schema: cg, root: z[0] ?? null, overlays: z.slice(1), document_events: [..._].sort(), unsupported: S.findings.list() };
}
const qg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Gg = null;
const Yg = () => Gg ??= new F0(qg);
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
let sa = El.NoEventPriority;
function Lg(n, l) {
  const i = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const o of i) {
    if (o === "children") continue;
    const s = n[o], d = l[o];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(o === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const Qg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function of(n, l) {
  for (const i of p0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(i);
  return n;
}
const Vg = {
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
  createInstance: (n, l, i) => of(new Kt(n, l, i.ownerDocument), l),
  createTextInstance: (n, l) => new ni(n),
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
      of(n, o);
    }
    Lg(i, o) && n.touch();
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
    sa = n;
  },
  getCurrentUpdatePriority: () => sa,
  resolveUpdatePriority: () => sa !== El.NoEventPriority ? sa : El.DefaultEventPriority,
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
}, Ne = H0(Vg), Tl = (n, l, i = null) => Ne.createPortal(n, l, null, i), Kg = {
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
}, Xg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Zg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Jg = (n) => {
  for (let l = n; l instanceof Kt; l = l.parentNode) if (l.props.disabled && Zg.has(l.tagName)) return !0;
  return !1;
};
class Wg {
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
function jr(n, l, i) {
  l.currentTarget = n;
  for (const { type: o, listener: s, capture: d } of [...n.listeners ?? []])
    o === l.type && d === i && s.call(n, l);
  if (n instanceof Kt) {
    const o = Kg[l.type], s = o && n.props[i ? `${o}Capture` : o];
    typeof s == "function" && s(l);
  }
}
function Qy(n, l, i = {}) {
  const { document: o, window: s, globals: d } = y0(n), m = new Kt("div", { id: "root", style: i.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let p = null;
  const y = () => [o, s].map((R) => R.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let k = "";
  const b = {}, v = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, E = -1;
  o.measureKey = (R) => v + R.id, o.stale = () => E !== S, o.computed = (R) => {
    if (!b.cascade || !b.top) return null;
    const h = [];
    for (let w = R; w instanceof Kt && w !== o.body; w = w.parentNode) h.unshift(w);
    let x = b.top;
    for (const w of h) x = b.cascade.compute(w, x);
    return x.values;
  };
  const z = () => (S += 1, p = Ug(o, n, Yg(), b, i.names), k = y(), n.render?.(p), p), _ = () => {
    Ne.flushPassiveEffects(), Ne.flushSyncWork(), y() !== k && z();
  };
  o.afterCommit = z;
  const N = (R) => {
    f.push(R), n.error?.(R);
  }, H = Ne.createContainer(m, El.ConcurrentRoot, null, !1, null, "", N, N, N, null);
  Ne.updateContainerSync(nt.createElement(l, i.props ?? {}), H, null, null), Ne.flushSyncWork(), _();
  const j = (R) => {
    const h = (x) => {
      if (x.id === R) return x;
      for (const w of x.children) {
        const M = h(w);
        if (M) return M;
      }
      return null;
    };
    return h(o.documentElement);
  }, X = (R) => {
    const h = sa;
    sa = El.DiscreteEventPriority;
    try {
      return R();
    } finally {
      sa = h, Ne.flushSyncWork(), _();
    }
  }, q = {
    document: o,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: m,
    errors: f,
    /** The latest description (after the last commit or state change). */
    get description() {
      return p;
    },
    describe: z,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(R, h, x = {}) {
      const w = typeof R == "string" ? j(R) : R;
      if (!w || Xg.has(h) && Jg(w)) return !1;
      const M = new Wg(h, x, w), O = [];
      for (let K = w; K; K = K.parentNode) O.push(K);
      const A = [...O, o, s];
      X(() => {
        for (let K = A.length - 1; K > 0 && !M.propagationStopped; K--) jr(A[K], M, !0);
        M.propagationStopped || (jr(w, M, !0), M.propagationStopped || jr(w, M, !1));
        for (let K = 1; K < A.length && !M.propagationStopped; K++) jr(A[K], M, !1);
      });
      const B = h === "click" && !M.defaultPrevented ? is(w) : null;
      if (B && q.dispatch(B, "submit", {}), h === "click" && !M.defaultPrevented)
        for (let K = w; K; K = K.parentNode) {
          if (K.tagName !== "a") continue;
          const F = K.props?.href;
          typeof F == "string" && /^https:\/\/\S+$/.test(F) && n.openLink?.(F);
          break;
        }
      return !M.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (R) => [o, s].some((h) => h.listeners.some((x) => x.type === R)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(R) {
      const h = o.activeElement && o.activeElement !== o.body ? o.activeElement : o.body;
      if (!q.dispatch(h, "keydown", R)) return !0;
      const w = R.key === "Enter" && !R.isComposing ? is(h, !0) : null;
      if (w)
        return q.dispatch(w, "submit", {}), !0;
      if (!Bf(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((R.ctrlKey || R.metaKey) && !R.altKey && !R.shiftKey && R.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (R.ctrlKey || R.metaKey) return !1;
      const M = h.selectedAll;
      h.selectedAll = !1;
      const O = h.value, B = R.key === "Backspace" || M && R.key === "Delete" ? M ? "" : O.slice(0, -1) : [...R.key].length === 1 ? (M ? "" : O) + R.key : O;
      return B === O ? !1 : (h.value = B, q.dispatch(h, "input", { data: R.key }), q.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), z(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(R, h) {
      const x = j(R);
      x && (x.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(R) {
      const h = j(R);
      if (!h || h.props.disabled || !q.dispatch(R, "click", { button: 0, detail: 1 })) return;
      const x = h.props.type === "radio";
      x && h.checked || (h.checked = x ? !0 : !h.checked, q.dispatch(R, "input", {}), q.dispatch(R, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), z());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(R, h = {}) {
      const x = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const w of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(R, w, x);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (R) => !!j(R)?.state.hover,
    hover(R, h) {
      const x = j(R);
      !x || x.state.hover === h || (x.state.hover = h, x.touch(), z());
    },
    focus(R) {
      const h = j(R);
      h && (X(() => {
        const x = o.activeElement;
        x && x !== h && x !== o.body && q.dispatch(x, "blur"), o.focus(h), q.dispatch(h, "focus");
      }), z());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(R) {
      let x = typeof R == "string" ? j(R) : R;
      for (; x && !(x instanceof Kt && typeof x.props.onKeyDown == "function" && Qg(x)); ) x = x.parentNode;
      !x || x === o.activeElement || (q.focus(x.id), x.state.pointerFocus = !0, x.touch(), z());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return E = S, o.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const R = o.retries.splice(0);
      for (const h of R) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: _,
    update(R) {
      Ne.updateContainerSync(nt.createElement(l, R ?? {}), H, null, null), Ne.flushSyncWork(), _();
    },
    unmount() {
      Ne.updateContainerSync(null, H, null, null), Ne.flushSyncWork(), Ne.flushPassiveEffects(), o.afterCommit = null, o.retries.length = 0, n.forgetBounds?.(v);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Ff = (n) => Ne.flushSyncFromReconciler(n), Fg = { createPortal: Tl, flushSync: Ff }, Vy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Tl,
  default: Fg,
  flushSync: Ff
}, Symbol.toStringTag, { value: "Module" }));
function If(n) {
  var l, i, o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (i = If(n[l])) && (o && (o += " "), o += i);
  } else for (i in n) n[i] && (o && (o += " "), o += i);
  return o;
}
function $f() {
  for (var n, l, i = 0, o = "", s = arguments.length; i < s; i++) (n = arguments[i]) && (l = If(n)) && (o && (o += " "), o += l);
  return o;
}
const Ig = (n, l) => {
  const i = new Array(n.length + l.length);
  for (let o = 0; o < n.length; o++)
    i[o] = n[o];
  for (let o = 0; o < l.length; o++)
    i[n.length + o] = l[o];
  return i;
}, $g = (n, l) => ({
  classGroupId: n,
  validator: l
}), Pf = (n = /* @__PURE__ */ new Map(), l = null, i) => ({
  nextPart: n,
  validators: l,
  classGroupId: i
}), Ir = "-", sf = [], Pg = "arbitrary..", tb = (n) => {
  const l = nb(n), {
    conflictingClassGroups: i,
    conflictingClassGroupModifiers: o
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return eb(m);
      const f = m.split(Ir), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return tm(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = o[m], y = i[m];
        return p ? y ? Ig(y, p) : p : y || sf;
      }
      return i[m] || sf;
    }
  };
}, tm = (n, l, i) => {
  if (n.length - l === 0)
    return i.classGroupId;
  const s = n[l], d = i.nextPart.get(s);
  if (d) {
    const y = tm(n, l + 1, d);
    if (y) return y;
  }
  const m = i.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(Ir) : n.slice(l).join(Ir), p = m.length;
  for (let y = 0; y < p; y++) {
    const k = m[y];
    if (k.validator(f))
      return k.classGroupId;
  }
}, eb = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), i = l.indexOf(":"), o = l.slice(0, i);
  return o ? Pg + o : void 0;
})(), nb = (n) => {
  const {
    theme: l,
    classGroups: i
  } = n;
  return ab(i, l);
}, ab = (n, l) => {
  const i = Pf();
  for (const o in n) {
    const s = n[o];
    Ms(s, i, o, l);
  }
  return i;
}, Ms = (n, l, i, o) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const m = n[d];
    lb(m, l, i, o);
  }
}, lb = (n, l, i, o) => {
  if (typeof n == "string") {
    rb(n, l, i);
    return;
  }
  if (typeof n == "function") {
    ib(n, l, i, o);
    return;
  }
  ob(n, l, i, o);
}, rb = (n, l, i) => {
  const o = n === "" ? l : em(l, n);
  o.classGroupId = i;
}, ib = (n, l, i, o) => {
  if (sb(n)) {
    Ms(n(o), l, i, o);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push($g(i, n));
}, ob = (n, l, i, o) => {
  const s = Object.entries(n), d = s.length;
  for (let m = 0; m < d; m++) {
    const [f, p] = s[m];
    Ms(p, em(l, f), i, o);
  }
}, em = (n, l) => {
  let i = n;
  const o = l.split(Ir), s = o.length;
  for (let d = 0; d < s; d++) {
    const m = o[d];
    let f = i.nextPart.get(m);
    f || (f = Pf(), i.nextPart.set(m, f)), i = f;
  }
  return i;
}, sb = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, cb = (n) => {
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
}, fs = "!", cf = ":", ub = [], uf = (n, l, i, o, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: i,
  maybePostfixModifierPosition: o,
  isExternal: s
}), db = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: i
  } = n;
  let o = (s) => {
    const d = [];
    let m = 0, f = 0, p = 0, y;
    const k = s.length;
    for (let z = 0; z < k; z++) {
      const _ = s[z];
      if (m === 0 && f === 0) {
        if (_ === cf) {
          d.push(s.slice(p, z)), p = z + 1;
          continue;
        }
        if (_ === "/") {
          y = z;
          continue;
        }
      }
      _ === "[" ? m++ : _ === "]" ? m-- : _ === "(" ? f++ : _ === ")" && f--;
    }
    const b = d.length === 0 ? s : s.slice(p);
    let v = b, S = !1;
    b.endsWith(fs) ? (v = b.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      b.startsWith(fs) && (v = b.slice(1), S = !0)
    );
    const E = y && y > p ? y - p : void 0;
    return uf(d, S, v, E);
  };
  if (l) {
    const s = l + cf, d = o;
    o = (m) => m.startsWith(s) ? d(m.slice(s.length)) : uf(ub, !1, m, void 0, !0);
  }
  if (i) {
    const s = o;
    o = (d) => i({
      className: d,
      parseClassName: s
    });
  }
  return o;
}, fb = (n) => {
  const l = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((i, o) => {
    l.set(i, 1e6 + o);
  }), (i) => {
    const o = [];
    let s = [];
    for (let d = 0; d < i.length; d++) {
      const m = i[d], f = m[0] === "[", p = l.has(m);
      f || p ? (s.length > 0 && (s.sort(), o.push(...s), s = []), o.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), o.push(...s)), o;
  };
}, mb = (n) => ({
  cache: cb(n.cacheSize),
  parseClassName: db(n),
  sortModifiers: fb(n),
  postfixLookupClassGroupIds: pb(n),
  ...tb(n)
}), pb = (n) => {
  const l = /* @__PURE__ */ Object.create(null), i = n.postfixLookupClassGroups;
  if (i)
    for (let o = 0; o < i.length; o++)
      l[i[o]] = !0;
  return l;
}, hb = /\s+/, gb = (n, l) => {
  const {
    parseClassName: i,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = n.trim().split(hb);
  let y = "";
  for (let k = p.length - 1; k >= 0; k -= 1) {
    const b = p[k], {
      isExternal: v,
      modifiers: S,
      hasImportantModifier: E,
      baseClassName: z,
      maybePostfixModifierPosition: _
    } = i(b);
    if (v) {
      y = b + (y.length > 0 ? " " + y : y);
      continue;
    }
    let N = !!_, H;
    if (N) {
      const h = z.substring(0, _);
      H = o(h);
      const x = H && m[H] ? o(z) : void 0;
      x && x !== H && (H = x, N = !1);
    } else
      H = o(z);
    if (!H) {
      if (!N) {
        y = b + (y.length > 0 ? " " + y : y);
        continue;
      }
      if (H = o(z), !H) {
        y = b + (y.length > 0 ? " " + y : y);
        continue;
      }
      N = !1;
    }
    const j = S.length === 0 ? "" : S.length === 1 ? S[0] : d(S).join(":"), X = E ? j + fs : j, q = X + H;
    if (f.indexOf(q) > -1)
      continue;
    f.push(q);
    const R = s(H, N);
    for (let h = 0; h < R.length; ++h) {
      const x = R[h];
      f.push(X + x);
    }
    y = b + (y.length > 0 ? " " + y : y);
  }
  return y;
}, bb = (...n) => {
  let l = 0, i, o, s = "";
  for (; l < n.length; )
    (i = n[l++]) && (o = nm(i)) && (s && (s += " "), s += o);
  return s;
}, nm = (n) => {
  if (typeof n == "string")
    return n;
  let l, i = "";
  for (let o = 0; o < n.length; o++)
    n[o] && (l = nm(n[o])) && (i && (i += " "), i += l);
  return i;
}, vb = (n, ...l) => {
  let i, o, s, d;
  const m = (p) => {
    const y = l.reduce((k, b) => b(k), n());
    return i = mb(y), o = i.cache.get, s = i.cache.set, d = f, f(p);
  }, f = (p) => {
    const y = o(p);
    if (y)
      return y;
    const k = gb(p, i);
    return s(p, k), k;
  };
  return d = m, (...p) => d(bb(...p));
}, yb = [], Wt = (n) => {
  const l = (i) => i[n] || yb;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, am = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, lm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, xb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, wb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, _b = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, kb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Sb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, Eb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Rn = (n) => xb.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), We = (n) => !!n && Number.isInteger(Number(n)), Io = (n) => n.endsWith("%") && vt(n.slice(0, -1)), mn = (n) => wb.test(n), rm = () => !0, zb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  _b.test(n) && !kb.test(n)
), As = () => !1, Nb = (n) => Sb.test(n), Tb = (n) => Eb.test(n), Cb = (n) => !rt(n) && !it(n), Mb = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), Ab = (n) => Gn(n, sm, As), rt = (n) => am.test(n), ia = (n) => Gn(n, cm, zb), df = (n) => Gn(n, qb, vt), jb = (n) => Gn(n, dm, rm), Ob = (n) => Gn(n, um, As), ff = (n) => Gn(n, im, As), Rb = (n) => Gn(n, om, Tb), Or = (n) => Gn(n, fm, Nb), it = (n) => lm.test(n), yl = (n) => ua(n, cm), Db = (n) => ua(n, um), mf = (n) => ua(n, im), Hb = (n) => ua(n, sm), Bb = (n) => ua(n, om), Rr = (n) => ua(n, fm, !0), Ub = (n) => ua(n, dm, !0), Gn = (n, l, i) => {
  const o = am.exec(n);
  return o ? o[1] ? l(o[1]) : i(o[2]) : !1;
}, ua = (n, l, i = !1) => {
  const o = lm.exec(n);
  return o ? o[1] ? l(o[1]) : i : !1;
}, im = (n) => n === "position" || n === "percentage", om = (n) => n === "image" || n === "url", sm = (n) => n === "length" || n === "size" || n === "bg-size", cm = (n) => n === "length", qb = (n) => n === "number", um = (n) => n === "family-name", dm = (n) => n === "number" || n === "weight", fm = (n) => n === "shadow", Gb = () => {
  const n = Wt("color"), l = Wt("font"), i = Wt("text"), o = Wt("font-weight"), s = Wt("tracking"), d = Wt("leading"), m = Wt("breakpoint"), f = Wt("container"), p = Wt("spacing"), y = Wt("radius"), k = Wt("shadow"), b = Wt("inset-shadow"), v = Wt("text-shadow"), S = Wt("drop-shadow"), E = Wt("blur"), z = Wt("perspective"), _ = Wt("aspect"), N = Wt("ease"), H = Wt("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], q = () => [...X(), it, rt], R = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], x = () => [it, rt, p], w = () => [Rn, "full", "auto", ...x()], M = () => [We, "none", "subgrid", it, rt], O = () => ["auto", {
    span: ["full", We, it, rt]
  }, We, it, rt], A = () => [We, "auto", it, rt], B = () => ["auto", "min", "max", "fr", it, rt], K = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], F = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...x()], J = () => [Rn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...x()], I = () => [f, Rn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...x()], L = () => [Rn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...x()], V = () => [n, it, rt], T = () => [...X(), mf, ff, {
    position: [it, rt]
  }], Z = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], at = () => ["auto", "cover", "contain", Hb, Ab, {
    size: [it, rt]
  }], st = () => [Io, yl, ia], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    it,
    rt
  ], ut = () => ["", vt, yl, ia], Et = () => ["solid", "dashed", "dotted", "double"], Ft = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Io, mf, ff], Yn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    E,
    it,
    rt
  ], Ln = () => ["none", vt, it, rt], De = () => ["none", vt, it, rt], He = () => [vt, it, rt], hn = () => [Rn, "full", ...x()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [mn],
      breakpoint: [mn],
      color: [rm],
      container: [mn],
      "drop-shadow": [mn],
      ease: ["in", "out", "in-out"],
      font: [Cb],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [mn],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [mn],
      shadow: [mn],
      spacing: ["px", vt],
      text: [mn],
      "text-shadow": [mn],
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
        aspect: ["auto", "square", Rn, rt, it, _]
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
      "container-named": [Mb],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [vt, "auto", rt, it, f]
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
        object: q()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: R()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": R()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": R()
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
        inset: w()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": w()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": w()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": w(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: w()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": w(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: w()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": w()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": w()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: w()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: w()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: w()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: w()
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
        z: [We, "auto", it, rt]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Rn, "full", "auto", f, ...x()]
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
        flex: [vt, Rn, "auto", "initial", "none", rt]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", vt, it, rt]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", vt, it, rt]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [We, "first", "last", "none", it, rt]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": M()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: O()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": A()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": A()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": M()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: O()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": A()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": A()
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
        justify: [...K(), "normal"]
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
        content: ["normal", ...K()]
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
        "place-content": K()
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
        w: [f, "screen", ...J()]
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
          ...J()
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
        text: ["base", i, yl, ia]
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
        font: [o, Ub, jb]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Io, rt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [Db, Ob, l]
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
        tracking: [s, it, rt]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", it, df]
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
          ...x()
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
        decoration: [vt, "from-font", "auto", it, ia]
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
        "underline-offset": [vt, "auto", it, rt]
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
        tab: [We, it, rt]
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
        bg: T()
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
          }, We, it, rt],
          radial: ["", it, rt],
          conic: ["", We, it, rt]
        }, Bb, Rb]
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
        "outline-offset": [vt, it, rt]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", vt, yl, ia]
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
          k,
          Rr,
          Or
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
        "inset-shadow": ["none", b, Rr, Or]
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
        "ring-offset": [vt, ia]
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
        "text-shadow": ["none", v, Rr, Or]
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
        opacity: [vt, it, rt]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...Ft(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": Ft()
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
        "mask-radial": [it, rt]
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
        "mask-radial-at": X()
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
        mask: T()
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
        blur: Yn()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [vt, it, rt]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [vt, it, rt]
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
          Rr,
          Or
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
        grayscale: ["", vt, it, rt]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [vt, it, rt]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", vt, it, rt]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [vt, it, rt]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", vt, it, rt]
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
        "backdrop-blur": Yn()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [vt, it, rt]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [vt, it, rt]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", vt, it, rt]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [vt, it, rt]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", vt, it, rt]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [vt, it, rt]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [vt, it, rt]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", vt, it, rt]
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
        duration: [vt, "initial", it, rt]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", N, it, rt]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [vt, it, rt]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", H, it, rt]
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
        "perspective-origin": q()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: Ln()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Ln()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Ln()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Ln()
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
        translate: hn()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": hn()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": hn()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": hn()
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
        zoom: [We, it, rt]
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
        fill: ["none", ...V()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [vt, yl, ia, df]
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
}, Yb = /* @__PURE__ */ vb(Gb);
function Ut(...n) {
  return Yb($f(n));
}
function Lb(n, l, i) {
  return n.filter((o, s) => s !== l && (o.start + o.end) / 2 < i).length;
}
function Qb(n, l, i, o) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const m = n[l + 1], f = n[l - 1], p = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((y, k) => {
    l < i && k > l && k <= i ? s[k] = -p : i < l && k >= i && k < l && (s[k] = p);
  }), s[l] = Math.min(Math.max(o, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const pf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Vb(n, l) {
  for (let i = n.parentElement; i; i = i.parentElement) {
    const o = getComputedStyle(i)[l === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (l === "x" ? i.scrollWidth > i.clientWidth : i.scrollHeight > i.clientHeight)) return i;
  }
  return null;
}
function Kb(n, l, i, o) {
  const s = n[l] ? Vb(n[l], i) : null, d = () => s ? i === "x" ? s.scrollLeft : s.scrollTop : 0, m = (_) => (i === "x" ? _.clientX : _.clientY) + d(), f = m(o), p = d(), y = n.map((_) => {
    const N = _.getBoundingClientRect();
    return i === "x" ? { start: N.left + p, end: N.right + p } : { start: N.top + p, end: N.bottom + p };
  }), k = n.map((_) => pf.map((N) => _.style[N])), b = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, v = i === "x" ? "translateX" : "translateY";
  let S = !1;
  const E = { to: l };
  n.forEach((_, N) => {
    if (_.style.pointerEvents = "none", N !== l) {
      b || (_.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(_).position === "static" && (_.style.position = "relative"), _.style.zIndex = "30", _.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const z = (_, N) => {
    E.to = _, Qb(y, l, _, N).forEach((H, j) => {
      n[j].style.transform = H ? `${v}(${H}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return E.to;
    },
    slot: (_) => Lb(y, l, m(_)),
    apply: (_, N) => {
      S || z(_, m(N) - f);
    },
    rest: () => {
      S || z(l, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((_, N) => pf.forEach((H, j) => {
        _.style[H] = k[N][j];
      })));
    }
  };
}
const Xb = 5;
let $o = !1;
function Zb(n, l) {
  if (n.button !== 0 || $o) return;
  const i = { clientX: n.clientX, clientY: n.clientY }, o = n.currentTarget, s = n.pointerId;
  let d = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, y = (E) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", k), window.removeEventListener("pointerup", b), window.removeEventListener("pointercancel", v), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", v), o.removeEventListener("lostpointercapture", v);
    try {
      o.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    $o = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, d.end();
    const z = (_) => _.stopPropagation();
    window.addEventListener("click", z, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", z, !0), 0), m?.(), l.onEnd(E, d);
  }, k = (E) => {
    if (!d) {
      if (Math.hypot(E.clientX - i.clientX, E.clientY - i.clientY) < Xb) return;
      const z = l.items();
      d = Kb(z, l.from(z), l.axis, i), $o = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(s);
      } catch {
      }
      o.addEventListener("lostpointercapture", v);
      const _ = l.onStart?.();
      m = typeof _ == "function" ? _ : void 0;
    }
    l.onMove(E, d);
  }, b = () => y(!0), v = () => y(!1), S = (E) => {
    E.key === "Escape" && (E.stopPropagation(), y(!1));
  };
  window.addEventListener("pointermove", k), window.addEventListener("pointerup", b), window.addEventListener("pointercancel", v), window.addEventListener("keydown", S, !0), window.addEventListener("blur", v);
}
const mm = typeof navigator < "u" && /Mac/i.test(navigator.platform), $r = {
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
for (let n = 1; n <= 12; n++) $r[`f${n}`] = `F${n}`;
const Jb = Object.fromEntries(Object.entries($r).map(([n, l]) => [l, n])), Wb = {
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
function Fb(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Jb[n];
}
const hf = /* @__PURE__ */ new Map();
function pm(n, l = mm) {
  const i = `${l}|${n}`, o = hf.get(i);
  if (o) return o;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if ($r[d]) s.code = $r[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return hf.set(i, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = pm(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Ib(n, l = mm) {
  const i = pm(n, l), o = $b(Fb(i.code) ?? "");
  return l ? `${i.ctrl ? "⌃" : ""}${i.alt ? "⌥" : ""}${i.shift ? "⇧" : ""}${i.cmd ? "⌘" : ""}${o}` : [i.ctrl && "Ctrl", i.alt && "Alt", i.shift && "Shift", o].filter(Boolean).join("+");
}
const $b = (n) => Wb[n] ?? n.toUpperCase(), gf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, bf = $f, ai = (n, l) => (i) => {
  var o;
  if (l?.variants == null) return bf(n, i?.class, i?.className);
  const { variants: s, defaultVariants: d } = l, m = Object.keys(s).map((y) => {
    const k = i?.[y], b = d?.[y];
    if (k === null) return null;
    const v = gf(k) || gf(b);
    return s[y][v];
  }), f = i && Object.entries(i).reduce((y, k) => {
    let [b, v] = k;
    return v === void 0 || (y[b] = v), y;
  }, {}), p = l == null || (o = l.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((y, k) => {
    let { class: b, className: v, ...S } = k;
    return Object.entries(S).every((E) => {
      let [z, _] = E;
      return Array.isArray(_) ? _.includes({
        ...d,
        ...f
      }[z]) : {
        ...d,
        ...f
      }[z] === _;
    }) ? [
      ...y,
      b,
      v
    ] : y;
  }, []);
  return bf(n, m, p, i?.class, i?.className);
}, Pb = ai(
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
), tv = ai(
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
function ev({ className: n, ...l } = {}) {
  return Ut(tv(l), n);
}
const hm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", js = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", nv = ai(`${js} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function av({ className: n, ...l } = {}) {
  return Ut(nv(l), n);
}
const li = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", ms = ai(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), lv = "my-1 h-px bg-overlay-0";
function rv({ size: n = 14, className: l }) {
  return /* @__PURE__ */ tt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ tt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ tt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ tt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function iv({ size: n = 16, className: l }) {
  return /* @__PURE__ */ tt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ tt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ tt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function ov({ size: n = 14, className: l }) {
  return /* @__PURE__ */ tt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ tt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function gm({ size: n = 14, className: l }) {
  return /* @__PURE__ */ tt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ tt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const vf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function sv({ state: n, error: l }) {
  return /* @__PURE__ */ tt.jsx(
    "span",
    {
      className: Ut("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", vf[n] ?? vf.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function cv({ title: n, onClose: l, children: i, testId: o }) {
  return Tl(
    /* @__PURE__ */ tt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ tt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": o,
            children: [
              /* @__PURE__ */ tt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              i
            ]
          }
        )
      }
    ),
    document.body
  );
}
const Dr = 4, Dn = 8, uv = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", yf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function dv({ value: n, onChange: l, options: i, className: o, ariaLabel: s, testId: d, id: m, title: f, disabled: p, placeholder: y, freeText: k, onKeyDown: b }) {
  const v = nt.useId(), [S, E] = nt.useState(!1), [z, _] = nt.useState(-1), [N, H] = nt.useState(!1), j = nt.useRef(null), X = nt.useRef(null), [q, R] = nt.useState({}), h = nt.useRef({ text: "", at: 0 }), x = k && N && n ? i.filter((L) => yf(L).toLowerCase().includes(n.toLowerCase()) || L.value.toLowerCase().includes(n.toLowerCase())) : i, w = i.find((L) => L.value === n), M = (L) => `${v}-${L}`;
  function O(L) {
    p || (_(L), E(!0));
  }
  function A() {
    E(!1), H(!1), _(-1);
  }
  function B(L) {
    !L || L.disabled || (l(L.value), A());
  }
  function K(L, V) {
    for (let T = 1; T <= x.length; T++) {
      const Z = (L + V * T + x.length * T) % x.length;
      if (!x[Z].disabled) return Z;
    }
    return L;
  }
  const F = () => x.findIndex((L) => !L.disabled), Q = () => x.length - 1 - [...x].reverse().findIndex((L) => !L.disabled);
  Kr(() => {
    if (!S || !j.current) {
      R((at) => at.left === void 0 ? at : {});
      return;
    }
    const L = j.current.getBoundingClientRect(), V = window.innerHeight - L.bottom - Dr - Dn, T = L.top - Dr - Dn, Z = V < 160 && T > V;
    R({
      position: "fixed",
      left: Math.min(Math.max(Dn, L.left), Math.max(Dn, window.innerWidth - L.width - Dn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: L.width,
      maxWidth: window.innerWidth - 2 * Dn,
      maxHeight: Math.min(Z ? T : V, 320),
      ...Z ? { bottom: window.innerHeight - L.top + Dr } : { top: L.bottom + Dr },
      overflowY: "auto"
    });
  }, [S, x.length]), Kr(() => {
    const L = X.current;
    if (!S || !L || q.left === void 0) return;
    const V = L.getBoundingClientRect().right, T = window.innerWidth - Dn;
    V > T && R((Z) => ({ ...Z, left: Math.max(Dn, Number(Z.left) - (V - T)) }));
  }, [S, q]), oe(() => {
    if (!S) return;
    const L = (V) => {
      const T = V.target;
      (T === document || T instanceof Node && j.current && T.contains(j.current)) && A();
    };
    return window.addEventListener("resize", A), window.addEventListener("scroll", L, !0), () => {
      window.removeEventListener("resize", A), window.removeEventListener("scroll", L, !0);
    };
  }, [S]), oe(() => {
    const L = S && z >= 0 ? document.getElementById(M(z)) : null, V = X.current;
    !L || !V || (L.offsetTop < V.scrollTop ? V.scrollTop = L.offsetTop : L.offsetTop + L.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = L.offsetTop + L.offsetHeight - V.clientHeight));
  }, [S, z]), ym(S, (L) => {
    L || A();
  }, j, X);
  function J(L) {
    if (L.nativeEvent.isComposing) return;
    const V = () => {
      L.preventDefault(), L.stopPropagation();
    }, { key: T } = L;
    if (S) {
      if (T === "Escape") {
        V(), A();
        return;
      } else if (T === "Tab")
        A();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        V(), x.length && _(z < 0 ? T === "ArrowDown" ? F() : Q() : K(z, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !k) {
        V(), _(F());
        return;
      } else if (T === "End" && !k) {
        V(), _(Q());
        return;
      } else if (T === "Enter" || T === " " && !k) {
        if (z >= 0 && x[z]) {
          V(), B(x[z]);
          return;
        }
        if (!k) {
          V(), A();
          return;
        }
      } else if (!k && T.length === 1 && !L.metaKey && !L.ctrlKey && !L.altKey) {
        const Z = Date.now();
        h.current = { text: (Z - h.current.at > 600 ? "" : h.current.text) + T.toLowerCase(), at: Z };
        const at = Math.max(z, 0), st = [...x.slice(at + (h.current.text.length === 1 ? 1 : 0)), ...x.slice(0, at + 1)].find((ct) => !ct.disabled && yf(ct).toLowerCase().startsWith(h.current.text));
        st && (V(), _(x.indexOf(st)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !k && (T === "Enter" || T === " ")) {
      V(), O(Math.max(0, x.findIndex((Z) => Z.value === n)));
      return;
    }
    b?.(L);
  }
  const I = {
    ref: (L) => {
      j.current = L;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": s,
    "aria-expanded": S,
    "aria-controls": S ? v : void 0,
    "aria-activedescendant": S && z >= 0 ? M(z) : void 0,
    "data-testid": d,
    onKeyDown: J
  };
  return /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
    k ? /* @__PURE__ */ tt.jsx(
      "input",
      {
        ...I,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: y,
        className: o,
        value: n,
        onChange: (L) => {
          l(L.target.value), H(!0), S ? _(-1) : (_(-1), E(!0));
        },
        onBlur: () => A()
      }
    ) : /* @__PURE__ */ tt.jsxs(
      "button",
      {
        ...I,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Ut("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", o),
        onClick: () => S ? A() : O(Math.max(0, x.findIndex((L) => L.value === n))),
        children: [
          /* @__PURE__ */ tt.jsx("span", { className: "min-w-0 flex-1 truncate", children: w ? w.label : y ?? "" }),
          /* @__PURE__ */ tt.jsx(Ds, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && x.length > 0 && Tl(
      /* @__PURE__ */ tt.jsx(
        "div",
        {
          ref: X,
          id: v,
          role: "listbox",
          "aria-label": s,
          className: Ut("z-[9999]", li),
          style: q,
          onMouseDown: (L) => {
            L.preventDefault(), L.stopPropagation();
          },
          onClick: (L) => L.stopPropagation(),
          children: x.map((L, V) => /* @__PURE__ */ tt.jsxs(
            "div",
            {
              id: M(V),
              role: "option",
              "aria-selected": L.value === n,
              "aria-disabled": L.disabled || void 0,
              "data-value": L.value,
              className: Ut(uv, V === z && !L.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                L.disabled || _(V);
              },
              onClick: () => B(L),
              children: [
                /* @__PURE__ */ tt.jsx("span", { className: "min-w-0 truncate", children: L.label }),
                L.value === n && /* @__PURE__ */ tt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const xf = 230, fv = 370;
function mv({ x: n, y: l, readOnly: i, canUndo: o, canRedo: s, hasSelection: d, onClose: m, actions: f }) {
  const p = nt.useRef(null);
  oe(() => {
    const v = (E) => {
      p.current?.contains(E.target) || m();
    }, S = (E) => {
      E.key === "Escape" && (E.preventDefault(), m());
    };
    return document.addEventListener("mousedown", v), document.addEventListener("keydown", S), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", v), document.removeEventListener("keydown", S), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const y = (v, S) => bs(Sm ? v : S), k = (v, S, E, z, _ = !1) => /* @__PURE__ */ tt.jsxs("button", { type: "button", className: Ut(Em(), "flex items-center justify-between gap-6"), "data-testid": E, disabled: _, onClick: S, children: [
    /* @__PURE__ */ tt.jsx("span", { children: v }),
    /* @__PURE__ */ tt.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: z })
  ] }), b = f.askAgent;
  return Tl(
    /* @__PURE__ */ tt.jsxs(
      "div",
      {
        ref: p,
        className: li,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(l, window.innerHeight - fv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - xf - 8)),
          zIndex: 9999,
          minWidth: xf
        },
        onContextMenu: (v) => v.preventDefault(),
        children: [
          b && /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
            k(d ? "Ask agent about selection…" : "Ask agent about file…", b, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ tt.jsx("div", { className: Vr })
          ] }),
          k("Undo", f.undo, "editor-menu-undo", y("cmd+z", "ctrl+z"), i || !o),
          k("Redo", f.redo, "editor-menu-redo", y("cmd+shift+z", "ctrl+y"), i || !s),
          /* @__PURE__ */ tt.jsx("div", { className: Vr }),
          k("Cut", f.cut, "editor-menu-cut", y("cmd+x", "ctrl+x"), i || !d),
          k("Copy", f.copy, "editor-menu-copy", y("cmd+c", "ctrl+c"), !d),
          k("Paste", f.paste, "editor-menu-paste", y("cmd+v", "ctrl+v"), i),
          k("Select All", f.selectAll, "editor-menu-select-all", y("cmd+a", "ctrl+a")),
          /* @__PURE__ */ tt.jsx("div", { className: Vr }),
          k("Find…", f.find, "editor-menu-find", y("cmd+f", "ctrl+f")),
          !i && k("Replace…", f.replace, "editor-menu-replace", y("cmd+alt+f", "ctrl+h")),
          k("Go to Line…", f.gotoLine, "editor-menu-goto", bs("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const pv = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", hv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", gv = "m-0 mb-2 text-[0.82rem] text-subtext-0", bm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Os = `${bm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, bv = `${Os} min-w-[5.5rem] shrink-0`, Rs = `${bm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, vv = `${Rs} flex-1 max-[700px]:flex-[1_1_100%]`, yv = `${Rs} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, xv = `${Rs} flex-[1_1_100%]`, wv = "flex flex-wrap items-center gap-[0.4rem]", _v = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", kv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", Sv = `settings-modal__host-row ${kv}`, Ev = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", zv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", vm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", Nv = `${vm} bg-accent`, Tv = `${vm} ml-auto bg-red`;
function Ds({ open: n, size: l = 12, className: i }) {
  return /* @__PURE__ */ tt.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ tt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Cv({ label: n, items: l, testId: i, side: o = "right", up: s = !1, maxHeight: d = 320 }) {
  const [m, f] = nt.useState(!1), [p, y] = nt.useState(!1), k = nt.useRef(null), b = nt.useRef(null), v = () => [...b.current?.querySelectorAll('[role="menuitem"]') ?? []];
  oe(() => {
    m && p && (v()[0]?.focus(), y(!1));
  }, [m, p]);
  const S = () => {
    f(!0), y(!0);
  }, E = (_) => {
    (_.key === "ArrowRight" || _.key === "Enter" || _.key === " ") && (_.preventDefault(), S());
  }, z = (_) => {
    const N = v(), H = N.findIndex((j) => j === document.activeElement);
    _.key === "ArrowDown" || _.key === "ArrowUp" ? (_.preventDefault(), N[(H + (_.key === "ArrowDown" ? 1 : N.length - 1)) % N.length]?.focus()) : (_.key === "ArrowLeft" || _.key === "Escape") && (_.preventDefault(), _.stopPropagation(), f(!1), k.current?.focus());
  };
  return /* @__PURE__ */ tt.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ tt.jsxs(
      "button",
      {
        ref: k,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: Ut(ms(), "flex items-center justify-between gap-2"),
        "data-testid": i,
        onClick: () => m ? f(!1) : S(),
        onKeyDown: E,
        children: [
          /* @__PURE__ */ tt.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ tt.jsx(Ds, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ tt.jsx(
      "div",
      {
        ref: b,
        role: "menu",
        "aria-label": n,
        className: Ut(
          li,
          "absolute z-10 w-60 overflow-y-auto",
          o === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: d },
        onKeyDown: z,
        children: l.map((_) => /* @__PURE__ */ tt.jsx("button", { type: "button", role: "menuitem", className: ms(), "data-testid": _.testId, onClick: _.onSelect, children: /* @__PURE__ */ tt.jsx("span", { className: "block truncate", children: _.label }) }, _.key))
      }
    )
  ] });
}
function Mv(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const ps = {
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
function hs(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((i) => i.id === n.parentSessionId);
}
function Av(n) {
  const l = /* @__PURE__ */ new Map();
  for (const i of n)
    hs(i, n) && l.set(i.parentSessionId, [...l.get(i.parentSessionId) ?? [], i]);
  return l.size ? n.filter((i) => !hs(i, n)).flatMap((i) => [i, ...l.get(i.id) ?? []]) : n;
}
const Hr = 6, wf = 8;
function jv(n, l = {}) {
  const { minWidth: i = 220, align: o = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = o === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, y = d.top - Hr - wf, k = f - d.bottom - Hr - wf;
  return y >= s ? {
    position: "fixed",
    bottom: f - d.top + Hr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(y, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Hr,
    ...p,
    minWidth: i,
    maxHeight: Math.min(k, f * 0.75),
    overflowY: "auto"
  };
}
function ym(n, l, i, o) {
  oe(() => {
    if (!n) return;
    function s(m) {
      const f = m.target, p = i.current?.contains(f) ?? !1, y = o.current?.contains(f) ?? !1;
      !p && !y && l(!1);
    }
    function d(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function Ov({ icon: n, fallback: l }) {
  const [i, o] = nt.useState(!1);
  return oe(() => o(!1), [n]), !n || i ? /* @__PURE__ */ tt.jsx(tt.Fragment, { children: l }) : /* @__PURE__ */ tt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const Rv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", xm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", Dv = `${xm} group-aria-[checked=false]:text-accent`, Hv = `${xm} group-aria-checked:text-accent`, Bv = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", Uv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function qv({
  mode: n,
  onChange: l,
  testId: i = "mode-switch",
  disabled: o = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ tt.jsxs(
    "button",
    {
      type: "button",
      className: Rv,
      "data-testid": i,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__label mode-switch__label--ui", Dv), children: "UI" }),
        /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__track", Bv), children: /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__thumb", Uv) }) }),
        /* @__PURE__ */ tt.jsx("span", { className: Ut("mode-switch__label mode-switch__label--cli", Hv), children: "CLI" })
      ]
    }
  );
}
const Ga = function(n, l) {
  let s = n;
  const d = wl[l];
  let m = null, f = 0, p = null;
  const y = [], k = {}, b = function(h, x) {
    f = s * 4 + 17, m = (function(w) {
      const M = new Array(w);
      for (let O = 0; O < w; O += 1) {
        M[O] = new Array(w);
        for (let A = 0; A < w; A += 1)
          M[O][A] = null;
      }
      return M;
    })(f), v(0, 0), v(f - 7, 0), v(0, f - 7), z(), E(), N(h, x), s >= 7 && _(h), p == null && (p = X(s, d, y)), H(p, x);
  }, v = function(h, x) {
    for (let w = -1; w <= 7; w += 1)
      if (!(h + w <= -1 || f <= h + w))
        for (let M = -1; M <= 7; M += 1)
          x + M <= -1 || f <= x + M || (0 <= w && w <= 6 && (M == 0 || M == 6) || 0 <= M && M <= 6 && (w == 0 || w == 6) || 2 <= w && w <= 4 && 2 <= M && M <= 4 ? m[h + w][x + M] = !0 : m[h + w][x + M] = !1);
  }, S = function() {
    let h = 0, x = 0;
    for (let w = 0; w < 8; w += 1) {
      b(!0, w);
      const M = Bn.getLostPoint(k);
      (w == 0 || h > M) && (h = M, x = w);
    }
    return x;
  }, E = function() {
    for (let h = 8; h < f - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < f - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, z = function() {
    const h = Bn.getPatternPosition(s);
    for (let x = 0; x < h.length; x += 1)
      for (let w = 0; w < h.length; w += 1) {
        const M = h[x], O = h[w];
        if (m[M][O] == null)
          for (let A = -2; A <= 2; A += 1)
            for (let B = -2; B <= 2; B += 1)
              A == -2 || A == 2 || B == -2 || B == 2 || A == 0 && B == 0 ? m[M + A][O + B] = !0 : m[M + A][O + B] = !1;
      }
  }, _ = function(h) {
    const x = Bn.getBCHTypeNumber(s);
    for (let w = 0; w < 18; w += 1) {
      const M = !h && (x >> w & 1) == 1;
      m[Math.floor(w / 3)][w % 3 + f - 8 - 3] = M;
    }
    for (let w = 0; w < 18; w += 1) {
      const M = !h && (x >> w & 1) == 1;
      m[w % 3 + f - 8 - 3][Math.floor(w / 3)] = M;
    }
  }, N = function(h, x) {
    const w = d << 3 | x, M = Bn.getBCHTypeInfo(w);
    for (let O = 0; O < 15; O += 1) {
      const A = !h && (M >> O & 1) == 1;
      O < 6 ? m[O][8] = A : O < 8 ? m[O + 1][8] = A : m[f - 15 + O][8] = A;
    }
    for (let O = 0; O < 15; O += 1) {
      const A = !h && (M >> O & 1) == 1;
      O < 8 ? m[8][f - O - 1] = A : O < 9 ? m[8][15 - O - 1 + 1] = A : m[8][15 - O - 1] = A;
    }
    m[f - 8][8] = !h;
  }, H = function(h, x) {
    let w = -1, M = f - 1, O = 7, A = 0;
    const B = Bn.getMaskFunction(x);
    for (let K = f - 1; K > 0; K -= 2)
      for (K == 6 && (K -= 1); ; ) {
        for (let F = 0; F < 2; F += 1)
          if (m[M][K - F] == null) {
            let Q = !1;
            A < h.length && (Q = (h[A] >>> O & 1) == 1), B(M, K - F) && (Q = !Q), m[M][K - F] = Q, O -= 1, O == -1 && (A += 1, O = 7);
          }
        if (M += w, M < 0 || f <= M) {
          M -= w, w = -w;
          break;
        }
      }
  }, j = function(h, x) {
    let w = 0, M = 0, O = 0;
    const A = new Array(x.length), B = new Array(x.length);
    for (let J = 0; J < x.length; J += 1) {
      const I = x[J].dataCount, L = x[J].totalCount - I;
      M = Math.max(M, I), O = Math.max(O, L), A[J] = new Array(I);
      for (let at = 0; at < A[J].length; at += 1)
        A[J][at] = 255 & h.getBuffer()[at + w];
      w += I;
      const V = Bn.getErrorCorrectPolynomial(L), Z = zl(A[J], V.getLength() - 1).mod(V);
      B[J] = new Array(V.getLength() - 1);
      for (let at = 0; at < B[J].length; at += 1) {
        const st = at + Z.getLength() - B[J].length;
        B[J][at] = st >= 0 ? Z.getAt(st) : 0;
      }
    }
    let K = 0;
    for (let J = 0; J < x.length; J += 1)
      K += x[J].totalCount;
    const F = new Array(K);
    let Q = 0;
    for (let J = 0; J < M; J += 1)
      for (let I = 0; I < x.length; I += 1)
        J < A[I].length && (F[Q] = A[I][J], Q += 1);
    for (let J = 0; J < O; J += 1)
      for (let I = 0; I < x.length; I += 1)
        J < B[I].length && (F[Q] = B[I][J], Q += 1);
    return F;
  }, X = function(h, x, w) {
    const M = _f.getRSBlocks(h, x), O = kf();
    for (let B = 0; B < w.length; B += 1) {
      const K = w[B];
      O.put(K.getMode(), 4), O.put(K.getLength(), Bn.getLengthInBits(K.getMode(), h)), K.write(O);
    }
    let A = 0;
    for (let B = 0; B < M.length; B += 1)
      A += M[B].dataCount;
    if (O.getLengthInBits() > A * 8)
      throw "code length overflow. (" + O.getLengthInBits() + ">" + A * 8 + ")";
    for (O.getLengthInBits() + 4 <= A * 8 && O.put(0, 4); O.getLengthInBits() % 8 != 0; )
      O.putBit(!1);
    for (; !(O.getLengthInBits() >= A * 8 || (O.put(236, 8), O.getLengthInBits() >= A * 8)); )
      O.put(17, 8);
    return j(O, M);
  };
  k.addData = function(h, x) {
    x = x || "Byte";
    let w = null;
    switch (x) {
      case "Numeric":
        w = Gv(h);
        break;
      case "Alphanumeric":
        w = Yv(h);
        break;
      case "Byte":
        w = Lv(h);
        break;
      case "Kanji":
        w = Qv(h);
        break;
      default:
        throw "mode:" + x;
    }
    y.push(w), p = null;
  }, k.isDark = function(h, x) {
    if (h < 0 || f <= h || x < 0 || f <= x)
      throw h + "," + x;
    return m[h][x];
  }, k.getModuleCount = function() {
    return f;
  }, k.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const x = _f.getRSBlocks(h, d), w = kf();
        for (let O = 0; O < y.length; O++) {
          const A = y[O];
          w.put(A.getMode(), 4), w.put(A.getLength(), Bn.getLengthInBits(A.getMode(), h)), A.write(w);
        }
        let M = 0;
        for (let O = 0; O < x.length; O++)
          M += x[O].dataCount;
        if (w.getLengthInBits() <= M * 8)
          break;
      }
      s = h;
    }
    b(!1, S());
  }, k.createTableTag = function(h, x) {
    h = h || 2, x = typeof x > "u" ? h * 4 : x;
    let w = "";
    w += '<table style="', w += " border-width: 0px; border-style: none;", w += " border-collapse: collapse;", w += " padding: 0px; margin: " + x + "px;", w += '">', w += "<tbody>";
    for (let M = 0; M < k.getModuleCount(); M += 1) {
      w += "<tr>";
      for (let O = 0; O < k.getModuleCount(); O += 1)
        w += '<td style="', w += " border-width: 0px; border-style: none;", w += " border-collapse: collapse;", w += " padding: 0px; margin: 0px;", w += " width: " + h + "px;", w += " height: " + h + "px;", w += " background-color: ", w += k.isDark(M, O) ? "#000000" : "#ffffff", w += ";", w += '"/>';
      w += "</tr>";
    }
    return w += "</tbody>", w += "</table>", w;
  }, k.createSvgTag = function(h, x, w, M) {
    let O = {};
    typeof arguments[0] == "object" && (O = arguments[0], h = O.cellSize, x = O.margin, w = O.alt, M = O.title), h = h || 2, x = typeof x > "u" ? h * 4 : x, w = typeof w == "string" ? { text: w } : w || {}, w.text = w.text || null, w.id = w.text ? w.id || "qrcode-description" : null, M = typeof M == "string" ? { text: M } : M || {}, M.text = M.text || null, M.id = M.text ? M.id || "qrcode-title" : null;
    const A = k.getModuleCount() * h + x * 2;
    let B, K, F, Q, J = "", I;
    for (I = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", J += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', J += O.scalable ? "" : ' width="' + A + 'px" height="' + A + 'px"', J += ' viewBox="0 0 ' + A + " " + A + '" ', J += ' preserveAspectRatio="xMinYMin meet"', J += M.text || w.text ? ' role="img" aria-labelledby="' + q([M.id, w.id].join(" ").trim()) + '"' : "", J += ">", J += M.text ? '<title id="' + q(M.id) + '">' + q(M.text) + "</title>" : "", J += w.text ? '<description id="' + q(w.id) + '">' + q(w.text) + "</description>" : "", J += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', J += '<path d="', F = 0; F < k.getModuleCount(); F += 1)
      for (Q = F * h + x, B = 0; B < k.getModuleCount(); B += 1)
        k.isDark(F, B) && (K = B * h + x, J += "M" + K + "," + Q + I);
    return J += '" stroke="transparent" fill="black"/>', J += "</svg>", J;
  }, k.createDataURL = function(h, x) {
    h = h || 2, x = typeof x > "u" ? h * 4 : x;
    const w = k.getModuleCount() * h + x * 2, M = x, O = w - x;
    return Zv(w, w, function(A, B) {
      if (M <= A && A < O && M <= B && B < O) {
        const K = Math.floor((A - M) / h), F = Math.floor((B - M) / h);
        return k.isDark(F, K) ? 0 : 1;
      } else
        return 1;
    });
  }, k.createImgTag = function(h, x, w) {
    h = h || 2, x = typeof x > "u" ? h * 4 : x;
    const M = k.getModuleCount() * h + x * 2;
    let O = "";
    return O += "<img", O += ' src="', O += k.createDataURL(h, x), O += '"', O += ' width="', O += M, O += '"', O += ' height="', O += M, O += '"', w && (O += ' alt="', O += q(w), O += '"'), O += "/>", O;
  };
  const q = function(h) {
    let x = "";
    for (let w = 0; w < h.length; w += 1) {
      const M = h.charAt(w);
      switch (M) {
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
          x += M;
          break;
      }
    }
    return x;
  }, R = function(h) {
    h = typeof h > "u" ? 2 : h;
    const w = k.getModuleCount() * 1 + h * 2, M = h, O = w - h;
    let A, B, K, F, Q;
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
    let L = "";
    for (A = 0; A < w; A += 2) {
      for (K = Math.floor((A - M) / 1), F = Math.floor((A + 1 - M) / 1), B = 0; B < w; B += 1)
        Q = "█", M <= B && B < O && M <= A && A < O && k.isDark(K, Math.floor((B - M) / 1)) && (Q = " "), M <= B && B < O && M <= A + 1 && A + 1 < O && k.isDark(F, Math.floor((B - M) / 1)) ? Q += " " : Q += "█", L += h < 1 && A + 1 >= O ? I[Q] : J[Q];
      L += `
`;
    }
    return w % 2 && h > 0 ? L.substring(0, L.length - w - 1) + Array(w + 1).join("▀") : L.substring(0, L.length - 1);
  };
  return k.createASCII = function(h, x) {
    if (h = h || 1, h < 2)
      return R(x);
    h -= 1, x = typeof x > "u" ? h * 2 : x;
    const w = k.getModuleCount() * h + x * 2, M = x, O = w - x;
    let A, B, K, F;
    const Q = Array(h + 1).join("██"), J = Array(h + 1).join("  ");
    let I = "", L = "";
    for (A = 0; A < w; A += 1) {
      for (K = Math.floor((A - M) / h), L = "", B = 0; B < w; B += 1)
        F = 1, M <= B && B < O && M <= A && A < O && k.isDark(K, Math.floor((B - M) / h)) && (F = 0), L += F ? Q : J;
      for (K = 0; K < h; K += 1)
        I += L + `
`;
    }
    return I.substring(0, I.length - 1);
  }, k.renderTo2dContext = function(h, x) {
    x = x || 2;
    const w = k.getModuleCount();
    for (let M = 0; M < w; M++)
      for (let O = 0; O < w; O++)
        h.fillStyle = k.isDark(M, O) ? "black" : "white", h.fillRect(O * x, M * x, x, x);
  }, k;
};
Ga.stringToBytes = function(n) {
  const l = [];
  for (let i = 0; i < n.length; i += 1) {
    const o = n.charCodeAt(i);
    l.push(o & 255);
  }
  return l;
};
Ga.createStringToBytes = function(n, l) {
  const i = (function() {
    const s = Kv(n), d = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const y = d(), k = d(), b = d(), v = String.fromCharCode(p << 8 | y), S = k << 8 | b;
      f[v] = S, m += 1;
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
        const p = i[s.charAt(m)];
        typeof p == "number" ? (p & 255) == p ? d.push(p) : (d.push(p >>> 8), d.push(p & 255)) : d.push(o);
      }
    }
    return d;
  };
};
const de = {
  MODE_NUMBER: 1,
  MODE_ALPHA_NUM: 2,
  MODE_8BIT_BYTE: 4,
  MODE_KANJI: 8
}, wl = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
}, Hn = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
}, Bn = (function() {
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
      case Hn.PATTERN000:
        return function(f, p) {
          return (f + p) % 2 == 0;
        };
      case Hn.PATTERN001:
        return function(f, p) {
          return f % 2 == 0;
        };
      case Hn.PATTERN010:
        return function(f, p) {
          return p % 3 == 0;
        };
      case Hn.PATTERN011:
        return function(f, p) {
          return (f + p) % 3 == 0;
        };
      case Hn.PATTERN100:
        return function(f, p) {
          return (Math.floor(f / 2) + Math.floor(p / 3)) % 2 == 0;
        };
      case Hn.PATTERN101:
        return function(f, p) {
          return f * p % 2 + f * p % 3 == 0;
        };
      case Hn.PATTERN110:
        return function(f, p) {
          return (f * p % 2 + f * p % 3) % 2 == 0;
        };
      case Hn.PATTERN111:
        return function(f, p) {
          return (f * p % 3 + (f + p) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + m;
    }
  }, s.getErrorCorrectPolynomial = function(m) {
    let f = zl([1], 0);
    for (let p = 0; p < m; p += 1)
      f = f.multiply(zl([1, Un.gexp(p)], 0));
    return f;
  }, s.getLengthInBits = function(m, f) {
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
  }, s.getLostPoint = function(m) {
    const f = m.getModuleCount();
    let p = 0;
    for (let b = 0; b < f; b += 1)
      for (let v = 0; v < f; v += 1) {
        let S = 0;
        const E = m.isDark(b, v);
        for (let z = -1; z <= 1; z += 1)
          if (!(b + z < 0 || f <= b + z))
            for (let _ = -1; _ <= 1; _ += 1)
              v + _ < 0 || f <= v + _ || z == 0 && _ == 0 || E == m.isDark(b + z, v + _) && (S += 1);
        S > 5 && (p += 3 + S - 5);
      }
    for (let b = 0; b < f - 1; b += 1)
      for (let v = 0; v < f - 1; v += 1) {
        let S = 0;
        m.isDark(b, v) && (S += 1), m.isDark(b + 1, v) && (S += 1), m.isDark(b, v + 1) && (S += 1), m.isDark(b + 1, v + 1) && (S += 1), (S == 0 || S == 4) && (p += 3);
      }
    for (let b = 0; b < f; b += 1)
      for (let v = 0; v < f - 6; v += 1)
        m.isDark(b, v) && !m.isDark(b, v + 1) && m.isDark(b, v + 2) && m.isDark(b, v + 3) && m.isDark(b, v + 4) && !m.isDark(b, v + 5) && m.isDark(b, v + 6) && (p += 40);
    for (let b = 0; b < f; b += 1)
      for (let v = 0; v < f - 6; v += 1)
        m.isDark(v, b) && !m.isDark(v + 1, b) && m.isDark(v + 2, b) && m.isDark(v + 3, b) && m.isDark(v + 4, b) && !m.isDark(v + 5, b) && m.isDark(v + 6, b) && (p += 40);
    let y = 0;
    for (let b = 0; b < f; b += 1)
      for (let v = 0; v < f; v += 1)
        m.isDark(v, b) && (y += 1);
    const k = Math.abs(100 * y / f / f - 50) / 5;
    return p += k * 10, p;
  }, s;
})(), Un = (function() {
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
})(), zl = function(n, l) {
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
        d[m + f] ^= Un.gexp(Un.glog(o.getAt(m)) + Un.glog(s.getAt(f)));
    return zl(d, 0);
  }, o.mod = function(s) {
    if (o.getLength() - s.getLength() < 0)
      return o;
    const d = Un.glog(o.getAt(0)) - Un.glog(s.getAt(0)), m = new Array(o.getLength());
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] = o.getAt(f);
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] ^= Un.gexp(Un.glog(s.getAt(f)) + d);
    return zl(m, 0).mod(s);
  }, o;
}, _f = (function() {
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
      case wl.L:
        return n[(s - 1) * 4 + 0];
      case wl.M:
        return n[(s - 1) * 4 + 1];
      case wl.Q:
        return n[(s - 1) * 4 + 2];
      case wl.H:
        return n[(s - 1) * 4 + 3];
      default:
        return;
    }
  };
  return i.getRSBlocks = function(s, d) {
    const m = o(s, d);
    if (typeof m > "u")
      throw "bad rs block @ typeNumber:" + s + "/errorCorrectionLevel:" + d;
    const f = m.length / 3, p = [];
    for (let y = 0; y < f; y += 1) {
      const k = m[y * 3 + 0], b = m[y * 3 + 1], v = m[y * 3 + 2];
      for (let S = 0; S < k; S += 1)
        p.push(l(b, v));
    }
    return p;
  }, i;
})(), kf = function() {
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
}, Gv = function(n) {
  const l = de.MODE_NUMBER, i = n, o = {};
  o.getMode = function() {
    return l;
  }, o.getLength = function(m) {
    return i.length;
  }, o.write = function(m) {
    const f = i;
    let p = 0;
    for (; p + 2 < f.length; )
      m.put(s(f.substring(p, p + 3)), 10), p += 3;
    p < f.length && (f.length - p == 1 ? m.put(s(f.substring(p, p + 1)), 4) : f.length - p == 2 && m.put(s(f.substring(p, p + 2)), 7));
  };
  const s = function(m) {
    let f = 0;
    for (let p = 0; p < m.length; p += 1)
      f = f * 10 + d(m.charAt(p));
    return f;
  }, d = function(m) {
    if ("0" <= m && m <= "9")
      return m.charCodeAt(0) - 48;
    throw "illegal char :" + m;
  };
  return o;
}, Yv = function(n) {
  const l = de.MODE_ALPHA_NUM, i = n, o = {};
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
}, Lv = function(n) {
  const l = de.MODE_8BIT_BYTE, i = Ga.stringToBytes(n), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(s) {
    return i.length;
  }, o.write = function(s) {
    for (let d = 0; d < i.length; d += 1)
      s.put(i[d], 8);
  }, o;
}, Qv = function(n) {
  const l = de.MODE_KANJI, i = Ga.stringToBytes;
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
      let p = (255 & m[f]) << 8 | 255 & m[f + 1];
      if (33088 <= p && p <= 40956)
        p -= 33088;
      else if (57408 <= p && p <= 60351)
        p -= 49472;
      else
        throw "illegal char at " + (f + 1) + "/" + p;
      p = (p >>> 8 & 255) * 192 + (p & 255), d.put(p, 13), f += 2;
    }
    if (f < m.length)
      throw "illegal char at " + (f + 1);
  }, s;
}, wm = function() {
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
}, Vv = function() {
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
      for (let p = 0; p < f; p += 1)
        o += "=";
    }
  }, s.toString = function() {
    return o;
  }, s;
}, Kv = function(n) {
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
      const p = l.charAt(i);
      if (i += 1, p == "=")
        return s = 0, -1;
      if (p.match(/^\s$/))
        continue;
      o = o << 6 | m(p.charCodeAt(0)), s += 6;
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
}, Xv = function(n, l) {
  const i = n, o = l, s = new Array(n * l), d = {};
  d.setPixel = function(y, k, b) {
    s[k * i + y] = b;
  }, d.write = function(y) {
    y.writeString("GIF87a"), y.writeShort(i), y.writeShort(o), y.writeByte(128), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(255), y.writeByte(255), y.writeByte(255), y.writeString(","), y.writeShort(0), y.writeShort(0), y.writeShort(i), y.writeShort(o), y.writeByte(0);
    const k = 2, b = f(k);
    y.writeByte(k);
    let v = 0;
    for (; b.length - v > 255; )
      y.writeByte(255), y.writeBytes(b, v, 255), v += 255;
    y.writeByte(b.length - v), y.writeBytes(b, v, b.length - v), y.writeByte(0), y.writeString(";");
  };
  const m = function(y) {
    const k = y;
    let b = 0, v = 0;
    const S = {};
    return S.write = function(E, z) {
      if (E >>> z)
        throw "length over";
      for (; b + z >= 8; )
        k.writeByte(255 & (E << b | v)), z -= 8 - b, E >>>= 8 - b, v = 0, b = 0;
      v = E << b | v, b = b + z;
    }, S.flush = function() {
      b > 0 && k.writeByte(v);
    }, S;
  }, f = function(y) {
    const k = 1 << y, b = (1 << y) + 1;
    let v = y + 1;
    const S = p();
    for (let H = 0; H < k; H += 1)
      S.add(String.fromCharCode(H));
    S.add(String.fromCharCode(k)), S.add(String.fromCharCode(b));
    const E = wm(), z = m(E);
    z.write(k, v);
    let _ = 0, N = String.fromCharCode(s[_]);
    for (_ += 1; _ < s.length; ) {
      const H = String.fromCharCode(s[_]);
      _ += 1, S.contains(N + H) ? N = N + H : (z.write(S.indexOf(N), v), S.size() < 4095 && (S.size() == 1 << v && (v += 1), S.add(N + H)), N = H);
    }
    return z.write(S.indexOf(N), v), z.write(b, v), z.flush(), E.toByteArray();
  }, p = function() {
    const y = {};
    let k = 0;
    const b = {};
    return b.add = function(v) {
      if (b.contains(v))
        throw "dup key:" + v;
      y[v] = k, k += 1;
    }, b.size = function() {
      return k;
    }, b.indexOf = function(v) {
      return y[v];
    }, b.contains = function(v) {
      return typeof y[v] < "u";
    }, b;
  };
  return d;
}, Zv = function(n, l, i) {
  const o = Xv(n, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < n; p += 1)
      o.setPixel(p, f, i(p, f));
  const s = wm();
  o.write(s);
  const d = Vv(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ga.stringToBytes;
function Jv({ text: n }) {
  const { size: l, path: i } = nt.useMemo(() => {
    const o = Ga(0, "M");
    o.addData(n), o.make();
    const s = o.getModuleCount();
    let d = "";
    for (let m = 0; m < s; m++)
      for (let f = 0; f < s; f++) o.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: s, path: d };
  }, [n]);
  return /* @__PURE__ */ tt.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ tt.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ tt.jsx("path", { d: i, fill: "#000" })
      ]
    }
  );
}
const Nl = nt.createContext(""), gs = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function Wv({ title: n, children: l, testId: i, ariaLabel: o }) {
  const s = nt.useContext(Nl), d = s !== "" && gs(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ tt.jsxs("section", { className: s && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": i, "aria-label": o, children: [
      n && /* @__PURE__ */ tt.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ tt.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ tt.jsx(Nl.Provider, { value: d ? "" : s, children: l }) })
    ] })
  );
}
function Fv({ title: n, description: l, children: i, testId: o }) {
  const s = nt.useContext(Nl);
  return s && !gs(n, s) && !gs(l, s) ? null : /* @__PURE__ */ tt.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ tt.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ tt.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ tt.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    i && /* @__PURE__ */ tt.jsx("div", { className: "flex shrink-0 items-center gap-2", children: i })
  ] });
}
function Iv({ checked: n, onChange: l, testId: i, label: o }) {
  return /* @__PURE__ */ tt.jsx(
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
const $v = () => nt.useContext(Nl), Pv = {
  select: Os,
  selectHost: bv,
  input: vv,
  inputPort: yv,
  inputWide: xv,
  addRow: wv,
  list: _v,
  hostRow: Sv,
  name: Ev,
  addr: zv,
  muted: hv,
  empty: gv,
  primary: Nv,
  danger: Tv,
  catalogToggle: pv
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const t1 = 512, Ie = globalThis.__perchResources ??= /* @__PURE__ */ new Map(), kl = /* @__PURE__ */ new Map();
function _m(n, l) {
  Ie.delete(n), Ie.set(n, l);
  for (const i of Ie.keys()) {
    if (Ie.size <= t1) break;
    kl.get(i)?.size || Ie.delete(i);
  }
}
function e1(n, l) {
  return Ie.has(n) ? Ie.get(n) : l;
}
function n1(n, l, i) {
  const o = e1(n, i), s = typeof l == "function" ? l(o) : l;
  if (!(Ie.has(n) && Object.is(s, o))) {
    _m(n, s);
    for (const d of [...kl.get(n) ?? []]) d();
  }
}
function a1(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Ie.has(n) || _m(n, l);
  const i = nt.useCallback((d) => {
    const m = kl.get(n) ?? /* @__PURE__ */ new Set();
    return kl.set(n, m), m.add(d), () => {
      m.delete(d), m.size || kl.delete(n);
    };
  }, [n]), o = nt.useSyncExternalStore(i, () => Ie.get(n)), s = nt.useCallback((d) => n1(n, d, l), [n]);
  return [o, s];
}
function l1(n, l = !1) {
  const i = n.toLowerCase();
  if (l) return { kind: /^(node_modules|packages|crates|vendor)$/.test(i) ? "package" : i === "lib" ? "library" : "folder", tone: "text-subtext-0" };
  if (/^(package\.json|cargo\.toml|go\.mod|pyproject\.toml|gemfile|composer\.json)$/.test(i)) return { kind: "package", tone: "text-peach" };
  if (/^(dockerfile|containerfile)(\.|$)/.test(i)) return { kind: "package", tone: "text-blue" };
  if (/^(\.gitignore|\.gitattributes|\.gitmodules)$/.test(i)) return { kind: "branch", tone: "text-subtext-0" };
  if (/\.(tsx|jsx)$/.test(i)) return { kind: "react", tone: "text-blue" };
  if (/\.(css|scss|sass|less)$/.test(i)) return { kind: "style", tone: "text-mauve" };
  if (/\.(md|mdx|txt|rst)$/.test(i) || /^(readme|license|copying)(\.|$)/.test(i)) return { kind: "book", tone: "text-subtext-0" };
  if (/\.(json|jsonc|ya?ml|toml|lock|ini|conf)$/.test(i) || /^\.env(\.|$)/.test(i)) return { kind: "config", tone: "text-yellow" };
  if (/\.(png|jpe?g|gif|webp|svg|ico|avif)$/.test(i)) return { kind: "image", tone: "text-mauve" };
  const o = i.split(".").at(-1) ?? "", s = {
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
  }, d = n.includes(".") && Object.hasOwn(s, o) ? s[o] : void 0;
  return d ? { kind: "language", tone: d[1], text: d[0] } : /\.(html?|vue|svelte)$/.test(i) ? { kind: "code", tone: "text-peach" } : { kind: "file", tone: "text-subtext-0" };
}
const r1 = {
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
function i1({ name: n, directory: l = !1, open: i = !1 }) {
  const { kind: o, tone: s, text: d } = l1(n, l);
  return /* @__PURE__ */ tt.jsxs("svg", { className: Ut("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": o, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    o === "react" ? /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
      /* @__PURE__ */ tt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ tt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ tt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ tt.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : d ? /* @__PURE__ */ tt.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: d }) : /* @__PURE__ */ tt.jsx("path", { d: o === "folder" && i ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : r1[o] }),
    o === "branch" && /* @__PURE__ */ tt.jsxs(tt.Fragment, { children: [
      /* @__PURE__ */ tt.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ tt.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ tt.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    o === "image" && /* @__PURE__ */ tt.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const o1 = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, Sf = (n) => typeof n == "string" ? o1[n] ?? "?" : "?", Ef = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function s1(n) {
  const l = Sf(n.index), i = Sf(n.worktree), o = l === "!" || i === "!", s = o ? "!" : n.staged && n.unstaged ? `${l || "?"}/${i || "?"}` : n.staged ? l : i || l, d = `Git · Index: ${Ef(n.index)}; working tree: ${Ef(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = o || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: d, tone: m };
}
function c1({ decoration: n, directory: l = !1 }) {
  if (!n) return null;
  if (l && n.containsChanges) return /* @__PURE__ */ tt.jsx("span", { className: Ut("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: i, title: o, tone: s } = s1(n.entry);
  return i ? /* @__PURE__ */ tt.jsx("span", { className: Ut("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": o, title: o, "data-testid": "file-git-marker", children: i }) : null;
}
const u1 = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", d1 = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const f1 = "1.3.0";
let Qr = null;
const m1 = (n) => {
  Qr = n;
};
function _t() {
  const n = (typeof Qr == "function" ? Qr() : Qr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const km = (n) => _t().subscribe?.(n) ?? (() => {
}), p1 = jv;
function h1() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Sm = globalThis.perch?.isMac !== !1, bs = (n) => Ib(n, _t().isMac !== !1), g1 = (n) => Pb(n), b1 = ({ className: n, ...l } = {}) => Ut(ev(l), n), v1 = av, Em = (n) => ms(n), Vr = lv, y1 = js, x1 = hm, w1 = (n) => ps[n].color, _1 = (n, l) => _t().shortcutFor?.(n, l) ?? null, k1 = (n) => _t().shortcutLabel?.(n) ?? null, ri = (n, l) => _t().command(n, l ?? {}) !== !1, S1 = (n, l, i) => _t().startSession?.(n, l, i), E1 = globalThis.perch?.pickFolder ? (n) => _t().pickFolder(n) : null;
function Xt(n) {
  const l = nt.useRef(n);
  return l.current = n, nt.useSyncExternalStore(km, () => l.current(_t()));
}
const zm = (n = {}) => Xt((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), z1 = () => Xt((n) => n.hosts()), N1 = () => Xt((n) => n.sessionFolders());
function T1() {
  const n = Xt((l) => l.addProject?.() ?? C1);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, i, o) => {
      l.trim() && n.status !== "pending" && _t().addProjectFolder?.(l, i, o);
    },
    clear: () => _t().clearAddProject?.()
  };
}
const C1 = Object.freeze({ status: "idle" }), Nm = "perch.lastAgentChoice", M1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), A1 = () => {
  const n = _t().storage?.getItem(Nm);
  return n === "claude" || n === "codex" ? n : "claude";
}, j1 = Object.freeze({ items: [] });
function O1() {
  const n = Xt((l) => l.notifications?.() ?? j1);
  return nt.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => _t().command("notification.open", { id: l }),
    dismiss: (l) => _t().command("notification.dismiss", { id: l })
  }), [n]);
}
function R1(n) {
  const l = Xt((s) => s.agentChoices?.(n) ?? M1), [i, o] = nt.useState(A1);
  return nt.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: i,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (_t().storage?.setItem(Nm, s), o(s));
    },
    manage: () => _t().command("agents.manage", {})
  }), [l, i]);
}
function D1(n) {
  oe(() => _t().onRequest?.("add-project", n) ?? void 0, [n]);
}
function H1(n) {
  const l = n.map((i) => ({ id: i.id, parentSessionId: i.parentId, session: i }));
  return Av(l).map((i) => ({ session: i.session, nested: hs(i, l) }));
}
function B1({ id: n, plain: l, className: i }) {
  const o = Xt((y) => y.session(n));
  if (!o) return null;
  const s = o.state ?? Mv(o), d = ps[s]?.color ?? ps.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? Ut("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", i) : Ut("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", i);
  return nt.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    nt.createElement("span", { className: Ut("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, nt.createElement(Tm, { provider: m, size: 14 }))
  );
}
function Tm({ provider: n, size: l = 14 }) {
  const i = _t().agentIcon?.(n, l) ?? null, o = i?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return nt.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": o, ...i && i.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const U1 = ({ children: n }) => nt.createElement(nt.Fragment, null, n);
function q1(n, l) {
  const i = nt.useRef(l);
  return i.current = l, oe(() => {
    const o = _t();
    if (!o.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(i.current))
      s[m] = typeof f == "function" ? (...p) => i.current[m]?.(...p) : f;
    const d = o.openOverlay(n, s);
    return () => o.closeOverlay?.(d);
  }, [n]), null;
}
const da = (n) => function(i) {
  return q1(n, i);
}, G1 = da("session-menu"), Y1 = da("new-session-menu"), L1 = da("confirm");
let Cm = null;
const Q1 = (n) => {
  Cm = n;
};
function V1(n) {
  return nt.createElement(Cm ?? L1, n);
}
function K1({ className: n = Os, ...l }) {
  return nt.createElement(dv, { ...l, className: n });
}
let vs = null;
const X1 = (n) => {
  vs = n;
}, Z1 = da("folder-browser");
function J1(n) {
  return vs ? nt.createElement(vs, { ...n, browse: (l) => _t().browse(n.hostId, l) }) : nt.createElement(Z1, n);
}
const W1 = da("instructions"), F1 = da("memory"), I1 = cv;
let Hs = null;
const $1 = (n) => {
  Hs = n;
};
function P1(n) {
  if (Hs) return nt.createElement(ey, n);
  const { hostId: l, path: i, className: o } = n, s = nt.useRef(null);
  return nt.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Ut("worktree-menu__btn", hm, o),
      "data-testid": `worktree-menu-${l}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => _t().openOverlay?.("worktree", { hostId: l, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    nt.createElement(gm, null)
  );
}
const Mm = "Perch did not answer.";
function Br(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Mm };
}
function ty(n, l, i = _t()) {
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
const zf = 5 * 6e4;
function Am(n, l, i, o = _t()) {
  const s = Date.now() + zf;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(y);
  }, p = () => {
    if (!d) {
      if (Date.now() >= s) return f();
      ty(n, l, o) && (f(), o.startSession?.(n, l, i));
    }
  }, y = setTimeout(f, zf);
  m = o.subscribe?.(p) ?? (() => {
  }), p();
}
function ey({ hostId: n, path: l, className: i, worktrees: o, request: s, parentChoices: d, emptyAgent: m, ...f }) {
  const [p, y] = nt.useState(o), k = (M) => !!_t().coreCan?.(M, n), b = zm(), v = `${n}:${l}`, S = nt.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!k("workspace.nest")) return [];
    const M = b?.projects?.find((B) => B.hostId === n && B.repoPath === l), O = [], A = (B, K) => {
      for (const F of B ?? [])
        K && O.push({ id: F.id, name: F.name, path: F.path }), A(F.children, !0);
    };
    return A(M?.workspaces, !1), O;
  }, [d, b, n, l]), E = n === "local" && k("worktree.job"), z = f.deleteSupported ?? k("worktree.delete"), _ = f.startFromSupported ?? k("worktree.startFrom"), N = Xt((M) => M.emptyWorkspaceAgent?.() ?? void 0), H = m ?? N ?? void 0, j = Xt((M) => M.worktreeMenuRequest?.() ?? null), X = j?.projectKey === v ? j.nonce : null, q = nt.useMemo(() => s ?? (X == null ? null : j), [s, X]), [R, h] = nt.useState(q);
  oe(() => {
    q && h(q);
  }, [q]);
  const x = nt.useRef({});
  x.current = { background: E, deleteSupported: z };
  const w = nt.useMemo(() => {
    const M = (O, A) => _t().ask(O, { hostId: n, repoPath: l, ...A });
    return {
      list: async () => {
        const O = await M("worktree.list", {});
        return O?.type === "worktree.list.result" && y({ worktrees: O.worktrees ?? [], defaultRoot: O.defaultRoot ?? "", baseRef: O.baseRef, refs: O.refs ?? [] }), Br(O);
      },
      create: async ({ branch: O, newBranch: A, path: B, extra: K, agent: F }) => {
        const Q = { branch: O, newBranch: !!A, path: B ?? null, name: K?.name ?? null, startFrom: K?.startFrom ?? null, parentWorkspaceId: K?.parentWorkspaceId ?? null }, { background: J } = x.current, I = await M(J ? "worktree.job.start" : "worktree.create", Q), L = J ? "worktree.job.started" : "worktree.done";
        if (I?.type !== L) return { error: Br(I).error ?? Mm };
        const V = J ? I.job?.path : I.path;
        return F && V && Am(n, V, F), { background: J };
      },
      remove: async (O, A) => {
        const B = await M("worktree.remove", { path: O, force: !!A, deleteBranch: x.current.deleteSupported });
        return { ...Br(B), preservedBranch: B?.type === "worktree.done" ? B.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (O, A) => Br(await M("worktree.branch.delete", { branch: O, expectedHead: A })),
      open: (O) => _t().startSession?.(n, O, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => _t().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return nt.createElement(Hs, {
    hostId: n,
    cwd: l,
    projectKey: v,
    className: i,
    worktrees: p,
    background: E,
    startFromSupported: _,
    deleteSupported: z,
    parentChoices: S,
    emptyAgent: H,
    request: R,
    actions: w
  });
}
const ny = (n, l) => {
  if (!_t().followPointer?.(n)) return;
  const i = l.items();
  for (const o of i) o.getBoundingClientRect();
  i[0]?.parentElement?.getBoundingClientRect(), Zb(n, l);
}, ay = () => Xt((n) => n.workspaceTabs()), ly = () => Xt((n) => n.statusLine()), ry = () => Xt((n) => n.zoom()), iy = () => Xt((n) => n.paneLook()), oy = () => Xt((n) => n.keybindings?.() ?? []), sy = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function cy(n) {
  const l = !!n?.keepFresh, i = Xt((s) => s.statusLine?.().connected ?? !1), o = Xt((s) => s.planUsage?.() ?? sy);
  return oe(() => {
    if (!l || !i) return;
    let s;
    const d = () => {
      _t().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, i]), o;
}
const uy = () => _t().command("usage.get", { force: !0 }), dy = (n) => _t().command("usage.redeemReset", { accountId: n }), fy = () => ri("app.zoom_reset"), my = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, py = (n, l, i) => _t().beginTabDrag?.(n, l, i);
function hy(n) {
  oe(() => _t().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const gy = (n) => ri("browser.open", { workspaceId: n }), by = (n, l) => ri("file.open", { workspaceId: n, path: l }), vy = () => null, yy = () => null, xy = da("new-file"), wy = [
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
], _y = /* @__PURE__ */ new Set(["discardPreview", "commitPreview", "previewBatch", "sendBatch"]);
function ky(n) {
  const l = {};
  for (const i of wy)
    l[i] = (...o) => {
      const s = _t().gitDo(i, n, ...o);
      return _y.has(i) ? s.then((d) => d ?? null, () => null) : (s.catch?.((d) => console.error(`perch: ${i}: ${d?.message ?? d}`)), null);
    };
  return l;
}
function Sy(n) {
  const l = Xt((o) => o.gitReview(n)), i = nt.useMemo(() => ky(n), [n]);
  return nt.useMemo(() => ({
    ready: l.ready,
    workspaceName: l.workspaceName ?? void 0,
    startSnapshot: l.startSnapshot ?? void 0,
    lastAgentTurn: l.lastAgentTurn ?? void 0,
    agentSessionId: l.agentSessionId,
    status: l.status ?? void 0,
    statusState: l.statusState,
    statusError: l.statusError,
    actionError: l.actionError,
    diff: l.diff ?? void 0,
    diffState: l.diffState,
    diffError: l.diffError,
    comments: l.comments ?? [],
    refs: l.refs ?? [],
    batchDelivery: l.batchDelivery ?? void 0,
    sessions: l.sessions ?? [],
    currentRevision: l.currentRevision ?? void 0,
    actions: i,
    askAgent: void 0
  }), [l, i]);
}
function Ey(n) {
  const { workspaceId: l } = n, i = `diff:${l}`, o = _t(), s = nt.useRef(null);
  s.current !== i && (o.diff.open(i, { workspaceId: l }), s.current = i), o.diff.setProps(i, {
    path: n.path ?? null,
    wrap: !!n.wrap,
    canAsk: !!n.onAskAgent,
    selection: n.selection ?? null,
    editingCommentId: n.editingCommentId ?? null,
    editingBody: n.editingBody ?? ""
  });
  const d = Xt((p) => p.gitReview(l)).comments ?? [], m = nt.useSyncExternalStore(km, () => o.diff.seq(i)), f = nt.useRef(n);
  return f.current = n, oe(() => {
    const p = f.current, y = (k) => d.find((b) => b.id === k);
    for (const k of o.diff.events(i))
      switch (k.type) {
        case "selectLine":
          p.onSelectLine?.(k.path, k.side, k.line, k.extend);
          break;
        case "addComment":
          p.onAddComment?.(k.path, k.side, k.line);
          break;
        case "askAgent":
          p.onAskAgent?.(k.path);
          break;
        case "editComment": {
          const b = y(k.commentId);
          b && p.onEditComment?.(b);
          break;
        }
        case "editBody":
          p.onEditBody?.(k.text);
          break;
        case "saveEdit": {
          const b = y(k.commentId);
          b && p.onSaveEdit?.(b);
          break;
        }
        case "cancelEdit":
          p.onCancelEdit?.();
          break;
        case "resolve": {
          const b = y(k.commentId);
          b && p.onResolve?.(b);
          break;
        }
        case "delete": {
          const b = y(k.commentId);
          b && p.onDelete?.(b);
          break;
        }
      }
  }, [m, i]), nt.createElement("div", { "data-perch-engine": "diff", "data-perch-key": i, "data-testid": "git-diff", className: n.className ?? "min-h-0 flex-1" });
}
function zy(n, l) {
  const i = n.selection(l);
  if (i) return i;
  const o = n.value(l), s = o.split(`
`).length - (o.endsWith(`
`) && o.length ? 1 : 0);
  return { text: o, startLine: 1, endLine: Math.max(1, s) };
}
function Ny({ onGo: n, onClose: l }) {
  const [i, o] = nt.useState(""), s = (d) => {
    d?.preventDefault?.();
    const [m, f] = i.split(":").map((p) => Number.parseInt(p, 10));
    Number.isFinite(m) ? n(m, Number.isFinite(f) ? f : 1) : l();
  };
  return nt.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    nt.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    nt.createElement("input", {
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
    nt.createElement("button", { type: "button", className: js, onClick: s }, "OK")
  );
}
function Ty({ value: n, onChange: l, onSave: i, onCaret: o, readOnly: s, wrap: d, label: m, path: f, docKey: p, onAskAgent: y, ref: k }) {
  const b = _t().editor, v = nt.useRef(null);
  v.current = { onChange: l, onSave: i, onCaret: o, onAskAgent: y };
  const S = nt.useRef(n), [E, z] = nt.useState(null), [_, N] = nt.useState(!1), H = () => {
    if (!b || !v.current.onAskAgent) return;
    const { text: q, startLine: R, endLine: h } = zy(b, p);
    v.current.onAskAgent(q, R, h);
  };
  if (nt.useImperativeHandle(k, () => ({
    openGoto: () => N(!0),
    focus: () => b?.focus(p),
    askAgent: H
  }), [p]), Kr(() => {
    if (!b) return;
    b.open(p, { path: f, value: n, readonly: !!s, wrap: !!d, label: m }), S.current = n;
    const q = b.watch(p, (R) => {
      for (const h of R)
        if (h.type === "change") {
          const x = b.value(p);
          S.current = x, v.current.onChange?.(x);
        } else h.type === "caret" ? v.current.onCaret?.({ line: h.line, col: h.col }) : h.type === "save" ? v.current.onSave?.() : h.type === "goto" ? N(!0) : h.type === "contextmenu" && z({ x: h.x, y: h.y });
    });
    return () => {
      q(), b.park(p);
    };
  }, [p]), oe(() => {
    !b || n === S.current || (S.current = n, b.setValue(p, n, { external: !0 }));
  }, [p, n]), oe(() => {
    b?.setReadonly(p, !!s);
  }, [p, s]), oe(() => {
    b?.setWrap(p, !!d);
  }, [p, d]), !b)
    return nt.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: s, onChange: (q) => l?.(q.target.value) });
  const j = (q) => () => {
    z(null), q(), b.focus(p);
  }, X = E ? !!b.selection(p) : !1;
  return nt.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    _ && nt.createElement(Ny, {
      onGo: (q, R) => {
        N(!1), b.goTo(p, q, R), b.focus(p);
      },
      onClose: () => {
        N(!1), b.focus(p);
      }
    }),
    nt.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    E && nt.createElement(mv, {
      x: E.x,
      y: E.y,
      readOnly: !!s,
      canUndo: b.canUndo(p),
      canRedo: b.canRedo(p),
      hasSelection: X,
      onClose: () => z(null),
      actions: {
        undo: j(() => b.undo(p)),
        redo: j(() => b.redo(p)),
        cut: j(() => b.cut(p)),
        copy: j(() => b.copy(p)),
        paste: j(() => b.paste(p)),
        selectAll: j(() => b.selectAll(p)),
        find: j(() => b.openSearch(p, !1)),
        replace: j(() => b.openSearch(p, !0)),
        gotoLine: () => {
          z(null), N(!0);
        },
        ...y ? { askAgent: () => {
          z(null), H();
        } } : {}
      }
    })
  );
}
const Cy = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function My(n) {
  const l = Xt((i) => i.browserPages?.(n) ?? Cy);
  return nt.useMemo(() => {
    const i = (o, s) => _t().command(o, { workspaceId: n, ...s });
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
function Ay({ pageId: n, active: l }) {
  const i = `drawer
${n}`;
  return oe(() => {
    l && _t().command("browser.focus", { key: i });
  }, [l, i]), nt.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": i,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const Ky = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Tm,
  BrowserPage: Ay,
  Chevron: Ds,
  CloseIcon: ov,
  CodeEditor: Ty,
  ConfirmDialog: V1,
  Dialog: I1,
  DiffView: Ey,
  EllipsisIcon: rv,
  FileIcon: i1,
  FolderBrowser: J1,
  GearIcon: iv,
  GitMarker: c1,
  HostStateDot: sv,
  InstructionsDialog: W1,
  MemoryDialog: F1,
  ModeSwitch: qv,
  NewFilePrompt: xy,
  NewSessionMenu: Y1,
  PageIcon: Ov,
  PlusIcon: gm,
  QrCode: Jv,
  Select: K1,
  SessionDot: B1,
  SessionMenu: G1,
  SettingRow: Fv,
  SettingsGroup: Wv,
  SettingsQuery: Nl,
  Slot: U1,
  Submenu: Cv,
  Switch: Iv,
  TabDragLayer: yy,
  TabMenu: vy,
  WorktreeMenu: P1,
  agentStateColor: w1,
  anchoredPopoverStyle: p1,
  beginReorderDrag: ny,
  beginTabDrag: py,
  bindHost: m1,
  buttonClass: v1,
  cn: Ut,
  drawConfirmationsInPlace: Q1,
  drawFolderBrowserInPlace: X1,
  drawWorktreeInPlace: $1,
  ghostButton: y1,
  glassClass: u1,
  iconButton: x1,
  isMac: Sm,
  keyLabel: bs,
  menuDividerClass: Vr,
  menuItemClass: Em,
  menuPanel: li,
  nestSessions: H1,
  newId: h1,
  openBrowserTab: gy,
  openFileTab: by,
  pickFolder: E1,
  redeemUsageReset: dy,
  refreshUsage: uy,
  resetZoom: fy,
  rowActionClass: b1,
  runCommand: ri,
  segmentClass: g1,
  settingsClass: Pv,
  shortcutFor: _1,
  shortcutLabel: k1,
  startPaneWhenReady: Am,
  startSession: S1,
  tabStateClass: my,
  tapButtonClass: d1,
  useAddProject: T1,
  useAddProjectRequest: D1,
  useAgentChoices: R1,
  useBrowserPages: My,
  useDismissOnOutsideClick: ym,
  useGitReview: Sy,
  useHostSnapshot: Xt,
  useHosts: z1,
  useKeybindings: oy,
  useNavigation: zm,
  useNewTabRequest: hy,
  useNotifications: O1,
  usePaneLook: iy,
  usePlanUsage: cy,
  useResourceState: a1,
  useSessionFolders: N1,
  useSettingsQuery: $v,
  useStatusLine: ly,
  useWorkspaceTabs: ay,
  useZoom: ry,
  version: f1
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
const Bs = {
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
  Bs[n] = (l, i) => l[n](i);
const Xy = Object.keys(Bs);
function Po(n, l) {
  for (const [i, o] of Object.entries(l)) {
    const s = Bs[i];
    if (!s) throw new Error(`the description key ${i} has no GPUI builder`);
    o != null && (n = s(n, o));
  }
  return n;
}
const oa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Nf = /* @__PURE__ */ new WeakSet(), ts = /* @__PURE__ */ new WeakSet();
function Tf(n, l, i) {
  const o = n.pressed, s = oa(i);
  return o && o.x === s.clientX && o.y === s.clientY ? o.id : l;
}
function jy(n, l, i) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && Pr.has(n.group) || i)) return null;
  const o = n.meta?.attrs["data-testid"];
  return o ? `~${n.id}:${o}` : `~${n.id}`;
}
const jm = (n, l = !1) => (n.children ?? []).some((i) => i.kind === "text" ? !l || /\s/.test(String(i.text ?? "").trim()) : i.kind === "div" && i.style?.flex_direction !== "row" && i.style?.whitespace !== "nowrap" && jm(i, !0)), Te = (n) => n.style?.display !== "hidden";
let Pr = /* @__PURE__ */ new Set(), ys = null;
function Om(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: i, style: o } of n.group_hover ?? []) "display" in o && l.add(i);
  for (const i of n.children ?? []) i.kind !== "text" && Om(i, l);
  return l;
}
function xs(n, l, i, o, s = !1, d = !1, m = null, f = {}, p = !1, y = /* @__PURE__ */ new Map(), k = null) {
  if (n.kind === "text") return y.get(n)?.text ?? n.text;
  const b = Nf.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (k = null), m = n.style.text_color ?? m;
  const v = !!n.hover?.text_color && Bm(n), S = n.group ?? (v ? `~g${n.id}` : null);
  v && (k = { group: S, color: n.hover.text_color }), f = { ...f };
  for (const A of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[A] !== void 0 && (f[A] = n.style[A]);
  const E = new Set(n.events ?? []), z = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !d && !n.pointer_none && n.style.position === "absolute" ? ys : null, _ = z ? z.count++ : -1;
  s && (ys = z);
  let N;
  if (n.kind === "image" && !n.markup ? N = l.image(n.src) : N = l.div(), n.kind === "engine" && (N = N.child(o.engine ? o.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && k && k.color !== m) {
    const { group: A, color: B } = k, K = () => l.div().absolute().top(0).left(0).size_full();
    N = N.child(K().group_hover(A, (F) => F.invisible()).child(o.icon(`~icon-${n.id}`, n.markup, m))).child(K().invisible().group_hover(A, (F) => F.visible()).child(o.icon(`~icon-${n.id}-hover`, n.markup, B)));
  } else n.markup && (N = N.child(o.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const H = jy(n, E, !!z);
  if (H && (N = N.id(H)), n.measure && (N = N.measure(n.measure)), n.name && N.also_named) for (const A of n.also ?? []) N = N.also_named(A);
  N = Po(N, { ...n.style, ...y.get(n) });
  const j = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && j && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && jm(n) && (N = N.min_w(0));
  for (const A of ["hover", "focus", "active"]) n[A] && (N = N[A]((B) => Po(B, n[A])));
  S && (N = N.group(S));
  for (const { group: A, style: B } of n.group_hover ?? []) {
    const { display: K, ...F } = B;
    Object.keys(F).length && (N = N.group_hover(A, (Q) => Po(Q, F)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const A = i.document?.scrollTarget, B = A ? (n.children ?? []).filter(Te).findIndex((K) => Hm(K, A.id)) : -1;
    if (B >= 0 && (i.scroller ?? n.id) === n.id && (i.document.scrollTarget = null, i.scroller = n.id, l.scroll.scroll_to_item(B)), i.scroller ??= n.id, i.scroller === n.id && i.document) {
      N = N.track_scroll(l.scroll);
      const K = (n.children ?? []).filter(Te).map((F) => F.id);
      i.document.itemBounds = (F) => K.includes(F) ? l.scroll.item_bounds?.(K.indexOf(F)) ?? null : null;
    }
  }
  const X = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", q = s && !n.pointer_none || n.blocks_pointer;
  if ((X && ts.has(n) || q) && (N = N.on_scroll_wheel((A, B) => B.stop_propagation?.())), X || ts.has(n)) for (const A of n.children ?? []) A.kind !== "text" && ts.add(A);
  n.kind === "input" && !n.disabled && (N = N.on_mouse_down("left", (A, B) => {
    A.bounds && i.setBounds(n.id, A.bounds), i.focus(n.id), B.notify();
  }));
  const R = n.kind === "input" ? n : n.meta?.tag === "label" ? Dm(n) : null;
  R && !R.disabled && /^(checkbox|radio)$/.test(R.input_type) && (N = N.on_click((A, B) => {
    B.stop_propagation?.(), i.toggle(R.id), B.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((A) => E.has(A));
  if (h || b) for (const A of n.children ?? []) A.kind !== "text" && Nf.add(A);
  if (h && (N = N.on_mouse_down("left", (A, B) => {
    B.stop_propagation?.(), A.bounds && i.setBounds(n.id, A.bounds);
    const K = { ...oa(A), button: 0, buttons: 1, detail: A.click_count }, F = Tf(i, n.id, A);
    i.pressed = null, i.dispatch(F, "pointerdown", { ...K, pointerType: "mouse" }), i.dispatch(F, "mousedown", K) && i.pressFocus?.(F), B.notify();
  }), N = N.on_mouse_down("right", (A, B) => {
    B.stop_propagation?.(), A.bounds && i.setBounds(n.id, A.bounds);
    const K = Tf(i, n.id, A);
    i.pressed = null, i.dispatch(K, "contextmenu", { ...oa(A), button: 2 }), B.notify();
  }), N = N.on_mouse_up("left", (A, B) => {
    B.stop_propagation?.();
    const K = { ...oa(A), button: 0 };
    i.dispatch(n.id, "pointerup", { ...K, pointerType: "mouse" }), i.dispatch(n.id, "mouseup", K), B.notify();
  }), N = N.on_click((A, B) => {
    i.dispatch(n.id, A.click_count === 2 && E.has("double_click") ? "dblclick" : "click", { detail: A.click_count, button: 0 }), B.notify();
  })), n.blocks_pointer && !h)
    for (const A of ["left", "right"]) N = N.on_mouse_down(A, (B, K) => K.stop_propagation?.());
  else if (b && !h)
    for (const A of ["left", "right"])
      N = N.on_mouse_down(A, (B) => {
        const K = oa(B);
        (i.pressed?.x !== K.clientX || i.pressed?.y !== K.clientY) && (i.pressed = { id: n.id, x: K.clientX, y: K.clientY });
      });
  if (E.has("mouse_move") && (N = N.on_mouse_move((A) => {
    i.dispatch(n.id, "pointermove", { ...oa(A), pointerType: "mouse" });
  })), n.track_hover && Pr.has(n.group) && (N = N.on_hover((A, B) => {
    i.hover(n.id, A), B.notify();
  })), z && (N = N.on_mouse_down_out((A, B) => {
    const K = oa(A), F = `${K.clientX},${K.clientY}`;
    z.at !== F && (z.at = F, z.hits = /* @__PURE__ */ new Set()), z.hits.add(_), !(z.hits.size < z.count) && (z.at = null, i.dispatch(i.document.body.id, "pointerdown", { ...K, pointerType: "mouse" }), i.dispatch(i.document.body.id, "mousedown", K), B.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const A = n.value ? String(n.value) : String(n.placeholder ?? "");
    let B = l.div().whitespace_nowrap().overflow_x_hidden();
    const K = ca(f);
    K && (B = B.h(K)), !n.value && m && (B = B.text_color(Ry(m))), A && (N = N.child(B.child(n.input_type === "password" && n.value ? "•".repeat([...A].length) : A))), n.field_w && (N = N.child(l.div().w(n.field_w).h(0)));
  }
  const x = f.whitespace === "nowrap" ? ca(f) : null, w = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let M = !n.range_name;
  const O = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const A of (n.children ?? []).filter(Te)) {
    const B = A.style?.flex_basis;
    O && A.style.flex_grow > 0 && (B === 0 || typeof B == "string" && B.endsWith("%")) && y.set(A, { ...y.get(A), flex_basis: "auto" });
    let K = xs(A, l, i, o, !1, d, m, f, w && A.style?.position !== "absolute", y, k);
    const F = !M && (A.kind === "text" || !A.meta), Q = A.kind === "text" ? y.get(A)?.h ?? x : null, J = A.kind === "text" ? y.get(A)?.w : void 0;
    if (F || Q || J !== void 0) {
      let I = l.div();
      F && (I = I.id(n.range_name)), F && !w && n.style.display === "flex" && (I = I[`self_${Oy[f.text_align] ?? "start"}`]().max_w("100%")), Q && (I = I.h(Q)), J !== void 0 && (I = I.w(J).flex_none().whitespace_nowrap()), K = I.child(K), M ||= F;
    }
    N = N.child(K);
  }
  return N;
}
const Oy = { center: "center", right: "end", end: "end" };
function Ry(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const i = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(i / 2).toString(16).padStart(2, "0")}`;
}
const Rm = /^(?:[!-,.-~]+|\S)$/u, Dm = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const i = l.kind === "text" ? null : Dm(l);
    if (i) return i;
  }
  return null;
}, Hm = (n, l) => n.id === l || (n.children ?? []).some((i) => i.kind !== "text" && Hm(i, l)), Bm = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Bm(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function Zy(n, l, i, o, s = 0, d = !1) {
  const m = [n.root, ...n.overlays];
  Pr = /* @__PURE__ */ new Set(), ys = null;
  for (const k of m) Om(k, Pr);
  const f = s > 0 ? Yy(m, s) : /* @__PURE__ */ new Map();
  s > 0 && o.measure && Dy(m, s, o.measure, f), qy(m, f), Uy(m, f), o.measure && By(m, o.measure, f);
  let p = l.div().relative().size_full().child(xs(n.root, l, i, o, !1, !1, null, {}, !1, f)), y = d && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const k of n.overlays) y = y.child(xs(k, l, i, o, !0, !1, null, {}, !1, f));
  return y === p ? p : p.child(y);
}
function Dy(n, l, i, o) {
  const s = (E, z) => o.set(E, { ...o.get(E), ...z }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(E, z, _) {
    if (E.kind === "text") {
      if (!(z.whitespace === "nowrap" || Rm.test(E.text)) || z.text_ellipsis || _ || typeof z.text_size != "number") return NaN;
      const h = i(E.text, { size: z.text_size, weight: z.font_weight ?? 400, family: z.font_family ?? ".SystemUIFont", italic: !!z.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!Te(E) || E.kind === "input" || E.kind === "engine" || E.markup) return y(E);
    const N = { ...z };
    for (const R of f) E.style[R] !== void 0 && (N[R] = E.style[R]);
    N.text_ellipsis = !!E.style.text_ellipsis, m.set(E, N);
    const H = E.style, j = (E.children ?? []).filter(Le), X = j.map((R) => p(R, N, _ || !!E.tabular));
    let q = y(E);
    if (!Number.isFinite(q) && H.w === void 0) {
      const R = j.map((x, w) => X[w] + (x.kind === "text" ? 0 : ot(x.style.ml) + ot(x.style.mr)));
      let h;
      j.length ? Re(E) ? h = j.some((x) => x.kind !== "text" && x.style.flex_grow > 0) || H.flex_wrap === "wrap" ? NaN : R.reduce((x, w) => x + w, 0) + ot(H.gap_x) * (j.length - 1) : h = Math.max(...R) : h = 0, q = h + ot(H.pl) + ot(H.pr) + ot(H.border_l) + ot(H.border_r), typeof H.min_w == "number" && (q = Math.max(q, H.min_w)), typeof H.max_w == "number" && (q = Math.min(q, H.max_w));
    }
    return d.set(E, q), q;
  }
  const y = (E) => typeof E.style?.w == "number" ? E.style.w : NaN, k = () => ({ exact: 0, laid: 0 }), b = (E, z) => {
    if (!Number.isFinite(z))
      return Object.assign(E, k()), NaN;
    E.exact += z;
    const _ = Math.round(E.exact * l + 1e-9) / l, N = _ - E.laid;
    return E.laid = _, N;
  }, v = (E) => Re(E) && E.style.flex_wrap !== "wrap" && (E.style.justify ?? "start") === "start";
  function S(E) {
    if (!E || E.kind === "text" || !Te(E)) return;
    const z = (E.children ?? []).filter(Le);
    if (v(E) && z.length > 1) {
      const _ = ot(E.style.gap_x), N = k(), H = !(_ && z.some((j) => j.kind === "text" || !Number.isFinite(ot(j.style.ml))));
      s(E, { border_l: b(N, ot(E.style.border_l)), pl: b(N, ot(E.style.pl)) }), H && _ && s(E, { gap_x: 0 }), z.forEach((j, X) => {
        const q = (X && H ? _ : 0) + (j.kind === "text" ? 0 : ot(j.style.ml));
        if (j.kind === "text")
          q && Object.assign(N, k());
        else {
          const w = b(N, q);
          Number.isFinite(w) && s(j, { ml: w });
        }
        const R = j.kind === "text" ? m.get(E) ?? {} : null, h = j.kind === "text" ? p(j, R, !!E.tabular) : d.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(h)) {
          const w = { w: b(N, h) };
          j.kind !== "text" && typeof j.style.w != "number" && j.style.min_w === void 0 && (w.whitespace = "nowrap", w.flex_shrink = 0), s(j, w);
        } else Object.assign(N, k());
        if (j.kind !== "text") {
          const w = b(N, ot(j.style.mr));
          Number.isFinite(w) && s(j, { mr: w });
        }
      });
    }
    for (const _ of E.children ?? []) _.kind !== "text" && S(_);
  }
  for (const E of n)
    E && (p(E, {}, !1), S(E));
}
const Hy = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function By(n, l, i) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (f) => typeof f == "number" ? f : 0, d = (f, p) => p && ti(p) && !Re(p) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(p.style.items), m = (f, p, y, k) => {
    if (!f || f.kind === "text" || !Te(f)) return;
    const b = f.style;
    let v = typeof b.w == "number" ? b.w : b.w === "100%" ? y : d(f, p) ? y - s(b.ml) - s(b.mr) : NaN;
    typeof b.max_w == "number" && (v = Math.min(v, b.max_w));
    const S = v - s(b.pl) - s(b.pr) - s(b.border_l) - s(b.border_r), E = { ...k };
    for (const _ of o) b[_] !== void 0 && (E[_] = b[_]);
    const z = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(S) && S > 0 && typeof E.text_size == "number" && z.length && z.every((_) => _.kind === "text")) {
      const _ = { size: E.text_size, weight: E.font_weight ?? 400, family: E.font_family ?? ".SystemUIFont", italic: !!E.italic }, N = (X) => l(X.trimEnd(), _) <= S + 0.01;
      let H = 0;
      for (const X of z) {
        const q = [];
        for (const h of X.text.split(`
`)) {
          let x = "";
          for (const w of h.split(Hy)) {
            if (N(x + w)) {
              x += w;
              continue;
            }
            x && q.push(x.trimEnd()), x = "";
            for (const M of w)
              x && !N(x + M) && (q.push(x), x = ""), x += M;
          }
          q.push(x.trimEnd());
        }
        const R = q.join(`
`);
        q.every((h) => !h || N(h)) ? R !== X.text && i.set(X, { ...i.get(X), text: R }) : H = NaN, H += q.length;
      }
      const j = ca(E);
      Number.isFinite(H) && j && b.h === void 0 && z.length === 1 && i.set(f, { ...i.get(f), h: H * j + s(b.pt) + s(b.pb) + s(b.border_t) + s(b.border_b) });
    }
    for (const _ of z) m(_, f, Re(f) ? NaN : S, E);
  };
  for (const f of n) m(f, null, NaN, {});
}
function Uy(n, l) {
  const i = (o, s) => {
    if (!o || o.kind === "text" || !Te(o)) return;
    const d = o.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (m && Re(o))
      for (const f of o.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of o.children ?? []) i(f, m);
  };
  for (const o of n) i(o, !1);
}
function qy(n, l) {
  const i = l.heights ?? /* @__PURE__ */ new Map(), o = (p) => i.get(p), s = (p) => {
    const y = o(p);
    if (Number.isFinite(y)) return y;
    if (p.kind === "text" || !Te(p)) return 0;
    const k = p.style, b = typeof k.min_h == "number" ? k.min_h : 0, v = (p.children ?? []).filter(Le), S = v.map((_) => s(_) + (_.kind === "text" ? 0 : Math.max(0, ot(_.style.mt) || 0) + Math.max(0, ot(_.style.mb) || 0))), E = v.length ? Re(p) ? Math.max(...S) : S.reduce((_, N) => _ + N, 0) + (k.display === "flex" ? (ot(k.gap_y) || 0) * (v.length - 1) : 0) : 0, z = [k.pt, k.pb, k.border_t, k.border_b].reduce((_, N) => _ + (ot(N) || 0), 0);
    return Math.max(b, E + z);
  }, d = (p) => !(p.children ?? []).filter(Le).length || Re(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, y) => {
    const k = p.style;
    if (typeof k.h == "number") return k.h;
    if (typeof k.max_h == "number") return k.max_h;
    if (!y || !ti(y) || Re(y)) return NaN;
    const b = y.style, v = typeof b.h == "number" ? b.h : typeof b.max_h == "number" ? b.max_h : NaN, S = (y.children ?? []).filter(Le);
    let E = 0;
    for (const _ of S) {
      if (_ === p) continue;
      const N = o(_);
      if (!Number.isFinite(N)) return NaN;
      E += N + (_.kind === "text" ? 0 : ot(_.style.mt) + ot(_.style.mb));
    }
    const z = b.display === "flex" ? ot(b.gap_y) * Math.max(0, S.length - 1) : 0;
    return v - ot(b.pt) - ot(b.pb) - ot(b.border_t) - ot(b.border_b) - E - z - ot(k.mt) - ot(k.mb);
  }, f = (p, y) => {
    if (!(!p || p.kind === "text" || !Te(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const k = d(p), b = m(p, y);
        Number.isFinite(k) && Number.isFinite(b) && k > b + 0.01 && l.set(p, { ...l.get(p), pr: ot(p.style.pr) + p.scrollbar });
      }
      for (const k of p.children ?? []) f(k, p);
    }
  };
  for (const p of n) f(p, null);
}
const Gy = ["text_size", "line_height", "whitespace", "text_ellipsis"], ot = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, ti = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Le = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function Yy(n, l) {
  const i = /* @__PURE__ */ new Map(), o = (z, _) => i.set(z, { ...i.get(z), ...Object.fromEntries(Object.entries(_).filter(([, N]) => Number.isFinite(N))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(z, _) {
    if (z.kind === "text") return _.whitespace === "nowrap" || Rm.test(z.text) ? ca(_) ?? NaN : NaN;
    const N = { ..._ };
    for (const R of Gy) z.style[R] !== void 0 && (N[R] = z.style[R]);
    d.set(z, N);
    const H = z.style, j = (z.children ?? []).filter(Le), X = j.map((R) => m(R, N));
    let q;
    if (H.h !== void 0 && H.h !== "auto") q = ot(H.h);
    else if (z.kind === "engine") q = NaN;
    else if (z.kind === "input")
      q = (z.input_type === "textarea" || z.input_type === "select" ? NaN : ca(N) ?? NaN) + ot(H.pt) + ot(H.pb) + ot(H.border_t) + ot(H.border_b), H.min_h !== void 0 && (q = Math.max(q, ot(H.min_h)));
    else {
      const R = j.map((x, w) => (x.kind === "text" ? 0 : ot(x.style.mt) + ot(x.style.mb)) + X[w]);
      let h;
      if (Re(z)) h = H.flex_wrap === "wrap" ? NaN : H.items === "baseline" ? p(j, X, N) : Math.max(0, ...R);
      else if (ti(z)) {
        const x = j.some((M) => M.kind !== "text" && (M.style.flex_grow > 0 || M.style.flex_basis !== void 0)), w = H.display !== "flex" && j.some((M) => M.kind !== "text" && (ot(M.style.mt) || ot(M.style.mb)));
        h = x || w ? NaN : R.reduce((M, O) => M + O, 0) + (H.display === "flex" ? ot(H.gap_y) * Math.max(0, j.length - 1) : 0);
      } else h = NaN;
      q = h + ot(H.pt) + ot(H.pb) + ot(H.border_t) + ot(H.border_b), H.min_h !== void 0 && (q = Math.max(q, ot(H.min_h))), H.max_h !== void 0 && (q = Math.min(q, ot(H.max_h)));
    }
    return s.set(z, q), q;
  }
  const f = (z) => (ca(z) - (Wr + Jf) * z.text_size) / 2 + Wr * z.text_size;
  function p(z, _, N) {
    let H = 0, j = 0;
    for (const [X, q] of z.entries()) {
      const R = q.kind === "text" ? N : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Le).every((M) => M.kind === "text")) || !Number.isFinite(_[X]) || typeof R.text_size != "number") return NaN;
      const x = q.kind === "text" ? {} : q.style, w = ot(x.mt) + ot(x.border_t) + ot(x.pt) + f(R);
      H = Math.max(H, w), j = Math.max(j, ot(x.mt) + _[X] + ot(x.mb) - w);
    }
    return H + j;
  }
  const y = () => ({ exact: 0, laid: 0 }), k = (z, _) => {
    if (!Number.isFinite(_))
      return Object.assign(z, y()), NaN;
    z.exact += _;
    const N = Math.round(z.exact * l + 1e-9) / l, H = N - z.laid;
    return z.laid = N, H;
  };
  function b(z) {
    if (!(z.kind === "text" || !Te(z))) {
      for (const _ of (z.children ?? []).filter((N) => N.kind !== "text" && Te(N) && N.style.position === "absolute")) b(_);
      if (ti(z) && !Re(z)) {
        const _ = y();
        o(z, { border_t: k(_, ot(z.style.border_t)), pt: k(_, ot(z.style.pt)) }), v(z, _);
      } else for (const _ of (z.children ?? []).filter(Le)) _.kind !== "text" && b(_);
    }
  }
  function v(z, _) {
    const N = (z.children ?? []).filter(Le), H = z.style.display === "flex" ? ot(z.style.gap_y) : 0;
    if (H && N.some((j) => j.kind === "text")) {
      for (const j of N) j.kind !== "text" && b(j);
      return !1;
    }
    return H && o(z, { gap_y: 0 }), N.forEach((j, X) => {
      if (j.kind === "text") {
        const q = s.get(j) ?? m(j, d.get(z) ?? {});
        Number.isFinite(q) ? o(j, { h: k(_, q) }) : Object.assign(_, y());
        return;
      }
      if (o(j, { mt: k(_, (X ? H : 0) + ot(j.style.mt)) }), Number.isFinite(s.get(j))) E(j, _);
      else if (S(j)) {
        const q = j.style;
        o(j, { border_t: k(_, ot(q.border_t)), pt: k(_, ot(q.pt)) }), o(j, { pb: k(_, ot(q.pb)), border_b: k(_, ot(q.border_b)) });
      } else
        b(j), Object.assign(_, y());
      o(j, { mb: k(_, ot(j.style.mb)) });
    }), !0;
  }
  function S(z) {
    const _ = z.style, N = (z.children ?? []).filter(Le), H = ca(d.get(z) ?? {});
    return z.kind === "div" && !Re(z) && N.length > 0 && N.every((j) => j.kind === "text") && Number.isInteger(H) && [_.h, _.min_h, _.max_h].every((j) => j === void 0 || j === "auto");
  }
  function E(z, _) {
    const N = z.style;
    for (const R of (z.children ?? []).filter((h) => h.kind !== "text" && Te(h) && h.style.position === "absolute")) b(R);
    const H = _.laid, j = _.exact;
    o(z, { border_t: k(_, ot(N.border_t)), pt: k(_, ot(N.pt)) });
    const X = N.h !== void 0 && N.h !== "auto", q = s.get(z) - ot(N.pt) - ot(N.pb) - ot(N.border_t) - ot(N.border_b);
    if (z.kind === "input")
      X || k(_, q);
    else if (Re(z) || X && (N.justify ?? "start") !== "start") {
      for (const R of (z.children ?? []).filter(Le)) R.kind !== "text" && b(R);
      X || k(_, q);
    } else !v(z, _) && !X && k(_, q);
    if (X) {
      _.exact = j + s.get(z), _.laid = Math.round(_.exact * l + 1e-9) / l, o(z, { h: _.laid - H });
      return;
    }
    o(z, { pb: k(_, ot(N.pb)), border_b: k(_, ot(N.border_b)) }), o(z, { h: _.laid - H });
  }
  for (const z of n)
    m(z, {}), b(z);
  return Object.defineProperty(i, "heights", { value: s }), i;
}
const Jy = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], review: [{ name: "review-root", selector: '[data-testid="workspace-git-review"]' }, { name: "git-refresh", selector: '[data-testid="git-refresh"]' }, { name: "git-status", selector: '[data-testid="git-status"]' }, { name: "git-diff", selector: '[data-testid="git-diff"]' }, { name: "git-diff-empty", selector: '[data-testid="git-diff-empty"]' }, { name: "git-file-header", selector: '[data-testid="git-diff"] article > header' }, { name: "git-hunk-header", selector: '[data-testid="git-diff"] section > div:first-child' }, { name: "git-diff-line", selector: '[data-testid="git-diff-line"]' }, { name: "git-line-comments", selector: '[data-testid="git-line-comments"]' }, { name: "git-comment-composer", selector: '[data-testid="git-comment-composer"]' }] };
export {
  Jy as NAMED_ELEMENTS,
  z0 as React,
  cg as SCHEMA,
  Xy as STYLE_KEYS,
  Zy as describeToGpui,
  Ly as jsxRuntime,
  Qy as mount,
  Vy as reactDom,
  Ky as sdk
};
