function Ss(n, l) {
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
class ie extends Error {
}
const i0 = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), o0 = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), s0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...i0]);
function ls(n) {
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
  if (i === l) throw new ie(`expected a name at ${l} in ${JSON.stringify(n)}`);
  return [ls(n.slice(l, i)), i];
}
function c0(n, l) {
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
  throw new ie(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Es(n) {
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
function u0(n, l) {
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
      if (d < 0) throw new ie(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(l + 1, d).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new ie(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      i.attrs.push({ name: ls(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : ls(p) }), l = d + 1, o = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [p, y] = bl(n, l + 2), S = p.toLowerCase();
        if (S !== "before" && S !== "after") throw new ie(`::${S} is not supported`);
        if (i.pseudoElement = S, l = y, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new ie(`nothing may follow ::${S} in ${JSON.stringify(n)}`);
        break;
      }
      const [d, m] = bl(n, l + 1);
      l = m;
      const f = d.toLowerCase();
      if ((f === "before" || f === "after") && n[l] !== "(") {
        if (i.pseudoElement = f, o = !0, l < n.length && !/[\s>]/.test(n[l])) throw new ie(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[l] === "(") {
        if (!o0.has(f)) throw new ie(`:${f}() is not supported`);
        const p = c0(n, l + 1), y = n.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(y)) throw new ie(`:nth-child(${y}) is not supported (only a number)`);
          i.pseudos.push({ name: f, n: Number(y) });
        } else {
          const S = Es(y).map(zs);
          if (f === "has" && S.some((b) => b.length !== 1)) throw new ie(`:has(${y}) is not supported (only a compound selector)`);
          i.pseudos.push({ name: f, list: S });
        }
      } else {
        if (!s0.has(f)) throw new ie(`:${f} is not supported`);
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
  if (!o) throw new ie(`empty compound selector at ${l} in ${JSON.stringify(n)}`);
  return [i, l];
}
function zs(n) {
  const l = [];
  let i = 0, o = null;
  for (n = n.trim(); i < n.length; ) {
    const [s, d] = u0(n, i);
    if (l.at(-1)?.compound.pseudoElement) throw new ie(`::${l.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
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
      if (f === "+" || f === "~") throw new ie(`the ${f} combinator is not supported`);
      if (m) o = " ";
      else throw new ie(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!l.length) throw new ie("empty selector");
  return l;
}
const Dd = /* @__PURE__ */ new Map();
function ai(n) {
  let l = Dd.get(n);
  return l || (l = Es(n).map(zs), Dd.set(n, l)), l;
}
function jf(n) {
  const l = [0, 0, 0], i = (o) => {
    l[0] += o[0], l[1] += o[1], l[2] += o[2];
  };
  for (const { compound: o } of n) {
    o.id && l[0]++, l[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && l[2]++, o.pseudoElement && l[2]++;
    for (const s of o.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(jf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          i(d);
        } else l[1]++;
  }
  return l;
}
function d0(n, { name: l, op: i, value: o }) {
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
function Cr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function Of(n, l) {
  for (const i of n.children) if (l(i) || Of(i, l)) return !0;
  return !1;
}
function Rf(n, l, i, o) {
  if ((l.pseudoElement ?? null) !== (o ? i.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const d of l.classes) if (!s.has(d)) return !1;
  }
  for (const s of l.attrs) if (!d0(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
      case "first-child":
        if (Cr(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Cr(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = Cr(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Cr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => qa(n, d, i, o))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: d }]) => Of(n, (m) => Rf(m, d, i, !1)))) return !1;
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
    if (!Rf(d, p, i, f)) return !1;
    if (m === 0) return !0;
    if (y === ">") return !!d.parentElement && s(d.parentElement, m - 1, !1);
    for (let S = d.parentElement; S; S = S.parentElement) if (s(S, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, o);
}
function f0(n, l, i = {}) {
  return (typeof l == "string" ? ai(l) : l).some((s) => qa(n, s, i));
}
function rs(n, l, i = {}) {
  return qa(n, l, i);
}
function Sl(n, l, i = {}) {
  const o = ai(l), s = [], d = (m) => {
    for (const f of m.children)
      o.some((p) => qa(f, p, i)) && s.push(f), d(f);
  };
  return d(n), s;
}
function Df(n, l, i = {}) {
  const o = ai(l);
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
let m0 = 1;
class is {
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
class Ns {
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
let p0 = 0;
const os = () => ++p0;
class li {
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
class Kt extends Ns {
  constructor(l, i = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${m0++}`, this.tagName = l.toLowerCase(), this.props = i, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = os(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const l = os();
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
    return f0(this, l);
  }
  closest(l) {
    return Df(this, l);
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
    return l ? new is(l.x, l.y, l.width, l.height) : new is();
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
    return Hd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return Hd(this, l);
  }
}
const Hf = Symbol("perch.stale-layout"), Bf = 3;
let Yr = !1;
function Uf(n) {
  return () => {
    let l, i = !1;
    const o = (s) => {
      const d = Yr;
      Yr = s < Bf;
      try {
        l = n();
      } catch (m) {
        const f = m?.[Hf];
        if (!f) throw m;
        f.retries.push(() => {
          i || o(s + 1);
        });
      } finally {
        Yr = d;
      }
    };
    return o(0), () => {
      i = !0, typeof l == "function" && l();
    };
  };
}
const ss = "perch-dom:", h0 = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), g0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Hd(n, l = []) {
  const i = new Set(l.map((s) => g0[s] ?? s)), o = (s) => {
    if (!(s instanceof Kt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(s.props))
      h0.has(m) || i.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(o), ...s.hidden ? { h: 1 } : {} };
  };
  return ss + JSON.stringify(o(n));
}
function b0(n, l) {
  if (typeof n != "string" || !n.startsWith(ss)) return null;
  let i;
  try {
    i = JSON.parse(n.slice(ss.length));
  } catch {
    return null;
  }
  const o = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!o(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new li(d.x);
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
class v0 {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class y0 {
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
function Bd(n) {
  for (let l = n; l instanceof Kt; l = l.parentElement) l.touch();
}
class x0 extends Ns {
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
    if (Yr && (!o || this.stale?.())) throw { [Hf]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, Bd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, Bd(l), this.activeElement === l && (this.activeElement = this.body);
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
class w0 extends Ns {
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
function qf(n) {
  return {
    setTimeout: (l, i = 0, ...o) => n.setTimeout(() => l(...o), Math.max(0, Number(i) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Ud = Symbol.for("perch.react.globals");
function Je(n, l, i) {
  Object.defineProperty(n, l, { value: i, configurable: !0, writable: !0, enumerable: !1 });
}
function _0(n, l = globalThis) {
  const i = new x0(n), o = new w0(n, i);
  i.defaultView = o;
  const s = n.storage ?? new y0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = qf(n);
    Je(l, "setTimeout", f.setTimeout), Je(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Je(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Je(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Je(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: i, window: o, localStorage: s, HTMLElement: Kt, Element: Kt };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Ud]?.[f], configurable: !0, enumerable: !1 });
  l[Ud] = d, Je(l, "DOMRect", is), Je(l, "getComputedStyle", k0), typeof l.ResizeObserver != "function" && Je(l, "ResizeObserver", v0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Je(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Je(l, "navigator", m), { document: i, window: o, globals: d };
}
function k0(n) {
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
function cs(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Yf(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let o = n.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const Yf = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const qd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof qd?.setTimeout == "function") {
  const n = qf(qd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Ts(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function S0(n) {
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
var Xo = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Yd;
function E0() {
  if (Yd) return pt;
  Yd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), i = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), y = Symbol.for("react.memo"), S = Symbol.for("react.lazy"), b = Symbol.for("react.activity"), v = Symbol.iterator;
  function E(T) {
    return T === null || typeof T != "object" ? null : (T = v && T[v] || T["@@iterator"], typeof T == "function" ? T : null);
  }
  var k = {
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
    this.props = T, this.context = Z, this.refs = _, this.updater = at || k;
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
    this.props = T, this.context = Z, this.refs = _, this.updater = at || k;
  }
  var X = j.prototype = new H();
  X.constructor = j, z(X, N.prototype), X.isPureReactComponent = !0;
  var q = Array.isArray;
  function D() {
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
  function C(T, Z) {
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
  function I(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(D, D) : (T.status = "pending", T.then(
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
            case S:
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
      return ct = ct(T), Et = st === "" ? "." + K(T, 0) : st, q(ct) ? (at = "", Et != null && (at = Et.replace(B, "$&/") + "/"), Q(ct, Z, at, "", function(Gn) {
        return Gn;
      })) : ct != null && (O(ct) && (ct = C(
        ct,
        at + (ct.key == null || T && T.key === ct.key ? "" : ("" + ct.key).replace(
          B,
          "$&/"
        ) + "/") + Et
      )), Z.push(ct)), 1;
    Et = 0;
    var It = st === "" ? "." : st + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        st = T[ht], ut = It + K(st, ht), Et += Q(
          st,
          Z,
          at,
          ut,
          ct
        );
    else if (ht = E(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(st = T.next()).done; )
        st = st.value, ut = It + K(st, ht++), Et += Q(
          st,
          Z,
          at,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof T.then == "function")
        return Q(
          I(T),
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
  function $(T) {
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
      for (var Et = Array(ut), It = 0; It < ut; It++)
        Et[It] = arguments[It + 2];
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
      for (var It = Array(Et), ht = 0; ht < Et; ht++)
        It[ht] = arguments[ht + 2];
      ct.children = It;
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
      $$typeof: S,
      _payload: { _status: -1, _result: T },
      _init: $
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
      ct !== null && ct(at, st), typeof st == "object" && st !== null && typeof st.then == "function" && st.then(D, L);
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
var Gd;
function z0() {
  return Gd || (Gd = 1, Xo.exports = E0()), Xo.exports;
}
var W = z0();
const Gf = /* @__PURE__ */ Ts(W), N0 = /* @__PURE__ */ Ss({
  __proto__: null,
  default: Gf
}, [W]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const T0 = Gf ?? N0;
function Ft(n, l) {
  return W.useEffect(Uf(n), l);
}
function Zr(n, l) {
  return W.useLayoutEffect(Uf(n), l);
}
const C0 = /* @__PURE__ */ Ss({
  __proto__: null,
  default: T0,
  useEffect: Ft,
  useLayoutEffect: Zr
}, [W]);
var Zo = { exports: {} }, vl = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ld;
function M0() {
  if (Ld) return vl;
  Ld = 1;
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
var Qd;
function A0() {
  return Qd || (Qd = 1, Zo.exports = M0()), Zo.exports;
}
var et = A0();
const j0 = /* @__PURE__ */ Ts(et), rx = /* @__PURE__ */ Ss({
  __proto__: null,
  default: j0
}, [et]);
var Jo = { exports: {} }, Wo = { exports: {} };
const O0 = /* @__PURE__ */ S0(C0);
var Fo = { exports: {} }, Io = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Vd;
function R0() {
  return Vd || (Vd = 1, (function(n) {
    function l(Q, J) {
      var $ = Q.length;
      Q.push(J);
      t: for (; 0 < $; ) {
        var L = $ - 1 >>> 1, V = Q[L];
        if (0 < s(V, J))
          Q[L] = J, Q[$] = V, $ = L;
        else break t;
      }
    }
    function i(Q) {
      return Q.length === 0 ? null : Q[0];
    }
    function o(Q) {
      if (Q.length === 0) return null;
      var J = Q[0], $ = Q.pop();
      if ($ !== J) {
        Q[0] = $;
        t: for (var L = 0, V = Q.length, T = V >>> 1; L < T; ) {
          var Z = 2 * (L + 1) - 1, at = Q[Z], st = Z + 1, ct = Q[st];
          if (0 > s(at, $))
            st < V && 0 > s(ct, at) ? (Q[L] = ct, Q[st] = $, L = st) : (Q[L] = at, Q[Z] = $, L = Z);
          else if (st < V && 0 > s(ct, $))
            Q[L] = ct, Q[st] = $, L = st;
          else break t;
        }
      }
      return J;
    }
    function s(Q, J) {
      var $ = Q.sortIndex - J.sortIndex;
      return $ !== 0 ? $ : Q.id - J.id;
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
    var p = [], y = [], S = 1, b = null, v = 3, E = !1, k = !1, z = !1, _ = !1, N = typeof setTimeout == "function" ? setTimeout : null, H = typeof clearTimeout == "function" ? clearTimeout : null, j = typeof setImmediate < "u" ? setImmediate : null;
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
      if (z = !1, X(Q), !k)
        if (i(p) !== null)
          k = !0, D || (D = !0, A());
        else {
          var J = i(y);
          J !== null && I(q, J.startTime - Q);
        }
    }
    var D = !1, h = -1, x = 5, w = -1;
    function C() {
      return _ ? !0 : !(n.unstable_now() - w < x);
    }
    function O() {
      if (_ = !1, D) {
        var Q = n.unstable_now();
        w = Q;
        var J = !0;
        try {
          t: {
            k = !1, z && (z = !1, H(h), h = -1), E = !0;
            var $ = v;
            try {
              e: {
                for (X(Q), b = i(p); b !== null && !(b.expirationTime > Q && C()); ) {
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
                  T !== null && I(
                    q,
                    T.startTime - Q
                  ), J = !1;
                }
              }
              break t;
            } finally {
              b = null, v = $, E = !1;
            }
            J = void 0;
          }
        } finally {
          J ? A() : D = !1;
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
    function I(Q, J) {
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
      var $ = v;
      v = J;
      try {
        return Q();
      } finally {
        v = $;
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
      var $ = v;
      v = Q;
      try {
        return J();
      } finally {
        v = $;
      }
    }, n.unstable_scheduleCallback = function(Q, J, $) {
      var L = n.unstable_now();
      switch (typeof $ == "object" && $ !== null ? ($ = $.delay, $ = typeof $ == "number" && 0 < $ ? L + $ : L) : $ = L, Q) {
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
      return V = $ + V, Q = {
        id: S++,
        callback: J,
        priorityLevel: Q,
        startTime: $,
        expirationTime: V,
        sortIndex: -1
      }, $ > L ? (Q.sortIndex = $, l(y, Q), i(p) === null && Q === i(y) && (z ? (H(h), h = -1) : z = !0, I(q, $ - L))) : (Q.sortIndex = V, l(p, Q), k || E || (k = !0, D || (D = !0, A()))), Q;
    }, n.unstable_shouldYield = C, n.unstable_wrapCallback = function(Q) {
      var J = v;
      return function() {
        var $ = v;
        v = J;
        try {
          return Q.apply(this, arguments);
        } finally {
          v = $;
        }
      };
    };
  })(Io)), Io;
}
var Kd;
function D0() {
  return Kd || (Kd = 1, Fo.exports = R0()), Fo.exports;
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
var Xd;
function H0() {
  return Xd || (Xd = 1, (function(n) {
    n.exports = function(l) {
      function i(t, e, a, r) {
        return new dp(t, e, a, r);
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
            for (var g = !1, M = c.child; M; ) {
              if (M === a) {
                g = !0, a = c, r = u;
                break;
              }
              if (M === r) {
                g = !0, r = c, a = u;
                break;
              }
              M = M.sibling;
            }
            if (!g) {
              for (M = u.child; M; ) {
                if (M === a) {
                  g = !0, a = u, r = c;
                  break;
                }
                if (M === r) {
                  g = !0, r = u, a = c;
                  break;
                }
                M = M.sibling;
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
      function S(t) {
        return t === null || typeof t != "object" ? null : (t = td && t[td] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function b(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === gp ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case ya:
            return "Fragment";
          case fo:
            return "Profiler";
          case $u:
            return "StrictMode";
          case po:
            return "Suspense";
          case ho:
            return "SuspenseList";
          case bo:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case va:
              return "Portal";
            case kn:
              return t.displayName || "Context";
            case Pu:
              return (t._context.displayName || "Context") + ".Consumer";
            case mo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case go:
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
      function E(t) {
        0 > _a || (t.current = ko[_a], ko[_a] = null, _a--);
      }
      function k(t, e) {
        _a++, ko[_a] = t.current, t.current = e;
      }
      function z(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Vh(t) / Kh | 0) | 0;
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
        var M = r & 134217727;
        return M !== 0 ? (r = M & ~u, r !== 0 ? c = _(r) : (g &= M, g !== 0 ? c = _(g) : a || (a = M & ~t, a !== 0 && (c = _(a))))) : (M = r & ~u, M !== 0 ? c = _(M) : g !== 0 ? c = _(g) : a || (a = r & ~t, a !== 0 && (c = _(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
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
        var t = ur;
        return ur <<= 1, (ur & 62914560) === 0 && (ur = 4194304), t;
      }
      function q(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function D(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function h(t, e, a, r, c, u) {
        var g = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var M = t.entanglements, G = t.expirationTimes, F = t.hiddenUpdates;
        for (a = g & ~a; 0 < a; ) {
          var nt = 31 - we(a), P = 1 << nt;
          M[nt] = 0, G[nt] = -1;
          var lt = F[nt];
          if (lt !== null)
            for (F[nt] = null, nt = 0; nt < lt.length; nt++) {
              var gt = lt[nt];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~P;
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
      function C(t, e) {
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
        if (typeof Fh == "function" && Ih(t), _e && typeof _e.setStrictMode == "function")
          try {
            _e.setStrictMode(rl, t);
          } catch {
          }
      }
      function K(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function I(t) {
        if (zo === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            zo = e && e[1] || "", zd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + zo + t + zd;
      }
      function Q(t, e) {
        if (!t || No) return "";
        No = !0;
        var a = Error.prepareStackTrace;
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
          var u = r.DetermineComponentFrameRoot(), g = u[0], M = u[1];
          if (g && M) {
            var G = g.split(`
`), F = M.split(`
`);
            for (c = r = 0; r < G.length && !G[r].includes("DetermineComponentFrameRoot"); )
              r++;
            for (; c < F.length && !F[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (r === G.length || c === F.length)
              for (r = G.length - 1, c = F.length - 1; 1 <= r && 0 <= c && G[r] !== F[c]; )
                c--;
            for (; 1 <= r && 0 <= c; r--, c--)
              if (G[r] !== F[c]) {
                if (r !== 1 || c !== 1)
                  do
                    if (r--, c--, 0 > c || G[r] !== F[c]) {
                      var nt = `
` + G[r].replace(" at new ", " at ");
                      return t.displayName && nt.includes("<anonymous>") && (nt = nt.replace("<anonymous>", t.displayName)), nt;
                    }
                  while (1 <= r && 0 <= c);
                break;
              }
          }
        } finally {
          No = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? I(a) : "";
      }
      function J(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return I(t.type);
          case 16:
            return I("Lazy");
          case 13:
            return t.child !== e && e !== null ? I("Suspense Fallback") : I("Suspense");
          case 19:
            return I("SuspenseList");
          case 0:
          case 15:
            return Q(t.type, !1);
          case 11:
            return Q(t.type.render, !1);
          case 1:
            return Q(t.type, !0);
          case 31:
            return I("Activity");
          default:
            return "";
        }
      }
      function $(t) {
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
          var a = Nd.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: $(e)
          }, Nd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: $(e)
        };
      }
      function V(t, e) {
        Sa[Ea++] = il, Sa[Ea++] = fr, fr = t, il = e;
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
        for (; t === fr; )
          fr = Sa[--Ea], Sa[Ea] = null, il = Sa[--Ea], Sa[Ea] = null;
        for (; t === En; )
          En = Ce[--Me], Ce[Me] = null, Ze = Ce[--Me], Ce[Me] = null, Xe = Ce[--Me], Ce[Me] = null;
      }
      function st(t, e) {
        Ce[Me++] = Xe, Ce[Me++] = Ze, Ce[Me++] = En, Xe = e.id, Ze = e.overflow, En = t;
      }
      function ct(t, e) {
        k(zn, e), k(ol, t), k(ae, null), t = yp(e), E(ae), k(ae, t);
      }
      function ut() {
        E(ae), E(ol), E(zn);
      }
      function Et(t) {
        t.memoizedState !== null && k(mr, t);
        var e = ae.current, a = xp(e, t.type);
        e !== a && (k(ol, t), k(ae, a));
      }
      function It(t) {
        ol.current === t && (E(ae), E(ol)), mr.current === t && (E(mr), ln ? In._currentValue = xa : In._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(L(e, t)), To;
      }
      function Gn(t, e) {
        if (!ue) throw Error(s(175));
        xh(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Ln(t) {
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
        if (!St) return Ln(t), St = !0, !1;
        var e = t.tag;
        if (Zt ? e !== 3 && e !== 27 && (e !== 5 || md(t.type) && !or(t.type, t.memoizedProps)) && Rt && ht(t) : e !== 3 && (e !== 5 || md(t.type) && !or(t.type, t.memoizedProps)) && Rt && ht(t), Ln(t), e === 13) {
          if (!ue) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = Eh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = Sh(t);
        } else
          Rt = Zt && e === 27 ? uh(
            t.type,
            Rt
          ) : le ? fd(t.stateNode) : null;
        return !0;
      }
      function He() {
        ue && (Rt = le = null, St = !1);
      }
      function hn() {
        var t = Nn;
        return t !== null && (be === null ? be = t : be.push.apply(
          be,
          t
        ), Nn = null), t;
      }
      function Ga(t) {
        Nn === null ? Nn = [t] : Nn.push(t);
      }
      function gn(t, e, a) {
        ln ? (k(pr, e._currentValue), e._currentValue = a) : (k(pr, e._currentValue2), e._currentValue2 = a);
      }
      function $e(t) {
        var e = pr.current;
        ln ? t._currentValue = e : t._currentValue2 = e, E(pr);
      }
      function si(t, e, a) {
        for (; t !== null; ) {
          var r = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, r !== null && (r.childLanes |= e)) : r !== null && (r.childLanes & e) !== e && (r.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function ci(t, e, a, r) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var u = c.dependencies;
          if (u !== null) {
            var g = c.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var M = u;
              u = c;
              for (var G = 0; G < e.length; G++)
                if (M.context === e[G]) {
                  u.lanes |= a, M = u.alternate, M !== null && (M.lanes |= a), si(
                    u.return,
                    a,
                    t
                  ), r || (g = null);
                  break t;
                }
              u = M.next;
            }
          } else if (c.tag === 18) {
            if (g = c.return, g === null) throw Error(s(341));
            g.lanes |= a, u = g.alternate, u !== null && (u.lanes |= a), si(g, a, t), g = null;
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
              var M = c.type;
              ke(c.pendingProps.value, g.value) || (t !== null ? t.push(M) : t = [M]);
            }
          } else if (c === mr.current) {
            if (g = c.alternate, g === null) throw Error(s(387));
            g.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(In) : t = [In]);
          }
          c = c.return;
        }
        t !== null && ci(
          e,
          t,
          a,
          r
        ), e.flags |= 262144;
      }
      function Ml(t) {
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
      function ee(t) {
        return Ys($n, t);
      }
      function Al(t, e) {
        return $n === null && Qn(t), Ys(t, e);
      }
      function Ys(t, e) {
        var a = ln ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, on === null) {
          if (t === null) throw Error(s(308));
          on = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else on = on.next = e;
        return a;
      }
      function ui() {
        return {
          controller: new Ph(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function La(t) {
        t.refCount--, t.refCount === 0 && t0(e0, function() {
          t.controller.abort();
        });
      }
      function jl() {
      }
      function Qe(t) {
        t !== za && t.next === null && (za === null ? hr = za = t : za = za.next = t), gr = !0, Co || (Co = !0, Gm());
      }
      function ma(t, e) {
        if (!Mo && gr) {
          Mo = !0;
          do
            for (var a = !1, r = hr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var g = r.suspendedLanes, M = r.pingedLanes;
                  u = (1 << 31 - we(42 | t) + 1) - 1, u &= c & ~(g & ~M), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, Ks(r, u));
              } else
                u = kt, u = N(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== Fn
                ), (u & 3) === 0 || H(r, u) || (a = !0, Ks(r, u));
              r = r.next;
            }
          while (a);
          Mo = !1;
        }
      }
      function Gs() {
        Ls();
      }
      function Ls() {
        gr = Co = !1;
        var t = 0;
        Pn !== 0 && Cp() && (t = Pn);
        for (var e = he(), a = null, r = hr; r !== null; ) {
          var c = r.next, u = Qs(r, e);
          u === 0 ? (r.next = null, a === null ? hr = c : a.next = c, c === null && (za = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (gr = !0)), r = c;
        }
        Jt !== 0 && Jt !== 5 || ma(t), Pn !== 0 && (Pn = 0);
      }
      function Qs(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var g = 31 - we(u), M = 1 << g, G = c[g];
          G === -1 ? ((M & a) === 0 || (M & r) !== 0) && (c[g] = j(M, e)) : G <= e && (t.expiredLanes |= M), u &= ~M;
        }
        if (e = At, a = kt, a = N(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Fn
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && So(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || H(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && So(r), A(a)) {
            case 2:
            case 8:
              a = Jh;
              break;
            case 32:
              a = Eo;
              break;
            case 268435456:
              a = Wh;
              break;
            default:
              a = Eo;
          }
          return r = Vs.bind(null, t), a = dr(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && So(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Vs(t, e) {
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
        ), r === 0 ? null : (Nu(t, r, e), Qs(t, he()), t.callbackNode != null && t.callbackNode === a ? Vs.bind(null, t) : null);
      }
      function Ks(t, e) {
        if (el()) return null;
        Nu(t, e, !0);
      }
      function Gm() {
        Hp ? Bp(function() {
          (xt & 6) !== 0 ? dr(
            Sd,
            Gs
          ) : Ls();
        }) : dr(
          Sd,
          Gs
        );
      }
      function di() {
        if (Pn === 0) {
          var t = Na;
          t === 0 && (t = sr, sr <<= 1, (sr & 261888) === 0 && (sr = 256)), Pn = t;
        }
        return Pn;
      }
      function Lm(t, e) {
        if (sl === null) {
          var a = sl = [];
          Ao = 0, Na = di(), Ta = {
            status: "pending",
            value: void 0,
            then: function(r) {
              a.push(r);
            }
          };
        }
        return Ao++, e.then(Xs, Xs), e;
      }
      function Xs() {
        if (--Ao === 0 && sl !== null) {
          Ta !== null && (Ta.status = "fulfilled");
          var t = sl;
          sl = null, Na = 0, Ta = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Qm(t, e) {
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
      function fi() {
        var t = ta.current;
        return t !== null ? t : At.pooledCache;
      }
      function Ol(t, e) {
        e === null ? k(ta, ta.current) : k(ta, e.pool);
      }
      function Zs() {
        var t = fi();
        return t === null ? null : {
          parent: ln ? Dt._currentValue : Dt._currentValue2,
          pool: t
        };
      }
      function Rl(t, e) {
        if (ke(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!$h.call(e, c) || !ke(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Js(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ws(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(jl, jl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Is(t), t;
          default:
            if (typeof e.status == "string") e.then(jl, jl);
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
                throw t = e.reason, Is(t), t;
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
      function Fs() {
        if (ea === null) throw Error(s(459));
        var t = ea;
        return ea = null, t;
      }
      function Is(t) {
        if (t === Ca || t === br)
          throw Error(s(483));
      }
      function Dl(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Ws(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Hl(t, e) {
        throw e.$$typeof === pp ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function $s(t) {
        function e(U, R) {
          if (t) {
            var Y = U.deletions;
            Y === null ? (U.deletions = [R], U.flags |= 16) : Y.push(R);
          }
        }
        function a(U, R) {
          if (!t) return null;
          for (; R !== null; )
            e(U, R), R = R.sibling;
          return null;
        }
        function r(U) {
          for (var R = /* @__PURE__ */ new Map(); U !== null; )
            U.key !== null ? R.set(U.key, U) : R.set(U.index, U), U = U.sibling;
          return R;
        }
        function c(U, R) {
          return U = an(U, R), U.index = 0, U.sibling = null, U;
        }
        function u(U, R, Y) {
          return U.index = Y, t ? (Y = U.alternate, Y !== null ? (Y = Y.index, Y < R ? (U.flags |= 67108866, R) : Y) : (U.flags |= 67108866, R)) : (U.flags |= 1048576, R);
        }
        function g(U) {
          return t && U.alternate === null && (U.flags |= 67108866), U;
        }
        function M(U, R, Y, tt) {
          return R === null || R.tag !== 6 ? (R = oo(Y, U.mode, tt), R.return = U, R) : (R = c(R, Y), R.return = U, R);
        }
        function G(U, R, Y, tt) {
          var ft = Y.type;
          return ft === ya ? nt(
            U,
            R,
            Y.props.children,
            tt,
            Y.key
          ) : R !== null && (R.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Sn && Vn(ft) === R.type) ? (R = c(R, Y.props), Qa(R, Y), R.return = U, R) : (R = lr(
            Y.type,
            Y.key,
            Y.props,
            null,
            U.mode,
            tt
          ), Qa(R, Y), R.return = U, R);
        }
        function F(U, R, Y, tt) {
          return R === null || R.tag !== 4 || R.stateNode.containerInfo !== Y.containerInfo || R.stateNode.implementation !== Y.implementation ? (R = so(Y, U.mode, tt), R.return = U, R) : (R = c(R, Y.children || []), R.return = U, R);
        }
        function nt(U, R, Y, tt, ft) {
          return R === null || R.tag !== 7 ? (R = Wn(
            Y,
            U.mode,
            tt,
            ft
          ), R.return = U, R) : (R = c(R, Y), R.return = U, R);
        }
        function P(U, R, Y) {
          if (typeof R == "string" && R !== "" || typeof R == "number" || typeof R == "bigint")
            return R = oo(
              "" + R,
              U.mode,
              Y
            ), R.return = U, R;
          if (typeof R == "object" && R !== null) {
            switch (R.$$typeof) {
              case rr:
                return Y = lr(
                  R.type,
                  R.key,
                  R.props,
                  null,
                  U.mode,
                  Y
                ), Qa(Y, R), Y.return = U, Y;
              case va:
                return R = so(
                  R,
                  U.mode,
                  Y
                ), R.return = U, R;
              case Sn:
                return R = Vn(R), P(U, R, Y);
            }
            if (ir(R) || S(R))
              return R = Wn(
                R,
                U.mode,
                Y,
                null
              ), R.return = U, R;
            if (typeof R.then == "function")
              return P(U, Dl(R), Y);
            if (R.$$typeof === kn)
              return P(
                U,
                Al(U, R),
                Y
              );
            Hl(U, R);
          }
          return null;
        }
        function lt(U, R, Y, tt) {
          var ft = R !== null ? R.key : null;
          if (typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint")
            return ft !== null ? null : M(U, R, "" + Y, tt);
          if (typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case rr:
                return Y.key === ft ? G(U, R, Y, tt) : null;
              case va:
                return Y.key === ft ? F(U, R, Y, tt) : null;
              case Sn:
                return Y = Vn(Y), lt(U, R, Y, tt);
            }
            if (ir(Y) || S(Y))
              return ft !== null ? null : nt(U, R, Y, tt, null);
            if (typeof Y.then == "function")
              return lt(
                U,
                R,
                Dl(Y),
                tt
              );
            if (Y.$$typeof === kn)
              return lt(
                U,
                R,
                Al(U, Y),
                tt
              );
            Hl(U, Y);
          }
          return null;
        }
        function gt(U, R, Y, tt, ft) {
          if (typeof tt == "string" && tt !== "" || typeof tt == "number" || typeof tt == "bigint")
            return U = U.get(Y) || null, M(R, U, "" + tt, ft);
          if (typeof tt == "object" && tt !== null) {
            switch (tt.$$typeof) {
              case rr:
                return U = U.get(
                  tt.key === null ? Y : tt.key
                ) || null, G(R, U, tt, ft);
              case va:
                return U = U.get(
                  tt.key === null ? Y : tt.key
                ) || null, F(R, U, tt, ft);
              case Sn:
                return tt = Vn(tt), gt(
                  U,
                  R,
                  Y,
                  tt,
                  ft
                );
            }
            if (ir(tt) || S(tt))
              return U = U.get(Y) || null, nt(R, U, tt, ft, null);
            if (typeof tt.then == "function")
              return gt(
                U,
                R,
                Y,
                Dl(tt),
                ft
              );
            if (tt.$$typeof === kn)
              return gt(
                U,
                R,
                Y,
                Al(R, tt),
                ft
              );
            Hl(R, tt);
          }
          return null;
        }
        function re(U, R, Y, tt) {
          for (var ft = null, Ht = null, mt = R, Nt = R = 0, te = null; mt !== null && Nt < Y.length; Nt++) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var Tt = lt(
              U,
              mt,
              Y[Nt],
              tt
            );
            if (Tt === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && Tt.alternate === null && e(U, mt), R = u(Tt, R, Nt), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt, mt = te;
          }
          if (Nt === Y.length)
            return a(U, mt), St && V(U, Nt), ft;
          if (mt === null) {
            for (; Nt < Y.length; Nt++)
              mt = P(U, Y[Nt], tt), mt !== null && (R = u(
                mt,
                R,
                Nt
              ), Ht === null ? ft = mt : Ht.sibling = mt, Ht = mt);
            return St && V(U, Nt), ft;
          }
          for (mt = r(mt); Nt < Y.length; Nt++)
            te = gt(
              mt,
              U,
              Nt,
              Y[Nt],
              tt
            ), te !== null && (t && te.alternate !== null && mt.delete(
              te.key === null ? Nt : te.key
            ), R = u(
              te,
              R,
              Nt
            ), Ht === null ? ft = te : Ht.sibling = te, Ht = te);
          return t && mt.forEach(function(On) {
            return e(U, On);
          }), St && V(U, Nt), ft;
        }
        function gl(U, R, Y, tt) {
          if (Y == null) throw Error(s(151));
          for (var ft = null, Ht = null, mt = R, Nt = R = 0, te = null, Tt = Y.next(); mt !== null && !Tt.done; Nt++, Tt = Y.next()) {
            mt.index > Nt ? (te = mt, mt = null) : te = mt.sibling;
            var On = lt(U, mt, Tt.value, tt);
            if (On === null) {
              mt === null && (mt = te);
              break;
            }
            t && mt && On.alternate === null && e(U, mt), R = u(On, R, Nt), Ht === null ? ft = On : Ht.sibling = On, Ht = On, mt = te;
          }
          if (Tt.done)
            return a(U, mt), St && V(U, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = Y.next())
              Tt = P(U, Tt.value, tt), Tt !== null && (R = u(
                Tt,
                R,
                Nt
              ), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt);
            return St && V(U, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = Y.next())
            Tt = gt(
              mt,
              U,
              Nt,
              Tt.value,
              tt
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), R = u(Tt, R, Nt), Ht === null ? ft = Tt : Ht.sibling = Tt, Ht = Tt);
          return t && mt.forEach(function(r0) {
            return e(U, r0);
          }), St && V(U, Nt), ft;
        }
        function ra(U, R, Y, tt) {
          if (typeof Y == "object" && Y !== null && Y.type === ya && Y.key === null && (Y = Y.props.children), typeof Y == "object" && Y !== null) {
            switch (Y.$$typeof) {
              case rr:
                t: {
                  for (var ft = Y.key; R !== null; ) {
                    if (R.key === ft) {
                      if (ft = Y.type, ft === ya) {
                        if (R.tag === 7) {
                          a(
                            U,
                            R.sibling
                          ), tt = c(
                            R,
                            Y.props.children
                          ), tt.return = U, U = tt;
                          break t;
                        }
                      } else if (R.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === Sn && Vn(ft) === R.type) {
                        a(
                          U,
                          R.sibling
                        ), tt = c(R, Y.props), Qa(tt, Y), tt.return = U, U = tt;
                        break t;
                      }
                      a(U, R);
                      break;
                    } else e(U, R);
                    R = R.sibling;
                  }
                  Y.type === ya ? (tt = Wn(
                    Y.props.children,
                    U.mode,
                    tt,
                    Y.key
                  ), tt.return = U, U = tt) : (tt = lr(
                    Y.type,
                    Y.key,
                    Y.props,
                    null,
                    U.mode,
                    tt
                  ), Qa(tt, Y), tt.return = U, U = tt);
                }
                return g(U);
              case va:
                t: {
                  for (ft = Y.key; R !== null; ) {
                    if (R.key === ft)
                      if (R.tag === 4 && R.stateNode.containerInfo === Y.containerInfo && R.stateNode.implementation === Y.implementation) {
                        a(
                          U,
                          R.sibling
                        ), tt = c(
                          R,
                          Y.children || []
                        ), tt.return = U, U = tt;
                        break t;
                      } else {
                        a(U, R);
                        break;
                      }
                    else e(U, R);
                    R = R.sibling;
                  }
                  tt = so(Y, U.mode, tt), tt.return = U, U = tt;
                }
                return g(U);
              case Sn:
                return Y = Vn(Y), ra(
                  U,
                  R,
                  Y,
                  tt
                );
            }
            if (ir(Y))
              return re(
                U,
                R,
                Y,
                tt
              );
            if (S(Y)) {
              if (ft = S(Y), typeof ft != "function")
                throw Error(s(150));
              return Y = ft.call(Y), gl(
                U,
                R,
                Y,
                tt
              );
            }
            if (typeof Y.then == "function")
              return ra(
                U,
                R,
                Dl(Y),
                tt
              );
            if (Y.$$typeof === kn)
              return ra(
                U,
                R,
                Al(U, Y),
                tt
              );
            Hl(U, Y);
          }
          return typeof Y == "string" && Y !== "" || typeof Y == "number" || typeof Y == "bigint" ? (Y = "" + Y, R !== null && R.tag === 6 ? (a(U, R.sibling), tt = c(R, Y), tt.return = U, U = tt) : (a(U, R), tt = oo(Y, U.mode, tt), tt.return = U, U = tt), g(U)) : a(U, R);
        }
        return function(U, R, Y, tt) {
          try {
            cl = 0;
            var ft = ra(
              U,
              R,
              Y,
              tt
            );
            return Ma = null, ft;
          } catch (mt) {
            if (mt === Ca || mt === br) throw mt;
            var Ht = i(29, mt, null, U.mode);
            return Ht.lanes = tt, Ht.return = U, Ht;
          } finally {
          }
        };
      }
      function Bl() {
        for (var t = Aa, e = Oo = Aa = 0; e < t; ) {
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
          u !== 0 && Ps(a, c, u);
        }
      }
      function Ul(t, e, a, r) {
        je[Aa++] = t, je[Aa++] = e, je[Aa++] = a, je[Aa++] = r, Oo |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function mi(t, e, a, r) {
        return Ul(t, e, a, r), ql(t);
      }
      function Kn(t, e) {
        return Ul(t, null, null, e), ql(t);
      }
      function Ps(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - we(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
      }
      function ql(t) {
        if (50 < hl)
          throw hl = 0, Ko = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function pi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function hi(t, e) {
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
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = ql(t), Ps(t, null, a), e;
        }
        return Ul(t, r, e, a), ql(t);
      }
      function Va(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, w(t, a);
        }
      }
      function gi(t, e) {
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
        if (Ro) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function Xa(t, e, a, r) {
        Ro = !1;
        var c = t.updateQueue;
        Tn = !1;
        var u = c.firstBaseUpdate, g = c.lastBaseUpdate, M = c.shared.pending;
        if (M !== null) {
          c.shared.pending = null;
          var G = M, F = G.next;
          G.next = null, g === null ? u = F : g.next = F, g = G;
          var nt = t.alternate;
          nt !== null && (nt = nt.updateQueue, M = nt.lastBaseUpdate, M !== g && (M === null ? nt.firstBaseUpdate = F : M.next = F, nt.lastBaseUpdate = G));
        }
        if (u !== null) {
          var P = c.baseState;
          g = 0, nt = F = G = null, M = u;
          do {
            var lt = M.lane & -536870913, gt = lt !== M.lane;
            if (gt ? (kt & lt) === lt : (r & lt) === lt) {
              lt !== 0 && lt === Na && (Ro = !0), nt !== null && (nt = nt.next = {
                lane: 0,
                tag: M.tag,
                payload: M.payload,
                callback: null,
                next: null
              });
              t: {
                var re = t, gl = M;
                lt = e;
                var ra = a;
                switch (gl.tag) {
                  case 1:
                    if (re = gl.payload, typeof re == "function") {
                      P = re.call(
                        ra,
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
                    if (re = gl.payload, lt = typeof re == "function" ? re.call(ra, P, lt) : re, lt == null) break t;
                    P = uo({}, P, lt);
                    break t;
                  case 2:
                    Tn = !0;
                }
              }
              lt = M.callback, lt !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [lt] : gt.push(lt));
            } else
              gt = {
                lane: lt,
                tag: M.tag,
                payload: M.payload,
                callback: M.callback,
                next: null
              }, nt === null ? (F = nt = gt, G = P) : nt = nt.next = gt, g |= lt;
            if (M = M.next, M === null) {
              if (M = c.shared.pending, M === null)
                break;
              gt = M, M = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          nt === null && (G = P), c.baseState = G, c.firstBaseUpdate = F, c.lastBaseUpdate = nt, u === null && (c.shared.lanes = 0), Mn |= g, t.lanes = g, t.memoizedState = P;
        }
      }
      function tc(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function ec(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            tc(a[t], e);
      }
      function nc(t, e) {
        t = un, k(yr, t), k(ja, e), un = t | e.baseLanes;
      }
      function bi() {
        k(yr, un), k(ja, ja.current);
      }
      function vi() {
        un = yr.current, E(ja), E(yr);
      }
      function yn(t) {
        var e = t.alternate;
        k(Yt, Yt.current & 1), k(Se, t), Oe === null && (e === null || ja.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function yi(t) {
        k(Yt, Yt.current), k(Se, t), Oe === null && (Oe = t);
      }
      function ac(t) {
        t.tag === 22 ? (k(Yt, Yt.current), k(Se, t), Oe === null && (Oe = t)) : xn();
      }
      function xn() {
        k(Yt, Yt.current), k(Se, Se.current);
      }
      function ve(t) {
        E(Se), Oe === t && (Oe = null), E(Yt);
      }
      function Yl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || xo(a) || wo(a)))
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
      function Bt() {
        throw Error(s(321));
      }
      function xi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ke(t[a], e[a])) return !1;
        return !0;
      }
      function wi(t, e, a, r, c, u) {
        return sn = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? Md : Do, aa = !1, u = a(r, c), aa = !1, Oa && (u = rc(
          e,
          a,
          r,
          c
        )), lc(t), u;
      }
      function lc(t) {
        dt.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (sn = 0, Gt = Mt = bt = null, xr = !1, ul = 0, Ra = null, e) throw Error(s(300));
        t === null || Lt || (t = t.dependencies, t !== null && Ml(t) && (Lt = !0));
      }
      function rc(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Gt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          dt.H = Ad, u = e(a, r);
        } while (Oa);
        return u;
      }
      function Vm() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Za(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (bt.flags |= 1024), e;
      }
      function _i() {
        var t = wr !== 0;
        return wr = 0, t;
      }
      function ki(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function Si(t) {
        if (xr) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          xr = !1;
        }
        sn = 0, Gt = Mt = bt = null, Oa = !1, ul = wr = 0, Ra = null;
      }
      function fe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return Gt === null ? bt.memoizedState = Gt = t : Gt = Gt.next = t, Gt;
      }
      function qt() {
        if (Mt === null) {
          var t = bt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Mt.next;
        var e = Gt === null ? bt.memoizedState : Gt.next;
        if (e !== null)
          Gt = e, Mt = t;
        else {
          if (t === null)
            throw bt.alternate === null ? Error(s(467)) : Error(s(310));
          Mt = t, t = {
            memoizedState: Mt.memoizedState,
            baseState: Mt.baseState,
            baseQueue: Mt.baseQueue,
            queue: Mt.queue,
            next: null
          }, Gt === null ? bt.memoizedState = Gt = t : Gt = Gt.next = t;
        }
        return Gt;
      }
      function Gl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Za(t) {
        var e = ul;
        return ul += 1, Ra === null && (Ra = []), t = Ws(Ra, t, e), e = bt, (Gt === null ? e.memoizedState : Gt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? Md : Do), t;
      }
      function Ll(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === kn) return ee(t);
        }
        throw Error(s(438, String(t)));
      }
      function Ei(t) {
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
            a[r] = hp;
        return e.index++, a;
      }
      function Pe(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Ql(t) {
        var e = qt();
        return zi(e, Mt, t);
      }
      function zi(t, e, a) {
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
          var M = g = null, G = null, F = e, nt = !1;
          do {
            var P = F.lane & -536870913;
            if (P !== F.lane ? (kt & P) === P : (sn & P) === P) {
              var lt = F.revertLane;
              if (lt === 0)
                G !== null && (G = G.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: F.action,
                  hasEagerState: F.hasEagerState,
                  eagerState: F.eagerState,
                  next: null
                }), P === Na && (nt = !0);
              else if ((sn & lt) === lt) {
                F = F.next, lt === Na && (nt = !0);
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
                }, G === null ? (M = G = P, g = u) : G = G.next = P, bt.lanes |= lt, Mn |= lt;
              P = F.action, aa && a(u, P), u = F.hasEagerState ? F.eagerState : a(u, P);
            } else
              lt = {
                lane: P,
                revertLane: F.revertLane,
                gesture: F.gesture,
                action: F.action,
                hasEagerState: F.hasEagerState,
                eagerState: F.eagerState,
                next: null
              }, G === null ? (M = G = lt, g = u) : G = G.next = lt, bt.lanes |= P, Mn |= P;
            F = F.next;
          } while (F !== null && F !== e);
          if (G === null ? g = u : G.next = M, !ke(u, t.memoizedState) && (Lt = !0, nt && (a = Ta, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = g, t.baseQueue = G, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function Ni(t) {
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
      function ic(t, e, a) {
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
        if (g && (c.memoizedState = a, Lt = !0), c = c.queue, Mi(cc.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || g || Gt !== null && Gt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            sc.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          u || (sn & 127) !== 0 || oc(r, e, a);
        }
        return a;
      }
      function oc(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = Gl(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function sc(t, e, a, r) {
        e.value = a, e.getSnapshot = r, uc(e) && dc(t);
      }
      function cc(t, e, a) {
        return a(function() {
          uc(e) && dc(t);
        });
      }
      function uc(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ke(t, a);
        } catch {
          return !0;
        }
      }
      function dc(t) {
        var e = Kn(t, 2);
        e !== null && pe(e, t, 2);
      }
      function Ti(t) {
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
      function fc(t, e, a, r) {
        return t.baseState = a, zi(
          t,
          Mt,
          typeof r == "function" ? r : Pe
        );
      }
      function Km(t, e, a, r, c) {
        if (Xl(t)) throw Error(s(485));
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
          dt.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, mc(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function mc(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = dt.T, g = {};
          dt.T = g;
          try {
            var M = a(c, r), G = dt.S;
            G !== null && G(g, M), pc(t, e, M);
          } catch (F) {
            Ci(t, e, F);
          } finally {
            u !== null && g.types !== null && (u.types = g.types), dt.T = u;
          }
        } else
          try {
            u = a(c, r), pc(t, e, u);
          } catch (F) {
            Ci(t, e, F);
          }
      }
      function pc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            hc(t, e, r);
          },
          function(r) {
            return Ci(t, e, r);
          }
        ) : hc(t, e, a);
      }
      function hc(t, e, a) {
        e.status = "fulfilled", e.value = a, gc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, mc(t, a)));
      }
      function Ci(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, gc(e), e = e.next;
          while (e !== r);
        }
        t.action = null;
      }
      function gc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function bc(t, e) {
        return e;
      }
      function vc(t, e) {
        if (St) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (St) {
                if (Rt) {
                  var c = sh(
                    Rt,
                    Ae
                  );
                  if (c) {
                    Rt = fd(c), r = ch(c);
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
          lastRenderedReducer: bc,
          lastRenderedState: e
        }, a.queue = r, a = Hc.bind(
          null,
          bt,
          r
        ), r.dispatch = a, r = Ti(!1);
        var u = Ri.bind(
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
        }, r.queue = c, a = Km.bind(
          null,
          bt,
          c,
          u,
          a
        ), c.dispatch = a, r.memoizedState = t, [e, a, !1];
      }
      function yc(t) {
        var e = qt();
        return xc(e, Mt, t);
      }
      function xc(t, e, a) {
        if (e = zi(
          t,
          e,
          bc
        )[0], t = Ql(Pe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var r = Za(e);
          } catch (g) {
            throw g === Ca ? br : g;
          }
        else r = e;
        e = qt();
        var c = e.queue, u = c.dispatch;
        return a !== e.memoizedState && (bt.flags |= 2048, pa(
          9,
          { destroy: void 0 },
          Xm.bind(null, c, a),
          null
        )), [r, u, t];
      }
      function Xm(t, e) {
        t.action = e;
      }
      function wc(t) {
        var e = qt(), a = Mt;
        if (a !== null)
          return xc(e, a, t);
        qt(), e = e.memoizedState, a = qt();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = Gl(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function _c() {
        return qt().memoizedState;
      }
      function Vl(t, e, a, r) {
        var c = fe();
        bt.flags |= t, c.memoizedState = pa(
          1 | e,
          { destroy: void 0 },
          a,
          r === void 0 ? null : r
        );
      }
      function Kl(t, e, a, r) {
        var c = qt();
        r = r === void 0 ? null : r;
        var u = c.memoizedState.inst;
        Mt !== null && r !== null && xi(r, Mt.memoizedState.deps) ? c.memoizedState = pa(e, u, a, r) : (bt.flags |= t, c.memoizedState = pa(
          1 | e,
          u,
          a,
          r
        ));
      }
      function kc(t, e) {
        Vl(8390656, 8, t, e);
      }
      function Mi(t, e) {
        Kl(2048, 8, t, e);
      }
      function Zm(t) {
        bt.flags |= 4;
        var e = bt.updateQueue;
        if (e === null)
          e = Gl(), bt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Sc(t) {
        var e = qt().memoizedState;
        return Zm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Ec(t, e) {
        return Kl(4, 2, t, e);
      }
      function zc(t, e) {
        return Kl(4, 4, t, e);
      }
      function Nc(t, e) {
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
      function Tc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Kl(
          4,
          4,
          Nc.bind(null, e, t),
          a
        );
      }
      function Ai() {
      }
      function Cc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && xi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function Mc(t, e) {
        var a = qt();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && xi(e, r[1]))
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
      function ji(t, e, a) {
        return a === void 0 || (sn & 1073741824) !== 0 && (kt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = zu(), bt.lanes |= t, Mn |= t, a);
      }
      function Ac(t, e, a, r) {
        return ke(a, e) ? a : ja.current !== null ? (t = ji(t, a, r), ke(t, e) || (Lt = !0), t) : (sn & 42) === 0 || (sn & 1073741824) !== 0 && (kt & 261930) === 0 ? (Lt = !0, t.memoizedState = a) : (t = zu(), bt.lanes |= t, Mn |= t, e);
      }
      function jc(t, e, a, r, c) {
        var u = rn();
        $t(
          u !== 0 && 8 > u ? u : 8
        );
        var g = dt.T, M = {};
        dt.T = M, Ri(t, !1, e, a);
        try {
          var G = c(), F = dt.S;
          if (F !== null && F(M, G), G !== null && typeof G == "object" && typeof G.then == "function") {
            var nt = Qm(
              G,
              r
            );
            Ja(
              t,
              e,
              nt,
              ye(t)
            );
          } else
            Ja(
              t,
              e,
              r,
              ye(t)
            );
        } catch (P) {
          Ja(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: P },
            ye()
          );
        } finally {
          $t(u), g !== null && M.types !== null && (g.types = M.types), dt.T = g;
        }
      }
      function Oc(t) {
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
      function Oi() {
        return ee(In);
      }
      function Rc() {
        return qt().memoizedState;
      }
      function Dc() {
        return qt().memoizedState;
      }
      function Jm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = ye();
              t = bn(a);
              var r = vn(e, t, a);
              r !== null && (pe(r, e, a), Va(r, e, a)), e = { cache: ui() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Wm(t, e, a) {
        var r = ye();
        a = {
          lane: r,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Xl(t) ? Bc(e, a) : (a = mi(t, e, a, r), a !== null && (pe(a, t, r), Uc(a, e, r)));
      }
      function Hc(t, e, a) {
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
        if (Xl(t)) Bc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var g = e.lastRenderedState, M = u(g, a);
              if (c.hasEagerState = !0, c.eagerState = M, ke(M, g))
                return Ul(t, e, c, 0), At === null && Bl(), !1;
            } catch {
            } finally {
            }
          if (a = mi(t, e, c, r), a !== null)
            return pe(a, t, r), Uc(a, e, r), !0;
        }
        return !1;
      }
      function Ri(t, e, a, r) {
        if (r = {
          lane: 2,
          revertLane: di(),
          gesture: null,
          action: r,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Xl(t)) {
          if (e) throw Error(s(479));
        } else
          e = mi(
            t,
            a,
            r,
            2
          ), e !== null && pe(e, t, 2);
      }
      function Xl(t) {
        var e = t.alternate;
        return t === bt || e !== null && e === bt;
      }
      function Bc(t, e) {
        Oa = xr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Uc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, w(t, a);
        }
      }
      function Di(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : uo({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function qc(t, e, a, r, c, u, g) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, g) : e.prototype && e.prototype.isPureReactComponent ? !Rl(a, r) || !Rl(c, u) : !0;
      }
      function Yc(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Ho.enqueueReplaceState(e, e.state, null);
      }
      function Xn(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var r in e)
            r !== "ref" && (a[r] = e[r]);
        }
        if (t = t.defaultProps) {
          a === e && (a = uo({}, a));
          for (var c in t)
            a[c] === void 0 && (a[c] = t[c]);
        }
        return a;
      }
      function Zl(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Gc(t, e, a) {
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
      function Hi(t, e, a) {
        return a = bn(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Zl(t, e);
        }, a;
      }
      function Lc(t) {
        return t = bn(t), t.tag = 3, t;
      }
      function Qc(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Gc(e, a, r);
          };
        }
        var g = a.stateNode;
        g !== null && typeof g.componentDidCatch == "function" && (t.callback = function() {
          Gc(e, a, r), typeof c != "function" && (An === null ? An = /* @__PURE__ */ new Set([this]) : An.add(this));
          var M = r.stack;
          this.componentDidCatch(r.value, {
            componentStack: M !== null ? M : ""
          });
        });
      }
      function Fm(t, e, a, r, c) {
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
                return Oe === null ? nr() : a.alternate === null && Ut === 0 && (Ut = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === vr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), ro(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === vr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), ro(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return ro(t, r, c), nr(), !1;
        }
        if (St)
          return e = Se.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== To && (t = Error(s(422), { cause: r }), Ga(
            L(t, a)
          ))) : (r !== To && (e = Error(s(423), {
            cause: r
          }), Ga(
            L(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = L(r, a), c = Hi(
            t.stateNode,
            r,
            c
          ), gi(t, c), Ut !== 4 && (Ut = 2)), !1;
        var u = Error(s(520), { cause: r });
        if (u = L(u, a), ml === null ? ml = [u] : ml.push(u), Ut !== 4 && (Ut = 2), e === null) return !0;
        r = L(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Hi(a.stateNode, r, t), gi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (An === null || !An.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Lc(c), Qc(
                  c,
                  t,
                  a,
                  r
                ), gi(a, c), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function ne(t, e, a, r) {
        e.child = t === null ? Cd(e, null, a, r) : na(
          e,
          t.child,
          a,
          r
        );
      }
      function Vc(t, e, a, r, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in r) {
          var g = {};
          for (var M in r)
            M !== "ref" && (g[M] = r[M]);
        } else g = r;
        return Qn(e), r = wi(
          t,
          e,
          a,
          g,
          u,
          c
        ), M = _i(), t !== null && !Lt ? (ki(t, e, c), tn(t, e, c)) : (St && M && Z(e), e.flags |= 1, ne(t, e, r, c), e.child);
      }
      function Kc(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !io(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Xc(
            t,
            e,
            u,
            r,
            c
          )) : (t = lr(
            a.type,
            null,
            r,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !Qi(t, c)) {
          var g = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : Rl, a(g, r) && t.ref === e.ref)
            return tn(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = an(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function Xc(t, e, a, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (Rl(u, r) && t.ref === e.ref)
            if (Lt = !1, e.pendingProps = r = u, Qi(t, c))
              (t.flags & 131072) !== 0 && (Lt = !0);
            else
              return e.lanes = t.lanes, tn(t, e, c);
        }
        return Bi(
          t,
          e,
          a,
          r,
          c
        );
      }
      function Zc(t, e, a, r) {
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
            return Jc(
              t,
              e,
              u,
              a,
              r
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Ol(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? nc(e, u) : bi(), ac(e);
          else
            return r = e.lanes = 536870912, Jc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (Ol(e, u.cachePool), nc(e, u), xn(), e.memoizedState = null) : (t !== null && Ol(e, null), bi(), xn());
        return ne(t, e, c, a), e.child;
      }
      function Wa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function Jc(t, e, a, r, c) {
        var u = fi();
        return u = u === null ? null : {
          parent: ln ? Dt._currentValue : Dt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && Ol(e, null), bi(), ac(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Jl(t, e) {
        return e = Fl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Wc(t, e, a) {
        return na(e, t.child, null, a), t = Jl(
          e,
          e.pendingProps
        ), t.flags |= 2, ve(e), e.memoizedState = null, t;
      }
      function Im(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (r.mode === "hidden")
              return t = Jl(e, r), e.lanes = 536870912, Wa(null, t);
            if (yi(e), (t = Rt) ? (t = vh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: En !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Xu(t), a.return = e, e.child = a, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Jl(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var g = u.dehydrated;
          if (yi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Wc(
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
            if (r = At, r !== null && (g = C(r, a), g !== 0 && g !== u.retryLane))
              throw u.retryLane = g, Kn(t, g), pe(r, t, g), Bo;
            nr(), e = Wc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ue && (Rt = mh(g), le = e, St = !0, Nn = null, Ae = !1, t !== null && st(e, t)), e = Jl(e, r), e.flags |= 4096;
          return e;
        }
        return t = an(t.child, {
          mode: r.mode,
          children: r.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Wl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Bi(t, e, a, r, c) {
        return Qn(e), a = wi(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = _i(), t !== null && !Lt ? (ki(t, e, c), tn(t, e, c)) : (St && r && Z(e), e.flags |= 1, ne(t, e, a, c), e.child);
      }
      function Fc(t, e, a, r, c, u) {
        return Qn(e), e.updateQueue = null, a = rc(
          e,
          r,
          a,
          c
        ), lc(t), r = _i(), t !== null && !Lt ? (ki(t, e, u), tn(t, e, u)) : (St && r && Z(e), e.flags |= 1, ne(t, e, a, u), e.child);
      }
      function Ic(t, e, a, r, c) {
        if (Qn(e), e.stateNode === null) {
          var u = ka, g = a.contextType;
          typeof g == "object" && g !== null && (u = ee(g)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Ho, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, pi(e), g = a.contextType, u.context = typeof g == "object" && g !== null ? ee(g) : ka, u.state = e.memoizedState, g = a.getDerivedStateFromProps, typeof g == "function" && (Di(
            e,
            a,
            g,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (g = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), g !== u.state && Ho.enqueueReplaceState(
            u,
            u.state,
            null
          ), Xa(e, r, u, c), Ka(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var M = e.memoizedProps, G = Xn(a, M);
          u.props = G;
          var F = u.context, nt = a.contextType;
          g = ka, typeof nt == "object" && nt !== null && (g = ee(nt));
          var P = a.getDerivedStateFromProps;
          nt = typeof P == "function" || typeof u.getSnapshotBeforeUpdate == "function", M = e.pendingProps !== M, nt || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (M || F !== g) && Yc(
            e,
            u,
            r,
            g
          ), Tn = !1;
          var lt = e.memoizedState;
          u.state = lt, Xa(e, r, u, c), Ka(), F = e.memoizedState, M || lt !== F || Tn ? (typeof P == "function" && (Di(
            e,
            a,
            P,
            r
          ), F = e.memoizedState), (G = Tn || qc(
            e,
            a,
            G,
            r,
            lt,
            F,
            g
          )) ? (nt || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = F), u.props = r, u.state = F, u.context = g, r = G) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, hi(t, e), g = e.memoizedProps, nt = Xn(a, g), u.props = nt, P = e.pendingProps, lt = u.context, F = a.contextType, G = ka, typeof F == "object" && F !== null && (G = ee(F)), M = a.getDerivedStateFromProps, (F = typeof M == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (g !== P || lt !== G) && Yc(
            e,
            u,
            r,
            G
          ), Tn = !1, lt = e.memoizedState, u.state = lt, Xa(e, r, u, c), Ka();
          var gt = e.memoizedState;
          g !== P || lt !== gt || Tn || t !== null && t.dependencies !== null && Ml(t.dependencies) ? (typeof M == "function" && (Di(
            e,
            a,
            M,
            r
          ), gt = e.memoizedState), (nt = Tn || qc(
            e,
            a,
            nt,
            r,
            lt,
            gt,
            G
          ) || t !== null && t.dependencies !== null && Ml(t.dependencies)) ? (F || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(r, gt, G), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            r,
            gt,
            G
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = r, e.memoizedState = gt), u.props = r, u.state = gt, u.context = G, r = nt) : (typeof u.componentDidUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || g === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), r = !1);
        }
        return u = r, Wl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = na(
          e,
          t.child,
          null,
          c
        ), e.child = na(
          e,
          null,
          a,
          c
        )) : ne(t, e, a, c), e.memoizedState = u.state, t = e.child) : t = tn(
          t,
          e,
          c
        ), t;
      }
      function $c(t, e, a, r) {
        return He(), e.flags |= 256, ne(t, e, a, r), e.child;
      }
      function Ui(t) {
        return { baseLanes: t, cachePool: Zs() };
      }
      function qi(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= ze), t;
      }
      function Pc(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, g;
        if ((g = u) || (g = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), g && (c = !0, e.flags &= -129), g = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? yn(e) : xn(), (t = Rt) ? (t = yh(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: En !== null ? { id: Xe, overflow: Ze } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = Xu(t), a.return = e, e.child = a, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return wo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var M = r.children;
          return r = r.fallback, c ? (xn(), c = e.mode, M = Fl(
            { mode: "hidden", children: M },
            c
          ), r = Wn(
            r,
            c,
            a,
            null
          ), M.return = e, r.return = e, M.sibling = r, e.child = M, r = e.child, r.memoizedState = Ui(a), r.childLanes = qi(
            t,
            g,
            a
          ), e.memoizedState = Uo, Wa(null, r)) : (yn(e), Yi(e, M));
        }
        var G = t.memoizedState;
        if (G !== null && (M = G.dehydrated, M !== null)) {
          if (u)
            e.flags & 256 ? (yn(e), e.flags &= -257, e = Gi(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (xn(), e.child = t.child, e.flags |= 128, e = null) : (xn(), M = r.fallback, c = e.mode, r = Fl(
              { mode: "visible", children: r.children },
              c
            ), M = Wn(
              M,
              c,
              a,
              null
            ), M.flags |= 2, r.return = e, M.return = e, r.sibling = M, e.child = r, na(
              e,
              t.child,
              null,
              a
            ), r = e.child, r.memoizedState = Ui(a), r.childLanes = qi(
              t,
              g,
              a
            ), e.memoizedState = Uo, e = Wa(null, r));
          else if (yn(e), wo(M))
            g = ih(M).digest, r = Error(s(419)), r.stack = "", r.digest = g, Ga({ value: r, source: null, stack: null }), e = Gi(
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
            if (g = At, g !== null && (r = C(
              g,
              a
            ), r !== 0 && r !== G.retryLane))
              throw G.retryLane = r, Kn(t, r), pe(g, t, r), Bo;
            xo(M) || nr(), e = Gi(
              t,
              e,
              a
            );
          } else
            xo(M) ? (e.flags |= 192, e.child = t.child, e = null) : (t = G.treeContext, ue && (Rt = ph(
              M
            ), le = e, St = !0, Nn = null, Ae = !1, t !== null && st(e, t)), e = Yi(
              e,
              r.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (xn(), M = r.fallback, c = e.mode, G = t.child, u = G.sibling, r = an(G, {
          mode: "hidden",
          children: r.children
        }), r.subtreeFlags = G.subtreeFlags & 65011712, u !== null ? M = an(
          u,
          M
        ) : (M = Wn(
          M,
          c,
          a,
          null
        ), M.flags |= 2), M.return = e, r.return = e, r.sibling = M, e.child = r, Wa(null, r), r = e.child, M = t.child.memoizedState, M === null ? M = Ui(a) : (c = M.cachePool, c !== null ? (G = ln ? Dt._currentValue : Dt._currentValue2, c = c.parent !== G ? { parent: G, pool: G } : c) : c = Zs(), M = {
          baseLanes: M.baseLanes | a,
          cachePool: c
        }), r.memoizedState = M, r.childLanes = qi(
          t,
          g,
          a
        ), e.memoizedState = Uo, Wa(t.child, r)) : (yn(e), a = t.child, t = a.sibling, a = an(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (g = e.deletions, g === null ? (e.deletions = [t], e.flags |= 16) : g.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Yi(t, e) {
        return e = Fl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Fl(t, e) {
        return t = i(22, t, null, e), t.lanes = 0, t;
      }
      function Gi(t, e, a) {
        return na(e, t.child, null, a), t = Yi(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function tu(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), si(t.return, e, a);
      }
      function Li(t, e, a, r, c, u) {
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
      function eu(t, e, a) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var g = Yt.current, M = (g & 2) !== 0;
        if (M ? (g = g & 1 | 2, e.flags |= 128) : g &= 1, k(Yt, g), ne(t, e, r, a), r = St ? il : 0, !M && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && tu(t, a, e);
            else if (t.tag === 19)
              tu(t, a, e);
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
              t = a.alternate, t !== null && Yl(t) === null && (c = a), a = a.sibling;
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), Li(
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
              if (t = c.alternate, t !== null && Yl(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = a, a = c, c = t;
            }
            Li(
              e,
              !0,
              a,
              null,
              u,
              r
            );
            break;
          case "together":
            Li(
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
      function Qi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Ml(t)));
      }
      function $m(t, e, a) {
        switch (e.tag) {
          case 3:
            ct(
              e,
              e.stateNode.containerInfo
            ), gn(e, Dt, t.memoizedState.cache), He();
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
              return e.flags |= 128, yi(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (yn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Pc(
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
                return eu(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), k(Yt, Yt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Zc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            gn(e, Dt, t.memoizedState.cache);
        }
        return tn(t, e, a);
      }
      function nu(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Lt = !0;
          else {
            if (!Qi(t, a) && (e.flags & 128) === 0)
              return Lt = !1, $m(
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
                io(t) ? (r = Xn(t, r), e.tag = 1, e = Ic(
                  null,
                  e,
                  t,
                  r,
                  a
                )) : (e.tag = 0, e = Bi(
                  null,
                  e,
                  t,
                  r,
                  a
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === mo) {
                    e.tag = 11, e = Vc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === go) {
                    e.tag = 14, e = Kc(
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
            return Bi(
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
            ), Ic(
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
              c = e.memoizedState, r = c.element, hi(t, e), Xa(e, u, null, a);
              var g = e.memoizedState;
              if (u = g.cache, gn(e, Dt, u), u !== c.cache && ci(
                e,
                [Dt],
                a,
                !0
              ), Ka(), u = g.element, ue && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: g.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = $c(
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
                  ), Ga(r), e = $c(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ue && (Rt = fh(
                    e.stateNode.containerInfo
                  ), le = e, St = !0, Nn = null, Ae = !0), a = Cd(
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
                ne(t, e, u, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Ye)
              return Wl(t, e), t === null ? (a = hd(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : St || (e.stateNode = qh(
                e.type,
                e.pendingProps,
                zn.current,
                e
              )) : e.memoizedState = hd(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Zt)
              return Et(e), t === null && Zt && St && (r = e.stateNode = wd(
                e.type,
                e.pendingProps,
                zn.current,
                ae.current,
                !1
              ), le = e, Ae = !0, Rt = hh(
                e.type,
                r,
                Rt
              )), ne(
                t,
                e,
                e.pendingProps.children,
                a
              ), Wl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (Hh(
              e.type,
              e.pendingProps,
              ae.current
            ), (c = r = Rt) && (r = gh(
              r,
              e.type,
              e.pendingProps,
              Ae
            ), r !== null ? (e.stateNode = r, le = e, Rt = dh(r), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, u = e.pendingProps, g = t !== null ? t.memoizedProps : null, r = u.children, or(c, u) ? r = null : g !== null && or(c, g) && (e.flags |= 32), e.memoizedState !== null && (c = wi(
              t,
              e,
              Vm,
              null,
              null,
              a
            ), ln ? In._currentValue = c : In._currentValue2 = c), Wl(t, e), ne(t, e, r, a), e.child;
          case 6:
            return t === null && St && (Bh(
              e.pendingProps,
              ae.current
            ), (t = a = Rt) && (a = bh(
              a,
              e.pendingProps,
              Ae
            ), a !== null ? (e.stateNode = a, le = e, Rt = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return Pc(t, e, a);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), r = e.pendingProps, t === null ? e.child = na(
              e,
              null,
              r,
              a
            ) : ne(t, e, r, a), e.child;
          case 11:
            return Vc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return ne(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return ne(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return ne(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return r = e.pendingProps, gn(e, e.type, r.value), ne(
              t,
              e,
              r.children,
              a
            ), e.child;
          case 9:
            return c = e.type._context, r = e.pendingProps.children, Qn(e), c = ee(c), r = r(c), e.flags |= 1, ne(t, e, r, a), e.child;
          case 14:
            return Kc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return Xc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return eu(
              t,
              e,
              a
            );
          case 31:
            return Im(t, e, a);
          case 22:
            return Zc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Qn(e), r = ee(Dt), t === null ? (c = fi(), c === null && (c = At, u = ui(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, pi(e), gn(e, Dt, c)) : ((t.lanes & a) !== 0 && (hi(t, e), Xa(e, null, null, a), Ka()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), gn(e, Dt, r)) : (r = u.cache, gn(e, Dt, r), r !== c.cache && ci(
              e,
              [Dt],
              a,
              !0
            ))), ne(
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
      function Il(t) {
        Ke && (t.flags |= 8);
      }
      function au(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function Vi(t, e, a, r) {
        if (ce)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              vo(t, a.stateNode);
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
              a && r && (u = ud(
                u,
                c.type,
                c.memoizedProps
              )), vo(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = dd(
                u,
                c.memoizedProps
              )), vo(t, u);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                u = c.child, u !== null && (u.return = c), Vi(t, c, !0, !0);
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
      function lu(t, e, a, r) {
        var c = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var g = u.stateNode;
              a && r && (g = ud(
                g,
                u.type,
                u.memoizedProps
              )), sd(t, g);
            } else if (u.tag === 6)
              g = u.stateNode, a && r && (g = dd(
                g,
                u.memoizedProps
              )), sd(t, g);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                c = u.child, c !== null && (c.return = u), lu(t, u, !0, !0), c = !0;
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
      function ru(t, e) {
        if (Ke && au(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = od();
          lu(r, e, !1, !1), t.pendingChildren = r, Be(e), rh(a, r);
        }
      }
      function Ki(t, e, a, r) {
        if (ce)
          t.memoizedProps !== r && Be(e);
        else if (Ke) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = au(t, e)) || u !== r) {
            var g = ae.current;
            u = lh(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Il(e), nd(
              u,
              a,
              r,
              g
            ) && Be(e), e.stateNode = u, t && Vi(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Xi(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? Ap(e, r) : jp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || yo(e, r))
            if (ld(t.stateNode, e, r))
              t.flags |= 8192;
            else if (Au()) t.flags |= 8192;
            else
              throw ea = vr, jo;
        } else t.flags &= -16777217;
      }
      function iu(t, e) {
        if (Gh(e)) {
          if (t.flags |= 16777216, !xd(e))
            if (Au()) t.flags |= 8192;
            else
              throw ea = vr, jo;
        } else t.flags &= -16777217;
      }
      function $l(t, e) {
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
      function Ot(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, r = 0;
        if (e)
          for (var c = t.child; c !== null; )
            a |= c.lanes | c.childLanes, r |= c.subtreeFlags & 65011712, r |= c.flags & 65011712, c.return = t, c = c.sibling;
        else
          for (c = t.child; c !== null; )
            a |= c.lanes | c.childLanes, r |= c.subtreeFlags, r |= c.flags, c.return = t, c = c.sibling;
        return t.subtreeFlags |= r, t.childLanes = a, e;
      }
      function Pm(t, e, a) {
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
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), $e(Dt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (De(e) ? Be(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, hn())), ru(t, e), Ot(e), null;
          case 26:
            if (Ye) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (Be(e), u !== null ? (Ot(e), iu(
                e,
                u
              )) : (Ot(e), Xi(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (Be(e), Ot(e), iu(
                e,
                u
              )) : (Ot(e), e.flags &= -16777217) : (u = t.memoizedProps, ce ? u !== r && Be(e) : Ki(
                t,
                e,
                c,
                r
              ), Ot(e), Xi(
                e,
                c,
                u,
                r,
                a
              )), null;
            }
          case 27:
            if (Zt) {
              if (It(e), a = zn.current, c = e.type, t !== null && e.stateNode != null)
                ce ? t.memoizedProps !== r && Be(e) : Ki(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return Ot(e), null;
                }
                t = ae.current, De(e) ? Gn(e, t) : (t = wd(
                  c,
                  r,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Be(e));
              }
              return Ot(e), null;
            }
          case 5:
            if (It(e), c = e.type, t !== null && e.stateNode != null)
              Ki(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return Ot(e), null;
              }
              if (u = ae.current, De(e))
                Gn(e, u), Mh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var g = kp(
                  c,
                  r,
                  zn.current,
                  u,
                  e
                );
                Il(e), Vi(g, e, !1, !1), e.stateNode = g, nd(
                  g,
                  c,
                  r,
                  u
                ) && Be(e);
              }
            }
            return Ot(e), Xi(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ce ? a !== r && Be(e) : Ke && (a !== r ? (t = zn.current, a = ae.current, Il(e), e.stateNode = ad(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = zn.current, a = ae.current, De(e)) {
                if (!ue) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = le, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      r = c.memoizedProps;
                  }
                wh(
                  t,
                  a,
                  e,
                  r
                ) || ht(e, !0);
              } else
                Il(e), e.stateNode = ad(
                  r,
                  t,
                  a,
                  e
                );
            }
            return Ot(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (r = De(e), a !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!ue) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  _h(t, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), t = !1;
              } else
                a = hn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (ve(e), e) : (ve(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return Ot(e), null;
          case 13:
            if (r = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = De(e), r !== null && r.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(s(318));
                  if (!ue) throw Error(s(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(s(317));
                  kh(c, e);
                } else
                  He(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), c = !1;
              } else
                c = hn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ve(e), e) : (ve(e), null);
            }
            return ve(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = r !== null, t = t !== null && t.memoizedState !== null, a && (r = e.child, c = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (c = r.alternate.memoizedState.cachePool.pool), u = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (u = r.memoizedState.cachePool.pool), u !== c && (r.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), $l(e, e.updateQueue), Ot(e), null);
          case 4:
            return ut(), ru(t, e), t === null && Np(e.stateNode.containerInfo), Ot(e), null;
          case 10:
            return $e(e.type), Ot(e), null;
          case 19:
            if (E(Yt), r = e.memoizedState, r === null) return Ot(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Ut !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Yl(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, $l(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Ku(a, t), a = a.sibling;
                      return k(
                        Yt,
                        Yt.current & 1 | 2
                      ), St && V(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && he() > pl && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Yl(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, $l(e, t), Fa(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !St)
                    return Ot(e), null;
                } else
                  2 * he() - r.renderingStartTime > pl && a !== 536870912 && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = he(), t.sibling = null, a = Yt.current, k(
              Yt,
              c ? a & 1 | 2 : a & 1
            ), St && V(e, r.treeForkCount), t) : (Ot(e), null);
          case 22:
          case 23:
            return ve(e), vi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (Ot(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ot(e), a = e.updateQueue, a !== null && $l(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && E(ta), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), $e(Dt), Ot(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function tp(t, e) {
        switch (at(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return $e(Dt), ut(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return It(e), null;
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
            return E(Yt), null;
          case 4:
            return ut(), null;
          case 10:
            return $e(e.type), null;
          case 22:
          case 23:
            return ve(e), vi(), t !== null && E(ta), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return $e(Dt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function ou(t, e) {
        switch (at(e), e.tag) {
          case 3:
            $e(Dt), ut();
            break;
          case 26:
          case 27:
          case 5:
            It(e);
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
            E(Yt);
            break;
          case 10:
            $e(e.type);
            break;
          case 22:
          case 23:
            ve(e), vi(), t !== null && E(ta);
            break;
          case 24:
            $e(Dt);
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
        } catch (M) {
          zt(e, e.return, M);
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
                var g = r.inst, M = g.destroy;
                if (M !== void 0) {
                  g.destroy = void 0, c = e;
                  var G = a, F = M;
                  try {
                    F();
                  } catch (nt) {
                    zt(
                      c,
                      G,
                      nt
                    );
                  }
                }
              }
              r = r.next;
            } while (r !== u);
          }
        } catch (nt) {
          zt(e, e.return, nt);
        }
      }
      function su(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            ec(e, a);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function cu(t, e, a) {
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
      function uu(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          Zp(r, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function Zi(t, e, a) {
        try {
          Jp(
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
      function du(t) {
        return t.tag === 5 || t.tag === 3 || (Ye ? t.tag === 26 : !1) || (Zt ? t.tag === 27 && wa(t.type) : !1) || t.tag === 4;
      }
      function Ji(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || du(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Zt && t.tag === 27 && wa(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Wi(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Fp(a, t, e) : Kp(a, t);
        else if (r !== 4 && (Zt && r === 27 && wa(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Wi(t, e, a), t = t.sibling; t !== null; )
            Wi(t, e, a), t = t.sibling;
      }
      function Pl(t, e, a) {
        var r = t.tag;
        if (r === 5 || r === 6)
          t = t.stateNode, e ? Wp(a, t, e) : Vp(a, t);
        else if (r !== 4 && (Zt && r === 27 && wa(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Pl(t, e, a), t = t.sibling; t !== null; )
            Pl(t, e, a), t = t.sibling;
      }
      function fu(t, e, a) {
        t = t.containerInfo;
        try {
          cd(t, a);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function mu(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Qh(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function ep(t, e) {
        for (wp(t.containerInfo), Pt = e; Pt !== null; )
          if (t = Pt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Pt = e;
          else
            for (; Pt !== null; ) {
              t = Pt;
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
                    } catch (M) {
                      zt(r, r.return, M);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && ah(t.stateNode.containerInfo);
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
                e.return = t.return, Pt = e;
                break;
              }
              Pt = t.return;
            }
      }
      function pu(t, e, a) {
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
            r & 64 && su(a), r & 512 && $a(a, a.return);
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
                ec(r, t);
              } catch (g) {
                zt(a, a.return, g);
              }
            }
            break;
          case 27:
            Zt && e === null && r & 4 && mu(a);
          case 26:
          case 5:
            if (en(t, a), e === null) {
              if (r & 4) uu(a);
              else if (r & 64) {
                t = a.type, e = a.memoizedProps, c = a.stateNode;
                try {
                  zh(
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
            en(t, a), r & 4 && gu(t, a);
            break;
          case 13:
            en(t, a), r & 4 && bu(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = sp.bind(
              null,
              a
            ), oh(r, a))));
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
      function hu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, hu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Mp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, a) {
        for (a = a.child; a !== null; )
          Fi(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function Fi(t, e, a) {
        if (_e && typeof _e.onCommitFiberUnmount == "function")
          try {
            _e.onCommitFiberUnmount(rl, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ye) {
              Qt || Ve(a, e), Ue(
                t,
                e,
                a
              ), a.memoizedState ? bd(a.memoizedState) : a.stateNode && yd(a.stateNode);
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
              ), _d(a.stateNode), Vt = r, ge = c;
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
                    $p(Vt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Ip(Vt, a.stateNode);
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
            ce && Vt !== null && (ge ? Oh(
              Vt,
              a.stateNode
            ) : jh(Vt, a.stateNode));
            break;
          case 4:
            ce ? (r = Vt, c = ge, Vt = a.stateNode.containerInfo, ge = !0, Ue(
              t,
              e,
              a
            ), Vt = r, ge = c) : (Ke && fu(
              a.stateNode,
              a,
              od()
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
            Qt || (Ve(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && cu(
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
      function gu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            Th(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function bu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Ch(t);
          } catch (a) {
            zt(e, e.return, a);
          }
      }
      function np(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new jd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new jd()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function tr(t, e) {
        var a = np(t);
        e.forEach(function(r) {
          if (!a.has(r)) {
            a.add(r);
            var c = cp.bind(null, t, r);
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
              var M = g;
              t: for (; M !== null; ) {
                switch (M.tag) {
                  case 27:
                    if (Zt) {
                      if (wa(M.type)) {
                        Vt = M.stateNode, ge = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Vt = M.stateNode, ge = !1;
                    break t;
                  case 3:
                  case 4:
                    Vt = M.stateNode.containerInfo, ge = !0;
                    break t;
                }
                M = M.return;
              }
              if (Vt === null) throw Error(s(160));
              Fi(u, g, c), Vt = null, ge = !1;
            } else Fi(u, g, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            vu(e, t), e = e.sibling;
      }
      function vu(t, e) {
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
            if (Ye) {
              var c = Ge;
              if (se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Uh(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : vd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = gd(
                  c,
                  u,
                  t.memoizedProps
                ) : r !== u ? (r === null ? a.stateNode !== null && yd(a.stateNode) : bd(r), u === null ? vd(
                  c,
                  t.type,
                  t.stateNode
                ) : gd(
                  c,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && Zi(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Zt) {
              se(e, t), me(t), r & 512 && (Qt || a === null || Ve(a, a.return)), a !== null && r & 4 && Zi(
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
                  id(c);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Zi(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (qo = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (se(e, t), me(t), r & 4 && ce) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                Xp(c, a, r);
              } catch (P) {
                zt(t, t.return, P);
              }
            }
            break;
          case 3:
            if (Ye ? (Yh(), c = Ge, Ge = _o(e.containerInfo), se(e, t), Ge = c) : se(e, t), me(t), r & 4) {
              if (ce && ue && a !== null && a.memoizedState.isDehydrated)
                try {
                  Nh(e.containerInfo);
                } catch (P) {
                  zt(t, t.return, P);
                }
              if (Ke) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  cd(r, a);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
            }
            qo && (qo = !1, yu(t));
            break;
          case 4:
            Ye ? (a = Ge, Ge = _o(
              t.stateNode.containerInfo
            ), se(e, t), me(t), Ge = a) : (se(e, t), me(t)), r & 4 && Ke && fu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            se(e, t), me(t);
            break;
          case 31:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, tr(t, r)));
            break;
          case 13:
            se(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (Nr = he()), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, tr(t, r)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var g = a !== null && a.memoizedState !== null, M = cn, G = Qt;
            if (cn = M || c, Qt = G || g, se(e, t), Qt = G, cn = M, me(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || g || cn || Qt || Zn(t)), ce)) {
              t: if (a = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ye && e.tag === 26) {
                    if (a === null) {
                      g = a = e;
                      try {
                        u = g.stateNode, c ? Pp(u) : eh(
                          g.stateNode,
                          g.memoizedProps
                        );
                      } catch (P) {
                        zt(g, g.return, P);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      g = e;
                      try {
                        var F = g.stateNode;
                        c ? th(F) : nh(F, g.memoizedProps);
                      } catch (P) {
                        zt(g, g.return, P);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      g = e;
                      try {
                        var nt = g.stateNode;
                        c ? Rh(nt) : Dh(g.stateNode);
                      } catch (P) {
                        zt(g, g.return, P);
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
            r & 4 && (r = t.updateQueue, r !== null && (a = r.retryQueue, a !== null && (r.retryQueue = null, tr(t, a))));
            break;
          case 19:
            se(e, t), me(t), r & 4 && (r = t.updateQueue, r !== null && (t.updateQueue = null, tr(t, r)));
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
              if (du(r)) {
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
                    var c = a.stateNode, u = Ji(t);
                    Pl(t, u, c);
                    break;
                  }
                case 5:
                  var g = a.stateNode;
                  a.flags & 32 && (id(g), a.flags &= -33);
                  var M = Ji(t);
                  Pl(t, M, g);
                  break;
                case 3:
                case 4:
                  var G = a.stateNode.containerInfo, F = Ji(t);
                  Wi(
                    t,
                    F,
                    G
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (nt) {
            zt(t, t.return, nt);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function yu(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            yu(e), e.tag === 5 && e.flags & 1024 && Dp(e.stateNode), t = t.sibling;
          }
      }
      function en(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            pu(t, e.alternate, e), e = e.sibling;
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
              typeof a.componentWillUnmount == "function" && cu(
                e,
                e.return,
                a
              ), Zn(e);
              break;
            case 27:
              Zt && _d(e.stateNode);
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
                } catch (F) {
                  zt(r, r.return, F);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var M = r.stateNode;
                try {
                  var G = c.shared.hiddenCallbacks;
                  if (G !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < G.length; c++)
                      tc(G[c], M);
                } catch (F) {
                  zt(r, r.return, F);
                }
              }
              a && g & 64 && su(u), $a(u, u.return);
              break;
            case 27:
              Zt && mu(u);
            case 26:
            case 5:
              nn(
                c,
                u,
                a
              ), a && r === null && g & 4 && uu(u), $a(u, u.return);
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
              ), a && g & 4 && gu(c, u);
              break;
            case 13:
              nn(
                c,
                u,
                a
              ), a && g & 4 && bu(c, u);
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
      function Ii(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && La(a));
      }
      function $i(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && La(t));
      }
      function qe(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            xu(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function xu(t, e, a, r) {
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
                var u = e.memoizedProps, g = u.id, M = u.onPostCommit;
                typeof M == "function" && M(
                  g,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (G) {
                zt(e, e.return, G);
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
            )), c & 2048 && Ii(g, e);
            break;
          case 24:
            qe(
              t,
              e,
              a,
              r
            ), c & 2048 && $i(e.alternate, e);
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
          var u = t, g = e, M = a, G = r, F = g.flags;
          switch (g.tag) {
            case 0:
            case 11:
            case 15:
              ha(
                u,
                g,
                M,
                G,
                c
              ), Ia(8, g);
              break;
            case 23:
              break;
            case 22:
              var nt = g.stateNode;
              g.memoizedState !== null ? nt._visibility & 2 ? ha(
                u,
                g,
                M,
                G,
                c
              ) : Pa(
                u,
                g
              ) : (nt._visibility |= 2, ha(
                u,
                g,
                M,
                G,
                c
              )), c && F & 2048 && Ii(
                g.alternate,
                g
              );
              break;
            case 24:
              ha(
                u,
                g,
                M,
                G,
                c
              ), c && F & 2048 && $i(g.alternate, g);
              break;
            default:
              ha(
                u,
                g,
                M,
                G,
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
                Pa(a, r), c & 2048 && Ii(
                  r.alternate,
                  r
                );
                break;
              case 24:
                Pa(a, r), c & 2048 && $i(
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
            wu(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function wu(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Jn(
              t,
              e,
              a
            ), t.flags & Da)
              if (t.memoizedState !== null)
                Lh(
                  a,
                  Ge,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || yo(c, t)) && rd(a, r, c, t);
              }
            break;
          case 5:
            Jn(
              t,
              e,
              a
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || yo(c, t)) && rd(a, r, c, t));
            break;
          case 3:
          case 4:
            Ye ? (r = Ge, Ge = _o(
              t.stateNode.containerInfo
            ), Jn(
              t,
              e,
              a
            ), Ge = r) : Jn(
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
      function _u(t) {
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
              Pt = r, Su(
                r,
                t
              );
            }
          _u(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            ku(t), t = t.sibling;
      }
      function ku(t) {
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
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, er(t)) : tl(t);
            break;
          default:
            tl(t);
        }
      }
      function er(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              Pt = r, Su(
                r,
                t
              );
            }
          _u(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              wn(8, e, e.return), er(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, er(e));
              break;
            default:
              er(e);
          }
          t = t.sibling;
        }
      }
      function Su(t, e) {
        for (; Pt !== null; ) {
          var a = Pt;
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
          if (r = a.child, r !== null) r.return = a, Pt = r;
          else
            t: for (a = t; Pt !== null; ) {
              r = Pt;
              var c = r.sibling, u = r.return;
              if (hu(r), r === a) {
                Pt = null;
                break t;
              }
              if (c !== null) {
                c.return = u, Pt = c;
                break t;
              }
              Pt = u;
            }
        }
      }
      function Pi(t) {
        var e = zp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Up(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function to(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case _r:
            if (t.type === e.value) return !0;
            break;
          case kr:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var r = t[a++], c = r.tag, u = t[a++], g = e[u];
                if (c !== 5 && c !== 26 && c !== 27 || !ll(r)) {
                  for (; g != null && to(r, g); )
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
          case Sr:
            if ((a === 5 || a === 26 || a === 27) && Gp(t.stateNode, e.value))
              return !0;
            break;
          case zr:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Yp(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Er:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function eo(t) {
        switch (t.$$typeof) {
          case _r:
            return "<" + (b(t.value) || "Unknown") + ">";
          case kr:
            return ":has(" + (eo(t) || "") + ")";
          case Sr:
            return '[role="' + t.value + '"]';
          case zr:
            return '"' + t.value + '"';
          case Er:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function Eu(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, g = t[r++], M = e[g];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; M != null && to(c, M); )
              g++, M = e[g];
            if (g === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, g), c = c.sibling;
          }
        }
        return a;
      }
      function no(t, e) {
        if (!al) throw Error(s(363));
        t = Pi(t), t = Eu(t, e), e = [], t = Array.from(t);
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
        return (xt & 2) !== 0 && kt !== 0 ? kt & -kt : dt.T !== null ? di() : Tp();
      }
      function zu() {
        if (ze === 0)
          if ((kt & 536870912) === 0 || St) {
            var t = cr;
            cr <<= 1, (cr & 3932160) === 0 && (cr = 262144), ze = t;
          } else ze = 536870912;
        return t = Se.current, t !== null && (t.flags |= 32), ze;
      }
      function pe(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), _n(
          t,
          kt,
          ze,
          !1
        )), D(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (la |= a), Ut === 4 && _n(
          t,
          kt,
          ze,
          !1
        )), Qe(t));
      }
      function Nu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || H(t, e), c = r ? rp(t, e) : lo(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ha && !r && _n(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !ap(a)) {
              c = lo(t, e, !1), u = !1;
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
                  var M = t;
                  c = ml;
                  var G = ue && M.current.memoizedState.isDehydrated;
                  if (G && (ga(M, g).flags |= 256), g = lo(
                    M,
                    g,
                    !1
                  ), g !== 2) {
                    if (Yo && !G) {
                      M.errorRecoveryDisabledLanes |= u, la |= u, c = 4;
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
              if ((e & 62914560) === e && (c = Nr + 300 - he(), 10 < c)) {
                if (_n(
                  r,
                  e,
                  ze,
                  !Cn
                ), N(r, 0, !0) !== 0) break t;
                dn = e, r.timeoutHandle = Sp(
                  Tu.bind(
                    null,
                    r,
                    a,
                    be,
                    Tr,
                    Lo,
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
              Tu(
                r,
                a,
                be,
                Tr,
                Lo,
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
      function Tu(t, e, a, r, c, u, g, M, G, F, nt, P, lt, gt) {
        if (t.timeoutHandle = Fn, P = e.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = Op(), wu(
            e,
            u,
            P
          );
          var re = (u & 62914560) === u ? Nr - he() : (u & 4194048) === u ? Od - he() : 0;
          if (re = Rp(
            P,
            re
          ), re !== null) {
            dn = u, t.cancelPendingCommit = re(
              Bu.bind(
                null,
                t,
                e,
                u,
                a,
                r,
                c,
                g,
                M,
                G,
                nt,
                P,
                null,
                lt,
                gt
              )
            ), _n(t, u, g, !F);
            return;
          }
        }
        Bu(
          t,
          e,
          u,
          a,
          r,
          c,
          g,
          M,
          G
        );
      }
      function ap(t) {
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
        e &= ~Go, e &= ~la, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - we(c), g = 1 << u;
          r[u] = -1, c &= ~g;
        }
        a !== 0 && x(t, a, e);
      }
      function Cu() {
        return (xt & 6) === 0 ? (ma(0), !1) : !0;
      }
      function ao() {
        if (wt !== null) {
          if (Ct === 0)
            var t = wt.return;
          else
            t = wt, on = $n = null, Si(t), Ma = null, cl = 0, t = wt;
          for (; t !== null; )
            ou(t.alternate, t), t = t.return;
          wt = null;
        }
      }
      function ga(t, e) {
        var a = t.timeoutHandle;
        a !== Fn && (t.timeoutHandle = Fn, Ep(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), dn = 0, ao(), At = t, wt = a = an(t.current, null), kt = e, Ct = 0, Ee = null, Cn = !1, Ha = H(t, e), Yo = !1, Ba = ze = Go = la = Mn = Ut = 0, be = ml = null, Lo = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - we(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return un = e, Bl(), a;
      }
      function Mu(t, e) {
        bt = null, dt.H = dl, e === Ca || e === br ? (e = Fs(), Ct = 3) : e === jo ? (e = Fs(), Ct = 4) : Ct = e === Bo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Ee = e, wt === null && (Ut = 1, Zl(
          t,
          L(e, t.current)
        ));
      }
      function Au() {
        var t = Se.current;
        return t === null ? !0 : (kt & 4194048) === kt ? Oe === null : (kt & 62914560) === kt || (kt & 536870912) !== 0 ? t === Oe : !1;
      }
      function ju() {
        var t = dt.H;
        return dt.H = dl, t === null ? dl : t;
      }
      function Ou() {
        var t = dt.A;
        return dt.A = a0, t;
      }
      function nr() {
        Ut = 4, Cn || (kt & 4194048) !== kt && Se.current !== null || (Ha = !0), (Mn & 134217727) === 0 && (la & 134217727) === 0 || At === null || _n(
          At,
          kt,
          ze,
          !1
        );
      }
      function lo(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = ju(), u = Ou();
        (At !== t || kt !== e) && (Tr = null, ga(t, e)), e = !1;
        var g = Ut;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var M = wt, G = Ee;
              switch (Ct) {
                case 8:
                  ao(), g = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Se.current === null && (e = !0);
                  var F = Ct;
                  if (Ct = 0, Ee = null, ba(t, M, G, F), a && Ha) {
                    g = 0;
                    break t;
                  }
                  break;
                default:
                  F = Ct, Ct = 0, Ee = null, ba(t, M, G, F);
              }
            }
            lp(), g = Ut;
            break;
          } catch (nt) {
            Mu(t, nt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, on = $n = null, xt = r, dt.H = c, dt.A = u, wt === null && (At = null, kt = 0, Bl()), g;
      }
      function lp() {
        for (; wt !== null; ) Ru(wt);
      }
      function rp(t, e) {
        var a = xt;
        xt |= 2;
        var r = ju(), c = Ou();
        At !== t || kt !== e ? (Tr = null, pl = he() + 500, ga(t, e)) : Ha = H(
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
                  if (Js(u)) {
                    Ct = 0, Ee = null, Du(e);
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
                  Js(u) ? (Ct = 0, Ee = null, Du(e)) : (Ct = 0, Ee = null, ba(t, e, u, 7));
                  break;
                case 5:
                  var g = null;
                  switch (wt.tag) {
                    case 26:
                      g = wt.memoizedState;
                    case 5:
                    case 27:
                      var M = wt, G = M.type, F = M.pendingProps;
                      if (g ? xd(g) : ld(M.stateNode, G, F)) {
                        Ct = 0, Ee = null;
                        var nt = M.sibling;
                        if (nt !== null) wt = nt;
                        else {
                          var P = M.return;
                          P !== null ? (wt = P, ar(P)) : wt = null;
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
                  ao(), Ut = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            ip();
            break;
          } catch (lt) {
            Mu(t, lt);
          }
        while (!0);
        return on = $n = null, dt.H = r, dt.A = c, xt = a, wt !== null ? 0 : (At = null, kt = 0, Bl(), Ut);
      }
      function ip() {
        for (; wt !== null && !Xh(); )
          Ru(wt);
      }
      function Ru(t) {
        var e = nu(
          t.alternate,
          t,
          un
        );
        t.memoizedProps = t.pendingProps, e === null ? ar(t) : wt = e;
      }
      function Du(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Fc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              kt
            );
            break;
          case 11:
            e = Fc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              kt
            );
            break;
          case 5:
            Si(e);
          default:
            ou(a, e), e = wt = Ku(e, un), e = nu(a, e, un);
        }
        t.memoizedProps = t.pendingProps, e === null ? ar(t) : wt = e;
      }
      function ba(t, e, a, r) {
        on = $n = null, Si(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Fm(
            t,
            c,
            e,
            a,
            kt
          )) {
            Ut = 1, Zl(
              t,
              L(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Ut = 1, Zl(
            t,
            L(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (St || r === 1 ? t = !0 : Ha || (kt & 536870912) !== 0 ? t = !1 : (Cn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Se.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Hu(e, t)) : ar(e);
      }
      function ar(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Hu(
              e,
              Cn
            );
            return;
          }
          t = e.return;
          var a = Pm(
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
        Ut === 0 && (Ut = 5);
      }
      function Hu(t, e) {
        do {
          var a = tp(t.alternate, t);
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
        Ut = 6, wt = null;
      }
      function Bu(t, e, a, r, c, u, g, M, G) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Jt !== 0);
        if ((xt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= Oo, h(
            t,
            a,
            u,
            g,
            M,
            G
          ), t === At && (wt = At = null, kt = 0), Ua = e, jn = t, dn = a, Qo = u, Vo = c, Rd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, up(Eo, function() {
            return Lu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = rn(), $t(2), g = xt, xt |= 4;
            try {
              ep(t, e, a);
            } finally {
              xt = g, $t(c), dt.T = r;
            }
          }
          Jt = 1, Uu(), qu(), Yu();
        }
      }
      function Uu() {
        if (Jt === 1) {
          Jt = 0;
          var t = jn, e = Ua, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = rn();
            $t(2);
            var c = xt;
            xt |= 4;
            try {
              vu(e, t), _p(t.containerInfo);
            } finally {
              xt = c, $t(r), dt.T = a;
            }
          }
          t.current = e, Jt = 2;
        }
      }
      function qu() {
        if (Jt === 2) {
          Jt = 0;
          var t = jn, e = Ua, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = rn();
            $t(2);
            var c = xt;
            xt |= 4;
            try {
              pu(t, e.alternate, e);
            } finally {
              xt = c, $t(r), dt.T = a;
            }
          }
          Jt = 3;
        }
      }
      function Yu() {
        if (Jt === 4 || Jt === 3) {
          Jt = 0, Zh();
          var t = jn, e = Ua, a = dn, r = Rd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Jt = 5 : (Jt = 0, Ua = jn = null, Gu(t, t.pendingLanes));
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
            e = dt.T, c = rn(), $t(2), dt.T = null;
            try {
              for (var u = t.onRecoverableError, g = 0; g < r.length; g++) {
                var M = r[g];
                u(M.value, {
                  componentStack: M.stack
                });
              }
            } finally {
              dt.T = e, $t(c);
            }
          }
          (dn & 3) !== 0 && el(), Qe(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === Ko ? hl++ : (hl = 0, Ko = t) : hl = 0, ue && Ah(), ma(0);
        }
      }
      function Gu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, La(e)));
      }
      function el() {
        return Uu(), qu(), Yu(), Lu();
      }
      function Lu() {
        if (Jt !== 5) return !1;
        var t = jn, e = Qo;
        Qo = 0;
        var a = A(dn), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = rn();
        try {
          $t(r), dt.T = null, r = Vo, Vo = null;
          var u = jn, g = dn;
          if (Jt = 0, Ua = jn = null, dn = 0, (xt & 6) !== 0)
            throw Error(s(331));
          var M = xt;
          if (xt |= 4, ku(u.current), xu(
            u,
            u.current,
            g,
            r
          ), xt = M, ma(0, !1), _e && typeof _e.onPostCommitFiberRoot == "function")
            try {
              _e.onPostCommitFiberRoot(rl, u);
            } catch {
            }
          return !0;
        } finally {
          $t(c), dt.T = a, Gu(t, e);
        }
      }
      function Qu(t, e, a) {
        e = L(a, e), e = Hi(t.stateNode, e, 2), t = vn(t, e, 2), t !== null && (D(t, 2), Qe(t));
      }
      function zt(t, e, a) {
        if (t.tag === 3)
          Qu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Qu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (An === null || !An.has(r))) {
                t = L(a, t), a = Lc(2), r = vn(e, a, 2), r !== null && (Qc(
                  a,
                  r,
                  e,
                  t
                ), D(r, 2), Qe(r));
                break;
              }
            }
            e = e.return;
          }
      }
      function ro(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new l0();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Yo = !0, c.add(a), t = op.bind(null, t, e, a), e.then(t, t));
      }
      function op(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (kt & a) === a && (Ut === 4 || Ut === 3 && (kt & 62914560) === kt && 300 > he() - Nr ? (xt & 2) === 0 && ga(t, 0) : Go |= a, Ba === kt && (Ba = 0)), Qe(t);
      }
      function Vu(t, e) {
        e === 0 && (e = X()), t = Kn(t, e), t !== null && (D(t, e), Qe(t));
      }
      function sp(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Vu(t, a);
      }
      function cp(t, e) {
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
        r !== null && r.delete(e), Vu(t, a);
      }
      function up(t, e) {
        return dr(t, e);
      }
      function dp(t, e, a, r) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function io(t) {
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
      function Ku(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function lr(t, e, a, r, c, u) {
        var g = 0;
        if (r = t, typeof t == "function") io(t) && (g = 1);
        else if (typeof t == "string")
          g = Ye && Zt ? pd(t, a, ae.current) ? 26 : kd(t) ? 27 : 5 : Ye ? pd(
            t,
            a,
            ae.current
          ) ? 26 : 5 : Zt && kd(t) ? 27 : 5;
        else
          t: switch (t) {
            case bo:
              return t = i(31, a, e, c), t.elementType = bo, t.lanes = u, t;
            case ya:
              return Wn(
                a.children,
                c,
                u,
                e
              );
            case $u:
              g = 8, c |= 24;
              break;
            case fo:
              return t = i(12, a, e, c | 2), t.elementType = fo, t.lanes = u, t;
            case po:
              return t = i(13, a, e, c), t.elementType = po, t.lanes = u, t;
            case ho:
              return t = i(19, a, e, c), t.elementType = ho, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case kn:
                    g = 10;
                    break t;
                  case Pu:
                    g = 9;
                    break t;
                  case mo:
                    g = 11;
                    break t;
                  case go:
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
      function oo(t, e, a) {
        return t = i(6, t, null, e), t.lanes = a, t;
      }
      function Xu(t) {
        var e = i(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function so(t, e, a) {
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
      function fp(t, e, a, r, c, u, g, M, G) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Fn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = g, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = G, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Zu(t, e, a, r, c, u, g, M, G, F, nt, P) {
        return t = new fp(
          t,
          e,
          a,
          g,
          G,
          F,
          nt,
          P,
          M
        ), e = 1, u === !0 && (e |= 24), u = i(3, null, null, e), t.current = u, u.stateNode = t, e = ui(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, pi(u), t;
      }
      function Ju(t) {
        return t ? (t = ka, t) : ka;
      }
      function Wu(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Fu(t, e, a, r, c, u) {
        c = Ju(c), r.context === null ? r.context = c : r.pendingContext = c, r = bn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = vn(t, r, e), a !== null && (pe(a, t, e), Va(a, t, e));
      }
      function Iu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function co(t, e) {
        Iu(t, e), (t = t.alternate) && Iu(t, e);
      }
      var yt = {}, mp = O0, xe = D0(), uo = Object.assign, pp = Symbol.for("react.element"), rr = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), $u = Symbol.for("react.strict_mode"), fo = Symbol.for("react.profiler"), Pu = Symbol.for("react.consumer"), kn = Symbol.for("react.context"), mo = Symbol.for("react.forward_ref"), po = Symbol.for("react.suspense"), ho = Symbol.for("react.suspense_list"), go = Symbol.for("react.memo"), Sn = Symbol.for("react.lazy"), bo = Symbol.for("react.activity"), hp = Symbol.for("react.memo_cache_sentinel"), td = Symbol.iterator, gp = Symbol.for("react.client.reference"), ir = Array.isArray, dt = mp.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, bp = l.rendererVersion, vp = l.rendererPackageName, ed = l.extraDevToolsConfig, nl = l.getPublicInstance, yp = l.getRootHostContext, xp = l.getChildHostContext, wp = l.prepareForCommit, _p = l.resetAfterCommit, kp = l.createInstance;
      l.cloneMutableInstance;
      var vo = l.appendInitialChild, nd = l.finalizeInitialChildren, or = l.shouldSetTextContent, ad = l.createTextInstance;
      l.cloneMutableTextInstance;
      var Sp = l.scheduleTimeout, Ep = l.cancelTimeout, Fn = l.noTimeout, ln = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var ce = l.supportsMutation, Ke = l.supportsPersistence, ue = l.supportsHydration, zp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var Np = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var $t = l.setCurrentUpdatePriority, rn = l.getCurrentUpdatePriority, Tp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var Cp = l.shouldAttemptEagerTransition, Mp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var Ap = l.maySuspendCommit, jp = l.maySuspendCommitOnUpdate, yo = l.maySuspendCommitInSyncRender, ld = l.preloadInstance, Op = l.startSuspendingCommit, rd = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var Rp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, In = l.HostTransitionContext, Dp = l.resetFormInstance;
      l.bindToConsole;
      var Hp = l.supportsMicrotasks, Bp = l.scheduleMicrotask, al = l.supportsTestSelectors, Up = l.findFiberRoot, qp = l.getBoundingRect, Yp = l.getTextContent, ll = l.isHiddenSubtree, Gp = l.matchAccessibilityRole, Lp = l.setFocusIfFocusable, Qp = l.setupIntersectionObserver, Vp = l.appendChild, Kp = l.appendChildToContainer, Xp = l.commitTextUpdate, Zp = l.commitMount, Jp = l.commitUpdate, Wp = l.insertBefore, Fp = l.insertInContainerBefore, Ip = l.removeChild, $p = l.removeChildFromContainer, id = l.resetTextContent, Pp = l.hideInstance, th = l.hideTextInstance, eh = l.unhideInstance, nh = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var ah = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var lh = l.cloneInstance, od = l.createContainerChildSet, sd = l.appendChildToContainerChildSet, rh = l.finalizeContainerChildren, cd = l.replaceContainerChildren, ud = l.cloneHiddenInstance, dd = l.cloneHiddenTextInstance, xo = l.isSuspenseInstancePending, wo = l.isSuspenseInstanceFallback, ih = l.getSuspenseInstanceFallbackErrorDetails, oh = l.registerSuspenseInstanceRetry, sh = l.canHydrateFormStateMarker, ch = l.isFormStateMarkerMatching, fd = l.getNextHydratableSibling, uh = l.getNextHydratableSiblingAfterSingleton, dh = l.getFirstHydratableChild, fh = l.getFirstHydratableChildWithinContainer, mh = l.getFirstHydratableChildWithinActivityInstance, ph = l.getFirstHydratableChildWithinSuspenseInstance, hh = l.getFirstHydratableChildWithinSingleton, gh = l.canHydrateInstance, bh = l.canHydrateTextInstance, vh = l.canHydrateActivityInstance, yh = l.canHydrateSuspenseInstance, xh = l.hydrateInstance, wh = l.hydrateTextInstance, _h = l.hydrateActivityInstance, kh = l.hydrateSuspenseInstance, Sh = l.getNextHydratableInstanceAfterActivityInstance, Eh = l.getNextHydratableInstanceAfterSuspenseInstance, zh = l.commitHydratedInstance, Nh = l.commitHydratedContainer, Th = l.commitHydratedActivityInstance, Ch = l.commitHydratedSuspenseInstance, Mh = l.finalizeHydratedChildren, Ah = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var jh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var Oh = l.clearSuspenseBoundaryFromContainer, Rh = l.hideDehydratedBoundary, Dh = l.unhideDehydratedBoundary, md = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var Hh = l.validateHydratableInstance, Bh = l.validateHydratableTextInstance, Ye = l.supportsResources, pd = l.isHostHoistableType, _o = l.getHoistableRoot, hd = l.getResource, gd = l.acquireResource, bd = l.releaseResource, Uh = l.hydrateHoistable, vd = l.mountHoistable, yd = l.unmountHoistable, qh = l.createHoistableInstance, Yh = l.prepareToCommitHoistables, Gh = l.mayResourceSuspendCommit, xd = l.preloadResource, Lh = l.suspendResource, Zt = l.supportsSingletons, wd = l.resolveSingletonInstance, Qh = l.acquireSingletonInstance, _d = l.releaseSingletonInstance, kd = l.isHostSingletonType, wa = l.isSingletonScope, ko = [], _a = -1, ka = {}, we = Math.clz32 ? Math.clz32 : z, Vh = Math.log, Kh = Math.LN2, sr = 256, cr = 262144, ur = 4194304, dr = xe.unstable_scheduleCallback, So = xe.unstable_cancelCallback, Xh = xe.unstable_shouldYield, Zh = xe.unstable_requestPaint, he = xe.unstable_now, Sd = xe.unstable_ImmediatePriority, Jh = xe.unstable_UserBlockingPriority, Eo = xe.unstable_NormalPriority, Wh = xe.unstable_IdlePriority, Fh = xe.log, Ih = xe.unstable_setDisableYieldValue, rl = null, _e = null, ke = typeof Object.is == "function" ? Object.is : K, Ed = typeof reportError == "function" ? reportError : function(t) {
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
      }, $h = Object.prototype.hasOwnProperty, zo, zd, No = !1, Nd = /* @__PURE__ */ new WeakMap(), Sa = [], Ea = 0, fr = null, il = 0, Ce = [], Me = 0, En = null, Xe = 1, Ze = "", ae = v(null), ol = v(null), zn = v(null), mr = v(null), le = null, Rt = null, St = !1, Nn = null, Ae = !1, To = Error(s(519)), pr = v(null), $n = null, on = null, Ph = typeof AbortController < "u" ? AbortController : function() {
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
      }, t0 = xe.unstable_scheduleCallback, e0 = xe.unstable_NormalPriority, Dt = {
        $$typeof: kn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, hr = null, za = null, Co = !1, gr = !1, Mo = !1, Pn = 0, sl = null, Ao = 0, Na = 0, Ta = null, Td = dt.S;
      dt.S = function(t, e) {
        Od = he(), typeof e == "object" && e !== null && typeof e.then == "function" && Lm(t, e), Td !== null && Td(t, e);
      };
      var ta = v(null), Ca = Error(s(460)), jo = Error(s(474)), br = Error(s(542)), vr = { then: function() {
      } }, ea = null, Ma = null, cl = 0, na = $s(!0), Cd = $s(!1), je = [], Aa = 0, Oo = 0, Tn = !1, Ro = !1, ja = v(null), yr = v(0), Se = v(null), Oe = null, Yt = v(0), sn = 0, bt = null, Mt = null, Gt = null, xr = !1, Oa = !1, aa = !1, wr = 0, ul = 0, Ra = null, n0 = 0, dl = {
        readContext: ee,
        use: Ll,
        useCallback: Bt,
        useContext: Bt,
        useEffect: Bt,
        useImperativeHandle: Bt,
        useLayoutEffect: Bt,
        useInsertionEffect: Bt,
        useMemo: Bt,
        useReducer: Bt,
        useRef: Bt,
        useState: Bt,
        useDebugValue: Bt,
        useDeferredValue: Bt,
        useTransition: Bt,
        useSyncExternalStore: Bt,
        useId: Bt,
        useHostTransitionStatus: Bt,
        useFormState: Bt,
        useActionState: Bt,
        useOptimistic: Bt,
        useMemoCache: Bt,
        useCacheRefresh: Bt
      };
      dl.useEffectEvent = Bt;
      var Md = {
        readContext: ee,
        use: Ll,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: ee,
        useEffect: kc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Vl(
            4194308,
            4,
            Nc.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Vl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Vl(4, 2, t, e);
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
          }, r.queue = t, t = t.dispatch = Wm.bind(
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
          t = Ti(t);
          var e = t.queue, a = Hc.bind(
            null,
            bt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: Ai,
        useDeferredValue: function(t, e) {
          var a = fe();
          return ji(a, t, e);
        },
        useTransition: function() {
          var t = Ti(!1);
          return t = jc.bind(
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
            (kt & 127) !== 0 || oc(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, kc(cc.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            sc.bind(
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
            a = (r & ~(1 << 32 - we(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = wr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = n0++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Oi,
        useFormState: vc,
        useActionState: vc,
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
          return e.queue = a, e = Ri.bind(
            null,
            bt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Ei,
        useCacheRefresh: function() {
          return fe().memoizedState = Jm.bind(
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
      }, Do = {
        readContext: ee,
        use: Ll,
        useCallback: Cc,
        useContext: ee,
        useEffect: Mi,
        useImperativeHandle: Tc,
        useInsertionEffect: Ec,
        useLayoutEffect: zc,
        useMemo: Mc,
        useReducer: Ql,
        useRef: _c,
        useState: function() {
          return Ql(Pe);
        },
        useDebugValue: Ai,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Ac(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ql(Pe)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: ic,
        useId: Rc,
        useHostTransitionStatus: Oi,
        useFormState: yc,
        useActionState: yc,
        useOptimistic: function(t, e) {
          var a = qt();
          return fc(a, Mt, t, e);
        },
        useMemoCache: Ei,
        useCacheRefresh: Dc
      };
      Do.useEffectEvent = Sc;
      var Ad = {
        readContext: ee,
        use: Ll,
        useCallback: Cc,
        useContext: ee,
        useEffect: Mi,
        useImperativeHandle: Tc,
        useInsertionEffect: Ec,
        useLayoutEffect: zc,
        useMemo: Mc,
        useReducer: Ni,
        useRef: _c,
        useState: function() {
          return Ni(Pe);
        },
        useDebugValue: Ai,
        useDeferredValue: function(t, e) {
          var a = qt();
          return Mt === null ? ji(a, t, e) : Ac(
            a,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Ni(Pe)[0], e = qt().memoizedState;
          return [
            typeof t == "boolean" ? t : Za(t),
            e
          ];
        },
        useSyncExternalStore: ic,
        useId: Rc,
        useHostTransitionStatus: Oi,
        useFormState: wc,
        useActionState: wc,
        useOptimistic: function(t, e) {
          var a = qt();
          return Mt !== null ? fc(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Ei,
        useCacheRefresh: Dc
      };
      Ad.useEffectEvent = Sc;
      var Ho = {
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
      }, Bo = Error(s(461)), Lt = !1, Uo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, cn = !1, Qt = !1, qo = !1, jd = typeof WeakSet == "function" ? WeakSet : Set, Pt = null, Vt = null, ge = !1, Ge = null, Da = 8192, a0 = {
        getCacheForType: function(t) {
          var e = ee(Dt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return ee(Dt).controller.signal;
        }
      }, _r = 0, kr = 1, Sr = 2, Er = 3, zr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        _r = fl("selector.component"), kr = fl("selector.has_pseudo_class"), Sr = fl("selector.role"), Er = fl("selector.test_id"), zr = fl("selector.text");
      }
      var l0 = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, kt = 0, Ct = 0, Ee = null, Cn = !1, Ha = !1, Yo = !1, un = 0, Ut = 0, Mn = 0, la = 0, Go = 0, ze = 0, Ba = 0, ml = null, be = null, Lo = !1, Nr = 0, Od = 0, pl = 1 / 0, Tr = null, An = null, Jt = 0, jn = null, Ua = null, dn = 0, Qo = 0, Vo = null, Rd = null, hl = 0, Ko = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Kn(t, 67108864);
          e !== null && pe(e, t, 67108864), co(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ye();
          e = O(e);
          var a = Kn(t, e);
          a !== null && pe(a, t, e), co(t, e);
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
            e = Kn(t, 2), e !== null && pe(e, t, 2), Cu(), co(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: _r, value: t };
      }, yt.createContainer = function(t, e, a, r, c, u, g, M, G, F) {
        return Zu(
          t,
          e,
          !1,
          null,
          a,
          r,
          u,
          null,
          g,
          M,
          G,
          F
        );
      }, yt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: kr, value: t };
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, g, M, G, F, nt, P, lt, gt) {
        return t = Zu(
          a,
          r,
          !0,
          t,
          c,
          u,
          M,
          gt,
          G,
          F,
          nt,
          P
        ), t.context = Ju(null), a = t.current, r = ye(), r = O(r), c = bn(r), c.callback = e ?? null, vn(a, c, r), e = r, t.current.lanes = e, D(t, e), Qe(t), t;
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
        return { $$typeof: Sr, value: t };
      }, yt.createTestNameSelector = function(t) {
        return { $$typeof: Er, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: zr, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        Ed(t);
      }, yt.defaultOnUncaughtError = function(t) {
        Ed(t);
      }, yt.deferredUpdates = function(t) {
        var e = dt.T, a = rn();
        try {
          return $t(32), dt.T = null, t();
        } finally {
          $t(a), dt.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = dt.T, g = rn();
        try {
          return $t(2), dt.T = null, t(e, a, r, c);
        } finally {
          $t(g), dt.T = u, xt === 0 && (pl = he() + 500);
        }
      }, yt.findAllNodes = no, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(s(363));
        e = no(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(qp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, g = u + a.height, M = e - 1; 0 <= M; M--)
            if (e !== M) {
              var G = t[M], F = G.x, nt = F + G.width, P = G.y, lt = P + G.height;
              if (r >= F && u >= P && c <= nt && g <= lt) {
                t.splice(e, 1);
                break;
              } else if (r !== F || a.width !== G.width || lt < u || P > g) {
                if (!(u !== P || a.height !== G.height || nt < r || F > c)) {
                  F > r && (G.width += F - r, G.x = r), nt < c && (G.width = c - F), t.splice(e, 1);
                  break;
                }
              } else {
                P > u && (G.height += P - u, G.y = u), lt < g && (G.height = g - P), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, yt.findHostInstance = Wu, yt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? y(t) : null, t === null ? null : nl(t.stateNode);
      }, yt.findHostInstanceWithWarning = function(t) {
        return Wu(t);
      }, yt.flushPassiveEffects = el, yt.flushSyncFromReconciler = function(t) {
        var e = xt;
        xt |= 1;
        var a = dt.T, r = rn();
        try {
          if ($t(2), dt.T = null, t)
            return t();
        } finally {
          $t(r), dt.T = a, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = Cu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(s(363));
        for (t = Pi(t), e = Eu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], r = a.tag;
          if (!ll(a)) {
            if ((r === 5 || r === 26 || r === 27) && Lp(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, yt.getFindAllNodesFailureDescription = function(t, e) {
        if (!al) throw Error(s(363));
        var a = 0, r = [];
        t = [Pi(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], g = u.tag, M = t[c++], G = e[M];
          if ((g !== 5 && g !== 26 && g !== 27 || !ll(u)) && (to(u, G) && (r.push(eo(G)), M++, M > a && (a = M)), M < e.length))
            for (u = u.child; u !== null; )
              t.push(u, M), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(eo(e[a]));
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
          version: bp,
          rendererPackageName: vp,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (ed !== null && (t.rendererConfig = ed), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
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
        t = no(t, e);
        var c = Qp(
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
        var c = Oc(t).queue;
        jc(
          t,
          c,
          e,
          xa,
          a === null ? o : function() {
            var u = Oc(t);
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
        return Fu(
          c,
          u,
          t,
          e,
          a,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, a, r) {
        return Fu(
          e.current,
          2,
          t,
          e,
          a,
          r
        ), 2;
      }, yt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(Wo)), Wo.exports;
}
var Zd;
function B0() {
  return Zd || (Zd = 1, Jo.exports = H0()), Jo.exports;
}
var U0 = B0();
const q0 = /* @__PURE__ */ Ts(U0);
var $o = { exports: {} }, fn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Jd;
function Y0() {
  return Jd || (Jd = 1, fn.ConcurrentRoot = 1, fn.ContinuousEventPriority = 8, fn.DefaultEventPriority = 32, fn.DiscreteEventPriority = 2, fn.IdleEventPriority = 268435456, fn.LegacyRoot = 0, fn.NoEventPriority = 0), fn;
}
var Wd;
function G0() {
  return Wd || (Wd = 1, $o.exports = Y0()), $o.exports;
}
var El = G0();
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
const Lf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], us = 16, Cs = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), L0 = [
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
], Fd = {
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
}, Q0 = /* @__PURE__ */ new Set([
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
]), Qf = {
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
}, Vf = {
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
}, ds = ["font-size", "color", ...new Set([...Object.keys(Qf), ...Object.keys(Vf)].filter((n) => n !== "font-size" && n !== "color"))], V0 = new Set(ds);
function oe(n, l = " ") {
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
function fs(n, l, i = 0) {
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
    const p = n.slice(d + 4, f - 1), y = oe(p, ","), S = y[0].trim(), b = y.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let v = l(S);
    if ((v == null || v === "initial") && (v = b), v == null) return null;
    const E = fs(v, l, i + 1);
    if (E === null) return null;
    o += E, s = f;
  }
}
function K0(n) {
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
  const i = K0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!i) return null;
  let o = 0;
  const s = ({ num: v, unit: E }) => {
    switch (E) {
      case "":
        return { px: 0, pct: 0, num: v, unitless: !0 };
      case "px":
        return { px: v, pct: 0, num: 0 };
      case "rem":
        return { px: v * us, pct: 0, num: 0 };
      case "em":
        return { px: v * (l.fontSize ?? us), pct: 0, num: 0 };
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
  }, d = (v, E, k) => v && E ? { px: v.px + k * E.px, pct: v.pct + k * E.pct, num: v.num + k * E.num, unitless: v.unitless && E.unitless } : null, m = (v, E) => v ? { px: v.px * E, pct: v.pct * E, num: v.num * E, unitless: v.unitless } : null, f = (v) => v && v.unitless;
  function p() {
    const v = i[o++];
    if (!v) return null;
    if (v.num !== void 0) return s(v);
    if (v.op === "(") {
      const E = S();
      return i[o]?.op !== ")" ? null : (o++, E);
    }
    if (v.op === "-" || v.op === "+") {
      const E = p();
      return v.op === "-" ? m(E, -1) : E;
    }
    if (v.fn) {
      const E = [];
      for (; ; ) {
        E.push(S());
        const _ = i[o++];
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
  function y() {
    let v = p();
    for (; i[o] && (i[o].op === "*" || i[o].op === "/"); ) {
      const E = i[o++].op, k = p();
      if (!v || !k) return null;
      E === "*" ? v = f(k) ? m(v, k.num) : f(v) ? m(k, v.num) : null : v = f(k) && k.num !== 0 ? m(v, 1 / k.num) : null;
    }
    return v;
  }
  function S() {
    let v = y();
    for (; i[o] && (i[o].op === "+" || i[o].op === "-"); ) {
      const E = i[o++].op;
      v = d(v, y(), E === "-" ? -1 : 1);
    }
    return v;
  }
  const b = S();
  return o !== i.length || !b ? null : b;
}
function ms(n, l) {
  const i = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(i))
    return i === "thin" ? { px: 1 } : i === "medium" ? { px: 3 } : i === "thick" ? { px: 5 } : i;
  const o = qn(i, l);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: n.trim() } : o.pct && (o.px || o.num) ? { expr: n.trim() } : o.pct ? { pct: o.pct } : { px: X0(o.px) } : { expr: n.trim() };
}
const X0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Mr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Z0 = ([n, l, i, o]) => `#${Mr(n)}${Mr(l)}${Mr(i)}${Mr(o * 255)}`;
function Id(n) {
  const l = n.slice(1), i = l.length <= 4 ? l.split("").map((s) => s + s).join("") : l;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return null;
  const o = (s) => parseInt(i.slice(s, s + 2), 16);
  return [o(0), o(2), o(4), i.length === 8 ? o(6) / 255 : 1];
}
function Jr(n, l) {
  const i = n.trim().toLowerCase();
  if (i === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(i);
  if (o) {
    const y = l(o[1]), S = y && Id(y);
    return S ? { rgba: S, token: o[1] } : null;
  }
  if (i.startsWith("#")) {
    const y = Id(i);
    return y ? { rgba: y, token: null } : null;
  }
  if (Fd[i]) return { rgba: [...Fd[i]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(i);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const y = oe(s[2], ",");
    if (y.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(y[0])) return null;
    const S = (B) => {
      const K = oe(B), I = K.findIndex(($) => /%$/.test($)), Q = I >= 0 ? parseFloat(K[I]) / 100 : null;
      return { color: Jr(K.filter(($, L) => L !== I).join(" "), l), pct: Q };
    }, b = S(y[1]), v = S(y[2]);
    if (!b.color || !v.color || b.color === "currentcolor" || v.color === "currentcolor") return null;
    let E = b.pct, k = v.pct;
    E === null && k === null ? (E = 0.5, k = 0.5) : E === null ? E = 1 - k : k === null && (k = 1 - E);
    const z = E + k, _ = z < 1 ? z : 1;
    E /= z, k /= z;
    const [N, H, j, X] = b.color.rgba, [q, D, h, x] = v.color.rgba, w = X * E + x * k, C = (B, K) => w === 0 ? 0 : (B * X * E + K * x * k) / w, O = [C(N, q), C(H, D), C(j, h), w * _], A = x === 0 ? b.color.token : X === 0 ? v.color.token : null;
    return { rgba: O, token: A };
  }
  const d = s[2].includes(",") ? oe(s[2], ",") : oe(s[2].replace("/", " / ")).filter((y) => y !== "/");
  if (d.length < 3) return null;
  const m = (y) => y.endsWith("%") ? parseFloat(y) / 100 * 255 : parseFloat(y), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), p = [m(d[0]), m(d[1]), m(d[2]), f];
  return p.some((y) => Number.isNaN(y)) ? null : { rgba: p, token: null };
}
const xl = ["top", "right", "bottom", "left"], J0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Ar = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], $d = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function ps(n, l) {
  const i = l.trim(), o = () => oe(i);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Ar(o());
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
      const s = Ar(o());
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
      const s = n.split("-")[1], d = Ar(o());
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
          $d.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? d = p : f = p;
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
      const s = Ar(oe(i.split("/")[0]));
      return J0.map((d, m) => [`border-${d}-radius`, s[m]]);
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
      return i === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : Jr(i, () => "#000000") ? [["background-color", i], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", i]];
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
      return ps("gap", i);
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
        $d.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
      return [["outline-width", s], ["outline-style", d], ["outline-color", m]];
    }
    case "transition": {
      if (i === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = oe(i, ","), d = s.map((f) => oe(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = s.map((f) => oe(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
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
function W0(n, l) {
  return n ? oe(n, ",").some((i) => {
    let o = i.trim().toLowerCase(), s = !1;
    o.startsWith("not ") && (s = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const d = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), y = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (y) {
        const [, b, v] = y, E = (k) => {
          const z = ms(k, { viewport: l });
          return typeof z == "object" && "px" in z ? z.px : NaN;
        };
        switch (b) {
          case "min-width":
            return l.width >= E(v);
          case "max-width":
            return l.width <= E(v);
          case "min-height":
            return l.height >= E(v);
          case "max-height":
            return l.height <= E(v);
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
      const S = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (S) {
        const b = S[1] === "width" ? l.width : l.height, v = ms(S[3], { viewport: l }), E = typeof v == "object" && "px" in v ? v.px : NaN;
        switch (S[2]) {
          case ">=":
            return b >= E;
          case "<=":
            return b <= E;
          case ">":
            return b > E;
          case "<":
            return b < E;
          default:
            return b === E;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function F0(n, l) {
  const i = l[l.length - 1].compound;
  return Ms(i)[0] ?? n;
}
function I0(n) {
  const l = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = (s, d) => {
    s.forEach(({ compound: m }, f) => {
      const p = d && f === s.length - 1;
      for (const y of m.pseudos)
        if (Cs.has(y.name) && (p ? l : i).add(y.name), y.list && y.name !== "not") for (const S of y.list) o(S, p);
    });
  };
  return o(n, !0), { subject: l, ancestor: i };
}
function Ms(n) {
  const l = [...n.classes];
  for (const i of n.pseudos)
    if (!(i.name !== "is" && i.name !== "where"))
      for (const o of i.list) o.length === 1 && l.push(...Ms(o[0].compound));
  return l;
}
function $0(n, l) {
  const i = (o, s) => {
    o.forEach(({ compound: d }, m) => {
      const f = s && m === o.length - 1, p = d.pseudos.filter((y) => Cs.has(y.name)).map((y) => y.name);
      if (!f) for (const y of p) for (const S of Ms(d)) l.add(`${y}:${S}`);
      for (const y of d.pseudos) if (y.list && y.name !== "not") for (const S of y.list) i(S, f);
    });
  };
  i(n, !0);
}
class P0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map();
    const i = (d, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(d);
    };
    let o = 0;
    const s = (d, m) => {
      for (const [f, p, y, S] of d)
        for (const b of Es(f)) {
          let v;
          try {
            v = zs(b);
          } catch (_) {
            if (_ instanceof ie) {
              this.skipped++;
              continue;
            }
            throw _;
          }
          const E = I0(v);
          $0(v, this.trackedStates);
          const k = v[v.length - 1].compound.pseudoElement, z = { steps: v, media: p, layer: y, origin: m, order: o++, specificity: jf(v), decls: S, states: E, pseudo: k, own: ag(v), above: eg(v), source: m === 0 ? `ua:${v[v.length - 1].compound.tag ?? "*"}` : F0(b, v) };
          this.rules.push(z), i(z, v);
        }
    };
    s(L0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
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
        const p = f.reads ??= Xf(f.steps);
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
const tg = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function eg(n) {
  const l = [];
  for (let i = n.length - 1; i > 0 && !(n[i].combinator !== " " && n[i].combinator !== ">"); i--)
    l.push(...n[i - 1].compound.classes);
  return l;
}
function Kf(n) {
  const l = n.parentElement;
  if (!l) return ng;
  const i = Kf(l), o = n.aboveCache;
  if (o && o.parent === l && o.name === l.className && o.base === i) return o.set;
  const s = l.classSet, d = s.size === 0 ? i : /* @__PURE__ */ new Set([...i, ...s]);
  return n.aboveCache = { parent: l, name: l.className, base: i, set: d }, d;
}
const ng = /* @__PURE__ */ new Set();
function ag(n) {
  if (n.length !== 1) return !1;
  const { compound: l } = n[0];
  return !l.id && !l.attrs.length && l.pseudos.every((i) => Cs.has(i.name) && i.name !== "focus-within");
}
function Xf(n, l = !0, i = { anc: !1, pos: !1, nth: !1, ancPos: !1 }) {
  return n.forEach((o, s) => {
    const d = l && s === n.length - 1;
    d || (i.anc = !0);
    for (const m of o.compound.pseudos)
      if (tg.has(m.name) && (d ? i.pos = !0 : i.ancPos = !0, m.name === "nth-child" && d && (i.nth = !0)), m.list && m.name !== "has") for (const f of m.list) Xf(f, d, i);
  }), i;
}
const lg = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function rg(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [i, o] of Object.entries(n)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const s = i.startsWith("--") ? i : i.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof o == "number" && o !== 0 && !lg.has(s) && !s.startsWith("--") ? `${o}px` : String(o);
    l.push([s, d]);
  }
  return l;
}
function ig(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const i of ["width", "height"]) {
    const o = n.getAttribute(i);
    o !== null && l.push([i, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return l;
}
const og = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class sg {
  constructor(l, { theme: i, viewport: o }) {
    this.sheet = l, this.theme = i, this.viewport = o, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map();
  }
  mediaHolds(l) {
    if (!l.media) return !0;
    for (const i of l.media) {
      let o = this.media.get(i);
      if (o === void 0 && this.media.set(i, o = W0(i, this.viewport)), !o) return !1;
    }
    return !0;
  }
  themeHex(l) {
    return this.theme?.[l] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(l, i, o = null) {
    const d = { state: (b, v, E) => {
      if (v === "disabled") return !!b.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(b.tagName);
      if (v === "enabled") return !b.props?.disabled && ["button", "input", "select", "textarea"].includes(b.tagName);
      if (v === "checked") return !!b.props?.checked;
      if (i === "*") return !0;
      if (v === "focus-within") {
        const k = b.ownerDocument?.activeElement;
        return !!k && k !== b.ownerDocument.body && typeof b.contains == "function" && b.contains(k);
      }
      return E ? i.has(v) : v === "focus-visible" ? !!b.state?.focus && !b.state?.pointerFocus : !!b.state?.[v];
    }, pseudo: o }, m = this.sheet.candidates(l, o), f = `${l.tagName} ${l.className}|${o ?? ""}|${i === "*" ? "*" : [...i].sort().join(",")}`;
    let p = this.ownMatches.get(f);
    p || (p = new Set(m.filter((b) => b.own && this.mediaHolds(b) && rs(l, b.steps, d))), this.ownMatches.set(f, p));
    let y = null;
    const S = (b) => b.above.length ? (y ??= Kf(l), b.above.every((v) => y.has(v))) : !0;
    return m.filter((b) => b.own ? p.has(b) : this.mediaHolds(b) && S(b) && rs(l, b.steps, d));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, i, o = /* @__PURE__ */ new Set(), s = null) {
    const d = this.matching(l, o, s), m = s ? [] : ig(l), f = s ? [] : rg(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    i && (p = this.computed.get(i.values), p || this.computed.set(i.values, p = /* @__PURE__ */ new Map()));
    const y = `${d.map((b) => b.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${f.length ? JSON.stringify(f) : ""}`;
    let S = p.get(y);
    return S || p.set(y, S = this.cascade(d, m, f, i)), { ...S, rules: d, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, i, o, s) {
    const d = [];
    for (const h of l)
      for (const [x, w, C] of h.decls) d.push({ prop: x, value: w, important: C ? 1 : 0, origin: h.origin === 0 ? 0 : 2, layer: h.layer, specificity: h.specificity, order: h.order, source: h.source });
    for (const [h, x] of i) d.push({ prop: h, value: x, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${h}` });
    for (const [h, x] of o) d.push({ prop: h, value: x, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(og);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
    for (const h of d) h.prop.startsWith("--") && y.set(h.prop, h.value);
    if (!s && this.theme) for (const h of Lf) this.theme[h] && y.set(`--${h}`, `perchtoken(${h})`);
    const S = (h) => {
      if (p.has(h)) return p.get(h);
      const x = m[h];
      return x && !x.inherits ? x.initial ?? null : h in f ? f[h] : x?.initial ?? null;
    }, b = /* @__PURE__ */ new Set(), v = (h) => {
      if (!y.has(h)) return S(h);
      if (b.has(h)) return null;
      b.add(h);
      const x = fs(y.get(h), v);
      return b.delete(h), y.delete(h), p.set(h, x), (!m[h] || m[h].inherits) && (f[h] = x), x;
    };
    for (const h of [...y.keys()]) v(h);
    const E = /* @__PURE__ */ new Map();
    for (const h of d) {
      if (h.prop.startsWith("--")) continue;
      const x = fs(h.value, S);
      if (x === null) {
        for (const [w] of ps(h.prop, "unset")) E.set(w, { value: "unset", source: h.source, origin: h.origin });
        continue;
      }
      for (const [w, C] of ps(h.prop, x)) E.set(w, { value: C, source: h.source, origin: h.origin });
    }
    const k = {}, z = {}, _ = /* @__PURE__ */ new Set(), N = /* @__PURE__ */ new Set(), H = s?.values, j = { fontSize: H?.["font-size"] ?? us, viewport: this.viewport }, X = (h, x) => {
      if (/currentcolor/i.test(x)) return this.parseValue(h, x, j, k, H);
      const w = `${h}\0${x}\0${j.fontSize}`;
      let C = this.parsed.get(w);
      return C === void 0 && this.parsed.set(w, C = this.parseValue(h, x, j, k, H)), C;
    }, q = E.size ? [...ds, ...[...E.keys()].filter((h) => !V0.has(h))] : ds;
    for (const h of q) {
      const x = E.get(h);
      let w = x?.value;
      const C = Q0.has(h);
      if ((w === void 0 || w === "unset" || w === "revert" || w === "revert-layer") && (w = C ? "inherit" : "initial"), x && (z[h] = x.source, x.origin !== 0 && _.add(h)), w === "inherit" && H && h in H) {
        k[h] = H[h], N.add(h);
        continue;
      }
      (w === "inherit" || w === "initial") && (w = C ? Vf[h] : Qf[h]), k[h] = X(h, w), h === "font-size" && (j.fontSize = k["font-size"]);
    }
    for (const h of xl) {
      const x = k[`border-${h}-style`];
      (x === "none" || x === "hidden") && (k[`border-${h}-width`] = { px: 0 });
    }
    k["outline-style"] === "none" && (k["outline-width"] = { px: 0 });
    const D = H?.display;
    return (D === "flex" || D === "inline-flex" || D === "grid" || D === "inline-grid") && k.position !== "absolute" && k.position !== "fixed" && (k.display = Pd(k.display)), (k.position === "absolute" || k.position === "fixed") && (k.display = Pd(k.display)), { values: k, sources: z, own: _, inherited: N, customs: f };
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
        const f = Jr(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = Jr(m, (p) => this.themeHex(p));
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
        return ms(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function Pd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Wr = (n) => n && n.rgba ? { value: Z0(n.rgba), token: n.token ?? null } : null, cg = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function ug(n, l) {
  const i = l?.(n);
  if (Number.isFinite(i)) return i;
  const o = Math.round(n * 100) / 100;
  return cg[o] ?? Math.round(n * 1.2);
}
function _l(n, l) {
  const i = n["line-height"], o = n["font-size"];
  return i.normal ? ug(o, l) : i.factor !== void 0 ? i.factor * o : i.px;
}
const dg = (n) => oe(n, ",").map((l) => l.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const fg = "perch-native-description/1", Fe = Symbol("display"), Fr = {
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
}, mg = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of mg) Fr[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Fr.rounded = 0;
const pg = /* @__PURE__ */ new Set([
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
]), hg = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, gg = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, bg = (n) => gg.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : hg.test(n) ? ".SystemUIFont" : dg(n).split(",")[0].trim(), vg = {
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
}, tf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, As = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const i = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (i) return `${n.tagName}.${i}`;
  const o = n.parentElement;
  return o && o.tagName !== "body" ? `${As(o)} > ${n.tagName}` : n.tagName;
};
class yg {
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
}, xg = /^(text|search|url|email|tel|password|number)$/, wg = 162.13 / 12.8;
function _g(n, l) {
  const i = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!i) return;
  const o = oe(i[1], ",").map((s) => qn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return o.length ? Math.min(...o) : void 0;
}
function kg(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const i = qn(n.expr, { fontSize: l["font-size"] }), o = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!i && !i.num && i.pct === 100 && Math.abs(i.px + o) < 0.01;
}
function Zf(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = o && oe(o[2], ",").map((d) => d.trim());
    return !s || s.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [s[0], "0"] : o[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const i = n.translate;
  if (i && i !== "none") {
    const o = oe(String(i).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && qn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function ef(n, l, i, o = !1) {
  const s = n.values, d = Zf(s);
  if (d?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (b, v) => {
    const E = qn(b, f);
    if (!(!E || E.unitless && E.num))
      return E.pct ? typeof v == "number" ? E.px + E.pct / 100 * v : void 0 : E.px;
  }, y = d ? p(d[0], l.w) : void 0, S = d ? p(d[1], l.h) : void 0;
  if (y === void 0 || S === void 0) {
    const b = !o && d ? d.map((v) => qn(v, f)) : null;
    if (b?.every((v) => v && !(v.unitless && v.num))) {
      l[Jf] = b.map((v) => [v.px, v.pct ?? 0]);
      return;
    }
    i("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (o) {
    y && (l.left = y), S && (l.top = S);
    return;
  }
  y && (l.ml = (l.ml ?? 0) + y), S && (l.mt = (l.mt ?? 0) + S);
}
const Jf = Symbol("perch.shift");
function Sg(n, l, i) {
  const o = n.ownerDocument, s = o?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, y]] = i, S = m + f / 100 * s.width, b = p + y / 100 * s.height;
    S && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + S), b && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + b);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < Bf && o?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function Gr(n, l, i = null) {
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
    const D = pn(o["row-gap"]), h = pn(o["column-gap"]);
    typeof D == "number" && D && (s.gap_y = D), typeof h == "number" && h && !j && (s.gap_x = h);
  }
  o["flex-grow"] && (s.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (s.flex_shrink = o["flex-shrink"]);
  const y = pn(o["flex-basis"]);
  y !== void 0 && y !== "auto" && (s.flex_basis = y);
  const S = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  S && (s.self = S);
  for (const [j, X] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = o[X], D = pn(q);
    if (D === void 0 && X === "width" && kg(q, o)) {
      s.self = "stretch", l("approximated", X, q.expr, d(X), "stretched across its parent, inside its margins");
      continue;
    }
    const h = D === void 0 && /^max-/.test(X) ? _g(q, o["font-size"]) : void 0;
    if (h !== void 0) {
      s[j] = h, l("approximated", X, q.expr, d(X), "the fixed bound of min()");
      continue;
    }
    if (D === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", X, q.expr, d(X), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", X, q, d(X));
      continue;
    }
    D !== "auto" && (s[j] = D);
  }
  const b = ["top", "right", "bottom", "left"];
  for (const j of b) {
    const X = j[0];
    for (const [q, D] of [["p", "padding"], ["m", "margin"]]) {
      const h = o[`${D}-${j}`], x = pn(h);
      if (x === void 0) {
        h?.expr && l("unsupported", `${D}-${j}`, h.expr, d(`${D}-${j}`), "no calc() in the engine");
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
    ef(n, s, l);
  } else v === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Zf(o)?.length !== 0 && (s.position = "relative", ef(n, s, l, !0));
  o["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", o["z-index"], d("z-index"), "paint order is tree order");
  for (const [j, X] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = o[X];
    q === "hidden" || q === "clip" ? s[j] = "hidden" : (q === "auto" || q === "scroll") && (s[j] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (s.visibility = "invisible");
  const E = o["background-color"];
  E?.unreadable ? l("unsupported", "background-color", E.unreadable, d("background-color")) : E?.rgba && E.rgba[3] > 0 && (s.bg = Wr(E)), o["background-image"] && o["background-image"] !== "none" && l("unsupported", "background-image", o["background-image"], d("background-image"));
  const k = b.map((j) => pn(o[`border-${j}-width`]) || 0), z = [];
  b.forEach((j, X) => {
    if (!k[X]) return;
    s[`border_${j[0]}`] = k[X];
    const q = o[`border-${j}-style`];
    q !== "solid" && l("approximated", `border-${j}-style`, q, d(`border-${j}-style`), "drawn solid");
    const D = Wr(o[`border-${j}-color`]);
    D && z.push(D);
  }), z.length && (s.border_color = z[0], z.some((j) => j.value !== z[0].value) && l("approximated", "border-color", z.map((j) => j.value).join(" "), d("border-top-color"), "one border colour"));
  const _ = (j) => {
    const X = pn(o[`border-${j}-radius`]) || 0;
    if (typeof X != "string") return X;
    const q = parseFloat(X) / 100, D = [s.w, s.h].filter((h) => typeof h == "number");
    return X === "auto" || !(q > 0) ? 0 : D.length ? Math.round(Math.min(q, 0.5) * Math.min(...D) * 100) / 100 : 9999;
  }, N = ["top-left", "top-right", "bottom-right", "bottom-left"].map(_);
  N.every((j) => j === N[0]) ? N[0] && (s.rounded = N[0]) : ["tl", "tr", "br", "bl"].forEach((j, X) => {
    N[X] && (s[`rounded_${j}`] = N[X]);
  }), o.opacity !== 1 && (s.opacity = Math.round(o.opacity * 1e3) / 1e3);
  const H = o["box-shadow"];
  if (H && H !== "none" && oe(H, ",").some((j) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(j.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", H, d("box-shadow"), "the engine's large shadow preset")), o.cursor && o.cursor !== "auto" && !n.inherited.has("cursor")) {
    const j = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[o.cursor];
    j ? s.cursor = j : l("unsupported", "cursor", o.cursor, d("cursor"));
  }
  return o["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), o["text-decoration-line"] === "underline" ? s.underline = !0 : o["text-decoration-line"] && o["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", o["text-decoration-line"], d("text-decoration-line")), s;
}
const Eg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Wf(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((i) => Eg[i]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Lr(n, l) {
  const i = n.values, o = i["line-height"];
  return {
    text_color: Wr(i.color),
    text_size: Math.round(i["font-size"] * 1e3) / 1e3,
    font_features: Wf(i["font-variant-numeric"]) ?? "",
    font_weight: i["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(_l(i, l) * 1e3) / 1e3 },
    font_family: bg(i["font-family"]),
    italic: i["font-style"] === "italic" || i["font-style"] === "oblique",
    whitespace: i["white-space"] === "nowrap" || i["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[i["text-align"]] ?? "left"
  };
}
const nf = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, js = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function Qr(n, l, i) {
  const o = {}, s = (f, p) => p.some((y) => !n.inherited.has(y));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !js(l[f], i[f])) && (o[f] = l[f]);
  const d = nf(l.line_height, l.text_size), m = i.line_height ? nf(i.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (o.line_height = l.line_height), o;
}
const zg = (n, l) => ({ ...n, ...l });
function Vr(n, l) {
  const i = {};
  for (const [o, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (i[o] = s.value, s.token && (l[o] = s.token)) : o === "line_height" ? i[o] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : o === "italic" ? s && (i.italic = !0) : i[o] = s;
  return i.italic === !1 && delete i.italic, i;
}
function af(n, l) {
  const i = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[o], d = l[o];
    js(s, d) || (i[o] = d === void 0 ? o in Fr ? Fr[o] : null : d);
  }
  return i;
}
function lf(n, l) {
  const i = n.values;
  for (const [o, s] of Object.entries(n.sources)) {
    if (o.startsWith("--") || pg.has(o) || s.startsWith("ua:")) continue;
    const d = i[o];
    switch (o) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", o, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Wf(d) === null && l("unsupported", o, d, s);
        break;
      case "text-transform":
        d !== "none" && l("approximated", o, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = i["transition-duration"];
        o === "transition-property" && m && oe(m, ",").some((f) => parseFloat(f) > 0) && i["transition-property"] !== "none" && l("unsupported", "transition", `${i["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
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
        i["outline-style"] !== "none" && o === "outline-style" && l("unsupported", "outline", `${pn(i["outline-width"])}px ${i["outline-style"]} ${Wr(i["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function Ng(n, l, i, o) {
  const s = As(n), d = [], m = (N, H, j, X, q) => d.push([N, H, j, X ?? "(user agent)", s, q]), f = o.cascade.compute(n, l), p = {}, y = Gr(f, m, o.viewport), S = y[Jf];
  lf(f, m);
  const b = Lr(f, o.measure), v = Qr(f, b, i), E = Vr({ ...y, ...v }, p), k = {}, z = o.cascade.matching(n, "*").filter((N) => N.states.subject.size);
  for (const [N, H] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!z.some((h) => H.some((x) => h.states.subject.has(x)))) continue;
    const j = o.cascade.compute(n, l, new Set(H)), X = {}, q = Vr({ ...Gr(j, () => {
    }), ...Qr(j, Lr(j, o.measure), i) }, X);
    N === "focus" && lf(j, m);
    const D = af(E, q);
    if (Object.keys(D).length) {
      k[N] = D;
      const h = Object.fromEntries(Object.entries(X).filter(([x]) => x in D));
      Object.keys(h).length && (k[`${N}_tokens`] = h);
    }
  }
  if (o.cascade.sheet.tracks(n, "hover") && (k.group = rf(n), k.track_hover = !0), o.cascade.sheet.readsAncestor(n, "hover"))
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
      const X = {}, q = Vr({ ...Gr(j, () => {
      }), ...Qr(j, Lr(j, o.measure), i) }, X), D = af(E, q);
      if (!Object.keys(D).length) continue;
      const h = Object.fromEntries(Object.entries(X).filter(([x]) => x in D));
      (k.group_hover ??= []).push({ group: rf(N), style: D, ...Object.keys(h).length ? { tokens: h } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (k.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (k.break_anywhere = !0), y.overflow_y === "scroll") {
    const N = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    N > 0 && (k.scrollbar = N);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (k.blocks_pointer = !0), f.values["pointer-events"] === "none" && (k.pointer_none = !0);
  const _ = Object.entries(vg).filter(([, N]) => N.some((H) => typeof n.props[H] == "function")).map(([N]) => N);
  return !_.includes("click") && cs(n) && _.push("click"), _.length && (k.events = _), { computed: f, style: E, tokens: p, extra: k, meta: Hg(n), reports: d, childText: zg(i, v), where: s, shift: S };
}
function Tg(n, l, i, o) {
  const s = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!o.cascade.matching(n, /* @__PURE__ */ new Set(), d).length) continue;
    const m = o.cascade.compute(n, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", y = (k, z, _, N, H) => o.add(k, z, _, N ?? "(user agent)", `${As(n)}::${d}`, H), S = {}, b = Gr(m, y, o.viewport), E = { kind: "div", style: Vr({ ...b, ...Qr(m, Lr(m, o.measure), i) }, S), tokens: S, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(E, Fe, { value: m.values.display }), s[d] = E;
  }
  return s;
}
const rf = (n) => `~g${n.id}`, Cg = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function Mg(n) {
  return n.kind === "div" && n[Fe] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !Cg.some((l) => n.style?.[l]) && n.children?.every((l) => l.kind === "text");
}
function jr(n, l) {
  const i = n[l], o = { ...i, style: { ...i.style } };
  return Object.defineProperty(o, Fe, { value: i[Fe] }), n[l] = o, o;
}
function Ag(n) {
  const l = [];
  for (let i = n.parentElement; i?.parentElement; i = i.parentElement) {
    const o = i.parentElement.children;
    l.push(`${+(o[0] === i)}${+(o[o.length - 1] === i)}`);
  }
  return l.join("");
}
function Ff(n, l, i, o, s = 0, d = !0, m = !0, f = 0) {
  const p = o.cascade.sheet.depends(n), y = p.pos ? `${+d}${+m}${p.nth ? `:${f}` : ""}` : "", S = p.ancPos ? Ag(n) : "";
  let b = o.cache.get(n);
  const v = b && b.version === n.version && b.parentValues === l?.values && b.inheritedText === i && b.pos === y && b.ancPos === S && (!p.anc || s <= b.at);
  if (v && b.node && b.stamp === n.stamp && !b.volatile && (!b.subAnc || s <= b.subAt)) {
    for (const _ of b.log) o.add(..._);
    return b.node;
  }
  if (!v) {
    const _ = Ng(n, l, i, o);
    b && js(b.part.childText, _.childText) && (_.childText = b.part.childText), b = { version: n.version, parentValues: l?.values, inheritedText: i, pos: y, ancPos: S, at: o.now, part: _ }, o.cache.set(n, b);
  }
  const E = o.log.length, k = { volatile: !!b.part.shift || p.ancPos, subAnc: p.anc }, z = jg(n, b, o, Math.max(s, n.attrStamp), k);
  return Object.assign(b, { node: z, stamp: n.stamp, subAt: o.now, log: o.log.slice(E), volatile: k.volatile, subAnc: k.subAnc }), z;
}
function jg(n, l, i, o, s) {
  const { computed: d, tokens: m, extra: f, reports: p, childText: y, where: S } = l.part;
  for (const w of p) i.add(...w);
  const b = (w, C, O, A, B) => i.add(w, C, O, A, S, B), v = { ...l.part.style };
  l.part.shift && Sg(n, v, l.part.shift);
  const E = { kind: "div", id: n.id, style: v, tokens: m, meta: l.part.meta, ...f };
  Object.defineProperty(E, Fe, { value: d.values.display }), n.measured && n.ownerDocument?.measureKey && (E.measure = n.ownerDocument.measureKey(n));
  const k = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return E.kind = "engine", E.engine = String(n.props["data-perch-engine"]), E.key = String(n.props["data-perch-key"] ?? ""), E;
  if (k === "svg")
    return E.kind = n.props["data-perch-image"] ? "image" : "svg", E.markup = Ug(n), E;
  if (k === "input" || k === "textarea" || k === "select") {
    E.kind = "input", E.input_type = k === "input" ? String(n.props.type ?? "text") : k;
    for (const O of ["placeholder", "checked", "disabled"]) n.props[O] !== void 0 && (E[O] = n.props[O]);
    if (/^(checkbox|radio)$/.test(E.input_type) && (E.checked = n.checked), k !== "select" && (E.value = n.value), k === "input" && xg.test(E.input_type) && (E.field_w = wg * d.values["font-size"]), k === "textarea" && v.h === void 0) {
      const O = d.values, A = (I) => I && typeof I == "object" && "px" in I ? I.px : 0, B = (I) => O[`border-${I}-style`] === "none" ? 0 : A(O[`border-${I}-width`]), K = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      v.h = K * _l(O, i.measure) + A(O["padding-top"]) + A(O["padding-bottom"]) + B("top") + B("bottom");
    }
    const { before: w, after: C } = Tg(n, d, y, i);
    return (w || C) && (E.children = [w, C].filter(Boolean)), E;
  }
  if (k === "img") {
    E.kind = "image", E.src = n.props.src ?? null;
    for (const [w, C] of [["width", "w"], ["height", "h"]]) {
      const O = Number(n.props[w]);
      v[C] === void 0 && n.props[w] != null && Number.isFinite(O) && (v[C] = O);
    }
    return E;
  }
  const z = d.values["text-transform"], _ = [];
  let N = !1, H = !1;
  const j = n.childNodes.reduce((w, C) => w + (C instanceof Kt ? 1 : 0), 0);
  let X = 0;
  for (const w of n.childNodes) {
    if (w instanceof li) {
      if (w.hidden || w.data === "") continue;
      N = !0;
      const B = _[_.length - 1];
      if (B?.kind === "text")
        B.source = (B.source ?? B.text) + w.data, B.text = of(B.source, z), B.text === B.source && delete B.source;
      else {
        const K = of(w.data, z);
        _.push(K === w.data ? { kind: "text", text: K } : { kind: "text", text: K, source: w.data });
      }
      continue;
    }
    if (!(w instanceof Kt)) continue;
    const C = Ff(w, d, y, i, o, X === 0, X === j - 1, X);
    X++;
    const O = i.cache.get(w);
    s.volatile ||= O.volatile, s.subAnc ||= O.subAnc;
    const A = C[Fe];
    A === "inline" || A === "inline-block" || A === "inline-flex" ? N = !0 : A !== "none" && (H = !0), _.push(C);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && v.w === void 0) {
    for (let w = 0; w < _.length; w++)
      if (_[w].style?.flex_grow && _[w].style.min_w === 0 && _[w].style.overflow_x === "hidden") {
        const C = jr(_, w);
        delete C.style.min_w, delete C.style.flex_grow, delete C.style.flex_basis, delete C.style.overflow_x, delete C.style.overflow_y;
      }
  }
  if (!v.display && N && _.some((w) => w.kind !== "text") && _.every((w) => w.kind === "text" || Mg(w))) {
    const w = _.map((C) => C.kind === "text" ? C.text : C.children.map((O) => O.text).join("")).join("");
    b("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), _.splice(0, _.length, { kind: "text", text: w });
  }
  const q = _.some((w) => w.kind !== "text");
  let D = _.length === 1 && _[0].kind !== "text" && /^inline-(block|flex)$/.test(_[0][Fe]) ? _[0] : null;
  if (!v.display && D) {
    D = jr(_, 0);
    const w = i.cache.get(n.childNodes.find((O) => O.id === D.id))?.part.computed, C = w ? $r(d.values, i.measure) - Dg(w.values, i.measure, D) : 0;
    v.display = "flex", v.flex_direction = "col", v.items = "start", C > 0 && (D.style.mt = Math.round(((D.style.mt ?? 0) + C) * 100) / 100), b("approximated", "display", `${d.values.display} holding one ${D[Fe]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!v.display && _.length === 1 && (_[0].kind === "svg" || _[0].kind === "image") && _[0][Fe] === "inline" && typeof _[0].style.h == "number") {
    const w = jr(_, 0), C = $r(d.values, i.measure), O = _l(d.values, i.measure) - C, A = (B) => Math.round(B * 100) / 100;
    v.display = "flex", v.flex_direction = "col", v.items = "start", C > w.style.h && (w.style.mt = A((w.style.mt ?? 0) + C - w.style.h)), O > 0 && (w.style.mb = A((w.style.mb ?? 0) + O)), b("approximated", "display", `${d.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!v.display && N && q) {
    if (v.display = "flex", v.flex_direction = H ? "col" : "row", !H) v.items = "baseline";
    else for (let w = 0; w < _.length; w++) _[w].kind !== "text" && /^inline-(block|flex)$/.test(_[w][Fe]) && !_[w].style.self && (jr(_, w).style.self = "start");
    b("approximated", "display", `${d.values.display} with inline content`, "(inline formatting)", H ? "a column of its children" : "a row on the text baseline");
  }
  const h = d.values["letter-spacing"]?.px, x = d.values["overflow-x"] !== "visible";
  if (h)
    for (let w = 0; w < _.length; w++) {
      const C = _[w];
      if (C.kind !== "text") continue;
      const O = Math.round(h * [...C.text].length * 1e3) / 1e3;
      if (h > 0 || !x) {
        _[w] = { kind: "div", style: { pr: O }, tokens: {}, children: [C] };
        continue;
      }
      const A = d.values["font-size"], B = Math.max(0.8, 1 + h / (0.55 * A)), K = Math.round(_l(d.values, i.measure) * 1e3) / 1e3;
      _[w] = { kind: "div", style: { text_size: Math.round(A * B * 1e3) / 1e3, line_height: `${K}px` }, tokens: {}, children: [C] };
    }
  return E.children = _, E;
}
function Og(n, l) {
  if (!l) return null;
  let o = (l.self ? n : l.closest ? Df(n, l.closest) : l.find ? Sl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return o && l.strip && o.startsWith(l.strip) && (o = o.slice(l.strip.length)), o;
}
function Rg(n, l, i) {
  const o = l.map((m) => [m, ai(m.selector)]), s = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const p = i.get(f.id);
      if (p)
        for (const [y, S] of o) {
          const b = y.textRange ? "range_name" : "name";
          if (y.textRange && p[b] != null || !S.some((z) => rs(f, z))) continue;
          const v = Og(f, y.key), E = v == null ? s.get(y.name) ?? 0 : 0;
          v == null && s.set(y.name, E + 1);
          const k = v != null ? `${y.name}:${v}` : E ? `${y.name}@${E}` : y.name;
          p[b] == null ? p[b] = k : (p.also ??= []).push(k);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Ir = 0.9521, If = 0.2256, $r = (n, l) => (_l(n, l) - (Ir + If) * n["font-size"]) / 2 + Ir * n["font-size"];
function Dg(n, l, i) {
  const o = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]), d = i?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max($r(n, l), (m.style.mt ?? 0) + m.style.h) : $r(n, l);
  return o(n["padding-top"]) + s + f;
}
const of = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (i) => i.toUpperCase()) : n, $f = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function Hg(n) {
  const l = {};
  for (const [i, o] of Object.entries(n.props)) {
    if ($f.has(i) || typeof o == "function" || o === void 0 || o === null || typeof o == "object") continue;
    const s = i.startsWith("aria-") || i.startsWith("data-");
    if (o === !1 && !s) continue;
    const d = i === "htmlFor" ? "for" : i === "tabIndex" ? "tabindex" : i;
    l[d] = typeof o == "boolean" ? s ? String(o) : "" : String(o);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const Bg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), sf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function Ug(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (i) => {
    const o = [];
    for (const [d, m] of Object.entries(i.props))
      $f.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || o.push(`${Bg(d)}="${sf(m === !0 ? "" : m)}"`);
    i.tagName === "svg" && !i.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = i.childNodes.map((d) => d instanceof li ? sf(d.data) : l(d)).join("");
    return `<${i.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${s}</${i.tagName}>`;
  };
  return l(n);
}
function qg(n) {
  const l = n.theme?.() ?? {}, i = {};
  for (const o of Lf) l[o] && (i[o] = l[o]);
  return i;
}
const Yg = { font_features: "" };
function Gg(n, l, i, o = {}, s = null) {
  const d = qg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (o.look !== f || o.sheet !== i) && Object.assign(o, { look: f, sheet: i, cache: /* @__PURE__ */ new WeakMap(), cascade: new sg(i, { theme: d, viewport: m }), top: null });
  const { cascade: p, cache: y } = o, S = new yg(), b = [], E = { cascade: p, cache: y, viewport: m, findings: S, log: b, add: (...N) => {
    b.push(N), S.add(...N);
  }, now: os(), measure: l.lineHeight ? (N) => l.lineHeight(N) : null };
  o.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const k = n.body.children, z = k.map((N, H) => Ff(N, o.top, Yg, E, 0, H === 0, H === k.length - 1, H));
  if (s?.length) {
    const N = /* @__PURE__ */ new Map(), H = (j) => {
      j.id && (N.set(j.id, j), delete j.name, delete j.range_name, delete j.also);
      for (const X of j.children ?? []) H(X);
    };
    z.forEach(H), Rg(n, s, N);
  }
  const _ = /* @__PURE__ */ new Set();
  for (const N of [n, n.defaultView])
    for (const { type: H } of N?.listeners ?? []) tf[H] && _.add(tf[H]);
  return { schema: fg, root: z[0] ?? null, overlays: z.slice(1), document_events: [..._].sort(), unsupported: E.findings.list() };
}
const Lg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let Qg = null;
const Vg = () => Qg ??= new P0(Lg);
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
function Kg(n, l) {
  const i = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const o of i) {
    if (o === "children") continue;
    const s = n[o], d = l[o];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(o === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const Xg = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function cf(n, l) {
  for (const i of b0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(i);
  return n;
}
const Zg = {
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
  createInstance: (n, l, i) => cf(new Kt(n, l, i.ownerDocument), l),
  createTextInstance: (n, l) => new li(n),
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
      cf(n, o);
    }
    Kg(i, o) && n.touch();
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
}, Ne = q0(Zg), Tl = (n, l, i = null) => Ne.createPortal(n, l, null, i), Jg = {
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
}, Wg = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Fg = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Ig = (n) => {
  for (let l = n; l instanceof Kt; l = l.parentNode) if (l.props.disabled && Fg.has(l.tagName)) return !0;
  return !1;
};
class $g {
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
function Or(n, l, i) {
  l.currentTarget = n;
  for (const { type: o, listener: s, capture: d } of [...n.listeners ?? []])
    o === l.type && d === i && s.call(n, l);
  if (n instanceof Kt) {
    const o = Jg[l.type], s = o && n.props[i ? `${o}Capture` : o];
    typeof s == "function" && s(l);
  }
}
function ix(n, l, i = {}) {
  const { document: o, window: s, globals: d } = _0(n), m = new Kt("div", { id: "root", style: i.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let p = null;
  const y = () => [o, s].map((D) => D.listeners.map((h) => `${h.type}:${h.capture}`).sort().join(",")).join("|");
  let S = "";
  const b = {}, v = `m${Math.random().toString(36).slice(2, 10)}:`;
  let E = 0, k = -1;
  o.measureKey = (D) => v + D.id, o.stale = () => k !== E, o.computed = (D) => {
    if (!b.cascade || !b.top) return null;
    const h = [];
    for (let w = D; w instanceof Kt && w !== o.body; w = w.parentNode) h.unshift(w);
    let x = b.top;
    for (const w of h) x = b.cascade.compute(w, x);
    return x.values;
  };
  const z = () => (E += 1, p = Gg(o, n, Vg(), b, i.names), S = y(), n.render?.(p), p), _ = () => {
    Ne.flushPassiveEffects(), Ne.flushSyncWork(), y() !== S && z();
  };
  o.afterCommit = z;
  const N = (D) => {
    f.push(D), n.error?.(D);
  }, H = Ne.createContainer(m, El.ConcurrentRoot, null, !1, null, "", N, N, N, null);
  Ne.updateContainerSync(W.createElement(l, i.props ?? {}), H, null, null), Ne.flushSyncWork(), _();
  const j = (D) => {
    const h = (x) => {
      if (x.id === D) return x;
      for (const w of x.children) {
        const C = h(w);
        if (C) return C;
      }
      return null;
    };
    return h(o.documentElement);
  }, X = (D) => {
    const h = sa;
    sa = El.DiscreteEventPriority;
    try {
      return D();
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
    dispatch(D, h, x = {}) {
      const w = typeof D == "string" ? j(D) : D;
      if (!w || Wg.has(h) && Ig(w)) return !1;
      const C = new $g(h, x, w), O = [];
      for (let K = w; K; K = h === "scroll" ? null : K.parentNode) O.push(K);
      const A = [...O, o, s];
      X(() => {
        for (let K = A.length - 1; K > 0 && !C.propagationStopped; K--) Or(A[K], C, !0);
        C.propagationStopped || (Or(w, C, !0), C.propagationStopped || Or(w, C, !1));
        for (let K = 1; K < A.length && !C.propagationStopped; K++) Or(A[K], C, !1);
      });
      const B = h === "click" && !C.defaultPrevented ? cs(w) : null;
      if (B && q.dispatch(B, "submit", {}), h === "click" && !C.defaultPrevented)
        for (let K = w; K; K = K.parentNode) {
          if (K.tagName !== "a") continue;
          const I = K.props?.href;
          typeof I == "string" && /^https:\/\/\S+$/.test(I) && n.openLink?.(I);
          break;
        }
      return !C.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (D) => [o, s].some((h) => h.listeners.some((x) => x.type === D)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(D) {
      const h = o.activeElement && o.activeElement !== o.body ? o.activeElement : o.body;
      if (!q.dispatch(h, "keydown", D)) return !0;
      const w = D.key === "Enter" && !D.isComposing ? cs(h, !0) : null;
      if (w)
        return q.dispatch(w, "submit", {}), !0;
      if (!Yf(h) || h.props.disabled || h.props.readOnly) return !1;
      if ((D.ctrlKey || D.metaKey) && !D.altKey && !D.shiftKey && D.key.toLowerCase() === "a")
        return h.selectedAll = !0, !0;
      if (D.ctrlKey || D.metaKey) return !1;
      const C = h.selectedAll;
      h.selectedAll = !1;
      const O = h.value, B = D.key === "Backspace" || C && D.key === "Delete" ? C ? "" : O.slice(0, -1) : [...D.key].length === 1 ? (C ? "" : O) + D.key : O;
      return B === O ? !1 : (h.value = B, q.dispatch(h, "input", { data: D.key }), q.dispatch(h, "change", {}), h.props.value !== void 0 && delete h.edit, h.touch(), z(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(D, h) {
      const x = j(D);
      x && (x.bounds = { x: h.x, y: h.y, width: h.width, height: h.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(D) {
      const h = j(D);
      if (!h || h.props.disabled || !q.dispatch(D, "click", { button: 0, detail: 1 })) return;
      const x = h.props.type === "radio";
      x && h.checked || (h.checked = x ? !0 : !h.checked, q.dispatch(D, "input", {}), q.dispatch(D, "change", {}), h.props.checked !== void 0 && delete h.ticked, h.touch(), z());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(D, h = {}) {
      const x = { button: 0, buttons: 1, pointerType: "mouse", ...h };
      for (const w of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(D, w, x);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (D) => !!j(D)?.state.hover,
    hover(D, h) {
      const x = j(D);
      !x || x.state.hover === h || (x.state.hover = h, x.touch(), z());
    },
    focus(D) {
      const h = j(D);
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
    pressFocus(D) {
      let x = typeof D == "string" ? j(D) : D;
      for (; x && !(x instanceof Kt && typeof x.props.onKeyDown == "function" && Xg(x)); ) x = x.parentNode;
      !x || x === o.activeElement || (q.focus(x.id), x.state.pointerFocus = !0, x.touch(), z());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return k = E, o.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const D = o.retries.splice(0);
      for (const h of D) h();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: _,
    update(D) {
      Ne.updateContainerSync(W.createElement(l, D ?? {}), H, null, null), Ne.flushSyncWork(), _();
    },
    unmount() {
      Ne.updateContainerSync(null, H, null, null), Ne.flushSyncWork(), Ne.flushPassiveEffects(), o.afterCommit = null, o.retries.length = 0, n.forgetBounds?.(v);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Pf = (n) => Ne.flushSyncFromReconciler(n), Pg = { createPortal: Tl, flushSync: Pf }, ox = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Tl,
  default: Pg,
  flushSync: Pf
}, Symbol.toStringTag, { value: "Module" }));
function tm(n) {
  var l, i, o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (i = tm(n[l])) && (o && (o += " "), o += i);
  } else for (i in n) n[i] && (o && (o += " "), o += i);
  return o;
}
function em() {
  for (var n, l, i = 0, o = "", s = arguments.length; i < s; i++) (n = arguments[i]) && (l = tm(n)) && (o && (o += " "), o += l);
  return o;
}
const tb = (n, l) => {
  const i = new Array(n.length + l.length);
  for (let o = 0; o < n.length; o++)
    i[o] = n[o];
  for (let o = 0; o < l.length; o++)
    i[n.length + o] = l[o];
  return i;
}, eb = (n, l) => ({
  classGroupId: n,
  validator: l
}), nm = (n = /* @__PURE__ */ new Map(), l = null, i) => ({
  nextPart: n,
  validators: l,
  classGroupId: i
}), Pr = "-", uf = [], nb = "arbitrary..", ab = (n) => {
  const l = rb(n), {
    conflictingClassGroups: i,
    conflictingClassGroupModifiers: o
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return lb(m);
      const f = m.split(Pr), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return am(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = o[m], y = i[m];
        return p ? y ? tb(y, p) : p : y || uf;
      }
      return i[m] || uf;
    }
  };
}, am = (n, l, i) => {
  if (n.length - l === 0)
    return i.classGroupId;
  const s = n[l], d = i.nextPart.get(s);
  if (d) {
    const y = am(n, l + 1, d);
    if (y) return y;
  }
  const m = i.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(Pr) : n.slice(l).join(Pr), p = m.length;
  for (let y = 0; y < p; y++) {
    const S = m[y];
    if (S.validator(f))
      return S.classGroupId;
  }
}, lb = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), i = l.indexOf(":"), o = l.slice(0, i);
  return o ? nb + o : void 0;
})(), rb = (n) => {
  const {
    theme: l,
    classGroups: i
  } = n;
  return ib(i, l);
}, ib = (n, l) => {
  const i = nm();
  for (const o in n) {
    const s = n[o];
    Os(s, i, o, l);
  }
  return i;
}, Os = (n, l, i, o) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const m = n[d];
    ob(m, l, i, o);
  }
}, ob = (n, l, i, o) => {
  if (typeof n == "string") {
    sb(n, l, i);
    return;
  }
  if (typeof n == "function") {
    cb(n, l, i, o);
    return;
  }
  ub(n, l, i, o);
}, sb = (n, l, i) => {
  const o = n === "" ? l : lm(l, n);
  o.classGroupId = i;
}, cb = (n, l, i, o) => {
  if (db(n)) {
    Os(n(o), l, i, o);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(eb(i, n));
}, ub = (n, l, i, o) => {
  const s = Object.entries(n), d = s.length;
  for (let m = 0; m < d; m++) {
    const [f, p] = s[m];
    Os(p, lm(l, f), i, o);
  }
}, lm = (n, l) => {
  let i = n;
  const o = l.split(Pr), s = o.length;
  for (let d = 0; d < s; d++) {
    const m = o[d];
    let f = i.nextPart.get(m);
    f || (f = nm(), i.nextPart.set(m, f)), i = f;
  }
  return i;
}, db = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, fb = (n) => {
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
}, hs = "!", df = ":", mb = [], ff = (n, l, i, o, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: i,
  maybePostfixModifierPosition: o,
  isExternal: s
}), pb = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: i
  } = n;
  let o = (s) => {
    const d = [];
    let m = 0, f = 0, p = 0, y;
    const S = s.length;
    for (let z = 0; z < S; z++) {
      const _ = s[z];
      if (m === 0 && f === 0) {
        if (_ === df) {
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
    let v = b, E = !1;
    b.endsWith(hs) ? (v = b.slice(0, -1), E = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      b.startsWith(hs) && (v = b.slice(1), E = !0)
    );
    const k = y && y > p ? y - p : void 0;
    return ff(d, E, v, k);
  };
  if (l) {
    const s = l + df, d = o;
    o = (m) => m.startsWith(s) ? d(m.slice(s.length)) : ff(mb, !1, m, void 0, !0);
  }
  if (i) {
    const s = o;
    o = (d) => i({
      className: d,
      parseClassName: s
    });
  }
  return o;
}, hb = (n) => {
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
}, gb = (n) => ({
  cache: fb(n.cacheSize),
  parseClassName: pb(n),
  sortModifiers: hb(n),
  postfixLookupClassGroupIds: bb(n),
  ...ab(n)
}), bb = (n) => {
  const l = /* @__PURE__ */ Object.create(null), i = n.postfixLookupClassGroups;
  if (i)
    for (let o = 0; o < i.length; o++)
      l[i[o]] = !0;
  return l;
}, vb = /\s+/, yb = (n, l) => {
  const {
    parseClassName: i,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = n.trim().split(vb);
  let y = "";
  for (let S = p.length - 1; S >= 0; S -= 1) {
    const b = p[S], {
      isExternal: v,
      modifiers: E,
      hasImportantModifier: k,
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
    const j = E.length === 0 ? "" : E.length === 1 ? E[0] : d(E).join(":"), X = k ? j + hs : j, q = X + H;
    if (f.indexOf(q) > -1)
      continue;
    f.push(q);
    const D = s(H, N);
    for (let h = 0; h < D.length; ++h) {
      const x = D[h];
      f.push(X + x);
    }
    y = b + (y.length > 0 ? " " + y : y);
  }
  return y;
}, xb = (...n) => {
  let l = 0, i, o, s = "";
  for (; l < n.length; )
    (i = n[l++]) && (o = rm(i)) && (s && (s += " "), s += o);
  return s;
}, rm = (n) => {
  if (typeof n == "string")
    return n;
  let l, i = "";
  for (let o = 0; o < n.length; o++)
    n[o] && (l = rm(n[o])) && (i && (i += " "), i += l);
  return i;
}, wb = (n, ...l) => {
  let i, o, s, d;
  const m = (p) => {
    const y = l.reduce((S, b) => b(S), n());
    return i = gb(y), o = i.cache.get, s = i.cache.set, d = f, f(p);
  }, f = (p) => {
    const y = o(p);
    if (y)
      return y;
    const S = yb(p, i);
    return s(p, S), S;
  };
  return d = m, (...p) => d(xb(...p));
}, _b = [], Wt = (n) => {
  const l = (i) => i[n] || _b;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, im = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, om = /^\((?:(\w[\w-]*):)?(.+)\)$/i, kb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Sb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, Eb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, zb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, Nb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, Tb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Rn = (n) => kb.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), We = (n) => !!n && Number.isInteger(Number(n)), Po = (n) => n.endsWith("%") && vt(n.slice(0, -1)), mn = (n) => Sb.test(n), sm = () => !0, Cb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  Eb.test(n) && !zb.test(n)
), Rs = () => !1, Mb = (n) => Nb.test(n), Ab = (n) => Tb.test(n), jb = (n) => !rt(n) && !it(n), Ob = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), Rb = (n) => Yn(n, dm, Rs), rt = (n) => im.test(n), ia = (n) => Yn(n, fm, Cb), mf = (n) => Yn(n, Lb, vt), Db = (n) => Yn(n, pm, sm), Hb = (n) => Yn(n, mm, Rs), pf = (n) => Yn(n, cm, Rs), Bb = (n) => Yn(n, um, Ab), Rr = (n) => Yn(n, hm, Mb), it = (n) => om.test(n), yl = (n) => ua(n, fm), Ub = (n) => ua(n, mm), hf = (n) => ua(n, cm), qb = (n) => ua(n, dm), Yb = (n) => ua(n, um), Dr = (n) => ua(n, hm, !0), Gb = (n) => ua(n, pm, !0), Yn = (n, l, i) => {
  const o = im.exec(n);
  return o ? o[1] ? l(o[1]) : i(o[2]) : !1;
}, ua = (n, l, i = !1) => {
  const o = om.exec(n);
  return o ? o[1] ? l(o[1]) : i : !1;
}, cm = (n) => n === "position" || n === "percentage", um = (n) => n === "image" || n === "url", dm = (n) => n === "length" || n === "size" || n === "bg-size", fm = (n) => n === "length", Lb = (n) => n === "number", mm = (n) => n === "family-name", pm = (n) => n === "number" || n === "weight", hm = (n) => n === "shadow", Qb = () => {
  const n = Wt("color"), l = Wt("font"), i = Wt("text"), o = Wt("font-weight"), s = Wt("tracking"), d = Wt("leading"), m = Wt("breakpoint"), f = Wt("container"), p = Wt("spacing"), y = Wt("radius"), S = Wt("shadow"), b = Wt("inset-shadow"), v = Wt("text-shadow"), E = Wt("drop-shadow"), k = Wt("blur"), z = Wt("perspective"), _ = Wt("aspect"), N = Wt("ease"), H = Wt("animate"), j = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], X = () => [
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
  ], q = () => [...X(), it, rt], D = () => ["auto", "hidden", "clip", "visible", "scroll"], h = () => ["auto", "contain", "none"], x = () => [it, rt, p], w = () => [Rn, "full", "auto", ...x()], C = () => [We, "none", "subgrid", it, rt], O = () => ["auto", {
    span: ["full", We, it, rt]
  }, We, it, rt], A = () => [We, "auto", it, rt], B = () => ["auto", "min", "max", "fr", it, rt], K = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], I = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...x()], J = () => [Rn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...x()], $ = () => [f, Rn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...x()], L = () => [Rn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...x()], V = () => [n, it, rt], T = () => [...X(), hf, pf, {
    position: [it, rt]
  }], Z = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], at = () => ["auto", "cover", "contain", qb, Rb, {
    size: [it, rt]
  }], st = () => [Po, yl, ia], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    y,
    it,
    rt
  ], ut = () => ["", vt, yl, ia], Et = () => ["solid", "dashed", "dotted", "double"], It = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Po, hf, pf], Gn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    k,
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
      color: [sm],
      container: [mn],
      "drop-shadow": [mn],
      ease: ["in", "out", "in-out"],
      font: [jb],
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
      "container-named": [Ob],
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
        "grid-cols": C()
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
        "grid-rows": C()
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
        "justify-items": [...I(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...I()]
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
        items: [...I(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...I(), {
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
        "place-items": [...I(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...I()]
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
        font: [o, Gb, Db]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", Po, rt]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [Ub, Hb, l]
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
        "line-clamp": [vt, "none", it, mf]
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
        }, Yb, Bb]
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
          S,
          Dr,
          Rr
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
        "inset-shadow": ["none", b, Dr, Rr]
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
        "text-shadow": ["none", v, Dr, Rr]
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
        "mix-blend": [...It(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": It()
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
        blur: Gn()
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
          E,
          Dr,
          Rr
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
        "backdrop-blur": Gn()
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
        stroke: [vt, yl, ia, mf]
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
}, Vb = /* @__PURE__ */ wb(Qb);
function jt(...n) {
  return Vb(em(n));
}
function Kb(n, l, i) {
  return n.filter((o, s) => s !== l && (o.start + o.end) / 2 < i).length;
}
function Xb(n, l, i, o) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const m = n[l + 1], f = n[l - 1], p = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((y, S) => {
    l < i && S > l && S <= i ? s[S] = -p : i < l && S >= i && S < l && (s[S] = p);
  }), s[l] = Math.min(Math.max(o, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const gf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function Zb(n, l) {
  for (let i = n.parentElement; i; i = i.parentElement) {
    const o = getComputedStyle(i)[l === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (l === "x" ? i.scrollWidth > i.clientWidth : i.scrollHeight > i.clientHeight)) return i;
  }
  return null;
}
function Jb(n, l, i, o) {
  const s = n[l] ? Zb(n[l], i) : null, d = () => s ? i === "x" ? s.scrollLeft : s.scrollTop : 0, m = (_) => (i === "x" ? _.clientX : _.clientY) + d(), f = m(o), p = d(), y = n.map((_) => {
    const N = _.getBoundingClientRect();
    return i === "x" ? { start: N.left + p, end: N.right + p } : { start: N.top + p, end: N.bottom + p };
  }), S = n.map((_) => gf.map((N) => _.style[N])), b = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, v = i === "x" ? "translateX" : "translateY";
  let E = !1;
  const k = { to: l };
  n.forEach((_, N) => {
    if (_.style.pointerEvents = "none", N !== l) {
      b || (_.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(_).position === "static" && (_.style.position = "relative"), _.style.zIndex = "30", _.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const z = (_, N) => {
    k.to = _, Xb(y, l, _, N).forEach((H, j) => {
      n[j].style.transform = H ? `${v}(${H}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return k.to;
    },
    slot: (_) => Kb(y, l, m(_)),
    apply: (_, N) => {
      E || z(_, m(N) - f);
    },
    rest: () => {
      E || z(l, 0);
    },
    end: () => {
      E || (E = !0, n.forEach((_, N) => gf.forEach((H, j) => {
        _.style[H] = S[N][j];
      })));
    }
  };
}
const Wb = 5;
let ts = !1;
function Fb(n, l) {
  if (n.button !== 0 || ts) return;
  const i = { clientX: n.clientX, clientY: n.clientY }, o = n.currentTarget, s = n.pointerId;
  let d = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, y = (k) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", S), window.removeEventListener("pointerup", b), window.removeEventListener("pointercancel", v), window.removeEventListener("keydown", E, !0), window.removeEventListener("blur", v), o.removeEventListener("lostpointercapture", v);
    try {
      o.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    ts = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, d.end();
    const z = (_) => _.stopPropagation();
    window.addEventListener("click", z, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", z, !0), 0), m?.(), l.onEnd(k, d);
  }, S = (k) => {
    if (!d) {
      if (Math.hypot(k.clientX - i.clientX, k.clientY - i.clientY) < Wb) return;
      const z = l.items();
      d = Jb(z, l.from(z), l.axis, i), ts = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(s);
      } catch {
      }
      o.addEventListener("lostpointercapture", v);
      const _ = l.onStart?.();
      m = typeof _ == "function" ? _ : void 0;
    }
    l.onMove(k, d);
  }, b = () => y(!0), v = () => y(!1), E = (k) => {
    k.key === "Escape" && (k.stopPropagation(), y(!1));
  };
  window.addEventListener("pointermove", S), window.addEventListener("pointerup", b), window.addEventListener("pointercancel", v), window.addEventListener("keydown", E, !0), window.addEventListener("blur", v);
}
const gm = typeof navigator < "u" && /Mac/i.test(navigator.platform), ti = {
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
for (let n = 1; n <= 12; n++) ti[`f${n}`] = `F${n}`;
const Ib = Object.fromEntries(Object.entries(ti).map(([n, l]) => [l, n])), $b = {
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
function Pb(n) {
  const l = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return l ? l[1].toLowerCase() : Ib[n];
}
const bf = /* @__PURE__ */ new Map();
function bm(n, l = gm) {
  const i = `${l}|${n}`, o = bf.get(i);
  if (o) return o;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (ti[d]) s.code = ti[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return bf.set(i, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = bm(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function tv(n, l = gm) {
  const i = bm(n, l), o = ev(Pb(i.code) ?? "");
  return l ? `${i.ctrl ? "⌃" : ""}${i.alt ? "⌥" : ""}${i.shift ? "⇧" : ""}${i.cmd ? "⌘" : ""}${o}` : [i.ctrl && "Ctrl", i.alt && "Alt", i.shift && "Shift", o].filter(Boolean).join("+");
}
const ev = (n) => $b[n] ?? n.toUpperCase(), vf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, yf = em, ri = (n, l) => (i) => {
  var o;
  if (l?.variants == null) return yf(n, i?.class, i?.className);
  const { variants: s, defaultVariants: d } = l, m = Object.keys(s).map((y) => {
    const S = i?.[y], b = d?.[y];
    if (S === null) return null;
    const v = vf(S) || vf(b);
    return s[y][v];
  }), f = i && Object.entries(i).reduce((y, S) => {
    let [b, v] = S;
    return v === void 0 || (y[b] = v), y;
  }, {}), p = l == null || (o = l.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((y, S) => {
    let { class: b, className: v, ...E } = S;
    return Object.entries(E).every((k) => {
      let [z, _] = k;
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
  return yf(n, m, p, i?.class, i?.className);
}, nv = ri(
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
), av = ri(
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
function lv({ className: n, ...l } = {}) {
  return jt(av(l), n);
}
const vm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Cl = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", rv = ri(`${Cl} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function iv({ className: n, ...l } = {}) {
  return jt(rv(l), n);
}
const ii = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", gs = ri(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), ov = "my-1 h-px bg-overlay-0";
function sv({ size: n = 14, className: l }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function cv({ size: n = 16, className: l }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function uv({ size: n = 14, className: l }) {
  return /* @__PURE__ */ et.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function ym({ size: n = 14, className: l }) {
  return /* @__PURE__ */ et.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const xf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function dv({ state: n, error: l }) {
  return /* @__PURE__ */ et.jsx(
    "span",
    {
      className: jt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", xf[n] ?? xf.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function fv({ title: n, onClose: l, children: i, testId: o }) {
  return Tl(
    /* @__PURE__ */ et.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ et.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": o,
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
const Hr = 4, Dn = 8, mv = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", wf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function pv({ value: n, onChange: l, options: i, className: o, ariaLabel: s, testId: d, id: m, title: f, disabled: p, placeholder: y, freeText: S, onKeyDown: b }) {
  const v = W.useId(), [E, k] = W.useState(!1), [z, _] = W.useState(-1), [N, H] = W.useState(!1), j = W.useRef(null), X = W.useRef(null), [q, D] = W.useState({}), h = W.useRef({ text: "", at: 0 }), x = S && N && n ? i.filter((L) => wf(L).toLowerCase().includes(n.toLowerCase()) || L.value.toLowerCase().includes(n.toLowerCase())) : i, w = i.find((L) => L.value === n), C = (L) => `${v}-${L}`;
  function O(L) {
    p || (_(L), k(!0));
  }
  function A() {
    k(!1), H(!1), _(-1);
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
  const I = () => x.findIndex((L) => !L.disabled), Q = () => x.length - 1 - [...x].reverse().findIndex((L) => !L.disabled);
  Zr(() => {
    if (!E || !j.current) {
      D((at) => at.left === void 0 ? at : {});
      return;
    }
    const L = j.current.getBoundingClientRect(), V = window.innerHeight - L.bottom - Hr - Dn, T = L.top - Hr - Dn, Z = V < 160 && T > V;
    D({
      position: "fixed",
      left: Math.min(Math.max(Dn, L.left), Math.max(Dn, window.innerWidth - L.width - Dn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: L.width,
      maxWidth: window.innerWidth - 2 * Dn,
      maxHeight: Math.min(Z ? T : V, 320),
      ...Z ? { bottom: window.innerHeight - L.top + Hr } : { top: L.bottom + Hr },
      overflowY: "auto"
    });
  }, [E, x.length]), Zr(() => {
    const L = X.current;
    if (!E || !L || q.left === void 0) return;
    const V = L.getBoundingClientRect().right, T = window.innerWidth - Dn;
    V > T && D((Z) => ({ ...Z, left: Math.max(Dn, Number(Z.left) - (V - T)) }));
  }, [E, q]), Ft(() => {
    if (!E) return;
    const L = (V) => {
      const T = V.target;
      (T === document || T instanceof Node && j.current && T.contains(j.current)) && A();
    };
    return window.addEventListener("resize", A), window.addEventListener("scroll", L, !0), () => {
      window.removeEventListener("resize", A), window.removeEventListener("scroll", L, !0);
    };
  }, [E]), Ft(() => {
    const L = E && z >= 0 ? document.getElementById(C(z)) : null, V = X.current;
    !L || !V || (L.offsetTop < V.scrollTop ? V.scrollTop = L.offsetTop : L.offsetTop + L.offsetHeight > V.scrollTop + V.clientHeight && (V.scrollTop = L.offsetTop + L.offsetHeight - V.clientHeight));
  }, [E, z]), _m(E, (L) => {
    L || A();
  }, j, X);
  function J(L) {
    if (L.nativeEvent.isComposing) return;
    const V = () => {
      L.preventDefault(), L.stopPropagation();
    }, { key: T } = L;
    if (E) {
      if (T === "Escape") {
        V(), A();
        return;
      } else if (T === "Tab")
        A();
      else if (T === "ArrowDown" || T === "ArrowUp") {
        V(), x.length && _(z < 0 ? T === "ArrowDown" ? I() : Q() : K(z, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !S) {
        V(), _(I());
        return;
      } else if (T === "End" && !S) {
        V(), _(Q());
        return;
      } else if (T === "Enter" || T === " " && !S) {
        if (z >= 0 && x[z]) {
          V(), B(x[z]);
          return;
        }
        if (!S) {
          V(), A();
          return;
        }
      } else if (!S && T.length === 1 && !L.metaKey && !L.ctrlKey && !L.altKey) {
        const Z = Date.now();
        h.current = { text: (Z - h.current.at > 600 ? "" : h.current.text) + T.toLowerCase(), at: Z };
        const at = Math.max(z, 0), st = [...x.slice(at + (h.current.text.length === 1 ? 1 : 0)), ...x.slice(0, at + 1)].find((ct) => !ct.disabled && wf(ct).toLowerCase().startsWith(h.current.text));
        st && (V(), _(x.indexOf(st)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !S && (T === "Enter" || T === " ")) {
      V(), O(Math.max(0, x.findIndex((Z) => Z.value === n)));
      return;
    }
    b?.(L);
  }
  const $ = {
    ref: (L) => {
      j.current = L;
    },
    id: m,
    title: f,
    disabled: p,
    "aria-label": s,
    "aria-expanded": E,
    "aria-controls": E ? v : void 0,
    "aria-activedescendant": E && z >= 0 ? C(z) : void 0,
    "data-testid": d,
    onKeyDown: J
  };
  return /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
    S ? /* @__PURE__ */ et.jsx(
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
        onChange: (L) => {
          l(L.target.value), H(!0), E ? _(-1) : (_(-1), k(!0));
        },
        onBlur: () => A()
      }
    ) : /* @__PURE__ */ et.jsxs(
      "button",
      {
        ...$,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: jt("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", o),
        onClick: () => E ? A() : O(Math.max(0, x.findIndex((L) => L.value === n))),
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "min-w-0 flex-1 truncate", children: w ? w.label : y ?? "" }),
          /* @__PURE__ */ et.jsx(Bs, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    E && x.length > 0 && Tl(
      /* @__PURE__ */ et.jsx(
        "div",
        {
          ref: X,
          id: v,
          role: "listbox",
          "aria-label": s,
          className: jt("z-[9999]", ii),
          style: q,
          onMouseDown: (L) => {
            L.preventDefault(), L.stopPropagation();
          },
          onClick: (L) => L.stopPropagation(),
          children: x.map((L, V) => /* @__PURE__ */ et.jsxs(
            "div",
            {
              id: C(V),
              role: "option",
              "aria-selected": L.value === n,
              "aria-disabled": L.disabled || void 0,
              "data-value": L.value,
              className: jt(mv, V === z && !L.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                L.disabled || _(V);
              },
              onClick: () => B(L),
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
const _f = 230, hv = 370;
function gv({ x: n, y: l, readOnly: i, canUndo: o, canRedo: s, hasSelection: d, onClose: m, actions: f }) {
  const p = W.useRef(null);
  Ft(() => {
    const v = (k) => {
      p.current?.contains(k.target) || m();
    }, E = (k) => {
      k.key === "Escape" && (k.preventDefault(), m());
    };
    return document.addEventListener("mousedown", v), document.addEventListener("keydown", E), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", v), document.removeEventListener("keydown", E), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const y = (v, E) => xs(Nm ? v : E), S = (v, E, k, z, _ = !1) => /* @__PURE__ */ et.jsxs("button", { type: "button", className: jt(Tm(), "flex items-center justify-between gap-6"), "data-testid": k, disabled: _, onClick: E, children: [
    /* @__PURE__ */ et.jsx("span", { children: v }),
    /* @__PURE__ */ et.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: z })
  ] }), b = f.askAgent;
  return Tl(
    /* @__PURE__ */ et.jsxs(
      "div",
      {
        ref: p,
        className: ii,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(l, window.innerHeight - hv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - _f - 8)),
          zIndex: 9999,
          minWidth: _f
        },
        onContextMenu: (v) => v.preventDefault(),
        children: [
          b && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
            S(d ? "Ask agent about selection…" : "Ask agent about file…", b, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ et.jsx("div", { className: Xr })
          ] }),
          S("Undo", f.undo, "editor-menu-undo", y("cmd+z", "ctrl+z"), i || !o),
          S("Redo", f.redo, "editor-menu-redo", y("cmd+shift+z", "ctrl+y"), i || !s),
          /* @__PURE__ */ et.jsx("div", { className: Xr }),
          S("Cut", f.cut, "editor-menu-cut", y("cmd+x", "ctrl+x"), i || !d),
          S("Copy", f.copy, "editor-menu-copy", y("cmd+c", "ctrl+c"), !d),
          S("Paste", f.paste, "editor-menu-paste", y("cmd+v", "ctrl+v"), i),
          S("Select All", f.selectAll, "editor-menu-select-all", y("cmd+a", "ctrl+a")),
          /* @__PURE__ */ et.jsx("div", { className: Xr }),
          S("Find…", f.find, "editor-menu-find", y("cmd+f", "ctrl+f")),
          !i && S("Replace…", f.replace, "editor-menu-replace", y("cmd+alt+f", "ctrl+h")),
          S("Go to Line…", f.gotoLine, "editor-menu-goto", xs("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const bv = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", vv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", yv = "m-0 mb-2 text-[0.82rem] text-subtext-0", xm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ds = `${xm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, xv = `${Ds} min-w-[5.5rem] shrink-0`, Hs = `${xm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, wv = `${Hs} flex-1 max-[700px]:flex-[1_1_100%]`, _v = `${Hs} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, kv = `${Hs} flex-[1_1_100%]`, Sv = "flex flex-wrap items-center gap-[0.4rem]", Ev = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", zv = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", Nv = `settings-modal__host-row ${zv}`, Tv = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", Cv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", wm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", Mv = `${wm} bg-accent`, Av = `${wm} ml-auto bg-red`;
function Bs({ open: n, size: l = 12, className: i }) {
  return /* @__PURE__ */ et.jsx("svg", { className: i, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function jv({ label: n, items: l, testId: i, side: o = "right", up: s = !1, maxHeight: d = 320 }) {
  const [m, f] = W.useState(!1), [p, y] = W.useState(!1), S = W.useRef(null), b = W.useRef(null), v = () => [...b.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Ft(() => {
    m && p && (v()[0]?.focus(), y(!1));
  }, [m, p]);
  const E = () => {
    f(!0), y(!0);
  }, k = (_) => {
    (_.key === "ArrowRight" || _.key === "Enter" || _.key === " ") && (_.preventDefault(), E());
  }, z = (_) => {
    const N = v(), H = N.findIndex((j) => j === document.activeElement);
    _.key === "ArrowDown" || _.key === "ArrowUp" ? (_.preventDefault(), N[(H + (_.key === "ArrowDown" ? 1 : N.length - 1)) % N.length]?.focus()) : (_.key === "ArrowLeft" || _.key === "Escape") && (_.preventDefault(), _.stopPropagation(), f(!1), S.current?.focus());
  };
  return /* @__PURE__ */ et.jsxs("div", { className: "group/submenu relative", children: [
    /* @__PURE__ */ et.jsxs(
      "button",
      {
        ref: S,
        type: "button",
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": m,
        className: jt(gs(), "flex items-center justify-between gap-2"),
        "data-testid": i,
        onClick: () => m ? f(!1) : E(),
        onKeyDown: k,
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ et.jsx(Bs, { open: !1, size: 10 })
        ]
      }
    ),
    /* @__PURE__ */ et.jsx(
      "div",
      {
        ref: b,
        role: "menu",
        "aria-label": n,
        className: jt(
          ii,
          "absolute z-10 w-60 overflow-y-auto",
          o === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: d },
        onKeyDown: z,
        children: l.map((_) => /* @__PURE__ */ et.jsx("button", { type: "button", role: "menuitem", className: gs(), "data-testid": _.testId, onClick: _.onSelect, children: /* @__PURE__ */ et.jsx("span", { className: "block truncate", children: _.label }) }, _.key))
      }
    )
  ] });
}
function Ov(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const bs = {
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
function vs(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((i) => i.id === n.parentSessionId);
}
function Rv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const i of n)
    vs(i, n) && l.set(i.parentSessionId, [...l.get(i.parentSessionId) ?? [], i]);
  return l.size ? n.filter((i) => !vs(i, n)).flatMap((i) => [i, ...l.get(i.id) ?? []]) : n;
}
const Br = 6, kf = 8;
function Dv(n, l = {}) {
  const { minWidth: i = 220, align: o = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = o === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, y = d.top - Br - kf, S = f - d.bottom - Br - kf;
  return y >= s ? {
    position: "fixed",
    bottom: f - d.top + Br,
    ...p,
    minWidth: i,
    maxHeight: Math.min(y, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Br,
    ...p,
    minWidth: i,
    maxHeight: Math.min(S, f * 0.75),
    overflowY: "auto"
  };
}
function _m(n, l, i, o) {
  Ft(() => {
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
function Hv({ icon: n, fallback: l }) {
  const [i, o] = W.useState(!1);
  return Ft(() => o(!1), [n]), !n || i ? /* @__PURE__ */ et.jsx(et.Fragment, { children: l }) : /* @__PURE__ */ et.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const Bv = ["application/zip", "application/x-tar", "application/gzip"];
function km(n) {
  const l = n ?? "";
  if (l.startsWith("image/")) return "image";
  if (l.startsWith("video/")) return "video";
  if (l.startsWith("audio/")) return "audio";
  if (l === "application/pdf") return "pdf";
  if (Bv.includes(l)) return "archive";
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
const Uv = 50 * 1024 * 1024, Sf = 1.25, qv = 0.05, Yv = 16384, Gv = "inline-flex items-center justify-center", Ur = jt(Cl, Gv, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), es = jt(Cl, "inline-flex min-h-8 items-center px-2"), Lv = { pdf: "PDF document", audio: "Audio", video: "Video" };
let Qv = 0;
function Vv(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function Kv(n, l, i) {
  const o = l ? Math.min(8, Yv / Math.max(l.width, l.height)) : 1, s = i === "in" ? n * Sf : i === "out" ? n / Sf : 1;
  return Math.min(o, Math.max(Math.min(qv, o), s));
}
function Xv(n, l) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${l.replace(/^\/+/, "")}`;
}
function Zv({ media: n, workspaceId: l, metadata: i, onFail: o }) {
  const s = W.useMemo(() => `media-${++Qv}`, []), [d, m] = W.useState(null), [f, p] = W.useState("fit");
  Ft(() => {
    let k = !0;
    return n.open(s, { workspaceId: l, path: i.path, mediaType: i.mediaType ?? "", size: i.size }).then((z) => {
      k && m(z ?? { width: 0, height: 0 });
    }, (z) => {
      k && o(String(z?.message ?? z));
    }), () => {
      k = !1, n.release(s);
    };
  }, [s]), Ft(() => {
    n.setZoom(s, f === "fit" ? null : f);
  }, [s, f]);
  const y = d !== null && d.width > 0 && d.height > 0, S = () => f !== "fit" ? f : n.fitScale(s) ?? 1, b = (k) => p(Kv(S(), d, k)), v = (k) => {
    if (!(k.metaKey || k.ctrlKey || k.altKey || !y)) {
      if (k.key === "+" || k.key === "=") b("in");
      else if (k.key === "-") b("out");
      else if (k.key === "0") b("actual");
      else return;
      k.preventDefault();
    }
  }, E = f === "fit" ? "Fit" : `${Math.round(f * 100)}%`;
  return W.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    W.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      W.createElement("button", { type: "button", className: Ur, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !y, onClick: () => b("out") }, "−"),
      W.createElement("button", { type: "button", className: Ur, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !y, onClick: () => b("in") }, "+"),
      W.createElement("button", { type: "button", className: jt(Ur, f === "fit" && "text-fg"), "aria-pressed": f === "fit", onClick: () => p("fit") }, "Fit"),
      W.createElement("button", { type: "button", className: jt(Ur, f === 1 && "text-fg"), "aria-pressed": f === 1, title: "Actual size (0)", disabled: !y, onClick: () => b("actual") }, "100%"),
      W.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, y ? `${d.width} × ${d.height} · ${E}` : "")
    ),
    W.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${i.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: v
    }, d === null ? W.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : W.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function Jv({ workspaceId: n, metadata: l, perch: i }) {
  const [o, s] = W.useState(!1), d = i.mediaFile?.(n, l.path) ?? { root: null, extraction: null }, m = d.extraction, f = km(l.mediaType), p = Xv(d.root, l.path), y = p === null, S = f === "archive", b = f === "image" && l.size > Uv, v = f !== void 0 && !S && !y && !b;
  let E = "Open this file in Quick Look or its default app.";
  y ? E = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : S && (E = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let k = "No preview for this file type";
  y ? k = "Remote media is not available yet" : S ? k = "Compressed archive" : b ? (k = "Image too large to preview", E = `This image is ${Math.round(l.size / 1048576)} MB. Open it in Quick Look or its default app.`) : o && (k = "Preview unavailable", f === "image" && (E = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const z = (N) => {
    try {
      i.media[N](p);
    } catch (H) {
      console.error(`perch-media ${N}: ${H?.message ?? H}`);
    }
  }, _ = f === "pdf" || f === "audio" || f === "video";
  return W.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${l.path}`, "data-testid": "workspace-file-asset" },
    W.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      W.createElement("strong", { className: "min-w-0 flex-1 truncate", title: l.path }, l.path),
      S && W.createElement(
        "button",
        { type: "button", className: es, disabled: m?.state === "loading", onClick: () => i.command("files.extract", { workspaceId: n, path: l.path }) },
        m?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !y && W.createElement("button", { type: "button", className: es, onClick: () => z("quickLook") }, "Quick Look"),
      !y && W.createElement("button", { type: "button", className: es, onClick: () => z("openDefault") }, "Open with Default App")
    ),
    m?.state === "ready" && W.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${m.destination}. Find it in the file tree.`),
    m?.state === "error" && W.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, m.error),
    !v || o ? W.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      W.createElement("strong", { className: "text-fg" }, k),
      W.createElement("span", null, E)
    ) : f === "image" ? W.createElement(Zv, { media: i.media, workspaceId: n, metadata: l, onFail: () => s(!0) }) : _ && W.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      W.createElement("strong", { className: "text-fg" }, l.name),
      W.createElement("span", null, `${Lv[f]} · ${Vv(l.size)}`),
      W.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function Wv(n, l = !1) {
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
const Fv = {
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
function Iv({ name: n, directory: l = !1, open: i = !1 }) {
  const { kind: o, tone: s, text: d } = Wv(n, l);
  return /* @__PURE__ */ et.jsxs("svg", { className: jt("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": o, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    o === "react" ? /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : d ? /* @__PURE__ */ et.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: d }) : /* @__PURE__ */ et.jsx("path", { d: o === "folder" && i ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : Fv[o] }),
    o === "branch" && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    o === "image" && /* @__PURE__ */ et.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const $v = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, Ef = (n) => typeof n == "string" ? $v[n] ?? "?" : "?", zf = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function Pv(n) {
  const l = Ef(n.index), i = Ef(n.worktree), o = l === "!" || i === "!", s = o ? "!" : n.staged && n.unstaged ? `${l || "?"}/${i || "?"}` : n.staged ? l : i || l, d = `Git · Index: ${zf(n.index)}; working tree: ${zf(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = o || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: d, tone: m };
}
function t1({ decoration: n, directory: l = !1 }) {
  if (!n) return null;
  if (l && n.containsChanges) return /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: i, title: o, tone: s } = Pv(n.entry);
  return i ? /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": o, title: o, "data-testid": "file-git-marker", children: i }) : null;
}
const e1 = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Sm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", n1 = `${Sm} group-aria-[checked=false]:text-accent`, a1 = `${Sm} group-aria-checked:text-accent`, l1 = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", r1 = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function i1({
  mode: n,
  onChange: l,
  testId: i = "mode-switch",
  disabled: o = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ et.jsxs(
    "button",
    {
      type: "button",
      className: e1,
      "data-testid": i,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--ui", n1), children: "UI" }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__track", l1), children: /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__thumb", r1) }) }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--cli", a1), children: "CLI" })
      ]
    }
  );
}
const Ya = function(n, l) {
  let s = n;
  const d = wl[l];
  let m = null, f = 0, p = null;
  const y = [], S = {}, b = function(h, x) {
    f = s * 4 + 17, m = (function(w) {
      const C = new Array(w);
      for (let O = 0; O < w; O += 1) {
        C[O] = new Array(w);
        for (let A = 0; A < w; A += 1)
          C[O][A] = null;
      }
      return C;
    })(f), v(0, 0), v(f - 7, 0), v(0, f - 7), z(), k(), N(h, x), s >= 7 && _(h), p == null && (p = X(s, d, y)), H(p, x);
  }, v = function(h, x) {
    for (let w = -1; w <= 7; w += 1)
      if (!(h + w <= -1 || f <= h + w))
        for (let C = -1; C <= 7; C += 1)
          x + C <= -1 || f <= x + C || (0 <= w && w <= 6 && (C == 0 || C == 6) || 0 <= C && C <= 6 && (w == 0 || w == 6) || 2 <= w && w <= 4 && 2 <= C && C <= 4 ? m[h + w][x + C] = !0 : m[h + w][x + C] = !1);
  }, E = function() {
    let h = 0, x = 0;
    for (let w = 0; w < 8; w += 1) {
      b(!0, w);
      const C = Bn.getLostPoint(S);
      (w == 0 || h > C) && (h = C, x = w);
    }
    return x;
  }, k = function() {
    for (let h = 8; h < f - 8; h += 1)
      m[h][6] == null && (m[h][6] = h % 2 == 0);
    for (let h = 8; h < f - 8; h += 1)
      m[6][h] == null && (m[6][h] = h % 2 == 0);
  }, z = function() {
    const h = Bn.getPatternPosition(s);
    for (let x = 0; x < h.length; x += 1)
      for (let w = 0; w < h.length; w += 1) {
        const C = h[x], O = h[w];
        if (m[C][O] == null)
          for (let A = -2; A <= 2; A += 1)
            for (let B = -2; B <= 2; B += 1)
              A == -2 || A == 2 || B == -2 || B == 2 || A == 0 && B == 0 ? m[C + A][O + B] = !0 : m[C + A][O + B] = !1;
      }
  }, _ = function(h) {
    const x = Bn.getBCHTypeNumber(s);
    for (let w = 0; w < 18; w += 1) {
      const C = !h && (x >> w & 1) == 1;
      m[Math.floor(w / 3)][w % 3 + f - 8 - 3] = C;
    }
    for (let w = 0; w < 18; w += 1) {
      const C = !h && (x >> w & 1) == 1;
      m[w % 3 + f - 8 - 3][Math.floor(w / 3)] = C;
    }
  }, N = function(h, x) {
    const w = d << 3 | x, C = Bn.getBCHTypeInfo(w);
    for (let O = 0; O < 15; O += 1) {
      const A = !h && (C >> O & 1) == 1;
      O < 6 ? m[O][8] = A : O < 8 ? m[O + 1][8] = A : m[f - 15 + O][8] = A;
    }
    for (let O = 0; O < 15; O += 1) {
      const A = !h && (C >> O & 1) == 1;
      O < 8 ? m[8][f - O - 1] = A : O < 9 ? m[8][15 - O - 1 + 1] = A : m[8][15 - O - 1] = A;
    }
    m[f - 8][8] = !h;
  }, H = function(h, x) {
    let w = -1, C = f - 1, O = 7, A = 0;
    const B = Bn.getMaskFunction(x);
    for (let K = f - 1; K > 0; K -= 2)
      for (K == 6 && (K -= 1); ; ) {
        for (let I = 0; I < 2; I += 1)
          if (m[C][K - I] == null) {
            let Q = !1;
            A < h.length && (Q = (h[A] >>> O & 1) == 1), B(C, K - I) && (Q = !Q), m[C][K - I] = Q, O -= 1, O == -1 && (A += 1, O = 7);
          }
        if (C += w, C < 0 || f <= C) {
          C -= w, w = -w;
          break;
        }
      }
  }, j = function(h, x) {
    let w = 0, C = 0, O = 0;
    const A = new Array(x.length), B = new Array(x.length);
    for (let J = 0; J < x.length; J += 1) {
      const $ = x[J].dataCount, L = x[J].totalCount - $;
      C = Math.max(C, $), O = Math.max(O, L), A[J] = new Array($);
      for (let at = 0; at < A[J].length; at += 1)
        A[J][at] = 255 & h.getBuffer()[at + w];
      w += $;
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
    const I = new Array(K);
    let Q = 0;
    for (let J = 0; J < C; J += 1)
      for (let $ = 0; $ < x.length; $ += 1)
        J < A[$].length && (I[Q] = A[$][J], Q += 1);
    for (let J = 0; J < O; J += 1)
      for (let $ = 0; $ < x.length; $ += 1)
        J < B[$].length && (I[Q] = B[$][J], Q += 1);
    return I;
  }, X = function(h, x, w) {
    const C = Nf.getRSBlocks(h, x), O = Tf();
    for (let B = 0; B < w.length; B += 1) {
      const K = w[B];
      O.put(K.getMode(), 4), O.put(K.getLength(), Bn.getLengthInBits(K.getMode(), h)), K.write(O);
    }
    let A = 0;
    for (let B = 0; B < C.length; B += 1)
      A += C[B].dataCount;
    if (O.getLengthInBits() > A * 8)
      throw "code length overflow. (" + O.getLengthInBits() + ">" + A * 8 + ")";
    for (O.getLengthInBits() + 4 <= A * 8 && O.put(0, 4); O.getLengthInBits() % 8 != 0; )
      O.putBit(!1);
    for (; !(O.getLengthInBits() >= A * 8 || (O.put(236, 8), O.getLengthInBits() >= A * 8)); )
      O.put(17, 8);
    return j(O, C);
  };
  S.addData = function(h, x) {
    x = x || "Byte";
    let w = null;
    switch (x) {
      case "Numeric":
        w = o1(h);
        break;
      case "Alphanumeric":
        w = s1(h);
        break;
      case "Byte":
        w = c1(h);
        break;
      case "Kanji":
        w = u1(h);
        break;
      default:
        throw "mode:" + x;
    }
    y.push(w), p = null;
  }, S.isDark = function(h, x) {
    if (h < 0 || f <= h || x < 0 || f <= x)
      throw h + "," + x;
    return m[h][x];
  }, S.getModuleCount = function() {
    return f;
  }, S.make = function() {
    if (s < 1) {
      let h = 1;
      for (; h < 40; h++) {
        const x = Nf.getRSBlocks(h, d), w = Tf();
        for (let O = 0; O < y.length; O++) {
          const A = y[O];
          w.put(A.getMode(), 4), w.put(A.getLength(), Bn.getLengthInBits(A.getMode(), h)), A.write(w);
        }
        let C = 0;
        for (let O = 0; O < x.length; O++)
          C += x[O].dataCount;
        if (w.getLengthInBits() <= C * 8)
          break;
      }
      s = h;
    }
    b(!1, E());
  }, S.createTableTag = function(h, x) {
    h = h || 2, x = typeof x > "u" ? h * 4 : x;
    let w = "";
    w += '<table style="', w += " border-width: 0px; border-style: none;", w += " border-collapse: collapse;", w += " padding: 0px; margin: " + x + "px;", w += '">', w += "<tbody>";
    for (let C = 0; C < S.getModuleCount(); C += 1) {
      w += "<tr>";
      for (let O = 0; O < S.getModuleCount(); O += 1)
        w += '<td style="', w += " border-width: 0px; border-style: none;", w += " border-collapse: collapse;", w += " padding: 0px; margin: 0px;", w += " width: " + h + "px;", w += " height: " + h + "px;", w += " background-color: ", w += S.isDark(C, O) ? "#000000" : "#ffffff", w += ";", w += '"/>';
      w += "</tr>";
    }
    return w += "</tbody>", w += "</table>", w;
  }, S.createSvgTag = function(h, x, w, C) {
    let O = {};
    typeof arguments[0] == "object" && (O = arguments[0], h = O.cellSize, x = O.margin, w = O.alt, C = O.title), h = h || 2, x = typeof x > "u" ? h * 4 : x, w = typeof w == "string" ? { text: w } : w || {}, w.text = w.text || null, w.id = w.text ? w.id || "qrcode-description" : null, C = typeof C == "string" ? { text: C } : C || {}, C.text = C.text || null, C.id = C.text ? C.id || "qrcode-title" : null;
    const A = S.getModuleCount() * h + x * 2;
    let B, K, I, Q, J = "", $;
    for ($ = "l" + h + ",0 0," + h + " -" + h + ",0 0,-" + h + "z ", J += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', J += O.scalable ? "" : ' width="' + A + 'px" height="' + A + 'px"', J += ' viewBox="0 0 ' + A + " " + A + '" ', J += ' preserveAspectRatio="xMinYMin meet"', J += C.text || w.text ? ' role="img" aria-labelledby="' + q([C.id, w.id].join(" ").trim()) + '"' : "", J += ">", J += C.text ? '<title id="' + q(C.id) + '">' + q(C.text) + "</title>" : "", J += w.text ? '<description id="' + q(w.id) + '">' + q(w.text) + "</description>" : "", J += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', J += '<path d="', I = 0; I < S.getModuleCount(); I += 1)
      for (Q = I * h + x, B = 0; B < S.getModuleCount(); B += 1)
        S.isDark(I, B) && (K = B * h + x, J += "M" + K + "," + Q + $);
    return J += '" stroke="transparent" fill="black"/>', J += "</svg>", J;
  }, S.createDataURL = function(h, x) {
    h = h || 2, x = typeof x > "u" ? h * 4 : x;
    const w = S.getModuleCount() * h + x * 2, C = x, O = w - x;
    return p1(w, w, function(A, B) {
      if (C <= A && A < O && C <= B && B < O) {
        const K = Math.floor((A - C) / h), I = Math.floor((B - C) / h);
        return S.isDark(I, K) ? 0 : 1;
      } else
        return 1;
    });
  }, S.createImgTag = function(h, x, w) {
    h = h || 2, x = typeof x > "u" ? h * 4 : x;
    const C = S.getModuleCount() * h + x * 2;
    let O = "";
    return O += "<img", O += ' src="', O += S.createDataURL(h, x), O += '"', O += ' width="', O += C, O += '"', O += ' height="', O += C, O += '"', w && (O += ' alt="', O += q(w), O += '"'), O += "/>", O;
  };
  const q = function(h) {
    let x = "";
    for (let w = 0; w < h.length; w += 1) {
      const C = h.charAt(w);
      switch (C) {
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
          x += C;
          break;
      }
    }
    return x;
  }, D = function(h) {
    h = typeof h > "u" ? 2 : h;
    const w = S.getModuleCount() * 1 + h * 2, C = h, O = w - h;
    let A, B, K, I, Q;
    const J = {
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
    let L = "";
    for (A = 0; A < w; A += 2) {
      for (K = Math.floor((A - C) / 1), I = Math.floor((A + 1 - C) / 1), B = 0; B < w; B += 1)
        Q = "█", C <= B && B < O && C <= A && A < O && S.isDark(K, Math.floor((B - C) / 1)) && (Q = " "), C <= B && B < O && C <= A + 1 && A + 1 < O && S.isDark(I, Math.floor((B - C) / 1)) ? Q += " " : Q += "█", L += h < 1 && A + 1 >= O ? $[Q] : J[Q];
      L += `
`;
    }
    return w % 2 && h > 0 ? L.substring(0, L.length - w - 1) + Array(w + 1).join("▀") : L.substring(0, L.length - 1);
  };
  return S.createASCII = function(h, x) {
    if (h = h || 1, h < 2)
      return D(x);
    h -= 1, x = typeof x > "u" ? h * 2 : x;
    const w = S.getModuleCount() * h + x * 2, C = x, O = w - x;
    let A, B, K, I;
    const Q = Array(h + 1).join("██"), J = Array(h + 1).join("  ");
    let $ = "", L = "";
    for (A = 0; A < w; A += 1) {
      for (K = Math.floor((A - C) / h), L = "", B = 0; B < w; B += 1)
        I = 1, C <= B && B < O && C <= A && A < O && S.isDark(K, Math.floor((B - C) / h)) && (I = 0), L += I ? Q : J;
      for (K = 0; K < h; K += 1)
        $ += L + `
`;
    }
    return $.substring(0, $.length - 1);
  }, S.renderTo2dContext = function(h, x) {
    x = x || 2;
    const w = S.getModuleCount();
    for (let C = 0; C < w; C++)
      for (let O = 0; O < w; O++)
        h.fillStyle = S.isDark(C, O) ? "black" : "white", h.fillRect(O * x, C * x, x, x);
  }, S;
};
Ya.stringToBytes = function(n) {
  const l = [];
  for (let i = 0; i < n.length; i += 1) {
    const o = n.charCodeAt(i);
    l.push(o & 255);
  }
  return l;
};
Ya.createStringToBytes = function(n, l) {
  const i = (function() {
    const s = f1(n), d = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const y = d(), S = d(), b = d(), v = String.fromCharCode(p << 8 | y), E = S << 8 | b;
      f[v] = E, m += 1;
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
        let E = 0;
        const k = m.isDark(b, v);
        for (let z = -1; z <= 1; z += 1)
          if (!(b + z < 0 || f <= b + z))
            for (let _ = -1; _ <= 1; _ += 1)
              v + _ < 0 || f <= v + _ || z == 0 && _ == 0 || k == m.isDark(b + z, v + _) && (E += 1);
        E > 5 && (p += 3 + E - 5);
      }
    for (let b = 0; b < f - 1; b += 1)
      for (let v = 0; v < f - 1; v += 1) {
        let E = 0;
        m.isDark(b, v) && (E += 1), m.isDark(b + 1, v) && (E += 1), m.isDark(b, v + 1) && (E += 1), m.isDark(b + 1, v + 1) && (E += 1), (E == 0 || E == 4) && (p += 3);
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
    const S = Math.abs(100 * y / f / f - 50) / 5;
    return p += S * 10, p;
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
}, Nf = (function() {
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
      const S = m[y * 3 + 0], b = m[y * 3 + 1], v = m[y * 3 + 2];
      for (let E = 0; E < S; E += 1)
        p.push(l(b, v));
    }
    return p;
  }, i;
})(), Tf = function() {
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
}, o1 = function(n) {
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
}, s1 = function(n) {
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
}, c1 = function(n) {
  const l = de.MODE_8BIT_BYTE, i = Ya.stringToBytes(n), o = {};
  return o.getMode = function() {
    return l;
  }, o.getLength = function(s) {
    return i.length;
  }, o.write = function(s) {
    for (let d = 0; d < i.length; d += 1)
      s.put(i[d], 8);
  }, o;
}, u1 = function(n) {
  const l = de.MODE_KANJI, i = Ya.stringToBytes;
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
}, Em = function() {
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
}, d1 = function() {
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
}, f1 = function(n) {
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
}, m1 = function(n, l) {
  const i = n, o = l, s = new Array(n * l), d = {};
  d.setPixel = function(y, S, b) {
    s[S * i + y] = b;
  }, d.write = function(y) {
    y.writeString("GIF87a"), y.writeShort(i), y.writeShort(o), y.writeByte(128), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(0), y.writeByte(255), y.writeByte(255), y.writeByte(255), y.writeString(","), y.writeShort(0), y.writeShort(0), y.writeShort(i), y.writeShort(o), y.writeByte(0);
    const S = 2, b = f(S);
    y.writeByte(S);
    let v = 0;
    for (; b.length - v > 255; )
      y.writeByte(255), y.writeBytes(b, v, 255), v += 255;
    y.writeByte(b.length - v), y.writeBytes(b, v, b.length - v), y.writeByte(0), y.writeString(";");
  };
  const m = function(y) {
    const S = y;
    let b = 0, v = 0;
    const E = {};
    return E.write = function(k, z) {
      if (k >>> z)
        throw "length over";
      for (; b + z >= 8; )
        S.writeByte(255 & (k << b | v)), z -= 8 - b, k >>>= 8 - b, v = 0, b = 0;
      v = k << b | v, b = b + z;
    }, E.flush = function() {
      b > 0 && S.writeByte(v);
    }, E;
  }, f = function(y) {
    const S = 1 << y, b = (1 << y) + 1;
    let v = y + 1;
    const E = p();
    for (let H = 0; H < S; H += 1)
      E.add(String.fromCharCode(H));
    E.add(String.fromCharCode(S)), E.add(String.fromCharCode(b));
    const k = Em(), z = m(k);
    z.write(S, v);
    let _ = 0, N = String.fromCharCode(s[_]);
    for (_ += 1; _ < s.length; ) {
      const H = String.fromCharCode(s[_]);
      _ += 1, E.contains(N + H) ? N = N + H : (z.write(E.indexOf(N), v), E.size() < 4095 && (E.size() == 1 << v && (v += 1), E.add(N + H)), N = H);
    }
    return z.write(E.indexOf(N), v), z.write(b, v), z.flush(), k.toByteArray();
  }, p = function() {
    const y = {};
    let S = 0;
    const b = {};
    return b.add = function(v) {
      if (b.contains(v))
        throw "dup key:" + v;
      y[v] = S, S += 1;
    }, b.size = function() {
      return S;
    }, b.indexOf = function(v) {
      return y[v];
    }, b.contains = function(v) {
      return typeof y[v] < "u";
    }, b;
  };
  return d;
}, p1 = function(n, l, i) {
  const o = m1(n, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < n; p += 1)
      o.setPixel(p, f, i(p, f));
  const s = Em();
  o.write(s);
  const d = d1(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function h1({ text: n }) {
  const { size: l, path: i } = W.useMemo(() => {
    const o = Ya(0, "M");
    o.addData(n), o.make();
    const s = o.getModuleCount();
    let d = "";
    for (let m = 0; m < s; m++)
      for (let f = 0; f < s; f++) o.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: s, path: d };
  }, [n]);
  return /* @__PURE__ */ et.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ et.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ et.jsx("path", { d: i, fill: "#000" })
      ]
    }
  );
}
const Nl = W.createContext(""), ys = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function g1({ title: n, children: l, testId: i, ariaLabel: o }) {
  const s = W.useContext(Nl), d = s !== "" && ys(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ et.jsxs("section", { className: s && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": i, "aria-label": o, children: [
      n && /* @__PURE__ */ et.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ et.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ et.jsx(Nl.Provider, { value: d ? "" : s, children: l }) })
    ] })
  );
}
function b1({ title: n, description: l, children: i, testId: o }) {
  const s = W.useContext(Nl);
  return s && !ys(n, s) && !ys(l, s) ? null : /* @__PURE__ */ et.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ et.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ et.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ et.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    i && /* @__PURE__ */ et.jsx("div", { className: "flex shrink-0 items-center gap-2", children: i })
  ] });
}
function v1({ checked: n, onChange: l, testId: i, label: o }) {
  return /* @__PURE__ */ et.jsx(
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
const y1 = () => W.useContext(Nl), x1 = {
  select: Ds,
  selectHost: xv,
  input: wv,
  inputPort: _v,
  inputWide: kv,
  addRow: Sv,
  list: Ev,
  hostRow: Nv,
  name: Tv,
  addr: Cv,
  muted: vv,
  empty: yv,
  primary: Mv,
  danger: Av,
  catalogToggle: bv
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const w1 = 512, Ie = /* @__PURE__ */ new Map(), kl = /* @__PURE__ */ new Map();
function zm(n, l) {
  Ie.delete(n), Ie.set(n, l);
  for (const i of Ie.keys()) {
    if (Ie.size <= w1) break;
    kl.get(i)?.size || Ie.delete(i);
  }
}
function _1(n, l) {
  return Ie.has(n) ? Ie.get(n) : l;
}
function k1(n, l, i) {
  const o = _1(n, i), s = typeof l == "function" ? l(o) : l;
  if (!(Ie.has(n) && Object.is(s, o))) {
    zm(n, s);
    for (const d of [...kl.get(n) ?? []]) d();
  }
}
function S1(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Ie.has(n) || zm(n, l);
  const i = W.useCallback((d) => {
    const m = kl.get(n) ?? /* @__PURE__ */ new Set();
    return kl.set(n, m), m.add(d), () => {
      m.delete(d), m.size || kl.delete(n);
    };
  }, [n]), o = W.useSyncExternalStore(i, () => Ie.get(n)), s = W.useCallback((d) => k1(n, d, l), [n]);
  return [o, s];
}
const E1 = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", z1 = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const N1 = "1.3.0";
let Kr = null;
const T1 = (n) => {
  Kr = n;
};
function _t() {
  const n = (typeof Kr == "function" ? Kr() : Kr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const C1 = (n) => _t().subscribe?.(n) ?? (() => {
}), M1 = Dv;
function A1() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Nm = globalThis.perch?.isMac !== !1, xs = (n) => tv(n, _t().isMac !== !1), j1 = (n) => nv(n), O1 = ({ className: n, ...l } = {}) => jt(lv(l), n), R1 = iv, Tm = (n) => gs(n), Xr = ov, D1 = Cl, H1 = vm, B1 = (n) => bs[n].color, U1 = (n, l) => _t().shortcutFor?.(n, l) ?? null, q1 = (n) => _t().shortcutLabel?.(n) ?? null, oi = (n, l) => _t().command(n, l ?? {}) !== !1, Y1 = (n, l, i) => _t().startSession?.(n, l, i), G1 = globalThis.perch?.pickFolder ? (n) => _t().pickFolder(n) : null;
function Xt(n) {
  const l = W.useRef(n);
  return l.current = n, W.useSyncExternalStore(C1, () => l.current(_t()));
}
const Cm = (n = {}) => Xt((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), L1 = () => Xt((n) => n.hosts()), Q1 = () => Xt((n) => n.sessionFolders());
function V1() {
  const n = Xt((l) => l.addProject?.() ?? K1);
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
const K1 = Object.freeze({ status: "idle" }), Mm = "perch.lastAgentChoice", X1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), Z1 = () => {
  const n = _t().storage?.getItem(Mm);
  return n === "claude" || n === "codex" ? n : "claude";
}, J1 = Object.freeze({ items: [] });
function W1() {
  const n = Xt((l) => l.notifications?.() ?? J1);
  return W.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => _t().command("notification.open", { id: l }),
    dismiss: (l) => _t().command("notification.dismiss", { id: l })
  }), [n]);
}
function F1(n) {
  const l = Xt((s) => s.agentChoices?.(n) ?? X1), [i, o] = W.useState(Z1);
  return W.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: i,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (_t().storage?.setItem(Mm, s), o(s));
    },
    manage: () => _t().command("agents.manage", {})
  }), [l, i]);
}
function I1(n) {
  Ft(() => _t().onRequest?.("add-project", n) ?? void 0, [n]);
}
function $1(n) {
  const l = n.map((i) => ({ id: i.id, parentSessionId: i.parentId, session: i }));
  return Rv(l).map((i) => ({ session: i.session, nested: vs(i, l) }));
}
function P1({ id: n, plain: l, className: i }) {
  const o = Xt((y) => y.session(n));
  if (!o) return null;
  const s = o.state ?? Ov(o), d = bs[s]?.color ?? bs.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? jt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", i) : jt("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", i);
  return W.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    W.createElement("span", { className: jt("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, W.createElement(Am, { provider: m, size: 14 }))
  );
}
function Am({ provider: n, size: l = 14 }) {
  const i = _t().agentIcon?.(n, l) ?? null, o = i?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return W.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": o, ...i && i.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const ty = ({ children: n }) => W.createElement(W.Fragment, null, n);
function ey(n, l) {
  const i = W.useRef(l);
  return i.current = l, Ft(() => {
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
  return ey(n, i);
}, ny = da("session-menu"), ay = da("new-session-menu"), ly = da("confirm");
let jm = null;
const ry = (n) => {
  jm = n;
};
function iy(n) {
  return W.createElement(jm ?? ly, n);
}
function oy({ className: n = Ds, ...l }) {
  return W.createElement(pv, { ...l, className: n });
}
let ws = null;
const sy = (n) => {
  ws = n;
}, cy = da("folder-browser");
function uy(n) {
  return ws ? W.createElement(ws, { ...n, browse: (l) => _t().browse(n.hostId, l) }) : W.createElement(cy, n);
}
const dy = da("instructions"), fy = da("memory"), my = fv;
let Us = null;
const py = (n) => {
  Us = n;
};
function hy(n) {
  if (Us) return W.createElement(by, n);
  const { hostId: l, path: i, className: o } = n, s = W.useRef(null);
  return W.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: jt("worktree-menu__btn", vm, o),
      "data-testid": `worktree-menu-${l}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => _t().openOverlay?.("worktree", { hostId: l, cwd: i, anchor: s.current?.getBoundingClientRect() })
    },
    W.createElement(ym, null)
  );
}
const Om = "Perch did not answer.";
function qr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: Om };
}
function gy(n, l, i = _t()) {
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
const Cf = 5 * 6e4;
function Rm(n, l, i, o = _t()) {
  const s = Date.now() + Cf;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(y);
  }, p = () => {
    if (!d) {
      if (Date.now() >= s) return f();
      gy(n, l, o) && (f(), o.startSession?.(n, l, i));
    }
  }, y = setTimeout(f, Cf);
  m = o.subscribe?.(p) ?? (() => {
  }), p();
}
function by({ hostId: n, path: l, className: i, worktrees: o, request: s, parentChoices: d, emptyAgent: m, ...f }) {
  const [p, y] = W.useState(o), S = (C) => !!_t().coreCan?.(C, n), b = Cm(), v = `${n}:${l}`, E = W.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!S("workspace.nest")) return [];
    const C = b?.projects?.find((B) => B.hostId === n && B.repoPath === l), O = [], A = (B, K) => {
      for (const I of B ?? [])
        K && O.push({ id: I.id, name: I.name, path: I.path }), A(I.children, !0);
    };
    return A(C?.workspaces, !1), O;
  }, [d, b, n, l]), k = n === "local" && S("worktree.job"), z = f.deleteSupported ?? S("worktree.delete"), _ = f.startFromSupported ?? S("worktree.startFrom"), N = Xt((C) => C.emptyWorkspaceAgent?.() ?? void 0), H = m ?? N ?? void 0, j = Xt((C) => C.worktreeMenuRequest?.() ?? null), X = j?.projectKey === v ? j.nonce : null, q = W.useMemo(() => s ?? (X == null ? null : j), [s, X]), [D, h] = W.useState(q);
  Ft(() => {
    q && h(q);
  }, [q]);
  const x = W.useRef({});
  x.current = { background: k, deleteSupported: z };
  const w = W.useMemo(() => {
    const C = (O, A) => _t().ask(O, { hostId: n, repoPath: l, ...A });
    return {
      list: async () => {
        const O = await C("worktree.list", {});
        return O?.type === "worktree.list.result" && y({ worktrees: O.worktrees ?? [], defaultRoot: O.defaultRoot ?? "", baseRef: O.baseRef, refs: O.refs ?? [] }), qr(O);
      },
      create: async ({ branch: O, newBranch: A, path: B, extra: K, agent: I }) => {
        const Q = { branch: O, newBranch: !!A, path: B ?? null, name: K?.name ?? null, startFrom: K?.startFrom ?? null, parentWorkspaceId: K?.parentWorkspaceId ?? null }, { background: J } = x.current, $ = await C(J ? "worktree.job.start" : "worktree.create", Q), L = J ? "worktree.job.started" : "worktree.done";
        if ($?.type !== L) return { error: qr($).error ?? Om };
        const V = J ? $.job?.path : $.path;
        return I && V && Rm(n, V, I), { background: J };
      },
      remove: async (O, A) => {
        const B = await C("worktree.remove", { path: O, force: !!A, deleteBranch: x.current.deleteSupported });
        return { ...qr(B), preservedBranch: B?.type === "worktree.done" ? B.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (O, A) => qr(await C("worktree.branch.delete", { branch: O, expectedHead: A })),
      open: (O) => _t().startSession?.(n, O, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => _t().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return W.createElement(Us, {
    hostId: n,
    cwd: l,
    projectKey: v,
    className: i,
    worktrees: p,
    background: k,
    startFromSupported: _,
    deleteSupported: z,
    parentChoices: E,
    emptyAgent: H,
    request: D,
    actions: w
  });
}
const vy = (n, l) => {
  if (!_t().followPointer?.(n)) return;
  const i = l.items();
  for (const o of i) o.getBoundingClientRect();
  i[0]?.parentElement?.getBoundingClientRect(), Fb(n, l);
}, yy = () => Xt((n) => n.workspaceTabs());
function xy({ content: n }) {
  return W.createElement("pre", { className: "m-0 min-h-0 flex-1 overflow-auto p-3 whitespace-pre-wrap text-fg" }, n);
}
const wy = () => null, _y = /* @__PURE__ */ new Map(), ky = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function Sy(n, l = {}) {
  const i = Xt((f) => f.workspaceFiles(n)), o = !!l.git, s = i.git?.decorations, d = W.useMemo(() => o && s?.length ? new Map(s) : _y, [s, o]), m = W.useMemo(() => Object.fromEntries(ky.map((f) => [f, (...p) => (_t().filesDo(f, n, ...p), null)])), [n]);
  return W.useMemo(() => ({
    workspace: i.workspace,
    connected: i.connected,
    trees: i.trees,
    documents: i.documents,
    previews: i.previews,
    search: i.search ?? void 0,
    wrap: i.wrap,
    git: { ...i.git, decorations: d },
    actions: m
  }), [i, d, m]);
}
const Ey = () => Xt((n) => n.statusLine()), zy = () => Xt((n) => n.zoom()), Ny = () => Xt((n) => n.paneLook()), Ty = () => Xt((n) => n.keybindings?.() ?? []), Cy = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function My(n) {
  const l = !!n?.keepFresh, i = Xt((s) => s.statusLine?.().connected ?? !1), o = Xt((s) => s.planUsage?.() ?? Cy);
  return Ft(() => {
    if (!l || !i) return;
    let s;
    const d = () => {
      _t().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, i]), o;
}
const Ay = () => _t().command("usage.get", { force: !0 }), jy = (n) => _t().command("usage.redeemReset", { accountId: n }), Oy = () => oi("app.zoom_reset"), Ry = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Dy = (n, l, i) => _t().beginTabDrag?.(n, l, i);
function Hy(n) {
  Ft(() => _t().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const By = (n) => oi("browser.open", { workspaceId: n }), Uy = (n, l) => oi("file.open", { workspaceId: n, path: l }), qy = () => null, Yy = () => null, Gy = da("new-file");
function Ly(n) {
  return W.createElement(Jv, { ...n, perch: _t() });
}
function Qy(n, l) {
  const i = n.selection(l);
  if (i) return i;
  const o = n.value(l), s = o.split(`
`).length - (o.endsWith(`
`) && o.length ? 1 : 0);
  return { text: o, startLine: 1, endLine: Math.max(1, s) };
}
function Vy({ onGo: n, onClose: l }) {
  const [i, o] = W.useState(""), s = (d) => {
    d?.preventDefault?.();
    const [m, f] = i.split(":").map((p) => Number.parseInt(p, 10));
    Number.isFinite(m) ? n(m, Number.isFinite(f) ? f : 1) : l();
  };
  return W.createElement(
    "div",
    { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    W.createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    W.createElement("input", {
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
    W.createElement("button", { type: "button", className: Cl, onClick: s }, "OK")
  );
}
function Ky({ value: n, onChange: l, onSave: i, onCaret: o, readOnly: s, wrap: d, label: m, path: f, docKey: p, onAskAgent: y, ref: S }) {
  const b = _t().editor, v = W.useRef(null);
  v.current = { onChange: l, onSave: i, onCaret: o, onAskAgent: y };
  const [E, , k] = String(p).split("\0"), z = !!b && k !== void 0 && /^\d+$/.test(k), _ = Xt((w) => z ? w.workspaceFiles(E)?.carets?.[p] ?? null : null);
  Ft(() => {
    _ && v.current.onCaret?.({ line: _.line, col: _.col });
  }, [_?.line, _?.col]);
  const N = W.useRef(n), [H, j] = W.useState(null), [X, q] = W.useState(!1), D = () => {
    if (!b || !v.current.onAskAgent) return;
    const { text: w, startLine: C, endLine: O } = Qy(b, p);
    v.current.onAskAgent(w, C, O);
  };
  if (W.useImperativeHandle(S, () => ({
    openGoto: () => q(!0),
    focus: () => b?.focus(p),
    askAgent: D
  }), [p]), Zr(() => {
    if (!b) return;
    b.open(p, { path: f, value: n, readonly: !!s, wrap: !!d, label: m }), N.current = n;
    const w = b.watch(p, (C) => {
      for (const O of C)
        if (O.type === "change") {
          const A = b.value(p);
          N.current = A, v.current.onChange?.(A);
        } else O.type === "caret" ? v.current.onCaret?.({ line: O.line, col: O.col }) : O.type === "save" ? v.current.onSave?.() : O.type === "goto" ? q(!0) : O.type === "contextmenu" && j({ x: O.x, y: O.y });
    });
    return () => {
      w(), b.park(p);
    };
  }, [p]), Ft(() => {
    !b || z || n === N.current || (N.current = n, b.setValue(p, n, { external: !0 }));
  }, [p, n]), Ft(() => {
    b?.setReadonly(p, !!s);
  }, [p, s]), Ft(() => {
    b?.setWrap(p, !!d);
  }, [p, d]), !b)
    return W.createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": m, value: n, readOnly: s, onChange: (w) => l?.(w.target.value) });
  const h = (w) => () => {
    j(null), w(), b.focus(p);
  }, x = H ? !!b.selection(p) : !1;
  return W.createElement(
    "div",
    { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": m },
    X && W.createElement(Vy, {
      onGo: (w, C) => {
        q(!1), b.goTo(p, w, C), b.focus(p);
      },
      onClose: () => {
        q(!1), b.focus(p);
      }
    }),
    W.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    H && W.createElement(gv, {
      x: H.x,
      y: H.y,
      readOnly: !!s,
      canUndo: b.canUndo(p),
      canRedo: b.canRedo(p),
      hasSelection: x,
      onClose: () => j(null),
      actions: {
        undo: h(() => b.undo(p)),
        redo: h(() => b.redo(p)),
        cut: h(() => b.cut(p)),
        copy: h(() => b.copy(p)),
        paste: h(() => b.paste(p)),
        selectAll: h(() => b.selectAll(p)),
        find: h(() => b.openSearch(p, !1)),
        replace: h(() => b.openSearch(p, !0)),
        gotoLine: () => {
          j(null), q(!0);
        },
        ...y ? { askAgent: () => {
          j(null), D();
        } } : {}
      }
    })
  );
}
const Xy = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Zy(n) {
  const l = Xt((i) => i.browserPages?.(n) ?? Xy);
  return W.useMemo(() => {
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
function Jy({ pageId: n, active: l }) {
  const i = `drawer
${n}`;
  return Ft(() => {
    l && _t().command("browser.focus", { key: i });
  }, [l, i]), W.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": i,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const sx = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Am,
  BrowserPage: Jy,
  Chevron: Bs,
  CloseIcon: uv,
  CodeEditor: Ky,
  ConfirmDialog: iy,
  Dialog: my,
  EllipsisIcon: sv,
  FileAsset: Ly,
  FileEntryMenu: wy,
  FileIcon: Iv,
  FolderBrowser: uy,
  GearIcon: cv,
  GitMarker: t1,
  HostStateDot: dv,
  InstructionsDialog: dy,
  MarkdownPreview: xy,
  MemoryDialog: fy,
  ModeSwitch: i1,
  NewFilePrompt: Gy,
  NewSessionMenu: ay,
  PageIcon: Hv,
  PlusIcon: ym,
  QrCode: h1,
  Select: oy,
  SessionDot: P1,
  SessionMenu: ny,
  SettingRow: b1,
  SettingsGroup: g1,
  SettingsQuery: Nl,
  Slot: ty,
  Submenu: jv,
  Switch: v1,
  TabDragLayer: Yy,
  TabMenu: qy,
  WorktreeMenu: hy,
  agentStateColor: B1,
  anchoredPopoverStyle: M1,
  assetKind: km,
  beginReorderDrag: vy,
  beginTabDrag: Dy,
  bindHost: T1,
  buttonClass: R1,
  cn: jt,
  drawConfirmationsInPlace: ry,
  drawFolderBrowserInPlace: sy,
  drawWorktreeInPlace: py,
  ghostButton: D1,
  glassClass: E1,
  iconButton: H1,
  isMac: Nm,
  keyLabel: xs,
  menuDividerClass: Xr,
  menuItemClass: Tm,
  menuPanel: ii,
  nestSessions: $1,
  newId: A1,
  openBrowserTab: By,
  openFileTab: Uy,
  pickFolder: G1,
  redeemUsageReset: jy,
  refreshUsage: Ay,
  resetZoom: Oy,
  rowActionClass: O1,
  runCommand: oi,
  segmentClass: j1,
  settingsClass: x1,
  shortcutFor: U1,
  shortcutLabel: q1,
  startPaneWhenReady: Rm,
  startSession: Y1,
  tabStateClass: Ry,
  tapButtonClass: z1,
  useAddProject: V1,
  useAddProjectRequest: I1,
  useAgentChoices: F1,
  useBrowserPages: Zy,
  useDismissOnOutsideClick: _m,
  useHostSnapshot: Xt,
  useHosts: L1,
  useKeybindings: Ty,
  useNavigation: Cm,
  useNewTabRequest: Hy,
  useNotifications: W1,
  usePaneLook: Ny,
  usePlanUsage: My,
  useResourceState: S1,
  useSessionFolders: Q1,
  useSettingsQuery: y1,
  useStatusLine: Ey,
  useWorkspaceFiles: Sy,
  useWorkspaceTabs: yy,
  useZoom: zy,
  version: N1
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
const qs = {
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
  qs[n] = (l, i) => l[n](i);
const cx = Object.keys(qs);
function ns(n, l) {
  for (const [i, o] of Object.entries(l)) {
    const s = qs[i];
    if (!s) throw new Error(`the description key ${i} has no GPUI builder`);
    o != null && (n = s(n, o));
  }
  return n;
}
const oa = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Mf = /* @__PURE__ */ new WeakSet(), as = /* @__PURE__ */ new WeakSet();
function Af(n, l, i) {
  const o = n.pressed, s = oa(i);
  return o && o.x === s.clientX && o.y === s.clientY ? o.id : l;
}
function Wy(n, l, i) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && ei.has(n.group) || i)) return null;
  const o = n.meta?.attrs["data-testid"];
  return o ? `~${n.id}:${o}` : `~${n.id}`;
}
const Dm = (n, l = !1) => (n.children ?? []).some((i) => i.kind === "text" ? !l || /\s/.test(String(i.text ?? "").trim()) : i.kind === "div" && i.style?.flex_direction !== "row" && i.style?.whitespace !== "nowrap" && Dm(i, !0)), Te = (n) => n.style?.display !== "hidden";
let ei = /* @__PURE__ */ new Set(), _s = null;
function Hm(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: i, style: o } of n.group_hover ?? []) "display" in o && l.add(i);
  for (const i of n.children ?? []) i.kind !== "text" && Hm(i, l);
  return l;
}
function ks(n, l, i, o, s = !1, d = !1, m = null, f = {}, p = !1, y = /* @__PURE__ */ new Map(), S = null) {
  if (n.kind === "text") return y.get(n)?.text ?? n.text;
  const b = Mf.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (S = null), m = n.style.text_color ?? m;
  const v = !!n.hover?.text_color && Ym(n), E = n.group ?? (v ? `~g${n.id}` : null);
  v && (S = { group: E, color: n.hover.text_color }), f = { ...f };
  for (const A of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[A] !== void 0 && (f[A] = n.style[A]);
  const k = new Set(n.events ?? []), z = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !d && !n.pointer_none && n.style.position === "absolute" ? _s : null, _ = z ? z.count++ : -1;
  s && (_s = z);
  let N;
  if (n.kind === "image" && !n.markup ? N = l.image(n.src) : N = l.div(), n.kind === "engine" && (N = N.child(o.engine ? o.engine(n.engine, n.key) : l.div())), n.markup && n.kind === "svg" && S && S.color !== m) {
    const { group: A, color: B } = S, K = () => l.div().absolute().top(0).left(0).size_full();
    N = N.child(K().group_hover(A, (I) => I.invisible()).child(o.icon(`~icon-${n.id}`, n.markup, m))).child(K().invisible().group_hover(A, (I) => I.visible()).child(o.icon(`~icon-${n.id}-hover`, n.markup, B)));
  } else n.markup && (N = N.child(o.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const H = Wy(n, k, !!z);
  if (H && (N = N.id(H)), n.measure && (N = N.measure(n.measure)), n.name && N.also_named) for (const A of n.also ?? []) N = N.also_named(A);
  N = ns(N, { ...n.style, ...y.get(n) });
  const j = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && j && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && Dm(n) && (N = N.min_w(0));
  for (const A of ["hover", "focus", "active"]) n[A] && (N = N[A]((B) => ns(B, n[A])));
  E && (N = N.group(E));
  for (const { group: A, style: B } of n.group_hover ?? []) {
    const { display: K, ...I } = B;
    Object.keys(I).length && (N = N.group_hover(A, (Q) => ns(Q, I)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const A = i.document?.scrollTarget, B = A ? (n.children ?? []).filter(Te).findIndex((K) => qm(K, A.id)) : -1;
    if (B >= 0 && (i.scroller ?? n.id) === n.id && (i.document.scrollTarget = null, i.scroller = n.id, l.scroll.scroll_to_item(B)), i.scroller ??= n.id, i.scroller === n.id && i.document) {
      N = N.track_scroll(l.scroll);
      const K = (n.children ?? []).filter(Te).map((I) => I.id);
      i.document.itemBounds = (I) => K.includes(I) ? l.scroll.item_bounds?.(K.indexOf(I)) ?? null : null;
    }
  }
  const X = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", q = s && !n.pointer_none || n.blocks_pointer;
  if ((X && as.has(n) || q) && (N = N.on_scroll_wheel((A, B) => B.stop_propagation?.())), X && k.has("scroll") && (N = N.on_scroll_wheel((A, B) => {
    i.dispatch(n.id, "scroll", {}), B.notify();
  })), X || as.has(n)) for (const A of n.children ?? []) A.kind !== "text" && as.add(A);
  n.kind === "input" && !n.disabled && (N = N.on_mouse_down("left", (A, B) => {
    A.bounds && i.setBounds(n.id, A.bounds), i.focus(n.id), B.notify();
  }));
  const D = n.kind === "input" ? n : n.meta?.tag === "label" ? Um(n) : null;
  D && !D.disabled && /^(checkbox|radio)$/.test(D.input_type) && (N = N.on_click((A, B) => {
    B.stop_propagation?.(), i.toggle(D.id), B.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((A) => k.has(A));
  if (h || b) for (const A of n.children ?? []) A.kind !== "text" && Mf.add(A);
  if (h && (N = N.on_mouse_down("left", (A, B) => {
    B.stop_propagation?.(), A.bounds && i.setBounds(n.id, A.bounds);
    const K = { ...oa(A), button: 0, buttons: 1, detail: A.click_count }, I = Af(i, n.id, A);
    i.pressed = null, i.dispatch(I, "pointerdown", { ...K, pointerType: "mouse" }), i.dispatch(I, "mousedown", K) && i.pressFocus?.(I), B.notify();
  }), N = N.on_mouse_down("right", (A, B) => {
    B.stop_propagation?.(), A.bounds && i.setBounds(n.id, A.bounds);
    const K = Af(i, n.id, A);
    i.pressed = null, i.dispatch(K, "contextmenu", { ...oa(A), button: 2 }), B.notify();
  }), N = N.on_mouse_up("left", (A, B) => {
    B.stop_propagation?.();
    const K = { ...oa(A), button: 0 };
    i.dispatch(n.id, "pointerup", { ...K, pointerType: "mouse" }), i.dispatch(n.id, "mouseup", K), B.notify();
  }), N = N.on_click((A, B) => {
    i.dispatch(n.id, A.click_count === 2 && k.has("double_click") ? "dblclick" : "click", { detail: A.click_count, button: 0 }), B.notify();
  })), n.blocks_pointer && !h)
    for (const A of ["left", "right"]) N = N.on_mouse_down(A, (B, K) => K.stop_propagation?.());
  else if (b && !h)
    for (const A of ["left", "right"])
      N = N.on_mouse_down(A, (B) => {
        const K = oa(B);
        (i.pressed?.x !== K.clientX || i.pressed?.y !== K.clientY) && (i.pressed = { id: n.id, x: K.clientX, y: K.clientY });
      });
  if (k.has("mouse_move") && (N = N.on_mouse_move((A) => {
    i.dispatch(n.id, "pointermove", { ...oa(A), pointerType: "mouse" });
  })), n.track_hover && ei.has(n.group) && (N = N.on_hover((A, B) => {
    i.hover(n.id, A), B.notify();
  })), z && (N = N.on_mouse_down_out((A, B) => {
    const K = oa(A), I = `${K.clientX},${K.clientY}`;
    z.at !== I && (z.at = I, z.hits = /* @__PURE__ */ new Set()), z.hits.add(_), !(z.hits.size < z.count) && (z.at = null, i.dispatch(i.document.body.id, "pointerdown", { ...K, pointerType: "mouse" }), i.dispatch(i.document.body.id, "mousedown", K), B.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const A = n.value ? String(n.value) : String(n.placeholder ?? "");
    let B = l.div().whitespace_nowrap().overflow_x_hidden();
    const K = ca(f);
    K && (B = B.h(K)), !n.value && m && (B = B.text_color(Iy(m))), A && (N = N.child(B.child(n.input_type === "password" && n.value ? "•".repeat([...A].length) : A))), n.field_w && (N = N.child(l.div().w(n.field_w).h(0)));
  }
  const x = f.whitespace === "nowrap" ? ca(f) : null, w = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let C = !n.range_name;
  const O = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const A of (n.children ?? []).filter(Te)) {
    const B = A.style?.flex_basis;
    O && A.style.flex_grow > 0 && (B === 0 || typeof B == "string" && B.endsWith("%")) && y.set(A, { ...y.get(A), flex_basis: "auto" });
    let K = ks(A, l, i, o, !1, d, m, f, w && A.style?.position !== "absolute", y, S);
    const I = !C && (A.kind === "text" || !A.meta), Q = A.kind === "text" ? y.get(A)?.h ?? x : null, J = A.kind === "text" ? y.get(A)?.w : void 0;
    if (I || Q || J !== void 0) {
      let $ = l.div();
      I && ($ = $.id(n.range_name)), I && !w && n.style.display === "flex" && ($ = $[`self_${Fy[f.text_align] ?? "start"}`]().max_w("100%")), Q && ($ = $.h(Q)), J !== void 0 && ($ = $.w(J).flex_none().whitespace_nowrap()), K = $.child(K), C ||= I;
    }
    N = N.child(K);
  }
  return N;
}
const Fy = { center: "center", right: "end", end: "end" };
function Iy(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const i = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(i / 2).toString(16).padStart(2, "0")}`;
}
const Bm = /^(?:[!-,.-~]+|\S)$/u, Um = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const i = l.kind === "text" ? null : Um(l);
    if (i) return i;
  }
  return null;
}, qm = (n, l) => n.id === l || (n.children ?? []).some((i) => i.kind !== "text" && qm(i, l)), Ym = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Ym(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function ux(n, l, i, o, s = 0, d = !1) {
  const m = [n.root, ...n.overlays];
  ei = /* @__PURE__ */ new Set(), _s = null;
  for (const S of m) Hm(S, ei);
  const f = s > 0 ? lx(m, s) : /* @__PURE__ */ new Map();
  s > 0 && o.measure && $y(m, s, o.measure, f), nx(m, f), ex(m, f), o.measure && tx(m, o.measure, f);
  let p = l.div().relative().size_full().child(ks(n.root, l, i, o, !1, !1, null, {}, !1, f)), y = d && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const S of n.overlays) y = y.child(ks(S, l, i, o, !0, !1, null, {}, !1, f));
  return y === p ? p : p.child(y);
}
function $y(n, l, i, o) {
  const s = (k, z) => o.set(k, { ...o.get(k), ...z }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(k, z, _) {
    if (k.kind === "text") {
      if (!(z.whitespace === "nowrap" || Bm.test(k.text)) || z.text_ellipsis || _ || typeof z.text_size != "number") return NaN;
      const h = i(k.text, { size: z.text_size, weight: z.font_weight ?? 400, family: z.font_family ?? ".SystemUIFont", italic: !!z.italic });
      return Number.isFinite(h) ? h : NaN;
    }
    if (!Te(k) || k.kind === "input" || k.kind === "engine" || k.markup) return y(k);
    const N = { ...z };
    for (const D of f) k.style[D] !== void 0 && (N[D] = k.style[D]);
    N.text_ellipsis = !!k.style.text_ellipsis, m.set(k, N);
    const H = k.style, j = (k.children ?? []).filter(Le), X = j.map((D) => p(D, N, _ || !!k.tabular));
    let q = y(k);
    if (!Number.isFinite(q) && H.w === void 0) {
      const D = j.map((x, w) => X[w] + (x.kind === "text" ? 0 : ot(x.style.ml) + ot(x.style.mr)));
      let h;
      j.length ? Re(k) ? h = j.some((x) => x.kind !== "text" && x.style.flex_grow > 0) || H.flex_wrap === "wrap" ? NaN : D.reduce((x, w) => x + w, 0) + ot(H.gap_x) * (j.length - 1) : h = Math.max(...D) : h = 0, q = h + ot(H.pl) + ot(H.pr) + ot(H.border_l) + ot(H.border_r), typeof H.min_w == "number" && (q = Math.max(q, H.min_w)), typeof H.max_w == "number" && (q = Math.min(q, H.max_w));
    }
    return d.set(k, q), q;
  }
  const y = (k) => typeof k.style?.w == "number" ? k.style.w : NaN, S = () => ({ exact: 0, laid: 0 }), b = (k, z) => {
    if (!Number.isFinite(z))
      return Object.assign(k, S()), NaN;
    k.exact += z;
    const _ = Math.round(k.exact * l + 1e-9) / l, N = _ - k.laid;
    return k.laid = _, N;
  }, v = (k) => Re(k) && k.style.flex_wrap !== "wrap" && (k.style.justify ?? "start") === "start";
  function E(k) {
    if (!k || k.kind === "text" || !Te(k)) return;
    const z = (k.children ?? []).filter(Le);
    if (v(k) && z.length > 1) {
      const _ = ot(k.style.gap_x), N = S(), H = !(_ && z.some((j) => j.kind === "text" || !Number.isFinite(ot(j.style.ml))));
      s(k, { border_l: b(N, ot(k.style.border_l)), pl: b(N, ot(k.style.pl)) }), H && _ && s(k, { gap_x: 0 }), z.forEach((j, X) => {
        const q = (X && H ? _ : 0) + (j.kind === "text" ? 0 : ot(j.style.ml));
        if (j.kind === "text")
          q && Object.assign(N, S());
        else {
          const w = b(N, q);
          Number.isFinite(w) && s(j, { ml: w });
        }
        const D = j.kind === "text" ? m.get(k) ?? {} : null, h = j.kind === "text" ? p(j, D, !!k.tabular) : d.get(j);
        if ((j.kind === "text" || !(j.style.flex_grow > 0)) && Number.isFinite(h)) {
          const w = { w: b(N, h) };
          j.kind !== "text" && typeof j.style.w != "number" && j.style.min_w === void 0 && (w.whitespace = "nowrap", w.flex_shrink = 0), s(j, w);
        } else Object.assign(N, S());
        if (j.kind !== "text") {
          const w = b(N, ot(j.style.mr));
          Number.isFinite(w) && s(j, { mr: w });
        }
      });
    }
    for (const _ of k.children ?? []) _.kind !== "text" && E(_);
  }
  for (const k of n)
    k && (p(k, {}, !1), E(k));
}
const Py = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function tx(n, l, i) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (f) => typeof f == "number" ? f : 0, d = (f, p) => p && ni(p) && !Re(p) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(p.style.items), m = (f, p, y, S) => {
    if (!f || f.kind === "text" || !Te(f)) return;
    const b = f.style;
    let v = typeof b.w == "number" ? b.w : b.w === "100%" ? y : d(f, p) ? y - s(b.ml) - s(b.mr) : NaN;
    typeof b.max_w == "number" && (v = Math.min(v, b.max_w));
    const E = v - s(b.pl) - s(b.pr) - s(b.border_l) - s(b.border_r), k = { ...S };
    for (const _ of o) b[_] !== void 0 && (k[_] = b[_]);
    const z = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(E) && E > 0 && typeof k.text_size == "number" && z.length && z.every((_) => _.kind === "text")) {
      const _ = { size: k.text_size, weight: k.font_weight ?? 400, family: k.font_family ?? ".SystemUIFont", italic: !!k.italic }, N = (X) => l(X.trimEnd(), _) <= E + 0.01;
      let H = 0;
      for (const X of z) {
        const q = [];
        for (const h of X.text.split(`
`)) {
          let x = "";
          for (const w of h.split(Py)) {
            if (N(x + w)) {
              x += w;
              continue;
            }
            x && q.push(x.trimEnd()), x = "";
            for (const C of w)
              x && !N(x + C) && (q.push(x), x = ""), x += C;
          }
          q.push(x.trimEnd());
        }
        const D = q.join(`
`);
        q.every((h) => !h || N(h)) ? D !== X.text && i.set(X, { ...i.get(X), text: D }) : H = NaN, H += q.length;
      }
      const j = ca(k);
      Number.isFinite(H) && j && b.h === void 0 && z.length === 1 && i.set(f, { ...i.get(f), h: H * j + s(b.pt) + s(b.pb) + s(b.border_t) + s(b.border_b) });
    }
    for (const _ of z) m(_, f, Re(f) ? NaN : E, k);
  };
  for (const f of n) m(f, null, NaN, {});
}
function ex(n, l) {
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
function nx(n, l) {
  const i = l.heights ?? /* @__PURE__ */ new Map(), o = (p) => i.get(p), s = (p) => {
    const y = o(p);
    if (Number.isFinite(y)) return y;
    if (p.kind === "text" || !Te(p)) return 0;
    const S = p.style, b = typeof S.min_h == "number" ? S.min_h : 0, v = (p.children ?? []).filter(Le), E = v.map((_) => s(_) + (_.kind === "text" ? 0 : Math.max(0, ot(_.style.mt) || 0) + Math.max(0, ot(_.style.mb) || 0))), k = v.length ? Re(p) ? Math.max(...E) : E.reduce((_, N) => _ + N, 0) + (S.display === "flex" ? (ot(S.gap_y) || 0) * (v.length - 1) : 0) : 0, z = [S.pt, S.pb, S.border_t, S.border_b].reduce((_, N) => _ + (ot(N) || 0), 0);
    return Math.max(b, k + z);
  }, d = (p) => !(p.children ?? []).filter(Le).length || Re(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, y) => {
    const S = p.style;
    if (typeof S.h == "number") return S.h;
    if (typeof S.max_h == "number") return S.max_h;
    if (!y || !ni(y) || Re(y)) return NaN;
    const b = y.style, v = typeof b.h == "number" ? b.h : typeof b.max_h == "number" ? b.max_h : NaN, E = (y.children ?? []).filter(Le);
    let k = 0;
    for (const _ of E) {
      if (_ === p) continue;
      const N = o(_);
      if (!Number.isFinite(N)) return NaN;
      k += N + (_.kind === "text" ? 0 : ot(_.style.mt) + ot(_.style.mb));
    }
    const z = b.display === "flex" ? ot(b.gap_y) * Math.max(0, E.length - 1) : 0;
    return v - ot(b.pt) - ot(b.pb) - ot(b.border_t) - ot(b.border_b) - k - z - ot(S.mt) - ot(S.mb);
  }, f = (p, y) => {
    if (!(!p || p.kind === "text" || !Te(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const S = d(p), b = m(p, y);
        Number.isFinite(S) && Number.isFinite(b) && S > b + 0.01 && l.set(p, { ...l.get(p), pr: ot(p.style.pr) + p.scrollbar });
      }
      for (const S of p.children ?? []) f(S, p);
    }
  };
  for (const p of n) f(p, null);
}
const ax = ["text_size", "line_height", "whitespace", "text_ellipsis"], ot = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, ni = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Le = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function lx(n, l) {
  const i = /* @__PURE__ */ new Map(), o = (z, _) => i.set(z, { ...i.get(z), ...Object.fromEntries(Object.entries(_).filter(([, N]) => Number.isFinite(N))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(z, _) {
    if (z.kind === "text") return _.whitespace === "nowrap" || Bm.test(z.text) ? ca(_) ?? NaN : NaN;
    const N = { ..._ };
    for (const D of ax) z.style[D] !== void 0 && (N[D] = z.style[D]);
    d.set(z, N);
    const H = z.style, j = (z.children ?? []).filter(Le), X = j.map((D) => m(D, N));
    let q;
    if (H.h !== void 0 && H.h !== "auto") q = ot(H.h);
    else if (z.kind === "engine") q = NaN;
    else if (z.kind === "input")
      q = (z.input_type === "textarea" || z.input_type === "select" ? NaN : ca(N) ?? NaN) + ot(H.pt) + ot(H.pb) + ot(H.border_t) + ot(H.border_b), H.min_h !== void 0 && (q = Math.max(q, ot(H.min_h)));
    else {
      const D = j.map((x, w) => (x.kind === "text" ? 0 : ot(x.style.mt) + ot(x.style.mb)) + X[w]);
      let h;
      if (Re(z)) h = H.flex_wrap === "wrap" ? NaN : H.items === "baseline" ? p(j, X, N) : Math.max(0, ...D);
      else if (ni(z)) {
        const x = j.some((C) => C.kind !== "text" && (C.style.flex_grow > 0 || C.style.flex_basis !== void 0)), w = H.display !== "flex" && j.some((C) => C.kind !== "text" && (ot(C.style.mt) || ot(C.style.mb)));
        h = x || w ? NaN : D.reduce((C, O) => C + O, 0) + (H.display === "flex" ? ot(H.gap_y) * Math.max(0, j.length - 1) : 0);
      } else h = NaN;
      q = h + ot(H.pt) + ot(H.pb) + ot(H.border_t) + ot(H.border_b), H.min_h !== void 0 && (q = Math.max(q, ot(H.min_h))), H.max_h !== void 0 && (q = Math.min(q, ot(H.max_h)));
    }
    return s.set(z, q), q;
  }
  const f = (z) => (ca(z) - (Ir + If) * z.text_size) / 2 + Ir * z.text_size;
  function p(z, _, N) {
    let H = 0, j = 0;
    for (const [X, q] of z.entries()) {
      const D = q.kind === "text" ? N : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Le).every((C) => C.kind === "text")) || !Number.isFinite(_[X]) || typeof D.text_size != "number") return NaN;
      const x = q.kind === "text" ? {} : q.style, w = ot(x.mt) + ot(x.border_t) + ot(x.pt) + f(D);
      H = Math.max(H, w), j = Math.max(j, ot(x.mt) + _[X] + ot(x.mb) - w);
    }
    return H + j;
  }
  const y = () => ({ exact: 0, laid: 0 }), S = (z, _) => {
    if (!Number.isFinite(_))
      return Object.assign(z, y()), NaN;
    z.exact += _;
    const N = Math.round(z.exact * l + 1e-9) / l, H = N - z.laid;
    return z.laid = N, H;
  };
  function b(z) {
    if (!(z.kind === "text" || !Te(z))) {
      for (const _ of (z.children ?? []).filter((N) => N.kind !== "text" && Te(N) && N.style.position === "absolute")) b(_);
      if (ni(z) && !Re(z)) {
        const _ = y();
        o(z, { border_t: S(_, ot(z.style.border_t)), pt: S(_, ot(z.style.pt)) }), v(z, _);
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
        Number.isFinite(q) ? o(j, { h: S(_, q) }) : Object.assign(_, y());
        return;
      }
      if (o(j, { mt: S(_, (X ? H : 0) + ot(j.style.mt)) }), Number.isFinite(s.get(j))) k(j, _);
      else if (E(j)) {
        const q = j.style;
        o(j, { border_t: S(_, ot(q.border_t)), pt: S(_, ot(q.pt)) }), o(j, { pb: S(_, ot(q.pb)), border_b: S(_, ot(q.border_b)) });
      } else
        b(j), Object.assign(_, y());
      o(j, { mb: S(_, ot(j.style.mb)) });
    }), !0;
  }
  function E(z) {
    const _ = z.style, N = (z.children ?? []).filter(Le), H = ca(d.get(z) ?? {});
    return z.kind === "div" && !Re(z) && N.length > 0 && N.every((j) => j.kind === "text") && Number.isInteger(H) && [_.h, _.min_h, _.max_h].every((j) => j === void 0 || j === "auto");
  }
  function k(z, _) {
    const N = z.style;
    for (const D of (z.children ?? []).filter((h) => h.kind !== "text" && Te(h) && h.style.position === "absolute")) b(D);
    const H = _.laid, j = _.exact;
    o(z, { border_t: S(_, ot(N.border_t)), pt: S(_, ot(N.pt)) });
    const X = N.h !== void 0 && N.h !== "auto", q = s.get(z) - ot(N.pt) - ot(N.pb) - ot(N.border_t) - ot(N.border_b);
    if (z.kind === "input")
      X || S(_, q);
    else if (Re(z) || X && (N.justify ?? "start") !== "start") {
      for (const D of (z.children ?? []).filter(Le)) D.kind !== "text" && b(D);
      X || S(_, q);
    } else !v(z, _) && !X && S(_, q);
    if (X) {
      _.exact = j + s.get(z), _.laid = Math.round(_.exact * l + 1e-9) / l, o(z, { h: _.laid - H });
      return;
    }
    o(z, { pb: S(_, ot(N.pb)), border_b: S(_, ot(N.border_b)) }), o(z, { h: _.laid - H });
  }
  for (const z of n)
    m(z, {}), b(z);
  return Object.defineProperty(i, "heights", { value: s }), i;
}
const dx = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }] };
export {
  dx as NAMED_ELEMENTS,
  C0 as React,
  fg as SCHEMA,
  cx as STYLE_KEYS,
  ux as describeToGpui,
  rx as jsxRuntime,
  ix as mount,
  ox as reactDom,
  sx as sdk
};
